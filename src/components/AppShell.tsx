import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, Users, Sparkles, LogOut, User, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { to: "/", label: "Home", icon: Home },
    { to: "/group", label: "Groups", icon: Users },
    { to: "/recommendations", label: "For You", icon: Sparkles },
  ] as const;

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

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
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <span className="max-w-[96px] truncate">{profile?.display_name || profile?.username || "Account"}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">@{profile?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
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
