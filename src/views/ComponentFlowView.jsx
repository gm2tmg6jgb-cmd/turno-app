import { useState, useEffect, useMemo } from "react";
import { supabase, fetchAllRows } from "../lib/supabase";
import { getCurrentWeekRange } from "../lib/dateUtils";
import { TURNI, PROCESS_STEPS, PROJECTS, PROJECT_COMPONENTS, EXCLUDED_PHASES, THROUGHPUT_CONFIG, NO_FERMO_PHASES, FASE_TECNOLOGIA_MAP } from "../data/constants";
import { getSlotForGroup } from "../lib/shiftRotation";
import Modal from "../components/Modal";
import { computeThroughput, loadThroughputConfig } from "../utils/throughput";
import { loadComponentPhases } from "../utils/componentiPhases";

// Parsing 100% manuale: solo material_fino_overrides (configurazione utente su Supabase)

const PHASE_CODE = Object.fromEntries(PROCESS_STEPS.map(step => [step.id, step.code]));

// Daily targets (standard)
const PROJECT_TARGETS = {
    "DCT300": 450,
    "8Fe": 800,
    "DCT ECO": 600,
    "RG + DH": 200
};

const COMPONENT_EXCLUSIONS = {
    "SG1": ["start_soft", "ut", "shaping", "grinding_cone", "laser_welding_2", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "DG-REV": [
        "start_hard", "dmc", "laser_welding", "laser_welding_2", "ut", "shaping",
        "milling", "broaching", "deburring", "grinding_cone", "teeth_grinding",
        "washing", "ht", "assembly", "welding", "quality", "shot_peening", "laser_welding_soft_2"
    ],
    "DG": ["shaping", "laser_welding_2", "ut", "start_hard", "deburring", "laser_welding_soft_2", "milling", "broaching", "shot_peening"],
    "SG3": ["shaping", "laser_welding_2", "ut", "milling", "broaching", "shot_peening"],
    "SG4": ["laser_welding", "laser_welding_2", "ut", "deburring", "laser_welding_soft_2", "broaching", "shot_peening"],
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




export default function ComponentFlowView({ showToast, globalDate, turnoCorrente }) {
    const [viewMode, setViewMode] = useState("daily"); // "weekly" | "daily"
    const [targetOverrides, setTargetOverrides] = useState(() => {
        const saved = localStorage.getItem("bap_target_overrides");
        return saved ? JSON.parse(saved) : PROJECT_TARGETS;
    });
    const [targetModal, setTargetModal] = useState(null); // { project: string, value: number }
    const [expandedProject, setExpandedProject] = useState(null); // string | null (project name)

    const [wWeek, setWWeek] = useState(() => {
        const range = getCurrentWeekRange();
        return range.monday;
    });
    const [wDate, setWDate] = useState(() => new Date().toISOString().split("T")[0]);
    const activeProject = "DCT300";
    const [localTurno, setLocalTurno] = useState(turnoCorrente || "ALL");
    const [loading, setLoading] = useState(false);
    const [matrixData, setMatrixData] = useState({});
    const [componentsByProject, setComponentsByProject] = useState({});
    const [, setCompMappings] = useState({});
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [detailTab, setDetailTab] = useState("records");
    const [showThroughput, setShowThroughput] = useState(false);
    const [isConfigMode, setIsConfigMode] = useState(false);
    const [quickConfigModal, setQuickConfigModal] = useState(null); // { project, comp, phase }
    const [dynamicOverrides] = useState([]);
    const [configuredCells, setConfiguredCells] = useState(new Set());
    const refreshTick = 0;
    const [cellExclusions, setCellExclusions] = useState({});
    const [cellInclusions, setCellInclusions] = useState({});
    const [ultimoImportato, setUltimoImportato] = useState(null);

    const throughputCfg = useMemo(() => loadThroughputConfig(), [showThroughput, selectedDetail]);

    // Fasi del componente selezionato, caricate da Supabase
    const [detailPhases, setDetailPhases] = useState([]);
    useEffect(() => {
        if (!selectedDetail?.proj || !selectedDetail?.comp) {
            setDetailPhases([]);
            return;
        }
        loadComponentPhases(selectedDetail.proj, selectedDetail.comp).then(setDetailPhases);
    }, [selectedDetail?.proj, selectedDetail?.comp]);

    const detailCompKey = selectedDetail ? `${selectedDetail.proj}::${selectedDetail.comp}` : null;
    const detailCompBase = detailCompKey ? (throughputCfg.components?.[detailCompKey] ?? {}) : {};
    const throughputPhases = useMemo(() => {
        if (!detailCompKey || detailPhases.length === 0) return [];
        return computeThroughput(detailCompKey, {
            components: { [detailCompKey]: { ...detailCompBase, phases: detailPhases } }
        });
    }, [detailPhases, detailCompKey]);
    const throughputTotalH = throughputPhases.at(-1)?.cumH || 0;

    const handlePrint = () => {
        // Mark for printing and trigger print dialog
        const printArea = document.querySelector('[data-print-area="boxes"]');
        if (!printArea) {
            alert('Elemento di stampa non trovato');
            return;
        }
        window.print();
    };

    useEffect(() => {
        // Inject print styles
        const style = document.createElement('style');
        style.textContent = `
            @media print {
                /* Hide sidebar and everything else */
                body > * {
                    display: none !important;
                }

                /* Show only the app content */
                #root, main, [role="main"] {
                    display: block !important;
                    width: 100% !important;
                }

                /* Reset and hide everything */
                * {
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                }

                html, body {
                    background: white !important;
                    color: #000 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    margin: 0 !important;
                    padding: 10px !important;
                }

                /* Hide sidebar navigation */
                nav, aside, [class*="sidebar"], [class*="menu"] {
                    display: none !important;
                }

                /* Main content area */
                .fade-in {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    width: 100% !important;
                    height: auto !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    margin: 0 !important;
                }

                /* Hide header/controls */
                .fade-in > div:first-of-type {
                    display: none !important;
                }

                /* Print area - show only this */
                [data-print-area="boxes"] {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                    grid-template-rows: 1fr 1fr !important;
                    gap: 15px !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: auto !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    page-break-inside: avoid !important;
                }

                /* Individual project boxes */
                [data-print-area="boxes"] > * {
                    display: block !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    overflow: visible !important;
                    height: auto !important;
                }

                /* Hide everything except print area */
                .fade-in > *:not([data-print-area="boxes"]) {
                    display: none !important;
                }

                /* Hide all modals, overlays, fixed elements */
                [style*="position: fixed"],
                [style*="position:fixed"],
                [role="dialog"],
                [class*="modal"] {
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(style);
        return () => {
            try {
                document.head.removeChild(style);
            } catch (e) {
                // Style might already be removed
            }
        };
    }, []);

    // Mostra alert con turni contati quando espandi un progetto
    useEffect(() => {
        if (expandedProject && viewMode === "weekly") {
            const recordsUpToday = Object.values(matrixData[expandedProject] || {})
                .flatMap(comp => Object.values(comp))
                .filter(cell => cell?.records?.length > 0)
                .reduce((acc, cell) => [...acc, ...cell.records], [])
                .filter(r => r.data <= wDate);

            const turniLavorati = new Set(recordsUpToday.map(r => r.turno_id).filter(Boolean));
            let numTurni = turniLavorati.size || 0;

            // Aggiungi turni completati oggi
            const today = new Date().toISOString().split("T")[0];
            if (wDate === today) {
                const now = new Date();
                const currentHour = now.getHours();
                const turniCompletatiOggi = Math.floor(currentHour / 6);
                const turniGiaConosciuti = recordsUpToday.filter(r => r.data === today).map(r => r.turno_id).filter(Boolean).length;
                const turniDaAggiungereDaOggi = Math.max(0, turniCompletatiOggi - turniGiaConosciuti);
                numTurni += turniDaAggiungereDaOggi;
            }

            alert(`${expandedProject}\n\nTurni contati: ${numTurni}\nTarget per turno: ${targetOverrides[expandedProject] || 0}\nTarget cumulativo: ${(targetOverrides[expandedProject] || 0) * numTurni}`);
        }
    }, [expandedProject, viewMode, matrixData, wDate, targetOverrides]);

    const [fermiByProject, setFermiByProject] = useState({});
    const [motiviFermoList, setMotiviFermoList] = useState([]);
    const [fermoModal, setFermoModal] = useState(null); // { project }
    const [fermoForm, setFermoForm] = useState({ macchinaId: "", motivo: "", durata: "", note: "" });
    const [savingFermo, setSavingFermo] = useState(false);

    const toggleCellExclusion = async (proj, comp, phase) => {
        const key = `${proj}:${comp}:${phase}`;
        const isCurrentlyExcluded = !!cellExclusions[key];
        if (isCurrentlyExcluded) {
            await supabase.from("cell_visibility_overrides")
                .delete()
                .eq("view", "flow").eq("tipo", "exclude")
                .eq("progetto", proj).eq("componente", comp).eq("fase", phase);
            setCellExclusions(prev => { const u = { ...prev }; delete u[key]; return u; });
        } else {
            await supabase.from("cell_visibility_overrides")
                .upsert({ view: "flow", tipo: "exclude", progetto: proj, componente: comp, fase: phase },
                    { onConflict: "view,tipo,progetto,componente,fase" });
            setCellExclusions(prev => ({ ...prev, [key]: true }));
        }
    };

    const toggleCellInclusion = async (proj, comp, phase) => {
        const key = `${proj}:${comp}:${phase}`;
        const isCurrentlyIncluded = !!cellInclusions[key];
        if (isCurrentlyIncluded) {
            await supabase.from("cell_visibility_overrides")
                .delete()
                .eq("view", "flow").eq("tipo", "include")
                .eq("progetto", proj).eq("componente", comp).eq("fase", phase);
            setCellInclusions(prev => { const u = { ...prev }; delete u[key]; return u; });
        } else {
            await supabase.from("cell_visibility_overrides")
                .upsert({ view: "flow", tipo: "include", progetto: proj, componente: comp, fase: phase },
                    { onConflict: "view,tipo,progetto,componente,fase" });
            setCellInclusions(prev => ({ ...prev, [key]: true }));
        }
    };

    const toLocalDateStr = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 0. Carica visibilità celle da DB
            const { data: visRes } = await supabase.from("cell_visibility_overrides").select("*").eq("view", "flow");
            if (visRes) {
                const excl = {}, incl = {};
                visRes.forEach(r => {
                    const key = `${r.progetto}:${r.componente}:${r.fase}`;
                    if (r.tipo === "exclude") excl[key] = true;
                    else if (r.tipo === "include") incl[key] = true;
                });
                setCellExclusions(excl);
                setCellInclusions(incl);
            }

            // === SISTEMA MANUALE: solo material_fino_overrides ===
            const { data: matOverridesRes, error: matOverridesErr } = await fetchAllRows(() => supabase.from("material_fino_overrides").select("*"));
            // Normalizza nomi varianti Lab (es. "DG - 1A" → "DG") per non duplicare righe in flow view
            const normalizeFlowComp = (comp) => comp.replace(/\s*-\s*(1A|21A)$/i, "").trim();

            const dbMaterialOverrides = matOverridesErr ? [] : (matOverridesRes || []).map(r => ({
                mat: (r.materiale || "").toUpperCase(),
                fino: r.fino ? String(r.fino).padStart(4, "0") : null,
                phase: r.fase,
                comp: normalizeFlowComp((r.componente || "").toUpperCase()),
                proj: (r.progetto || "").trim(),
                macchina_id: (r.macchina_id || "").toUpperCase()
            }));

            const cfgSet = new Set();
            (matOverridesErr ? [] : (matOverridesRes || [])).forEach(r => {
                if (r.progetto && r.componente && r.fase) {
                    cfgSet.add(`${r.progetto.trim()}::${normalizeFlowComp(r.componente.toUpperCase())}::${r.fase}`);
                }
            });
            setConfiguredCells(cfgSet);

            const compToMats = {};
            dbMaterialOverrides.forEach(o => {
                if (o.comp) {
                    if (!compToMats[o.comp]) compToMats[o.comp] = [];
                    if (!compToMats[o.comp].includes(o.mat)) compToMats[o.comp].push(o.mat);
                }
            });
            setCompMappings(compToMats);

            // Fetch dati produzione
            const selectFields = "data, materiale, work_center_sap, macchina_id, qta_ottenuta, turno_id, fino, importato_il";
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
                if (localTurno && localTurno !== "ALL") q = q.eq("turno_id", localTurno);
                return q;
            };

            const { data: prodRes, error: prodErr } = await fetchAllRows(queryFactory);
            if (prodErr) {
                console.error("Errore fetch conferme_sap:", prodErr);
                if (showToast) showToast(`Errore lettura dati produzione: ${prodErr.message}`, "error");
                return;
            }

            // Estrai il timestamp più recente dai dati scaricati
            if (prodRes && prodRes.length > 0) {
                const recordsConImportato = prodRes.filter(r => r.importato_il);
                if (recordsConImportato.length > 0) {
                    const ultimoRecord = recordsConImportato.sort((a, b) =>
                        new Date(b.importato_il) - new Date(a.importato_il)
                    )[0];
                    setUltimoImportato(ultimoRecord.importato_il);
                } else {
                    setUltimoImportato(null);
                }
            } else {
                setUltimoImportato(null);
            }

            const newMatrix = {};
            const projComponentSets = {};
            PROJECTS.forEach(p => { newMatrix[p] = {}; projComponentSets[p] = new Set(); });

            if (prodRes) {
                prodRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase();
                    const fino = String(r.fino || "").padStart(4, "0");

                    // SOLO configurazione manuale — match specifico (fino esatto) ha priorità su match generico (fino null)
                    const override = dbMaterialOverrides.find(o => o.mat === matCode && o.fino === fino)
                        || dbMaterialOverrides.find(o => o.mat === matCode && !o.fino);
                    if (!override) return;

                    const phase = override.phase;
                    if (!phase || phase === "baa") return;

                    let proj = override.proj;
                    if (proj === "DCT 300") proj = "DCT300";
                    if (proj === "8 FE" || proj === "8Fedct") proj = "8Fe";
                    if (proj === "DCT Eco" || proj === "DCTeco") proj = "DCT ECO";
                    if (!PROJECTS.includes(proj)) return;

                    let comp = override.comp;
                    if (!comp) return;
                    if (comp === "SG2-REV") comp = "DG-REV";

                    const wc = (r.macchina_id || r.work_center_sap || override.macchina_id || "").toUpperCase();
                    projComponentSets[proj].add(comp);
                    if (!newMatrix[proj][comp]) newMatrix[proj][comp] = {};
                    if (!newMatrix[proj][comp][phase]) newMatrix[proj][comp][phase] = { value: 0, records: [] };
                    newMatrix[proj][comp][phase].value += (r.qta_ottenuta || 0);
                    newMatrix[proj][comp][phase].records.push({ ...r, matCode, macchina: wc });
                });
            }

            // --- Fetch BAA da prelievi_baa (MB51) ---
            const baaQueryFactory = () => {
                let q = supabase.from("prelievi_baa").select("data, orario, materiale, quantita");
                if (viewMode === "weekly") {
                    const [y, mo, d] = wWeek.split("-").map(Number);
                    const mon = new Date(y, mo - 1, d);
                    const sun = new Date(y, mo - 1, d + 6);
                    q = q.gte("data", toLocalDateStr(mon)).lte("data", toLocalDateStr(sun));
                } else {
                    q = q.eq("data", wDate);
                }
                if (localTurno && localTurno !== "ALL") {
                    const refDate = viewMode === "weekly" ? new Date(wWeek) : new Date(wDate + "T12:00:00");
                    const slot = getSlotForGroup(localTurno, refDate);
                    if (slot) {
                        const [startH, endH] = slot.orario.split("–").map(s => s.trim().replace(":", ":"));
                        const start = startH.length === 5 ? startH + ":00" : startH;
                        const end = endH === "24:00" ? "23:59:59" : (endH.length === 5 ? endH + ":00" : endH);
                        if (slot.id === "N") {
                            // Notte: 00:00 – 06:00
                            q = q.gte("orario", "00:00:00").lt("orario", end);
                        } else {
                            q = q.gte("orario", start).lt("orario", end === "23:59:59" ? "24:00:00" : end);
                        }
                    }
                }
                return q;
            };
            // Mappa comp+proj → set di materiali esplicitamente assegnati a BAA
            const baaOverrideMatsByCell = {};
            dbMaterialOverrides.filter(o => o.phase === "baa").forEach(o => {
                const key = `${o.proj}::${o.comp}`;
                if (!baaOverrideMatsByCell[key]) baaOverrideMatsByCell[key] = new Set();
                baaOverrideMatsByCell[key].add(o.mat);
            });

            const { data: baaRes } = await fetchAllRows(baaQueryFactory);
            if (baaRes) {
                baaRes.forEach(r => {
                    const matCode = (r.materiale || "").toUpperCase();
                    // Usa material_fino_overrides per risolvere comp/proj del materiale BAA
                    const override = dbMaterialOverrides.find(o => o.mat === matCode);
                    if (!override) return;
                    let proj = override.proj;
                    if (proj === "DCT 300") proj = "DCT300";
                    if (proj === "8 FE" || proj === "8Fedct") proj = "8Fe";
                    if (proj === "DCT Eco" || proj === "DCTeco") proj = "DCT ECO";
                    if (!PROJECTS.includes(proj)) return;
                    let comp = override.comp;
                    if (!comp) return;
                    if (comp === "SG2-REV") comp = "DG-REV";
                    // Se per questa cella (proj+comp) ci sono materiali BAA esplicitamente assegnati,
                    // includi solo quelli; altrimenti includi tutti
                    const cellKey = `${proj}::${comp}`;
                    const allowedMats = baaOverrideMatsByCell[cellKey];
                    if (allowedMats && !allowedMats.has(matCode)) return;
                    projComponentSets[proj].add(comp);
                    if (!newMatrix[proj][comp]) newMatrix[proj][comp] = {};
                    if (!newMatrix[proj][comp]["baa"]) newMatrix[proj][comp]["baa"] = { value: 0, records: [] };
                    newMatrix[proj][comp]["baa"].value += Math.abs(r.quantita || 0);
                    newMatrix[proj][comp]["baa"].records.push({ ...r, matCode });
                });
            }


            setMatrixData(newMatrix);

            // Fetch motivi fermo e fermi del giorno
            const [{ data: motiviRes }, { data: fermiRes }] = await Promise.all([
                supabase.from("motivi_fermo").select("*").order("label"),
                supabase.from("fermi_flusso").select("*").eq("data", wDate)
            ]);
            setMotiviFermoList(motiviRes || []);
            // Raggruppa fermi per "proj:comp:fase"
            const fermiGrouped = {};
            (fermiRes || []).forEach(f => {
                const key = `${f.progetto}:${f.componente}:${f.fase}`;
                if (!fermiGrouped[key]) fermiGrouped[key] = [];
                fermiGrouped[key].push(f);
            });
            setFermiByProject(fermiGrouped);

            const newCompsByProject = {};
            PROJECTS.forEach(p => {
                const fixed = PROJECT_COMPONENTS[p] || [];
                // Se è DCT300, escludiamo SG2 dagli extra per evitare dati sporchi in quella vista
                const extra = Array.from(projComponentSets[p])
                    .filter(c => !fixed.includes(c))
                    .filter(c => !(p === "DCT300" && c === "SG2"))
                    .filter(c => !(p === "8Fe" && c === "RG"))
                    .filter(c => !(p === "DCT ECO" && c === "SG4 ECO"))
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

    const saveFermo = async () => {
        if (!fermoForm.motivo) { showToast?.("Seleziona un motivo", "error"); return; }
        if (!fermoForm.durata) { showToast?.("Inserisci la durata in minuti", "error"); return; }
        setSavingFermo(true);
        try {
            const { error } = await supabase.from("fermi_flusso").insert({
                progetto: fermoModal.project,
                componente: fermoModal.comp || null,
                fase: fermoModal.fase || null,
                data: wDate,
                turno_id: localTurno !== "ALL" ? localTurno : null,
                macchina_id: fermoForm.macchinaId.trim() || null,
                motivo: fermoForm.motivo,
                durata_minuti: parseInt(fermoForm.durata) || 0,
                note: fermoForm.note || null
            });
            if (error) throw error;
            showToast?.("Fermo registrato", "success");
            setFermoModal(null);
            setFermoForm({ macchinaId: "", motivo: "", durata: "", note: "" });
            fetchData();
        } catch (err) {
            console.error(err);
            showToast?.("Errore salvataggio fermo: " + err.message, "error");
        } finally {
            setSavingFermo(false);
        }
    };

    useEffect(() => {
        if (turnoCorrente) setLocalTurno(turnoCorrente);
    }, [turnoCorrente]);

    useEffect(() => {
        if (globalDate) setWDate(globalDate);
    }, [globalDate]);

    const renderProjectBox = (proj, isExpanded = false) => {
        const projectComps = componentsByProject[proj] || [];
        const projectExclusions = EXCLUDED_PHASES[proj] || [];
        let projectVisibleSteps = PROCESS_STEPS.filter(s => !projectExclusions.includes(s.id));
        if (proj === "DCT ECO") {
            // Move MZA (ut) before SLA (grinding_cone)
            const utStep = projectVisibleSteps.find(s => s.id === "ut");
            if (utStep) {
                projectVisibleSteps = projectVisibleSteps.filter(s => s.id !== "ut");
                const slaIdx = projectVisibleSteps.findIndex(s => s.id === "grinding_cone");
                projectVisibleSteps.splice(slaIdx !== -1 ? slaIdx : projectVisibleSteps.length, 0, utStep);
            }
            // Inserisci colonna MZA Soft prima di STW (shaping)
            const utSoftStep = projectVisibleSteps.find(s => s.id === "ut_soft");
            if (utSoftStep) {
                projectVisibleSteps = projectVisibleSteps.filter(s => s.id !== "ut_soft");
                const stwIdx = projectVisibleSteps.findIndex(s => s.id === "shaping");
                projectVisibleSteps.splice(stwIdx !== -1 ? stwIdx : 0, 0, utSoftStep);
            }
        }
        if (proj === "8Fe") {
            const utStep = projectVisibleSteps.find(s => s.id === "ut");
            if (utStep) {
                projectVisibleSteps = projectVisibleSteps.filter(s => s.id !== "ut");
                const sca2Idx = projectVisibleSteps.findIndex(s => s.id === "laser_welding_soft_2");
                projectVisibleSteps.splice(sca2Idx !== -1 ? sca2Idx + 1 : projectVisibleSteps.length, 0, utStep);
            }
        }

        // Separatore visivo universale tra WSH e BAA
        const baaIdx = projectVisibleSteps.findIndex(s => s.id === "baa");
        if (baaIdx !== -1) {
            projectVisibleSteps.splice(baaIdx, 0, { id: "__sep__", label: "", code: "", separator: true });
        }
        if (proj === "RG + DH") {
            // DRA Soft (start_soft) prima di ZSA (dmc)
            const draSoftStep = projectVisibleSteps.find(s => s.id === "start_soft");
            if (draSoftStep) {
                projectVisibleSteps = projectVisibleSteps.filter(s => s.id !== "start_soft");
                const zsaIdx = projectVisibleSteps.findIndex(s => s.id === "dmc");
                projectVisibleSteps.splice(zsaIdx !== -1 ? zsaIdx : 0, 0, draSoftStep);
            }
            // DRA Hard (start_hard) dopo OKU (shot_peening)
            const draHardStep = projectVisibleSteps.find(s => s.id === "start_hard");
            if (draHardStep) {
                projectVisibleSteps = projectVisibleSteps.filter(s => s.id !== "start_hard");
                const okuIdx = projectVisibleSteps.findIndex(s => s.id === "shot_peening");
                projectVisibleSteps.splice(okuIdx !== -1 ? okuIdx + 1 : projectVisibleSteps.length, 0, draHardStep);
            }
        }

        if (projectComps.length === 0) return null;

        // Color Palette per Progetto
        const colors = {
            "DCT300": { main: "#3c6ef0", bg: "rgba(60, 110, 240, 0.05)" },
            "8Fe": { main: "#10b981", bg: "rgba(16, 185, 129, 0.05)" },
            "DCT ECO": { main: "#f59e0b", bg: "rgba(245, 158, 11, 0.05)" },
            "RG + DH": { main: "#10b981", bg: "rgba(16, 185, 129, 0.05)" } // Stesso colore di 8Fe (stesso progetto)
        };
        const theme = colors[proj] || colors["DCT300"];

        return (
            <div key={proj} style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-card)",
                borderRadius: isExpanded ? "24px" : "16px",
                border: `1px solid ${theme.main}33`,
                boxShadow: isExpanded ? "0 20px 60px rgba(0,0,0,0.4)" : "0 10px 30px rgba(0,0,0,0.08)",
                overflow: "hidden",
                gridColumn: isExpanded ? "auto" : "span 1",
                height: isExpanded ? "100%" : "auto"
            }}>
                {/* Header con Gradiente Soft */}
                <div style={{
                    padding: isExpanded ? "20px 30px" : "10px 20px",
                    background: `linear-gradient(90deg, ${theme.bg}, transparent)`,
                    borderBottom: `1px solid ${theme.main}22`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            <div style={{ width: isExpanded ? "20px" : "15px", height: isExpanded ? "20px" : "15px", borderRadius: "50%", background: theme.main }} />
                            <h3 style={{ fontSize: isExpanded ? "42px" : "32px", fontWeight: "900", color: "var(--text-primary)", margin: 0 }}>
                                {proj === "RG + DH" ? "8Fe - RG + DH" : proj}
                            </h3>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {/* Expand Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpandedProject(isExpanded ? null : proj); }}
                            title={isExpanded ? "Chiudi" : "Espandi al centro"}
                            style={{
                                border: `1px solid ${theme.main}55`,
                                background: isExpanded ? theme.main : `${theme.main}18`,
                                borderRadius: "10px",
                                padding: isExpanded ? "8px 18px" : "6px 14px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: isExpanded ? "#fff" : theme.main,
                                fontSize: isExpanded ? "14px" : "13px",
                                fontWeight: "700",
                                transition: "all 0.15s",
                                whiteSpace: "nowrap"
                            }}
                        >
                            {isExpanded ? "✕ Chiudi" : "⤢ Espandi"}
                        </button>

                        {/* Target Indicator (Single Line Style) */}
                        <div style={{
                            background: "rgba(0,0,0,0.05)",
                            padding: isExpanded ? "12px 24px" : "8px 16px",
                            borderRadius: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            border: "1px solid var(--border-light)"
                        }}>
                            <div style={{
                                fontSize: isExpanded ? "20px" : "16px",
                                fontWeight: "900",
                                color: theme.main,
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}>
                                <span>Target {viewMode === "weekly" ? "Settimanale" : (localTurno !== "ALL" ? `Turno ${localTurno}` : "Giorno")}</span>
                                <span style={{ fontSize: isExpanded ? "32px" : "24px", color: "var(--text-primary)" }}>
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
                                style={{ border: "none", background: "none", cursor: "pointer", fontSize: isExpanded ? "24px" : "16px", padding: 0, opacity: 0.5 }}
                            >
                                ⚙️
                            </button>
                        </div>
                    </div>
                </div>
            </div>

                {/* Content con Scroll Interno */}
                <div style={{ flex: 1, overflow: "auto", padding: isExpanded ? "24px" : "12px" }}>
                    <div style={{ minWidth: "max-content" }}>
                        {/* Phases Row */}
                        <div style={{ display: "flex", marginBottom: "16px", paddingLeft: "110px" }}>
                            {projectVisibleSteps.map((s, sIdx) => {
                                if (s.separator) return <div key={sIdx} style={{ width: "40px", flexShrink: 0 }} />;
                                return (
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
                                );
                            })}
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
                                    width: "110px",
                                    flexShrink: 0,
                                    fontSize: isExpanded ? "22px" : "18px",
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
                                        if (step.separator) return (
                                            <div key={idx} style={{ 
                                                width: "40px", 
                                                flexShrink: 0, 
                                                display: "flex", 
                                                justifyContent: "center" 
                                            }}>
                                                <div style={{ height: "100%", borderLeft: "2px dashed var(--border-light)", opacity: 0.5 }} />
                                            </div>
                                        );
                                        const data = matrixData[proj]?.[comp]?.[step.id];
                                        let qty = data?.value || 0;
                                        let isHardExcluded = COMPONENT_EXCLUSIONS[comp]?.includes(step.id);

                                        if (proj === "DCT300" && ["SG7", "SGR", "RG"].includes(comp) && step.id === "grinding_cone") isHardExcluded = true;
                                        if (proj === "DCT300" && ["SG3", "SGR"].includes(comp) && step.id === "start_soft") isHardExcluded = true;
                                        if (proj === "8Fe" && comp !== "SG3" && step.id === "laser_welding_soft_2") isHardExcluded = true;
                                        if (["RG + DH", "8Fe", "DCT300"].includes(proj) && comp.startsWith("DH") && !["start_hard", "laser_welding_2"].includes(step.id)) isHardExcluded = true;
                                        if (proj === "DCT ECO" && comp.startsWith("RG") && step.id === "grinding_cone") isHardExcluded = true;

                                        // MZA Soft (ut_soft) e MZA Hard (ut): attivi per SG2, SG3, SGR in DCT ECO
                                        if (proj === "DCT ECO" && ["SG2", "SG3", "SGR"].includes(comp) && (step.id === "ut" || step.id === "ut_soft")) isHardExcluded = false;

                                        const isDynamicExcluded = !!cellExclusions[`${proj}:${comp}:${step.id}`];
                                        const isDynamicIncluded = !!cellInclusions[`${proj}:${comp}:${step.id}`];

                                        // Hard excluded and NOT manually added by user
                                        if (isHardExcluded && !isDynamicIncluded) {
                                            if (!isConfigMode) return <div key={idx} style={{ width: "85px", flexShrink: 0 }} />;
                                            // Config mode: show gray "+" to allow adding
                                            return (
                                                <div key={idx} style={{ width: "85px", flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
                                                    <div
                                                        onClick={() => toggleCellInclusion(proj, comp, step.id)}
                                                        title="Aggiungi cella"
                                                        style={{
                                                            width: "75px", height: "45px",
                                                            border: "2px dashed var(--border)",
                                                            borderRadius: "10px",
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            cursor: "pointer", color: "var(--text-muted)", fontSize: "20px",
                                                            opacity: 0.35, transition: "all 0.2s"
                                                        }}
                                                    >+</div>
                                                </div>
                                            );
                                        }

                                        // Dynamically excluded (user hid it)
                                        if (isDynamicExcluded && !isConfigMode) return <div key={idx} style={{ width: "85px", flexShrink: 0 }} />;

                                        if (isDynamicExcluded) return (
                                            <div key={idx} style={{ width: "85px", flexShrink: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
                                                <div
                                                    onClick={() => toggleCellExclusion(proj, comp, step.id)}
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

                                        // === CALCOLO TARGET E COLORE CUMULATIVO PER TURNI ===
                                        let currentTarget = 0;
                                        if (viewMode === "weekly") {
                                            // Calcola il cumulativo fino a wDate (oggi) e il target cumulativo atteso
                                            const base = targetOverrides[proj] || 0;

                                            // Cumulativo reale fino a wDate
                                            const recordsUpToday = (data?.records || []).filter(r => r.data <= wDate);
                                            qty = recordsUpToday.reduce((sum, r) => sum + (r.qta_ottenuta || 0), 0);

                                            // Conta turni unici (turno_id) nei record fino a oggi
                                            const turniLavorati = new Set(recordsUpToday.map(r => r.turno_id).filter(Boolean));
                                            let numTurni = turniLavorati.size || 0;

                                            // Se oggi (wDate) è il giorno corrente, aggiungi i turni completati oggi basato sull'ora
                                            const today = new Date().toISOString().split("T")[0];
                                            if (wDate === today) {
                                                const now = new Date();
                                                const currentHour = now.getHours();
                                                // Turni da 6 ore: 0-6, 6-12, 12-18, 18-24
                                                const turniCompletatiOggi = Math.floor(currentHour / 6);
                                                // Se currentHour === 23, sono nel turno 3 (18-24), quindi ho completato 3 turni (0, 1, 2)
                                                // Se currentHour === 12, sono nel turno 2 (12-18), quindi ho completato 2 turni (0, 1)
                                                const turniGiaConosciuti = recordsUpToday.filter(r => r.data === today).map(r => r.turno_id).filter(Boolean).length;
                                                const turniDaAggiungereDaOggi = Math.max(0, turniCompletatiOggi - turniGiaConosciuti);
                                                numTurni += turniDaAggiungereDaOggi;
                                            }

                                            // Target cumulativo: target per turno × numero di turni lavorati
                                            currentTarget = base * numTurni;
                                        } else {
                                            // Modalità giornaliera
                                            const base = targetOverrides[proj] || 0;
                                            if (localTurno !== "ALL") {
                                                currentTarget = Math.round(base / 3);
                                            } else {
                                                currentTarget = base;
                                            }
                                        }

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
                                                            // Normal mode: show SAP production details
                                                            const cellData = matrixData[proj]?.[comp]?.[step.id];
                                                            if (cellData?.records?.length > 0) {
                                                                setSelectedDetail({
                                                                    title: `${comp} · ${step.label}`,
                                                                    records: cellData.records,
                                                                    phaseId: step.id,
                                                                    proj,
                                                                    comp,
                                                                });
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: "75px",
                                                            height: "45px",
                                                            background: !hasProduction ? "var(--bg-tertiary)" : (isSuccess ? "#22c55e" : "#ef4444"),
                                                            borderRadius: "10px",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: hasProduction ? "white" : "var(--text-muted)",
                                                            fontSize: isExpanded ? "20px" : "16px",
                                                            fontWeight: "900",
                                                            boxShadow: hasProduction ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                                                            cursor: "pointer",
                                                            border: isConfigMode ? "2px dashed var(--accent)" : "1px solid rgba(255,255,255,0.1)",
                                                            transition: "all 0.2s",
                                                            position: "relative"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            const btn = e.currentTarget.querySelector('button[data-fermo-btn]');
                                                            if (btn) btn.style.opacity = "1";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            const btn = e.currentTarget.querySelector('button[data-fermo-btn]');
                                                            if (btn) btn.style.opacity = "0.3";
                                                        }}
                                                    >
                                                        {qty}

                                                        {step.id !== "baa" && !configuredCells.has(`${proj}::${comp}::${step.id}`) && (
                                                            <div style={{
                                                                position: "absolute", top: 2, right: 2,
                                                                fontSize: 10, lineHeight: 1,
                                                                color: "#F59E0B",
                                                                textShadow: "0 0 4px rgba(245,158,11,0.6)",
                                                                pointerEvents: "none"
                                                            }} title="Nessun codice materiale assegnato">⚠</div>
                                                        )}

                                                        {/* Badge fermo — pallino rosso se ci sono fermi per questa cella */}
                                                        {!isConfigMode && !NO_FERMO_PHASES.includes(step.id) && (() => {
                                                            const cellFermi = fermiByProject[`${proj}:${comp}:${step.id}`] || [];
                                                            if (cellFermi.length === 0) return null;
                                                            const totMin = cellFermi.reduce((s, f) => s + (f.durata_minuti || 0), 0);
                                                            return (
                                                                <div style={{
                                                                    position: "absolute", bottom: -5, left: -5,
                                                                    background: "#ef4444", borderRadius: "50%",
                                                                    width: 16, height: 16, display: "flex",
                                                                    alignItems: "center", justifyContent: "center",
                                                                    fontSize: 8, fontWeight: 900, color: "white",
                                                                    boxShadow: "0 2px 5px rgba(239,68,68,0.5)",
                                                                    pointerEvents: "none"
                                                                }} title={`${cellFermi.length} fermo/i · ${totMin}min`}>
                                                                    {cellFermi.length}
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Bottone aggiungi fermo — integrato dentro la cella */}
                                                        {!isConfigMode && !NO_FERMO_PHASES.includes(step.id) && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFermoModal({ project: proj, comp, fase: step.id, phaseLabel: step.label });
                                                                    setFermoForm({ macchinaId: "", motivo: "", durata: "", note: "" });
                                                                }}
                                                                data-fermo-btn
                                                                title="Aggiungi fermo"
                                                                style={{
                                                                    position: "absolute", bottom: 3, left: 3,
                                                                    background: "rgba(255, 255, 255, 0.3)", borderRadius: "50%",
                                                                    width: "18px", height: "18px",
                                                                    border: "none", display: "flex",
                                                                    alignItems: "center", justifyContent: "center",
                                                                    fontSize: "12px", fontWeight: "900",
                                                                    color: "white", cursor: "pointer", zIndex: 5,
                                                                    padding: 0,
                                                                    transition: "all 0.2s",
                                                                    lineHeight: "1",
                                                                    opacity: 0.3
                                                                }}
                                                            >+</button>
                                                        )}

                                                        {isConfigMode && (
                                                            <>
                                                                <div
                                                                    onClick={(e) => { e.stopPropagation(); isDynamicIncluded ? toggleCellInclusion(proj, comp, step.id) : toggleCellExclusion(proj, comp, step.id); }}
                                                                    title={isDynamicIncluded ? "Rimuovi cella aggiunta" : "Nascondi cella"}
                                                                    style={{
                                                                        position: "absolute", top: -6, left: -6,
                                                                        background: isDynamicIncluded ? "#f59e0b" : "#ef4444",
                                                                        borderRadius: "50%",
                                                                        width: "20px", height: "20px", display: "flex",
                                                                        alignItems: "center", justifyContent: "center",
                                                                        fontSize: "10px", fontWeight: "900",
                                                                        boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                                                                        color: "white", cursor: "pointer", zIndex: 10
                                                                    }}
                                                                >✕</div>
                                                            </>
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

                {/* Sezione fermi — solo in espanso */}
                {isExpanded && (() => {
                    const projFermi = Object.entries(fermiByProject)
                        .filter(([key]) => key.startsWith(proj + ":"))
                        .flatMap(([key, items]) => items.map(f => ({ ...f, _key: key })));
                    if (projFermi.length === 0) return null;
                    return (
                        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 24px", background: "rgba(239,68,68,0.04)" }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", marginBottom: 8 }}>
                                ⚡ Fermi — {new Date(wDate + "T12:00:00").toLocaleDateString("it-IT")} · {projFermi.reduce((s, f) => s + (f.durata_minuti || 0), 0)}min totali
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {projFermi.map((f, i) => (
                                    <div key={i} style={{
                                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                                        borderRadius: 8, padding: "6px 12px", fontSize: 12
                                    }}>
                                        <span style={{ fontWeight: 800, color: "var(--text-muted)", marginRight: 4 }}>{f.componente} · {PHASE_CODE[f.fase] || f.fase}</span>
                                        <span style={{ fontWeight: 800, color: "#ef4444" }}>{f.durata_minuti}min</span>
                                        <span style={{ color: "var(--text-primary)", marginLeft: 6 }}>{f.motivo}</span>
                                        {f.macchina_id && <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>· {f.macchina_id}</span>}
                                        {f.note && <span style={{ color: "var(--text-muted)", marginLeft: 6, fontStyle: "italic" }}>"{f.note}"</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>
        );
    };

    return (
        <div className="fade-in" style={{ padding: "10px 16px", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "10px" }}>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {/* Date Picker - Prima elemento */}
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

                    <button
                        onClick={handlePrint}
                        className="btn"
                        style={{
                            padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700",
                            background: "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)"
                        }}
                        title="Stampa le quattro box"
                    >
                        🖨 Stampa
                    </button>

                </div>
            </div>

            {/* Banner: Stato aggiornamento dati settimanali */}
            <div style={{
                background: "linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
                padding: "12px 16px",
                margin: "12px 16px 0",
                display: viewMode === "weekly" ? "flex" : "none",
                alignItems: "center",
                gap: "12px",
                fontSize: "13px"
            }}>
                    {(() => {
                        // Calcola turni contati fino a oggi
                        const allRecords = Object.values(matrixData).flatMap(proj =>
                            Object.values(proj).flatMap(comp =>
                                Object.values(comp).flatMap(cell => cell?.records || [])
                            )
                        ).filter(r => r.data <= wDate);

                        // Conta shift unici (data + turno_id combination)
                        const turniSet = new Set(allRecords.map(r => r.data && r.turno_id ? `${r.data}#${r.turno_id}` : null).filter(Boolean));
                        const turniLavorati = turniSet.size || 0;

                        // Aggiungi turni di oggi in corso
                        let turniTotali = turniLavorati;
                        let turniSenzaDatiOggi = 0;
                        const today = new Date().toISOString().split("T")[0];
                        if (wDate === today) {
                            const currentHour = new Date().getHours();
                            const turniCompletatiOggi = Math.floor(currentHour / 6);
                            const turniGiaConosciutiSet = new Set(allRecords.filter(r => r.data === today).map(r => r.turno_id).filter(Boolean));
                            const turniGiaConosciuti = turniGiaConosciutiSet.size;
                            turniSenzaDatiOggi = Math.max(0, turniCompletatiOggi - turniGiaConosciuti);
                            turniTotali += turniSenzaDatiOggi;
                        }

                        const turniSettimanaliTotali = 20; // 5 giorni × 4 turni
                        const turniMancanti = Math.max(0, turniSettimanaliTotali - turniTotali);

                        // Trova la data/ora più recente dei dati scaricati
                        let ultimoScarico = "—";
                        if (ultimoImportato) {
                            const dataOra = new Date(ultimoImportato);
                            const giorno = dataOra.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
                            const ora = dataOra.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                            ultimoScarico = `${giorno} ${ora}`;
                        }

                        return (
                            <>
                                <div style={{ fontSize: "16px" }}>📊</div>
                                <div>
                                    <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>
                                        ✓ Ultimo scarico: <span style={{ color: "var(--accent)" }}>{ultimoScarico}</span>
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Dati SAP: <span style={{ fontWeight: "700", color: "var(--accent)" }}>{turniLavorati}</span> turni
                                        {turniSenzaDatiOggi > 0 && <span style={{ marginLeft: "12px" }}>⚠️ <span style={{ fontWeight: "700", color: "#ef4444" }}>{turniSenzaDatiOggi}</span> completati senza dati</span>}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>

            {/* Sleek Mosaic Board (High Efficiency Layout) */}
            {!loading && (
                <div
                    data-print-area="boxes"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gridTemplateRows: "1fr 1fr",
                        gap: "12px",
                        height: "calc(100vh - 90px)",
                        padding: "0",
                        overflow: "hidden"
                    }}>
                    {PROJECTS.map((proj) => renderProjectBox(proj))}
                </div>
            )}

            {/* Expanded Project — centrato a schermo */}
            {expandedProject && (
                <div
                    style={{
                        position: "fixed", inset: 0,
                        backgroundColor: "rgba(0,0,0,0.75)",
                        zIndex: 2000,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backdropFilter: "blur(8px)",
                        padding: "32px"
                    }}
                    onClick={() => setExpandedProject(null)}
                >
                    <div
                        style={{ width: "100%", height: "100%", maxWidth: "1600px", display: "flex", flexDirection: "column" }}
                        onClick={e => e.stopPropagation()}
                    >
                        {renderProjectBox(expandedProject, true)}
                    </div>
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
                        {/* Tab bar */}
                        <div style={{ display: "flex", gap: 8, padding: "12px 24px", borderBottom: "1px solid var(--border)" }}>
                            {[{ id: "records", label: "📋 Produzione" }, { id: "throughput", label: "⏱ Throughput" }].map(tab => (
                                <button key={tab.id} onClick={() => setDetailTab(tab.id)} style={{
                                    padding: "6px 14px", borderRadius: 6, cursor: "pointer",
                                    border: "1px solid var(--border)",
                                    background: detailTab === tab.id ? "var(--accent)" : "var(--bg-tertiary)",
                                    color: detailTab === tab.id ? "white" : "var(--text-secondary)",
                                    fontWeight: 600, fontSize: 12
                                }}>{tab.label}</button>
                            ))}
                        </div>
                        <div style={{ padding: "20px 24px", overflowY: "auto" }}>
                            {detailTab === "records" ? (
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ background: "var(--bg-tertiary)" }}>
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)", borderRadius: "6px 0 0 6px" }}>Data</th>
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Materiale</th>
                                            <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Op</th>
                                            {selectedDetail.phaseId === "baa"
                                                ? <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Orario</th>
                                                : <><th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Turno</th>
                                                   <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>Macchina</th></>
                                            }
                                            <th style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>Q.tà</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedDetail.records.length > 0 ? (
                                            selectedDetail.records.map((r, i) => (
                                                <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                    <td style={{ padding: "10px", fontSize: "13px" }}>{new Date(r.data).toLocaleDateString("it-IT")}</td>
                                                    <td style={{ padding: "10px", fontSize: "13px", color: "var(--accent)", fontWeight: "600" }}>{r.materiale}</td>
                                                    <td style={{ padding: "10px", fontSize: "13px", fontWeight: "600" }}>{r.fino || "—"}</td>
                                                    {selectedDetail.phaseId === "baa"
                                                        ? <td style={{ padding: "10px", fontSize: "13px" }}>{r.orario || "—"}</td>
                                                        : <><td style={{ padding: "10px", fontSize: "13px" }}>{r.turno_id}</td>
                                                           <td style={{ padding: "10px", fontSize: "13px", fontWeight: "bold" }}>{r.macchina || r.macchina_id || r.work_center_sap || "—"}</td></>
                                                    }
                                                    <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", textAlign: "right", color: "#3c6ef0" }}>
                                                        {selectedDetail.phaseId === "baa" ? Math.abs(r.quantita || 0) : r.qta_ottenuta}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="7" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                                                    Nessun record trovato in questa fase.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                /* Tab Throughput */
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted)" }}>
                                        Tempo stimato per fase · Lotto {detailCompBase.lotto ?? 1200} pz · OEE {Math.round((detailCompBase.oee ?? 0.85) * 100)}%
                                    </p>
                                    {throughputPhases.map(p => {
                                        const isCurrent = p.phaseId === selectedDetail.phaseId;
                                        const isPast = throughputPhases.findIndex(x => x.phaseId === selectedDetail.phaseId) >
                                                       throughputPhases.findIndex(x => x.phaseId === p.phaseId);
                                        return (
                                            <div key={p.phaseId} style={{
                                                display: "flex", alignItems: "center", gap: 12,
                                                padding: "10px 14px", borderRadius: 8,
                                                background: isCurrent ? "rgba(var(--accent-rgb,60,110,240),0.12)" : "var(--bg-tertiary)",
                                                border: isCurrent ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                                                opacity: isPast ? 0.45 : 1
                                            }}>
                                                <span style={{ fontSize: 13, fontWeight: isCurrent ? 800 : 600, flex: 1, color: isCurrent ? "var(--accent)" : "var(--text-primary)" }}>
                                                    {isCurrent ? "▶ " : ""}{p.label}
                                                </span>
                                                <span style={{ fontSize: 14, fontWeight: 900, color: isCurrent ? "var(--accent)" : "var(--text-secondary)" }}>{p.h}h</span>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>cum. {p.cumH}h</span>
                                            </div>
                                        );
                                    })}
                                    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: 700 }}>Totale attraversamento</span>
                                        <span style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
                                            {throughputTotalH}h &nbsp;<span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>≈ {(throughputTotalH / 24).toFixed(1)} gg</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Target Settings Modal */}
            {targetModal && (
                <Modal
                    title={`🎯 Target Giornaliero ${targetModal.proj}`}
                    subtitle="Inserisci il valore target per l'intera giornata (24h)."
                    onClose={() => setTargetModal(null)}
                    width={320}
                    zIndex={3000}
                >
                    <input
                        type="number"
                        value={targetModal.value}
                        onChange={(e) => setTargetModal({ ...targetModal, value: parseInt(e.target.value) || 0 })}
                        className="input"
                        style={{ width: "100%", fontSize: "24px", fontWeight: "900", textAlign: "center", border: "2px solid var(--accent)", marginTop: 4 }}
                    />
                    <div className="modal-footer">
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setTargetModal(null)}>Annulla</button>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1 }}
                            onClick={() => {
                                const newOverrides = { ...targetOverrides, [targetModal.proj]: targetModal.value };
                                // Sincronizza 8Fe e RG + DH (stesso progetto)
                                if (targetModal.proj === "8Fe") {
                                    newOverrides["RG + DH"] = targetModal.value;
                                } else if (targetModal.proj === "RG + DH") {
                                    newOverrides["8Fe"] = targetModal.value;
                                }
                                setTargetOverrides(newOverrides);
                                localStorage.setItem("bap_target_overrides", JSON.stringify(newOverrides));
                                setTargetModal(null);
                                showToast?.("Target aggiornato!", "success");
                            }}
                        >Salva</button>
                    </div>
                </Modal>
            )}

            {/* Quick Config Modal (Configura Singolo) */}
            {quickConfigModal && (
                <QuickConfigModal
                    data={quickConfigModal}
                    onClose={() => setQuickConfigModal(null)}
                    onSave={() => { setQuickConfigModal(null); fetchData(); }}
                    showToast={showToast}
                />
            )}

            {/* Fermo Modal */}
            {fermoModal && (
                <div style={{
                    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 4000,
                    display: "flex", justifyContent: "center", alignItems: "center", backdropFilter: "blur(6px)"
                }} onClick={() => setFermoModal(null)}>
                    <div style={{
                        background: "var(--bg-card)", borderRadius: 16, width: 420, padding: 28,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.4)", border: "1px solid rgba(239,68,68,0.3)"
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                            <div style={{ fontSize: 20 }}>⚡</div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#ef4444" }}>Registra Fermo</div>
                                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    {fermoModal.comp} · {PHASE_CODE[fermoModal.fase] || fermoModal.fase} · {new Date(wDate + "T12:00:00").toLocaleDateString("it-IT")}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>MACCHINA (opzionale)</label>
                                <input
                                    className="input"
                                    placeholder="Es. FRW123"
                                    value={fermoForm.macchinaId}
                                    onChange={e => setFermoForm(f => ({ ...f, macchinaId: e.target.value.toUpperCase() }))}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>MOTIVO *</label>
                                <select
                                    className="select-input"
                                    value={fermoForm.motivo}
                                    onChange={e => setFermoForm(f => ({ ...f, motivo: e.target.value }))}
                                >{(() => {
                                    const tecId = fermoModal ? FASE_TECNOLOGIA_MAP[fermoModal.fase] : null;
                                    const macchina = motiviFermoList.filter(m => m.tecnologia_id === tecId && !m.is_automazione);
                                    const automazione = motiviFermoList.filter(m => m.tecnologia_id === "automazione");
                                    return (<>
                                        <option value="">— Seleziona —</option>
                                        {macchina.length > 0 && (
                                            <optgroup label="🔧 Macchina">
                                                {macchina.map(m => (
                                                    <option key={m.id} value={m.label}>{m.icona ? m.icona + " " : ""}{m.label}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {automazione.length > 0 && (
                                            <optgroup label="🤖 Automazione">
                                                {automazione.map(m => (
                                                    <option key={m.id} value={m.label}>{m.icona ? m.icona + " " : ""}{m.label}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </>);
                                })()}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>DURATA (minuti) *</label>
                                <input
                                    className="input"
                                    type="number"
                                    placeholder="Es. 30"
                                    value={fermoForm.durata}
                                    onChange={e => setFermoForm(f => ({ ...f, durata: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>NOTE (opzionale)</label>
                                <input
                                    className="input"
                                    placeholder="Dettagli aggiuntivi..."
                                    value={fermoForm.note}
                                    onChange={e => setFermoForm(f => ({ ...f, note: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setFermoModal(null)}>Annulla</button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, background: "#ef4444", borderColor: "#ef4444" }}
                                disabled={savingFermo}
                                onClick={saveFermo}
                            >
                                {savingFermo ? "..." : "Salva Fermo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Numero di codici materiale richiesti per componente in DCT300
const DCT300_CODES_COUNT = {
    "DG": 3, "SG3": 3, "SG4": 3, "SG5": 3, "SG6": 3, "SG7": 3,
    "SG1": 2, "RG": 2,
    "SGR": 1,
};

// --- QUICK CONFIG MODAL (CONFIGURA SINGOLO) ---
function QuickConfigModal({ data, onClose, onSave, showToast }) {
    const isDCT300 = data.project === "DCT300";
    // Quanti codici mostrare per questo componente
    const numCodici = isDCT300
        ? (DCT300_CODES_COUNT[data.comp?.toUpperCase()] ?? 2)
        : 1;

    const [form, setForm] = useState({
        fino: "",
        componente: data.comp || "",
        macchina: "",
        codice: "",
        codice2: "",
        codice3: "",
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchExisting = async () => {
            try {
                // Carica SENZA filtro progetto per gestire varianti ("DCT300" vs "DCT 300")
                const { data: allForCell, error: existingErr } = await supabase
                    .from('material_fino_overrides')
                    .select('*')
                    .eq('fase', data.phase)
                    .ilike('componente', data.comp)
                    .order('id', { ascending: true });

                if (existingErr) console.error("QuickConfigModal query error:", existingErr);

                // Filtra progetto lato client (ignora spazi e case)
                const normalizeProj = (p) => (p || "").trim().replace(/\s+/g, "").toLowerCase();
                const existing = (allForCell || [])
                    .filter(r => normalizeProj(r.progetto) === normalizeProj(data.project))
                    .slice(0, numCodici);

                if (existing.length > 0) {
                    setForm({
                        fino:       existing[0].fino ?? "",
                        componente: existing[0].componente || data.comp || "",
                        macchina:   existing[0].macchina_id || "",
                        codice:     existing[0]?.materiale || "",
                        codice2:    existing[1]?.materiale || "",
                        codice3:    existing[2]?.materiale || "",
                    });
                }
            } catch (err) {
                console.error("QuickConfigModal fetchExisting error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchExisting();
    }, []);

    // Normalizza progetto per confronto (ignora spazi e case)
    const normalizeProj = (p) => (p || "").trim().replace(/\s+/g, "").toLowerCase();

    const deleteMaterial = async (matCode) => {
        if (!matCode.trim()) return;
        try {
            const code = matCode.toUpperCase().trim();
            // Cerca per id per evitare problemi con varianti del nome progetto
            const { data: rows } = await supabase.from('material_fino_overrides')
                .select('id, progetto')
                .eq('materiale', code)
                .eq('fase', data.phase)
                .ilike('componente', data.comp);
            const target = (rows || []).find(r => normalizeProj(r.progetto) === normalizeProj(data.project));
            if (target) {
                await supabase.from('material_fino_overrides').delete().eq('id', target.id);
            }
            showToast("Materiale eliminato con successo!");
            onSave();
        } catch (err) {
            console.error(err);
            showToast("Errore durante l'eliminazione", "error");
        }
    };

    const saveSingleMaterial = async (matCode, finoStr, comp, project, phase, macchina = "") => {
        const ovPayload = {
            materiale:  matCode,
            fino:       finoStr,
            fase:       phase,
            componente: comp,
            progetto:   project,
            macchina_id: macchina.trim() || null,
        };

        // Cerca record esistente tollerando varianti del progetto (es. "DCT 300" vs "DCT300")
        let ovSearchQ = supabase.from('material_fino_overrides').select('id, progetto')
            .eq('materiale', matCode)
            .eq('fase', phase)
            .ilike('componente', comp);
        ovSearchQ = finoStr ? ovSearchQ.eq('fino', finoStr) : ovSearchQ.is('fino', null);
        const { data: ovRows } = await ovSearchQ;
        const existingOv = (ovRows || []).find(r => normalizeProj(r.progetto) === normalizeProj(project));

        if (existingOv) {
            const { error: updErr } = await supabase.from('material_fino_overrides').update(ovPayload).eq('id', existingOv.id);
            if (updErr) console.error("Update error:", updErr);
        } else {
            const { error: insErr } = await supabase.from('material_fino_overrides').insert(ovPayload);
            if (insErr) console.error("Insert error:", insErr, "payload:", ovPayload);
        }
    };

    const handleSave = async () => {
        if (!form.componente || !form.codice) {
            return showToast("Componente e Codice Materiale sono obbligatori", "error");
        }
        setIsSaving(true);
        try {
            const comp = form.componente.toUpperCase();
            const finoStr = form.fino && String(form.fino).trim() ? String(form.fino.trim()).padStart(4, "0") : null;
            const ensureHok = (code) => {
                const c = code.toUpperCase().trim();
                return data.phase === "ht" && !c.endsWith("/T") ? c + "/T" : c;
            };

            await saveSingleMaterial(ensureHok(form.codice), finoStr, comp, data.project, data.phase, form.macchina);

            if (numCodici >= 2 && form.codice2.trim()) {
                await saveSingleMaterial(ensureHok(form.codice2), finoStr, comp, data.project, data.phase, form.macchina);
            }
            if (numCodici >= 3 && form.codice3.trim()) {
                await saveSingleMaterial(ensureHok(form.codice3), finoStr, comp, data.project, data.phase, form.macchina);
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
        <Modal
            title={<>⚙️ Configura Singolo Cell</>}
            subtitle={
                <>
                    Fase <strong style={{ color: "var(--accent)" }}>{data.phaseLabel}</strong> — Progetto <strong>{data.project}</strong>
                    {isLoading && <span style={{ marginLeft: 8, opacity: 0.6 }}>· Caricamento...</span>}
                </>
            }
            onClose={onClose}
            width={460}
            zIndex={5000}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                    <label className="form-label">
                        OP Macchina (Fino) <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>— opzionale</span>
                    </label>
                    <input
                        className="input"
                        value={form.fino}
                        onChange={e => setForm({...form, fino: e.target.value})}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Componente *</label>
                    <input
                        className="input"
                        value={form.componente}
                        onChange={e => setForm({...form, componente: e.target.value.toUpperCase()})}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        Macchina <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>— opzionale</span>
                    </label>
                    <input
                        className="input"
                        value={form.macchina}
                        onChange={e => setForm({...form, macchina: e.target.value.toUpperCase()})}
                    />
                </div>

                {/* Codici materiale — numero dinamico in base al componente */}
                {[
                    { key: "codice",  label: numCodici > 1 ? "Codice Materiale 1 *" : "Codice Materiale *", required: true },
                    { key: "codice2", label: "Codice Materiale 2", required: numCodici >= 2 },
                    { key: "codice3", label: "Codice Materiale 3", required: numCodici >= 3 },
                ].slice(0, numCodici).map(({ key, label, required }) => (
                    <div className="form-group" key={key}>
                        <label className="form-label">
                            {label}
                            {!required && <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}> — opzionale</span>}
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                className="input"
                                value={form[key]}
                                onChange={e => setForm({...form, [key]: e.target.value.toUpperCase()})}
                                style={{ flex: 1 }}
                            />
                            {form[key] && (
                                <button
                                    onClick={() => deleteMaterial(form[key])}
                                    className="btn btn-sm"
                                    title="Elimina materiale"
                                    style={{ background: "var(--danger-muted)", color: "var(--danger)", border: "1px solid var(--danger)", flexShrink: 0 }}
                                >✕</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose}>Annulla</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Salvataggio..." : "Salva Configurazione"}
                </button>
            </div>
        </Modal>
    );
}
