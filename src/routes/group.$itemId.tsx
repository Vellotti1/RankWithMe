import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { supabase, type Group, type MediaItem, type Review, type Profile } from "@/lib/supabase";
import { ChevronLeft, Copy, Users, Plus, Lock, Globe, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/group/$itemId")({
  component: GroupDetailPage,
});

type ReviewWithProfile = Review & { profiles: Profile };
type MediaWithAvg = MediaItem & { avg: number; review_count: number };

function GroupDetailPage() {
  const { itemId: groupId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaWithAvg[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Add media sheet
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newType, setNewType] = useState<"movie" | "show">("movie");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  // Rate item sheet
  const [rateItem, setRateItem] = useState<MediaWithAvg | null>(null);
  const [draftScore, setDraftScore] = useState(80);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);

    const [groupRes, membersRes, itemsRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase
        .from("group_members")
        .select("profiles(*)")
        .eq("group_id", groupId),
      supabase.from("media_items").select("*").eq("group_id", groupId),
    ]);

    if (groupRes.data) setGroup(groupRes.data);
    if (membersRes.data) {
      setMembers(membersRes.data.map((row: any) => row.profiles).filter(Boolean));
    }

    if (itemsRes.data) {
      // For each item, get all reviews to compute avg
      const withAvg = await Promise.all(
        itemsRes.data.map(async (item) => {
          const { data: reviews } = await supabase
            .from("reviews")
            .select("score")
            .eq("media_item_id", item.id);
          const scores = reviews?.map((r) => r.score) ?? [];
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { ...item, avg, review_count: scores.length } as MediaWithAvg;
        })
      );
      setMediaItems(withAvg.sort((a, b) => b.avg - a.avg));
    }

    setPageLoading(false);
  }, [groupId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Increment view count when loading a public group
  useEffect(() => {
    if (group?.is_public) {
      supabase
        .from("groups")
        .update({ view_count: (group.view_count ?? 0) + 1 })
        .eq("id", groupId);
    }
  }, [group?.id]);

  async function handleAddMedia() {
    if (!user || !newTitle.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("media_items").insert({
      group_id: groupId,
      title: newTitle.trim(),
      year: newYear ? parseInt(newYear) : null,
      media_type: newType,
      description: newDesc.trim(),
      added_by: user.id,
    });
    setAdding(false);
    if (error) {
      toast.error("Failed to add title.");
    } else {
      toast.success(`"${newTitle}" added!`);
      setNewTitle("");
      setNewYear("");
      setNewDesc("");
      setAddOpen(false);
      loadData();
    }
  }

  async function openRate(item: MediaWithAvg) {
    if (!user) return;
    setRateItem(item);
    // Load existing review
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("media_item_id", item.id)
      .eq("user_id", user.id)
      .maybeSingle();
    setDraftScore(data?.score ?? 80);
    setDraftText(data?.text ?? "");
  }

  async function handleSaveReview() {
    if (!user || !rateItem) return;
    setSaving(true);
    const { error } = await supabase.from("reviews").upsert(
      {
        media_item_id: rateItem.id,
        user_id: user.id,
        score: draftScore,
        text: draftText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "media_item_id,user_id" }
    );
    setSaving(false);
    if (error) {
      toast.error("Failed to save review.");
    } else {
      toast.success("Review saved!");
      setRateItem(null);
      loadData();
    }
  }

  if (loading || !user) return null;

  if (!pageLoading && !group) {
    return (
      <AppShell>
        <div className="px-5 pt-10 text-center">
          <h1 className="text-xl font-bold">Group not found</h1>
          <Link to="/group" className="mt-3 inline-block text-primary">Back to groups</Link>
        </div>
      </AppShell>
    );
  }

  const isMember = members.some((m) => m.id === user.id);

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <Link
          to="/group"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> All groups
        </Link>

        {pageLoading ? (
          <div className="mt-4 space-y-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{group?.name}</h1>
                  {group?.is_public ? (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {group?.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
              </div>
              {group && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(group.invite_code);
                    toast.success("Invite code copied!");
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-mono font-semibold hover:bg-muted"
                >
                  {group.invite_code}
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Rankings · {mediaItems.length} titles
          </h2>
          {isMember && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddOpen(true)}
              className="h-8 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add title
            </Button>
          )}
        </div>

        {pageLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
            <p className="text-sm font-medium">No titles yet</p>
            <p className="text-xs text-muted-foreground">Add the first movie or show to rank.</p>
            {isMember && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add title
              </Button>
            )}
          </div>
        ) : (
          <ol className="space-y-2">
            {mediaItems.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => isMember && openRate(item)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div
                    className="flex h-16 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold uppercase text-muted-foreground"
                  >
                    {item.media_type === "movie" ? "Film" : "Show"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {item.media_type} · {item.year ?? "—"} · {item.review_count} {item.review_count === 1 ? "rating" : "ratings"}
                    </p>
                  </div>
                  {item.review_count > 0 ? (
                    <ScoreBadge score={item.avg} size="md" />
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">—</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Add title sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>Add a title</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-6">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Interstellar"
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Year</label>
                <Input
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="2024"
                  type="number"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "movie" | "show")}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="movie">Movie</option>
                  <option value="show">Show</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description…"
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddMedia}
              disabled={!newTitle.trim() || adding}
            >
              {adding ? "Adding…" : "Add title"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Rate item sheet */}
      <Sheet open={!!rateItem} onOpenChange={(o) => !o && setRateItem(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader>
            <SheetTitle>{rateItem?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your score</p>
              <ScoreBadge score={draftScore} size="lg" />
            </div>
            <Slider
              value={[draftScore]}
              onValueChange={(v) => setDraftScore(v[0])}
              min={0}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Write a quick review for the group…"
              className="resize-none bg-background"
              rows={4}
            />
            <Button className="w-full" onClick={handleSaveReview} disabled={saving}>
              {saving ? "Saving…" : "Save rating & review"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
