import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbPosterUrl, type MediaItem, type Profile, type Review } from "@/lib/supabase";
import { ChevronLeft, Film, Tv, Star, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/group/$itemId/$mediaId")({
  component: MediaDetailPage,
});

type ReviewWithProfile = Review & { profiles: Profile };

function MediaDetailPage() {
  const { itemId: groupId, mediaId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<MediaItem | null>(null);
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [draftScore, setDraftScore] = useState(80);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    setPageLoading(true);
    const [itemRes, reviewsRes] = await Promise.all([
      supabase.from("media_items").select("*").eq("id", mediaId).maybeSingle(),
      supabase
        .from("reviews")
        .select("*, profiles(id, username, display_name, avatar_url)")
        .eq("media_item_id", mediaId)
        .order("score", { ascending: false }),
    ]);

    if (itemRes.data) setItem(itemRes.data);
    if (reviewsRes.data) setReviews(reviewsRes.data as ReviewWithProfile[]);
    setPageLoading(false);
  }, [mediaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load user's existing review when opening rate sheet
  async function openRate() {
    if (!user) return;
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("media_item_id", mediaId)
      .eq("user_id", user.id)
      .maybeSingle();
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
    setSaving(false);
    if (error) {
      toast.error("Failed to save review.");
    } else {
      toast.success("Review saved!");
      setRateOpen(false);
      loadData();
    }
  }

  async function loadAiOverview() {
    if (!item || reviews.length === 0) return;
    setOverviewLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-overview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
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
      toast.error("Could not generate overview.");
    }
    setOverviewLoading(false);
  }

  if (loading || !user) return null;

  const avgScore =
    reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length)
      : null;

  const posterUrl = item?.tmdb_poster_path
    ? tmdbPosterUrl(item.tmdb_poster_path, "w500")
    : item?.poster_url || "";

  const myReview = reviews.find((r) => r.user_id === user.id);

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
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      ) : !item ? (
        <div className="px-5 pt-10 text-center">
          <p className="font-semibold">Title not found.</p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <section className="relative mt-4 px-5">
            <div className="flex gap-4">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={item.title}
                  className="h-44 w-32 shrink-0 rounded-2xl object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-44 w-32 shrink-0 items-center justify-center rounded-2xl bg-muted">
                  {item.media_type === "movie" ? (
                    <Film className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <Tv className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="flex flex-col justify-between py-1 min-w-0">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {item.media_type === "movie" ? "Movie" : "TV Show"}
                    {item.year ? ` · ${item.year}` : ""}
                  </span>
                  <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight">
                    {item.title}
                  </h1>
                  {item.description && (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-4">
                      {item.description}
                    </p>
                  )}
                </div>

                {avgScore !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <ScoreBadge score={avgScore} size="md" />
                    <span className="text-xs text-muted-foreground">
                      {reviews.length} {reviews.length === 1 ? "rating" : "ratings"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              className="mt-4 w-full gap-2"
              onClick={openRate}
            >
              <Star className="h-4 w-4" />
              {myReview ? "Edit my rating" : "Rate this"}
            </Button>
          </section>

          {/* AI Overview */}
          {reviews.length > 0 && (
            <section className="mt-6 px-5">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">AI Group Overview</h2>
                  </div>
                  {!overview && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={loadAiOverview}
                      disabled={overviewLoading}
                    >
                      {overviewLoading ? "Generating…" : "Generate"}
                    </Button>
                  )}
                </div>
                {overview ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{overview}</p>
                ) : !overviewLoading ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tap Generate for an AI summary of your group's opinions.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Reviews */}
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
                  <div
                    key={r.id}
                    className="flex gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {(r.profiles?.display_name || r.profiles?.username || "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {r.profiles?.display_name || r.profiles?.username || "Unknown"}
                          {r.user_id === user.id && (
                            <span className="ml-1.5 text-xs font-normal text-primary">(you)</span>
                          )}
                        </p>
                        <ScoreBadge score={r.score} size="sm" />
                      </div>
                      {r.text && (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {r.text}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Rate sheet */}
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
            <Slider
              value={[draftScore]}
              onValueChange={(v) => setDraftScore(v[0])}
              min={0} max={100} step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span><span>50</span><span>100</span>
            </div>
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Write a quick review for the group…"
              className="resize-none bg-background"
              rows={4}
            />
            <Button className="w-full" onClick={handleSaveReview} disabled={saving}>
              {saving ? "Saving…" : "Save rating & review"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
