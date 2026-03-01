import { getSlotForGroup } from './src/lib/shiftRotation.js';
function formatDate(d) { return d.toISOString().split('T')[0]; }
function runWeek(startDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    console.log(`Week ${formatDate(start)} - ${formatDate(end)}`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const line = ['A', 'B', 'C', 'D'].map(g => {
            const slot = getSlotForGroup(g, d);
            return `${g}:${slot ? slot.id : 'null'}`;
        }).join(' ');
        console.log(`${dateStr} ${line}`);
    }
    console.log('');
}
const weeks = ['2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09'];
weeks.forEach(runWeek);
