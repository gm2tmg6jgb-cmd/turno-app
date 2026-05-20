import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://osrgdvrhffpslanlpxub.supabase.co',
  'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U'
);

(async () => {
  try {
    // Prova a leggere conferme_sap e estrai materiale e fino
    const { data: conferme, error } = await supabase
      .from('conferme_sap')
      .select('materiale, fino, macchina, qta_ottenuta')
      .limit(200);

    if (error) throw error;

    console.log('✅ Found', conferme.length, 'conferme SAP\n');

    // Raggruppa per materiale
    const byMateriale = {};
    const byComponente = {};

    conferme.forEach(row => {
      const mat = row.materiale ? row.materiale.toUpperCase() : null;
      const fino = row.fino ? row.fino.toUpperCase() : null;
      const mac = row.macchina || null;

      if (mat && fino) {
        if (!byMateriale[mat]) byMateriale[mat] = new Set();
        byMateriale[mat].add(fino);
      }
    });

    console.log('📊 Materiali unici:', Object.keys(byMateriale).length);
    console.log('📊 Campioni di dati:');
    Object.entries(byMateriale).slice(0, 10).forEach(([mat, fini]) => {
      console.log(`  ${mat}: ${Array.from(fini).join(', ')}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
