import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const { data } = await supabase.from('conferme_sap').select('*').in('work_center_sap', ['FRW10193', 'FRW10079']).order('data', { ascending: false }).limit(200);

console.log("Raw SAP records for SG1...");
console.table(data.filter(d => ['2511108150', '2511108150/S', '2511108150/T'].includes(d.materiale)).map(d => ({date: d.data, machine: d.work_center_sap, qty: d.qta_ottenuta})));
