import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://osrgdvrhffpslanlpxub.supabase.co',
  'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U'
);

(async () => {
  try {
    // Leggi conferme_sap
    const { data: conferme, error } = await supabase
      .from('conferme_sap')
      .select('materiale, fino, qta_ottenuta')
      .limit(300);

    if (error) throw error;

    console.log('✅ Found', conferme.length, 'conferme SAP\n');

    // Raggruppa per materiale
    const byMateriale = {};
    const byFino = {};
    const componentiSet = new Set();

    conferme.forEach(row => {
      const mat = row.materiale ? row.materiale.toUpperCase().trim() : null;
      const fino = row.fino ? String(row.fino).toUpperCase().trim() : null;

      if (mat && fino) {
        if (!byMateriale[mat]) byMateriale[mat] = new Set();
        byMateriale[mat].add(fino);

        if (!byFino[fino]) byFino[fino] = [];
        byFino[fino].push(mat);
      }
    });

    // Deduce componenti dalla struttura del materiale
    // Es: M0153401/S → SG3, M0153389/S → SG2
    Object.keys(byMateriale).forEach(mat => {
      if (mat.includes('M0153401')) componentiSet.add('SG3');
      if (mat.includes('M0153389')) componentiSet.add('SG2');
    });

    console.log('📊 Materiali unici:', Object.keys(byMateriale).length);
    console.log('📊 Fino (OP) unici:', Object.keys(byFino).length);
    console.log('📊 Componenti dedotti:', Array.from(componentiSet).join(', '));

    console.log('\n=== FINO (OP) TROVATI ===');
    Object.keys(byFino).sort().forEach(fino => {
      console.log(`${fino}`);
    });

    console.log('\n=== CAMPIONI MATERIALI ===');
    Object.entries(byMateriale).slice(0, 15).forEach(([mat, fini]) => {
      console.log(`${mat}: ${Array.from(fini).sort().join(', ')}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
