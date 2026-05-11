import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
    if (!TMDB_KEY) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("query");
    const type = url.searchParams.get("type") ?? "multi"; // movie | tv | multi

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tmdbUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
    const tmdbRes = await fetch(tmdbUrl, {
      headers: { Authorization: `Bearer ${TMDB_KEY}` },
    });

    if (!tmdbRes.ok) {
      return new Response(JSON.stringify({ error: "TMDB request failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await tmdbRes.json();

    // Normalise results to a consistent shape
    const results = (data.results ?? [])
      .filter((r: any) => r.media_type !== "person" && (r.title || r.name))
      .slice(0, 10)
      .map((r: any) => ({
        tmdb_id: r.id,
        title: r.title ?? r.name,
        year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || null,
        media_type: r.media_type === "tv" || r.name ? "show" : "movie",
        poster_path: r.poster_path ?? null,
        description: r.overview ?? "",
      }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
