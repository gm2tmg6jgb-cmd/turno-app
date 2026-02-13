import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) env[key.trim()] = value.trim();
        });
        return env;
    } catch (e) {
        console.error("❌ Could not read .env file");
        return {};
    }
};

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPresenze() {
    const today = new Date().toISOString().split("T")[0];
    console.log(`🧹 Clearing presenze for today: ${today}...`);

    const { error } = await supabase
        .from('presenze')
        .delete()
        .eq('data', today);

    if (error) {
        console.error("❌ Error deleting presenze:", error);
    } else {
        console.log("✅ Successfully cleared duplicate presenze.");
        console.log("🔄 Please reload the web page to regenerate them correctly.");
    }
}

fixPresenze();
