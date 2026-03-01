export const SLOTS = [
    { id: "M", nome: "Mattina", orario: "06:00 – 12:00", color: "#F59E0B", order: 0 },
    { id: "P", nome: "Pomeriggio", orario: "12:00 – 18:00", color: "#3B82F6", order: 1 },
    { id: "S", nome: "Sera", orario: "18:00 – 24:00", color: "#6366F1", order: 2 },
    { id: "N", nome: "Notte", orario: "00:00 – 06:00", color: "#10B981", order: 3 },
];

export const GROUPS = ["A", "B", "C", "D"];

// Anchor: Week of Feb 9, 2026 (Monday)
// Mapping for that week:
// A -> Sera (2)
// B -> Notte (3)
// C -> Mattina (0)
// D -> Pomeriggio (1)
const ANCHOR_DATE = new Date("2026-02-09T12:00:00Z"); // Use noon to avoid timezone edge cases on boundary
const ANCHOR_MAPPING = {
    "A": 2, // Sera
    "B": 3, // Notte
    "C": 0, // Mattina
    "D": 1  // Pomeriggio
};

// Logic: Rotation is FORWARD (Next week = Current Slot Index + 1)
// Order: M(0) -> P(1) -> S(2) -> N(3) -> M(0) ...

export function getWeekDiff(date) {
    const d = new Date(date);
    d.setUTCHours(12, 0, 0, 0);
    const diffTime = d.getTime() - ANCHOR_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // Return signed week difference (negative for past dates)
    return Math.floor(diffDays / 7);
}

export function getSlotIndexForGroup(groupId, date) {
    if (!ANCHOR_MAPPING.hasOwnProperty(groupId)) return 0;

    const weeksPassed = getWeekDiff(date);
    const initialIndex = ANCHOR_MAPPING[groupId];

    // Forward rotation: index + weeks (handle negative weeks correctly)
    const slotsCount = SLOTS.length;
    const rawIndex = initialIndex + weeksPassed;
    const newIndex = ((rawIndex % slotsCount) + slotsCount) % slotsCount;
    return newIndex;
}

export function getSlotForGroup(groupId, date) {
    const index = getSlotIndexForGroup(groupId, date);
    return SLOTS.find(s => s.order === index);
}

export function getGroupForSlot(slotNameOrId, date) {
    // Find which group is doing this slot on this date
    // Iterate all groups
    const targetSlot = SLOTS.find(s => s.id === slotNameOrId || s.nome === slotNameOrId);
    if (!targetSlot) return null;

    return GROUPS.find(g => getSlotIndexForGroup(g, date) === targetSlot.order);
}

/**
 * Detects which group is currently working based on the hour of the day.
 * M: 06-12, P: 12-18, S: 18-00, N: 00-06
 */
export function getActiveGroup(date = new Date()) {
    const hour = date.getHours();
    let slotId = "N"; // Default 00-06

    if (hour >= 6 && hour < 12) slotId = "M";
    else if (hour >= 12 && hour < 18) slotId = "P";
    else if (hour >= 18 && hour < 24) slotId = "S";

    return getGroupForSlot(slotId, date);
}
