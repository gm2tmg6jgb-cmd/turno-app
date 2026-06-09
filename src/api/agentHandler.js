// Local Agent Handler - Direct Claude API via Supabase Proxy
// Calls agent-ask-public function which handles Claude API calls on backend

const COMPONENT_DATA = [
  { componente: "SG5", progetto: "DCT300", fase_label: "Trattamento Termico", percentuale_avanzamento: 83, urgency_delta: -17, stato: "in_progress" },
  { componente: "FG5/7", progetto: "8Fe", fase_label: "Dentatura", percentuale_avanzamento: 67, urgency_delta: -34, stato: "in_progress" },
  { componente: "SG2", progetto: "DCT ECO", fase_label: "Dentatura", percentuale_avanzamento: 96, urgency_delta: 2, stato: "in_progress" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AGENT_ENDPOINT = `${SUPABASE_URL}/functions/v1/agent-ask-public`;

export async function askAgent(query, context) {
  // Use fallback directly (no Supabase call for now)
  // TODO: Once Supabase agent-ask-public is deployed without CORS issues, enable this:
  /*
  try {
    const response = await fetch(AGENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context: context || { globalDate: new Date().toISOString().split("T")[0] } }),
    });
    if (!response.ok) throw new Error(`Agent service error: ${response.status}`);
    const data = await response.json();
    return data.response || "No response generated";
  } catch (error) {
    // Fallback on error
  }
  */

  // Use synthesized response directly
  return generateFallbackResponse(query);
}

function generateFallbackResponse(query) {
  const queryLower = query.toLowerCase();

  // Synthesize responses based on query
  const responses = {
    "stato": `📊 **STATO PRODUZIONE - 9 Giugno 2026**\n\n🔴 **SITUAZIONE CRITICA - FG5/7·8Fe**\nAttualmente indietro di 34 punti percentuali!\n\n📋 Componenti in Produzione:\n\n✅ **SG5·DCT300**: 83% completato\n   • Fase attuale: Trattamento Termico (Forno)\n   • Urgency: -17% (leggermente indietro)\n   • Azioni: Completare forno entro stasera\n\n🔴 **FG5/7·8Fe** (CRITICA): 67% completato\n   • Fase attuale: Dentatura\n   • Urgency: -34% (MOLTO INDIETRO - PRIORITARIA)\n   • Azioni URGENTI:\n     1. Changeover immediato Z1-Z3\n     2. Dedicare macchine DRA per soft turning\n     3. Setup pre-caricato per rettifica denti\n     4. Guadagno stimato: -8% urgency in 2-3 giorni\n\n✅ **SG2·DCT ECO**: 96% completato\n   • Fase attuale: Dentatura\n   • Urgency: +2% (on track)\n   • Azioni: Continuare normale\n\n⚠️ **BOTTLENECK PRINCIPALE**: Forno (56 ore per ciclo)`,

    "bottleneck": `🚨 **BOTTLENECK IDENTIFICATI**\n\n1️⃣ **FORNO (Trattamento Termico)** - 56 ORE\n   • Capacità: 176 pz/carica\n   • Cariche per lotto 1200 pz: 7 cariche\n   • Tempo totale: 56 ore (2.3 giorni)\n   • Impatto: 49% del ciclo totale\n   • Soluzione: Ottimizzare sequenza cariche per urgency\n\n2️⃣ **Rettifica Denti (Z19-Z21)** - 15.1 ORE\n   • 12 macchine SLW in 3 zone parallele\n   • FG5/7 (8Fe) richiede setup extra +2-3h\n   • Cause inversioni priorità frequenti\n   • Soluzione: Zone dedicate per FG5/7 quando urgency >30%\n\n3️⃣ **Tornitura Soft (Z1-Z3)** - 11.8 ORE\n   • 12 macchine DRA\n   • Contesa tra 3 progetti (DCT300, 8Fe, ECO)\n   • Changeover setup ~1h tra progetti\n   • Soluzione: Ridurre setup a <45 min\n\n4️⃣ **Tornitura Hard (Z15-Z18)** - 46.7 ORE\n   • 10 macchine DRA\n   • Setup +2h per geometrie diverse\n   • Load-balancing critico\n   • Soluzione: Pianificazione parallela per più geometrie`,

    "fg5": `⚠️ **ANALISI CRITICA: FG5/7·8Fe**\n\n**Status Attuale:**\n• Percentuale completamento: 67%\n• Urgency: -34% (17 punti percentuali INDIETRO rispetto SG5)\n• Fase attuale: Dentatura (Z9-Z11)\n• Stato: IN_PROGRESS\n\n**Perché è Critica?**\n1. Ingranaggio libero → tolleranze strette (±0.05mm)\n2. Rettifica denti richiede setup specializzato +2-3h\n3. È il componente con urgency più negativa\n4. Se non accelera, arriverà al forno quando SG5 sta uscendo\n\n**Azioni Consigliate (IMMEDIATE):**\n✓ Changeover a Z1-Z3: dedicare 2 macchine DRA per soft turning\n✓ Guadagno: -8% urgency in 2-3 giorni\n✓ Z19-Z21 (rettifica): preparare setup pre-caricato\n✓ Riduci setup da 3h → 1.5h per FG5/7 specializzato\n✓ Forno: pianificare cariche 1-3 con 50% FG5/7\n\n**Timeline Prevista:**\n• Oggi: completare dentatura soft\n• Domani: soft hard + forno\n• Dopodomani: rettifica denti (critica)\n• 3 giorni: finalizzazione`,

    "default": `🤖 **AGENTE DI SCHEDULING INTELLIGENTE**\n\n**Dati Componenti Disponibili:**\n• SG5·DCT300: 83% (Forno)\n• FG5/7·8Fe: 67% CRITICA -34% (Dentatura)\n• SG2·DCT ECO: 96% (Dentatura)\n\n**Puoi chiedermi:**\n✓ "Qual è lo stato della produzione?"\n✓ "Quali sono i bottleneck?"\n✓ "Analizza FG5/7"\n✓ "Quando finisce il forno?"\n✓ "Cosa consigli per urgency?"\n✓ "Analizza utilizzo linea 8Fe"`,
  };

  // Match query to response
  for (const [key, response] of Object.entries(responses)) {
    if (key !== "default" && queryLower.includes(key)) {
      return response;
    }
  }

  // Check for specific keywords
  if (queryLower.includes("stato") || queryLower.includes("produzione")) {
    return responses.stato;
  }
  if (queryLower.includes("bottleneck") || queryLower.includes("collo")) {
    return responses.bottleneck;
  }
  if (queryLower.includes("fg5") || queryLower.includes("fg 5")) {
    return responses.fg5;
  }

  return responses.default;
}
