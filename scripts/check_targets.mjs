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
    console.log("Checking tables in 'public' schema...");
    const { data: tables, error } = await supabase.rpc('get_tables');
    if (error) {
        console.log("Error RPC 'get_tables':", error);
        // Fallback: search for specific table names
        const guess = ['produzione_targets', 'macchine_targets', 'oee_data', 'bi_targets'];
        for (const t of guess) {
            const { data } = await supabase.from(t).select('*').limit(1);
            if (data) console.log(`Found table: ${t}`);
        }
    } else {
        console.log("Tables:", tables);
    }

    // Check 'produzione_targets' content
    const { data: pgTargets } = await supabase.from('produzione_targets').select('*');
    if (pgTargets) console.log("produzione_targets sample:", pgTargets.slice(0, 5));
}

check();
