import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, type Profile, type PersonalReview, type TasteProfile } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreBadge } from "@/components/ScoreBadge";
import {
  User, Users, LogOut, UserPlus, UserCheck, Search, X,
  Film, Tv, Sparkles, ChevronRight, Lock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/user")({
  component: UserPage,
});

type FollowWithProfile = { id: string; follower_id: string; following_id: string; profiles: Profile };

function UserPage() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"account" | "friends">("account");
  const [followers, setFollowers] = useState<FollowWithProfile[]>([]);
  const [following, setFollowing] = useState<FollowWithProfile[]>([]);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [personalReviews, setPersonalReviews] = useState<PersonalReview[]>([]);
  const [tasteLoading, setTasteLoading] = useState(false);

  // Friend search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadSocial = useCallback(async () => {
    if (!user) return;
    const [followersRes, followingRes, tasteRes, reviewsRes] = await Promise.all([
      supabase.from("follows").select("id, follower_id, following_id").eq("following_id", user.id),
      supabase.from("follows").select("id, follower_id, following_id").eq("follower_id", user.id),
      supabase.from("taste_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("personal_reviews").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    ]);

    const followerRows = followersRes.data ?? [];
    const followingRows = followingRes.data ?? [];

    // Fetch profiles for all unique user IDs involved
    const allUserIds = Array.from(new Set([
      ...followerRows.map((f) => f.follower_id),
      ...followingRows.map((f) => f.following_id),
    ]));

    let profileMap: Record<string, Profile> = {};
    if (allUserIds.length > 0) {
      const { data: profileRows } = await supabase.from("profiles").select("*").in("id", allUserIds);
      for (const p of profileRows ?? []) profileMap[p.id] = p;
    }

    setFollowers(followerRows.map((f) => ({ ...f, profiles: profileMap[f.follower_id] })) as any);
    setFollowing(followingRows.map((f) => ({ ...f, profiles: profileMap[f.following_id] })) as any);
    if (tasteRes.data) setTasteProfile(tasteRes.data);
    if (reviewsRes.data) setPersonalReviews(reviewsRes.data);
  }, [user]);

  useEffect(() => { loadSocial(); }, [loadSocial]);

  // Debounced username search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${searchQuery.trim()}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, user]);

  async function handleFollow(targetId: string) {
    if (!user) return;
    const alreadyFollowing = following.some((f) => f.following_id === targetId);
    if (alreadyFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
    }
    loadSocial();
  }

  async function generateTasteProfile() {
    if (!user || personalReviews.length < 3) {
      toast.error("Rate at least 3 titles first to generate your taste profile.");
      return;
    }
    setTasteLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "taste_profile",
          user_id: user.id,
          reviews: personalReviews.map((r) => ({
            title: r.title, media_type: r.media_type, year: r.year, score: r.score, text: r.text,
          })),
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setTasteProfile({ id: "", user_id: user.id, summary: data.summary, genres: data.genres ?? [], updated_at: new Date().toISOString() });
        toast.success("Taste profile generated!");
      }
    } catch {
      toast.error("Could not generate taste profile.");
    }
    setTasteLoading(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  if (loading || !user) return null;

  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const friends = following.filter((f) => followers.some((r) => r.follower_id === f.following_id));

  return (
    <AppShell>
      <div className="px-5 pt-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground"
            style={{ background: "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))" }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{profile?.display_name || profile?.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{friends.length} friends</span>
              <span>{following.length} following</span>
              <span>{followers.length} followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1 rounded-xl bg-muted p-1">
          {(["account", "friends"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Account tab */}
        {tab === "account" && (
          <div className="mt-5 space-y-4 pb-8">
            {/* Taste profile */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Your Taste Profile</h2>
              </div>
              {tasteProfile?.summary ? (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">{tasteProfile.summary}</p>
                  {tasteProfile.genres?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tasteProfile.genres.map((g) => (
                        <span key={g} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{g}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    {personalReviews.length < 3
                      ? `Rate ${3 - personalReviews.length} more title${3 - personalReviews.length === 1 ? "" : "s"} to generate your profile.`
                      : "Generate your AI taste profile based on your ratings."}
                  </p>
                  <Button size="sm" variant="outline" onClick={generateTasteProfile} disabled={tasteLoading || personalReviews.length < 3}>
                    {tasteLoading ? "Generating…" : "Generate profile"}
                  </Button>
                </div>
              )}
            </div>

            {/* My reviews */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Your Reviews · {personalReviews.length}
              </h2>
              {personalReviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                  <p className="text-sm text-muted-foreground">No reviews yet. Use the Review tab to rate titles.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {personalReviews.map((r) => {
                    const poster = r.poster_path ? tmdbPosterUrl(r.poster_path, "w92") : null;
                    return (
                      <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                        {poster ? (
                          <img src={poster} alt={r.title} className="h-14 w-10 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            {r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.title}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {r.media_type} · {r.year ?? "—"}
                          </p>
                          {r.text && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.text}</p>}
                        </div>
                        <ScoreBadge score={r.score} size="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account actions */}
            <div className="space-y-2 pt-2">
              <Link to="/profile" className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-muted">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Account settings</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-destructive hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sign out</span>
              </button>
            </div>
          </div>
        )}

        {/* Friends tab */}
        {tab === "friends" && (
          <div className="mt-5 space-y-4 pb-8">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username…"
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searching && <div className="h-12 animate-pulse rounded-2xl bg-muted" />}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Results</p>
                {searchResults.map((p) => {
                  const isFollowing = following.some((f) => f.following_id === p.id);
                  const isFriend = friends.some((f) => f.following_id === p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isFriend && <span className="text-xs font-medium text-primary">Friends</span>}
                        <button
                          type="button"
                          onClick={() => handleFollow(p.id)}
                          className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${isFollowing ? "border-border bg-muted text-muted-foreground" : "border-primary bg-primary/10 text-primary hover:bg-primary/20"}`}
                        >
                          {isFollowing ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                        <Link to="/user/$userId" params={{ userId: p.id }} className="flex items-center justify-center rounded-xl border border-border p-1.5 hover:bg-muted">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!searchQuery && (
              <>
                {/* Friends (mutual follows) */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Friends · {friends.length}</p>
                  {friends.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border py-6 text-center">
                      <p className="text-sm text-muted-foreground">No friends yet. Search for users and follow them.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {friends.map((f) => {
                        const p = f.profiles;
                        return (
                          <Link key={f.id} to="/user/$userId" params={{ userId: f.following_id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {(p?.display_name || p?.username || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{p?.display_name || p?.username}</p>
                              <p className="text-xs text-muted-foreground">@{p?.username}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Following */}
                {following.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Following · {following.length}</p>
                    <div className="space-y-2">
                      {following.map((f) => {
                        const p = f.profiles;
                        const isFriend = friends.some((fr) => fr.following_id === f.following_id);
                        return (
                          <div key={f.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                              {(p?.display_name || p?.username || "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{p?.display_name || p?.username}</p>
                              <p className="text-xs text-muted-foreground">@{p?.username}{isFriend ? " · Friends" : " · Pending"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => handleFollow(f.following_id)} className="rounded-xl border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                                Unfollow
                              </button>
                              <Link to="/user/$userId" params={{ userId: f.following_id }} className="flex items-center justify-center rounded-xl border border-border p-1.5 hover:bg-muted">
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
