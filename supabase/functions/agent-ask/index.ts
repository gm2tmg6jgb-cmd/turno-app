import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not configured");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, context } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range (last 30 days)
    const today = context?.globalDate || new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(new Date(today).getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Fetch data from Supabase
    const [
      { data: dipendenti, error: errDip },
      { data: macchine, error: errMac },
      { data: assegnazioni, error: errAss },
      { data: presenze, error: errPres },
      { data: componentiAvanzamento, error: errComp },
    ] = await Promise.all([
      supabase.from("dipendenti").select("id, nome, reparto_id, turno_default").limit(100),
      supabase.from("macchine").select("id, nome, reparto_id, personale_minimo").limit(100),
      supabase.from("assegnazioni").select("dipendente_id, macchina_id, data_inizio, data_fine").limit(100),
      supabase.from("presenze").select("dipendente_id, data, turno_id, presente, motivo_assenza").gte("data", thirtyDaysAgo).lte("data", today).limit(100),
      supabase.from("componente_avanzamento").select("progetto, componente, fase_id, fase_label, pezzi_totali, pezzi_prodotti, stato, percentuale_avanzamento, urgency_delta").limit(100),
    ]);

    if (errDip) console.error("Dipendenti error:", errDip);
    if (errMac) console.error("Macchine error:", errMac);
    if (errAss) console.error("Assegnazioni error:", errAss);
    if (errPres) console.error("Presenze error:", errPres);
    if (errComp) console.error("Componente avanzamento error:", errComp);

    const systemPrompt = `You are an AI assistant specialized in production scheduling, component advancement tracking, and manufacturing optimization.
You have detailed knowledge of:
- 3 production lines: T11 SOFT (Tornitura Soft), TERMICO (Heat Treatment/Forno), T12 HARD (Tornitura Hard), T13 RG+DH (Final Assembly)
- 3 active projects: DCT300 (synchro gears), 8Fe (free gears), DCT ECO (eco-design)
- Key bottlenecks: Forno (56h, 176 pz/charge), Rettifica Denti (Z19-Z21, critical for urgency), Tornitura Soft (12 machines, changeover ~1h)
- Component phases: laser_welding (saldatura soft) → hobbing (dentatura) → ht (forno) → start_hard (tornitura hard) → teeth_grinding (rettifica denti)
- Urgency tracking: urgency_delta shows % deviation from target (negative = behind schedule)

You can:
- Analyze component advancement and identify delays
- Suggest scheduling optimizations based on urgency and bottleneck constraints
- Calculate changeover impact and recommendations
- Identify critical path components needing priority
- Provide production insights and forecasts

Always respond in Italian since the user is Italian.
Be concise, data-driven, and practical.
When a component is >30% behind (-30% urgency), recommend immediate priority actions.
Focus on analysis - you cannot modify data directly.`;


    // Fallback data if table is empty (for testing)
    const fallbackComponentData = [
      { componente: "SG5", progetto: "DCT300", fase_label: "Trattamento Termico", percentuale_avanzamento: 83, urgency_delta: -17, stato: "in_progress" },
      { componente: "FG5/7", progetto: "8Fe", fase_label: "Dentatura", percentuale_avanzamento: 67, urgency_delta: -34, stato: "in_progress" },
      { componente: "SG2", progetto: "DCT ECO", fase_label: "Dentatura", percentuale_avanzamento: 96, urgency_delta: 2, stato: "in_progress" },
    ];

    // Format component progress data from raw table data
    const componentsByKey = new Map<string, any[]>();
    const dataSource = componentiAvanzamento?.length ? componentiAvanzamento : fallbackComponentData;

    if (dataSource?.length) {
      dataSource.forEach((c: any) => {
        const key = `${c.componente}·${c.progetto}`;
        if (!componentsByKey.has(key)) {
          componentsByKey.set(key, []);
        }
        componentsByKey.get(key)!.push(c);
      });
    }

    const componentProgressInfo = componentsByKey.size > 0
      ? Array.from(componentsByKey.entries())
          .map(([key, fasi]) => {
            const avgPercentuale = fasi.reduce((sum, f) => sum + (f.percentuale_avanzamento || 0), 0) / fasi.length;
            const avgUrgency = fasi.reduce((sum, f) => sum + (f.urgency_delta || 0), 0) / fasi.length;
            const completedFases = fasi.filter(f => f.stato === 'completed').length;
            const currentFase = fasi.find(f => f.stato === 'in_progress')?.fase_label || fasi.find(f => f.stato === 'pending')?.fase_label || 'unknown';

            return `${key}: ${avgPercentuale.toFixed(1)}% completato, urgency ${avgUrgency.toFixed(1)}%, fase attuale: ${currentFase}`;
          })
          .sort((a, b) => {
            const urgencyA = parseFloat(a.match(/urgency ([-\d.]+)/)?.[1] || "0");
            const urgencyB = parseFloat(b.match(/urgency ([-\d.]+)/)?.[1] || "0");
            return urgencyA - urgencyB; // Most critical first (most negative)
          })
          .join('\n')
      : "Dati componenti non disponibili";

    const contextInfo = `
=== PRODUCTION STATUS (${context?.globalDate || new Date().toISOString().split("T")[0]}) ===

WORKFORCE:
- Employees: ${dipendenti?.length || 0}
- Present Today: ${presenze?.filter((p: any) => p.presente)?.length || 0}
- Active Assignments: ${assegnazioni?.length || 0}

MACHINES & LINES:
- Total Machines: ${macchine?.length || 0}
${macchine?.slice(0, 8).map((m: any) => `  • ${m.nome} (min staff: ${m.personale_minimo})`).join('\n') || "No data"}

COMPONENT ADVANCEMENT (CRITICAL):
${componentProgressInfo}

BOTTLENECK ANALYSIS:
- Forno (Heat Treatment): 56h cycle, 176 pz/charge - MAIN BOTTLENECK
- Rettifica Denti (Teeth Grinding Z19-Z21): FG5/7 needs special setup
- Tornitura Soft (Z1-Z3): 12 machines, competition between 3 projects
- Tornitura Hard (Z15-Z18): Load-balancing critical

URGENT ACTIONS NEEDED:
${
  componentiAvanzamento?.some((c: any) => c.urgency_delta && c.urgency_delta < -30)
    ? '⚠️ CRITICA: Component(s) >30% behind schedule - recommend priority changeover'
    : componentiAvanzamento?.some((c: any) => c.urgency_delta && c.urgency_delta < -15)
    ? '⚠️ ATTENZIONE: Component(s) >15% behind - monitor closely'
    : 'Status normal'
}
`;

    const userMessage = `${contextInfo}\n\nQuestion: ${query}`;

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-1-20250805",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Claude API error:", error);
      return new Response(
        JSON.stringify({ error: "AI service failed", detail: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const assistantResponse = data.content[0]?.text || "No response generated";

    return new Response(JSON.stringify({ response: assistantResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

