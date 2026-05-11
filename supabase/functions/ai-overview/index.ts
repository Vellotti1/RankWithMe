import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function callClaude(key: string, prompt: string, maxTokens = 256): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251112",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.[0]?.text ?? null;
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

    const body = await req.json();
    const action = body.action ?? "group_overview";

    // ── Group overview ──────────────────────────────────────────────────────
    if (action === "group_overview") {
      const { title, media_type, reviews } = body;
      if (!reviews || reviews.length === 0) {
        return new Response(JSON.stringify({ overview: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reviewLines = reviews
        .map((r: any) => `- ${r.username} scored it ${r.score}/100${r.text ? `: "${r.text}"` : ""}`)
        .join("\n");

      const prompt = `You are summarising a friend group's opinions on a ${media_type === "show" ? "TV show" : "movie"} called "${title}".

Here are their reviews:
${reviewLines}

Write a short, natural 2-3 sentence group consensus summary. Mention the average score sentiment, highlight any strong agreements or disagreements, and keep it conversational and fun. Do not use bullet points or headers.`;

      const overview = await callClaude(ANTHROPIC_KEY, prompt);
      return new Response(JSON.stringify({ overview }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Taste profile generation ─────────────────────────────────────────────
    if (action === "taste_profile") {
      const { user_id, reviews } = body;
      if (!reviews || reviews.length < 3) {
        return new Response(JSON.stringify({ summary: null, genres: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reviewLines = reviews
        .map((r: any) => `- "${r.title}" (${r.media_type}, ${r.year ?? "?"}): ${r.score}/100${r.text ? ` — "${r.text}"` : ""}`)
        .join("\n");

      const prompt = `Based on this user's ratings history, generate a concise taste profile.

Ratings:
${reviewLines}

Respond with JSON only (no markdown, no explanation):
{
  "summary": "2-3 sentence description of their taste — what genres/themes they enjoy, what they rate highly vs poorly. Write in third person as if describing them to someone.",
  "genres": ["genre1", "genre2", "genre3"]
}

Genres must be from this list: Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Fantasy, Horror, Mystery, Romance, Sci-Fi, Thriller, Western`;

      const text = await callClaude(ANTHROPIC_KEY, prompt, 512);
      if (!text) {
        return new Response(JSON.stringify({ summary: null, genres: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const parsed = JSON.parse(text);

        // Persist to DB using service role
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin.from("taste_profiles").upsert(
          { user_id, summary: parsed.summary, genres: parsed.genres, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

        return new Response(JSON.stringify({ summary: parsed.summary, genres: parsed.genres }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ summary: text, genres: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── TMDB recommendations based on taste profile ───────────────────────────
    if (action === "recommendations") {
      const { genres, already_seen_tmdb_ids } = body;
      const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
      if (!TMDB_KEY || !genres?.length) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Map genre names to TMDB genre IDs
      const genreMap: Record<string, number> = {
        "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
        "Crime": 80, "Documentary": 99, "Drama": 18, "Fantasy": 14,
        "Horror": 27, "Mystery": 9648, "Romance": 10749, "Sci-Fi": 878,
        "Thriller": 53, "Western": 37,
      };
      const genreIds = genres.slice(0, 3).map((g: string) => genreMap[g]).filter(Boolean).join(",");

      const seenIds = new Set<number>(already_seen_tmdb_ids ?? []);

      // Fetch discover movies and shows in parallel
      const [movRes, tvRes] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/discover/movie?sort_by=vote_average.desc&vote_count.gte=200&with_genres=${genreIds}&language=en-US&page=1`, {
          headers: { Authorization: `Bearer ${TMDB_KEY}` },
        }),
        fetch(`https://api.themoviedb.org/3/discover/tv?sort_by=vote_average.desc&vote_count.gte=100&with_genres=${genreIds}&language=en-US&page=1`, {
          headers: { Authorization: `Bearer ${TMDB_KEY}` },
        }),
      ]);

      const [movData, tvData] = await Promise.all([movRes.json(), tvRes.json()]);

      const movies = (movData.results ?? [])
        .filter((r: any) => !seenIds.has(r.id))
        .slice(0, 6)
        .map((r: any) => ({
          tmdb_id: r.id, title: r.title, media_type: "movie",
          year: r.release_date?.slice(0, 4) ?? null,
          poster_path: r.poster_path ?? null, description: r.overview ?? "",
          vote_average: r.vote_average,
        }));

      const shows = (tvData.results ?? [])
        .filter((r: any) => !seenIds.has(r.id))
        .slice(0, 6)
        .map((r: any) => ({
          tmdb_id: r.id, title: r.name, media_type: "show",
          year: r.first_air_date?.slice(0, 4) ?? null,
          poster_path: r.poster_path ?? null, description: r.overview ?? "",
          vote_average: r.vote_average,
        }));

      // Interleave and return top 12
      const results: any[] = [];
      const max = Math.max(movies.length, shows.length);
      for (let i = 0; i < max; i++) {
        if (movies[i]) results.push(movies[i]);
        if (shows[i]) results.push(shows[i]);
      }

      return new Response(JSON.stringify({ results: results.slice(0, 12) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── User profile AI overview ────────────────────────────────────────────
    if (action === "profile_overview") {
      const { reviews } = body;
      if (!reviews || reviews.length < 1) {
        return new Response(JSON.stringify({ overview: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reviewLines = reviews
        .map((r: any) => `- "${r.title}" (${r.media_type}, ${r.year ?? "?"}): ${r.score}/100${r.text ? ` — "${r.text}"` : ""}`)
        .join("\n");

      const prompt = `Based on this user's ratings history, write a short 2-3 sentence AI overview of their overall taste and critical takes. Mention what they tend to love, what they've rated highly, and any patterns you notice. Write naturally and conversationally as if describing this person's taste to a friend. Don't use bullet points.

Ratings:
${reviewLines}`;

      const overview = await callClaude(ANTHROPIC_KEY, prompt, 300);
      return new Response(JSON.stringify({ overview }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
