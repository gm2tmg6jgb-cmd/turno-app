import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useInventoryAnalysis(project, component, startDate, endDate) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project || !component || !startDate || !endDate) return;

    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch SAP conferme nel periodo
        const { data: sapData, error: sapError } = await supabase
          .from('conferme_sap')
          .select('data, materiale, fino, qta_ottenuta, qta_scarto, work_center_sap, macchina_id')
          .gte('data', startDate)
          .lte('data', endDate);

        if (sapError) throw sapError;

        // 2. Fetch target da componente_avanzamento
        const { data: targetData, error: targetError } = await supabase
          .from('componente_avanzamento')
          .select('*')
          .eq('componente', component)
          .eq('progetto', project)
          .single();

        // targetError non è critico se la riga non esiste

        // 3. Aggregazione e calcoli
        const analysis = calculateAnalysis(sapData, targetData, startDate, endDate);
        setData(analysis);
      } catch (err) {
        console.error('[useInventoryAnalysis] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [project, component, startDate, endDate]);

  return { data, loading, error };
}

function calculateAnalysis(sapData, targetData, startDate, endDate) {
  // Aggregazione SAP per fase
  const phaseInventory = aggregateSAPByPhase(sapData);

  // Calcolo ciclo time medio per fase
  const cycleTimesPerPhase = calculateCycleTimes(sapData);

  // Identificazione bottleneck
  const bottleneckPhase = identifyBottleneck(phaseInventory, targetData);

  // Calcolo urgency score
  const urgencyScore = calculateUrgencyScore(targetData, phaseInventory, cycleTimesPerPhase);

  // Previsione completamento
  const completionDate = estimateCompletionDate(phaseInventory, cycleTimesPerPhase, targetData);

  // Raccomandazioni intelligenti
  const recommendations = generateRecommendations(
    phaseInventory,
    bottleneckPhase,
    urgencyScore,
    cycleTimesPerPhase,
    targetData
  );

  return {
    phaseInventory,
    targetProgress: targetData || {},
    cycleTimesPerPhase,
    bottleneckPhase,
    urgencyScore,
    recommendations,
    completionDate,
    analysisRange: { startDate, endDate }
  };
}

function aggregateSAPByPhase(sapData) {
  if (!sapData || sapData.length === 0) return [];

  const phaseMap = {};
  sapData.forEach(row => {
    const workCenter = row.work_center_sap || 'unknown';
    if (!phaseMap[workCenter]) {
      phaseMap[workCenter] = {
        phase: workCenter,
        quantity: 0,
        scrap: 0,
        records: []
      };
    }
    phaseMap[workCenter].quantity += row.qta_ottenuta || 0;
    phaseMap[workCenter].scrap += row.qta_scarto || 0;
    phaseMap[workCenter].records.push(row);
  });

  return Object.values(phaseMap).sort((a, b) => b.quantity - a.quantity);
}

function calculateCycleTimes(sapData) {
  if (!sapData || sapData.length === 0) return {};

  const phaseTimings = {};
  sapData.forEach(row => {
    const workCenter = row.work_center_sap || 'unknown';
    if (!phaseTimings[workCenter]) {
      phaseTimings[workCenter] = { dates: [] };
    }
    phaseTimings[workCenter].dates.push(new Date(row.data));
  });

  const cycleTimes = {};
  Object.entries(phaseTimings).forEach(([phase, timing]) => {
    if (timing.dates.length > 1) {
      const minDate = Math.min(...timing.dates.map(d => d.getTime()));
      const maxDate = Math.max(...timing.dates.map(d => d.getTime()));
      const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      cycleTimes[phase] = Math.round((daysDiff * 24) / Math.max(1, timing.dates.length)); // ore medie
    }
  });

  return cycleTimes;
}

function identifyBottleneck(phaseInventory, targetData) {
  if (!phaseInventory || phaseInventory.length === 0) {
    return { phase: 'unknown', impact: 0, reason: 'No data' };
  }

  // Semplice: la fase con meno quantità è il bottleneck (collo di bottiglia)
  const bottleneck = phaseInventory[phaseInventory.length - 1];
  const impact = Math.round(((phaseInventory[0].quantity - bottleneck.quantity) / phaseInventory[0].quantity) * 100);

  return {
    phase: bottleneck.phase,
    impact,
    reason: `${bottleneck.phase} ha processato solo ${bottleneck.quantity} pezzi vs ${phaseInventory[0].quantity} in input`
  };
}

function calculateUrgencyScore(targetData, phaseInventory, cycleTimesPerPhase) {
  if (!targetData) return 50; // default

  const totalQty = phaseInventory.reduce((sum, p) => sum + p.quantity, 0);
  const targetQty = targetData.qta_target_totale || 1;
  const completionPct = Math.min(100, (totalQty / targetQty) * 100);

  // Base: % ritardo rispetto target
  let score = Math.max(0, 100 - completionPct);

  // Moltiplicatori
  if (completionPct < 50) score *= 1.5; // molto indietro
  if (phaseInventory.length > 0 && phaseInventory[phaseInventory.length - 1].quantity < targetQty * 0.3) {
    score *= 1.3; // bottleneck severo
  }

  return Math.round(Math.min(100, score));
}

function estimateCompletionDate(phaseInventory, cycleTimesPerPhase, targetData) {
  if (!targetData) return null;

  const totalQty = phaseInventory.reduce((sum, p) => sum + p.quantity, 0);
  const remainingQty = Math.max(0, (targetData.qta_target_totale || 0) - totalQty);

  if (remainingQty <= 0) {
    return new Date(); // Already complete
  }

  const avgCycleTimeHours = Object.values(cycleTimesPerPhase).length > 0
    ? Math.round(Object.values(cycleTimesPerPhase).reduce((a, b) => a + b, 0) / Object.values(cycleTimesPerPhase).length)
    : 24; // default 1 day per phase

  const hoursRemaining = remainingQty * (avgCycleTimeHours / Math.max(1, phaseInventory[0]?.quantity || 1));
  const daysRemaining = Math.ceil(hoursRemaining / 8); // 8 ore lavoro al giorno

  const today = new Date();
  const estimatedDate = new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000);

  return estimatedDate;
}

function generateRecommendations(phaseInventory, bottleneckPhase, urgencyScore, cycleTimesPerPhase, targetData) {
  const recommendations = [];

  // Raccomandazione 1: Bottleneck
  if (bottleneckPhase.impact > 30) {
    recommendations.push({
      action: `Aumenta capacità in ${bottleneckPhase.phase}`,
      impact: 'HIGH',
      priority: 1,
      details: `Questa fase ha un ritardo del ${bottleneckPhase.impact}%. Aggiungi turni o parallelizza lavorazioni.`
    });
  }

  // Raccomandazione 2: Urgency critica
  if (urgencyScore > 70) {
    recommendations.push({
      action: 'Attiva piano di recupero urgente',
      impact: 'HIGH',
      priority: 2,
      details: `Urgency score ${urgencyScore}/100. Considerare straordinari o ressourceing da altri progetti.`
    });
  }

  // Raccomandazione 3: Discrepanza inventario
  if (phaseInventory.length > 0) {
    const maxQty = phaseInventory[0].quantity;
    const minQty = phaseInventory[phaseInventory.length - 1].quantity;
    const discrepancy = Math.round(((maxQty - minQty) / maxQty) * 100);
    if (discrepancy > 20) {
      recommendations.push({
        action: 'Verifica discrepanze nei flussi intermedi',
        impact: 'MEDIUM',
        priority: 3,
        details: `Differenza di ${discrepancy}% tra prima e ultima fase. Controllare scarti e riscritti.`
      });
    }
  }

  // Raccomandazione 4: Tempo ciclo elevato
  const avgCycleTime = Object.values(cycleTimesPerPhase).length > 0
    ? Object.values(cycleTimesPerPhase).reduce((a, b) => a + b, 0) / Object.values(cycleTimesPerPhase).length
    : 0;
  if (avgCycleTime > 48) {
    recommendations.push({
      action: 'Ottimizza tempo di ciclo',
      impact: 'MEDIUM',
      priority: 4,
      details: `Tempo medio di ciclo ${Math.round(avgCycleTime)}h è elevato. Controllare settaggi macchine.`
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
