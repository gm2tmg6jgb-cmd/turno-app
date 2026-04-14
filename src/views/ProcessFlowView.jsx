import React, { useState, useEffect } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";
import ImportView from "./ImportView";
import { TURNI } from "../data/constants";

const PROCESS_STEPS = [
    { code: "DRA", label: "Soft Turning", phase: "start_soft" },
    { code: "ZSA", label: "DMC", phase: "dmc" },
    { code: "SCA", label: "Laser Welding", phase: "laser_welding" },
    { code: "MZA", label: "UT", phase: "ut" },
    { code: "STW", label: "Shaping", phase: "shaping" },
    { code: "FRA", label: "Milling", phase: "milling" },
    { code: "RAA", label: "Broaching", phase: "broaching" },
    { code: "FRW", label: "Hobbing", phase: "hobbing" },
    { code: "EGW", label: "Deburring", phase: "deburring" },
    { code: "HOK", label: "Heat Treatment", phase: "ht" },
    { code: "OKU", label: "Shot Peening", phase: "shot_peening" },
    { code: "DRA", label: "Hard Turning", phase: "start_hard" },
    { code: "SCA", label: "Laser Welding Hard", phase: "laser_welding_2" },
    { code: "SLA", label: "Grinding Cone", phase: "grinding_cone" },
    { code: "SLW", label: "Teeth Grinding", phase: "teeth_grinding" },
    { code: "WSH", label: "Washing", phase: "washing" },
    { code: "BAA", label: "BAA", phase: "baa" }
];

const PROJECTS = ["DCT300", "8Fedct", "DCTeco"];

const TRACKED_COMPONENTS = ["SG1", "SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "RG", "FG5/7"];
const EXCLUDED_PROJECTS_BY_STEP = {
    "DRA": ["DCTeco"], 
    "ZSA": ["DCTeco", "DCT300"],
    "EGW": ["DCT300"],
    "FRA": ["DCT300"],
    "RAA": ["DCTeco", "DCT300"]
};

const DAYS_NAMES = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const SECTIONS = ["Riepilogo Settimanale", ...DAYS_NAMES];

// Specific materials for BAP1 under the DCTeco project
const BAP1_DCTECO_MATERIALS = [
    "M0162644", "M0162644/S", "M0162623", "M0162623/S",
    "M0162637", "M0162639/S", "M0162621", "M0162622/S",
    "M0162523", "M0162523/S", "M0162587", "M0162587/S",
    "M0162901", "M0162901/S"
];

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

export default function ProcessFlowView({ macchine, showToast, setCurrentView, globalDate, turnoCorrente, setTurnoCorrente }) {
    const [showImportModal, setShowImportModal] = useState(false);
    const [viewMode, setViewMode] = useState("weekly"); // "weekly" | "daily"
    const [wDate, setWDate] = useState(() => globalDate || new Date().toISOString().split("T")[0]);
    const [localTurno, setLocalTurno] = useState(turnoCorrente || "ALL");
    const [activeTab, setActiveTab] = useState("BAP1");
    const [wWeek, setWWeek] = useState(() => getCurrentWeekRange().monday);
    const [loading, setLoading] = useState(false);
    const [flowDataBySection, setFlowDataBySection] = useState({});
    const [selectedDetail, setSelectedDetail] = useState(null);

    // Sync wDate with globalDate when it changes in the sidebar
    useEffect(() => {
        if (globalDate) setWDate(globalDate);
    }, [globalDate]);

    // Sync localTurno with turnoCorrente when it changes
    useEffect(() => {
        if (turnoCorrente) setLocalTurno(turnoCorrente);
    }, [turnoCorrente]);

    // Initialize empty structures for all sections
    const getInitFlow = () => PROCESS_STEPS.map(step => {
        return {
            code: step.code,
            label: step.label,
            phase: step.phase,
            total: 0,
            components: {} // { "SG5": { value: 0, records: [] } }
        };
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch material mappings
            const { data: anagraficaRes } = await fetchAllRows(() => supabase.from("anagrafica_materiali").select("*"));
            const anagrafica = {};
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    if (row.codice) {
                        anagrafica[row.codice.toUpperCase()] = row;
                    }
                });
            }

            // 2. Fetch WC-Phases mapping to link work centers to phases
            const { data: wcFasiRes } = await fetchAllRows(() => supabase.from("wc_fasi_mapping").select("*"));
            const wcFasiMapping = wcFasiRes || [];

            // 2b. Fetch slot configurations for fallback material-based matching
            const { data: slotConfigRes } = await fetchAllRows(() => supabase.from("slot_config").select("*"));
            const matToMachineMap = {}; // material: machineId
            const matFinoToMachineMap = {}; // material+fino: machineId

            if (slotConfigRes) {
                slotConfigRes.forEach(sc => {
                    const mId = sc.macchina_id?.toUpperCase();
                    const mat = sc.codice_materiale?.toUpperCase();
                    const fino = sc.fino ? String(parseInt(sc.fino, 10)) : null;

                    if (mId && mat) {
                        // Store simple material match
                        if (!matToMachineMap[mat]) matToMachineMap[mat] = mId;
                        // Store specific material+operation match
                        if (fino) {
                            matFinoToMachineMap[`${mat}_${fino}`] = mId;
                        }
                    }
                });
            }

            const getStageFromWC = (wc, matCode) => {
                // Try wc_fasi_mapping lookup first
                if (wc && wcFasiMapping.length > 0) {
                    const wcUp = wc.toUpperCase();

                    // 1. Prima controlla i match esatti
                    for (const m of wcFasiMapping) {
                        if (m.match_type === "exact" && wcUp === m.work_center.toUpperCase()) {
                            // For DRA exact matches that might be start_soft/start_hard,
                            // use material suffix to disambiguate if needed
                            return m.fase;
                        }
                    }

                    // 2. Poi i match a prefisso — for DRA, use material suffix to pick start_soft/start_hard
                    const draMatches = [];
                    for (const m of wcFasiMapping) {
                        if (m.match_type !== "exact" && wcUp.startsWith(m.work_center.toUpperCase())) {
                            draMatches.push(m.fase);
                        }
                    }
                    if (draMatches.length === 1) return draMatches[0];
                    if (draMatches.length > 1) {
                        // Ambiguous (e.g. DRA→start_soft AND DRA→start_hard): use material suffix
                        const isSoft = matCode && matCode.endsWith("/S");
                        if (draMatches.includes("start_soft") && draMatches.includes("start_hard")) {
                            return isSoft ? "start_soft" : "start_hard";
                        }
                        return draMatches[0];
                    }
                }

                // Fallback: if no WC or not in mapping, infer from macchina_id prefix
                if (!wc) return null;
                const wcUp = wc.toUpperCase();
                const isSoft = matCode && matCode.endsWith("/S");
                if (wcUp.startsWith("DRA")) return isSoft ? "start_soft" : "start_hard";
                if (wcUp.startsWith("ZSA")) return "dmc";
                if (wcUp.startsWith("SCA")) return "laser_welding";
                if (wcUp.startsWith("MZA")) return "ut";
                if (wcUp.startsWith("STW")) return "shaping";
                if (wcUp.startsWith("FRA") || wcUp.startsWith("FRW")) return "milling";
                if (wcUp.startsWith("RAA")) return "broaching";
                if (wcUp.startsWith("EGW")) return "deburring";
                if (wcUp.startsWith("HOK")) return "ht";
                if (wcUp.startsWith("OKU")) return "shot_peening";
                if (wcUp.startsWith("SLA")) return "grinding_cone";
                if (wcUp.startsWith("SLW")) return "teeth_grinding";
                if (wcUp.startsWith("WSH")) return "washing";
                if (wcUp.startsWith("BAA")) return "baa";
                return null;
            };

            // 3. Fetch production data based on ViewMode
            let query = supabase.from("conferme_sap").select("data, materiale, work_center_sap, macchina_id, fino, qta_ottenuta, turno_id");
            let weekDaysDates = [];
            if (viewMode === "weekly") {
                weekDaysDates = getWeekDays(wWeek);
                query = query.gte("data", weekDaysDates[0]).lte("data", weekDaysDates[6]);
            } else {
                query = query.eq("data", wDate);
                // Apply turno filter in daily mode
                if (localTurno && localTurno !== "ALL") {
                    query = query.eq("turno_id", localTurno);
                }
            }
            const { data: dataRes } = await fetchAllRows(() => query);

            const SEZIONI = viewMode === "weekly"
                ? ["Riepilogo Settimanale", ...DAYS_NAMES]
                : (localTurno && localTurno !== "ALL")
                    ? [`Turno ${localTurno}`]
                    : ["Totale Giorno", "Turno A", "Turno B", "Turno C", "Turno D"];

            const newFlowData = {};
            SEZIONI.forEach(sec => {
                newFlowData[sec] = getInitFlow();
            });

            // Process records
            if (dataRes) {
                dataRes.forEach(r => {
                    if (!r.qta_ottenuta || r.qta_ottenuta <= 0) return;

                    const matCode = (r.materiale || "").toUpperCase();
                    const info = anagrafica[matCode];
                    let proj = "Other";
                    if (info && info.progetto) {
                        proj = info.progetto;
                        // Normalize project names
                        if (proj === "DCT 300") proj = "DCT300";
                        if (proj === "8Fe") proj = "8Fedct";
                        if (proj === "DCT Eco") proj = "DCTeco";
                    }

                    if (!PROJECTS.includes(proj)) return;

                    // Apply BAP1 specific filter for DCTeco
                    if (proj === "DCTeco") {
                        if (!BAP1_DCTECO_MATERIALS.includes(matCode)) {
                            return; // Skip if it's DCTeco but not in the BAP1 list
                        }
                    }

                    // Apply filter for DCT300
                    if (proj === "DCT300") {
                        if (!matCode.startsWith("2511")) {
                            return; // Only consider DCT300 codes starting with 2511
                        }
                    }

                    // Use macchina_id first (same priority as ProductionFlowReportView), fall back to work_center_sap
                    let wcField = (r.macchina_id?.trim() || r.work_center_sap?.trim() || "").toUpperCase() || null;
                    
                    // FALLBACK: If still no WC/Machine, use slot_config map by material
                    if (!wcField) {
                        const fino = r.fino ? String(parseInt(r.fino, 10)) : null;
                        if (fino && matFinoToMachineMap[`${matCode}_${fino}`]) {
                            wcField = matFinoToMachineMap[`${matCode}_${fino}`];
                        } else if (matToMachineMap[matCode]) {
                            wcField = matToMachineMap[matCode];
                        }
                    }

                    const phase = getStageFromWC(wcField || null, matCode);
                    if (!phase) return;

                    const macchinaLabel = r.work_center_sap || r.macchina_id || "";

                    const addValue = (sectionName) => {
                        const sec = newFlowData[sectionName];
                        if (!sec) return;
                        const stepIdx = sec.findIndex(s => s.phase === phase);
                        if (stepIdx !== -1) {
                            const componentName = info?.componente?.toUpperCase() || "ALTRO";
                            
                            if (!sec[stepIdx].components[componentName]) {
                                sec[stepIdx].components[componentName] = { value: 0, records: [] };
                            }
                            
                            sec[stepIdx].components[componentName].value += r.qta_ottenuta;
                            sec[stepIdx].components[componentName].records.push({
                                ...r,
                                matCode,
                                componente: componentName,
                                macchina: macchinaLabel
                            });
                            
                            sec[stepIdx].total = Object.values(sec[stepIdx].components).reduce((acc, c) => acc + c.value, 0);
                        }
                    };

                    if (viewMode === "weekly") {
                        const dayIndex = weekDaysDates.indexOf(r.data);
                        let targetSection = null;
                        if (dayIndex >= 0 && dayIndex < 6) {
                            targetSection = DAYS_NAMES[dayIndex];
                        }
                        if (targetSection) addValue(targetSection);
                        addValue("Riepilogo Settimanale");
                    } else {
                        const t_id = r.turno_id || "N/D";
                        if (localTurno && localTurno !== "ALL") {
                            // Specific turno selected: only add to that section
                            addValue(`Turno ${t_id}`);
                        } else {
                            // All turni: add to per-turno section + Totale Giorno
                            const targetSection = `Turno ${t_id}`;
                            if (!newFlowData[targetSection]) {
                                newFlowData[targetSection] = getInitFlow();
                            }
                            addValue(targetSection);
                            addValue("Totale Giorno");
                        }
                    }
                });
            }

            setFlowDataBySection(newFlowData);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wWeek, viewMode, wDate, localTurno]);

    const renderFlow = (title) => {
        const isFunctional = activeTab === "BAP1";
        const processData = (isFunctional && flowDataBySection[title]) ? flowDataBySection[title] : getInitFlow();

        return (
            <div key={title} style={{
                padding: "24px",
                backgroundColor: "var(--bg-card)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                marginBottom: "24px",
                opacity: (!isFunctional || loading) ? 0.5 : 1,
                transition: "opacity 0.2s ease",
                position: "relative"
            }}>
                {!isFunctional && (
                    <div style={{ position: "absolute", top: 10, right: 15, fontSize: 12, fontWeight: "bold", color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "4px 8px", borderRadius: 4 }}>
                        Dati non ancora disponibili per {activeTab}
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
                    <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "18px", fontWeight: "700" }}>
                        {title === "Riepilogo Settimanale" ? `📊 ${title}` : `📅 ${title}`}
                    </h2>
                </div>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    paddingBottom: "20px"
                }}>
                    {processData.map((step, index) => {
                        let valueColor = "white";

                        // confronto con step precedente
                        if (index > 0) {
                            if (step.total < processData[index - 1].total) {
                                valueColor = "#ff4d4d"; // red
                            } else {
                                valueColor = "#7CFC00"; // green
                            }
                        }

                        return (
                            <React.Fragment key={index}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                    {/* Main Box: Total per Phase */}
                                    <div
                                        style={{
                                            background: "linear-gradient(145deg, #3c6ef0, #2f5bd6)",
                                            color: "white",
                                            width: "120px",
                                            padding: "12px 8px",
                                            borderRadius: "15px",
                                            textAlign: "center",
                                            boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "center",
                                            transition: "transform 0.2s ease",
                                            cursor: step.total > 0 ? "pointer" : "default"
                                        }}
                                        onClick={() => {
                                            if (step.total > 0) {
                                                const allRecords = Object.values(step.components).reduce((acc, c) => acc.concat(c.records), []);
                                                setSelectedDetail({
                                                    title: `${title} - ${step.label} - Totale Generale`,
                                                    records: allRecords
                                                });
                                            }
                                        }}
                                        onMouseEnter={(e) => {
                                            if (step.total > 0) e.currentTarget.style.transform = "scale(1.05)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "scale(1)";
                                        }}
                                    >
                                        <div style={{ fontSize: "12px", opacity: 0.9, fontWeight: 700 }}>{step.code}</div>
                                        <div style={{ fontSize: "22px", fontWeight: "bold", margin: "4px 0", color: valueColor }}>
                                            {step.total}
                                        </div>
                                        <div style={{ fontSize: "9px", opacity: 0.9, letterSpacing: 0.5, textTransform: "uppercase" }}>{step.label}</div>
                                    </div>

                                    {/* Sub-Components Boxes: Detail per Component */}
                                    <div style={{ display: "flex", gap: "4px", width: "100%", justifyContent: "center", flexWrap: "wrap", maxWidth: "160px" }}>
                                        {Object.entries(step.components)
                                            .sort((a, b) => b[1].value - a[1].value)
                                            .slice(0, 12)
                                            .map(([name, compData], cIdx) => {
                                                const isTracked = TRACKED_COMPONENTS.includes(name);
                                                return (
                                                    <div key={cIdx}
                                                        onClick={() => {
                                                            if (compData.value > 0) {
                                                                setSelectedDetail({
                                                                    title: `${title} - ${step.label} - Componente ${name}`,
                                                                    records: compData.records
                                                                });
                                                            }
                                                        }}
                                                        style={{
                                                            background: isTracked ? "rgba(60, 110, 240, 0.1)" : "var(--bg-tertiary)",
                                                            border: isTracked ? "1px solid rgba(60, 110, 240, 0.4)" : "1px solid var(--border)",
                                                            borderRadius: "6px",
                                                            padding: "4px 2px",
                                                            textAlign: "center",
                                                            width: "48px",
                                                            cursor: compData.value > 0 ? "pointer" : "default",
                                                            transition: "all 0.2s"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (compData.value > 0) e.currentTarget.style.background = "var(--bg-hover)";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = isTracked ? "rgba(60, 110, 240, 0.1)" : "var(--bg-tertiary)";
                                                        }}
                                                    >
                                                        <div style={{ fontSize: "8px", color: isTracked ? "#3c6ef0" : "var(--text-muted)", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden" }}>{name}</div>
                                                        <div style={{ fontSize: "11px", color: "var(--text-primary)", fontWeight: 800 }}>{compData.value}</div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                {index < processData.length - 1 && (
                                    <div style={{ fontSize: "24px", color: "#3c6ef0", fontWeight: "bold", opacity: 0.5, marginTop: "-40px" }}>
                                        →
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fade-in" style={{ height: "100%", overflowY: "auto", padding: "16px 20px", paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                    {viewMode === "weekly" ? "Analisi Flusso Settimanale" : "Analisi Flusso Giornaliero"}
                </h1>

                {/* View Mode Toggle */}
                <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                    <button
                        onClick={() => setViewMode("weekly")}
                        style={{
                            padding: "6px 16px", background: viewMode === "weekly" ? "var(--bg-card)" : "transparent",
                            color: viewMode === "weekly" ? "var(--text-primary)" : "var(--text-muted)",
                            border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px",
                            boxShadow: viewMode === "weekly" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", cursor: "pointer", transition: "all 0.2s ease"
                        }}
                    >
                        Settimanale
                    </button>
                    <button
                        onClick={() => setViewMode("daily")}
                        style={{
                            padding: "6px 16px", background: viewMode === "daily" ? "var(--bg-card)" : "transparent",
                            color: viewMode === "daily" ? "var(--text-primary)" : "var(--text-muted)",
                            border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "14px",
                            boxShadow: viewMode === "daily" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", cursor: "pointer", transition: "all 0.2s ease"
                        }}
                    >
                        Giornaliero
                    </button>
                </div>
            </div>

            {/* Tabs per Reparto */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", borderBottom: "1px solid var(--border)" }}>
                {["BAP1", "BAP2", "BAP3"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "10px 20px",
                            border: "none",
                            borderBottom: activeTab === tab ? "3px solid #3c6ef0" : "3px solid transparent",
                            background: "transparent",
                            color: activeTab === tab ? "#3c6ef0" : "var(--text-muted)",
                            fontWeight: activeTab === tab ? "700" : "600",
                            fontSize: "15px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}
                    >
                        {tab}
                        {tab !== "BAP1" && <span style={{ fontSize: "10px", opacity: 0.6, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "10px" }}>Presto</span>}
                    </button>
                ))}
            </div>

            {/* Navigazione date */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                {viewMode === "weekly" ? (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const d = new Date(wWeek + "T12:00:00");
                            d.setDate(d.getDate() - 7);
                            setWWeek(d.toISOString().split("T")[0]);
                        }}>← Prec.</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", background: "var(--bg-tertiary)", padding: "6px 12px", borderRadius: "8px" }}>
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
                    </>
                ) : (
                    <>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const d = new Date(wDate + "T12:00:00");
                            d.setDate(d.getDate() - 1);
                            setWDate(d.toISOString().split("T")[0]);
                        }}>← Prec.</button>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", background: "var(--bg-tertiary)", padding: "6px 12px", borderRadius: "8px" }}>
                            {new Date(wDate + "T12:00:00").toLocaleDateString("it-IT", { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                            const d = new Date(wDate + "T12:00:00");
                            d.setDate(d.getDate() + 1);
                            setWDate(d.toISOString().split("T")[0]);
                        }}>Succ. →</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setWDate(new Date().toISOString().split("T")[0])}>Oggi</button>
                        {/* Filtro turno in modalità giornaliera */}
                        <select
                            value={localTurno}
                            onChange={(e) => {
                                setLocalTurno(e.target.value);
                                if (setTurnoCorrente) setTurnoCorrente(e.target.value !== "ALL" ? e.target.value : turnoCorrente);
                            }}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border)",
                                background: localTurno !== "ALL" ? "var(--accent-muted)" : "var(--bg-tertiary)",
                                color: localTurno !== "ALL" ? "var(--accent)" : "var(--text-primary)",
                                fontWeight: "700",
                                fontSize: "13px",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            <option value="ALL">Tutti i turni</option>
                            {TURNI.map(t => (
                                <option key={t.id} value={t.id}>Turno {t.id} — {t.coordinatore}</option>
                            ))}
                        </select>
                    </>
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowImportModal(true)}>
                        {Icons.upload} Importa SAP
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
                        {Icons.history} Aggiorna
                    </button>
                </div>
            </div>

            {Object.keys(flowDataBySection).map(section => renderFlow(section))}

            {selectedDetail && (() => {
                // Raggruppa i record per data, macchina e codice materiale (ignorando il turno_id nel weekly mode)
                const grouped = selectedDetail.records.reduce((acc, r) => {
                    const t_id = viewMode === "daily" ? (r.turno_id || "N/D") : null;
                    const key = viewMode === "daily" ? `${r.data}_${t_id}_${r.macchina}_${r.matCode}` : `${r.data}_${r.macchina}_${r.matCode}`;

                    if (!acc[key]) {
                        acc[key] = { ...r, turno: t_id };
                    } else {
                        acc[key].qta_ottenuta += r.qta_ottenuta;
                    }
                    return acc;
                }, {});

                // Converti in array e ordina
                const displayRecords = Object.values(grouped).sort((a, b) => {
                    if (a.data !== b.data) return b.data.localeCompare(a.data);
                    if (viewMode === "daily" && a.turno !== b.turno) return (a.turno || "").localeCompare(b.turno || "");
                    return (a.macchina || "").localeCompare(b.macchina || "");
                });

                return (
                    <div style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
                        display: "flex", justifyContent: "center", alignItems: "center",
                        backdropFilter: "blur(4px)"
                    }} onClick={() => setSelectedDetail(null)}>
                        <div style={{
                            background: "var(--bg-card)",
                            borderRadius: "16px",
                            width: "90%",
                            maxWidth: "600px",
                            maxHeight: "80vh",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                            border: "1px solid var(--border)"
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ margin: 0, fontSize: "18px", color: "var(--text-primary)" }}>{selectedDetail.title}</h3>
                                <button onClick={() => setSelectedDetail(null)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
                            </div>
                            <div style={{ padding: "20px 24px", overflowY: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-tertiary)" }}>
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", borderRadius: "6px 0 0 6px" }}>Data</th>
                                            {viewMode === "daily" && <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Turno</th>}
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Macchina</th>
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Codice / Mat.</th>
                                            <th style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)", borderRadius: "0 6px 6px 0" }}>Q.tà Totale</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayRecords.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ padding: "10px", fontSize: "13px" }}>{new Date(r.data).toLocaleDateString("it-IT")}</td>
                                                {viewMode === "daily" && <td style={{ padding: "10px", fontSize: "13px" }}>{r.turno}</td>}
                                                <td style={{ padding: "10px", fontSize: "13px", fontWeight: "bold" }}>{r.macchina}</td>
                                                <td style={{ padding: "10px", fontSize: "13px" }}>{r.matCode}</td>
                                                <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", textAlign: "right", color: "#3c6ef0" }}>{r.qta_ottenuta}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {showImportModal && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1100,
                    display: "flex", justifyContent: "center", alignItems: "center",
                    backdropFilter: "blur(4px)"
                }} onClick={() => { setShowImportModal(false); fetchData(); }}>
                    <div style={{
                        background: "var(--bg)",
                        borderRadius: "16px",
                        width: "90%",
                        maxWidth: "900px",
                        maxHeight: "90vh",
                        overflowY: "auto",
                        position: "relative",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                        border: "1px solid var(--border)"
                    }} onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => { setShowImportModal(false); fetchData(); }}
                            style={{ 
                                position: "absolute", top: 15, right: 20, 
                                background: "var(--bg-tertiary)", border: "none", 
                                fontSize: "16px", cursor: "pointer", 
                                color: "var(--text-muted)", borderRadius: "50%",
                                width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                                zIndex: 10
                            }}
                        >✕</button>
                        <div style={{ padding: "10px 0" }}>
                            <ImportView 
                                macchine={macchine} 
                                showToast={showToast} 
                                setCurrentView={(view) => {
                                    setShowImportModal(false);
                                    if(setCurrentView) setCurrentView(view);
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
