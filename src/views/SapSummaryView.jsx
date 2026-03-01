import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
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

function FermiPopup({ isOpen, onClose, date, machines, turnoId, macchineAnagrafica }) {
    const [fermi, setFermi] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && (date || machines?.length)) {
            fetchFermi();
        }
    }, [isOpen, date, machines, turnoId]);

    const fetchFermi = async () => {
        setLoading(true);
        let query = supabase
            .from("fermi_macchina")
            .select("*")
            .order("ora_inizio", { ascending: true });

        if (Array.isArray(date)) {
            query = query.gte("data", date[0]).lte("data", date[date.length - 1]);
        } else {
            query = query.eq("data", date);
        }

        if (turnoId) {
            query = query.eq("turno_id", turnoId);
        }

        if (machines && machines.length > 0) {
            // machines contains either machine IDs or SAP work center codes
            // We need to match against macchina_id in fermi_macchina
            // First, find all machine IDs that match the provided machines (which could be codes)
            const machineIds = machines.map(m => {
                const found = macchineAnagrafica.find(ma =>
                    ma.id === m || (ma.codice_sap && ma.codice_sap.toUpperCase() === m.toUpperCase())
                );
                return found ? found.id : m;
            });
            query = query.in("macchina_id", machineIds);
        }

        const { data, error } = await query;
        if (error) console.error("Errore fetchFermi:", error);
        else setFermi(data || []);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, backdropFilter: "blur(4px)"
        }} onClick={onClose}>
            <div style={{
                background: "var(--bg-card)", borderRadius: 12,
                width: "100%", maxWidth: 800, maxHeight: "90vh",
                display: "flex", flexDirection: "column",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
                border: "1px solid var(--border)"
            }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Fermi Macchina</h3>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
                            {Array.isArray(date)
                                ? `Dal ${date[0].split('-').reverse().join('/')} al ${date[date.length - 1].split('-').reverse().join('/')}`
                                : `Data: ${date.split('-').reverse().join('/')}`}
                            {turnoId && ` · Turno ${turnoId}`}
                        </p>
                    </div>
                    <button className="btn-ghost" onClick={onClose} style={{ padding: 8 }}>{Icons.x}</button>
                </div>

                <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Caricamento fermi...</div>
                    ) : fermi.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontStyle: "italic" }}>
                            Nessun fermo registrato per questa selezione.
                        </div>
                    ) : (
                        <div className="table-container">
                            <table style={{ width: "100%" }}>
                                <thead>
                                    <tr style={{ background: "var(--bg-tertiary)" }}>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase" }}>Macchina</th>
                                        <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase" }}>Motivo</th>
                                        <th style={{ textAlign: "center", padding: "10px 12px", fontSize: 11, textTransform: "uppercase" }}>Durata</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fermi.map(f => {
                                        const m = macchineAnagrafica.find(ma => ma.id === f.macchina_id);
                                        return (
                                            <tr key={f.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{m?.nome || f.macchina_id}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 13 }}>
                                                    <div style={{ fontWeight: 600 }}>{f.motivo}</div>
                                                    {f.note && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>{f.note}</div>}
                                                </td>
                                                <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>{f.durata_minuti || 0} min</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-secondary" onClick={onClose}>Chiudi</button>
                </div>
            </div>
        </div>
    );
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

    // ── Mapping Macchine per Fase (Sempre Collegate) ──
    const PHASE_MACHINE_MAPPING = {
        "DCT 300::SG1::start_soft": ["SCA11008"],
        // Aggiungi qui altri mapping se necessario
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

    // ── Popup Fermi state ──
    const [popupData, setPopupData] = useState({ isOpen: false, date: null, machines: [], turnoId: null });

    const openFermiPopup = (date, machines, turnoId = null) => {
        setPopupData({ isOpen: true, date, machines, turnoId });
    };

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
        const { data: rows, error: gErr } = await fetchAllRows(() =>
            supabase
                .from("conferme_sap")
                .select("materiale, work_center_sap, qta_ottenuta, macchina_id")
                .eq("data", gDate)
        );
        if (gErr) { console.error("Errore loadGiornaliero:", gErr); setGLoading(false); return; }

        if (rows) {
            const map = {};
            // Pre-fill with manual mappings from PHASE_MACHINE_MAPPING
            PROGETTI_GIORNALIERO.forEach(proj => {
                proj.componenti.forEach(comp => {
                    ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(stage => {
                        const mapped = PHASE_MACHINE_MAPPING[`${proj.id}::${comp}::${stage}`];
                        if (mapped) {
                            const key = `${proj.id}::${comp}`;
                            if (!map[key]) map[key] = {
                                start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                            };
                            mapped.forEach(mId => map[key].machines[stage].add(mId));
                        }
                    });
                });
            });

            let mapped = 0;
            const unmappedMateriali = new Set();
            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) {
                    unmappedMateriali.add(`${r.materiale || "?"} (WC: ${r.work_center_sap || "?"})`);
                    return;
                }
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = {
                    start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                    machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                };
                mapped++;
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) {
                    map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
                    if (r.macchina_id) map[key].machines[stage].add(r.macchina_id);
                    if (r.work_center_sap) map[key].machines[stage].add(r.work_center_sap);
                }
            });

            // Convert Sets to Arrays for easier usage
            Object.keys(map).forEach(key => {
                Object.keys(map[key].machines).forEach(stage => {
                    map[key].machines[stage] = Array.from(map[key].machines[stage]);
                });
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
        const { data: rows, error: wErr } = await fetchAllRows(() =>
            supabase
                .from("conferme_sap")
                .select("materiale, work_center_sap, qta_ottenuta, macchina_id")
                .gte("data", wWeek)
                .lte("data", sunday)
        );
        if (wErr) { console.error("Errore loadSettimanale:", wErr); setWLoading(false); return; }

        if (rows) {
            const map = {};
            // Pre-fill with manual mappings from PHASE_MACHINE_MAPPING
            PROGETTI_GIORNALIERO.forEach(proj => {
                proj.componenti.forEach(comp => {
                    ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(stage => {
                        const mapped = PHASE_MACHINE_MAPPING[`${proj.id}::${comp}::${stage}`];
                        if (mapped) {
                            const key = `${proj.id}::${comp}`;
                            if (!map[key]) map[key] = {
                                start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                            };
                            mapped.forEach(mId => map[key].machines[stage].add(mId));
                        }
                    });
                });
            });

            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) return;
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = {
                    start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                    machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                };
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) {
                    map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
                    if (r.macchina_id) map[key].machines[stage].add(r.macchina_id);
                    if (r.work_center_sap) map[key].machines[stage].add(r.work_center_sap);
                }
            });

            // Convert Sets to Arrays
            Object.keys(map).forEach(key => {
                Object.keys(map[key].machines).forEach(stage => {
                    map[key].machines[stage] = Array.from(map[key].machines[stage]);
                });
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
        const { data: rows, error: tErr } = await fetchAllRows(() =>
            supabase
                .from("conferme_sap")
                .select("materiale, work_center_sap, qta_ottenuta, macchina_id")
                .eq("data", tDate)
                .eq("turno_id", tTurnoId)
        );
        if (tErr) { console.error("Errore loadTurno:", tErr); setTLoading(false); return; }
        if (rows) {
            const map = {};
            // Pre-fill with manual mappings from PHASE_MACHINE_MAPPING
            PROGETTI_GIORNALIERO.forEach(proj => {
                proj.componenti.forEach(comp => {
                    ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(stage => {
                        const mapped = PHASE_MACHINE_MAPPING[`${proj.id}::${comp}::${stage}`];
                        if (mapped) {
                            const key = `${proj.id}::${comp}`;
                            if (!map[key]) map[key] = {
                                start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                            };
                            mapped.forEach(mId => map[key].machines[stage].add(mId));
                        }
                    });
                });
            });

            rows.forEach(r => {
                const info = anagrafica[(r.materiale || "").toUpperCase()];
                if (!info?.componente || !info?.progetto) return;
                const key = `${info.progetto}::${info.componente}`;
                if (!map[key]) map[key] = {
                    start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                    machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                };
                const stage = getStageFromWC(r.work_center_sap);
                if (stage) {
                    map[key][stage] = (map[key][stage] || 0) + (r.qta_ottenuta || 0);
                    if (r.macchina_id) map[key].machines[stage].add(r.macchina_id);
                    if (r.work_center_sap) map[key].machines[stage].add(r.work_center_sap);
                }
            });

            // Convert Sets to Arrays
            Object.keys(map).forEach(key => {
                Object.keys(map[key].machines).forEach(stage => {
                    map[key].machines[stage] = Array.from(map[key].machines[stage]);
                });
            });

            setTData(map);
        }
        setTLoading(false);
    };

    const fetchData = async () => {
        setLoading(true);
        const { data: res, error } = await fetchAllRows(() => {
            let q = supabase
                .from("conferme_sap")
                .select("*")
                .order("data", { ascending: true });
            if (startDate) q = q.gte("data", startDate);
            if (endDate) q = q.lte("data", endDate);
            return q;
        });
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
        saveTimerRef.current[key] = setTimeout(async () => {
            const { error } = await supabase
                .from("produzione_targets")
                .upsert(
                    { progetto_id: progettoId, [field]: value !== "" ? parseInt(value) : null },
                    { onConflict: "progetto_id" }
                );
            if (error) console.error("Errore salvataggio target:", error);
        }, 800);
    };

    // Cleanup timer all'unmount
    useEffect(() => {
        return () => { Object.values(saveTimerRef.current).forEach(clearTimeout); };
    }, []);

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
    const thStyle = { padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", borderRight: "1px solid var(--border-light)" };

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
                            {/* Diagnostica materiali nascosta su richiesta utente */}
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
                                        background: target > 0 ? (totale >= target ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)") : "var(--bg-tertiary)",
                                        borderRight: "2px solid var(--border)",
                                        fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                        color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                        userSelect: "none",
                                        minWidth: 46, flexShrink: 0,
                                        transition: "all 0.3s ease",
                                    }}>
                                        {proj.nome}
                                    </div>

                                    {/* Tabella */}
                                    <div style={{ flex: 1, overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                {/* Riga Daily Target + Days */}
                                                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                    <td colSpan={7} style={{ padding: "8px 16px" }}>
                                                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Daily Target</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={gTargets[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setGTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "daily_target", v); }}
                                                                    placeholder="0"
                                                                    style={{
                                                                        width: 90, padding: "4px 10px",
                                                                        background: "var(--bg-tertiary)",
                                                                        border: target > 0 ? (totale >= target ? "2px solid var(--success)" : "2px solid var(--danger)") : "1px solid var(--border)",
                                                                        borderRadius: 6,
                                                                        color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                                                        fontSize: 15, fontWeight: 700, textAlign: "right",
                                                                        outline: "none"
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Riga data */}
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <td colSpan={7} style={{ textAlign: "center", padding: "7px 12px", background: "rgba(99,102,241,0.07)", fontWeight: 800, fontSize: 15, color: "var(--accent)", letterSpacing: 2 }}>
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
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proj.componenti.map((componente, idx) => {
                                                    const isBap = componente === "BAP";
                                                    const isGear = componente === "GEAR";
                                                    const isShafts = componente === "SHAFTS";
                                                    const isSummaryRow = isBap || isGear || isShafts;

                                                    let row = gData[`${proj.id}::${componente}`] || {};
                                                    const days = parseInt(gDays[proj.id] || 1);

                                                    // Logica di aggregazione per righe di riepilogo
                                                    if (isSummaryRow) {
                                                        const calculatedRow = {
                                                            start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                                            machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                                                        };
                                                        let children = [];

                                                        if (isBap) {
                                                            children = proj.componenti.filter(c => !["BAP", "GEAR", "SHAFTS"].includes(c));
                                                        } else if (isGear) {
                                                            children = proj.componenti.filter(c =>
                                                                !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                (c.startsWith("SG") || c.startsWith("DG") || c.startsWith("RG") || c.startsWith("SGR") || c === "Pinion" || c.startsWith("Fix"))
                                                            );
                                                        } else if (isShafts) {
                                                            children = proj.componenti.filter(c =>
                                                                !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                (c.startsWith("IS") || c.startsWith("OS"))
                                                            );
                                                        }

                                                        children.forEach(c => {
                                                            const cData = gData[`${proj.id}::${c}`] || {};
                                                            ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                                calculatedRow[f] += (cData[f] || 0);
                                                                if (cData.machines?.[f]) {
                                                                    cData.machines[f].forEach(m => calculatedRow.machines[f].add(m));
                                                                }
                                                            });
                                                        });

                                                        // Convert Sets to Arrays for render
                                                        ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                            calculatedRow.machines[f] = Array.from(calculatedRow.machines[f]);
                                                        });
                                                        row = calculatedRow;
                                                    }

                                                    const isEven = idx % 2 === 0;
                                                    const rowBg = isSummaryRow ? "rgba(99, 102, 241, 0.15)" : (isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)");

                                                    return (
                                                        <tr key={componente} style={{ background: rowBg, borderBottom: isSummaryRow ? "2px solid var(--accent)" : "1px solid var(--border-light)", fontWeight: isSummaryRow ? 800 : 400 }}>
                                                            <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: isSummaryRow ? "var(--accent)" : "inherit", borderRight: "1px solid var(--border-light)" }}>
                                                                {componente}
                                                            </td>
                                                            {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                                const value = row[field];
                                                                const machineList = row.machines?.[field] || [];

                                                                return (
                                                                    <td
                                                                        key={field}
                                                                        style={{
                                                                            padding: "7px 12px",
                                                                            textAlign: "center",
                                                                            fontSize: 13,
                                                                            fontWeight: value > 0 ? 700 : (machineList.length > 0 ? 600 : 400),
                                                                            color: value > 0 ? (isSummaryRow ? "var(--accent)" : "#D97706") : (machineList.length > 0 ? "var(--accent)" : "var(--text-secondary)"),
                                                                            borderRight: "1px solid var(--border-light)",
                                                                            cursor: (value > 0 || machineList.length > 0) ? "pointer" : "default"
                                                                        }}
                                                                        onClick={() => (value > 0 || machineList.length > 0) && openFermiPopup(gDate, machineList)}
                                                                        title={(value > 0 || machineList.length > 0) ? "Clicca per vedere i fermi macchina" : ""}
                                                                    >
                                                                        {value > 0 ? value.toLocaleString("it-IT") : (machineList.length > 0 ? "0" : "—")}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}

                                            </tbody>
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
                                        padding: "24px 10px",
                                        background: target > 0 ? (totale >= target ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)") : "var(--bg-tertiary)",
                                        borderRight: "2px solid var(--border)",
                                        fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                        color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                        userSelect: "none",
                                        minWidth: 46, flexShrink: 0,
                                        transition: "all 0.3s ease",
                                    }}>
                                        {proj.nome}
                                    </div>

                                    <div style={{ flex: 1, overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                {/* Riga Weekly Target */}
                                                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                    <td colSpan={7} style={{ padding: "8px 16px" }}>
                                                        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Weekly Target</span>
                                                                <input
                                                                    type="number" min="0"
                                                                    value={wTargets[proj.id] || ""}
                                                                    onChange={e => { const v = e.target.value; setWTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "weekly_target", v); }}
                                                                    placeholder="0"
                                                                    style={{
                                                                        width: 90, padding: "4px 10px",
                                                                        background: "var(--bg-tertiary)",
                                                                        border: target > 0 ? (totale >= target ? "2px solid var(--success)" : "2px solid var(--danger)") : "1px solid var(--border)",
                                                                        borderRadius: 6,
                                                                        color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                                                        fontSize: 15, fontWeight: 700, textAlign: "right",
                                                                        outline: "none"
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
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
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {proj.componenti.map((componente, idx) => {
                                                    const isBap = componente === "BAP";
                                                    const isGear = componente === "GEAR";
                                                    const isShafts = componente === "SHAFTS";
                                                    const isSummaryRow = isBap || isGear || isShafts;

                                                    let row = wData[`${proj.id}::${componente}`] || {};
                                                    const days = parseInt(gDays[proj.id] || 6); // Default 6 for weekly

                                                    // Logica di aggregazione per righe di riepilogo
                                                    if (isSummaryRow) {
                                                        const calculatedRow = {
                                                            start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                                            machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                                                        };
                                                        let children = [];

                                                        if (isBap) {
                                                            children = proj.componenti.filter(c => !["BAP", "GEAR", "SHAFTS"].includes(c));
                                                        } else if (isGear) {
                                                            children = proj.componenti.filter(c =>
                                                                !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                (c.startsWith("SG") || c.startsWith("DG") || c.startsWith("RG") || c.startsWith("SGR") || c === "Pinion" || c.startsWith("Fix"))
                                                            );
                                                        } else if (isShafts) {
                                                            children = proj.componenti.filter(c =>
                                                                !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                (c.startsWith("IS") || c.startsWith("OS"))
                                                            );
                                                        }

                                                        children.forEach(c => {
                                                            const cData = wData[`${proj.id}::${c}`] || {};
                                                            ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                                calculatedRow[f] += (cData[f] || 0);
                                                                if (cData.machines?.[f]) {
                                                                    cData.machines[f].forEach(m => calculatedRow.machines[f].add(m));
                                                                }
                                                            });
                                                        });

                                                        // Convert Sets to Arrays for render
                                                        ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                            calculatedRow.machines[f] = Array.from(calculatedRow.machines[f]);
                                                        });
                                                        row = calculatedRow;
                                                    }

                                                    const isEven = idx % 2 === 0;
                                                    const rowBg = isSummaryRow ? "rgba(99, 102, 241, 0.15)" : (isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)");

                                                    return (
                                                        <tr key={componente} style={{ background: rowBg, borderBottom: isSummaryRow ? "2px solid var(--accent)" : "1px solid var(--border-light)", fontWeight: isSummaryRow ? 800 : 400 }}>
                                                            <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: isSummaryRow ? "var(--accent)" : "inherit", borderRight: "1px solid var(--border-light)" }}>
                                                                {componente}
                                                            </td>
                                                            {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                                const value = row[field];
                                                                const machineList = row.machines?.[field] || [];

                                                                return (
                                                                    <td
                                                                        key={field}
                                                                        style={{
                                                                            padding: "7px 12px",
                                                                            textAlign: "center",
                                                                            fontSize: 13,
                                                                            fontWeight: value > 0 ? 700 : (machineList.length > 0 ? 600 : 400),
                                                                            color: value > 0 ? (isSummaryRow ? "var(--accent)" : "#D97706") : (machineList.length > 0 ? "var(--accent)" : "var(--text-secondary)"),
                                                                            borderRight: "1px solid var(--border-light)",
                                                                            cursor: (value > 0 || machineList.length > 0) ? "pointer" : "default"
                                                                        }}
                                                                        onClick={() => (value > 0 || machineList.length > 0) && openFermiPopup(getWeekDays(wWeek), machineList)}
                                                                        title={(value > 0 || machineList.length > 0) ? "Clicca per vedere i fermi macchina" : ""}
                                                                    >
                                                                        {value > 0 ? value.toLocaleString("it-IT") : (machineList.length > 0 ? "0" : "—")}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}

                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )
            }

            {/* ══════════════════════════════════════
                TAB TURNO
            ══════════════════════════════════════ */}
            {
                activeTab === "turno" && (
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
                                    {["A", "B", "C", "D"].map(t => {
                                        const isActive = tTurnoId === t;
                                        return (
                                            <button
                                                key={t}
                                                className={isActive ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                                                onClick={() => setTTurnoId(t)}
                                                style={{
                                                    minWidth: 40,
                                                    fontWeight: 700
                                                }}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
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
                                            padding: "24px 10px",
                                            background: target > 0 ? (totale >= target ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)") : "var(--bg-tertiary)",
                                            borderRight: "2px solid var(--border)",
                                            fontWeight: 900, fontSize: 16, letterSpacing: 3,
                                            color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                            userSelect: "none",
                                            minWidth: 46, flexShrink: 0,
                                        }}>
                                            {proj.nome}
                                        </div>

                                        <div style={{ flex: 1, overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead>
                                                    {/* Riga Shift Target */}
                                                    <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                                                        <td colSpan={7} style={{ padding: "8px 16px" }}>
                                                            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Shift Target</span>
                                                                    <input
                                                                        type="number" min="0"
                                                                        value={tTargets[proj.id] || ""}
                                                                        onChange={e => { const v = e.target.value; setTTargets(prev => ({ ...prev, [proj.id]: v })); saveTargetDebounced(proj.id, "shift_target", v); }}
                                                                        placeholder="0"
                                                                        style={{
                                                                            width: 90, padding: "4px 10px",
                                                                            background: "var(--bg-tertiary)",
                                                                            border: target > 0 ? (totale >= target ? "2px solid var(--success)" : "2px solid var(--danger)") : "1px solid var(--border)",
                                                                            borderRadius: 6,
                                                                            color: target > 0 ? (totale >= target ? "var(--success)" : "var(--danger)") : "var(--text-primary)",
                                                                            fontSize: 15, fontWeight: 700, textAlign: "right",
                                                                            outline: "none"
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <td colSpan={7} style={{ textAlign: "center", padding: "7px 12px", background: "rgba(99,102,241,0.07)", fontWeight: 800, fontSize: 15, color: "var(--accent)", letterSpacing: 2 }}>
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
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {proj.componenti.map((componente, idx) => {
                                                        const isBap = componente === "BAP";
                                                        const isGear = componente === "GEAR";
                                                        const isShafts = componente === "SHAFTS";
                                                        const isSummaryRow = isBap || isGear || isShafts;

                                                        let row = tData[`${proj.id}::${componente}`] || {};

                                                        // Logica di aggregazione per righe di riepilogo
                                                        if (isSummaryRow) {
                                                            const calculatedRow = {
                                                                start_soft: 0, end_soft: 0, ht: 0, start_hard: 0, end_hard: 0, washing: 0,
                                                                machines: { start_soft: new Set(), end_soft: new Set(), ht: new Set(), start_hard: new Set(), end_hard: new Set(), washing: new Set() }
                                                            };
                                                            let children = [];

                                                            if (isBap) {
                                                                children = proj.componenti.filter(c => !["BAP", "GEAR", "SHAFTS"].includes(c));
                                                            } else if (isGear) {
                                                                children = proj.componenti.filter(c =>
                                                                    !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                    (c.startsWith("SG") || c.startsWith("DG") || c.startsWith("RG") || c.startsWith("SGR") || c === "Pinion" || c.startsWith("Fix"))
                                                                );
                                                            } else if (isShafts) {
                                                                children = proj.componenti.filter(c =>
                                                                    !["BAP", "GEAR", "SHAFTS"].includes(c) &&
                                                                    (c.startsWith("IS") || c.startsWith("OS"))
                                                                );
                                                            }

                                                            children.forEach(c => {
                                                                const cData = tData[`${proj.id}::${c}`] || {};
                                                                ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                                    calculatedRow[f] += (cData[f] || 0);
                                                                    if (cData.machines?.[f]) {
                                                                        cData.machines[f].forEach(m => calculatedRow.machines[f].add(m));
                                                                    }
                                                                });
                                                            });

                                                            // Convert Sets to Arrays for render
                                                            ["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].forEach(f => {
                                                                calculatedRow.machines[f] = Array.from(calculatedRow.machines[f]);
                                                            });
                                                            row = calculatedRow;
                                                        }

                                                        const isEven = idx % 2 === 0;
                                                        const rowBg = isSummaryRow ? "rgba(99, 102, 241, 0.15)" : (isEven ? "var(--bg-card)" : "rgba(0,0,0,0.015)");

                                                        return (
                                                            <tr key={componente} style={{ background: rowBg, borderBottom: isSummaryRow ? "2px solid var(--accent)" : "1px solid var(--border-light)", fontWeight: isSummaryRow ? 800 : 400 }}>
                                                                <td style={{ padding: "7px 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: isSummaryRow ? "var(--accent)" : "inherit", borderRight: "1px solid var(--border-light)" }}>
                                                                    {componente}
                                                                </td>
                                                                {["start_soft", "end_soft", "ht", "start_hard", "end_hard", "washing"].map(field => {
                                                                    const value = row[field];
                                                                    const machineList = row.machines?.[field] || [];

                                                                    return (
                                                                        <td
                                                                            key={field}
                                                                            style={{
                                                                                padding: "7px 12px",
                                                                                textAlign: "center",
                                                                                fontSize: 13,
                                                                                fontWeight: value > 0 ? 700 : (machineList.length > 0 ? 600 : 400),
                                                                                color: value > 0 ? (isSummaryRow ? "var(--accent)" : "#D97706") : (machineList.length > 0 ? "var(--accent)" : "var(--text-secondary)"),
                                                                                borderRight: "1px solid var(--border-light)",
                                                                                cursor: (value > 0 || machineList.length > 0) ? "pointer" : "default"
                                                                            }}
                                                                            onClick={() => (value > 0 || machineList.length > 0) && openFermiPopup(tDate, machineList, tTurnoId)}
                                                                            title={(value > 0 || machineList.length > 0) ? "Clicca per vedere i fermi macchina" : ""}
                                                                        >
                                                                            {value > 0 ? value.toLocaleString("it-IT") : (machineList.length > 0 ? "0" : "—")}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        );
                                                    })}

                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )
            }

            <FermiPopup
                isOpen={popupData.isOpen}
                onClose={() => setPopupData({ ...popupData, isOpen: false })}
                date={popupData.date}
                machines={popupData.machines}
                turnoId={popupData.turnoId}
                macchineAnagrafica={macchine}
            />
        </div >
    );
}
