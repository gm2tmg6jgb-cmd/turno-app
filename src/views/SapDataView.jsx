import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

export default function SapDataView({ macchine = [] }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    useEffect(() => {
        fetchSapData();
    }, []);

    const fetchSapData = async () => {
        setLoading(true);
        const { data: res, error } = await supabase
            .from("conferme_sap")
            .select("*")
            .order("data", { ascending: false })
            .limit(500);

        if (error) {
            console.error("Errore recupero dati SAP:", error);
        } else {
            setData(res || []);
        }
        setLoading(false);
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

        const matchesDate = !dateFilter || r.data === dateFilter;
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
                        <button className="btn btn-secondary btn-sm" onClick={fetchSapData} disabled={loading}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>
                </div>

                {data.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                        {/* Alert Date Future */}
                        {data.some(r => r.data > new Date().toISOString().split('T')[0]) && (
                            <div style={{ flex: 1, minWidth: "300px", padding: "10px 14px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, fontSize: 13 }}>
                                <strong style={{ color: "#EA580C" }}>⚠️ Attenzione: Date Future</strong><br />
                                Alcuni dati importati hanno date nel futuro (es. luglio 2026). Controlla se il formato data nel file SAP era corretto (Giorno.Mese o Mese.Giorno).
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
                    <div style={{ width: 160 }}>
                        <input
                            type="date"
                            className="input"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                        />
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
                                        <td style={{ padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}>{r.data}</td>
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
                                                        {m.codice_sap && m.codice_sap.toUpperCase() !== m.nome.toUpperCase() && (
                                                            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>SAP: {m.codice_sap}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: "var(--text-lighter)", fontStyle: "italic" }}>Non collegata</span>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{r.materiale}</td>
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
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
                    Mostrando {filtered.length} di {data.length} record caricati.
                </div>
            </div>
        </div>
    );
}
