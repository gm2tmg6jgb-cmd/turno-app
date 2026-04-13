import React, { useState, useEffect, useMemo } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";
import { TURNI } from "../data/constants";

// --- LOCAL ANAGRAFICA (Single Source of Truth) ---
const LOCAL_ANAGRAFICA = {
    "M0153401/S": { comp: "SG3", proj: "8Fe" },
    "M0153401": { comp: "SG3", proj: "8Fe" },
    "M0153389/S": { comp: "SG3", proj: "DCT300" },
    "M0153384/S": { comp: "DG", proj: "DCT300" },
    "M0153384": { comp: "DG", proj: "DCT300" },
    "M0192963/S": { comp: "SG3", proj: "DCT ECO" },
    "M0192963": { comp: "SG3", proj: "DCT ECO" },
    "M0140997/S": { comp: "SG2", proj: "DCT ECO" },
    "M0140997": { comp: "SG2", proj: "DCT ECO" },
    "2516272835": { comp: "SG1", proj: "DCT300" },
    "2516107836": { comp: "SG1", proj: "DCT300" },
    "M0162583": { comp: "SG4", proj: "8Fe" },
    "M0162623": { comp: "SG5", proj: "8Fe" }
};

const PROCESS_STEPS = [
    { id: "start_soft", label: "Soft Turning", code: "DRA" },
    { id: "dmc", label: "DMC", code: "ZSA" },
    { id: "laser_welding", label: "Saldatura Soft", code: "SCA" },
    { id: "laser_welding_soft_2", label: "Saldatura Soft 2", code: "SCA" },
    { id: "shaping", label: "Stozzatura", code: "STW" },
    { id: "milling", label: "Fresatura", code: "FRA" },
    { id: "broaching", label: "Brocciatura", code: "RAA" },
    { id: "hobbing", label: "Dentatura", code: "FRW" },
    { id: "deburring", label: "Sbavatura", code: "EGW" },
    { id: "ht", label: "Trattamento Termico", code: "HOK" },
    { id: "shot_peening", label: "Pallinatura", code: "OKU" },
    { id: "start_hard", label: "Tornitura Hard", code: "TH" },
    { id: "laser_welding_2", label: "Saldatura Hard", code: "SCA" },
    { id: "ut", label: "UT", code: "MZA" },
    { id: "grinding_cone", label: "Rettifica Cono", code: "SLA" },
    { id: "teeth_grinding", label: "Rettifica Denti", code: "SLW" },
    { id: "washing", label: "Lavaggio", code: "WSH" }
];

const PROJECTS = ["DCT300", "DCT ECO", "8Fe", "RG + DH"];

const PROJECT_COMPONENTS = {
    "DCT300": ["SG1", "DG-REV", "DG", "SG3", "SG4", "SG5", "SG6", "SG7", "SGR", "RG"],
    "8Fe": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7"],
    "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"],
    "RG + DH": ["RG FD1", "RG FD2", "DH TORNITURA", "DH ASSEMBLAGGIO", "DH SALDATURA"]
};

// Daily targets (standard)
const PROJECT_TARGETS = {
    "DCT300": 450,
    "8Fe": 800,
    "DCT ECO": 600,
    "RG + DH": 200
};

const EXCLUDED_PHASES = {
    "DCT300": ["dmc", "broaching"], // milling tolto dalle globali per attivazione selettiva su SG4
    "8Fe": [],
    "DCT ECO": ["start_soft", "dmc", "broaching", "laser_welding_soft_2"],
    "RG + DH": ["shaping", "broaching", "laser_welding_soft_2", "milling", "ut", "grinding_cone", "laser_welding", "start_hard"]
};

const COMPONENT_EXCLUSIONS = {
    "SG1": ["start_soft", "ut", "shaping", "grinding_cone", "laser_welding_2", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "DG-REV": [
        "start_hard", "dmc", "laser_welding", "laser_welding_2", "ut", "shaping",
        "milling", "broaching", "deburring", "grinding_cone", "teeth_grinding",
        "washing", "ht", "assembly", "welding", "quality", "shot_peening", "laser_welding_soft_2"
    ],
    "DG": ["shaping", "laser_welding_2", "ut", "start_hard", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "SG3": ["shaping", "laser_welding", "laser_welding_2", "ut", "milling", "broaching", "shot_peening"],
    "SG4": ["laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "broaching", "shot_peening"],
    "SG7": ["laser_welding", "laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "milling", "broaching", "shaping", "shot_peening", "start_hard"],
    "SGR": ["shaping", "laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "RG": ["shaping", "laser_welding", "laser_welding_2", "ut", "laser_welding_soft_2", "milling", "broaching"], // shot_peening VISIBILE
    "SG5": ["laser_welding", "laser_welding_2", "shaping", "shot_peening", "laser_welding_soft_2", "milling", "broaching"],
    "SG6": ["laser_welding", "laser_welding_2", "shaping", "shot_peening", "deburring", "laser_welding_soft_2", "milling", "broaching", "start_hard"],
    "SG2": ["shaping", "milling", "broaching", "laser_welding_2", "ut", "grinding_cone", "laser_welding_soft_2"],
    "PG": ["shaping", "laser_welding", "laser_welding_2", "ut", "deburring", "milling", "laser_welding_soft_2", "start_hard", "grinding_cone", "shot_peening"],
    "FG5/7": ["shaping", "laser_welding", "laser_welding_2", "ut", "milling", "laser_welding_soft_2", "start_hard", "grinding_cone", "broaching"], // shot_peening VISIBILE
    "SG8": ["milling", "broaching", "shaping", "deburring", "shot_peening", "start_hard", "laser_welding_2", "ut"],
    "DH SALDATURA": ["start_hard"],
    "RG FD1": ["laser_welding", "shaping", "milling", "broaching", "laser_welding_2", "ut", "grinding_cone"],
    "RG FD2": ["laser_welding", "shaping", "milling", "broaching", "laser_welding_2", "ut", "grinding_cone"]
};

const MATERIAL_PHASE_OVERRIDES = [
    { mat: "2511108150/S", fino: "0060", phase: "laser_welding" },
    { mat: "2511108150/S", fino: "0090", phase: "hobbing" },
    { mat: "2511108150/T", phase: "ht" },
    { mat: "2511108150", fino: "0100", phase: "shot_peening" },
    { mat: "2511108150", fino: "0110", phase: "shot_peening" },
    { mat: "2511108150", fino: "0120", phase: "start_hard" },
    { mat: "2511108150", fino: "0230", phase: "teeth_grinding" },
    { mat: "2511108150", fino: "0250", phase: "washing" },
    { mat: "M0153389/S", fino: "0020", phase: "start_soft" },
    { mat: "M0153389/S", fino: "0025", phase: "dmc" },
    { mat: "M0153389/S", fino: "0050", phase: "dmc" },
    { mat: "M0153401/S", fino: "0020", phase: "start_soft" },
    { mat: "M0153401/S", fino: "0025", phase: "dmc" },
    { mat: "M0153401", fino: "0025", phase: "dmc" }
];

const MACHINE_PHASE_OVERRIDES = {
    "HOK11001": "ht"
};

export default function ComponentFlowView({ macchine, showToast, globalDate, turnoCorrente }) {
    const [viewMode, setViewMode] = useState("daily"); // "weekly" | "daily"
    const [targetOverrides, setTargetOverrides] = useState(() => {
        const saved = localStorage.getItem("bap_target_overrides");
        return saved ? JSON.parse(saved) : PROJECT_TARGETS;
    });
    const [targetModal, setTargetModal] = useState(null); // { project: string, value: number }

    const [wWeek, setWWeek] = useState(() => {
        const range = getCurrentWeekRange();
        return range.monday;
    });
    const [wDate, setWDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [activeProject, setActiveProject] = useState("DCT300"); // used only for modal context
    const [localTurno, setLocalTurno] = useState(turnoCorrente || "ALL");
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState({});
    const [componentsByProject, setComponentsByProject] = useState({});
    const [compMappings, setCompMappings] = useState({});
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [quickConfigModal, setQuickConfigModal] = useState(null); // { project, comp, phase }
    const [dynamicOverrides, setDynamicOverrides] = useState([]);
    const [refreshTick, setRefreshTick] = useState(0);

    const toLocalDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch anagrafica
            const { data: anagraficaRes } = await fetchAllRows(() => supabase.from("anagrafica_materiali").select("*"));
            const anagrafica = {};
            
            // First, load from LOCAL_ANAGRAFICA (Priority)
            Object.entries(LOCAL_ANAGRAFICA).forEach(([mat, info]) => {
                anagrafica[mat.toUpperCase()] = { 
                    codice: mat.toUpperCase(), 
                    componente: info.comp.toUpperCase(), 
                    progetto: info.proj 
                };
            });

            const compToMats = {}; // { COMP: [mat1, mat2, ...] }
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    const c = (row.codice || "").toUpperCase();
                    const comp = (row.componente || "").toUpperCase();
                    // Don't overwrite LOCAL_ANAGRAFICA items
                    if (c && !anagrafica[c]) anagrafica[c] = row;
                });
            }

            // Build component mapping for UI dropdowns
            Object.values(anagrafica).forEach(row => {
                const c = row.codice.toUpperCase();
                const comp = row.componente.toUpperCase();
                if (!compToMats[comp]) compToMats[comp] = [];
                if (!compToMats[comp].includes(c)) compToMats[comp].push(c);
            });
            
            setCompMappings(compToMats);

            // 2. Fetch WC-Phases mapping
            const { data: wcFasiRes } = await fetchAllRows(() => supabase.from("wc_fasi_mapping").select("*"));
            const wcFasiMapping = wcFasiRes || [];

            // 2b. Fetch material-fino overrides from DB (persisted user mappings)
            // Falls back to empty array if table does not exist yet
            const { data: matOverridesRes, error: matOverridesErr } = await fetchAllRows(() => supabase.from("material_fino_overrides").select("*"));
            const dbMaterialOverrides = matOverridesErr ? [] : (matOverridesRes || []).map(r => ({
                mat: (r.materiale || "").toUpperCase(),
                fino: r.fino ? String(r.fino).padStart(4, "0") : null,
                phase: r.fase,
                comp: (r.componente || "").toUpperCase()
            }));

            const getPhaseForRecord = (r) => {
                const matCode = (r.materiale || "").toUpperCase();
                const fino = String(r.fino || "").padStart(4, "0");
                const wc = (r.macchina_id || r.work_center_sap || "").toUpperCase();

                // 1. PRIMARY: Static + DB-persisted + session overrides (Material/Fino)
                const allMaterialOverrides = [...MATERIAL_PHASE_OVERRIDES, ...dbMaterialOverrides, ...dynamicOverrides];
                const override = allMaterialOverrides.find(o =>
                    matCode === o.mat.toUpperCase() &&
                    (o.fino === fino || !o.fino)
                );
                if (override) return override.phase;

                // 2. SECONDARY: Check Overrides (Machine)
                if (MACHINE_PHASE_OVERRIDES[wc]) return MACHINE_PHASE_OVERRIDES[wc];

                // 3. TABLE-BASED: Exact match dal DB
                for (const m of wcFasiMapping) {
                    if (m.match_type === "exact" && wc === m.work_center.toUpperCase()) return m.fase;
                }

                // 4. TABLE-BASED: Prefix match dal DB
                for (const m of wcFasiMapping) {
                    if (m.match_type === "prefix" && wc.startsWith(m.work_center.toUpperCase())) return m.fase;
                }

                // 5. FALLBACK: Code-based matching dai PROCESS_STEPS
                for (const step of PROCESS_STEPS) {
                    if (wc.startsWith(step.code)) {
                        // DRA è ambiguo: usato sia per start_soft che start_hard
                        if (step.code === "DRA") {
                            return matCode.endsWith("/S") ? "start_soft" : "start_hard";
                        }
                        // SCA è ambiguo: usato sia per laser_welding che laser_welding_soft_2
                        if (step.code === "SCA") {
                            return "laser_welding";
                        }
                        return step.id;
                    }
                }

                return null;
            };

            // 3. Fetch production data
            const selectFields = "data, materiale, work_center_sap, macchina_id, qta_ottenuta, turno_id, fino";

            const queryFactory = () => {
                let q = supabase.from("conferme_sap").select(selectFields);
                if (viewMode === "weekly") {
                    const [y, mo, d] = wWeek.split("-").map(Number);
                    const mon = new Date(y, mo - 1, d);
                    const sun = new Date(y, mo - 1, d + 6);
                    q = q.gte("data", toLocalDateStr(mon)).lte("data", toLocalDateStr(sun));
                } else {
                    q = q.eq("data", wDate);
                }
                if (localTurno && localTurno !== "ALL") {
                    q = q.eq("turno_id", localTurno);
                }
                return q;
            };

            const { data: prodRes, error: prodErr } = await fetchAllRows(queryFactory);

            if (prodErr) {
                console.error("Errore fetch conferme_sap:", prodErr);
                if (showToast) showToast(`Errore lettura dati produzione: ${prodErr.message}`, "error");
                return;
            }

            console.log(`[ComponentFlow] Fetch ${viewMode} - records grezzi: ${prodRes?.length ?? 0}`);

            // newMatrix: { projId: { comp: { phase: { value, records } } } }
            const newMatrix = {};
            const projComponentSets = {}; // { projId: Set<string> }
            PROJECTS.forEach(p => { newMatrix[p] = {}; projComponentSets[p] = new Set(); });

            let skippedNoInfo = 0, skippedNoPhase = 0;
            const unmappedMaterials = {};
            const unmappedWC = {};

            if (prodRes) {
                prodRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase();
                    const info = anagrafica[matCode];
                    if (!info) {
                        skippedNoInfo++;
                        unmappedMaterials[matCode] = (unmappedMaterials[matCode] || 0) + 1;
                        return;
                    }

                    let proj = info.progetto || "Other";
                    if (proj === "DCT 300" || proj === "DCT300") proj = "DCT300";
                    if (proj === "8Fe" || proj === "8 FE" || proj === "8Fedct") proj = "8Fe";
                    if (proj === "DCT Eco" || proj === "DCTeco" || proj === "DCT ECO") proj = "DCT ECO";
                    if (proj === "RG" || proj === "DH" || proj === "RG + DH") proj = "RG + DH";

                    if (!PROJECTS.includes(proj)) return; // skip unknown projects

                    const fino = String(r.fino || "").padStart(4, "0");

                    const compOverride = [...dbMaterialOverrides, ...dynamicOverrides].find(o => o.mat.toUpperCase() === matCode && (o.fino === fino || !o.fino));
                    let comp = compOverride ? compOverride.comp : (info.componente || "ALTRO").toUpperCase();
                    if (comp === "SG2-REV") comp = "DG-REV";

                    const wc = (r.macchina_id || r.work_center_sap || "").toUpperCase();
                    const phase = getPhaseForRecord(r);
                    if (!phase) {
                        skippedNoPhase++;
                        unmappedWC[wc] = (unmappedWC[wc] || 0) + 1;
                        return;
                    }

                    projComponentSets[proj].add(comp);
                    if (!newMatrix[proj][comp]) newMatrix[proj][comp] = {};
                    if (!newMatrix[proj][comp][phase]) newMatrix[proj][comp][phase] = { value: 0, records: [] };
                    newMatrix[proj][comp][phase].value += (r.qta_ottenuta || 0);
                    newMatrix[proj][comp][phase].records.push({ ...r, matCode, macchina: wc });
                });
            }

            console.log(`[ComponentFlow] Scartati: ${skippedNoInfo} senza anagrafica, ${skippedNoPhase} senza fase`);
            if (skippedNoInfo > 0) {
                const top = Object.entries(unmappedMaterials).sort((a, b) => b[1] - a[1]).slice(0, 10);
                console.log(`[ComponentFlow] Top materiali senza anagrafica:`, top.map(([m, n]) => `${m} (${n})`).join(", "));
            }
            if (skippedNoPhase > 0) {
                const top = Object.entries(unmappedWC).sort((a, b) => b[1] - a[1]).slice(0, 15);
                console.log(`[ComponentFlow] Top work center senza fase:`, top.map(([wc, n]) => `${wc} (${n})`).join(", "));
            }

            setMatrixData(newMatrix);

            const newCompsByProject = {};
            PROJECTS.forEach(p => {
                const fixed = PROJECT_COMPONENTS[p] || [];
                // Se è DCT300, escludiamo SG2 dagli extra per evitare dati sporchi in quella vista
                const extra = Array.from(projComponentSets[p])
                    .filter(c => !fixed.includes(c))
                    .filter(c => !(p === "DCT300" && c === "SG2"))
                    .sort();
                newCompsByProject[p] = [...fixed, ...extra];
            });
            setComponentsByProject(newCompsByProject);

        } catch (err) {
            console.error(err);
            if (showToast) showToast("Errore caricamento dati flusso", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [wWeek, wDate, viewMode, activeProject, localTurno, dynamicOverrides, refreshTick]);

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
                <div />

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

                    <button
                        onClick={() => setIsConfigMode(!isConfigMode)}
                        className="btn"
                        style={{ 
                            padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700",
                            background: isConfigMode ? "var(--accent)" : "var(--bg-tertiary)",
                            color: isConfigMode ? "white" : "var(--text-secondary)",
                            border: "1px solid var(--border)",
                            boxShadow: isConfigMode ? "0 0 10px var(--accent)" : "none"
                        }}
                    >
                        {isConfigMode ? "✓ Fine Config" : "⚙ Configura Celle"}
                    </button>

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



            {/* Sleek Mosaic Board (High Efficiency Layout) */}
            {!loading && (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "1fr 1fr",
                    gap: "20px",
                    height: "calc(100vh - 140px)",
                    padding: "10px",
                    overflow: "hidden"
                }}>
                    {PROJECTS.map((proj, idx) => {
                        const projectComps = componentsByProject[proj] || [];
                        const projectExclusions = EXCLUDED_PHASES[proj] || [];
                        const projectVisibleSteps = PROCESS_STEPS.filter(s => !projectExclusions.includes(s.id));

                        if (projectComps.length === 0) return null;

                        // Color Palette per Progetto
                        const colors = {
                            "DCT300": { main: "#3c6ef0", bg: "rgba(60, 110, 240, 0.05)" },
                            "8Fe": { main: "#10b981", bg: "rgba(16, 185, 129, 0.05)" },
                            "DCT ECO": { main: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)" },
                            "RG + DH": { main: "#8b5cf6", bg: "rgba(139, 92, 246, 0.05)" } // Tono Indigo per Specials
                        };
                        const theme = colors[proj] || colors["DCT300"];

                        return (
                            <div key={proj} style={{
                                display: "flex",
                                flexDirection: "column",
                                background: "var(--bg-card)",
                                borderRadius: "16px",
                                border: `1px solid ${theme.main}33`,
                                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                                overflow: "hidden",
                                // Layout a Quadrante 2x2
                                gridColumn: "span 1"
                            }}>
                                {/* Header con Gradiente Soft */}
                                <div style={{
                                    padding: "10px 20px",
                                    background: `linear-gradient(90deg, ${theme.bg}, transparent)`,
                                    borderBottom: `1px solid ${theme.main}22`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                                            <div style={{ width: "15px", height: "15px", borderRadius: "50%", background: theme.main }} />
                                            <h3 style={{ fontSize: "32px", fontWeight: "900", color: "var(--text-primary)", margin: 0 }}>{proj}</h3>
                                        </div>

                                        {/* Target Indicator (Single Line Style) */}
                                        <div style={{
                                            background: "rgba(0,0,0,0.05)",
                                            padding: "8px 16px",
                                            borderRadius: "12px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                            border: "1px solid var(--border-light)"
                                        }}>
                                            <div style={{
                                                fontSize: "16px",
                                                fontWeight: "900",
                                                color: theme.main,
                                                textTransform: "uppercase",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px"
                                            }}>
                                                <span>Target {viewMode === "weekly" ? "Settimanale" : (localTurno !== "ALL" ? `Turno ${localTurno}` : "Giorno")}</span>
                                                <span style={{ fontSize: "24px", color: "var(--text-primary)" }}>
                                                    {(() => {
                                                        const base = targetOverrides[proj] || 0;
                                                        if (viewMode === "weekly") return base * 6;
                                                        if (localTurno !== "ALL") return Math.round(base / 3);
                                                        return base;
                                                    })()}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setTargetModal({ proj, value: targetOverrides[proj] || 0 })}
                                                style={{ border: "none", background: "none", cursor: "pointer", fontSize: "16px", padding: 0, opacity: 0.5 }}
                                            >
                                                ⚙️
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Content con Scroll Interno */}
                                <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
                                    <div style={{ minWidth: "max-content" }}>
                                        {/* Phases Row */}
                                        <div style={{ display: "flex", marginBottom: "16px", paddingLeft: "170px" }}>
                                            {projectVisibleSteps.map((s, sIdx) => (
                                                <div key={sIdx} style={{
                                                    width: "85px",
                                                    textAlign: "center",
                                                    flexShrink: 0,
                                                    background: s.id === "ht" ? "rgba(0, 212, 255, 0.4)" : "transparent",
                                                    borderRadius: "4px 4px 0 0",
                                                    borderLeft: s.id === "ht" ? "1px solid rgba(0, 212, 255, 0.3)" : "none",
                                                    borderRight: s.id === "ht" ? "1px solid rgba(0, 212, 255, 0.3)" : "none"
                                                }}>
                                                    <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", opacity: 0.8 }}>{s.code}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Component Rows */}
                                        {projectComps.map((comp, cIdx) => (
                                            <div key={comp} style={{
                                                display: "flex",
                                                alignItems: "center",
                                                padding: "12px 0",
                                                borderBottom: "1px solid var(--border-light)",
                                                background: cIdx % 2 === 0 ? "rgba(0,0,0,0.01)" : "transparent"
                                            }}>
                                                <div style={{
                                                    width: "170px",
                                                    flexShrink: 0,
                                                    fontSize: "18px",
                                                    fontWeight: "800",
                                                    color: "var(--text-primary)",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis"
                                                }}>
                                                    {comp}
                                                </div>

                                                <div style={{ display: "flex" }}>
                                                    {projectVisibleSteps.map((step, idx) => {
                                                        const data = matrixData[proj]?.[comp]?.[step.id];
                                                        const qty = data?.value || 0;
                                                        let isExcluded = COMPONENT_EXCLUSIONS[comp]?.includes(step.id);

                                                        if (proj === "DCT300" && ["SG7", "SGR", "RG"].includes(comp) && step.id === "grinding_cone") isExcluded = true;
                                                        if (proj === "DCT300" && ["SG3", "SGR"].includes(comp) && step.id === "start_soft") isExcluded = true;
                                                        if (proj === "8Fe" && comp !== "SG3" && step.id === "laser_welding_soft_2") isExcluded = true;
                                                        if (["RG + DH", "8Fe", "DCT300"].includes(proj) && comp.startsWith("DH") && !["start_hard", "laser_welding_2"].includes(step.id)) isExcluded = true;
                                                        if (proj === "DCT ECO" && comp.startsWith("RG") && step.id === "grinding_cone") isExcluded = true;

                                                        if (isExcluded) return <div key={idx} style={{ width: "85px", flexShrink: 0 }} />;

                                                        const currentTarget = (() => {
                                                            const base = targetOverrides[proj] || 0;
                                                            if (viewMode === "weekly") return base * 6;
                                                            if (localTurno !== "ALL") return Math.round(base / 3);
                                                            return base;
                                                        })();
                                                        const isSuccess = qty >= currentTarget && qty > 0;
                                                        const hasProduction = qty > 0;

                                                        return (
                                                            <div key={idx} style={{
                                                                width: "85px",
                                                                display: "flex",
                                                                justifyContent: "center",
                                                                flexShrink: 0,
                                                                background: step.id === "ht" ? "rgba(0, 212, 255, 0.15)" : "transparent",
                                                                borderLeft: step.id === "ht" ? "1px solid rgba(0, 212, 255, 0.3)" : "none",
                                                                borderRight: step.id === "ht" ? "1px solid rgba(0, 212, 255, 0.3)" : "none"
                                                            }}>
                                                                <div
                                                                    className="production-cell-container"
                                                                    style={{ position: "relative" }}
                                                                    onClick={(e) => {
                                                                        if (isConfigMode) {
                                                                            e.stopPropagation();
                                                                            setQuickConfigModal({
                                                                                project: proj,
                                                                                comp: comp,
                                                                                phase: step.id,
                                                                                phaseLabel: step.label
                                                                            });
                                                                        } else {
                                                                            setSelectedDetail({
                                                                                title: `${comp} - ${step.label}`,
                                                                                phaseId: step.id,
                                                                                compName: comp,
                                                                                records: data?.records || [],
                                                                                project: proj
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            width: "75px",
                                                                            height: "45px",
                                                                            background: !hasProduction ? "var(--bg-tertiary)" : (isSuccess ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #ef4444, #dc2626)"),
                                                                            borderRadius: "10px",
                                                                            display: "flex",
                                                                            alignItems: "center",
                                                                            justifyContent: "center",
                                                                            color: hasProduction ? "white" : "var(--text-muted)",
                                                                            fontSize: "16px",
                                                                            fontWeight: "900",
                                                                            boxShadow: hasProduction ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                                                                            cursor: "pointer",
                                                                            border: isConfigMode ? "2px dashed var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                                                                            transition: "all 0.2s"
                                                                        }}
                                                                    >
                                                                        {qty > 0 ? qty : ""}

                                                                        {isConfigMode && (
                                                                            <div style={{
                                                                                position: "absolute", top: -6, right: -6,
                                                                                background: "var(--bg-card)", borderRadius: "50%",
                                                                                width: "20px", height: "20px", display: "flex",
                                                                                alignItems: "center", justifyContent: "center",
                                                                                fontSize: "12px", boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                                                                                border: "1px solid var(--accent)", color: "var(--accent)"
                                                                            }}>
                                                                                ⚙️
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Materiale</th>
                                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Turno</th>
                                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Macchina</th>
                                        <th style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>Q.tà</th>
                                        <th style={{ padding: "10px", width: "40px" }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDetail.records.length > 0 ? (
                                        selectedDetail.records.map((r, i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ padding: "10px", fontSize: "13px" }}>{new Date(r.data).toLocaleDateString("it-IT")}</td>
                                                <td style={{ padding: "10px", fontSize: "13px", color: "var(--accent)", fontWeight: "600" }}>{r.materiale}</td>
                                                <td style={{ padding: "10px", fontSize: "13px" }}>{r.turno_id}</td>
                                                <td style={{ padding: "10px", fontSize: "13px", fontWeight: "bold" }}>{r.macchina}</td>
                                                <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", textAlign: "right", color: "#3c6ef0" }}>{r.qta_ottenuta}</td>
                                                <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", textAlign: "right", color: "#3c6ef0" }}>{r.qta_ottenuta}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                                Nessun record trovato in questa fase.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Target Settings Modal */}
            {targetModal && (
                <div className="modal-backdrop" style={{ zIndex: 3000 }}>
                    <div className="modal-content" style={{ width: "300px", padding: "24px", textAlign: "center" }}>
                        <h3 style={{ fontSize: "18px", marginBottom: "16px", fontWeight: "800" }}>Target Giornaliero {targetModal.proj}</h3>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
                            Inserisci il valore target per l'intera giornata (24h).
                        </p>

                        <input
                            type="number"
                            value={targetModal.value}
                            onChange={(e) => setTargetModal({ ...targetModal, value: parseInt(e.target.value) || 0 })}
                            style={{
                                width: "100%", padding: "12px", fontSize: "20px", fontWeight: "900",
                                textAlign: "center", borderRadius: "10px", border: "2px solid var(--accent)",
                                marginBottom: "20px"
                            }}
                        />

                        <div style={{ display: "flex", gap: "10px" }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => setTargetModal(null)}
                            >Annulla</button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    const newOverrides = { ...targetOverrides, [targetModal.proj]: targetModal.value };
                                    setTargetOverrides(newOverrides);
                                    localStorage.setItem("bap_target_overrides", JSON.stringify(newOverrides));
                                    setTargetModal(null);
                                    showToast?.("Target aggiornato con successo!", "success");
                                }}
                            >Salva</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Target Settings Modal */}

            {/* Quick Config Modal (Configura Singolo) */}
            {quickConfigModal && (
                <QuickConfigModal 
                    data={quickConfigModal}
                    onClose={() => setQuickConfigModal(null)}
                    onSave={() => { setQuickConfigModal(null); fetchData(); }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}

// --- QUICK CONFIG MODAL (CONFIGURA SINGOLO) ---
function QuickConfigModal({ data, onClose, onSave, showToast }) {
    const [form, setForm] = useState({
        fino: "",
        componente: data.comp || "",
        codice: ""
    });
    const [isSaving, setIsSaving] = useState(false);

    // Auto-fill existing if possible? For now just empty for speed
    
    const handleSave = async () => {
        if (!form.fino || !form.componente || !form.codice) {
            return showToast("Tutti i campi sono obbligatori", "error");
        }
        setIsSaving(true);
        try {
            const matCode = form.codice.toUpperCase().trim();
            const finoStr = String(form.fino).padStart(4, "0");

            // 1. Update Anagrafica Materiali (Code -> Component/Project)
            const { data: existingMat } = await supabase.from('anagrafica_materiali').select('id').eq('codice', matCode).maybeSingle();
            const matPayload = { codice: matCode, componente: form.componente.toUpperCase(), progetto: data.project };
            
            if (existingMat) {
                await supabase.from('anagrafica_materiali').update(matPayload).eq('id', existingMat.id);
            } else {
                await supabase.from('anagrafica_materiali').insert(matPayload);
            }

            // 2. Update Phase Mapping (Code + Fino -> Phase)
            const ovPayload = { 
                materiale: matCode, 
                fino: finoStr, 
                fase: data.phase, 
                componente: form.componente.toUpperCase(), 
                progetto: data.project 
            };
            
            const { data: existingOv } = await supabase.from('material_fino_overrides').select('id').eq('materiale', matCode).eq('fino', finoStr).maybeSingle();
            
            if (existingOv) {
                await supabase.from('material_fino_overrides').update(ovPayload).eq('id', existingOv.id);
            } else {
                await supabase.from('material_fino_overrides').insert(ovPayload);
            }

            showToast("Mappatura salvata con successo!");
            onSave();
        } catch (err) {
            console.error(err);
            showToast("Errore durante il salvataggio", "error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 5000 }}>
            <div className="modal-content" style={{ width: "450px", padding: "24px", borderRadius: "20px" }}>
                <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontWeight: "900", fontSize: "18px" }}>⚙️ Configura Singolo Cell</h3>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                        Stai configurando la fase <strong style={{ color: "var(--accent)" }}>{data.phaseLabel}</strong> del progetto <strong>{data.project}</strong>.
                    </p>

                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: "700", fontSize: "11px", textTransform: "uppercase" }}>OP Macchina (Fino) *</label>
                        <input 
                            className="input" 
                            placeholder="Es. 0140, 0010..." 
                            value={form.fino} 
                            onChange={e => setForm({...form, fino: e.target.value})}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: "700", fontSize: "11px", textTransform: "uppercase" }}>Componente *</label>
                        <input 
                            className="input" 
                            placeholder="Es. SG3..." 
                            value={form.componente} 
                            onChange={e => setForm({...form, componente: e.target.value.toUpperCase()})}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontWeight: "700", fontSize: "11px", textTransform: "uppercase" }}>Codice Materiale *</label>
                        <input 
                            className="input" 
                            placeholder="Es. M0153389/S" 
                            value={form.codice} 
                            onChange={e => setForm({...form, codice: e.target.value.toUpperCase()})}
                        />
                    </div>
                </div>

                <div style={{ marginTop: "24px", display: "flex", gap: "10px" }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Salvataggio..." : "Salva Configurazione"}
                    </button>
                    <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
                </div>
            </div>
        </div>
    );
}
