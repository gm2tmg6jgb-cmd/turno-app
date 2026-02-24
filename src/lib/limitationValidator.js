import { LIMITAZIONI } from "../data/constants";
import { getSlotForGroup } from "./shiftRotation";

/**
 * Parse l104 text field and extract limitation IDs
 * Example: "104 x 2" → ["L104"], "no notte" → ["NO_NOTTE"]
 */
export const parseL104Text = (text) => {
    if (!text || typeof text !== 'string' || text.trim() === "") return [];

    const limitations = [];
    const lowerText = text.toLowerCase();

    // Parse heuristically based on keywords
    if (lowerText.includes("104")) limitations.push("L104");
    if (lowerText.includes("notte") || lowerText.includes("no notte")) limitations.push("NO_NOTTE");
    if (lowerText.includes("sollevamento")) limitations.push("NO_SOLLEVAMENTO");
    if (lowerText.includes("chimico")) limitations.push("NO_CHIMICO");
    if (lowerText.includes("part") || lowerText.includes("tempo")) limitations.push("PART_TIME");

    return [...new Set(limitations)]; // Remove duplicates
};

/**
 * Get all limitations for an employee
 * @param {Object} dipendente - Employee object with l104 field
 * @returns {Array} Array of limitation IDs like ["L104", "NO_NOTTE"]
 */
export const getLimitationsForEmployee = (dipendente) => {
    if (!dipendente || !dipendente.l104) return [];
    return parseL104Text(dipendente.l104);
};

/**
 * Get all limitations info with colors and labels
 * @param {Object} dipendente - Employee object
 * @returns {Array} Array of limitation objects with id, label, color
 */
export const getLimitationDetails = (dipendente) => {
    const limitationIds = getLimitationsForEmployee(dipendente);
    return limitationIds
        .map(id => LIMITAZIONI.find(l => l.id === id))
        .filter(Boolean);
};

/**
 * Check if operator can be assigned to a specific shift
 * @param {Object} dipendente - Employee object
 * @param {String} turno - Turno ID (A, B, C, D)
 * @param {String} date - Date string (YYYY-MM-DD) for slot lookup
 * @returns {Object} { allowed: boolean, reason: string }
 */
export const canAssignToShift = (dipendente, turno, date) => {
    if (!dipendente) return { allowed: false, reason: "Dipendente non trovato" };

    const limitations = getLimitationsForEmployee(dipendente);
    if (limitations.length === 0) return { allowed: true };

    // Get the actual shift slot (M, P, S, N) for this turno on this date
    const slot = getSlotForGroup(turno, date);
    if (!slot) return { allowed: true }; // Can't determine slot, allow

    const slotId = slot.id; // M, P, S, N

    // Check specific limitations
    if (limitations.includes("NO_NOTTE") && slotId === "N") {
        return {
            allowed: false,
            reason: `${dipendente.cognome} ${dipendente.nome} ha divieto turno notturno (attualmente turno ${slot.nome})`
        };
    }

    if (limitations.includes("NO_CHIMICO") && slotId === "P") {
        return {
            allowed: false,
            reason: `${dipendente.cognome} ${dipendente.nome} ha limitazioni con rischio chimico`
        };
    }

    if (limitations.includes("PART_TIME")) {
        return {
            allowed: true, // Part time can work, but flag as warning
            warning: `${dipendente.cognome} ${dipendente.nome} è part-time - verificare orario`
        };
    }

    return { allowed: true };
};

/**
 * Check if operator has any limitations that might affect assignment
 * Used for displaying warnings without blocking assignment
 * @param {Object} dipendente - Employee object
 * @returns {Object|null} { type: string, message: string } or null
 */
export const getAssignmentWarning = (dipendente) => {
    if (!dipendente) return null;

    const limitations = getLimitationsForEmployee(dipendente);
    if (limitations.length === 0) return null;

    const limitationLabels = getLimitationDetails(dipendente)
        .map(l => l.label)
        .join(", ");

    return {
        type: "warning",
        message: `Operatore ha limitazioni: ${limitationLabels}. Verificare compatibilità turno.`
    };
};

/**
 * Validate an assignment before saving
 * @param {Object} dipendente - Employee object
 * @param {String} turno - Turno ID
 * @param {String} date - Date string
 * @param {String} machineId - Machine ID (optional)
 * @returns {Object} { isValid: boolean, error: string|null, warning: string|null }
 */
export const validateAssignment = (dipendente, turno, date, machineId = null) => {
    const shiftCheck = canAssignToShift(dipendente, turno, date);

    return {
        isValid: shiftCheck.allowed,
        error: shiftCheck.allowed ? null : shiftCheck.reason,
        warning: shiftCheck.warning || (getAssignmentWarning(dipendente)?.message || null)
    };
};
