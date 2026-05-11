import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { GROUP, ITEMS, averageRating } from "@/lib/mock-data";
import { Avatar } from "@/components/Avatar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/group/")({
  head: () => ({
    meta: [
      { title: "Movie Night Crew — RankWithMe" },
      { name: "description", content: "Group dashboard for ranking movies and shows together." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const sorted = [...ITEMS].sort((a, b) => averageRating(b) - averageRating(a));

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Group
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{GROUP.name}</h1>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex -space-x-2">
            {GROUP.members.map((m) => (
              <div key={m.id} className="ring-2 ring-background rounded-full">
                <Avatar member={m} size={30} />
              </div>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {GROUP.members.length} members
          </span>
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Invite</span>
          <span className="font-mono font-semibold">{GROUP.inviteCode}</span>
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </section>

      <section className="mt-6 px-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Group Rankings
          </h2>
          <span className="text-xs text-muted-foreground">{sorted.length} titles</span>
        </div>

        <ol className="space-y-2">
          {sorted.map((item, idx) => (
            <li key={item.id}>
              <Link
                to="/group/$itemId"
                params={{ itemId: item.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-surface-elevated"
              >
                <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div
                  className="h-16 w-12 shrink-0 rounded-md"
                  style={{ background: item.poster }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  {item.subtitle && (
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  )}
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {item.type} · {item.year} · {item.reviews.length} ratings
                  </p>
                </div>
                <ScoreBadge score={averageRating(item)} size="md" />
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
