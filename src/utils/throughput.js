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

            // Se non ci sono fasi salvate, usa i defaults
            if (savedPhases.length === 0) {
                merged.components[key] = defaultPhases;
                continue;
            }

            // Altrimenti, usa le fasi salvate e preserva i campi editabili dai defaults se disponibili
            merged.components[key] = savedPhases.map(sp => {
                const dp = defaultPhases.find(p => p.phaseId === sp.phaseId);

                // Preserva tutti i campi della fase salvata, mantenendo i tipi corretti
                return {
                    ...sp,
                    pzH: sp.pzH != null ? Number(sp.pzH) : sp.pzH,
                    fixedH: sp.fixedH != null ? Number(sp.fixedH) : sp.fixedH,
                    changeOverH: sp.changeOverH != null ? Number(sp.changeOverH) : sp.changeOverH,
                    chargeSize: sp.chargeSize != null ? Number(sp.chargeSize) : sp.chargeSize,
                    sapMat: sp.sapMat || undefined,
                    sapOp: sp.sapOp || undefined
                };
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
    const lotto = Number(cfg.lotto) || 0;
    const oee = Number(cfg.oee) || 1;
    const co = phase.noChangeOver ? 0 : Number(phase.changeOverH ?? cfg.changeOverH ?? 1);

    if (phase.fixedH != null) {
        const fixedH = Number(phase.fixedH) || 0;
        if (phase.chargeSize) {
            return Math.ceil(lotto / Number(phase.chargeSize)) * fixedH + co;
        }
        return fixedH + co;
    }
    const pzH = Number(phase.pzH) || 1;
    return (lotto / (pzH * oee)) + co;
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
