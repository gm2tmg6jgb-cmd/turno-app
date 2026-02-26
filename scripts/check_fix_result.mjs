import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentState() {
    console.log("Checking current state of conferme_sap after fix...");
    try {
        const { data, error } = await supabase
            .from('conferme_sap')
            .select('*')
            .not('macchina_id', 'is', null)
            .limit(10);

        if (error) {
            console.error("Error:", error);
            return;
        }

        console.log(`Records with macchina_id: ${data.length}`);
        console.log(data.map(r => ({
            id: r.id,
            work_center_sap: r.work_center_sap,
            macchina_id: r.macchina_id,
            materiale: r.materiale,
            data: r.data
        })));

        // Check if there are still null macchina_id for SCA14025
        const { count } = await supabase
            .from('conferme_sap')
            .select('*', { count: 'exact', head: true })
            .eq('work_center_sap', 'SCA14025')
            .is('macchina_id', null);

        console.log(`\nRemaining null links for SCA14025: ${count}`);

    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

checkCurrentState();
