import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbPosterUrl, type Group, type MediaItem, type Profile } from "@/lib/supabase";
import {
  ChevronLeft, Copy, Users, Plus, Lock, Globe, Settings,
  Film, Tv, Search, X, Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/group/$itemId")({
  component: GroupDetailPage,
});

type MediaWithAvg = MediaItem & { avg: number; review_count: number };

interface TmdbResult {
  tmdb_id: number;
  title: string;
  year: string | null;
  media_type: "movie" | "show";
  poster_path: string | null;
  description: string;
}

type GroupMemberWithProfile = { id: string; user_id: string; role: string; profiles: Profile };

function GroupDetailPage() {
  const { itemId: groupId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaWithAvg[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Add media via TMDB search
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null); // tmdb_id being added
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit group sheet (owner only)
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);

    const [groupRes, membersRes, itemsRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("id, user_id, role, profiles(*)").eq("group_id", groupId),
      supabase.from("media_items").select("*").eq("group_id", groupId),
    ]);

    if (groupRes.data) setGroup(groupRes.data);
    if (membersRes.data) {
      setMembers(membersRes.data.map((row: any) => ({ ...row, profiles: row.profiles })).filter((r: any) => r.profiles));
    }

    if (itemsRes.data) {
      const withAvg = await Promise.all(
        itemsRes.data.map(async (item) => {
          const { data: reviews } = await supabase
            .from("reviews").select("score").eq("media_item_id", item.id);
          const scores = reviews?.map((r) => r.score) ?? [];
          const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { ...item, avg, review_count: scores.length } as MediaWithAvg;
        })
      );
      setMediaItems(withAvg.sort((a, b) => b.avg - a.avg));
    }

    setPageLoading(false);
  }, [groupId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (group?.is_public) {
      supabase.from("groups").update({ view_count: (group.view_count ?? 0) + 1 }).eq("id", groupId);
    }
  }, [group?.id]);

  // TMDB search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/tmdb-search?query=${encodeURIComponent(searchQuery)}&type=multi`,
          { headers: { Authorization: `Bearer ${supabaseKey}` } }
        );
        const data = await res.json();
        setSearchResults(data.results ?? []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  async function handleAddFromTmdb(result: TmdbResult) {
    if (!user) return;
    setAdding(result.tmdb_id);
    const { error } = await supabase.from("media_items").insert({
      group_id: groupId,
      title: result.title,
      year: result.year ? parseInt(result.year) : null,
      media_type: result.media_type,
      description: result.description,
      poster_url: result.poster_path ? tmdbPosterUrl(result.poster_path) : "",
      tmdb_id: result.tmdb_id,
      tmdb_poster_path: result.poster_path,
      added_by: user.id,
    });
    setAdding(null);
    if (error) {
      toast.error("Failed to add title.");
    } else {
      toast.success(`"${result.title}" added!`);
      setAddOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      loadData();
    }
  }

  function openEdit() {
    if (!group) return;
    setEditName(group.name);
    setEditDesc(group.description ?? "");
    setEditImage(group.image_url ?? "");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!group) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("groups")
      .update({ name: editName.trim(), description: editDesc.trim(), image_url: editImage.trim() })
      .eq("id", group.id);
    setEditSaving(false);
    if (error) {
      toast.error("Failed to save changes.");
    } else {
      toast.success("Group updated!");
      setEditOpen(false);
      loadData();
    }
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    if (memberUserId === user?.id) return;
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("id", memberId);
    if (error) {
      toast.error("Failed to remove member.");
    } else {
      toast.success("Member removed.");
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

  const memberProfiles = members.map((m) => m.profiles);
  const isMember = memberProfiles.some((p) => p?.id === user.id);
  const isOwner = group?.owner_id === user.id;
  const posterUrl = group?.image_url || "";

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
            {posterUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl">
                <img src={posterUrl} alt={group?.name} className="h-32 w-full object-cover" />
              </div>
            )}
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
              {isOwner && (
                <button
                  type="button"
                  onClick={openEdit}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
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
          <ol className="space-y-2 pb-8">
            {mediaItems.map((item, idx) => {
              const poster = item.tmdb_poster_path
                ? tmdbPosterUrl(item.tmdb_poster_path, "w154")
                : item.poster_url;
              return (
                <li key={item.id}>
                  <Link
                    to="/group/$itemId/$mediaId"
                    params={{ itemId: groupId, mediaId: item.id }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                  >
                    <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                    {poster ? (
                      <img
                        src={poster}
                        alt={item.title}
                        className="h-16 w-11 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
                        {item.media_type === "movie"
                          ? <Film className="h-5 w-5 text-muted-foreground" />
                          : <Tv className="h-5 w-5 text-muted-foreground" />
                        }
                      </div>
                    )}
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
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Add title via TMDB search */}
      <Sheet open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setSearchQuery(""); setSearchResults([]); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add a title</SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies & TV shows…"
                className="pl-9 pr-9"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {searching && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              )}

              {!searching && searchQuery && searchResults.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
              )}

              {!searching && searchResults.map((r) => (
                <button
                  key={r.tmdb_id}
                  type="button"
                  onClick={() => handleAddFromTmdb(r)}
                  disabled={adding === r.tmdb_id}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {r.poster_path ? (
                    <img
                      src={tmdbPosterUrl(r.poster_path, "w92")}
                      alt={r.title}
                      className="h-14 w-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      {r.media_type === "movie"
                        ? <Film className="h-4 w-4 text-muted-foreground" />
                        : <Tv className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.media_type === "movie" ? "Movie" : "TV Show"}{r.year ? ` · ${r.year}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary shrink-0">
                    {adding === r.tmdb_id ? "Adding…" : "Add"}
                  </span>
                </button>
              ))}

              {!searchQuery && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Start typing to search TMDB for movies and TV shows.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit group sheet (owner only) */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit group</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div>
              <label className="text-sm font-medium">Group name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="What does this group watch?"
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cover image URL <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                placeholder="https://…"
                className="mt-1.5"
              />
              {editImage && (
                <img
                  src={editImage}
                  alt="Preview"
                  className="mt-2 h-24 w-full rounded-xl object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleSaveEdit}
              disabled={!editName.trim() || editSaving}
            >
              {editSaving ? "Saving…" : "Save changes"}
            </Button>

            {/* Members list with remove option */}
            <div className="pt-2">
              <h3 className="mb-2 text-sm font-semibold">Members</h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {(m.profiles?.display_name || m.profiles?.username || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {m.profiles?.display_name || m.profiles?.username}
                          {m.user_id === user.id && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                          )}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                      </div>
                    </div>
                    {m.user_id !== user.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id, m.user_id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
