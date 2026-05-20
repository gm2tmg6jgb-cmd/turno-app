import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://osrgdvrhffpslanlpxub.supabase.co';
const supabaseKey = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    // Leggi material_fino_overrides
    const { data: overrides, error: err1 } = await supabase
      .from('material_fino_overrides')
      .select('*')
      .limit(500);

    if (err1) throw err1;

    console.log('✅ Found', overrides.length, 'entries in material_fino_overrides\n');

    // Raggruppa per componente
    const byComponent = {};
    const byMaterial = {};
    const byFino = {};

    overrides.forEach(row => {
      const comp = row.componente || 'UNKNOWN';
      const fino = row.fino || 'UNKNOWN';
      const mat = row.materiale || 'UNKNOWN';
      const mac = row.macchina || 'UNKNOWN';

      if (!byComponent[comp]) byComponent[comp] = { fini: new Set(), macchine: {}, materiali: new Set() };
      byComponent[comp].fini.add(fino);
      byComponent[comp].materiali.add(mat);
      if (fino) byComponent[comp].macchine[fino] = mac;

      if (!byFino[fino]) byFino[fino] = new Set();
      byFino[fino].add(comp);

      byMaterial[mat] = { componente: comp, fino: fino, macchina: mac };
    });

    console.log('📊 Componenti trovati:', Object.keys(byComponent).length);
    console.log('📊 Materiali trovati:', Object.keys(byMaterial).length);
    console.log('📊 Fino (OP) univoci:', Object.keys(byFino).length);

    console.log('\n=== COMPONENTI E FLUSSO ===');
    Object.entries(byComponent).forEach(([comp, data]) => {
      const fini = Array.from(data.fini).sort();
      console.log(`\n${comp}:`);
      console.log(`  Fino (OP): ${fini.join(', ')}`);
      console.log(`  Macchine: ${fini.map(f => `${f}→${data.macchine[f]}`).join(', ')}`);
    });

    console.log('\n=== FINO (OP) A COMPONENTI ===');
    Object.entries(byFino).forEach(([fino, comps]) => {
      console.log(`${fino}: ${Array.from(comps).join(', ')}`);
    });

    // Salva in file
    const output = {
      componenti: Object.fromEntries(
        Object.entries(byComponent).map(([comp, data]) => [
          comp,
          {
            fini: Array.from(data.fini).sort(),
            macchine: data.macchine,
            materiali: Array.from(data.materiali)
          }
        ])
      ),
      fino_componenti: Object.fromEntries(
        Object.entries(byFino).map(([fino, comps]) => [fino, Array.from(comps)])
      ),
      materiali: byMaterial,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync('extracted_config.json', JSON.stringify(output, null, 2));
    console.log('\n✅ Dati salvati in extracted_config.json');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
