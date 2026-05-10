import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "superadmin" | "admin_arena" | "player";

export interface UserRole {
  role: AppRole;
  arena_id: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRoles(s.user!.id), 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchRoles(s.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role, arena_id")
      .eq("user_id", userId);
    setRoles((data ?? []) as UserRole[]);
    setLoading(false);
  }

  const isSuperAdmin = roles.some((r) => r.role === "superadmin");
  const adminArenaId = roles.find((r) => r.role === "admin_arena")?.arena_id ?? null;
  const playerArenaIds = roles.filter((r) => r.role === "player").map((r) => r.arena_id!).filter(Boolean);

  return { session, user, roles, loading, isSuperAdmin, adminArenaId, playerArenaIds };
}
