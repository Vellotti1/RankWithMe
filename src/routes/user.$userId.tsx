import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { supabase, tmdbPosterUrl, type Profile, type PersonalReview, type TasteProfile } from "@/lib/supabase";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Film, Tv, Sparkles, UserPlus, UserCheck } from "lucide-react";

export const Route = createFileRoute("/user/$userId")({
  component: FriendProfilePage,
});

function FriendProfilePage() {
  const { userId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [reviews, setReviews] = useState<PersonalReview[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    const [profileRes, tasteRes, reviewsRes, followingRes, followersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("taste_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("personal_reviews").select("*").eq("user_id", userId).order("score", { ascending: false }),
      supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle(),
      supabase.from("follows").select("id").eq("follower_id", userId).eq("following_id", user.id).maybeSingle(),
    ]);
    if (profileRes.data) setProfile(profileRes.data);
    if (tasteRes.data) setTasteProfile(tasteRes.data);
    if (reviewsRes.data) setReviews(reviewsRes.data);
    const following = !!followingRes.data;
    const follower = !!followersRes.data;
    setIsFollowing(following);
    setIsFriend(following && follower);
    setPageLoading(false);
  }, [userId, user]);

  useEffect(() => { loadData(); }, [loadData]);

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

  return (
    <AppShell>
      <div className="px-5 pt-5">
        <button type="button" onClick={() => navigate({ to: "/user" })} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground"
              style={{ background: "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{profile.display_name || profile.username}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
              {isFriend && <p className="mt-0.5 text-xs font-medium text-primary">Friends</p>}
            </div>
            {userId !== user.id && (
              <Button size="sm" variant={isFollowing ? "outline" : "default"} onClick={handleFollow} className="gap-1.5 shrink-0">
                {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>

          {/* Taste profile */}
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

          {/* Reviews */}
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              All Reviews · {reviews.length}
            </p>
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">No public reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => {
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
