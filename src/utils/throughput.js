import { THROUGHPUT_CONFIG } from "../data/constants";

const LS_KEY = "throughput_config";

/**
 * Legge la config dal localStorage. Se non esiste, usa THROUGHPUT_CONFIG di default.
 * Merge intelligente: mantiene la struttura delle fasi da constants, sovrascrive solo i valori editabili.
 */
export function loadThroughputConfig() {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (!saved) return THROUGHPUT_CONFIG;
        const parsed = JSON.parse(saved);
        // Merge: mantiene le fasi di default ma aggiorna pzH e fixedH se salvati
        const merged = {
            lotto: parsed.lotto ?? THROUGHPUT_CONFIG.lotto,
            oee: parsed.oee ?? THROUGHPUT_CONFIG.oee,
            changeOverH: parsed.changeOverH ?? THROUGHPUT_CONFIG.changeOverH,
            rackSize: parsed.rackSize ?? THROUGHPUT_CONFIG.rackSize,
            components: {}
        };
        for (const [key, defaultPhases] of Object.entries(THROUGHPUT_CONFIG.components)) {
            const savedPhases = parsed.components?.[key] || [];
            merged.components[key] = defaultPhases.map(dp => {
                const sp = savedPhases.find(p => p.phaseId === dp.phaseId);
                // Mantieni sempre chargeSize e noChangeOver dal default (non editabili dall'utente)
                return sp ? { ...dp, pzH: sp.pzH, fixedH: sp.fixedH } : dp;
            });
        }
        return merged;
    } catch {
        return THROUGHPUT_CONFIG;
    }
}

/**
 * Salva la config nel localStorage.
 */
export function saveThroughputConfig(cfg) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

/**
 * Calcola le ore necessarie per una singola fase.
 * - Fase con chargeSize (es. T.T.): ⌈lotto / chargeSize⌉ × fixedH, senza change over se noChangeOver=true
 * - Fase con fixedH normale: fixedH + changeOver
 * - Fase continua: (lotto / (pzH × oee)) + changeOver
 */
export function phaseHours(phase, cfg) {
    // change over: per-fase se definito, altrimenti globale; 0 se noChangeOver
    const co = phase.noChangeOver ? 0 : (phase.changeOverH ?? cfg.changeOverH);
    if (phase.fixedH != null) {
        if (phase.chargeSize) {
            return Math.ceil(cfg.lotto / phase.chargeSize) * phase.fixedH + co;
        }
        return phase.fixedH + co;
    }
    return (cfg.lotto / (phase.pzH * cfg.oee)) + co;
}

/**
 * Calcola tutte le fasi con ore per fase e cumulate.
 */
export function computeThroughput(componentKey, cfg) {
    const phases = cfg.components[componentKey] || [];
    let cumH = 0;
    return phases.map(p => {
        const h = phaseHours(p, cfg);
        cumH += h;
        return { ...p, h: +h.toFixed(1), cumH: +cumH.toFixed(1) };
    });
}
