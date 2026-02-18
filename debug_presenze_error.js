
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
    console.log("Checking presenze table structure...");

    // Try to insert a dummy record to see error or success (then rollback/delete)
    // Or just fetch one to see columns

    const { data, error } = await supabase.from('presenze').select('*').limit(1);

    if (error) {
        console.error("Error fetching presenze:", error);
    } else {
        console.log("Presenze record sample:", data[0]);
    }

    // Check if we can upsert with the exact payload causing error
    // We need a valid dipendente_id. Let's fetch one.
    const { data: dip } = await supabase.from('dipendenti').select('id').limit(1).single();

    if (dip) {
        console.log("Testing upsert with dipendente_id:", dip.id);
        const payload = {
            dipendente_id: dip.id,
            data: new Date().toISOString().split('T')[0],
            presente: false,
            motivo_assenza: null, // Test with null first, then with a mock if needed, but let's see if basic fields work
            turno_id: 'D'
        };

        console.log("Payload:", payload);

        const { error: upsertError } = await supabase.from('presenze').upsert(payload, { onConflict: 'dipendente_id, data' });

        if (upsertError) {
            console.error("❌ Upsert failed:", upsertError);
        } else {
            console.log("✅ Upsert successful!");
            // cleanup
            await supabase.from('presenze').delete().eq('dipendente_id', dip.id).eq('data', payload.data);
        }
    }
}

checkSchema();
