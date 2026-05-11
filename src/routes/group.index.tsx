import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Plus, Users, Copy, Globe, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Group, type MediaItem, type Review } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/group/")({
  component: GroupListPage,
});

type GroupWithItems = Group & { item_count: number; member_count: number };

function GroupListPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupWithItems[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoadingGroups(true);
      const { data } = await supabase
        .from("group_members")
        .select("groups(*)")
        .eq("user_id", user!.id);

      if (data) {
        const rawGroups = data.map((row: any) => row.groups).filter(Boolean) as Group[];
        const withCounts = await Promise.all(
          rawGroups.map(async (g) => {
            const [items, members] = await Promise.all([
              supabase.from("media_items").select("*", { count: "exact", head: true }).eq("group_id", g.id),
              supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id),
            ]);
            return { ...g, item_count: items.count ?? 0, member_count: members.count ?? 0 };
          })
        );
        setGroups(withCounts);
      }
      setLoadingGroups(false);
    }
    load();
  }, [user]);

  if (loading || !user) return null;

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Groups</h1>
          </div>
          <Link
            to="/create"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New
          </Link>
        </div>
      </section>

      <section className="mt-4 px-5">
        {loadingGroups ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">No groups yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create or join a group to start ranking.</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/create"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Create group
              </Link>
              <Link
                to="/join"
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Join group
              </Link>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  to="/group/$groupId"
                  params={{ groupId: g.id }}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-bold">{g.name}</h2>
                        {g.is_public ? (
                          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      {g.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{g.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {g.member_count} {g.member_count === 1 ? "member" : "members"}
                      </span>
                      <span>{g.item_count} titles</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(g.invite_code);
                        toast.success("Invite code copied!");
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-mono font-semibold hover:bg-muted"
                    >
                      {g.invite_code}
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </AppShell>
  );
}
