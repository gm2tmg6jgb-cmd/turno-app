
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking dipendenti table structure...");

    // Fetch one to see columns
    const { data: existing, error: fetchError } = await supabase.from('dipendenti').select('*').limit(1);

    if (fetchError) {
        console.error("Error fetching dipendenti:", fetchError);
    } else {
        console.log("Dipendenti record sample:", existing[0]);
    }

    // Test Insert
    const testId = crypto.randomUUID();
    const payload = {
        id: testId,
        nome: "Test",
        cognome: "User",
        turno: "D",
        reparto_id: "T11", // Changed from reparto to reparto_id based on previous file reads
        tipo: "indeterminato",
        ruolo: "operatore"
        // Intentionally omitting optional fields to see if they are the issue
    };

    console.log("Testing insert:", payload);

    const { data, error } = await supabase
        .from('dipendenti')
        .insert([payload])
        .select();

    if (error) {
        console.error("❌ Insert failed:", error);
    } else {
        console.log("✅ Insert successful:", data);
        // cleanup
        await supabase.from('dipendenti').delete().eq('id', testId);
    }
}

checkSchema();
