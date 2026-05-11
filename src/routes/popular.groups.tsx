import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Group } from "@/lib/supabase";
import { ChevronLeft, TrendingUp, Users, Eye, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/popular/groups")({
  component: PopularGroupsPage,
});

type PopularGroup = Group & { member_count: number };

function PopularGroupsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<PopularGroup[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    async function load() {
      setDataLoading(true);
      const { data } = await supabase.from("groups").select("*").eq("is_public", true).order("view_count", { ascending: false }).limit(25);
      if (data?.length) {
        const withCounts = await Promise.all(data.map(async (g) => {
          const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
          return { ...g, member_count: count ?? 0 };
        }));
        setGroups(withCounts);
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
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight">Popular Groups</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Top 25 most viewed public groups</p>
      </section>

      <section className="mt-5 px-5 pb-8">
        {dataLoading ? (
          <div className="flex flex-col gap-3">{[1,2,3,4,5].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No public groups yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g, i) => (
              <Link key={g.id} to="/group/$itemId" params={{ itemId: g.id }} className="flex overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted">
                {g.image_url ? (
                  <div className="h-20 w-24 shrink-0 overflow-hidden"><img src={g.image_url} alt={g.name} className="h-full w-full object-cover" /></div>
                ) : (
                  <span className="flex h-20 w-14 shrink-0 items-center justify-center text-sm font-bold"
                    style={{ background: i === 0 ? "linear-gradient(135deg, var(--color-primary), oklch(0.72 0.16 60))" : "oklch(0.26 0.025 270)", color: i === 0 ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}>
                    #{i + 1}
                  </span>
                )}
                <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {g.image_url && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                          style={{ background: i === 0 ? "linear-gradient(135deg, var(--color-primary), oklch(0.72 0.16 60))" : "oklch(0.26 0.025 270)", color: i === 0 ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}>
                          {i + 1}
                        </span>
                      )}
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                    </div>
                    {g.description && <p className="truncate text-xs text-muted-foreground">{g.description}</p>}
                    <div className="mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{g.member_count}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{g.view_count.toLocaleString()}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
