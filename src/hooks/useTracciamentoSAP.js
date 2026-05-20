/**
 * useTracciamentoSAP
 *
 * Hook React per tracciare il flusso produttivo partendo dalle conferme SAP.
 *
 * Input: conferme SAP (da TurnoApp import)
 * Output: timeline, conflitti, bottleneck, KPI
 */

import { useState, useMemo } from 'react';
import {
  COMPONENTI_CONFIG,
  MAC_CONDIVISE,
  getFlussoCompleto,
  durataOP,
  opPrecedente,
  getComponennteDaConferma,
  getMacchinaOP,
  isOpCondivisa
} from '../config/componenti-config';

const TRASPORTO_MIN = 5; // Tempo trasporto tra macchine

/**
 * Estrae il codice operazione da work_center_sap (formato: "OP0020", "HT", etc.)
 */
function extractOpCode(workCenter) {
  if (!workCenter) return '';
  // Formato tipico: "0020", "HT", etc.
  const match = workCenter.match(/(\d{4}|HT)/);
  return match ? match[1] : workCenter;
}

/**
 * HOOK PRINCIPALE
 *
 * Prende le conferme SAP e le processa per ottenere:
 * - Timeline per ogni componente
 * - Conflitti su macchine condivise
 * - Bottleneck
 * - KPI (lead time, fine target, etc.)
 */
export function useTracciamentoSAP(conferme_sap = [], data_inizio = null) {

  // Se non ci sono conferme, usa dati mock
  const conferme = conferme_sap.length > 0 ? conferme_sap : generateMockConferme();

  // Elabora i dati
  const elaborati = useMemo(() => {
    return elaboraConferme(conferme, data_inizio);
  }, [conferme, data_inizio]);

  return elaborati;
}

/**
 * ELABORAZIONE PRINCIPALE
 */
function elaboraConferme(conferme_sap, data_inizio = null) {

  if (conferme_sap.length > 0) {
    console.log('📊 Primo record SAP:', conferme_sap[0]);
    console.log('📊 Colonne disponibili:', Object.keys(conferme_sap[0]));
    console.log('📊 work_center_sap value:', conferme_sap[0].work_center_sap);
    console.log('📊 op_code value:', conferme_sap[0].op_code);
    console.log('📊 qta_ottenuta value:', conferme_sap[0].qta_ottenuta);
    console.log('📊 materiale value:', conferme_sap[0].materiale);

    // Mostra primi 5 record con quantità
    const sample = conferme_sap.slice(0, 5).map(c => ({
      work_center_sap: c.work_center_sap,
      op_code: c.op_code,
      qta_ottenuta: c.qta_ottenuta,
      materiale: c.materiale
    }));
    console.log('📊 Sample 5 record:', sample);
  }

  // Normalizza i dati SAP: mappa qta_ottenuta → acquisito
  const confermeSapNormalizzate = conferme_sap.map(conf => ({
    ...conf,
    // Usa qta_ottenuta se disponibile, altrimenti acquisito (per compatibilità con mock)
    acquisito: conf.qta_ottenuta ?? conf.acquisito ?? 0,
    // Mappa op_code da work_center_sap se necessario
    op_code: conf.op_code ?? extractOpCode(conf.work_center_sap)
  }));

  // Raggruppa per componente
  const per_comp = {};
  for (const comp of Object.keys(COMPONENTI_CONFIG)) {
    per_comp[comp] = [];
  }

  for (const conf of confermeSapNormalizzate) {
    const comp = getComponennteDaConferma(conf.materiale);
    if (comp) {
      per_comp[comp].push(conf);
    }
  }

  // Calcola timeline per ogni componente
  const timelines = {};
  const bottleneck_per_comp = {};

  for (const comp in per_comp) {
    const conferme = per_comp[comp];
    const qty = COMPONENTI_CONFIG[comp].target_giornaliero;

    const tl = calcolaTimeline(comp, qty, conferme, data_inizio);
    timelines[comp] = tl;
    bottleneck_per_comp[comp] = trovaBottleneck(tl.timeline);
  }

  // Calcola conflitti su macchine condivise
  const conflitti = calcolaConflitti(timelines);

  // KPI globali
  const kpi = calcolaKPI(timelines, conflitti);

  return {
    timelines,
    conflitti,
    bottleneck_per_comp,
    kpi,
    elaborati_ok: true
  };
}

/**
 * CALCOLA TIMELINE PER UN COMPONENTE
 *
 * Traccia il percorso da OP0020 a OP0250, calcolando:
 * - Data di inizio (quando è pronto)
 * - Data di fine
 * - Attesa su macchine condivise
 */
function calcolaTimeline(comp, quantita, conferme_sap, data_inizio_base) {

  const cfg = COMPONENTI_CONFIG[comp];
  const flusso = getFlussoCompleto(comp);
  const timeline = [];

  // Data inizio: primo giorno 08:00 (oppure da parametro)
  let tempo_min = 0;
  if (data_inizio_base) {
    tempo_min = Math.floor((new Date(data_inizio_base) - new Date()) / (1000 * 60));
  }

  for (const {op, fase} of flusso) {
    const dur = durataOP(comp, op, quantita);
    const mac = getMacchinaOP(comp, op);
    const is_condivisa = isOpCondivisa(comp, op);

    // Trova la conferma SAP se esiste
    const conf_sap = conferme_sap.find(c => c.op_code === op);

    timeline.push({
      comp,
      op,
      desc: cfg.ops[op]?.desc || '—',
      fase,
      mac,
      quantita,
      jph: cfg.ops[op]?.jph || 0,
      changeover: cfg.ops[op]?.co || 0,
      durata_min: dur,
      inizio_min: tempo_min,
      fine_min: tempo_min + dur,
      attesa_min: 0,  // Aggiunto dalle macchine condivise
      is_condivisa,
      conferma_sap: conf_sap ? conf_sap.acquisito : null,
      priorita: null  // Aggiunto dalle macchine condivise
    });

    tempo_min += dur;
  }

  return {
    comp,
    quantita,
    target_giornaliero: cfg.target_giornaliero,
    timeline,
    lead_time_min: tempo_min,
    lead_time_ore: (tempo_min / 60).toFixed(1),
    lead_time_giorni: (tempo_min / (8 * 60)).toFixed(1)
  };
}

/**
 * CALCOLA CONFLITTI SU MACCHINE CONDIVISE
 *
 * Per ogni macchina condivisa, calcola l'ordine FIFO e le attese.
 */
function calcolaConflitti(timelines) {

  const conflitti = {};

  for (const mac in MAC_CONDIVISE) {
    const ops_lista = MAC_CONDIVISE[mac];
    const ops_timeline = [];

    // Raccogli tutte le OP su questa macchina
    for (const {comp, op} of ops_lista) {
      const tl = timelines[comp];
      if (!tl) continue;

      const riga = tl.timeline.find(r => r.op === op);
      if (riga) {
        ops_timeline.push({
          comp,
          op,
          inizio_min: riga.inizio_min,
          fine_min: riga.fine_min,
          durata_min: riga.durata_min
        });
      }
    }

    // Ordina per FIFO (inizio_min)
    ops_timeline.sort((a, b) => a.inizio_min - b.inizio_min);

    // Calcola attese
    let tempo_libero = 0;
    const con_attese = ops_timeline.map((op, idx) => {
      const ini = Math.max(op.inizio_min, tempo_libero);
      const fine = ini + op.durata_min;
      const attesa = Math.max(0, tempo_libero - op.inizio_min);

      tempo_libero = fine;

      return {
        ...op,
        priorita: idx + 1,
        inizio_reale: ini,
        fine_reale: fine,
        attesa_min: attesa
      };
    });

    conflitti[mac] = {
      mac,
      n_comps: ops_lista.length,
      ops: con_attese,
      tempo_totale_occupazione: tempo_libero
    };
  }

  return conflitti;
}

/**
 * TROVA BOTTLENECK PER COMPONENTE
 *
 * Identifica le 5 OP più lunghe.
 */
function trovaBottleneck(timeline) {

  return timeline
    .sort((a, b) => b.durata_min - a.durata_min)
    .slice(0, 5)
    .map((op, idx) => ({
      rank: idx + 1,
      op: op.op,
      desc: op.desc,
      mac: op.mac,
      durata_min: op.durata_min,
      durata_ore: (op.durata_min / 60).toFixed(1),
      pct_lead: ((op.durata_min / timeline.reduce((s, x) => s + x.durata_min, 0)) * 100).toFixed(1)
    }));
}

/**
 * CALCOLA KPI GLOBALI
 */
function calcolaKPI(timelines, conflitti) {

  const comps = Object.keys(timelines);

  // Lead time per ogni componente
  const lead_times = comps.map(comp => ({
    comp,
    lead_time_min: timelines[comp].lead_time_min,
    lead_time_ore: timelines[comp].lead_time_ore
  }));

  // Lead time massimo (quello che arriva ultimo)
  const max_lead = Math.max(...lead_times.map(x => x.lead_time_min));

  // Conteggi
  const n_comps = comps.length;
  const n_macs_condivise = Object.keys(conflitti).length;

  // Bottleneck globale (tutte le OP)
  const all_ops = [];
  for (const comp in timelines) {
    all_ops.push(...timelines[comp].timeline);
  }
  const bottleneck_global = all_ops
    .sort((a, b) => b.durata_min - a.durata_min)
    .slice(0, 3)
    .map(op => ({
      comp: op.comp,
      op: op.op,
      desc: op.desc,
      durata_ore: (op.durata_min / 60).toFixed(1)
    }));

  return {
    n_comps,
    n_macs_condivise,
    lead_time_min_max: max_lead,
    lead_time_ore_max: (max_lead / 60).toFixed(1),
    lead_time_giorni_max: (max_lead / (8 * 60)).toFixed(1),
    lead_times,
    bottleneck_global,
    warning: bottleneck_global[0]?.durata_ore > 24 ? 'HT è bottleneck massimo' : null
  };
}

/**
 * MOCK CONFERME SAP (per testing)
 */
function generateMockConferme() {
  // Se non ci sono dati SAP, ritorna un array vuoto
  // In produzione, questi dati verranno da TurnoApp import
  return [];
}

/**
 * UTILITY: Formatta tempo in ore/minuti
 */
export function formatTempo(minuti) {
  const ore = Math.floor(minuti / 60);
  const min = Math.floor(minuti % 60);
  return `${ore}:${String(min).padStart(2, '0')}`;
}

/**
 * UTILITY: Calcola data/ora da inizio
 */
export function dataOra(minuti_da_inizio, data_start = new Date()) {
  const data = new Date(data_start);
  data.setMinutes(data.getMinutes() + minuti_da_inizio);
  return data;
}
