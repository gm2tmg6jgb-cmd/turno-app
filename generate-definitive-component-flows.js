#!/usr/bin/env node

/**
 * Genera la mappatura DEFINITIVA dei flussi componenti.
 * Fonte: componente_fasi (Supabase) + PROCESS_STEPS constants + machine zones.
 * Se material_fino_overrides ha dati, usa macchine specifiche; altrimenti mostra il tipo.
 */

import fs from 'fs';

const SUPABASE_URL = 'https://osrgdvrhffpslanlpxub.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';

const DEFAULT_LOTTO = 1200;
const DEFAULT_OEE = 0.85;
const DEFAULT_CHANGEOVER = 1;

async function fetchAll(table, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${params ? '&' + params : ''}&limit=2000`;
    const r = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Accept': 'application/json' } });
    return r.json();
}

function calcHours(phase, lotto = DEFAULT_LOTTO, oee = DEFAULT_OEE) {
    const co = phase.noChangeOver ? 0 : DEFAULT_CHANGEOVER;
    if (phase.fixedH) {
        if (phase.chargeSize) return (Math.ceil(lotto / phase.chargeSize) * phase.fixedH) + co;
        return phase.fixedH + co;
    }
    return (lotto / ((phase.pzH || 1) * oee)) + co;
}

// Codice SAP → zona principale e nome zona
const CODE_TO_ZONE = {
    'DRA': { zona: 'Z1-Z3', nome: 'Tornitura Soft', team: 'T11' },
    'ZSA': { zona: 'Z14',   nome: 'Marcatura DMC',  team: 'T11' },
    'SCA': { zona: 'Z6-Z7', nome: 'Saldatura',       team: 'T11' },
    'STW': { zona: 'Z5',    nome: 'Stozzatura',       team: 'T11' },
    'FRA': { zona: 'Z5',    nome: 'Fresatura',        team: 'T11' },
    'RAA': { zona: 'Z13',   nome: 'Brocciatura',      team: 'T11' },
    'FRW': { zona: 'Z4-Z11',nome: 'Dentatura',        team: 'T11' },
    'EGW': { zona: 'Z8',    nome: 'Smussatura',       team: 'T11' },
    'MZA': { zona: 'Z26',   nome: 'Controllo UT',     team: 'T12' },
    'HOK': { zona: '—',     nome: 'Forno HT',         team: '—'   },
    'OKU': { zona: '—',     nome: 'Pallinatura',      team: '—'   },
    'TH':  { zona: 'Z15-Z18',nome: 'Tornitura Hard',  team: 'T12' },
    'TSF': { zona: 'Z15-Z18',nome: 'Tornitura Sferico',team: 'T12'},
    'ORE': { zona: '—',     nome: 'Ore manuali',      team: '—'   },
    'ASM': { zona: '—',     nome: 'Assemblaggio',     team: '—'   },
    'SLW': { zona: 'Z19-Z21',nome: 'Rettifica Denti', team: 'T12' },
    'SLA': { zona: 'Z22-Z25',nome: 'Tornitura Rettifica', team: 'T12' },
    'WSH': { zona: '—',     nome: 'Lavaggio',         team: '—'   },
    'BAA': { zona: '—',     nome: 'BAA',              team: '—'   },
};

// fase_id → SAP code (da PROCESS_STEPS in constants.js)
const FASE_CODE = {
    'start_soft':           'DRA',
    'dmc':                  'ZSA',
    'laser_welding':        'SCA',
    'laser_welding_soft_2': 'SCA',
    'shaping':              'STW',
    'milling':              'FRA',
    'broaching':            'RAA',
    'hobbing':              'FRW',
    'deburring':            'EGW',
    'sca_post_deburring':   'SCA',
    'mza_pre_ht':           'MZA',
    'ht':                   'HOK',
    'shot_peening':         'OKU',
    'start_hard':           'TH',
    'spherical_turning':    'TSF',
    'labor_hours':          'ORE',
    'assembly':             'ASM',
    'slw_post_th':          'SLW',
    'teeth_grinding_2':     'SLW',
    'laser_welding_2':      'SCA',
    'ut_soft':              'MZA',
    'ut':                   'MZA',
    'grinding_cone':        'SLA',
    'start_hard_2':         'TH',
    'grinding_cone_2':      'SLA',
    'teeth_grinding':       'SLW',
    'washing':              'WSH',
    'baa':                  'BAA',
};

// Macchina specifica → zona
const MACHINE_ZONES = {
    'DRA10061': 'Z1', 'DRA10062': 'Z1', 'DRA10063': 'Z1', 'DRA10064': 'Z1',
    'DRA10065': 'Z2', 'DRA10066': 'Z2', 'DRA10069': 'Z2', 'DRA10070': 'Z2',
    'DRA10067': 'Z3', 'DRA10068': 'Z3', 'DRA10071': 'Z3', 'DRA10060': 'Z3',
    'FRW11042': 'Z4', 'DRA10072': 'Z4', 'FRW11060': 'Z4',
    'STW11002': 'Z5', 'FRA11025': 'Z5',
    'SCA10191': 'Z6', 'SCA11006': 'Z6', 'FRW10074': 'Z6',
    'SCA11008': 'Z7', 'SDA11010': 'Z7',
    'EGW11006': 'Z8',
    'FRW10103': 'Z9', 'FRW11013': 'Z9', 'FRW11032': 'Z9', 'FRW10079': 'Z9',
    'FRW11016': 'Z10', 'FRW11017': 'Z10',
    'FRW10052': 'Z11', 'FRW10051': 'Z11', 'FRW10073': 'Z11', 'FRW10077': 'Z11',
    'STW10089': 'Z12', 'FRD10060': 'Z12',
    'STW12177': 'Z13', 'FRD10013': 'Z13',
    'ZBA11019': 'Z14',
    'DRA10102': 'Z15', 'DRA10099': 'Z16', 'DRA10097': 'Z16', 'DRA10101': 'Z17',
    'DRA10113': 'Z17', 'DRA10110': 'Z17', 'DRA10119': 'Z18',
    'SLW11048': 'Z19', 'SLW11044': 'Z19', 'SLW11009': 'Z19', 'SLW11014': 'Z19',
    'SLW11017': 'Z20', 'SLW11027': 'Z20', 'SLW11011': 'Z20',
    'SLW11012': 'Z21', 'SLW11015': 'Z21',
    'SLA11064': 'Z22', 'SLA11063': 'Z22', 'SLA11065': 'Z22', 'SLA11108': 'Z22',
    'SLA11118': 'Z23', 'SLA11057': 'Z23', 'SLA11059': 'Z23',
    'SLA11109': 'Z24', 'SLA11050': 'Z24',
    'SLA11092': 'Z25', 'SLA11091': 'Z25',
    'MZA11006': 'Z26',
    'DRA10058': 'Z27', 'DRA10059': 'Z27', 'FRW10109': 'Z27', 'EGW11007': 'Z27', 'BOA10094': 'Z27',
    'DRA4FRW15': 'Z28',
    'DRA10100': 'Z29',
    'SLW11045': 'Z30', 'DRA10096': 'Z30', 'SLW11125': 'Z30',
    'DRA11130': 'Z31', 'DRA11131': 'Z31', 'DRA11132': 'Z31', 'DRA11133': 'Z31',
    'MON12051': 'Z32', 'SCA11051': 'Z32',
    'ZBA11022': 'Z33',
    'MISURE': 'Z34'
};

const ZONE_LABELS = {
    'Z1': 'Tornitura Soft', 'Z2': 'Tornitura Soft', 'Z3': 'Tornitura Soft',
    'Z4': 'Dentatura', 'Z5': 'Stozzatura', 'Z6': 'Saldatura', 'Z7': 'Saldatura',
    'Z8': 'Smussatura', 'Z9': 'Dentatura', 'Z10': 'Dentatura', 'Z11': 'Dentatura',
    'Z12': 'SGS', 'Z13': 'Brocciatura', 'Z14': 'Marcatura',
    'Z15': 'Tornitura Hard', 'Z16': 'Tornitura Hard', 'Z17': 'Tornitura Hard', 'Z18': 'Tornitura Hard',
    'Z19': 'Rettifica Denti', 'Z20': 'Rettifica Denti', 'Z21': 'Rettifica Denti',
    'Z22': 'Torno Rettifica', 'Z23': 'Torno Rettifica', 'Z24': 'Torno Rettifica',
    'Z25': 'Torno Rettifica', 'Z26': 'UT',
    'Z27': 'Tornitura RG', 'Z28': 'Smussatura RG', 'Z29': 'Tornitura/Rettifica RG',
    'Z30': 'Rettifica Denti', 'Z31': 'Tornitura DH', 'Z32': 'Assembly Laser DH',
    'Z33': 'Marcatura', 'Z34': 'Misurazioni'
};

// Colori per team
const TEAM_COLORS = {
    'T11': '#3b82f6',
    'T12': '#8b5cf6',
    'T13': '#10b981',
    '—':   '#64748b',
};

async function main() {
    console.log('📥 Caricamento dati da Supabase...\n');

    const [componentPhases, materialOverrides] = await Promise.all([
        fetchAll('componente_fasi', 'order=progetto,componente,id'),
        fetchAll('material_fino_overrides')
    ]);

    console.log(`   componente_fasi: ${componentPhases.length} righe`);
    console.log(`   material_fino_overrides: ${materialOverrides.length} righe`);

    // Indice macchine specifiche per fase: {progetto::componente::fase_id} → macchina_id
    const faseMachineMap = new Map();
    const compMaterials = new Map();
    materialOverrides.forEach(mo => {
        const key = `${mo.progetto}::${mo.componente}::${mo.fase}`;
        if (!faseMachineMap.has(key)) faseMachineMap.set(key, mo.macchina_id);
        const ck = `${mo.progetto}::${mo.componente}`;
        if (!compMaterials.has(ck)) compMaterials.set(ck, new Set());
        compMaterials.get(ck).add(mo.materiale);
    });

    const hasMachineData = materialOverrides.length > 0;

    // Raggruppa fasi per componente
    const compMap = new Map();
    componentPhases.forEach(p => {
        const ck = `${p.progetto}::${p.componente}`;
        if (!compMap.has(ck)) compMap.set(ck, { progetto: p.progetto, componente: p.componente, phases: [] });
        compMap.get(ck).phases.push(p);
    });

    // Costruisci flusso per ogni componente
    const flows = [];
    compMap.forEach(({ progetto, componente, phases }, ck) => {
        let totalH = 0;
        const flusso = phases.sort((a, b) => a.id - b.id).map(phase => {
            const hours = calcHours(phase);
            totalH += hours;

            // Macchina specifica (se configurata in material_fino_overrides)
            const mKey = `${progetto}::${componente}::${phase.fase_id}`;
            const machineId = faseMachineMap.get(mKey) || null;

            // Tipo macchina / zona da PROCESS_STEPS code
            const code = FASE_CODE[phase.fase_id] || '?';
            const codeInfo = CODE_TO_ZONE[code] || { zona: '—', nome: code, team: '—' };

            const zona = machineId ? (MACHINE_ZONES[machineId] || '—') : codeInfo.zona;
            const zonaNome = machineId
                ? (ZONE_LABELS[MACHINE_ZONES[machineId]] || '—')
                : codeInfo.nome;
            const team = codeInfo.team;

            return {
                faseId: phase.fase_id,
                faseLabel: phase.fase_label,
                machineId: machineId || `[${code}]`,
                zona,
                zonaNome,
                team,
                ore: parseFloat(hours.toFixed(1)),
                pzH: phase.pzH,
                fixedH: phase.fixedH,
                specificMachine: !!machineId,
            };
        });

        const mats = compMaterials.get(ck);
        flows.push({
            progetto,
            componente,
            materials: mats ? [...mats].sort() : [],
            flusso,
            tempoTotale: parseFloat(totalH.toFixed(1)),
            giorni: parseFloat((totalH / 8).toFixed(1)),
        });
    });

    flows.sort((a, b) => {
        if (a.progetto !== b.progetto) return a.progetto.localeCompare(b.progetto);
        return a.componente.localeCompare(b.componente);
    });

    // Salva JSON
    const jsonPath = '/Users/angelofato/Documents/turno-app copia/public/definitive-component-flows.json';
    const byKey = Object.fromEntries(flows.map(f => [`${f.progetto}::${f.componente}`, f]));
    fs.writeFileSync(jsonPath, JSON.stringify(byKey, null, 2));
    console.log(`\n✅ JSON: ${jsonPath}`);

    // Genera HTML
    const totalComps = flows.length;
    const avgH = flows.reduce((s, f) => s + f.tempoTotale, 0) / totalComps;
    const projects = [...new Set(flows.map(f => f.progetto))];

    const cardsHtml = flows.map(comp => {
        const phasesHtml = comp.flusso.map((p, i) => {
            const color = TEAM_COLORS[p.team] || '#64748b';
            const badge = p.specificMachine
                ? `<span class="badge badge-ok">${p.machineId}</span>`
                : `<span class="badge badge-type">${p.machineId}</span>`;
            return `
            <div class="phase" style="border-left: 3px solid ${color}">
                <div class="phase-row">
                    <span class="step-num">${i + 1}</span>
                    <span class="fase-label">${p.faseLabel}</span>
                    ${badge}
                    <span class="zona">${p.zona} — ${p.zonaNome}</span>
                    <span class="ore">${p.ore}h</span>
                </div>
                ${p.pzH ? `<div class="phase-detail">${p.pzH} pz/h · lotto 1200</div>` : ''}
                ${p.fixedH ? `<div class="phase-detail">fisso ${p.fixedH}h${p.specificMachine ? '' : ''}</div>` : ''}
            </div>`;
        }).join('');

        const matsLabel = comp.materials.length
            ? comp.materials.join(', ')
            : '<em style="color:#64748b">nessun materiale SAP configurato</em>';

        return `
    <div class="card">
        <div class="card-header">
            <div>
                <span class="proj-tag">${comp.progetto}</span>
                <strong class="comp-name">${comp.componente}</strong>
            </div>
            <div class="card-stats">
                <span>⏱ ${comp.tempoTotale}h</span>
                <span>📅 ${comp.giorni}d</span>
                <span>🔢 ${comp.flusso.length} fasi</span>
            </div>
        </div>
        <div class="phases">${phasesHtml}</div>
        <div class="mats">📦 SAP: ${matsLabel}</div>
    </div>`;
    }).join('');

    const warningBanner = hasMachineData
        ? ''
        : `<div class="warning">
            ⚠️ Macchine specifiche non ancora assegnate in Supabase (<code>material_fino_overrides</code> vuoto).
            I tag <code>[SCA]</code>, <code>[FRW]</code> ecc. indicano il <strong>tipo</strong> di macchina dalla costante PROCESS_STEPS.
            Per assegnare la macchina esatta a ogni fase, configurale nell'app → <em>Avanzamento Componenti</em>.
          </div>`;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flussi Definitivi Componenti — OP10</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
.container { max-width: 1300px; margin: 0 auto; }
h1 { color: #60a5fa; font-size: 22px; margin-bottom: 6px; }
.subtitle { color: #94a3b8; font-size: 13px; margin-bottom: 20px; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.stat { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center; }
.stat-val { color: #60a5fa; font-size: 22px; font-weight: 700; }
.stat-lbl { color: #94a3b8; font-size: 11px; margin-top: 4px; }

.warning { background: #451a03; border: 1px solid #92400e; color: #fcd34d; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.6; }
.warning code { background: #78350f; padding: 1px 5px; border-radius: 3px; font-size: 12px; }

.filter-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 13px; }
.filter-btn.active { background: #1d4ed8; border-color: #3b82f6; color: white; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(580px, 1fr)); gap: 16px; }

.card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #334155; }
.proj-tag { background: #1d4ed8; color: white; font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
.comp-name { color: #60a5fa; font-size: 16px; }
.card-stats { display: flex; gap: 12px; font-size: 12px; color: #94a3b8; }

.phases { display: flex; flex-direction: column; gap: 8px; }
.phase { background: #0f172a; padding: 10px 12px; border-radius: 6px; }
.phase-row { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.step-num { background: #334155; color: #94a3b8; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.fase-label { flex: 1; font-weight: 500; }
.badge { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 600; flex-shrink: 0; }
.badge-ok   { background: #166534; color: #86efac; }
.badge-type { background: #1e3a5f; color: #93c5fd; font-style: italic; }
.zona { color: #64748b; font-size: 11px; flex-shrink: 0; }
.ore { color: #10b981; font-weight: 700; font-size: 13px; flex-shrink: 0; min-width: 40px; text-align: right; }
.phase-detail { font-size: 11px; color: #475569; margin-top: 4px; padding-left: 32px; }

.mats { margin-top: 12px; padding-top: 10px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; }

.legend { display: flex; gap: 16px; margin-bottom: 16px; font-size: 12px; align-items: center; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-box { width: 12px; height: 12px; border-radius: 2px; }
</style>
</head>
<body>
<div class="container">
    <h1>📊 Flussi DEFINITIVI Componenti — Programmazione OP10</h1>
    <p class="subtitle">Fonte dati: componente_fasi Supabase · Lotto default 1200 pz · OEE 85% · Changeover 1h</p>

    <div class="stats">
        <div class="stat"><div class="stat-val">${totalComps}</div><div class="stat-lbl">Componenti</div></div>
        <div class="stat"><div class="stat-val">${projects.length}</div><div class="stat-lbl">Progetti</div></div>
        <div class="stat"><div class="stat-val">${avgH.toFixed(1)}h</div><div class="stat-lbl">Tempo medio</div></div>
        <div class="stat"><div class="stat-val">${(avgH/8).toFixed(1)}d</div><div class="stat-lbl">Giorni lavorativi</div></div>
    </div>

    ${warningBanner}

    <div class="legend">
        <span style="color:#94a3b8">Legenda macchine:</span>
        <div class="legend-item"><span class="badge badge-ok">SCA10191</span> Macchina specifica configurata</div>
        <div class="legend-item"><span class="badge badge-type">[SCA]</span> Tipo macchina (da configurare)</div>
        <div class="legend-item" style="color:#94a3b8">Colori bordo: <span style="color:#3b82f6">■ T11 Soft</span> &nbsp; <span style="color:#8b5cf6">■ T12 Hard</span> &nbsp; <span style="color:#10b981">■ T13 RG/DH</span></div>
    </div>

    <div class="filter-bar" id="filters">
        <button class="filter-btn active" data-proj="ALL" onclick="filterProject(this)">Tutti</button>
        ${projects.map(p => `<button class="filter-btn" data-proj="${p}" onclick="filterProject(this)">${p}</button>`).join('')}
    </div>

    <div class="grid" id="grid">
        ${cardsHtml}
    </div>
</div>
<script>
function filterProject(btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const proj = btn.dataset.proj;
    document.querySelectorAll('.card').forEach(card => {
        const tag = card.querySelector('.proj-tag')?.textContent || '';
        card.style.display = (proj === 'ALL' || tag === proj) ? '' : 'none';
    });
}
</script>
</body>
</html>`;

    const htmlPath = '/Users/angelofato/Documents/turno-app copia/public/definitive-component-flows.html';
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ HTML: ${htmlPath}`);

    console.log(`\n📊 Riepilogo:`);
    console.log(`   Componenti: ${totalComps}`);
    console.log(`   Progetti: ${projects.join(', ')}`);
    console.log(`   Tempo medio: ${avgH.toFixed(1)}h (${(avgH/8).toFixed(1)}d)`);
    if (!hasMachineData) {
        console.log(`\n⚠️  material_fino_overrides vuoto — macchine specifiche non ancora configurate.`);
        console.log(`   Usa ComponentFlowView nell'app per assegnarle.`);
    }
}

main().catch(console.error);
