import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  if (!loading && !user) {
    navigate({ to: "/login" });
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save changes.");
    } else {
      toast.success("Profile updated!");
    }
  }

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">@{profile?.username}</p>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="mt-1.5 opacity-60"
            />
          </div>

          <Button type="submit" className="mt-2 w-full" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </section>
    </AppShell>
  );
}
