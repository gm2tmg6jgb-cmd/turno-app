import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

const ICONE_PRESET = ["🔧", "⚡", "📦", "⚙️", "🧹", "☕", "📝", "🛑", "⚠️", "🔩", "💧", "🔌", "🖥️", "📋", "🔑", "🪛", "🪝", "🔨"];
const EMPTY_TEC = { id: "", label: "", prefissi: "", colore: "#6B7280", ordine: 0 };
const EMPTY_MOTIVO = { label: "", icona: "🔧" };

export default function AnagraficaFermiView({ motiviFermo, setMotiviFermo, tecnologie, setTecnologie, macchine, setMacchine, showToast }) {
    const [editingTecId, setEditingTecId] = useState(null);
    const [formTec, setFormTec] = useState(EMPTY_TEC);
    const [addingMotivoFor, setAddingMotivoFor] = useState(null);
    const [newMotivo, setNewMotivo] = useState(EMPTY_MOTIVO);
    const [assigningFor, setAssigningFor] = useState(null); // tecId per cui si sta assegnando una macchina
    const [selectedMacchina, setSelectedMacchina] = useState("");

    /* ── Helpers ─────────────────────────────────── */
    const motiviPerTec = (tecId) => motiviFermo.filter(m => m.tecnologia_id === tecId);
    const macchinePerTec = (tecId) => (macchine || []).filter(m => m.tecnologia_id === tecId);
    const macchineLibere = () => (macchine || []).filter(m => !m.tecnologia_id);

    const closeEdit = () => { setEditingTecId(null); setFormTec(EMPTY_TEC); };
    const closeAddMotivo = () => { setAddingMotivoFor(null); setNewMotivo(EMPTY_MOTIVO); };
    const closeAssign = () => { setAssigningFor(null); setSelectedMacchina(""); };

    /* ── CRUD Tecnologie ─────────────────────────── */
    const handleSaveTec = async () => {
        if (!formTec.label.trim()) { showToast("Inserisci un nome", "warning"); return; }
        try {
            if (editingTecId === "NEW") {
                const id = formTec.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { id, label: formTec.label.trim(), prefissi: formTec.prefissi.trim(), colore: formTec.colore, ordine: parseInt(formTec.ordine) || 0 };
                const { data, error } = await supabase.from('tecnologie_fermo').insert([payload]).select();
                if (error) throw error;
                setTecnologie(prev => [...prev, data[0]].sort((a, b) => a.ordine - b.ordine));
                showToast(`Tecnologia creata: ${formTec.label}`, "success");
                closeEdit();
            } else {
                const payload = { label: formTec.label.trim(), prefissi: formTec.prefissi.trim(), colore: formTec.colore, ordine: parseInt(formTec.ordine) || 0 };
                const { error } = await supabase.from('tecnologie_fermo').update(payload).eq('id', editingTecId);
                if (error) throw error;
                setTecnologie(prev => prev.map(t => t.id === editingTecId ? { ...t, ...payload } : t).sort((a, b) => a.ordine - b.ordine));
                showToast("Tecnologia aggiornata", "success");
                closeEdit();
            }
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleDeleteTec = async (id) => {
        const count = motiviPerTec(id).length;
        const msg = count > 0 ? `Eliminare questa tecnologia e i suoi ${count} motivi?` : "Eliminare questa tecnologia?";
        if (!window.confirm(msg)) return;
        try {
            const { error } = await supabase.from('tecnologie_fermo').delete().eq('id', id);
            if (error) throw error;
            setTecnologie(prev => prev.filter(t => t.id !== id));
            setMotiviFermo(prev => prev.filter(m => m.tecnologia_id !== id));
            // rimuove associazione macchine
            if (setMacchine) setMacchine(prev => prev.map(m => m.tecnologia_id === id ? { ...m, tecnologia_id: null } : m));
            showToast("Tecnologia eliminata", "success");
            if (editingTecId === id) closeEdit();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    /* ── CRUD Motivi ─────────────────────────────── */
    const handleAddMotivo = async (tecId, tecColore) => {
        if (!newMotivo.label.trim()) { showToast("Inserisci l'etichetta del motivo", "warning"); return; }
        try {
            const id = `${tecId}_${newMotivo.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')}`;
            const payload = { id, label: newMotivo.label.trim(), icona: newMotivo.icona, colore: tecColore, tecnologia_id: tecId };
            const { data, error } = await supabase.from('motivi_fermo').insert([payload]).select();
            if (error) throw error;
            setMotiviFermo(prev => [...prev, data[0]]);
            closeAddMotivo();
            showToast(`Motivo aggiunto: ${newMotivo.label}`, "success");
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleDeleteMotivo = async (id) => {
        if (!window.confirm("Eliminare questo motivo?")) return;
        try {
            const { error } = await supabase.from('motivi_fermo').delete().eq('id', id);
            if (error) throw error;
            setMotiviFermo(prev => prev.filter(m => m.id !== id));
            showToast("Motivo eliminato", "success");
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    /* ── Assegnazione macchine ────────────────────── */
    const handleAssignMacchina = async (tecId) => {
        if (!selectedMacchina) return;
        try {
            const { error } = await supabase.from('macchine').update({ tecnologia_id: tecId }).eq('id', selectedMacchina);
            if (error) throw error;
            if (setMacchine) setMacchine(prev => prev.map(m => m.id === selectedMacchina ? { ...m, tecnologia_id: tecId } : m));
            closeAssign();
            showToast("Macchina associata", "success");
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleUnassignMacchina = async (macchinaId) => {
        try {
            const { error } = await supabase.from('macchine').update({ tecnologia_id: null }).eq('id', macchinaId);
            if (error) throw error;
            if (setMacchine) setMacchine(prev => prev.map(m => m.id === macchinaId ? { ...m, tecnologia_id: null } : m));
            showToast("Macchina rimossa", "success");
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    /* ── Form tecnologia ─────────────────────────── */
    const TecForm = ({ onClose }) => (
        <div style={{ padding: "16px", borderTop: editingTecId !== "NEW" ? "2px solid var(--border)" : "none" }}>
            <div className="form-group">
                <label className="form-label">Nome tecnologia *</label>
                <input className="input" value={formTec.label} onChange={e => setFormTec(p => ({ ...p, label: e.target.value }))} placeholder="es. Tornitura Soft" autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Colore</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="color" value={formTec.colore} onChange={e => setFormTec(p => ({ ...p, colore: e.target.value }))} style={{ width: 40, height: 36, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                        <input className="input" value={formTec.colore} onChange={e => setFormTec(p => ({ ...p, colore: e.target.value }))} style={{ fontFamily: "monospace", fontSize: 12 }} />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Ordine</label>
                    <input className="input" type="number" min="0" value={formTec.ordine} onChange={e => setFormTec(p => ({ ...p, ordine: e.target.value }))} />
                </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveTec}>
                    {editingTecId === "NEW" ? "Crea tecnologia" : "Salva"}
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
            </div>
        </div>
    );

    /* ── Render ──────────────────────────────────── */
    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                    Associa le macchine direttamente a ogni tecnologia e configura i motivi di fermo.
                </p>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => { setEditingTecId("NEW"); setFormTec(EMPTY_TEC); closeAddMotivo(); closeAssign(); }}
                    disabled={editingTecId === "NEW"}
                >
                    {Icons.plus} Nuova Tecnologia
                </button>
            </div>

            {/* Card nuova tecnologia */}
            {editingTecId === "NEW" && (
                <div className="card" style={{ marginBottom: 20, border: `2px solid var(--primary)` }}>
                    <div className="card-header" style={{ marginBottom: 0 }}>
                        <div className="card-title" style={{ color: "var(--primary)" }}>Nuova Tecnologia</div>
                        <button className="btn-ghost btn-sm" onClick={closeEdit}>{Icons.x}</button>
                    </div>
                    <TecForm onClose={closeEdit} />
                </div>
            )}

            {/* Grid card tecnologie */}
            {tecnologie.length === 0 && editingTecId !== "NEW" ? (
                <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Nessuna tecnologia. Clicca "Nuova Tecnologia" per iniziare.
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                    {tecnologie.map(t => {
                        const motivi = motiviPerTec(t.id);
                        const macchineTec = macchinePerTec(t.id);
                        const libere = macchineLibere();
                        const isEditing = editingTecId === t.id;
                        const isAddingMotivo = addingMotivoFor === t.id;
                        const isAssigning = assigningFor === t.id;

                        return (
                            <div key={t.id} className="card" style={{ padding: 0, overflow: "hidden", border: isEditing ? `2px solid ${t.colore}` : "1px solid var(--border)" }}>
                                {/* Header */}
                                <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", background: t.colore + "11" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.colore, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{macchineTec.length} macchine</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                            <button
                                                className="btn-action edit"
                                                onClick={() => {
                                                    if (isEditing) closeEdit();
                                                    else { setEditingTecId(t.id); setFormTec({ id: t.id, label: t.label, prefissi: t.prefissi || "", colore: t.colore, ordine: t.ordine ?? 0 }); closeAddMotivo(); closeAssign(); }
                                                }}
                                                title={isEditing ? "Chiudi" : "Modifica"}
                                            >
                                                {isEditing ? Icons.x : Icons.edit}
                                            </button>
                                            <button className="btn-action delete" onClick={() => handleDeleteTec(t.id)} title="Elimina">{Icons.trash}</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Form edit */}
                                {isEditing && <TecForm onClose={closeEdit} />}

                                {/* ── Sezione Macchine ── */}
                                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-light)" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: macchineTec.length > 0 ? 8 : 0 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Macchine</span>
                                        {!isAssigning && (
                                            <button
                                                style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: `1px solid ${t.colore}`, color: t.colore, background: t.colore + "11", cursor: "pointer", fontWeight: 600 }}
                                                onClick={() => { setAssigningFor(t.id); setSelectedMacchina(""); if (isEditing) closeEdit(); if (addingMotivoFor === t.id) closeAddMotivo(); }}
                                            >
                                                + Aggiungi
                                            </button>
                                        )}
                                    </div>
                                    {macchineTec.length === 0 && !isAssigning && (
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna macchina associata</div>
                                    )}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                        {macchineTec.map(m => (
                                            <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: t.colore + "18", color: t.colore, border: `1px solid ${t.colore}44`, borderRadius: 4, padding: "2px 6px", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>
                                                {m.nome || m.id}
                                                <button onClick={() => handleUnassignMacchina(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.colore, fontSize: 13, lineHeight: 1, padding: 0, opacity: 0.7 }} title="Rimuovi">×</button>
                                            </span>
                                        ))}
                                    </div>
                                    {isAssigning && (
                                        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                                            <select
                                                className="select-input"
                                                style={{ flex: 1, fontSize: 12 }}
                                                value={selectedMacchina}
                                                onChange={e => setSelectedMacchina(e.target.value)}
                                                autoFocus
                                            >
                                                <option value="">— Seleziona macchina —</option>
                                                {libere.map(m => <option key={m.id} value={m.id}>{m.nome || m.id}</option>)}
                                            </select>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleAssignMacchina(t.id)} disabled={!selectedMacchina}>OK</button>
                                            <button className="btn btn-secondary btn-sm" onClick={closeAssign}>✕</button>
                                        </div>
                                    )}
                                </div>

                                {/* ── Sezione Motivi ── */}
                                <div style={{ padding: "10px 16px 0" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Motivi di fermo</div>
                                    {motivi.length === 0 && !isAddingMotivo && (
                                        <div style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic", paddingBottom: 6 }}>
                                            Nessun motivo configurato
                                        </div>
                                    )}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        {motivi.map(m => (
                                            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                                                <span style={{ fontSize: 15, flexShrink: 0 }}>{m.icona}</span>
                                                <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.label}</span>
                                                <button onClick={() => handleDeleteMotivo(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, flexShrink: 0 }} title="Elimina">×</button>
                                            </div>
                                        ))}
                                    </div>

                                    {isAddingMotivo && (
                                        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginTop: 8 }}>
                                            <div className="form-group" style={{ marginBottom: 8 }}>
                                                <input className="input" value={newMotivo.label} onChange={e => setNewMotivo(p => ({ ...p, label: e.target.value }))} placeholder="Nome motivo (es. Appoggio piano)" onKeyDown={e => e.key === 'Enter' && handleAddMotivo(t.id, t.colore)} autoFocus />
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                                                {ICONE_PRESET.map(ic => (
                                                    <button key={ic} onClick={() => setNewMotivo(p => ({ ...p, icona: ic }))} style={{ fontSize: 17, padding: "3px 5px", borderRadius: 5, cursor: "pointer", border: newMotivo.icona === ic ? `2px solid ${t.colore}` : "2px solid var(--border)", background: newMotivo.icona === ic ? t.colore + "22" : "transparent" }}>{ic}</button>
                                                ))}
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleAddMotivo(t.id, t.colore)}>Aggiungi</button>
                                                <button className="btn btn-secondary btn-sm" onClick={closeAddMotivo}>Annulla</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div style={{ padding: "10px 16px 14px" }}>
                                    {!isAddingMotivo && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ width: "100%", fontSize: 12 }}
                                            onClick={() => { setAddingMotivoFor(t.id); setNewMotivo(EMPTY_MOTIVO); if (isEditing) closeEdit(); closeAssign(); }}
                                        >
                                            {Icons.plus} Aggiungi motivo
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
