import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

const ICONE_PRESET = ["🔧", "⚡", "📦", "⚙️", "🧹", "☕", "📝", "🛑", "⚠️", "🔩", "💧", "🔌", "🖥️", "📋", "🔑", "🪛", "🪝", "🔨"];
const EMPTY_TEC = { id: "", label: "", prefissi: "", colore: "#6B7280", ordine: 0 };
const EMPTY_MOTIVO = { label: "", icona: "🔧" };

export default function AnagraficaFermiView({ motiviFermo, setMotiviFermo, tecnologie, setTecnologie, showToast }) {
    const [editingId, setEditingId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(EMPTY_TEC);
    const [newMotivo, setNewMotivo] = useState(EMPTY_MOTIVO);
    const [addingMotivo, setAddingMotivo] = useState(false);

    /* ── Helpers ─────────────────────────────────── */
    const resetForm = () => {
        setFormData(EMPTY_TEC);
        setEditingId(null);
        setIsCreating(false);
        setNewMotivo(EMPTY_MOTIVO);
        setAddingMotivo(false);
    };

    const motiviPerTec = (tecId) => motiviFermo.filter(m => m.tecnologia_id === tecId);

    /* ── CRUD Tecnologie ─────────────────────────── */
    const handleCreate = () => {
        setFormData(EMPTY_TEC);
        setEditingId(null);
        setIsCreating(true);
        setAddingMotivo(false);
    };

    const handleEdit = (t) => {
        setFormData({ id: t.id, label: t.label, prefissi: t.prefissi || "", colore: t.colore, ordine: t.ordine ?? 0 });
        setEditingId(t.id);
        setIsCreating(false);
        setNewMotivo(EMPTY_MOTIVO);
        setAddingMotivo(false);
    };

    const handleSaveTec = async () => {
        if (!formData.label.trim()) { showToast("Inserisci un nome", "warning"); return; }
        try {
            if (isCreating) {
                const id = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { id, label: formData.label.trim(), prefissi: formData.prefissi.trim(), colore: formData.colore, ordine: parseInt(formData.ordine) || 0 };
                const { data, error } = await supabase.from('tecnologie_fermo').insert([payload]).select();
                if (error) throw error;
                setTecnologie(prev => [...prev, data[0]].sort((a, b) => a.ordine - b.ordine));
                showToast(`Famiglia creata: ${formData.label}`, "success");
                // passa subito in edit per permettere di aggiungere motivi
                setFormData({ ...payload });
                setEditingId(id);
                setIsCreating(false);
            } else {
                const payload = { label: formData.label.trim(), prefissi: formData.prefissi.trim(), colore: formData.colore, ordine: parseInt(formData.ordine) || 0 };
                const { error } = await supabase.from('tecnologie_fermo').update(payload).eq('id', editingId);
                if (error) throw error;
                setTecnologie(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t).sort((a, b) => a.ordine - b.ordine));
                showToast("Famiglia aggiornata", "success");
            }
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleDeleteTec = async (id) => {
        const count = motiviPerTec(id).length;
        const msg = count > 0
            ? `Eliminare questa famiglia e i suoi ${count} motivi?`
            : "Eliminare questa famiglia tecnologica?";
        if (!window.confirm(msg)) return;
        try {
            const { error } = await supabase.from('tecnologie_fermo').delete().eq('id', id);
            if (error) throw error;
            setTecnologie(prev => prev.filter(t => t.id !== id));
            setMotiviFermo(prev => prev.filter(m => m.tecnologia_id !== id));
            showToast("Famiglia eliminata", "success");
            if (editingId === id) resetForm();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    /* ── CRUD Motivi ─────────────────────────────── */
    const handleAddMotivo = async () => {
        if (!newMotivo.label.trim()) { showToast("Inserisci l'etichetta del motivo", "warning"); return; }
        try {
            const id = `${editingId}_${newMotivo.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')}`;
            const payload = { id, label: newMotivo.label.trim(), icona: newMotivo.icona, colore: formData.colore, tecnologia_id: editingId };
            const { data, error } = await supabase.from('motivi_fermo').insert([payload]).select();
            if (error) throw error;
            setMotiviFermo(prev => [...prev, data[0]]);
            setNewMotivo(EMPTY_MOTIVO);
            setAddingMotivo(false);
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

    /* ── Render ──────────────────────────────────── */
    const prefissiArray = formData.prefissi.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
    const showForm = isCreating || !!editingId;
    const motiviCorrente = editingId ? motiviPerTec(editingId) : [];

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                    <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                        Ogni famiglia raggruppa le macchine per prefisso e ha i propri motivi di fermo.
                    </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleCreate}>{Icons.plus} Nuova Famiglia</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 380px" : "1fr", gap: 24, alignItems: "start" }}>

                {/* ── Tabella tecnologie ── */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)", textAlign: "left" }}>
                                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Famiglia</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Prefissi</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>Motivi</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>Ordine</th>
                                <th style={{ padding: "12px 16px", width: 90 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tecnologie.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna famiglia. Clicca "Nuova Famiglia".</td></tr>
                            ) : tecnologie.map(t => {
                                const pref = (t.prefissi || "").split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
                                const nMotivi = motiviPerTec(t.id).length;
                                return (
                                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border-light)", background: editingId === t.id ? "var(--bg-secondary)" : "transparent" }}>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.colore, flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600 }}>{t.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 8px" }}>
                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                {pref.length > 0 ? pref.map(p => (
                                                    <span key={p} style={{ background: t.colore + "22", color: t.colore, border: `1px solid ${t.colore}44`, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{p}*</span>
                                                )) : <span style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>Tutto il resto</span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                                            <span style={{ background: nMotivi > 0 ? t.colore + "22" : "var(--bg-secondary)", color: nMotivi > 0 ? t.colore : "var(--text-muted)", border: `1px solid ${nMotivi > 0 ? t.colore + "55" : "var(--border)"}`, borderRadius: 10, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                                                {nMotivi}
                                            </span>
                                        </td>
                                        <td style={{ padding: "12px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>{t.ordine}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                                <button className="btn-action edit" onClick={() => handleEdit(t)}>{Icons.edit}</button>
                                                <button className="btn-action delete" onClick={() => handleDeleteTec(t.id)}>{Icons.trash}</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Form panel ── */}
                {showForm && (
                    <div className="card" style={{ position: "sticky", top: 20, height: "fit-content" }}>
                        <div className="card-header" style={{ marginBottom: 16 }}>
                            <div className="card-title">{isCreating ? "Nuova Famiglia" : formData.label || "Modifica Famiglia"}</div>
                            <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                        </div>

                        {!isCreating && <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>ID: <span style={{ fontFamily: "monospace" }}>{formData.id}</span></div>}

                        <div className="form-group">
                            <label className="form-label">Nome famiglia *</label>
                            <input className="input" value={formData.label} onChange={e => setFormData(p => ({ ...p, label: e.target.value }))} placeholder="es. Tornitura Soft" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Prefissi macchina</label>
                            <input
                                className="input"
                                value={formData.prefissi}
                                onChange={e => setFormData(p => ({ ...p, prefissi: e.target.value }))}
                                placeholder="es. DRA  oppure  SLW,SLA"
                            />
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Separati da virgola.</div>
                            {prefissiArray.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                                    {prefissiArray.map(p => (
                                        <span key={p} style={{ background: formData.colore + "22", color: formData.colore, border: `1px solid ${formData.colore}44`, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>{p}*</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 12 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Colore</label>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input type="color" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ width: 40, height: 36, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                                    <input className="input" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ fontFamily: "monospace", fontSize: 12 }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Ordine</label>
                                <input className="input" type="number" min="0" value={formData.ordine} onChange={e => setFormData(p => ({ ...p, ordine: e.target.value }))} />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 16, marginBottom: editingId ? 24 : 0 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveTec}>
                                {isCreating ? "Crea e aggiungi motivi →" : "Salva"}
                            </button>
                            <button className="btn btn-secondary" onClick={resetForm}>Annulla</button>
                        </div>

                        {/* ── Motivi per questa tecnologia ── */}
                        {editingId && (
                            <div style={{ borderTop: "2px solid var(--border)", paddingTop: 20 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>Motivi di fermo</span>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setAddingMotivo(v => !v)}
                                    >
                                        {addingMotivo ? "Annulla" : `${Icons.plus} Aggiungi`}
                                    </button>
                                </div>

                                {/* Lista motivi */}
                                {motiviCorrente.length === 0 && !addingMotivo && (
                                    <div style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic", padding: "8px 0" }}>
                                        Nessun motivo. Clicca "Aggiungi".
                                    </div>
                                )}
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: addingMotivo ? 12 : 0 }}>
                                    {motiviCorrente.map(m => (
                                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                                            <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icona}</span>
                                            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.label}</span>
                                            <button
                                                onClick={() => handleDeleteMotivo(m.id)}
                                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1, padding: "2px 4px", borderRadius: 4, flexShrink: 0 }}
                                                title="Elimina"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>

                                {/* Form aggiungi motivo */}
                                {addingMotivo && (
                                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 10 }}>
                                            <label className="form-label">Etichetta *</label>
                                            <input
                                                className="input"
                                                value={newMotivo.label}
                                                onChange={e => setNewMotivo(p => ({ ...p, label: e.target.value }))}
                                                placeholder="es. Appoggio piano"
                                                onKeyDown={e => e.key === 'Enter' && handleAddMotivo()}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 10 }}>
                                            <label className="form-label">Icona</label>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                                                {ICONE_PRESET.map(ic => (
                                                    <button key={ic} onClick={() => setNewMotivo(p => ({ ...p, icona: ic }))} style={{ fontSize: 18, padding: "3px 5px", borderRadius: 5, cursor: "pointer", border: newMotivo.icona === ic ? "2px solid var(--primary)" : "2px solid var(--border)", background: newMotivo.icona === ic ? "var(--primary-light, #dbeafe)" : "transparent" }}>{ic}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleAddMotivo}>
                                            Aggiungi motivo
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
