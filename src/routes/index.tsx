import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Plus, Hash, TrendingUp, ArrowRight, Film, Star, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Group } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type PopularGroup = Group & { member_count: number };

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [popularGroups, setPopularGroups] = useState<PopularGroup[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setGroupsLoading(true);

      const [popularRes, myRes] = await Promise.all([
        supabase
          .from("groups")
          .select("*")
          .eq("is_public", true)
          .order("view_count", { ascending: false })
          .limit(6),
        supabase
          .from("group_members")
          .select("groups(*)")
          .eq("user_id", user!.id)
          .limit(4),
      ]);

      if (popularRes.data) {
        const withCounts = await Promise.all(
          popularRes.data.map(async (g) => {
            const { count } = await supabase
              .from("group_members")
              .select("*", { count: "exact", head: true })
              .eq("group_id", g.id);
            return { ...g, member_count: count ?? 0 };
          })
        );
        setPopularGroups(withCounts);
      }

      if (myRes.data) {
        const groups = myRes.data
          .map((row: any) => row.groups)
          .filter(Boolean) as Group[];
        setMyGroups(groups);
      }

      setGroupsLoading(false);
    }
    load();
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <div className="flex flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-8 pt-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -10%, var(--color-primary), transparent)",
            }}
          />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background:
                    "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))",
                }}
              >
                <Film className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                Kritiq
              </span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Rank movies &amp; shows
              <br />
              <span style={{ color: "var(--color-primary)" }}>with your crew.</span>
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Create private groups, rate everything you watch, and see how your taste stacks up against your friends.
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                to="/create"
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                New group
              </Link>
              <Link
                to="/join"
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <Hash className="h-4 w-4" />
                Join group
              </Link>
            </div>
          </div>
        </section>

        {/* My Groups */}
        {myGroups.length > 0 && (
          <section className="px-5 pb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Your groups</h2>
              <Link
                to="/group"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {myGroups.map((g) => (
                <Link
                  key={g.id}
                  to="/group/$groupId"
                  params={{ groupId: g.id }}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.is_public ? "Public" : "Private"}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Popular Groups */}
        <section className="px-5 pb-8">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Popular groups</h2>
          </div>

          {groupsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : popularGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No public groups yet</p>
                <p className="text-xs text-muted-foreground">Create the first public group!</p>
              </div>
              <Link
                to="/create"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Create group
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {popularGroups.map((g, i) => (
                <PopularGroupCard key={g.id} group={g} rank={i + 1} />
              ))}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="px-5 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/recommendations"
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-muted"
            >
              <Star className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">For You</p>
              <p className="text-xs text-muted-foreground">Personalized picks</p>
            </Link>
            <Link
              to="/group"
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-muted"
            >
              <Users className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">All groups</p>
              <p className="text-xs text-muted-foreground">Manage your groups</p>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function PopularGroupCard({ group, rank }: { group: PopularGroup; rank: number }) {
  async function incrementView() {
    await supabase
      .from("groups")
      .update({ view_count: group.view_count + 1 })
      .eq("id", group.id);
  }

  return (
    <Link
      to="/group/$groupId"
      params={{ groupId: group.id }}
      onClick={incrementView}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
        style={{
          background:
            rank === 1
              ? "linear-gradient(135deg, var(--color-primary), oklch(0.72 0.16 60))"
              : "oklch(0.26 0.025 270)",
          color:
            rank === 1
              ? "var(--color-primary-foreground)"
              : "var(--color-muted-foreground)",
        }}
      >
        #{rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{group.name}</p>
        {group.description && (
          <p className="truncate text-xs text-muted-foreground">{group.description}</p>
        )}
        <div className="mt-0.5 flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {group.view_count.toLocaleString()}
          </span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
