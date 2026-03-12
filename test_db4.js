import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data } = await supabase.from('anagrafica_materiali').select('*').ilike('componente', '%SG1%');
  console.log("SG1 materials:", data.length);
  if (data.length > 0) console.log(data.slice(0, 3));
  
  const { data: prod } = await supabase.from('conferme_sap').select('*').eq('work_center_sap', 'FRW10193').order('data', { ascending: false }).limit(10);
  console.log("Recent FRW10193 prod:", prod.map(p => ({ mat: p.materiale, qta: p.qta_ottenuta, date: p.data })));
}
test();
