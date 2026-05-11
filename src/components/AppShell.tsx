import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Users, Sparkles, ChevronDown } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";
import { MEMBERS } from "@/lib/mock-data";
import { Avatar } from "./Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, setUserId } = useCurrentUser();
  const { pathname } = useLocation();

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/group", label: "Group", icon: Users },
    { to: "/recommendations", label: "For You", icon: Sparkles },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg"
            style={{
              background:
                "conic-gradient(from 220deg, var(--color-primary), var(--color-accent), var(--color-primary))",
            }}
          />
          <span className="text-base font-bold tracking-tight">RankWithMe</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-sm font-medium hover:bg-muted">
            <Avatar member={user} size={26} />
            <span>{user.name}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Viewing as</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MEMBERS.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => setUserId(m.id)}
                className="flex items-center gap-2"
              >
                <Avatar member={m} size={22} />
                <span>{m.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-background/90 backdrop-blur-md">
        <div className="grid grid-cols-3">
          {tabs.map((t) => {
            const active =
              t.to === "/"
                ? pathname === "/"
                : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors"
                style={{
                  color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                }}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
