const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pgn, result, playerColor } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a world-class chess coach. Analyze the game and identify exactly 3 of the player's most impactful mistakes (blunders, missed tactics, or strategic errors). The player played as ${playerColor === "w" ? "White" : "Black"}. Game result: ${result}.

Respond ONLY by calling the report_mistakes tool. For each mistake provide:
- moveNumber (the full move number, e.g. 12)
- moveNotation (the actual move played in SAN, e.g. "Ng5")
- severity ("blunder" | "mistake" | "inaccuracy")
- explanation (one to two sentences: what went wrong and why)
- betterMove (the recommended alternative in SAN with a brief reason)

Also provide a 'summary' field: 2-3 sentences summarizing the player's overall performance.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `PGN:\n\n${pgn}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_mistakes",
              description: "Return the 3 key mistakes and a summary.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  mistakes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        moveNumber: { type: "number" },
                        moveNotation: { type: "string" },
                        severity: { type: "string", enum: ["blunder", "mistake", "inaccuracy"] },
                        explanation: { type: "string" },
                        betterMove: { type: "string" },
                      },
                      required: ["moveNumber", "moveNotation", "severity", "explanation", "betterMove"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "mistakes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_mistakes" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No analysis returned");

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-game error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
