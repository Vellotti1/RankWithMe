import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Hash, TrendingUp, ArrowRight, Film, Tv, Eye, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbPosterUrl, type Group } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type PopularGroup = Group & { member_count: number };
type PopularMedia = { id: string; title: string; media_type: string; year: number | null; tmdb_poster_path: string | null; poster_url: string; avg: number; review_count: number };

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [popularGroups, setPopularGroups] = useState<PopularGroup[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [popularMovies, setPopularMovies] = useState<PopularMedia[]>([]);
  const [popularShows, setPopularShows] = useState<PopularMedia[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      setDataLoading(true);

      const { data: groups } = await supabase.from("groups").select("*").eq("is_public", true).order("view_count", { ascending: false }).limit(6);
      if (groups?.length) {
        const withCounts = await Promise.all(groups.map(async (g) => {
          const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
          return { ...g, member_count: count ?? 0 };
        }));
        setPopularGroups(withCounts);
      }

      const { data: allMovies } = await supabase.from("media_items").select("*").eq("media_type", "movie");
      if (allMovies?.length) {
        const withAvg = await Promise.all(allMovies.map(async (item) => {
          const { data: reviews } = await supabase.from("reviews").select("score").eq("media_item_id", item.id);
          const scores = reviews?.map((r) => r.score) ?? [];
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { ...item, avg, review_count: scores.length };
        }));
        setPopularMovies(withAvg.filter((m) => m.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 6));
      }

      const { data: allShows } = await supabase.from("media_items").select("*").eq("media_type", "show");
      if (allShows?.length) {
        const withAvg = await Promise.all(allShows.map(async (item) => {
          const { data: reviews } = await supabase.from("reviews").select("score").eq("media_item_id", item.id);
          const scores = reviews?.map((r) => r.score) ?? [];
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { ...item, avg, review_count: scores.length };
        }));
        setPopularShows(withAvg.filter((s) => s.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 6));
      }

      setDataLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function loadMyGroups() {
      const { data } = await supabase.from("group_members").select("groups(*)").eq("user_id", user!.id).limit(6);
      if (data) setMyGroups(data.map((row: any) => row.groups).filter(Boolean) as Group[]);
    }
    loadMyGroups();
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-6 pt-8">
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, var(--color-primary), transparent)" }} />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))" }}>
                <Film className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Kritiq</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Rank movies &amp; shows<br />
              <span style={{ color: "var(--color-primary)" }}>with your crew.</span>
            </h1>
            <div className="mt-2 flex gap-3">
              <Link to="/create" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4" /> New group
              </Link>
              <Link to="/join" className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                <Hash className="h-4 w-4" /> Join group
              </Link>
            </div>
          </div>
        </section>

        {/* My Groups */}
        {myGroups.length > 0 && (
          <section className="px-5 pb-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Your groups</h2>
              <Link to="/group" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {myGroups.slice(0, 3).map((g) => (
                <Link key={g.id} to="/group/$itemId" params={{ itemId: g.id }} className="flex overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted">
                  {g.image_url ? (
                    <div className="h-16 w-20 shrink-0 overflow-hidden"><img src={g.image_url} alt={g.name} className="h-full w-full object-cover" /></div>
                  ) : (
                    <div className="flex h-16 w-20 shrink-0 items-center justify-center bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div className="flex flex-1 items-center justify-between px-4 py-3 min-w-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.is_public ? "Public" : "Private"}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
              {myGroups.length > 3 && (
                <Link to="/group" className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  View {myGroups.length - 3} more <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Popular Groups */}
        {popularGroups.length > 0 && (
          <section className="px-5 pb-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Popular groups</h2>
              </div>
              {popularGroups.length > 3 && (
                <Link to="/group" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  See all <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {popularGroups.slice(0, 3).map((g, i) => <PopularGroupCard key={g.id} group={g} rank={i + 1} />)}
              {popularGroups.length > 3 && (
                <Link to="/group" className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  View more <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Popular Movies */}
        {!dataLoading && popularMovies.length > 0 && (
          <section className="px-5 pb-5">
            <div className="mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Popular Movies</h2>
            </div>
            <div className="flex flex-col gap-2">
              {popularMovies.slice(0, 3).map((item, idx) => {
                const poster = item.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w154") : item.poster_url;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{idx + 1}</span>
                    {poster ? <img src={poster} alt={item.title} className="h-14 w-10 shrink-0 rounded-md object-cover" /> : (
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted"><Film className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.year ?? "—"} · {item.review_count} {item.review_count === 1 ? "rating" : "ratings"}</p>
                    </div>
                    <ScoreBadge score={item.avg} size="sm" />
                  </div>
                );
              })}
              {popularMovies.length > 3 && (
                <Link to="/group" className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  View {popularMovies.length - 3} more <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Popular Shows */}
        {!dataLoading && popularShows.length > 0 && (
          <section className="px-5 pb-5">
            <div className="mb-3 flex items-center gap-2">
              <Tv className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Popular Shows</h2>
            </div>
            <div className="flex flex-col gap-2">
              {popularShows.slice(0, 3).map((item, idx) => {
                const poster = item.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w154") : item.poster_url;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{idx + 1}</span>
                    {poster ? <img src={poster} alt={item.title} className="h-14 w-10 shrink-0 rounded-md object-cover" /> : (
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
              {popularShows.length > 3 && (
                <Link to="/group" className="flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  View {popularShows.length - 3} more <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="px-5 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/review" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 hover:bg-muted">
              <Star className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Review</p>
              <p className="text-xs text-muted-foreground">Rate what you've watched</p>
            </Link>
            <Link to="/recommendations" className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 hover:bg-muted">
              <TrendingUp className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">For You</p>
              <p className="text-xs text-muted-foreground">Personalised picks</p>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PopularGroupCard({ group, rank }: { group: PopularGroup; rank: number }) {
  async function incrementView() {
    await supabase.from("groups").update({ view_count: group.view_count + 1 }).eq("id", group.id);
  }
  return (
    <Link to="/group/$itemId" params={{ itemId: group.id }} onClick={incrementView} className="flex overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted">
      {group.image_url ? (
        <div className="h-20 w-24 shrink-0 overflow-hidden"><img src={group.image_url} alt={group.name} className="h-full w-full object-cover" /></div>
      ) : (
        <span className="flex h-20 w-14 shrink-0 items-center justify-center text-sm font-bold"
          style={{ background: rank === 1 ? "linear-gradient(135deg, var(--color-primary), oklch(0.72 0.16 60))" : "oklch(0.26 0.025 270)", color: rank === 1 ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}>
          #{rank}
        </span>
      )}
      <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {group.image_url && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                style={{ background: rank === 1 ? "linear-gradient(135deg, var(--color-primary), oklch(0.72 0.16 60))" : "oklch(0.26 0.025 270)", color: rank === 1 ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}>
                {rank}
              </span>
            )}
            <p className="truncate text-sm font-semibold">{group.name}</p>
          </div>
          {group.description && <p className="truncate text-xs text-muted-foreground">{group.description}</p>}
          <div className="mt-0.5 flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{group.member_count}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{group.view_count.toLocaleString()}</span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
