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
    const action = url.searchParams.get("action") ?? "search";

    // --- Search action ---
    if (action === "search") {
      const query = url.searchParams.get("query");
      if (!query) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tmdbUrl = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
      const tmdbRes = await fetch(tmdbUrl, {
        headers: { Authorization: `Bearer ${TMDB_KEY}` },
      });

      if (!tmdbRes.ok) {
        return new Response(JSON.stringify({ error: "TMDB request failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await tmdbRes.json();
      const results = (data.results ?? [])
        .filter((r: any) => r.media_type !== "person" && (r.title || r.name))
        .slice(0, 10)
        .map((r: any) => ({
          tmdb_id: r.id,
          title: r.title ?? r.name,
          year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4) || null,
          media_type: r.media_type === "tv" ? "show" : "movie",
          poster_path: r.poster_path ?? null,
          description: r.overview ?? "",
        }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Seasons action: get all seasons for a TV show ---
    if (action === "seasons") {
      const tmdbId = url.searchParams.get("tmdb_id");
      if (!tmdbId) {
        return new Response(JSON.stringify({ error: "tmdb_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tmdbRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`, {
        headers: { Authorization: `Bearer ${TMDB_KEY}` },
      });

      if (!tmdbRes.ok) {
        return new Response(JSON.stringify({ error: "TMDB request failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await tmdbRes.json();
      const seasons = (data.seasons ?? [])
        .filter((s: any) => s.season_number > 0) // skip specials season
        .map((s: any) => ({
          season_number: s.season_number,
          name: s.name,
          episode_count: s.episode_count,
          poster_path: s.poster_path ?? null,
          air_date: s.air_date ?? null,
        }));

      return new Response(JSON.stringify({ seasons }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Episodes action: get all episodes for a season ---
    if (action === "episodes") {
      const tmdbId = url.searchParams.get("tmdb_id");
      const season = url.searchParams.get("season");
      if (!tmdbId || !season) {
        return new Response(JSON.stringify({ error: "tmdb_id and season required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?language=en-US`,
        { headers: { Authorization: `Bearer ${TMDB_KEY}` } }
      );

      if (!tmdbRes.ok) {
        return new Response(JSON.stringify({ error: "TMDB request failed" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await tmdbRes.json();
      const episodes = (data.episodes ?? []).map((e: any) => ({
        tmdb_episode_id: e.id,
        season_number: e.season_number,
        episode_number: e.episode_number,
        title: e.name,
        overview: e.overview ?? "",
        still_path: e.still_path ?? null,
        air_date: e.air_date ?? null,
      }));

      return new Response(JSON.stringify({ episodes }), {
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
