/**
 * CONFIGURAZIONE COMPONENTI
 *
 * Struttura centralizzata per tutti i componenti del progetto 8Fe.
 * Facile da estendere: basta aggiungere un nuovo componente e il sistema funziona automaticamente.
 */

export const COMPONENTI_CONFIG = {
  SG3: {
    codice: 'M0153401',
    nome: 'SG3',
    colore: 'blue',
    target_giornaliero: 550,

    materiali: {
      soft: 'M0153401/S',      // Soft turning
      ht: 'M0153401/T',        // Heat treatment
      hard: 'M0153401'         // Hard turning
    },

    ht_batch: 144,  // Pezzi per carica forno
    ht_durata_ore: 8,

    flusso_soft: ['0020', '0030', '0050', '0060', '0080', '0090'],
    flusso_hard: ['0110', '0120', '0230', '0250'],

    ops: {
      '0020': {desc: 'Soft turning', jph: 20, mac: 'DRA10071', co: 60},
      '0030': {desc: 'DMC', jph: 240, mac: 'ZSA11019/22', co: 5},
      '0050': {desc: 'Laser', jph: 128, mac: 'SCA11008', co: 30},
      '0060': {desc: 'Laser 2', jph: 128, mac: 'SCA11010', co: 30},
      '0080': {desc: 'Hobbing', jph: 70, mac: 'FRW10077', co: 30},
      '0090': {desc: 'Deburring', jph: 72, mac: 'EGW11015', co: 20},
      'HT': {desc: 'Heat treatment', jph: 0, mac: 'FORNO', co: 0},
      '0110': {desc: 'Grinding Cone', jph: 38, mac: 'SLA11108', co: 60},
      '0120': {desc: 'Hard turning', jph: 92, mac: 'DRA10009', co: 0},
      '0230': {desc: 'Grinding Teeth', jph: 60, mac: 'SLW11010', co: 60},
      '0250': {desc: 'Final Washing', jph: 300, mac: 'WAS-001', co: 0}
    }
  },

  SG2: {
    codice: 'M0153389',
    nome: 'SG2',
    colore: 'purple',
    target_giornaliero: 550,

    materiali: {
      soft: 'M0153389/S',      // Soft turning
      ht: 'M0153389/T',        // Heat treatment
      hard: 'M0153389'         // Hard turning
    },

    ht_batch: 120,  // Pezzi per carica forno
    ht_durata_ore: 8,

    flusso_soft: ['0020', '0030', '0060', '0080', '0090'],
    flusso_hard: ['0120', '0230', '0250'],

    ops: {
      '0020': {desc: 'Soft turning', jph: 78, mac: 'DRA10063/64', co: 120},
      '0030': {desc: 'DMC', jph: 240, mac: 'ZSA11019/22', co: 5},
      '0060': {desc: 'Laser', jph: 128, mac: 'SCA11010', co: 30},
      '0080': {desc: 'Hobbing', jph: 70, mac: 'FRW10193', co: 30},
      '0090': {desc: 'Deburring', jph: 72, mac: 'EGW11016', co: 0},
      'HT': {desc: 'Heat treatment', jph: 0, mac: 'FORNO', co: 0},
      '0120': {desc: 'Hard turning', jph: 80, mac: 'DRA10110/111', co: 120},
      '0230': {desc: 'Grinding Teeth', jph: 56, mac: 'SLW11048', co: 60},
      '0250': {desc: 'Final Washing', jph: 300, mac: 'WAS-001', co: 0}
    }
  }

  // PER AGGIUNGERE ALTRI COMPONENTI (es. SG4):
  // Copia la struttura SG3 o SG2 e modifica codice, target, materiali, ops
  // Il sistema si aggiorna automaticamente!
};

/**
 * MACCHINE CONDIVISE
 *
 * Elenca le operazioni su macchine usate da più componenti.
 * Usato per calcolare priorità FIFO e conflitti.
 */
export const MAC_CONDIVISE = {
  'ZSA11019/22': [
    { comp: 'SG3', op: '0030' },
    { comp: 'SG2', op: '0030' }
  ],
  'SCA11010': [
    { comp: 'SG3', op: '0060' },
    { comp: 'SG2', op: '0060' }
  ],
  'WAS-001': [
    { comp: 'SG3', op: '0250' },
    { comp: 'SG2', op: '0250' }
  ]
};

/**
 * FLUSSO COMPLETO (SOFT → HT → HARD)
 *
 * Ritorna l'ordine di tutte le fasi per un componente.
 */
export function getFlussoCompleto(comp, config = COMPONENTI_CONFIG) {
  const cfg = config[comp];
  if (!cfg) return [];

  return [
    ...cfg.flusso_soft.map(op => ({ op, fase: 'soft' })),
    { op: 'HT', fase: 'ht' },
    ...cfg.flusso_hard.map(op => ({ op, fase: 'hard' }))
  ];
}

/**
 * DURATA DI UN'OPERAZIONE
 *
 * Calcola il tempo (in minuti) per completare un'OP.
 * Formula: changeover + (quantita / JPH) * 60
 */
export function durataOP(comp, op, quantita, config = COMPONENTI_CONFIG) {
  const cfg = config[comp];
  if (!cfg) return 0;

  // HT è un caso speciale: dipende dal batch size
  if (op === 'HT') {
    const n_cariche = Math.ceil(quantita / cfg.ht_batch);
    return n_cariche * cfg.ht_durata_ore * 60;
  }

  const info = cfg.ops[op];
  if (!info) return 0;

  if (info.jph === 0) return info.co || 30;

  return Math.round(info.co + (quantita / info.jph) * 60);
}

/**
 * OPERAZIONE PRECEDENTE
 *
 * Ritorna l'OP che viene prima di quella passata nel flusso.
 */
export function opPrecedente(comp, op) {
  const flusso = getFlussoCompleto(comp);
  const idx = flusso.findIndex(x => x.op === op);
  return idx > 0 ? flusso[idx - 1].op : null;
}

/**
 * COMPONENTE DALLE CONFERME SAP
 *
 * Dato un numero di conferma (es. "2511108150/S"), ritorna il componente (SG3, SG2, etc.)
 * In base al codice materiale.
 */
export function getComponennteDaConferma(materiale, config = COMPONENTI_CONFIG) {
  for (const [comp, cfg] of Object.entries(config)) {
    if (
      materiale === cfg.materiali.soft ||
      materiale === cfg.materiali.ht ||
      materiale === cfg.materiali.hard
    ) {
      return comp;
    }
  }
  return null;
}

/**
 * MACCHINA PER UN'OPERAZIONE
 */
export function getMacchinaOP(comp, op, config = COMPONENTI_CONFIG) {
  const cfg = config[comp];
  if (!cfg) return '—';
  return cfg.ops[op]?.mac || '—';
}

/**
 * CONTROLLA SE UN'OP USA UNA MACCHINA CONDIVISA
 */
export function isOpCondivisa(comp, op) {
  for (const mac in MAC_CONDIVISE) {
    const ops = MAC_CONDIVISE[mac];
    if (ops.some(x => x.comp === comp && x.op === op)) {
      return mac;
    }
  }
  return null;
}

/**
 * LISTA TUTTI I COMPONENTI
 */
export function getAllComponenti() {
  return Object.keys(COMPONENTI_CONFIG);
}

/**
 * LISTA TUTTE LE MACCHINE CONDIVISE
 */
export function getAllMacchineCondivise() {
  return Object.keys(MAC_CONDIVISE);
}
