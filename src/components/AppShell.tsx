import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Hop as Home, Users, Sparkles, Star, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const tabs = [
    { to: "/", label: "Home", icon: Home, exact: true },
    { to: "/group", label: "Groups", icon: Users, exact: false },
    { to: "/review", label: "Review", icon: Star, exact: false },
    { to: "/recommendations", label: "For You", icon: Sparkles, exact: false },
    { to: "/user", label: "User", icon: User, exact: false },
  ] as const;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-background/95 backdrop-blur-md">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
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
