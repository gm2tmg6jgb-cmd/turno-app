import { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { REPARTI } from "../data/constants";

const EMPTY = {
    id: "",
    nome: "",
    reparto_id: "T11",
    zona: "",
    tecnologia_id: "",
    personale_minimo: 1,
    codice_sap: "",
};

export default function AnagraficaMacchineView({ macchine, setMacchine, tecnologie = [], zone = [], showToast }) {
    const [search, setSearch] = useState("");
    const [filterReparto, setFilterReparto] = useState("");
    const [filterTec, setFilterTec] = useState("");
    const [editingId, setEditingId] = useState(null); // null = nessun form aperto, 'new' = nuovo, ID = modifica
    const [originalId, setOriginalId] = useState(null); // ID originale prima di eventuali modifiche
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    /* ── dati filtrati ── */
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return macchine
            .filter(m => {
                const matchQ = !q || (m.id || "").toLowerCase().includes(q) || (m.nome || "").toLowerCase().includes(q);
                const matchRep = !filterReparto || m.reparto_id === filterReparto;
                const matchTec = !filterTec || m.tecnologia_id === filterTec;
                return matchQ && matchRep && matchTec;
            })
            .sort((a, b) => (a.id || "").localeCompare(b.id || "", undefined, { numeric: true, sensitivity: "base" }));
    }, [macchine, search, filterReparto, filterTec]);

    /* ── helpers lookup ── */
    const getTecLabel = (tecId) => tecnologie.find(t => t.id === tecId)?.label || "—";
    const getZonaLabel = (zonaId) => zone.find(z => z.id === zonaId)?.label || zonaId || "—";

    /* ── apri form ── */
    const openNew = () => {
        setForm(EMPTY);
        setEditingId("new");
    };

    const openEdit = (m) => {
        const f = {
            id: m.id || "",
            nome: m.nome || "",
            reparto_id: m.reparto_id || "T11",
            zona: m.zona || "",
            tecnologia_id: m.tecnologia_id || "",
            personale_minimo: m.personale_minimo ?? 1,
            codice_sap: m.codice_sap || "",
        };
        setForm(f);
        setOriginalId(m.id);
        setEditingId(m.id);
    };

    const closeForm = () => { setEditingId(null); setOriginalId(null); setForm(EMPTY); };

    /* ── zone filtrate per reparto selezionato nel form ── */
    const zonePerReparto = useMemo(() => {
        if (!form.reparto_id) return zone;
        return zone.filter(z => (z.repart_id || z.reparto) === form.reparto_id);
    }, [zone, form.reparto_id]);

    /* ── salva ── */
    const handleSave = async () => {
        const newId = form.id.trim().toUpperCase();
        if (!newId) { showToast("ID macchina obbligatorio", "error"); return; }
        setSaving(true);

        const payload = {
            id: newId,
            nome: form.nome.trim() || newId,
            reparto_id: form.reparto_id || null,
            zona: form.zona || null,
            tecnologia_id: form.tecnologia_id || null,
            personale_minimo: parseInt(form.personale_minimo) || 1,
            codice_sap: form.codice_sap.trim().toUpperCase() || null,
        };

        const idChanged = editingId !== "new" && originalId && originalId !== newId;

        if (idChanged) {
            // ID rinominato: insert con nuovo ID + delete del vecchio
            const { data: inserted, error: errIns } = await supabase.from("macchine").insert(payload).select();
            if (errIns) { setSaving(false); showToast("Errore inserimento nuovo ID: " + errIns.message, "error"); return; }
            const { error: errDel } = await supabase.from("macchine").delete().eq("id", originalId);
            setSaving(false);
            if (errDel) { showToast("Nuovo ID creato ma errore cancellazione vecchio: " + errDel.message, "error"); return; }
            setMacchine(prev => prev.map(m => m.id === originalId ? inserted[0] : m));
            showToast(`ID rinominato: ${originalId} → ${newId}`, "success");
        } else {
            // Nuovo o aggiornamento senza cambio ID
            const { data, error } = await supabase.from("macchine").upsert(payload, { onConflict: 'id' }).select();
            setSaving(false);
            if (error) { showToast("Errore: " + error.message, "error"); return; }
            const saved = data[0];
            if (editingId === "new") {
                setMacchine(prev => [...prev, saved]);
                showToast(`Macchina ${saved.id} aggiunta`, "success");
            } else {
                setMacchine(prev => prev.map(m => m.id === saved.id ? saved : m));
                showToast(`Macchina ${saved.id} aggiornata`, "success");
            }
        }
        closeForm();
    };

    /* ── elimina ── */
    const handleDelete = async (id) => {
        if (!window.confirm(`Eliminare la macchina ${id}? Verranno rimossi anche assegnazioni e competenze associate.`)) return;
        const { error } = await supabase.from("macchine").delete().eq("id", id);
        if (error) { showToast("Errore eliminazione: " + error.message, "error"); return; }
        setMacchine(prev => prev.filter(m => m.id !== id));
        showToast(`Macchina ${id} eliminata`, "warning");
        if (editingId === id) closeForm();
    };

    const formOpen = editingId !== null;

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingRight: 8, paddingBottom: 20 }}>

            {/* ── Filtri + bottone ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Cerca</label>
                    <input
                        className="input"
                        placeholder="ID o nome macchina…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: 220 }}
                    />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Reparto</label>
                    <select className="select-input" value={filterReparto} onChange={e => setFilterReparto(e.target.value)} style={{ width: 160 }}>
                        <option value="">Tutti</option>
                        {REPARTI.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tecnologia</label>
                    <select className="select-input" value={filterTec} onChange={e => setFilterTec(e.target.value)} style={{ width: 180 }}>
                        <option value="">Tutte</option>
                        {tecnologie.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        <strong>{filtered.length}</strong> / {macchine.length} macchine
                    </span>
                    <button className={formOpen && editingId === "new" ? "btn btn-secondary" : "btn btn-primary"} onClick={formOpen && editingId === "new" ? closeForm : openNew}>
                        {formOpen && editingId === "new" ? "Chiudi" : <>{Icons.plus} Nuova Macchina</>}
                    </button>
                </div>
            </div>

            {/* ── Layout tabella + form ── */}
            <div style={{ display: "grid", gridTemplateColumns: formOpen ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>

                {/* ── Tabella ── */}
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                            Nessuna macchina trovata.
                        </div>
                    ) : (
                        <div className="table-container">
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-tertiary)" }}>
                                        <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>ID</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Nome</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Reparto</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Zona</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tecnologia Fermi</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Codice SAP</th>
                                        <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Min</th>
                                        <th style={{ width: 80, padding: "10px 16px" }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(m => {
                                        const tec = tecnologie.find(t => t.id === m.tecnologia_id);
                                        const isActive = editingId === m.id;
                                        return (
                                            <tr
                                                key={m.id}
                                                style={{
                                                    borderBottom: "1px solid var(--border-light)",
                                                    background: isActive ? "var(--bg-tertiary)" : "transparent",
                                                    cursor: "pointer",
                                                }}
                                                onClick={() => isActive ? closeForm() : openEdit(m)}
                                            >
                                                <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>
                                                    {m.id}
                                                </td>
                                                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                                    {m.nome !== m.id ? m.nome : <span style={{ color: "var(--text-muted)" }}>—</span>}
                                                </td>
                                                <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                                                    {m.reparto_id || "—"}
                                                </td>
                                                <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>
                                                    {getZonaLabel(m.zona)}
                                                </td>
                                                <td style={{ padding: "10px 12px" }}>
                                                    {tec ? (
                                                        <span style={{
                                                            background: (tec.colore || "#6B7280") + "22",
                                                            color: tec.colore || "#6B7280",
                                                            border: `1px solid ${(tec.colore || "#6B7280") + "55"}`,
                                                            borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                                                        }}>
                                                            {tec.label}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "10px 12px", fontSize: 13, fontFamily: "monospace", color: "var(--accent)" }}>
                                                    {m.codice_sap || <span style={{ color: "var(--text-lighter)", fontStyle: "italic", fontSize: 11 }}>—</span>}
                                                </td>
                                                <td style={{ textAlign: "center", padding: "10px 12px", fontSize: 13, color: "var(--text-secondary)" }}>
                                                    {m.personale_minimo ?? 1}
                                                </td>
                                                <td style={{ padding: "10px 16px" }} onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                                        <button className="btn-action edit" onClick={() => isActive ? closeForm() : openEdit(m)} title="Modifica">
                                                            {Icons.edit}
                                                        </button>
                                                        <button className="btn-action delete" onClick={() => handleDelete(m.id)} title="Elimina">
                                                            {Icons.trash}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Form panel ── */}
                {formOpen && (
                    <div className="card" style={{ position: "sticky", top: 20 }}>
                        <div className="card-header" style={{ marginBottom: 16 }}>
                            <div className="card-title">{editingId === "new" ? "Nuova Macchina" : `Modifica ${editingId}`}</div>
                            <button className="btn-ghost btn-sm" onClick={closeForm}>{Icons.x}</button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">ID Macchina *</label>
                            <input
                                className="input"
                                placeholder="Es. FRW11042"
                                value={form.id}
                                onChange={e => setForm(p => ({ ...p, id: e.target.value.toUpperCase() }))}
                                style={{ fontFamily: "monospace", fontWeight: 700 }}
                            />
                            {editingId !== "new" && originalId && form.id !== originalId && (
                                <div style={{ fontSize: 11, color: "var(--warning, #F59E0B)", marginTop: 4 }}>
                                    Rinomina: <strong>{originalId}</strong> → <strong>{form.id}</strong>. I fermi già registrati con il vecchio ID non vengono aggiornati automaticamente.
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nome descrittivo</label>
                            <input
                                className="input"
                                placeholder="Lascia vuoto = usa ID"
                                value={form.nome}
                                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Reparto</label>
                            <select
                                className="select-input"
                                value={form.reparto_id}
                                onChange={e => setForm(p => ({ ...p, reparto_id: e.target.value, zona: "" }))}
                            >
                                <option value="">— Nessuno —</option>
                                {REPARTI.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Zona</label>
                            <select
                                className="select-input"
                                value={form.zona}
                                onChange={e => setForm(p => ({ ...p, zona: e.target.value }))}
                            >
                                <option value="">— Nessuna —</option>
                                {zonePerReparto.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tecnologia Fermi</label>
                            <select
                                className="select-input"
                                value={form.tecnologia_id}
                                onChange={e => setForm(p => ({ ...p, tecnologia_id: e.target.value }))}
                            >
                                <option value="">— Non assegnata —</option>
                                {tecnologie.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Codice SAP (per Import)</label>
                            <input
                                className="input"
                                placeholder="Es. FRW14020"
                                value={form.codice_sap}
                                onChange={e => setForm(p => ({ ...p, codice_sap: e.target.value.toUpperCase() }))}
                                style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}
                            />
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                Usato per abbinare i dati dei file Excel esportati da SAP.
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Personale minimo</label>
                            <input
                                type="number"
                                min="0"
                                className="input"
                                value={form.personale_minimo}
                                onChange={e => setForm(p => ({ ...p, personale_minimo: e.target.value }))}
                                style={{ width: 80 }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                                {saving ? "Salvataggio…" : "Salva"}
                            </button>
                            <button className="btn btn-secondary" onClick={closeForm}>Annulla</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
