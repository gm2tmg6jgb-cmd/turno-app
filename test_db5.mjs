import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const { data } = await supabase.from('anagrafica_materiali').select('*');
console.log(data.filter(d => d.componente === 'SG1' || d.componente === 'SG3' || d.componente === 'SG4' || d.componente === 'SG4_8FE' || d.componente === 'SG3_8FE'))
