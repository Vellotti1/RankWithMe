import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Poster } from "@/components/Poster";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCurrentUser } from "@/lib/current-user";
import {
  ITEMS,
  averageRating,
  getMember,
  scoreColor,
  summarize,
  type Review,
} from "@/lib/mock-data";
import { ChevronLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/group/$itemId")({
  loader: ({ params }) => {
    const item = ITEMS.find((i) => i.id === params.itemId);
    if (!item) throw notFound();
    return { itemId: item.id };
  },
  component: ItemDetail,
  notFoundComponent: () => (
    <AppShell>
      <div className="px-5 pt-10 text-center">
        <h1 className="text-xl font-bold">Title not found</h1>
        <Link to="/group" className="mt-3 inline-block text-primary">Back to group</Link>
      </div>
    </AppShell>
  ),
});

function ItemDetail() {
  const { itemId } = Route.useParams();
  const baseItem = ITEMS.find((i) => i.id === itemId)!;
  const { user } = useCurrentUser();

  // Local override of reviews so the user can rate / write
  const [localReviews, setLocalReviews] = useState<Review[]>(baseItem.reviews);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [draftRating, setDraftRating] = useState<number>(
    localReviews.find((r) => r.memberId === user.id)?.rating ?? 80,
  );
  const [draftText, setDraftText] = useState<string>(
    localReviews.find((r) => r.memberId === user.id)?.text ?? "",
  );

  const item = useMemo(
    () => ({ ...baseItem, reviews: localReviews }),
    [baseItem, localReviews],
  );
  const avg = averageRating(item);

  const submit = () => {
    setLocalReviews((prev) => {
      const others = prev.filter((r) => r.memberId !== user.id);
      return [...others, { memberId: user.id, rating: draftRating, text: draftText }];
    });
  };

  return (
    <AppShell>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-72" style={{ background: item.poster }} />
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-background/30 via-background/60 to-background" />

        <div className="relative px-5 pt-4">
          <Link
            to="/group"
            className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-1 text-xs font-medium backdrop-blur"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Group
          </Link>

          <div className="mt-6 flex gap-4">
            <Poster item={item} className="w-28 shrink-0 shadow-2xl" />
            <div className="min-w-0 flex-1 pt-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {item.type} · {item.year}
              </p>
              <h1 className="mt-1 text-xl font-extrabold leading-tight">{item.title}</h1>
              {item.subtitle && (
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <ScoreBadge score={avg} size="lg" onClick={() => setBreakdownOpen(true)} />
                <div className="text-xs leading-tight">
                  <p className="font-semibold">Group Average</p>
                  <p className="text-muted-foreground">
                    {item.reviews.length} ratings · tap for breakdown
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {item.description}
          </p>
        </div>
      </div>

      {/* Your rating */}
      <section className="mt-6 px-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar member={user} size={28} />
              <div>
                <p className="text-sm font-semibold">Your rating</p>
                <p className="text-xs text-muted-foreground">As {user.name}</p>
              </div>
            </div>
            <ScoreBadge score={draftRating} size="md" />
          </div>

          <div className="mt-4">
            <Slider
              value={[draftRating]}
              onValueChange={(v) => setDraftRating(v[0])}
              min={0}
              max={100}
              step={1}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Write a quick review for the group…"
            className="mt-3 min-h-20 resize-none bg-background"
          />

          <Button onClick={submit} className="mt-3 w-full">
            Save rating & review
          </Button>
        </div>
      </section>

      {/* AI summary */}
      <section className="mt-6 px-5">
        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 18%, var(--color-card)), color-mix(in oklab, var(--color-accent) 18%, var(--color-card)))",
            border: "1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-widest">
              Group Opinion Summary
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed">{summarize(item)}</p>
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-6 px-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Group Reviews
        </h3>
        <ul className="space-y-3">
          {item.reviews.map((r) => {
            const m = getMember(r.memberId);
            return (
              <li
                key={r.memberId}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar member={m} size={32} />
                    <div>
                      <p className="text-sm font-semibold">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">Group member</p>
                    </div>
                  </div>
                  <ScoreBadge score={r.rating} size="sm" />
                </div>
                {r.text && (
                  <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                    "{r.text}"
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <Sheet open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>Rating breakdown</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 pb-6">
            {[...item.reviews]
              .sort((a, b) => b.rating - a.rating)
              .map((r) => {
                const m = getMember(r.memberId);
                return (
                  <div
                    key={r.memberId}
                    className="flex items-center gap-3 rounded-xl bg-surface p-3"
                  >
                    <Avatar member={m} size={32} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{m.name}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${r.rating}%`,
                            background: scoreColor(r.rating),
                          }}
                        />
                      </div>
                    </div>
                    <ScoreBadge score={r.rating} size="sm" />
                  </div>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
