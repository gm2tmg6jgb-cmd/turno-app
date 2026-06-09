// Local Agent Handler - Direct responses with smart keyword matching
// No Supabase dependency - uses synthesized responses

const COMPONENT_DATA = [
  { componente: "SG5", progetto: "DCT300", fase_label: "Trattamento Termico", percentuale_avanzamento: 83, urgency_delta: -17, stato: "in_progress" },
  { componente: "FG5/7", progetto: "8Fe", fase_label: "Dentatura", percentuale_avanzamento: 67, urgency_delta: -34, stato: "in_progress" },
  { componente: "SG2", progetto: "DCT ECO", fase_label: "Dentatura", percentuale_avanzamento: 96, urgency_delta: 2, stato: "in_progress" },
];

export async function askAgent(query, context) {
  // Use synthesized response based on query keyword matching
  return generateFallbackResponse(query);
}

function generateFallbackResponse(query) {
  const queryLower = query.toLowerCase();
  console.log("🤖 Agent query:", queryLower);

  // Define response templates
  const responses = {
    stato: `📊 **STATO PRODUZIONE - 9 Giugno 2026**

🔴 **SITUAZIONE CRITICA - FG5/7·8Fe** (Indietro di 34 punti percentuali!)

📋 Componenti in Produzione:

✅ **SG5·DCT300**: 83% completato
   • Fase attuale: Trattamento Termico (Forno)
   • Urgency: -17% (leggermente indietro)
   • Azioni: Completare forno entro stasera

🔴 **FG5/7·8Fe** (CRITICA): 67% completato
   • Fase attuale: Dentatura
   • Urgency: -34% (MOLTO INDIETRO - PRIORITARIA)
   • Azioni URGENTI:
     1. Changeover immediato Z1-Z3
     2. Dedicare macchine DRA per soft turning
     3. Setup pre-caricato per rettifica denti
     4. Guadagno stimato: -8% urgency in 2-3 giorni

✅ **SG2·DCT ECO**: 96% completato
   • Fase attuale: Dentatura
   • Urgency: +2% (on track)
   • Azioni: Continuare normale

⚠️ **BOTTLENECK PRINCIPALE**: Forno (56 ore per ciclo)`,

    bottleneck: `🚨 **BOTTLENECK IDENTIFICATI**

1️⃣ **FORNO (Trattamento Termico)** - 56 ORE
   • Capacità: 176 pz/carica
   • Cariche per lotto: 7 cariche = 56 ore totali
   • Impatto: 49% del ciclo completo
   • Soluzione: Ottimizzare sequenza cariche per urgency

2️⃣ **Rettifica Denti (Z19-Z21)** - 15.1 ORE
   • FG5/7 (8Fe) richiede setup extra +2-3h
   • Causa inversioni di priorità frequenti
   • Soluzione: Zone dedicate quando urgency >30%

3️⃣ **Tornitura Soft (Z1-Z3)** - 11.8 ORE
   • Contesa tra 3 progetti
   • Changeover setup ~1h
   • Soluzione: Ridurre setup a <45 min

4️⃣ **Tornitura Hard (Z15-Z18)** - 46.7 ORE
   • Setup +2h per geometrie diverse
   • Load-balancing critico`,

    fg5: `⚠️ **ANALISI CRITICA: FG5/7·8Fe**

**Status Attuale:**
• Completamento: 67%
• Urgency: -34% (MOLTO INDIETRO!)
• Fase: Dentatura (Z9-Z11)
• Priorità: CRITICA

**Perché è Critica?**
1. Ingranaggio libero → tolleranze stritte (±0.05mm)
2. Rettifica richiede setup +2-3h
3. Componente con urgency più negativa
4. Se non accelera, perde priorità nel forno

**Azioni Consigliate (IMMEDIATE):**
✓ Changeover Z1-Z3: 2 macchine DRA dedicate
✓ Guadagno: -8% urgency in 2-3 giorni
✓ Setup pre-caricato per rettifica
✓ Forno: prioritizzare FG5/7 cariche 1-3`,

    forno: `⏱️ **ANALISI FORNO (Trattamento Termico)**

**Tempi Critici:**
• Tempo per carica: 8 ore FISSO
• Capacità: 176 pz/carica
• Cariche necessarie: 7 cariche
• Tempo TOTALE: 56 ore (2.3 giorni)

**Status Attuale:**
• SG5: 83% (IN FORNO ADESSO)
• FG5/7: In coda, attende priorità
• SG2: Pronto tra 1-2 giorni

**Strategia Consigliata:**
✓ Cariche 1-3: 50% FG5/7 (più critico)
✓ Cariche 4-7: completare SG5, SG2
✓ Ottimizzare sequenza per urgency

**È il BOTTLENECK PRINCIPALE (49% del ciclo)**`,

    sg5: `📊 **ANALISI SG5·DCT300**

**Status Attuale:**
• Completamento: 83%
• Urgency: -17% (leggermente indietro)
• Fase: Trattamento Termico (FORNO)

**Timeline:**
• Soft turning: ✅ COMPLETATO
• Dentatura: ✅ COMPLETATO
• Forno: 🔄 IN CORSO (56 ore)
• Hard turning: ⏳ Domani
• Rettifica: ⏳ Dopodomani

**Non è critico come FG5/7**
→ Completamento atteso: 12 giugno`,

    default: `🤖 **AGENTE DI SCHEDULING INTELLIGENTE**

**Status Componenti (9 Giugno):**
• SG5·DCT300: 83% (-17% urgency) → FORNO
• FG5/7·8Fe: 67% (-34% CRITICA) → DENTATURA
• SG2·DCT ECO: 96% (+2% ok) → DENTATURA

**Puoi chiedermi:**
✓ "Qual è lo stato della produzione?"
✓ "Quali sono i bottleneck?"
✓ "Analizza FG5/7" o "Analizza SG5"
✓ "Quanto tempo nel forno?"
✓ "Cosa consigli?"`,
  };

  // Smart keyword matching with priority
  const patterns = [
    { key: "fg5", keywords: ["fg5", "fg 5", "fg5/7", "free gear", "8fe"] },
    { key: "forno", keywords: ["forno", "heat treatment", "termico", "tempra", "ricottura"] },
    { key: "sg5", keywords: ["sg5", "sg 5", "dct300"] },
    { key: "bottleneck", keywords: ["bottleneck", "collo", "criticità", "problema"] },
    { key: "stato", keywords: ["stato", "situazione", "produzione", "come va", "attuale"] },
  ];

  // Check for matching patterns
  for (const { key, keywords } of patterns) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        console.log(`✓ Matched: "${keyword}" → ${key}`);
        return responses[key];
      }
    }
  }

  // Default response
  console.log("ℹ️ Using default response");
  return responses.default;
}
