
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

async function checkConstraints() {
    console.log("Checking assegnazioni constraints...");

    // 1. Get a dipendente and today's date
    const { data: dip } = await supabase.from('dipendenti').select('id').limit(1).single();
    if (!dip) { console.log("No dipendenti found"); return; }

    const today = new Date().toISOString().split('T')[0];
    const dipId = dip.id;

    // 2. Insert first assignment
    const ass1 = {
        dipendente_id: dipId,
        data: today,
        turno_id: 'D',
        macchina_id: 'TEST_MAC_1',
        note: 'Test 1'
    };

    console.log("Inserting #1...");
    const { data: d1, error: e1 } = await supabase.from('assegnazioni').insert([ass1]).select();
    if (e1) console.error("Error 1:", e1);
    else console.log("Inserted #1:", d1[0]);

    // 3. Insert second assignment (different machine, same user/date)
    const ass2 = {
        dipendente_id: dipId,
        data: today,
        turno_id: 'D',
        macchina_id: 'TEST_MAC_2',
        note: 'Test 2'
    };

    console.log("Inserting #2 (Same User, Different Machine)...");
    const { data: d2, error: e2 } = await supabase.from('assegnazioni').insert([ass2]).select();

    if (e2) {
        console.error("❌ Error 2 (Constraint likely exists):", e2);
    } else {
        console.log("✅ Inserted #2 - Multiple assignments allowed!");
    }

    // Cleanup
    console.log("Cleaning up...");
    await supabase.from('assegnazioni').delete().eq('dipendente_id', dipId).eq('data', today).ilike('macchina_id', 'TEST_MAC_%');
}

checkConstraints();
