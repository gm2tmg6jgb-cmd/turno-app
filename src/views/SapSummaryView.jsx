import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import { getCurrentWeekRange, getLocalDate } from "../lib/dateUtils";
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

// getStageFromWC è ora dinamico — caricato da wc_fasi_mapping in Supabase

function getWeekDays(mondayStr) {
    const days = [];
    const base = new Date(mondayStr + "T12:00:00");
    for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        days.push(d.toISOString().split("T")[0]);
    }
    return days;
}

export default function SapSummaryView({ macchine = [] }) {
    const [activeTab, setActiveTab] = useState("turno");

    // ── Riepilogo state ──
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [anagrafica, setAnagrafica] = useState({});
    const [wcFasiMapping, setWcFasiMapping] = useState([]); // [{ work_center, fase, match_type }]

    const week = getCurrentWeekRange();
    const [startDate, setStartDate] = useState(week.monday);
    const [endDate, setEndDate] = useState(week.sunday);

    useEffect(() => {
        fetchData();
        fetchAnagrafica();
        fetchWcFasi();
        fetchTargets();
    }, [startDate, endDate]);

    // Resolver dinamico: usa le righe di wc_fasi_mapping caricate da DB
    const getStageFromWC = (wc) => {
        if (!wc || wcFasiMapping.length === 0) return null;
        const wcUp = wc.toUpperCase();
        for (const m of wcFasiMapping) {
            const mWc = m.work_center.toUpperCase();
            if (m.match_type === "exact" && wcUp === mWc) return m.fase;
            if (m.match_type !== "exact" && wcUp.startsWith(mWc)) return m.fase;
        }
        return null;
    };

    // ── Giornaliero state ──
    const [gDate, setGDate] = useState(getLocalDate(new Date()));
    const [gData, setGData] = useState({});
    const [gLoading, setGLoading] = useState(false);
    const [gTargets, setGTargets] = useState({});
    const [gDays, setGDays] = useState({});

    // ── Settimanale state ──
    const [wWeek, setWWeek] = useState(getCurrentWeekRange().monday);
    const [wData, setWData] = useState({});
    const [wLoading, setWLoading] = useState(false);
    const [wTargets, setWTargets] = useState({});

    // ── Turno state ──
    const [tDate, setTDate] = useState(getLocalDate(new Date()));
    const [tTurnoId, setTTurnoId] = useState("");
    const [tData, setTData] = useState({});
    const [tLoading, setTLoading] = useState(false);
    const [tTargets, setTTargets] = useState({});
    const [tAvailableTurni, setTAvailableTurni] = useState([]);

    // Debounce ref per salvataggio target
    const saveTimerRef = useRef({});

    // Progetti e componenti (hardcoded, WC mapping da aggiungere)
    const PROGETTI_GIORNALIERO = [
        {
            id: "DCT 300", nome: "DCT300",
            componenti: ["GEAR", "SG1", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "SGR", "RG", "SHAFTS", "IS1", "IS2", "OS1", "OS2", "DGFIX", "BAP"]
        },
        {
            id: "8Fe", nome: "8Fedct",
            componenti: ["GEAR", "SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGRev", "Pinion", "Fix 5/7", "RG", "SHAFTS", "IS1", "IS2", "OS1", "OS2", "BAP"]
        },
        {
            id: "DCT Eco", nome: "DCTECO",
            componenti: ["SG2", "SG3", "SG4", "SG5", "SGRW", "RG", "SHAFTS", "IS1", "IS2", "OS1", "OS2", "BAP"]
        },
    ];

    useEffect(() => {
        if (activeTab !== "giornaliero") return;
        loadGiornaliero();
    }, [gDate, activeTab, anagrafica, wcFasiMapping]);

    const [gDiag, setGDiag] = useState(null); // { total, mapped }

    const loadGiornaliero = async () => {
        setGLoading(true);
        const { data: rows } = await supabase
            .from("conferme_sap")
            .select("materiale, work_center_sap, qta_ottenuta")
            .eq("data", gDate);

        if (rows) {
            const map = {};
            let mapped = 0;
            const unmappedMateriali = new Set();
            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) {
                    unmappedMateriali.add(`${r.materiale || "?"} (WC: ${r.work_center_sap || "?"})`);
                    return;
                }
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = { start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0 };
                mapped++;
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
            });
            setGData(map);
            setGDiag({ total: rows.length, mapped, unmapped: [...unmappedMateriali] });
        }
        setGLoading(false);
    };

    const getProduzione = (row) => {
        if (!row) return null;
        const soft = Math.max(0, (row.end_soft || 0) - (row.start_soft || 0));
        const hard = Math.max(0, (row.end_hard || 0) - (row.start_hard || 0));
        return soft + hard || null;
    };

    useEffect(() => {
        if (activeTab !== "settimanale") return;
        loadSettimanale();
    }, [wWeek, activeTab, anagrafica, wcFasiMapping]);

    useEffect(() => {
        if (activeTab !== "turno") return;
        fetchTAvailableTurni();
    }, [tDate, activeTab]);

    useEffect(() => {
        if (activeTab !== "turno" || !tTurnoId) return;
        loadTurno();
    }, [tDate, tTurnoId, activeTab, anagrafica, wcFasiMapping]);

    const loadSettimanale = async () => {
        setWLoading(true);
        const days = getWeekDays(wWeek);
        const sunday = days[6];
        const { data: rows } = await supabase
            .from("conferme_sap")
            .select("materiale, work_center_sap, qta_ottenuta")
            .gte("data", wWeek)
            .lte("data", sunday);

        if (rows) {
            const map = {};
            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) return;
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = { start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0 };
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
            });
            setWData(map);
        }
        setWLoading(false);
    };

    const fetchTAvailableTurni = async () => {
        const { data: rows } = await supabase
            .from("conferme_sap")
            .select("turno_id")
            .eq("data", tDate)
            .not("turno_id", "is", null);
        if (rows) {
            const unique = [...new Set(rows.map(r => r.turno_id).filter(Boolean))].sort();
            setTAvailableTurni(unique);
            setTTurnoId(cur => (!cur || !unique.includes(cur)) ? (unique[0] || "") : cur);
        }
    };

    const loadTurno = async () => {
        if (!tTurnoId) return;
        setTLoading(true);
        const { data: rows } = await supabase
            .from("conferme_sap")
            .select("materiale, work_center_sap, qta_ottenuta")
            .eq("data", tDate)
            .eq("turno_id", tTurnoId);
        if (rows) {
            const map = {};
            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) return;
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = { start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0 };
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
            });
            setTData(map);
        }
        setTLoading(false);
    };

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

    const fetchWcFasi = async () => {
        const { data: res } = await supabase.from("wc_fasi_mapping").select("*");
        if (res) setWcFasiMapping(res);
    };

    const fetchTargets = async () => {
        const { data } = await supabase.from("produzione_targets").select("*");
        if (data) {
            const gt = {}, gd = {}, wt = {}, tt = {};
            data.forEach(r => {
                if (r.daily_target != null) gt[r.progetto_id] = String(r.daily_target);
                if (r.days != null) gd[r.progetto_id] = String(r.days);
                if (r.weekly_target != null) wt[r.progetto_id] = String(r.weekly_target);
                if (r.shift_target != null) tt[r.progetto_id] = String(r.shift_target);
            });
            setGTargets(gt);
            setGDays(gd);
            setWTargets(wt);
            setTTargets(tt);
        }
    };

    const saveTargetDebounced = (progettoId, field, value) => {
        const key = `${progettoId}::${field}`;
        clearTimeout(saveTimerRef.current[key]);
        saveTimerRef.current[key] = setTimeout(() => {
            supabase
                .from("produzione_targets")
                .upsert(
                    { progetto_id: progettoId, [field]: value !== "" ? parseInt(value) : null },
                    { onConflict: "progetto_id" }
                );
        }, 800);
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
    const thStyle = { padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", paddingBottom: 32 }}>

            {/* Header con tab */}
            <div className="card" style={{ marginBottom: 16, padding: "14px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Analisi Produzione SAP</h2>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                            {activeTab === "turno" ? "Produzione per singolo turno" : activeTab === "giornaliero" ? "Produzione giornaliera per progetto e componente" : "Riepilogo settimana per progetto e componente"}
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button className={activeTab === "turno" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("turno")}>🔄 Per Turno</button>
                        <button className={activeTab === "giornaliero" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("giornaliero")}>📋 Giornaliero</button>
                        <button className={activeTab === "settimanale" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("settimanale")}>📅 Settimanale</button>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════
                TAB GIORNALIERO
            ══════════════════════════════════════ */}
            {activeTab === "giornaliero" && (
                <div>
                    {/* Selettore data */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Data</label>
                            <input type="date" value={gDate} onChange={e => setGDate(e.target.value)} className="input" style={{ width: 160 }} />
                        </div>
                        <div style={{ paddingTop: 20 }}>
                            <button className="btn btn-secondary btn-sm" onClick={loadGiornaliero} disabled={gLoading}>
                                {Icons.history} Aggiorna
                            </button>
                        </div>
                        <div style={{ marginLeft: "auto", paddingTop: 20, fontSize: 12, color: "var(--text-muted)", maxWidth: 500 }}>
                            {gDiag == null ? null : gDiag.total === 0
                                ? "⚠️ Nessuna riga in conferme_sap per questa data"
                                : <>
                                    <div style={{ color: gDiag.mapped === 0 ? "var(--danger)" : "var(--success)" }}>
                                        {gDiag.mapped === 0
                                            ? `⚠️ ${gDiag.total} righe trovate ma 0 mappate`
                                            : `✓ ${gDiag.total} righe trovate, ${gDiag.mapped} mappate`}
                                    </div>
                                    {gDiag.unmapped?.length > 0 && (
                                        <div style={{ marginTop: 4, color: "#F59E0B", fontSize: 11 }}>
                                            Non mappati: {gDiag.unmapped.slice(0, 5).join(" | ")}{gDiag.unmapped.length > 5 ? ` +${gDiag.unmapped.length - 5}` : ""}
                                        </div>
                                    )}
                                </>
                            }
                        </div>
                    </div>

                    {gLoading ? (
                        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                    ) : (
                        PROGETTI_GIORNALIERO.map(proj => {
                            const totale = proj.componenti.reduce((s, comp) => s + (getProduzione(gData[`${proj.id}::${comp}`]) || 0), 0);
                            const target = parseInt(gTargets[proj.id] || 0);
                            const pctTarget = target > 0 ? Math.round(totale / target * 100) : null;
                            const dateLabel = new Date(gDate + "T12:00:00")
                                .toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
                                .replace(/\//g, ".");

                            return (
                                <div key={proj.id} style={{ marginBottom: 32, display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>

                                    {/* Label progetto verticale */}
                                    <div style={{
                                        writingMode: "vertical-rl",
                                        transform: "rotate(180deg)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        padding: "24px 10px",
                                        background: "var(--bg-tertiary)",
                                        borderRight: "2px solid var(--border)",
                                        fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                        color: "var(--text-primary)", userSelect: "none",
                                        minWidth: 46, flexShrink: 0,
                                    }}>
                                        {proj.nome}
                                    </div>

                                    {/* Tabella */}
                                    <div style={{ flex: 1, overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                {/* Riga Daily Target + Days */}
                                                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                    <td colSpan={8} style={{ padding: "8px 16px" }}>
                                                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Daily Target</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={gTargets[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setGTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "daily_target", v); }}
                                                                    placeholder="0"
                                                                    style={{ width: 90, padding: "4px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                                                                />
                                                            </div>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Days</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={gDays[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setGDays(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "days", v); }}
                                                                    placeholder="0"
                                                                    style={{ width: 70, padding: "4px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                                                                />
                                                            </div>
                                                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                                                                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                                    Produzione: <strong style={{ fontSize: 16, color: totale > 0 ? "var(--success)" : "var(--text-muted)" }}>{totale > 0 ? totale.toLocaleString("it-IT") : "—"}</strong>
                                                                </span>
                                                                {pctTarget !== null && (
                                                                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: pctTarget >= 100 ? "var(--success)" : pctTarget >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {pctTarget}% target
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Riga data */}
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={8} style={{ textAlign: "center", padding: "7px 12px", background: "rgba(99,102,241,0.07)", fontWeight: 800, fontSize: 15, color: "var(--accent)", letterSpacing: 2 }}>
                                                        {dateLabel}
                                                    </td>
                                                </tr>

                                                {/* Intestazioni colonne */}
                                                <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                                    <th style={thStyle}>Component</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>HT</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Washing</th>
                                                    <th style={{ ...thStyle, minWidth: 180 }}>Daily Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proj.componenti.map((componente, idx) => {
                                                    const row = gData[`${proj.id}::${componente}`] || {};
                                                    const isEven = idx % 2 === 0;
                                                    return (
                                                        <tr key={componente} style={{ background: isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)", borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                                                                {componente}
                                                            </td>
                                                            {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => (
                                                                <td key={field} style={{ padding: "7px 12px", textAlign: "center", fontSize: 13, fontWeight: row[field] > 0 ? 700 : 400, color: row[field] > 0 ? "#D97706" : "var(--text-secondary)" }}>
                                                                    {row[field] > 0 ? row[field].toLocaleString("it-IT") : "—"}
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: "7px 12px", fontSize: 12, color: "var(--text-muted)" }}>—</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot style={{ background: "var(--bg-card)", borderTop: "2px solid var(--border)" }}>
                                                <tr style={{ fontWeight: 800 }}>
                                                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)" }}>TOTALE</td>
                                                    {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                        const colTotal = proj.componenti.reduce((s, comp) => s + (gData[`${proj.id}::${comp}`]?.[field] || 0), 0);
                                                        const colPct = target > 0 ? Math.round(colTotal / target * 100) : null;
                                                        return (
                                                            <td key={field} style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                <div style={{ fontSize: 14, color: (target > 0 && colTotal < target) ? "var(--danger)" : (colTotal > 0 ? "var(--success)" : "var(--text-muted)") }}>
                                                                    {colTotal > 0 ? colTotal.toLocaleString("it-IT") : "—"}
                                                                </div>
                                                                {colPct !== null && (
                                                                    <div style={{ fontSize: 10, color: colPct >= 100 ? "var(--success)" : colPct >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {colPct}%
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: "10px 12px" }}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════
                TAB SETTIMANALE
            ══════════════════════════════════════ */}
            {activeTab === "settimanale" && (
                <div>
                    {/* Navigazione settimana */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const d = new Date(wWeek + "T12:00:00");
                            d.setDate(d.getDate() - 7);
                            setWWeek(d.toISOString().split("T")[0]);
                        }}>← Prec.</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                            {new Date(wWeek + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                            {" — "}
                            {new Date(getWeekDays(wWeek)[6] + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const d = new Date(wWeek + "T12:00:00");
                            d.setDate(d.getDate() + 7);
                            setWWeek(d.toISOString().split("T")[0]);
                        }}>Succ. →</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setWWeek(getCurrentWeekRange().monday)}>Questa settimana</button>
                        <button className="btn btn-secondary btn-sm" onClick={loadSettimanale} disabled={wLoading} style={{ marginLeft: "auto" }}>
                            {Icons.history} Aggiorna
                        </button>
                    </div>

                    {wLoading ? (
                        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                    ) : (
                        PROGETTI_GIORNALIERO.map(proj => {
                            const weekDays = getWeekDays(wWeek);
                            const totale = proj.componenti.reduce((s, comp) => s + (getProduzione(wData[`${proj.id}::${comp}`]) || 0), 0);
                            const target = parseInt(wTargets[proj.id] || 0);
                            const pctTarget = target > 0 ? Math.round(totale / target * 100) : null;
                            const weekLabel = `${new Date(wWeek + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} — ${new Date(weekDays[6] + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
                            return (
                                <div key={proj.id} style={{ marginBottom: 32, display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>

                                    {/* Label progetto verticale */}
                                    <div style={{
                                        writingMode: "vertical-rl", transform: "rotate(180deg)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        padding: "24px 10px", background: "var(--bg-tertiary)",
                                        borderRight: "2px solid var(--border)",
                                        fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                        color: "var(--text-primary)", userSelect: "none",
                                        minWidth: 46, flexShrink: 0,
                                    }}>
                                        {proj.nome}
                                    </div>

                                    <div style={{ flex: 1, overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                {/* Riga Weekly Target */}
                                                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                    <td colSpan={8} style={{ padding: "8px 16px" }}>
                                                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Weekly Target</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={wTargets[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setWTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "weekly_target", v); }}
                                                                    placeholder="0"
                                                                    style={{ width: 90, padding: "4px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                                                                />
                                                            </div>
                                                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                                                                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                                    Produzione: <strong style={{ fontSize: 16, color: totale > 0 ? "var(--success)" : "var(--text-muted)" }}>{totale > 0 ? totale.toLocaleString("it-IT") : "—"}</strong>
                                                                </span>
                                                                {pctTarget !== null && (
                                                                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: pctTarget >= 100 ? "var(--success)" : pctTarget >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {pctTarget}% target
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Riga settimana */}
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={8} style={{ textAlign: "center", padding: "7px 12px", background: "rgba(99,102,241,0.07)", fontWeight: 800, fontSize: 15, color: "var(--accent)", letterSpacing: 2 }}>
                                                        {weekLabel}
                                                    </td>
                                                </tr>

                                                {/* Intestazioni colonne */}
                                                <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                                    <th style={thStyle}>Component</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>HT</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Washing</th>
                                                    <th style={{ ...thStyle, minWidth: 180 }}>Weekly Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proj.componenti.map((componente, idx) => {
                                                    const row = wData[`${proj.id}::${componente}`] || {};
                                                    const isEven = idx % 2 === 0;
                                                    return (
                                                        <tr key={componente} style={{ background: isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)", borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                                                                {componente}
                                                            </td>
                                                            {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => (
                                                                <td key={field} style={{ padding: "7px 12px", textAlign: "center", fontSize: 13, fontWeight: row[field] > 0 ? 700 : 400, color: row[field] > 0 ? "#D97706" : "var(--text-secondary)" }}>
                                                                    {row[field] > 0 ? row[field].toLocaleString("it-IT") : "—"}
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: "7px 12px", fontSize: 12, color: "var(--text-muted)" }}>—</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot style={{ background: "var(--bg-card)", borderTop: "2px solid var(--border)" }}>
                                                <tr style={{ fontWeight: 800 }}>
                                                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)" }}>TOTALE</td>
                                                    {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                        const colTotal = proj.componenti.reduce((s, comp) => s + (wData[`${proj.id}::${comp}`]?.[field] || 0), 0);
                                                        const colPct = target > 0 ? Math.round(colTotal / target * 100) : null;
                                                        return (
                                                            <td key={field} style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                <div style={{ fontSize: 14, color: (target > 0 && colTotal < target) ? "var(--danger)" : (colTotal > 0 ? "var(--success)" : "var(--text-muted)") }}>
                                                                    {colTotal > 0 ? colTotal.toLocaleString("it-IT") : "—"}
                                                                </div>
                                                                {colPct !== null && (
                                                                    <div style={{ fontSize: 10, color: colPct >= 100 ? "var(--success)" : colPct >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {colPct}%
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: "10px 12px" }}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════
                TAB TURNO
            ══════════════════════════════════════ */}
            {activeTab === "turno" && (
                <div>
                    {/* Selettori data + turno */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Data</label>
                            <input type="date" value={tDate} onChange={e => setTDate(e.target.value)} className="input" style={{ width: 160 }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Turno</label>
                            <div style={{ display: "flex", gap: 6 }}>
                                {tAvailableTurni.length === 0 ? (
                                    <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>Nessun turno per questa data</span>
                                ) : (
                                    tAvailableTurni.map(t => (
                                        <button
                                            key={t}
                                            className={tTurnoId === t ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                                            onClick={() => setTTurnoId(t)}
                                        >
                                            {t}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                        <div style={{ paddingTop: 20 }}>
                            <button className="btn btn-secondary btn-sm" onClick={loadTurno} disabled={tLoading || !tTurnoId}>
                                {Icons.history} Aggiorna
                            </button>
                        </div>
                    </div>

                    {tLoading ? (
                        <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
                    ) : (
                        PROGETTI_GIORNALIERO.map(proj => {
                            const totale = proj.componenti.reduce((s, comp) => s + (getProduzione(tData[`${proj.id}::${comp}`]) || 0), 0);
                            const target = parseInt(tTargets[proj.id] || 0);
                            const pctTarget = target > 0 ? Math.round(totale / target * 100) : null;
                            const dateLabel = new Date(tDate + "T12:00:00")
                                .toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
                                .replace(/\//g, ".");

                            return (
                                <div key={proj.id} style={{ marginBottom: 32, display: "flex", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                                    {/* Label progetto verticale */}
                                    <div style={{
                                        writingMode: "vertical-rl", transform: "rotate(180deg)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        padding: "24px 10px", background: "var(--bg-tertiary)",
                                        borderRight: "2px solid var(--border)",
                                        fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                        color: "var(--text-primary)", userSelect: "none",
                                        minWidth: 46, flexShrink: 0,
                                    }}>
                                        {proj.nome}
                                    </div>

                                    <div style={{ flex: 1, overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                {/* Riga Shift Target */}
                                                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                    <td colSpan={8} style={{ padding: "8px 16px" }}>
                                                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Shift Target</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={tTargets[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setTTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "shift_target", v); }}
                                                                    placeholder="0"
                                                                    style={{ width: 90, padding: "4px 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 15, fontWeight: 700, textAlign: "right" }}
                                                                />
                                                            </div>
                                                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                                                                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                                                    Produzione: <strong style={{ fontSize: 16, color: totale > 0 ? "var(--success)" : "var(--text-muted)" }}>{totale > 0 ? totale.toLocaleString("it-IT") : "—"}</strong>
                                                                </span>
                                                                {pctTarget !== null && (
                                                                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: pctTarget >= 100 ? "var(--success)" : pctTarget >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {pctTarget}% target
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={8} style={{ textAlign: "center", padding: "7px 12px", background: "rgba(99,102,241,0.07)", fontWeight: 800, fontSize: 15, color: "var(--accent)", letterSpacing: 2 }}>
                                                        {dateLabel} {tTurnoId ? `· Turno ${tTurnoId}` : "· Nessun dato turno"}
                                                    </td>
                                                </tr>
                                                {/* Intestazioni colonne */}
                                                <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                                                    <th style={thStyle}>Component</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Soft</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>HT</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Start Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>End Hard</th>
                                                    <th style={{ ...thStyle, textAlign: "center" }}>Washing</th>
                                                    <th style={{ ...thStyle, minWidth: 180 }}>Shift Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proj.componenti.map((componente, idx) => {
                                                    const row = tData[`${proj.id}::${componente}`] || {};
                                                    const isEven = idx % 2 === 0;
                                                    return (
                                                        <tr key={componente} style={{ background: isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)", borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{componente}</td>
                                                            {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => (
                                                                <td key={field} style={{ padding: "7px 12px", textAlign: "center", fontSize: 13, fontWeight: row[field] > 0 ? 700 : 400, color: row[field] > 0 ? "#D97706" : "var(--text-secondary)" }}>
                                                                    {row[field] > 0 ? row[field].toLocaleString("it-IT") : "—"}
                                                                </td>
                                                            ))}
                                                            <td style={{ padding: "7px 12px", fontSize: 12, color: "var(--text-muted)" }}>—</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot style={{ background: "var(--bg-card)", borderTop: "2px solid var(--border)" }}>
                                                <tr style={{ fontWeight: 800 }}>
                                                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)" }}>TOTALE</td>
                                                    {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                        const colTotal = proj.componenti.reduce((s, comp) => s + (tData[`${proj.id}::${comp}`]?.[field] || 0), 0);
                                                        const colPct = target > 0 ? Math.round(colTotal / target * 100) : null;
                                                        return (
                                                            <td key={field} style={{ padding: "10px 12px", textAlign: "center" }}>
                                                                <div style={{ fontSize: 14, color: (target > 0 && colTotal < target) ? "var(--danger)" : (colTotal > 0 ? "var(--success)" : "var(--text-muted)") }}>
                                                                    {colTotal > 0 ? colTotal.toLocaleString("it-IT") : "—"}
                                                                </div>
                                                                {colPct !== null && (
                                                                    <div style={{ fontSize: 10, color: colPct >= 100 ? "var(--success)" : colPct >= 80 ? "#F59E0B" : "var(--danger)" }}>
                                                                        {colPct}%
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td style={{ padding: "10px 12px" }}></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

        </div>
    );
}
