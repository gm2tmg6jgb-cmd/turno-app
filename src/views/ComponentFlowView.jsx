import React, { useState, useEffect, useMemo } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { Icons } from "../components/ui/Icons";
import { TURNI } from "../data/constants";

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
    { id: "start_hard", label: "Tornitura Hard", code: "DRA" },
    { id: "laser_welding_2", label: "Saldatura Hard", code: "SCA" },
    { id: "ut", label: "UT", code: "MZA" },
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
    "DCT300": ["dmc"], // milling e broaching rimossi dalle globali per gestione granulare
    "8 FE": [],
    "DCT ECO": ["start_soft", "dmc"]
};

const COMPONENT_EXCLUSIONS = {
    "SG1": ["start_soft", "ut", "shaping", "grinding_cone", "laser_welding_2", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "DG-REV": [
        "start_hard", "dmc", "laser_welding", "laser_welding_2", "ut", "shaping", 
        "milling", "broaching", "deburring", "grinding_cone", "teeth_grinding", 
        "washing", "ht", "assembly", "welding", "quality", "shot_peening", "laser_welding_soft_2"
    ],
    "DG": ["shaping", "laser_welding_2", "ut", "start_hard", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "SG3": ["shaping", "laser_welding", "laser_welding_2", "ut", "deburring", "milling", "broaching", "shot_peening"],
    "SG4": ["laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "broaching", "shot_peening"],
    "SG7": ["laser_welding", "laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "milling", "broaching", "shaping", "shot_peening"],
    "SGR": ["shaping", "laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "RG": ["shaping", "laser_welding", "laser_welding_2", "ut", "laser_welding_soft_2", "milling", "broaching"], // shot_peening VISIBILE
    "SG5": ["laser_welding", "laser_welding_2", "shaping", "shot_peening", "deburring", "laser_welding_soft_2", "milling", "broaching"],
    "SG6": ["laser_welding", "laser_welding_2", "shaping", "shot_peening", "deburring", "laser_welding_soft_2", "milling", "broaching"],
    "SG2": ["shaping", "milling", "broaching", "shot_peening", "laser_welding_2", "ut", "grinding_cone", "deburring", "laser_welding_soft_2"],
    "PG": ["shaping", "laser_welding", "laser_welding_2", "ut", "deburring", "milling", "laser_welding_soft_2", "start_hard", "grinding_cone", "shot_peening"],
    "FG5/7": ["shaping", "laser_welding", "laser_welding_2", "ut", "deburring", "milling", "laser_welding_soft_2", "start_hard", "grinding_cone", "broaching"] // shot_peening VISIBILE
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
    { mat: "M0153389/S", fino: "0050", phase: "dmc" }
];

const MACHINE_PHASE_OVERRIDES = {
    "HOK11001": "ht"
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
    const [bulkText, setBulkText] = useState("");
    const [dynamicOverrides, setDynamicOverrides] = useState([]); // [{ mat, fino, phase, comp }] — session-only (bulk parser)
    const [refreshTick, setRefreshTick] = useState(0); // incremented after DB save to trigger re-fetch
    const [showParser, setShowParser] = useState(false);
    const [mappingModal, setMappingModal] = useState(null); // { mat, mat2, machine, fino, currentPhase, currentComp }
    const [compMappings, setCompMappings] = useState({}); // { COMP: [m1, m2] }

    const PHASE_KEYWORDS = {
        "SALDATURA SOFT": "laser_welding",
        "SALDATURA HARD": "laser_welding_2",
        "DENTATURA": "hobbing",
        "TORNITURA HARD": "start_hard",
        "TORNITURA SOFT": "start_soft",
        "PALLINATURA": "shot_peening",
        "RETTIFICA DENTI": "teeth_grinding",
        "LAVAGGIO": "washing",
        "TRATTAMENTO": "ht",
        "TT": "ht",
        "HOK": "ht"
    };

    const toLocalDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const handleBulkParse = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText.split("\n");
        const newRules = [];
        
        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = line.toUpperCase().replace(/,/g, " ").replace(/-/g, " ").split(/\s+/);
            
            // Cerca codice materiale (es. 2511108150 o M017... )
            const mat = parts.find(p => /^\d{5,}/.test(p) || p.startsWith("M01"));
            // Cerca fino (es. 0060, 0120) - di solito 4 cifre
            const fino = parts.find(p => /^\d{4}$/.test(p));
            // Cerca fase (keyword match)
            let phase = null;
            for (const [key, val] of Object.entries(PHASE_KEYWORDS)) {
                if (line.toUpperCase().includes(key)) {
                    phase = val;
                    break;
                }
            }

            if (mat && phase) {
                newRules.push({ mat, fino, phase });
            }
        });

        if (newRules.length > 0) {
            setDynamicOverrides(prev => {
                // Evita duplicati
                const existing = new Set(prev.map(r => `${r.mat}-${r.fino}-${r.phase}`));
                const filtered = newRules.filter(r => !existing.has(`${r.mat}-${r.fino}-${r.phase}`));
                return [...prev, ...filtered];
            });
            setBulkText("");
            showToast(`Caricate ${newRules.length} nuove regole!`, "success");
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch anagrafica
            const { data: anagraficaRes } = await fetchAllRows(() => supabase.from("anagrafica_materiali").select("*"));
            const anagrafica = {};
            const compToMats = {}; // { COMP: [mat1, mat2, ...] }
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    const c = (row.codice || "").toUpperCase();
                    const comp = (row.componente || "").toUpperCase();
                    if (c) anagrafica[c] = row;
                    if (comp && c) {
                        if (!compToMats[comp]) compToMats[comp] = [];
                        if (!compToMats[comp].includes(c)) compToMats[comp].push(c);
                    }
                });
            }
            setCompMappings(compToMats); // Store this in state if needed or just use locally

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

            const newMatrix = {};
            const projectComponents = new Set();
            let skippedNoInfo = 0, skippedNoPhase = 0, skippedWrongProject = 0;
            const unmappedMaterials = {}; // mat → count
            const unmappedWC = {}; // wc → count

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
                    if (proj === "DCT 300") proj = "DCT300";
                    if (proj === "8Fe") proj = "8 FE";
                    if (proj === "8Fedct") proj = "8 FE";
                    if (proj === "DCT Eco") proj = "DCT ECO";
                    if (proj === "DCTeco") proj = "DCT ECO";

                    if (proj !== activeProject) { skippedWrongProject++; return; }

                    const fino = String(r.fino || "").padStart(4, "0");

                    // Check if there is a component override (DB or session)
                    const compOverride = [...dbMaterialOverrides, ...dynamicOverrides].find(o => o.mat.toUpperCase() === matCode && (o.fino === fino || !o.fino));
                    let comp = compOverride ? compOverride.comp : (info.componente || "ALTRO").toUpperCase();

                    if (comp === "SG2-REV") comp = "DG-REV";

                    projectComponents.add(comp);

                    const wc = (r.macchina_id || r.work_center_sap || "").toUpperCase();
                    const phase = getPhaseForRecord(r);
                    if (!phase) {
                        skippedNoPhase++;
                        unmappedWC[wc] = (unmappedWC[wc] || 0) + 1;
                        return;
                    }

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

            console.log(`[ComponentFlow] Scartati: ${skippedNoInfo} senza anagrafica, ${skippedWrongProject} progetto errato, ${skippedNoPhase} senza fase`);

            if (skippedNoInfo > 0) {
                const top = Object.entries(unmappedMaterials).sort((a,b) => b[1]-a[1]).slice(0, 10);
                console.log(`[ComponentFlow] Top materiali senza anagrafica:`, top.map(([m,n]) => `${m} (${n})`).join(", "));
            }
            if (skippedNoPhase > 0) {
                const top = Object.entries(unmappedWC).sort((a,b) => b[1]-a[1]).slice(0, 15);
                console.log(`[ComponentFlow] Top work center senza fase:`, top.map(([wc,n]) => `${wc} (${n})`).join(", "));
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

                    <button 
                        onClick={() => setShowParser(!showParser)}
                        style={{
                            padding: "6px 12px", background: "var(--bg-tertiary)", color: "var(--text-primary)",
                            border: "1px solid var(--border)", borderRadius: "8px", fontWeight: "700", cursor: "pointer",
                            fontSize: "12px"
                        }}
                    >
                        {showParser ? "Chiudi Parser" : "Bulk Parser ⚙️"}
                    </button>
                </div>
            </div>

            {showParser && (
                <div className="card fade-in" style={{ marginBottom: "20px", padding: "20px", background: "var(--bg-tertiary)", border: "2px dashed var(--accent)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div>
                            <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--accent)", margin: 0 }}>Importazione Massiva Regole</h3>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDynamicOverrides([])}>Svuota</button>
                        </div>
                    </div>
                    
                    <textarea 
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Incolla qui (es: SG1 LAVAGGIO 2511108150 0250)..."
                        style={{
                            width: "100%", height: "80px", borderRadius: "10px", border: "1px solid var(--border)",
                            padding: "12px", fontSize: "13px", fontFamily: "monospace", marginBottom: "12px",
                            background: "var(--bg-card)", color: "var(--text-primary)"
                        }}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn btn-primary btn-sm" onClick={handleBulkParse}>Analizza e Applica</button>
                    </div>
                </div>
            )}

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
                                {components.map((comp, cIdx) => (
                                    <div key={comp} style={{ 
                                        display: "flex", 
                                        alignItems: "center", 
                                        padding: "16px 8px",
                                        background: cIdx % 2 === 0 ? "rgba(0,0,0,0.03)" : "transparent",
                                        borderBottom: "2px solid var(--border)",
                                        marginBottom: "4px",
                                        borderRadius: "8px"
                                    }}>
                                        {/* Component Label */}
                                        <div style={{ width: "150px", flexShrink: 0, fontWeight: "800", fontSize: "15px", color: "var(--text-primary)" }}>
                                            {comp}
                                        </div>

                                        {/* Process Boxes */}
                                        <div style={{ display: "flex", gap: "0px" }}>
                                            {visibleSteps.map((step, idx) => {
                                                const data = matrixData[comp]?.[step.id];
                                                const qty = data?.value || 0;
                                                const isExcluded = COMPONENT_EXCLUSIONS[comp]?.includes(step.id);
                                                
                                                if (isExcluded) return <div key={idx} style={{ width: "100px", flexShrink: 0 }} />;

                                                return (
                                                    <div key={idx} style={{ width: "100px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
                                                        <div 
                                                            onClick={() => {
                                                                setSelectedDetail({
                                                                    title: `${comp} - ${step.label}`,
                                                                    phaseId: step.id,
                                                                    compName: comp,
                                                                    records: data?.records || []
                                                                });
                                                            }}
                                                            style={{
                                                            width: "80px",
                                                            height: "50px",
                                                            background: isExcluded ? "var(--bg-primary)" : (qty > 0 ? "linear-gradient(135deg, #3c6ef0, #1e40af)" : "var(--bg-tertiary)"),
                                                            borderRadius: "10px",
                                                            display: "flex",
                                                            flexDirection: "column",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: isExcluded ? "var(--text-muted)" : (qty > 0 ? "white" : "var(--text-muted)"),
                                                            border: isExcluded ? "1px solid var(--border)" : (qty > 0 ? "none" : "1px dashed var(--border)"),
                                                            boxShadow: (qty > 0 && !isExcluded) ? "0 4px 10px rgba(60, 110, 240, 0.2)" : "none",
                                                            opacity: isExcluded ? 0.3 : (qty > 0 ? 1 : 0.6),
                                                            transition: "all 0.2s",
                                                            cursor: "pointer"
                                                        }}>
                                                            <div style={{ fontSize: "14px", fontWeight: "900" }}>{isExcluded ? "N/A" : qty}</div>
                                                            {qty > 0 && !isExcluded && <div style={{ fontSize: "8px", fontWeight: "700", opacity: 0.8 }}>PEZZI</div>}
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
                                                <td style={{ padding: "10px", textAlign: "center" }}>
                                                    <button 
                                                        onClick={() => {
                                                            const existingMats = compMappings[selectedDetail.compName] || [];
                                                            setMappingModal({
                                                                mat: existingMats[0] || r.materiale,
                                                                mat2: existingMats[1] || "",
                                                                machine: r.macchina || "", // BACK TO PRE-FILLING as the user wants to see it
                                                                fino: r.fino,
                                                                currentPhase: selectedDetail.phaseId,
                                                                currentComp: selectedDetail.compName
                                                            });
                                                        }}
                                                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)" }}
                                                    >
                                                        {Icons.edit}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                                Nessun record trovato in questa fase. 
                                                <div style={{ marginTop: "12px" }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => {
                                                        const existingMats = compMappings[selectedDetail.compName] || [];
                                                        setMappingModal({
                                                            mat: existingMats[0] || "",
                                                            mat2: existingMats[1] || "",
                                                            machine: "",
                                                            fino: "0010",
                                                            currentPhase: selectedDetail.phaseId,
                                                            currentComp: selectedDetail.compName
                                                        });
                                                    }}>Aggiungi Associazione ➕</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Mapping Modal */}
            {mappingModal && (
                <div className="modal-backdrop" style={{ zIndex: 2000 }}>
                    <div className="modal-content" style={{ width: "400px", padding: "24px" }}>
                        <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>Associa a {mappingModal.currentComp}</h2>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", fontWeight: "bold" }}>Codice Materiale 1</label>
                                <input 
                                    type="text"
                                    placeholder="es: 2511108150"
                                    value={mappingModal.mat}
                                    onChange={(e) => setMappingModal({...mappingModal, mat: e.target.value.toUpperCase()})}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", fontWeight: "bold" }}>Codice Materiale 2 (Opt)</label>
                                <input 
                                    type="text"
                                    placeholder="es: 2511108160"
                                    value={mappingModal.mat2}
                                    onChange={(e) => setMappingModal({...mappingModal, mat2: e.target.value.toUpperCase()})}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                                />
                            </div>
                        </div>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", fontWeight: "bold" }}>Operazione (Fino a)</label>
                                <input 
                                    type="text"
                                    placeholder="es: 0010"
                                    value={mappingModal.fino}
                                    onChange={(e) => setMappingModal({...mappingModal, fino: e.target.value})}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", marginBottom: "4px", fontWeight: "bold" }}>Macchina</label>
                                <input 
                                    type="text"
                                    placeholder="es: DRA101"
                                    value={mappingModal.machine}
                                    onChange={(e) => setMappingModal({...mappingModal, machine: e.target.value.toUpperCase()})}
                                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Componente Destinatario</label>
                            <select 
                                value={mappingModal.currentComp}
                                onChange={(e) => setMappingModal({...mappingModal, currentComp: e.target.value})}
                                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                            >
                                {components.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", fontSize: "12px", marginBottom: "6px" }}>Fase Destinataria</label>
                            <select 
                                value={mappingModal.currentPhase}
                                onChange={(e) => setMappingModal({...mappingModal, currentPhase: e.target.value})}
                                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)" }}
                            >
                                {PROCESS_STEPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                            <button className="btn btn-secondary" onClick={() => setMappingModal(null)}>Annulla</button>
                            
                            {/* Delete Button (only if we have at least one material or machine) */}
                            {(mappingModal.mat || mappingModal.machine) && (
                                <button 
                                    className="btn btn-danger" 
                                    style={{ background: "#ef4444", color: "white" }}
                                    onClick={async () => {
                                        if (!window.confirm("Sei sicuro di voler eliminare questa associazione?")) return;
                                        try {
                                            if (mappingModal.mat) {
                                                await supabase.from('anagrafica_materiali').delete().eq('codice', mappingModal.mat);
                                                if (mappingModal.mat2) {
                                                    await supabase.from('anagrafica_materiali').delete().eq('codice', mappingModal.mat2);
                                                }
                                            }
                                            if (mappingModal.machine) {
                                                await supabase.from('wc_fasi_mapping').delete().eq('work_center', mappingModal.machine);
                                            }
                                            showToast("Associazione eliminata con successo!");
                                            setMappingModal(null);
                                            setSelectedDetail(null);
                                            fetchData();
                                        } catch (err) {
                                            console.error(err);
                                            showToast("Errore durante l'eliminazione", "error");
                                        }
                                    }}
                                >
                                    Elimina
                                </button>
                            )}

                            <button className="btn btn-primary" onClick={async () => {
                                try {
                                    const matsToSave = [mappingModal.mat, mappingModal.mat2].filter(m => m && m.trim() !== "");
                                    
                                    for (const mCode of matsToSave) {
                                        // 1. Double Material Save in anagrafica_materiali
                                        const { data: existing, error: selErr } = await supabase
                                            .from('anagrafica_materiali')
                                            .select('id')
                                            .eq('codice', mCode)
                                            .maybeSingle();

                                        if (selErr) {
                                            console.error("Select error:", selErr);
                                            showToast(`Errore lettura materiale ${mCode}: ${selErr.message}`, "error");
                                            return;
                                        }

                                        const payload = {
                                            codice: mCode,
                                            componente: mappingModal.currentComp,
                                            progetto: activeProject
                                        };

                                        if (existing) {
                                            const { error: updErr } = await supabase.from('anagrafica_materiali').update(payload).eq('id', existing.id);
                                            if (updErr) {
                                                console.error("Update error:", updErr);
                                                showToast(`Errore aggiornamento ${mCode}: ${updErr.message}`, "error");
                                                return;
                                            }
                                        } else {
                                            const { error: insErr } = await supabase.from('anagrafica_materiali').insert(payload);
                                            if (insErr) {
                                                console.error("Insert error:", insErr);
                                                showToast(`Errore inserimento ${mCode}: ${insErr.message}`, "error");
                                                return;
                                            }
                                        }

                                        // Save material+fino→phase override to DB (persisted)
                                        const finoStr = String(mappingModal.fino || "").padStart(4, "0");
                                        const ovPayload = {
                                            materiale: mCode,
                                            fino: finoStr,
                                            fase: mappingModal.currentPhase,
                                            componente: mappingModal.currentComp,
                                            progetto: activeProject
                                        };
                                        // Try DB first; if table missing, fall back to local state
                                        const { data: existingOv, error: selOvErr } = await supabase
                                            .from('material_fino_overrides')
                                            .select('id')
                                            .eq('materiale', mCode)
                                            .eq('fino', finoStr)
                                            .maybeSingle();
                                        const tableExists = !selOvErr || selOvErr.code !== 'PGRST205';
                                        if (tableExists) {
                                            if (existingOv) {
                                                const { error: ovErr } = await supabase.from('material_fino_overrides').update(ovPayload).eq('id', existingOv.id);
                                                if (ovErr) { console.error("Override update error:", ovErr); showToast(`Errore salvataggio override: ${ovErr.message}`, "error"); return; }
                                            } else {
                                                const { error: ovErr } = await supabase.from('material_fino_overrides').insert(ovPayload);
                                                if (ovErr) { console.error("Override insert error:", ovErr); showToast(`Errore salvataggio override: ${ovErr.message}`, "error"); return; }
                                            }
                                        } else {
                                            // Table not created yet — store in session state with a warning
                                            console.warn("Tabella material_fino_overrides non trovata, usando stato locale");
                                            setDynamicOverrides(prev => {
                                                const filtered = prev.filter(o => o.mat !== mCode || o.fino !== finoStr);
                                                return [...filtered, { mat: mCode, fino: finoStr, phase: mappingModal.currentPhase, comp: mappingModal.currentComp }];
                                            });
                                            showToast("⚠️ Tabella material_fino_overrides mancante: crea la tabella in Supabase per rendere il salvataggio permanente", "error");
                                        }
                                    }

                                    // 2. Machine Persistence if provided
                                    if (mappingModal.machine && mappingModal.machine.trim() !== "") {
                                        const { data: mRows, error: mSelErr } = await supabase
                                            .from('wc_fasi_mapping')
                                            .select('id')
                                            .eq('work_center', mappingModal.machine)
                                            .limit(1);

                                        if (mSelErr) {
                                            console.error("Machine select error:", mSelErr);
                                            showToast(`Errore lettura macchina: ${mSelErr.message}`, "error");
                                            return;
                                        }

                                        const mExisting = mRows?.[0] || null;
                                        const mPayload = {
                                            work_center: mappingModal.machine,
                                            fase: mappingModal.currentPhase,
                                            match_type: 'exact'
                                        };

                                        let mErr;
                                        if (mExisting) {
                                            const { error } = await supabase.from('wc_fasi_mapping').update(mPayload).eq('id', mExisting.id);
                                            mErr = error;
                                        } else {
                                            const { error } = await supabase.from('wc_fasi_mapping').insert(mPayload);
                                            mErr = error;
                                        }

                                        if (mErr) {
                                            console.error("Machine save error:", mErr);
                                            showToast(`Errore salvataggio macchina: ${mErr.message}`, "error");
                                            return;
                                        }
                                    }

                                    showToast("Salvataggio permanente completato!");
                                    setMappingModal(null);
                                    setSelectedDetail(null);
                                    setRefreshTick(t => t + 1);
                                } catch (err) {
                                    console.error("Save error:", err);
                                    showToast("Errore durante il salvataggio", "error");
                                }
                            }}>Salva Permanentemente</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
