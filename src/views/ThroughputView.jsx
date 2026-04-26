import { useState, useCallback, useEffect, useMemo } from "react";
import { THROUGHPUT_CONFIG, PROCESS_STEPS } from "../data/constants";
import { computeThroughput, loadThroughputConfig, saveThroughputConfig, phaseHours } from "../utils/throughput";
import { supabase } from "../lib/supabase";

export default function ThroughputView({ showToast }) {
    const [cfg, setCfg] = useState(() => loadThroughputConfig());
    // editingKey = chiave del componente in modifica (es. "DCT300::SG1"), null se nessuno
    const [editingKey, setEditingKey] = useState(null);
    const editing = editingKey !== null;
    const [draft, setDraft] = useState(null);
    const [targetModal, setTargetModal] = useState(null);
    const [targetValue, setTargetValue] = useState(450);

    const startEdit = (key) => {
        setEditingKey(key);
        setDraft({
            lotto: cfg.lotto,
            oeePercent: Math.round(cfg.oee * 100),
            rackSize: cfg.rackSize ?? 72,
            phases: (cfg.components[key] || []).map(p => ({
                ...p,
                changeOverH: p.noChangeOver ? 0 : (p.changeOverH ?? cfg.changeOverH)
            }))
        });
    };

    const saveEdit = useCallback(() => {
        const newCfg = {
            ...cfg,
            lotto: Number(draft.lotto),
            oee: Number(draft.oeePercent) / 100,
            rackSize: Number(draft.rackSize),
            changeOverH: Number(draft.changeOverH),
            components: {
                ...cfg.components,  // preserva TUTTI i componenti
                [editingKey]: draft.phases.map(p => ({
                    ...p,
                    pzH: p.fixedH != null ? null : Number(p.pzH),
                    fixedH: p.fixedH != null ? Number(p.fixedH) : null,
                    changeOverH: p.noChangeOver ? undefined : Number(p.changeOverH),
                    sapMat: p.sapMat || undefined,
                    sapOp: p.sapOp || undefined,
                    macchina_id: p.macchina_id || undefined,
                    chargeSize: p.chargeSize ? Number(p.chargeSize) : null
                }))
            }
        };
        saveThroughputConfig(newCfg);
        setCfg(newCfg);
        setEditingKey(null);
        setDraft(null);
        showToast?.("Parametri salvati", "success");
    }, [draft, cfg, editingKey, showToast]);

    const cancelEdit = () => {
        setEditingKey(null);
        setDraft(null);
    };

    const resetDefaults = () => {
        localStorage.removeItem("throughput_config");
        setCfg(THROUGHPUT_CONFIG);
        setEditingKey(null);
        setDraft(null);
        showToast?.("Parametri ripristinati ai valori di default", "info");
    };

    const entries = useMemo(() => Object.entries(cfg.components), [cfg.components]);

    // --- Target giornaliero (stesso di ComponentFlowView) ---
    const dailyTarget = (() => {
        try {
            const saved = localStorage.getItem("bap_target_overrides");
            return (saved ? JSON.parse(saved) : { "DCT300": 450 })["DCT300"] || 450;
        } catch { return 450; }
    })();

    // --- Sync SAP ---
    // phaseData: phaseId → { totQty, firstDate, lottoNum, progress }
    const [phaseData, setPhaseData] = useState({});
    const [phaseDataRaw, setPhaseDataRaw] = useState({});
    const [sapLoading, setSapLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(0);
    const [selectedPhaseDebug, setSelectedPhaseDebug] = useState(null);
    const [sapConfigModal, setSapConfigModal] = useState(false);
    const [sapConfigDraft, setSapConfigDraft] = useState(null);
    const [debugSapModal, setDebugSapModal] = useState(false);
    const [debugSapData, setDebugSapData] = useState(null);

    // Flow data (per la scheda di flusso)
    const [flowData, setFlowData] = useState({});
    const [flowLoading, setFlowLoading] = useState(false);

    // Track which component cards have their detail table expanded
    const [expandedTableCards, setExpandedTableCards] = useState({});
    // Track active tab
    const [activeTab, setActiveTab] = useState(null);
    // Configuration modal state
    const [configModal, setConfigModal] = useState(null);

    // Project filtering logic (after useState declarations)
    const uniqueProjects = [...new Set(entries.map(([key]) => key.split("::")[0]))];
    const projectMapping = { "RG+DH": "8Fe" };
    const normalizedProjects = [...new Set(uniqueProjects.map(p => projectMapping[p] || p))];
    const currentTab = activeTab || normalizedProjects[0] || null;

    const filteredEntries = useMemo(() => entries.filter(([key]) => {
        const proj = key.split("::")[0];
        const normalizedProj = projectMapping[proj] || proj;
        return normalizedProj === currentTab;
    }), [entries, currentTab]);

    useEffect(() => {
        const fetchSap = async () => {
            setSapLoading(true);
            try {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                const weekStart = new Date(today.setDate(diff));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const weekStartStr = weekStart.toISOString().split('T')[0];
                const weekEndStr = weekEnd.toISOString().split('T')[0];

                // Carica anagrafica_sap centralizzata da Supabase
                const progettiAttivi = [...new Set(filteredEntries.map(([k]) => k.split("::")[0]))];
                const componentiAttivi = [...new Set(filteredEntries.map(([k]) => k.split("::")[1]))];
                const { data: anagraficaRows } = await supabase
                    .from("anagrafica_sap")
                    .select("progetto, componente, fase_label, sap_mat, sap_op")
                    .in("progetto", progettiAttivi)
                    .in("componente", componentiAttivi);

                // Mappa (progetto::componente::fase_label) → { sap_mat, sap_op }
                const anagraficaMap = {};
                for (const r of (anagraficaRows || [])) {
                    anagraficaMap[`${r.progetto}::${r.componente}::${r.fase_label}`] = { sap_mat: r.sap_mat, sap_op: r.sap_op };
                }

                const result = {};
                const resultRaw = {};
                const lotto = cfg.lotto || 1200;

                for (const [key] of filteredEntries) {
                    const [progetto, componente] = key.split("::");
                    const phases = cfg.components[key] || [];

                    for (const phase of phases) {
                        // Priorità: anagrafica_sap centralizzata, fallback a phase.sapMat locale
                        const anagraficaKey = `${progetto}::${componente}::${phase.label}`;
                        const sapInfo = anagraficaMap[anagraficaKey];
                        const sapMat = sapInfo?.sap_mat || phase.sapMat;
                        const sapOp = sapInfo?.sap_op || phase.sapOp;

                        if (!sapMat) continue;

                        let query = supabase
                            .from("conferme_sap")
                            .select("data, materiale, qta_ottenuta, work_center_sap, macchina_id, fino")
                            .ilike("materiale", sapMat)
                            .gte("data", weekStartStr)
                            .lte("data", weekEndStr);

                        if (sapOp) query = query.eq("fino", sapOp);

                        const { data: rows } = await query.order("data", { ascending: true });

                        if (!rows?.length) continue;

                        const totQty = rows.reduce((s, r) => s + (r.qta_ottenuta || 0), 0);
                        const firstDate = rows[0].data;
                        const lottoNum = Math.ceil(totQty / lotto);
                        const progress = Math.round((totQty % lotto) / lotto * 100);

                        result[phase.phaseId] = { totQty, firstDate, lottoNum, progress };
                        resultRaw[phase.phaseId] = {
                            sapMat,
                            sapOp,
                            weekStart: weekStartStr,
                            weekEnd: weekEndStr,
                            rows: rows
                        };
                    }
                }
                setPhaseData(result);
                setPhaseDataRaw(resultRaw);
            } finally {
                setSapLoading(false);
            }
        };
        fetchSap();
    }, [cfg, filteredEntries, lastRefresh]);

    // Fetch dati flusso per la scheda (come ComponentFlowView)
    useEffect(() => {
        const fetchFlowData = async () => {
            setFlowLoading(true);
            try {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                const weekStart = new Date(today.setDate(diff));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const toLocalDateStr = (d) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    const day = String(d.getDate()).padStart(2, "0");
                    return `${y}-${m}-${day}`;
                };

                const weekStartStr = toLocalDateStr(weekStart);
                const weekEndStr = toLocalDateStr(weekEnd);

                // Carica material_fino_overrides
                const { data: matOverrides } = await supabase.from("material_fino_overrides").select("*");

                // Carica conferme_sap per la settimana
                const { data: prodRes } = await supabase.from("conferme_sap").select("data, materiale, work_center_sap, macchina_id, qta_ottenuta, fino")
                    .gte("data", weekStartStr)
                    .lte("data", weekEndStr);

                // Log primi 5 record di prodRes per capire il formato
                console.log("📊 fetchFlowData: prodRes =", prodRes?.length, "records, matOverrides =", matOverrides?.length);
                if (prodRes?.length > 0) {
                    console.log("Sample prodRes records:", prodRes.slice(0, 3).map(r => ({ mat: r.materiale, fino: r.fino })));
                    console.log("Sample matOverrides:", matOverrides?.slice(0, 3).map(o => ({ mat: o.mat, fino: o.fino, proj: o.proj, comp: o.comp })));
                }

                // Organizza i dati per TUTTI i progetti/componenti
                const newFlow = {};
                let matchCount = 0;

                if (prodRes) {
                    prodRes.forEach(r => {
                        const matCode = (r.materiale || "").toUpperCase();
                        const fino = String(r.fino || "").padStart(4, "0");

                        const override = (matOverrides || []).find(o => o.mat === matCode && o.fino === fino)
                            || (matOverrides || []).find(o => o.mat === matCode && !o.fino);

                        if (!override) return;

                        matchCount++;
                        const phase = override.phase;
                        if (!phase || phase === "baa") return;

                        // Normalizza i nomi dei progetti come in ComponentFlowView
                        let proj = override.proj;
                        if (proj === "DCT 300") proj = "DCT300";
                        if (proj === "8 FE" || proj === "8Fedct") proj = "8Fe";
                        if (proj === "DCT Eco" || proj === "DCTeco") proj = "DCT ECO";

                        let comp = override.comp;
                        if (comp === "SG2-REV") comp = "DG-REV";

                        const key = `${proj}::${comp}`;
                        if (!newFlow[key]) newFlow[key] = {};
                        if (!newFlow[key][phase]) newFlow[key][phase] = { value: 0, records: [] };
                        newFlow[key][phase].value += (r.qta_ottenuta || 0);
                        newFlow[key][phase].records.push({ ...r, matCode });
                    });
                }

                console.log("📊 fetchFlowData: matchCount =", matchCount, "components =", Object.keys(newFlow).length, "newFlow keys =", Object.keys(newFlow));
                setFlowData(newFlow);
            } catch (err) {
                console.error("Errore fetch flow data:", err);
            } finally {
                setFlowLoading(false);
            }
        };
        fetchFlowData();
    }, [lastRefresh]);

    // Fase corrente = quella più avanzata (indice più alto) con dati SAP
    const buildTimeline = (phases) => {
        // Trova il lotto più alto con dati SAP → è il lotto corrente di quella fase
        // La fase "corrente" è quella con lottoNum più basso (il lotto è ancora lì)
        // Le fasi "completate" hanno lottoNum > lottoNum della fase successiva
        const lotto = cfg.lotto || 1200;
        let prevEndDate = null;

        return phases.map(p => {
            const pd = phaseData[p.phaseId];
            const fromSap = !!pd;
            const totQty = pd?.totQty || 0;
            const lottoNum = pd?.lottoNum || 0;
            const progress = pd?.progress ?? 0;

            // Data inizio: prima data SAP oppure fine fase precedente
            const startDate = pd?.firstDate
                ? parseISODate(pd.firstDate)
                : prevEndDate ? new Date(prevEndDate) : null;

            // Data fine stimata: startDate + ore fase
            const endDate = startDate
                ? new Date(startDate.getTime() + p.h * 3600000)
                : null;

            prevEndDate = endDate;

            return { ...p, fromSap, totQty, lottoNum, progress, startDate, endDate };
        });
    };

    // Parse date from ISO string (YYYY-MM-DD) ensuring it's treated as local date, not UTC
    const parseISODate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const fmtDate = d => d
        ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" })
        : "—";
    const fmtFull = d => d
        ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "—";

    return (
        <div style={{ padding: "32px", maxWidth: "none", margin: "0 auto" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>
                        ⏱ Tempi di Attraversamento
                    </h2>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {(() => {
                        const lastSapDate = Object.values(phaseData).reduce((latest, pd) => {
                            if (!pd?.firstDate) return latest;
                            const date = parseISODate(pd.firstDate);
                            return !latest || date > latest ? date : latest;
                        }, null);
                        const dateStr = lastSapDate ? `Ult. agg: ${lastSapDate.toLocaleDateString("it-IT")}` : "Aggiorna SAP";
                        return (
                            <button onClick={() => setLastRefresh(prev => prev + 1)} disabled={sapLoading} className="btn" style={{
                                padding: "8px 16px", fontWeight: 600,
                                background: sapLoading ? "var(--bg-tertiary)" : "var(--accent)", color: sapLoading ? "var(--text-muted)" : "white",
                                border: "none", borderRadius: 8, cursor: sapLoading ? "not-allowed" : "pointer", opacity: sapLoading ? 0.6 : 1
                            }}>🔄 {dateStr}</button>
                        );
                    })()}
                    <button onClick={async () => {
                        try {
                            const { data } = await supabase
                                .from("conferme_sap")
                                .select("*")
                                .limit(50)
                                .order("data", { ascending: false });
                            setDebugSapData(data || []);
                            setDebugSapModal(true);
                        } catch (err) {
                            console.error("Debug SAP error:", err);
                            showToast?.("Errore nel caricamento debug SAP", "error");
                        }
                    }} className="btn" style={{
                        padding: "8px 16px", fontWeight: 600,
                        background: "var(--bg-tertiary)", color: "#ef4444",
                        border: "1px solid #ef4444", borderRadius: 8, cursor: "pointer", fontSize: 12
                    }}>🐛 Debug SAP</button>
                </div>
            </div>

            {/* Target Editabili per Progetti */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                marginBottom: "24px"
            }}>
                {Object.entries(cfg.components).length > 0 && (() => {
                    // Usa le variabili globali già dichiarate alle linee 90-93
                    return normalizedProjects.filter(p => p === currentTab).map(proj => {
                        const savedTarget = localStorage.getItem("bap_target_overrides");
                        const projectKey = projectMapping[proj] || proj;
                        const target = savedTarget ? JSON.parse(savedTarget)[projectKey] || 450 : 450;
                        // Trova l'ultima data SAP tra tutte le fasi
                        const lastSapDate = Object.values(phaseData).reduce((latest, pd) => {
                            if (!pd?.firstDate) return latest;
                            const date = parseISODate(pd.firstDate);
                            return !latest || date > latest ? date : latest;
                        }, null);

                        return (
                            <div key={proj} style={{
                            background: "transparent",
                            border: "1px solid var(--border-light)",
                            borderRadius: "8px",
                            padding: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                        }}>
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "2px"
                            }}>
                                <div style={{
                                    fontSize: "10px",
                                    fontWeight: "600",
                                    color: "var(--text-muted)",
                                    textTransform: "uppercase"
                                }}>
                                    {proj}
                                </div>
                            </div>
                            <div style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "baseline"
                            }}>
                                <div style={{
                                    fontSize: "18px",
                                    fontWeight: "700",
                                    color: "var(--text-secondary)",
                                    flex: 1
                                }}>
                                    {target}
                                </div>
                                <span style={{
                                    fontSize: "10px",
                                    color: "var(--text-muted)"
                                }}>pz/gg</span>
                            </div>
                            <button
                                onClick={() => {
                                    setTargetValue(target);
                                    setTargetModal(projectKey);
                                }}
                                style={{
                                    padding: "8px 12px",
                                    background: "var(--bg-tertiary)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    color: "var(--text-secondary)",
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            >
                                ✏️ Modifica
                            </button>
                        </div>
                    );
                    });
                })()}
            </div>

            {/* Project Tabs */}
            <div style={{
                display: "flex", gap: 8, marginBottom: 24, borderBottom: "2px solid var(--border)",
                paddingBottom: 0, flexWrap: "wrap"
            }}>
                {normalizedProjects.map(proj => (
                    <button
                        key={proj}
                        onClick={() => setActiveTab(proj)}
                        style={{
                            padding: "12px 20px", fontSize: 14, fontWeight: 700,
                            background: currentTab === proj ? "var(--accent)" : "transparent",
                            color: currentTab === proj ? "white" : "var(--text-secondary)",
                            border: "none", borderBottom: currentTab === proj ? "3px solid var(--accent)" : "3px solid transparent",
                            cursor: "pointer", transition: "all 0.2s"
                        }}
                    >
                        {proj}
                    </button>
                ))}
            </div>

            {/* Tabelle componenti */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginBottom: 24 }}>
                {filteredEntries.map(([key]) => {
                    const [proj, comp] = key.split("::");
                    const phases = computeThroughput(key, cfg);
                    const totalH = phases.at(-1)?.cumH || 0;
                    const totalDays = (totalH / 24).toFixed(1);
                    const isExpanded = expandedTableCards[key];

                    return (
                        <div key={key} style={{
                            background: "var(--bg-card)", border: "1px solid var(--border)",
                            borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column"
                        }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                            <span style={{ background: "var(--accent)", color: "white", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{proj}</span>
                            <span style={{ fontWeight: 800, fontSize: 17 }}>{comp}</span>
                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                                {editingKey === key ? (
                                    <>
                                        <button onClick={saveEdit} style={{
                                            padding: "6px 14px", fontWeight: 700, fontSize: 13,
                                            background: "#22c55e", color: "white",
                                            border: "none", borderRadius: 8, cursor: "pointer"
                                        }}>✓ Salva</button>
                                        <button onClick={cancelEdit} style={{
                                            padding: "6px 14px", fontWeight: 600, fontSize: 13,
                                            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                                            border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer"
                                        }}>Annulla</button>
                                    </>
                                ) : (
                                    <button onClick={() => setConfigModal(key)} style={{
                                        padding: "6px 10px", fontSize: 16, background: "var(--bg-tertiary)",
                                        border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                                        color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center"
                                    }}>⚙️</button>
                                )}
                            </div>
                        </div>

                        {/* Timeline SAP (PRIMARY DISPLAY) */}
                        {(() => {
                            const timeline = buildTimeline(phases);
                            const lotto = cfg.lotto || 1200;
                            const maxLottoNum = Math.max(0, ...timeline.filter(p => p.fromSap).map(p => p.lottoNum));
                            const currentPhaseIdx = timeline.findIndex(p => !p.fromSap || p.lottoNum < maxLottoNum);
                            const currentPhase = timeline[currentPhaseIdx];
                            const lastPhase = timeline[timeline.length - 1];
                            const targetPzH = dailyTarget / 24;

                            return (
                                <div style={{ marginBottom: 20 }}>
                                    {/* Header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                                        <span style={{ fontWeight: 800, fontSize: 14 }}>📡 Lotto Corrente — {comp}</span>
                                        {sapLoading && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Caricamento…</span>}
                                        {!sapLoading && currentPhase && (
                                            <span style={{
                                                background: "rgba(60,110,240,0.15)", color: "var(--accent)",
                                                fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
                                                border: "1px solid var(--accent)"
                                            }}>
                                                Lotto #{currentPhase.lottoNum} · In: {currentPhase.label}
                                            </span>
                                        )}
                                        {!sapLoading && lastPhase?.endDate && (
                                            <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
                                                Uscita stimata washing: <strong style={{ color: "var(--text-primary)" }}>{fmtFull(lastPhase.endDate)}</strong>
                                            </span>
                                        )}
                                    </div>

                                    {/* Barra timeline proporzionale */}
                                    <div style={{ display: "flex", alignItems: "stretch", borderRadius: 10, overflow: "hidden", marginBottom: 20, height: 52 }}>
                                        {timeline.map((p, i) => {
                                            const isPast = p.fromSap && p.lottoNum > maxLottoNum - 1 && i < currentPhaseIdx;
                                            const isCurrent = i === currentPhaseIdx;
                                            const bg = isPast ? "#22c55e" : isCurrent ? "var(--accent)" : "var(--bg-tertiary)";
                                            const innerPct = isCurrent ? (p.progress || 0) : 0;
                                            return (
                                                <div key={p.phaseId} style={{
                                                    flex: p.h, position: "relative", overflow: "hidden",
                                                    background: bg,
                                                    borderRight: i < timeline.length - 1 ? "2px solid rgba(0,0,0,0.2)" : "none",
                                                    display: "flex", flexDirection: "column",
                                                    alignItems: "center", justifyContent: "center",
                                                    opacity: !p.fromSap && i > currentPhaseIdx ? 0.4 : 1
                                                }}>
                                                    {isCurrent && innerPct > 0 && (
                                                        <div style={{
                                                            position: "absolute", left: 0, top: 0, bottom: 0,
                                                            width: `${innerPct}%`,
                                                            background: "rgba(255,255,255,0.2)"
                                                        }} />
                                                    )}
                                                    <div style={{ fontSize: 10, fontWeight: 700, color: (isPast || isCurrent) ? "white" : "var(--text-muted)", zIndex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%", textAlign: "center" }}>{p.label}</div>
                                                    {isCurrent && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", zIndex: 1 }}>{innerPct}%</div>}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Dettaglio per fase */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {timeline.map((p, i) => {
                                            const isPast = p.fromSap && i < currentPhaseIdx;
                                            const isCurrent = i === currentPhaseIdx;
                                            const expectedQty = p.fromSap && p.startDate
                                                ? Math.round(targetPzH * ((Date.now() - p.startDate.getTime()) / 3600000))
                                                : null;
                                            const delta = p.fromSap && expectedQty != null ? p.totQty - expectedQty : null;

                                            return (
                                                <div key={p.phaseId} style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "8px 1fr auto auto auto auto",
                                                    alignItems: "center", gap: 12,
                                                    padding: "10px 14px", borderRadius: 8,
                                                    background: isCurrent ? "rgba(60,110,240,0.08)" : "var(--bg-tertiary)",
                                                    border: isCurrent ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                                                    opacity: !p.fromSap && i > currentPhaseIdx ? 0.5 : 1,
                                                    cursor: "pointer",
                                                    transition: "all 0.2s"
                                                }} onClick={() => setSelectedPhaseDebug(p.phaseId)}>
                                                    <span style={{
                                                        width: 8, height: 8, borderRadius: "50%",
                                                        background: isPast ? "#22c55e" : isCurrent ? "var(--accent)" : "var(--border)",
                                                        display: "block"
                                                    }} />
                                                    <span style={{ fontWeight: isCurrent ? 800 : 600, fontSize: 13, color: isCurrent ? "var(--accent)" : "var(--text-primary)" }}>
                                                        {isCurrent && "▶ "}{p.label}
                                                    </span>
                                                    {p.fromSap ? (
                                                        <>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                                                                <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{p.totQty.toLocaleString("it-IT")}</span> pz · Lotto #{p.lottoNum} · {p.progress}%
                                                            </span>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                                📡 Inizio: <strong>{fmtDate(p.startDate)}</strong>
                                                            </span>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                                Fine stim.: <strong>{fmtDate(p.endDate)}</strong>
                                                            </span>
                                                            {delta != null && (
                                                                <span style={{
                                                                    fontSize: 12, fontWeight: 700, minWidth: 60, textAlign: "right",
                                                                    color: delta >= 0 ? "#22c55e" : "#ef4444"
                                                                }}>
                                                                    {delta >= 0 ? "+" : ""}{delta.toLocaleString("it-IT")} pz
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Nessun dato SAP</span>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>📐 Inizio stim.: <strong>{fmtDate(p.startDate)}</strong></span>
                                                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Fine stim.: <strong>{fmtDate(p.endDate)}</strong></span>
                                                            <span />
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
                                        📡 dato reale SAP &nbsp;·&nbsp; 📐 stima throughput &nbsp;·&nbsp; ±pz = scostamento vs target ({dailyTarget} pz/gg)
                                    </div>
                                </div>
                            );
                        })()}


                        {/* Phase Table removed - now in configuration modal */}
                        {false && (
                            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-tertiary)" }}>
                                            <th style={thStyle("#")}>  #</th>
                                            <th style={thStyle("FASE")}>FASE</th>
                                            <th style={thStyle("right")}>PZ/H</th>
                                            <th style={thStyle("right")}>TEMPO LOTTO</th>
                                            <th style={thStyle("right")}>CHANGE OVER</th>
                                            {editingKey === key && <th style={thStyle("right")}>CARICA</th>}
                                            {editingKey === key && <th style={thStyle("left")}>MAT. SAP</th>}
                                            {editingKey === key && <th style={thStyle("left")}>OP. SAP</th>}
                                            <th style={thStyle("right")}>TOTALE FASE</th>
                                            <th style={thStyle("right")}>CUMULATO</th>
                                            <th style={thStyle("right")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(editingKey === key ? draft.phases : phases).map((p, i) => {
                                            const phase = p;
                                            const isEditingThis = editingKey === key;
                                            const computed = isEditingThis
                                                ? computeThroughput(key, {
                                                    ...cfg,
                                                    lotto: Number(draft.lotto),
                                                    oee: Number(draft.oeePercent) / 100,
                                                    changeOverH: Number(draft.changeOverH),
                                                    components: { [key]: draft.phases.map(dp => ({
                                                        ...dp,
                                                        pzH: dp.fixedH != null ? null : Number(dp.pzH),
                                                        fixedH: dp.fixedH != null ? Number(dp.fixedH) : null
                                                    })) }
                                                })[i]
                                                : p;

                                            const activeLotto = Number(isEditingThis ? draft.lotto : cfg.lotto);
                                            const activeOee = Number(isEditingThis ? draft.oeePercent / 100 : cfg.oee);
                                            const lottoH = phase.fixedH != null
                                                ? (phase.chargeSize
                                                    ? Math.ceil(activeLotto / phase.chargeSize) * phase.fixedH
                                                    : phase.fixedH)
                                                : +(activeLotto / (Number(phase.pzH) * activeOee)).toFixed(1);
                                            const coH = phase.noChangeOver ? 0 : Number(isEditingThis ? draft.phases[i].changeOverH : (phase.changeOverH ?? cfg.changeOverH));
                                            const barWidth = Math.round((computed.h / totalH) * 100);

                                            return (
                                                <tr key={phase.phaseId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                    <td style={{ padding: "12px", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                                                    <td style={{ padding: "12px" }}>
                                                        {isEditingThis ? (
                                                            <input type="text" value={draft.phases[i].label}
                                                                onChange={e => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases[i] = { ...phases[i], label: e.target.value };
                                                                    return { ...d, phases };
                                                                })}
                                                                style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
                                                        ) : (
                                                            <div style={{ fontWeight: 700, fontSize: 14 }}>{phase.label}</div>
                                                        )}
                                                        <div style={{ marginTop: 4, height: 4, borderRadius: 4, background: "var(--bg-tertiary)", width: "100%", maxWidth: 200 }}>
                                                            <div style={{ height: 4, borderRadius: 4, background: "var(--accent)", width: `${barWidth}%` }} />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                                        {isEditingThis ? (
                                                            phase.fixedH != null ? (
                                                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>fisso</span>
                                                            ) : (
                                                                <input type="number" value={draft.phases[i].pzH}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], pzH: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    style={{ ...inputStyle, width: 70, textAlign: "right" }} />
                                                            )
                                                        ) : (
                                                            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{phase.pzH ?? "—"}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                                        {isEditingThis ? (
                                                            phase.fixedH != null ? (
                                                                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                                                                    <input type="number" value={draft.phases[i].fixedH}
                                                                        onChange={e => setDraft(d => {
                                                                            const phases = [...d.phases];
                                                                            phases[i] = { ...phases[i], fixedH: e.target.value };
                                                                            return { ...d, phases };
                                                                        })}
                                                                        style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                                                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>h fisso</span>
                                                                </div>
                                                            ) : (
                                                                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{isNaN(lottoH) ? "—" : `${lottoH}h`}</span>
                                                            )
                                                        ) : (
                                                            <span style={{ fontSize: 13 }}>
                                                                {phase.fixedH != null
                                                                    ? (phase.chargeSize
                                                                        ? `${Math.ceil(activeLotto / phase.chargeSize)} × ${phase.fixedH}h = ${lottoH}h`
                                                                        : `${phase.fixedH}h fisso`)
                                                                    : `${lottoH}h`}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "right" }}>
                                                        {phase.noChangeOver
                                                            ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                                                            : isEditingThis
                                                                ? <input type="number" value={draft.phases[i].changeOverH} min={0} step={0.5}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], changeOverH: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                                                                : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{coH}h</span>
                                                        }
                                                    </td>
                                                    {isEditingThis && (
                                                        <td style={{ padding: "12px", textAlign: "right" }}>
                                                            <input type="number" value={draft.phases[i].chargeSize || ""} min={1}
                                                                onChange={e => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases[i] = { ...phases[i], chargeSize: e.target.value ? Number(e.target.value) : null };
                                                                    return { ...d, phases };
                                                                })}
                                                                style={{ ...inputStyle, width: 70, textAlign: "right" }}
                                                                placeholder="es. 120" />
                                                        </td>
                                                    )}
                                                    {isEditingThis && (
                                                        <td style={{ padding: "12px" }}>
                                                            <input type="text" placeholder="es. M0140996" value={draft.phases[i].sapMat || ""}
                                                                onChange={e => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases[i] = { ...phases[i], sapMat: e.target.value };
                                                                    return { ...d, phases };
                                                                })}
                                                                style={{ ...inputStyle, width: 110, fontSize: 11 }} />
                                                        </td>
                                                    )}
                                                    {isEditingThis && (
                                                        <td style={{ padding: "12px" }}>
                                                            <input type="text" placeholder="es. 0010" value={draft.phases[i].sapOp || ""}
                                                                onChange={e => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases[i] = { ...phases[i], sapOp: e.target.value };
                                                                    return { ...d, phases };
                                                                })}
                                                                style={{ ...inputStyle, width: 70, fontSize: 11 }} />
                                                        </td>
                                                    )}
                                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--accent)" }}>
                                                        {computed.h}h
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-secondary)" }}>
                                                        {computed.cumH}h
                                                    </td>
                                                    <td style={{ padding: "12px", textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                                        {isEditingThis && (
                                                            <>
                                                                {i > 0 && (
                                                                    <button onClick={() => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        [phases[i - 1], phases[i]] = [phases[i], phases[i - 1]];
                                                                        return { ...d, phases };
                                                                    })} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "var(--bg-tertiary)",
                                                                        color: "var(--text-secondary)", border: "1px solid var(--border)",
                                                                        borderRadius: 4, cursor: "pointer", fontWeight: 700
                                                                    }} title="Sposta su">↑</button>
                                                                )}
                                                                {i < draft.phases.length - 1 && (
                                                                    <button onClick={() => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        [phases[i], phases[i + 1]] = [phases[i + 1], phases[i]];
                                                                        return { ...d, phases };
                                                                    })} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "var(--bg-tertiary)",
                                                                        color: "var(--text-secondary)", border: "1px solid var(--border)",
                                                                        borderRadius: 4, cursor: "pointer", fontWeight: 700
                                                                    }} title="Sposta giù">↓</button>
                                                                )}
                                                                <button onClick={() => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases.splice(i + 1, 0, {
                                                                        phaseId: `phase_${Date.now()}`,
                                                                        label: "Nuova Fase",
                                                                        pzH: 100,
                                                                        fixedH: null,
                                                                        changeOverH: 0,
                                                                        chargeSize: null,
                                                                        noChangeOver: false,
                                                                        sapMat: "",
                                                                        sapOp: ""
                                                                    });
                                                                    return { ...d, phases };
                                                                })} style={{
                                                                    padding: "4px 8px", fontSize: 12, background: "var(--accent)",
                                                                    color: "white", border: "none", borderRadius: 4, cursor: "pointer"
                                                                }}>+</button>
                                                                {draft.phases.length > 1 && (
                                                                    <button onClick={() => setDraft(d => ({
                                                                        ...d,
                                                                        phases: d.phases.filter((_, idx) => idx !== i)
                                                                    }))} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "#ef4444",
                                                                        color: "white", border: "none", borderRadius: 4, cursor: "pointer"
                                                                    }}>×</button>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: "var(--bg-tertiary)", borderTop: "2px solid var(--border)" }}>
                                            <td colSpan={editingKey === key ? 8 : 5} style={{ padding: "12px", fontWeight: 800, fontSize: 14 }}>TOTALE</td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 16, fontWeight: 900, color: "var(--accent)" }}>{totalH}h</td>
                                            <td style={{ padding: "12px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>≈ {totalDays} gg</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}

                        {/* Legend */}
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                            <div>📡 dato reale SAP · 📐 stima throughput · ±pz = scostamento vs target (1000 pz/gg)</div>
                        </div>
                    </div>
                        );
                    })}
            </div>

            {/* Modal Debug SAP Data */}
            {selectedPhaseDebug && (
                phaseDataRaw[selectedPhaseDebug] ? (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000,
                    overflowY: "auto"
                }} onClick={() => setSelectedPhaseDebug(null)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 600,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)", margin: "20px"
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900 }}>
                            Dati SAP — {Object.values(cfg.components)[0]?.find(p => p.phaseId === selectedPhaseDebug)?.label || selectedPhaseDebug}
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Materiale Cercato</div>
                                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{phaseDataRaw[selectedPhaseDebug].sapMat}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Operazione Cercata</div>
                                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{phaseDataRaw[selectedPhaseDebug].sapOp}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Intervallo Date</div>
                                <div style={{ fontSize: 14, color: "var(--text-primary)" }}>
                                    {fmtDate(parseISODate(phaseDataRaw[selectedPhaseDebug].weekStart))} → {fmtDate(parseISODate(phaseDataRaw[selectedPhaseDebug].weekEnd))}
                                </div>
                            </div>
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
                                    Record Trovati ({phaseDataRaw[selectedPhaseDebug].rows.length})
                                </div>
                                <div style={{ maxHeight: 300, overflowY: "auto", background: "var(--bg-tertiary)", borderRadius: 8, padding: 12 }}>
                                    {phaseDataRaw[selectedPhaseDebug].rows.length === 0 ? (
                                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nessun record trovato</div>
                                    ) : (
                                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                    <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>Data</th>
                                                    <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Operazione</th>
                                                    <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Materiale</th>
                                                    <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Macchina</th>
                                                    <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {phaseDataRaw[selectedPhaseDebug].rows.map((row, i) => {
                                                    const dateObj = parseISODate(row.data);
                                                    const dateStr = dateObj ? fmtDate(dateObj) : row.data;
                                                    const opStr = String(row.fino || "").padStart(4, "0");
                                                    return (
                                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)", opacity: 0.8 }}>
                                                            <td style={{ padding: 8 }}>{dateStr}</td>
                                                            <td style={{ padding: 8, textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{opStr}</td>
                                                            <td style={{ padding: 8, textAlign: "center", fontSize: 11 }}>{row.materiale || "—"}</td>
                                                            <td style={{ padding: 8, textAlign: "center", fontSize: 11 }}>{row.macchina_id || "—"}</td>
                                                            <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>{row.qta_ottenuta.toLocaleString("it-IT")}</td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr style={{ background: "rgba(60,110,240,0.1)", fontWeight: 700 }}>
                                                    <td colSpan={4} style={{ padding: 8 }}>TOTALE</td>
                                                    <td style={{ padding: 8, textAlign: "right", color: "var(--accent)" }}>
                                                        {phaseDataRaw[selectedPhaseDebug].rows.reduce((s, r) => s + r.qta_ottenuta, 0).toLocaleString("it-IT")}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedPhaseDebug(null)}
                            style={{
                                width: "100%", padding: "10px 16px", background: "var(--bg-tertiary)",
                                color: "var(--text-secondary)", border: "1px solid var(--border)",
                                borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14
                            }}
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
                ) : (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000
                }} onClick={() => setSelectedPhaseDebug(null)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 500,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900 }}>
                            ⚠️ Nessun dato SAP
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                                Non è stato trovato alcun record SAP per questa fase nella settimana corrente.
                            </div>
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Parametri Ricerca</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                                    <div><strong>Settimana:</strong> 20/04/2026 → 26/04/2026</div>
                                    <div><strong>Materiale:</strong> M0140996/S</div>
                                    <div><strong>Operazione:</strong> {(() => {
                                        const phaseLabel = selectedPhaseDebug;
                                        const phase = Object.values(cfg.components)[0]?.find(p => p.phaseId === phaseLabel);
                                        return phase?.sapOp || "—";
                                    })()}</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
                                ℹ️ Verifica che il materiale e l'operazione nel database corrispondano ai parametri di ricerca.
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedPhaseDebug(null)}
                            style={{
                                width: "100%", padding: "10px 16px", background: "var(--bg-tertiary)",
                                color: "var(--text-secondary)", border: "1px solid var(--border)",
                                borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14
                            }}
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
                )
            )}

            {/* Modal Debug SAP Data */}
            {debugSapModal && debugSapData && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000,
                    overflowY: "auto"
                }} onClick={() => setDebugSapModal(false)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 800,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)", margin: "20px"
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900 }}>
                            🐛 Debug SAP — Ultimi 50 record nel database
                        </h3>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                            Mostra un campione dei dati nel database. Confronta con i codici che stai cercando.
                        </div>
                        <div style={{ maxHeight: 500, overflowY: "auto", background: "var(--bg-tertiary)", borderRadius: 8, padding: 12, border: "1px solid var(--border)" }}>
                            {debugSapData.length === 0 ? (
                                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                                    ⚠️ Nessun record trovato nel database conferme_sap
                                </div>
                            ) : (
                                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
                                            <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)", minWidth: 80 }}>Data</th>
                                            <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)", minWidth: 110 }}>Materiale</th>
                                            <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)", minWidth: 70 }}>Operazione</th>
                                            <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)", minWidth: 100 }}>Work Center</th>
                                            <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)", minWidth: 80 }}>Macchina</th>
                                            <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)", minWidth: 70 }}>Qta</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {debugSapData.map((row, i) => {
                                            const dateObj = parseISODate(row.data);
                                            const dateStr = dateObj ? fmtDate(dateObj) : row.data;
                                            return (
                                                <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                    <td style={{ padding: 8, textAlign: "center", fontSize: 10 }}>{dateStr}</td>
                                                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 10 }}>{row.materiale}</td>
                                                    <td style={{ padding: 8, textAlign: "center", fontSize: 10 }}>{String(row.fino).padStart(4, "0")}</td>
                                                    <td style={{ padding: 8, fontSize: 10 }}>{row.work_center_sap || "—"}</td>
                                                    <td style={{ padding: 8, fontSize: 10 }}>{row.macchina_id || "—"}</td>
                                                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--accent)", fontSize: 10 }}>
                                                        {row.qta_ottenuta?.toLocaleString("it-IT")}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <button
                            onClick={() => setDebugSapModal(false)}
                            style={{
                                width: "100%", padding: "10px 16px", background: "var(--bg-tertiary)",
                                color: "var(--text-secondary)", border: "1px solid var(--border)",
                                borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14,
                                marginTop: 16
                            }}
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Configurazione Componente */}
            {configModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000,
                    overflowY: "auto"
                }} onClick={() => setConfigModal(null)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 900,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)", margin: "20px"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                                ⚙️ Configurazione — {configModal?.split("::")[0]} / {configModal?.split("::")[1]}
                            </h3>
                            <button
                                onClick={() => setConfigModal(null)}
                                style={{
                                    background: "none", border: "none", fontSize: 20, cursor: "pointer",
                                    color: "var(--text-secondary)"
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal content switches between view and edit */}
                        {editingKey !== configModal ? (
                            <>
                                {/* VIEW MODE */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                                    {/* Parameters */}
                                    <div style={{
                                        background: "var(--bg-tertiary)", padding: 16, borderRadius: 8,
                                        border: "1px solid var(--border)", display: "grid",
                                        gridTemplateColumns: "1fr 1fr", gap: 16
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Lotto</div>
                                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{cfg.lotto} pz</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>OEE</div>
                                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{Math.round(cfg.oee * 100)}%</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Change Over</div>
                                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{cfg.changeOverH}h</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Rack Size</div>
                                            <div style={{ fontSize: 16, fontWeight: 900, color: "var(--text-primary)" }}>{cfg.rackSize || "—"}</div>
                                        </div>
                                    </div>

                                    {/* Phases Table */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
                                            Fasi ({(cfg.components[configModal] || []).length})
                                        </div>
                                        <div style={{ maxHeight: 300, overflowY: "auto", background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                                            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                                        <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>#</th>
                                                        <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>Fase</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Macchina</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Mat. SAP</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Op. SAP</th>
                                                        <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>PZ/H</th>
                                                        <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Tempo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(cfg.components[configModal] || []).map((phase, i) => (
                                                        <tr key={phase.phaseId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: 8, color: "var(--text-muted)" }}>{i + 1}</td>
                                                            <td style={{ padding: 8, fontWeight: 600 }}>{phase.label}</td>
                                                            <td style={{ padding: 8, textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{phase.macchina_id || "—"}</td>
                                                            <td style={{ padding: 8, textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{phase.sapMat || "—"}</td>
                                                            <td style={{ padding: 8, textAlign: "center", color: "var(--text-secondary)", fontSize: 11 }}>{phase.sapOp || "—"}</td>
                                                            <td style={{ padding: 8, textAlign: "right", color: "var(--text-secondary)" }}>{phase.pzH || "fisso"}</td>
                                                            <td style={{ padding: 8, textAlign: "right", color: "var(--accent)", fontWeight: 700 }}>
                                                                {phaseHours(phase, cfg).toFixed(1)}h
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Button Bar */}
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button
                                        onClick={() => {
                                            startEdit(configModal);
                                        }}
                                        style={{
                                            flex: 1, padding: "12px 16px",
                                            background: "var(--accent)", color: "white",
                                            border: "none", borderRadius: 8, fontWeight: 700,
                                            cursor: "pointer", fontSize: 14
                                        }}
                                    >
                                        ✏️ Modifica
                                    </button>
                                    <button
                                        onClick={() => setConfigModal(null)}
                                        style={{
                                            flex: 1, padding: "12px 16px",
                                            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                                            border: "1px solid var(--border)", borderRadius: 8, fontWeight: 700,
                                            cursor: "pointer", fontSize: 14
                                        }}
                                    >
                                        Chiudi
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* EDIT MODE - Same as card edit, but in modal */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
                                    {/* Edit Parameters */}
                                    <div style={{
                                        background: "var(--bg-tertiary)", padding: 16, borderRadius: 8,
                                        border: "1px solid var(--border)", display: "grid",
                                        gridTemplateColumns: "1fr 1fr", gap: 16
                                    }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Lotto</label>
                                            <input type="number" value={draft.lotto}
                                                onChange={e => setDraft(d => ({ ...d, lotto: e.target.value }))}
                                                style={{ ...inputStyle }} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>OEE %</label>
                                            <input type="number" value={draft.oeePercent}
                                                onChange={e => setDraft(d => ({ ...d, oeePercent: e.target.value }))}
                                                style={{ ...inputStyle }} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Change Over</label>
                                            <input type="number" value={draft.changeOverH}
                                                onChange={e => setDraft(d => ({ ...d, changeOverH: e.target.value }))}
                                                style={{ ...inputStyle }} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Rack Size</label>
                                            <input type="number" value={draft.rackSize}
                                                onChange={e => setDraft(d => ({ ...d, rackSize: Number(e.target.value) }))}
                                                style={{ ...inputStyle }} />
                                        </div>
                                    </div>

                                    {/* Phases Table */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
                                            Fasi ({draft.phases.length})
                                        </div>
                                        <div style={{ maxHeight: 350, overflowY: "auto", background: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border)" }}>
                                            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}>
                                                        <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>#</th>
                                                        <th style={{ padding: 8, textAlign: "left", fontWeight: 700, color: "var(--text-secondary)" }}>Fase</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Macchina</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Mat. SAP</th>
                                                        <th style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "var(--text-secondary)" }}>Op. SAP</th>
                                                        <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>PZ/H</th>
                                                        <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}>Tempo</th>
                                                        <th style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--text-secondary)" }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {draft.phases.map((phase, i) => (
                                                        <tr key={phase.phaseId} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                            <td style={{ padding: 8, color: "var(--text-muted)" }}>{i + 1}</td>
                                                            <td style={{ padding: 8 }}>
                                                                <input type="text" value={draft.phases[i].label}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], label: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    style={{ ...inputStyle, width: "100%" }} />
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "center" }}>
                                                                <input type="text" value={draft.phases[i].macchina_id || ""}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], macchina_id: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    placeholder="—"
                                                                    style={{ ...inputStyle, width: "100%" }} />
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "center" }}>
                                                                <input type="text" placeholder="es. M0140996" value={draft.phases[i].sapMat || ""}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], sapMat: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    style={{ ...inputStyle, width: "100%", fontSize: 11 }} />
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "center" }}>
                                                                <input type="text" placeholder="es. 0010" value={draft.phases[i].sapOp || ""}
                                                                    onChange={e => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        phases[i] = { ...phases[i], sapOp: e.target.value };
                                                                        return { ...d, phases };
                                                                    })}
                                                                    style={{ ...inputStyle, width: "100%", fontSize: 11 }} />
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "right" }}>
                                                                {phase.fixedH != null ? (
                                                                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>fisso</span>
                                                                ) : (
                                                                    <input type="number" value={draft.phases[i].pzH}
                                                                        onChange={e => setDraft(d => {
                                                                            const phases = [...d.phases];
                                                                            phases[i] = { ...phases[i], pzH: e.target.value };
                                                                            return { ...d, phases };
                                                                        })}
                                                                        style={{ ...inputStyle, width: 60, textAlign: "right" }} />
                                                                )}
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: "var(--accent)" }}>
                                                                {phaseHours(phase, { ...cfg, lotto: Number(draft.lotto), oee: Number(draft.oeePercent) / 100 }).toFixed(1)}h
                                                            </td>
                                                            <td style={{ padding: 8, textAlign: "right", display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                                                {i > 0 && (
                                                                    <button onClick={() => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        [phases[i - 1], phases[i]] = [phases[i], phases[i - 1]];
                                                                        return { ...d, phases };
                                                                    })} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "var(--bg-secondary)",
                                                                        color: "var(--text-secondary)", border: "1px solid var(--border)",
                                                                        borderRadius: 4, cursor: "pointer", fontWeight: 700
                                                                    }} title="Sposta su">↑</button>
                                                                )}
                                                                {i < draft.phases.length - 1 && (
                                                                    <button onClick={() => setDraft(d => {
                                                                        const phases = [...d.phases];
                                                                        [phases[i], phases[i + 1]] = [phases[i + 1], phases[i]];
                                                                        return { ...d, phases };
                                                                    })} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "var(--bg-secondary)",
                                                                        color: "var(--text-secondary)", border: "1px solid var(--border)",
                                                                        borderRadius: 4, cursor: "pointer", fontWeight: 700
                                                                    }} title="Sposta giù">↓</button>
                                                                )}
                                                                <button onClick={() => setDraft(d => {
                                                                    const phases = [...d.phases];
                                                                    phases.splice(i + 1, 0, {
                                                                        phaseId: `phase_${Date.now()}`,
                                                                        label: "Nuova Fase",
                                                                        pzH: 100,
                                                                        fixedH: null,
                                                                        changeOverH: 0,
                                                                        chargeSize: null,
                                                                        noChangeOver: false,
                                                                        sapMat: "",
                                                                        sapOp: "",
                                                                        macchina_id: ""
                                                                    });
                                                                    return { ...d, phases };
                                                                })} style={{
                                                                    padding: "4px 8px", fontSize: 12, background: "var(--accent)",
                                                                    color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700
                                                                }} title="Aggiungi fase dopo questa">+</button>
                                                                {draft.phases.length > 1 && (
                                                                    <button onClick={() => setDraft(d => ({
                                                                        ...d,
                                                                        phases: d.phases.filter((_, idx) => idx !== i)
                                                                    }))} style={{
                                                                        padding: "4px 8px", fontSize: 12, background: "#ef4444",
                                                                        color: "white", border: "none", borderRadius: 4, cursor: "pointer"
                                                                    }} title="Elimina fase">×</button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <button
                                            onClick={() => setDraft(d => ({
                                                ...d,
                                                phases: [...d.phases, {
                                                    phaseId: `phase_${Date.now()}`,
                                                    label: "Nuova Fase",
                                                    pzH: 100,
                                                    fixedH: null,
                                                    changeOverH: 0,
                                                    chargeSize: null,
                                                    noChangeOver: false,
                                                    sapMat: "",
                                                    sapOp: "",
                                                    macchina_id: ""
                                                }]
                                            }))}
                                            style={{
                                                width: "100%", marginTop: 12, padding: "8px 12px",
                                                background: "var(--accent)", color: "white",
                                                border: "none", borderRadius: 8, fontWeight: 700,
                                                cursor: "pointer", fontSize: 13
                                            }}
                                        >
                                            + Aggiungi Fase
                                        </button>
                                    </div>
                                </div>

                                {/* Button Bar */}
                                <div style={{ display: "flex", gap: 12 }}>
                                    <button
                                        onClick={saveEdit}
                                        style={{
                                            flex: 1, padding: "12px 16px",
                                            background: "#22c55e", color: "white",
                                            border: "none", borderRadius: 8, fontWeight: 700,
                                            cursor: "pointer", fontSize: 14
                                        }}
                                    >
                                        ✓ Salva
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        style={{
                                            flex: 1, padding: "12px 16px",
                                            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                                            border: "1px solid var(--border)", borderRadius: 8, fontWeight: 700,
                                            cursor: "pointer", fontSize: 14
                                        }}
                                    >
                                        Annulla
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Configura Codici SAP */}
            {sapConfigModal && sapConfigDraft && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000,
                    overflowY: "auto"
                }} onClick={() => setSapConfigModal(false)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 600,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)", margin: "20px"
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900 }}>
                            ⚙️ Configura Codici SAP
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20, maxHeight: 400, overflowY: "auto" }}>
                            {sapConfigDraft.map((phase, idx) => (
                                <div key={phase.phaseId} style={{
                                    background: "var(--bg-tertiary)", padding: 12, borderRadius: 8,
                                    border: "1px solid var(--border)"
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
                                        {phase.label}
                                    </div>
                                    <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                                                Codice Materiale
                                            </label>
                                            <input
                                                type="text"
                                                value={phase.sapMat}
                                                onChange={e => {
                                                    const updated = [...sapConfigDraft];
                                                    updated[idx].sapMat = e.target.value.toUpperCase();
                                                    setSapConfigDraft(updated);
                                                }}
                                                style={{
                                                    padding: "6px 10px", borderRadius: 6, fontSize: 12,
                                                    background: "var(--bg-card)", border: "1px solid var(--border)",
                                                    color: "var(--text-primary)", fontWeight: 700, outline: "none"
                                                }}
                                                placeholder="es. M0140996/S"
                                            />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                                                Codice Operazione
                                            </label>
                                            <input
                                                type="text"
                                                value={phase.sapOp}
                                                onChange={e => {
                                                    const updated = [...sapConfigDraft];
                                                    updated[idx].sapOp = e.target.value;
                                                    setSapConfigDraft(updated);
                                                }}
                                                style={{
                                                    padding: "6px 10px", borderRadius: 6, fontSize: 12,
                                                    background: "var(--bg-card)", border: "1px solid var(--border)",
                                                    color: "var(--text-primary)", fontWeight: 700, outline: "none"
                                                }}
                                                placeholder="es. 0060"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => {
                                    const key = Object.keys(cfg.components)[0];
                                    const newCfg = {
                                        ...cfg,
                                        components: {
                                            [key]: cfg.components[key].map(phase => {
                                                const draftPhase = sapConfigDraft.find(p => p.phaseId === phase.phaseId);
                                                return {
                                                    ...phase,
                                                    sapMat: draftPhase?.sapMat || phase.sapMat,
                                                    sapOp: draftPhase?.sapOp || phase.sapOp
                                                };
                                            })
                                        }
                                    };
                                    saveThroughputConfig(newCfg);
                                    setCfg(newCfg);
                                    setSapConfigModal(false);
                                    showToast?.("Codici SAP aggiornati!", "success");
                                }}
                                style={{
                                    flex: 1, padding: "10px 16px", background: "var(--accent)",
                                    color: "white", border: "none", borderRadius: 8,
                                    fontWeight: 700, cursor: "pointer", fontSize: 14
                                }}
                            >
                                ✓ Salva
                            </button>
                            <button
                                onClick={() => setSapConfigModal(false)}
                                style={{
                                    flex: 1, padding: "10px 16px", background: "var(--bg-tertiary)",
                                    color: "var(--text-secondary)", border: "1px solid var(--border)",
                                    borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14
                                }}
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Modifica Target */}
            {targetModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)", display: "flex",
                    alignItems: "center", justifyContent: "center", zIndex: 1000
                }} onClick={() => setTargetModal(null)}>
                    <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: 12, padding: "24px", width: "100%", maxWidth: 320,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 900 }}>
                            Modifica Target {targetModal}
                        </h3>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{
                                display: "block", fontSize: 12, fontWeight: 700,
                                color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase"
                            }}>
                                Pezzi al giorno (pz/gg)
                            </label>
                            <input
                                type="number"
                                value={targetValue}
                                onChange={e => setTargetValue(Number(e.target.value))}
                                style={{
                                    width: "100%", padding: "10px 12px", borderRadius: 8,
                                    border: "1px solid var(--border)", background: "var(--bg-tertiary)",
                                    color: "var(--text-primary)", fontSize: 14, fontWeight: 700,
                                    outline: "none", boxSizing: "border-box"
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => {
                                    const saved = localStorage.getItem("bap_target_overrides");
                                    const overrides = saved ? JSON.parse(saved) : {};
                                    overrides[targetModal] = targetValue;
                                    localStorage.setItem("bap_target_overrides", JSON.stringify(overrides));
                                    setTargetModal(null);
                                    showToast?.("Target aggiornato!", "success");
                                }}
                                style={{
                                    flex: 1, padding: "10px 16px", background: "var(--accent)",
                                    color: "white", border: "none", borderRadius: 8,
                                    fontWeight: 700, cursor: "pointer", fontSize: 14
                                }}
                            >
                                ✓ Salva
                            </button>
                            <button
                                onClick={() => setTargetModal(null)}
                                style={{
                                    flex: 1, padding: "10px 16px", background: "var(--bg-tertiary)",
                                    color: "var(--text-secondary)", border: "1px solid var(--border)",
                                    borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14
                                }}
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputStyle = {
    padding: "6px 10px", borderRadius: 6, fontSize: 14, fontWeight: 700,
    background: "var(--bg-tertiary)", border: "1px solid var(--accent)",
    color: "var(--text-primary)", width: 90, outline: "none"
};

const thStyle = () => ({
    padding: "10px 12px", textAlign: "right", fontSize: 11,
    color: "var(--text-muted)", fontWeight: 700
});
