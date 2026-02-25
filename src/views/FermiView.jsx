import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/ui/Icons';
import { MOTIVI_FERMO, REPARTI, TURNI } from '../data/constants';
import { getLocalDate } from '../lib/dateUtils';

export default function FermiView({ macchine = [], initialReparto, initialTurno }) {

    const [date, setDate] = useState(getLocalDate(new Date()));
    const [turno, setTurno] = useState(initialTurno || "A");

    // Data List
    const [fermi, setFermi] = useState([]);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);

    // 1. Fetch Fermi when Date/Turno changes
    useEffect(() => {
        const fetchFermi = async () => {
            setLoading(true);

            // Simplified query without problematic join
            let query = supabase
                .from('fermi_macchina')
                .select('*')
                .eq('data', date);

            if (turno) {
                query = query.eq('turno_id', turno);
            }

            // We order by ora_inizio but it might be null
            query = query.order('ora_inizio', { ascending: false, nullsFirst: false });

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching fermi:", error);
                showNotification("Errore caricamento dati: " + error.message, "error");
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
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Report Fermi Macchina</h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>Riepilogo delle inefficienze e dei fermi registrati per il turno selezionato.</p>
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
                            style={{ width: 140 }}
                        >
                            <option value="">Tutti i Turni</option>
                            {TURNI.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.02)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Elenco Fermi Registrati</h3>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        Totale: <strong>{fermi.length}</strong> fermi
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento in corso...</div>
                ) : fermi.length === 0 ? (
                    <div style={{ padding: 80, textAlign: "center", fontStyle: "italic", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>{Icons.report}</div>
                        Nessun fermo registrato per i criteri selezionati.
                    </div>
                ) : (
                    <div className="table-container">
                        <table style={{ width: "100%" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-tertiary)" }}>
                                    <th style={{ textAlign: "left", padding: "12px 20px" }}>Macchina</th>
                                    <th style={{ textAlign: "center", padding: "12px" }}>Orario</th>
                                    <th style={{ textAlign: "left", padding: "12px" }}>Motivo / Note</th>
                                    <th style={{ textAlign: "center", padding: "12px" }}>Durata (min)</th>
                                    <th style={{ width: 60, padding: "12px 20px" }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {fermi.map(f => {
                                    const motivoObj = MOTIVI_FERMO.find(m => m.label === f.motivo) || MOTIVI_FERMO.find(m => m.id === f.motivo);

                                    // Get machine info from props instead of problematic join
                                    const machineObj = macchine.find(m => m.id === f.macchina_id);
                                    const machineName = machineObj?.nome || "Macchina " + f.macchina_id;
                                    const repartoName = REPARTI.find(r => r.id === machineObj?.reparto_id)?.nome || "";

                                    return (
                                        <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "12px 20px", fontWeight: 600 }}>
                                                {machineName}
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{repartoName}</div>
                                            </td>
                                            <td style={{ textAlign: "center", padding: "12px", fontFamily: "monospace", fontSize: 13 }}>
                                                {f.ora_inizio ? f.ora_inizio.slice(0, 5) : "—"} - {f.ora_fine ? f.ora_fine.slice(0, 5) : "—"}
                                            </td>
                                            <td style={{ padding: "12px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    {motivoObj && <span style={{ fontSize: 18 }}>{motivoObj.icona}</span>}
                                                    <span style={{ fontWeight: 500 }}>{f.motivo}</span>
                                                </div>
                                                {f.note && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4, background: "rgba(0,0,0,0.03)", padding: "4px 8px", borderRadius: 4 }}>{f.note}</div>}
                                            </td>
                                            <td style={{ textAlign: "center", padding: "12px", fontWeight: 700, color: f.durata_minuti > 30 ? "var(--danger)" : "inherit" }}>
                                                {f.durata_minuti || "—"}
                                            </td>
                                            <td style={{ textAlign: "right", padding: "12px 20px" }}>
                                                <button
                                                    onClick={() => handleDelete(f.id)}
                                                    className="btn-icon-small"
                                                    style={{ color: "var(--text-muted)" }}
                                                    title="Elimina record"
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

            <div className="alert alert-info" style={{ marginTop: 24 }}>
                {Icons.info} I fermi vengono ora registrati direttamente dalla pagina <strong>Report</strong> tramite il menu a tendina disponibile per ogni macchina.
            </div>
        </div>
    );
}
