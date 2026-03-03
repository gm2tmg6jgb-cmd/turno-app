const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabase() {
    const tables = ['anagrafica_materiali', 'wc_fasi_mapping', 'produzione_targets', 'dipendenti', 'macchine', 'zone', 'conferme_sap'];

    for (const table of tables) {
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
            if (error) {
                if (table !== 'conferme_sap') console.error(`Error fetching ${table}:`, error.message);
                break;
            }
            if (!data || data.length === 0) break;

            const umItems = data.filter(item =>
                Object.values(item).some(val => String(val) === 'UM')
            );

            if (umItems.length > 0) {
                console.log(`Found 'UM' EXACT MATCH in table ${table}:`);
                console.log(umItems);
            }

            // Also check if any duplicate IDs
            const idCounts = {};
            data.forEach(d => {
                if (d.id !== undefined) {
                    idCounts[d.id] = (idCounts[d.id] || 0) + 1;
                }
            });
            const dupes = Object.entries(idCounts).filter(([id, count]) => count > 1 && id === 'UM');
            if (dupes.length > 0) {
                console.log(`Duplicate IDs in table ${table} for UM:`, dupes);
            }

            if (data.length < pageSize) break;
            from += pageSize;
        }
    }
}

checkDatabase();
