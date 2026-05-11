import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, type Group, type MediaItem, type Profile, type GroupNextToWatch } from "@/lib/supabase";
import { ChevronLeft, Copy, Users, Plus, Lock, Globe, Settings, Film, Tv, Search, X, Trash2, LogOut, Crown, Bookmark, MessageSquare, EyeOff, Eye, Send, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/group/$itemId")({
  component: GroupDetailPage,
});

type MediaWithAvg = MediaItem & { avg: number; review_count: number };
type GroupMemberWithProfile = { id: string; user_id: string; role: string; profiles: Profile };
interface TmdbResult { tmdb_id: number; title: string; year: string | null; media_type: "movie" | "show"; poster_path: string | null; description: string; }

function GroupDetailPage() {
  const { itemId: groupId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaWithAvg[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rankings" | "next" | "chat">("rankings");
  const [nextItems, setNextItems] = useState<GroupNextToWatch[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addNextOpen, setAddNextOpen] = useState(false);
  const [nextSearchQuery, setNextSearchQuery] = useState("");
  const [nextSearchResults, setNextSearchResults] = useState<TmdbResult[]>([]);
  const [nextSearching, setNextSearching] = useState(false);
  const nextSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ownershipOpen, setOwnershipOpen] = useState(false);
  const [newOwnerMemberId, setNewOwnerMemberId] = useState("");

  // Watched tracking for Next to Watch
  type WatchedRecord = { id: string; item_id: string; user_id: string; score: number | null; text: string };
  const [watchedRecords, setWatchedRecords] = useState<WatchedRecord[]>([]);
  const [watchedSheetItemId, setWatchedSheetItemId] = useState<string | null>(null);
  const [watchedScore, setWatchedScore] = useState(80);
  const [watchedText, setWatchedText] = useState("");
  const [watchedSaving, setWatchedSaving] = useState(false);

  // Chat state
  type ChatMessage = { id: string; group_id: string; user_id: string | null; message: string; message_type: "chat" | "review_stamp"; metadata: any; created_at: string };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Hidden items state (for owner UI)
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    const [groupRes, membersRes, itemsRes, nextRes, watchedRes, chatRes] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("id, user_id, role, profiles(*)").eq("group_id", groupId),
      supabase.from("media_items").select("*").eq("group_id", groupId),
      supabase.from("group_next_to_watch").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("group_next_to_watch_watched").select("id, item_id, user_id, score, text"),
      supabase.from("group_chat_messages").select("*").eq("group_id", groupId).order("created_at").limit(100),
    ]);
    if (groupRes.data) setGroup(groupRes.data);
    if (membersRes.data) setMembers(membersRes.data.map((r: any) => ({ ...r, profiles: r.profiles })).filter((r: any) => r.profiles));
    if (nextRes.data) setNextItems(nextRes.data);
    if (watchedRes.data) setWatchedRecords(watchedRes.data as any);
    if (chatRes.data) setChatMessages(chatRes.data as any);
    if (itemsRes.data) {
      const withAvg = await Promise.all(itemsRes.data.map(async (item) => {
        const { data: reviews } = await supabase.from("reviews").select("score").eq("media_item_id", item.id);
        const scores = reviews?.map((r) => r.score) ?? [];
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        return { ...item, avg, review_count: scores.length } as MediaWithAvg;
      }));
      setMediaItems(withAvg.sort((a, b) => b.avg - a.avg));
    }
    setPageLoading(false);
  }, [groupId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (group?.is_public) supabase.from("groups").update({ view_count: (group.view_count ?? 0) + 1 }).eq("id", groupId);
  }, [group?.id]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { const res = await fetch(`${SUPABASE_URL}/functions/v1/tmdb-search?query=${encodeURIComponent(searchQuery)}`, { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }); const data = await res.json(); setSearchResults(data.results ?? []); } catch { setSearchResults([]); }
      setSearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (!nextSearchQuery.trim()) { setNextSearchResults([]); return; }
    if (nextSearchTimer.current) clearTimeout(nextSearchTimer.current);
    nextSearchTimer.current = setTimeout(async () => {
      setNextSearching(true);
      try { const res = await fetch(`${SUPABASE_URL}/functions/v1/tmdb-search?query=${encodeURIComponent(nextSearchQuery)}`, { headers: { Authorization: `Bearer ${SUPABASE_KEY}` } }); const data = await res.json(); setNextSearchResults(data.results ?? []); } catch { setNextSearchResults([]); }
      setNextSearching(false);
    }, 350);
    return () => { if (nextSearchTimer.current) clearTimeout(nextSearchTimer.current); };
  }, [nextSearchQuery]);

  async function handleAddFromTmdb(result: TmdbResult) {
    if (!user) return;
    setAdding(result.tmdb_id);
    const { error } = await supabase.from("media_items").insert({ group_id: groupId, title: result.title, year: result.year ? parseInt(result.year) : null, media_type: result.media_type, description: result.description, poster_url: result.poster_path ? tmdbPosterUrl(result.poster_path) : "", tmdb_id: result.tmdb_id, tmdb_poster_path: result.poster_path, added_by: user.id });
    setAdding(null);
    if (error) { toast.error("Failed to add title."); return; }
    toast.success(`"${result.title}" added!`);
    setAddOpen(false); setSearchQuery(""); setSearchResults([]);
    loadData();
  }

  async function handleAddNextToWatch(result: TmdbResult) {
    if (!user) return;
    if (nextItems.length >= 3) { toast.error("Maximum 3 items in Next to Watch at a time."); return; }
    if (nextItems.some((n) => n.tmdb_id === result.tmdb_id)) { toast.error("Already in Next to Watch."); return; }
    const { error } = await supabase.from("group_next_to_watch").insert({ group_id: groupId, tmdb_id: result.tmdb_id, title: result.title, media_type: result.media_type, year: result.year ? parseInt(result.year) : null, poster_path: result.poster_path, description: result.description, added_by: user.id });
    if (error) { toast.error("Failed to add."); return; }
    toast.success(`"${result.title}" added to Next to Watch!`);
    setAddNextOpen(false); setNextSearchQuery(""); setNextSearchResults([]);
    loadData();
  }

  async function handleRemoveNext(id: string) {
    await supabase.from("group_next_to_watch").delete().eq("id", id);
    loadData();
  }

  function openEdit() {
    if (!group) return;
    setEditName(group.name); setEditDesc(group.description ?? ""); setEditImage(group.image_url ?? ""); setEditOpen(true);
  }

  async function handleSaveEdit() {
    if (!group) return;
    setEditSaving(true);
    const { error } = await supabase.from("groups").update({ name: editName.trim(), description: editDesc.trim(), image_url: editImage.trim() }).eq("id", group.id);
    setEditSaving(false);
    if (error) { toast.error("Failed to save changes."); return; }
    toast.success("Group updated!"); setEditOpen(false); loadData();
  }

  async function removeUserFromGroup(targetUserId: string) {
    // Delete all of that user's reviews for media items in this group
    const { data: groupItems } = await supabase.from("media_items").select("id").eq("group_id", groupId);
    if (groupItems?.length) {
      const itemIds = groupItems.map((i) => i.id);
      await supabase.from("reviews").delete().eq("user_id", targetUserId).in("media_item_id", itemIds);
    }
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    if (memberUserId === user?.id) return;
    await removeUserFromGroup(memberUserId);
    const { error } = await supabase.from("group_members").delete().eq("id", memberId);
    if (error) { toast.error("Failed to remove member."); return; }
    toast.success("Member removed."); loadData();
  }

  async function handleLeaveGroup() {
    if (!user) return;
    await removeUserFromGroup(user.id);
    const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    if (error) { toast.error("Failed to leave group."); return; }
    toast.success("You left the group."); navigate({ to: "/group" });
  }

  async function handleGiveOwnership() {
    if (!user || !group || !newOwnerMemberId) return;
    const newOwnerMember = members.find((m) => m.id === newOwnerMemberId);
    if (!newOwnerMember) return;
    const { error } = await supabase.from("groups").update({ owner_id: newOwnerMember.user_id }).eq("id", groupId);
    if (error) { toast.error("Failed to transfer ownership."); return; }
    await supabase.from("group_members").update({ role: "owner" }).eq("id", newOwnerMemberId);
    await supabase.from("group_members").update({ role: "member" }).eq("group_id", groupId).eq("user_id", user.id);
    toast.success(`Ownership transferred.`); setOwnershipOpen(false); loadData();
  }

  async function handleDeleteGroup() {
    if (!group || group.owner_id !== user?.id) return;
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) { toast.error("Failed to delete group."); return; }
    toast.success("Group deleted."); navigate({ to: "/group" });
  }

  async function handleSendChat() {
    if (!user || !chatInput.trim()) return;
    setChatSending(true);
    const msg = chatInput.trim();
    setChatInput("");
    const { data, error } = await supabase.from("group_chat_messages").insert({
      group_id: groupId, user_id: user.id, message: msg, message_type: "chat",
    }).select().maybeSingle();
    if (!error && data) setChatMessages((prev) => [...prev, data as any]);
    setChatSending(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function handleToggleHide(itemId: string, currentHidden: boolean) {
    await supabase.from("media_items").update({ is_hidden: !currentHidden }).eq("id", itemId);
    loadData();
  }

  function openWatchedSheet(itemId: string) {
    if (!user) return;
    const existing = watchedRecords.find((w) => w.item_id === itemId && w.user_id === user.id);
    setWatchedScore(existing?.score ?? 80);
    setWatchedText(existing?.text ?? "");
    setWatchedSheetItemId(itemId);
  }

  async function handleSaveWatched() {
    if (!user || !watchedSheetItemId) return;
    setWatchedSaving(true);
    await supabase.from("group_next_to_watch_watched").upsert(
      { item_id: watchedSheetItemId, user_id: user.id, score: watchedScore, text: watchedText },
      { onConflict: "item_id,user_id" }
    );
    setWatchedSaving(false);
    setWatchedSheetItemId(null);
    loadData();
  }

  if (loading || !user) return null;
  if (!pageLoading && !group) return (
    <AppShell>
      <div className="px-5 pt-10 text-center"><h1 className="text-xl font-bold">Group not found</h1><Link to="/group" className="mt-3 inline-block text-primary">Back to groups</Link></div>
    </AppShell>
  );

  const isMember = members.some((m) => m.profiles?.id === user.id);
  const isOwner = group?.owner_id === user.id;
  const otherMembers = members.filter((m) => m.user_id !== user.id);

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <Link to="/group" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> All groups
        </Link>
        {pageLoading ? (
          <div className="mt-4 space-y-3"><div className="h-8 w-48 animate-pulse rounded-lg bg-muted" /></div>
        ) : (
          <>
            {group?.image_url && <div className="mt-4 overflow-hidden rounded-2xl"><img src={group.image_url} alt={group?.name} className="h-36 w-full object-cover" /></div>}
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{group?.name}</h1>
                  {group?.is_public ? <Globe className="h-4 w-4 text-muted-foreground" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                {group?.description && <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>}
              </div>
              {isOwner && (
                <button type="button" onClick={openEdit} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted">
                  <Settings className="h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /><span>{members.length} {members.length === 1 ? "member" : "members"}</span>
              </div>
              {group && (
                <button type="button" onClick={() => { navigator.clipboard.writeText(group.invite_code); toast.success("Invite code copied!"); }}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-mono font-semibold hover:bg-muted">
                  {group.invite_code} <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Tabs */}
      <div className="mt-5 px-5">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {([["rankings", "Rankings"], ["next", "Watch"], ["chat", "Chat"]] as const).map(([t, label]) => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings tab */}
      {activeTab === "rankings" && (
        <section className="mt-4 px-5 pb-4">
          {(() => {
            const visibleItems = isOwner ? mediaItems : mediaItems.filter((i) => !(i as any).is_hidden);
            const hiddenItems = mediaItems.filter((i) => (i as any).is_hidden);
            return (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{visibleItems.length} titles</h2>
                  {isMember && <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-8 gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> Add title</Button>}
                </div>
                {pageLoading ? (
                  <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
                ) : visibleItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
                    <p className="text-sm font-medium">No titles yet</p>
                    <p className="text-xs text-muted-foreground">Add the first movie or show to rank.</p>
                    {isMember && <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add title</Button>}
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {visibleItems.map((item, idx) => {
                      const poster = item.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w154") : item.poster_url;
                      const isHidden = (item as any).is_hidden;
                      return (
                        <li key={item.id} className="relative">
                          <Link to="/media/$groupId/$mediaId" params={{ groupId, mediaId: item.id }}
                            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted">
                            <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{idx + 1}</span>
                            {poster ? <img src={poster} alt={item.title} className="h-16 w-11 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : (
                              <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
                                {item.media_type === "movie" ? <Film className="h-5 w-5 text-muted-foreground" /> : <Tv className="h-5 w-5 text-muted-foreground" />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{item.title}</p>
                              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">{item.media_type} · {item.year ?? "—"} · {item.review_count} {item.review_count === 1 ? "rating" : "ratings"}</p>
                            </div>
                            {item.review_count > 0 ? <ScoreBadge score={item.avg} size="md" /> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">—</span>}
                          </Link>
                          {isOwner && (
                            <button type="button" onClick={() => handleToggleHide(item.id, !!isHidden)}
                              className="absolute right-11 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title={isHidden ? "Show" : "Hide"}>
                              {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {isOwner && hiddenItems.length > 0 && (
                  <div className="mt-4">
                    <button type="button" onClick={() => setShowHiddenPanel(!showHiddenPanel)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <EyeOff className="h-3.5 w-3.5" />
                      {showHiddenPanel ? "Hide" : "Show"} hidden titles ({hiddenItems.length})
                    </button>
                    {showHiddenPanel && (
                      <div className="mt-2 space-y-2">
                        {hiddenItems.map((item) => {
                          const poster = item.tmdb_poster_path ? tmdbPosterUrl(item.tmdb_poster_path, "w154") : item.poster_url;
                          return (
                            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-3 opacity-60">
                              {poster ? <img src={poster} alt={item.title} className="h-12 w-8 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : (
                                <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                                  {item.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{item.title}</p>
                                <p className="text-[11px] text-muted-foreground capitalize">{item.media_type} · {item.year ?? "—"}</p>
                              </div>
                              <button type="button" onClick={() => handleToggleHide(item.id, true)}
                                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                                <Eye className="h-3 w-3" /> Show
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* Next to Watch tab */}
      {activeTab === "next" && (
        <section className="mt-4 px-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Next to Watch · {nextItems.length}/3</h2>
            {isMember && nextItems.length < 3 && <Button size="sm" variant="outline" onClick={() => setAddNextOpen(true)} className="h-8 gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>}
          </div>
          {nextItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
              <Bookmark className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Nothing queued yet</p>
              <p className="text-xs text-muted-foreground">Add up to 3 titles your group plans to watch next.</p>
              {isMember && <Button size="sm" onClick={() => setAddNextOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add title</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              {nextItems.map((item, idx) => {
                const poster = item.poster_path ? tmdbPosterUrl(item.poster_path, "w154") : null;
                const addedBy = members.find((m) => m.user_id === item.added_by);
                const itemWatched = watchedRecords.filter((w) => w.item_id === item.id);
                const myWatched = itemWatched.find((w) => w.user_id === user.id);
                const watchedCount = itemWatched.length;
                const canRemove = watchedCount >= 3 && (item.added_by === user.id || isOwner);
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-center text-sm font-bold text-primary">{idx + 1}</span>
                      {poster ? <img src={poster} alt={item.title} className="h-16 w-11 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : (
                        <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
                          {item.media_type === "movie" ? <Film className="h-5 w-5 text-muted-foreground" /> : <Tv className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.media_type} · {item.year ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Added by {addedBy?.profiles?.display_name || addedBy?.profiles?.username || "someone"}
                          {watchedCount > 0 && ` · ${watchedCount} watched`}
                        </p>
                      </div>
                      {canRemove && (
                        <button type="button" onClick={() => handleRemoveNext(item.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isMember && (
                      <button type="button" onClick={() => openWatchedSheet(item.id)}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-colors ${myWatched ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:bg-muted"}`}>
                        {myWatched ? "Watched · Edit review" : "Mark as Watched"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <section className="mt-4 px-5 pb-4 flex flex-col" style={{ minHeight: "calc(100vh - 300px)" }}>
          <div className="flex-1 space-y-3 overflow-y-auto pb-4" style={{ maxHeight: "calc(100vh - 360px)", overflowY: "auto" }}>
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-muted-foreground">Start the conversation!</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const sender = members.find((m) => m.user_id === msg.user_id);
                const senderName = sender?.profiles?.display_name || sender?.profiles?.username || "Someone";
                const isMe = msg.user_id === user.id;
                if (msg.message_type === "review_stamp") {
                  const meta = msg.metadata ?? {};
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground max-w-xs text-center">
                        <Star className="h-3 w-3 text-amber-500 shrink-0" />
                        <span>
                          <Link to="/user/$userId" params={{ userId: msg.user_id! }} className="font-semibold text-foreground hover:text-primary">{senderName}</Link>
                          {" "}rated{" "}
                          <span className="font-semibold text-foreground">{meta.title}</span>
                          {" "}<span className="font-bold text-primary">{meta.score}/100</span>
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    {!isMe && (
                      <Link to="/user/$userId" params={{ userId: msg.user_id! }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground hover:opacity-80">
                        {senderName.slice(0, 2).toUpperCase()}
                      </Link>
                    )}
                    <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                      {!isMe && <p className="text-[10px] text-muted-foreground ml-1">{senderName}</p>}
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          {isMember && (
            <div className="mt-3 flex gap-2 sticky bottom-0 bg-background pt-2 pb-2 border-t border-border">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Message…"
                className="flex-1"
                disabled={chatSending}
              />
              <Button size="sm" onClick={handleSendChat} disabled={!chatInput.trim() || chatSending} className="shrink-0 px-3">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Group actions */}
      {!pageLoading && isMember && activeTab !== "chat" && (
        <section className="mt-4 px-5 pb-8 space-y-2">
          {!isOwner && (
            <button type="button" onClick={() => setLeaveConfirmOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium text-destructive hover:bg-muted">
              <LogOut className="h-4 w-4" /> Leave group
            </button>
          )}
        </section>
      )}

      {/* Add title sheet */}
      <Sheet open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setSearchQuery(""); setSearchResults([]); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Add a title</SheetTitle></SheetHeader>
          <div className="mt-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search movies & TV shows…" className="pl-9 pr-9" autoFocus />
              {searchQuery && <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-3 space-y-2">
              {searching && [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
              {!searching && searchQuery && searchResults.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>}
              {!searching && searchResults.map((r) => (
                <button key={r.tmdb_id} type="button" onClick={() => handleAddFromTmdb(r)} disabled={adding === r.tmdb_id}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:bg-muted disabled:opacity-60">
                  {r.poster_path ? <img src={tmdbPosterUrl(r.poster_path, "w92")} alt={r.title} className="h-14 w-10 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : (
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted">{r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}</div>
                  )}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">{r.media_type === "movie" ? "Movie" : "TV Show"}{r.year ? ` · ${r.year}` : ""}</p></div>
                  <span className="text-xs font-medium text-primary shrink-0">{adding === r.tmdb_id ? "Adding…" : "Add"}</span>
                </button>
              ))}
              {!searchQuery && <p className="py-6 text-center text-sm text-muted-foreground">Start typing to search TMDB.</p>}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add next to watch sheet */}
      <Sheet open={addNextOpen} onOpenChange={(o) => { setAddNextOpen(o); if (!o) { setNextSearchQuery(""); setNextSearchResults([]); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Add to Next to Watch</SheetTitle></SheetHeader>
          <div className="mt-4 pb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={nextSearchQuery} onChange={(e) => setNextSearchQuery(e.target.value)} placeholder="Search movies & TV shows…" className="pl-9 pr-9" autoFocus />
              {nextSearchQuery && <button type="button" onClick={() => { setNextSearchQuery(""); setNextSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-3 space-y-2">
              {nextSearching && [1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
              {!nextSearching && nextSearchQuery && nextSearchResults.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>}
              {!nextSearching && nextSearchResults.map((r) => (
                <button key={r.tmdb_id} type="button" onClick={() => handleAddNextToWatch(r)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left hover:bg-muted">
                  {r.poster_path ? <img src={tmdbPosterUrl(r.poster_path, "w92")} alt={r.title} className="h-14 w-10 shrink-0 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : (
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted">{r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}</div>
                  )}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">{r.media_type === "movie" ? "Movie" : "TV Show"}{r.year ? ` · ${r.year}` : ""}</p></div>
                  <span className="text-xs font-medium text-primary shrink-0">Add</span>
                </button>
              ))}
              {!nextSearchQuery && <p className="py-6 text-center text-sm text-muted-foreground">Start typing to search.</p>}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit group sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit group</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div><label className="text-sm font-medium">Group name</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Group name" className="mt-1.5" /></div>
            <div><label className="text-sm font-medium">Description</label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="What does this group watch?" className="mt-1.5 resize-none" rows={3} /></div>
            <div>
              <label className="text-sm font-medium">Cover image URL <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input value={editImage} onChange={(e) => setEditImage(e.target.value)} placeholder="https://…" className="mt-1.5" />
              {editImage && <img src={editImage} alt="Preview" className="mt-2 h-24 w-full rounded-xl object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
            </div>
            <Button className="w-full" onClick={handleSaveEdit} disabled={!editName.trim() || editSaving}>{editSaving ? "Saving…" : "Save changes"}</Button>
            {isOwner && (
              <button type="button" onClick={() => { setEditOpen(false); setOwnershipOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm font-medium hover:bg-muted">
                <Crown className="h-4 w-4 text-amber-500" /> Give ownership
              </button>
            )}
            {isOwner && (
              <button type="button" onClick={() => { setEditOpen(false); setDeleteConfirmOpen(true); }}
                className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-background p-3 text-sm font-medium text-destructive hover:bg-destructive/5">
                <Trash2 className="h-4 w-4" /> Delete group
              </button>
            )}
            <div className="pt-2">
              <h3 className="mb-2 text-sm font-semibold">Members</h3>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
                    <Link to="/user/$userId" params={{ userId: m.user_id }} onClick={() => setEditOpen(false)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0 flex-1">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {(m.profiles?.display_name || m.profiles?.username || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.profiles?.display_name || m.profiles?.username}{m.user_id === user.id && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}</p>
                        <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
                      </div>
                    </Link>
                    {m.user_id !== user.id && (
                      <button type="button" onClick={() => handleRemoveMember(m.id, m.user_id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors ml-2"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Give ownership sheet */}
      <Sheet open={ownershipOpen} onOpenChange={setOwnershipOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader><SheetTitle>Give ownership</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3 pb-6">
            <p className="text-sm text-muted-foreground">Select a member to become the new owner. You will become a regular member.</p>
            {otherMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No other members to transfer to.</p>
            ) : otherMembers.map((m) => (
              <button key={m.id} type="button" onClick={() => setNewOwnerMemberId(m.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${newOwnerMemberId === m.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"}`}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {(m.profiles?.display_name || m.profiles?.username || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{m.profiles?.display_name || m.profiles?.username}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
                {newOwnerMemberId === m.id && <Crown className="h-4 w-4 text-amber-500" />}
              </button>
            ))}
            <Button className="w-full" onClick={handleGiveOwnership} disabled={!newOwnerMemberId}>Confirm transfer</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Watched sheet */}
      <Sheet open={!!watchedSheetItemId} onOpenChange={(o) => { if (!o) setWatchedSheetItemId(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl border-border bg-card">
          <SheetHeader><SheetTitle className="text-left">Mark as Watched</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your score</p>
              <ScoreBadge score={watchedScore} size="lg" />
            </div>
            <Slider value={[watchedScore]} onValueChange={(v) => setWatchedScore(v[0])} min={0} max={100} step={1} />
            <div className="flex justify-between text-xs text-muted-foreground"><span>0</span><span>50</span><span>100</span></div>
            <Textarea value={watchedText} onChange={(e) => setWatchedText(e.target.value)} placeholder="What did you think?" className="resize-none bg-background" rows={3} />
            <Button className="w-full" onClick={handleSaveWatched} disabled={watchedSaving}>
              {watchedSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Leave group?</AlertDialogTitle><AlertDialogDescription>Your reviews in this group will be removed. You will need an invite code to rejoin.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Leave</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete group?</AlertDialogTitle><AlertDialogDescription>This permanently deletes the group and all its rankings. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
