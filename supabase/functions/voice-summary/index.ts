import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function callGroq(key: string, prompt: string, maxTokens = 150): Promise<string | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: maxTokens,
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { review_id, table, user_id, title, media_type, duration_seconds } = body;

    if (!review_id || !table || !user_id) {
      return new Response(JSON.stringify({ error: "review_id, table, and user_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a short summary based on context
    // Since we can't transcribe audio directly, we generate a contextual placeholder
    // that acknowledges the voice review. If a transcription service is available later,
    // it can be integrated here.
    const mediaLabel = media_type === "movie" ? "movie" : "TV show";
    const prompt = `A user just submitted a ${duration_seconds ?? 0}-second voice review for the ${mediaLabel} "${title ?? 'this title'}". Generate a very short (1-2 sentence) natural-sounding summary placeholder that acknowledges this is a voice review. For example: "The reviewer shared their thoughts about [title] in a brief voice recording." Be specific to the title if provided. Do not use quotes or bullet points. Keep it under 40 words.`;

    const summary = await callGroq(GROQ_KEY, prompt, 80);

    if (summary) {
      // Update the review with the summary
      const { error: updateErr } = await supabaseAdmin
        .from(table)
        .update({ voice_summary: summary })
        .eq("id", review_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: "Failed to update review" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ summary: summary ?? "Voice review submitted." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
