import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "user" | "superadmin" | "admin_arena" | "player";

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
    let mounted = true;
    const stopLoadingFallback = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchRoles(s.user!.id), 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) fetchRoles(s.user.id);
        else setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRoles([]);
        setLoading(false);
      });

    return () => {
      mounted = false;
      window.clearTimeout(stopLoadingFallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function fetchRoles(userId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, arena_id")
      .eq("user_id", userId);
    setRoles(error ? [] : ((data ?? []) as UserRole[]));
    setLoading(false);
  }

  const isSuperAdmin = roles.some((r) => r.role === "superadmin" || r.role === "admin");
  const adminArenaId = roles.find((r) => r.role === "admin_arena")?.arena_id ?? null;
  const playerArenaIds = roles.filter((r) => r.role === "player").map((r) => r.arena_id!).filter(Boolean);
  const isAdmin = isSuperAdmin || Boolean(adminArenaId);

  return { session, user, roles, loading, isSuperAdmin, isAdmin, adminArenaId, playerArenaIds };
}
