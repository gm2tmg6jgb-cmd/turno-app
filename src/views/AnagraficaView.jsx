import { useState } from "react";
import { REPARTI, TURNI, MACCHINE, LIMITAZIONI } from "../data/constants";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { Modal } from "../components/ui/Modal";

export default function AnagraficaView({ dipendenti, setDipendenti, macchine, showToast, turnoCorrente }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterReparto, setFilterReparto] = useState("all");
    const [filterTipo, setFilterTipo] = useState("all");
    const [showAllShifts, setShowAllShifts] = useState(false); // Toggle state
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentDipId, setCurrentDipId] = useState(null);
    const [newDip, setNewDip] = useState({
        nome: "", cognome: "", turno: "D", reparto: "T11", tipo: "indeterminato",
        competenze: {}, ruolo: "operatore", agenzia: "", scadenza: "", l104: "",
    });

    const filtered = dipendenti.filter((d) => {
        const matchSearch = `${d.nome} ${d.cognome}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchReparto = filterReparto === "all" || d.reparto_id === filterReparto;
        const matchTipo = filterTipo === "all" || d.tipo === filterTipo;

        // STRICT FILTER: Only show employees of the CURRENT ACTIVE SHIFT unless "Show All" is checked
        // Fallback to 'D' if d.turno_default is missing.
        const matchTurno = showAllShifts || d.turno_default === turnoCorrente;

        return matchSearch && matchReparto && matchTipo && matchTurno;
    }).sort((a, b) => a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome));

    const handleSave = async () => {
        if (!newDip.nome || !newDip.cognome) return;

        try {
            if (isEditing) {
                // Update on DB
                const payload = {
                    nome: newDip.nome,
                    cognome: newDip.cognome,
                    turno_default: newDip.turno,
                    reparto_id: newDip.reparto_id,
                    tipo: newDip.tipo,
                    ruolo: newDip.ruolo,
                    agenzia: newDip.agenzia,
                    scadenza: newDip.scadenza,
                    l104: newDip.l104
                };

                const { error } = await supabase
                    .from('dipendenti')
                    .update(payload)
                    .eq('id', currentDipId);

                if (error) throw error;

                // Optimistic Update
                setDipendenti(dipendenti.map(d => d.id === currentDipId ? { ...newDip, id: currentDipId, turno_default: newDip.turno } : d));
                showToast("Dipendente modificato", "success");
            } else {
                // Create new
                const dip = {
                    id: crypto.randomUUID(),
                    nome: newDip.nome,
                    cognome: newDip.cognome,
                    turno_default: newDip.turno || "D", // Map 'turno' to 'turno_default'
                    reparto_id: newDip.reparto_id || newDip.reparto || "T11", // Ensure ID is used
                    tipo: newDip.tipo,
                    ruolo: newDip.ruolo,
                    // Optional fields
                    agenzia: newDip.tipo === 'interinale' ? newDip.agenzia : null,
                    scadenza: newDip.tipo === 'interinale' ? newDip.scadenza : null,
                    l104: newDip.l104
                };

                const { data, error } = await supabase
                    .from('dipendenti')
                    .insert([dip])
                    .select();

                if (error) throw error;

                setDipendenti([...dipendenti, data[0]]);
                showToast("Dipendente aggiunto", "success");
            }
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving dipendente:", error);
            showToast("Errore salvataggio: " + error.message, "error");
        }
    };

    const resetForm = () => {
        setNewDip({
            nome: "",
            cognome: "",
            turno: turnoCorrente || "D", // Default to current shift
            reparto: "T11",
            tipo: "indeterminato",
            competenze: {},
            ruolo: "operatore",
            agenzia: "",
            scadenza: "",
            l104: ""
        });
        setIsEditing(false);
        setCurrentDipId(null);
    };

    const openEdit = (dip) => {
        setNewDip({
            ...dip,
            turno: dip.turno_default || dip.turno || "D", // Fix: Load from turno_default
            reparto: dip.reparto || dip.reparto_id || "T11" // Ensure fallback for team too just in case
        });
        setCurrentDipId(dip.id);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Sei sicuro di voler eliminare questo dipendente?")) {
            try {
                const { error } = await supabase.from('dipendenti').delete().eq('id', id);
                if (error) throw error;

                setDipendenti(dipendenti.filter(d => d.id !== id));
                showToast("Dipendente eliminato", "warning");
            } catch (error) {
                console.error("Error deleting dipendente:", error);
                showToast("Errore eliminazione: " + error.message, "error");
            }
        }
    };

    return (
        <div className="fade-in">
            <div className="filters-bar">
                <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
                    {Icons.search}
                    <input className="input" placeholder="Cerca per nome o cognome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <select className="select-input" style={{ width: 180 }} value={filterReparto} onChange={(e) => setFilterReparto(e.target.value)}>
                    <option value="all">Tutti i reparti</option>
                    {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
                <select className="select-input" style={{ width: 160 }} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                    <option value="all">Tutti i tipi</option>
                    <option value="indeterminato">Indeterminato</option>
                    <option value="interinale">Interinale</option>
                </select>

                {/* Visual Toggle for Show All Shifts */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", userSelect: "none", background: "var(--bg-secondary)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <input
                        type="checkbox"
                        checked={showAllShifts}
                        onChange={(e) => setShowAllShifts(e.target.checked)}
                        style={{ accentColor: "var(--primary)" }}
                    />
                    Mostra tutti i turni
                </label>

                <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>{Icons.plus} Nuovo</button>
            </div>

            <div className="teams-container" style={{ display: "flex", gap: 20, height: "calc(100vh - 180px)", overflow: "hidden" }}>
                {REPARTI.map(reparto => {
                    const teamMembers = filtered.filter(d => d.reparto_id === reparto.id);
                    return (
                        <div key={reparto.id} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 300, background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                            {/* Column Header */}
                            <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{reparto.nome}</div>
                                <span className="tag tag-gray">{teamMembers.length}</span>
                            </div>

                            {/* Scrollable List */}
                            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                                {teamMembers.length > 0 ? (
                                    <div style={{ display: "grid", gap: 12 }}>
                                        {teamMembers.map((d) => (
                                            <div
                                                key={d.id}
                                                className="card dipendente-card"
                                                onClick={() => openEdit(d)}
                                                style={{
                                                    cursor: "pointer",
                                                    background: d.tipo === 'interinale' ? "rgba(236, 72, 153, 0.15)" : "var(--bg-card)",
                                                    border: d.tipo === 'interinale' ? "1px solid rgba(236, 72, 153, 0.3)" : "1px solid var(--border)",
                                                    padding: 12,
                                                    borderRadius: 8,
                                                    transition: "all 0.2s"
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{d.cognome} {d.nome}</div>
                                                        {d.tipo === 'interinale' && (
                                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                                                <span style={{ color: "#EC4899", fontWeight: 600 }}>INTERINALE</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                                                        Turno {d.turno_default || d.turno || "D"}
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 4 }}>
                                                    {d.ruolo === "capoturno" && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>👑 Team Leader</span>}
                                                    {d.l104 && (
                                                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--danger)" }} title="Vedi dettaglio in Privacy Alta">
                                                            ⚠️ Note Privacy
                                                        </span>
                                                    )}
                                                </div>

                                                {d.tipo === 'interinale' && d.scadenza && (
                                                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, borderTop: "1px solid var(--border-light)", paddingTop: 6 }}>
                                                        ⏳ {new Date(d.scadenza).toLocaleDateString()} {d.agenzia && <span>• {d.agenzia}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                                        Nessun dipendente
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {
                showModal && (
                    <Modal
                        title="Nuovo Dipendente"
                        onClose={() => setShowModal(false)}
                        footer={
                            <>
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                                <button className="btn btn-primary" onClick={handleSave}>Salva</button>
                            </>
                        }
                    >
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Nome</label>
                                <input className="input" value={newDip.nome} onChange={(e) => setNewDip({ ...newDip, nome: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cognome</label>
                                <input className="input" value={newDip.cognome} onChange={(e) => setNewDip({ ...newDip, cognome: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Turno</label>
                                <select className="select-input" value={newDip.turno} onChange={(e) => setNewDip({ ...newDip, turno: e.target.value })}>
                                    {TURNI.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Team</label>
                                <select className="select-input" value={newDip.reparto_id} onChange={(e) => setNewDip({ ...newDip, reparto_id: e.target.value })}>
                                    {REPARTI.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo Contratto</label>
                                <select className="select-input" value={newDip.tipo} onChange={(e) => setNewDip({ ...newDip, tipo: e.target.value })}>
                                    <option value="indeterminato">Indeterminato</option>
                                    <option value="interinale">Interinale</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ruolo</label>
                                <select className="select-input" value={newDip.ruolo} onChange={(e) => setNewDip({ ...newDip, ruolo: e.target.value })}>
                                    <option value="operatore">Operatore</option>
                                    <option value="capoturno">Team Leader</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: "span 2" }}>
                                <div className="alert alert-info" style={{ marginTop: 0, padding: "8px 12px" }}>
                                    <span style={{ fontSize: 14, marginRight: 6 }}>🔒</span>
                                    Le limitazioni fisiche e prescrizioni mediche sono gestite nell'area <strong>Privacy Alta</strong>.
                                </div>
                            </div>
                        </div>
                        {newDip.tipo === "interinale" && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                                <div className="form-group">
                                    <label className="form-label">Agenzia</label>
                                    <input className="input" value={newDip.agenzia} onChange={(e) => setNewDip({ ...newDip, agenzia: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Scadenza Contratto</label>
                                    <input className="input" type="date" value={newDip.scadenza} onChange={(e) => setNewDip({ ...newDip, scadenza: e.target.value })} />
                                </div>
                            </div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                                Le competenze si gestiscono dalla pagina "Matrice Competenze".
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
}
