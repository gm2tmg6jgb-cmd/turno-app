import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/angelofato/Documents/turno-app copia/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing credentials");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { error } = await supabase.from('conferme_sap').insert([{
    data: '2026-04-03',
    materiale: 'TEST',
    qta_ottenuta: 0,
    qta_scarto: 0,
    turno_id: 'A',
    fino: '0010'
  }]);
  console.log("Error:", error);
}

testInsert();
