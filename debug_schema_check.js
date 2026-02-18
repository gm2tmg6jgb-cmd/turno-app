
import { createClient } from '@supabase/supabase-js';

// Access environment variables securely
// Note: In this Node.js context, we need to load .env or just use placeholders if not available.
// Since we are in the user's environment, we can try to read the .env file or rely on the user to have them exported.
// However, the cleanest way in this specific agent environment is to read the .env file directly.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    try {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        for (const line of envConfig.split('\n')) {
            const [key, value] = line.split('=');
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = value?.trim();
            if (key === 'VITE_SUPABASE_ANON_KEY') supabaseAnonKey = value?.trim();
        }
    } catch (e) {
        console.error("Could not read .env file");
    }
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
    console.log("Checking schema for 'macchine' table...");

    // insert a dummy record with 'zona' to see if it fails
    // or better, just select and look at the structure if possible, but select * returns columns.
    // If column doesn't exist, we won't see it in data, but we can't be sure it's not just null.
    // Making a select with the specific column will fail if it doesn't exist.

    const { data, error } = await supabase.from('macchine').select('id, zona').limit(1);

    if (error) {
        console.error("❌ Error selecting 'zona' column:", error.message);
        if (error.message.includes('column "zona" does not exist')) {
            console.log("\n⚠️ DIAGNOSIS: The 'zona' column is MISSING from the database.");
            console.log("👉 Please run the migration_total_sync.sql script in Supabase SQL Editor.");
        }
    } else {
        console.log("✅ 'zona' column EXISTS.");
        console.log("Sample data:", data);

        // Also check zone max_machines
        const { data: zoneData, error: zoneError } = await supabase.from('zone').select('id, max_machines').limit(1);
        if (zoneError) {
            console.error("❌ Error selecting 'max_machines' column:", zoneError.message);
        } else {
            console.log("✅ 'max_machines' column EXISTS.");
        }
    }
}

checkSchema();
