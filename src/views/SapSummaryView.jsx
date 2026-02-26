import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";

export default function SapSummaryView({ macchine = [] }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anagrafica, setAnagrafica] = useState({});
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // 30 days back by default
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1); // 1 year forward to catch the "future" dates imported by mistake
        return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        fetchData();
        fetchAnagrafica();
    }, [startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        const { data: res, error } = await supabase
            .from("conferme_sap")
            .select("*")
            .gte("data", startDate)
            .lte("data", endDate)
            .order("data", { ascending: false });

        if (error) {
            console.error("Errore recupero dati aggregati:", error);
        } else {
            setData(res || []);
        }
        setLoading(false);
    };

    const fetchAnagrafica = async () => {
        const { data: res, error } = await supabase
            .from("anagrafica_materiali")
            .select("codice, componente, progetto");

        if (!error && res) {
            const map = {};
            res.forEach(item => {
                map[item.codice.toUpperCase()] = {
                    componente: item.componente,
                    progetto: item.progetto
                };
            });
            setAnagrafica(map);
        }
    };

    const getProjectFromCode = (code) => {
        if (!code) return null;
        const c = code.toUpperCase();
        if (c.startsWith("251")) return "DCT 300";
        if (c.startsWith("M015")) return "8Fe";
        if (c.startsWith("M016")) return "DCT Eco";
        return null;
    };

    const aggregatedData = useMemo(() => {
        const groups = {};

        data.forEach(r => {
            // Matching macchina (dinamico)
            const m = macchine.find(m =>
                m.id === r.macchina_id ||
                (r.work_center_sap && (m.codice_sap || "").toUpperCase() === r.work_center_sap.toUpperCase())
            );

            const machineKey = m ? m.id : (r.work_center_sap || "NON_COLLEGATA");
            const machineName = m ? m.nome : (r.work_center_sap || "Non collegata");
            const sapCode = m ? m.codice_sap : r.work_center_sap;

            if (!groups[machineKey]) {
                groups[machineKey] = {
                    id: machineKey,
                    nome: machineName,
                    codiceSap: sapCode,
                    materiali: {}
                };
            }

            const matCode = r.materiale || "Senza Materiale";
            const info = anagrafica[matCode.toUpperCase()];

            // Definiamo una chiave di aggregazione basata su Progetto + Componente se presenti, 
            // altrimenti usiamo il codice SAP puro.
            let groupKey = matCode;
            let currentProj = info?.progetto || getProjectFromCode(matCode);

            if (info && info.componente) {
                const proj = currentProj || "Senza Progetto";
                groupKey = `${proj}:::${info.componente}`;
            }

            if (!groups[machineKey].materiali[groupKey]) {
                groups[machineKey].materiali[groupKey] = {
                    nome: info ? info.componente : matCode,
                    progetto: currentProj,
                    isMapped: !!info,
                    materialiInclusi: new Set([matCode]),
                    qtaOttenuta: 0,
                    qtaScarto: 0,
                    count: 0
                };
            } else {
                groups[machineKey].materiali[groupKey].materialiInclusi.add(matCode);
            }

            groups[machineKey].materiali[groupKey].qtaOttenuta += (r.qta_ottenuta || 0);
            groups[machineKey].materiali[groupKey].qtaScarto += (r.qta_scarto || 0);
            groups[machineKey].materiali[groupKey].count += 1;
        });

        // Convertiamo Set in Array prima di tornare i dati
        const final = Object.values(groups).map(g => ({
            ...g,
            materiali: Object.values(g.materiali).map(m => ({
                ...m,
                materialiInclusi: Array.from(m.materialiInclusi)
            }))
        }));

        return final.sort((a, b) => a.nome.localeCompare(b.nome));
    }, [data, macchine, anagrafica]);

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 20 }}>
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Analisi Produzione SAP</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Riepilogo produzione aggregato per macchina e materiale</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Dal</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                            />
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginLeft: 8 }}>Al</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, outline: "none" }}
                            />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        <div className="spinner" style={{ marginBottom: 12 }}></div>
                        Caricamento dati...
                    </div>
                ) : aggregatedData.length === 0 ? (
                    <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Nessun dato trovato per l'intervallo selezionato.
                    </div>
                ) : (
                    <div className="table-container">
                        <table style={{ width: "100%" }}>
                            <thead>
                                <tr style={{ background: "var(--bg-tertiary)" }}>
                                    <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Macchina / Materiale</th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Pezzi Buoni</th>
                                    <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Scarti</th>
                                    <th style={{ textAlign: "right", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>% Scarto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregatedData.map(group => {
                                    const materiali = Object.values(group.materiali).sort((a, b) => b.qtaOttenuta - a.qtaOttenuta);
                                    const machineTotalOk = materiali.reduce((acc, current) => acc + current.qtaOttenuta, 0);
                                    const machineTotalScrap = materiali.reduce((acc, current) => acc + current.qtaScarto, 0);
                                    const scrapRate = machineTotalOk + machineTotalScrap > 0 ? (machineTotalScrap / (machineTotalOk + machineTotalScrap) * 100).toFixed(1) : 0;

                                    return (
                                        <React.Fragment key={group.id}>
                                            <tr style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                                <td colSpan={1} style={{ padding: "12px 16px", fontWeight: 700, color: "var(--text-secondary)" }}>
                                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                                        <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{group.nome}</span>
                                                        {group.codiceSap && group.codiceSap !== group.id && (
                                                            <span style={{ fontSize: 10, opacity: 0.7 }}>Centro SAP: {group.codiceSap}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 800, fontSize: 14, color: "var(--success)" }}>{machineTotalOk.toLocaleString("it-IT")}</td>
                                                <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, fontSize: 13, color: "var(--danger)" }}>{machineTotalScrap > 0 ? machineTotalScrap.toLocaleString("it-IT") : "—"}</td>
                                                <td style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: scrapRate > 5 ? "var(--danger)" : "var(--text-secondary)" }}>
                                                    {scrapRate > 0 ? `${scrapRate}%` : "0%"}
                                                </td>
                                            </tr>
                                            {materiali.map(m => {
                                                const mScrapRate = m.qtaOttenuta + m.qtaScarto > 0 ? (m.qtaScarto / (m.qtaOttenuta + m.qtaScarto) * 100).toFixed(1) : 0;
                                                const rowKey = `${m.progetto || ''}-${m.nome}`;

                                                return (
                                                    <tr key={rowKey} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                        <td style={{ padding: "8px 12px 8px 40px", fontSize: 13, color: "var(--text-primary)" }}>
                                                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                                    {m.progetto ? (
                                                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                                                            {m.progetto}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>Senza progetto</span>
                                                                    )}
                                                                    <span style={{ opacity: 0.3 }}>•</span>
                                                                    <span style={{ padding: "2px 8px", background: "var(--bg-tertiary)", borderRadius: 4, fontWeight: 800, color: "var(--accent)", fontSize: 12 }}>
                                                                        {m.nome}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.8 }}>
                                                                    Codici SAP: {m.materialiInclusi.join(", ")}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: "right", padding: "8px 12px", fontSize: 13, fontWeight: 600 }}>{m.qtaOttenuta.toLocaleString("it-IT")}</td>
                                                        <td style={{ textAlign: "right", padding: "8px 12px", fontSize: 12, color: m.qtaScarto > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                                                            {m.qtaScarto > 0 ? m.qtaScarto.toLocaleString("it-IT") : "—"}
                                                        </td>
                                                        <td style={{ textAlign: "right", padding: "8px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                                                            {mScrapRate > 0 ? `${mScrapRate}%` : "—"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
