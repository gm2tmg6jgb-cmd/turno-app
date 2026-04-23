import { useState, useEffect, useMemo } from "react";
import { TURNI, REPARTI } from "../data/constants";
import { Icons } from "../components/ui/Icons";
import { getSlotForGroup } from "../lib/shiftRotation";
import { supabase } from "../lib/supabase";

export default function PlanningView({
    dipendenti, setDipendenti,
    presenze = [],
    pianificazione = [], setPianificazione,
    turnoCorrente, globalDate,
    motivi = [], showToast
}) {
    const [currentDate, setCurrentDate] = useState(globalDate ? new Date(globalDate) : new Date());
    const [selectedCells, setSelectedCells] = useState([]); // Array of { dipId, date }
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (globalDate) {
            setCurrentDate(new Date(globalDate));
            // Auto-scroll to active date column after a short delay to ensure render
            setTimeout(() => {
                const activeCell = document.querySelector(`[data-date="${globalDate}"]`);
                if (activeCell) {
                    activeCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }, 100);
        }
    }, [globalDate]);

    // --- HOLIDAY LOGIC (Shared with Dashboard) ---
    const getEaster = (year) => {
        const f = Math.floor,
            G = year % 19,
            C = f(year / 100),
            H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
            I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
            J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
            L = I - J,
            month = 3 + f((L + 40) / 44),
            day = L + 28 - 31 * f(month / 4);
        return new Date(year, month - 1, day);
    };

    const isItalianHoliday = (d) => {
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        if (month === 1 && day === 1) return true; // Capodanno
        if (month === 1 && day === 6) return true; // Epifania
        if (month === 4 && day === 25) return true; // Liberazione
        if (month === 5 && day === 1) return true; // Lavoratori
        if (month === 6 && day === 2) return true; // Repubblica
        if (month === 8 && day === 15) return true; // Ferragosto
        if (month === 11 && day === 1) return true; // Tutti i Santi
        if (month === 12 && day === 8) return true; // Immacolata  
        if (month === 12 && day === 25) return true; // Natale
        if (month === 12 && day === 26) return true; // S. Stefano
        const easter = getEaster(year);
        const pasquetta = new Date(easter);
        pasquetta.setDate(pasquetta.getDate() + 1);
        const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const pt = new Date(pasquetta.getFullYear(), pasquetta.getMonth(), pasquetta.getDate());
        return dt.getTime() === pt.getTime();
    };

    // Use memo to create a fast lookup for planning
    const planLookup = useMemo(() => {
        const map = {};
        pianificazione.forEach(p => {
            map[`${p.dipendente_id}_${p.data}`] = p;
        });
        return map;
    }, [pianificazione]);

    // Get days in month
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const result = [];
        for (let i = 1; i <= days; i++) {
            const d = new Date(year, month, i);
            const isSunday = d.getDay() === 0;
            const isHoliday = isItalianHoliday(d);
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
            result.push({
                date: dateStr,
                day: i,
                dayLabel: `${String(i).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}`,
                dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
                isWeekend: isSunday || isHoliday
            });
        }
        return result;
    };

    const days = getDaysInMonth(currentDate);
    const monthName = currentDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    const activeDateStr = globalDate || new Date().toISOString().split("T")[0];

    // Tutti i dipendenti del turno corrente, ordinati per reparto poi cognome
    const sortedDipendenti = dipendenti
        .filter(d => {
            if (d.attivo === false) return false;
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

    const handleCellClick = (dipId, date, event) => {
        const key = `${dipId}_${date}`;

        if (event.shiftKey && selectedCells.length > 0) {
            const lastSelected = selectedCells[0];
            if (lastSelected.dipId === dipId) {
                const start = new Date(lastSelected.date);
                const end = new Date(date);
                const [minD, maxD] = start < end ? [start, end] : [end, start];

                const newSelection = [];
                let curr = new Date(minD);
                while (curr <= maxD) {
                    newSelection.push({ dipId, date: curr.toISOString().split("T")[0] });
                    curr.setDate(curr.getDate() + 1);
                }
                setSelectedCells(newSelection);
            } else {
                setSelectedCells([{ dipId, date }]);
            }
        } else {
            setSelectedCells([{ dipId, date }]);
        }
    };

    const savePlanningRecord = async (turnoId, motivoAssenza) => {
        if (selectedCells.length === 0) return;
        setIsSaving(true);
        try {
            const updates = selectedCells.map(cell => ({
                dipendente_id: cell.dipId,
                data: cell.date,
                turno_id: turnoId || null,
                motivo_assenza: motivoAssenza || null
            }));

            if (!turnoId && !motivoAssenza) {
                for (const cell of selectedCells) {
                    await supabase
                        .from('pianificazione')
                        .delete()
                        .eq('dipendente_id', cell.dipId)
                        .eq('data', cell.date);
                }
                setPianificazione(prev => prev.filter(p => !selectedCells.some(s => s.dipId === p.dipendente_id && s.date === p.data)));
                showToast("Pianificazioni rimosse", "success");
            } else {
                const { data, error } = await supabase
                    .from('pianificazione')
                    .upsert(updates, { onConflict: 'dipendente_id,data' })
                    .select();

                if (error) throw error;

                setPianificazione(prev => {
                    const filtered = prev.filter(p => !selectedCells.some(s => s.dipId === p.dipendente_id && s.date === p.data));
                    return [...filtered, ...data];
                });
                showToast(`Pianificazione salvata per ${selectedCells.length} giorni`, "success");
            }
        } catch (error) {
            console.error("Error saving planning:", error);
            showToast("Errore durante il salvataggio: " + error.message, "error");
        } finally {
            setIsSaving(false);
            setSelectedCells([]);
        }
    };

    let lastReparto = null;

    return (
        <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header Mirroring Presenze Style */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center", background: "var(--bg-secondary)", padding: "12px 20px", borderRadius: 12, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Stato Sistema</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 8px var(--success)" }}></div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Pianificazione Attiva</span>
                        </div>
                    </div>
                    <div style={{ width: 1, height: 24, background: "var(--border)" }}></div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Periodo</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--info)", textTransform: "capitalize" }}>{monthName}</span>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" style={{ borderRadius: 8 }} onClick={() => changeMonth(-1)}>{Icons.chevronLeft}</button>
                    <button className="btn btn-secondary btn-sm" style={{ borderRadius: 8, fontWeight: 700 }} onClick={() => setCurrentDate(new Date())}>Oggi</button>
                    <button className="btn btn-secondary btn-sm" style={{ borderRadius: 8 }} onClick={() => changeMonth(1)}>{Icons.chevronRight}</button>
                </div>
            </div>

            <div className="table-container" style={{ flex: 1, overflow: "auto" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                        <tr>
                            {/* Mirroring Presenze Columns */}
                            <th style={{ padding: "16px 14px", width: 180, position: "sticky", top: 0, left: 0, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)" }}>Dipendente</th>
                            <th style={{ padding: "16px 8px", width: 60, position: "sticky", top: 0, left: 180, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)", textAlign: 'center', borderRight: "1px solid var(--border-light)" }}>Team</th>
                            <th style={{ padding: "16px 4px", width: 50, position: "sticky", top: 0, left: 240, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)", textAlign: 'center', fontSize: 10, borderRight: "1px solid var(--border-light)" }}>FERIE</th>
                            <th style={{ padding: "16px 4px", width: 50, position: "sticky", top: 0, left: 290, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)", textAlign: 'center', fontSize: 10, borderRight: "2px solid var(--border)" }}>ROL</th>

                            {days.map(d => (
                                <th key={d.date} data-date={d.date} style={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 10,
                                    minWidth: 60,
                                    textAlign: "center",
                                    padding: "10px 4px",
                                    background: d.date === activeDateStr ? "rgba(249, 115, 22, 0.2)" : (d.isWeekend ? "rgba(99, 102, 241, 0.15)" : "var(--bg-card)"),
                                    color: d.date === activeDateStr ? "var(--accent)" : undefined,
                                    borderBottom: "2px solid var(--border)",
                                    borderLeft: "1px solid var(--border-light)"
                                }}>
                                    <div style={{ fontSize: 12, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4 }}>{d.dayName}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{d.dayLabel}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDipendenti.map((d, index) => {
                            const isNewGroup = d.reparto_id !== lastReparto;
                            lastReparto = d.reparto_id;
                            const rowStyle = isNewGroup && index !== 0
                                ? { borderTop: "3px solid var(--border-dark)" }
                                : { borderTop: "1px solid var(--border-light)" };

                            return (
                                <tr key={d.id}>
                                    {/* CELLA 1: Nominativo (Sticky) */}
                                    <td style={{
                                        padding: "4px 8px",
                                        minWidth: 180,
                                        maxWidth: 180,
                                        fontWeight: 500,
                                        fontSize: 15,
                                        whiteSpace: "nowrap",
                                        position: "sticky",
                                        left: 0,
                                        background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "var(--bg-card)",
                                        zIndex: 5,
                                        borderRight: "1px solid var(--border-light)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        ...rowStyle
                                    }}>
                                        <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{d.cognome} {d.nome.charAt(0)}.</div>
                                    </td>

                                    {/* CELLA 2: Team (Sticky) */}
                                    <td style={{
                                        padding: "4px 4px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        fontSize: 15,
                                        color: "var(--text-muted)",
                                        position: "sticky",
                                        left: 180,
                                        background: "var(--bg-card)",
                                        zIndex: 5,
                                        borderRight: "2px solid var(--border)",
                                        ...rowStyle
                                    }}>
                                        {d.reparto_id ? d.reparto_id.replace(/^T/i, '') : ''}
                                    </td>

                                    {/* CELLA 3: Ferie (Sticky) */}
                                    <td style={{
                                        padding: "4px 4px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        fontSize: 15,
                                        position: "sticky",
                                        left: 240,
                                        zIndex: 5,
                                        borderRight: "1px solid var(--border-light)",
                                        ...rowStyle,
                                        ...(() => {
                                            const base = d.ferie_residue || 0;
                                            const plannedHours = pianificazione
                                                .filter(p => p.dipendente_id === d.id && p.motivo_assenza?.toUpperCase() === 'PF')
                                                .length * 8;
                                            const balance = Math.floor((base - plannedHours) / 8);
                                            return balance < 0
                                                ? { background: "var(--danger)", color: "white" }
                                                : { background: "var(--bg-card)", color: "var(--success)" };
                                        })()
                                    }}>
                                        {d.tipo !== 'interinale' ? (() => {
                                            const base = d.ferie_residue || 0;
                                            const plannedHours = pianificazione
                                                .filter(p => p.dipendente_id === d.id && p.motivo_assenza?.toUpperCase() === 'PF')
                                                .length * 8;
                                            return Math.floor((base - plannedHours) / 8);
                                        })() : '-'}
                                    </td>

                                    {/* CELLA 4: ROL (Sticky) */}
                                    <td style={{
                                        padding: "4px 4px",
                                        textAlign: "center",
                                        fontWeight: 700,
                                        fontSize: 15,
                                        position: "sticky",
                                        left: 290,
                                        zIndex: 5,
                                        borderRight: "2px solid var(--border)",
                                        ...rowStyle,
                                        ...(() => {
                                            const base = d.rol_residui || 0;
                                            const plannedHours = pianificazione
                                                .filter(p => p.dipendente_id === d.id && p.motivo_assenza?.toUpperCase() === 'PR')
                                                .length * 8;
                                            const balance = Math.floor((base - plannedHours) / 8);
                                            return balance < 0
                                                ? { background: "var(--danger)", color: "white" }
                                                : { background: "var(--bg-card)", color: "var(--warning)" };
                                        })()
                                    }}>
                                        {d.tipo !== 'interinale' ? (() => {
                                            const base = d.rol_residui || 0;
                                            const plannedHours = pianificazione
                                                .filter(p => p.dipendente_id === d.id && p.motivo_assenza?.toUpperCase() === 'PR')
                                                .length * 8;
                                            return Math.floor((base - plannedHours) / 8);
                                        })() : '-'}
                                    </td>

                                    {days.map(day => {
                                        const key = `${d.id}_${day.date}`;
                                        const planned = planLookup[key];
                                        const isSelected = selectedCells.some(s => s.dipId === d.id && s.date === day.date);

                                        let displayLabel = "";
                                        let displayColor = "transparent";
                                        let isPlanned = !!planned;
                                        let isAbsence = false;

                                            if (planned) {
                                                if (planned.motivo_assenza) {
                                                    const mot = motivi.find(m => m.id === planned.motivo_assenza);
                                                    displayLabel = mot?.sigla || planned.motivo_assenza || "A";
                                                    // Usa il colore assegnato al motivo nel database
                                                    displayColor = mot?.colore || "#6366f1";
                                                    isAbsence = true;
                                                } else {
                                                    const tId = planned.turno_id || "D";
                                                    displayLabel = tId;
                                                    displayColor = "#6366f1"; // Unique planning color (Indigo)
                                                }
                                            } else {
                                                const actual = presenze.find(p => p.dipendente_id === d.id && p.data === day.date);
                                                if (actual && !actual.presente) {
                                                    const mot = motivi.find(m => m.id === actual.motivo_assenza);
                                                    displayLabel = mot?.sigla || "A";
                                                    displayColor = mot?.colore || "var(--danger)";
                                                    isAbsence = true;
                                                } else if (actual && actual.presente) {
                                                    // Usa getSlotForGroup per calcolare la fascia oraria corretta
                                                    const group = d.turno || d.turno_default || "D";
                                                    const slot = getSlotForGroup(group, day.date);
                                                    displayLabel = slot?.id || actual.turno_id || group;
                                                    const turn = TURNI.find(t => t.id === group) || TURNI.find(t => t.id === "D");
                                                    displayColor = turn?.colore || "var(--success)";
                                                } else if (day.isWeekend) {
                                                    displayLabel = "-";
                                                    displayColor = "var(--text-muted)";
                                                } else {
                                                    // AUTOMATION: Show all suggested shifts
                                                    const group = d.turno || d.turno_default || "D";
                                                    const slot = getSlotForGroup(group, day.date);
                                                    if (slot) {
                                                        displayLabel = slot.id;
                                                        const turn = TURNI.find(t => t.id === group) || TURNI.find(t => t.id === "D");
                                                        displayColor = turn?.colore || "#666";
                                                    }
                                                }
                                            }

                                        return (
                                            <td
                                                key={day.date}
                                                onClick={(e) => handleCellClick(d.id, day.date, e)}
                                                style={{
                                                    textAlign: "center",
                                                    padding: 0,
                                                    width: 60,
                                                    minWidth: 60,
                                                    height: 34,
                                                    background: isSelected ? "var(--accent-muted)" : (d.date === activeDateStr ? "rgba(249, 115, 22, 0.08)" : (day.isWeekend ? "rgba(99, 102, 241, 0.05)" : (isPlanned || isAbsence ? displayColor : "transparent"))),
                                                    borderLeft: "1px solid var(--border-light)",
                                                    cursor: "pointer",
                                                    ...rowStyle
                                                }}
                                            >
                                                <div style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: (isPlanned || isAbsence) ? "#fff" : (day.isWeekend ? "var(--text-muted)" : "var(--text-primary)"),
                                                    fontSize: 12,
                                                    fontWeight: 800,
                                                    opacity: (isPlanned || isAbsence) ? 1 : 0.6,
                                                    border: isPlanned ? "2px solid rgba(255,255,255,0.4)" : "none",
                                                    boxShadow: isPlanned ? "inset 0 0 8px rgba(0,0,0,0.1)" : "none"
                                                }}>
                                                    {displayLabel}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MODAL / POPUP PIANIFICAZIONE */}
            {selectedCells.length > 0 && !isSaving && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                    backdropFilter: "blur(4px)"
                }} onClick={() => setSelectedCells([])}>
                    <div style={{
                        background: "var(--bg-card)",
                        padding: 24,
                        borderRadius: 16,
                        width: 380,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                        border: "1px solid var(--border)"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Pianifica Periodo</h3>
                                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                                    Seleziona i giorni per l'inserimento multiplo
                                </div>
                            </div>
                            <button className="btn-ghost" onClick={() => setSelectedCells([])}>{Icons.x}</button>
                        </div>

                        {/* Date Range Selector in Modal */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>DA</label>
                                <input
                                    type="date"
                                    className="input"
                                    style={{ width: "100%", fontSize: 12, padding: "6px" }}
                                    value={selectedCells[0]?.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        const dipId = selectedCells[0].dipId;
                                        const endDate = selectedCells[selectedCells.length - 1].date;
                                        // Rebuild range
                                        const start = new Date(newDate);
                                        const end = new Date(endDate);
                                        const [minD, maxD] = start < end ? [start, end] : [end, start];
                                        const newSelection = [];
                                        let curr = new Date(minD);
                                        while (curr <= maxD) {
                                            newSelection.push({ dipId, date: curr.toISOString().split("T")[0] });
                                            curr.setDate(curr.getDate() + 1);
                                        }
                                        setSelectedCells(newSelection);
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>A</label>
                                <input
                                    type="date"
                                    className="input"
                                    style={{ width: "100%", fontSize: 12, padding: "6px" }}
                                    value={selectedCells[selectedCells.length - 1]?.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        const dipId = selectedCells[0].dipId;
                                        const startDate = selectedCells[0].date;
                                        // Rebuild range
                                        const start = new Date(startDate);
                                        const end = new Date(newDate);
                                        const [minD, maxD] = start < end ? [start, end] : [end, start];
                                        const newSelection = [];
                                        let curr = new Date(minD);
                                        while (curr <= maxD) {
                                            newSelection.push({ dipId, date: curr.toISOString().split("T")[0] });
                                            curr.setDate(curr.getDate() + 1);
                                        }
                                        setSelectedCells(newSelection);
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ padding: "8px", background: "var(--bg-secondary)", borderRadius: 8, marginBottom: 20, textAlign: "center", border: "1px dashed var(--border)" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--info)" }}>
                                {selectedCells.length} giorni selezionati
                            </span>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                                {["A", "B", "C", "D"].map(tId => {
                                    const turn = TURNI.find(t => t.id === tId) || { colore: "#666" };
                                    return (
                                        <button
                                            key={tId}
                                            onClick={() => savePlanningRecord(tId, null)}
                                            style={{
                                                padding: "10px 0",
                                                borderRadius: 8,
                                                border: "1px solid var(--border)",
                                                background: "transparent",
                                                color: turn.colore,
                                                fontWeight: 800,
                                                fontSize: 16,
                                                cursor: "pointer"
                                            }}
                                        >
                                            {tId}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                {(() => {
                                    // Ensure PF and PR are always available even if not in DB yet
                                    const allMotivi = [...motivi];
                                    if (!allMotivi.find(m => m.id === 'PF')) {
                                        allMotivi.push({ id: "PF", label: "Pianificazione Ferie", sigla: "PF", colore: "#f97316" });
                                    }
                                    if (!allMotivi.find(m => m.id === 'PR')) {
                                        allMotivi.push({ id: "PR", label: "Pianificazione ROL", sigla: "PR", colore: "#f97316" });
                                    }
                                    
                                    return allMotivi.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => savePlanningRecord(null, m.id)}
                                            style={{
                                                padding: "8px 4px",
                                                borderRadius: 8,
                                                border: "1px solid var(--border)",
                                                background: "transparent",
                                                color: m.colore,
                                                fontWeight: 700,
                                                fontSize: 11,
                                                cursor: "pointer",
                                                textAlign: "center"
                                            }}
                                        >
                                            <div style={{ fontWeight: 900, fontSize: 13 }}>{m.sigla}</div>
                                            <div style={{ fontSize: 9, opacity: 0.8 }}>{m.label}</div>
                                        </button>
                                    ));
                                })()}
                            </div>

                        <button
                            className="btn btn-secondary"
                            style={{ width: "100%", color: "var(--danger)" }}
                            onClick={() => savePlanningRecord(null, null)}
                        >
                            {Icons.trash} Rimuovi Pianificazione
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
