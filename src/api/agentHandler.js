// Local Agent Handler - No Supabase dependency
// Responds directly with component advancement data

const COMPONENT_DATA = [
  { componente: "SG5", progetto: "DCT300", fase_label: "Trattamento Termico", percentuale_avanzamento: 83, urgency_delta: -17, stato: "in_progress" },
  { componente: "FG5/7", progetto: "8Fe", fase_label: "Dentatura", percentuale_avanzamento: 67, urgency_delta: -34, stato: "in_progress" },
  { componente: "SG2", progetto: "DCT ECO", fase_label: "Dentatura", percentuale_avanzamento: 96, urgency_delta: 2, stato: "in_progress" },
];

export async function askAgent(query, context) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const systemPrompt = `You are an AI assistant specialized in production scheduling.
You have data on 3 components in production:
${COMPONENT_DATA.map(c =>
  `- ${c.componente}·${c.progetto}: ${c.percentuale_avanzamento}% done, urgency ${c.urgency_delta}%, phase: ${c.fase_label}`
).join('\n')}

CRITICAL: FG5/7·8Fe is 34% BEHIND SCHEDULE and NEEDS IMMEDIATE PRIORITY.

Always respond in Italian.
Be concise and practical.
Analyze the data and provide actionable insights.`;

  const userMessage = `Question: ${query}\n\nDate: ${context?.globalDate || new Date().toISOString().split("T")[0]}, Shift: ${context?.turnoCorrente || "D"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
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
      throw new Error("AI service failed");
    }

    const data = await response.json();
    return data.content[0]?.text || "No response generated";
  } catch (error) {
    console.error("Agent error:", error);
    throw error;
  }
}
