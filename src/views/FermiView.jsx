import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/ui/Icons';
import { MOTIVI_FERMO, REPARTI, TURNI } from '../data/constants';

export default function FermiView() {
    // Determine Local Date for default
    const getLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- STATE ---
    const [date, setDate] = useState(getLocalDate(new Date()));
    const [turno, setTurno] = useState("A"); // Default or empty? Let's default to A for now or handle empty

    // Data List
    const [fermi, setFermi] = useState([]);
    const [macchine, setMacchine] = useState([]);

    // Form State
    const [selectedMachine, setSelectedMachine] = useState("");
    const [selectedReason, setSelectedReason] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [notes, setNotes] = useState("");

    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type }

    // --- FETCH DATA ---
    // 1. Fetch Machines ONCE
    useEffect(() => {
        const fetchMachines = async () => {
            const { data, error } = await supabase.from('macchine').select('*').order('nome');
            if (error) console.error("Error fetching machines:", error);
            else setMacchine(data || []);
        };
        fetchMachines();
    }, []);

    // 2. Fetch Fermi when Date/Turno changes
    useEffect(() => {
        const fetchFermi = async () => {
            setLoading(true);
            let query = supabase
                .from('fermi_macchina')
                .select('*, macchine(nome, reparto_id)') // Join to get machine name/reparto details if needed
                .eq('data', date);

            if (turno) {
                query = query.eq('turno_id', turno);
            }

            query = query.order('ora_inizio', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching fermi:", error);
                showNotification("Errore caricamento dati", "error");
            } else {
                setFermi(data || []);
            }
            setLoading(false);
        };

        fetchFermi();
    }, [date, turno]);

    // --- HELPERS ---
    const showNotification = (msg, type = "success") => {
        setNotification({ message: msg, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const min1 = h1 * 60 + m1;
        const min2 = h2 * 60 + m2;
        return Math.max(0, min2 - min1);
    };

    // --- HANDLERS ---
    const handleSave = async () => {
        if (!selectedMachine || !selectedReason || !startTime || !endTime) {
            showNotification("Compila tutti i campi obbligatori", "error");
            return;
        }

        const duration = calculateDuration(startTime, endTime);
        if (duration <= 0) {
            showNotification("L'ora di fine deve essere successiva all'inizio", "error");
            return;
        }

        const payload = {
            data: date,
            turno_id: turno,
            macchina_id: selectedMachine,
            motivo: selectedReason, // Store ID or Label? Constants use ID. Let's store Label for readability in Report or ID? 
            // The DB schema likely expects text or we standardized on IDs. 
            // Let's store the Label associated with the ID for easier reading, OR store ID if we want strictly relational.
            // ReportView currently just displays `f.motivo`. If we change constant labels, old records might be stale if we store text.
            // But let's look at `motivi_assenza`... usually we store IDs.
            // **Correction**: ReportView displays `f.motivo` directly. 
            // Ideally we store the ID `guasto_meccanico` and map it back. 
            // BUT for simplicity in `ReportView` (which I didn't verify if it maps or just shows text), 
            // I see `<span>{f.motivo}</span>` in ReportView. So it prints what's in DB.
            // Let's store the LABEL to be safe/human readable immediately, or ID and update ReportView?
            // The plan said "Add MOTIVI_FERMO to constants". 
            // Let's store the **Label** (e.g. "Guasto Meccanico") for now so ReportView works without changes.
            motivo: MOTIVI_FERMO.find(m => m.id === selectedReason)?.label || selectedReason,

            ora_inizio: startTime,
            ora_fine: endTime,
            durata_minuti: duration,
            note: notes
        };

        const { data, error } = await supabase.from('fermi_macchina').insert(payload).select();

        if (error) {
            console.error("Error saving fermo:", error);
            showNotification("Errore salvataggio: " + error.message, "error");
        } else {
            showNotification("Fermo registrato correttamente");
            // Add to local list immediately
            // We need to fetch the machine name for the UI list since we only have ID
            const machineDetails = macchine.find(m => m.id === selectedMachine);
            const newRecord = {
                ...data[0],
                macchine: { nome: machineDetails?.nome, reparto_id: machineDetails?.reparto_id }
            };

            setFermi([newRecord, ...fermi]);

            // Reset form partly
            setSelectedMachine("");
            setSelectedReason("");
            setStartTime("");
            setEndTime("");
            setNotes("");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo fermo?")) return;

        const { error } = await supabase.from('fermi_macchina').delete().eq('id', id);
        if (error) {
            console.error("Error deleting:", error);
            showNotification("Errore cancellazione", "error");
        } else {
            setFermi(fermi.filter(f => f.id !== id));
            showNotification("Fermo eliminato", "warning");
        }
    };

    // --- RENDER HELPERS ---
    const machinesByReparto = useMemo(() => {
        const grouped = {};
        REPARTI.forEach(r => grouped[r.id] = []);
        macchine.forEach(m => {
            if (grouped[m.reparto_id]) {
                grouped[m.reparto_id].push(m);
            }
        });
        return grouped;
    }, [macchine]);

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>

            {/* Notification Toast */}
            {notification && (
                <div style={{
                    position: "fixed", bottom: 20, right: 20,
                    background: notification.type === "error" ? "var(--danger)" :
                        notification.type === "warning" ? "var(--warning)" : "var(--success)",
                    color: "#fff", padding: "12px 24px", borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 1000,
                    fontWeight: 600
                }}>
                    {notification.message}
                </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Gestione Fermi Macchina</h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Registra i tempi di inattività delle macchine per il report giornaliero.</p>
                </div>

                {/* SELECTORS HEADER */}
                <div style={{ display: "flex", gap: 12, background: "var(--bg-card)", padding: "12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Data</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="input"
                            style={{ width: 140 }}
                        />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Turno</label>
                        <select
                            value={turno}
                            onChange={(e) => setTurno(e.target.value)}
                            className="select-input"
                            style={{ width: 120 }}
                        >
                            {TURNI.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>

                {/* LEFT: INSERT FORM */}
                <div className="card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        {Icons.plus} Nuovo Fermo
                    </h3>

                    <div className="form-group">
                        <label className="form-label">Macchina</label>
                        <select
                            className="select-input"
                            value={selectedMachine}
                            onChange={(e) => setSelectedMachine(e.target.value)}
                        >
                            <option value="">Seleziona Macchina...</option>
                            {REPARTI.map(reparto => (
                                <optgroup key={reparto.id} label={reparto.nome}>
                                    {(machinesByReparto[reparto.id] || []).map(m => (
                                        <option key={m.id} value={m.id}>{m.nome}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Motivo</label>
                        <select
                            className="select-input"
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                        >
                            <option value="">Seleziona Motivo...</option>
                            {MOTIVI_FERMO.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.icona} {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Ora Inizio</label>
                            <input
                                type="time"
                                className="input"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">Ora Fine</label>
                            <input
                                type="time"
                                className="input"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Live Duration Calculation */}
                    {startTime && endTime && (
                        <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)", textAlign: "right" }}>
                            Durata calcolata: <strong>{calculateDuration(startTime, endTime)} min</strong>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Note (Opzionale)</label>
                        <textarea
                            className="input"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Dettagli aggiuntivi..."
                        />
                    </div>

                    <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={handleSave}>
                        Registra Fermo
                    </button>

                </div>

                {/* RIGHT: LIST */}
                <div className="card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Riepilogo Fermi — {date}</h3>

                    {loading ? (
                        <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                    ) : fermi.length === 0 ? (
                        <div style={{ padding: 40, textAlign: "center", fontStyle: "italic", color: "var(--text-muted)", border: "2px dashed var(--border)", borderRadius: 8 }}>
                            Nessun fermo registrato per questo turno.
                        </div>
                    ) : (
                        <div className="table-container">
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: "left", width: "30%" }}>Macchina</th>
                                        <th style={{ textAlign: "center" }}>Orario</th>
                                        <th style={{ textAlign: "left" }}>Motivo</th>
                                        <th style={{ textAlign: "center" }}>Min.</th>
                                        <th style={{ width: 40 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fermi.map(f => {
                                        const motivoObj = MOTIVI_FERMO.find(m => m.label === f.motivo) || MOTIVI_FERMO.find(m => m.id === f.motivo); // Handle both saves
                                        const machineName = f.macchine?.nome || "Macchina " + f.macchina_id;
                                        const repartoName = REPARTI.find(r => r.id === f.macchine?.reparto_id)?.nome || "";

                                        return (
                                            <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {machineName}
                                                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>{repartoName}</div>
                                                </td>
                                                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: 13 }}>
                                                    {f.ora_inizio.slice(0, 5)} - {f.ora_fine.slice(0, 5)}
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        {motivoObj && <span>{motivoObj.icona}</span>}
                                                        <span>{f.motivo}</span>
                                                    </div>
                                                    {f.note && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>{f.note}</div>}
                                                </td>
                                                <td style={{ textAlign: "center", fontWeight: 700 }}>
                                                    {f.durata_minuti}
                                                </td>
                                                <td style={{ textAlign: "right" }}>
                                                    <button
                                                        onClick={() => handleDelete(f.id)}
                                                        className="btn-icon-small"
                                                        style={{ color: "var(--text-muted)", hover: { color: "var(--danger)" } }}
                                                        title="Elimina"
                                                    >
                                                        {Icons.trash}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
