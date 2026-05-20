/**
 * SchedulingTab
 *
 * Componente React per la nuova tab "Scheduling" in TurnoApp.
 *
 * Funzionalità:
 * - Tracciamento SAP in tempo reale
 * - Timeline Gantt parallela (SG3, SG2, etc.)
 * - Scheduling priorità macchine condivise
 * - KPI e bottleneck
 *
 * Integrazione TurnoApp:
 * - Riceve le conferme SAP come props (da sezione import già esistente)
 * - Usa i dati per calcolare tracciamento
 */

import React, { useState, useMemo } from 'react';
import { useTracciamentoSAP, formatTempo, dataOra } from '../hooks/useTracciamentoSAP';
import { COMPONENTI_CONFIG, getAllComponenti, getAllMacchineCondivise } from '../config/componenti-config';

export function SchedulingTab({ conferme_sap = [], componentiConfig = null }) {

  // Usa la config estratta o quella hardcoded
  const configAttiva = componentiConfig || COMPONENTI_CONFIG;

  // Hook di tracciamento - NOTA: useTracciamentoSAP usa ancora COMPONENTI_CONFIG hardcoded
  // TODO: Passare configAttiva a useTracciamentoSAP
  const {
    timelines,
    conflitti,
    bottleneck_per_comp,
    kpi,
    elaborati_ok
  } = useTracciamentoSAP(conferme_sap);

  // Filtra solo i componenti che hanno una timeline calcolata
  const componentiDisponibili = useMemo(() => {
    return Object.keys(configAttiva).filter(comp => timelines[comp]);
  }, [configAttiva, timelines]);

  // State UI
  const [tab_attivo, setTabAttivo] = useState('timeline');
  const [comp_selezionato, setCompSelezionato] = useState(
    componentiDisponibili[0] || 'SG3'
  );

  if (!elaborati_ok || componentiDisponibili.length === 0) {
    return (
      <div style={{padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)'}}>
        <p>Nessun dato disponibile. Importa le conferme SAP.</p>
      </div>
    );
  }

  // Assicurati che il componente selezionato esista ancora
  const compSicuro = timelines[comp_selezionato] ? comp_selezionato : componentiDisponibili[0];
  const tl_comp = timelines[compSicuro];

  if (!tl_comp) {
    return (
      <div style={{padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)'}}>
        <p>Componente non disponibile.</p>
      </div>
    );
  }

  return (
    <div style={{padding: '1.5rem'}}>

      {/* HEADER */}
      <div style={{marginBottom: '2rem'}}>
        <h2 style={{fontSize: '18px', fontWeight: 500, marginBottom: '0.5rem'}}>
          Scheduling & Priorità Macchine Condivise
        </h2>
        <p style={{fontSize: '13px', color: 'var(--color-text-secondary)'}}>
          Tracciamento SAP, bottleneck, lead time 550 pz/giorno
        </p>
      </div>

      {/* SELECTOR COMPONENTI */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
        {componentiDisponibili.map(comp => (
          <button
            key={comp}
            onClick={() => setCompSelezionato(comp)}
            style={{
              padding: '8px 16px',
              border: compSicuro === comp
                ? '0.5px solid var(--color-border-primary)'
                : '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              background: compSicuro === comp
                ? 'var(--color-background-secondary)'
                : 'transparent',
              color: compSicuro === comp
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            {comp} ({configAttiva[comp]?.codice || comp})
          </button>
        ))}
      </div>

      {/* KPI CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '2rem'
      }}>
        <KPICard
          label="Lead time"
          value={tl_comp.lead_time_ore}
          unit="h"
        />
        <KPICard
          label="Giorni lavorativi"
          value={tl_comp.lead_time_giorni}
          unit="gg"
        />
        <KPICard
          label="Fine target"
          value={dataOra(tl_comp.lead_time_min).toLocaleDateString('it-IT', {weekday: 'short', hour: '2-digit', minute: '2-digit'})}
          unit=""
        />
        <KPICard
          label="Bottleneck"
          value={bottleneck_per_comp[comp_selezionato][0]?.op}
          unit={`${bottleneck_per_comp[comp_selezionato][0]?.durata_ore}h`}
        />
      </div>

      {/* TABS */}
      <div style={{borderBottom: '0.5px solid var(--color-border-tertiary)', marginBottom: '1.5rem'}}>
        {['timeline', 'conflitti', 'bottleneck'].map(tab => (
          <button
            key={tab}
            onClick={() => setTabAttivo(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              color: tab_attivo === tab
                ? 'var(--color-text-primary)'
                : 'var(--color-text-secondary)',
              borderBottom: tab_attivo === tab
                ? '2px solid var(--color-text-primary)'
                : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: tab_attivo === tab ? '-1px' : '0'
            }}
          >
            {tab === 'timeline' && 'Timeline'}
            {tab === 'conflitti' && 'Conflitti macchine'}
            {tab === 'bottleneck' && 'Bottleneck'}
          </button>
        ))}
      </div>

      {/* CONTENUTO TAB */}
      {tab_attivo === 'timeline' && (
        <TabTimeline tl={tl_comp} comp={comp_selezionato} />
      )}

      {tab_attivo === 'conflitti' && (
        <TabConflitti conflitti={conflitti} comp={comp_selezionato} />
      )}

      {tab_attivo === 'bottleneck' && (
        <TabBottleneck bottleneck={bottleneck_per_comp[comp_selezionato]} kpi={kpi} />
      )}
    </div>
  );
}

/**
 * TAB 1: TIMELINE
 */
function TabTimeline({ tl, comp }) {

  const cfg = COMPONENTI_CONFIG[comp];
  const fasi = ['soft', 'ht', 'hard'];

  return (
    <div>
      <Alert>
        Target {cfg.target_giornaliero} pz: Partenza lunedì 08:00,
        arrivo {dataOra(tl.lead_time_min).toLocaleDateString('it-IT', {weekday: 'long', hour: '2-digit', minute: '2-digit'})}
      </Alert>

      {fasi.map(fase => {
        const ops = tl.timeline.filter(r => r.fase === fase);
        return (
          <div key={fase} style={{marginBottom: '2rem'}}>
            <h3 style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Fase {fase === 'soft' ? '1: Soft' : fase === 'ht' ? '2: Heat Treatment' : '3: Hard'}
            </h3>

            {ops.map((op, idx) => (
              <TimelineRow key={idx} op={op} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * TAB 2: CONFLITTI MACCHINE CONDIVISE
 */
function TabConflitti({ conflitti, comp }) {

  const macs_da_controllare = getAllMacchineCondivise();

  return (
    <div>
      <Alert>
        {macs_da_controllare.length} macchine condivise: Scheduling FIFO per evitare attese.
        Leggi i dati SAP in tempo reale.
      </Alert>

      {macs_da_controllare.map(mac => {
        const conf = conflitti[mac];
        if (!conf) return null;

        return (
          <ConflictCard key={mac} conflitto={conf} />
        );
      })}
    </div>
  );
}

/**
 * TAB 3: BOTTLENECK
 */
function TabBottleneck({ bottleneck, kpi }) {

  return (
    <div>
      <Alert>
        Bottleneck critico: {bottleneck[0]?.op} ({bottleneck[0]?.durata_ore}h) occupa
        il {bottleneck[0]?.pct_lead}% del lead time totale.
        Ottimizzazione: parallelizza le OP dedicate.
      </Alert>

      <div style={{marginBottom: '2rem'}}>
        <h3 style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Top 5 operazioni più lunghe
        </h3>

        {bottleneck.map((op, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            padding: '10px',
            background: 'var(--color-background-secondary)',
            borderRadius: 'var(--border-radius-md)',
            border: '0.5px solid var(--color-border-tertiary)'
          }}>
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-secondary)',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              OP{op.op}
            </span>
            <span style={{fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)'}}>
              {op.desc}
            </span>
            <div style={{
              flex: 1,
              height: '20px',
              background: 'var(--color-background-tertiary)',
              borderRadius: '3px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                height: '100%',
                background: '#378ADD',
                width: `${Math.min(100, (op.durata_ore / 32) * 100)}%`,
                borderRadius: '2px'
              }} />
            </div>
            <span style={{fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '60px'}}>
              {op.durata_ore}h ({op.pct_lead}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * COMPONENTI RIUTILIZZABILI
 */

function KPICard({ label, value, unit }) {
  return (
    <div style={{
      background: 'var(--color-background-secondary)',
      borderRadius: 'var(--border-radius-md)',
      padding: '1rem',
      border: 'none'
    }}>
      <div style={{
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {label}
      </div>
      <div style={{fontSize: '24px', fontWeight: 500, color: 'var(--color-text-primary)'}}>
        {value}<span style={{fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '4px', fontWeight: 400}}>{unit}</span>
      </div>
    </div>
  );
}

function TimelineRow({ op }) {
  if (!op.quantita || op.quantita === 0) {
    console.warn('⚠️ OP senza quantita:', op.op, op.mac, 'quantita=', op.quantita);
  }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '10px',
      padding: '10px',
      background: 'var(--color-background-secondary)',
      borderRadius: 'var(--border-radius-md)',
      border: '0.5px solid var(--color-border-tertiary)'
    }}>
      <span style={{
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        background: op.fase === 'soft' ? '#E6F1FB' : op.fase === 'ht' ? '#EAF3DE' : '#EEEDFE',
        color: op.fase === 'soft' ? '#0C447C' : op.fase === 'ht' ? '#27500A' : '#3C3489',
        border: 'none',
        minWidth: '40px',
        textAlign: 'center'
      }}>
        OP{op.op}
      </span>

      <span style={{fontSize: '12px', fontWeight: 500, color: 'var(--color-text-primary)', minWidth: '100px'}}>
        {op.mac}
      </span>

      <div style={{
        flex: 1,
        height: '20px',
        background: 'var(--color-background-tertiary)',
        borderRadius: '3px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          height: '100%',
          background: op.fase === 'soft' ? '#378ADD' : op.fase === 'ht' ? '#639922' : '#534AB7',
          width: `${Math.min(100, (op.durata_min / 1000) * 100)}%`,
          borderRadius: '2px'
        }} />
      </div>

      <span style={{fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '80px'}}>
        {formatTempo(op.inizio_min)} → {formatTempo(op.fine_min)}
      </span>

      <span style={{
        fontSize: '12px',
        fontWeight: 700,
        color: '#10b981',
        minWidth: '70px',
        textAlign: 'right',
        padding: '4px 8px',
        background: 'rgba(16, 185, 129, 0.1)',
        borderRadius: '4px'
      }}>
        {(op.conferma_sap ?? op.quantita)?.toLocaleString('it-IT') || 0} pz
      </span>
    </div>
  );
}

function ConflictCard({ conflitto }) {
  const maxTime = Math.max(...conflitto.ops.map(op => op.fine_reale), 100);

  return (
    <div style={{
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: '1rem 1.25rem',
      marginBottom: '12px',
      background: 'var(--color-background-primary)'
    }}>
      <div style={{marginBottom: '12px'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
          <span style={{fontSize: '13px', fontWeight: 600}}>🔧 {conflitto.mac}</span>
          <span style={{fontSize: '11px', color: 'var(--color-text-secondary)'}}>
            Tempo totale: {formatTempo(conflitto.tempo_totale_occupazione)}
          </span>
        </div>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        {conflitto.ops.map((op, idx) => (
          <div key={idx} style={{
            padding: '10px',
            background: 'var(--color-background-secondary)',
            borderRadius: '6px',
            border: '0.5px solid var(--color-border-secondary)'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: op.comp === 'SG3' ? '#E6F1FB' : '#EEEDFE',
                  color: op.comp === 'SG3' ? '#0C447C' : '#3C3489',
                  minWidth: '50px',
                  textAlign: 'center'
                }}>
                  {op.comp} OP{op.op}
                </span>
                <span style={{fontSize: '12px', fontWeight: 500}}>
                  P{op.priorita}
                </span>
              </div>
              <div style={{fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'right'}}>
                <div>{formatTempo(op.inizio_reale)} → {formatTempo(op.fine_reale)}</div>
                {op.attesa_min > 0 && <div style={{color: '#ef4444', fontWeight: 500}}>Attesa: {formatTempo(op.attesa_min)}</div>}
              </div>
            </div>

            <div style={{height: '4px', background: 'var(--color-background-tertiary)', borderRadius: '2px', position: 'relative', overflow: 'hidden'}}>
              <div style={{
                position: 'absolute',
                height: '100%',
                background: op.comp === 'SG3' ? '#378ADD' : '#534AB7',
                width: `${Math.min(100, (op.durata_min / maxTime) * 100)}%`,
                borderRadius: '1px'
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Alert({ children }) {
  return (
    <div style={{
      padding: '12px',
      borderRadius: 'var(--border-radius-md)',
      borderLeft: '3px solid var(--color-text-warning)',
      fontSize: '12px',
      marginBottom: '1rem',
      background: 'var(--color-background-warning)',
      color: 'var(--color-text-primary)'
    }}>
      ⚠️ {children}
    </div>
  );
}
