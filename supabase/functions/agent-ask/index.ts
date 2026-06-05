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
    ] = await Promise.all([
      supabase.from("dipendenti").select("id, nome, reparto_id, turno_default"),
      supabase.from("macchine").select("id, nome, reparto_id, personale_minimo"),
      supabase.from("assegnazioni").select("dipendente_id, macchina_id, data_inizio, data_fine"),
      supabase.from("presenze").select("dipendente_id, data, turno_id, presente, motivo_assenza").gte("data", thirtyDaysAgo).lte("data", today),
    ]);

    if (errDip || errMac || errAss || errPres) {
      console.error("DB Errors:", { errDip, errMac, errAss, errPres });
    }

    const systemPrompt = `You are an AI assistant specialized in production scheduling and workforce management for a manufacturing facility.
You can analyze scheduling conflicts, suggest optimizations, calculate changeover times, and provide insights about production efficiency.
Always respond in Italian since the user is Italian.
Be concise and practical in your recommendations.
Focus only on analysis - you cannot modify data.`;

    const contextInfo = `
Current Context:
- Date: ${context?.globalDate || new Date().toISOString().split("T")[0]}
- Active Shift: ${context?.turnoCorrente || "D"}
- Employees: ${dipendenti?.length || 0}
- Machines: ${macchine?.length || 0}
- Active Assignments: ${assegnazioni?.length || 0}
- Present Today: ${presenze?.filter((p: any) => p.presente)?.length || 0}

Machines: ${macchine?.slice(0, 5).map((m: any) => `${m.nome} (min ${m.personale_minimo})`).join(", ") || "No data"}
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

