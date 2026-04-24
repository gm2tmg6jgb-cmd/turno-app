/**
 * Calcola le ore necessarie per una singola fase.
 * Se la fase ha fixedH (es. trattamento termico), usa quello + changeOver.
 * Altrimenti usa: (lotto / (pzH × oee)) + changeOver
 */
export function phaseHours(phase, cfg) {
    if (phase.fixedH != null) return phase.fixedH + cfg.changeOverH;
    return (cfg.lotto / (phase.pzH * cfg.oee)) + cfg.changeOverH;
}

/**
 * Calcola tutte le fasi di un componente con ore per fase e ore cumulate.
 * @param {string} componentKey - es. "DCT300::SGR"
 * @param {object} cfg - THROUGHPUT_CONFIG
 * @returns {Array} fasi arricchite con h (ore fase) e cumH (ore cumulate)
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

/**
 * Dato un phaseId corrente, restituisce le ore rimanenti (dalla fase corrente inclusa).
 */
export function remainingHours(componentKey, currentPhaseId, cfg) {
    const phases = computeThroughput(componentKey, cfg);
    const idx = phases.findIndex(p => p.phaseId === currentPhaseId);
    if (idx === -1) return null;
    const total = phases.at(-1)?.cumH || 0;
    const doneBefore = idx > 0 ? phases[idx - 1].cumH : 0;
    return +(total - doneBefore).toFixed(1);
}
