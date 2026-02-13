import { useState, useEffect, useMemo } from "react";
import { MOTIVI_ASSENZA, REPARTI } from "../data/constants";

export default function DashboardView({ dipendenti, presenze, setPresenze, assegnazioni, macchine, showToast }) {
    const today = new Date().toISOString().split("T")[0];

    // Default: yesterday as start, calculate how many days fit (~max 14 days visible)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const defaultStart = yesterday.toISOString().split("T")[0];
    const defaultEnd = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 12);
        return d.toISOString().split("T")[0];
    })();

    const visibleDays = useMemo(() => {
        const days = [];
        const start = new Date(dateStart + "T00:00:00");
        const end = new Date(dateEnd + "T00:00:00");
        const d = new Date(start);
        while (d <= end) {
            days.push({
                date: d.toISOString().split("T")[0],
                label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
                dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
                isToday: d.toISOString().split("T")[0] === today,
                isSunday: d.getDay() === 0,
            });
            d.setDate(d.getDate() + 1);
        }
        return days;
    }, [dateStart, dateEnd, today]);

    const [weekPresenze, setWeekPresenze] = useState(() => {
        const wp = {};
        dipendenti.forEach((d) => {
            visibleDays.forEach((day) => {
                const key = `${d.id}-${day.date}`;
                if (day.date === today) {
                    const p = presenze.find((pp) => pp.dipendente_id === d.id);
                    wp[key] = p ? p.presente : true;
                } else {
                    wp[key] = day.isSunday ? "-" : true;
                }
            });
        });
        return wp;
    });

    // Re-init new days when range changes
    useEffect(() => {
        setWeekPresenze((prev) => {
            const wp = { ...prev };
            dipendenti.forEach((d) => {
                visibleDays.forEach((day) => {
                    const key = `${d.id}-${day.date}`;
                    if (!(key in wp)) {
                        if (day.date === today) {
                            const p = presenze.find((pp) => pp.dipendente_id === d.id);
                            wp[key] = p ? p.presente : true;
                        } else {
                            wp[key] = day.isSunday ? "-" : true;
                        }
                    }
                });
            });
            return wp;
        });
    }, [dateStart, dateEnd, dipendenti, presenze, visibleDays, today]);

    const [motivoPopup, setMotivoPopup] = useState(null); // { dipId, date, x, y }

    const toggleWeekPresenza = (dipId, date, event) => {
        const key = `${dipId}-${date}`;
        const current = weekPresenze[key];
        const isCurrentlyPresent = current === true || current === undefined;

        if (isCurrentlyPresent) {
            // Going from present → absent: show motivo popup
            const rect = event.target.getBoundingClientRect();
            setMotivoPopup({ dipId, date, x: rect.left, y: rect.bottom + 4 });
        } else {
            // Going from absent → present
            setWeekPresenze((prev) => ({ ...prev, [key]: true }));
            setMotivoPopup(null);

            // Update global state (Upsert)
            setPresenze((prev) => {
                const exists = prev.find(p => p.dipendente_id === dipId && p.data === date);
                if (exists) {
                    return prev.map(p => p.dipendente_id === dipId && p.data === date ? { ...p, presente: true, motivo_assenza: null } : p);
                } else {
                    return [...prev, { dipendente_id: dipId, data: date, presente: true, motivo_assenza: null, turno_id: "D" }];
                }
            });
        }
    };

    const confirmAssenza = (motivo) => {
        if (!motivoPopup) return;
        const { dipId, date } = motivoPopup;
        const key = `${dipId}-${date}`;
        const motivoObj = MOTIVI_ASSENZA.find(m => m.id === motivo);
        setWeekPresenze((prev) => ({ ...prev, [key]: motivoObj?.sigla || "-" }));

        // Update global state (Upsert)
        setPresenze((prev) => {
            const exists = prev.find(p => p.dipendente_id === dipId && p.data === date);
            if (exists) {
                return prev.map(p => p.dipendente_id === dipId && p.data === date ? { ...p, presente: false, motivo_assenza: motivo } : p);
            } else {
                return [...prev, { dipendente_id: dipId, data: date, presente: false, motivo_assenza: motivo, turno_id: "D" }];
            }
        });

        setMotivoPopup(null);
        showToast(`Assenza registrata: ${motivoObj?.label}`, "warning");
    };

    const presenzeOdierni = presenze.filter((p) => p.data === today);
    const presenti = presenzeOdierni.filter((p) => p.presente).length;
    const assenti = presenzeOdierni.filter((p) => !p.presente).length;

    const sortedDip = [...dipendenti].sort((a, b) => {
        if (a.reparto_id !== b.reparto_id) return a.reparto_id.localeCompare(b.reparto_id);
        return a.cognome.localeCompare(b.cognome);
    });

    let lastReparto = "";

    return (
        <div className="fade-in">
            <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ padding: "8px 16px", background: "var(--success-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PRESENTI</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{presenti}</span>
                </div>
                <div style={{ padding: "8px 16px", background: "var(--danger-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>ASSENTI</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{assenti}</span>
                </div>
                <div style={{ padding: "8px 16px", background: "var(--info-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TOTALE</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--info)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{dipendenti.length}</span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DA</label>
                    <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>A</label>
                    <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                </div>
            </div>

            <div className="table-container">
                <table style={{ fontSize: 11 }}>
                    <thead>
                        <tr>
                            <th style={{ padding: "16px 14px", width: 180, position: "sticky", left: 0, background: "var(--bg-tertiary)", zIndex: 2, fontSize: 16 }}>Nominativo</th>
                            {visibleDays.map((day) => (
                                <th
                                    key={day.date}
                                    style={{
                                        textAlign: "center",
                                        padding: "10px 4px",
                                        width: 60,
                                        background: day.isToday ? "rgba(249, 115, 22, 0.2)" : undefined,
                                        color: day.isToday ? "var(--accent)" : undefined,
                                    }}
                                >
                                    <div style={{ fontSize: 12, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4 }}>{day.dayName}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{day.label}</div>
                                </th>
                            ))}
                            <th style={{
                                padding: "16px 16px",
                                minWidth: 200,
                                borderLeft: "2px solid var(--border-light)",
                                background: "var(--bg-tertiary)",
                            }}>Macchina Assegnata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDip.map((d) => {
                            const reparto = REPARTI.find((r) => r.id === d.reparto_id);
                            const showHeader = d.reparto_id !== lastReparto;
                            lastReparto = d.reparto_id;
                            // Update: Filter assignments to show ONLY today's assignments
                            const dipAss = assegnazioni.filter((a) => a.dipendente_id === d.id && a.data === today);
                            const macchineNames = dipAss.map((a) => {
                                const m = macchine.find((mm) => mm.id === a.macchina_id);
                                return m ? m.nome : a.macchina_id;
                            });

                            return (
                                <div key={d.id} style={{ display: 'contents' }}>
                                    {showHeader && (
                                        <tr key={`header-${d.reparto_id}`}>
                                            <td
                                                colSpan={2 + visibleDays.length}
                                                style={{
                                                    background: reparto?.colore || "var(--bg-tertiary)",
                                                    color: "white",
                                                    fontWeight: 700,
                                                    fontSize: 15,
                                                    padding: "12px 14px",
                                                    letterSpacing: 0.3,
                                                    borderBottom: "none",
                                                }}
                                            >
                                                {reparto?.nome} — {reparto?.capoturno}
                                            </td>
                                        </tr>
                                    )}
                                    <tr key={d.id}>
                                        <td style={{ padding: "6px 8px", fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--bg-card)", zIndex: 1, borderRight: "1px solid var(--border)" }}>
                                            {d.cognome} {d.nome.charAt(0)}.
                                        </td>
                                        {visibleDays.map((day) => {
                                            const key = `${d.id}-${day.date}`;
                                            const val = weekPresenze[key];
                                            const isPresent = val === true || val === undefined;
                                            const sigla = (!isPresent && typeof val === "string") ? val : "-";
                                            return (
                                                <td
                                                    key={day.date}
                                                    style={{
                                                        textAlign: "center",
                                                        padding: "2px 1px",
                                                        background: day.isToday ? "rgba(249, 115, 22, 0.04)" : undefined,
                                                    }}
                                                >
                                                    <button
                                                        onClick={(e) => toggleWeekPresenza(d.id, day.date, e)}
                                                        style={{
                                                            minWidth: 30,
                                                            height: 20,
                                                            padding: "0 4px",
                                                            border: "none",
                                                            borderRadius: 3,
                                                            cursor: "pointer",
                                                            fontWeight: 700,
                                                            fontSize: 10,
                                                            fontFamily: "'JetBrains Mono', monospace",
                                                            color: "white",
                                                            background: isPresent ? "#22C55E" : "#EF4444",
                                                            transition: "all 0.1s ease",
                                                        }}
                                                    >
                                                        {isPresent ? "1" : sigla}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                        <td style={{
                                            padding: "2px 10px",
                                            borderLeft: "2px solid var(--border-light)",
                                            whiteSpace: "nowrap",
                                        }}>
                                            {macchineNames.length > 0 ? (
                                                macchineNames.map((name, i) => (
                                                    <span key={i} style={{
                                                        display: "inline-block",
                                                        padding: "2px 8px",
                                                        background: "var(--info-muted)",
                                                        color: "var(--info)",
                                                        borderRadius: 4,
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        marginRight: 4,
                                                    }}>
                                                        {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                </div>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Motivo Assenza Popup */}
            {motivoPopup && (
                <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setMotivoPopup(null)} />
                    <div style={{
                        position: "fixed",
                        left: Math.min(motivoPopup.x, window.innerWidth - 180),
                        top: motivoPopup.y,
                        zIndex: 1000,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: 6,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                        minWidth: 160,
                    }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 8px", fontWeight: 600, textTransform: "uppercase" }}>Motivo assenza</div>
                        {MOTIVI_ASSENZA.map((m) => (
                            <div
                                key={m.id}
                                onClick={() => confirmAssenza(m.id)}
                                style={{
                                    padding: "6px 8px",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    transition: "background 0.1s",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-elevated)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                                <span>{m.icona}</span>
                                <span>{m.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
