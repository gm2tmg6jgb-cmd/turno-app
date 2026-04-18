import { supabase } from './supabase';
import { getLocalDate } from './dateUtils';

/**
 * Calcola la data del giorno X giorni da oggi
 */
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Calcola il numero di giorni tra due date (può essere negativo)
 */
const daysUntil = (targetDate) => {
  const today = new Date(getLocalDate(new Date()));
  const target = new Date(targetDate);
  const diffMs = target - today;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Fetch materiali associati a un componente e progetto
 */
export const getMaterialsForComponent = async (componente, progetto) => {
  const { data, error } = await supabase
    .from('anagrafica_materiali')
    .select('codice')
    .eq('componente', componente)
    .eq('progetto', progetto);

  if (error) {
    console.error('Error fetching materials:', error);
    return [];
  }

  return data?.map(m => m.codice) || [];
};

/**
 * Fetch produzioni per un componente nei giorni specificati
 */
const fetchComponentProductions = async (materials, endDate) => {
  if (materials.length === 0) return [];

  const { data, error } = await supabase
    .from('conferme_sap')
    .select('data, qta_ottenuta')
    .in('materiale', materials)
    .lte('data', endDate)
    .order('data', { ascending: false });

  if (error) {
    console.error('Error fetching productions:', error);
    return [];
  }

  return data || [];
};

/**
 * Calcola la media di produzione giornaliera (ultimi N giorni)
 */
export const calculateThroughput = (productions, days = 3) => {
  if (productions.length === 0) return 1; // fallback

  // Raggruppa per data e somma quantità
  const byDate = {};
  productions.forEach(p => {
    if (!byDate[p.data]) byDate[p.data] = 0;
    byDate[p.data] += p.qta_ottenuta || 0;
  });

  const dateCount = Object.keys(byDate).length;
  if (dateCount === 0) return 1;

  const total = Object.values(byDate).reduce((sum, val) => sum + val, 0);
  return total / dateCount; // media giornaliera
};

/**
 * Fetch produzione totale effettiva per un componente fino a una data
 */
export const fetchComponentActualQuantity = async (materials, endDate) => {
  if (materials.length === 0) return 0;

  const { data, error } = await supabase
    .from('conferme_sap')
    .select('qta_ottenuta')
    .in('materiale', materials)
    .lte('data', endDate);

  if (error) {
    console.error('Error fetching actual quantities:', error);
    return 0;
  }

  return data?.reduce((sum, row) => sum + (row.qta_ottenuta || 0), 0) || 0;
};

/**
 * Fetch macchine coinvolte nella produzione di un componente
 */
export const getMachinesForComponent = async (materials) => {
  if (materials.length === 0) return [];

  const { data, error } = await supabase
    .from('conferme_sap')
    .select('macchina_id')
    .in('materiale', materials);

  if (error) {
    console.error('Error fetching machines:', error);
    return [];
  }

  return [...new Set(data?.map(m => m.macchina_id) || [])];
};

/**
 * Calcola il slack e lo status per un deadline
 */
export const calculateDeadlineMetrics = (
  quantitaTarget,
  quantitaEffettiva,
  deadlineDate
) => {
  const quantitaMancante = Math.max(0, quantitaTarget - quantitaEffettiva);
  const giorniResidui = daysUntil(deadlineDate);

  // Calcolo: assume throughput di 25 pezzi/giorno (fallback conservativo)
  const DEFAULT_THROUGHPUT = 25;
  const giorniNecessari = quantitaMancante > 0
    ? Math.ceil(quantitaMancante / DEFAULT_THROUGHPUT)
    : 0;

  const slack = giorniResidui - giorniNecessari;

  // Determinare status
  let status = 'ON_TRACK';
  if (slack < 0) {
    status = 'CRITICO';
  } else if (slack < 2) {
    status = 'WARNING';
  }

  const eta = slack < 0
    ? new Date(deadlineDate) // già scaduto
    : addDays(new Date(getLocalDate(new Date())), giorniNecessari);

  return {
    quantitaMancante,
    giorniResidui,
    giorniNecessari,
    slack,
    status,
    eta: getLocalDate(eta),
    throughputAssumed: DEFAULT_THROUGHPUT
  };
};

/**
 * Arricchisci un deadline con metriche calcolate
 */
export const enrichDeadline = async (deadline) => {
  try {
    // Fetch materiali del componente
    const materials = await getMaterialsForComponent(deadline.componente, deadline.progetto);

    // Fetch produzioni attuali
    const productions = await fetchComponentProductions(materials, deadline.deadline_date);
    const quantitaEffettiva = productions.reduce((sum, p) => sum + (p.qta_ottenuta || 0), 0);

    // Calcola throughput reale
    const throughputReale = calculateThroughput(productions, 3);

    // Calcola metriche di slack
    const metrics = calculateDeadlineMetrics(
      deadline.quantita_target,
      quantitaEffettiva,
      deadline.deadline_date
    );

    // Fetch macchine coinvolte
    const machines = await getMachinesForComponent(materials);

    return {
      ...deadline,
      quantita_effettiva: quantitaEffettiva,
      quantita_mancante: metrics.quantitaMancante,
      giorni_residui: metrics.giorniResidui,
      giorni_necessari: metrics.giorniNecessari,
      slack: metrics.slack,
      status: metrics.status,
      eta: metrics.eta,
      throughput: Math.round(throughputReale),
      machines,
      materials
    };
  } catch (error) {
    console.error('Error enriching deadline:', error);
    // Return con valori di fallback
    return {
      ...deadline,
      quantita_effettiva: 0,
      quantita_mancante: deadline.quantita_target,
      giorni_residui: daysUntil(deadline.deadline_date),
      giorni_necessari: 0,
      slack: 0,
      status: 'UNKNOWN',
      eta: getLocalDate(new Date()),
      throughput: 0,
      machines: [],
      materials: [],
      error: error.message
    };
  }
};

/**
 * Fetch tutti i deadline e arricchisci con metriche
 */
export const fetchProductionDeadlines = async (filters = {}) => {
  try {
    let query = supabase
      .from('production_deadlines')
      .select('*');

    // Filtro per progetto (opzionale)
    if (filters.progetto) {
      query = query.eq('progetto', filters.progetto);
    }

    // Filtro per componente (opzionale)
    if (filters.componente) {
      query = query.eq('componente', filters.componente);
    }

    // Filtro per intervallo date (default: ultimi 7 giorni + futuri)
    const startDate = filters.startDate || getLocalDate(new Date(new Date().setDate(new Date().getDate() - 7)));
    const endDate = filters.endDate || getLocalDate(new Date(new Date().setDate(new Date().getDate() + 60)));

    query = query
      .gte('deadline_date', startDate)
      .lte('deadline_date', endDate)
      .order('deadline_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching deadlines:', error);
      return [];
    }

    // Arricchisci ogni deadline con metriche
    const enriched = await Promise.all(
      (data || []).map(deadline => enrichDeadline(deadline))
    );

    // Ordina per slack (minimo in alto = critici prima)
    return enriched.sort((a, b) => a.slack - b.slack);
  } catch (error) {
    console.error('Error in fetchProductionDeadlines:', error);
    return [];
  }
};

/**
 * Crea un nuovo deadline
 */
export const createProductionDeadline = async (deadline) => {
  const { data, error } = await supabase
    .from('production_deadlines')
    .insert([{
      progetto: deadline.progetto,
      componente: deadline.componente,
      quantita_target: deadline.quantita_target,
      deadline_date: deadline.deadline_date,
      data_inizio: deadline.data_inizio || null,
      priorita_override: deadline.priorita_override || null,
      note: deadline.note || null
    }])
    .select();

  if (error) {
    console.error('Error creating deadline:', error);
    throw error;
  }

  return data?.[0] || null;
};

/**
 * Update un deadline
 */
export const updateProductionDeadline = async (id, updates) => {
  const { data, error } = await supabase
    .from('production_deadlines')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating deadline:', error);
    throw error;
  }

  return data?.[0] || null;
};

/**
 * Cancella un deadline
 */
export const deleteProductionDeadline = async (id) => {
  const { error } = await supabase
    .from('production_deadlines')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting deadline:', error);
    throw error;
  }

  return true;
};

/**
 * Log storico di delay (opzionale)
 */
export const logComponentDelay = async (deadline, enrichedData) => {
  const { error } = await supabase
    .from('component_delay_logs')
    .insert([{
      componente: deadline.componente,
      progetto: deadline.progetto,
      deadline_date: deadline.deadline_date,
      quantita_target: deadline.quantita_target,
      quantita_effettiva: enrichedData.quantita_effettiva,
      quantita_mancante: enrichedData.quantita_mancante,
      giorni_residui: enrichedData.giorni_residui,
      slack_giorni: enrichedData.slack,
      status: enrichedData.status,
      data_log: getLocalDate(new Date())
    }])
    .select();

  if (error) {
    console.error('Error logging delay:', error);
    // Non lanciare errore, è opzionale
  }
};
