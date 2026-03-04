import React, { useState, useEffect } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";

const PROCESS_STEPS = [
    { code: "DRA", label: "Soft Turning", phase: "start_soft" },
    { code: "ZSA", label: "DMC", phase: "dmc" },
    { code: "SCA", label: "Laser Welding", phase: "laser_welding" },
    { code: "MZA", label: "UT", phase: "ut" },
    { code: "SHP", label: "Shaping", phase: "shaping" },
    { code: "FRA", label: "Milling", phase: "milling" },
    { code: "BRC", label: "Broaching", phase: "broaching" },
    { code: "FRW", label: "Hobbing", phase: "hobbing" },
    { code: "EGW", label: "Deburring", phase: "deburring" },
    { code: "HOK", label: "Heat Treatment", phase: "ht" },
    { code: "OKU", label: "Shot Peening", phase: "shot_peening" },
    { code: "DRA", label: "Hard Turning", phase: "start_hard" },
    { code: "SLA", label: "Grinding Cone", phase: "grinding_cone" },
    { code: "SLW", label: "Teeth Grinding", phase: "teeth_grinding" },
    { code: "WSH", label: "Washing", phase: "washing" }
];

const PROJECTS = ["DCT300", "8Fedct", "DCTeco"];

// Mapping of step codes to an array of project names that should NOT be displayed
const EXCLUDED_PROJECTS_BY_STEP = {
    "DRA": ["DCTeco"], // previously ST
    "ZSA": ["DCTeco", "DCT300"], // previously DMC
    "EGW": ["DCT300"], // previously DBR
    "FRA": ["DCT300"], // previously MIL
    "BRC": ["DCTeco", "DCT300"]
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

export default function ProcessFlowView() {
    const [activeTab, setActiveTab] = useState("BAP1");
    const [wWeek, setWWeek] = useState(() => getCurrentWeekRange().monday);
    const [loading, setLoading] = useState(false);
    const [flowDataBySection, setFlowDataBySection] = useState({});

    // Initialize empty structures for all sections
    const getInitFlow = () => PROCESS_STEPS.map(step => {
        const exclusions = EXCLUDED_PROJECTS_BY_STEP[step.code] || [];
        return {
            code: step.code,
            label: step.label,
            phase: step.phase,
            total: 0,
            projects: PROJECTS
                .filter(p => !exclusions.includes(p))
                .map(p => ({ name: p, value: 0 }))
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

            // 3. Fetch week's production data
            const weekDaysDates = getWeekDays(wWeek);
            const { data: dataRes } = await fetchAllRows(() =>
                supabase.from("conferme_sap")
                    .select("data, materiale, work_center_sap, qta_ottenuta")
                    .gte("data", weekDaysDates[0])
                    .lte("data", weekDaysDates[6])
            );

            const newFlowData = {
                "Riepilogo Settimanale": getInitFlow(),
                "Lunedì": getInitFlow(),
                "Martedì": getInitFlow(),
                "Mercoledì": getInitFlow(),
                "Giovedì": getInitFlow(),
                "Venerdì": getInitFlow(),
                "Sabato": getInitFlow()
            };

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

                    const phase = getStageFromWC(r.work_center_sap);
                    if (!phase) return;

                    const dayIndex = weekDaysDates.indexOf(r.data);
                    let targetSection = null;
                    if (dayIndex >= 0 && dayIndex < 6) {
                        targetSection = DAYS_NAMES[dayIndex];
                    }

                    const addValue = (sectionName) => {
                        const sec = newFlowData[sectionName];
                        const stepIdx = sec.findIndex(s => s.phase === phase);
                        if (stepIdx !== -1) {
                            const projIdx = sec[stepIdx].projects.findIndex(p => p.name === proj);
                            if (projIdx !== -1) {
                                sec[stepIdx].projects[projIdx].value += r.qta_ottenuta;
                                sec[stepIdx].total = sec[stepIdx].projects.reduce((acc, p) => acc + p.value, 0);
                            }
                        }
                    };

                    if (targetSection) addValue(targetSection);
                    addValue("Riepilogo Settimanale");
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
    }, [wWeek]);

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
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                    {/* Main Box */}
                                    <div
                                        style={{
                                            background: "linear-gradient(145deg, #3c6ef0, #2f5bd6)",
                                            color: "white",
                                            width: "110px",
                                            padding: "10px 8px",
                                            borderRadius: "15px",
                                            textAlign: "center",
                                            boxShadow: "0 8px 18px rgba(0,0,0,0.15)",
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "center",
                                            transition: "transform 0.2s ease",
                                            cursor: "default"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                                    >
                                        <div style={{ fontSize: "12px", opacity: 0.9, fontWeight: 700 }}>{step.code}</div>
                                        <div style={{ fontSize: "22px", fontWeight: "bold", margin: "4px 0", color: valueColor }}>
                                            {step.total}
                                        </div>
                                        <div style={{ fontSize: "9px", opacity: 0.9, letterSpacing: 0.5, textTransform: "uppercase" }}>{step.label}</div>
                                    </div>

                                    {/* Sub-Projects Boxes */}
                                    <div style={{ display: "flex", gap: "6px", width: "100%", justifyContent: "center" }}>
                                        {step.projects.map((proj, pIdx) => (
                                            <div key={pIdx} style={{
                                                background: "var(--bg-tertiary)",
                                                border: "1px solid var(--border)",
                                                borderRadius: "8px",
                                                padding: "6px 2px",
                                                textAlign: "center",
                                                flex: 1,
                                                minWidth: 0
                                            }}>
                                                <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={proj.name}>{proj.name}</div>
                                                <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 800 }}>{proj.value}</div>
                                            </div>
                                        ))}
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
                    Analisi Flusso Settimanale
                </h1>
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

            {/* Navigazione settimana */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
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
                <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading} style={{ marginLeft: "auto" }}>
                    {Icons.history} Aggiorna
                </button>
            </div>

            {SECTIONS.map(section => renderFlow(section))}
        </div>
    );
}
