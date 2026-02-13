
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
    console.log("🔍 Finding duplicate presenze...");

    // 1. Fetch all presenze
    const { data: presenze, error } = await supabase
        .from('presenze')
        .select('*');

    if (error) {
        console.error("Error fetching presenze:", error);
        return;
    }

    console.log(`Processing ${presenze.length} records...`);

    const seen = new Set();
    const duplicates = [];

    // Group by dipendente_id + data
    const uniqueKeys = {}; // key -> record

    for (const p of presenze) {
        const key = `${p.dipendente_id}-${p.data}`;
        if (!uniqueKeys[key]) {
            uniqueKeys[key] = p; // Keep the first one found
        } else {
            duplicates.push(p);
        }
    }

    console.log(`Found ${duplicates.length} duplicates.`);

    if (duplicates.length === 0) {
        console.log("No duplicates found.");
        return;
    }

    // 2. Delete duplicates
    console.log("🗑️ Deleting duplicates...");
    const idsToDelete = duplicates.map(d => d.id);

    const { error: delError } = await supabase
        .from('presenze')
        .delete()
        .in('id', idsToDelete);

    if (delError) {
        console.error("Error deleting duplicates:", delError);
    } else {
        console.log(`✅ Successfully deleted ${idsToDelete.length} duplicate records.`);
    }
}

cleanupDuplicates();
