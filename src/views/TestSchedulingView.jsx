/**
 * TestSchedulingView
 *
 * View di test per il componente SchedulingTab
 * Mostra timeline, conflitti e bottleneck dei componenti
 */

import React from 'react';
import { SchedulingTab } from '../components/SchedulingTab';
import { getComponennteDaConferma } from '../config/componenti-config';

// Dati mock di conferme SAP per il test
const CONFERME_SAP_MOCK = [
  // SG3 - Conferme soft turning
  { materiale: 'M0153401/S', op_code: '0020', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/S', op_code: '0030', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/S', op_code: '0050', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/S', op_code: '0060', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/S', op_code: '0080', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/S', op_code: '0090', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401/T', op_code: 'HT', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401', op_code: '0110', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401', op_code: '0120', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401', op_code: '0230', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153401', op_code: '0250', componente: 'SG3', acquisito: 550, data: '2026-05-20' },
  // SG2 - Conferme soft turning
  { materiale: 'M0153389/S', op_code: '0020', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389/S', op_code: '0030', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389/S', op_code: '0060', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389/S', op_code: '0080', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389/S', op_code: '0090', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389/T', op_code: 'HT', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389', op_code: '0120', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389', op_code: '0230', componente: 'SG2', acquisito: 550, data: '2026-05-20' },
  { materiale: 'M0153389', op_code: '0250', componente: 'SG2', acquisito: 550, data: '2026-05-20' }
];

export default function TestSchedulingView({ conferme_sap = [], material_fino_overrides = [] }) {

  // Arricchisci i dati SAP con il campo fino dai material_fino_overrides
  const confermeSapArricchite = React.useMemo(() => {
    if (conferme_sap.length === 0) return [];

    return conferme_sap.map(conf => {
      const matCode = (conf.materiale || '').toUpperCase();

      // Trova il mapping nel material_fino_overrides
      const override = material_fino_overrides.find(o =>
        (o.materiale || '').toUpperCase() === matCode
      );

      return {
        ...conf,
        fino: override?.fino || conf.fino,
        op_code: override?.fino || conf.op_code
      };
    });
  }, [conferme_sap, material_fino_overrides]);

  // Estrai il flusso di ogni componente dai dati SAP
  const componentiConfig = React.useMemo(() => {
    const dataset = confermeSapArricchite.length > 0 ? confermeSapArricchite : CONFERME_SAP_MOCK;
    const config = {};

    // Raggruppa per componente e estrai l'ordine dei fino
    const byComp = {};
    const orderMap = {};

    dataset.forEach((conf, idx) => {
      const comp = conf.componente || getComponennteDaConferma(conf.materiale) || 'UNKNOWN';
      const fino = conf.op_code || conf.fino || 'unknown';

      if (!byComp[comp]) {
        byComp[comp] = new Set();
        orderMap[comp] = {};
      }

      byComp[comp].add(fino);
      if (!orderMap[comp][fino]) orderMap[comp][fino] = idx;
    });

    // Crea config per ogni componente
    Object.entries(byComp).forEach(([comp, finiSet]) => {
      const fini = Array.from(finiSet).sort((a, b) => orderMap[comp][a] - orderMap[comp][b]);
      const softFini = fini.filter(f => !['HT', 'UNKNOWN'].includes(f) && parseInt(f) < 100);
      const hardFini = fini.filter(f => !['HT', 'UNKNOWN'].includes(f) && parseInt(f) >= 100);

      config[comp] = {
        codice: comp,
        nome: comp,
        target_giornaliero: 550,
        materiali: { soft: `${comp}/S`, ht: `${comp}/T`, hard: comp },
        ht_batch: 144,
        ht_durata_ore: 8,
        flusso_soft: softFini,
        flusso_hard: hardFini,
        ops: Object.fromEntries(
          fini.map(fino => [
            fino,
            { desc: fino, jph: 100, mac: 'TBD', co: 30 }
          ])
        )
      };
    });

    return config;
  }, [confermeSapArricchite]);

  // Log per verificare quale dataset viene usato
  React.useEffect(() => {
    const dataset = confermeSapArricchite.length > 0 ? confermeSapArricchite : CONFERME_SAP_MOCK;
    console.log('📊 Dataset usato:', confermeSapArricchite.length > 0 ? 'SAP REALI' : 'MOCK');
    console.log('📊 Numero conferme:', dataset.length);
    console.log('📊 Componenti estratti:', Object.keys(componentiConfig).length);
    console.log('📊 Config:', componentiConfig);

    // Mostra la distribuzione dei pezzi per operazione
    const byOp = {};
    dataset.forEach(conf => {
      const op = conf.op_code || conf.fino || 'unknown';
      if (!byOp[op]) byOp[op] = [];
      byOp[op].push(conf.qta_ottenuta || conf.acquisito || 0);
    });

    console.log('📊 Pezzi per operazione:', Object.entries(byOp).map(([op, qtys]) =>
      `${op}: ${qtys.length} record, quantità: ${[...new Set(qtys)].join(', ')}`
    ).join(' | '));
  }, [confermeSapArricchite.length, componentiConfig]);

  return (
    <div style={{
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div style={{maxWidth: '1400px', margin: '0 auto'}}>

        {/* Header */}
        <div style={{marginBottom: '2rem'}}>
          <h1 style={{fontSize: '28px', fontWeight: 700, marginBottom: '0.5rem'}}>
            🧪 Test Scheduling & Tracciamento SAP
          </h1>
          <p style={{fontSize: '14px', color: 'var(--text-secondary)'}}>
            Componente di prova per timeline, conflitti e bottleneck analysis
          </p>
        </div>

        {/* Info Box */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>
            <strong>ℹ️ {conferme_sap.length > 0 ? 'Dati SAP Reali' : 'Dati Mock'}:</strong> {(conferme_sap.length > 0 ? conferme_sap : CONFERME_SAP_MOCK).length} conferme SAP
          </div>
          <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '0.5rem'}}>
            {conferme_sap.length > 0 ? '✅ Caricati dai dati SAP del database' : '⚠️ Dati mock per test'}
            <br/>
            Seleziona un componente per visualizzare timeline, conflitti su macchine condivise e bottleneck
          </div>
        </div>

        {/* SchedulingTab Component */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '1rem'
        }}>
          <SchedulingTab
            conferme_sap={confermeSapArricchite.length > 0 ? confermeSapArricchite : CONFERME_SAP_MOCK}
            componentiConfig={Object.keys(componentiConfig).length > 0 ? componentiConfig : null}
          />
        </div>

      </div>
    </div>
  );
}
