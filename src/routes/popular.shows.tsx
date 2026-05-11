import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbPosterUrl } from "@/lib/supabase";
import { ChevronLeft, Tv } from "lucide-react";
import { ScoreBadge } from "@/components/ScoreBadge";

export const Route = createFileRoute("/popular/shows")({
  component: PopularShowsPage,
});

type PopularMedia = { id: string; title: string; year: number | null; tmdb_poster_path: string | null; poster_url: string; avg: number; review_count: number };

function PopularShowsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<PopularMedia[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      setDataLoading(true);
      const { data } = await supabase.from("media_items").select("*").eq("media_type", "show");
      if (data?.length) {
        const withAvg = await Promise.all(data.map(async (item) => {
          const { data: reviews } = await supabase.from("reviews").select("score").eq("media_item_id", item.id);
          const scores = reviews?.map((r) => r.score) ?? [];
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { ...item, avg, review_count: scores.length };
        }));
        setItems(withAvg.filter((s) => s.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 25));
      }
      setDataLoading(false);
    }
    load();
  }, []);

  if (loading || !user) return null;

  return (
    <AppShell>
      <section className="px-5 pt-5">
        <button type="button" onClick={() => navigate({ to: "/" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Home
        </button>
        <div className="mt-4 flex items-center gap-2">
          <Tv className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight">Popular Shows</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Top 25 most reviewed TV shows</p>
      </section>

      <section className="mt-5 px-5 pb-8">
        {dataLoading ? (
          <div className="flex flex-col gap-3">{[1,2,3,4,5].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No shows rated yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => {
              const poster = item.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w154") : item.poster_url;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-muted-foreground">{idx + 1}</span>
                  {poster ? (
                    <img src={poster} alt={item.title} className="h-14 w-10 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted"><Tv className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.year ?? "—"} · {item.review_count} {item.review_count === 1 ? "rating" : "ratings"}</p>
                  </div>
                  <ScoreBadge score={item.avg} size="sm" />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
