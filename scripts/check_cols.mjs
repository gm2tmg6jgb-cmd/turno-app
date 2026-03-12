import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data, error } = await supabase.from('conferme_sap').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log("Columns found:", Object.keys(data[0] || {}));
    }
}

main().catch(console.error);
