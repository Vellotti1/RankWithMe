import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { GROUP, ITEMS, averageRating } from "@/lib/mock-data";
import { Avatar } from "@/components/Avatar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Plus, LogIn, Eye, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const top = [...ITEMS].sort((a, b) => averageRating(b) - averageRating(a)).slice(0, 3);

  return (
    <AppShell>
      <section className="relative overflow-hidden px-5 pb-8 pt-6">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 80% 0%, color-mix(in oklab, var(--color-accent) 35%, transparent), transparent 70%), radial-gradient(50% 40% at 0% 20%, color-mix(in oklab, var(--color-primary) 30%, transparent), transparent 70%)",
          }}
        />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Friends · Films · Scores
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
          Rank movies & shows{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            }}
          >
            with your crew
          </span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Score every movie, show, season or episode. See the group average, read each
          other's takes, and get recommendations tuned to your circle.
        </p>

        <div className="mt-6 grid gap-2">
          <Button asChild size="lg" className="h-12 text-base font-semibold">
            <Link to="/group">
              <Eye className="mr-1 h-4 w-4" /> View Demo Group
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" className="h-11">
              <Link to="/create">
                <Plus className="mr-1 h-4 w-4" /> Create
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11">
              <Link to="/join">
                <LogIn className="mr-1 h-4 w-4" /> Join
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Demo group
              </p>
              <h2 className="mt-0.5 text-lg font-bold">{GROUP.name}</h2>
            </div>
            <div className="flex -space-x-2">
              {GROUP.members.map((m) => (
                <div key={m.id} className="ring-2 ring-card rounded-full">
                  <Avatar member={m} size={28} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {top.map((item) => (
              <Link
                key={item.id}
                to="/group/$itemId"
                params={{ itemId: item.id }}
                className="flex items-center gap-3 rounded-xl bg-surface p-2 transition-colors hover:bg-muted"
              >
                <div
                  className="h-12 w-9 shrink-0 rounded-md"
                  style={{ background: item.poster }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.subtitle ?? `${item.type} · ${item.year}`}
                  </p>
                </div>
                <ScoreBadge score={averageRating(item)} size="sm" />
              </Link>
            ))}
          </div>
        </div>

        <Link
          to="/recommendations"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--color-primary), var(--color-accent))",
              color: "var(--color-primary-foreground)",
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Group Recommendations</p>
            <p className="text-xs text-muted-foreground">
              Picks based on what your crew loves
            </p>
          </div>
        </Link>
      </section>
    </AppShell>
  );
}
