import React, { useState, useEffect, useMemo } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { Icons } from "../components/ui/Icons";
import Modal from "../components/Modal";

// --- LABORATORIO INVENTARIO: Tracciamento WIP con Inventario Fisico ---

const LOCAL_ANAGRAFICA = {
    "M0153401/S": { comp: "SG3", proj: "8Fe" },
    "M0153401": { comp: "SG3", proj: "8Fe" },
    "M0153389/S": { comp: "SG3 - 1A", proj: "DCT300" },
    "M0153384/S": { comp: "DG - 1A", proj: "DCT300" },
    "M0153384": { comp: "DG - 1A", proj: "DCT300" },
    "M0146872": { comp: "DG - 1A", proj: "DCT300" },
    "M0146872/S": { comp: "DG - 1A", proj: "DCT300" },
    "M0146872/T": { comp: "DG - 1A", proj: "DCT300" },
    "M0156548": { comp: "DG - 21A", proj: "DCT300" },
    "M0156548/S": { comp: "DG - 21A", proj: "DCT300" },
    "M0156548/T": { comp: "DG - 21A", proj: "DCT300" },
    "M0192963/S": { comp: "SG3", proj: "DCT ECO" },
    "M0192963": { comp: "SG3", proj: "DCT ECO" },
    "M0140997/S": { comp: "SG2", proj: "DCT ECO" },
    "M0140997": { comp: "SG2", proj: "DCT ECO" },
    "M0162644/S": { comp: "SG2", proj: "DCT ECO" },
    "M0162644": { comp: "SG2", proj: "DCT ECO" },
    "2516272835": { comp: "SG1", proj: "DCT300" },
    "2516107836": { comp: "SG1", proj: "DCT300" },
    "M0162583/S": { comp: "SG4", proj: "8Fe" },
    "M0162583/T": { comp: "SG4", proj: "8Fe" },
    "M0162583": { comp: "SG4", proj: "8Fe" },
    "M0162623": { comp: "SG5", proj: "8Fe" },
    "M0153387": { comp: "SG6", proj: "8Fe" },
    "M0153397/S": { comp: "SG8", proj: "8Fe" },
    "M0153397/T": { comp: "SG8", proj: "8Fe" },
    "M0153397": { comp: "SG8", proj: "8Fe" }
};

// Label fasi da ID
const PHASE_CODE = {
    "start_soft": "DRA", "dmc": "ZSA", "slw": "SLW", "laser_welding": "SCA",
    "laser_welding_soft_2": "SCA", "shaping": "STW", "milling": "FRA",
    "broaching": "RAA", "hobbing": "FRW", "deburring": "EGW",
    "to_be_treated": "WIP", "ht": "HT", "shot_peening": "OKU",
    "start_hard": "DRA", "laser_welding_2": "SCA", "ut_soft": "MZA",
    "ut": "UT", "grinding_cone": "SLA", "grinding_cone_2": "SLA",
    "teeth_grinding": "SLW", "teeth_grinding_post_dra": "SLW",
    "ore": "ORE",
    "to_be_washed": "WIP", "washing": "WSH",
    "baa": "BAA"
};

const PHASE_LABEL = {
    "start_soft": "Torn. Soft", "dmc": "DMC", "slw": "SLW", "laser_welding": "Sald. Soft",
    "laser_welding_soft_2": "Sald. Soft 2", "shaping": "Stozzatura", "milling": "Fresatura",
    "broaching": "Brocciatura", "hobbing": "Dentatura", "deburring": "Sbavatura",
    "to_be_treated": "Da Trattare", "ht": "Tratt. Term.", "shot_peening": "Pallinatura",
    "start_hard": "Torn. Hard", "laser_welding_2": "Sald. Hard", "ut_soft": "MZA Soft",
    "ut": "MZA Hard", "grinding_cone": "Rett. Cono", "grinding_cone_2": "Rett. Cono 2",
    "teeth_grinding": "Rett. Denti", "teeth_grinding_post_dra": "Rett. Denti",
    "ore": "ORE",
    "to_be_washed": "Da Lavare", "washing": "Lavaggio",
    "baa": "BAA"
};

// Componenti del laboratorio
const PROJECTS = ["DCT ECO", "8Fe", "DCT300"];
const PROJECT_COMPONENTS_LAB = {
    "DCT ECO": ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"],
    "8Fe": ["SG2", "SG3", "SG4", "SG5", "SG6", "SG7", "SG8", "SGR", "PG", "FG5/7"],
    "DCT300": ["SG1", "DG-REV", "DG - 1A", "DG - 21A", "SG3 - 1A", "SG3 - 21A", "SG4 - 1A", "SG4 - 21A", "SG5 - 1A", "SG5 - 21A", "SG6 - 1A", "SG6 - 21A", "SG7 - 1A", "SG7 - 21A", "SGR", "RG - 1A", "RG - 21A"]
};

// Colore tema per progetto
const PROJECT_COLORS = {
    "DCT ECO": { main: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)" },
    "DCT300": { main: "#3c6ef0", bg: "rgba(60, 110, 240, 0.05)" },
    "8Fe": { main: "#10b981", bg: "rgba(16, 185, 129, 0.05)" },
    "RG + DH": { main: "#ef4444", bg: "rgba(239, 68, 68, 0.05)" },
};
// sapPrev di una fase può provenire da una fase specifica (non la precedente)
const SAP_PREV_SOURCE = {
    "DCT300": {
        "to_be_treated": "hobbing" // WIP prende sapPrev da FRW
    }
};

// Fasi per cui non si usa sapPrev (OP10 non disponibile → solo scarichi SAP)
const NO_SAP_PREV_PHASES = {
    "DCT ECO": ["laser_welding", "laser_welding_2", "shaping"]
};

// Fasi non editabili per progetto
const NON_EDITABLE_PHASES = {
    "DCT300": ["shot_peening"] // OKU
};

const normalizeComp = (c, proj = null) => {
    if (!c) return "";
    const s = String(c).toUpperCase();
    if (proj === null || proj === "DCT ECO") {
        const eco = ["SG2", "SG3", "SG4", "SG5", "SGR", "RG FD1", "RG FD2"];
        if (eco.includes(s)) return s + " ECO";
    }
    return s;
};


export default function PrioritaView({ showToast, globalDate }) {
    // Calculate first day of week (Monday) and today
    const getWeekStartDate = () => {
        const today = new Date();
        const day = today.getDay(); // 0=Sunday, 1=Monday, etc.
        const diff = today.getDate() - (day === 0 ? 6 : day - 1); // Correct formula for Monday
        const monday = new Date(today); // Create a copy!
        monday.setDate(diff);
        return monday.toISOString().split("T")[0];
    };

    const getTodayDate = () => new Date().toISOString().split("T")[0];

    const [inventarioDate, setInventarioDate] = useState(() => {
        // Always use calculated week start date, don't use localStorage for this
        // (laboratorio needs fresh calculation)
        localStorage.removeItem("lab_inv_date");
        return getWeekStartDate();
    });
    const [inventarioDateFine, setInventarioDateFine] = useState(() => {
        // Always use today's date, don't use localStorage for this
        localStorage.removeItem("lab_inv_date_fine");
        return getTodayDate();
    });
    const noSapPrevRef = React.useRef({});
    const [finoSequences, setFinoSequences] = useState({}); // {comp: [{fino, fase}]}
    const [rawMatrixData, setRawMatrixData] = useState({}); // dati non filtrati
    const [filterExcludeSto, setFilterExcludeSto] = useState(() => {
        try { return JSON.parse(localStorage.getItem("lab_filter_exclude_sto")) ?? false; } catch { return false; }
    });
    const [filterExcludeOperators, setFilterExcludeOperators] = useState(() => {
        try { return JSON.parse(localStorage.getItem("lab_filter_exclude_operators")) ?? []; } catch { return []; }
    });
    const [highlightOperator, setHighlightOperator] = useState(null);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showOperatorReport, setShowOperatorReport] = useState(false);
    const [componentsByProject, setComponentsByProject] = useState({});
    const [loading, setLoading] = useState(false);
    const [editingCell, setEditingCell] = useState(null); // {comp, fino, value}
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [savingCell, setSavingCell] = useState(null); // {comp, fino}
    const [cellExclusions, setCellExclusions] = useState({});
    const [cellInclusions, setCellInclusions] = useState({});
    const [noSapPrevCells, setNoSapPrevCells] = useState(() => {
        try {
            const v = JSON.parse(localStorage.getItem("lab_no_sap_prev") || "{}");
            // Rimuovi dal localStorage tutte le fasi che NON sono in NO_SAP_PREV_PHASES
            // (non devono mai essere bloccate da toggle accidentali)
            const allNoSapPhasesPerProj = NO_SAP_PREV_PHASES; // { "DCT ECO": [...], ... }
            Object.keys(v).forEach(key => {
                const [compFase, fase] = key.split(":");
                if (!fase) return;
                // Controlla se questa fase è in qualche progetto in NO_SAP_PREV_PHASES
                const isDefaultDisabled = Object.values(allNoSapPhasesPerProj).some(arr => arr.includes(fase));
                // Se la fase NON è di default disabilitata, rimuovila (era un toggle accidentale)
                if (!isDefaultDisabled) {
                    delete v[key];
                }
            });
            localStorage.setItem("lab_no_sap_prev", JSON.stringify(v));
            noSapPrevRef.current = v;
            return v;
        } catch { return {}; }
    });
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [quickConfigModal, setQuickConfigModal] = useState(null);
    const [showDetails, setShowDetails] = useState(true);
    const [activeTab, setActiveTab] = useState("DCT ECO");
    const [unconfiguredSap, setUnconfiguredSap] = useState([]); // [{materiale, fino, qty}]
    const [resetConfirmModal, setResetConfirmModal] = useState(false); // Modal reset
    const [isResetting, setIsResetting] = useState(false); // Loading durante reset
    const [inventarioOraInizio, setInventarioOraInizio] = useState(null); // Timestamp inizio inventario fisico
    const [resetDate, setResetDate] = useState(new Date().toISOString().split("T")[0]); // Data reset editabile
    const [resetTime, setResetTime] = useState("00:00"); // Ora reset editabile
    const [refreshKey, setRefreshKey] = useState(0); // Forza reload fetchData anche se le date non cambiano

    useEffect(() => {
        localStorage.setItem("lab_inv_date", inventarioDate);
    }, [inventarioDate]);

    useEffect(() => {
        localStorage.setItem("lab_inv_date_fine", inventarioDateFine);
    }, [inventarioDateFine]);

    // Applica filtri storni/operatori in tempo reale senza ricaricare dal DB
    const matrixData = useMemo(() => {
        if (!filterExcludeSto && filterExcludeOperators.length === 0) return rawMatrixData;
        const filtered = {};
        for (const [comp, fases] of Object.entries(rawMatrixData)) {
            filtered[comp] = {};
            for (const [fase, cell] of Object.entries(fases)) {
                const filteredRecords = (cell.records || []).filter(r => {
                    if (filterExcludeSto && r.sto === "X") return false;
                    if (filterExcludeOperators.length > 0 && filterExcludeOperators.includes(r.acq_da)) return false;
                    return true;
                });
                const filteredSap = filteredRecords.reduce((sum, r) => sum + (r.qta_ottenuta || 0), 0);
                filtered[comp][fase] = {
                    ...cell,
                    sap: filteredSap,
                    remaining: (cell.inv || 0) - filteredSap + (cell.sapPrev || 0),
                    records: filteredRecords
                };
            }
        }
        return filtered;
    }, [rawMatrixData, filterExcludeSto, filterExcludeOperators]);

    // NOTE: Don't sync with globalDate - we want to keep the week start date, not today
    // useEffect(() => {
    //     if (globalDate) setInventarioDate(globalDate);
    // }, [globalDate]);

    useEffect(() => {
        if (!isConfigMode) {
            // Reload exclusion/inclusion data when exiting config mode to show saved changes
            const loadVisibility = async () => {
                const { data: visRes } = await supabase.from("cell_visibility_overrides").select("*").eq("view", "lab");
                const excl = {}, incl = {};
                if (visRes) {
                    visRes.forEach(r => {
                        const key = `${r.componente}:${r.fase}`;
                        if (r.tipo === "exclude") excl[key] = true;
                        else if (r.tipo === "include") incl[key] = true;
                    });
                }
                setCellExclusions(excl);
                setCellInclusions(incl);
            };
            loadVisibility();
        }
    }, [isConfigMode]);

    const fetchData = async () => {
        if (!inventarioDate || !inventarioDateFine) return;
        setLoading(true);

        // Rimuovi dal localStorage tutte le fasi che NON devono essere bloccate (non in NO_SAP_PREV_PHASES)
        try {
            const stored = JSON.parse(localStorage.getItem("lab_no_sap_prev") || "{}");
            let modified = false;
            Object.keys(stored).forEach(key => {
                const parts = key.split(":");
                const fase = parts.slice(1).join(":");
                if (!fase) return;
                const isDefaultDisabled = Object.values(NO_SAP_PREV_PHASES).some(arr => arr.includes(fase));
                if (!isDefaultDisabled) {
                    delete stored[key];
                    modified = true;
                }
            });
            if (modified) {
                localStorage.setItem("lab_no_sap_prev", JSON.stringify(stored));
                noSapPrevRef.current = stored;
            }
        } catch (e) {
            // ignore
        }

        try {
            // 1. Anagrafica materiali
            const anagrafica = {};
            Object.entries(LOCAL_ANAGRAFICA).forEach(([mat, info]) => {
                anagrafica[mat.toUpperCase()] = { comp: info.comp, proj: info.proj };
            });
            const { data: anagraficaRes } = await fetchAllRows(() =>
                supabase.from("anagrafica_materiali").select("codice,componente,progetto")
            );
            if (anagraficaRes) {
                anagraficaRes.forEach(row => {
                    const c = (row.codice || "").toUpperCase();
                    if (c && !anagrafica[c]) {
                        anagrafica[c] = { comp: row.componente, proj: row.progetto };
                    }
                });
            }

            const { data: visRes } = await supabase.from("cell_visibility_overrides").select("*").eq("view", "lab");
            const excl = {}, incl = {};
            if (visRes) {
                visRes.forEach(r => {
                    const key = `${r.componente}:${r.fase}`;
                    if (r.tipo === "exclude") excl[key] = true;
                    else if (r.tipo === "include") incl[key] = true;
                });
            }
            setCellExclusions(excl);
            setCellInclusions(incl);

            // 2. Material_fino_overrides → sequenza finos per componente
            const { data: matOverridesRes } = await fetchAllRows(() =>
                supabase.from("material_fino_overrides").select("materiale,fino,fase,componente,progetto")
            );
            const dbOverrides = (matOverridesRes || []).map(r => ({
                mat: (r.materiale || "").toUpperCase(),
                fino: r.fino ? String(r.fino).padStart(4, "0") : null,
                fase: r.fase,
                comp: (r.componente || "").toUpperCase(),
                proj: (r.progetto || "").trim()
            }));

            // Costruisce sequenze finos per componente
            const LAB_SEQUENCE_DEFAULT = [
                "start_soft", "laser_welding", "ut_soft", "shaping",
                "milling", "hobbing", "deburring", "to_be_treated", "ht",
                "shot_peening", "start_hard", "laser_welding_2", "ut",
                "grinding_cone", "grinding_cone_2", "teeth_grinding", "to_be_washed", "washing", "baa"
            ];
            // DCT ECO: aggiungi slw tra start_hard (DRA) e laser_welding_2 (SCA), dopo shot_peening (OKU)
            const LAB_SEQUENCE_ECO = [
                "start_soft", "laser_welding", "ut_soft", "shaping",
                "milling", "hobbing", "deburring", "to_be_treated", "ht",
                "shot_peening", "start_hard", "slw", "laser_welding_2", "ut",
                "grinding_cone", "grinding_cone_2", "teeth_grinding", "to_be_washed", "washing", "baa"
            ];
            // DCT300: rimuovi ut_soft(MZA), milling(FRA), grinding_cone/2(SLA)
            //         aggiungi ore dopo deburring, teeth_grinding_post_dra dopo start_hard
            const LAB_SEQUENCE_DCT300 = [
                "start_soft", "laser_welding", "shaping",
                "hobbing", "deburring", "ore", "to_be_treated", "ht",
                "shot_peening", "start_hard", "teeth_grinding_post_dra", "laser_welding_2", "ut",
                "teeth_grinding", "to_be_washed", "washing", "baa"
            ];
            const LAB_SEQUENCE_BY_PROJ = {
                "DCT ECO": LAB_SEQUENCE_ECO,
                "DCT300": LAB_SEQUENCE_DCT300
            };

            const finoSeqSorted = {};
            PROJECTS.forEach(proj => {
                const comps = PROJECT_COMPONENTS_LAB[proj] || [];
                comps.forEach(comp => {
                    const normComp = normalizeComp(comp, proj);
                    // Create sequence with sample fino values to ensure components always display
                    const finoPrefix = String((Object.keys(finoSeqSorted).length % 99) + 1).padStart(2, "0");
                    let finoCounter = 0;
                    const LAB_SEQUENCE = LAB_SEQUENCE_BY_PROJ[proj] || LAB_SEQUENCE_DEFAULT;
                    finoSeqSorted[normComp] = LAB_SEQUENCE.map(fase => {
                        finoCounter++;
                        const override = dbOverrides.find(o =>
                            normalizeComp(o.comp, o.proj) === normComp && o.proj === proj && o.fase === fase
                        );
                        // Se override esiste ma fino è "0000" o vuoto, usa il counter generato
                        const overrideFino = override?.fino;
                        const isAutoFino = !overrideFino || overrideFino === "0000";
                        const validFino = isAutoFino ? String(finoCounter).padStart(4, "0") : overrideFino;
                        return {
                            fino: validFino,
                            fase: fase,
                            isAutoFino // true = nessuna configurazione reale per questa cella
                        };
                    });
                });
            });
            // 3. Inventario fisico da Supabase
            const { data: invRes } = await supabase
                .from("inventario_fisico")
                .select("componente,fino,quantita,data_inventario,data_ora_inventario")
                .eq("data_inventario", inventarioDate);
            const invMap = {}; // {comp: {fino: qty}}
            let markerDataOra = null;
            if (invRes) {
                invRes.forEach(r => {
                    const comp = (r.componente || "").toUpperCase();
                    const fino = String(r.fino || "").padStart(4, "0");
                    // Il MARKER segna l'inizio inventario — leggi solo da lui
                    if (comp === "MARKER_INIZIO_INVENTARIO") {
                        markerDataOra = r.data_ora_inventario;
                        return; // non aggiungere alla mappa dati
                    }
                    if (!invMap[comp]) invMap[comp] = {};
                    invMap[comp][fino] = r.quantita || 0;
                });
                setInventarioOraInizio(markerDataOra);
            }
            // 4. SAP conferme nel periodo inventario
            const { data: sapRes } = await fetchAllRows(() =>
                supabase.from("conferme_sap")
                    .select("data,materiale,fino,qta_ottenuta,work_center_sap,macchina_id,turno_id,acq_da,sto")
                    .gte("data", inventarioDate)
                    .lte("data", inventarioDateFine)
            );

            // Aggrega SAP per comp+fino
            const sapMap = {}; // {comp: {fino: {qty, records}}}


            // Filtro materiali e progetto stretti
            // Match esatto mat+fino ha priorità, mat senza fino è fallback generico (come ComponentFlowView)
            const validConfigMap = {};  // {mat_fino: {comp, fase}}
            const genericMatMap = {};   // {mat: {comp, fase}} per override con fino=null
            dbOverrides.forEach(o => {
                if (!PROJECTS.includes(o.proj)) return;
                if (o.fino) {
                    validConfigMap[`${o.mat}_${o.fino}`] = { comp: normalizeComp(o.comp, o.proj), fase: o.fase };
                } else {
                    genericMatMap[o.mat] = { comp: normalizeComp(o.comp, o.proj), fase: o.fase };
                }
            });

            const unconfigured = {}; // {materiale_fino: {materiale, fino, qty}}
            if (sapRes) {
                sapRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase().split("/")[0].trim();
                    const fino = String(r.fino || "").padStart(4, "0");
                    if (!fino || fino === "0000") return;

                    const config = validConfigMap[`${matCode}_${fino}`] || genericMatMap[matCode];
                    if (!config) {
                        // Raccogli solo materiali che appartengono a progetti configurati
                        const anagEntry = anagrafica[matCode];
                        if (!anagEntry || !PROJECTS.includes(anagEntry.proj)) return;
                        const key = `${matCode}_${fino}`;
                        if (!unconfigured[key]) unconfigured[key] = { materiale: matCode, fino, qty: 0 };
                        unconfigured[key].qty += (r.qta_ottenuta || 0);
                        return;
                    }

                    const comp = config.comp;
                    if (!sapMap[comp]) sapMap[comp] = {};
                    if (!sapMap[comp][fino]) sapMap[comp][fino] = { qty: 0, records: [] };
                    sapMap[comp][fino].qty += (r.qta_ottenuta || 0);
                    sapMap[comp][fino].records.push({
                        ...r,
                        matCode,
                        macchina: (r.macchina_id || r.work_center_sap || "").toUpperCase()
                    });
                });
            }
            setUnconfiguredSap(Object.values(unconfigured));

            // Per componenti senza material_fino_overrides, aggiorna finoSeqSorted
            // usando i finos reali trovati in sapMap (invece dei placeholder)
            PROJECTS.forEach(proj => {
                const LAB_SEQUENCE = LAB_SEQUENCE_BY_PROJ[proj] || LAB_SEQUENCE_DEFAULT;
                (PROJECT_COMPONENTS_LAB[proj] || []).forEach(comp => {
                    const normComp = normalizeComp(comp, proj);
                    const seq = finoSeqSorted[normComp] || [];
                    const compSapFinos = Object.keys(sapMap[normComp] || {}).sort();
                    if (compSapFinos.length === 0) return;

                    // Conta quante celle hanno finos reali da dbOverrides
                    const configuredFinos = new Set(
                        dbOverrides
                            .filter(o => normalizeComp(o.comp, o.proj) === normComp && o.proj === proj)
                            .map(o => o.fino)
                    );
                    const hasFullConfig = seq.every(s => configuredFinos.has(s.fino));
                    if (hasFullConfig) return; // già tutto configurato

                    // Assegna finos reali SAP alle fasi in ordine
                    let finoIdx = 0;
                    finoSeqSorted[normComp] = LAB_SEQUENCE.map((fase, i) => {
                        // Se esiste un override DB per questa fase, usalo
                        const override = dbOverrides.find(o =>
                            normalizeComp(o.comp, o.proj) === normComp && o.proj === proj && o.fase === fase
                        );
                        if (override) return { fino: override.fino, fase };
                        // Altrimenti usa il prossimo fino reale da SAP
                        const sapFino = compSapFinos[finoIdx++] || String(i + 1).padStart(4, "0");
                        return { fino: sapFino, fase };
                    });
                });
            });

            // 5. Calcolo WIP flow per componente
            // Prima passata: costruisci la mappa sap per ogni cella
            const newMatrix = {};
            PROJECTS.forEach(proj => {
                const comps = PROJECT_COMPONENTS_LAB[proj] || [];
                comps.forEach(comp => {
                    const normComp = normalizeComp(comp, proj);
                    const seq = finoSeqSorted[normComp] || [];
                    newMatrix[normComp] = {};

                    // Prima passata: calcola sap per ogni cella (chiave = fase, unica nella sequenza)
                    seq.forEach(({ fino, fase, isAutoFino }) => {
                        const sap = sapMap[normComp]?.[fino]?.qty || 0;
                        const sapRecords = sapMap[normComp]?.[fino]?.records || [];
                        newMatrix[normComp][fase] = { fino, fase, isAutoFino, sap, sapRecords };
                    });

                    // Seconda passata: propaga sapPrev = sap della fase precedente visibile
                    seq.forEach(({ fino, fase, isAutoFino }, idx) => {
                        const inv = invMap[normComp]?.[fino] || 0;
                        const cellData = newMatrix[normComp]?.[fase] || { sap: 0, sapRecords: [] };
                        const { sap, sapRecords } = cellData;
                        const hasNoSapData = sap === 0 && (sapRecords || []).length === 0;

                        const sapPrevSourceFase = SAP_PREV_SOURCE[proj]?.[fase];
                        let sapPrev = 0;
                        const noSapPrev = !!(NO_SAP_PREV_PHASES[proj]?.includes(fase));

                        if (!noSapPrev && idx > 0) {
                            if (sapPrevSourceFase) {
                                const sourceIdx = seq.findIndex(s => s.fase === sapPrevSourceFase);
                                for (let i = sourceIdx; i >= 0; i--) {
                                    if (!excl[`${normComp}:${seq[i].fase}`]) {
                                        sapPrev = newMatrix[normComp][seq[i].fase]?.sap || 0;
                                        break;
                                    }
                                }
                            } else {
                                for (let i = idx - 1; i >= 0; i--) {
                                    if (!excl[`${normComp}:${seq[i].fase}`]) {
                                        sapPrev = newMatrix[normComp][seq[i].fase]?.sap || 0;
                                        break;
                                    }
                                }
                            }
                        }

                        const isFirstActive = sapPrev === 0 && idx === 0;
                        const remaining = (isFirstActive && inv === 0) ? sap : (inv - sap + sapPrev);

                        newMatrix[normComp][fase] = {
                            fino, fase, inv, sap, sapPrev, remaining,
                            records: sapRecords, isFirstActive, isAutoFino, hasNoSapData, noSapPrev
                        };
                    });
                });
            });

            // Imposta sequenze DOPO la riassegnazione, così render e matrix usano gli stessi finos
            setFinoSequences({ ...finoSeqSorted });
            setRawMatrixData(newMatrix);
            setComponentsByProject(PROJECT_COMPONENTS_LAB);

        } catch (err) {
            console.error("[PrioritaView] Errore fetchData:", err);
            showToast?.("Errore caricamento dati inventario", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inventarioDate, inventarioDateFine, refreshKey]);

    const toggleCellVisibility = async (comp, fase) => {
        const normC = comp; // già normalizzato dal chiamante
        const key = `${normC}:${fase}`;
        const isExcluded = !!cellExclusions[key];

        try {
            if (isExcluded) {
                await supabase.from("cell_visibility_overrides")
                    .delete()
                    .eq("view", "lab").eq("tipo", "exclude")
                    .eq("componente", normC).eq("fase", fase);
                setCellExclusions(prev => { const u = { ...prev }; delete u[key]; return u; });
            } else {
                await supabase.from("cell_visibility_overrides")
                    .upsert({ view: "lab", tipo: "exclude", progetto: "ALL", componente: normC, fase: fase },
                        { onConflict: "view,tipo,progetto,componente,fase" });
                setCellExclusions(prev => ({ ...prev, [key]: true }));
            }
        } catch (err) {
            console.error("Errore toggle visibilità:", err);
            showToast?.("Errore salvataggio visibilità", "error");
        }
    };

    const toggleCellExclusion = async (comp, fase) => {
        const normC = comp; // già normalizzato dal chiamante
        const key = `${normC}:${fase}`;
        const isCurrentlyExcluded = !!cellExclusions[key];
        try {
            if (isCurrentlyExcluded) {
                await supabase.from("cell_visibility_overrides")
                    .delete()
                    .eq("view", "lab").eq("tipo", "exclude")
                    .eq("componente", normC).eq("fase", fase);
                setCellExclusions(prev => { const u = { ...prev }; delete u[key]; return u; });
            } else {
                await supabase.from("cell_visibility_overrides")
                    .upsert({ view: "lab", tipo: "exclude", progetto: "ALL", componente: normC, fase: fase },
                        { onConflict: "view,tipo,progetto,componente,fase" });
                setCellExclusions(prev => ({ ...prev, [key]: true }));
            }
        } catch (err) {
            console.error("Errore toggle esclusione:", err);
            showToast?.("Errore salvataggio", "error");
        }
    };

    const toggleCellInclusion = async (comp, fase) => {
        const normC = comp; // già normalizzato dal chiamante
        const key = `${normC}:${fase}`;
        const isCurrentlyIncluded = !!cellInclusions[key];
        try {
            if (isCurrentlyIncluded) {
                await supabase.from("cell_visibility_overrides")
                    .delete()
                    .eq("view", "lab").eq("tipo", "include")
                    .eq("componente", normC).eq("fase", fase);
                setCellInclusions(prev => { const u = { ...prev }; delete u[key]; return u; });
            } else {
                await supabase.from("cell_visibility_overrides")
                    .upsert({ view: "lab", tipo: "include", progetto: "ALL", componente: normC, fase: fase },
                        { onConflict: "view,tipo,progetto,componente,fase" });
                setCellInclusions(prev => ({ ...prev, [key]: true }));
            }
        } catch (err) {
            console.error("Errore toggle inclusione:", err);
            showToast?.("Errore salvataggio", "error");
        }
    };

    const toggleNoSapPrev = (comp, fase) => {
        const key = `${comp}:${fase}`;
        setNoSapPrevCells(prev => {
            const updated = { ...prev };
            if (updated[key]) delete updated[key];
            else updated[key] = true;
            localStorage.setItem("lab_no_sap_prev", JSON.stringify(updated));
            noSapPrevRef.current = updated;
            return updated;
        });
        setTimeout(() => fetchData(), 0);
    };

    const saveInventory = async (comp, fino, qty) => {
        // Auto-generate dummy fino if not configured (e.g., HT with null fino)
        let saveFino = fino;
        if (!fino || fino === "0000" || fino === null) {
            saveFino = `99${comp.slice(-2)}`.substring(0, 4).padStart(4, "0");
            showToast?.(`Salvataggio con operazione generata: ${saveFino}`, "info");
        }
        const normComp = comp.toUpperCase();
        setSavingCell({ comp: normComp, fino: saveFino });
        try {
            // Bypass per sviluppo locale senza Supabase
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const isDevMode = !supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseAnonKey?.length || supabaseAnonKey.includes('placeholder');

            if (isDevMode) {
                // Salva in localStorage per sviluppo locale
                const key = `inv_${normComp}_${saveFino}`;
                const data = { componente: normComp, fino: saveFino, quantita: qty, data_inventario: inventarioDate, updated_at: new Date().toISOString() };
                localStorage.setItem(key, JSON.stringify(data));
                showToast?.(`Salvato: ${comp} op.${saveFino} = ${qty}`, "success");
            } else {
                const { error } = await supabase.from("inventario_fisico")
                    .upsert({
                        componente: normComp,
                        fino: saveFino,
                        quantita: qty,
                        data_inventario: inventarioDate,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "componente,fino" });

                if (error) throw error;
            }

            // Ricalcola rimanenza per questa fase e la successiva (aggiorna rawMatrixData)
            setRawMatrixData(prev => {
                const updated = { ...prev };
                if (!updated[normComp]) return prev;
                const seq = finoSequences[normComp] || [];
                const idx = seq.findIndex(s => s.fino === saveFino);
                if (idx === -1) return prev;
                const fase = seq[idx].fase;

                // Ricalcola fase corrente
                const prevFase = idx > 0 ? seq[idx - 1].fase : null;
                const sapPrev = prevFase ? (updated[normComp][prevFase]?.sap || 0) : 0;
                const cell = updated[normComp][fase];
                updated[normComp][fase] = { ...cell, inv: qty, remaining: qty - (cell?.sap || 0) + sapPrev };

                // Ricalcola fase successiva (il suo sapPrev cambia)
                const nextEntry = seq[idx + 1];
                if (nextEntry) {
                    const nextCell = updated[normComp][nextEntry.fase];
                    const newSap = updated[normComp][fase]?.sap || 0;
                    updated[normComp][nextEntry.fase] = {
                        ...nextCell,
                        sapPrev: newSap,
                        remaining: (nextCell?.inv || 0) - (nextCell?.sap || 0) + newSap
                    };
                }
                return updated;
            });

        } catch (err) {
            console.error("[PrioritaView] Errore salvataggio inventario:", err);
            showToast?.("Errore salvataggio inventario", "error");
        } finally {
            setSavingCell(null);
        }
    };

    const resetInventarioPeriod = async () => {
        const selectedDate = resetDate; // YYYY-MM-DD
        const [hours, minutes] = resetTime.split(":").map(Number); // HH:MM

        // Costruisce timestamp locale preciso (orario selezionato dall'utente)
        const d = new Date(selectedDate + "T00:00:00");
        d.setHours(hours, minutes, 0, 0);
        const resetTimestampWithTime = d.toISOString();

        setInventarioDate(selectedDate);
        setInventarioDateFine(selectedDate);
        setCellExclusions({});
        setCellInclusions({});

        try {
            const { error } = await supabase.from("inventario_fisico").upsert({
                componente: "MARKER_INIZIO_INVENTARIO",
                fino: "0000",
                quantita: 0,
                data_inventario: selectedDate,
                data_ora_inventario: resetTimestampWithTime,
                updated_at: resetTimestampWithTime
            }, {
                onConflict: "componente,fino"
            });

            if (error) throw error;

            // Aggiorna subito il display
            setInventarioOraInizio(resetTimestampWithTime);
            const formattedDate = new Date(selectedDate).toLocaleDateString("it-IT");
            showToast?.("✓ Periodo resettato a " + formattedDate + " ore " + resetTime, "success");
        } catch (err) {
            console.error("[Reset] Errore upsert:", err);
            showToast?.("Errore: " + err.message, "error");
        }

        setResetConfirmModal(false);
        // Forza fetchData anche se le date non sono cambiate (refreshKey cambia sempre)
        setRefreshKey(k => k + 1);
    };

    const startEditing = (comp, fino, currentInv, proj, faseHint) => {
        if (isConfigMode) {
            // Use faseHint when provided (avoids ambiguity when fino="0000" appears multiple times)
            const fase = faseHint;
            setQuickConfigModal({
                project: proj || activeTab,
                comp,
                fino,   // pass fino so the modal can filter by exact operation
                phase: fase,
                phaseLabel: PHASE_LABEL[fase] || fase || fino
            });
            return;
        }
        setEditingCell({ comp, fino, value: currentInv });
    };

    const commitEdit = async () => {
        if (!editingCell) return;
        const qty = parseInt(editingCell.value) || 0;
        await saveInventory(editingCell.comp, editingCell.fino, qty);
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    // Colore rimanenza
    const remainingColor = (remaining) => {
        if (remaining < 0) return "#ef4444";
        if (remaining === 0) return "var(--text-muted)";
        return "var(--text-primary)";
    };

    const remainingBg = (remaining) => {
        if (remaining < 0) return "rgba(239, 68, 68, 0.12)";
        if (remaining === 0) return "var(--bg-tertiary)";
        return "rgba(255,255,255,0.04)";
    };

    return (
        <div className="fade-in" style={{ padding: "20px", height: "100%", overflowY: "auto" }}>

            {/* Header toolbar */}
            <div style={{ marginBottom: 20 }}>
                {/* Riga 1: titolo + filtri + azioni */}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    {/* Titolo */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                        <div style={{ fontSize: 20 }}>📦</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>Laboratorio Inventario</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>WIP tracking con scarichi SAP</div>
                        </div>
                    </div>

                    {/* Separatore */}
                    <div style={{ width: 1, height: 36, background: "var(--border-light)", alignSelf: "flex-end", marginBottom: 2 }} />

                    {/* Dal */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dal</span>
                        <input type="date" value={inventarioDate} onChange={e => setInventarioDate(e.target.value)}
                            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", outline: "none", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} />
                    </div>

                    {/* Al */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Al</span>
                        <input type="date" value={inventarioDateFine} onChange={e => setInventarioDateFine(e.target.value)}
                            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", backgroundColor: "white", fontSize: 14, fontWeight: 600, color: "var(--text-primary)", outline: "none", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} />
                    </div>

                    {/* Separatore */}
                    <div style={{ width: 1, height: 36, background: "var(--border-light)", alignSelf: "flex-end", marginBottom: 2 }} />

                    {/* Bottoni azione — stile uniforme */}
                    {(() => {
                        const btnBase = { display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: "38px", borderRadius: 8, border: "1px solid var(--border-light)", backgroundColor: "white", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "all 0.15s", fontFamily: "inherit", lineHeight: 1 };
                        const hasActiveFilter = filterExcludeSto || filterExcludeOperators.length > 0;
                        return (<>
                            <button onClick={() => fetchData()} style={btnBase}>
                                {Icons.refresh} Aggiorna
                            </button>

                            <button onClick={() => setShowFilterPanel(true)} style={{ ...btnBase, ...(hasActiveFilter ? { backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid #60a5fa55" } : {}) }}>
                                🔽 Filtra {hasActiveFilter ? "●" : ""}
                            </button>

                            <button onClick={() => setShowOperatorReport(true)} style={btnBase}>
                                📊 Operatori
                            </button>

                            <button onClick={() => { const now = new Date(); setResetDate(now.toISOString().split("T")[0]); setResetTime(now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })); setResetConfirmModal(true); }}
                                style={{ ...btnBase, backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid #ef444433" }}
                                title="Seleziona data e ora inizio inventario fisico.">
                                🔄 Reset Periodo
                            </button>

                            <button onClick={() => setShowDetails(!showDetails)}
                                style={{ ...btnBase, ...(showDetails ? { backgroundColor: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid #60a5fa33" } : {}) }}>
                                {showDetails ? "Nascondi Dettagli" : "Mostra Dettagli"}
                            </button>

                            <button onClick={() => setIsConfigMode(!isConfigMode)}
                                title={isConfigMode ? "Esci dalla configurazione" : "Configura celle"}
                                style={{ ...btnBase, ...(isConfigMode ? { backgroundColor: "var(--accent)", color: "white", border: "1px solid var(--accent)", boxShadow: "0 0 8px var(--accent)" } : {}) }}>
                                {isConfigMode ? "✓ Salva Config" : "⚙️ Configura Celle"}
                            </button>
                        </>);
                    })()}

                    {/* Orario inizio inventario */}
                    {inventarioOraInizio && (() => {
                        const d = new Date(inventarioOraInizio);
                        return (
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginLeft: "auto", alignSelf: "flex-end", paddingBottom: 2 }}>
                                📋 Inventario fisico del {d.toLocaleDateString("it-IT")} ore {d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Legenda */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                    { color: "var(--accent)", label: "Inv", desc: "Inventario fisico (editabile)" },
                    { color: "#60a5fa", label: "SAP ↓", desc: "Scarichi SAP dal " + new Date(inventarioDate + "T12:00:00").toLocaleDateString("it-IT") + " al " + new Date(inventarioDateFine + "T12:00:00").toLocaleDateString("it-IT") },
                    { color: "#a78bfa", label: "SAP ↑", desc: "Entrate dalla fase precedente" },
                    { color: "var(--text-primary)", label: "=", desc: "Rimanenza = Inv - SAP↓ + SAP↑" },
                ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                        <span style={{ fontWeight: 700, color: item.color }}>{item.label}</span>
                        <span>{item.desc}</span>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            {!loading && (
                <div style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 20,
                    borderBottom: "2px solid var(--border)",
                    paddingBottom: 12
                }}>
                    {PROJECTS.map(proj => {
                        const theme = PROJECT_COLORS[proj] || PROJECT_COLORS["DCT300"];
                        const isActive = activeTab === proj;
                        return (
                            <button
                                key={proj}
                                onClick={() => setActiveTab(proj)}
                                style={{
                                    padding: "10px 20px",
                                    background: isActive ? theme.bg : "transparent",
                                    border: `2px solid ${isActive ? theme.main : "transparent"}`,
                                    borderRadius: "8px 8px 0 0",
                                    color: isActive ? theme.main : "var(--text-secondary)",
                                    fontWeight: isActive ? 800 : 600,
                                    fontSize: 14,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                }}
                            >
                                <div style={{ width: 10, height: 10, borderRadius: "50%", background: theme.main }} />
                                {proj}
                            </button>
                        );
                    })}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    Caricamento dati...
                </div>
            )}

            {!loading && [activeTab].map(proj => {
                const comps = componentsByProject[proj] || [];
                if (comps.length === 0) return null;
                const theme = PROJECT_COLORS[proj] || PROJECT_COLORS["DCT300"];

                return (
                    <div key={proj} style={{
                        background: "var(--bg-card)",
                        borderRadius: 16,
                        border: `1px solid ${theme.main}33`,
                        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        marginBottom: 24
                    }}>
                        {/* Header progetto */}
                        <div style={{
                            padding: "10px 20px",
                            background: `linear-gradient(90deg, ${theme.bg}, transparent)`,
                            borderBottom: `1px solid ${theme.main}22`,
                            display: "flex", alignItems: "center", gap: 12
                        }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.main }} />
                            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: theme.main }}>
                                {proj}
                            </h2>
                        </div>

                        {/* Tabella */}
                        <div style={{ overflow: "auto", padding: 12 }}>
                            <div style={{ minWidth: "max-content" }}>
                                {/* Intestazione colonne — solo una volta */}
                                {(() => {
                                    const firstSeq = finoSequences[normalizeComp(comps[0], proj)] || [];
                                    if (firstSeq.length === 0) return null;
                                    return (
                                        <div style={{ display: "flex", marginBottom: 6, paddingLeft: 120, position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 2 }}>
                                            {firstSeq.map(({ fino, fase }) => (
                                                <div key={fase + "_" + fino} style={{
                                                    width: 90, flexShrink: 0, textAlign: "center", paddingTop: 4,
                                                    borderTop: `2px solid ${theme.main}44`
                                                }}>
                                                    <div style={{ fontSize: 14, fontWeight: 800, color: theme.main }}>
                                                        {PHASE_CODE[fase] || fase}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {comps.map(comp => {
                                    const normComp = normalizeComp(comp, proj);
                                    const seq = finoSequences[normComp] || [];
                                    const compMatrix = matrixData[normComp] || {};

                                    if (seq.length === 0) {
                                        return (
                                            <div key={comp} style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                                                Nessuna fase configurata per {comp}. Configura i materiali tramite ⚙ Configura Celle.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={comp}>
                                            {/* Riga componente */}
                                            <div style={{ display: "flex", alignItems: "stretch", padding: "8px 0" }}>
                                                {/* Label componente */}
                                                <div style={{
                                                    alignSelf: "flex-start", height: 50, width: 120, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                                                    fontSize: 16, fontWeight: 800, color: "var(--text-primary)",
                                                    paddingRight: 8
                                                }}>
                                                    {comp}
                                                </div>

                                                {/* Celle */}
                                                {seq.map(({ fino, fase }, idx) => {
                                                    const cell = compMatrix[fase] || { inv: 0, sap: 0, sapPrev: 0, remaining: 0, records: [] };
                                                    const isEditing = editingCell?.comp === normComp && editingCell?.fino === fino;
                                                    const isSaving = savingCell?.comp === normComp && savingCell?.fino === fino;
                                                    const isFirstFino = idx === 0;

                                                    const isCellExcluded = !!cellExclusions[`${normComp}:${fase}`];

                                                    // Handle excluded cells
                                                    if (isCellExcluded) {
                                                        if (!isConfigMode) {
                                                            // Normal mode — return empty placeholder to keep layout
                                                            return <div key={fase + "_" + fino} style={{ width: 90, flexShrink: 0 }} />;
                                                        }
                                                    }

                                                    // In config mode, if excluded, show "+" button instead
                                                    if (isConfigMode && isCellExcluded) {
                                                        return (
                                                            <div key={fase + "_" + fino} style={{
                                                                width: 90, flexShrink: 0, padding: "0 4px",
                                                                borderLeft: idx > 0 ? "1px solid var(--border-light)" : "none",
                                                                display: "flex", justifyContent: "center", alignItems: "center"
                                                            }}>
                                                                <div
                                                                    onClick={() => toggleCellExclusion(normComp, fase)}
                                                                    title="Ripristina cella"
                                                                    style={{
                                                                        width: "75px", height: "45px",
                                                                        border: "2px dashed var(--accent)",
                                                                        borderRadius: "10px",
                                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                                        cursor: "pointer", color: "var(--accent)", fontSize: "20px",
                                                                        opacity: 0.5, transition: "all 0.2s"
                                                                    }}
                                                                >+</div>
                                                            </div>
                                                        );
                                                    }

                                                    const isEditable = !(NON_EDITABLE_PHASES[proj] || []).includes(fase);

                                                    // Highlight operator & storno
                                                    const rawCell = rawMatrixData[normComp]?.[fase];
                                                    const allRecords = rawCell?.records || [];
                                                    const hasHighlightedOperator = highlightOperator && allRecords.some(r => r.acq_da === highlightOperator);
                                                    const hasSto = allRecords.some(r => r.sto === "X");
                                                    const inv = cell.inv || 0;

                                                    return (
                                                        <div key={fase + "_" + fino} style={{
                                                            width: 90, flexShrink: 0, padding: "0 4px",
                                                            borderLeft: idx > 0 ? "1px solid var(--border-light)" : "none"
                                                        }}>
                                                            {/* Cella principale — rimanenza */}
                                                            <div
                                                                onClick={() => {
                                                                    if (isConfigMode) {
                                                                        startEditing(normComp, fino, cell.inv, proj, fase);
                                                                    } else if (!isEditing && cell.records?.length > 0) {
                                                                        setSelectedDetail({
                                                                            title: `${comp} — op.${fino} (${PHASE_CODE[fase] || fase})`,
                                                                            records: cell.records,
                                                                            fino, fase
                                                                        });
                                                                    }
                                                                }}
                                                                title={isConfigMode ? "Clicca per configurare questa cella" : "Clicca per vedere i pezzi prodotti"}
                                                                style={{
                                                                    width: "100%",
                                                                    height: 50,
                                                                    background: hasHighlightedOperator ? "rgba(239,68,68,0.15)" : remainingBg(cell.remaining),
                                                                    borderRadius: 10,
                                                                    display: "flex",
                                                                    flexDirection: "column",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    cursor: isConfigMode ? "pointer" : cell.records?.length > 0 ? "pointer" : "default",
                                                                    border: isConfigMode ? "2px dashed var(--accent)" : hasHighlightedOperator ? "2px solid #ef4444" : `1px solid ${cell.remaining !== 0 ? theme.main + "33" : "transparent"}`,
                                                                    position: "relative",
                                                                    transition: "all 0.15s"
                                                                }}
                                                            >
                                                                {isSaving ? (
                                                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>...</div>
                                                                ) : isEditing ? (
                                                                    <input
                                                                        autoFocus
                                                                        type="number"
                                                                        value={editingCell.value}
                                                                        onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                                                                        onBlur={commitEdit}
                                                                        onKeyDown={e => e.key === "Enter" && commitEdit()}
                                                                        style={{
                                                                            width: "90%", fontSize: 16, textAlign: "center",
                                                                            fontWeight: 900, border: "2px solid var(--accent)",
                                                                            borderRadius: 6, padding: "2px 0", outline: "none",
                                                                            background: "white", color: "black"
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        fontSize: Math.abs(cell.remaining) >= 1000 ? 14 : 18,
                                                                        fontWeight: 900,
                                                                        color: remainingColor(cell.remaining),
                                                                        opacity: cell.remaining === 0 ? 0.35 : 1
                                                                    }}>
                                                                        {cell.remaining !== 0 ? cell.remaining : "—"}
                                                                    </div>
                                                                )}

                                                                {/* Badge storno — visibile quando ci sono record con sto="X" */}
                                                                {hasSto && !isConfigMode && (
                                                                    <div title="Contiene storni (sto=X)" style={{
                                                                        position: "absolute", top: -5, right: -5,
                                                                        background: "#f59e0b", color: "white",
                                                                        borderRadius: "50%", width: 14, height: 14,
                                                                        fontSize: 8, fontWeight: 900,
                                                                        display: "flex", alignItems: "center", justifyContent: "center"
                                                                    }}>S</div>
                                                                )}

                                                                {/* Badge configurazione mancante — fino auto-generato */}
                                                                {!isConfigMode && rawCell?.isAutoFino && (
                                                                    <div title="Fino non configurato — vai su ⚙️ Configura Celle per impostare l'operazione SAP" style={{
                                                                        position: "absolute", top: -5, left: -5,
                                                                        background: "#ef4444", color: "white",
                                                                        borderRadius: "50%", width: 14, height: 14,
                                                                        fontSize: 9, fontWeight: 900,
                                                                        display: "flex", alignItems: "center", justifyContent: "center"
                                                                    }}>!</div>
                                                                )}

                                                                {/* Badge nessun dato SAP nel periodo (fino configurato ma vuoto) */}
                                                                {!isConfigMode && !rawCell?.isAutoFino && rawCell?.hasNoSapData && inv === 0 && (
                                                                    <div title="Nessuno scarico SAP in questo periodo" style={{
                                                                        position: "absolute", top: -5, left: -5,
                                                                        background: "#f59e0b", color: "white",
                                                                        borderRadius: "50%", width: 14, height: 14,
                                                                        fontSize: 9, fontWeight: 900,
                                                                        display: "flex", alignItems: "center", justifyContent: "center"
                                                                    }}>?</div>
                                                                )}

                                                                {isConfigMode && (
                                                                    <>
                                                                        {/* Hide/Exclude button - top left */}
                                                                        <div
                                                                            onClick={(e) => { e.stopPropagation(); toggleCellExclusion(normComp, fase); }}
                                                                            title="Nascondi cella"
                                                                            style={{
                                                                                position: "absolute", top: -6, left: -6,
                                                                                background: "#ef4444",
                                                                                borderRadius: "50%",
                                                                                width: "20px", height: "20px", display: "flex",
                                                                                alignItems: "center", justifyContent: "center",
                                                                                fontSize: "12px", fontWeight: "bold",
                                                                                color: "white", cursor: "pointer",
                                                                                boxShadow: "0 2px 5px rgba(239,68,68,0.5)",
                                                                                transition: "all 0.2s"
                                                                            }}
                                                                        >
                                                                            ✕
                                                                        </div>
                                                                        {/* Toggle SAP ↑ (entrata da fase precedente) - top right */}
                                                                        {idx > 0 && (() => {
                                                                            const sapPrevDisabled = !!(NO_SAP_PREV_PHASES[proj]?.includes(fase)) !== !!noSapPrevCells[`${normComp}:${fase}`];
                                                                            return (
                                                                                <div
                                                                                    onClick={(e) => { e.stopPropagation(); toggleNoSapPrev(normComp, fase); }}
                                                                                    title={sapPrevDisabled ? "Abilita entrata da fase precedente" : "Disabilita entrata da fase precedente"}
                                                                                    style={{
                                                                                        position: "absolute", top: -6, right: -6,
                                                                                        background: sapPrevDisabled ? "#6b7280" : "#a78bfa",
                                                                                        borderRadius: "50%",
                                                                                        width: "20px", height: "20px", display: "flex",
                                                                                        alignItems: "center", justifyContent: "center",
                                                                                        fontSize: "10px", fontWeight: "bold",
                                                                                        color: "white", cursor: "pointer",
                                                                                        boxShadow: sapPrevDisabled ? "0 2px 5px rgba(107,114,128,0.4)" : "0 2px 5px rgba(167,139,250,0.5)",
                                                                                        transition: "all 0.2s"
                                                                                    }}
                                                                                >
                                                                                    ↑
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Inventario fisico (sempre visibile e editabile) */}
                                                            <div
                                                                onClick={() => isEditable && startEditing(normComp, fino, cell.inv, proj)}
                                                                title={isEditable ? "Modifica inventario fisico" : "Questa fase non è editabile"}
                                                                style={{
                                                                    width: "100%", fontSize: 12, fontWeight: 800,
                                                                    color: cell.inv > 0 ? "white" : "var(--text-muted)",
                                                                    textAlign: "center", cursor: isEditable ? "pointer" : "not-allowed",
                                                                    padding: "4px 2px", borderRadius: 6, marginTop: 4,
                                                                    border: cell.inv > 0 ? "none" : "1px dashed var(--border-light)",
                                                                    background: cell.inv > 0 ? "var(--accent)" : "transparent",
                                                                    opacity: isConfigMode ? 0 : isEditable ? 1 : 0.5
                                                                }}
                                                            >
                                                                {`Inv: ${cell.inv || 0}`}
                                                            </div>

                                                            {/* Riga dettagli SAP (visibili solo se showDetails) */}
                                                            {showDetails && (
                                                                <div style={{
                                                                    display: "flex", flexDirection: "column", gap: 3,
                                                                    padding: "4px 2px", width: "100%", borderTop: "1px solid var(--border-light)", marginTop: 4
                                                                }}>
                                                                {/* SAP scarichi */}
                                                                {true && (
                                                                    <div
                                                                        onClick={() => !isConfigMode && (cell.records?.length ?? 0) > 0 && setSelectedDetail({
                                                                            title: `${comp} — op.${fino} (${PHASE_CODE[fase] || fase})`,
                                                                            records: cell.records,
                                                                            fino, fase
                                                                        })}
                                                                        title="Scarichi SAP — clicca per dettaglio"
                                                                        style={{
                                                                            width: "100%", fontSize: 12, fontWeight: 800,
                                                                            color: "#60a5fa",
                                                                            textAlign: "center", cursor: (cell.records?.length ?? 0) > 0 ? "pointer" : "default",
                                                                            padding: "4px 2px", borderRadius: 6,
                                                                            border: "1px solid rgba(96,165,250,0.3)",
                                                                            background: "rgba(96,165,250,0.1)",
                                                                            whiteSpace: "nowrap"
                                                                        }}
                                                                    >
                                                                        {`SAP ↓: ${cell.sap || 0}`}
                                                                    </div>
                                                                )}

                                                                {/* Entrate dalla fase precedente */}
                                                                {!isFirstFino && !(rawCell?.noSapPrev ?? (!!(NO_SAP_PREV_PHASES[proj]?.includes(fase)) !== !!noSapPrevCells[`${normComp}:${fase}`])) && (
                                                                    <div
                                                                        title="Pezzi entrati dalla fase precedente"
                                                                        style={{
                                                                            width: "100%", fontSize: 12, fontWeight: 800,
                                                                            color: "#a78bfa",
                                                                            textAlign: "center",
                                                                            padding: "4px 2px", borderRadius: 6,
                                                                            border: "1px solid rgba(167,139,250,0.3)",
                                                                            background: "rgba(167,139,250,0.1)",
                                                                            whiteSpace: "nowrap"
                                                                        }}
                                                                    >
                                                                        {`SAP ↑: ${cell.sapPrev || 0}`}
                                                                    </div>
                                                                )}
                                                            </div>)}
                                                            </div>
                                                    );
                                                })}
                                            </div>

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Modale dettaglio scarichi SAP */}
            {selectedDetail && (
                <div style={{
                    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
                    display: "flex", flexDirection: "column", alignItems: "center", backdropFilter: "blur(4px)"
                }} onClick={() => setSelectedDetail(null)}>
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16,
                        width: "90%", maxWidth: 600, maxHeight: "80vh",
                        display: "flex", flexDirection: "column",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "1px solid var(--border)",
                        overflow: "hidden"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "var(--bg-tertiary)"
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDetail.title}</h3>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                    Scarichi SAP dal {new Date(inventarioDate + "T12:00:00").toLocaleDateString("it-IT")} al {new Date(inventarioDateFine + "T12:00:00").toLocaleDateString("it-IT")} — {selectedDetail.records?.length ?? 0} record
                                </div>
                            </div>
                            <button onClick={() => setSelectedDetail(null)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                                        {["Data", "Materiale", "Macchina", "Turno", "Q.tà"].map(h => (
                                            <th key={h} style={{ padding: "8px 10px", textAlign: h === "Q.tà" ? "right" : "left", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedDetail.records.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={{ padding: "8px 10px", fontSize: 12 }}>{new Date(r.data + "T12:00:00").toLocaleDateString("it-IT")}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{r.materiale}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 11 }}>{r.macchina_id || r.work_center_sap || "—"}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 11 }}>{r.turno_id || "—"}</td>
                                            <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 900, textAlign: "right", color: "#60a5fa" }}>{r.qta_ottenuta}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Config Modal */}
            {quickConfigModal && (
                <QuickConfigModal
                    data={quickConfigModal}
                    onClose={() => setQuickConfigModal(null)}
                    onSave={() => { setQuickConfigModal(null); fetchData(); }}
                    showToast={showToast}
                />
            )}

            {/* Filter Panel Modal */}
            {showFilterPanel && (
                <div style={{ position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}
                    onClick={() => setShowFilterPanel(false)}>
                    <div style={{ background:"var(--bg-card)",borderRadius:16,width:"90%",maxWidth:420,boxShadow:"0 20px 40px rgba(0,0,0,0.5)",border:"1px solid var(--border)",overflow:"hidden" }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                            <h3 style={{ margin:0,fontSize:16,fontWeight:800 }}>🔽 Filtri SAP</h3>
                            <button onClick={() => setShowFilterPanel(false)} style={{ background:"rgba(255,255,255,0.05)",border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",color:"var(--text-muted)",fontSize:16 }}>✕</button>
                        </div>
                        <div style={{ padding:20,display:"flex",flexDirection:"column",gap:16 }}>
                            <label style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:14 }}>
                                <input type="checkbox" checked={filterExcludeSto} onChange={e => {
                                    setFilterExcludeSto(e.target.checked);
                                    localStorage.setItem("lab_filter_exclude_sto", JSON.stringify(e.target.checked));
                                }} style={{ width:16,height:16,cursor:"pointer" }} />
                                <span>Escludi storni <span style={{ color:"#f59e0b",fontWeight:700 }}>(sto = "X")</span></span>
                            </label>
                            <div>
                                <div style={{ fontSize:12,fontWeight:700,color:"var(--text-secondary)",marginBottom:6 }}>Escludi operatori (uno per riga):</div>
                                <textarea
                                    value={filterExcludeOperators.join("\n")}
                                    onChange={e => {
                                        const ops = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
                                        setFilterExcludeOperators(ops);
                                        localStorage.setItem("lab_filter_exclude_operators", JSON.stringify(ops));
                                    }}
                                    placeholder="es: ROSSI&#10;BIANCHI"
                                    style={{ width:"100%",height:80,padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg-secondary)",color:"var(--text-primary)",fontSize:13,resize:"vertical",boxSizing:"border-box" }}
                                />
                            </div>
                            {(filterExcludeSto || filterExcludeOperators.length > 0) && (
                                <button onClick={() => {
                                    setFilterExcludeSto(false);
                                    setFilterExcludeOperators([]);
                                    localStorage.setItem("lab_filter_exclude_sto", JSON.stringify(false));
                                    localStorage.setItem("lab_filter_exclude_operators", JSON.stringify([]));
                                }} className="btn btn-secondary" style={{ fontSize:13 }}>
                                    ✕ Resetta filtri
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Operator Report Modal */}
            {showOperatorReport && (() => {
                // Aggrega operatori dai record raw (non filtrati)
                const opStats = {};
                for (const finos of Object.values(rawMatrixData)) {
                    for (const cell of Object.values(finos)) {
                        for (const r of (cell.records || [])) {
                            const op = r.acq_da;
                            if (!op) continue;
                            if (!opStats[op]) opStats[op] = { celle: 0, pezzi: 0 };
                            opStats[op].celle++;
                            opStats[op].pezzi += (r.qta_ottenuta || 0);
                        }
                    }
                }
                const operators = Object.entries(opStats).sort((a, b) => b[1].pezzi - a[1].pezzi);
                return (
                    <div style={{ position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}
                        onClick={() => setShowOperatorReport(false)}>
                        <div style={{ background:"var(--bg-card)",borderRadius:16,width:"90%",maxWidth:480,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 40px rgba(0,0,0,0.5)",border:"1px solid var(--border)",overflow:"hidden" }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ padding:"16px 20px",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
                                <h3 style={{ margin:0,fontSize:16,fontWeight:800 }}>📊 Operatori SAP</h3>
                                <button onClick={() => setShowOperatorReport(false)} style={{ background:"rgba(255,255,255,0.05)",border:"none",width:32,height:32,borderRadius:"50%",cursor:"pointer",color:"var(--text-muted)",fontSize:16 }}>✕</button>
                            </div>
                            <div style={{ overflowY:"auto",flex:1 }}>
                                {operators.length === 0 ? (
                                    <div style={{ padding:24,textAlign:"center",color:"var(--text-muted)",fontSize:14 }}>Nessun operatore trovato nei dati SAP</div>
                                ) : operators.map(([op, stats]) => {
                                    const isExcluded = filterExcludeOperators.includes(op);
                                    const isHighlighted = highlightOperator === op;
                                    return (
                                        <div key={op} style={{ padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,
                                            background: isExcluded ? "rgba(239,68,68,0.06)" : isHighlighted ? "rgba(59,130,246,0.06)" : "transparent",
                                            border: isExcluded ? "1px solid #ef444422" : isHighlighted ? "1px solid #3b82f622" : "transparent" }}>
                                            <div style={{ flex:1,minWidth:0 }}>
                                                <div style={{ fontSize:13,fontWeight:700,color:"var(--text-primary)",truncate:true }}>{op}</div>
                                                <div style={{ fontSize:11,color:"var(--text-muted)" }}>{stats.celle} record · {stats.pezzi} pz</div>
                                            </div>
                                            <button
                                                onClick={() => setHighlightOperator(isHighlighted ? null : op)}
                                                style={{ padding:"4px 10px",fontSize:11,borderRadius:6,border:"1px solid var(--border)",cursor:"pointer",
                                                    background: isHighlighted ? "#3b82f6" : "var(--bg-tertiary)",
                                                    color: isHighlighted ? "white" : "var(--text-secondary)" }}>
                                                {isHighlighted ? "✓ Evidenziato" : "Evidenzia"}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newOps = isExcluded
                                                        ? filterExcludeOperators.filter(o => o !== op)
                                                        : [...filterExcludeOperators, op];
                                                    setFilterExcludeOperators(newOps);
                                                    localStorage.setItem("lab_filter_exclude_operators", JSON.stringify(newOps));
                                                }}
                                                style={{ padding:"4px 10px",fontSize:11,borderRadius:6,border: isExcluded ? "1px solid #ef4444" : "1px solid var(--border)",cursor:"pointer",
                                                    background: isExcluded ? "rgba(239,68,68,0.1)" : "var(--bg-tertiary)",
                                                    color: isExcluded ? "#ef4444" : "var(--text-secondary)" }}>
                                                {isExcluded ? "✓ Escluso" : "Escludi"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ padding:"12px 16px",borderTop:"1px solid var(--border)",fontSize:11,color:"var(--text-muted)",flexShrink:0 }}>
                                💡 <strong>Evidenzia:</strong> Bordo rosso sulle celle · <strong>Escludi:</strong> Rimuove dal calcolo SAP
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Reset Confirmation Modal */}
            {resetConfirmModal && (
                <div style={{
                    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)"
                }} onClick={() => setResetConfirmModal(false)}>
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16,
                        width: "90%", maxWidth: 420,
                        display: "flex", flexDirection: "column",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "1px solid var(--border)",
                        overflow: "hidden"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "rgba(239, 68, 68, 0.08)"
                        }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#ef4444" }}>🔄 Reset Inventario</h3>
                            <button onClick={() => setResetConfirmModal(false)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "none", width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>
                        </div>
                        <div style={{ padding: 20 }}>
                            <p style={{ fontSize: 14, color: "var(--text-primary)", margin: "0 0 16px 0" }}>
                                Seleziona data e ora inizio inventario fisico. I dati precedenti rimangono salvati nel database.
                            </p>

                            {/* Data input */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                                    Data inizio
                                </label>
                                <input
                                    type="date"
                                    value={resetDate}
                                    onChange={(e) => setResetDate(e.target.value)}
                                    style={{
                                        width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                                        background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            {/* Time input */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                                    Ora inizio
                                </label>
                                <input
                                    type="time"
                                    value={resetTime}
                                    onChange={(e) => setResetTime(e.target.value)}
                                    style={{
                                        width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                                        background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
                                        boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            <div style={{
                                background: "rgba(96, 165, 250, 0.08)", padding: 12, borderRadius: 10, marginBottom: 16,
                                border: "1px solid rgba(96, 165, 250, 0.2)"
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>
                                    ✓ {new Date(resetDate).toLocaleDateString("it-IT")} ore {resetTime}
                                </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                                ℹ️ L'inventario precedente rimane nel database. I dati SAP ripartiranno da questa data/ora.
                            </p>
                        </div>
                        <div style={{
                            display: "flex", gap: 10, padding: 16, borderTop: "1px solid var(--border)",
                            background: "var(--bg-tertiary)", justifyContent: "flex-end"
                        }}>
                            <button
                                onClick={() => setResetConfirmModal(false)}
                                className="btn btn-secondary"
                                disabled={isResetting}
                            >
                                Annulla
                            </button>
                            <button
                                onClick={resetInventarioPeriod}
                                className="btn"
                                style={{
                                    background: "#ef4444", color: "white", border: "none"
                                }}
                                disabled={isResetting}
                            >
                                {isResetting ? "Resetting..." : "Confirma Reset"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- QUICK CONFIG MODAL ---
const QuickConfigModal = ({ data, onClose, onSave, showToast }) => {
    const [form, setForm] = useState({
        fino: "",
        componente: (data.comp || "").toUpperCase().replace(/ ECO$/, "").trim(),
        codice: "",
        codice2: ""
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExisting = async () => {
            try {
                // DB stores components WITHOUT " ECO" suffix (e.g. "SG4" not "SG4 ECO")
                const dbComp = data.comp.toUpperCase().replace(/ ECO$/, "").trim();

                const { data: existing } = await supabase
                    .from("material_fino_overrides")
                    .select("*")
                    .eq("fase", data.phase)
                    .eq("componente", dbComp)
                    .eq("progetto", data.project);

                if (existing && existing.length > 0) {
                    const fino = existing[0].fino ?? null;
                    setForm({
                        fino: fino !== null ? String(fino) : "",
                        componente: existing[0].componente || dbComp || "",
                        codice: existing[0]?.materiale || "",
                        codice2: existing[1]?.materiale || ""
                    });
                } else {
                    // Use DB-format component name for new records too
                    setForm(prev => ({ ...prev, componente: dbComp }));
                }
            } catch (err) {
                console.error("QuickConfigModal fetch error:", err);
            }
            finally { setIsLoading(false); }
        };
        fetchExisting();
    }, []);

    const handleSave = async () => {
        if (!form.codice.trim()) {
            showToast?.("Inserisci almeno un codice materiale", "error");
            return;
        }
        setIsSaving(true);
        try {
            const rows = [
                {
                    materiale: form.codice.toUpperCase().trim(),
                    fino: form.fino ? String(form.fino).padStart(4, "0") : null,
                    fase: data.phase,
                    componente: form.componente.toUpperCase().trim(),
                    progetto: data.project
                }
            ];
            if (form.codice2.trim()) {
                rows.push({
                    materiale: form.codice2.toUpperCase().trim(),
                    fino: form.fino ? String(form.fino).padStart(4, "0") : null,
                    fase: data.phase,
                    componente: form.componente.toUpperCase().trim(),
                    progetto: data.project
                });
            }
            for (const row of rows) {
                const { data: existing } = await supabase.from("material_fino_overrides")
                    .select("id")
                    .eq("materiale", row.materiale)
                    .eq("fase", row.fase)
                    .eq("componente", row.componente)
                    .eq("progetto", row.progetto)
                    .maybeSingle();
                if (existing) {
                    const { error } = await supabase.from("material_fino_overrides").update(row).eq("id", existing.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from("material_fino_overrides").insert(row);
                    if (error) throw error;
                }
            }
            showToast?.("Configurazione salvata!", "success");
            onSave();
        } catch (err) {
            console.error(err);
            showToast?.("Errore salvataggio configurazione", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return null;

    return (
        <Modal
            title={`⚙️ Configura fase: ${PHASE_LABEL[data.phase] || data.phase}`}
            subtitle={`${data.comp} — ${data.project}`}
            onClose={onClose}
            width={420}
            zIndex={3000}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                    { key: "fino", label: "Fino (Operazione SAP)", placeholder: "es. 0100" },
                    { key: "codice", label: "Codice Materiale 1", placeholder: "es. M0162644" },
                    { key: "codice2", label: "Codice Materiale 2 (opzionale)", placeholder: "es. M0162644/S" },
                    { key: "componente", label: "Componente", placeholder: "es. SG4 ECO" },
                ].map(field => (
                    <div key={field.key} className="form-group">
                        <label className="form-label">{field.label}</label>
                        <input
                            type="text"
                            value={form[field.key]}
                            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="input"
                        />
                    </div>
                ))}
            </div>
            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Salvataggio..." : "Salva"}
                </button>
            </div>
        </Modal>
    );
};
