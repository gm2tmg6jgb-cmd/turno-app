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
 * Determine variant from material code pattern.
 * WHY: SAP article numbers for DCT300 encode the gear variant in digits 6-7:
 *   "2511108..." → line 1A (original geometry)
 *   "2511122..." → line 21A (revised geometry)
 * This allows automatic variant detection without requiring manual component
 * name suffixes like "SG5 - 1A" in the configuration.
 */
export function extractVariantFromMat(matCode) {
    const code = (matCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.startsWith("2511108") || code.startsWith("2511109")) return "1A";
    if (code.startsWith("2511122")) return "21A";
    return null;
}

/**
 * Normalise raw SAP project name variants to canonical keys used across the app.
 * Returns null if the project is not in the known PROJECTS list.
 */
export function normalizeProject(proj) {
    let p = (proj || "").trim();
    if (p === "DCT 300")                    p = "DCT300";
    if (p === "8 FE" || p === "8Fedct")    p = "8Fe";
    if (p === "DCT Eco" || p === "DCTeco") p = "DCT ECO";
    return PROJECTS.includes(p) ? p : null;
}

/**
 * Build a Map<mat, {specific: Map<fino, override>, generic: override|null}>
 * from a normalized overrides array for O(1) lookups instead of O(n) .find().
 */
export function buildOverrideIndex(materialOverrides) {
    const index = new Map();
    for (const o of materialOverrides) {
        if (!index.has(o.mat)) index.set(o.mat, { specific: new Map(), generic: null });
        const entry = index.get(o.mat);
        if (o.fino) {
            entry.specific.set(o.fino, o);
        } else {
            entry.generic = o;
        }
    }
    return index;
}

/** Resolve an override for a given matCode+fino using a pre-built index. */
function resolveOverride(index, matCode, fino) {
    const entry = index.get(matCode);
    if (!entry) return null;
    return entry.specific.get(fino) || entry.generic || null;
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

    const index = buildOverrideIndex(materialOverrides);

    for (const r of rawConferme) {
        const matCode = (r.materiale || "").toUpperCase();
        const fino    = String(r.fino || "").padStart(4, "0");
        const override = resolveOverride(index, matCode, fino);
        if (!override) continue;

        const phase = override.phase;
        if (!phase || phase === "baa") continue;

        const proj = normalizeProject(override.proj);
        if (!proj) continue;

        let comp = override.comp || "";
        if (!comp) continue;
        // SG2-REV is stored in legacy configs as the old name; canonical name is DG-REV
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

    const index = buildOverrideIndex(materialOverrides);

    for (const r of rawConferme) {
        const matCode = (r.materiale || "").toUpperCase();
        const fino    = String(r.fino || "").padStart(4, "0");
        const override = resolveOverride(index, matCode, fino);
        if (!override?.compVariant) continue;

        const phase = override.phase;
        if (!phase || phase === "baa") continue;

        const proj = normalizeProject(override.proj);
        if (!proj) continue;

        let comp = override.comp || "";
        if (!comp) continue;
        // SG2-REV is stored in legacy configs as the old name; canonical name is DG-REV
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
        // Variant from component name (e.g. "SG5 - 1A") takes priority;
        // fall back to material code pattern when name has no suffix.
        const variant = extractVariant(rawComp) || extractVariantFromMat(matCode);
        return {
            mat:         matCode,
            fino:        r.fino ? String(r.fino).padStart(4, "0") : null,
            phase:       r.fase || r.phase || "",
            comp:        normalizeFlowComp(rawComp.toUpperCase()),
            compVariant: variant,
            proj:        (r.progetto || r.proj || "").trim(),
            macchina_id: r.macchina_id || "",
        };
    });
}
