import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

export default function AnagraficaMaterialiView({ showToast }) {
    const [materiali, setMateriali] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");

    // Form state
    const [newItem, setNewItem] = useState({ codice: "", componente: "", progetto: "" });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("anagrafica_materiali")
            .select("*")
            .order("codice", { ascending: true });

        if (error) {
            console.error("Errore fetch materiali:", error);
            showToast("Errore caricamento dati", "error");
        } else {
            setMateriali(data || []);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!newItem.codice || !newItem.componente) {
            showToast("Codice e Componente sono obbligatori", "warning");
            return;
        }

        setSaving(true);
        const payload = {
            codice: newItem.codice.trim().toUpperCase(),
            componente: newItem.componente.trim().toUpperCase(),
            progetto: newItem.progetto ? newItem.progetto.trim() : null,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from("anagrafica_materiali")
            .upsert(payload, { onConflict: 'codice' });

        setSaving(false);

        if (error) {
            console.error("Errore salvataggio:", error);
            showToast("Errore salvataggio: " + error.message, "error");
        } else {
            showToast("Materiale salvato correttamente", "success");
            setNewItem({ codice: "", componente: "", progetto: "" });
            fetchData();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Sei sicuro di voler eliminare questa associazione?")) return;

        const { error } = await supabase
            .from("anagrafica_materiali")
            .delete()
            .eq("id", id);

        if (error) {
            showToast("Errore eliminazione", "error");
        } else {
            showToast("Associazione eliminata", "success");
            fetchData();
        }
    };

    const handleCodiceChange = (val) => {
        const uppercaseVal = val.toUpperCase();
        let autoProj = "";
        if (uppercaseVal.startsWith("251")) autoProj = "DCT 300";
        else if (uppercaseVal.startsWith("M015")) autoProj = "8Fe";
        else if (uppercaseVal.startsWith("M016")) autoProj = "DCT Eco";

        setNewItem(prev => ({
            ...prev,
            codice: val,
            progetto: autoProj || prev.progetto
        }));
    };

    const filtered = materiali.filter(m =>
        m.codice.toLowerCase().includes(search.toLowerCase()) ||
        m.componente.toLowerCase().includes(search.toLowerCase()) ||
        (m.progetto && m.progetto.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="fade-in" style={{ height: "100%", paddingBottom: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Anagrafica Materiali</h2>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Associa i codici SAP a componenti e progetti (es. SCA14025 → SG2 · DCT Eco)</p>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 24, padding: "16px", background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Codice SAP</label>
                        <input
                            className="input"
                            value={newItem.codice}
                            onChange={e => handleCodiceChange(e.target.value)}
                            placeholder="es. SCA14025"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ flex: "1 1 150px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Componente</label>
                        <input
                            className="input"
                            value={newItem.componente}
                            onChange={e => setNewItem(prev => ({ ...prev, componente: e.target.value }))}
                            placeholder="es. SG2"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ flex: "1 1 150px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Progetto</label>
                        <input
                            className="input"
                            value={newItem.progetto}
                            onChange={e => setNewItem(prev => ({ ...prev, progetto: e.target.value }))}
                            placeholder="es. DCT Eco"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ height: 42, minWidth: 160 }}>
                        {saving ? "Salvataggio..." : "Aggiungi / Aggiorna"}
                    </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                    <input
                        className="input"
                        placeholder="Cerca per codice, componente o progetto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: "100%", maxWidth: 400 }}
                    />
                </div>

                <div className="table-container">
                    <table style={{ width: "100%" }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)" }}>
                                <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Codice SAP</th>
                                <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Progetto / Componente</th>
                                <th style={{ textAlign: "right", padding: "10px 16px", width: 80 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Nessun materiale trovato</td></tr>
                            ) : (
                                filtered.map(m => (
                                    <tr key={m.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                        <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 14 }}>{m.codice}</td>
                                        <td style={{ padding: "12px 16px" }}>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                {m.progetto && (
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                                                        {m.progetto}
                                                    </span>
                                                )}
                                                {m.progetto && <span style={{ opacity: 0.3 }}>•</span>}
                                                <span style={{ padding: "4px 8px", background: "var(--bg-tertiary)", borderRadius: 4, fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>
                                                    {m.componente}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleDelete(m.id)}
                                                style={{ color: "var(--danger)", padding: "4px 8px" }}
                                            >
                                                {Icons.trash}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
