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

// Logic: Rotation is BACKWARDS (Next week = Current Slot Index - 1)
// Order: M(0) <- P(1) <- S(2) <- N(3) <- M(0) ...

export function getWeekDiff(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const diffTime = d.getTime() - ANCHOR_DATE.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    // Calculate weeks. If negative, floor correctly.
    // Monday is start of week.
    // Adjust to Monday
    const anchorDay = ANCHOR_DATE.getDay() || 7; // ISO day (1-7)
    // Actually simpler: just divide days by 7? 
    // Need to handle "start of week".
    // Let's use ISO week logic if exactness matters, or simple day diff/7 if we assume inputs are reliable dates.
    // For rotation, simply: floor(days / 7).
    return Math.floor(diffDays / 7);
}

export function getSlotIndexForGroup(groupId, date) {
    if (!ANCHOR_MAPPING.hasOwnProperty(groupId)) return 0;

    const weeksPassed = getWeekDiff(date);
    const initialIndex = ANCHOR_MAPPING[groupId];

    // Backwards rotation: index - weeks
    // Modulo arithmetic for negative result support: ((a % n) + n) % n
    const slotsCount = 4;
    let newIndex = (initialIndex - weeksPassed) % slotsCount;
    if (newIndex < 0) newIndex += slotsCount;

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
