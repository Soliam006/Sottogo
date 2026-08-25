"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { UserProfile } from "@/core/models";
import { toUserProfile } from "@/services/mappers";
import { getSupabaseBrowserClient } from "@/services/supabase/client";

interface SessionContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const db = getSupabaseBrowserClient();
    const { data } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data ? toUserProfile(data) : null);
  }, []);

  useEffect(() => {
    const db = getSupabaseBrowserClient();
    let active = true;

    void (async () => {
      const { data } = await db.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    })();

    const { data: listener } = db.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) void loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      profile,
      loading,
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id);
      },
      signOut: async () => {
        await getSupabaseBrowserClient().auth.signOut();
        window.location.href = "/login";
      },
    }),
    [session, profile, loading, loadProfile],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}

/** Perfil garantizado dentro del area privada. */
export function useCurrentUser(): UserProfile {
  const { profile } = useSession();
  if (!profile) throw new Error("No hay usuario autenticado en este contexto");
  return profile;
}
