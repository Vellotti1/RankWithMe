import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase, recalculateGroupStars } from "@/lib/supabase";

export const Route = createFileRoute("/join")({
  component: JoinPage,
});

function JoinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!user || !code.trim()) return;
    setLoading(true);

    const { data: group, error } = await supabase
      .from("groups")
      .select("*")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();

    if (error || !group) {
      toast.error("Invalid invite code. Please check and try again.");
      setLoading(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      toast.info("You're already in this group!");
      navigate({ to: "/group/$itemId", params: { itemId: group.id } });
      return;
    }

    const { error: joinError } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "member",
    });

    if (joinError) {
      toast.error("Failed to join group. Please try again.");
      setLoading(false);
      return;
    }

    // Sync user's personal reviews into the group
    const { data: personalReviews } = await supabase
      .from("personal_reviews")
      .select("*")
      .eq("user_id", user.id);

    if (personalReviews?.length) {
      for (const pr of personalReviews) {
        // Check if media_item already exists in this group by tmdb_id
        const { data: existingItem } = await supabase
          .from("media_items")
          .select("id")
          .eq("group_id", group.id)
          .eq("tmdb_id", pr.tmdb_id)
          .maybeSingle();

        let mediaItemId: string | undefined = existingItem?.id;

        if (!mediaItemId) {
          const { data: newItem } = await supabase
            .from("media_items")
            .insert({
              group_id: group.id,
              title: pr.title,
              year: pr.year,
              media_type: pr.media_type,
              description: pr.description ?? "",
              poster_url: pr.poster_path ? `https://image.tmdb.org/t/p/w342${pr.poster_path}` : "",
              tmdb_id: pr.tmdb_id,
              tmdb_poster_path: pr.poster_path,
              added_by: user.id,
            })
            .select("id")
            .maybeSingle();
          mediaItemId = newItem?.id;
        }

        if (mediaItemId) {
          const reviewRow: Record<string, any> = {
            media_item_id: mediaItemId,
            user_id: user.id,
            score: pr.score,
            text: (pr as any).review_type === "voice" ? "" : (pr.text ?? ""),
            review_type: (pr as any).review_type ?? "text",
            voice_audio_url: (pr as any).review_type === "voice" ? (pr as any).voice_audio_url : null,
            voice_duration_seconds: (pr as any).review_type === "voice" ? (pr as any).voice_duration_seconds : null,
            voice_summary: (pr as any).review_type === "voice" ? (pr as any).voice_summary : null,
            updated_at: new Date().toISOString(),
          };
          await supabase.from("reviews").upsert(reviewRow, { onConflict: "media_item_id,user_id" });
        }
      }
    }

    setLoading(false);
    toast.success(`Joined "${group.name}"!`);
    recalculateGroupStars(group.id).catch(() => {});
    navigate({ to: "/group/$itemId", params: { itemId: group.id } });
  }

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Join a group</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the invite code shared by your group.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Invite code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXX-XXXX"
              className="mt-1.5 font-mono uppercase tracking-widest"
            />
          </div>

          <Button
            className="h-12 w-full text-base font-semibold"
            disabled={!code.trim() || loading}
            onClick={handleJoin}
          >
            {loading ? "Joining…" : "Join group"}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
