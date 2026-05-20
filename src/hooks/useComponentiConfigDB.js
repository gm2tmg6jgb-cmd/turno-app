/**
 * useComponentiConfigDB
 *
 * Carica la configurazione dei componenti da Supabase (tabella componente_ops).
 * Sostituisce il hardcoding in componenti-config.js.
 *
 * Una volta caricata, è disponibile ovunque nell'app senza riconfigurare.
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

let _cache = null; // Cache globale: caricata una volta per sessione

/**
 * Converte le righe dal DB nel formato COMPONENTI_CONFIG usato dall'app.
 *
 * Input DB (array di righe):
 *   { componente, op_code, macchina, descrizione, jph, changeover_min, fase, ordine, ht_batch_size, ht_durata_ore, target_giornaliero, codice_materiale_* }
 *
 * Output (oggetto):
 *   { SG3: { codice, nome, target_giornaliero, materiali, ht_batch, ht_durata_ore, flusso_soft, flusso_hard, ops }, ... }
 */
function buildConfig(rows) {
  const config = {};

  for (const row of rows) {
    const comp = row.componente;

    if (!config[comp]) {
      config[comp] = {
        codice: row.codice_materiale_hard || comp,
        nome: comp,
        colore: _defaultColor(comp),
        target_giornaliero: row.target_giornaliero || 550,
        materiali: {
          soft: row.codice_materiale_soft,
          ht:   row.codice_materiale_ht,
          hard: row.codice_materiale_hard
        },
        ht_batch: null,
        ht_durata_ore: null,
        flusso_soft: [],
        flusso_hard: [],
        ops: {}
      };
    }

    const cfg = config[comp];

    // HT: prendi batch e durata
    if (row.fase === 'ht') {
      cfg.ht_batch = row.ht_batch_size;
      cfg.ht_durata_ore = row.ht_durata_ore;
    }

    // Aggiungi al flusso ordinato
    if (row.fase === 'soft') cfg.flusso_soft.push(row.op_code);
    if (row.fase === 'hard') cfg.flusso_hard.push(row.op_code);

    // Definizione op
    cfg.ops[row.op_code] = {
      desc: row.descrizione,
      jph:  row.jph || 0,
      mac:  row.macchina,
      co:   row.changeover_min || 0
    };
  }

  // Ordina i flussi per campo ordine (già ordinati dalla query ORDER BY ordine)
  // ma li abbiamo aggiunti in ordine, quindi ok.

  return config;
}

const COLORS = ['blue', 'purple', 'green', 'orange', 'red', 'teal'];
let _colorIdx = 0;
const _colorMap = {};
function _defaultColor(comp) {
  if (!_colorMap[comp]) _colorMap[comp] = COLORS[_colorIdx++ % COLORS.length];
  return _colorMap[comp];
}

/**
 * Hook principale.
 *
 * Ritorna:
 *   { config, loading, error }
 *
 * `config` ha la stessa struttura di COMPONENTI_CONFIG in componenti-config.js.
 */
export function useComponentiConfigDB() {
  const [rows, setRows]     = useState(_cache);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (_cache) return; // già caricato in questa sessione

    supabase
      .from('componente_ops')
      .select('*')
      .order('componente')
      .order('ordine')
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          _cache = data;
          setRows(data);
        }
        setLoading(false);
      });
  }, []);

  const config = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return buildConfig(rows);
  }, [rows]);

  return { config, loading, error };
}

/**
 * Versione asincrona per contesti non-React (es. hook useTracciamentoSAP).
 * Usa la stessa cache globale.
 */
export async function loadComponentiConfig() {
  if (_cache) return buildConfig(_cache);

  const { data, error } = await supabase
    .from('componente_ops')
    .select('*')
    .order('componente')
    .order('ordine');

  if (error) throw new Error(error.message);

  _cache = data;
  return buildConfig(data);
}

/**
 * Invalida la cache (usa dopo modifiche alla config nel DB).
 */
export function invalidateComponentiConfig() {
  _cache = null;
}
