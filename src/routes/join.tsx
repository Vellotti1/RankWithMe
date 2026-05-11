import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUP } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/join")({
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  return (
    <AppShell>
      <section className="px-5 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Join a group</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your invite code. Try the demo code{" "}
          <span className="font-mono font-semibold text-foreground">
            {GROUP.inviteCode}
          </span>
          .
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="code">Invite code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MNC-7421"
              className="mt-1.5 font-mono uppercase tracking-widest"
            />
          </div>

          <Button
            className="h-12 w-full text-base font-semibold"
            disabled={!code.trim()}
            onClick={() => {
              if (code.trim() === GROUP.inviteCode) {
                toast.success(`Joined ${GROUP.name}`);
              } else {
                toast.message("Demo: opening Movie Night Crew");
              }
              setTimeout(() => navigate({ to: "/group" }), 400);
            }}
          >
            Join group
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
