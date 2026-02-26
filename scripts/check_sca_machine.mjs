import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSca() {
    console.log("Checking sca11008 machine...");
    try {
        const { data, error } = await supabase
            .from('macchine')
            .select('*')
            .eq('id', 'SCA11008')
            .single();

        if (error) {
            console.error("Error fetching sca11008:", error);
            return;
        }

        console.log("Record sca11008:");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

checkSca();
