import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseAny, isSupabaseConfigured } from "./client";

interface AdminProfile {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  is_active: boolean;
  is_super_admin: boolean;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: User | null;
  adminProfile: AdminProfile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAdminProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<Session | null>(null);
  const [adminProfile, setAdminProfile] = React.useState<AdminProfile | null>(null);
  const queryClient = useQueryClient();
  // Tracks the last authenticated user id so we can detect "user changed"
  // (login → logout → outro login) e limpar todo o cache de admin.
  // O cache "por sessão logada" só é seguro se trocar de usuário SEMPRE
  // limpa o cache — caso contrário, o novo admin veria dados do anterior.
  const lastUserIdRef = React.useRef<string | null>(null);

  const fetchAdminProfile = React.useCallback(
    async (user: User): Promise<AdminProfile | null> => {
      if (!supabase) return null;
      // Buscar TODAS as roles do usuário (admin e/ou super_admin).
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) {
        console.warn("[auth] user_roles fetch error:", error.message);
        return null;
      }
      const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
      const isSuper = roles.includes("super_admin");
      const isAdmin = roles.includes("admin") || isSuper;
      if (!isAdmin) return null;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      return {
        id: user.id,
        email: user.email ?? null,
        name: (meta.name as string) ?? (meta.display_name as string) ?? null,
        role: isSuper ? "super_admin" : "admin",
        is_active: true,
        is_super_admin: isSuper,
      };
    },
    [],
  );

  const refreshAdminProfile = React.useCallback(async () => {
    if (!session?.user) {
      setAdminProfile(null);
      return;
    }
    const profile = await fetchAdminProfile(session.user);
    setAdminProfile(profile);
  }, [session, fetchAdminProfile]);

  React.useEffect(() => {
    // Fail-safe: always stop loading after 5 seconds regardless of network hangs
    const timer = setTimeout(() => {
      setLoading((l) => {
        if (l) console.warn("[auth] Loading timed out after 5s");
        return false;
      });
    }, 5000);

    if (!supabase) {
      setLoading(false);
      clearTimeout(timer);
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user?.id ?? null;
      // Limpa todo o cache do React Query quando:
      //  • o usuário desloga (newUserId === null)
      //  • troca para OUTRO usuário (newUserId !== lastUserIdRef.current)
      // Isso garante que o cache "por sessão" não vaze entre admins.
      if (newUserId !== lastUserIdRef.current) {
        queryClient.clear();
      }
      lastUserIdRef.current = newUserId;
      setSession(newSession);
      if (newSession?.user) {
        fetchAdminProfile(newSession.user)
          .then(setAdminProfile)
          .catch(err => console.error("[auth] Auth state change profile fetch error:", err));
      } else {
        setAdminProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      lastUserIdRef.current = data.session?.user?.id ?? null;
      setSession(data.session);
      if (data.session?.user) {
        fetchAdminProfile(data.session.user)
          .then((p) => {
            setAdminProfile(p);
          })
          .catch((err) => {
            console.error("[auth] Initial profile fetch error:", err);
          })
          .finally(() => {
            setLoading(false);
            clearTimeout(timer);
          });
      } else {
        setLoading(false);
        clearTimeout(timer);
      }
    }).catch(err => {
      console.error("[auth] getSession error:", err);
      setLoading(false);
      clearTimeout(timer);
    });

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [fetchAdminProfile, queryClient]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: "Supabase não conectado. Conecte o connector Supabase da Lovable." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = React.useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // Defesa em profundidade: limpa o cache imediatamente, sem esperar
    // o evento `onAuthStateChange`. Garante que a próxima tela montada
    // (ex.: /admin/login) não veja dados do admin anterior.
    queryClient.clear();
  }, [queryClient]);

  const value: AuthContextValue = {
    loading,
    session,
    user: session?.user ?? null,
    adminProfile,
    isAdmin: !!adminProfile?.is_active,
    isSuperAdmin: !!adminProfile?.is_super_admin,
    configured: isSupabaseConfigured,
    signIn,
    signOut,
    refreshAdminProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
