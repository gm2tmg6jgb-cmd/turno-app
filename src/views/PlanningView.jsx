import { useState } from "react";
import { TURNI, REPARTI, MOTIVI_ASSENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { getSlotForGroup } from "../lib/shiftRotation";

export default function PlanningView({ dipendenti, setDipendenti, presenze = [], turnoCorrente }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const result = [];
        for (let i = 1; i <= days; i++) {
            const d = new Date(year, month, i);
            const isRest = d.getDay() === 0; // domenica = riposo
            result.push({
                date: d.toISOString().split("T")[0],
                day: i,
                weekday: d.toLocaleDateString("it-IT", { weekday: "narrow" }),
                isWeekend: isRest
            });
        }
        return result;
    };

    const days = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    const todayStr = new Date().toISOString().split("T")[0];

    // Tutti i dipendenti del turno corrente, ordinati per reparto poi cognome
    const sortedDipendenti = dipendenti
        .filter(d => {
            if (!turnoCorrente) return true;
            return d.turno_default === turnoCorrente;
        })
        .sort((a, b) => {
            const rA = a.reparto_id || "";
            const rB = b.reparto_id || "";
            if (rA !== rB) return rA.localeCompare(rB);
            return (a.cognome || "").localeCompare(b.cognome || "") || (a.nome || "").localeCompare(b.nome || "");
        });

    const changeMonth = (delta) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    // Ignora i record di assenza per le domeniche (giorno di riposo)
    const getAssenzaInfo = (dipId, dateString, isRestDay) => {
        if (isRestDay) return null;
        const record = presenze.find(p => p.dipendente_id === dipId && p.data === dateString);
        if (record && !record.presente && record.motivo_assenza) {
            const motivo = MOTIVI_ASSENZA.find(m => m.id === record.motivo_assenza);
            return motivo || { sigla: "?", colore: "var(--danger)" };
        }
        return null;
    };

    let lastReparto = null;

    return (
        <div className="fade-in">
            {/* Solo navigazione mese */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>{Icons.chevronLeft || "<"}</button>
                    <span style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize", minWidth: 160, textAlign: "center" }}>
                        {monthName}
                    </span>
                    <button className="btn btn-secondary" onClick={() => changeMonth(1)}>{Icons.chevronRight || ">"}</button>
                </div>
            </div>

            <div className="table-container" style={{ maxHeight: "calc(100vh - 180px)" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                        <tr>
                            <th style={{
                                position: "sticky",
                                top: 0,
                                left: 0,
                                zIndex: 20,
                                background: "var(--bg-tertiary)",
                                minWidth: 180,
                                padding: "16px 14px",
                                borderBottom: "2px solid var(--border)",
                                fontSize: 13
                            }}>Dipendente</th>
                            {days.map(d => (
                                <th key={d.date} style={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 10,
                                    minWidth: 38,
                                    padding: "10px 4px",
                                    textAlign: "center",
                                    background: d.date === todayStr ? "rgba(249, 115, 22, 0.2)" : "var(--bg-card)",
                                    color: d.date === todayStr ? "var(--accent)" : (d.isWeekend ? "var(--warning)" : "var(--text-primary)"),
                                    borderBottom: "2px solid var(--border)",
                                    borderLeft: "1px solid var(--border-light)"
                                }}>
                                    <div style={{ fontSize: 10, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4, opacity: 0.8 }}>{d.weekday}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{d.day}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDipendenti.map(d => {
                            const reparto = REPARTI.find(r => r.id === d.reparto_id);
                            const showSeparator = d.reparto_id !== lastReparto;
                            lastReparto = d.reparto_id;

                            return (
                                <>
                                    {showSeparator && (
                                        <tr key={`sep-${d.reparto_id}`}>
                                            <td colSpan={days.length + 1} style={{
                                                padding: "8px 14px",
                                                background: "var(--bg-secondary)",
                                                borderTop: "2px solid var(--border)",
                                                borderBottom: "1px solid var(--border)",
                                                fontWeight: 700,
                                                fontSize: 12,
                                                color: "var(--text-muted)",
                                                textTransform: "uppercase",
                                                letterSpacing: 1
                                            }}>
                                                {reparto?.nome || d.reparto_id}
                                            </td>
                                        </tr>
                                    )}
                                    <tr key={d.id}>
                                        <td style={{
                                            position: "sticky",
                                            left: 0,
                                            zIndex: 5,
                                            background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "var(--bg-card)",
                                            padding: "4px 8px",
                                            borderRight: "1px solid var(--border-light)",
                                            fontWeight: 500,
                                            fontSize: 15,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            borderTop: "1px solid var(--border-light)"
                                        }}>
                                            {d.cognome} {d.nome.charAt(0)}.
                                        </td>
                                        {days.map(day => {
                                            const group = d.turno || d.turno_default || "D";
                                            let shiftLabel = "";
                                            let shiftColor = "transparent";
                                            let bgOpacity = "20";

                                            const assenza = getAssenzaInfo(d.id, day.date, day.isWeekend);

                                            if (assenza) {
                                                shiftLabel = assenza.sigla;
                                                shiftColor = assenza.colore;
                                                bgOpacity = "ff";
                                            } else if (!day.isWeekend) {
                                                const slot = getSlotForGroup(group, day.date);
                                                if (slot) {
                                                    shiftLabel = slot.id;
                                                    const turnColor = TURNI.find(t => t.id === group)?.colore || "#666";
                                                    shiftColor = turnColor;
                                                }
                                            }

                                            return (
                                                <td key={day.date} style={{
                                                    padding: "2px 1px",
                                                    textAlign: "center",
                                                    borderRight: "1px solid var(--border-light)",
                                                    borderTop: "1px solid var(--border-light)",
                                                    background: (assenza || day.date === todayStr) ? (assenza ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.04)") : "transparent"
                                                }}>
                                                    <div style={{
                                                        width: "100%",
                                                        height: 22,
                                                        lineHeight: "22px",
                                                        background: day.isWeekend ? "transparent" : (assenza ? shiftColor : `${shiftColor}${bgOpacity}`),
                                                        color: day.isWeekend ? "var(--text-muted)" : (assenza ? "#fff" : shiftColor),
                                                        borderRadius: 4,
                                                        fontSize: 11,
                                                        fontWeight: 800
                                                    }}>
                                                        {shiftLabel}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="alert alert-info" style={{ marginTop: 20 }}>
                {Icons.info} I turni (M, P, S, N) sono generati automaticamente dalla matrice di rotazione. Le assenze sono mostrate con il colore del motivo corrispondente.
            </div>
        </div>
    );
}
