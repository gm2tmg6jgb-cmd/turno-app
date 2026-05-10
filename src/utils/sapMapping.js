import { PROJECTS } from "../data/constants";

/**
 * Normalise a component name: strip variant suffixes like "-1A", "-21A".
 * "DG-1A" → "DG",  "SG2-REV" → "DG-REV" (handled upstream via override)
 */
export function normalizeFlowComp(comp) {
    return (comp || "").replace(/\s*-\s*(1A|21A)$/i, "").trim();
}

/** Extract variant suffix: "SG4 - 1A" → "1A", "SG4" → null */
export function extractVariant(comp) {
    const m = (comp || "").match(/\s*-\s*(1A|21A)$/i);
    return m ? m[1].toUpperCase() : null;
}

/**
 * Determine variant from material code pattern:
 * - Codes starting with "2511108" → "1A"
 * - Codes starting with "2511122" → "21A"
 */
export function extractVariantFromMat(matCode) {
    const code = (matCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.startsWith("2511108")) return "1A";
    if (code.startsWith("2511122")) return "21A";
    return null;
}

/**
 * Aggregate conferme_sap records into totals keyed by "proj::comp::fase_id".
 *
 * @param {Array}  rawConferme       — rows from conferme_sap
 * @param {Array}  materialOverrides — rows from material_fino_overrides
 *                 Each row expected as: { mat, fino, phase, comp, proj, macchina_id, compVariant }
 * @returns {Object} Record<"proj::comp::fase_id", number>
 */
export function aggregateSapByPhase(rawConferme, materialOverrides) {
    const result = {};

    if (!rawConferme?.length || !materialOverrides?.length) return result;

    for (const r of rawConferme) {
        const matCode = (r.materiale || "").toUpperCase();
        const fino    = String(r.fino || "").padStart(4, "0");

        // Match specific (exact fino) first, then generic (fino null/empty)
        const override =
            materialOverrides.find(o => o.mat === matCode && o.fino === fino) ||
            materialOverrides.find(o => o.mat === matCode && !o.fino);

        if (!override) continue;

        const phase = override.phase;
        if (!phase || phase === "baa") continue;

        // Normalise project names
        let proj = override.proj || "";
        if (proj === "DCT 300")                        proj = "DCT300";
        if (proj === "8 FE" || proj === "8Fedct")      proj = "8Fe";
        if (proj === "DCT Eco" || proj === "DCTeco")   proj = "DCT ECO";
        if (!PROJECTS.includes(proj)) continue;

        // Normalise component names (strip variant suffix for combined totals)
        let comp = override.comp || "";
        if (!comp) continue;
        if (comp === "SG2-REV") comp = "DG-REV";
        comp = normalizeFlowComp(comp);

        const key = `${proj}::${comp}::${phase}`;
        result[key] = (result[key] || 0) + (r.qta_ottenuta || 0);
    }

    return result;
}

/**
 * Aggregate conferme_sap records keeping variant suffixes (1A / 21A) separate.
 * Keys: "proj::comp::variant::fase_id"  (variant = "1A" | "21A")
 * Only components WITH a variant suffix are included (components without variant are skipped).
 *
 * @returns {Object} Record<"proj::comp::variant::fase_id", number>
 */
export function aggregateSapByVariant(rawConferme, materialOverrides) {
    const result = {};

    if (!rawConferme?.length || !materialOverrides?.length) return result;

    for (const r of rawConferme) {
        const matCode = (r.materiale || "").toUpperCase();
        const fino    = String(r.fino || "").padStart(4, "0");

        const override =
            materialOverrides.find(o => o.mat === matCode && o.fino === fino) ||
            materialOverrides.find(o => o.mat === matCode && !o.fino);

        if (!override?.compVariant) continue; // solo componenti con variante

        const phase = override.phase;
        if (!phase || phase === "baa") continue;

        let proj = override.proj || "";
        if (proj === "DCT 300")                        proj = "DCT300";
        if (proj === "8 FE" || proj === "8Fedct")      proj = "8Fe";
        if (proj === "DCT Eco" || proj === "DCTeco")   proj = "DCT ECO";
        if (!PROJECTS.includes(proj)) continue;

        let comp = override.comp || "";
        if (!comp) continue;
        if (comp === "SG2-REV") comp = "DG-REV";
        comp = normalizeFlowComp(comp);

        const key = `${proj}::${comp}::${override.compVariant}::${phase}`;
        result[key] = (result[key] || 0) + (r.qta_ottenuta || 0);
    }

    return result;
}

/**
 * Normalise rows from material_fino_overrides as stored in Supabase.
 * Adds compVariant ("1A" | "21A" | null) for components with variant suffixes.
 */
export function normalizeMaterialOverrides(dbRows) {
    if (!dbRows) return [];
    return dbRows.map(r => {
        const rawComp = (r.componente || r.comp || "");
        const matCode = (r.materiale || r.mat || "").toUpperCase();
        // Variante dal nome componente (es. "SG5 - 1A"), altrimenti dal codice materiale
        const variant = extractVariant(rawComp) || extractVariantFromMat(matCode);
        return {
            mat:         matCode,
            fino:        r.fino ? String(r.fino).padStart(4, "0") : null,
            phase:       r.fase || r.phase || "",
            comp:        normalizeFlowComp(rawComp.toUpperCase()),
            compVariant: variant,   // "1A" | "21A" | null
            proj:        (r.progetto || r.proj || "").trim(),
            macchina_id: r.macchina_id || "",
        };
    });
}
