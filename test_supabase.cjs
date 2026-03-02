require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    const payload = [{
        codice: "TEST_DUMP_001",
        componente: "SG2",
        progetto: "8Fe",
        centri_di_lavoro: "A, B"
    }];
    const { data, error } = await supabase.from("anagrafica_materiali").insert(payload).select();
    console.log("Error object:", error);
    if (data) {
        await supabase.from("anagrafica_materiali").delete().eq("codice", "TEST_DUMP_001");
    }
}
test();
