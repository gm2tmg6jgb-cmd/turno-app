import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

const autoDetectProgetto = (codice) => {
    if (codice.startsWith("251")) return "DCT 300";
    if (codice.startsWith("M015") || codice.startsWith("M017")) return "8Fe";
    if (codice.startsWith("M016")) return "DCT Eco";
    return "";
};

const FASI = [
    { value: "start_soft", label: "Inizio Soft" },
    { value: "end_soft", label: "Fine Soft" },
    { value: "ht", label: "HT" },
    { value: "start_hard", label: "Inizio Hard" },
    { value: "end_hard", label: "Fine Hard" },
    { value: "washing", label: "Washing" },
];

export default function AnagraficaMaterialiView({ showToast }) {
    const [materiali, setMateriali] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);

    // Form state
    const [newItem, setNewItem] = useState({ codice: "", componente: "", progetto: "" });

    // Import bulk state
    const [importMode, setImportMode] = useState(false);
    const [importRows, setImportRows] = useState([]); // [{ codice, workCenters, componente, progetto }]
    const [importLoading, setImportLoading] = useState(false);
    const [importSaving, setImportSaving] = useState(false);

    // Centri di lavoro → fasi state
    const [wcFasi, setWcFasi] = useState([]);
    const [wcFasiLoading, setWcFasiLoading] = useState(true);
    const [wcFasiOpen, setWcFasiOpen] = useState(false);
    const [newWc, setNewWc] = useState({ work_center: "", fase: "start_soft", match_type: "prefix" });
    const [wcSaving, setWcSaving] = useState(false);

    useEffect(() => {
        fetchData();
        fetchWcFasi();
    }, []);

    const fetchWcFasi = async () => {
        setWcFasiLoading(true);
        const { data, error } = await supabase
            .from("wc_fasi_mapping")
            .select("*")
            .order("fase", { ascending: true });
        if (error) {
            console.error("Errore fetch wc_fasi_mapping:", error);
        } else {
            setWcFasi(data || []);
        }
        setWcFasiLoading(false);
    };

    const handleAddWc = async () => {
        if (!newWc.work_center.trim()) {
            showToast("Inserisci il Centro di Lavoro", "warning");
            return;
        }
        setWcSaving(true);
        const { error } = await supabase
            .from("wc_fasi_mapping")
            .insert({
                work_center: newWc.work_center.trim().toUpperCase(),
                fase: newWc.fase,
                match_type: newWc.match_type,
            });
        setWcSaving(false);
        if (error) {
            showToast("Errore: " + error.message, "error");
        } else {
            showToast("Mappatura aggiunta", "success");
            setNewWc({ work_center: "", fase: "start_soft", match_type: "prefix" });
            fetchWcFasi();
        }
    };

    const handleDeleteWc = async (id) => {
        if (!confirm("Eliminare questa mappatura?")) return;
        const { error } = await supabase.from("wc_fasi_mapping").delete().eq("id", id);
        if (error) {
            showToast("Errore eliminazione", "error");
        } else {
            showToast("Mappatura eliminata", "success");
            fetchWcFasi();
        }
    };

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
        const codice = newItem.codice.trim().toUpperCase();
        const payload = {
            codice,
            componente: newItem.componente.trim().toUpperCase(),
            progetto: newItem.progetto ? newItem.progetto.trim() : null,
        };

        // Prova insert; se il codice esiste già, aggiorna
        const { error: insertError } = await supabase
            .from("anagrafica_materiali")
            .insert(payload);

        if (insertError) {
            if (insertError.code === "23505") {
                const { error: updateError } = await supabase
                    .from("anagrafica_materiali")
                    .update({ componente: payload.componente, progetto: payload.progetto })
                    .eq("codice", codice);
                setSaving(false);
                if (updateError) {
                    showToast("Errore aggiornamento: " + updateError.message, "error");
                } else {
                    showToast("Materiale aggiornato correttamente", "success");
                    setNewItem({ codice: "", componente: "", progetto: "" });
                    fetchData();
                }
            } else {
                setSaving(false);
                showToast("Errore salvataggio: " + insertError.message, "error");
            }
        } else {
            setSaving(false);
            showToast("Materiale aggiunto correttamente", "success");
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
        const autoProj = autoDetectProgetto(uppercaseVal);
        setNewItem(prev => ({
            ...prev,
            codice: val,
            progetto: autoProj || prev.progetto
        }));
    };

    // ── Import da Storico SAP ──────────────────────────────────────────────────

    const handleImportFromSAP = async () => {
        setImportLoading(true);
        setImportMode(true);
        setImportRows([]);

        // Fetch paginato (PostgREST ha limite di 1000 righe per default)
        let allData = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from("conferme_sap")
                .select("materiale, work_center_sap")
                .range(from, from + pageSize - 1);
            if (error) {
                showToast("Errore caricamento storico SAP: " + error.message, "error");
                setImportLoading(false);
                return;
            }
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        // Aggrega: { codice → Set<work_center> }
        const map = {};
        allData.forEach(r => {
            if (!r.materiale) return;
            const mat = r.materiale.trim().toUpperCase();
            if (!map[mat]) map[mat] = new Set();
            if (r.work_center_sap) map[mat].add(r.work_center_sap.trim().toUpperCase());
        });

        // Filtra quelli già in anagrafica
        const existing = new Set(materiali.map(m => (m.codice || "").toUpperCase()));
        const rows = Object.entries(map)
            .filter(([mat]) => !existing.has(mat))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mat, wcs]) => ({
                codice: mat,
                workCenters: [...wcs].sort(),
                componente: "",
                progetto: autoDetectProgetto(mat),
            }));

        setImportRows(rows);
        setImportLoading(false);

        if (rows.length === 0) {
            showToast("Nessun nuovo codice trovato — tutti già mappati!", "success");
        }
    };

    const updateImportRow = (idx, field, value) => {
        setImportRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    };

    const handleBulkSave = async () => {
        const toSave = importRows.filter(r => r.componente.trim());
        if (toSave.length === 0) {
            showToast("Inserisci almeno un Componente prima di salvare", "warning");
            return;
        }

        setImportSaving(true);
        const payload = toSave.map(r => ({
            codice: r.codice,
            componente: r.componente.trim().toUpperCase(),
            progetto: r.progetto ? r.progetto.trim() : null,
        }));

        const { error } = await supabase
            .from("anagrafica_materiali")
            .insert(payload);

        setImportSaving(false);

        if (error) {
            console.error("Errore salvataggio bulk:", error);
            showToast("Errore: " + error.message, "error");
        } else {
            showToast(`${toSave.length} materiali salvati correttamente`, "success");
            setImportMode(false);
            setImportRows([]);
            fetchData();
        }
    };

    // ──────────────────────────────────────────────────────────────────────────

    const filtered = materiali.filter(m =>
        m.codice.toLowerCase().includes(search.toLowerCase()) ||
        m.componente.toLowerCase().includes(search.toLowerCase()) ||
        (m.progetto && m.progetto.toLowerCase().includes(search.toLowerCase()))
    );

    const toSaveCount = importRows.filter(r => r.componente.trim()).length;

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Anagrafica Materiali</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Associa i codici SAP a componenti e progetti</p>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                        {!isAdmin ? (
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    const pw = prompt("Inserisci la password amministratore:");
                                    if (pw === "admin123") {
                                        setIsAdmin(true);
                                        showToast("Accesso amministratore sbloccato", "success");
                                    } else if (pw !== null) {
                                        showToast("Password errata", "error");
                                    }
                                }}
                            >
                                {Icons.lock} Sblocca Modifiche
                            </button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => setIsAdmin(false)}>
                                {Icons.unlock} Blocca Modifiche
                            </button>
                        )}
                        <button
                            className="btn btn-secondary"
                            onClick={importMode ? () => { setImportMode(false); setImportRows([]); } : handleImportFromSAP}
                            disabled={importLoading || !isAdmin}
                            style={{ whiteSpace: "nowrap" }}
                            title={!isAdmin ? "Solo amministratorori" : ""}
                        >
                            {importMode ? "Chiudi Import" : importLoading ? "Caricamento..." : "Importa da Storico SAP"}
                        </button>
                    </div>
                </div>

                {/* ── Sezione Import Bulk ── */}
                {importMode && (
                    <div style={{ marginBottom: 24, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>Codici non ancora mappati da Storico SAP</span>
                                {!importLoading && (
                                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>
                                        {importRows.length} codici trovati — inserisci il Componente per ciascuno
                                    </span>
                                )}
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleBulkSave}
                                disabled={importSaving || toSaveCount === 0 || !isAdmin}
                                style={{ minWidth: 160 }}
                            >
                                {importSaving ? "Salvataggio..." : `Salva ${toSaveCount > 0 ? toSaveCount : ""} Materiali`}
                            </button>
                        </div>

                        {importLoading ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                Lettura storico SAP...
                            </div>
                        ) : importRows.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                Tutti i codici sono già mappati
                            </div>
                        ) : (
                            <div className="table-container" style={{ maxHeight: 480, overflowY: "auto" }}>
                                <table style={{ width: "100%" }}>
                                    <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                                        <tr style={{ background: "var(--bg-tertiary)" }}>
                                            <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: "30%" }}>Codice Materiale</th>
                                            <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Centri di Lavoro (WC)</th>
                                            <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: 130 }}>Componente</th>
                                            <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", width: 130 }}>Progetto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importRows.map((row, idx) => (
                                            <tr key={row.codice} style={{ borderBottom: "1px solid var(--border-light)", background: row.componente.trim() ? "color-mix(in srgb, var(--success) 5%, transparent)" : undefined }}>
                                                <td style={{ padding: "8px 16px", fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>{row.codice}</td>
                                                <td style={{ padding: "8px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                                                    {row.workCenters.length > 0
                                                        ? row.workCenters.join(", ")
                                                        : <span style={{ opacity: 0.4 }}>—</span>
                                                    }
                                                </td>
                                                <td style={{ padding: "6px 16px" }}>
                                                    <input
                                                        className="input"
                                                        value={row.componente}
                                                        onChange={e => updateImportRow(idx, "componente", e.target.value)}
                                                        placeholder="es. SG1"
                                                        style={{ width: "100%", height: 32, fontSize: 13 }}
                                                    />
                                                </td>
                                                <td style={{ padding: "6px 16px" }}>
                                                    <input
                                                        className="input"
                                                        value={row.progetto}
                                                        onChange={e => updateImportRow(idx, "progetto", e.target.value)}
                                                        placeholder="es. DCT 300"
                                                        style={{ width: "100%", height: 32, fontSize: 13 }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Form aggiungi singolo ── */}
                <div style={{ display: "flex", gap: 12, marginBottom: 24, padding: "16px", background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Codice SAP</label>
                        <input
                            className="input"
                            value={newItem.codice}
                            onChange={e => handleCodiceChange(e.target.value)}
                            placeholder="es. 2511108150/S"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ flex: "1 1 150px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Componente</label>
                        <input
                            className="input"
                            value={newItem.componente}
                            onChange={e => setNewItem(prev => ({ ...prev, componente: e.target.value }))}
                            placeholder="es. SG1"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ flex: "1 1 150px" }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Progetto</label>
                        <input
                            className="input"
                            value={newItem.progetto}
                            onChange={e => setNewItem(prev => ({ ...prev, progetto: e.target.value }))}
                            placeholder="es. DCT 300"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isAdmin} style={{ height: 42, minWidth: 160 }}>
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
                                                disabled={!isAdmin}
                                                style={{ color: !isAdmin ? "var(--text-muted)" : "var(--danger)", padding: "4px 8px" }}
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

            {/* ── Sezione Centri di Lavoro → Fasi ── */}
            <div className="card" style={{ marginBottom: 16 }}>
                <button
                    onClick={() => setWcFasiOpen(o => !o)}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}
                >
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, textAlign: "left" }}>Centri di Lavoro → Fasi</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "left" }}>Mappa i codici WC SAP alle fasi di produzione (Start Soft, End Soft, HT...)</p>
                    </div>
                    <span style={{ fontSize: 18, color: "var(--text-muted)", marginLeft: 12 }}>{wcFasiOpen ? "▲" : "▼"}</span>
                </button>

                {wcFasiOpen && (
                    <>
                        {/* Form aggiungi */}
                        <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 20, padding: 16, background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)", alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div style={{ flex: "1 1 160px" }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Centro di Lavoro</label>
                                <input
                                    className="input"
                                    value={newWc.work_center}
                                    onChange={e => setNewWc(p => ({ ...p, work_center: e.target.value }))}
                                    placeholder="es. FRW o FRW14020"
                                    style={{ width: "100%" }}
                                />
                            </div>
                            <div style={{ flex: "1 1 140px" }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Fase</label>
                                <select
                                    className="input"
                                    value={newWc.fase}
                                    onChange={e => setNewWc(p => ({ ...p, fase: e.target.value }))}
                                    style={{ width: "100%" }}
                                >
                                    {FASI.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: "1 1 140px" }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Tipo Match</label>
                                <select
                                    className="input"
                                    value={newWc.match_type}
                                    onChange={e => setNewWc(p => ({ ...p, match_type: e.target.value }))}
                                    style={{ width: "100%" }}
                                >
                                    <option value="prefix">Prefisso (inizia con...)</option>
                                    <option value="exact">Esatto (codice completo)</option>
                                </select>
                            </div>
                            <button className="btn btn-primary" onClick={handleAddWc} disabled={wcSaving || !isAdmin} style={{ height: 42, minWidth: 120 }}>
                                {wcSaving ? "..." : "Aggiungi"}
                            </button>
                        </div>

                        {/* Tabella mappature esistenti */}
                        <div className="table-container">
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-tertiary)" }}>
                                        <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Centro di Lavoro</th>
                                        <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Tipo</th>
                                        <th style={{ textAlign: "left", padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Fase</th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wcFasiLoading ? (
                                        <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</td></tr>
                                    ) : wcFasi.length === 0 ? (
                                        <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Nessuna mappatura — esegui la migration SQL prima</td></tr>
                                    ) : (
                                        wcFasi.map(wc => (
                                            <tr key={wc.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ padding: "10px 16px", fontWeight: 700, fontFamily: "monospace" }}>{wc.work_center}</td>
                                                <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                                                    {wc.match_type === "exact" ? "Esatto" : "Prefisso"}
                                                </td>
                                                <td style={{ padding: "10px 16px" }}>
                                                    <span style={{ padding: "3px 10px", borderRadius: 4, background: "var(--bg-tertiary)", fontWeight: 700, fontSize: 12, color: "var(--accent)" }}>
                                                        {FASI.find(f => f.value === wc.fase)?.label || wc.fase}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => handleDeleteWc(wc.id)}
                                                        disabled={!isAdmin}
                                                        style={{ color: !isAdmin ? "var(--text-muted)" : "var(--danger)", padding: "4px 8px" }}
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
                    </>
                )}
            </div>
        </div>
    );
}
