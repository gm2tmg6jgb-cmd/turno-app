import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PROCESS_STEPS } from '../data/constants';

const PHASE_ORDER = PROCESS_STEPS.map(s => s.id);
const phaseSortIndex = (id) => {
  const idx = PHASE_ORDER.indexOf(id);
  return idx === -1 ? 999 : idx;
};
const phaseLabel = (id) => PROCESS_STEPS.find(s => s.id === id)?.label || id;

// Lista dei progetti per cui esiste un piano di avanzamento
export function useAvailableProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('componente_avanzamento')
        .select('progetto');

      if (cancelled) return;
      if (!error && data) {
        setProjects([...new Set(data.map(r => r.progetto))]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { projects, loading };
}

// Analisi di tutti i componenti di un progetto in un'unica vista
export function useProjectAnalysis(project) {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project) {
      setComponents([]);
      return;
    }

    let cancelled = false;
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase
          .from('componente_avanzamento')
          .select('*')
          .eq('progetto', project);

        if (err) throw err;
        if (cancelled) return;

        const byComponent = {};
        (rows || []).forEach(r => {
          if (!byComponent[r.componente]) byComponent[r.componente] = [];
          byComponent[r.componente].push(r);
        });

        const result = Object.entries(byComponent)
          .map(([componente, compRows]) => ({
            componente,
            ...calculateAnalysis(compRows)
          }))
          // Componenti più urgenti per primi
          .sort((a, b) => b.urgencyScore - a.urgencyScore);

        setComponents(result);
      } catch (err) {
        console.error('[useProjectAnalysis] Error:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnalysis();
    return () => { cancelled = true; };
  }, [project]);

  return { components, loading, error };
}

function calculateAnalysis(rows) {
  if (!rows || rows.length === 0) return null;

  const phases = rows
    .map(r => ({
      id: r.fase_id,
      label: r.fase_label || phaseLabel(r.fase_id),
      totale: r.pezzi_totali || 0,
      prodotti: r.pezzi_prodotti || 0,
      pct: Math.round(Number(r.percentuale_avanzamento) || 0),
      stato: r.stato || 'pending',
      dataInizio: r.data_inizio,
      dataFinePrevista: r.data_fine_prevista,
      dataFineEffettiva: r.data_fine_effettiva,
      urgencyDelta: Math.round(Number(r.urgency_delta) || 0),
      note: r.note,
      updatedAt: r.updated_at
    }))
    .sort((a, b) => phaseSortIndex(a.id) - phaseSortIndex(b.id));

  const targetTotal = phases[0]?.totale || 0;

  // Avanzamento generale: media delle percentuali di tutte le fasi
  const overallProgress = Math.round(
    phases.reduce((sum, p) => sum + p.pct, 0) / phases.length
  );

  // Fasi non ancora completate
  const activePhases = phases.filter(p => p.stato !== 'completed');
  const completedCount = phases.length - activePhases.length;

  // Urgency score: deriva dal peggior ritardo (urgency_delta) tra le fasi attive
  const worstDelta = activePhases.length > 0
    ? Math.min(...activePhases.map(p => p.urgencyDelta))
    : 0;
  const urgencyScore = Math.round(Math.min(100, Math.max(0, -worstDelta * 2)));

  // Bottleneck: fase attiva con il delta peggiore
  let bottleneck = null;
  if (activePhases.length > 0) {
    const worst = activePhases.reduce((a, b) => (a.urgencyDelta <= b.urgencyDelta ? a : b));
    if (worst.urgencyDelta < 0) {
      bottleneck = {
        phase: worst.label,
        impact: Math.abs(worst.urgencyDelta),
        reason: worst.note || `${worst.label} è al ${worst.pct}% (${worst.prodotti}/${worst.totale} pz)`
      };
    }
  }

  // Fase corrente: prima fase non completata
  const currentPhase = activePhases[0] || null;

  // Stima ritardo accumulato: fasi attive la cui data fine prevista è già passata
  const today = new Date();
  let delayDays = 0;
  activePhases.forEach(p => {
    if (p.dataFinePrevista) {
      const prevista = new Date(p.dataFinePrevista);
      if (prevista < today) {
        const delay = Math.ceil((today - prevista) / (1000 * 60 * 60 * 24));
        delayDays = Math.max(delayDays, delay);
      }
    }
  });

  // Data di completamento stimata = fine prevista ultima fase + ritardo accumulato
  const lastPhase = phases[phases.length - 1];
  let completionDateOriginal = null;
  let completionDate = null;
  if (lastPhase?.dataFinePrevista) {
    completionDateOriginal = new Date(lastPhase.dataFinePrevista);
    completionDate = delayDays > 0
      ? new Date(completionDateOriginal.getTime() + delayDays * 24 * 60 * 60 * 1000)
      : completionDateOriginal;
  }

  // Ultimo aggiornamento dati
  const lastUpdated = phases.reduce((latest, p) => {
    if (!p.updatedAt) return latest;
    const d = new Date(p.updatedAt);
    return (!latest || d > latest) ? d : latest;
  }, null);

  const recommendations = generateRecommendations(phases, activePhases, delayDays);

  return {
    phases,
    targetTotal,
    completedCount,
    totalPhases: phases.length,
    currentPhase,
    overallProgress,
    urgencyScore,
    bottleneck,
    completionDate,
    completionDateOriginal,
    delayDays,
    lastUpdated,
    recommendations
  };
}

function generateRecommendations(phases, activePhases, delayDays) {
  const recs = [];

  activePhases.forEach(p => {
    if (p.urgencyDelta <= -25) {
      recs.push({
        action: `Recupera ritardo critico in "${p.label}"`,
        impact: 'HIGH',
        priority: 1,
        details: `${p.label} è al ${p.pct}% (${p.prodotti}/${p.totale} pz), ${Math.abs(p.urgencyDelta)}% sotto target. ${p.note || ''}`.trim()
      });
    } else if (p.urgencyDelta <= -10) {
      recs.push({
        action: `Monitora "${p.label}"`,
        impact: 'MEDIUM',
        priority: 2,
        details: `${p.label} è al ${p.pct}% (${p.prodotti}/${p.totale} pz), ${Math.abs(p.urgencyDelta)}% sotto target. ${p.note || ''}`.trim()
      });
    }
  });

  if (delayDays > 0) {
    recs.push({
      action: `Pianificazione a rischio: completamento stimato in ritardo di ${delayDays} ${delayDays === 1 ? 'giorno' : 'giorni'}`,
      impact: delayDays > 2 ? 'HIGH' : 'MEDIUM',
      priority: 1,
      details: `Una o più fasi hanno superato la data di fine prevista. Valutare straordinari o riallocazione risorse sulle fasi in ritardo.`
    });
  }

  // Fasi ancora in pending la cui data inizio prevista è già trascorsa
  const today = new Date();
  phases.forEach(p => {
    if (p.stato === 'pending' && p.dataInizio && new Date(p.dataInizio) < today) {
      recs.push({
        action: `"${p.label}" doveva già essere iniziata`,
        impact: 'MEDIUM',
        priority: 3,
        details: `Data inizio prevista: ${new Date(p.dataInizio).toLocaleDateString('it-IT')}. Verificare disponibilità risorse a monte.`
      });
    }
  });

  return recs.sort((a, b) => a.priority - b.priority);
}
