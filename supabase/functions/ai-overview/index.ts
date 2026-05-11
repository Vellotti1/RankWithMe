import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewInput {
  username: string;
  score: number;
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, media_type, reviews }: { title: string; media_type: string; reviews: ReviewInput[] } = await req.json();

    if (!reviews || reviews.length === 0) {
      return new Response(JSON.stringify({ overview: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewLines = reviews
      .map((r) => `- ${r.username} scored it ${r.score}/100${r.text ? `: "${r.text}"` : ""}`)
      .join("\n");

    const prompt = `You are summarising a friend group's opinions on a ${media_type === "show" ? "TV show" : "movie"} called "${title}".

Here are their reviews:
${reviewLines}

Write a short, natural 2-3 sentence group consensus summary. Mention the average score sentiment, highlight any strong agreements or disagreements, and keep it conversational and fun. Do not use bullet points or headers.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const overview = data.content?.[0]?.text ?? null;

    return new Response(JSON.stringify({ overview }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
