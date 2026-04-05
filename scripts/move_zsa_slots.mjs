import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function migrate() {
    console.log("Migrating ZSA slots from ZSA11019 to ZSA11022...");

    // 1. Move RG - FD1 (slot 11)
    const { data: d1, error: e1 } = await supabase
        .from('slot_config')
        .update({ macchina_id: 'ZSA11022', slot_index: 1 })
        .match({ macchina_id: 'ZSA11019', slot_index: 11 });

    if (e1) console.error("Error moving slot 11:", e1);
    else console.log("Moved slot 11 to ZSA11022 (index 1)");

    // 2. Move RG - FD2 (slot 12)
    const { data: d2, error: e2 } = await supabase
        .from('slot_config')
        .update({ macchina_id: 'ZSA11022', slot_index: 2 })
        .match({ macchina_id: 'ZSA11019', slot_index: 12 });

    if (e2) console.error("Error moving slot 12:", e2);
    else console.log("Moved slot 12 to ZSA11022 (index 2)");

    console.log("Migration complete.");
}

migrate();
