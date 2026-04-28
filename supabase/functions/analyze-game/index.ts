import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PGN_LEN = 10_000;
const MAX_RESULT_LEN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pgn, result, playerColor } = body ?? {};

    // Input validation
    if (playerColor !== "w" && playerColor !== "b") {
      return new Response(JSON.stringify({ error: "Invalid playerColor" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof result !== "string" || result.length === 0 || result.length > MAX_RESULT_LEN) {
      return new Response(JSON.stringify({ error: "Invalid result" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof pgn !== "string" || pgn.length === 0 || pgn.length > MAX_PGN_LEN) {
      return new Response(JSON.stringify({ error: "Invalid PGN" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Basic PGN sanity check — should contain at least one move number marker like "1."
    if (!/\d+\./.test(pgn)) {
      return new Response(JSON.stringify({ error: "Invalid PGN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a chess coach who speaks the language of entrepreneurship and startups. Analyze the chess game and explain each key mistake using business and startup analogies. For example: "Move 15: You attacked without securing your position first — in startup terms, this is like scaling your marketing before achieving product-market fit." Be specific, insightful, and make the player think about both chess strategy AND business strategy simultaneously. Give 5-7 key moments with this dual analysis.

The player played as ${playerColor === "w" ? "White" : "Black"}. Game result: ${result}.

Respond ONLY by calling the report_moments tool. For each moment, use the player's full move number from the PGN (the integer N in "N. ..."). For each moment provide:
- moveNumber: the full move number (integer)
- ply: the half-move index in the game starting at 1 (so White's move 1 = ply 1, Black's move 1 = ply 2, White's move 2 = ply 3, etc.)
- side: "w" or "b" — which side made this move
- moveNotation: the actual move played in SAN (e.g. "Ng5")
- severity: "blunder" | "mistake" | "inaccuracy" | "brilliant"
- chessInsight: 1-2 sentences explaining the chess concept (what went wrong tactically/strategically, or why this was strong)
- businessAnalogy: 1-2 sentences mapping the chess idea to a startup/business situation. Be vivid and specific (mention concepts like PMF, runway, burn rate, moat, hiring, fundraising, MVPs, customer acquisition, etc.)
- betterMove: the recommended alternative in SAN (or "—" if the move was already best/brilliant)

Also include 'summary': 2-3 sentences summarizing the player's overall approach with one closing business takeaway.`;

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
              name: "report_moments",
              description: "Return 5-7 critical moments and a summary blending chess and business insight.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  moments: {
                    type: "array",
                    minItems: 5,
                    maxItems: 7,
                    items: {
                      type: "object",
                      properties: {
                        moveNumber: { type: "number" },
                        ply: { type: "number" },
                        side: { type: "string", enum: ["w", "b"] },
                        moveNotation: { type: "string" },
                        severity: { type: "string", enum: ["blunder", "mistake", "inaccuracy", "brilliant"] },
                        chessInsight: { type: "string" },
                        businessAnalogy: { type: "string" },
                        betterMove: { type: "string" },
                      },
                      required: ["moveNumber", "ply", "side", "moveNotation", "severity", "chessInsight", "businessAnalogy", "betterMove"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "moments"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_moments" } },
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
    return new Response(
      JSON.stringify({ error: "Game analysis failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
