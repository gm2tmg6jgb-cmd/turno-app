#!/usr/bin/env node

/**
 * Script per generare la mappa REALE di flusso di ogni componente
 * Legge da Supabase la configurazione effettiva di ogni componente
 */

import fs from 'fs';

// Credenziali Supabase
const SUPABASE_URL = 'https://osrgdvrhffpslanlpxub.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lG-AIpyAKGHUSqrey_mjpw_TPkq5k5U';

// Parametri default
const DEFAULT_LOTTO = 1200;
const DEFAULT_OEE = 0.85;
const DEFAULT_CHANGEOVER = 1;

/**
 * Fetch dati da Supabase
 */
async function fetchComponentPhases() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/componente_fasi?select=*&order=progetto,componente,id`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Accept': 'application/json'
                }
            }
        );
        return await response.json();
    } catch (err) {
        console.error('❌ Errore fetching dati:', err);
        return [];
    }
}

/**
 * Calcola ore per una fase
 */
function calculatePhaseHours(phase, lotto = DEFAULT_LOTTO, oee = DEFAULT_OEE) {
    const changeoverH = phase.noChangeOver ? 0 : DEFAULT_CHANGEOVER;

    if (phase.fixedH) {
        // Tempo fisso (es. forno)
        if (phase.chargeSize) {
            const numCharges = Math.ceil(lotto / phase.chargeSize);
            return (numCharges * phase.fixedH) + changeoverH;
        }
        return phase.fixedH + changeoverH;
    }

    // Tempo variabile
    const pzH = phase.pzH || 1;
    return (lotto / (pzH * oee)) + changeoverH;
}

/**
 * Genera HTML per ogni componente
 */
function generateComponentHTML(component, phases) {
    const totalHours = phases.reduce((sum, p) => sum + p.hours, 0);
    const maxHours = Math.max(...phases.map(p => p.hours));

    let html = `
    <div class="component-card">
        <h3>${component.progetto}::<strong>${component.componente}</strong></h3>
        <div class="phases-timeline">
    `;

    phases.forEach((phase, idx) => {
        const percentage = (phase.hours / maxHours) * 100;
        const days = (phase.hours / 8).toFixed(1);

        html += `
            <div class="phase-item">
                <div class="phase-header">
                    <span class="phase-num">${idx + 1}.</span>
                    <span class="phase-name">${phase.fase_label}</span>
                    <span class="phase-time">${phase.hours.toFixed(1)}h (${days}d)</span>
                </div>
                <div class="phase-bar-container">
                    <div class="phase-bar" style="width: ${percentage}%"></div>
                </div>
                <div class="phase-details">${phase.fase_id}</div>
            </div>
        `;
    });

    const totalDays = (totalHours / 8).toFixed(1);
    html += `
        </div>
        <div class="component-summary">
            <strong>⏱️ Tempo totale: ${totalHours.toFixed(1)}h (${totalDays} giorni)</strong>
        </div>
    </div>
    `;

    return html;
}

/**
 * Main
 */
async function main() {
    console.log('📥 Scaricamento configurazione componenti da Supabase...\n');

    const allPhases = await fetchComponentPhases();

    // Raggruppa per componente
    const componentMap = {};
    allPhases.forEach(phase => {
        const key = `${phase.progetto}::${phase.componente}`;
        if (!componentMap[key]) {
            componentMap[key] = {
                progetto: phase.progetto,
                componente: phase.componente,
                phases: []
            };
        }

        const hours = calculatePhaseHours(phase);
        componentMap[key].phases.push({
            ...phase,
            hours
        });
    });

    // Genera HTML
    let html = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flussi Reali Componenti</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 30px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #60a5fa; margin-bottom: 30px; }
        .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-box {
            background: #1e293b;
            border: 1px solid #334155;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value { color: #60a5fa; font-weight: 600; font-size: 20px; }
        .stat-label { font-size: 12px; color: #94a3b8; margin-top: 5px; }

        .components-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
        }

        .component-card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
        }

        .component-card h3 {
            color: #60a5fa;
            margin-bottom: 15px;
            font-size: 16px;
        }

        .phases-timeline {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .phase-item {
            background: #0f172a;
            padding: 12px;
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
        }

        .phase-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            font-size: 13px;
        }

        .phase-num {
            background: #3b82f6;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 11px;
        }

        .phase-name {
            flex: 1;
            font-weight: 500;
            color: #e2e8f0;
        }

        .phase-time {
            color: #60a5fa;
            font-weight: 600;
        }

        .phase-bar-container {
            background: #0f172a;
            height: 4px;
            border-radius: 2px;
            overflow: hidden;
        }

        .phase-bar {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #1d4ed8);
        }

        .phase-details {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }

        .component-summary {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #334155;
            color: #10b981;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Flussi REALI di Ogni Componente (da Supabase)</h1>

        <div class="stats">
    `;

    // Statistiche
    const projects = [...new Set(Object.values(componentMap).map(c => c.progetto))];
    const totalComponents = Object.keys(componentMap).length;
    const avgTime = Object.values(componentMap).reduce((sum, c) => sum + c.phases.reduce((s, p) => s + p.hours, 0), 0) / totalComponents;

    html += `
            <div class="stat-box">
                <div class="stat-value">${totalComponents}</div>
                <div class="stat-label">Componenti totali</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${projects.length}</div>
                <div class="stat-label">Progetti</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${avgTime.toFixed(1)}h</div>
                <div class="stat-label">Tempo medio</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${(avgTime/8).toFixed(1)}d</div>
                <div class="stat-label">Giorni lavorativi</div>
            </div>
        </div>

        <div class="components-grid">
    `;

    // Genera card per ogni componente (ordinato)
    Object.values(componentMap)
        .sort((a, b) => {
            if (a.progetto !== b.progetto) return a.progetto.localeCompare(b.progetto);
            return a.componente.localeCompare(b.componente);
        })
        .forEach(comp => {
            html += generateComponentHTML(comp, comp.phases);
        });

    html += `
        </div>
    </div>
</body>
</html>
    `;

    // Salva file
    const outputPath = '/Users/angelofato/Documents/turno-app copia/public/real-component-flows.html';
    fs.writeFileSync(outputPath, html);
    console.log(`✅ File generato: ${outputPath}`);
    console.log(`\n📊 Componenti trovati: ${totalComponents}`);
    console.log(`📁 Progetti: ${projects.join(', ')}`);
    console.log(`⏱️ Tempo medio: ${avgTime.toFixed(1)}h (${(avgTime/8).toFixed(1)} giorni)`);
}

main().catch(console.error);
