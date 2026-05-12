import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FeedItem {
  tmdb_id: number;
  title: string;
  media_type: "movie" | "show";
  year: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  description: string;
  vote_average: number;
  genres: string[];
  maturity_rating: string | null;
  app_score: number | null;
  app_review_count: number;
  review: { username: string; display_name: string; score: number; text: string; relationship: string; review_type: string; voice_audio_url: string | null; voice_summary: string | null; voice_duration_seconds: number | null } | null;
  ai_overview: string | null;
  video_key: string | null;
  video_name: string | null;
}

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch(path: string, key: string): Promise<any> {
  const res = await fetch(`${TMDB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`TMDb ${path} returned ${res.status}`);
    throw new Error(`TMDb ${path} returned ${res.status}`);
  }
  return res.json();
}

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics",
};

function mapGenres(genreIds: number[]): string[] {
  return genreIds.map((id) => GENRE_MAP[id]).filter(Boolean);
}

// ── Maturity rating extraction ──
const REGION_PRIORITY = ["US", "AU", "GB"];

function extractMaturityRating(releaseDates: any): string | null {
  const results = releaseDates?.results ?? [];
  for (const region of REGION_PRIORITY) {
    const entry = results.find((r: any) => r.iso_3166_1 === region);
    if (entry?.release_dates?.length) {
      for (const rd of entry.release_dates) {
        if (rd.certification) return rd.certification;
      }
    }
  }
  for (const r of results) {
    for (const rd of (r.release_dates ?? [])) {
      if (rd.certification) return rd.certification;
    }
  }
  return null;
}

function extractTvRating(contentRatings: any): string | null {
  const results = contentRatings?.results ?? [];
  for (const region of REGION_PRIORITY) {
    const entry = results.find((r: any) => r.iso_3166_1 === region);
    if (entry?.rating) return entry.rating;
  }
  for (const r of results) {
    if (r.rating) return r.rating;
  }
  return null;
}

// ── Maturity bucket classification ──
const KIDS_RATINGS = new Set(["G", "PG", "TV-Y", "TV-Y7", "TV-Y7-FV", "TV-G", "TV-PG", "U", "0", "6", "AL"]);
const TEEN_RATINGS = new Set(["PG-13", "TV-14", "M", "M/PG", "12", "12A", "12+", "MA", "T"]);
const MATURE_RATINGS = new Set(["R", "NC-17", "TV-MA", "MA15+", "R18+", "18", "18+", "X", "AO", "15", "16+", "15+"]);

type MaturityBucket = "kids" | "teen" | "mature" | "unknown";

function classifyMaturity(rating: string | null): MaturityBucket {
  if (!rating) return "unknown";
  const r = rating.toUpperCase().trim();
  if (MATURE_RATINGS.has(r)) return "mature";
  if (TEEN_RATINGS.has(r)) return "teen";
  if (KIDS_RATINGS.has(r)) return "kids";
  if (/^(17|18|19|\d{2,})/.test(r) || r.includes("18")) return "mature";
  if (/^(14|15|16)/.test(r)) return "teen";
  return "unknown";
}

// ── Video selection: YouTube only, prioritized ──
const VIDEO_TYPE_PRIORITY: Record<string, number> = {
  "Trailer": 0,
  "Teaser": 1,
  "Clip": 2,
  "Featurette": 3,
  "Behind the Scenes": 4,
  "Bloopers": 5,
};

function pickBestVideo(videos: any[]): { key: string; name: string } | null {
  // STRICT filter: only YouTube with a non-empty key
  const ytVideos = videos.filter((v: any) => v.site === "YouTube" && v.key && v.key.trim().length > 0);
  if (ytVideos.length === 0) return null;

  const sorted = [...ytVideos].sort((a: any, b: any) => {
    // Official videos first
    const aOff = a.official ? 0 : 1;
    const bOff = b.official ? 0 : 1;
    if (aOff !== bOff) return aOff - bOff;

    // Type priority
    const aType = VIDEO_TYPE_PRIORITY[a.type] ?? 99;
    const bType = VIDEO_TYPE_PRIORITY[b.type] ?? 99;
    if (aType !== bType) return aType - bType;

    // Name containing "Official Trailer" gets priority
    const aName = a.name?.toLowerCase().includes("official trailer") ? 0 : 1;
    const bName = b.name?.toLowerCase().includes("official trailer") ? 0 : 1;
    return aName - bName;
  });

  const best = sorted[0];
  const embedUrl = `https://www.youtube.com/embed/${best.key}`;
  console.log(`[for-you-feed] Selected video for "${best.name}": key=${best.key}, type=${best.type}, official=${best.official}, embed=${embedUrl}`);
  return { key: best.key, name: best.name ?? "Trailer" };
}

// ── AI overview generation ──
async function callGroq(key: string, prompt: string, maxTokens = 120): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: maxTokens,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error(`Groq returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("Groq call failed:", err);
    return null;
  }
}

// Patterns that indicate a bad AI response that should be discarded
const BAD_OVERVIEW_PATTERNS = [
  /knowledge cutoff/i,
  /couldn'?t find/i,
  /could not find/i,
  /don'?t have (?:enough |any )?information/i,
  /i (?:am |was )?unable/i,
  /i (?:do not|don'?t) (?:have|know|possess)/i,
  /no information (?:is )?available/i,
  /not (?:enough |much )?(?:information|data|details) (?:available|provided|known)/i,
  /as of my (?:last|current) (?:update|training)/i,
  /my (?:training|data|knowledge) (?:cuts|stops|ends|goes)/i,
  /released after/i,
  /after (?:my|the) (?:knowledge|training|data) (?:cutoff|date)/i,
];

function isBadOverview(text: string): boolean {
  return BAD_OVERVIEW_PATTERNS.some((p) => p.test(text));
}

function buildOverviewPrompt(item: { title: string; media_type: string; year: string | null; genres: string[]; description: string }): string {
  const mediaLabel = item.media_type === "movie" ? "movie" : "TV show";
  const yearStr = item.year ?? "unknown year";
  const genresStr = item.genres.length > 0 ? item.genres.slice(0, 4).join(", ") : "unknown genres";
  const hasDescription = item.description && item.description.trim().length > 10;

  if (hasDescription) {
    return `Using ONLY the following TMDb data, write a short 2-3 sentence overview. Do not use outside knowledge. Do not mention knowledge cutoffs. Do not say you cannot find information. Do not claim the title does not exist. Do not add facts not present in the provided data. Keep it punchy, spoiler-free, and recommendation-style.

Title: ${item.title}
Year: ${yearStr}
Media type: ${mediaLabel}
Genres: ${genresStr}
TMDb overview: ${item.description}`;
  } else {
    return `Using ONLY the following TMDb data, write a short 1-2 sentence overview. Since no plot description is available, write a simple fallback like: "No detailed description is available yet, but this title is listed as a [genre] [media type] from [year]." Do not use outside knowledge. Do not mention knowledge cutoffs. Do not say you cannot find information. Do not claim the title does not exist. Do not add facts not present in the provided data.

Title: ${item.title}
Year: ${yearStr}
Media type: ${mediaLabel}
Genres: ${genresStr}
TMDb overview: (none available)`;
  }
}

function truncateOverview(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const trimmed = sentences.slice(0, 3).join(" ").trim();
  if (trimmed.length > 300) return trimmed.slice(0, 297) + "...";
  return trimmed;
}

function buildFallbackOverview(item: { title: string; media_type: string; year: string | null; genres: string[]; description: string }): string {
  const mediaLabel = item.media_type === "movie" ? "movie" : "TV show";
  const yearStr = item.year ?? "unknown year";
  const genresStr = item.genres.length > 0 ? item.genres.slice(0, 3).join(", ") : "unknown genres";

  if (item.description && item.description.trim().length > 10) {
    return truncateOverview(item.description);
  }
  return `No detailed description is available yet, but "${item.title}" is listed as a ${genresStr} ${mediaLabel} from ${yearStr}.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const TMDB_KEY = Deno.env.get("TMDB_API_KEY");
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!TMDB_KEY) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const page = body.page ?? 1;
    const user_id = body.user_id ?? null;
    const seen_tmdb_ids: number[] = body.seen_tmdb_ids ?? [];

    // ── Step 1: Determine user maturity preference ──
    let userMaturityPreference: MaturityBucket = "unknown";
    if (user_id) {
      const { data: userReviews } = await supabaseAdmin
        .from("personal_reviews")
        .select("tmdb_id, media_type, score")
        .eq("user_id", user_id);

      if (userReviews && userReviews.length >= 3) {
        const highRated = userReviews.filter((r: any) => r.score >= 70).slice(0, 20);
        const bucketCounts: Record<MaturityBucket, number> = { kids: 0, teen: 0, mature: 0, unknown: 0 };

        const ratingPromises = highRated.slice(0, 10).map(async (r: any) => {
          try {
            if (r.media_type === "movie") {
              const data = await tmdbFetch(`/movie/${r.tmdb_id}/release_dates`, TMDB_KEY);
              return extractMaturityRating(data);
            } else {
              const data = await tmdbFetch(`/tv/${r.tmdb_id}/content_ratings`, TMDB_KEY);
              return extractTvRating(data);
            }
          } catch { return null; }
        });
        const ratings = await Promise.all(ratingPromises);
        for (const rating of ratings) {
          bucketCounts[classifyMaturity(rating)]++;
        }

        const total = bucketCounts.kids + bucketCounts.teen + bucketCounts.mature;
        if (total > 0) {
          if (bucketCounts.mature / total > 0.4) userMaturityPreference = "mature";
          else if (bucketCounts.kids / total > 0.4) userMaturityPreference = "kids";
          else if (bucketCounts.teen / total > 0.3) userMaturityPreference = "teen";
        }
      }
    }

    // ── Step 2: Fetch TMDb trending + popular ──
    const [trendingMovies, trendingShows, popularMovies, popularShows] = await Promise.all([
      tmdbFetch(`/trending/movie/week?page=${page}`, TMDB_KEY).catch(() => ({ results: [] })),
      tmdbFetch(`/trending/tv/week?page=${page}`, TMDB_KEY).catch(() => ({ results: [] })),
      tmdbFetch(`/movie/popular?page=${page}`, TMDB_KEY).catch(() => ({ results: [] })),
      tmdbFetch(`/tv/popular?page=${page}`, TMDB_KEY).catch(() => ({ results: [] })),
    ]);

    // Merge and deduplicate
    const allItems: { tmdb_id: number; title: string; media_type: "movie" | "show"; year: string | null; poster_path: string | null; backdrop_path: string | null; description: string; vote_average: number; genre_ids: number[]; source: string; adult: boolean }[] = [];
    const seen = new Set<number>(seen_tmdb_ids);

    function addItems(results: any[], mediaType: "movie" | "show", source: string) {
      for (const r of results ?? []) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        allItems.push({
          tmdb_id: r.id,
          title: r.title || r.name || "Unknown",
          media_type: mediaType,
          year: (r.release_date || r.first_air_date || "").slice(0, 4) || null,
          poster_path: r.poster_path ?? null,
          backdrop_path: r.backdrop_path ?? null,
          description: r.overview ?? "",
          vote_average: r.vote_average ?? 0,
          genre_ids: r.genre_ids ?? [],
          source,
          adult: r.adult ?? false,
        });
      }
    }

    addItems(trendingMovies.results, "movie", "trending");
    addItems(trendingShows.results, "show", "trending");
    addItems(popularMovies.results, "movie", "popular");
    addItems(popularShows.results, "show", "popular");

    const pageItems = allItems.slice(0, 20);
    const tmdbIds = pageItems.map((i) => i.tmdb_id);

    // ── Step 3: Fetch app data, AI cache in parallel ──
    const [mediaItemsRes, cachedOverviewsRes] = await Promise.all([
      supabaseAdmin.from("media_items").select("id, tmdb_id").in("tmdb_id", tmdbIds),
      supabaseAdmin.from("media_ai_overviews").select("tmdb_id, media_type, overview").in("tmdb_id", tmdbIds),
    ]);

    const mediaItemMap = new Map<number, string>();
    const mediaItemIds: string[] = [];
    for (const mi of mediaItemsRes.data ?? []) {
      mediaItemMap.set(mi.tmdb_id, mi.id);
      mediaItemIds.push(mi.id);
    }

    const [appReviewsRes, followingRes, followersRes] = await Promise.all([
      mediaItemIds.length > 0
        ? supabaseAdmin.from("reviews").select("media_item_id, user_id, score, text, review_type, voice_audio_url, voice_summary, voice_duration_seconds, profiles(username, display_name)").in("media_item_id", mediaItemIds)
        : Promise.resolve({ data: [] }),
      user_id ? supabaseAdmin.from("follows").select("following_id").eq("follower_id", user_id) : Promise.resolve({ data: [] }),
      user_id ? supabaseAdmin.from("follows").select("follower_id").eq("following_id", user_id) : Promise.resolve({ data: [] }),
    ]);

    // Build app score map
    const appScoreMap = new Map<number, { scores: number[]; reviews: any[] }>();
    for (const r of appReviewsRes.data ?? []) {
      for (const [tmdbId, miId] of mediaItemMap) {
        if (miId === r.media_item_id) {
          if (!appScoreMap.has(tmdbId)) appScoreMap.set(tmdbId, { scores: [], reviews: [] });
          appScoreMap.get(tmdbId)!.scores.push(r.score);
          appScoreMap.get(tmdbId)!.reviews.push(r);
          break;
        }
      }
    }

    const followingIds = new Set((followingRes.data ?? []).map((f: any) => f.following_id));
    const followerIds = new Set((followersRes.data ?? []).map((f: any) => f.follower_id));
    const friendIds = new Set([...followingIds].filter((id) => followerIds.has(id)));

    // AI overview cache — filter out bad cached overviews
    const overviewCache = new Map<string, string>();
    const badCacheKeys: string[] = [];
    for (const o of cachedOverviewsRes.data ?? []) {
      const cacheKey = `${o.tmdb_id}:${o.media_type}`;
      if (isBadOverview(o.overview)) {
        badCacheKeys.push(cacheKey);
        console.log(`[for-you-feed] Discarding bad cached overview for ${o.tmdb_id} (${o.media_type}): "${o.overview.slice(0, 80)}..."`);
      } else {
        overviewCache.set(cacheKey, o.overview);
      }
    }

    // Delete bad cached overviews from DB
    if (badCacheKeys.length > 0) {
      const badTmdbIds = badCacheKeys.map((k) => parseInt(k.split(":")[0]));
      const badMediaTypes = badCacheKeys.map((k) => k.split(":")[1]);
      // Delete in batches
      for (let i = 0; i < badTmdbIds.length; i++) {
        await supabaseAdmin.from("media_ai_overviews")
          .delete()
          .eq("tmdb_id", badTmdbIds[i])
          .eq("media_type", badMediaTypes[i]);
      }
    }

    // ── Step 4: Fetch videos and maturity ratings in parallel ──
    const videoMap = new Map<number, { key: string; name: string }>();
    const maturityMap = new Map<number, string | null>();

    const detailPromises = pageItems.map(async (item) => {
      const tasks: Promise<void>[] = [];

      // Fetch video
      tasks.push(
        tmdbFetch(
          item.media_type === "movie" ? `/movie/${item.tmdb_id}/videos` : `/tv/${item.tmdb_id}/videos`,
          TMDB_KEY
        ).then((data) => {
          const best = pickBestVideo(data.results ?? []);
          if (best) {
            videoMap.set(item.tmdb_id, best);
          } else {
            console.log(`[for-you-feed] No valid YouTube video for tmdb_id=${item.tmdb_id} "${item.title}"`);
          }
        }).catch((err) => {
          console.error(`[for-you-feed] Video fetch failed for tmdb_id=${item.tmdb_id}:`, err);
        })
      );

      // Fetch maturity rating
      tasks.push(
        (item.media_type === "movie"
          ? tmdbFetch(`/movie/${item.tmdb_id}/release_dates`, TMDB_KEY).then((d) => extractMaturityRating(d))
          : tmdbFetch(`/tv/${item.tmdb_id}/content_ratings`, TMDB_KEY).then((d) => extractTvRating(d))
        ).then((rating) => {
          maturityMap.set(item.tmdb_id, rating);
        }).catch(() => {
          maturityMap.set(item.tmdb_id, null);
        })
      );

      await Promise.all(tasks);
    });
    await Promise.all(detailPromises);

    // ── Step 5: Build feed items ──
    const feedItems: FeedItem[] = pageItems.map((item) => {
      const appData = appScoreMap.get(item.tmdb_id);
      const avg = appData ? Math.round(appData.scores.reduce((a, b) => a + b, 0) / appData.scores.length) : null;
      const reviewCount = appData?.scores.length ?? 0;

      let bestReview: FeedItem["review"] = null;
      const reviews = appData?.reviews ?? [];
      const sorted = [...reviews].sort((a, b) => {
        const aRel = friendIds.has(a.user_id) ? 0 : followingIds.has(a.user_id) ? 1 : followerIds.has(a.user_id) ? 2 : 3;
        const bRel = friendIds.has(b.user_id) ? 0 : followingIds.has(b.user_id) ? 1 : followerIds.has(b.user_id) ? 2 : 3;
        return aRel - bRel;
      });
      if (sorted.length > 0 && (sorted[0].text || sorted[0].voice_audio_url)) {
        const r = sorted[0];
        const rel = friendIds.has(r.user_id) ? "friend" : followingIds.has(r.user_id) ? "following" : followerIds.has(r.user_id) ? "follower" : "community";
        bestReview = {
          username: r.profiles?.username ?? "",
          display_name: r.profiles?.display_name ?? "",
          score: r.score,
          text: r.text ?? "",
          relationship: rel,
          review_type: r.review_type ?? "text",
          voice_audio_url: r.voice_audio_url ?? null,
          voice_summary: r.voice_summary ?? null,
          voice_duration_seconds: r.voice_duration_seconds ?? null,
        };
      }

      const video = videoMap.get(item.tmdb_id);
      const cachedOverview = overviewCache.get(`${item.tmdb_id}:${item.media_type}`);
      const maturityRating = maturityMap.get(item.tmdb_id) ?? null;

      return {
        tmdb_id: item.tmdb_id,
        title: item.title,
        media_type: item.media_type,
        year: item.year,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        description: item.description,
        vote_average: item.vote_average,
        genres: mapGenres(item.genre_ids),
        maturity_rating: maturityRating,
        app_score: avg,
        app_review_count: reviewCount,
        review: bestReview,
        ai_overview: cachedOverview ?? null,
        video_key: video?.key ?? null,
        video_name: video?.name ?? null,
      };
    });

    // ── Step 6: Maturity-aware ranking ──
    feedItems.sort((a, b) => {
      const aBucket = classifyMaturity(a.maturity_rating);
      const bBucket = classifyMaturity(b.maturity_rating);
      const aMatch = maturityScore(aBucket, userMaturityPreference);
      const bMatch = maturityScore(bBucket, userMaturityPreference);
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.vote_average - a.vote_average;
    });

    // ── Step 7: Generate AI overviews for items without valid cache (max 5) ──
    if (GROQ_KEY) {
      const itemsNeedingOverview = feedItems.filter((i) => !i.ai_overview).slice(0, 5);
      const overviewPromises = itemsNeedingOverview.map(async (item) => {
        const prompt = buildOverviewPrompt(item);
        const text = await callGroq(GROQ_KEY, prompt, 120);

        if (text && !isBadOverview(text)) {
          const overview = truncateOverview(text);
          item.ai_overview = overview;
          // Cache the good overview
          await supabaseAdmin.from("media_ai_overviews").upsert(
            { tmdb_id: item.tmdb_id, media_type: item.media_type, title: item.title, overview, updated_at: new Date().toISOString() },
            { onConflict: "tmdb_id,media_type" }
          );
        } else if (text && isBadOverview(text)) {
          console.log(`[for-you-feed] Discarding bad AI response for tmdb_id=${item.tmdb_id}: "${text.slice(0, 80)}..."`);
          // Use fallback instead
          item.ai_overview = buildFallbackOverview(item);
        }
      });
      await Promise.all(overviewPromises);
    }

    // Fallback for items still without AI overview
    for (const item of feedItems) {
      if (!item.ai_overview) {
        item.ai_overview = buildFallbackOverview(item);
      }
    }

    return new Response(JSON.stringify({ items: feedItems, page, has_more: allItems.length > 20, maturity_preference: userMaturityPreference }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("for-you-feed error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function maturityScore(itemBucket: MaturityBucket, userPref: MaturityBucket): number {
  if (userPref === "unknown") return 0;
  if (itemBucket === userPref) return 3;
  const order: MaturityBucket[] = ["kids", "teen", "mature", "unknown"];
  const uIdx = order.indexOf(userPref);
  const iIdx = order.indexOf(itemBucket);
  if (Math.abs(uIdx - iIdx) === 1) return 1;
  return 0;
}
