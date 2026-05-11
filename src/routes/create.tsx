import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEMBERS } from "@/lib/mock-data";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>(["jack"]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Create a group</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo only — your real group will live in the demo space.
        </p>

        <div className="mt-6 space-y-4">
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
            <Label>Add members</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {MEMBERS.map((m) => {
                const active = picked.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="flex items-center gap-2 rounded-xl border p-2 text-left transition-colors"
                    style={{
                      borderColor: active
                        ? "var(--color-primary)"
                        : "var(--color-border)",
                      background: active
                        ? "color-mix(in oklab, var(--color-primary) 12%, var(--color-card))"
                        : "var(--color-card)",
                    }}
                  >
                    <Avatar member={m} size={28} />
                    <span className="text-sm font-semibold">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            className="mt-4 h-12 w-full text-base font-semibold"
            onClick={() => {
              toast.success("Group created (demo) — opening Movie Night Crew");
              setTimeout(() => navigate({ to: "/group" }), 400);
            }}
            disabled={!name.trim() || picked.length === 0}
          >
            Create group
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
