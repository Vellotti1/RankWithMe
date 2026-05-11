import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sparkles, Film, Tv } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, type TasteProfile } from "@/lib/supabase";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/recommendations")({
  component: RecsPage,
});

interface TmdbRec {
  tmdb_id: number;
  title: string;
  media_type: "movie" | "show";
  year: string | null;
  poster_path: string | null;
  description: string;
  vote_average: number;
}

function RecsPage() {
  const { user, loading } = useAuth();
  const [recs, setRecs] = useState<TmdbRec[]>([]);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [recsLoading, setRecsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadRecs();
  }, [user]);

  async function loadRecs() {
    if (!user) return;
    setRecsLoading(true);

    // Load taste profile
    const { data: tp } = await supabase.from("taste_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setTasteProfile(tp);

    if (!tp?.genres?.length) {
      setRecsLoading(false);
      return;
    }

    // Get already-seen tmdb_ids
    const { data: personalReviews } = await supabase.from("personal_reviews").select("tmdb_id").eq("user_id", user.id);
    const seenIds = personalReviews?.map((r) => r.tmdb_id) ?? [];

    // Fetch recommendations from edge function
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ action: "recommendations", genres: tp.genres, already_seen_tmdb_ids: seenIds }),
      });
      const data = await res.json();
      setRecs(data.results ?? []);
    } catch { setRecs([]); }

    setRecsLoading(false);
  }

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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "taste_profile", user_id: user.id,
          reviews: reviews.map((r) => ({ title: r.title, media_type: r.media_type, year: r.year, score: r.score, text: r.text })),
        }),
      });
      const data = await res.json();
      if (data.summary && data.genres?.length) {
        const newProfile = { id: "", user_id: user.id, summary: data.summary, genres: data.genres, updated_at: new Date().toISOString() };
        setTasteProfile(newProfile);
        toast.success("Taste profile generated!");
        // Load recs directly with the new genres (don't re-fetch from DB which may lag)
        setRecsLoading(true);
        const { data: personalReviews } = await supabase.from("personal_reviews").select("tmdb_id").eq("user_id", user.id);
        const seenIds = personalReviews?.map((r) => r.tmdb_id) ?? [];
        try {
          const recsRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ action: "recommendations", genres: data.genres, already_seen_tmdb_ids: seenIds }),
          });
          const recsData = await recsRes.json();
          setRecs(recsData.results ?? []);
        } catch { setRecs([]); }
        setRecsLoading(false);
      } else {
        toast.error("Could not generate taste profile. Try adding more reviews.");
      }
    } catch {
      toast.error("Failed to connect to AI service.");
    }
    setGenerating(false);
  }

  if (loading || !user) return null;

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">For You</p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Recommended</h1>
        {tasteProfile?.genres?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tasteProfile.genres.map((g) => (
              <span key={g} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{g}</span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Based on your ratings and taste profile.</p>
        )}
      </section>

      <section className="mt-6 px-5 pb-8">
        {recsLoading ? (
          <div className="flex flex-col gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : !tasteProfile?.genres?.length ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">No taste profile yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Rate at least 3 titles in the Review tab, then generate your profile.</p>
            </div>
            <Button onClick={generateTasteProfile} disabled={generating}>{generating ? "Generating…" : "Generate taste profile"}</Button>
          </div>
        ) : recs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">No recommendations found</p>
            <Button variant="outline" onClick={loadRecs}>Refresh</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recs.map((item) => {
              const poster = item.poster_path ? tmdbPosterUrl(item.poster_path, "w154") : null;
              const score = Math.round(item.vote_average * 10);
              return (
                <div key={item.tmdb_id} className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3">
                  {poster ? (
                    <img src={poster} alt={item.title} className="h-16 w-11 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
                      {item.media_type === "movie" ? <Film className="h-5 w-5 text-muted-foreground" /> : <Tv className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.media_type}{item.year ? ` · ${item.year}` : ""}</p>
                    {item.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                  </div>
                  {score > 0 && <ScoreBadge score={score} size="sm" />}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
