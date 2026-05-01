import { useState, useMemo } from "react";
import { REPARTI } from "../data/constants";
import { supabase } from "../lib/supabase";
import { getLocalDate } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";
import AnagraficaView from "./AnagraficaView";
import MotiviView from "./MotiviView";
import AnalisiAvanzataView from "./AnalisiAvanzataView";
import PlanningView from "./PlanningView";
import LimitazioniView from "./LimitazioniView";
import { AdminSecurityWrapper } from "../components/AdminSecurityWrapper";

export default function DashboardView({
    dipendenti, setDipendenti,
    presenze, setPresenze,
    assegnazioni, macchine,
    turnoCorrente,
    showToast, motivi, setMotivi,
    zones, globalDate,
    pianificazione, setPianificazione
}) {
    const [activeTab, setActiveTab] = useState("presenze"); // presenze, anagrafica, motivi, analisi, richiami
    const [selectedDipendente, setSelectedDipendente] = useState(null);
    const [richiami, setRichiami] = useState([]);
    const [showRichiamModal, setShowRichiamModal] = useState(false);
    const [editingRichiamo, setEditingRichiamo] = useState(null);
    const [rFormData, setRFormData] = useState({ data_richiamo: "", motivo: "", descrizione: "" });
    const [allegatiTemp, setAllegatiTemp] = useState([]);

    const today = globalDate || getLocalDate(new Date());

    // Default: yesterday as start
    const [dateStart, setDateStart] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return getLocalDate(d);
    });

    // Default: +27 days (4 settimane)
    const [dateEnd, setDateEnd] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 27);
        return getLocalDate(d);
    });

    // Helper: Calcolo Pasqua (algoritmo di Gauss)
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

    // Helper: Riconosce Festività Nazionali
    const isItalianHoliday = (d) => {
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();

        // Feste fisse
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

        // Pasquetta (Lunedì dell'Angelo)
        const easter = getEaster(year);
        const pasquetta = new Date(easter);
        pasquetta.setDate(pasquetta.getDate() + 1);

        const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const pt = new Date(pasquetta.getFullYear(), pasquetta.getMonth(), pasquetta.getDate());
        return dt.getTime() === pt.getTime();
    };

    const visibleDays = useMemo(() => {
        const days = [];
        const start = new Date(dateStart + "T00:00:00");
        const end = new Date(dateEnd + "T00:00:00");
        const d = new Date(start);

        // Safety break to prevent infinite loop if dates are invalid
        let iterations = 0;
        while (d <= end && iterations < 35) {
            const dateStr = getLocalDate(d);
            days.push({
                date: dateStr,
                label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
                dayName: d.toLocaleDateString("it-IT", { weekday: "short" }),
                isToday: dateStr === today,
                isSunday: d.getDay() === 0 || isItalianHoliday(d),
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

    const [selectedCells, setSelectedCells] = useState([]); // Array of { dipId, date }
    const [isSaving, setIsSaving] = useState(false);

    const getPresenceStatus = (dipId, date, isSunday) => {
        const key = `${dipId}-${date}`;
        const p = presenceMap[key];
        if (p) {
            // If record exists, use it
            if (p.presente) return true;
            if (p.motivo_assenza) {
                const m = motivi.find(ma => ma.id === p.motivo_assenza);
                return m ? m.sigla : p.motivo_assenza;
            }
            return false;
        }

        // Default behavior if no record exists
        if (isSunday) return "-";
        return true;
    };

    const handleCellClick = (dipId, date, event) => {
        if (event.shiftKey && selectedCells.length > 0) {
            const lastSelected = selectedCells[0];
            if (lastSelected.dipId === dipId) {
                const start = new Date(lastSelected.date);
                const end = new Date(date);
                const [minD, maxD] = start < end ? [start, end] : [end, start];
                
                const newSelection = [];
                let curr = new Date(minD);
                while (curr <= maxD) {
                    newSelection.push({ dipId, date: getLocalDate(curr) });
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

    const saveMassPresenza = async (isPresent, motivoId = null, turnoId = null) => {
        if (selectedCells.length === 0) return;
        setIsSaving(true);
        try {
            const updates = selectedCells.map(cell => {
                const currentP = presenceMap[`${cell.dipId}-${cell.date}`];
                return {
                    dipendente_id: cell.dipId,
                    data: cell.date,
                    presente: isPresent,
                    motivo_assenza: isPresent ? null : (motivoId || currentP?.motivo_assenza),
                    turno_id: turnoId || currentP?.turno_id || turnoCorrente || "D"
                };
            });
            
            if (!isPresent && !motivoId && !turnoId) {
                // Delete logic
                for (const cell of selectedCells) {
                    await supabase
                        .from('presenze')
                        .delete()
                        .eq('dipendente_id', cell.dipId)
                        .eq('data', cell.date);
                }
                setPresenze(prev => prev.filter(p => !selectedCells.some(s => s.dipId === p.dipendente_id && s.date === p.data)));
                showToast("Presenze rimosse", "info");
            } else {
                const { data, error } = await supabase
                    .from('presenze')
                    .upsert(updates, { onConflict: 'dipendente_id,data' })
                    .select();

                if (error) throw error;
                
                setPresenze(prev => {
                    const filtered = prev.filter(p => !selectedCells.some(s => s.dipId === p.dipendente_id && s.date === p.data));
                    return [...filtered, ...data];
                });
                showToast(`Aggiornate ${selectedCells.length} presenze`, "success");
            }
        } catch (error) {
            console.error("Error saving massive presence:", error);
            showToast("Errore durante il salvataggio", "error");
        } finally {
            setIsSaving(false);
            setSelectedCells([]);
        }
    };

    // -------------------------------------------------------------------------
    // FILTRO E ORDINAMENTO DIPENDENTI
    // -------------------------------------------------------------------------

    // 1. FILTRO per Turno Corrente
    // L'utente si aspetta di vedere solo i dipendenti appartenenti al turno selezionato (es. "D")
    const filteredDipendenti = dipendenti.filter(d => {
        if (d.attivo === false) return false;
        if (!turnoCorrente) return true; // Mostra tutti se nessun turno è selezionato
        return d.turno_default === turnoCorrente;
    });

    // presenzeOdierni removed - unused

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

    // RC logic: find missed compensatory rests (cumulative balance in visible range)
    const dipWithAlerts = useMemo(() => {
        const alerts = new Set();
        sortedDip.forEach(dip => {
            let sundaysWorked = 0;
            let rcsTaken = 0;

            presenze.filter(p => p.dipendente_id === dip.id).forEach(p => {
                const d = new Date(p.data);
                // Present on Sunday
                if (d.getDay() === 0 && p.presente) {
                    sundaysWorked++;
                }
                // Has "Permesso Compensativo" (RC)
                if (p.motivo_assenza === 'permesso_compensativo') {
                    rcsTaken++;
                }
            });

            if (sundaysWorked > rcsTaken) {
                alerts.add(dip.id);
            }
        });
        return alerts;
    }, [presenze, sortedDip]);

    // Fetch richiami per dipendente
    const fetchRichiami = async (dipId) => {
        try {
            const { data, error } = await supabase
                .from('richiami')
                .select('*, richiami_allegati(*)')
                .eq('dipendente_id', dipId)
                .is('deleted_at', null)
                .order('data_richiamo', { ascending: false });

            if (error) throw error;
            setRichiami(data || []);
        } catch (error) {
            console.error("Errore caricamento richiami:", error);
            showToast("Errore caricamento richiami", "error");
        }
    };

    // Cambio dipendente selezionato
    const handleSelectDipendente = (dip) => {
        setSelectedDipendente(dip);
        setActiveTab("richiami");
        fetchRichiami(dip.id);
        setEditingRichiamo(null);
        setRFormData({ data_richiamo: "", motivo: "", descrizione: "" });
        setAllegatiTemp([]);
    };

    // Salva richiamo (nuovo o modifica)
    const handleSaveRichiamo = async () => {
        if (!rFormData.data_richiamo || !rFormData.motivo || !selectedDipendente) {
            showToast("Compila i campi obbligatori", "error");
            return;
        }

        try {
            const payload = {
                dipendente_id: selectedDipendente.id,
                data_richiamo: rFormData.data_richiamo,
                motivo: rFormData.motivo,
                descrizione: rFormData.descrizione || null
            };

            if (editingRichiamo) {
                const { error } = await supabase
                    .from('richiami')
                    .update(payload)
                    .eq('id', editingRichiamo.id);

                if (error) throw error;
                showToast("Richiamo modificato", "success");
            } else {
                const { data, error } = await supabase
                    .from('richiami')
                    .insert([payload])
                    .select();

                if (error) throw error;
                setRichiami([data[0], ...richiami]);
                showToast("Richiamo aggiunto", "success");
            }

            setShowRichiamModal(false);
            setEditingRichiamo(null);
            setRFormData({ data_richiamo: "", motivo: "", descrizione: "" });
            setAllegatiTemp([]);
            await fetchRichiami(selectedDipendente.id);
        } catch (error) {
            console.error("Errore salvataggio richiamo:", error);
            showToast("Errore salvataggio", "error");
        }
    };

    // Soft delete richiamo
    const handleDeleteRichiamo = async (richiamo) => {
        if (!confirm("Confermi l'eliminazione del richiamo?")) return;

        try {
            const { error } = await supabase
                .from('richiami')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', richiamo.id);

            if (error) throw error;
            setRichiami(richiami.filter(r => r.id !== richiamo.id));
            showToast("Richiamo eliminato", "success");
        } catch (error) {
            console.error("Errore eliminazione:", error);
            showToast("Errore eliminazione", "error");
        }
    };

    if (!dipendenti) return <div className="p-4 text-center">Caricamento dipendenti...</div>;

    let lastReparto = "";

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Tab Navigation */}
            <div className="tabs" style={{ marginBottom: 20, display: "flex", gap: 8 }}>
                <button
                    className={`tab ${activeTab === "presenze" ? "active" : ""}`}
                    onClick={() => setActiveTab("presenze")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {Icons.dashboard} Presenze
                </button>
                <button
                    className={`tab ${activeTab === "pianificazione" ? "active" : ""}`}
                    onClick={() => setActiveTab("pianificazione")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {Icons.calendar} Pianificazione
                </button>
                <button
                    className={`tab ${activeTab === "limitazioni" ? "active" : ""}`}
                    onClick={() => setActiveTab("limitazioni")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    🩺 Prescrizione e Note
                </button>
                <button
                    className={`tab ${activeTab === "anagrafica" ? "active" : ""}`}
                    onClick={() => setActiveTab("anagrafica")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {Icons.users} Anagrafica Personale
                </button>
                <button
                    className={`tab ${activeTab === "motivi" ? "active" : ""}`}
                    onClick={() => setActiveTab("motivi")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {Icons.settings} Motivi Assenza
                </button>
                <button
                    className={`tab ${activeTab === "analisi" ? "active" : ""}`}
                    onClick={() => setActiveTab("analisi")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    {Icons.analytics} Analisi Avanzata
                </button>
                <button
                    className={`tab ${activeTab === "richiami" ? "active" : ""}`}
                    onClick={() => setActiveTab("richiami")}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                    ⚠️ Richiami
                </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
                {activeTab === "presenze" && (
                    <div className="fade-in">
                        <div style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
                            {/* COUNTER: Present Employees */}
                            <div style={{ padding: "8px 16px", background: "var(--success-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(34,197,94,0.2)" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>PRESENTI</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--success)", marginLeft: 8 }}>{presenti}</span>
                            </div>
                            {/* COUNTER: Absent Employees */}
                            <div style={{ padding: "8px 16px", background: "var(--danger-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.2)" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>ASSENTI</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)", marginLeft: 8 }}>{assenti}</span>
                            </div>
                            {/* COUNTER: Total */}
                            <div style={{ padding: "8px 16px", background: "var(--info-muted)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(59,130,246,0.2)" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>TOTALE</span>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--info)", marginLeft: 8 }}>{filteredDipendenti.length}</span>
                            </div>
                            {/* DATE RANGE FILTER */}
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                                <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>DA</label>
                                <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                                <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>A</label>
                                <input type="date" className="input" style={{ width: 130, padding: "5px 8px", fontSize: 12 }} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                            </div>
                        </div>

                        <div className="table-container">
                            <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                                <thead>
                                    <tr>
                                        {/* COLONNA 1: Nominativo (Sticky Top & Left) */}
                                        <th style={{ padding: "16px 14px", width: 180, position: "sticky", top: 0, left: 0, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)" }}>Dipendente</th>

                                        {/* COLONNA 2: Team/Reparto (Sticky Top & Left) */}
                                        <th style={{ padding: "16px 8px", width: 60, position: "sticky", top: 0, left: 180, background: "var(--bg-tertiary)", zIndex: 20, borderBottom: "2px solid var(--border)", textAlign: 'center', borderRight: "2px solid var(--border)" }}>Team</th>

                                        {/* COLONNE DATE (Sticky Top) */}
                                        {visibleDays.map((day) => (
                                            <th
                                                key={day.date}
                                                style={{
                                                    position: "sticky",
                                                    top: 0,
                                                    zIndex: 10,
                                                    textAlign: "center",
                                                    padding: "10px 4px",
                                                    width: 60,
                                                    background: day.isToday ? "rgba(249, 115, 22, 0.2)" : "var(--bg-card)",
                                                    color: day.isToday ? "var(--accent)" : undefined,
                                                    borderBottom: "2px solid var(--border)",
                                                    borderLeft: "1px solid var(--border-light)" // Demarcation line
                                                }}
                                            >
                                                <div style={{ fontSize: 12, textTransform: "uppercase", lineHeight: 1.2, marginBottom: 4 }}>{day.dayName}</div>
                                                <div style={{ fontSize: 15, fontWeight: 700 }}>{day.label}</div>
                                            </th>
                                        ))}

                                        {/* COLUMN: Assigned Machine (Sticky Top) */}
                                        <th style={{
                                            position: "sticky",
                                            top: 0,
                                            zIndex: 10,
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


                                                return {
                                                    label: z.label || z.id,
                                                    machines: zoneMachines
                                                };
                                            }

                                            return a.macchina_id || a.attivita_id || "N/A";
                                        });

                                        return (
                                            <tr key={d.id}>
                                                {/* CELLA 1: Nominativo (Sticky) */}
                                                <td style={{
                                                    padding: "4px 8px", // Reduced from 8px 8px
                                                    minWidth: 180, // Match header width
                                                    maxWidth: 180,
                                                    fontWeight: 500,
                                                    fontSize: 15, // Same as day font size
                                                    whiteSpace: "nowrap",
                                                    position: "sticky",
                                                    left: 0,
                                                    background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "var(--bg-card)", // Only here for interinale
                                                    zIndex: 5,
                                                    borderRight: "1px solid var(--border-light)",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    ...rowStyle
                                                }}>
                                                    {d.cognome} {(d.nome || "").charAt(0)}.
                                                    {dipWithAlerts.has(d.id) && (
                                                        <span style={{ marginLeft: 6, cursor: "help" }} title="Mancato riposo compensativo!">⚠️</span>
                                                    )}
                                                </td>

                                                {/* CELLA 2: Team (Sticky - Richiesta Utente) */}
                                                <td style={{
                                                    padding: "4px 4px", // Reduced from 8px 4px
                                                    textAlign: "center",
                                                    fontWeight: 700,
                                                    fontSize: 15, // Same as nominativo font size
                                                    color: "var(--text-muted)",
                                                    position: "sticky",
                                                    left: 180,
                                                    background: "var(--bg-card)",
                                                    zIndex: 5,
                                                    borderRight: "2px solid var(--border)", // Divisore tra colonne fisse e scrollabili
                                                    ...rowStyle
                                                }}>
                                                    {d.reparto_id ? d.reparto_id.replace(/^T/i, '') : ''}
                                                </td>

                                                {/* PRESENCE CELLS */}
                                                {visibleDays.map((day) => {
                                                    const isSelected = selectedCells.some(s => s.dipId === d.id && s.date === day.date);
                                                    
                                                    const status = getPresenceStatus(d.id, day.date, day.isSunday);
                                                    const isPresent = status === true;
                                                    const sigla = (!isPresent && typeof status === "string") ? status : "-";
                                                    const isAbsence = !isPresent && sigla !== "-";

                                                    // Cell background logic
                                                    let cellBg = undefined;
                                                    if (isSelected) {
                                                        cellBg = "var(--accent-muted)";
                                                    } else if (isAbsence) {
                                                        cellBg = "rgba(249, 115, 22, 0.2)"; // Orange fill for absence
                                                    } else if (day.isSunday) {
                                                        cellBg = "rgba(99, 102, 241, 0.15)"; // Soft Indigo for Sunday
                                                    } else if (day.isToday) {
                                                        cellBg = "rgba(249, 115, 22, 0.04)";
                                                    }

                                                    return (
                                                        <td
                                                            key={day.date}
                                                            onClick={(e) => handleCellClick(d.id, day.date, e)}
                                                            style={{
                                                                textAlign: "center",
                                                                padding: 0, 
                                                                background: cellBg,
                                                                borderLeft: "1px solid var(--border-light)",
                                                                height: 34,
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
                                                                fontWeight: 700,
                                                                fontSize: 14,
                                                                color: isAbsence ? "#EA580C" : (isPresent ? "var(--text-primary)" : "var(--text-muted)"),
                                                            }}>
                                                                {isPresent ? (
                                                                    (() => {
                                                                        return "1";
                                                                    })()
                                                                ) : sigla}
                                                            </div>
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
                                                                    fontSize: 15, // Same as nominativo font size
                                                                    marginRight: 4,
                                                                    cursor: isZone ? "pointer" : "default"
                                                                }}>
                                                                    {name}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "anagrafica" && (
                    <AdminSecurityWrapper showToast={showToast}>
                        <AnagraficaView
                            dipendenti={dipendenti}
                            setDipendenti={setDipendenti}
                            macchine={macchine}
                            showToast={showToast}
                            turnoCorrente={turnoCorrente}
                        />
                    </AdminSecurityWrapper>
                )}

                {activeTab === "motivi" && (
                    <MotiviView
                        motivi={motivi}
                        setMotivi={setMotivi}
                        showToast={showToast}
                    />
                )}

                {activeTab === "analisi" && (
                    <AnalisiAvanzataView
                        dipendenti={dipendenti}
                        presenze={presenze}
                        motivi={motivi}
                        globalDate={globalDate}
                        turnoCorrente={turnoCorrente}
                    />
                )}

                {activeTab === "pianificazione" && (
                    <PlanningView
                        dipendenti={dipendenti}
                        setDipendenti={setDipendenti}
                        presenze={presenze}
                        pianificazione={pianificazione}
                        setPianificazione={setPianificazione}
                        turnoCorrente={turnoCorrente}
                        globalDate={globalDate}
                        motivi={motivi}
                        showToast={showToast}
                    />
                )}

                {activeTab === "limitazioni" && (
                    <AdminSecurityWrapper showToast={showToast}>
                        <LimitazioniView
                            dipendenti={dipendenti}
                            presenze={presenze}
                        />
                    </AdminSecurityWrapper>
                )}

                {activeTab === "richiami" && (
                    <div className="fade-in">
                        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <select
                                    className="select-input"
                                    style={{ width: 300 }}
                                    value={selectedDipendente?.id || ""}
                                    onChange={(e) => {
                                        const dip = dipendenti.find(d => d.id === e.target.value);
                                        if (dip) handleSelectDipendente(dip);
                                    }}
                                >
                                    <option value="">Seleziona dipendente...</option>
                                    {dipendenti.filter(d => d.attivo !== false).map(d => (
                                        <option key={d.id} value={d.id}>{d.cognome} {d.nome}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedDipendente && (
                                <button className="btn btn-primary" onClick={() => {
                                    setShowRichiamModal(true);
                                    setEditingRichiamo(null);
                                    setRFormData({ data_richiamo: "", motivo: "", descrizione: "" });
                                }}>
                                    {Icons.plus} Aggiungi Richiamo
                                </button>
                            )}
                        </div>

                        {selectedDipendente && (
                            <div>
                                {richiami.length > 0 ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        {richiami.map(r => (
                                            <div key={r.id} style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-secondary)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{new Date(r.data_richiamo).toLocaleDateString()}</div>
                                                        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Motivo: {r.motivo}</div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ padding: "4px 8px", fontSize: 12 }}
                                                            onClick={() => {
                                                                setEditingRichiamo(r);
                                                                setRFormData({ data_richiamo: r.data_richiamo, motivo: r.motivo, descrizione: r.descrizione || "" });
                                                                setShowRichiamModal(true);
                                                            }}
                                                        >
                                                            Modifica
                                                        </button>
                                                        <button
                                                            className="btn btn-danger"
                                                            style={{ padding: "4px 8px", fontSize: 12 }}
                                                            onClick={() => handleDeleteRichiamo(r)}
                                                        >
                                                            Elimina
                                                        </button>
                                                    </div>
                                                </div>
                                                {r.descrizione && (
                                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, padding: 8, background: "var(--bg-card)", borderRadius: 4 }}>
                                                        {r.descrizione}
                                                    </div>
                                                )}
                                                {r.richiami_allegati?.length > 0 && (
                                                    <div style={{ marginTop: 8, fontSize: 11 }}>
                                                        <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Allegati ({r.richiami_allegati.length}):</div>
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                            {r.richiami_allegati.map(a => (
                                                                <a key={a.id} href={a.url_file} target="_blank" rel="noopener noreferrer" style={{ padding: "4px 8px", background: "var(--bg-tertiary)", borderRadius: 4, fontSize: 11, color: "var(--primary)", textDecoration: "none", border: "1px solid var(--border)" }}>
                                                                    📎 {a.nome_file}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                        Nessun richiamo registrato
                                    </div>
                                )}
                            </div>
                        )}

                        {!selectedDipendente && (
                            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                                Seleziona un dipendente per visualizzare i richiami
                            </div>
                        )}

                        {/* MODAL RICHIAMO */}
                        {showRichiamModal && selectedDipendente && (
                            <Modal
                                title={editingRichiamo ? "Modifica Richiamo" : "Nuovo Richiamo"}
                                onClose={() => {
                                    setShowRichiamModal(false);
                                    setEditingRichiamo(null);
                                    setRFormData({ data_richiamo: "", motivo: "", descrizione: "" });
                                    setAllegatiTemp([]);
                                }}
                                footer={
                                    <>
                                        <button className="btn btn-secondary" onClick={() => setShowRichiamModal(false)}>Annulla</button>
                                        <button className="btn btn-primary" onClick={handleSaveRichiamo}>Salva</button>
                                    </>
                                }
                            >
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                        <label className="form-label">Dipendente</label>
                                        <input className="input" disabled value={`${selectedDipendente.cognome} ${selectedDipendente.nome}`} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Data Richiamo</label>
                                        <input className="input" type="date" value={rFormData.data_richiamo} onChange={(e) => setRFormData({ ...rFormData, data_richiamo: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Motivo</label>
                                        <input className="input" placeholder="Es: Assenza ingiustificata" value={rFormData.motivo} onChange={(e) => setRFormData({ ...rFormData, motivo: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                        <label className="form-label">Descrizione</label>
                                        <textarea className="input" style={{ minHeight: 80, resize: "vertical" }} placeholder="Dettagli aggiuntivi..." value={rFormData.descrizione} onChange={(e) => setRFormData({ ...rFormData, descrizione: e.target.value })}></textarea>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                        <label className="form-label">Allegati</label>
                                        <div style={{ padding: 12, border: "2px dashed var(--border)", borderRadius: 8, textAlign: "center", cursor: "pointer", background: "var(--bg-secondary)" }}>
                                            <input type="file" multiple style={{ display: "none" }} id="file-input" onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                setAllegatiTemp([...allegatiTemp, ...files.map(f => ({ file: f, name: f.name, size: f.size }))]);
                                            }} />
                                            <label htmlFor="file-input" style={{ cursor: "pointer", display: "block" }}>
                                                📁 Clicca per selezionare file o trascinali qui
                                            </label>
                                        </div>
                                        {allegatiTemp.length > 0 && (
                                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {allegatiTemp.map((a, i) => (
                                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--bg-tertiary)", borderRadius: 4, fontSize: 11 }}>
                                                        <span>{a.name}</span>
                                                        <button className="btn-ghost" style={{ padding: 0, width: 16, height: 16 }} onClick={() => setAllegatiTemp(allegatiTemp.filter((_, idx) => idx !== i))}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Modal>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL GESTIONE PRESENZE MASSIVA */}
            {selectedCells.length > 0 && !isSaving && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 1000, backdropFilter: "blur(4px)"
                }} onClick={() => setSelectedCells([])}>
                    <div style={{
                        background: "var(--bg-card)", padding: 24, borderRadius: 16, width: 380,
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)", border: "1px solid var(--border)"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Gestisci Presenze</h3>
                                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                                    Conferma presenza o giustifica assenza
                                </div>
                            </div>
                            <button className="btn-ghost" onClick={() => setSelectedCells([])}>{Icons.x}</button>
                        </div>

                        {/* Date Range Selector */}
                        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>DA</label>
                                <input 
                                    type="date" className="input" style={{ width: "100%", fontSize: 12, padding: "6px" }}
                                    value={selectedCells[0]?.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        const dipId = selectedCells[0].dipId;
                                        const endDate = selectedCells[selectedCells.length - 1].date;
                                        const start = new Date(newDate);
                                        const end = new Date(endDate);
                                        const [minD, maxD] = start < end ? [start, end] : [end, start];
                                        const newSelection = [];
                                        let curr = new Date(minD);
                                        while (curr <= maxD) {
                                            newSelection.push({ dipId, date: getLocalDate(curr) });
                                            curr.setDate(curr.getDate() + 1);
                                        }
                                        setSelectedCells(newSelection);
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>A</label>
                                <input 
                                    type="date" className="input" style={{ width: "100%", fontSize: 12, padding: "6px" }}
                                    value={selectedCells[selectedCells.length - 1]?.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        const dipId = selectedCells[0].dipId;
                                        const startDate = selectedCells[0].date;
                                        const start = new Date(startDate);
                                        const end = new Date(newDate);
                                        const [minD, maxD] = start < end ? [start, end] : [end, start];
                                        const newSelection = [];
                                        let curr = new Date(minD);
                                        while (curr <= maxD) {
                                            newSelection.push({ dipId, date: getLocalDate(curr) });
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
                                {["A", "B", "C", "D"].map(tId => (
                                    <button 
                                        key={tId} onClick={() => saveMassPresenza(true, null, tId)}
                                        style={{ padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontWeight: 800, fontSize: 16, cursor: "pointer" }}
                                    >
                                        {tId}
                                    </button>
                                ))}
                            </div>
                            <button 
                                onClick={() => saveMassPresenza(true, null, null)}
                                style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 8, background: "var(--success)", color: "white", border: "none", fontWeight: 700, cursor: "pointer" }}
                            >
                                Conferma Presenza Standard
                            </button>
                        </div>

                        <div style={{ marginBottom: 20 }}>
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
                                            key={m.id} onClick={() => saveMassPresenza(false, m.id)}
                                            style={{ padding: "8px 4px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: m.colore, fontWeight: 700, fontSize: 11, cursor: "pointer", textAlign: "center" }}
                                        >
                                            <div style={{ fontWeight: 900, fontSize: 13 }}>{m.sigla}</div>
                                            <div style={{ fontSize: 9, opacity: 0.8 }}>{m.label}</div>
                                        </button>
                                    ));
                                })()}
                            </div>
                        </div>

                        <button 
                            className="btn btn-secondary" 
                            style={{ width: "100%", color: "var(--danger)" }}
                            onClick={() => saveMassPresenza(false, null, null)}
                        >
                            {Icons.trash} Rimuovi Marcatura
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
