import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, callEdgeFunction, type TasteProfile } from "@/lib/supabase";
import {
  Sparkles, Film, Tv, Play, Star, MessageSquare, Plus,
  Volume2, VolumeX, Users, RefreshCw, Mic, Shield,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/recommendations")({
  component: ForYouPage,
});

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
  review: {
    username: string;
    display_name: string;
    score: number;
    text: string;
    relationship: string;
    review_type: string;
    voice_audio_url: string | null;
    voice_summary: string | null;
    voice_duration_seconds: number | null;
  } | null;
  ai_overview: string | null;
  video_key: string | null;
  video_name: string | null;
}

function ForYouPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const seenIds = useRef<Set<number>>(new Set());
  const loaderRef = useRef<HTMLDivElement>(null);
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("taste_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setTasteProfile(data));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("group_members").select("group_id, groups(id, name)").eq("user_id", user.id).then(({ data }) => {
      if (data) setUserGroups(data.map((d: any) => ({ id: d.groups?.id, name: d.groups?.name })).filter((g: any) => g.id));
    });
  }, [user]);

  const loadFeed = useCallback(async (pageNum: number, append = false) => {
    if (!user) return;
    if (append) setLoadingMore(true);
    else setFeedLoading(true);

    try {
      const { data: personalReviews } = await supabase.from("personal_reviews").select("tmdb_id").eq("user_id", user.id);
      const seen = personalReviews?.map((r) => r.tmdb_id) ?? [];

      const data = await callEdgeFunction("for-you-feed", {
        page: pageNum,
        user_id: user.id,
        seen_tmdb_ids: [...seen, ...Array.from(seenIds.current)],
      });

      const newItems = (data.items ?? []) as FeedItem[];
      const filtered = newItems.filter((i) => !seenIds.current.has(i.tmdb_id));
      for (const i of filtered) seenIds.current.add(i.tmdb_id);

      if (append) setItems((prev) => [...prev, ...filtered]);
      else setItems(filtered);

      setHasMore(data.has_more ?? filtered.length >= 10);

      // If first page returned 0 items after filtering, auto-fetch next page
      if (!append && filtered.length === 0 && (data.has_more ?? true)) {
        setFeedLoading(false);
        loadFeed(pageNum + 1, false);
        return;
      }
    } catch {
      if (!append) setItems([]);
    }

    if (append) setLoadingMore(false);
    else setFeedLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) loadFeed(1);
  }, [user, loadFeed]);

  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadFeed(nextPage, true);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page, loadFeed]);

  async function generateTasteProfile() {
    if (!user) return;
    setGenerating(true);
    const { data: reviews } = await supabase.from("personal_reviews").select("*").eq("user_id", user.id);
    if (!reviews || reviews.length < 3) {
      toast.error("Rate at least 3 titles first.");
      setGenerating(false);
      return;
    }
    try {
      const data = await callEdgeFunction("ai-overview", {
        action: "taste_profile",
        user_id: user.id,
        reviews: reviews.map((r) => ({ title: r.title, media_type: r.media_type, year: r.year, score: r.score, text: r.text })),
      });
      if (data.summary && data.genres?.length) {
        setTasteProfile({ id: "", user_id: user.id, summary: data.summary, genres: data.genres, updated_at: new Date().toISOString() });
        toast.success("Taste profile generated!");
      } else {
        toast.error("Could not generate taste profile.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate.");
    }
    setGenerating(false);
  }

  if (loading || !user) return null;

  return (
    <AppShell>
      <section className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">For You</p>
          </div>
          <button
            type="button"
            onClick={() => { seenIds.current.clear(); setPage(1); setItems([]); loadFeed(1); }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Discover</h1>
        {tasteProfile?.genres?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tasteProfile.genres.map((g) => (
              <span key={g} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{g}</span>
            ))}
          </div>
        ) : (
          <div className="mt-2">
            <button type="button" onClick={generateTasteProfile} disabled={generating}
              className="text-xs text-primary hover:underline disabled:opacity-50">
              {generating ? "Generating taste profile..." : "Generate your taste profile for better picks"}
            </button>
          </div>
        )}
      </section>

      <section className="mt-2 pb-8">
        {feedLoading ? (
          <div className="flex flex-col gap-4 px-4">
            {[1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <Skeleton className="h-56 w-full" />
                <div className="space-y-2 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-16 w-full" /></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-5 py-16 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">No recommendations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Rate some titles and generate your taste profile for personalized picks.</p>
            </div>
            <Button onClick={generateTasteProfile} disabled={generating}>{generating ? "Generating..." : "Generate taste profile"}</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4">
            {items.map((item) => (
              <FeedCard key={item.tmdb_id} item={item} muted={muted} setMuted={setMuted} playingVideo={playingVideo} setPlayingVideo={setPlayingVideo} userGroups={userGroups} />
            ))}
            <div ref={loaderRef} className="flex items-center justify-center py-6">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading more...
                </div>
              )}
              {!hasMore && items.length > 0 && (
                <p className="text-sm text-muted-foreground">You've seen it all for now!</p>
              )}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function FeedCard({
  item,
  muted,
  setMuted,
  playingVideo,
  setPlayingVideo,
  userGroups,
}: {
  item: FeedItem;
  muted: boolean;
  setMuted: (m: boolean) => void;
  playingVideo: string | null;
  setPlayingVideo: (k: string | null) => void;
  userGroups: { id: string; name: string }[];
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const backdropUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null;
  const posterUrl = item.poster_path ? tmdbPosterUrl(item.poster_path, "w342") : null;
  const tmdbScore = Math.round(item.vote_average * 10);
  const hasVideo = !!(item.video_key && item.video_key.length > 0);

  async function handleAddToGroup(groupId: string) {
    setAddingToGroup(groupId);
    const { data: existing } = await supabase.from("media_items").select("id").eq("group_id", groupId).eq("tmdb_id", item.tmdb_id).maybeSingle();
    if (existing) {
      toast.info("Already in this group!");
    } else {
      const { error } = await supabase.from("media_items").insert({
        group_id: groupId,
        title: item.title,
        year: item.year ? parseInt(item.year) : null,
        media_type: item.media_type,
        description: item.description,
        poster_url: posterUrl ?? "",
        tmdb_id: item.tmdb_id,
        tmdb_poster_path: item.poster_path,
        added_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) toast.error("Failed to add.");
      else toast.success(`Added "${item.title}" to group!`);
    }
    setAddingToGroup(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Media Section */}
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {showVideo && hasVideo ? (
          <div className="relative h-full w-full">
            <iframe
              src={`https://www.youtube.com/embed/${item.video_key}?mute=${muted ? 1 : 0}&controls=1&modestbranding=1&rel=0`}
              title={item.video_name ?? "Trailer"}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        ) : (
          <>
            {backdropUrl ? (
              <img src={backdropUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
            ) : posterUrl ? (
              <img src={posterUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                {item.media_type === "movie" ? <Film className="h-12 w-12 text-muted-foreground" /> : <Tv className="h-12 w-12 text-muted-foreground" />}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {hasVideo && (
              <button
                type="button"
                onClick={() => { setShowVideo(true); setPlayingVideo(`${item.tmdb_id}`); }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform hover:scale-110">
                  <Play className="h-7 w-7 fill-white text-white" />
                </div>
              </button>
            )}
            {/* Media type badge */}
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {item.media_type === "movie" ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
              {item.media_type === "movie" ? "Movie" : "TV Show"}
            </div>
            {/* Maturity rating badge */}
            {item.maturity_rating && (
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <Shield className="h-3 w-3" />
                {item.maturity_rating}
              </div>
            )}
            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h2 className="text-xl font-bold text-white leading-tight">{item.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/80">
                {item.year && <span>{item.year}</span>}
                {item.genres.length > 0 && (
                  <>
                    {item.year && <span className="text-white/40">·</span>}
                    <span>{item.genres.slice(0, 3).join(", ")}</span>
                  </>
                )}
                {item.maturity_rating && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {item.maturity_rating}
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content Section */}
      <div className="space-y-3 p-4">
        {/* Scores row */}
        <div className="flex items-center gap-3">
          {item.app_score !== null && item.app_review_count > 0 ? (
            <div className="flex items-center gap-2">
              <ScoreBadge score={item.app_score} size="md" />
              <span className="text-xs text-muted-foreground">{item.app_review_count} app {item.app_review_count === 1 ? "rating" : "ratings"}</span>
            </div>
          ) : null}
          {tmdbScore > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">TMDb</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {tmdbScore}%
              </span>
            </div>
          )}
        </div>

        {/* AI Overview */}
        {item.ai_overview ? (
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">AI Overview</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{item.ai_overview}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground">Generating overview...</span>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
        )}

        {/* Review snippet */}
        {item.review && (
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {item.review.relationship === "friend" && "Review from a friend"}
                  {item.review.relationship === "following" && "Review from someone you follow"}
                  {item.review.relationship === "follower" && "Review from one of your followers"}
                  {item.review.relationship === "community" && "Community review"}
                </span>
              </div>
              <ScoreBadge score={item.review.score} size="sm" />
            </div>
            {item.review.review_type === "voice" && item.review.voice_audio_url ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                  <Mic className="h-3 w-3 shrink-0 text-primary" />
                  <audio controls className="h-6 flex-1" src={item.review.voice_audio_url} preload="metadata" />
                </div>
                {item.review.voice_summary && (
                  <p className="text-xs text-muted-foreground italic">{item.review.voice_summary}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-foreground line-clamp-3">{item.review.text}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              — {item.review.display_name || item.review.username || "Anonymous"}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Link to="/review" className="flex-1">
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
              <Star className="h-3.5 w-3.5" /> Add Review
            </Button>
          </Link>
          {userGroups.length > 0 && (
            <div className="relative flex-1 group">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add to Group
              </Button>
              <div className="absolute left-0 right-0 top-full z-10 mt-1 hidden group-hover:block">
                <div className="rounded-xl border border-border bg-card shadow-lg py-1 max-h-40 overflow-y-auto">
                  {userGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleAddToGroup(g.id)}
                      disabled={addingToGroup === g.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {g.name}
                      {addingToGroup === g.id && <RefreshCw className="ml-auto h-3 w-3 animate-spin" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
