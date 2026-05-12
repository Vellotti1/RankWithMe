import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, type PersonalReview, recalculateGroupStars } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReviewForm } from "@/components/ReviewForm";
import { VoiceReviewPlayer } from "@/components/VoiceReviewPlayer";
import { Search, X, Film, Tv, Star, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

type ReviewMode = "text" | "voice";

interface TmdbResult {
  tmdb_id: number;
  title: string;
  year: string | null;
  media_type: "movie" | "show";
  poster_path: string | null;
  description: string;
}

function ReviewPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [myReviews, setMyReviews] = useState<PersonalReview[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rate sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TmdbResult | null>(null);
  const [draftScore, setDraftScore] = useState(80);
  const [draftText, setDraftText] = useState("");
  const [reviewType, setReviewType] = useState<ReviewMode>("text");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadReviews = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("personal_reviews")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setMyReviews(data);
  }, [user]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  // Debounced TMDB search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/tmdb-search?query=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const data = await res.json();
        setSearchResults(data.results ?? []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  function openRate(result: TmdbResult) {
    const existing = myReviews.find((r) => Number(r.tmdb_id) === Number(result.tmdb_id));
    setSelectedResult(result);
    setDraftScore(existing?.score ?? 80);
    setDraftText(existing?.text ?? "");
    setReviewType((existing as any)?.review_type === "voice" ? "voice" : "text");
    setSheetOpen(true);
  }

  function openEditReview(review: PersonalReview) {
    setSelectedResult({
      tmdb_id: review.tmdb_id,
      title: review.title,
      year: review.year?.toString() ?? null,
      media_type: review.media_type,
      poster_path: review.poster_path,
      description: review.description,
    });
    setDraftScore(review.score);
    setDraftText((review as any).review_type === "voice" ? "" : review.text);
    setReviewType((review as any).review_type === "voice" ? "voice" : "text");
    setSheetOpen(true);
  }

  async function handleSave(data: { score: number; review_type: ReviewMode; text: string; voice_audio_url: string | null; voice_duration_seconds: number | null }) {
    if (!user || !selectedResult) return;
    setSaving(true);

    const reviewData: Record<string, any> = {
      user_id: user.id,
      tmdb_id: selectedResult.tmdb_id,
      title: selectedResult.title,
      media_type: selectedResult.media_type,
      year: selectedResult.year ? parseInt(selectedResult.year) : null,
      poster_path: selectedResult.poster_path,
      description: selectedResult.description,
      score: data.score,
      text: data.review_type === "text" ? data.text : "",
      review_type: data.review_type,
      voice_audio_url: data.review_type === "voice" ? data.voice_audio_url : null,
      voice_duration_seconds: data.review_type === "voice" ? data.voice_duration_seconds : null,
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error } = await supabase
      .from("personal_reviews")
      .upsert(reviewData, { onConflict: "user_id,tmdb_id" })
      .select()
      .maybeSingle();

    if (error) {
      toast.error("Failed to save review.");
      setSaving(false);
      return;
    }

    // Auto-add to all groups the user is in
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    if (memberships?.length) {
      for (const m of memberships) {
        const { data: existing } = await supabase
          .from("media_items")
          .select("id")
          .eq("group_id", m.group_id)
          .eq("tmdb_id", selectedResult.tmdb_id)
          .maybeSingle();

        let mediaItemId: string;

        if (!existing) {
          const { data: newItem } = await supabase
            .from("media_items")
            .insert({
              group_id: m.group_id,
              title: selectedResult.title,
              year: selectedResult.year ? parseInt(selectedResult.year) : null,
              media_type: selectedResult.media_type,
              description: selectedResult.description,
              poster_url: selectedResult.poster_path ? tmdbPosterUrl(selectedResult.poster_path) : "",
              tmdb_id: selectedResult.tmdb_id,
              tmdb_poster_path: selectedResult.poster_path,
              added_by: user.id,
            })
            .select("id")
            .maybeSingle();
          mediaItemId = newItem?.id;
        } else {
          mediaItemId = existing.id;
        }

        if (mediaItemId) {
          const groupReviewData: Record<string, any> = {
            media_item_id: mediaItemId,
            user_id: user.id,
            score: data.score,
            text: data.review_type === "text" ? data.text : "",
            review_type: data.review_type,
            voice_audio_url: data.review_type === "voice" ? data.voice_audio_url : null,
            voice_duration_seconds: data.review_type === "voice" ? data.voice_duration_seconds : null,
            updated_at: new Date().toISOString(),
          };
          const { data: groupReview } = await supabase.from("reviews").upsert(
            groupReviewData,
            { onConflict: "media_item_id,user_id" }
          ).select().maybeSingle();

          // Trigger voice summary for group review
          if (data.review_type === "voice" && groupReview) {
            fetch(`${SUPABASE_URL}/functions/v1/voice-summary`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
              body: JSON.stringify({
                review_id: groupReview.id,
                table: "reviews",
                user_id: user.id,
                title: selectedResult.title,
                media_type: selectedResult.media_type,
                duration_seconds: data.voice_duration_seconds ?? 0,
              }),
            }).catch(() => {});
          }
        }

        recalculateGroupStars(m.group_id).catch(() => {});
      }
    }

    // Trigger voice summary for personal review
    if (data.review_type === "voice" && upserted) {
      fetch(`${SUPABASE_URL}/functions/v1/voice-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          review_id: upserted.id,
          table: "personal_reviews",
          user_id: user.id,
          title: selectedResult.title,
          media_type: selectedResult.media_type,
          duration_seconds: data.voice_duration_seconds ?? 0,
        }),
      }).catch(() => {});
    }

    setSaving(false);
    toast.success("Review saved and added to your groups!");
    setSheetOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    loadReviews();
  }

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="px-5 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Star className="h-5 w-5 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Review</p>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Rate a title</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your reviews are saved to your profile and shared with your groups.</p>
      </div>

      <div className="mt-4 px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies & TV shows…"
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {(searchQuery || searching) && (
        <div className="mt-3 px-5 space-y-2">
          {searching && [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}
          {!searching && searchResults.length === 0 && searchQuery && (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          )}
          {!searching && searchResults.map((r) => {
            const existing = myReviews.find((rev) => Number(rev.tmdb_id) === Number(r.tmdb_id));
            return (
              <button
                key={r.tmdb_id}
                type="button"
                onClick={() => openRate(r)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:bg-muted"
              >
                {r.poster_path ? (
                  <img src={tmdbPosterUrl(r.poster_path, "w92")} alt={r.title} className="h-14 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.media_type === "movie" ? "Movie" : "TV Show"}{r.year ? ` · ${r.year}` : ""}</p>
                </div>
                {existing ? (
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={existing.score} size="sm" />
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-primary">Rate</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* My reviews */}
      {!searchQuery && (
        <div className="mt-6 px-5 pb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Your Reviews · {myReviews.length}
          </p>
          {myReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center">
              <Star className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No reviews yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Search for a movie or show above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myReviews.map((r) => {
                const poster = r.poster_path ? tmdbPosterUrl(r.poster_path, "w92") : null;
                const isVoice = (r as any).review_type === "voice";
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openEditReview(r)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:bg-muted"
                  >
                    {poster ? (
                      <img src={poster} alt={r.title} className="h-14 w-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        {r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.title}</p>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.media_type} · {r.year ?? "—"}</p>
                      {isVoice ? (
                        <p className="mt-0.5 text-xs text-primary font-medium">Voice review · {(r as any).voice_duration_seconds ?? 0}s</p>
                      ) : (
                        r.text && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.text}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={r.score} size="sm" />
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rate sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">
              <span className="block text-xs font-normal text-muted-foreground">
                {selectedResult?.media_type === "movie" ? "Movie" : "TV Show"}{selectedResult?.year ? ` · ${selectedResult.year}` : ""}
              </span>
              {selectedResult?.title}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-6">
            <ReviewForm
              score={draftScore}
              onScoreChange={setDraftScore}
              text={draftText}
              onTextChange={setDraftText}
              reviewType={reviewType}
              onReviewTypeChange={setReviewType}
              onSave={handleSave}
              saving={saving}
              saveLabel="Save review"
              textPlaceholder="Write a review…"
              mediaTitle={selectedResult?.title}
              mediaType={selectedResult?.media_type}
              userId={user?.id ?? ""}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
