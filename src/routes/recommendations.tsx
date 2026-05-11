import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Sparkles, Users, Film, Tv } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type MediaItem } from "@/lib/supabase";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "For You — RankWithMe" },
      { name: "description", content: "Discover what to watch next based on your group's ratings." },
    ],
  }),
  component: RecsPage,
});

type TopRatedItem = MediaItem & { avg: number; group_name: string; group_id: string };

function RecsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<TopRatedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoadingItems(true);

      // Get all groups the user is a member of
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name)")
        .eq("user_id", user!.id);

      if (!memberships?.length) {
        setLoadingItems(false);
        return;
      }

      const groupIds = memberships.map((m) => m.group_id);
      const groupMap = new Map<string, string>();
      memberships.forEach((m: any) => {
        if (m.groups) groupMap.set(m.groups.id, m.groups.name);
      });

      // Get all media items from those groups
      const { data: allItems } = await supabase
        .from("media_items")
        .select("*")
        .in("group_id", groupIds);

      if (!allItems?.length) {
        setLoadingItems(false);
        return;
      }

      // Get reviews for items the current user hasn't rated yet
      const { data: userReviews } = await supabase
        .from("reviews")
        .select("media_item_id")
        .eq("user_id", user!.id);

      const ratedIds = new Set(userReviews?.map((r) => r.media_item_id) ?? []);

      // Get avg scores for all items
      const withAvg = await Promise.all(
        allItems
          .filter((item) => !ratedIds.has(item.id))
          .map(async (item) => {
            const { data: reviews } = await supabase
              .from("reviews")
              .select("score")
              .eq("media_item_id", item.id);
            const scores = reviews?.map((r) => r.score) ?? [];
            const avg = scores.length
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : 0;
            return {
              ...item,
              avg,
              group_name: groupMap.get(item.group_id) ?? "",
              group_id: item.group_id,
            } as TopRatedItem;
          })
      );

      // Sort by avg descending, take top 10
      const sorted = withAvg
        .filter((i) => i.avg > 0)
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);

      setItems(sorted);
      setLoadingItems(false);
    }
    load();
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            For You
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          Highly rated by your groups
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Titles you haven't rated yet, loved by your crew.
        </p>
      </section>

      <section className="mt-6 space-y-3 px-5 pb-6">
        {loadingItems ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-12 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">Nothing to show yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Join groups and start rating to get personalised picks.
              </p>
            </div>
            <Link
              to="/group"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Browse groups
            </Link>
          </div>
        ) : (
          items.map((item, idx) => (
            <Link
              key={item.id}
              to="/group/$itemId"
              params={{ itemId: item.group_id }}
              className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted"
            >
              <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                {item.media_type === "movie" ? (
                  <Film className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Tv className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.media_type} · {item.year ?? "—"}
                </p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{item.group_name}</span>
                </div>
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background:
                    item.avg >= 75
                      ? "color-mix(in oklab, var(--color-score-high) 20%, var(--color-card))"
                      : item.avg >= 50
                      ? "color-mix(in oklab, var(--color-score-mid) 20%, var(--color-card))"
                      : "color-mix(in oklab, var(--color-score-low) 20%, var(--color-card))",
                  color:
                    item.avg >= 75
                      ? "var(--color-score-high)"
                      : item.avg >= 50
                      ? "var(--color-score-mid)"
                      : "var(--color-score-low)",
                  border: "1.5px solid currentColor",
                }}
              >
                {item.avg}
              </div>
            </Link>
          ))
        )}
      </section>
    </AppShell>
  );
}
