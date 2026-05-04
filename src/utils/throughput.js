import { THROUGHPUT_CONFIG } from "../data/constants";

const LS_KEY = "throughput_config";

/**
 * Legge la config dal localStorage. Se non esiste, usa THROUGHPUT_CONFIG di default.
 * Migra automaticamente il vecchio formato (lotto/oee globali) al nuovo per-componente.
 */
export function loadThroughputConfig() {
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (!saved) return THROUGHPUT_CONFIG;
        const parsed = JSON.parse(saved);

        // Detect old format: had top-level lotto/oee
        const isOldFormat = parsed.lotto != null || parsed.oee != null;

        const merged = { components: {} };

        for (const [key, defaultComp] of Object.entries(THROUGHPUT_CONFIG.components)) {
            if (isOldFormat) {
                // Old format: components[key] was an array of phases
                const savedPhases = parsed.components?.[key] || [];
                merged.components[key] = {
                    lotto: Number(parsed.lotto ?? defaultComp.lotto),
                    oee: Number(parsed.oee ?? defaultComp.oee),
                    changeOverH: Number(parsed.changeOverH ?? defaultComp.changeOverH),
                    rackSize: Number(parsed.rackSize ?? defaultComp.rackSize),
                    phases: savedPhases.length > 0
                        ? savedPhases.map(sp => ({
                            ...sp,
                            pzH: sp.pzH != null ? Number(sp.pzH) : sp.pzH,
                            fixedH: sp.fixedH != null ? Number(sp.fixedH) : sp.fixedH,
                            changeOverH: sp.changeOverH != null ? Number(sp.changeOverH) : sp.changeOverH,
                            chargeSize: sp.chargeSize != null ? Number(sp.chargeSize) : sp.chargeSize,
                        }))
                        : defaultComp.phases.map(p => ({ ...p })),
                };
            } else {
                // New format: components[key] is { lotto, oee, changeOverH, rackSize, phases }
                const savedComp = parsed.components?.[key];
                if (!savedComp) {
                    merged.components[key] = { ...defaultComp, phases: defaultComp.phases.map(p => ({ ...p })) };
                    continue;
                }
                merged.components[key] = {
                    lotto: Number(savedComp.lotto ?? defaultComp.lotto),
                    oee: Number(savedComp.oee ?? defaultComp.oee),
                    changeOverH: Number(savedComp.changeOverH ?? defaultComp.changeOverH),
                    rackSize: Number(savedComp.rackSize ?? defaultComp.rackSize),
                    phases: (savedComp.phases?.length > 0 ? savedComp.phases : defaultComp.phases).map(sp => ({
                        ...sp,
                        pzH: sp.pzH != null ? Number(sp.pzH) : sp.pzH,
                        fixedH: sp.fixedH != null ? Number(sp.fixedH) : sp.fixedH,
                        changeOverH: sp.changeOverH != null ? Number(sp.changeOverH) : sp.changeOverH,
                        chargeSize: sp.chargeSize != null ? Number(sp.chargeSize) : sp.chargeSize,
                    })),
                };
            }
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
 * compCfg = { lotto, oee, changeOverH, ... }
 */
export function phaseHours(phase, compCfg) {
    const lotto = Number(compCfg.lotto) || 0;
    const oee = Number(compCfg.oee) || 1;
    const co = phase.noChangeOver ? 0 : Number(phase.changeOverH ?? compCfg.changeOverH ?? 1);

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
 * cfg.components[componentKey] = { lotto, oee, changeOverH, rackSize, phases }
 * startPhaseId (opzionale): se fornito, il calcolo parte da questa fase (escludendo quelle precedenti)
 * excludePhaseIds (opzionale): array di phase IDs da escludere (es. ["assembly", "laser_welding_2"])
 */
export function computeThroughput(componentKey, cfg, startPhaseId = null, excludePhaseIds = []) {
    const compCfg = cfg.components[componentKey] || {};
    let phases = compCfg.phases || [];

    // Se startPhaseId è fornito, filtra le fasi da startPhaseId in poi
    if (startPhaseId) {
        const startIndex = phases.findIndex(p => p.phaseId === startPhaseId);
        if (startIndex !== -1) {
            phases = phases.slice(startIndex);
        }
    }

    // Escludiili phase specifici
    if (excludePhaseIds && excludePhaseIds.length > 0) {
        phases = phases.filter(p => !excludePhaseIds.includes(p.phaseId));
    }

    let cumH = 0;
    return phases.map(p => {
        const h = phaseHours(p, compCfg);
        cumH += h;
        return { ...p, h: +h.toFixed(1), cumH: +cumH.toFixed(1) };
    });
}
