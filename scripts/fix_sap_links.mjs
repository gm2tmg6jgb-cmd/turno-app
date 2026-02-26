import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExistingData() {
    console.log("Starting retroactive fix for SAP data...");

    // 1. Get all machines with a SAP code
    const { data: macchine, error: errMac } = await supabase
        .from('macchine')
        .select('id, codice_sap')
        .not('codice_sap', 'is', null);

    if (errMac) {
        console.error("Error fetching macchine:", errMac);
        return;
    }

    console.log(`Found ${macchine.length} machines with SAP codes.`);

    let fixedCount = 0;

    for (const m of macchine) {
        const sapCode = m.codice_sap.toUpperCase().trim();
        console.log(`Updating records for SAP code: ${sapCode} -> Machine ID: ${m.id}`);

        const { data, error, count } = await supabase
            .from('conferme_sap')
            .update({ macchina_id: m.id })
            .eq('work_center_sap', sapCode)
            .is('macchina_id', null) // Only update those not yet linked
            .select();

        if (error) {
            console.error(`Error updating code ${sapCode}:`, error);
        } else {
            console.log(`Successfully updated ${data?.length || 0} records.`);
            fixedCount += (data?.length || 0);
        }
    }

    console.log(`\nFix completed! Total records updated: ${fixedCount}`);
}

fixExistingData();
