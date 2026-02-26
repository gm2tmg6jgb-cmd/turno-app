import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

const ICONE_PRESET = ["🔧", "⚡", "📦", "⚙️", "🧹", "☕", "📝", "🛑", "⚠️", "🔩", "💧", "🔌", "🖥️", "📋"];
const EMPTY_MOTIVO = { id: "", label: "", colore: "#6B7280", icona: "📝" };
const EMPTY_TEC = { id: "", label: "", prefissi: "", colore: "#6B7280", ordine: 0, motivi_ids: "" };

/* ── Separatore sezione ────────────────────────────────── */
function SectionHeader({ title, description, action }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid var(--border)" }}>
            <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{title}</h2>
                {description && <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4, marginBottom: 0 }}>{description}</p>}
            </div>
            {action}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   FAMIGLIE TECNOLOGIA
══════════════════════════════════════════════════════════ */
function TecnologieSection({ tecnologie, setTecnologie, motiviFermo, showToast }) {
    const [editingId, setEditingId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(EMPTY_TEC);

    const resetForm = () => { setFormData(EMPTY_TEC); setEditingId(null); setIsCreating(false); };

    const handleEdit = (t) => {
        setFormData({ id: t.id, label: t.label, prefissi: t.prefissi || "", colore: t.colore, ordine: t.ordine ?? 0, motivi_ids: t.motivi_ids || "" });
        setEditingId(t.id);
        setIsCreating(false);
    };

    const handleCreate = () => { setFormData(EMPTY_TEC); setEditingId(null); setIsCreating(true); };

    const toggleMotivo = (id) => {
        const current = formData.motivi_ids ? formData.motivi_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        setFormData(p => ({ ...p, motivi_ids: next.join(',') }));
    };

    const selectedMotivi = formData.motivi_ids ? formData.motivi_ids.split(',').map(s => s.trim()).filter(Boolean) : [];

    const handleSave = async () => {
        if (!formData.label.trim()) { showToast("Inserisci un'etichetta", "warning"); return; }
        try {
            if (isCreating) {
                const id = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { id, label: formData.label.trim(), prefissi: formData.prefissi.trim(), colore: formData.colore, ordine: parseInt(formData.ordine) || 0, motivi_ids: formData.motivi_ids };
                const { data, error } = await supabase.from('tecnologie_fermo').insert([payload]).select();
                if (error) throw error;
                setTecnologie(prev => [...prev, data[0]].sort((a, b) => a.ordine - b.ordine));
                showToast(`Famiglia creata: ${formData.label}`, "success");
            } else {
                const payload = { label: formData.label.trim(), prefissi: formData.prefissi.trim(), colore: formData.colore, ordine: parseInt(formData.ordine) || 0, motivi_ids: formData.motivi_ids };
                const { error } = await supabase.from('tecnologie_fermo').update(payload).eq('id', editingId);
                if (error) throw error;
                setTecnologie(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t).sort((a, b) => a.ordine - b.ordine));
                showToast("Famiglia aggiornata", "success");
            }
            resetForm();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Eliminare questa famiglia tecnologica?")) return;
        try {
            const { error } = await supabase.from('tecnologie_fermo').delete().eq('id', id);
            if (error) throw error;
            setTecnologie(prev => prev.filter(t => t.id !== id));
            showToast("Famiglia eliminata", "success");
            if (editingId === id) resetForm();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const prefissiArray = formData.prefissi.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

    return (
        <div>
            <SectionHeader
                title="Famiglie Tecnologia"
                description="Raggruppa le macchine per prefisso ID. I grafici in Report Fermi usano questi raggruppamenti."
                action={<button className="btn btn-primary btn-sm" onClick={handleCreate}>{Icons.plus} Nuova Famiglia</button>}
            />

            <div style={{ display: "grid", gridTemplateColumns: isCreating || editingId ? "1fr 360px" : "1fr", gap: 24 }}>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)", textAlign: "left" }}>
                                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Famiglia</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Prefissi Macchina</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Colore</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700, textAlign: "center" }}>Ordine</th>
                                <th style={{ padding: "12px 16px", width: 90 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tecnologie.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>Nessuna famiglia. Clicca "Nuova Famiglia".</td></tr>
                            ) : tecnologie.map(t => {
                                const pref = (t.prefissi || "").split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
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
                                        <td style={{ padding: "12px 8px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ width: 16, height: 16, borderRadius: 4, background: t.colore, border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />
                                                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{t.colore}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>{t.ordine}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                                <button className="btn-action edit" onClick={() => handleEdit(t)}>{Icons.edit}</button>
                                                <button className="btn-action delete" onClick={() => handleDelete(t.id)}>{Icons.trash}</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {(isCreating || editingId) && (
                    <div className="card" style={{ height: "fit-content", position: "sticky", top: 20 }}>
                        <div className="card-header" style={{ marginBottom: 16 }}>
                            <div className="card-title">{isCreating ? "Nuova Famiglia" : "Modifica Famiglia"}</div>
                            <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                        </div>

                        {!isCreating && <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>ID: <span style={{ fontFamily: "monospace" }}>{formData.id}</span></div>}

                        <div className="form-group">
                            <label className="form-label">Nome famiglia *</label>
                            <input className="input" value={formData.label} onChange={e => setFormData(p => ({ ...p, label: e.target.value }))} placeholder="es. Tornitura Hard" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Prefissi macchina</label>
                            <input
                                className="input"
                                value={formData.prefissi}
                                onChange={e => setFormData(p => ({ ...p, prefissi: e.target.value }))}
                                placeholder="es. DRA  oppure  SLW,SLA"
                            />
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                Separati da virgola. Lascia vuoto per raggruppare tutto il resto.
                            </div>
                            {prefissiArray.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                                    {prefissiArray.map(p => (
                                        <span key={p} style={{ background: formData.colore + "22", color: formData.colore, border: `1px solid ${formData.colore}44`, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>{p}*</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Colore</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ width: 40, height: 38, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                                <input className="input" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ fontFamily: "monospace" }} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Ordine visualizzazione</label>
                            <input className="input" type="number" min="0" value={formData.ordine} onChange={e => setFormData(p => ({ ...p, ordine: e.target.value }))} placeholder="0" style={{ width: 80 }} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Motivi disponibili</label>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                                Nessuna selezione = tutti i motivi. Seleziona per limitare.
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {motiviFermo.map(m => {
                                    const checked = selectedMotivi.includes(m.id);
                                    return (
                                        <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 10px", borderRadius: 6, background: checked ? (formData.colore + "15") : "var(--bg-secondary)", border: `1px solid ${checked ? formData.colore + "55" : "var(--border)"}`, transition: "all .12s" }}>
                                            <input type="checkbox" checked={checked} onChange={() => toggleMotivo(m.id)} style={{ accentColor: formData.colore, width: 15, height: 15, cursor: "pointer" }} />
                                            <span style={{ fontSize: 16 }}>{m.icona}</span>
                                            <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400 }}>{m.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {selectedMotivi.length > 0 && (
                                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                                    {selectedMotivi.length} motivo/i selezionato/i
                                    <button onClick={() => setFormData(p => ({ ...p, motivi_ids: "" }))} style={{ marginLeft: 8, fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                                        Reset (tutti)
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: formData.colore }} />
                            <span style={{ fontWeight: 600 }}>{formData.label || "Anteprima…"}</span>
                            {prefissiArray.length > 0 && (
                                <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>
                                    {prefissiArray.map(p => p + '*').join(' · ')}
                                </span>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Salva</button>
                            <button className="btn btn-secondary" onClick={resetForm}>Annulla</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   MOTIVI FERMO
══════════════════════════════════════════════════════════ */
function MotiviSection({ motiviFermo, setMotiviFermo, showToast }) {
    const [editingId, setEditingId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState(EMPTY_MOTIVO);

    const resetForm = () => { setFormData(EMPTY_MOTIVO); setEditingId(null); setIsCreating(false); };
    const handleEdit = (m) => { setFormData({ id: m.id, label: m.label, colore: m.colore, icona: m.icona }); setEditingId(m.id); setIsCreating(false); };
    const handleCreate = () => { setFormData(EMPTY_MOTIVO); setEditingId(null); setIsCreating(true); };

    const handleSave = async () => {
        if (!formData.label.trim()) { showToast("Inserisci un'etichetta", "warning"); return; }
        try {
            if (isCreating) {
                const id = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { id, label: formData.label.trim(), colore: formData.colore, icona: formData.icona };
                const { data, error } = await supabase.from('motivi_fermo').insert([payload]).select();
                if (error) throw error;
                setMotiviFermo(prev => [...prev, data[0]]);
                showToast(`Motivo creato: ${formData.label}`, "success");
            } else {
                const payload = { label: formData.label.trim(), colore: formData.colore, icona: formData.icona };
                const { error } = await supabase.from('motivi_fermo').update(payload).eq('id', editingId);
                if (error) throw error;
                setMotiviFermo(prev => prev.map(m => m.id === editingId ? { ...m, ...payload } : m));
                showToast("Motivo aggiornato", "success");
            }
            resetForm();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Eliminare questo motivo?")) return;
        try {
            const { error } = await supabase.from('motivi_fermo').delete().eq('id', id);
            if (error) throw error;
            setMotiviFermo(prev => prev.filter(m => m.id !== id));
            showToast("Motivo eliminato", "success");
            if (editingId === id) resetForm();
        } catch (err) { showToast("Errore: " + err.message, "error"); }
    };

    return (
        <div>
            <SectionHeader
                title="Motivi Fermo"
                description="Lista globale dei motivi disponibili. Ogni famiglia tecnologia può usarne un sottoinsieme."
                action={<button className="btn btn-primary btn-sm" onClick={handleCreate}>{Icons.plus} Nuovo Motivo</button>}
            />

            <div style={{ display: "grid", gridTemplateColumns: isCreating || editingId ? "1fr 350px" : "1fr", gap: 24 }}>
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)", textAlign: "left" }}>
                                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Icona</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Etichetta</th>
                                <th style={{ padding: "12px 8px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Colore</th>
                                <th style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>ID</th>
                                <th style={{ padding: "12px 16px", width: 90 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {motiviFermo.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>Nessun motivo. Clicca "Nuovo Motivo".</td></tr>
                            ) : motiviFermo.map(m => (
                                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)", background: editingId === m.id ? "var(--bg-secondary)" : "transparent" }}>
                                    <td style={{ padding: "12px 16px", fontSize: 20 }}>{m.icona}</td>
                                    <td style={{ padding: "12px 8px", fontWeight: 600 }}>{m.label}</td>
                                    <td style={{ padding: "12px 8px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ width: 16, height: 16, borderRadius: 4, background: m.colore, border: "1px solid rgba(0,0,0,0.15)", flexShrink: 0 }} />
                                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{m.colore}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{m.id}</td>
                                    <td style={{ padding: "12px 16px" }}>
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                            <button className="btn-action edit" onClick={() => handleEdit(m)}>{Icons.edit}</button>
                                            <button className="btn-action delete" onClick={() => handleDelete(m.id)}>{Icons.trash}</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {(isCreating || editingId) && (
                    <div className="card" style={{ height: "fit-content", position: "sticky", top: 20 }}>
                        <div className="card-header" style={{ marginBottom: 16 }}>
                            <div className="card-title">{isCreating ? "Nuovo Motivo" : "Modifica Motivo"}</div>
                            <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                        </div>
                        {!isCreating && <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>ID: <span style={{ fontFamily: "monospace" }}>{formData.id}</span></div>}
                        <div className="form-group">
                            <label className="form-label">Etichetta *</label>
                            <input className="input" value={formData.label} onChange={e => setFormData(p => ({ ...p, label: e.target.value }))} placeholder="es. Guasto Meccanico" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Icona</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                {ICONE_PRESET.map(ic => (
                                    <button key={ic} onClick={() => setFormData(p => ({ ...p, icona: ic }))} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 6, cursor: "pointer", border: formData.icona === ic ? "2px solid var(--primary)" : "2px solid var(--border)", background: formData.icona === ic ? "var(--primary-light, #dbeafe)" : "transparent" }}>{ic}</button>
                                ))}
                            </div>
                            <input className="input" value={formData.icona} onChange={e => setFormData(p => ({ ...p, icona: e.target.value }))} placeholder="oppure incolla emoji" style={{ fontSize: 18 }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Colore</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="color" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ width: 40, height: 38, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                                <input className="input" value={formData.colore} onChange={e => setFormData(p => ({ ...p, colore: e.target.value }))} style={{ fontFamily: "monospace" }} />
                            </div>
                        </div>
                        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 22 }}>{formData.icona}</span>
                            <span style={{ fontWeight: 600 }}>{formData.label || "Anteprima…"}</span>
                            <div style={{ marginLeft: "auto", width: 14, height: 14, borderRadius: 3, background: formData.colore }} />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Salva</button>
                            <button className="btn btn-secondary" onClick={resetForm}>Annulla</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPALE
══════════════════════════════════════════════════════════ */
export default function AnagraficaFermiView({ motiviFermo, setMotiviFermo, tecnologie, setTecnologie, showToast }) {
    return (
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            <TecnologieSection tecnologie={tecnologie} setTecnologie={setTecnologie} motiviFermo={motiviFermo} showToast={showToast} />
            <MotiviSection motiviFermo={motiviFermo} setMotiviFermo={setMotiviFermo} showToast={showToast} />
        </div>
    );
}
