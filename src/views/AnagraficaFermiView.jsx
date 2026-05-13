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
                // Auto-generate ID from Label + Technology
                const tecPrefix = formData.tecnologia_id || (formData.is_automazione ? "automazione" : "global");
                const labelSlug = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const generatedId = `${tecPrefix}_${labelSlug}`;
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
                        // Helper to render a table list
                        const renderTable = (list, typeLabel, color) => (
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 900, color: color || "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", paddingLeft: "4px" }}>
                                    {typeLabel} ({list.length})
                                </div>
                                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
                                    <tbody>
                                        {list.sort((a, b) => a.label.localeCompare(b.label)).map(m => (
                                            <tr key={m.id} style={{ backgroundColor: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
                                                <td style={{ padding: "8px 10px", width: "32px", fontSize: 16, borderRadius: "8px 0 0 8px" }}>{m.icona}</td>
                                                <td style={{ padding: "8px 10px" }}>
                                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{m.label}</div>
                                                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>ID: {m.id}</div>
                                                </td>
                                                <td style={{ padding: "8px 10px", textAlign: "right", borderRadius: "0 8px 8px 0" }}>
                                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                                                        <button className="btn-action edit" style={{ padding: "4px" }} onClick={() => handleEdit(m)}>{Icons.edit}</button>
                                                        <button className="btn-action delete" style={{ padding: "4px" }} onClick={() => handleDelete(m.id)}>{Icons.trash}</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {list.length === 0 && (
                                            <tr>
                                                <td colSpan="3" style={{ padding: "12px", textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                                                    Nessuna causale
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );

                        // Define groups: Global + each Technology
                        const groups = [
                            { id: null, label: "🌎 Globali / Comuni", color: "#64748b" },
                            ...tecnologie.map(t => ({ id: t.id, label: `⚙️ ${t.label}`, color: "#3b82f6" }))
                        ];

                        return groups.map(group => {
                            const groupMotivi = motiviFermo.filter(m => (m.tecnologia_id === group.id) || (group.id === null && !m.tecnologia_id));
                            const machineList = groupMotivi.filter(m => !m.is_automazione);
                            const autoList = groupMotivi.filter(m => m.is_automazione);

                            if (groupMotivi.length === 0) return null;

                            return (
                                <div key={group.id || "global"} style={{ marginBottom: 48, background: "var(--bg-card)" }}>
                                    <div style={{ 
                                        padding: "14px 20px", 
                                        background: "var(--bg-tertiary)",
                                        borderBottom: "2px solid var(--border)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        marginBottom: 20
                                    }}>
                                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: group.color }} />
                                        <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                                            {group.label}
                                        </h3>
                                    </div>
                                    <div style={{ 
                                        display: "flex", 
                                        flexDirection: "column",
                                        gap: 32, 
                                        padding: "0 20px 20px 20px"
                                    }}>
                                        <div style={{ background: "rgba(59, 130, 246, 0.03)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(59, 130, 246, 0.1)" }}>
                                            {renderTable(machineList, "⚙️ Fermi Macchina", "#3b82f6")}
                                        </div>
                                        <div style={{ background: "rgba(168, 85, 247, 0.03)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(168, 85, 247, 0.1)" }}>
                                            {renderTable(autoList, "🤖 Fermi Automazione", "#a855f7")}
                                        </div>
                                    </div>
                                </div>
                            );
                        });
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

                        <div className="form-group">
                            <label className="form-label">Tecnologia Associata (Opzionale)</label>
                            <select 
                                className="select-input" 
                                value={formData.tecnologia_id || ""} 
                                onChange={e => setFormData({ ...formData, tecnologia_id: e.target.value || null })}
                            >
                                <option value="">Global / Tutte le tecnologie</option>
                                {tecnologie.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>

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
