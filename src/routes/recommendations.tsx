import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Poster } from "@/components/Poster";
import { RECOMMENDATIONS } from "@/lib/mock-data";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/recommendations")({
  head: () => ({
    meta: [
      { title: "Group Recommendations — RankWithMe" },
      { name: "description", content: "Movies and shows recommended for your group based on your ratings." },
    ],
  }),
  component: RecsPage,
});

function RecsPage() {
  return (
    <AppShell>
      <section className="px-5 pt-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            For your group
          </p>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
          Picks the crew will probably love
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Based on what your group has rated highly so far.
        </p>
      </section>

      <section className="mt-6 space-y-4 px-5">
        {RECOMMENDATIONS.map((r) => (
          <article
            key={r.id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex gap-3 p-3">
              <Poster
                item={{ title: r.title, poster: r.poster }}
                className="w-24 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Recommended · {r.year}
                </p>
                <h2 className="mt-0.5 text-base font-bold leading-tight">{r.title}</h2>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                  {r.description}
                </p>
              </div>
            </div>
            <div
              className="flex items-start gap-2 border-t border-border p-3"
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent)",
              }}
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed">{r.reason}</p>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
