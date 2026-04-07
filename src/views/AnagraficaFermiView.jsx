import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

export default function AnagraficaFermiView({ motiviFermo, setMotiviFermo, tecnologie = [], showToast }) {
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        id: "",
        label: "",
        icona: "⚠️",
        is_automazione: false,
        tecnologia_id: ""
    });
    const [isCreating, setIsCreating] = useState(false);

    const resetForm = () => {
        setFormData({ id: "", label: "", icona: "⚠️", is_automazione: false, tecnologia_id: "" });
        setEditingId(null);
        setIsCreating(false);
    };

    const handleEdit = (m) => {
        setFormData(m);
        setEditingId(m.id);
        setIsCreating(false);
    };

    const handleCreate = () => {
        resetForm();
        setIsCreating(true);
    };

    const handleSave = async () => {
        if (!formData.label) {
            showToast("Il campo Etichetta è obbligatorio", "warning");
            return;
        }

        try {
            if (isCreating) {
                // Auto-generate ID from Label
                const generatedId = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { ...formData, id: generatedId };

                // Create
                const { data, error } = await supabase
                    .from('motivi_fermo')
                    .insert([payload])
                    .select();

                if (error) throw error;
                setMotiviFermo([...motiviFermo, data[0]]);
                showToast(`Motivo creato (ID: ${generatedId})`, "success");
            } else {
                // Update
                const { error } = await supabase
                    .from('motivi_fermo')
                    .update(formData)
                    .eq('id', editingId);

                if (error) throw error;
                setMotiviFermo(motiviFermo.map(m => m.id === editingId ? formData : m));
                showToast("Motivo aggiornato", "success");
            }
            resetForm();
        } catch (error) {
            console.error("Error saving motivo:", error);
            showToast("Errore salvataggio: " + error.message, "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo motivo di fermo?")) return;

        try {
            const { error } = await supabase
                .from('motivi_fermo')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMotiviFermo(motiviFermo.filter(m => m.id !== id));
            showToast("Motivo eliminato", "success");
        } catch (error) {
            console.error("Error deleting motivo:", error);
            showToast("Errore eliminazione: " + error.message, "error");
        }
    };

    return (
        <div className="fade-in" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                        Anagrafica Fermi Macchine
                    </h1>
                    <p style={{ margin: "4px 0 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        Gestisci le causali dei fermi per macchine e automazione.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleCreate}>
                    {Icons.plus} Nuovo Motivo
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24, alignItems: "start" }}>
                {/* LISTA MOTIVI */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {(() => {
                        // Separate Automazione from others
                        const automazioneMotivi = motiviFermo.filter(m => m.is_automazione);
                        const machineMotivi = motiviFermo.filter(m => !m.is_automazione);

                        // Group machineMotivi by technology
                        const groupedByTec = machineMotivi.reduce((acc, m) => {
                            const tecId = m.tecnologia_id || "unassigned";
                            if (!acc[tecId]) acc[tecId] = [];
                            acc[tecId].push(m);
                            return acc;
                        }, {});

                        const renderSection = (title, list, color) => {
                            if (list.length === 0) return null;
                            return (
                                <div key={title} style={{ marginBottom: 24 }}>
                                    <div style={{ 
                                        padding: "12px 18px", 
                                        background: color ? `${color}15` : "var(--bg-tertiary)", 
                                        borderBottom: "1px solid var(--border)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px"
                                    }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color || "var(--text-muted)" }} />
                                        <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0, color: color || "var(--text-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                                            {title}
                                        </h3>
                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>{list.length} causali</span>
                                    </div>
                                    <div style={{ padding: "8px" }}>
                                        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                                            <tbody>
                                                {list.sort((a, b) => a.label.localeCompare(b.label)).map(m => (
                                                    <tr key={m.id} style={{ backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
                                                        <td style={{ padding: "10px 12px", width: "40px", fontSize: 18, borderRadius: "8px 0 0 8px" }}>{m.icona}</td>
                                                        <td style={{ padding: "10px 12px" }}>
                                                            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</div>
                                                            <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {m.id}</div>
                                                        </td>
                                                        <td style={{ padding: "10px 12px", textAlign: "right", borderRadius: "0 8px 8px 0" }}>
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
                                </div>
                            );
                        };

                        return (
                            <>
                                {renderSection("🤖 Automazione (Globali)", automazioneMotivi, "#a855f7")}
                                {Object.entries(groupedByTec).map(([tecId, list]) => {
                                    const tecLabel = tecnologie.find(t => t.id === tecId)?.label || "Senza Tecnologia";
                                    return renderSection(`⚙️ ${tecLabel}`, list, "#3b82f6");
                                })}
                            </>
                        );
                    })()}
                </div>

                {/* FORM */}
                {(isCreating || editingId) && (
                    <div className="card shadow-lg" style={{ position: "sticky", top: 20, border: "1px solid var(--accent-muted)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <div style={{ fontWeight: 800, fontSize: 16 }}>{isCreating ? "Crea Nuovo Motivo" : "Modifica Motivo"}</div>
                            <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Etichetta *</label>
                            <input
                                className="input"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="es. Cambio Utensile"
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Icona (Emoji)</label>
                                <input
                                    className="input"
                                    value={formData.icona}
                                    onChange={e => setFormData({ ...formData, icona: e.target.value })}
                                    placeholder="⚠️"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tipo</label>
                                <select 
                                    className="select-input" 
                                    value={formData.is_automazione} 
                                    onChange={e => setFormData({ ...formData, is_automazione: e.target.value === "true" })}
                                >
                                    <option value="false">Fermo Macchina</option>
                                    <option value="true">Fermo Automazione</option>
                                </select>
                            </div>
                        </div>

                        {!formData.is_automazione && (
                            <div className="form-group">
                                <label className="form-label">Tecnologia Associata (Opzionale)</label>
                                <select 
                                    className="select-input" 
                                    value={formData.tecnologia_id || ""} 
                                    onChange={e => setFormData({ ...formData, tecnologia_id: e.target.value || null })}
                                >
                                    <option value="">Tutte le tecnologie</option>
                                    {tecnologie.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                                {Icons.check} Salva
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={resetForm}>
                                Annulla
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
