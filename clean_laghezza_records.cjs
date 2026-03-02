require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    // 1. Get Laghezza ID
    const { data: dipendenti } = await supabase.from("dipendenti").select("id").ilike("cognome", "%laghezza%");
    if (!dipendenti || dipendenti.length === 0) return console.log("Laghezza not found");
    const dipId = dipendenti[0].id;
    console.log("Laghezza ID:", dipId);

    const todayDate = new Date().toISOString().split('T')[0];

    // 2. Delete from presenze today and onward
    const { data: pres, error: errPres } = await supabase.from("presenze").delete().eq("dipendente_id", dipId).gte("data", todayDate);
    console.log("Presenze deleted:", errPres || "Success");

    // 3. Delete from assegnazioni today and onward
    const { data: ass, error: errAss } = await supabase.from("assegnazioni").delete().eq("dipendente_id", dipId).gte("data", todayDate);
    console.log("Assegnazioni deleted:", errAss || "Success");
}
test();
