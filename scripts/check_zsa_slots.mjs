import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking slot_config entries for ZSA machines...");
    const { data, error } = await supabase
        .from('slot_config')
        .select('*')
        .or('macchina_id.ilike.zsa11019,macchina_id.ilike.zsa11022')
        .order('slot_index', { ascending: true });

    if (error) {
        console.error("Error fetching slot_config:", error);
        return;
    }

    console.log(`Found ${data.length} records.`);
    console.table(data.map(d => ({ 
        id: d.id, 
        machine: d.macchina_id, 
        slot: d.slot_index, 
        comp: d.componente,
        fino: d.fino 
    })));
}

check();
