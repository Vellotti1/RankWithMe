import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, SUPABASE_URL, SUPABASE_KEY, tmdbPosterUrl, type Profile, type PersonalReview, type TasteProfile } from "@/lib/supabase";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Film, Tv, Sparkles, UserPlus, UserCheck, Users } from "lucide-react";

export const Route = createFileRoute("/user/$userId")({
  component: FriendProfilePage,
});

type FollowRow = { id: string; follower_id: string; following_id: string };

function FriendProfilePage() {
  const { userId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [reviews, setReviews] = useState<PersonalReview[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [followerRows, setFollowerRows] = useState<FollowRow[]>([]);
  const [followingRows, setFollowingRows] = useState<FollowRow[]>([]);
  const [followerProfiles, setFollowerProfiles] = useState<Profile[]>([]);
  const [followingProfiles, setFollowingProfiles] = useState<Profile[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [socialView, setSocialView] = useState<"main" | "followers" | "following">("main");
  const [aiOverview, setAiOverview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    const [profileRes, tasteRes, reviewsRes, iFollowRes, theyFollowRes, followersRes, followingRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("personal_reviews").select("*").eq("user_id", userId).order("score", { ascending: false }),
      supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle(),
      supabase.from("follows").select("id").eq("follower_id", userId).eq("following_id", user.id).maybeSingle(),
      supabase.from("follows").select("id, follower_id, following_id").eq("following_id", userId),
      supabase.from("follows").select("id, follower_id, following_id").eq("follower_id", userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (tasteRes.data) setTasteProfile(tasteRes.data);
    const revData = reviewsRes.data ?? [];
    setReviews(revData);
    setIsFollowing(!!iFollowRes.data);
    setIsFriend(!!iFollowRes.data && !!theyFollowRes.data);

    const fRows = (followersRes.data ?? []) as FollowRow[];
    const fgRows = (followingRes.data ?? []) as FollowRow[];
    setFollowerRows(fRows);
    setFollowingRows(fgRows);

    const allIds = Array.from(new Set([...fRows.map((r) => r.follower_id), ...fgRows.map((r) => r.following_id)]));
    if (allIds.length > 0) {
      const { data: profileRows } = await supabase.from("profiles").select("*").in("id", allIds);
      const map: Record<string, Profile> = {};
      for (const p of profileRows ?? []) map[p.id] = p;
      setFollowerProfiles(fRows.map((r) => map[r.follower_id]).filter(Boolean) as Profile[]);
      setFollowingProfiles(fgRows.map((r) => map[r.following_id]).filter(Boolean) as Profile[]);
    }

    // Auto-load AI overview
    if (!aiLoaded && revData.length > 0) {
      setAiLoaded(true);
      loadAiOverview(revData);
    }

    setPageLoading(false);
  }, [userId, user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function loadAiOverview(revs: PersonalReview[]) {
    setAiLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-overview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          action: "profile_overview",
          reviews: revs.slice(0, 20).map((r) => ({ title: r.title, media_type: r.media_type, year: r.year, score: r.score, text: r.text })),
        }),
      });
      const data = await res.json();
      setAiOverview(data.overview ?? null);
    } catch { /* silent */ }
    setAiLoading(false);
  }

  async function handleFollow() {
    if (!user) return;
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
    }
    loadData();
  }

  if (loading || !user) return null;

  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  if (socialView !== "main") {
    const list = socialView === "followers" ? followerProfiles : followingProfiles;
    const title = socialView === "followers" ? "Followers" : "Following";
    return (
      <AppShell>
        <div className="px-5 pt-5">
          <button type="button" onClick={() => setSocialView("main")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="mt-4 text-xl font-bold">{title}</h1>
        </div>
        <div className="mt-4 px-5 pb-8 space-y-2">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>
          ) : list.map((p) => (
            <Link key={p.id} to="/user/$userId" params={{ userId: p.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {(p.display_name || p.username || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground">@{p.username}</p>
              </div>
            </Link>
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 pt-5">
        <button type="button" onClick={() => navigate({ to: ".." as any })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>

      {pageLoading ? (
        <div className="px-5 pt-6 space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !profile ? (
        <div className="px-5 pt-10 text-center"><p className="font-semibold">User not found.</p></div>
      ) : (
        <div className="px-5 pt-4 space-y-5 pb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground"
              style={{ background: "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{profile.display_name || profile.username}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {isFriend && <p className="mt-0.5 text-xs font-medium text-primary">Friends</p>}
              <div className="mt-1 flex items-center gap-3">
                <button type="button" onClick={() => setSocialView("followers")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span className="font-semibold text-foreground">{followerRows.length}</span> followers
                </button>
                <button type="button" onClick={() => setSocialView("following")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <span className="font-semibold text-foreground">{followingRows.length}</span> following
                </button>
              </div>
            </div>
            {userId !== user.id && (
              <Button size="sm" variant={isFollowing ? "outline" : "default"} onClick={handleFollow} className="gap-1.5 shrink-0">
                {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>

          {(aiLoading || aiOverview) && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">AI Overview</h2>
              </div>
              {aiLoading ? (
                <div className="space-y-2">
                  {[1, 0.8, 0.6].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w * 100}%` }} />)}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">{aiOverview}</p>
              )}
            </div>
          )}

          {tasteProfile?.summary && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Taste Profile</h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{tasteProfile.summary}</p>
              {tasteProfile.genres?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tasteProfile.genres.map((g) => (
                    <span key={g} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{g}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {reviews.length > 0 && (() => {
            const topMovies = reviews.filter((r) => r.media_type === "movie").slice(0, 3);
            const topShows = reviews.filter((r) => r.media_type === "show").slice(0, 3);
            return (topMovies.length > 0 || topShows.length > 0) ? (
              <div className="grid grid-cols-2 gap-3">
                {topMovies.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Film className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top Movies</p>
                    </div>
                    <div className="space-y-2">
                      {topMovies.map((r, i) => {
                        const poster = r.poster_path ? tmdbPosterUrl(r.poster_path, "w92") : null;
                        return (
                          <div key={r.id} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-3 shrink-0">{i + 1}</span>
                            {poster ? <img src={poster} alt={r.title} className="h-10 w-7 shrink-0 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-muted"><Film className="h-3 w-3 text-muted-foreground" /></div>}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold leading-tight">{r.title}</p>
                              <p className="text-[10px] font-bold text-primary">{r.score}/100</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {topShows.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tv className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top Shows</p>
                    </div>
                    <div className="space-y-2">
                      {topShows.map((r, i) => {
                        const poster = r.poster_path ? tmdbPosterUrl(r.poster_path, "w92") : null;
                        return (
                          <div key={r.id} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground w-3 shrink-0">{i + 1}</span>
                            {poster ? <img src={poster} alt={r.title} className="h-10 w-7 shrink-0 rounded object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : <div className="flex h-10 w-7 shrink-0 items-center justify-center rounded bg-muted"><Tv className="h-3 w-3 text-muted-foreground" /></div>}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold leading-tight">{r.title}</p>
                              <p className="text-[10px] font-bold text-primary">{r.score}/100</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null;
          })()}

          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">All Reviews · {reviews.length}</p>
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => {
                  const poster = r.poster_path ? tmdbPosterUrl(r.poster_path, "w92") : null;
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                      {poster ? (
                        <img src={poster} alt={r.title} className="h-14 w-10 shrink-0 rounded-lg object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {r.media_type === "movie" ? <Film className="h-4 w-4 text-muted-foreground" /> : <Tv className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.title}</p>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.media_type} · {r.year ?? "—"}</p>
                        {r.text && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.text}</p>}
                      </div>
                      <ScoreBadge score={r.score} size="sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
