import { useState } from "react";
import { TURNI, REPARTI, MOTIVI_ASSENZA } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { getSlotForGroup } from "../lib/shiftRotation";

export default function PlanningView({ dipendenti, setDipendenti, presenze = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [repartoCorrente, setRepartoCorrente] = useState("T11");

    // Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const result = [];
        for (let i = 1; i <= days; i++) {
            const d = new Date(year, month, i);
            result.push({
                date: d.toISOString().split("T")[0],
                day: i,
                weekday: d.toLocaleDateString("it-IT", { weekday: "narrow" }),
                isWeekend: d.getDay() === 0
            });
        }
        return result;
    };

    const days = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    const filteredDipendenti = dipendenti.filter(d => d.reparto_id === repartoCorrente);

    const changeMonth = (delta) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setCurrentDate(newDate);
    };

    // Helper per trovare se c'è un'assenza registrata ed estrarre l'informazione
    const getAssenzaInfo = (dipId, dateString) => {
        const record = presenze.find(p => p.dipendente_id === dipId && p.data === dateString);
        if (record && !record.presente && record.motivo_assenza) {
            const motivo = MOTIVI_ASSENZA.find(m => m.id === record.motivo_assenza);
            return motivo || { sigla: "?", colore: "var(--danger)" };
        }
        return null;
    };

    return (
        <div className="fade-in">
            <div className="main-header-actions" style={{ marginBottom: 20, justifyContent: "space-between", display: "flex" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <select
                        className="select-input"
                        value={repartoCorrente}
                        onChange={(e) => setRepartoCorrente(e.target.value)}
                        style={{ width: 200 }}
                    >
                        {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button className="btn btn-secondary" onClick={() => changeMonth(-1)}>{Icons.chevronLeft || "<"}</button>
                    <span style={{ fontSize: 16, fontWeight: 700, textTransform: "capitalize", minWidth: 140, textAlign: "center" }}>
                        {monthName}
                    </span>
                    <button className="btn btn-secondary" onClick={() => changeMonth(1)}>{Icons.chevronRight || ">"}</button>
                </div>
            </div>

            <div className="table-container" style={{ maxHeight: "calc(100vh - 200px)" }}>
                <table style={{ fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={{ position: "sticky", left: 0, zIndex: 3, background: "var(--bg-tertiary)", minWidth: 180, padding: "12px 16px" }}>Dipendente</th>
                            {days.map(d => (
                                <th key={d.date} style={{
                                    minWidth: 32,
                                    padding: 4,
                                    textAlign: "center",
                                    color: d.isWeekend ? "var(--warning)" : "var(--text-primary)",
                                    background: d.date === new Date().toISOString().split("T")[0] ? "rgba(59,130,246,0.1)" : "transparent"
                                }}>
                                    <div style={{ fontSize: 10, opacity: 0.7 }}>{d.weekday}</div>
                                    <div>{d.day}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDipendenti.map(d => (
                            <tr key={d.id}>
                                <td style={{
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 2,
                                    background: "var(--bg-card)",
                                    padding: "8px 16px",
                                    borderRight: "1px solid var(--border)",
                                    fontWeight: 500
                                }}>
                                    {d.cognome} {d.nome.charAt(0)}.
                                </td>
                                {days.map(day => {
                                    // Calculate dynamic shift based on rotation
                                    const group = d.turno || d.turno_default || "D";
                                    let shiftLabel = "";
                                    let shiftColor = "transparent";
                                    let bgOpacity = "20";

                                    const assenza = getAssenzaInfo(d.id, day.date);

                                    if (assenza) {
                                        shiftLabel = assenza.sigla;
                                        shiftColor = assenza.colore;
                                        bgOpacity = "ff"; // solid color for absences
                                    } else if (!day.isWeekend) {
                                        const slot = getSlotForGroup(group, day.date);
                                        if (slot) {
                                            shiftLabel = slot.id; // M, P, S, N
                                            const turnColor = TURNI.find(t => t.id === group)?.colore || "#666";
                                            shiftColor = turnColor;
                                        }
                                    }

                                    return (
                                        <td key={day.date} style={{ padding: 2, textAlign: "center", borderRight: "1px solid var(--border-light)" }}>
                                            <div style={{
                                                width: "100%",
                                                height: 24,
                                                lineHeight: "24px",
                                                background: day.isWeekend ? "transparent" : (assenza ? shiftColor : `${shiftColor}${bgOpacity}`),
                                                color: day.isWeekend ? "var(--text-muted)" : (assenza ? "#fff" : shiftColor),
                                                borderRadius: 2,
                                                fontSize: 11,
                                                fontWeight: 600
                                            }}>
                                                {shiftLabel}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="alert alert-info" style={{ marginTop: 20 }}>
                {Icons.info} I turni (M, P, S, N) sono generati automaticamente dalla matrice di rotazione. Le assenze sono mostrate con il colore del motivo corrispondente.
            </div>
        </div>
    );
}
