import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

export default function MotiviView({ motivi, setMotivi, showToast }) {
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        id: "",
        label: "",
        sigla: "",
        colore: "#6B7280"
    });
    const [isCreating, setIsCreating] = useState(false);

    const resetForm = () => {
        setFormData({ id: "", label: "", sigla: "", colore: "#6B7280" });
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
        if (!formData.label || !formData.sigla) {
            showToast("Compila tutti i campi obbligatori", "warning");
            return;
        }

        try {
            if (isCreating) {
                // Auto-generate ID from Label
                const generatedId = formData.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
                const payload = { ...formData, id: generatedId };

                // Create
                const { data, error } = await supabase
                    .from('motivi_assenza')
                    .insert([payload])
                    .select();

                if (error) throw error;
                setMotivi([...motivi, data[0]]);
                showToast(`Motivo creato (ID: ${generatedId})`, "success");
            } else {
                // Update
                const { error } = await supabase
                    .from('motivi_assenza')
                    .update(formData)
                    .eq('id', editingId);

                if (error) throw error;
                setMotivi(motivi.map(m => m.id === editingId ? formData : m));
                showToast("Motivo aggiornato", "success");
            }
            resetForm();
        } catch (error) {
            console.error("Error saving motivo:", error);
            showToast("Errore salvataggio: " + error.message, "error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Sei sicuro di voler eliminare questo motivo?")) return;

        try {
            const { error } = await supabase
                .from('motivi_assenza')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setMotivi(motivi.filter(m => m.id !== id));
            showToast("Motivo eliminato", "success");
        } catch (error) {
            console.error("Error deleting motivo:", error);
            showToast("Errore eliminazione: " + error.message, "error");
        }
    };

    return (
        <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>Gestione Motivi Assenza</h2>
                <button className="btn btn-primary btn-sm" onClick={handleCreate}>
                    {Icons.plus} Nuovo Motivo
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 24 }}>
                {/* LISTA MOTIVI */}
                <div className="card">
                    <table style={{ width: "100%", fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 11 }}>
                                {/* <th style={{ paddingBottom: 10 }}>Icona</th> */}
                                {/* <th style={{ paddingBottom: 10 }}>ID</th> */}
                                <th style={{ paddingBottom: 10 }}>Etichetta</th>
                                <th style={{ paddingBottom: 10 }}>Sigla</th>
                                <th style={{ paddingBottom: 10 }}>Colore</th>
                                <th style={{ paddingBottom: 10, textAlign: 'right' }}>Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {motivi.map(m => (
                                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                    {/* <td style={{ padding: "12px 0", fontSize: 18 }}>{m.icona}</td> */}
                                    {/* <td style={{ padding: "12px 0", fontFamily: "monospace" }}>{m.id}</td> */}
                                    <td style={{ padding: "12px 0", fontWeight: 600 }}>{m.label}</td>
                                    <td style={{ padding: "12px 0" }}><span className="tag" style={{ background: m.colore + "20", color: m.colore }}>{m.sigla}</span></td>
                                    <td style={{ padding: "12px 0" }}>
                                        <div style={{ width: 16, height: 16, borderRadius: 4, background: m.colore, border: "1px solid rgba(255,255,255,0.2)" }} />
                                    </td>
                                    <td style={{ padding: "12px 0", textAlign: "right" }}>
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

                {/* FORM */}
                {(isCreating || editingId) && (
                    <div className="card" style={{ height: "fit-content", position: "sticky", top: 20 }}>
                        <div className="card-header">
                            <div className="card-title">{isCreating ? "Nuovo Motivo" : "Modifica Motivo"}</div>
                            <button className="btn-ghost btn-sm" onClick={resetForm}>{Icons.x}</button>
                        </div>

                        <div className="form-group">
                            {/* ID is auto-generated */}
                            {!isCreating && (
                                <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text-muted)" }}>
                                    ID: <span style={{ fontFamily: "monospace" }}>{formData.id}</span>
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Etichetta</label>
                            <input
                                className="input"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="es. Ferie"
                            />
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="form-group">
                                <label className="form-label">Sigla (Dashboard)</label>
                                <input
                                    className="input"
                                    value={formData.sigla}
                                    onChange={e => setFormData({ ...formData, sigla: e.target.value })}
                                    placeholder="es. F"
                                    maxLength={3}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Colore</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="color"
                                    value={formData.colore}
                                    onChange={e => setFormData({ ...formData, colore: e.target.value })}
                                    style={{ width: 40, height: 38, padding: 0, border: "none", background: "none", cursor: "pointer" }}
                                />
                                <input
                                    className="input"
                                    value={formData.colore}
                                    onChange={e => setFormData({ ...formData, colore: e.target.value })}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Salva</button>
                            <button className="btn btn-secondary" onClick={resetForm}>Annulla</button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
