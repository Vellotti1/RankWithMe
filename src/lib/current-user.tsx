import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MEMBERS, type Member } from "./mock-data";

type Ctx = {
  user: Member;
  setUserId: (id: string) => void;
};

const UserCtx = createContext<Ctx | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string>("jack");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("rwm-user");
    if (saved && MEMBERS.some((m) => m.id === saved)) setUserId(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rwm-user", userId);
    }
  }, [userId]);

  const user = MEMBERS.find((m) => m.id === userId) ?? MEMBERS[0];
  return <UserCtx.Provider value={{ user, setUserId }}>{children}</UserCtx.Provider>;
}

export function useCurrentUser() {
  const ctx = useContext(UserCtx);
  if (!ctx) throw new Error("useCurrentUser outside provider");
  return ctx;
}
