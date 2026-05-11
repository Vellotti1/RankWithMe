import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { User, Mail, AtSign, Lock } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? "");
  }, [profile]);

  async function handleSaveProfile(e: React.FormEvent) {
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setChangingPassword(true);

    // Re-authenticate then update
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });

    if (signInError) {
      toast.error("Current password is incorrect.");
      setChangingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error("Failed to update password.");
    } else {
      toast.success("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  if (loading || !user) return null;

  const initials = (profile?.display_name || profile?.username || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell>
      <section className="px-5 pt-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground"
            style={{
              background:
                "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))",
            }}
          >
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile?.display_name || profile?.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
          </div>
        </div>

        {/* Account info (read-only) */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Account
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="text-sm font-medium">@{profile?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Edit display name */}
        <form onSubmit={handleSaveProfile} className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Display name
          </h2>
          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="flex-1"
            />
            <Button type="submit" disabled={saving || !displayName.trim()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>

        {/* Change password */}
        <form onSubmit={handleChangePassword} className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Change password
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="currentPw" className="text-xs text-muted-foreground">Current password</Label>
              <Input
                id="currentPw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newPw" className="text-xs text-muted-foreground">New password</Label>
              <Input
                id="newPw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="confirmPw" className="text-xs text-muted-foreground">Confirm new password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
