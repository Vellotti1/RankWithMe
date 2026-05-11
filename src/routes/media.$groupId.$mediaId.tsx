import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import {
  supabase, tmdbPosterUrl, tmdbStillUrl,
  type MediaItem, type Profile, type Review, type Episode,
} from "@/lib/supabase";
import { ChevronLeft, Film, Tv, Star, Sparkles, Users, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/media/$groupId/$mediaId")({
  component: MediaDetailPage,
});

type ReviewWithProfile = Review & { profiles: Profile };
type EpisodeWithAvg = Episode & { avg: number; review_count: number };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function MediaDetailPage() {
  const { groupId, mediaId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const overviewLoadedForCount = useRef<number>(-1);

  // Episode state (shows only)
  const [seasons, setSeasons] = useState<{ season_number: number; name: string; episode_count: number }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<EpisodeWithAvg[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);

  // Rate sheet (movies only)
  const [rateOpen, setRateOpen] = useState(false);
  const [draftScore, setDraftScore] = useState(80);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    const [itemRes, reviewsRes, memberRes] = await Promise.all([
      supabase.from("media_items").select("*").eq("id", mediaId).maybeSingle(),
      supabase
        .from("reviews")
        .select("*, profiles(id, username, display_name, avatar_url)")
        .eq("media_item_id", mediaId)
        .order("score", { ascending: false }),
      supabase.from("group_members").select("id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (itemRes.data) setItem(itemRes.data);
    if (reviewsRes.data) setReviews(reviewsRes.data as ReviewWithProfile[]);
    setIsMember(!!memberRes.data);
    setPageLoading(false);
  }, [mediaId, groupId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-load AI overview whenever reviews change and there are reviews
  useEffect(() => {
    if (!item || reviews.length === 0) return;
    // Only reload if the review count changed (new/edited review) or not yet loaded
    if (overviewLoadedForCount.current === reviews.length && overview !== null) return;
    overviewLoadedForCount.current = reviews.length;
    loadAiOverview();
  }, [reviews, item]);

  async function loadAiOverview() {
    if (!item) return;
    setOverviewLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          title: item.title,
          media_type: item.media_type,
          reviews: reviews.map((r) => ({
            username: r.profiles?.display_name || r.profiles?.username || "Someone",
            score: r.score,
            text: r.text,
          })),
        }),
      });
      const data = await res.json();
      setOverview(data.overview ?? null);
    } catch {
      // silently fail — no toast for auto-load
    }
    setOverviewLoading(false);
  }

  // When item loads and it's a show, fetch seasons
  useEffect(() => {
    if (!item || item.media_type !== "show" || !item.tmdb_id) return;
    async function fetchSeasons() {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/tmdb-search?action=seasons&tmdb_id=${item!.tmdb_id}`,
        { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const data = await res.json();
      if (data.seasons?.length) {
        setSeasons(data.seasons);
        setSelectedSeason(data.seasons[0].season_number);
      }
    }
    fetchSeasons();
  }, [item]);

  // Load episodes when season changes
  useEffect(() => {
    if (!item || item.media_type !== "show" || !item.tmdb_id || !seasons.length) return;
    loadEpisodes(selectedSeason);
  }, [selectedSeason, item, seasons.length]);

  async function loadEpisodes(seasonNum: number) {
    if (!item?.tmdb_id) return;
    setEpisodesLoading(true);

    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/tmdb-search?action=episodes&tmdb_id=${item.tmdb_id}&season=${seasonNum}`,
      { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json();
    const tmdbEps = data.episodes ?? [];

    if (!tmdbEps.length) { setEpisodesLoading(false); return; }

    // Upsert episodes into DB
    await supabase.from("episodes").upsert(
      tmdbEps.map((e: any) => ({
        media_item_id: mediaId,
        tmdb_episode_id: e.tmdb_episode_id,
        season_number: e.season_number,
        episode_number: e.episode_number,
        title: e.title,
        overview: e.overview,
        still_path: e.still_path,
        air_date: e.air_date,
      })),
      { onConflict: "media_item_id,season_number,episode_number", ignoreDuplicates: false }
    );

    const { data: storedEps } = await supabase
      .from("episodes")
      .select("*")
      .eq("media_item_id", mediaId)
      .eq("season_number", seasonNum)
      .order("episode_number");

    if (!storedEps) { setEpisodesLoading(false); return; }

    const withAvg = await Promise.all(
      storedEps.map(async (ep) => {
        const { data: epReviews } = await supabase
          .from("episode_reviews").select("score").eq("episode_id", ep.id);
        const scores = epReviews?.map((r) => r.score) ?? [];
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { ...ep, avg, review_count: scores.length } as EpisodeWithAvg;
      })
    );

    setEpisodes(withAvg);
    setEpisodesLoading(false);
  }

  async function openRate() {
    if (!user) return;
    const { data } = await supabase
      .from("reviews").select("*")
      .eq("media_item_id", mediaId).eq("user_id", user.id).maybeSingle();
    setDraftScore(data?.score ?? 80);
    setDraftText(data?.text ?? "");
    setRateOpen(true);
  }

  async function handleSaveReview() {
    if (!user || !item) return;
    setSaving(true);
    const { error } = await supabase.from("reviews").upsert(
      { media_item_id: mediaId, user_id: user.id, score: draftScore, text: draftText, updated_at: new Date().toISOString() },
      { onConflict: "media_item_id,user_id" }
    );

    // Sync to personal_reviews if item has a tmdb_id
    if (!error && item.tmdb_id) {
      await supabase.from("personal_reviews").upsert(
        {
          user_id: user.id,
          tmdb_id: item.tmdb_id,
          title: item.title,
          media_type: item.media_type,
          year: item.year,
          poster_path: item.tmdb_poster_path,
          description: item.description ?? "",
          score: draftScore,
          text: draftText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id" }
      );
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save review.");
    } else {
      toast.success("Review saved!");
      setRateOpen(false);
      overviewLoadedForCount.current = -1;
      loadData();
    }
  }

  if (loading || !user) return null;

  const avgScore = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length)
    : null;
  const posterUrl = item?.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w500") : item?.poster_url || "";
  const myReview = reviews.find((r) => r.user_id === user.id);
  const isShow = item?.media_type === "show";
  const currentSeason = seasons.find((s) => s.season_number === selectedSeason);

  return (
    <AppShell>
      <section className="px-5 pt-5">
        <Link
          to="/group/$itemId"
          params={{ itemId: groupId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to group
        </Link>
      </section>

      {pageLoading ? (
        <div className="px-5 pt-6 space-y-4">
          <div className="h-56 animate-pulse rounded-2xl bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
      ) : !item ? (
        <div className="px-5 pt-10 text-center">
          <p className="font-semibold">Title not found.</p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="mt-4 px-5">
            <div className="flex gap-4">
              {posterUrl ? (
                <img src={posterUrl} alt={item.title} className="h-44 w-32 shrink-0 rounded-2xl object-cover shadow-lg" />
              ) : (
                <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  {isShow ? <Tv className="h-10 w-10 text-muted-foreground" /> : <Film className="h-10 w-10 text-muted-foreground" />}
                </div>
              )}
              <div className="flex flex-col justify-between py-1 min-w-0">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {isShow ? "TV Show" : "Movie"}{item.year ? ` · ${item.year}` : ""}
                  </span>
                  <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight">{item.title}</h1>
                  {item.description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">{item.description}</p>
                  )}
                </div>
                {!isShow && avgScore !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <ScoreBadge score={avgScore} size="md" />
                    <span className="text-xs text-muted-foreground">
                      {reviews.length} {reviews.length === 1 ? "rating" : "ratings"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rate button — movies only */}
            {!isShow && isMember && (
              <Button className="mt-4 w-full gap-2" onClick={openRate}>
                <Star className="h-4 w-4" />
                {myReview ? "Edit my rating" : "Rate this"}
              </Button>
            )}
          </section>

          {/* AI Overview — auto-loads, no button */}
          <section className="mt-6 px-5">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">AI Group Overview</h2>
              </div>
              {overviewLoading ? (
                <div className="space-y-2 mt-1">
                  {[1, 0.8, 0.6].map((w, i) => (
                    <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w * 100}%` }} />
                  ))}
                </div>
              ) : overview ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{overview}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {reviews.length === 0 ? "Add ratings to generate a group overview." : "Generating overview…"}
                </p>
              )}
            </div>
          </section>

          {/* Episodes section — shows only */}
          {isShow && seasons.length > 0 && (
            <section className="mt-6 px-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Episodes</h2>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSeasonOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    {currentSeason?.name ?? `Season ${selectedSeason}`}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {seasonOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                      {seasons.map((s) => (
                        <button
                          key={s.season_number}
                          type="button"
                          onClick={() => { setSelectedSeason(s.season_number); setSeasonOpen(false); }}
                          className={`w-full px-3 py-2 text-left text-xs hover:bg-muted ${s.season_number === selectedSeason ? "font-bold text-primary" : ""}`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {episodesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
                </div>
              ) : (
                <ol className="space-y-2 pb-8">
                  {episodes.map((ep) => {
                    const still = ep.still_path ? tmdbStillUrl(ep.still_path) : null;
                    return (
                      <li key={ep.id}>
                        <Link
                          to="/episode/$groupId/$mediaId/$episodeId"
                          params={{ groupId, mediaId, episodeId: ep.id }}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                        >
                          <span className="w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">
                            {ep.episode_number}
                          </span>
                          {still ? (
                            <img src={still} alt={ep.title} className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Tv className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{ep.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ep.review_count > 0
                                ? `${ep.review_count} ${ep.review_count === 1 ? "rating" : "ratings"}`
                                : "No ratings yet"}
                            </p>
                          </div>
                          {ep.review_count > 0 ? (
                            <ScoreBadge score={ep.avg} size="sm" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}

          {/* Movie reviews only (shows use episode reviews) */}
          {!isShow && (
            <section className="mt-6 px-5 pb-8">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {reviews.length} {reviews.length === 1 ? "Rating" : "Ratings"}
                </h2>
              </div>
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">No ratings yet. Be the first!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {(r.profiles?.display_name || r.profiles?.username || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {r.profiles?.display_name || r.profiles?.username || "Unknown"}
                            {r.user_id === user.id && <span className="ml-1.5 text-xs font-normal text-primary">(you)</span>}
                          </p>
                          <ScoreBadge score={r.score} size="sm" />
                        </div>
                        {r.text && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Spacer for shows (episodes list has bottom padding) */}
          {isShow && seasons.length === 0 && <div className="pb-8" />}
        </>
      )}

      {/* Rate sheet — movies only */}
      <Sheet open={rateOpen} onOpenChange={setRateOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>{item?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your score</p>
              <ScoreBadge score={draftScore} size="lg" />
            </div>
            <Slider value={[draftScore]} onValueChange={(v) => setDraftScore(v[0])} min={0} max={100} step={1} />
            <div className="flex justify-between text-xs text-muted-foreground"><span>0</span><span>50</span><span>100</span></div>
            <Textarea value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Write a quick review for the group…" className="resize-none bg-background" rows={4} />
            <Button className="w-full" onClick={handleSaveReview} disabled={saving}>
              {saving ? "Saving…" : "Save rating & review"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
