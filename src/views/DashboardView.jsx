import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { REPARTI } from "../data/constants";
import { supabase } from "../lib/supabase";

export default function DashboardView({ dipendenti, presenze, setPresenze, assegnazioni, macchine, repartoCorrente, turnoCorrente, showToast, motivi, zones }) {
    if (!dipendenti) return <div className="p-4 text-center">Caricamento dipendenti...</div>;

    // Fix: Use local date to avoid UTC mismatch
    const getLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const today = getLocalDate(new Date());

    // Default: yesterday as start
    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return getLocalDate(d);
    });

    // Default: +12 days
    const [dateEnd, setDateEnd] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 12);
        return getLocalDate(d);
    });

    const visibleDays = useMemo(() => {
        const days = [];
        const start = new Date(dateStart + "T00:00:00");
        const end = new Date(dateEnd + "T00:00:00");
        const d = new Date(start);

        // Safety break to prevent infinite loop if dates are invalid
        let iterations = 0;
        while (d <= end && iterations < 31) {
            const dateStr = getLocalDate(d);
            days.push({
                date: dateStr,
                label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
                dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
                isToday: dateStr === today,
                isSunday: d.getDay() === 0,
            });
            d.setDate(d.getDate() + 1);
            iterations++;
        }
        return days;
    }, [dateStart, dateEnd, today]);

    // Create a fast lookup map for presence
    const presenceMap = useMemo(() => {
        const map = {};
        if (!presenze) return map;
        presenze.forEach(p => {
            const key = `${p.dipendente_id}-${p.data}`;
            map[key] = p;
        });
        return map;
    }, [presenze]);

    const [motivoPopup, setMotivoPopup] = useState(null); // { dipId, date, x, y }

    const getPresenceStatus = (dipId, date, isSunday) => {
        const key = `${dipId}-${date}`;
        const p = presenceMap[key];

        if (p) {
            // If record exists, use it
            if (p.presente) return true;
            if (p.motivo_assenza) {
                const m = motivi.find(ma => ma.id === p.motivo_assenza);
                return m ? m.sigla : "?";
            }
            return false; // Should generally have reason if not present
        }

        // Default behavior if no record exists
        if (isSunday) return "-";
        if (date === today) return true; // Default present today only if NOT Sunday

        return true; // Default present in future/past if no record
    };

    const toggleWeekPresenza = async (dipId, date, event) => {
        const status = getPresenceStatus(dipId, date, false);
        const isCurrentlyPresent = status === true;

        if (isCurrentlyPresent) {
            // Going from present → absent: show motivo popup
            const rect = event.currentTarget.getBoundingClientRect(); // Use currentTarget for consistency
            const spaceBelow = window.innerHeight - rect.bottom;
            const ESTIMATED_HEIGHT = 200; // Reduced estimate
            // Default to bottom unless space is tight (less than 200px)
            const placement = spaceBelow < ESTIMATED_HEIGHT ? 'top' : 'bottom';

            console.log("Popup:", { rect, spaceBelow, placement, windowHeight: window.innerHeight });

            setMotivoPopup({
                dipId,
                date,
                x: rect.left,
                y: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
                placement
            });
        } else {
            // Going from absent (or null/-) → present
            setMotivoPopup(null);

            // Optimistic Update
            setPresenze((prev) => {
                const exists = prev.find(p => p.dipendente_id === dipId && p.data === date);
                if (exists) {
                    return prev.map(p => p.dipendente_id === dipId && p.data === date ? { ...p, presente: true, motivo_assenza: null } : p);
                } else {
                    return [...prev, { dipendente_id: dipId, data: date, presente: true, motivo_assenza: null, turno_id: "D" }];
                }
            });

            // DB Update
            try {
                const { error } = await supabase.from('presenze').upsert({
                    dipendente_id: dipId,
                    data: date,
                    presente: true,
                    motivo_assenza: null,
                    turno_id: turnoCorrente || "D" // Default to current or D
                }, { onConflict: 'dipendente_id, data' });

                if (error) throw error;
            } catch (error) {
                console.error("Error saving presence:", error);
                showToast("Errore salvataggio presenza", "error");
                // Revert logic could go here
            }
        }
    };

    const confirmAssenza = async (motivo) => {
        if (!motivoPopup) return;
        const { dipId, date } = motivoPopup;

        // Optimistic Update
        setPresenze((prev) => {
            const exists = prev.find(p => p.dipendente_id === dipId && p.data === date);
            if (exists) {
                return prev.map(p => p.dipendente_id === dipId && p.data === date ? { ...p, presente: false, motivo_assenza: motivo } : p);
            } else {
                return [...prev, { dipendente_id: dipId, data: date, presente: false, motivo_assenza: motivo, turno_id: "D" }];
            }
        });

        setMotivoPopup(null);
        const motivoObj = motivi.find(m => m.id === motivo);
        showToast(`Assenza registrata: ${motivoObj?.label}`, "warning");

        // DB Update
        try {
            const { error } = await supabase.from('presenze').upsert({
                dipendente_id: dipId,
                data: date,
                presente: false,
                motivo_assenza: motivo,
                turno_id: turnoCorrente || "D"
            }, { onConflict: 'dipendente_id, data' });

            if (error) throw error;
        } catch (error) {
            console.error("Error saving absence:", error);
            showToast("Errore salvataggio assenza", "error");
        }
    };

    // -------------------------------------------------------------------------
    // FILTRO E ORDINAMENTO DIPENDENTI
    // -------------------------------------------------------------------------

    // 1. FILTRO per Turno Corrente
    // L'utente si aspetta di vedere solo i dipendenti appartenenti al turno selezionato (es. "D")
    const filteredDipendenti = dipendenti.filter(d => {
        if (!turnoCorrente) return true; // Mostra tutti se nessun turno è selezionato
        return d.turno_default === turnoCorrente;
    });

    const presenzeOdierni = presenze ? presenze.filter((p) => p.data === today) : [];

    // Ricalcolo statistiche basato sui dipendenti FILTRATI e sulla logica di visualizzazione (default incluri)
    const isTodaySunday = new Date(today).getDay() === 0;

    const presenti = filteredDipendenti.filter(d => {
        const status = getPresenceStatus(d.id, today, isTodaySunday);
        return status === true;
    }).length;

    const assenti = filteredDipendenti.filter(d => {
        const status = getPresenceStatus(d.id, today, isTodaySunday);
        return status !== true && status !== "-" && status !== "?";
    }).length;

    // 2. ORDINAMENTO con Team Leader per primi
    const teamLeaders = {
        'T11': 'Cianci',
        'T12': 'Cappelluti',
        'T13': 'Ferrandes'
    };

    const sortedDip = [...filteredDipendenti].sort((a, b) => {
        // Primario: Reparto/Team
        if (a.reparto_id !== b.reparto_id) return (a.reparto_id || "").localeCompare(b.reparto_id || "");

        // Secondario: Verifica Team Leader
        const leaderNameA = teamLeaders[a.reparto_id];
        const cognomeA = a.cognome || "";
        const isALeader = leaderNameA && cognomeA.includes(leaderNameA);

        const leaderNameB = teamLeaders[b.reparto_id];
        const cognomeB = b.cognome || "";
        const isBLeader = leaderNameB && cognomeB.includes(leaderNameB);

        if (isALeader && !isBLeader) return -1;
        if (!isALeader && isBLeader) return 1;

        // Terziario: Alfabetico per Cognome
        return cognomeA.localeCompare(cognomeB);
    });

    let lastReparto = "";

    return (
        <div className="fade-in">
            <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                {/* COUNTER: Present Employees */}
                <div style={{ padding: "8px 16px", background: "var(--success-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(34,197,94,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PRESENTI</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{presenti}</span>
                </div>
                {/* COUNTER: Absent Employees */}
                <div style={{ padding: "8px 16px", background: "var(--danger-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>ASSENTI</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{assenti}</span>
                </div>
                {/* COUNTER: Total */}
                <div style={{ padding: "8px 16px", background: "var(--info-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TOTALE</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--info)", marginLeft: 8, fontFamily: "'JetBrains Mono', monospace" }}>{filteredDipendenti.length}</span>
                </div>
                {/* DATE RANGE FILTER */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DA</label>
                    <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>A</label>
                    <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                </div>
            </div>

            {/* 
              TABELLA DASHBOARD PRINCIPALE 
              - Header sticky per le date
              - Prime colonne sticky per Nome e Team
            */}

            <div className="table-container">
                <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                    {/* ... (thead) ... */}
                    <thead>
                        <tr>
                            {/* COLONNA 1: Nominativo (Sticky Left) */}
                            <th style={{ padding: "16px 14px", width: 180, position: "sticky", left: 0, background: "var(--bg-tertiary)", zIndex: 10, borderBottom: "2px solid var(--border)" }}>Nominativo</th>

                            {/* COLONNA 2: Team/Reparto (Sticky Left - Nuova Richiesta) */}
                            <th style={{ padding: "16px 8px", width: 60, position: "sticky", left: 180, background: "var(--bg-tertiary)", zIndex: 10, borderBottom: "2px solid var(--border)", textAlign: 'center', borderRight: "2px solid var(--border)" }}>Team</th>

                            {/* COLONNE DATE */}
                            {visibleDays.map((day) => (
                                <th
                                    key={day.date}
                                    style={{
                                        textAlign: "center",
                                        padding: "10px 4px",
                                        width: 60,
                                        background: day.isToday ? "rgba(249, 115, 22, 0.2)" : undefined,
                                        color: day.isToday ? "var(--accent)" : undefined,
                                        borderBottom: "2px solid var(--border)"
                                    }}
                                >
                                    <div style={{ fontSize: 12, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4 }}>{day.dayName}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{day.label}</div>
                                </th>
                            ))}

                            {/* COLUMN: Assigned Machine */}
                            <th style={{
                                padding: "16px 16px",
                                minWidth: 200,
                                borderLeft: "2px solid var(--border-light)",
                                background: "var(--bg-tertiary)",
                                borderBottom: "2px solid var(--border)"
                            }}>Macchina Assegnata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDip.map((d, index) => {
                            // Determine if this is the start of a new Team/Reparto group
                            const isNewGroup = d.reparto_id !== lastReparto;
                            lastReparto = d.reparto_id;

                            // Visual styling for group separation: thicker top border if new group
                            const rowStyle = isNewGroup && index !== 0
                                ? { borderTop: "3px solid var(--border-dark)" } // Strong divider
                                : { borderTop: "1px solid var(--border-light)" }; // Normal divider

                            // Get assigments logic (same as before)
                            const dipAss = assegnazioni ? assegnazioni.filter((a) => a.dipendente_id === d.id && a.data === today) : [];
                            const macchineNames = dipAss.map((a) => {
                                // 1. Try Machines
                                const m = macchine ? macchine.find((mm) => mm.id === a.macchina_id) : null;
                                if (m) return m.nome;

                                // 2. Try Zones (using ID match on a.macchina_id or a.attivita_id if aligned)
                                const z = zones ? zones.find((zz) => zz.id === a.macchina_id || zz.id === a.attivita_id) : null;
                                if (z) {
                                    // Find machines in this zone
                                    const zoneMachines = macchine ? macchine.filter(m => m.zona === z.id).map(m => m.nome) : [];

                                    // DEBUG LOG
                                    if (zoneMachines.length === 0) {
                                        console.log("DEBUG ZONE NULL:", { zID: z.id, macchineSample: macchine?.slice(0, 3) });
                                    }

                                    return {
                                        label: z.label || z.id,
                                        machines: zoneMachines
                                    };
                                }

                                return a.macchina_id || a.attivita_id || "N/A";
                            });

                            // -------------------------------------------------------------------------
                            // RENDER RIGHE (Iterazione sui dipendenti ordinati)
                            // -------------------------------------------------------------------------
                            return (
                                <tr key={d.id}>
                                    {/* CELLA 1: Nominativo (Sticky) */}
                                    <td style={{
                                        padding: "8px 8px",
                                        minWidth: 180, // Match header width
                                        maxWidth: 180,
                                        fontWeight: 500,
                                        whiteSpace: "nowrap",
                                        position: "sticky",
                                        left: 0,
                                        background: "var(--bg-card)",
                                        zIndex: 5,
                                        borderRight: "1px solid var(--border-light)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        ...rowStyle
                                    }}>
                                        {d.cognome} {(d.nome || "").charAt(0)}.
                                        {teamLeaders[d.reparto_id] && (d.cognome || "").includes(teamLeaders[d.reparto_id]) && (
                                            <span style={{ marginLeft: 6, fontSize: 12 }} title="Team Leader">👑</span>
                                        )}
                                    </td>

                                    {/* CELLA 2: Team (Sticky - Richiesta Utente) */}
                                    <td style={{
                                        padding: "8px 4px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        color: "var(--text-muted)",
                                        position: "sticky",
                                        left: 180,
                                        background: "var(--bg-card)",
                                        zIndex: 5,
                                        borderRight: "2px solid var(--border)", // Divisore tra colonne fisse e scrollabili
                                        ...rowStyle
                                    }}>
                                        {d.reparto_id}
                                    </td>

                                    {/* PRESENCE CELLS */}
                                    {visibleDays.map((day) => {
                                        const status = getPresenceStatus(d.id, day.date, day.isSunday);
                                        const isPresent = status === true;
                                        const sigla = (!isPresent && typeof status === "string") ? status : "-";

                                        return (
                                            <td
                                                key={day.date}
                                                style={{
                                                    textAlign: "center",
                                                    padding: "4px 1px",
                                                    background: day.isToday ? "rgba(249, 115, 22, 0.04)" : undefined,
                                                    ...rowStyle
                                                }}
                                            >
                                                <button
                                                    onClick={(e) => toggleWeekPresenza(d.id, day.date, e)}
                                                    style={{
                                                        minWidth: 28,
                                                        height: 22,
                                                        padding: "0 2px",
                                                        border: "none",
                                                        borderRadius: 4,
                                                        cursor: "pointer",
                                                        fontWeight: 700,
                                                        fontFamily: "'JetBrains Mono', monospace",
                                                        color: "white",
                                                        // Status Color Logic
                                                        background: isPresent ? "#22C55E" : (sigla === "-" ? "var(--bg-tertiary)" : "#EF4444"),
                                                        color: (sigla === "-" && !isPresent) ? "var(--text-muted)" : "white",
                                                        boxShadow: isPresent ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                                                        transition: "all 0.1s ease",
                                                    }}
                                                >
                                                    {isPresent ? "1" : sigla}
                                                </button>
                                            </td>
                                        );
                                    })}

                                    {/* ASSIGNMENTS CELL */}
                                    <td style={{
                                        padding: "4px 10px",
                                        borderLeft: "2px solid var(--border-light)",
                                        whiteSpace: "nowrap",
                                        ...rowStyle
                                    }}>
                                        {macchineNames.length > 0 ? (
                                            macchineNames.map((item, i) => {
                                                const isZone = typeof item === 'object';
                                                const name = isZone ? item.label : item;
                                                const title = isZone ? `Macchine: ${item.machines.join(', ')}` : '';

                                                return (
                                                    <span key={i} title={title} style={{
                                                        display: "inline-block",
                                                        padding: "2px 8px",
                                                        background: "var(--info-muted)",
                                                        color: "var(--info)",
                                                        borderRadius: 4,
                                                        fontWeight: 600,
                                                        marginRight: 4,
                                                        cursor: isZone ? "pointer" : "default"
                                                    }}>
                                                        {name}
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span style={{ color: "var(--text) opacity 0.3", fontSize: 11 }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Motivo Assenza Popup - Using Portal to escape overflow/stacking context */}
            {motivoPopup && createPortal(
                <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }} onClick={() => setMotivoPopup(null)} />
                    <div style={{
                        position: "fixed",
                        left: Math.min(motivoPopup.x, window.innerWidth - 180),
                        top: (motivoPopup.placement === 'bottom' || !motivoPopup.placement) ? motivoPopup.y : undefined,
                        bottom: motivoPopup.placement === 'top' ? (window.innerHeight - motivoPopup.y) : undefined,
                        zIndex: 10000,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        padding: 6,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                        minWidth: 160,
                    }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 8px", fontWeight: 600, textTransform: "uppercase" }}>Motivo assenza</div>
                        {motivi.map((m) => (
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
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                            >
                                <div style={{ width: 12, height: 12, borderRadius: 2, background: m.colore, marginRight: 6 }}></div>
                                <span>{m.label}</span>
                            </div>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
