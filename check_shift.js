import { getSlotForGroup } from './src/lib/shiftRotation.js';
const today = new Date();
const groups = ['A', 'B', 'C', 'D'];
const result = groups.map(g => ({ g, slot: getSlotForGroup(g, today).id }));
console.log('Today slots:', result);
