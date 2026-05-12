import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReviewForm } from "@/components/ReviewForm";
import { VoiceReviewPlayer } from "@/components/VoiceReviewPlayer";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbStillUrl, type Episode, type EpisodeReview, type Profile } from "@/lib/supabase";
import { ChevronLeft, Tv, Star, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/episode/$groupId/$mediaId/$episodeId")({
  component: EpisodeDetailPage,
});

type EpisodeReviewWithProfile = EpisodeReview & { profiles: Profile };

function EpisodeDetailPage() {
  const { groupId, mediaId, episodeId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [reviews, setReviews] = useState<EpisodeReviewWithProfile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [draftScore, setDraftScore] = useState(80);
  const [draftText, setDraftText] = useState("");
  const [reviewType, setReviewType] = useState<"text" | "voice">("text");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    const [epRes, reviewsRes, memberRes] = await Promise.all([
      supabase.from("episodes").select("*").eq("id", episodeId).maybeSingle(),
      supabase
        .from("episode_reviews")
        .select("*, profiles(id, username, display_name, avatar_url)")
        .eq("episode_id", episodeId)
        .order("score", { ascending: false }),
      supabase.from("group_members").select("id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    ]);

    if (epRes.data) setEpisode(epRes.data);
    if (reviewsRes.data) setReviews(reviewsRes.data as EpisodeReviewWithProfile[]);
    setIsMember(!!memberRes.data);
    setPageLoading(false);
  }, [episodeId, groupId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function openRate() {
    if (!user) return;
    const { data } = await supabase
      .from("episode_reviews")
      .select("*")
      .eq("episode_id", episodeId)
      .eq("user_id", user.id)
      .maybeSingle();
    setDraftScore(data?.score ?? 80);
    setDraftText((data as any)?.review_type === "voice" ? "" : (data?.text ?? ""));
    setReviewType((data as any)?.review_type === "voice" ? "voice" : "text");
    setRateOpen(true);
  }

  async function handleSaveReview(data: { score: number; review_type: "text" | "voice"; text: string; voice_audio_url: string | null; voice_duration_seconds: number | null }) {
    if (!user || !episode) return;
    setSaving(true);
    const reviewRow: Record<string, any> = {
      episode_id: episodeId,
      user_id: user.id,
      score: data.score,
      text: data.review_type === "text" ? data.text : "",
      review_type: data.review_type,
      voice_audio_url: data.review_type === "voice" ? data.voice_audio_url : null,
      voice_duration_seconds: data.review_type === "voice" ? data.voice_duration_seconds : null,
      updated_at: new Date().toISOString(),
    };
    const { data: upserted, error } = await supabase.from("episode_reviews").upsert(
      reviewRow,
      { onConflict: "episode_id,user_id" }
    ).select().maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Failed to save review.");
    } else {
      toast.success("Review saved!");
      setRateOpen(false);
      loadData();
      // Trigger voice summary
      if (data.review_type === "voice" && upserted) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({
            review_id: upserted.id,
            table: "episode_reviews",
            user_id: user.id,
            title: episode.title,
            media_type: "show",
            duration_seconds: data.voice_duration_seconds ?? 0,
          }),
        }).catch(() => {});
      }
    }
  }

  if (loading || !user) return null;

  const avgScore = reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length)
    : null;
  const stillUrl = episode?.still_path ? tmdbStillUrl(episode.still_path, "w780") : null;
  const myReview = reviews.find((r) => r.user_id === user.id);

  return (
    <AppShell>
      <section className="px-5 pt-5">
        <Link
          to="/media/$groupId/$mediaId"
          params={{ groupId, mediaId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to show
        </Link>
      </section>

      {pageLoading ? (
        <div className="px-5 pt-6 space-y-4">
          <div className="h-48 animate-pulse rounded-2xl bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </div>
      ) : !episode ? (
        <div className="px-5 pt-10 text-center">
          <p className="font-semibold">Episode not found.</p>
        </div>
      ) : (
        <>
          {/* Hero still */}
          {stillUrl ? (
            <div className="mt-4 px-5">
              <img src={stillUrl} alt={episode.title} className="w-full rounded-2xl object-cover shadow-lg aspect-video" />
            </div>
          ) : (
            <div className="mt-4 mx-5 flex aspect-video items-center justify-center rounded-2xl bg-muted">
              <Tv className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          <section className="mt-4 px-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Season {episode.season_number} · Episode {episode.episode_number}
              {episode.air_date ? ` · ${episode.air_date.slice(0, 4)}` : ""}
            </p>
            <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight">{episode.title}</h1>
            {episode.overview && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{episode.overview}</p>
            )}

            <div className="mt-4 flex items-center gap-4">
              {avgScore !== null && (
                <div className="flex items-center gap-2">
                  <ScoreBadge score={avgScore} size="md" />
                  <span className="text-xs text-muted-foreground">
                    {reviews.length} {reviews.length === 1 ? "rating" : "ratings"}
                  </span>
                </div>
              )}
            </div>

            {isMember && (
              <Button className="mt-4 w-full gap-2" onClick={openRate}>
                <Star className="h-4 w-4" />
                {myReview ? "Edit my rating" : "Rate this episode"}
              </Button>
            )}
          </section>

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
                {reviews.map((r) => {
                  const isVoice = (r as any).review_type === "voice" && (r as any).voice_audio_url;
                  return (
                    <div key={r.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                      <Link to="/user/$userId" params={{ userId: r.user_id }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:opacity-80 transition-opacity">
                        {(r.profiles?.display_name || r.profiles?.username || "?").slice(0, 2).toUpperCase()}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link to="/user/$userId" params={{ userId: r.user_id }} className="text-sm font-semibold hover:text-primary transition-colors">
                            {r.profiles?.display_name || r.profiles?.username || "Unknown"}
                            {r.user_id === user.id && <span className="ml-1.5 text-xs font-normal text-primary">(you)</span>}
                          </Link>
                          <ScoreBadge score={r.score} size="sm" />
                        </div>
                        {isVoice ? (
                          <VoiceReviewPlayer
                            audioUrl={(r as any).voice_audio_url}
                            summary={(r as any).voice_summary}
                            duration={(r as any).voice_duration_seconds}
                          />
                        ) : (
                          r.text && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <Sheet open={rateOpen} onOpenChange={setRateOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-left">
              <span className="block text-xs font-normal text-muted-foreground">
                S{episode?.season_number} E{episode?.episode_number}
              </span>
              {episode?.title}
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
              onSave={handleSaveReview}
              saving={saving}
              saveLabel="Save rating & review"
              textPlaceholder="What did you think of this episode?"
              mediaTitle={episode?.title}
              mediaType="show"
              userId={user?.id ?? ""}
            />
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
