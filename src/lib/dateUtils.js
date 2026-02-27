/**
 * dateUtils.js — Shared date & presence utilities
 * Centralises logic that was previously duplicated in 5+ components.
 */

/**
 * Returns "YYYY-MM-DD" for the given Date using LOCAL time (not UTC).
 * Avoids the classic JS pitfall where `toISOString()` shifts the day
 * when the local timezone is behind UTC.
 *
 * @param {Date} d
 * @returns {string}
 */
export function getLocalDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/** Today's date string in local time — convenience constant */
export const TODAY = getLocalDate(new Date());

/**
 * Converts "YYYY-MM-DD" → "DD/MM/YYYY" for display.
 * Returns the original value if it doesn't match the expected format.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatItalianDate(dateStr) {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Returns true if the employee should be considered present for a given date.
 *
 * Rules (consistent with Dashboard logic):
 *  - Sunday → absent by default (no work)
 *  - If a presenze record exists → use record.presente
 *  - If no record exists yet → default to PRESENT
 *
 * @param {string}   dipId      — employee UUID
 * @param {Array}    presenze   — full presenze array from Supabase
 * @param {string}   [date]     — ISO date string, defaults to today
 * @returns {boolean}
 */
export function getIsPresent(dipId, presenze, date = TODAY) {
    const isSunday = new Date(date + "T12:00:00").getDay() === 0;
    if (isSunday) return false;
    const record = presenze.find(
        (p) => p.dipendente_id === dipId && p.data === date
    );
    return record ? record.presente : true;
}
/**
 * Returns the current week's Monday and Sunday as "YYYY-MM-DD" strings.
 * @returns {{ monday: string, sunday: string }}
 */
export function getCurrentWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)
    const diffToMonday = day === 0 ? 6 : day - 1;

    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
        monday: getLocalDate(monday),
        sunday: getLocalDate(sunday)
    };
}
