import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking conferme_sap table...");
    try {
        const { data, error, count } = await supabase
            .from('conferme_sap')
            .select('*', { count: 'exact' });

        if (error) {
            console.error("Error fetching data:", error);
            return;
        }

        console.log(`Total rows in conferme_sap: ${count}`);
        if (data && data.length > 0) {
            console.log("First 5 rows:");
            console.log(JSON.stringify(data.slice(0, 5), null, 2));
        } else {
            console.log("No data found in conferme_sap.");
        }
    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

checkData();
