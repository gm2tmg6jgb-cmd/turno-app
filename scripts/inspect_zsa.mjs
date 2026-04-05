import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure we find .env.local if .env doesn't work
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

if (!process.env.VITE_SUPABASE_URL) {
    console.error("VITE_SUPABASE_URL is missing! Check .env or .env.local.");
    process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking slot_config for ZSA machines...");
    const { data: slots, error: slotError } = await supabase
        .from('slot_config')
        .select('*')
        .or('macchina_id.ilike.zsa11019,macchina_id.ilike.zsa11022')
        .order('slot_index', { ascending: true });

    if (slotError) {
        console.error("Error fetching slots:", slotError);
        return;
    }

    console.log(`Found ${slots.length} configured slots.`);
    console.table(slots.map(s => ({
        machine: s.macchina_id,
        index: s.slot_index,
        comp: s.componente,
        proj: s.progetto,
        material: s.codice_materiale,
        fino: s.fino
    })));
}

check();
