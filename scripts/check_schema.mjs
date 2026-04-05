import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking tables for OEE/Target related columns...");
    
    // Check 'macchine' table
    const { data: macCols, error: errMac } = await supabase.rpc('get_table_columns', { table_name: 'macchine' });
    if (errMac) {
        // Fallback: just try to select one row
        const { data: mRow } = await supabase.from('macchine').select('*').limit(1);
        if (mRow && mRow[0]) console.log("Macchine columns:", Object.keys(mRow[0]));
    } else {
        console.log("Macchine columns:", macCols);
    }

    // Check if there is a 'targets' or 'performance' table
    const { data: tables, error: errTables } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
    if (tables) console.log("Tables in public schema:", tables.map(t => t.tablename));

    // Try to find any table with 'target' or 'oee' in name
    const { data: targetData } = await supabase.from('targets').select('*').limit(1).catch(() => ({ data: null }));
    if (targetData) console.log("Found 'targets' table!");
}

check();
