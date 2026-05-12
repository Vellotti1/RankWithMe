import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Globe, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, recalculateGroupStars } from "@/lib/supabase";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});

function CreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setLoading(true);

    // Generate a unique invite code
    const { data: codeData } = await supabase.rpc("generate_invite_code");
    const inviteCode = codeData as string;

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        description: description.trim(),
        invite_code: inviteCode,
        owner_id: user.id,
        is_public: isPublic,
      })
      .select()
      .maybeSingle();

    if (error || !group) {
      toast.error(error?.message ?? "Failed to create group. Please try again.");
      setLoading(false);
      return;
    }

    // Add creator as owner member
    await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "owner",
    });

    toast.success("Group created!");
    recalculateGroupStars(group.id).catch(() => {});
    navigate({ to: "/group/$itemId", params: { itemId: group.id } });
  }

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Create a group</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite friends with a code and start ranking together.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="name">Group name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Cinema Club"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this group watch?"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Visibility</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: !isPublic ? "var(--color-primary)" : "var(--color-border)",
                  background: !isPublic
                    ? "color-mix(in oklab, var(--color-primary) 12%, var(--color-card))"
                    : "var(--color-card)",
                }}
              >
                <Lock className="h-4 w-4" style={{ color: !isPublic ? "var(--color-primary)" : "var(--color-muted-foreground)" }} />
                <span className="text-sm font-semibold">Private</span>
                <span className="text-xs text-muted-foreground">Invite only</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: isPublic ? "var(--color-primary)" : "var(--color-border)",
                  background: isPublic
                    ? "color-mix(in oklab, var(--color-primary) 12%, var(--color-card))"
                    : "var(--color-card)",
                }}
              >
                <Globe className="h-4 w-4" style={{ color: isPublic ? "var(--color-primary)" : "var(--color-muted-foreground)" }} />
                <span className="text-sm font-semibold">Public</span>
                <span className="text-xs text-muted-foreground">Listed on homepage</span>
              </button>
            </div>
          </div>

          <Button
            className="mt-4 h-12 w-full text-base font-semibold"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? "Creating…" : "Create group"}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
