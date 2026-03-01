import { getSlotForGroup } from './src/lib/shiftRotation.js';
function formatDate(d) { return d.toISOString().split('T')[0]; }
const start = new Date('2026-02-16');
const end = new Date('2026-02-23');
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    console.log('Date', dateStr);
    ['A', 'B', 'C', 'D'].forEach(g => {
        const slot = getSlotForGroup(g, d);
        console.log(`  Group ${g}: ${slot ? slot.id : 'null'}`);
    });
}
