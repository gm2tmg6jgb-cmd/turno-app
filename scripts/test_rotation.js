import { getSlotForGroup, getGroupForSlot } from '../src/lib/shiftRotation.js';

// Mock Date format YYYY-MM-DD
const testDates = [
    "2026-02-13", // Current Week (Anchor)
    "2026-02-17", // Next Week (+1) -> Expect shift -1 slot
    "2026-02-24", // +2 Weeks -> Expect shift -2 slots
];

console.log("--- Testing Shift Rotation ---");

// Test 1: Anchor Week (Feb 13)
console.log("\nWeek Feb 13 (Anchor):");
console.log("Group A (Expect Sera):", getSlotForGroup("A", "2026-02-13").nome);
console.log("Group B (Expect Notte):", getSlotForGroup("B", "2026-02-13").nome);
console.log("Group C (Expect Mattina):", getSlotForGroup("C", "2026-02-13").nome);
console.log("Group D (Expect Pomeriggio):", getSlotForGroup("D", "2026-02-13").nome);

// Test 2: Next Week (Feb 17) - Backwards
// A: Sera -> Pomeriggio
// B: Notte -> Sera
// C: Mattina -> Notte
// D: Pomeriggio -> Mattina
console.log("\nWeek Feb 17 (Next Week):");
console.log("Group A (Expect Pomeriggio):", getSlotForGroup("A", "2026-02-17").nome);
console.log("Group B (Expect Sera):", getSlotForGroup("B", "2026-02-17").nome);
console.log("Group C (Expect Notte):", getSlotForGroup("C", "2026-02-17").nome);
console.log("Group D (Expect Mattina):", getSlotForGroup("D", "2026-02-17").nome);

// Test 3: Reverse Lookup
console.log("\nReverse Lookup Feb 17 for 'Mattina':");
console.log("Who is working Mattina? (Expect D):", getGroupForSlot("Mattina", "2026-02-17"));
