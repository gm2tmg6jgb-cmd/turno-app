import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMacchine() {
    console.log("Checking macchine table structure and data...");
    try {
        const { data, error } = await supabase
            .from('macchine')
            .select('*')
            .limit(5);

        if (error) {
            console.error("Error fetching macchine:", error);
            return;
        }

        if (data && data.length > 0) {
            console.log("Columns present in 'macchine' table (from first record):");
            console.log(Object.keys(data[0]));
            console.log("\nSample data with codice_sap:");
            console.log(data.map(m => ({ id: m.id, nome: m.nome, codice_sap: m.codice_sap })));
        } else {
            console.log("No macchine found.");
        }
    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

checkMacchine();
