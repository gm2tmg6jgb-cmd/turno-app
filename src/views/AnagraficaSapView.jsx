import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const EMPTY_ROW = { progetto: "", componente: "", fase_label: "", sap_mat: "", sap_op: "", macchina: "", note: "" };

export default function AnagraficaSapView({ showToast }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newRow, setNewRow] = useState(EMPTY_ROW);
    const [filter, setFilter] = useState("");

    const fetchRows = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("anagrafica_sap")
            .select("*")
            .order("progetto")
            .order("componente")
            .order("fase_label");
        if (error) {
            showToast?.("Errore caricamento anagrafica SAP", "error");
        } else {
            setRows(data || []);
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    const startEdit = (row) => {
        setEditingId(row.id);
        setDraft({ ...row });
    };

    const cancelEdit = () => { setEditingId(null); setDraft(null); };

    const saveEdit = async () => {
        const { error } = await supabase
            .from("anagrafica_sap")
            .update({
                progetto: draft.progetto.trim(),
                componente: draft.componente.trim(),
                fase_label: draft.fase_label.trim(),
                sap_mat: draft.sap_mat.trim(),
                sap_op: draft.sap_op?.trim() || null,
                macchina: draft.macchina?.trim() || null,
                note: draft.note?.trim() || null,
            })
            .eq("id", draft.id);
        if (error) {
            showToast?.("Errore salvataggio: " + error.message, "error");
        } else {
            showToast?.("Salvato", "success");
            setEditingId(null);
            setDraft(null);
            fetchRows();
        }
    };

    const saveNew = async () => {
        if (!newRow.progetto || !newRow.componente || !newRow.fase_label || !newRow.sap_mat) {
            showToast?.("Compila Progetto, Componente, Fase e Mat. SAP", "error");
            return;
        }
        const { error } = await supabase
            .from("anagrafica_sap")
            .insert({
                progetto: newRow.progetto.trim(),
                componente: newRow.componente.trim(),
                fase_label: newRow.fase_label.trim(),
                sap_mat: newRow.sap_mat.trim(),
                sap_op: newRow.sap_op?.trim() || null,
                macchina: newRow.macchina?.trim() || null,
                note: newRow.note?.trim() || null,
            });
        if (error) {
            showToast?.("Errore inserimento: " + error.message, "error");
        } else {
            showToast?.("Riga aggiunta", "success");
            setAdding(false);
            setNewRow(EMPTY_ROW);
            fetchRows();
        }
    };

    const deleteRow = async (id) => {
        if (!confirm("Eliminare questa riga?")) return;
        const { error } = await supabase.from("anagrafica_sap").delete().eq("id", id);
        if (error) {
            showToast?.("Errore eliminazione", "error");
        } else {
            showToast?.("Eliminato", "success");
            fetchRows();
        }
    };

    const filtered = rows.filter(r =>
        !filter || [r.progetto, r.componente, r.fase_label, r.sap_mat, r.sap_op, r.macchina].some(v =>
            v?.toLowerCase().includes(filter.toLowerCase())
        )
    );

    const inputStyle = {
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "5px 8px",
        color: "var(--text-primary)",
        fontSize: 12,
        width: "100%",
    };

    const colStyle = { padding: "10px 12px", verticalAlign: "middle" };

    return (
        <div style={{ padding: 32, maxWidth: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                        🗂️ Anagrafica SAP
                    </h2>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                        Registro centralizzato dei codici materiale e operazione SAP per ogni componente. Tutte le viste leggono da qui.
                    </p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <input
                        placeholder="Filtra..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={{ ...inputStyle, width: 200, padding: "8px 12px" }}
                    />
                    <button
                        onClick={() => { setAdding(true); setNewRow(EMPTY_ROW); }}
                        style={{
                            padding: "8px 18px", fontWeight: 700, fontSize: 13,
                            background: "var(--accent)", color: "white",
                            border: "none", borderRadius: 8, cursor: "pointer"
                        }}
                    >
                        + Aggiungi
                    </button>
                </div>
            </div>

            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                            {["Progetto", "Componente", "Fase", "Mat. SAP", "Op. SAP", "Macchina", "Note", ""].map(h => (
                                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {/* Riga nuova */}
                        {adding && (
                            <tr style={{ background: "rgba(60,110,240,0.06)", borderBottom: "1px solid var(--border)" }}>
                                {["progetto", "componente", "fase_label", "sap_mat", "sap_op", "macchina", "note"].map(field => (
                                    <td key={field} style={colStyle}>
                                        <input
                                            value={newRow[field]}
                                            onChange={e => setNewRow(r => ({ ...r, [field]: e.target.value }))}
                                            placeholder={field === "sap_op" || field === "macchina" || field === "note" ? "opzionale" : ""}
                                            style={inputStyle}
                                        />
                                    </td>
                                ))}
                                <td style={{ ...colStyle, whiteSpace: "nowrap" }}>
                                    <button onClick={saveNew} style={{ marginRight: 6, padding: "5px 12px", background: "#22c55e", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓</button>
                                    <button onClick={() => setAdding(false)} style={{ padding: "5px 12px", background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✕</button>
                                </td>
                            </tr>
                        )}

                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento…</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Nessuna riga. Clicca "+ Aggiungi" per iniziare.</td></tr>
                        ) : filtered.map((row, i) => {
                            const isEditing = editingId === row.id;
                            return (
                                <tr key={row.id} style={{ borderBottom: "1px solid var(--border-light)", background: isEditing ? "rgba(60,110,240,0.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                    {["progetto", "componente", "fase_label", "sap_mat", "sap_op", "macchina", "note"].map(field => (
                                        <td key={field} style={colStyle}>
                                            {isEditing ? (
                                                <input
                                                    value={draft[field] || ""}
                                                    onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
                                                    style={inputStyle}
                                                />
                                            ) : (
                                                <span style={{ color: field === "sap_mat" ? "var(--accent)" : field === "sap_op" ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: field === "sap_mat" ? 700 : 400 }}>
                                                    {row[field] || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                    <td style={{ ...colStyle, whiteSpace: "nowrap" }}>
                                        {isEditing ? (
                                            <>
                                                <button onClick={saveEdit} style={{ marginRight: 6, padding: "5px 12px", background: "#22c55e", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✓ Salva</button>
                                                <button onClick={cancelEdit} style={{ padding: "5px 12px", background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Annulla</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(row)} style={{ marginRight: 6, padding: "5px 12px", background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✏️</button>
                                                <button onClick={() => deleteRow(row.id)} style={{ padding: "5px 10px", background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>🗑</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
                {filtered.length} righe · Ogni riga = una fase di un componente con il relativo codice materiale SAP
            </p>
        </div>
    );
}
