import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { formatItalianDate } from "../lib/dateUtils";

export default function SapFermiView({ macchine = [] }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const PAGE_SIZE = 100;
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);      
    const [filteredCount, setFilteredCount] = useState(0); 

    // Carica la pagina corrente ogni volta che cambiano filtri o pagina
    useEffect(() => {
        fetchSapFermi();
    }, [page, search, startDate, endDate]);

    // Fetch conteggio totale all'inizio
    useEffect(() => {
        fetchTotalCount();
    }, []);

    const handleDeleteFutureData = async () => {
        const today = new Date().toISOString().split('T')[0];
        if (!window.confirm(`Sei sicuro di voler eliminare TUTTI i fermi con data successiva a oggi (${today})? Questa operazione non è reversibile.`)) return;

        setLoading(true);
        const { error } = await supabase
            .from("fermi_sap")
            .delete()
            .gt("data_inizio", today);

        if (error) {
            console.error("Errore cancellazione dati futuri:", error);
            alert("Errore durante la cancellazione dei dati: " + error.message);
        } else {
            alert("Dati futuri eliminati con successo.");
            fetchSapFermi();
        }
        setLoading(false);
    };

    const fetchTotalCount = async () => {
        const { count } = await supabase
            .from("fermi_sap")
            .select("*", { count: "exact", head: true });
        setTotalCount(count || 0);
    };

    const applyFilters = (q) => {
        if (startDate) q = q.gte("data_inizio", startDate);
        if (endDate) q = q.lte("data_inizio", endDate);
        if (search.trim()) {
            q = q.or(`descrizione_fermo.ilike.%${search.trim()}%,work_center_sap.ilike.%${search.trim()}%,autore.ilike.%${search.trim()}%,oggetto_tecnico.ilike.%${search.trim()}%`);
        }
        return q;
    };

    const fetchSapFermi = async () => {
        setLoading(true);

        const { count: fc } = await applyFilters(
            supabase.from("fermi_sap").select("*", { count: "exact", head: true })
        );
        setFilteredCount(fc || 0);

        const { data: res, error } = await applyFilters(
            supabase.from("fermi_sap").select("*").order("data_inizio", { ascending: false })
        ).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error("Errore recupero fermi SAP:", error);
        } else {
            setData(res || []);
        }
        setLoading(false);
    };

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Storico Fermi SAP</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Visualizza i fermi macchina importati da SAP</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setPage(0); setStartDate(""); setEndDate(""); }}
                        >
                            Tutti i dati
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={fetchSapFermi} disabled={loading}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>
                </div>

                {!loading && data.length === 0 && totalCount > 0 && (
                    <div style={{ marginBottom: 16, padding: "14px 18px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                        <div>
                            <strong style={{ color: "var(--accent)" }}>ℹ️ Nessun fermo nel periodo selezionato</strong><br />
                            Il DB contiene <strong>{totalCount.toLocaleString("it-IT")}</strong> record.
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => { setPage(0); setStartDate(""); setEndDate(""); }}>
                            Mostra tutti i dati
                        </button>
                    </div>
                )}

                {data.length > 0 && data.some(r => r.data_inizio > new Date().toISOString().split('T')[0]) && (
                    <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                        <div>
                            <strong style={{ color: "#EA580C" }}>⚠️ Date Future Rilevate</strong><br />
                            Sono presenti fermi con date nel futuro.
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={handleDeleteFutureData}>
                            {Icons.trash} Elimina Dati Futuri
                        </button>
                    </div>
                )}

                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <input
                            type="text"
                            className="input"
                            placeholder="Cerca per codice, descrizione o centro..."
                            value={search}
                            onChange={e => { setPage(0); setSearch(e.target.value); }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="date" className="input" value={startDate} onChange={e => { setPage(0); setStartDate(e.target.value); }} style={{ width: 140 }} />
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>al</span>
                        <input type="date" className="input" value={endDate} onChange={e => { setPage(0); setEndDate(e.target.value); }} style={{ width: 140 }} />
                    </div>
                </div>

                <div className="table-container" style={{ maxHeight: "calc(100vh - 350px)", overflowY: "auto" }}>
                    <table style={{ width: "100%" }}>
                        <thead>
                            <tr style={{ background: "var(--bg-tertiary)", position: "sticky", top: 0, zIndex: 1 }}>
                                {["Inizio", "Fine", "Durata", "Autore", "Macchina", "Oggetto Tecnico", "Descrizione"].map(h => (
                                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Nessun dato trovato</td></tr>
                            ) : (
                                data.map(r => (
                                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                                            <div style={{ fontWeight: 600 }}>{formatItalianDate(r.data_inizio)}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.ora_inizio?.slice(0, 5)}</div>
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                                            <div style={{ fontWeight: 600 }}>{formatItalianDate(r.data_fine)}</div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.ora_fine?.slice(0, 5)}</div>
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{r.durata_minuti}m</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{r.autore || "—"}</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>
                                            {(() => {
                                                const m = macchine.find(m =>
                                                    m.id === r.macchina_id ||
                                                    (r.work_center_sap && (m.codice_sap || "").toUpperCase() === r.work_center_sap.toUpperCase())
                                                );
                                                return m ? (
                                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                                        <span style={{ color: "var(--success)", fontWeight: 600 }}>{m.nome}</span>
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.work_center_sap}</span>
                                                    </div>
                                                ) : <span style={{ color: "var(--text-lighter)" }}>{r.work_center_sap || "—"}</span>;
                                            })()}
                                        </td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{r.oggetto_tecnico || "—"}</td>
                                        <td style={{ padding: "8px 12px", fontSize: 13 }}>{r.descrizione_fermo}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        Mostrati {data.length} di {filteredCount} record
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>←</button>
                        <span style={{ alignSelf: "center", fontSize: 13 }}>{page + 1} / {Math.ceil(filteredCount / PAGE_SIZE) || 1}</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(filteredCount / PAGE_SIZE) - 1}>→</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
