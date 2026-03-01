import React, { useState, useEffect } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { getCurrentWeekRange, formatItalianDate } from "../lib/dateUtils";

export default function SapDataView({ macchine = [] }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Default to current week (Monday to Sunday) as requested
    const week = getCurrentWeekRange();
    const [startDate, setStartDate] = useState(week.monday);
    const [endDate, setEndDate] = useState(week.sunday);

    const [limit, setLimit] = useState(500);
    const [totalCount, setTotalCount] = useState(0);

    const [anagrafica, setAnagrafica] = useState({});
    const [loadingAnagrafica, setLoadingAnagrafica] = useState(false);

    useEffect(() => {
        fetchSapData();
        fetchAnagrafica();
    }, [limit, startDate, endDate]);

    const fetchAnagrafica = async () => {
        setLoadingAnagrafica(true);
        const { data, error } = await supabase
            .from("anagrafica_materiali")
            .select("codice, componente, progetto");

        if (!error && data) {
            const map = {};
            data.forEach(item => {
                map[item.codice.toUpperCase()] = {
                    componente: item.componente,
                    progetto: item.progetto
                };
            });
            setAnagrafica(map);
        }
        setLoadingAnagrafica(false);
    };

    const getProjectFromCode = (code) => {
        if (!code) return null;
        const c = code.toUpperCase();
        if (c.startsWith("251")) return "DCT 300";
        if (c.startsWith("M015") || c.startsWith("M017")) return "8Fe";
        if (c.startsWith("M016")) return "DCT Eco";
        return null;
    };

    const handleDeleteFutureData = async () => {
        const today = new Date().toISOString().split('T')[0];
        if (!window.confirm(`Sei sicuro di voler eliminare TUTTI i dati con data successiva a oggi (${today})? Questa operazione non è reversibile.`)) return;

        setLoading(true);
        const { error } = await supabase
            .from("conferme_sap")
            .delete()
            .gt("data", today);

        if (error) {
            console.error("Errore cancellazione dati futuri:", error);
            alert("Errore durante la cancellazione dei dati: " + error.message);
        } else {
            alert("Dati futuri eliminati con successo.");
            fetchSapData();
        }
        setLoading(false);
    };

    const fetchSapData = async () => {
        setLoading(true);

        // Recupera il conteggio totale (senza filtri)
        const { count, error: countErr } = await supabase
            .from("conferme_sap")
            .select("*", { count: "exact", head: true });

        if (!countErr) setTotalCount(count || 0);

        // Carica tutte le righe paginate (nessun cap a 1000)
        const { data: res, error } = await fetchAllRows(() => {
            let q = supabase
                .from("conferme_sap")
                .select("*")
                .order("data", { ascending: false })
                .limit(limit);
            if (startDate) q = q.gte("data", startDate);
            if (endDate) q = q.lte("data", endDate);
            return q;
        });

        if (error) {
            console.error("Errore recupero dati SAP:", error);
        } else {
            setData(res || []);
        }
        setLoading(false);
    };

    const loadMore = () => {
        setLimit(prev => prev + 500);
    };

    const filtered = data.filter(r => {
        const m = macchine.find(m =>
            m.id === r.macchina_id ||
            (r.work_center_sap && (m.codice_sap || "").toUpperCase() === r.work_center_sap.toUpperCase())
        );
        const machineMatches = m && m.nome.toLowerCase().includes(search.toLowerCase());

        const matchesSearch = !search ||
            (r.materiale || "").toLowerCase().includes(search.toLowerCase()) ||
            (r.work_center_sap || "").toLowerCase().includes(search.toLowerCase()) ||
            machineMatches;

        const matchesDate = true; // Date filtering is now handled in the query
        return matchesSearch && matchesDate;
    });

    const getMacchinaNome = (macchinaId, workCenterSap) => {
        // 1. Cerca per ID (se presente)
        let m = macchine.find(m => m.id === macchinaId);

        // 2. Se non trovato per ID, cerca per Codice SAP
        if (!m && workCenterSap) {
            m = macchine.find(m => (m.codice_sap || "").toUpperCase() === workCenterSap.toUpperCase());
        }

        return m ? m.nome : (workCenterSap || "—");
    };

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Storico Conferme SAP</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Visualizza i dati importati dai file Excel di SAP</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            title="Rimuovi filtro date e mostra tutti i record"
                        >
                            Tutti i dati
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={fetchSapData} disabled={loading}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>
                </div>

                {/* Avviso: filtro date non trova dati ma il DB ne ha */}
                {!loading && data.length === 0 && totalCount > 0 && (
                    <div style={{ marginBottom: 16, padding: "14px 18px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                        <div>
                            <strong style={{ color: "var(--accent)" }}>ℹ️ Nessun dato nel periodo selezionato</strong><br />
                            Il DB contiene <strong>{totalCount.toLocaleString("it-IT")}</strong> record, ma nessuno ricade tra <strong>{startDate || "—"}</strong> e <strong>{endDate || "—"}</strong>.
                            I dati potrebbero avere date diverse (es. future o passate).
                        </div>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                            Mostra tutti i dati
                        </button>
                    </div>
                )}

                {data.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                        {/* Alert Date Future */}
                        {data.some(r => r.data > new Date().toISOString().split('T')[0]) && (
                            <div style={{ flex: 1, minWidth: "300px", padding: "12px 16px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                                <div>
                                    <strong style={{ color: "#EA580C" }}>⚠️ Attenzione: Date Future Rilevate</strong><br />
                                    Ci sono record con date nel futuro (es. luglio 2026). Questo di solito indica un errore di formato nel file SAP.
                                </div>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={handleDeleteFutureData}
                                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                                >
                                    {Icons.trash} Elimina Dati Futuri
                                </button>
                            </div>
                        )}
                        {/* Alert Matching Macchine */}
                        {data.some(r => !r.macchina_id) && (
                            <div style={{ flex: 1, minWidth: "300px", padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 13 }}>
                                <strong style={{ color: "var(--danger)" }}>⚠️ Macchine non collegate</strong><br />
                                I record "Non collegati" non appariranno nei Report Fine Turno. Verifica che il "Centro SAP" corrisponda all'ID macchina in Anagrafica.
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Cerca materiale o centro di lavoro..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 140 }}>
                            <input
                                type="date"
                                className="input"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>al</span>
                        <div style={{ width: 140 }}>
                            <input
                                type="date"
                                className="input"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-container" style={{ maxHeight: "calc(100vh - 350px)", overflowY: "auto" }}>
                    <table style={{ width: "100%" }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)", position: "sticky", top: 0, zIndex: 1 }}>
                                {["Data Prod.", "Centro SAP", "Macchina", "Materiale", "Qtà Ott.", "Qtà Scarto", "Turno", "Importato il"].map(h => (
                                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento in corso...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Nessun dato trovato</td></tr>
                            ) : (
                                filtered.map(r => (
                                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                        <td style={{ padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}>{formatItalianDate(r.data)}</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.work_center_sap}</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                                            {(() => {
                                                const m = macchine.find(m =>
                                                    m.id === r.macchina_id ||
                                                    (r.work_center_sap && (m.codice_sap || "").toUpperCase() === r.work_center_sap.toUpperCase())
                                                );
                                                return m ? (
                                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                                        <span style={{ color: "var(--success)", fontWeight: 600 }}>{m.nome}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text-lighter)", fontStyle: "italic" }}>Non collegata</span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                                            {(() => {
                                                const info = anagrafica[r.materiale?.toUpperCase()];
                                                const proj = info?.progetto || getProjectFromCode(r.materiale);

                                                if (info && info.componente) {
                                                    return (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                                {proj && (
                                                                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                                                        {proj}
                                                                    </span>
                                                                )}
                                                                {proj && <span style={{ opacity: 0.3 }}>•</span>}
                                                                <span style={{ padding: "2px 6px", background: "var(--bg-tertiary)", borderRadius: 4, fontWeight: 700, color: "var(--accent)", fontSize: 12 }}>
                                                                    {info.componente}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                        {proj && (
                                                            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                                                {proj}
                                                            </span>
                                                        )}
                                                        <span style={{ fontFamily: "monospace", fontSize: 12 }}>{r.materiale}</span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 700 }}>{r.qta_ottenuta?.toLocaleString("it-IT")}</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13, color: r.qta_scarto > 0 ? "var(--danger)" : "inherit" }}>{r.qta_scarto ? r.qta_scarto.toLocaleString("it-IT") : "—"}</td>
                                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                            {r.turno_id ? (
                                                <span style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{r.turno_id}</span>
                                            ) : "—"}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-muted)" }}>
                                            {r.data_import ? new Date(r.data_import).toLocaleString("it-IT") : "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        Mostrando <strong>{filtered.length}</strong> record {search ? "(filtrati)" : ""} di <strong>{data.length}</strong> caricati (su <strong>{totalCount.toLocaleString("it-IT")}</strong> totali nel DB).
                    </div>
                    {data.length < totalCount && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={loadMore}
                            disabled={loading}
                            style={{ display: "flex", alignItems: "center", gap: 8 }}
                        >
                            {loading ? "Caricamento..." : <>{Icons.plus} Carica Altri 500</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
