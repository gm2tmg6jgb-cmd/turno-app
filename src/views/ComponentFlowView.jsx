import React, { useState, useEffect, useMemo } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";
import { TURNI } from "../data/constants";

const PROCESS_STEPS = [
    { id: "start_soft", label: "Soft Turning", code: "DRA" },
    { id: "dmc", label: "DMC", code: "ZSA" },
    { id: "laser_welding", label: "Saldatura Soft", code: "SCA" },
    { id: "ut", label: "UT", code: "MZA" },
    { id: "shaping", label: "Stozzatura", code: "STW" },
    { id: "milling", label: "Fresatura", code: "FRA" },
    { id: "broaching", label: "Brocciatura", code: "RAA" },
    { id: "hobbing", label: "Dentatura", code: "FRW" },
    { id: "deburring", label: "Sbavatura", code: "EGW" },
    { id: "ht", label: "Trattamento Termico", code: "HOK" },
    { id: "shot_peening", label: "Pallinatura", code: "OKU" },
    { id: "start_hard", label: "Tornitura Hard", code: "DRA" },
    { id: "laser_welding_2", label: "Saldatura Hard", code: "SCA" },
    { id: "grinding_cone", label: "Rettifica Cono", code: "SLA" },
    { id: "teeth_grinding", label: "Rettifica Denti", code: "SLW" },
    { id: "washing", label: "Lavaggio", code: "WSH" }
];

const PROJECTS = ["DCT300", "8 FE", "DCT ECO"];

const PROJECT_COMPONENTS = {
    "DCT300": ["SG1", "DG-REV", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "SGR", "RG"],
    "8 FE": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7", "RG FD1", "RG FD2", "DH TORNITURA", "DH ASSEMBLAGGIO", "DH SALDATURA"],
    "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "FD1", "FD2"]
};

const EXCLUDED_PHASES = {
    "DCT300": ["dmc", "milling", "broaching", "deburring"],
    "8 FE": [],
    "DCT ECO": ["start_soft", "dmc", "broaching"]
};

export default function ComponentFlowView({ macchine, showToast, globalDate, turnoCorrente }) {
    const [viewMode, setViewMode] = useState("weekly"); // "weekly" | "daily"
    const [wWeek, setWWeek] = useState(() => {
        const range = getCurrentWeekRange();
        const monday = new Date(range.monday + "T12:00:00");
        const today = new Date();
        if (today.getDay() === 1 || today.getDay() === 2) {
            monday.setDate(monday.getDate() - 7);
        }
        return monday.toISOString().split("T")[0];
    });
    const [wDate, setWDate] = useState(() => globalDate || new Date().toISOString().split("T")[0]);
    const [activeProject, setActiveProject] = useState("DCT300");
    const [localTurno, setLocalTurno] = useState(turnoCorrente || "ALL");
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState({}); // { componentId: { phaseId: { value, records } } }
    const [components, setComponents] = useState([]); // List of components for active project
    const [selectedDetail, setSelectedDetail] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch anagrafica
            const { data: anagraficaRes } = await fetchAllRows(() => supabase.from("anagrafica_materiali").select("*"));
            const anagrafica = {};
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    if (row.codice) anagrafica[row.codice.toUpperCase()] = row;
                });
            }

            // 2. Fetch WC-Phases mapping
            const { data: wcFasiRes } = await fetchAllRows(() => supabase.from("wc_fasi_mapping").select("*"));
            const wcFasiMapping = wcFasiRes || [];

            const getPhaseFromWC = (wc, matCode) => {
                const wcUp = (wc || "").toUpperCase();
                if (!wcUp) return null;

                // Simple prefix/exact matching similar to ProcessFlowView
                for (const m of wcFasiMapping) {
                    if (m.match_type === "exact" && wcUp === m.work_center.toUpperCase()) return m.fase;
                }
                const matches = wcFasiMapping.filter(m => m.match_type !== "exact" && wcUp.startsWith(m.work_center.toUpperCase()));
                if (matches.length === 1) return matches[0].fase;
                if (matches.length > 1) {
                    const isSoft = matCode && matCode.endsWith("/S");
                    const found = matches.find(m => isSoft ? m.fase === "start_soft" : m.fase === "start_hard");
                    return found ? found.fase : matches[0].fase;
                }

                // Hardcoded fallback
                const isSoft = matCode && matCode.endsWith("/S");
                if (wcUp.startsWith("DRA")) return isSoft ? "start_soft" : "start_hard";
                if (wcUp.startsWith("ZSA")) return "dmc";
                if (wcUp.startsWith("SCA")) return isSoft ? "laser_welding" : "laser_welding_2";
                if (wcUp.startsWith("MZA")) return "ut";
                if (wcUp.startsWith("STW")) return "shaping";
                if (wcUp.startsWith("FRA")) return "milling"; // Fresatura
                if (wcUp.startsWith("FRW")) return "hobbing"; // Dentatura
                if (wcUp.startsWith("RAA")) return "broaching";
                if (wcUp.startsWith("EGW")) return "deburring";
                if (wcUp.startsWith("SLA")) return "grinding_cone";
                if (wcUp.startsWith("SLW")) return "teeth_grinding";
                if (wcUp.startsWith("WSH")) return "washing";
                return null;
            };

            // 3. Fetch production data
            let q = supabase.from("conferme_sap")
                    .select("data, materiale, work_center_sap, macchina_id, qta_ottenuta, turno_id");
            
            if (viewMode === "weekly") {
                const monday = new Date(wWeek + "T00:00:00");
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                q = q.gte("data", monday.toISOString().split("T")[0])
                     .lte("data", sunday.toISOString().split("T")[0]);
            } else {
                q = q.eq("data", wDate);
            }
            
            if (localTurno && localTurno !== "ALL") {
                q = q.eq("turno_id", localTurno);
            }

            const { data: prodRes } = await fetchAllRows(() => q);

            const newMatrix = {};
            const projectComponents = new Set();

            if (prodRes) {
                prodRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase();
                    const info = anagrafica[matCode];
                    if (!info) return;

                    let proj = info.progetto || "Other";
                    if (proj === "DCT 300") proj = "DCT300";
                    if (proj === "8Fe") proj = "8 FE";
                    if (proj === "8Fedct") proj = "8 FE";
                    if (proj === "DCT Eco") proj = "DCT ECO";
                    if (proj === "DCTeco") proj = "DCT ECO";

                    if (proj !== activeProject) return;

                    let comp = (info.componente || "ALTRO").toUpperCase();
                    // Normalizzazione minima per match più robusto (es. DG-REV = DG-RE)
                    if (comp === "SG2-REV") comp = "DG-REV"; 

                    projectComponents.add(comp);

                    const wc = (r.macchina_id || r.work_center_sap || "").toUpperCase();
                    const phase = getPhaseFromWC(wc, matCode);
                    if (!phase) return;

                    if (!newMatrix[comp]) newMatrix[comp] = {};
                    if (!newMatrix[comp][phase]) newMatrix[comp][phase] = { value: 0, records: [] };
                    
                    newMatrix[comp][phase].value += (r.qta_ottenuta || 0);
                    newMatrix[comp][phase].records.push({
                        ...r,
                        matCode,
                        macchina: wc
                    });
                });
            }

            setMatrixData(newMatrix);
            
            const fixedList = PROJECT_COMPONENTS[activeProject] || [];
            const foundOthers = Array.from(projectComponents)
                .filter(c => !fixedList.includes(c))
                .sort();
            
            setComponents([...fixedList, ...foundOthers]);

        } catch (err) {
            console.error(err);
            if (showToast) showToast("Errore caricamento dati flusso", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [wWeek, wDate, viewMode, activeProject, localTurno]);

    useEffect(() => {
        if (turnoCorrente) setLocalTurno(turnoCorrente);
    }, [turnoCorrente]);

    useEffect(() => {
        if (globalDate) setWDate(globalDate);
    }, [globalDate]);

    const visibleSteps = useMemo(() => {
        const exclusions = EXCLUDED_PHASES[activeProject] || [];
        return PROCESS_STEPS.filter(step => !exclusions.includes(step.id));
    }, [activeProject]);

    return (
        <div className="fade-in" style={{ padding: "20px", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div>
                    <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                        {viewMode === "weekly" ? "Avanzamento Componenti Settimanale" : "Avanzamento Componenti Giornaliero"}
                    </h1>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {/* View Mode Toggle */}
                    <div style={{ display: "flex", background: "var(--bg-tertiary)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                        <button
                            onClick={() => setViewMode("weekly")}
                            style={{
                                padding: "6px 16px", background: viewMode === "weekly" ? "var(--bg-card)" : "transparent",
                                color: viewMode === "weekly" ? "var(--text-primary)" : "var(--text-muted)",
                                border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "13px",
                                boxShadow: viewMode === "weekly" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", cursor: "pointer", transition: "all 0.2s ease"
                            }}
                        >
                            Settimana
                        </button>
                        <button
                            onClick={() => setViewMode("daily")}
                            style={{
                                padding: "6px 16px", background: viewMode === "daily" ? "var(--bg-card)" : "transparent",
                                color: viewMode === "daily" ? "var(--text-primary)" : "var(--text-muted)",
                                border: "none", borderRadius: "6px", fontWeight: "600", fontSize: "13px",
                                boxShadow: viewMode === "daily" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", cursor: "pointer", transition: "all 0.2s ease"
                            }}
                        >
                            Giorno
                        </button>
                    </div>

                    <select
                        value={localTurno}
                        onChange={(e) => setLocalTurno(e.target.value)}
                        style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border)",
                            background: localTurno !== "ALL" ? "var(--accent-muted)" : "var(--bg-tertiary)",
                            color: localTurno !== "ALL" ? "var(--accent)" : "var(--text-primary)",
                            fontWeight: "700",
                            fontSize: "14px",
                            cursor: "pointer",
                            outline: "none"
                        }}
                    >
                        <option value="ALL">Tutti i turni</option>
                        {TURNI.map(t => (
                            <option key={t.id} value={t.id}>Turno {t.id}</option>
                        ))}
                    </select>

                    {viewMode === "weekly" ? (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                const d = new Date(wWeek + "T12:00:00");
                                d.setDate(d.getDate() - 7);
                                setWWeek(d.toISOString().split("T")[0]);
                            }}>←</button>
                            <span style={{ fontWeight: "700", background: "var(--bg-tertiary)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>
                                {new Date(wWeek + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                            </span>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                const d = new Date(wWeek + "T12:00:00");
                                d.setDate(d.getDate() + 7);
                                setWWeek(d.toISOString().split("T")[0]);
                            }}>→</button>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                const d = new Date(wDate + "T12:00:00");
                                d.setDate(d.getDate() - 1);
                                setWDate(d.toISOString().split("T")[0]);
                            }}>←</button>
                            <span style={{ fontWeight: "700", background: "var(--bg-tertiary)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px" }}>
                                {new Date(wDate + "T12:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                            </span>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                                const d = new Date(wDate + "T12:00:00");
                                d.setDate(d.getDate() + 1);
                                setWDate(d.toISOString().split("T")[0]);
                            }}>→</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Project Tabs */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "30px", borderBottom: "1px solid var(--border)" }}>
                {PROJECTS.map(p => (
                    <button
                        key={p}
                        onClick={() => setActiveProject(p)}
                        style={{
                            padding: "12px 24px",
                            background: "transparent",
                            border: "none",
                            borderBottom: activeProject === p ? "3px solid #3c6ef0" : "3px solid transparent",
                            color: activeProject === p ? "#3c6ef0" : "var(--text-muted)",
                            fontWeight: activeProject === p ? "800" : "600",
                            fontSize: "16px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                        }}
                    >
                        {p}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: "center", padding: "100px", color: "var(--text-muted)" }}>{Icons.loading} Caricamento flussi in corso...</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {components.length === 0 ? (
                        <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                            Nessun dato di produzione trovato per il progetto {activeProject} in questa settimana.
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <div style={{ minWidth: "fit-content", padding: "10px" }}>
                                {/* Table Header - Phases */}
                                <div style={{ display: "flex", marginBottom: "20px", paddingLeft: "150px" }}>
                                    {visibleSteps.map((step, idx) => (
                                        <div key={idx} style={{ width: "100px", textAlign: "center", flexShrink: 0, position: "relative" }}>
                                            <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{step.label}</div>
                                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#3c6ef0", marginTop: "4px" }}>{step.code}</div>
                                            {idx < visibleSteps.length - 1 && (
                                                <div style={{ position: "absolute", right: -15, top: "50%", color: "var(--border)", fontWeight: "bold" }}>→</div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Component Rows */}
                                {components.map(comp => (
                                    <div key={comp} style={{ display: "flex", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-light)", paddingBottom: "12px" }}>
                                        {/* Component Label */}
                                        <div style={{ width: "150px", flexShrink: 0, fontWeight: "800", fontSize: "15px", color: "var(--text-primary)" }}>
                                            {comp}
                                        </div>

                                        {/* Process Boxes */}
                                        <div style={{ display: "flex", gap: "0px" }}>
                                            {visibleSteps.map((step, idx) => {
                                                const data = matrixData[comp]?.[step.id];
                                                const qty = data?.value || 0;
                                                return (
                                                    <div key={idx} style={{ width: "100px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                                                        <div 
                                                            onClick={() => {
                                                                if (qty > 0) {
                                                                    setSelectedDetail({
                                                                        title: `${comp} - ${step.label}`,
                                                                        records: data.records
                                                                    });
                                                                }
                                                            }}
                                                            style={{
                                                            width: "80px",
                                                            height: "50px",
                                                            background: qty > 0 ? "linear-gradient(135deg, #3c6ef0, #1e40af)" : "var(--bg-tertiary)",
                                                            borderRadius: "10px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: qty > 0 ? "white" : "var(--text-muted)",
                                                            border: qty > 0 ? "none" : "1px dashed var(--border)",
                                                            boxShadow: qty > 0 ? "0 4px 10px rgba(60, 110, 240, 0.2)" : "none",
                                                            opacity: qty > 0 ? 1 : 0.4,
                                                            transition: "all 0.2s",
                                                            cursor: qty > 0 ? "pointer" : "default"
                                                        }}>
                                                            <div style={{ fontSize: "14px", fontWeight: "900" }}>{qty || "—"}</div>
                                                            {qty > 0 && <div style={{ fontSize: "8px", fontWeight: "700", opacity: 0.8 }}>PEZZI</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedDetail && (
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
                                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Turno</th>
                                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Macchina</th>
                                        <th style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)", borderRadius: "0 6px 6px 0" }}>Q.tà</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDetail.records.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "10px", fontSize: "13px" }}>{new Date(r.data).toLocaleDateString("it-IT")}</td>
                                            <td style={{ padding: "10px", fontSize: "13px" }}>{r.turno_id}</td>
                                            <td style={{ padding: "10px", fontSize: "13px", fontWeight: "bold" }}>{r.macchina}</td>
                                            <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", textAlign: "right", color: "#3c6ef0" }}>{r.qta_ottenuta}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
