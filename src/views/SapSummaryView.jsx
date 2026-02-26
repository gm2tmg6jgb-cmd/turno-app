import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { getCurrentWeekRange } from "../lib/dateUtils";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid
} from 'recharts';

function KpiCard({ label, value, sub, color, icon }) {
    return (
        <div style={{
            flex: 1, minWidth: 160,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 6
        }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {icon} {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: color || "var(--text-primary)", lineHeight: 1 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
        </div>
    );
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
            {payload.map(p => (
                <div key={p.dataKey} style={{ color: p.color }}>
                    {p.name}: <strong>{p.value?.toLocaleString("it-IT")}</strong>
                </div>
            ))}
        </div>
    );
}

export default function SapSummaryView({ macchine = [] }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anagrafica, setAnagrafica] = useState({});

    const week = getCurrentWeekRange();
    const [startDate, setStartDate] = useState(week.monday);
    const [endDate, setEndDate] = useState(week.sunday);

    useEffect(() => {
        fetchData();
        fetchAnagrafica();
    }, [startDate, endDate]);

    const fetchData = async () => {
        setLoading(true);
        let query = supabase
            .from("conferme_sap")
            .select("*")
            .order("data", { ascending: true });

        if (startDate) query = query.gte("data", startDate);
        if (endDate) query = query.lte("data", endDate);

        const { data: res, error } = await query;
        if (error) console.error("Errore recupero dati:", error);
        else setData(res || []);
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
        if (c.startsWith("M015") || c.startsWith("M017")) return "8Fe";
        if (c.startsWith("M016")) return "DCT Eco";
        return null;
    };

    /* ── KPI ── */
    const kpi = useMemo(() => {
        const totalBuoni = data.reduce((s, r) => s + (r.qta_ottenuta || 0), 0);
        const totalScarti = data.reduce((s, r) => s + (r.qta_scarto || 0), 0);
        const scrapPct = totalBuoni + totalScarti > 0
            ? (totalScarti / (totalBuoni + totalScarti) * 100).toFixed(1)
            : "0.0";
        const macchineAttive = new Set(
            data.map(r => r.macchina_id || r.work_center_sap).filter(Boolean)
        ).size;
        return { totalBuoni, totalScarti, scrapPct, macchineAttive, totalRecords: data.length };
    }, [data]);

    /* ── Trend giornaliero ── */
    const trendData = useMemo(() => {
        const byDate = {};
        data.forEach(r => {
            if (!r.data) return;
            if (!byDate[r.data]) byDate[r.data] = { label: r.data.slice(5).replace("-", "/"), buoni: 0, scarti: 0 };
            byDate[r.data].buoni += r.qta_ottenuta || 0;
            byDate[r.data].scarti += r.qta_scarto || 0;
        });
        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => v);
    }, [data]);

    /* ── Confronto turni ── */
    const turniData = useMemo(() => {
        const byTurno = {};
        data.forEach(r => {
            const t = r.turno_id || "?";
            if (!byTurno[t]) byTurno[t] = { turno: t, buoni: 0, scarti: 0 };
            byTurno[t].buoni += r.qta_ottenuta || 0;
            byTurno[t].scarti += r.qta_scarto || 0;
        });
        return Object.values(byTurno).sort((a, b) => a.turno.localeCompare(b.turno));
    }, [data]);

    /* ── Tabella aggregata per macchina (logica originale) ── */
    const aggregatedData = useMemo(() => {
        const groups = {};

        data.forEach(r => {
            const m = macchine.find(m =>
                m.id === r.macchina_id ||
                (r.work_center_sap && (m.codice_sap || "").toUpperCase() === r.work_center_sap.toUpperCase())
            );

            const machineKey = m ? m.id : (r.work_center_sap || "NON_COLLEGATA");
            const machineName = m ? m.nome : (r.work_center_sap || "Non collegata");
            const sapCode = m ? m.codice_sap : r.work_center_sap;

            if (!groups[machineKey]) {
                groups[machineKey] = { id: machineKey, nome: machineName, codiceSap: sapCode, materiali: {} };
            }

            const matCode = r.materiale || "Senza Materiale";
            const info = anagrafica[matCode.toUpperCase()];
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
                    qtaOttenuta: 0, qtaScarto: 0, count: 0
                };
            } else {
                groups[machineKey].materiali[groupKey].materialiInclusi.add(matCode);
            }

            groups[machineKey].materiali[groupKey].qtaOttenuta += (r.qta_ottenuta || 0);
            groups[machineKey].materiali[groupKey].qtaScarto += (r.qta_scarto || 0);
            groups[machineKey].materiali[groupKey].count += 1;
        });

        return Object.values(groups).map(g => ({
            ...g,
            materiali: Object.values(g.materiali).map(m => ({
                ...m,
                materialiInclusi: Array.from(m.materialiInclusi)
            }))
        })).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [data, macchine, anagrafica]);

    /* ── Render ── */
    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 32 }}>

            {/* Filtri data */}
            <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Analisi Produzione SAP</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>KPI e trend produzione per il periodo selezionato</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-tertiary)", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Dal</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginLeft: 8 }}>Al</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setStartDate(""); setEndDate(""); }}
                            title="Rimuovi filtro e mostra tutti i dati"
                        >
                            Tutti i dati
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                    <div className="spinner" style={{ marginBottom: 12 }}></div>
                    Caricamento dati...
                </div>
            ) : data.length === 0 ? (
                <div className="card" style={{ padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>ℹ️ Nessun dato nel periodo selezionato</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                            {startDate || endDate
                                ? `Nessuna conferma SAP tra ${startDate || "—"} e ${endDate || "—"}. I dati potrebbero avere date diverse (es. future).`
                                : "Nessun dato disponibile nella tabella conferme_sap."}
                        </div>
                    </div>
                    {(startDate || endDate) && (
                        <button className="btn btn-primary" onClick={() => { setStartDate(""); setEndDate(""); }}>
                            Mostra tutti i dati
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* ── KPI Panel ── */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                        <KpiCard
                            label="Pezzi Buoni"
                            value={kpi.totalBuoni.toLocaleString("it-IT")}
                            sub={`su ${(kpi.totalBuoni + kpi.totalScarti).toLocaleString("it-IT")} prodotti`}
                            color="var(--success)"
                            icon="✅"
                        />
                        <KpiCard
                            label="Scarti Totali"
                            value={kpi.totalScarti.toLocaleString("it-IT")}
                            sub={`${kpi.scrapPct}% del totale prodotto`}
                            color={parseFloat(kpi.scrapPct) > 5 ? "var(--danger)" : "var(--text-muted)"}
                            icon="⚠️"
                        />
                        <KpiCard
                            label="% Scarto"
                            value={`${kpi.scrapPct}%`}
                            sub={parseFloat(kpi.scrapPct) > 5 ? "Soglia 5% superata" : "Entro soglia"}
                            color={parseFloat(kpi.scrapPct) > 5 ? "var(--danger)" : "var(--success)"}
                            icon="📊"
                        />
                        <KpiCard
                            label="Macchine Attive"
                            value={kpi.macchineAttive}
                            sub={`${kpi.totalRecords} conferme importate`}
                            color="var(--accent)"
                            icon="⚙️"
                        />
                    </div>

                    {/* ── Grafici ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

                        {/* Trend giornaliero */}
                        <div className="card">
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text-primary)" }}>
                                Trend Produzione Giornaliero
                            </div>
                            {trendData.length <= 1 ? (
                                <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                                    Seleziona un intervallo di più giorni per vedere il trend
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradBuoni" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gradScarti" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={50} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area type="monotone" dataKey="buoni" name="Pezzi Buoni" stroke="#10B981" fill="url(#gradBuoni)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="scarti" name="Scarti" stroke="#EF4444" fill="url(#gradScarti)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Confronto turni */}
                        <div className="card">
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text-primary)" }}>
                                Produzione per Turno
                            </div>
                            {turniData.length === 0 || (turniData.length === 1 && turniData[0].turno === "?") ? (
                                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
                                    Nessun dato turno nelle conferme importate
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={turniData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                        <XAxis dataKey="turno" tick={{ fontSize: 13, fontWeight: 700, fill: "var(--text-primary)" }} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={50} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="buoni" name="Pezzi Buoni" radius={[4, 4, 0, 0]}
                                            fill="#10B981"
                                            label={{ position: "top", fontSize: 11, fill: "var(--text-muted)", formatter: v => v > 0 ? v.toLocaleString("it-IT") : "" }}
                                        />
                                        <Bar dataKey="scarti" name="Scarti" radius={[4, 4, 0, 0]} fill="#EF4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* ── Tabella aggregata per macchina ── */}
                    <div className="card">
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text-primary)" }}>
                            Dettaglio per Macchina e Componente
                        </div>
                        <div className="table-container">
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-tertiary)" }}>
                                        <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Macchina / Componente</th>
                                        <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Pezzi Buoni</th>
                                        <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Scarti</th>
                                        <th style={{ textAlign: "right", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>% Scarto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aggregatedData.map(group => {
                                        const materiali = Object.values(group.materiali).sort((a, b) => b.qtaOttenuta - a.qtaOttenuta);
                                        const machineTotalOk = materiali.reduce((acc, m) => acc + m.qtaOttenuta, 0);
                                        const machineTotalScrap = materiali.reduce((acc, m) => acc + m.qtaScarto, 0);
                                        const scrapRate = machineTotalOk + machineTotalScrap > 0
                                            ? (machineTotalScrap / (machineTotalOk + machineTotalScrap) * 100).toFixed(1) : 0;

                                        return (
                                            <React.Fragment key={group.id}>
                                                <tr style={{ background: "rgba(99,102,241,0.05)", borderBottom: "1px solid var(--border)" }}>
                                                    <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{group.nome}</td>
                                                    <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 800, fontSize: 14, color: "var(--success)" }}>{machineTotalOk.toLocaleString("it-IT")}</td>
                                                    <td style={{ textAlign: "right", padding: "12px 12px", fontWeight: 700, fontSize: 13, color: "var(--danger)" }}>{machineTotalScrap > 0 ? machineTotalScrap.toLocaleString("it-IT") : "—"}</td>
                                                    <td style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: scrapRate > 5 ? "var(--danger)" : "var(--text-secondary)" }}>
                                                        {scrapRate > 0 ? `${scrapRate}%` : "0%"}
                                                    </td>
                                                </tr>
                                                {materiali.map(m => {
                                                    const mScrapRate = m.qtaOttenuta + m.qtaScarto > 0
                                                        ? (m.qtaScarto / (m.qtaOttenuta + m.qtaScarto) * 100).toFixed(1) : 0;
                                                    return (
                                                        <tr key={`${m.progetto}-${m.nome}`} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "8px 12px 8px 40px", fontSize: 13 }}>
                                                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                                    {m.progetto ? (
                                                                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>{m.progetto}</span>
                                                                    ) : (
                                                                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>Senza progetto</span>
                                                                    )}
                                                                    <span style={{ opacity: 0.3 }}>•</span>
                                                                    <span style={{ padding: "2px 8px", background: "var(--bg-tertiary)", borderRadius: 4, fontWeight: 800, color: "var(--accent)", fontSize: 12 }}>
                                                                        {m.nome}
                                                                    </span>
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
                    </div>
                </>
            )}
        </div>
    );
}
