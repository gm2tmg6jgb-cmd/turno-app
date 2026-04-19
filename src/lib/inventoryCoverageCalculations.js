import { supabase } from './supabase';
import { getLocalDate, getCurrentWeekMonday, getCurrentWeekRange } from './dateUtils';

/**
 * Fetch inventario disponibile per componente/progetto/linea
 */
export const getComponentInventory = async (componente, progetto, linea) => {
  const { data, error } = await supabase
    .from('component_inventory')
    .select('qty_disponibile, data_aggiornamento')
    .eq('componente', componente)
    .eq('progetto', progetto)
    .eq('linea', linea)
    .single();

  if (error) {
    console.warn('Inventario non trovato:', { componente, progetto, linea });
    return 0;
  }

  return data?.qty_disponibile || 0;
};

/**
 * Fetch consumo orario per componente/progetto/linea
 */
export const getComponentConsumption = async (componente, progetto, linea) => {
  const { data, error } = await supabase
    .from('component_consumption')
    .select('pz_per_ora, tempo_ciclo_minuti')
    .eq('componente', componente)
    .eq('progetto', progetto)
    .eq('linea', linea)
    .single();

  if (error) {
    console.warn('Consumo non configurato:', { componente, progetto, linea });
    return 0; // Default: nessun consumo configurato
  }

  return parseFloat(data?.pz_per_ora) || 0;
};

/**
 * Calcola la copertura dell'inventario in giorni
 * coverage_days = inventario_disponibile / (consumo_orario * 8 ore_lavoro)
 */
export const calculateInventoryCoverage = (qtyDisponibile, pzPerOra) => {
  if (pzPerOra === 0 || !pzPerOra) return Infinity; // Nessun consumo = infinita copertura

  const WORKING_HOURS_PER_DAY = 8;
  const dailyConsumption = pzPerOra * WORKING_HOURS_PER_DAY;

  if (dailyConsumption === 0) return Infinity;

  const coverageDays = qtyDisponibile / dailyConsumption;
  return Math.max(0, coverageDays); // Non può essere negativo
};

/**
 * Determina lo status basato sulla copertura in giorni
 */
export const getCoverageStatus = (coverageDays) => {
  if (coverageDays < 1) return 'CRITICO';
  if (coverageDays < 5) return 'WARNING';
  return 'ON_TRACK';
};

/**
 * Calcola la data di esaurimento dell'inventario
 */
export const calculateStockoutDate = (qtyDisponibile, pzPerOra) => {
  const coverageDays = calculateInventoryCoverage(qtyDisponibile, pzPerOra);

  if (coverageDays === Infinity) {
    return null; // Nessun consumo configurato
  }

  const today = new Date(getLocalDate(new Date()));
  const stockoutDate = new Date(today);
  stockoutDate.setDate(stockoutDate.getDate() + Math.floor(coverageDays));

  return getLocalDate(stockoutDate);
};

/**
 * Fetch tutte le righe di inventario per una linea di montaggio
 * Arricchisce con calcoli di copertura
 */
export const fetchLineInventoryCoverage = async (linea, progetto) => {
  try {
    // Fetch inventario per questa linea e progetto
    const { data: inventoryData, error: invError } = await supabase
      .from('component_inventory')
      .select('*')
      .eq('linea', linea)
      .eq('progetto', progetto);

    if (invError) {
      console.error('Error fetching inventory:', invError);
      return [];
    }

    if (!inventoryData || inventoryData.length === 0) {
      console.warn(`No inventory found for linea=${linea}, progetto=${progetto}`);
      return [];
    }

    // Per ogni componente, fetch consumo e calcola copertura
    const enriched = await Promise.all(
      inventoryData.map(async (inv) => {
        const consumption = await getComponentConsumption(inv.componente, inv.progetto, inv.linea);
        const coverageDays = calculateInventoryCoverage(inv.qty_disponibile, consumption);
        const status = getCoverageStatus(coverageDays);
        const stockoutDate = calculateStockoutDate(inv.qty_disponibile, consumption);

        return {
          ...inv,
          pz_per_ora: consumption,
          coverage_days: Math.round(coverageDays * 10) / 10, // 1 decimal
          status,
          stockout_date: stockoutDate,
          priority: 1 / (coverageDays + 0.1) // Lower coverage = higher priority
        };
      })
    );

    // Ordina per copertura crescente (meno scorta = primo)
    return enriched.sort((a, b) => a.coverage_days - b.coverage_days);
  } catch (error) {
    console.error('Error in fetchLineInventoryCoverage:', error);
    return [];
  }
};

/**
 * Fetch inventario per TUTTI i progetti e linee (overview generale)
 */
export const fetchAllInventoryCoverage = async () => {
  try {
    const { data, error } = await supabase
      .from('component_inventory')
      .select('*')
      .order('progetto', { ascending: true });

    if (error) {
      console.error('Error fetching all inventory:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.warn('No inventory data found');
      return [];
    }

    // Arricchisci con calcoli di copertura
    const enriched = await Promise.all(
      data.map(async (inv) => {
        const consumption = await getComponentConsumption(inv.componente, inv.progetto, inv.linea);
        const coverageDays = calculateInventoryCoverage(inv.qty_disponibile, consumption);
        const status = getCoverageStatus(coverageDays);
        const stockoutDate = calculateStockoutDate(inv.qty_disponibile, consumption);

        return {
          ...inv,
          pz_per_ora: consumption,
          coverage_days: Math.round(coverageDays * 10) / 10,
          status,
          stockout_date: stockoutDate,
          priority: 1 / (coverageDays + 0.1)
        };
      })
    );

    // Ordina per copertura crescente globalmente
    return enriched.sort((a, b) => a.coverage_days - b.coverage_days);
  } catch (error) {
    console.error('Error in fetchAllInventoryCoverage:', error);
    return [];
  }
};

/**
 * Salva o aggiorna l'inventario
 */
export const saveComponentInventory = async (componente, progetto, linea, qtyDisponibile) => {
  const { data, error } = await supabase
    .from('component_inventory')
    .upsert({
      componente,
      progetto,
      linea,
      qty_disponibile: parseInt(qtyDisponibile),
      data_aggiornamento: new Date().toISOString()
    }, {
      onConflict: 'componente,progetto,linea'
    })
    .select();

  if (error) {
    console.error('Error saving inventory:', error);
    throw error;
  }

  return data?.[0] || null;
};

/**
 * Salva o aggiorna la configurazione di consumo
 */
export const saveComponentConsumption = async (componente, progetto, linea, pzPerOra, tempoCicloMinuti = null) => {
  const { data, error } = await supabase
    .from('component_consumption')
    .upsert({
      componente,
      progetto,
      linea,
      pz_per_ora: parseFloat(pzPerOra),
      tempo_ciclo_minuti: tempoCicloMinuti ? parseFloat(tempoCicloMinuti) : null
    }, {
      onConflict: 'componente,progetto,linea'
    })
    .select();

  if (error) {
    console.error('Error saving consumption:', error);
    throw error;
  }

  return data?.[0] || null;
};

/**
 * Calcola il consumo orario da tempo ciclo
 * pz_per_ora = 60 / tempo_ciclo_minuti
 */
export const calculateConsumptionFromCycleTime = (timeCycleMinutes) => {
  if (!timeCycleMinutes || timeCycleMinutes === 0) return 0;
  return Math.round((60 / timeCycleMinutes) * 100) / 100; // 2 decimals
};

/**
 * Fetch quantità effettivamente prodotta questa settimana per un componente
 * Legge da conferme_sap usando material_fino_overrides (come ComponentFlowView)
 * @private
 */
const fetchWeeklyProducedQuantity = async (componente, progetto, weekStart, weekEnd) => {
  try {
    // Fetch material_fino_overrides per questo componente
    const { data: overrides } = await supabase
      .from('material_fino_overrides')
      .select('materiale')
      .eq('componente', componente)
      .eq('progetto', progetto);

    if (!overrides || overrides.length === 0) return 0;

    const materiali = overrides.map(o => o.materiale.toUpperCase());

    // Fetch conferme_sap per questa settimana, questi materiali
    const { data: produzioni } = await supabase
      .from('conferme_sap')
      .select('qta_ottenuta')
      .in('materiale', materiali)
      .gte('data', weekStart)
      .lte('data', weekEnd);

    // Somma le quantità
    return (produzioni || []).reduce((sum, p) => sum + (p.qta_ottenuta || 0), 0);
  } catch (error) {
    console.error('Error in fetchWeeklyProducedQuantity:', error);
    return 0;
  }
};

/**
 * Calcola il ritardo settimanale per ogni componente
 * Legge: target settimanale vs prodotto effettivo (da conferme_sap)
 * Ritorna: gap, giorni_per_recuperare, priority
 *
 * Priority = copertura_inventario / giorni_per_recuperare_gap
 * Più BASSA la priority → Più URGENTE il componente
 */
export const fetchWeeklyComponentPriorities = async () => {
  try {
    // 1. Prendi la settimana corrente (lunedì - domenica)
    const { monday: weekStart, sunday: weekEnd } = getCurrentWeekRange();

    // 2. Fetch tutti i target settimanali per questa settimana
    const { data: targetsData, error: targetsError } = await supabase
      .from('component_weekly_targets')
      .select('*')
      .eq('week_start', weekStart);

    if (targetsError) {
      console.error('Error fetching weekly targets:', targetsError.message || JSON.stringify(targetsError));
      console.error('Full error:', targetsError);
      return [];
    }

    if (!targetsData || targetsData.length === 0) {
      console.warn('No weekly targets found for week starting', weekStart);
      return [];
    }

    // 3. Per ogni target, calcola il prodotto effettivo e la priority
    const enriched = await Promise.all(
      targetsData.map(async (target) => {
        try {
          // Fetch inventario disponibile
          const qty = await getComponentInventory(target.componente, target.progetto, target.linea);

          // Fetch consumo orario
          const pz_per_ora = await getComponentConsumption(target.componente, target.progetto, target.linea);

          // Fetch prodotto reale della settimana
          const produced = await fetchWeeklyProducedQuantity(
            target.componente,
            target.progetto,
            weekStart,
            weekEnd
          );

          // Calcoli
          const gap = Math.max(0, target.target_qty - produced);
          const daysToRecover = gap > 0 && pz_per_ora > 0 ? Math.ceil(gap / pz_per_ora / 8) : 0;
          const coverageDays = calculateInventoryCoverage(qty, pz_per_ora);

          // PRIORITY: inventario_giorni / giorni_per_recuperare
          // Protezione: se non c'è gap, priority = Infinity (non urgente)
          let priority = Infinity;
          if (gap > 0 && daysToRecover > 0) {
            priority = Math.round((coverageDays / (daysToRecover + 0.1)) * 100) / 100;
          }

          // STATUS basato su gap + copertura
          let status = 'ON_TRACK';
          if (gap > 0 && coverageDays < 2) {
            status = 'CRITICO';
          } else if (gap > 0 && coverageDays < 5) {
            status = 'WARNING';
          } else if (gap > 0) {
            status = 'WARNING';
          }

          return {
            ...target,
            qty_disponibile: qty,
            pz_per_ora,
            produced,
            gap,
            days_to_recover: daysToRecover,
            coverage_days: Math.round(coverageDays * 10) / 10,
            priority,
            status,
            stockout_date: calculateStockoutDate(qty, pz_per_ora)
          };
        } catch (error) {
          console.error('Error enriching weekly target:', target, error);
          return {
            ...target,
            qty_disponibile: 0,
            pz_per_ora: 0,
            produced: 0,
            gap: target.target_qty,
            days_to_recover: 0,
            coverage_days: 0,
            priority: 0,
            status: 'UNKNOWN',
            stockout_date: null
          };
        }
      })
    );

    // Ordina per PRIORITY (crescente = più urgente prima)
    // Infinity (no gap) finisce in fondo
    return enriched.sort((a, b) => {
      if (a.priority === Infinity && b.priority === Infinity) return 0;
      if (a.priority === Infinity) return 1; // a va dopo
      if (b.priority === Infinity) return -1; // b va dopo
      return a.priority - b.priority;
    });
  } catch (error) {
    console.error('Error in fetchWeeklyComponentPriorities:', error);
    return [];
  }
};

/**
 * Nuova logica: Target per PROGETTO distribuito pro-rata tra COMPONENTI
 *
 * Flusso:
 * 1. Fetch target per progetto (project_weekly_targets)
 * 2. Fetch tutti i componenti di ogni progetto (PROJECT_COMPONENTS)
 * 3. Per ogni componente, calcola la sua % di produzione
 * 4. Distribuisci il target del progetto pro-rata
 * 5. Calcola gap e priorità per componente
 */
export const fetchProjectComponentPriorities = async (PROJECT_COMPONENTS) => {
  try {
    const { monday: weekStart, sunday: weekEnd } = getCurrentWeekRange();

    // 1. Fetch target per progetto
    const { data: projectTargets, error: targetsError } = await supabase
      .from('project_weekly_targets')
      .select('progetto, linea, target_qty')
      .eq('week_start', weekStart);

    if (targetsError) {
      console.error('Error fetching project targets:', targetsError.message || targetsError);
      return [];
    }

    if (!projectTargets || projectTargets.length === 0) {
      console.warn('No project targets found for week starting', weekStart);
      return [];
    }

    // 2. Per ogni progetto, elabora i componenti
    const allComponentData = [];

    for (const projectTarget of projectTargets) {
      const componentiProgetto = PROJECT_COMPONENTS[projectTarget.progetto] || [];
      if (componentiProgetto.length === 0) continue;

      // Calcola la produzione totale del progetto e per componente
      const componentProductionMap = {};
      let totalProjectProduction = 0;

      for (const componente of componentiProgetto) {
        const produced = await fetchWeeklyProducedQuantity(
          componente,
          projectTarget.progetto,
          weekStart,
          weekEnd
        );
        componentProductionMap[componente] = produced;
        totalProjectProduction += produced;
      }

      // 3. Distribuisci il target pro-rata della produzione di ogni componente
      for (const componente of componentiProgetto) {
        try {
          const componentProduced = componentProductionMap[componente];

          // Calcola la % di produzione di questo componente
          const productionRatio = totalProjectProduction > 0
            ? componentProduced / totalProjectProduction
            : 1 / componentiProgetto.length; // Se nessuno produce, distribuisci equamente

          // Target per questo componente = target progetto × ratio
          const componentTarget = Math.floor(projectTarget.target_qty * productionRatio);

          // Inventario e consumo del componente
          const qty = await getComponentInventory(componente, projectTarget.progetto, projectTarget.linea);
          const pz_per_ora = await getComponentConsumption(componente, projectTarget.progetto, projectTarget.linea);

          // Gap e calcoli
          const gap = Math.max(0, componentTarget - componentProduced);
          const daysToRecover = gap > 0 && pz_per_ora > 0 ? Math.ceil(gap / pz_per_ora / 8) : 0;
          const coverageDays = calculateInventoryCoverage(qty, pz_per_ora);

          // Priority
          let priority = Infinity;
          if (gap > 0 && daysToRecover > 0) {
            priority = Math.round((coverageDays / (daysToRecover + 0.1)) * 100) / 100;
          }

          // Status
          let status = 'ON_TRACK';
          if (gap > 0 && coverageDays < 2) {
            status = 'CRITICO';
          } else if (gap > 0 && coverageDays < 5) {
            status = 'WARNING';
          } else if (gap > 0) {
            status = 'WARNING';
          }

          allComponentData.push({
            componente,
            progetto: projectTarget.progetto,
            linea: projectTarget.linea,
            qty_disponibile: qty,
            pz_per_ora,
            target_qty: componentTarget,
            produced: componentProduced,
            gap,
            days_to_recover: daysToRecover,
            coverage_days: Math.round(coverageDays * 10) / 10,
            priority,
            status,
            stockout_date: calculateStockoutDate(qty, pz_per_ora),
            production_ratio: Math.round(productionRatio * 100) // %
          });
        } catch (error) {
          console.error('Error processing component:', componente, error);
          // Continua con il prossimo componente
        }
      }
    }

    // Ordina per priority (crescente = più urgente)
    return allComponentData.sort((a, b) => {
      if (a.priority === Infinity && b.priority === Infinity) return 0;
      if (a.priority === Infinity) return 1;
      if (b.priority === Infinity) return -1;
      return a.priority - b.priority;
    });
  } catch (error) {
    console.error('Error in fetchProjectComponentPriorities:', error);
    return [];
  }
};
