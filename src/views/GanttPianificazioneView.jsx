import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase, fetchAllRows } from "../lib/supabase";
import { phaseHours, loadThroughputConfig } from "../utils/throughput";
import { aggregateSapByPhase, aggregateSapByVariant, normalizeMaterialOverrides } from "../utils/sapMapping";
import { PROJECTS, PROCESS_STEPS } from "../data/constants";
import { getCurrentWeekRange, getLocalDate } from "../lib/dateUtils";

// ─── Costanti ────────────────────────────────────────────────────────────────
const SHIFT_HOURS = 6;
const SHIFTS_DAY  = 4;
const DAYS_WEEK   = 6;       // lun–sab
const DAY_HOURS   = 24;
const WEEK_HOURS  = DAY_HOURS * DAYS_WEEK; // 144

// Target giornalieri per progetto — stessa chiave/localStorage di ComponentFlowView
// RG + DH fa parte del progetto 8Fe → usa lo stesso target
const PROJECT_TARGETS_DEFAULT = {
    "DCT300":  450,
    "8Fe":     800,
    "DCT ECO": 600,
};
// Progetti che ereditano il target da un altro progetto
const PROJECT_TARGET_ALIAS = { "RG + DH": "8Fe" };
const LS_TARGET_KEY = "bap_target_overrides";
const LS_STOCK_OVERRIDES_KEY = "gantt_stock_overrides";      // Record<"proj::comp::phaseId", number>
const LS_UPSTREAM_MACHINE_KEY = "gantt_upstream_machines";   // Record<"machineId::compKey", upstreamMachineId>
const LS_UPSTREAM_PHASE_KEY   = "gantt_upstream_phases";     // Record<"machineId::compKey", phaseId>
const LS_DCT300_ORDERS        = "gantt_dct300_orders";

// Componenti DCT300 comuni a entrambe le varianti 1A/21A (nessun changeover tra varianti)
const DCT300_SHARED_COMPS = new Set(["SG1", "SGR", "DG-REV"]);

// Macchine/fasi per le quali nascondere il bottone "configura flusso"
const MACHINES_NO_FLOW_CONFIG = new Set([
    "dra10060", "dra10061", "dra10062", "dra10063", "dra10064",
    "dra10065", "dra10066", "dra10067", "dra10068", "dra10070",
    "dra10071", "dra10072", "dra11042"
]);
const PHASES_NO_FLOW_CONFIG = new Set(["start_soft"]);

// Mappa completa fase → label (superset per tutte le fasi in material_fino_overrides)
const PHASE_LABELS = {
    start_soft:          "Tornitura Soft",
    hobbing:             "Dentatura",
    laser_welding:       "Saldatura",
    laser_welding_2:     "Saldatura 2",
    ht:                  "Tratt. Termico",
    start_hard:          "Tornitura Hard",
    grinding_cone:       "Rettifica Cono",
    teeth_grinding:      "Rettifica Denti",
    sca_post_deburring:  "Saldatura",
    shaping:             "Dentatura (Shaping)",
    ut:                  "Ultrasuoni",
    ut_soft:             "Ultrasuoni",
    deburring:           "Sbavatura",
    shot_peening:        "Pallinatura",
    ecc_grinding:        "Rettifica Cono Ecc.",
    annealing:           "Ricottura",
    start_hard_2:        "Tornitura Hard 2",
    baa:                 "BAA",
};

// Colori per le fasi principali (usato per i badge nella UI)
const PHASE_COLORS = {
    start_soft:      "#64748b",
    hobbing:         "#2a9e6e",
    laser_welding:   "#e05c2a",
    laser_welding_2: "#c0522a",
    ht:              "#c47b00",
    start_hard:      "#3c6ef0",
    grinding_cone:   "#0891b2",
    teeth_grinding:  "#9b59b6",
    shaping:         "#16a34a",
    ut:              "#0ea5e9",
    deburring:       "#d97706",
    sca_post_deburring: "#e05c2a",
};

// Fasi usate per il Tab "Stato Settimana" (fasi schedulabili)
const GANTT_PHASES = [
    { phaseId: "start_soft",     label: "Tornitura Soft",  shortLabel: "T.Soft",  color: "#64748b", tecnologiaId: "tornitura_soft" },
    { phaseId: "hobbing",        label: "Dentatura",       shortLabel: "Dent.",   color: "#2a9e6e", tecnologiaId: "dentatrici" },
    { phaseId: "laser_welding",  label: "Saldatura",       shortLabel: "Sald.",   color: "#e05c2a", tecnologiaId: "saldatrici" },
    { phaseId: "ht",             label: "Tratt. Termico",  shortLabel: "T.Term.", color: "#c47b00", tecnologiaId: null, idPrefix: "HOK" },
    { phaseId: "start_hard",     label: "Tornitura Hard",  shortLabel: "T.Hard",  color: "#3c6ef0", tecnologiaId: "tornitura_hard" },
    { phaseId: "grinding_cone",  label: "Rettifica Cono",  shortLabel: "R.Cono",  color: "#0891b2", tecnologiaId: "tornitura_rettifica_cono" },
    { phaseId: "teeth_grinding", label: "Rettifica Denti", shortLabel: "R.Denti", color: "#9b59b6", tecnologiaId: "rettifiche denti" },
];

const PROJ_SHORT = { "DCT300": "DCT", "8Fe": "8Fe", "DCT ECO": "ECO", "RG + DH": "RG" };

const DEFAULT_CHANGEOVER_H = {
    start_soft: 1, hobbing: 1, laser_welding: 1, ht: 0,
    start_hard: 1, grinding_cone: 1, teeth_grinding: 1,
};

const DEFAULT_BUNDLES = [
    { id: "dg_bundle", phaseId: "laser_welding", members: ["DCT300::DG", "DCT300::DG-REV"], label: "DG + DG-REV", zeroChangeover: true },
];

// Ordine globale delle fasi (indice = posizione nel flusso)
const PHASE_FLOW_INDEX = Object.fromEntries(PROCESS_STEPS.map((s, i) => [s.id, i]));

/**
 * Ritorna la fase precedente nel flusso per un componente specifico.
 * Prende le fasi configurate per quel componente (da cfg), le ordina
 * secondo PROCESS_STEPS, e restituisce quella prima di phaseId.
 * Null se phaseId è la prima fase o non trovata.
 */
function getUpstreamPhase(compKey, phaseId, cfgComponents) {
    const compPhases = cfgComponents?.[compKey]?.phases || [];
    // Ordina le fasi del componente secondo il flusso globale
    const sorted = [...compPhases]
        .filter(p => p.phaseId !== "baa")
        .sort((a, b) => (PHASE_FLOW_INDEX[a.phaseId] ?? 999) - (PHASE_FLOW_INDEX[b.phaseId] ?? 999));
    const idx = sorted.findIndex(p => p.phaseId === phaseId);
    if (idx <= 0) return null;
    return sorted[idx - 1].phaseId;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonday(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return getLocalDate(d);
}

function keyColor(key) {
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
        h = ((h << 5) + h) ^ key.charCodeAt(i);
        h = h >>> 0;
    }
    return `hsl(${h % 360},${55 + (h % 20)}%,${44 + ((h >> 8) % 14)}%)`;
}

/** Normalizza il progetto alle chiavi canoniche usate in tutta l'app */
function normProj(p) {
    if (!p) return p;
    if (p === "DCT 300")                        return "DCT300";
    if (p === "8 FE" || p === "8Fedct")         return "8Fe";
    if (p === "DCT Eco" || p === "DCTeco")      return "DCT ECO";
    return p;
}

/** How many hours of the week have already elapsed */
function computeConsumedH(weekStart) {
    const now    = new Date();
    const monday = new Date(weekStart + "T00:00:00");
    const diffMs = now - monday;
    if (diffMs <= 0) return 0;
    const diffH = diffMs / (1000 * 3600);
    return Math.min(diffH, WEEK_HOURS);
}

function addDays(dateStr, n) {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) +
        " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/** Formatta "YYYY-MM-DD" → "04/05/2026" */
function fmtDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Converte ore dall'inizio della settimana in una stringa data/ora italiana */
function hoursToDatetime(weekStart, hours) {
    const monday = new Date(weekStart + "T00:00:00");
    const d = new Date(monday.getTime() + hours * 3600000);
    const day  = d.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "2-digit" });
    const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    return `${day} alle ${time}`;
}

// ─── GanttBar ─────────────────────────────────────────────────────────────────
function GanttBar({ blocks, consumedH }) {
    const dayLines   = Array.from({ length: DAYS_WEEK - 1 }, (_, i) => (i + 1) * DAY_HOURS);
    const shiftLines = Array.from({ length: DAYS_WEEK * SHIFTS_DAY - 1 }, (_, i) => (i + 1) * SHIFT_HOURS)
        .filter(h => h % DAY_HOURS !== 0);
    const greyPct = (consumedH / WEEK_HOURS) * 100;
    return (
        <div style={{ position: "relative", height: 28, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
            {/* Past hours grey overlay */}
            {greyPct > 0 && (
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${greyPct}%`, background: "rgba(0,0,0,0.35)", zIndex: 3, borderRight: "2px solid rgba(255,255,255,0.4)" }} />
            )}
            {dayLines.map(h => (
                <div key={h} style={{ position: "absolute", left: `${(h / WEEK_HOURS) * 100}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.18)", zIndex: 1 }} />
            ))}
            {shiftLines.map(h => (
                <div key={h} style={{ position: "absolute", left: `${(h / WEEK_HOURS) * 100}%`, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.05)", zIndex: 1 }} />
            ))}
            {blocks.map((block, i) => {
                const left  = (block.startH / WEEK_HOURS) * 100;
                const width = Math.max(((block.endH - block.startH) / WEEK_HOURS) * 100, 0.1);
                if (block.type === "co") {
                    return <div key={i} title={`Changeover +${block.startH.toFixed(1)}h→${block.endH.toFixed(1)}h`}
                        style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 4, bottom: 4, background: "#6b7280", borderRadius: 2, zIndex: 2 }} />;
                }
                return (
                    <div key={i} title={`${block.shortLabel}: +${block.startH.toFixed(1)}h→${block.endH.toFixed(1)}h`}
                        style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 2, bottom: 2, background: block.color, borderRadius: 2, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap" }}>
                        {width > 2.5 ? block.shortLabel : ""}
                    </div>
                );
            })}
        </div>
    );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ pct }) {
    if (pct >= 100) return <span style={{ padding: "2px 8px", borderRadius: 4, background: "#10b98120", color: "#10b981", fontSize: 11, fontWeight: 700 }}>✓ Completato</span>;
    if (pct >= 70)  return <span style={{ padding: "2px 8px", borderRadius: 4, background: "#f59e0b20", color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>⬤ In corso</span>;
    if (pct >= 1)   return <span style={{ padding: "2px 8px", borderRadius: 4, background: "#3c6ef020", color: "#3c6ef0", fontSize: 11, fontWeight: 700 }}>◎ Iniziato</span>;
    return <span style={{ padding: "2px 8px", borderRadius: 4, background: "#ef444420", color: "#ef4444", fontSize: 11, fontWeight: 700 }}>⚠ Non iniziato</span>;
}

// ─── Main View ────────────────────────────────────────────────────────────────
export default function GanttPianificazioneView({ showToast }) {
    const { monday: thisMonday } = getCurrentWeekRange();

    // ── Navigation state ──
    const [weekStart,     setWeekStart]     = useState(thisMonday);
    const [activeTab,     setActiveTab]     = useState("status");  // "status" | "gantt" | "report" | "config"
    const projectFilter = "all"; // Filter removed — always show all projects
    const [configSubTab,  setConfigSubTab]  = useState("targets"); // "targets"|"changeover"

    // ── Target per progetto (stessa fonte di ComponentFlowView: localStorage) ──
    const [projectTargets, setProjectTargets] = useState(() => {
        try {
            const saved = localStorage.getItem(LS_TARGET_KEY);
            return saved ? JSON.parse(saved) : PROJECT_TARGETS_DEFAULT;
        } catch { return PROJECT_TARGETS_DEFAULT; }
    });

    // ── DB data ──
    const [rawConferme,       setRawConferme]        = useState([]);
    const [materialOverrides, setMaterialOverrides]  = useState([]);
    const [dbFasi,            setDbFasi]             = useState([]);  // componente_fasi rows
    const [lastImport,        setLastImport]         = useState(null);

    // ── Stock overrides manuali (localStorage) ──
    const [stockOverrides, setStockOverrides] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LS_STOCK_OVERRIDES_KEY) || "{}"); }
        catch { return {}; }
    });
    const saveStockOverride = useCallback((key, value) => {
        setStockOverrides(prev => {
            const next = { ...prev };
            if (value === undefined) delete next[key];
            else next[key] = value;
            try { localStorage.setItem(LS_STOCK_OVERRIDES_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    // ── Upstream machine config (localStorage) — Record<"machineId::compKey", upstreamMachineId> ──
    const [upstreamMachineConfig, setUpstreamMachineConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LS_UPSTREAM_MACHINE_KEY) || "{}"); }
        catch { return {}; }
    });
    // machineId + compKey → upstream machine ID (per-component, stessa macchina può avere upstream diversi per componente)
    const saveUpstreamMachine = useCallback((machineId, compKey, upstreamId) => {
        const storageKey = `${machineId}::${compKey}`;
        setUpstreamMachineConfig(prev => {
            const next = { ...prev };
            if (!upstreamId) delete next[storageKey];
            else next[storageKey] = upstreamId;
            try { localStorage.setItem(LS_UPSTREAM_MACHINE_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    // ── Upstream phase config (localStorage) — Record<"machineId::compKey", phaseId> ──
    const [upstreamPhaseConfig, setUpstreamPhaseConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LS_UPSTREAM_PHASE_KEY) || "{}"); }
        catch { return {}; }
    });
    const saveUpstreamPhase = useCallback((machineId, compKey, phaseId) => {
        const storageKey = `${machineId}::${compKey}`;
        setUpstreamPhaseConfig(prev => {
            const next = { ...prev };
            if (!phaseId) delete next[storageKey];
            else next[storageKey] = phaseId;
            try { localStorage.setItem(LS_UPSTREAM_PHASE_KEY, JSON.stringify(next)); } catch {}
            return next;
        });
    }, []);

    // ── Changeover / bundle config ──
    const [changeoverConfig, setChangeoverConfig] = useState(DEFAULT_CHANGEOVER_H);
    const [bundleConfig,     setBundleConfig]     = useState(DEFAULT_BUNDLES);

    // ── Alert debouncing (prevents duplicate alerts for same event within 60s) ──
    const [lastAlertTime, setLastAlertTime] = useState({});

    // ── Changeover non pianificati eseguiti manualmente dall'operatore ──
    // Reset automatico ad ogni nuova settimana (weekStart cambia)
    const [executedCOs, setExecutedCOs] = useState(() => {
        try {
            const stored = JSON.parse(localStorage.getItem("gantt_executed_cos") || "{}");
            return stored.weekStart === weekStart ? (stored.cos || {}) : {};
        } catch { return {}; }
    });
    const markCOExecuted = useCallback((machineId, co) => {
        setExecutedCOs(prev => {
            const key  = `${machineId}::${co.toCompKey}`;
            const next = { ...prev, [key]: { toCompKey: co.toCompKey, toLabel: co.toLabel, toColor: co.toColor, executedAt: Date.now() } };
            localStorage.setItem("gantt_executed_cos", JSON.stringify({ weekStart, cos: next }));
            return next;
        });
    }, [weekStart]);
    const unmarkCOExecuted = useCallback((machineId, co) => {
        setExecutedCOs(prev => {
            const key  = `${machineId}::${co.toCompKey}`;
            const next = { ...prev };
            delete next[key];
            localStorage.setItem("gantt_executed_cos", JSON.stringify({ weekStart, cos: next }));
            return next;
        });
    }, [weekStart]);

    // ── Ordini cliente DCT300 (varianti 1A / 21A) ──
    const [dct300Orders, setDct300Orders] = useState(() => {
        try {
            const s = JSON.parse(localStorage.getItem(LS_DCT300_ORDERS) || "{}");
            return s.weekStart === weekStart ? s : null;
        } catch { return null; }
    });
    const saveDct300Orders = useCallback((data) => {
        const payload = { weekStart, ...data };
        localStorage.setItem(LS_DCT300_ORDERS, JSON.stringify(payload));
        setDct300Orders(payload);
    }, [weekStart]);
    const clearDct300Orders = useCallback(() => {
        localStorage.removeItem(LS_DCT300_ORDERS);
        setDct300Orders(null);
    }, []);

    // ── Loading ──
    const [loading,         setLoading]         = useState(true);
    const [loadingConferme, setLoadingConferme] = useState(false);

    // ── Weekend end date ──
    const weekEnd = useMemo(() => {
        const d = new Date(weekStart + "T12:00:00");
        d.setDate(d.getDate() + 5); // Saturday
        return getLocalDate(d);
    }, [weekStart]);

    // ── Consumed hours (grey zone) ──
    const consumedH = useMemo(() => computeConsumedH(weekStart), [weekStart]);

    // ── Throughput config (DB fasi → localStorage → constants) ──
    const cfg = useMemo(() => {
        const base = loadThroughputConfig();
        if (!dbFasi.length) return base;

        // Group dbFasi by "proj::comp"
        const byComp = {};
        for (const row of dbFasi) {
            const k = `${row.progetto}::${row.componente}`;
            if (!byComp[k]) byComp[k] = [];
            byComp[k].push({
                phaseId: row.fase_id,
                label:   row.fase_label,
                pzH:     row.pzH,
                fixedH:  row.fixedH,
                chargeSize: row.chargeSize,
                noChangeOver: row.noChangeOver ?? false,
            });
        }

        // Merge DB phases into config: per ogni componente, unisci fase per fase
        // (non sostituire l'intero array — altrimenti le fasi non presenti in DB spariscono)
        const merged = { components: { ...base.components } };
        for (const [k, dbPhases] of Object.entries(byComp)) {
            const existing  = base.components[k] || { lotto: 1200, oee: 0.85, changeOverH: 1, rackSize: 72 };
            const basePhases = (existing.phases || []).map(p => ({ ...p }));

            // Indice per phaseId sulle fasi DB
            const dbByPhaseId = Object.fromEntries(dbPhases.map(p => [p.phaseId, p]));

            // Per ogni fase di base: sovrascrive solo i campi presenti in DB
            const mergedPhases = basePhases.map(bp => {
                const dbP = dbByPhaseId[bp.phaseId];
                return dbP ? { ...bp, ...dbP } : bp;
            });
            // Aggiungi eventuali fasi DB che non esistono nel default
            for (const dbP of dbPhases) {
                if (!mergedPhases.find(p => p.phaseId === dbP.phaseId)) {
                    mergedPhases.push(dbP);
                }
            }

            merged.components[k] = { ...existing, phases: mergedPhases };
        }
        return merged;
    }, [dbFasi]);

    // ─── Load static data (once, + reload on demand) ──────────────────────
    const loadOverrides = useCallback(() => {
        return supabase.from("material_fino_overrides")
            .select("materiale,fino,fase,componente,progetto,macchina_id")
            .then(({ data }) => { if (data) setMaterialOverrides(normalizeMaterialOverrides(data)); });
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            loadOverrides(),
            supabase.from("componente_fasi").select("progetto,componente,fase_id,fase_label,pzH,fixedH,chargeSize,noChangeOver")
                .then(({ data }) => { if (data) setDbFasi(data); }),
        ]).then(() => setLoading(false));
    }, [loadOverrides]);

    // ─── Load week data (SAP conferme, on weekStart change) ───────────────
    useEffect(() => {
        setLoadingConferme(true);
        fetchAllRows(() =>
            supabase.from("conferme_sap")
                .select("materiale,fino,qta_ottenuta,data,macchina_id,importato_il")
                .gte("data", weekStart)
                .lte("data", weekEnd)
        ).then(({ data: cData }) => {
            if (cData) {
                setRawConferme(cData);
                const maxDate = cData.reduce((max, r) => {
                    if (!r.importato_il) return max;
                    return (!max || r.importato_il > max) ? r.importato_il : max;
                }, null);
                setLastImport(maxDate);
            }
            setLoadingConferme(false);
        });
    }, [weekStart, weekEnd]);

    // ─── SAP aggregation ──────────────────────────────────────────────────
    const sapByKey = useMemo(
        () => aggregateSapByPhase(rawConferme, materialOverrides),
        [rawConferme, materialOverrides]
    );

    // ─── SAP aggregazione per variante (1A / 21A) — solo componenti DCT300 ───
    const sapByVariant = useMemo(
        () => aggregateSapByVariant(rawConferme, materialOverrides),
        [rawConferme, materialOverrides]
    );

    // ─── Ultima conferma SAP reale per macchina ───────────────────────────
    // Poiché conferme_sap.macchina_id è sempre vuoto, risaliamo alla macchina
    // tramite material_fino_overrides: cerchiamo quale materiale/fino è associato
    // a quale macchina_id, poi prendiamo la conferma con la data più recente.
    const lastSapByMachine = useMemo(() => {
        if (!rawConferme.length || !materialOverrides.length) return {};
        const result = {};
        for (const r of rawConferme) {
            const matCode = (r.materiale || "").toUpperCase();
            const fino    = String(r.fino || "").padStart(4, "0");
            const rowDate = r.data;
            if (!rowDate) continue;
            // Match specifico (mat+fino) prima, poi generico (solo mat)
            const override =
                materialOverrides.find(o => o.mat === matCode && o.fino === fino && o.macchina_id) ||
                materialOverrides.find(o => o.mat === matCode && !o.fino && o.macchina_id);
            if (!override?.macchina_id) continue;
            const machineId = override.macchina_id;
            if (!result[machineId] || rowDate > result[machineId].date) {
                let comp = override.comp;
                if (comp === "SG2-REV") comp = "DG-REV";
                const proj = normProj(override.proj);
                const ps   = PROJ_SHORT[proj] || proj.slice(0, 3);
                result[machineId] = {
                    comp, proj,
                    date:       rowDate,
                    shortLabel: `${comp}·${ps}`,
                    color:      keyColor(`${proj}::${comp}`),
                };
            }
        }
        return result;
    }, [rawConferme, materialOverrides]);

    // ─── Components list ──────────────────────────────────────────────────
    const components = useMemo(() => {
        return Object.keys(cfg.components)
            .filter(key => projectFilter === "all" || key.startsWith(projectFilter + "::"))
            .map(key => {
                const colonIdx = key.indexOf("::");
                const project  = key.slice(0, colonIdx);
                const comp     = key.slice(colonIdx + 2);
                const ps       = PROJ_SHORT[project] || project.slice(0, 3);
                return { key, label: comp, project, shortLabel: `${comp}·${ps}`, color: keyColor(key) };
            });
    }, [cfg, projectFilter]);

    // ─── Weekly targets: target giornaliero × 6 giorni, uguale per tutti i componenti del progetto ──
    // RG + DH usa lo stesso target di 8Fe (sono lo stesso progetto fisico)
    // DCT300 con ordini cliente: target per variante 1A/21A invece del fisso
    const weeklyTargets = useMemo(() => {
        const result = {};
        for (const comp of components) {
            const proj  = PROJECT_TARGET_ALIAS[comp.project] || comp.project;
            const daily = projectTargets[proj] || 0;
            if (comp.project === "DCT300" && dct300Orders) {
                if (DCT300_SHARED_COMPS.has(comp.label)) {
                    // Componenti condivisi: target = somma entrambe le varianti
                    result[comp.key] = (dct300Orders.tot1a || 0) + (dct300Orders.tot21a || 0);
                } else {
                    // Componenti variante-specifici: target separato per variante
                    result[`${comp.key}::1a`]  = dct300Orders.tot1a  || 0;
                    result[`${comp.key}::21a`] = dct300Orders.tot21a || 0;
                }
            } else {
                result[comp.key] = daily * DAYS_WEEK;
            }
        }
        return result;
    }, [components, projectTargets, dct300Orders]);

    // ─── Status data (Tab 1) ──────────────────────────────────────────────
    const statusRows = useMemo(() => {
        const rows = [];
        for (const comp of components) {
            const target = weeklyTargets[comp.key] || 0;
            if (!target) continue;
            const compCfg = cfg.components[comp.key];
            if (!compCfg?.phases) continue;

            for (const phase of compCfg.phases) {
                const sapKey   = `${comp.key}::${phase.phaseId}`;
                const produced = sapByKey[sapKey] || 0;
                const pct      = target > 0 ? Math.round((produced / target) * 100) : 0;
                const remaining = Math.max(0, target - produced);
                rows.push({
                    compKey:   comp.key,
                    label:     comp.label,
                    project:   comp.project,
                    color:     comp.color,
                    phaseId:   phase.phaseId,
                    phaseLabel: phase.label || phase.phaseId,
                    target,
                    produced,
                    remaining,
                    pct: Math.min(pct, 100),
                });
            }
        }
        return rows;
    }, [components, cfg, sapByKey, weeklyTargets]);

    // ─── Shared machines (Tab 2) ──────────────────────────────────────────
    // Costruisce la lista di macchine condivise da material_fino_overrides
    // Una macchina è "condivisa" se gestisce >1 componente (proj::comp distinti)
    const sharedMachines = useMemo(() => {
        if (!materialOverrides.length) return [];

        // Raggruppa override per macchina_id (salta quelli senza macchina)
        const byMachine = {};
        for (const o of materialOverrides) {
            if (!o.macchina_id) continue;
            if (!byMachine[o.macchina_id]) byMachine[o.macchina_id] = [];
            byMachine[o.macchina_id].push(o);
        }

        const result = [];
        for (const [machineId, overrides] of Object.entries(byMachine)) {
            // Costruisci le chiavi normalizzate proj::comp
            const compKeysRaw = overrides.map(o => {
                const pj = normProj(o.proj);
                let comp = o.comp; // già uppercase da normalizeMaterialOverrides
                if (comp === "SG2-REV") comp = "DG-REV";
                return `${pj}::${comp}`;
            });
            const uniqueComps = [...new Set(compKeysRaw)];
            if (uniqueComps.length <= 1) continue; // non condivisa

            // Fase primaria della macchina (la più frequente tra gli override)
            const phaseCounts = {};
            for (const o of overrides) {
                if (o.phase && o.phase !== "baa") {
                    phaseCounts[o.phase] = (phaseCounts[o.phase] || 0) + 1;
                }
            }
            const phase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
            if (!phase) continue;

            // Filtro progetto
            if (projectFilter !== "all" && !uniqueComps.some(k => k.startsWith(projectFilter + "::"))) continue;

            const coH = changeoverConfig[phase] ?? 1;

            // Calcola lavoro per ogni componente
            const items = [];
            for (const compKey of uniqueComps) {
                if (projectFilter !== "all" && !compKey.startsWith(projectFilter + "::")) continue;

                // DCT300 variante-specifici con ordini cliente: gestiti separatamente sotto
                const [_ckProj, _ckComp] = [compKey.slice(0, compKey.indexOf("::")), compKey.slice(compKey.indexOf("::") + 2)];
                if (_ckProj === "DCT300" && dct300Orders && !DCT300_SHARED_COMPS.has(_ckComp)) continue;

                const target    = weeklyTargets[compKey] || 0;

                // Trova tutte le fasi di questo componente su questa macchina
                // Tutte le SCA usano laser_welding come fase in material_fino_overrides
                const compOverridesForMachine = overrides.filter(o => {
                    const opj = normProj(o.proj);
                    let oc = o.comp;
                    if (oc === "SG2-REV") oc = "DG-REV";
                    return `${opj}::${oc}` === compKey && o.phase && o.phase !== "baa";
                });
                const relevantPhases = [...new Set(compOverridesForMachine.map(o => o.phase))];
                const phasesToUse = relevantPhases.length > 0 ? relevantPhases : [phase];

                // Somma produzione su tutte le fasi rilevanti
                const produced  = phasesToUse.reduce((s, p) => s + (sapByKey[`${compKey}::${p}`] || 0), 0);
                const pct       = target > 0 ? Math.min(Math.round((produced / target) * 100), 100) : 0;

                // ── Vincolo upstream (flusso) ──────────────────────────────
                // Fase upstream: priorità config manuale → auto-detect dal flusso componente
                const upstreamPhaseId = upstreamPhaseConfig[`${machineId}::${compKey}`] || getUpstreamPhase(compKey, phase, cfg.components);
                let remaining = Math.max(0, target - produced);
                let upstreamProduced = null;
                let upstreamConstrained = false;
                let upstreamMachineId = null;
                let isManualOverride = false;
                let availableFromUpstream = null;
                // Grezzo manuale (prima fase — nessuna fase upstream)
                const grezzoKey = `${compKey}::grezzo`;
                const grezzoStock = !upstreamPhaseId && grezzoKey in stockOverrides ? stockOverrides[grezzoKey] : null;
                if (upstreamPhaseId) {
                    const overrideKey = `${compKey}::${upstreamPhaseId}`;
                    isManualOverride = overrideKey in stockOverrides;
                    upstreamProduced = isManualOverride
                        ? stockOverrides[overrideKey]
                        : (sapByKey[`${compKey}::${upstreamPhaseId}`] || 0);
                    availableFromUpstream = Math.max(0, upstreamProduced - produced);
                    const targetRemaining = Math.max(0, target - produced);
                    remaining = Math.min(targetRemaining, availableFromUpstream);
                    upstreamConstrained = availableFromUpstream < targetRemaining;
                    // Priorità: config manuale per questo machine+comp → auto-detect da material_fino_overrides
                    upstreamMachineId = upstreamMachineConfig[`${machineId}::${compKey}`] ||
                        materialOverrides.find(o => {
                            const op = normProj(o.proj);
                            let oc = o.comp;
                            if (oc === "SG2-REV") oc = "DG-REV";
                            return `${op}::${oc}` === compKey && o.phase === upstreamPhaseId && o.macchina_id;
                        })?.macchina_id || null;
                } else if (grezzoStock !== null) {
                    // Vincolo grezzo manuale
                    const available = Math.max(0, grezzoStock - produced);
                    const targetRemaining = Math.max(0, target - produced);
                    remaining = Math.min(targetRemaining, available);
                }

                const [proj, comp] = [compKey.slice(0, compKey.indexOf("::")), compKey.slice(compKey.indexOf("::") + 2)];
                const ps = PROJ_SHORT[proj] || proj.slice(0, 3);

                const compCfg  = cfg.components[compKey];
                // Cerca il config throughput su tutte le fasi rilevanti del componente su questa macchina
                // (non solo sulla fase primaria della macchina, che può differire per componente)
                const phaseFasi = phasesToUse
                    .map(ph => compCfg?.phases?.find(p => p.phaseId === ph))
                    .find(Boolean);
                const lotto     = compCfg?.lotto || 1200;
                const hPerLot   = phaseFasi ? +phaseHours(phaseFasi, { ...compCfg, changeOverH: coH }).toFixed(2) : 0;
                // Per il Gantt usiamo targetRemaining (senza vincolo upstream) così il carico pianificato
                // è sempre visibile anche quando l'upstream non ha ancora prodotto questa settimana.
                const targetRemainingForPlan = Math.max(0, target - produced);
                const lotsNeeded = (hPerLot > 0 && targetRemainingForPlan > 0) ? Math.ceil(targetRemainingForPlan / lotto) : 0;
                const totalH    = +(lotsNeeded * hPerLot).toFixed(1);

                // JPH: pezzi per ora (throughput)
                const jph = hPerLot > 0 ? +(lotto / hPerLot).toFixed(1) : 0;
                // Urgency: ore rimanenti / ore disponibili (quanto critico è questo componente)
                const remainingH = hPerLot > 0 && remaining > 0 ? remaining / jph : 0;
                const availableH = Math.max(WEEK_HOURS - consumedH, 1);
                const urgencyScore = availableH > 0 ? (remainingH / availableH).toFixed(2) : 0;

                items.push({
                    compKey, proj, comp, ps,
                    label:      comp,
                    shortLabel: `${comp}·${ps}`,
                    color:      keyColor(compKey),
                    target, produced, remaining, pct,
                    lotto, hPerLot, lotsNeeded, totalH,
                    jph, remainingH, urgencyScore,
                    upstreamPhaseId, upstreamProduced, upstreamConstrained, availableFromUpstream,
                    upstreamMachineId, isManualOverride, grezzoStock,
                    changeOverH: coH,
                    hasConfig:  !!phaseFasi,
                    relevantPhases: phasesToUse,
                });
            }

            // DCT300 variante-specifici: due item per variante (1A e 21A) in ordine urgenza
            if (dct300Orders) {
                const firstVariant  = (dct300Orders.first21a || "") <= (dct300Orders.first1a || "") ? "21a" : "1a";
                const secondVariant = firstVariant === "21a" ? "1a" : "21a";
                const tot1a  = dct300Orders.tot1a  || 0;
                const tot21a = dct300Orders.tot21a || 0;
                const sapTotAll = tot1a + tot21a;
                const availableH = Math.max(WEEK_HOURS - consumedH, 1);

                for (const compKey of uniqueComps) {
                    if (projectFilter !== "all" && !compKey.startsWith(projectFilter + "::")) continue;
                    const [proj, comp] = [compKey.slice(0, compKey.indexOf("::")), compKey.slice(compKey.indexOf("::") + 2)];
                    if (proj !== "DCT300" || DCT300_SHARED_COMPS.has(comp)) continue;

                    const compOverridesForMachine = overrides.filter(o => {
                        const opj = normProj(o.proj); let oc = o.comp;
                        if (oc === "SG2-REV") oc = "DG-REV";
                        return `${opj}::${oc}` === compKey && o.phase && o.phase !== "baa";
                    });
                    const relevantPhases = [...new Set(compOverridesForMachine.map(o => o.phase))];
                    const phasesToUse = relevantPhases.length > 0 ? relevantPhases : [phase];
                    const ps = PROJ_SHORT[proj] || proj.slice(0, 3);
                    const compCfg  = cfg.components[compKey];
                    const phaseFasi = phasesToUse.map(ph => compCfg?.phases?.find(p => p.phaseId === ph)).find(Boolean);
                    const lotto    = compCfg?.lotto || 1200;
                    const hPerLot  = phaseFasi ? +phaseHours(phaseFasi, { ...compCfg, changeOverH: coH }).toFixed(2) : 0;
                    const jph      = hPerLot > 0 ? +(lotto / hPerLot).toFixed(1) : 0;
                    const sapTotalForComp = phasesToUse.reduce((s, p) => s + (sapByKey[`${compKey}::${p}`] || 0), 0);

                    for (const v of [firstVariant, secondVariant]) {
                        const vKey      = `${compKey}::${v}`;
                        const vTarget   = weeklyTargets[vKey] || 0;
                        const vQty      = v === "1a" ? tot1a : tot21a;
                        const vProduced = sapTotAll > 0 ? Math.round(sapTotalForComp * vQty / sapTotAll) : 0;
                        const vPct      = vTarget > 0 ? Math.min(Math.round((vProduced / vTarget) * 100), 100) : 0;
                        const vRemaining = Math.max(0, vTarget - vProduced);
                        const vLotsNeeded = (hPerLot > 0 && vRemaining > 0) ? Math.ceil(vRemaining / lotto) : 0;
                        const vTotalH   = +(vLotsNeeded * hPerLot).toFixed(1);
                        const vRemainingH = hPerLot > 0 && vRemaining > 0 ? vRemaining / jph : 0;
                        const vUrgency  = +(vRemainingH / availableH).toFixed(2);
                        items.push({
                            compKey: vKey, proj, comp, ps,
                            label:      `${comp} ${v.toUpperCase()}`,
                            shortLabel: `${comp}·DCT·${v.toUpperCase()}`,
                            color:      keyColor(compKey),
                            target: vTarget, produced: vProduced, remaining: vRemaining, pct: vPct,
                            lotto, hPerLot, lotsNeeded: vLotsNeeded, totalH: vTotalH,
                            jph, remainingH: vRemainingH, urgencyScore: vUrgency,
                            upstreamPhaseId: null, upstreamProduced: null, upstreamConstrained: false,
                            availableFromUpstream: null, upstreamMachineId: null,
                            isManualOverride: false, grezzoStock: null,
                            changeOverH: coH,
                            hasConfig:  !!phaseFasi,
                            relevantPhases: phasesToUse,
                            isVariant: true,
                            baseCompKey: compKey,
                        });
                    }
                }
            }

            // Ordina: più urgente prima (urgency DESC = più ore richieste rispetto al tempo rimasto)
            items.sort((a, b) => b.urgencyScore - a.urgencyScore || a.pct - b.pct);

            // Risali al componente attualmente in produzione da SAP:
            // cerca in rawConferme la conferma più recente per i materiali di questa macchina
            let lastSapCompKey = null;
            {
                let lastDate = null;
                for (const r of rawConferme) {
                    const matCode = (r.materiale || "").toUpperCase();
                    const fino    = String(r.fino || "").padStart(4, "0");
                    const rowDate = r.data;
                    if (!rowDate) continue;
                    const ov =
                        overrides.find(o => o.mat === matCode && o.fino === fino) ||
                        overrides.find(o => o.mat === matCode && !o.fino);
                    if (!ov) continue;
                    if (!lastDate || rowDate > lastDate) {
                        lastDate = rowDate;
                        let c = ov.comp;
                        if (c === "SG2-REV") c = "DG-REV";
                        lastSapCompKey = `${normProj(ov.proj)}::${c}`;
                    }
                }
                // Usa lastSapCompKey solo se è uno dei componenti gestiti da questa macchina
                if (lastSapCompKey && !uniqueComps.includes(lastSapCompKey)) lastSapCompKey = null;
            }

            // ── Scheduler con epoche giornaliere ──────────────────────────
            // Quando ci sono più componenti da produrre, invece di finire
            // tutti i lotti del componente A prima di passare a B,
            // ogni giorno (DAY_HOURS) distribuiamo il tempo proporzionalmente
            // al lavoro rimanente → changeover quotidiani, entrambi avanzano.
            const blocks = [];
            let cursor = consumedH;
            let lastCompKey = lastSapCompKey;

            // Coda lotti modificabile
            const lotQueue = items
                .filter(i => i.lotsNeeded > 0 && i.hPerLot > 0)
                .map(i => ({ ...i, lotsLeft: i.lotsNeeded }));

            const scheduleOneLot = (item) => {
                const needsCO = lastCompKey !== null && lastCompKey !== item.compKey;
                if (needsCO) {
                    const coEnd = Math.min(cursor + item.changeOverH, WEEK_HOURS);
                    blocks.push({ type: "co", startH: cursor, endH: coEnd, toCompKey: item.compKey });
                    cursor = coEnd;
                }
                if (cursor >= WEEK_HOURS) return false;
                const endH = Math.min(cursor + item.hPerLot, WEEK_HOURS);
                blocks.push({ type: "work", compKey: item.compKey, shortLabel: item.shortLabel, color: item.color, startH: cursor, endH });
                lastCompKey = item.compKey;
                cursor = endH;
                item.lotsLeft--;
                return true;
            };

            if (lotQueue.length <= 1) {
                // Singolo componente: tutti i lotti in sequenza
                const item = lotQueue[0];
                if (item) {
                    while (item.lotsLeft > 0 && cursor < WEEK_HOURS) scheduleOneLot(item);
                }
            } else {
                // Più componenti: pianifica per epoche giornaliere
                // In ogni epoca, distribuisce il tempo proporzionalmente al lavoro rimanente
                const MAX_EPOCHS = DAYS_WEEK * 4; // protezione loop infinito
                let epochCount = 0;
                while (cursor < WEEK_HOURS && lotQueue.some(i => i.lotsLeft > 0) && epochCount++ < MAX_EPOCHS) {
                    const epochEnd = Math.min(cursor + DAY_HOURS, WEEK_HOURS);
                    const epochH   = epochEnd - cursor;

                    const active = lotQueue.filter(i => i.lotsLeft > 0);
                    if (!active.length) break;

                    // Sort: più urgente prima (urgencyScore DESC = richiede più ore rispetto al tempo rimasto)
                    active.sort((a, b) => b.urgencyScore - a.urgencyScore);

                    // Calcola ore totali rimanenti per proporzione
                    const totalWorkH = active.reduce((s, i) => s + i.lotsLeft * i.hPerLot, 0);

                    for (const item of active) {
                        if (cursor >= epochEnd) break;
                        // Ore proporzionali per questo componente in questa epoca
                        const fraction = (item.lotsLeft * item.hPerLot) / Math.max(totalWorkH, 0.01);
                        const allocH   = epochH * fraction;

                        // Schedula lotti finché rientrano nell'allocazione
                        let usedH = 0;
                        while (item.lotsLeft > 0 && cursor < epochEnd) {
                            const coH = (lastCompKey !== null && lastCompKey !== item.compKey) ? item.changeOverH : 0;
                            if (usedH + coH + item.hPerLot > allocH + 0.1) break; // tolleranza 0.1h
                            const prevCursor = cursor;
                            const ok = scheduleOneLot(item);
                            if (!ok) break;
                            usedH += cursor - prevCursor;
                        }
                    }
                    // Se cursor non ha raggiunto epochEnd ma i lotti sono esauriti, esci
                    if (!lotQueue.some(i => i.lotsLeft > 0)) break;
                }
            }

            // Estrai eventi changeover con data/ora assoluta
            const changeovers = blocks
                .filter(b => b.type === "co")
                .map(b => {
                    const toItem = items.find(i => i.compKey === b.toCompKey);
                    return {
                        at:         b.startH,
                        toCompKey:  b.toCompKey,
                        toLabel:    toItem?.shortLabel || b.toCompKey,
                        toColor:    toItem?.color || "#888",
                        datetime:   hoursToDatetime(weekStart, b.startH),
                    };
                });

            const totalDemandH  = +items.reduce((s, i) => s + i.totalH, 0).toFixed(1);
            const availableH    = Math.max(WEEK_HOURS - consumedH, 1);
            const utilPct       = Math.min(Math.round((totalDemandH / availableH) * 100), 100);
            const isOverCapacity = totalDemandH > availableH;

            result.push({
                machineId,
                phase,
                phaseLabel: PHASE_LABELS[phase] || phase,
                phaseColor: PHASE_COLORS[phase] || "#888",
                items, blocks, changeovers,
                totalDemandH,
                utilPct,
                isOverCapacity,
            });
        }

        // Ordina: più componenti condivisi prima, poi per machineId
        result.sort((a, b) => b.items.length - a.items.length || a.machineId.localeCompare(b.machineId));
        return result;
    }, [materialOverrides, rawConferme, weeklyTargets, sapByKey, stockOverrides, upstreamMachineConfig, upstreamPhaseConfig, cfg, changeoverConfig, consumedH, projectFilter, weekStart, dct300Orders]);

    // ─── Compute machineStatus for all shared machines (for alerts) ──
    const machineStatus = useMemo(() => {
        return sharedMachines.map(machine => {
            const itemsWithProgress = machine.items.map(item => {
                const target   = weeklyTargets[item.compKey] || 0;
                // Per item variante DCT300 (compKey = "DCT300::SG3::1a"), il SAP è sotto la chiave base
                const sapKey = item.isVariant && item.baseCompKey ? item.baseCompKey : item.compKey;
                const baseSapProduced = (item.relevantPhases || [machine.phase])
                    .reduce((s, p) => s + (sapByKey[`${sapKey}::${p}`] || 0), 0);
                const produced = item.isVariant && item.baseCompKey
                    ? (() => {
                        const tot1a  = weeklyTargets[`${item.baseCompKey}::1a`]  || 0;
                        const tot21a = weeklyTargets[`${item.baseCompKey}::21a`] || 0;
                        const sapTotal = tot1a + tot21a;
                        return sapTotal > 0 ? Math.round(baseSapProduced * target / sapTotal) : 0;
                    })()
                    : baseSapProduced;
                const pct      = target > 0 ? Math.min(Math.round((produced / target) * 100), 100) : 0;

                const upstreamPhaseId = item.isVariant ? null : ((upstreamPhaseConfig || {})[`${machine.machineId}::${item.compKey}`] || item.upstreamPhaseId || null);
                let remaining = Math.max(0, target - produced);
                let upstreamConstrained = false;
                let upstreamProduced = null;
                let availableFromUpstream = null;
                let isManualOverride = false;
                const grezzoKey = `${item.compKey}::grezzo`;
                const grezzoStock = !upstreamPhaseId && grezzoKey in (stockOverrides || {}) ? stockOverrides[grezzoKey] : null;
                if (upstreamPhaseId) {
                    const overrideKey = `${item.compKey}::${upstreamPhaseId}`;
                    isManualOverride = overrideKey in (stockOverrides || {});
                    upstreamProduced = isManualOverride
                        ? stockOverrides[overrideKey]
                        : (sapByKey[`${item.compKey}::${upstreamPhaseId}`] || 0);
                    availableFromUpstream = Math.max(0, upstreamProduced - produced);
                    const targetRemaining = Math.max(0, target - produced);
                    remaining = Math.min(targetRemaining, availableFromUpstream);
                    upstreamConstrained = availableFromUpstream < targetRemaining;
                } else if (grezzoStock !== null) {
                    const available = Math.max(0, grezzoStock - produced);
                    remaining = Math.min(Math.max(0, target - produced), available);
                }

                const hoursLeft = Math.max(WEEK_HOURS - consumedH, 1);
                const pzHNeeded = item.hPerLot > 0 ? Math.round((item.lotto / item.hPerLot)) : 0;
                const onPace    = pzHNeeded > 0 ? (produced / (consumedH || 1)) >= (target / WEEK_HOURS * 0.85) : null;
                return { ...item, upstreamPhaseId, target, produced, pct, remaining, onPace, hoursLeft, upstreamConstrained, upstreamProduced, availableFromUpstream, isManualOverride, grezzoStock };
            });

            const currentBlock = machine.blocks.find(b =>
                b.type === "work" && b.startH <= consumedH && b.endH > consumedH
            ) || machine.blocks.filter(b => b.type === "work" && b.endH <= consumedH).pop();

            const nextCO = machine.changeovers.find(co => co.at > consumedH);
            // Escludi i CO già segnati come eseguiti dall'operatore
            const overdueCOs = machine.changeovers.filter(co =>
                co.at <= consumedH && !executedCOs[`${machine.machineId}::${co.toCompKey}`]
            );
            // Ultimo CO eseguito manualmente (per aggiornare "componente attuale" senza aspettare SAP)
            const lastExecutedCO = Object.entries(executedCOs)
                .filter(([k]) => k.startsWith(`${machine.machineId}::`))
                .map(([, v]) => v)
                .sort((a, b) => b.executedAt - a.executedAt)[0] || null;

            let urgency = 0;
            if (overdueCOs.length > 0) urgency = 3;
            else if (nextCO && (nextCO.at - consumedH) <= 6)  urgency = 2;
            else if (nextCO && (nextCO.at - consumedH) <= 24) urgency = 1;

            let prodUrgency = 0;
            if (consumedH > 6) {
                const expectedPct = Math.round((consumedH / WEEK_HOURS) * 100);
                const worstDelta = Math.min(...itemsWithProgress
                    .filter(i => i.target > 0)
                    .map(i => i.pct - expectedPct));
                if (worstDelta < -30) prodUrgency = 2;
                else if (worstDelta < -15) prodUrgency = 1;
            }

            // ── Smart Changeover Recommendation: Urgency-based ──
            // Se un componente è significativamente più critico (>15% gap), suggerisci changeover
            let recommendedItem = null;
            let urgencyDelta = 0;
            {
                const currentItemKey = currentBlock?.compKey || machine.items[0]?.compKey;
                const currentItem = itemsWithProgress.find(i => i.compKey === currentItemKey);
                if (currentItem && itemsWithProgress.length > 1) {
                    let maxDelta = 0;
                    let mostCriticalItem = null;

                    // Calcola percentuale di ritardo per ogni componente
                    const getUrgencyPercentage = (item) => {
                        if (item.target <= 0) return 0;
                        return (item.target - item.produced) / item.target;
                    };

                    const currentUrgency = getUrgencyPercentage(currentItem);

                    for (const item of itemsWithProgress) {
                        if (item.compKey === currentItemKey || item.target <= 0) continue;
                        const itemUrgency = getUrgencyPercentage(item);
                        const delta = itemUrgency - currentUrgency;
                        if (delta > maxDelta && delta > 0.15) {  // Threshold: 15%
                            maxDelta = delta;
                            mostCriticalItem = item;
                        }
                    }

                    if (mostCriticalItem && maxDelta > 0.15) {
                        recommendedItem = mostCriticalItem;
                        urgencyDelta = maxDelta;
                    }
                }
            }

            // ── Bottleneck Risk Detection ──
            // Una macchina è a rischio bottleneck se:
            // 1. Ha componenti molto indietro (prodUrgency >= 1)
            // 2. Ha poco tempo rimasto rispetto al lavoro necessario
            // 3. Serve componenti critici per altri progetti
            let bottleneckRisk = 0;  // 0=none, 1=warning, 2=critical
            {
                const totalHoursNeeded = itemsWithProgress
                    .filter(i => i.remaining > 0)
                    .reduce((sum, i) => sum + i.remainingH, 0);
                const hoursRemaining = WEEK_HOURS - consumedH;
                const daysRemaining = hoursRemaining / 24;

                // Se ha lavoro > ore rimanenti per >30% → warning
                if (totalHoursNeeded > hoursRemaining * 1.3 && daysRemaining < 3 && prodUrgency >= 1) {
                    bottleneckRisk = 1;
                }
                // Se ha lavoro > ore rimanenti per >50% → critical
                if (totalHoursNeeded > hoursRemaining * 1.5 && daysRemaining < 2) {
                    bottleneckRisk = 2;
                }
            }

            return { ...machine, itemsWithProgress, currentBlock, nextCO, overdueCOs, lastExecutedCO, urgency, prodUrgency, recommendedItem, urgencyDelta, bottleneckRisk };
        }).sort((a, b) => b.urgency - a.urgency || a.machineId.localeCompare(b.machineId));
    }, [sharedMachines, weeklyTargets, sapByKey, stockOverrides, upstreamPhaseConfig, consumedH, executedCOs]);

    // ── Alert system: triggers operator-guidance alerts ──
    useEffect(() => {
        if (!machineStatus.length || !showToast) return;

        const shouldAlert = (machineId, eventKey, cooldown = 60) => {
            const key = `${machineId}::${eventKey}`;
            const lastTime = lastAlertTime[key] || 0;
            const now = Date.now();
            if (now - lastTime >= cooldown * 1000) {
                setLastAlertTime(prev => ({ ...prev, [key]: now }));
                return true;
            }
            return false;
        };

        for (const machine of machineStatus) {
            // Check 1: Overdue changeovers — changeover.toCompKey/toLabel are the correct fields
            if (machine.overdueCOs.length > 0) {
                const co = machine.overdueCOs[0];
                const timeAgo = (consumedH - co.at).toFixed(1);
                if (shouldAlert(machine.machineId, `overdue_${co.toCompKey}`)) {
                    showToast(`🔴 CAMBIO SCADUTO: dovevi passare a ${co.toLabel} ${timeAgo}h fa`, "error");
                }
            }

            // Check 2: Changeover in progress — use blocks (have startH/endH), not changeovers (only have `at`)
            const activeCOBlock = machine.blocks.find(
                b => b.type === "co" && b.startH <= consumedH && b.endH > consumedH
            );
            if (activeCOBlock) {
                const toItem = machine.itemsWithProgress.find(i => i.compKey === activeCOBlock.toCompKey);
                const timeLeft = (activeCOBlock.endH - consumedH).toFixed(1);
                const label = toItem?.shortLabel || activeCOBlock.toCompKey;
                if (shouldAlert(machine.machineId, `in_progress_${activeCOBlock.toCompKey}`)) {
                    showToast(`🔄 IN CORSO: changeover → ${label} (fine in ${timeLeft}h)`, "info");
                }
            }

            // Check 3: Imminent changeover (0-4h before) — use toCompKey/toLabel
            if (machine.nextCO && machine.nextCO.at > consumedH && (machine.nextCO.at - consumedH) <= 4) {
                const timeLeft = (machine.nextCO.at - consumedH).toFixed(1);
                if (shouldAlert(machine.machineId, `imminent_${machine.nextCO.toCompKey}`)) {
                    showToast(`⏳ Tra ${timeLeft}h: cambia a ${machine.nextCO.toLabel}`, "warning");
                }
            }

            // Check 4: Component complete — item.proj and item.compKey come from sharedMachines items spread
            for (const item of machine.itemsWithProgress) {
                if (item.produced >= item.target && item.target > 0) {
                    const nextItem = machine.itemsWithProgress.find(i => i.produced < i.target && i.target > 0);
                    const nextLabel = nextItem ? nextItem.shortLabel : "fine turno";
                    if (shouldAlert(machine.machineId, `complete_${item.compKey}`)) {
                        showToast(`✅ ${item.shortLabel} completato! Prossimo: ${nextLabel}`, "success");
                    }
                }
            }

            // Check 5: Behind schedule — guard against empty itemsWithProgress
            if (machine.prodUrgency >= 1) {
                const withTarget = machine.itemsWithProgress.filter(i => i.target > 0);
                if (withTarget.length > 0) {
                    const expectedPct = Math.round((consumedH / WEEK_HOURS) * 100);
                    const worstDelta = Math.min(...withTarget.map(i => i.pct - expectedPct));
                    const delta = Math.abs(worstDelta);
                    if (shouldAlert(machine.machineId, `behind_schedule_${Math.floor(delta / 10)}`)) {
                        showToast(`⚠ ${machine.machineId}: Sei ${delta}% dietro al ritmo previsto`, "warning");
                    }
                }
            }
        }
    }, [machineStatus, consumedH, lastAlertTime, showToast]);

    // ─── Save project targets → localStorage (stessa chiave di ComponentFlowView) ───
    const saveProjectTargets = useCallback((newTargets) => {
        setProjectTargets(newTargets);
        try { localStorage.setItem(LS_TARGET_KEY, JSON.stringify(newTargets)); } catch {}
        showToast?.("✅ Target salvati", "success");
    }, [showToast]);

    // ─── Styles ───────────────────────────────────────────────────────────
    const cardStyle = { background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 };
    const tabBtnStyle = (active, color) => ({
        padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 400,
        border: `2px solid ${active ? (color || "var(--accent)") : "var(--border)"}`,
        background: active ? (color ? color + "22" : "var(--accent-dim)") : "var(--bg-secondary)",
        color: active ? (color || "var(--accent)") : "var(--text-secondary)",
        transition: "all 0.15s",
    });

    if (loading) return (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento...</div>
    );

    return (
        <div style={{ padding: "0 0 32px 0" }}>

            {/* ── Header ── */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                    📅 Pianificazione Changeover
                </h2>
                {lastImport && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-tertiary)", padding: "3px 8px", borderRadius: 4 }}>
                        SAP: {fmtDateTime(lastImport)}
                    </span>
                )}
                {loadingConferme && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⟳ aggiornamento...</span>}
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Settimana:</span>
                    <input type="date" value={weekStart}
                        onChange={e => setWeekStart(getMonday(e.target.value))}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }} />
                </div>
            </div>

            {/* ── Main Tabs ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                <button style={tabBtnStyle(activeTab === "status",  "#10b981")} onClick={() => setActiveTab("status")}>📊 Stato Settimana</button>
                <button style={tabBtnStyle(activeTab === "gantt",   "#3c6ef0")} onClick={() => setActiveTab("gantt")}>📅 Gantt Pianificazione</button>
                <button style={tabBtnStyle(activeTab === "report",  "#ef4444")} onClick={() => setActiveTab("report")}>📉 Report Mancato Target</button>
                <button style={tabBtnStyle(activeTab === "config",  "#9b59b6")} onClick={() => setActiveTab("config")}>⚙️ Configurazione</button>
            </div>

            {/* ══════════════════════════ TAB 1: STATO SETTIMANA ══════════════════════════ */}
            {activeTab === "status" && <StatusTab
                machineStatus={machineStatus}
                weeklyTargets={weeklyTargets}
                sapByKey={sapByKey}
                sapByVariant={sapByVariant}
                lastSapByMachine={lastSapByMachine}
                consumedH={consumedH}
                weekStart={weekStart}
                weekEnd={weekEnd}
                cfg={cfg}
                stockOverrides={stockOverrides}
                saveStockOverride={saveStockOverride}
                upstreamMachineConfig={upstreamMachineConfig}
                saveUpstreamMachine={saveUpstreamMachine}
                upstreamPhaseConfig={upstreamPhaseConfig}
                saveUpstreamPhase={saveUpstreamPhase}
                onRefreshOverrides={loadOverrides}
                showToast={showToast}
                cardStyle={cardStyle}
                markCOExecuted={markCOExecuted}
                unmarkCOExecuted={unmarkCOExecuted}
                executedCOs={executedCOs}
            />}

            {/* ══════════════════════════ TAB 2: GANTT ══════════════════════════ */}
            {activeTab === "gantt" && <GanttTab
                sharedMachines={sharedMachines}
                weekStart={weekStart}
                consumedH={consumedH}
                cardStyle={cardStyle}
            />}

            {/* ══════════════════════════ TAB 3: REPORT MANCATO TARGET ══════════════════════════ */}
            {activeTab === "report" && <MancatoTargetTab
                sharedMachines={sharedMachines}
                weeklyTargets={weeklyTargets}
                sapByKey={sapByKey}
                rawConferme={rawConferme}
                weekStart={weekStart}
                weekEnd={weekEnd}
                materialOverrides={materialOverrides}
                showToast={showToast}
                cardStyle={cardStyle}
            />}

            {/* ══════════════════════════ TAB 4: CONFIG ══════════════════════════ */}
            {activeTab === "config" && <ConfigTab
                projectTargets={projectTargets}
                saveProjectTargets={saveProjectTargets}
                changeoverConfig={changeoverConfig}
                setChangeoverConfig={setChangeoverConfig}
                bundleConfig={bundleConfig}
                configSubTab={configSubTab}
                setConfigSubTab={setConfigSubTab}
                sharedMachines={sharedMachines}
                cfg={cfg}
                dbFasi={dbFasi}
                onRefreshFasi={() => supabase.from("componente_fasi")
                    .select("progetto,componente,fase_id,fase_label,pzH,fixedH,chargeSize,noChangeOver")
                    .then(({ data }) => { if (data) setDbFasi(data); })}
                upstreamMachineConfig={upstreamMachineConfig}
                saveUpstreamMachine={saveUpstreamMachine}
                stockOverrides={stockOverrides}
                saveStockOverride={saveStockOverride}
                showToast={showToast}
                cardStyle={cardStyle}
                dct300Orders={dct300Orders}
                saveDct300Orders={saveDct300Orders}
                clearDct300Orders={clearDct300Orders}
                weekStart={weekStart}
            />}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Stato Settimana (dashboard per macchina con raccomandazioni)
// ══════════════════════════════════════════════════════════════════════════════
const LS_DASHBOARD_KEY   = "gantt_dashboard_machines";   // Set<machineId> visibili
const LS_DASHBOARD_COLS  = "gantt_dashboard_cols";

// Definito fuori da StatusTab: referenza stabile → React non smonta/rimonta l'input ad ogni keystroke
function UpstreamEditForm({ machineId, compKey, showReset, editingUpstream, setEditingUpstream, saveUpstreamPhase, saveUpstreamMachine }) {
    if (!editingUpstream || editingUpstream.key !== `${machineId}::${compKey}`) return null;
    const save = () => {
        if (editingUpstream.phaseValue) saveUpstreamPhase(machineId, compKey, editingUpstream.phaseValue);
        saveUpstreamMachine(machineId, compKey, editingUpstream.machineValue || null);
        setEditingUpstream(null);
    };
    return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, paddingLeft: 18, flexWrap: "wrap" }}>
            <select value={editingUpstream.phaseValue || ""}
                onChange={e => setEditingUpstream({ ...editingUpstream, phaseValue: e.target.value })}
                style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12 }}>
                <option value="">— fase —</option>
                {Object.entries(PHASE_LABELS).filter(([id]) => id !== "baa").map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                ))}
            </select>
            <input type="text" value={editingUpstream.machineValue || ""} placeholder="es. STW11002 (opz.)"
                onChange={e => setEditingUpstream({ ...editingUpstream, machineValue: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditingUpstream(null); }}
                style={{ width: 130, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace" }} />
            <button onClick={save}
                style={{ padding: "3px 8px", borderRadius: 4, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Salva</button>
            {showReset && (
                <button onClick={() => { saveUpstreamPhase(machineId, compKey, null); saveUpstreamMachine(machineId, compKey, null); setEditingUpstream(null); }}
                    style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "#ef4444", border: "1px solid #ef444440", cursor: "pointer", fontSize: 11 }}>Reset</button>
            )}
            <button onClick={() => setEditingUpstream(null)}
                style={{ padding: "3px 6px", borderRadius: 4, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 11 }}>✕</button>
        </div>
    );
}

function StatusTab({ machineStatus, weeklyTargets, sapByKey, sapByVariant, lastSapByMachine, consumedH, weekStart, weekEnd, cfg, stockOverrides, saveStockOverride, upstreamMachineConfig, saveUpstreamMachine, upstreamPhaseConfig, saveUpstreamPhase, onRefreshOverrides, showToast, cardStyle, markCOExecuted, unmarkCOExecuted, executedCOs }) {
    const [editMachine,       setEditMachine]       = useState(null); // macchina aperta nel modal
    const [editingStock,      setEditingStock]      = useState(null); // { key, value } override stock upstream
    const [editingUpstream,   setEditingUpstream]   = useState(null); // { key: "machineId::compKey", machineValue: string, phaseValue: string }
    const [highlightedCard,   setHighlightedCard]   = useState(null); // machineId temporaneamente evidenziato

    const [filterPhase,   setFilterPhase]   = useState("all");
    const filterProject = "all";
    const [filterUrgency, setFilterUrgency] = useState("all");
    const cols = 4;

    // Naviga alla card della macchina indicata (scroll + flash highlight).
    // Se la card è filtrata, resetta i filtri e riprova dopo il render.
    const scrollToMachine = useCallback((machineId) => {
        const doScroll = () => {
            const el = document.getElementById(`machine-card-${machineId}`);
            if (!el) return false;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedCard(machineId);
            setTimeout(() => setHighlightedCard(null), 2000);
            return true;
        };
        if (!doScroll()) {
            setFilterPhase("all");
            setFilterUrgency("all");
            setTimeout(doScroll, 80);
        }
    }, [setFilterPhase, setFilterUrgency]);


    const visibleMachines = useMemo(() => machineStatus.filter(m => {
        // filterPhase può essere un phaseId singolo o "label:Saldatura" per gruppi
        if (filterPhase !== "all") {
            if (filterPhase.startsWith("label:")) {
                const lbl = filterPhase.slice(6);
                if ((PHASE_LABELS[m.phase] || m.phase) !== lbl) return false;
            } else {
                if (m.phase !== filterPhase) return false;
            }
        }
        if (filterUrgency === "urgent" && m.changeovers.length === 0) return false;
        if (filterUrgency === "ok"     && m.changeovers.length > 0)  return false;
        if (filterUrgency === "co_3"   && m.urgency !== 3)            return false;
        if (filterUrgency === "co_2"   && m.urgency !== 2)            return false;
        if (filterUrgency === "co_1"   && m.urgency !== 1)            return false;
        if (filterUrgency === "prod_2" && m.prodUrgency < 2)          return false;
        if (filterUrgency === "prod_1" && m.prodUrgency !== 1)        return false;
        if (filterProject !== "all" && !m.items.some(i => i.proj === filterProject)) return false;
        return true;
    }), [machineStatus, filterPhase, filterUrgency, filterProject]);

    // Fasi presenti tra le macchine condivise — raggruppate per label
    // (es. laser_welding + sca_post_deburring + laser_welding_2 → un solo "Saldatura")
    const availablePhases = useMemo(() => {
        const phases = [...new Set(machineStatus.map(m => m.phase))];
        const byLabel = {};
        for (const p of phases) {
            const label = PHASE_LABELS[p] || p;
            const color = PHASE_COLORS[p] || "#888";
            if (!byLabel[label]) byLabel[label] = { filterId: `label:${label}`, label, color, phaseIds: [] };
            byLabel[label].phaseIds.push(p);
        }
        return Object.values(byLabel).sort((a, b) => {
            const minIndexA = Math.min(...a.phaseIds.map(pid => PHASE_FLOW_INDEX[pid] ?? 999));
            const minIndexB = Math.min(...b.phaseIds.map(pid => PHASE_FLOW_INDEX[pid] ?? 999));
            return minIndexA - minIndexB;
        });
    }, [machineStatus]);

    // Progetti presenti
    const availableProjects = useMemo(() => {
        const projs = [...new Set(machineStatus.flatMap(m => m.items.map(i => i.proj)))];
        return projs.sort();
    }, [machineStatus]);

    const urgent   = machineStatus.filter(m => Math.max(m.urgency, m.prodUrgency) >= 2).length;
    const warning  = machineStatus.filter(m => Math.max(m.urgency, m.prodUrgency) === 1).length;
    const ok       = machineStatus.filter(m => Math.max(m.urgency, m.prodUrgency) === 0).length;

    // ── Efficiency Analytics ──
    const efficiencyMetrics = useMemo(() => {
        const expectedPct = consumedH > 0 ? Math.round((consumedH / WEEK_HOURS) * 100) : 0;

        // Metriche per componente
        const componentMetrics = {};
        let totalProduced = 0, totalTarget = 0, totalRemaining = 0;

        for (const m of machineStatus) {
            for (const item of m.itemsWithProgress) {
                if (!item || item.target <= 0) continue;
                const key = item.comp || item.compKey;
                if (!componentMetrics[key]) {
                    componentMetrics[key] = { target: 0, produced: 0, remaining: 0, machines: new Set() };
                }
                componentMetrics[key].target += item.target;
                componentMetrics[key].produced += item.produced;
                componentMetrics[key].remaining += item.remaining;
                componentMetrics[key].machines.add(m.machineId);

                totalTarget += item.target;
                totalProduced += item.produced;
                totalRemaining += item.remaining;
            }
        }

        // Calcolo varianze
        const componentStats = Object.entries(componentMetrics).map(([comp, data]) => ({
            comp,
            pctDone: data.target > 0 ? Math.round((data.produced / data.target) * 100) : 0,
            variance: data.target > 0 ? Math.round((data.produced / data.target) * 100) - expectedPct : 0,
            produced: data.produced,
            target: data.target,
            remaining: data.remaining,
            machines: data.machines.size,
        })).sort((a, b) => a.variance - b.variance);

        // Utilizzo macchine
        const machineUtil = machineStatus.map(m => ({
            machineId: m.machineId,
            phase: m.phaseLabel,
            hoursUsed: consumedH,
            hoursAvailable: WEEK_HOURS,
            utilization: Math.round((consumedH / WEEK_HOURS) * 100),
            itemsProduced: m.itemsWithProgress.reduce((s, i) => s + i.produced, 0),
            itemsTarget: m.itemsWithProgress.reduce((s, i) => s + i.target, 0),
            changeovers: m.nextCO ? m.nextCO.at - (m.currentBlock?.endH || 0) : 0,
        }));

        // Stima completion
        const avgDailyRate = consumedH > 0 ? totalProduced / (consumedH / 24) : 0;
        const daysToComplete = avgDailyRate > 0 ? totalRemaining / avgDailyRate : 999;

        // Calcola data stima completamento
        let projectedDate = new Date(weekStart + 'T12:00:00Z');
        projectedDate.setDate(projectedDate.getDate() + Math.ceil(daysToComplete));
        const projectedCompletionDay = getLocalDate(projectedDate);

        return {
            expectedPct,
            totalProduced,
            totalTarget,
            totalRemaining,
            overallEfficiency: totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : 0,
            variance: totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) - expectedPct : 0,
            componentStats,
            machineUtil,
            avgDailyRate: Math.round(avgDailyRate),
            projectedCompletionDay,
            onTrack: daysToComplete <= 6,
        };
    }, [machineStatus, consumedH, weekStart]);

    // ── Smart Inventory Alerts ──
    // Identifica componenti critici per stock: quelli che sono >75% completati e con pezzi rimasti < 2 giorni di produzione
    const inventoryAlerts = useMemo(() => {
        const alerts = [];
        for (const m of machineStatus) {
            for (const item of m.itemsWithProgress) {
                if (!item || item.target <= 0) continue;
                const pctDone = (item.produced / item.target) * 100;
                const daysRemaining = item.remaining > 0 && item.jph > 0 ? (item.remaining / item.jph) / 24 : 0;

                // Alert se: >75% fatto E rimangono <2 giorni di lavoro (stock sottodimensionato)
                if (pctDone >= 75 && daysRemaining < 2 && daysRemaining > 0) {
                    alerts.push({
                        machineId: m.machineId,
                        compKey: item.compKey,
                        label: item.label,
                        remaining: item.remaining,
                        pctDone: Math.round(pctDone),
                        daysLeft: daysRemaining,
                        urgency: daysRemaining < 1 ? 2 : 1,  // critical if <1 day
                    });
                }
            }
        }
        return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
    }, [machineStatus]);

    const urgencyStyle = (u, pu) => {
        const combined = Math.max(u, pu);
        if (combined >= 3) return { border: "2px solid #ef4444", background: "#ef444408" };
        if (combined === 2) return { border: "2px solid #f97316", background: "#f9731608" };
        if (combined === 1) return { border: "2px solid #f59e0b", background: "#f59e0b08" };
        return { border: "1px solid var(--border)", background: "var(--bg-secondary)" };
    };
    // Badge changeover — cliccabili per filtrare per tipo urgenza
    const badgeBtn = (filterId, bg, color, label) => {
        const active = filterUrgency === filterId;
        return (
            <button
                onClick={() => setFilterUrgency(active ? "all" : filterId)}
                title={active ? "Rimuovi filtro" : `Filtra per: ${label}`}
                style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                    background: active ? color : bg, color: active ? "#fff" : color,
                    border: `1px solid ${color}`, cursor: "pointer",
                    outline: active ? `2px solid ${color}` : "none", outlineOffset: 1 }}>
                {label}
            </button>
        );
    };
    const coLabel = (u) => {
        if (u === 3) return badgeBtn("co_3", "#ef444420", "#ef4444", "🔴 CO IN RITARDO");
        if (u === 2) return badgeBtn("co_2", "#f9731620", "#f97316", "🟠 CO ENTRO 6h");
        if (u === 1) return badgeBtn("co_1", "#f59e0b20", "#f59e0b", "🟡 CO OGGI");
        return null;
    };
    const prodLabel = (pu) => {
        if (pu >= 2) return badgeBtn("prod_2", "#ef444420", "#ef4444", "📉 IN RITARDO");
        if (pu === 1) return badgeBtn("prod_1", "#f59e0b20", "#f59e0b", "📉 SOTTO RITMO");
        return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#10b98120", color: "#10b981", fontWeight: 700 }}>🟢 OK</span>;
    };

    const chipStyle = (active, color) => ({
        padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400,
        border: `1px solid ${active ? (color || "var(--accent)") : "var(--border)"}`,
        background: active ? (color ? color + "22" : "var(--accent-dim)") : "var(--bg-secondary)",
        color: active ? (color || "var(--accent)") : "var(--text-secondary)",
        whiteSpace: "nowrap",
    });

    return (
        <>
            {/* ── Barra filtri ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                {/* Filtro urgenza */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginRight: 2 }}>STATO</span>
                    {[
                        { id: "all",    label: "Tutte" },
                        { id: "urgent", label: "🔔 Con CO" },
                        { id: "ok",     label: "🟢 Senza CO" },
                    ].map(f => (
                        <button key={f.id} style={chipStyle(filterUrgency === f.id)} onClick={() => setFilterUrgency(f.id)}>{f.label}</button>
                    ))}
                    {/* Badge-filter attivo da click su card — mostra etichetta + X per rimuovere */}
                    {["co_3","co_2","co_1","prod_2","prod_1"].includes(filterUrgency) && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20,
                            background: "var(--accent-dim)", border: "1px solid var(--accent)", fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>
                            {{ co_3:"🔴 CO IN RITARDO", co_2:"🟠 CO ENTRO 6h", co_1:"🟡 CO OGGI", prod_2:"📉 IN RITARDO", prod_1:"📉 SOTTO RITMO" }[filterUrgency]}
                            <button onClick={() => setFilterUrgency("all")}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                        </span>
                    )}
                </div>

                <div style={{ width: 1, height: 20, background: "var(--border)" }} />

                {/* Filtro fase */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginRight: 2 }}>FASE</span>
                    <button style={chipStyle(filterPhase === "all")} onClick={() => setFilterPhase("all")}>Tutte</button>
                    {availablePhases.map(p => (
                        <button key={p.filterId} style={chipStyle(filterPhase === p.filterId, p.color)} onClick={() => setFilterPhase(filterPhase === p.filterId ? "all" : p.filterId)}>
                            {p.label}
                        </button>
                    ))}
                </div>

            </div>


            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                    { label: "Macchine condivise", value: machineStatus.length, color: "var(--text-primary)" },
                    { label: "🔴 Urgenti / 🟠",    value: urgent,  color: urgent  > 0 ? "#ef4444" : "#10b981" },
                    { label: "🟡 Attenzione oggi", value: warning, color: warning > 0 ? "#f59e0b" : "#10b981" },
                    { label: "🟢 In regola",        value: ok,      color: "#10b981" },
                ].map(c => (
                    <div key={c.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* ── Predictive Bottleneck Alerts ── */}
            {(() => {
                const criticalBottlenecks = machineStatus.filter(m => m.bottleneckRisk === 2);
                const warningBottlenecks = machineStatus.filter(m => m.bottleneckRisk === 1);

                if (criticalBottlenecks.length === 0 && warningBottlenecks.length === 0) return null;

                return (
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px", marginBottom: 20 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
                            ⚠️ Predictive Bottleneck Detection
                        </div>

                        {criticalBottlenecks.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>
                                    🔴 CRITICO — Rischio di blocco produzione
                                </div>
                                {criticalBottlenecks.map(m => (
                                    <div key={m.machineId} style={{ fontSize: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, marginBottom: 6, cursor: "pointer" }} onClick={() => scrollToMachine(m.machineId)}>
                                        <strong>{m.machineId}</strong> ({m.phaseLabel}) — scadenza in &lt;2 giorni
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            Lavoro rimanente: {m.itemsWithProgress.reduce((s, i) => s + i.remaining, 0).toLocaleString("it-IT")} pz
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {warningBottlenecks.length > 0 && (
                            <div>
                                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 6 }}>
                                    🟡 ATTENZIONE — Potenziale collo di bottiglia
                                </div>
                                {warningBottlenecks.map(m => (
                                    <div key={m.machineId} style={{ fontSize: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, marginBottom: 6, cursor: "pointer" }} onClick={() => scrollToMachine(m.machineId)}>
                                        <strong>{m.machineId}</strong> ({m.phaseLabel}) — scadenza in 2-3 giorni
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            Ritmo: {(Math.min(...m.itemsWithProgress.filter(i => i.target > 0).map(i => (i.produced / i.target) * 100)) || 0).toFixed(0)}% del target
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Smart Inventory Alerts ── */}
            {(() => {
                const criticalInv = inventoryAlerts.filter(a => a.urgency === 2);
                const warningInv = inventoryAlerts.filter(a => a.urgency === 1);

                if (inventoryAlerts.length === 0) return null;

                return (
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px", marginBottom: 20 }}>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
                                📦 Smart Inventory Alerts
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                Identifica componenti prossimi alla fine stock. Quando un componente è al 75%+ della produzione settimanale ma rimangono &lt;2 giorni di materiale, significa che il ritmo di produzione supera l'arrivo di nuovo materiale. Pianifica il rifornimento per evitare fermi macchina.
                            </div>
                        </div>

                        {criticalInv.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>
                                    🔴 STOCK CRITICO — Rimane &lt;1 giorno di produzione
                                </div>
                                {criticalInv.map((alert, i) => (
                                    <div key={i} style={{ fontSize: 12, padding: "8px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, marginBottom: 6, cursor: "pointer" }} onClick={() => scrollToMachine(alert.machineId)}>
                                        <strong>{alert.label}</strong> — {alert.pctDone}% completato
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            Rimangono {alert.remaining.toLocaleString("it-IT")} pz (~{alert.daysLeft.toFixed(1)} giorni)
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {warningInv.length > 0 && (
                            <div>
                                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, marginBottom: 6 }}>
                                    🟡 ATTENZIONE STOCK — Rimane 1-2 giorni di produzione
                                </div>
                                {warningInv.map((alert, i) => (
                                    <div key={i} style={{ fontSize: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, marginBottom: 6, cursor: "pointer" }} onClick={() => scrollToMachine(alert.machineId)}>
                                        <strong>{alert.label}</strong> — {alert.pctDone}% completato
                                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                            Rimangono {alert.remaining.toLocaleString("it-IT")} pz (~{alert.daysLeft.toFixed(1)} giorni)
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Efficiency Analytics Dashboard ── */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px", marginBottom: 20 }}>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
                        📊 Efficiency Analytics
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Monitora il ritmo di produzione complessivo rispetto al piano settimanale. Mostra se sei in linea col calendario, il ritmo giornaliero medio, la data stima di completamento, e identifica componenti che corrono avanti (verde) o in ritardo (rosso) rispetto al ritmo atteso.
                    </div>
                </div>

                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Efficienza Globale</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: efficiencyMetrics.variance >= 0 ? "#10b981" : "#ef4444" }}>
                            {efficiencyMetrics.overallEfficiency}%
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                            {efficiencyMetrics.variance >= 0 ? "+" : ""}{efficiencyMetrics.variance}% vs piano
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Ritmo Giornaliero</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#3c6ef0" }}>
                            {efficiencyMetrics.avgDailyRate.toLocaleString("it-IT")}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>pz/giorno</div>
                    </div>

                    <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Completamento</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: efficiencyMetrics.onTrack ? "#10b981" : "#f59e0b" }}>
                            {efficiencyMetrics.projectedCompletionDay}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                            {efficiencyMetrics.onTrack ? "✅ In tempo" : "⚠️ A rischio"}
                        </div>
                    </div>

                    <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Rimangono</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>
                            {efficiencyMetrics.totalRemaining.toLocaleString("it-IT")}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>pz rimanenti</div>
                    </div>
                </div>

                {/* Componenti variance */}
                <div>
                    <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: "var(--text-primary)" }}>
                            Varianza Componenti
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            Confronta il progresso di ogni componente col ritmo atteso settimanale ({efficiencyMetrics.expectedPct}%). Verde = avanti, Rosso = indietro. Aiuta a identificare quali componenti stanno rallentando l'intera linea.
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                        {efficiencyMetrics.componentStats.slice(0, 6).map(c => (
                            <div key={c.comp} style={{ padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, borderLeft: `3px solid ${c.variance >= 0 ? "#10b981" : c.variance >= -10 ? "#f59e0b" : "#ef4444"}` }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.comp}</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                                    {c.pctDone}% completato ({c.produced}/{c.target})
                                </div>
                                <div style={{ fontSize: 11, color: c.variance >= 0 ? "#10b981" : "#ef4444" }}>
                                    {c.variance >= 0 ? "+" : ""}{c.variance}% vs piano
                                </div>
                            </div>
                        ))}
                    </div>
                    {efficiencyMetrics.componentStats.length > 6 && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, textAlign: "center" }}>
                            +{efficiencyMetrics.componentStats.length - 6} componenti
                        </div>
                    )}
                </div>
            </div>

            {machineStatus.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    Nessuna macchina condivisa trovata — verifica <code>macchina_id</code> in <code>material_fino_overrides</code>.
                </div>
            )}

            {visibleMachines.length === 0 && machineStatus.length > 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10 }}>
                    Nessuna macchina corrisponde ai filtri selezionati.
                </div>
            )}

            {/* Machine cards — ordinati per urgenza */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18 }}>
            {visibleMachines.map(machine => (
                <div key={machine.machineId} id={`machine-card-${machine.machineId}`} style={{ ...urgencyStyle(machine.urgency, machine.prodUrgency), borderRadius: 12, overflow: "hidden", outline: highlightedCard === machine.machineId ? "3px solid var(--accent)" : "none", transition: "outline 0.3s" }}>

                    {/* Header macchina */}
                    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 17, color: "var(--text-primary)" }}>{machine.machineId}</span>
                        <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 5, background: machine.phaseColor + "22", color: machine.phaseColor, fontWeight: 600 }}>
                            {machine.phaseLabel}
                        </span>
                        {coLabel(machine.urgency)}
                        {prodLabel(machine.prodUrgency)}
                        <div style={{ flex: 1 }} />
                        {/* Ultima conferma SAP reale per questa macchina */}
                        {lastSapByMachine[machine.machineId] ? (
                            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                Ultima SAP:{" "}
                                <strong style={{ color: lastSapByMachine[machine.machineId].color }}>
                                    {lastSapByMachine[machine.machineId].shortLabel}
                                </strong>
                                {" "}
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                    {fmtDate(lastSapByMachine[machine.machineId].date)}
                                </span>
                            </span>
                        ) : (
                            <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                                Nessuna conferma SAP
                            </span>
                        )}
                    </div>

                    {/* Raccomandazione automatica — sempre visibile */}
                    {(() => {
                        const hasOverdue = machine.overdueCOs.length > 0;
                        const hasNext    = !!machine.nextCO;
                        const bgColor    = machine.urgency >= 3 ? "rgba(239,68,68,0.06)"
                                         : machine.urgency === 2 ? "rgba(249,115,22,0.06)"
                                         : machine.urgency === 1 ? "rgba(245,158,11,0.06)"
                                         : "transparent";

                        // Priorità "componente attuale": CO eseguito manualmente > SAP > piano
                        const lastSap  = lastSapByMachine[machine.machineId];
                        const curBlock = machine.currentBlock;
                        const curItem  =
                            (curBlock && machine.itemsWithProgress.find(i => i.compKey === curBlock.compKey)) ||
                            machine.itemsWithProgress[0];
                        const lastExec = machine.lastExecutedCO;
                        const nowLabel = lastExec?.toLabel  || lastSap?.shortLabel || curItem?.shortLabel;
                        const nowColor = lastExec?.toColor  || lastSap?.color      || curItem?.color;

                        return (
                            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: bgColor }}>

                                {/* Changeover già scaduti → azione immediata */}
                                {machine.overdueCOs.map((co, i) => {
                                    const hoursOverdue = consumedH - co.at;
                                    const fromLabel = i === 0 ? nowLabel : machine.overdueCOs[i - 1].toLabel;
                                    const fromColor = i === 0 ? nowColor : machine.overdueCOs[i - 1].toColor;
                                    return (
                                        <div key={i} style={{ marginBottom: hasNext ? 6 : 0 }}>
                                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                                <span style={{ fontSize: 15, flexShrink: 0 }}>🚨</span>
                                                <div style={{ fontSize: 13, flex: 1 }}>
                                                    <strong style={{ color: "#ef4444" }}>
                                                        Adesso —{fromLabel && <>{" "}<span style={{ color: fromColor }}>● {fromLabel}</span> →</>}{" "}
                                                        <span style={{ color: co.toColor }}>● {co.toLabel}</span>
                                                    </strong>
                                                    {hoursOverdue > 2 && (
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                                                            (era previsto {co.datetime})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Bottone conferma CO eseguito */}
                                            <div style={{ paddingLeft: 22, marginTop: 5 }}>
                                                <button
                                                    onClick={() => markCOExecuted(machine.machineId, co)}
                                                    style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #10b98140", background: "#10b98115", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                                                    ✅ CO eseguito — ora su ● {co.toLabel}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Prossimo changeover futuro */}
                                {hasNext && (() => {
                                    const hoursLeft  = machine.nextCO.at - consumedH;
                                    const hRound     = hoursLeft < 1 ? "<1" : Math.round(hoursLeft);
                                    const isImminent = machine.urgency >= 2 && !hasOverdue;
                                    // "da" component: last overdue CO target (if overdue), or SAP current (if imminent)
                                    const lastOverdue = machine.overdueCOs[machine.overdueCOs.length - 1];
                                    const fromLabel   = hasOverdue ? lastOverdue?.toLabel : nowLabel;
                                    const fromColor   = hasOverdue ? lastOverdue?.toColor : nowColor;
                                    return (
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                            <span style={{ fontSize: 15, flexShrink: 0 }}>
                                                {isImminent ? "⚠️" : hasOverdue ? "↳" : "📋"}
                                            </span>
                                            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                                                {hasOverdue ? (
                                                    <>
                                                        <span style={{ color: "var(--text-muted)" }}>Poi — </span>
                                                        <strong>{machine.nextCO.datetime}</strong>:{" "}
                                                        {fromLabel && <><span style={{ color: fromColor, fontWeight: 600 }}>● {fromLabel}</span> → </>}
                                                        <span style={{ color: machine.nextCO.toColor, fontWeight: 700 }}>● {machine.nextCO.toLabel}</span>
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(tra {hRound}h)</span>
                                                    </>
                                                ) : isImminent ? (
                                                    <>
                                                        <strong>Adesso —{fromLabel && <>{" "}<span style={{ color: fromColor }}>● {fromLabel}</span> →</>}{" "}</strong>
                                                        <span style={{ color: machine.nextCO.toColor, fontWeight: 700 }}>● {machine.nextCO.toLabel}</span>
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>({machine.nextCO.datetime}, tra {hRound}h)</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span style={{ color: "var(--text-muted)" }}>Prossimo CO — </span>
                                                        <strong>{machine.nextCO.datetime}</strong>:{" "}
                                                        {fromLabel && <><span style={{ color: fromColor, fontWeight: 600 }}>● {fromLabel}</span> → </>}
                                                        <span style={{ color: machine.nextCO.toColor, fontWeight: 700 }}>● {machine.nextCO.toLabel}</span>
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(tra {hRound}h)</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Nessun changeover → mostra componente attuale oppure changeover consigliato */}
                                {!hasOverdue && !hasNext && nowLabel && (() => {
                                    // Calcola urgency relativa nel rendering (dove ho tutte le info)
                                    const nowItem = machine.itemsWithProgress.find(i => i.shortLabel === nowLabel) || machine.itemsWithProgress[0];
                                    let recommendedItem = null;
                                    let urgencyDelta = 0;

                                    if (nowItem && machine.itemsWithProgress.length > 1) {
                                        const nowUrgency = nowItem.target > 0 ? (nowItem.target - nowItem.produced) / nowItem.target : 0;
                                        let maxDelta = 0;

                                        for (const item of machine.itemsWithProgress) {
                                            if (item.compKey === nowItem.compKey || item.target <= 0) continue;
                                            const itemUrgency = (item.target - item.produced) / item.target;
                                            const delta = itemUrgency - nowUrgency;
                                            if (delta > maxDelta && delta > 0.15) {
                                                maxDelta = delta;
                                                recommendedItem = item;
                                                urgencyDelta = maxDelta;
                                            }
                                        }
                                    }

                                    return (
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                            <span style={{ fontSize: 15, flexShrink: 0 }}>{recommendedItem ? "⚠️" : "✅"}</span>
                                            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                                                {recommendedItem ? (
                                                    // Smart Changeover Recommendation
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                                        <div>
                                                            <span>Considera changeover a </span>
                                                            <span style={{ color: recommendedItem.color, fontWeight: 700 }}>● {recommendedItem.shortLabel}</span>
                                                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                                                                (+{(urgencyDelta * 100).toFixed(0)}% più urgente)
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                            {recommendedItem.target - recommendedItem.produced} pz indietro vs {nowItem.target - nowItem.produced} su <span style={{ color: nowColor, fontWeight: 600 }}>● {nowLabel}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Continua con quello attuale
                                                    <>
                                                        Adesso — continua con{" "}
                                                        <span style={{ color: nowColor, fontWeight: 700 }}>● {nowLabel}</span>
                                                        {lastExec
                                                            ? <button onClick={() => unmarkCOExecuted(machine.machineId, lastExec)}
                                                                title="Annulla conferma CO"
                                                                style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 10 }}>
                                                                ↩ annulla CO
                                                              </button>
                                                            : <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>nessun changeover previsto</span>
                                                        }
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}

                    {/* Avanzamento per componente */}
                    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                        {machine.itemsWithProgress.map(item => {
                            const pct = item.pct;
                            const barColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
                            const expectedPct = Math.round((consumedH / WEEK_HOURS) * 100);
                            const delta = pct - expectedPct;

                            return (
                                <div key={item.compKey} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {/* Label + delta */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{item.shortLabel}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                            <span style={{ color: "#10b981", fontWeight: 700 }}>{item.produced.toLocaleString("it-IT")}</span>
                                            <span style={{ color: "var(--text-muted)" }}>/ {item.target.toLocaleString("it-IT")}</span>
                                            {item.target > 0 && consumedH > 6 && (
                                                <span style={{ fontWeight: 700, fontSize: 12, color: delta >= 0 ? "#10b981" : "#ef4444" }}>
                                                    ({delta >= 0 ? "+" : ""}{delta}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Vincolo upstream + config macchina precedente (Op10) */}
                                    {item.upstreamPhaseId && (() => {
                                        const overrideKey       = `${item.compKey}::${item.upstreamPhaseId}`;
                                        const upstreamMachineKey = `${machine.machineId}::${item.compKey}`;
                                        const configuredMachine  = (upstreamMachineConfig || {})[upstreamMachineKey] || item.upstreamMachineId;
                                        const isEditingStock     = editingStock?.key === overrideKey;
                                        const isEditingMachine   = editingUpstream?.key === upstreamMachineKey;
                                        const showBlock = item.upstreamConstrained || item.isManualOverride || !!configuredMachine;
                                        if (!showBlock) return (
                                            // Nessun dato upstream: mostra bottone per configurare fase + macchina
                                            !(MACHINES_NO_FLOW_CONFIG.has(machine.machineId) || PHASES_NO_FLOW_CONFIG.has(machine.phase)) && (
                                            <div style={{ marginTop: 2 }}>
                                                {!isEditingMachine
                                                    ? <button onClick={() => setEditingUpstream({ key: upstreamMachineKey, machineValue: configuredMachine || "", phaseValue: item.upstreamPhaseId || "" })}
                                                        style={{ padding: "1px 7px", borderRadius: 3, border: "1px solid var(--accent-dim)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontSize: 10 }}>
                                                        + configura flusso
                                                      </button>
                                                    : <UpstreamEditForm machineId={machine.machineId} compKey={item.compKey} showReset={false} editingUpstream={editingUpstream} setEditingUpstream={setEditingUpstream} saveUpstreamPhase={saveUpstreamPhase} saveUpstreamMachine={saveUpstreamMachine} />
                                                }
                                            </div>
                                            )
                                        );
                                        return (
                                            <div style={{ marginTop: -2 }}>
                                                <div style={{ fontSize: 11, color: item.isManualOverride ? "#9b59b6" : "#f59e0b", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                                    <span>{item.isManualOverride ? "✏️" : "⚠️"}</span>
                                                    <span>
                                                        Attende{" "}
                                                        <strong>{(item.availableFromUpstream ?? 0).toLocaleString("it-IT")} pz</strong>
                                                        {" "}da{" "}
                                                        {configuredMachine
                                                            ? <><button
                                                                    onClick={() => scrollToMachine(configuredMachine)}
                                                                    title={`Vai alla card ${configuredMachine}`}
                                                                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, color: "var(--accent)", fontSize: 11, textDecoration: "underline dotted", fontFamily: "monospace" }}>
                                                                    {configuredMachine}
                                                                </button>
                                                                <span style={{ color: "var(--text-muted)", marginLeft: 3 }}>({PHASE_LABELS[item.upstreamPhaseId] || item.upstreamPhaseId})</span>
                                                                {/* Bottone modifica fase + macchina upstream */}
                                                                <button onClick={() => setEditingUpstream(isEditingMachine ? null : { key: upstreamMachineKey, machineValue: configuredMachine || "", phaseValue: item.upstreamPhaseId || "" })}
                                                                    style={{ marginLeft: 3, padding: "0px 4px", borderRadius: 3, border: "1px solid var(--border)", background: isEditingMachine ? "var(--accent)" : "var(--bg-tertiary)", color: isEditingMachine ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: 9 }}>
                                                                    ✏️
                                                                </button>
                                                              </>
                                                            : <><strong>{PHASE_LABELS[item.upstreamPhaseId] || item.upstreamPhaseId}</strong>
                                                                <button onClick={() => setEditingUpstream(isEditingMachine ? null : { key: upstreamMachineKey, machineValue: "", phaseValue: item.upstreamPhaseId || "" })}
                                                                    style={{ marginLeft: 4, padding: "0px 5px", borderRadius: 3, border: "1px solid var(--accent-dim)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontSize: 9 }}>
                                                                    + macchina
                                                                </button>
                                                              </>
                                                        }
                                                        {" "}— pianificabili{" "}
                                                        <strong>{item.remaining.toLocaleString("it-IT")} pz</strong>
                                                    </span>
                                                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3,
                                                        background: item.isManualOverride ? "#9b59b620" : "rgba(255,255,255,0.08)",
                                                        color: item.isManualOverride ? "#9b59b6" : "var(--text-muted)" }}>
                                                        {item.isManualOverride ? "manuale" : "SAP"}
                                                    </span>
                                                    {/* Bottone modifica stock */}
                                                    <button onClick={() => setEditingStock(isEditingStock ? null : { key: overrideKey, value: item.upstreamProduced || 0 })}
                                                        style={{ padding: "1px 6px", borderRadius: 3, border: "1px solid var(--border)",
                                                            background: isEditingStock ? "var(--accent)" : "var(--bg-tertiary)",
                                                            color: isEditingStock ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 10 }}>
                                                        📦
                                                    </button>
                                                </div>
                                                {/* Form inline modifica fase + macchina upstream */}
                                                <UpstreamEditForm
                                                    machineId={machine.machineId}
                                                    compKey={item.compKey}
                                                    showReset={!!(upstreamMachineConfig||{})[upstreamMachineKey] || !!(upstreamPhaseConfig||{})[upstreamMachineKey]}
                                                    editingUpstream={editingUpstream}
                                                    setEditingUpstream={setEditingUpstream}
                                                    saveUpstreamPhase={saveUpstreamPhase}
                                                    saveUpstreamMachine={saveUpstreamMachine}
                                                />
                                                {/* Form inline override stock */}
                                                {isEditingStock && (
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, paddingLeft: 18 }}>
                                                        <input type="number" min="0"
                                                            value={editingStock.value}
                                                            onChange={e => setEditingStock({ ...editingStock, value: e.target.value })}
                                                            style={{ width: 90, padding: "3px 6px", borderRadius: 4,
                                                                border: "1px solid var(--accent)", background: "var(--bg-primary)",
                                                                color: "var(--text-primary)", fontSize: 12 }}
                                                            autoFocus={!isEditingMachine}
                                                        />
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>pz</span>
                                                        <button onClick={() => { saveStockOverride(overrideKey, +editingStock.value); setEditingStock(null); }}
                                                            style={{ padding: "3px 8px", borderRadius: 4, background: "var(--accent)", color: "#fff",
                                                                border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                                                            Salva
                                                        </button>
                                                        {overrideKey in (stockOverrides || {}) && (
                                                            <button onClick={() => { saveStockOverride(overrideKey, undefined); setEditingStock(null); }}
                                                                style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "#ef4444",
                                                                    border: "1px solid #ef444440", cursor: "pointer", fontSize: 11 }}>
                                                                Reset SAP
                                                            </button>
                                                        )}
                                                        <button onClick={() => setEditingStock(null)}
                                                            style={{ padding: "3px 6px", borderRadius: 4, background: "transparent",
                                                                color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 11 }}>
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {/* Grezzo disponibile (prima fase — nessun upstream automatico) */}
                                    {!item.upstreamPhaseId && (() => {
                                        const gk = `${item.compKey}::grezzo`;
                                        const isEditingG = editingStock?.key === gk;
                                        const gs = item.grezzoStock;
                                        const available = gs !== null ? Math.max(0, gs - item.produced) : null;
                                        return (
                                            <div style={{ marginTop: 2 }}>
                                                {gs !== null ? (
                                                    <div style={{ fontSize: 11, color: "#9b59b6", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                                                        <span>📦</span>
                                                        <span>
                                                            Grezzo{" "}
                                                            <strong>{gs.toLocaleString("it-IT")} pz</strong>
                                                            {" "}disponibili —{" "}
                                                            pianificabili{" "}
                                                            <strong>{item.remaining.toLocaleString("it-IT")} pz</strong>
                                                            {available < Math.max(0, item.target - item.produced) && (
                                                                <span style={{ color: "#f59e0b", marginLeft: 4 }}>⚠️ limitante</span>
                                                            )}
                                                        </span>
                                                        <button onClick={() => setEditingStock(isEditingG ? null : { key: gk, value: gs })}
                                                            style={{ padding: "1px 6px", borderRadius: 3, border: "1px solid var(--border)",
                                                                background: isEditingG ? "var(--accent)" : "var(--bg-tertiary)",
                                                                color: isEditingG ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 10 }}>
                                                            ✏️
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                        <button onClick={() => setEditingStock(isEditingG ? null : { key: gk, value: 0 })}
                                                            style={{ padding: "1px 7px", borderRadius: 3, border: "1px solid #9b59b640", background: "#9b59b610", color: "#9b59b6", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>
                                                            📦 Inserisci grezzo
                                                        </button>
                                                        {!(MACHINES_NO_FLOW_CONFIG.has(machine.machineId) || PHASES_NO_FLOW_CONFIG.has(machine.phase)) && (
                                                        <button onClick={() => setEditingUpstream({ key: `${machine.machineId}::${item.compKey}`, machineValue: "", phaseValue: "" })}
                                                            style={{ padding: "1px 7px", borderRadius: 3, border: "1px solid var(--accent-dim)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontSize: 10 }}>
                                                            🔗 configura flusso
                                                        </button>
                                                        )}
                                                    </div>
                                                )}
                                                <UpstreamEditForm machineId={machine.machineId} compKey={item.compKey} showReset={false} editingUpstream={editingUpstream} setEditingUpstream={setEditingUpstream} saveUpstreamPhase={saveUpstreamPhase} saveUpstreamMachine={saveUpstreamMachine} />
                                                {isEditingG && (
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 5, paddingLeft: 18 }}>
                                                        <input type="number" min="0" value={editingStock.value} autoFocus
                                                            onChange={e => setEditingStock({ ...editingStock, value: e.target.value })}
                                                            onKeyDown={e => {
                                                                if (e.key === "Enter") { saveStockOverride(gk, +editingStock.value); setEditingStock(null); }
                                                                if (e.key === "Escape") setEditingStock(null);
                                                            }}
                                                            style={{ width: 100, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 12 }} />
                                                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>pz</span>
                                                        <button onClick={() => { saveStockOverride(gk, +editingStock.value); setEditingStock(null); }}
                                                            style={{ padding: "3px 8px", borderRadius: 4, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                                                            Salva
                                                        </button>
                                                        {gk in (stockOverrides || {}) && (
                                                            <button onClick={() => { saveStockOverride(gk, undefined); setEditingStock(null); }}
                                                                style={{ padding: "3px 8px", borderRadius: 4, background: "transparent", color: "#ef4444", border: "1px solid #ef444440", cursor: "pointer", fontSize: 11 }}>
                                                                Rimuovi
                                                            </button>
                                                        )}
                                                        <button onClick={() => setEditingStock(null)}
                                                            style={{ padding: "3px 6px", borderRadius: 4, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 11 }}>
                                                            ✕
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    {/* Progress bar */}
                                    <div style={{ position: "relative", height: 20, background: "var(--bg-tertiary)", borderRadius: 4, overflow: "hidden" }}>
                                        <div style={{ position: "absolute", left: `${expectedPct}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,0.35)", zIndex: 2 }} title={`Atteso: ${expectedPct}%`} />
                                        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 5, transition: "width 0.3s" }}>
                                            {pct > 10 && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{pct}%</span>}
                                        </div>
                                    </div>

                                    {/* Varianti 1A / 21A per componenti DCT300 */}
                                    {["1A", "21A"].map(v => {
                                        if (!sapByVariant) return null;
                                        const phases = item.relevantPhases || [machine.phase];
                                        // Mostra la riga solo se esiste almeno una chiave variante in sapByVariant
                                        const hasVariantData = phases.some(p => `${item.compKey}::${v}::${p}` in sapByVariant);
                                        if (!hasVariantData) return null;
                                        // Somma produzione variante su tutte le fasi rilevanti
                                        const varProd = phases.reduce((s, p) => s + (sapByVariant[`${item.compKey}::${v}::${p}`] || 0), 0);
                                        // Target per variante = target totale / 2 (le due varianti sono metà ciascuna)
                                        const varTarget = item.target > 0 ? item.target / 2 : 0;
                                        const varPct = varTarget > 0 ? Math.min(Math.round((varProd / varTarget) * 100), 100) : 0;
                                        const varColor = varPct >= 80 ? "#10b981" : varPct >= 50 ? "#f59e0b" : "#ef4444";
                                        return (
                                            <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 18, marginTop: 2 }}>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 26 }}>└ <span style={{ fontWeight: 600 }}>{v}</span></span>
                                                <div style={{ flex: 1, position: "relative", height: 10, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                                                    <div style={{ width: `${varPct}%`, height: "100%", background: varColor, borderRadius: 3, opacity: 0.75 }} />
                                                </div>
                                                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70, textAlign: "right" }}>
                                                    {varProd.toLocaleString("it-IT")} pz
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            </div>

            {/* ── Modal modifica componenti macchina ── */}
            {editMachine && (
                <MachineEditModal
                    machine={editMachine}
                    cfg={cfg}
                    onRefresh={() => { onRefreshOverrides(); setEditMachine(null); }}
                    onClose={() => setEditMachine(null)}
                    showToast={showToast}
                />
            )}
        </>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Modal — Modifica componenti su una macchina
// ══════════════════════════════════════════════════════════════════════════════
function MachineEditModal({ machine, cfg, onRefresh, onClose, showToast }) {
    const [saving, setSaving] = useState(false);
    const [addProj, setAddProj] = useState(PROJECTS[0]);
    const [addComp, setAddComp] = useState("");

    // Componenti disponibili per il progetto selezionato
    const availableComps = useMemo(() => {
        return Object.keys(cfg.components)
            .filter(k => k.startsWith(addProj + "::"))
            .map(k => k.split("::")[1])
            .sort();
    }, [cfg, addProj]);

    // Componenti già presenti su questa macchina
    const currentItems = machine.items;

    const handleAdd = async () => {
        if (!addComp) return;
        const compKey = `${addProj}::${addComp}`;
        if (currentItems.some(i => i.compKey === compKey)) {
            showToast?.("⚠️ Componente già presente su questa macchina", "info");
            return;
        }
        setSaving(true);
        try {
            // Trova le righe di material_fino_overrides per questo comp+proj+fase senza macchina_id
            // Normalizza il progetto per il DB (potrebbe avere formato diverso)
            const { data: rows, error: fetchErr } = await supabase
                .from("material_fino_overrides")
                .select("id,componente,progetto,fase,macchina_id")
                .ilike("componente", addComp)
                .eq("fase", machine.phase);

            if (fetchErr) throw fetchErr;

            // Filtra per progetto (il DB potrebbe avere "DCT 300" invece di "DCT300" ecc.)
            const toUpdate = (rows || []).filter(r => normProj(r.progetto) === addProj);

            if (!toUpdate.length) {
                showToast?.(`⚠️ Nessuna riga trovata per ${addComp} · ${addProj} · ${machine.phaseLabel} in material_fino_overrides`, "info");
                setSaving(false);
                return;
            }

            const ids = toUpdate.map(r => r.id);
            const { error } = await supabase
                .from("material_fino_overrides")
                .update({ macchina_id: machine.machineId })
                .in("id", ids);
            if (error) throw error;
            showToast?.(`✅ ${addComp}·${addProj} aggiunto a ${machine.machineId} (${ids.length} righe)`, "success");
            onRefresh();
        } catch (e) {
            showToast?.("❌ " + (e.message || JSON.stringify(e)), "error");
            setSaving(false);
        }
    };

    const handleRemove = async (item) => {
        setSaving(true);
        try {
            const { data: rows, error: fetchErr } = await supabase
                .from("material_fino_overrides")
                .select("id")
                .eq("macchina_id", machine.machineId)
                .ilike("componente", item.comp)
                .eq("fase", machine.phase);
            if (fetchErr) throw fetchErr;
            const ids = (rows || []).map(r => r.id);
            if (!ids.length) { showToast?.("⚠️ Nessuna riga trovata", "info"); setSaving(false); return; }
            const { error } = await supabase
                .from("material_fino_overrides")
                .update({ macchina_id: null })
                .in("id", ids);
            if (error) throw error;
            showToast?.(`✅ ${item.shortLabel} rimosso da ${machine.machineId}`, "success");
            onRefresh();
        } catch (e) {
            showToast?.("❌ " + (e.message || JSON.stringify(e)), "error");
            setSaving(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, width: 520, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{machine.machineId}</span>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: machine.phaseColor + "22", color: machine.phaseColor, fontWeight: 600 }}>{machine.phaseLabel}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>✕</button>
                </div>

                {/* Componenti attuali */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Componenti attuali</div>
                    {currentItems.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Nessun componente configurato.</div>}
                    {currentItems.map(item => (
                        <div key={item.compKey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", marginBottom: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", flex: 1 }}>{item.shortLabel}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.proj}</span>
                            <button onClick={() => handleRemove(item)} disabled={saving}
                                style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #ef444460", background: "#ef444412", color: "#ef4444", cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600 }}>
                                Rimuovi
                            </button>
                        </div>
                    ))}
                </div>

                {/* Aggiungi componente */}
                <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Aggiungi componente</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={addProj} onChange={e => { setAddProj(e.target.value); setAddComp(""); }}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 13, flex: 1 }}>
                            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={addComp} onChange={e => setAddComp(e.target.value)}
                            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 13, flex: 1 }}>
                            <option value="">— Componente —</option>
                            {availableComps.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={handleAdd} disabled={saving || !addComp}
                            style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: addComp ? "#10b981" : "var(--bg-tertiary)", color: addComp ? "#fff" : "var(--text-muted)", cursor: addComp ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {saving ? "..." : "➕ Aggiungi"}
                        </button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                        Aggiunge la macchina a tutte le righe di <code>material_fino_overrides</code> per questo componente e fase.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Gantt Pianificazione (per macchina condivisa)
// ══════════════════════════════════════════════════════════════════════════════
function GanttTab({ sharedMachines, weekStart, consumedH, cardStyle }) {
    const totalCOs     = sharedMachines.reduce((s, m) => s + m.changeovers.length, 0);
    const overCapCount = sharedMachines.filter(m => m.isOverCapacity).length;

    return (
        <>
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                    { label: "Macchine condivise", value: sharedMachines.length, color: "#3c6ef0" },
                    { label: "Changeover settimana", value: totalCOs, color: "#8b5cf6" },
                    { label: "Ore passate", value: Math.round(consumedH) + "h", color: "var(--text-muted)" },
                    { label: "Ore rimanenti", value: (WEEK_HOURS - Math.round(consumedH)) + "h", color: "#10b981" },
                    { label: "Macchine overload", value: overCapCount, color: overCapCount > 0 ? "#ef4444" : "#10b981" },
                ].map(c => (
                    <div key={c.label} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {sharedMachines.length === 0 && (
                <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b", borderRadius: 8, padding: "14px 16px", color: "#f59e0b", fontSize: 13 }}>
                    ⚠️ Nessuna macchina condivisa trovata. Verifica che <code>macchina_id</code> sia compilato in <code>material_fino_overrides</code> e che i target siano impostati.
                </div>
            )}

            {/* Day labels header */}
            {sharedMachines.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", marginBottom: 6, paddingLeft: 16, paddingRight: 54 }}>
                    <div style={{ width: 150, flexShrink: 0 }} />
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(6, 1fr)" }}>
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                                {addDays(weekStart, i)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Machine cards */}
            {sharedMachines.map(machine => (
                <div key={machine.machineId} style={{ ...cardStyle, marginBottom: 16 }}>
                    {/* Machine header */}
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)", letterSpacing: 0.5 }}>
                            {machine.machineId}
                        </span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: machine.phaseColor + "22", color: machine.phaseColor, fontWeight: 600 }}>
                            {machine.phaseLabel}
                        </span>
                        {machine.isOverCapacity && (
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#ef444420", color: "#ef4444", fontWeight: 700 }}>
                                ⚠ OVERLOAD
                            </span>
                        )}
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            <strong style={{ color: machine.utilPct > 100 ? "#ef4444" : machine.utilPct > 85 ? "#f59e0b" : "#10b981" }}>
                                {machine.utilPct}%
                            </strong>
                            {" "}utilizzo · {machine.totalDemandH}h richieste · {machine.changeovers.length} changeover
                        </span>
                    </div>

                    {/* Component pills: what this machine processes */}
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {machine.items.map(item => (
                            <div key={item.compKey} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                background: "var(--bg-tertiary)", borderRadius: 7,
                                padding: "6px 12px", borderLeft: `3px solid ${item.color}`,
                            }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{item.shortLabel}</span>
                                    {item.target > 0 ? (
                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                                            <span style={{ color: "#10b981" }}>{item.produced.toLocaleString("it-IT")}</span>
                                            <span> / {item.target.toLocaleString("it-IT")} pz</span>
                                            {item.remaining > 0 && (
                                                <>
                                                    <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                                                        ({item.remaining.toLocaleString("it-IT")} rim.)
                                                    </span>
                                                    <span style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                        <span style={{ fontSize: 10, background: item.urgencyScore >= 0.8 ? "#ef444422" : item.urgencyScore >= 0.5 ? "#f59e0b22" : "#10b98122", color: item.urgencyScore >= 0.8 ? "#ef4444" : item.urgencyScore >= 0.5 ? "#f59e0b" : "#10b981", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
                                                            Urg: {item.urgencyScore}
                                                        </span>
                                                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>({item.jph.toLocaleString("it-IT")} pz/h)</span>
                                                    </span>
                                                </>
                                            )}
                                            {item.produced >= item.target && (
                                                <span style={{ color: "#10b981", marginLeft: 4 }}>✓ completato</span>
                                            )}
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>nessun target</span>
                                    )}
                                    {item.target > 0 && !item.hasConfig && (
                                        <span style={{ fontSize: 10, color: "#ef4444", marginLeft: 4 }}>⚠ no throughput</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Gantt bar */}
                    <div style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <GanttBar blocks={machine.blocks} consumedH={consumedH} />
                            </div>
                            <div style={{ width: 38, flexShrink: 0, textAlign: "right", fontSize: 11, fontWeight: 700,
                                color: machine.utilPct > 100 ? "#ef4444" : machine.utilPct > 85 ? "#f59e0b" : "var(--text-muted)" }}>
                                {machine.utilPct}%
                            </div>
                        </div>
                        {/* Mini legend for this machine */}
                        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                            {machine.items.filter(i => i.totalH > 0).map(item => (
                                <div key={item.compKey} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                                    <span style={{ color: "var(--text-secondary)" }}>{item.shortLabel}</span>
                                    <span style={{ color: "var(--text-muted)" }}>{item.totalH}h</span>
                                </div>
                            ))}
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#6b7280", flexShrink: 0 }} />
                                <span style={{ color: "var(--text-muted)" }}>Changeover</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(0,0,0,0.35)", flexShrink: 0 }} />
                                <span style={{ color: "var(--text-muted)" }}>Ore passate</span>
                            </div>
                        </div>
                    </div>

                    {/* Changeover schedule: when exactly to change over */}
                    {machine.changeovers.length > 0 && (
                        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                🔄 Quando fare il changeover
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {machine.changeovers.map((co, i) => (
                                    <div key={i} style={{
                                        background: "var(--bg-tertiary)", borderRadius: 7, padding: "7px 12px",
                                        fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                                        borderLeft: `3px solid ${co.toColor}`,
                                    }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: co.toColor, flexShrink: 0 }} />
                                        <div>
                                            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{co.datetime}</span>
                                            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>→ inizia {co.toLabel}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* No remaining work message */}
                    {machine.items.every(i => i.target > 0 && i.produced >= i.target) && machine.items.some(i => i.target > 0) && (
                        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", color: "#10b981", fontSize: 12 }}>
                            ✓ Tutti i componenti completati per questa settimana
                        </div>
                    )}
                </div>
            ))}
        </>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Configurazione
// ══════════════════════════════════════════════════════════════════════════════
// Sub-tab Throughput: griglia macchina × componente con JPH editabile
// ══════════════════════════════════════════════════════════════════════════════
function ThroughputSubTab({ sharedMachines, cfg, dbFasi, onRefreshFasi, showToast, cardStyle }) {
    // draft: Record<"proj::comp::fase_id", number|""> — valori in editing
    const [draft, setDraft] = useState({});
    const [saving, setSaving] = useState(false);

    // Costruisci le righe della griglia dalle macchine condivise
    const rows = useMemo(() => {
        const out = [];
        for (const machine of sharedMachines) {
            for (const item of machine.items) {
                const key = `${item.compKey}::${machine.phase}`;
                // Cerca pzH corrente in dbFasi
                const dbRow = dbFasi.find(r =>
                    r.fase_id === machine.phase &&
                    r.componente?.toUpperCase() === item.comp?.toUpperCase() &&
                    r.progetto === item.proj
                );
                const currentPzH = dbRow?.pzH ?? null;
                const lotto = cfg.components[item.compKey]?.lotto || 1200;
                out.push({
                    key,
                    machineId:  machine.machineId,
                    phaseId:    machine.phase,
                    phaseLabel: machine.phaseLabel,
                    phaseColor: machine.phaseColor,
                    compKey:    item.compKey,
                    comp:       item.comp,
                    proj:       item.proj,
                    shortLabel: item.shortLabel,
                    color:      item.color,
                    currentPzH,
                    lotto,
                    dbRow,
                });
            }
        }
        return out;
    }, [sharedMachines, dbFasi, cfg]);

    const getValue = (key, currentPzH) => {
        if (key in draft) return draft[key];
        return currentPzH ?? "";
    };

    const handleSave = async () => {
        const toSave = Object.entries(draft).filter(([, v]) => v !== "" && !isNaN(+v) && +v > 0);
        if (!toSave.length) { showToast?.("Nessuna modifica da salvare", "info"); return; }
        setSaving(true);
        try {
            const upsertRows = toSave.map(([key, pzH]) => {
                const row = rows.find(r => r.key === key);
                if (!row) return null;
                return {
                    progetto:   row.proj,
                    componente: row.comp,
                    fase_id:    row.phaseId,
                    fase_label: row.phaseLabel,
                    pzH:        +pzH,
                    // mantieni valori esistenti se presenti
                    fixedH:      row.dbRow?.fixedH    ?? null,
                    chargeSize:  row.dbRow?.chargeSize ?? null,
                    noChangeOver: row.dbRow?.noChangeOver ?? false,
                };
            }).filter(Boolean);

            const { error } = await supabase
                .from("componente_fasi")
                .upsert(upsertRows, { onConflict: "progetto,componente,fase_id" });
            if (error) throw error;

            showToast?.(`✅ Salvati ${upsertRows.length} JPH in componente_fasi`, "success");
            setDraft({});
            onRefreshFasi?.();
        } catch (e) {
            showToast?.("❌ " + (e.message || JSON.stringify(e)), "error");
        } finally {
            setSaving(false);
        }
    };

    // Raggruppa per macchina
    const byMachine = useMemo(() => {
        const map = {};
        for (const row of rows) {
            if (!map[row.machineId]) map[row.machineId] = { machineId: row.machineId, phaseLabel: row.phaseLabel, phaseColor: row.phaseColor, items: [] };
            map[row.machineId].items.push(row);
        }
        return Object.values(map);
    }, [rows]);

    const hasDraft = Object.keys(draft).length > 0;

    return (
        <div>
            {/* Header con salva */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Configura i JPH (pezzi/ora) per ogni componente su ogni macchina condivisa.
                    Vengono salvati in <code>componente_fasi</code> e usati per il calcolo del Gantt.
                </span>
                <div style={{ flex: 1 }} />
                {hasDraft && (
                    <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                        {Object.keys(draft).length} modifiche non salvate
                    </span>
                )}
                <button onClick={handleSave} disabled={saving || !hasDraft}
                    style={{ padding: "7px 18px", borderRadius: 6, border: "none", background: hasDraft ? "#10b981" : "var(--bg-tertiary)", color: hasDraft ? "#fff" : "var(--text-muted)", cursor: hasDraft ? "pointer" : "default", fontSize: 13, fontWeight: 600 }}>
                    {saving ? "Salvataggio..." : "💾 Salva JPH"}
                </button>
            </div>

            {byMachine.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    Nessuna macchina condivisa trovata. Configura prima le macchine nel tab Stato Settimana.
                </div>
            )}

            {byMachine.map(machine => (
                <div key={machine.machineId} style={{ ...cardStyle, marginBottom: 16 }}>
                    {/* Header macchina */}
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{machine.machineId}</span>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: machine.phaseColor + "22", color: machine.phaseColor, fontWeight: 600 }}>
                            {machine.phaseLabel}
                        </span>
                    </div>

                    {/* Tabella componenti */}
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: "var(--bg-tertiary)" }}>
                                    <th style={{ padding: "8px 16px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Componente</th>
                                    <th style={{ padding: "8px 16px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>JPH (pz/h)</th>
                                    <th style={{ padding: "8px 16px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Lotto (pz)</th>
                                    <th style={{ padding: "8px 16px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>h/lotto</th>
                                    <th style={{ padding: "8px 16px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Stato</th>
                                </tr>
                            </thead>
                            <tbody>
                                {machine.items.map((row, i) => {
                                    const val = getValue(row.key, row.currentPzH);
                                    const pzH = parseFloat(val);
                                    const hPerLot = pzH > 0 ? (row.lotto / pzH).toFixed(1) : "—";
                                    const isDirty = row.key in draft;
                                    const isMissing = !row.currentPzH && !(row.key in draft);
                                    return (
                                        <tr key={row.key} style={{ borderTop: "1px solid var(--border)", background: isDirty ? "rgba(59,130,246,0.05)" : "transparent" }}>
                                            <td style={{ padding: "10px 16px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                                                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{row.shortLabel}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                                <input
                                                    type="number" min={1} step={1}
                                                    value={val}
                                                    placeholder="—"
                                                    onChange={e => setDraft(prev => ({ ...prev, [row.key]: e.target.value }))}
                                                    style={{
                                                        width: 80, padding: "5px 8px", borderRadius: 4, textAlign: "center",
                                                        border: `1px solid ${isDirty ? "var(--accent)" : isMissing ? "#f59e0b" : "var(--border)"}`,
                                                        background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700,
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: "10px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                                                {row.lotto.toLocaleString("it-IT")}
                                            </td>
                                            <td style={{ padding: "10px 16px", textAlign: "center", color: pzH > 0 ? "var(--text-primary)" : "var(--text-muted)", fontWeight: pzH > 0 ? 600 : 400 }}>
                                                {hPerLot}
                                            </td>
                                            <td style={{ padding: "10px 16px" }}>
                                                {isDirty
                                                    ? <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>✏️ Modificato</span>
                                                    : isMissing
                                                        ? <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>⚠ Non configurato</span>
                                                        : <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ Configurato</span>
                                                }
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
function ConfigTab({ projectTargets, saveProjectTargets, changeoverConfig, setChangeoverConfig, bundleConfig, configSubTab, setConfigSubTab, sharedMachines, cfg, dbFasi, onRefreshFasi, upstreamMachineConfig, saveUpstreamMachine, stockOverrides, saveStockOverride, showToast, cardStyle, dct300Orders, saveDct300Orders, clearDct300Orders, weekStart }) {
    // Copia locale per editing (non committato finché non si preme Salva)
    const [draft, setDraft] = useState(() => ({ ...projectTargets }));

    const subTabBtn = (id) => ({
        padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13,
        border: `1px solid ${configSubTab === id ? "var(--accent)" : "var(--border)"}`,
        background: configSubTab === id ? "var(--accent-dim)" : "var(--bg-secondary)",
        color: configSubTab === id ? "var(--accent)" : "var(--text-secondary)",
        fontWeight: configSubTab === id ? 700 : 400,
    });

    return (
        <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                <button style={subTabBtn("targets")}    onClick={() => setConfigSubTab("targets")}>🎯 Target Giornalieri</button>
                <button style={subTabBtn("throughput")} onClick={() => setConfigSubTab("throughput")}>⚡ Throughput (JPH)</button>
                <button style={subTabBtn("changeover")} onClick={() => setConfigSubTab("changeover")}>⏱ Ore Changeover</button>
                <button style={subTabBtn("op10")}       onClick={() => setConfigSubTab("op10")}>🔗 Op10 (Stock Upstream)</button>
                <button style={subTabBtn("dct300orders")} onClick={() => setConfigSubTab("dct300orders")}>
                    📦 Ordini DCT300{dct300Orders ? " ✓" : ""}
                </button>
            </div>

            {/* Sub-tab: Target per progetto (giornaliero, stessa fonte di ComponentFlowView) */}
            {configSubTab === "targets" && (
                <div style={cardStyle}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
                        <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Target Giornalieri per Progetto</span>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                                Stessa configurazione di Avanzamento Componenti · target settimanale = giornaliero × 6
                            </div>
                        </div>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => saveProjectTargets(draft)}
                            style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                            💾 Salva
                        </button>
                    </div>
                    <div style={{ padding: 20 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
                            {Object.entries(PROJECT_TARGETS_DEFAULT).map(([proj]) => (
                                <div key={proj} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "14px 16px" }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>{proj}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <input type="number" min={0} step={50}
                                            value={draft[proj] ?? PROJECT_TARGETS_DEFAULT[proj]}
                                            onChange={e => setDraft(prev => ({ ...prev, [proj]: +e.target.value }))}
                                            style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }} />
                                        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>pz/giorno</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                                        → {((draft[proj] ?? PROJECT_TARGETS_DEFAULT[proj]) * DAYS_WEEK).toLocaleString("it-IT")} pz/settimana
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-tab: Throughput (JPH) */}
            {configSubTab === "throughput" && (
                <ThroughputSubTab
                    sharedMachines={sharedMachines}
                    cfg={cfg}
                    dbFasi={dbFasi}
                    onRefreshFasi={onRefreshFasi}
                    showToast={showToast}
                    cardStyle={cardStyle}
                />
            )}

            {/* Sub-tab: Changeover */}
            {configSubTab === "changeover" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div style={cardStyle}>
                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            ⏱ Ore Changeover per Fase
                        </div>
                        <div style={{ padding: 16 }}>
                            {GANTT_PHASES.map(phase => (
                                <div key={phase.phaseId} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{phase.label}</span>
                                    <input type="number" min={0} step={0.5}
                                        value={changeoverConfig[phase.phaseId] ?? 1}
                                        onChange={e => setChangeoverConfig(prev => ({ ...prev, [phase.phaseId]: +e.target.value }))}
                                        style={{ width: 72, padding: "5px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-tertiary)", color: "var(--text-primary)", fontSize: 13 }} />
                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>h</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={cardStyle}>
                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                            🔗 Bundle (zero changeover tra i membri)
                        </div>
                        <div style={{ padding: 16 }}>
                            {bundleConfig.map(b => (
                                <div key={b.id} style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>{b.label}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Fase: {b.phaseId}</div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                        Componenti: {b.members.join(", ")}
                                    </div>
                                    <div style={{ fontSize: 11, marginTop: 8, color: "#10b981" }}>
                                        ✓ Changeover = 0 tra i membri del bundle
                                    </div>
                                </div>
                            ))}
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                                DG e DG-REV vengono saldati insieme nella fase Saldatura → trattati come job unico senza interruzione.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-tab: Op10 — Macchina Precedente + Stock Manuali */}
            {configSubTab === "op10" && (
                <Op10SubTab
                    sharedMachines={sharedMachines}
                    upstreamMachineConfig={upstreamMachineConfig}
                    saveUpstreamMachine={saveUpstreamMachine}
                    stockOverrides={stockOverrides}
                    saveStockOverride={saveStockOverride}
                    showToast={showToast}
                    cardStyle={cardStyle}
                />
            )}

            {/* Sub-tab: Ordini Cliente DCT300 */}
            {configSubTab === "dct300orders" && (
                <Dct300OrdersSubTab
                    dct300Orders={dct300Orders}
                    saveDct300Orders={saveDct300Orders}
                    clearDct300Orders={clearDct300Orders}
                    weekStart={weekStart}
                    showToast={showToast}
                    cardStyle={cardStyle}
                />
            )}
        </>
    );
}

// ─── Dct300OrdersSubTab ───────────────────────────────────────────────────────
function Dct300OrdersSubTab({ dct300Orders, saveDct300Orders, clearDct300Orders, weekStart, showToast, cardStyle }) {
    const fileInputRef = useRef(null);

    const weekEnd = useMemo(() => {
        const d = new Date(weekStart + "T12:00:00");
        d.setDate(d.getDate() + 5);
        return getLocalDate(d);
    }, [weekStart]);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const wb  = XLSX.read(ev.target.result, { type: "array" });
                const ws  = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });

                // Trova colonne Data, 1A, 21A (case-insensitive, cerca anche varianti)
                const sample = rows[0] || {};
                const keys   = Object.keys(sample);
                const dataKey = keys.find(k => /^data$/i.test(k.trim()));
                const key1a   = keys.find(k => /^1a$/i.test(k.trim()));
                const key21a  = keys.find(k => /^21a$/i.test(k.trim()));

                if (!dataKey || (!key1a && !key21a)) {
                    showToast?.("❌ Colonne non trovate. Il file deve avere: Data, 1A, 21A", "error");
                    return;
                }

                const wStart = new Date(weekStart + "T00:00:00");
                const wEnd   = new Date(weekEnd   + "T23:59:59");

                let tot1a = 0, tot21a = 0;
                let first1a = null, first21a = null;
                const filteredRows = [];

                for (const row of rows) {
                    const rawDate = row[dataKey];
                    if (!rawDate) continue;
                    // XLSX può restituire numeri seriali Excel o stringhe
                    let dateObj;
                    if (typeof rawDate === "number") {
                        dateObj = XLSX.SSF.parse_date_code(rawDate);
                        dateObj = new Date(dateObj.y, dateObj.m - 1, dateObj.d);
                    } else {
                        dateObj = new Date(rawDate);
                    }
                    if (isNaN(dateObj)) continue;
                    if (dateObj < wStart || dateObj > wEnd) continue;

                    const qty1a  = Number(key1a  ? row[key1a]  : 0) || 0;
                    const qty21a = Number(key21a ? row[key21a] : 0) || 0;
                    tot1a  += qty1a;
                    tot21a += qty21a;
                    const iso = dateObj.toISOString();
                    if (qty1a  > 0 && (!first1a  || iso < first1a))  first1a  = iso;
                    if (qty21a > 0 && (!first21a || iso < first21a)) first21a = iso;
                    filteredRows.push({ date: iso, qty1a, qty21a });
                }

                if (!filteredRows.length) {
                    showToast?.(`⚠️ Nessuna riga per la settimana ${weekStart}–${weekEnd}`, "warning");
                    return;
                }

                saveDct300Orders({ tot1a, tot21a, first1a, first21a, rows: filteredRows });
                showToast?.(`✅ Importati ${filteredRows.length} ordini — 1A: ${tot1a.toLocaleString("it-IT")} pz · 21A: ${tot21a.toLocaleString("it-IT")} pz`, "success");
            } catch (err) {
                showToast?.("❌ Errore lettura file: " + err.message, "error");
            }
            e.target.value = "";
        };
        reader.readAsArrayBuffer(file);
    };

    const firstVariant  = dct300Orders
        ? ((dct300Orders.first21a || "") <= (dct300Orders.first1a || "") ? "21A" : "1A")
        : null;
    const secondVariant = firstVariant === "21A" ? "1A" : "21A";

    const fmtDate = (iso) => {
        if (!iso) return "—";
        const d = new Date(iso);
        return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}`;
    };

    return (
        <div style={cardStyle}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>📦 Ordini Cliente DCT300</span>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        Settimana {weekStart} – {weekEnd} · Varianti 1A e 21A
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFile} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent-dim)", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    📂 Importa Excel
                </button>
                {dct300Orders && (
                    <button
                        onClick={() => { if (window.confirm("Rimuovere gli ordini importati?")) clearDct300Orders(); }}
                        style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #ef444440", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>
                        🗑 Rimuovi
                    </button>
                )}
            </div>

            <div style={{ padding: 20 }}>
                {!dct300Orders ? (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>
                        Nessun ordine importato. Clicca <strong>Importa Excel</strong> per caricare il file del cliente.<br />
                        <span style={{ fontSize: 11, marginTop: 6, display: "block" }}>
                            Il file deve avere le colonne: <code>Data</code>, <code>1A</code>, <code>21A</code>
                        </span>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Riepilogo quantità */}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ textAlign: "left", padding: "6px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>VARIANTE</th>
                                    <th style={{ textAlign: "right", padding: "6px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>QUANTITÀ</th>
                                    <th style={{ textAlign: "right", padding: "6px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>PRIMA RICHIESTA</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)" }}>1A</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{(dct300Orders.tot1a || 0).toLocaleString("it-IT")} pz</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)", fontSize: 12 }}>{fmtDate(dct300Orders.first1a)}</td>
                                </tr>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-primary)" }}>21A</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{(dct300Orders.tot21a || 0).toLocaleString("it-IT")} pz</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)", fontSize: 12 }}>{fmtDate(dct300Orders.first21a)}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", fontSize: 12 }}>TOTALE</td>
                                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "var(--accent)", fontSize: 15 }}>
                                        {((dct300Orders.tot1a || 0) + (dct300Orders.tot21a || 0)).toLocaleString("it-IT")} pz
                                    </td>
                                    <td />
                                </tr>
                            </tbody>
                        </table>

                        {/* Sequenza produzione */}
                        {firstVariant && (
                            <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
                                <span style={{ fontWeight: 700, color: "var(--text-primary)", marginRight: 8 }}>Sequenza pianificata:</span>
                                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{firstVariant}</span>
                                <span style={{ color: "var(--text-muted)", margin: "0 8px" }}>→ CO →</span>
                                <span style={{ color: "var(--accent)", fontWeight: 700 }}>{secondVariant}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 12 }}>
                                    ({firstVariant} urgente: prima richiesta {fmtDate(firstVariant === "21A" ? dct300Orders.first21a : dct300Orders.first1a)})
                                </span>
                            </div>
                        )}

                        {/* Info righe importate */}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {(dct300Orders.rows || []).length} righe importate per la settimana selezionata
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Op10SubTab ───────────────────────────────────────────────────────────────
function Op10SubTab({ sharedMachines, upstreamMachineConfig, saveUpstreamMachine, stockOverrides, saveStockOverride, showToast, cardStyle }) {
    // Righe: una per ogni (machineId, compKey) con fase e componente
    const rows = useMemo(() => {
        return sharedMachines
            .flatMap(m => m.items.map(item => ({
                machineId:  m.machineId,
                phaseLabel: m.phaseLabel,
                phaseColor: m.phaseColor,
                compKey:    item.compKey,
                comp:       item.comp,
                proj:       item.proj,
                configKey:  `${m.machineId}::${item.compKey}`,
            })))
            .sort((a, b) => a.machineId.localeCompare(b.machineId) || a.compKey.localeCompare(b.compKey));
    }, [sharedMachines]);

    // Draft locale per gli input (chiave = "machineId::compKey")
    const [draftMachines, setDraftMachines] = useState(() => ({ ...upstreamMachineConfig }));

    // Stock overrides: lista coppie chiave→valore
    const stockEntries = useMemo(() => Object.entries(stockOverrides).sort((a, b) => a[0].localeCompare(b[0])), [stockOverrides]);

    const handleSaveMachines = () => {
        // Salva entry non vuote, rimuove quelle svuotate
        const toSave = Object.fromEntries(Object.entries(draftMachines).filter(([, v]) => v && v.trim()));
        for (const key of Object.keys(upstreamMachineConfig)) {
            if (!toSave[key]) {
                const [machineId, ...rest] = key.split("::");
                const compKey = rest.join("::");
                saveUpstreamMachine(machineId, compKey, null);
            }
        }
        for (const [key, upstreamId] of Object.entries(toSave)) {
            const [machineId, ...rest] = key.split("::");
            const compKey = rest.join("::");
            saveUpstreamMachine(machineId, compKey, upstreamId.trim());
        }
        showToast?.("✅ Configurazione Op10 salvata", "success");
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Sezione 1: Macchina Precedente per (macchina × componente) */}
            <div style={cardStyle}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>🔗 Macchina Precedente per Componente (Op10)</span>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            Ogni macchina può avere upstream diverse per componente · configurabile anche inline nelle card Stato Settimana
                        </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    <button
                        onClick={handleSaveMachines}
                        style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                        💾 Salva tutto
                    </button>
                </div>
                <div style={{ padding: 16, overflowX: "auto" }}>
                    {rows.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>
                            Nessuna macchina condivisa. Carica i dati SAP per la settimana corrente.
                        </div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>MACCHINA</th>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>FASE</th>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>COMPONENTE</th>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>MACCHINA PRECEDENTE</th>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>STATO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const isConfigured = !!(upstreamMachineConfig[r.configKey]);
                                    const draftVal = draftMachines[r.configKey] ?? (upstreamMachineConfig[r.configKey] || "");
                                    return (
                                        <tr key={r.configKey} style={{ borderBottom: "1px solid var(--border)", background: isConfigured ? "var(--bg-tertiary)" : "transparent" }}>
                                            <td style={{ padding: "8px 10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace", fontSize: 12 }}>
                                                {r.machineId}
                                            </td>
                                            <td style={{ padding: "8px 10px" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.phaseColor, display: "inline-block", flexShrink: 0 }} />
                                                    <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{r.phaseLabel}</span>
                                                </span>
                                            </td>
                                            <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-primary)" }}>
                                                <span style={{ fontWeight: 600 }}>{r.comp}</span>
                                                <span style={{ color: "var(--text-muted)", marginLeft: 4, fontSize: 11 }}>{r.proj}</span>
                                            </td>
                                            <td style={{ padding: "8px 10px" }}>
                                                <input
                                                    type="text"
                                                    value={draftVal}
                                                    placeholder="es. STW11002"
                                                    onChange={e => setDraftMachines(prev => ({ ...prev, [r.configKey]: e.target.value }))}
                                                    style={{
                                                        width: 150, padding: "4px 8px", borderRadius: 4,
                                                        border: `1px solid ${draftVal ? "var(--accent)" : "var(--border)"}`,
                                                        background: "var(--bg-primary)", color: "var(--text-primary)",
                                                        fontSize: 12, fontFamily: "monospace",
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: "8px 10px" }}>
                                                {isConfigured
                                                    ? <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>✓ configurata</span>
                                                    : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Sezione 2: Stock Manuali attivi */}
            <div style={cardStyle}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                    <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>📦 Stock Upstream Manuali</span>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            Valori inseriti manualmente (sovrascrivono SAP) · modifica tramite 📦 nelle card Stato Settimana
                        </div>
                    </div>
                    {stockEntries.length > 0 && (
                        <button
                            onClick={() => {
                                if (!window.confirm("Rimuovere tutti gli stock manuali?")) return;
                                stockEntries.forEach(([k]) => saveStockOverride(k, undefined));
                                showToast?.("🗑️ Stock manuali rimossi", "info");
                            }}
                            style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, border: "1px solid #ef444440", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>
                            🗑️ Rimuovi tutti
                        </button>
                    )}
                </div>
                <div style={{ padding: 16 }}>
                    {stockEntries.length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>
                            Nessuno stock manuale. Usa il pulsante 📦 nelle card del tab Stato Settimana.
                        </div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                    <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>CHIAVE (proj::comp::fase)</th>
                                    <th style={{ textAlign: "right", padding: "6px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 11 }}>STOCK (pz)</th>
                                    <th style={{ padding: "6px 10px" }} />
                                </tr>
                            </thead>
                            <tbody>
                                {stockEntries.map(([key, value]) => (
                                    <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "7px 10px", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 12 }}>{key}</td>
                                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#9b59b6" }}>{value.toLocaleString("it-IT")}</td>
                                        <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                            <button
                                                onClick={() => { saveStockOverride(key, undefined); showToast?.("🗑️ Stock rimosso", "info"); }}
                                                style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ef444440", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>
                                                Reset SAP
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Report Mancato Target ────────────────────────────────────────────────────

const MOTIVI = [
    { value: "mancanza_grezzo",    label: "Mancanza grezzo" },
    { value: "mancanza_cestelli",  label: "Mancanza cestelli" },
    { value: "guasto_macchina",    label: "Guasto macchina" },
    { value: "setup_lungo",        label: "Setup lungo" },
    { value: "priorita_cambio",    label: "Cambio priorità" },
    { value: "mancanza_operatore", label: "Mancanza operatore" },
    { value: "altro",              label: "Altro" },
];

/** Serialise/deserialise motivi array ↔ JSON string stored in DB */
function motiviToDb(arr) { return arr?.length ? JSON.stringify(arr) : null; }
function motiviFromDb(str) {
    if (!str) return [];
    try { const p = JSON.parse(str); return Array.isArray(p) ? p : [str]; }
    catch { return str ? [str] : []; }
}

function getMonday2(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function MancatoTargetTab({ sharedMachines, weeklyTargets, sapByKey, rawConferme, weekStart, weekEnd, materialOverrides, showToast }) {
    const [viewMode, setViewMode] = React.useState("week");
    const [selectedDay, setSelectedDay] = React.useState(() => {
        const t = new Date(); t.setHours(0, 0, 0, 0); return t;
    });
    const [notes, setNotes] = React.useState({});
    const [saving, setSaving] = React.useState({});

    const weekStr = React.useMemo(() => weekStart
        ? (weekStart instanceof Date ? weekStart : new Date(weekStart)).toISOString().slice(0, 10)
        : "", [weekStart]);

    const weekDays = React.useMemo(() => {
        if (!weekStart) return [];
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(weekStart instanceof Date ? weekStart : new Date(weekStart));
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [weekStart]);

    // Load saved notes from DB for this week
    React.useEffect(() => {
        if (!weekStr) return;
        const wEnd = weekEnd instanceof Date ? weekEnd.toISOString().slice(0, 10) : String(weekEnd || "").slice(0, 10);
        supabase.from("mancato_target_note").select("*").gte("data", weekStr).lte("data", wEnd || weekStr)
            .then(({ data, error }) => {
                if (error) { console.error("mancato_target_note load error", error); return; }
                const map = {};
                for (const row of (data || [])) {
                    map[`${row.data}::${row.macchina_id}::${row.componente}::${row.fase}`] =
                        { motivi: motiviFromDb(row.motivo), note_libere: row.note_libere || "" };
                }
                setNotes(map);
            });
    }, [weekStr, weekEnd]);

    // Cards: one per machine that has ≥1 component below target
    const machineCards = React.useMemo(() => {
        if (!sharedMachines?.length) return [];
        const cards = [];
        for (const machine of sharedMachines) {
            if (!machine.items?.length) continue;
            // machine.items already has target+produced computed in sharedMachines useMemo
            const missedItems = machine.items.filter(it => (it.target || 0) > 0 && (it.produced || 0) < (it.target || 0));
            if (!missedItems.length) continue;
            const runningItems = machine.items.filter(it => (it.produced || 0) > 0);
            cards.push({ machine, missedItems, runningItems });
        }
        return cards;
    }, [sharedMachines]);

    const getNoteKey = (dateStr, machineId, comp, fase) => `${dateStr}::${machineId}::${comp}::${fase}`;

    async function saveNote(machine, item, dateStr) {
        if (!dateStr) return;
        const settimana = viewMode === "week" ? dateStr
            : getMonday2(new Date(dateStr)).toISOString().slice(0, 10);
        const key = getNoteKey(dateStr, machine.machineId, item.comp, machine.phase);
        const nd = notes[key] || {};
        setSaving(prev => ({ ...prev, [key]: true }));
        const { error } = await supabase.from("mancato_target_note").upsert({
            data: dateStr,
            settimana,
            macchina_id: machine.machineId,
            componente: item.comp,
            progetto: item.proj,
            fase: machine.phase,
            target: item.target,
            prodotto: item.produced,
            mancante: item.target - item.produced,
            motivo: motiviToDb(nd.motivi),
            note_libere: nd.note_libere || null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "data,macchina_id,componente,fase" });
        setSaving(prev => ({ ...prev, [key]: false }));
        if (error) showToast?.("Errore: " + error.message, "error");
        else showToast?.("Nota salvata ✓", "success");
    }

    const dayStr = selectedDay.toISOString().slice(0, 10);
    const activeDateStr = viewMode === "week" ? weekStr : dayStr;

    // KPI aggregates
    const totalMissed = machineCards.reduce((s, { missedItems }) =>
        s + missedItems.reduce((ss, it) => ss + (it.target - it.produced), 0), 0);
    const totalMachines = machineCards.length;
    const worstCard = machineCards.reduce((w, c) => {
        const gap = c.missedItems.reduce((s, it) => s + (it.target - it.produced), 0);
        return gap > (w?.gap || 0) ? { ...c, gap } : w;
    }, null);

    const s = { // compact input style
        padding: "3px 7px", borderRadius: 5,
        border: "1px solid var(--border)",
        background: "var(--bg-primary)", color: "var(--text-primary)",
        fontSize: 12,
    };

    return (
        <div style={{ padding: "12px 0" }}>

            {/* ── Toolbar ── */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border)" }}>
                    {[["week", "Settimana"], ["day", "Giorno"]].map(([v, label]) => (
                        <button key={v} onClick={() => setViewMode(v)}
                            style={{ padding: "4px 12px", border: "none", cursor: "pointer", fontSize: 12,
                                background: viewMode === v ? "var(--accent)" : "var(--bg-secondary)",
                                color: viewMode === v ? "#fff" : "var(--text-muted)", fontWeight: viewMode === v ? 600 : 400 }}>
                            {label}
                        </button>
                    ))}
                </div>
                {viewMode === "day" && weekDays.map(d => {
                    const ds = d.toISOString().slice(0, 10);
                    const sel = dayStr === ds;
                    return (
                        <button key={ds} onClick={() => setSelectedDay(d)}
                            style={{ padding: "4px 9px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                                border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                                background: sel ? "var(--accent)" : "var(--bg-secondary)",
                                color: sel ? "#fff" : "var(--text-muted)", fontWeight: sel ? 600 : 400 }}>
                            {d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" })}
                        </button>
                    );
                })}
            </div>

            {machineCards.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Nessun mancato target</div>
                </div>
            ) : (<>

                {/* ── KPI bar ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                    {[
                        { label: "Macchine sotto target", value: totalMachines, color: "#f59e0b", icon: "⚙️" },
                        { label: "Pezzi mancanti", value: totalMissed.toLocaleString("it-IT"), color: "#ef4444", icon: "📦" },
                        { label: "Macchina critica", value: worstCard?.machine.machineId || "—", color: "#8b5cf6", icon: "⚠️", sub: worstCard ? `−${worstCard.gap.toLocaleString("it-IT")} pz` : "" },
                    ].map(kpi => (
                        <div key={kpi.label} style={{ borderRadius: 8, border: `1px solid ${kpi.color}33`,
                            background: kpi.color + "0d", padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{kpi.icon} {kpi.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color, fontFamily: "monospace", lineHeight: 1 }}>
                                {kpi.value}
                            </div>
                            {kpi.sub && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{kpi.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* ── Card grid ── */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 10 }}>
                    {machineCards.map(({ machine, missedItems, runningItems }) =>
                        missedItems.map(item => {
                            const pct = item.target > 0 ? Math.round((item.produced / item.target) * 100) : 0;
                            const div = viewMode === "week" ? 1 : 5;
                            const tgt = Math.round(item.target / div);
                            const prod = Math.round(item.produced / div);
                            const diff = tgt - prod;
                            const key = getNoteKey(activeDateStr, machine.machineId, item.comp, machine.phase);
                            const nd = notes[key] || {};
                            const selectedMotivi = nd.motivi || [];
                            const isSaving = saving[key];
                            const barColor = pct >= 80 ? "#f59e0b" : pct >= 50 ? "#f97316" : "#ef4444";
                            const causes = runningItems.filter(r => r.compKey !== item.compKey && (r.produced || 0) > 0);
                            const toggleMotivo = (val) => setNotes(prev => {
                                const cur = prev[key]?.motivi || [];
                                const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val];
                                return { ...prev, [key]: { ...prev[key], motivi: next } };
                            });

                            return (
                                <div key={key} style={{ borderRadius: 8, border: "1px solid var(--border)",
                                    background: "var(--bg-secondary)", overflow: "hidden", fontSize: 12 }}>

                                    {/* Row 1: machine + comp + %badge */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                                        borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary, var(--bg-secondary))" }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                            background: machine.phaseColor || "#888", display: "inline-block" }} />
                                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                                            {machine.machineId}
                                        </span>
                                        <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "1px 6px",
                                            background: (machine.phaseColor || "#888") + "22", borderRadius: 8 }}>
                                            {machine.phaseLabel}
                                        </span>
                                        <span style={{ marginLeft: 4, fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                                            {item.comp}
                                        </span>
                                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.proj}</span>
                                        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700,
                                            color: barColor, background: barColor + "18",
                                            padding: "1px 7px", borderRadius: 8, border: `1px solid ${barColor}44` }}>
                                            {pct}%
                                        </span>
                                    </div>

                                    <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                                        {/* Row 2: progress bar + numbers */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                                                <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3 }} />
                                            </div>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                <strong style={{ color: "var(--text-primary)" }}>{prod.toLocaleString("it-IT")}</strong>
                                                {" / "}{tgt.toLocaleString("it-IT")}
                                            </span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap" }}>
                                                −{diff.toLocaleString("it-IT")} pz
                                            </span>
                                        </div>

                                        {/* Row 3: cause chips */}
                                        {causes.length > 0 && (
                                            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Occupata da:</span>
                                                {causes.map(r => (
                                                    <span key={r.compKey} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8,
                                                        background: (r.color || "#888") + "20",
                                                        border: `1px solid ${r.color || "#888"}44`,
                                                        color: "var(--text-primary)", fontWeight: 600 }}>
                                                        {r.comp}
                                                        <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 3 }}>
                                                            {r.produced.toLocaleString("it-IT")} pz
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Row 4: motivi chip-toggle */}
                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            {MOTIVI.map(m => {
                                                const on = selectedMotivi.includes(m.value);
                                                return (
                                                    <button key={m.value} onClick={() => toggleMotivo(m.value)}
                                                        style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                                                            background: on ? "var(--accent)" : "transparent",
                                                            color: on ? "#fff" : "var(--text-muted)",
                                                            fontSize: 10, cursor: "pointer", fontWeight: on ? 600 : 400,
                                                            transition: "all 0.12s" }}>
                                                        {on ? "✓ " : ""}{m.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Row 5: note + save */}
                                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                                            <input type="text" value={nd.note_libere || ""} placeholder="Note libere..."
                                                style={{ ...s, flex: 1, minWidth: 0 }}
                                                onChange={e => setNotes(prev => ({ ...prev, [key]: { ...prev[key], note_libere: e.target.value } }))} />
                                            <button disabled={isSaving} onClick={() => saveNote(machine, item, activeDateStr)}
                                                style={{ padding: "3px 10px", borderRadius: 5, border: "none", fontSize: 11,
                                                    cursor: isSaving ? "default" : "pointer", fontWeight: 600,
                                                    background: selectedMotivi.length || nd.note_libere ? "var(--accent)" : "var(--bg-tertiary, var(--border))",
                                                    color: selectedMotivi.length || nd.note_libere ? "#fff" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                                                {isSaving ? "…" : "Salva"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </>)}
        </div>
    );
}
