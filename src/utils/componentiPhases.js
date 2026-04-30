import { supabase } from "../lib/supabase";
import { STD_PHASES } from "../data/constants";

/**
 * Load component-specific phases from Supabase
 * Falls back to STD_PHASES if table doesn't exist or data is unavailable
 * @param {string} progetto - Project name (e.g., "DCT300", "8Fe")
 * @param {string} componente - Component name (e.g., "SGR", "RG")
 * @returns {Promise<Array>} Array of phases with phaseId, label, pzH, fixedH, chargeSize, noChangeOver
 */
export async function loadComponentPhases(progetto, componente) {
  try {
    const { data, error } = await supabase
      .from("componente_fasi")
      .select("*")
      .eq("progetto", progetto)
      .eq("componente", componente)
      .order("id", { ascending: true });

    if (error) {
      console.warn(
        `Error loading phases for ${progetto}::${componente}:`,
        error.message
      );
      return fallbackPhases();
    }

    if (!data || data.length === 0) {
      console.warn(
        `No phases found in DB for ${progetto}::${componente}, using defaults`
      );
      return fallbackPhases();
    }

    // Map DB data to phase format
    return data.map((row) => ({
      phaseId: row.fase_id,
      label: row.fase_label,
      pzH: row.pzH,
      fixedH: row.fixedH,
      chargeSize: row.chargeSize,
      noChangeOver: row.noChangeOver ?? false,
    }));
  } catch (err) {
    console.error("Unexpected error loading component phases:", err);
    return fallbackPhases();
  }
}

/**
 * Load all phases for a project (across all components)
 * Useful for displaying available phases in configuration screens
 * @param {string} progetto - Project name
 * @returns {Promise<Array>} Array of unique phases for the project
 */
export async function loadProjectPhases(progetto) {
  try {
    const { data, error } = await supabase
      .from("componente_fasi")
      .select("*")
      .eq("progetto", progetto)
      .order("id", { ascending: true });

    if (error || !data) {
      return fallbackPhases();
    }

    // Return unique phases
    const phaseMap = new Map();
    data.forEach((row) => {
      if (!phaseMap.has(row.fase_id)) {
        phaseMap.set(row.fase_id, {
          phaseId: row.fase_id,
          label: row.fase_label,
          pzH: row.pzH,
          fixedH: row.fixedH,
          chargeSize: row.chargeSize,
          noChangeOver: row.noChangeOver ?? false,
        });
      }
    });

    return Array.from(phaseMap.values());
  } catch (err) {
    console.error("Error loading project phases:", err);
    return fallbackPhases();
  }
}

/**
 * Fallback to hardcoded standard phases
 * @returns {Array} STD_PHASES
 */
function fallbackPhases() {
  return STD_PHASES.map((p) => ({ ...p }));
}

/**
 * Save or update a component's phase configuration
 * @param {string} progetto
 * @param {string} componente
 * @param {Object} phase - { phaseId, label, pzH, fixedH, chargeSize, noChangeOver }
 */
export async function saveComponentPhase(progetto, componente, phase) {
  try {
    const { data, error } = await supabase
      .from("componente_fasi")
      .upsert({
        progetto,
        componente,
        fase_id: phase.phaseId,
        fase_label: phase.label,
        pzH: phase.pzH,
        fixedH: phase.fixedH,
        chargeSize: phase.chargeSize,
        noChangeOver: phase.noChangeOver ?? false,
      })
      .select();

    if (error) {
      console.error("Error saving phase:", error.message);
      throw error;
    }

    return data;
  } catch (err) {
    console.error("Unexpected error saving phase:", err);
    throw err;
  }
}
