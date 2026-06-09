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
      { data: componentiSummary, error: errSummary },
    ] = await Promise.all([
      supabase.from("dipendenti").select("id, nome, reparto_id, turno_default"),
      supabase.from("macchine").select("id, nome, reparto_id, personale_minimo"),
      supabase.from("assegnazioni").select("dipendente_id, macchina_id, data_inizio, data_fine"),
      supabase.from("presenze").select("dipendente_id, data, turno_id, presente, motivo_assenza").gte("data", thirtyDaysAgo).lte("data", today),
      supabase.from("componente_avanzamento").select("progetto, componente, fase_id, fase_label, pezzi_totali, pezzi_prodotti, stato, percentuale_avanzamento, urgency_delta"),
      supabase.from("v_componente_avanzamento_summary").select("*"),
    ]);

    if (errDip || errMac || errAss || errPres) {
      console.error("DB Errors:", { errDip, errMac, errAss, errPres });
    }

    if (errComp) {
      console.warn("Componente avanzamento table not available:", errComp);
    }

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


    // Format component progress data
    const componentProgressInfo = componentiSummary?.length
      ? componentiSummary.map((c: any) =>
          `${c.componente}·${c.progetto}: ${c.percentuale_media?.toFixed(1) || 0}% completato, ` +
          `urgency ${c.urgency_delta_media?.toFixed(1) || 0}%, ` +
          `fase attuale: ${c.fase_attuale || 'pending'}, ` +
          `fasi: ${c.fasi_completate}/${c.total_fasi} completate`
        ).join('\n')
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
  componentiSummary?.some((c: any) => c.urgency_delta_media < -30)
    ? '⚠️ CRITICA: Component(s) >30% behind schedule - recommend priority changeover'
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

