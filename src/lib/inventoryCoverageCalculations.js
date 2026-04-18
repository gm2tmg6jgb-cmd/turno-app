import { supabase } from './supabase';
import { getLocalDate } from './dateUtils';

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
