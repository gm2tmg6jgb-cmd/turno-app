import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

    // Fallback component data for testing
    const componentiData = [
      { componente: "SG5", progetto: "DCT300", fase_label: "Trattamento Termico", percentuale_avanzamento: 83, urgency_delta: -17, stato: "in_progress" },
      { componente: "FG5/7", progetto: "8Fe", fase_label: "Dentatura", percentuale_avanzamento: 67, urgency_delta: -34, stato: "in_progress" },
      { componente: "SG2", progetto: "DCT ECO", fase_label: "Dentatura", percentuale_avanzamento: 96, urgency_delta: 2, stato: "in_progress" },
    ];

    const systemPrompt = `You are an AI assistant specialized in production scheduling, component advancement tracking, and manufacturing optimization.
You have detailed knowledge of:
- 3 production lines: T11 SOFT (Tornitura Soft), TERMICO (Heat Treatment/Forno), T12 HARD (Tornitura Hard), T13 RG+DH (Final Assembly)
- 3 active projects: DCT300 (synchro gears), 8Fe (free gears), DCT ECO (eco-design)
- Key bottlenecks: Forno (56h, 176 pz/charge), Rettifica Denti (Z19-Z21, critical for urgency), Tornitura Soft (12 machines, changeover ~1h)
- Component phases: laser_welding (saldatura soft) → hobbing (dentatura) → ht (forno) → start_hard (tornitura hard) → teeth_grinding (rettifica denti)
- Urgency tracking: urgency_delta shows % deviation from target (negative = behind schedule)

Current Production Status:
${componentiData.map(c =>
  `${c.componente}·${c.progetto}: ${c.percentuale_avanzamento}% done, urgency ${c.urgency_delta}%, phase: ${c.fase_label}`
).join('\n')}

Always respond in Italian.
Be concise and data-driven.
Focus on: component advancement, bottlenecks, scheduling recommendations.`;

    const userMessage = `Question: ${query}\n\nContext: Date=${context?.globalDate || new Date().toISOString().split("T")[0]}, Shift=${context?.turnoCorrente || "D"}`;

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
