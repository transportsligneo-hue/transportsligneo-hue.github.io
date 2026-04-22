import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "convoyeur" | "client";
type TypeClient = "particulier" | "b2b";
type ConvoyeurStatut = "en_attente" | "valide" | "actif" | "refuse" | "suspendu";

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  /** true tant que role/profil/statut ne sont pas tous chargés */
  isLoading: boolean;
  /** true uniquement pendant la toute première initialisation */
  isInitializing: boolean;
  roleActif: boolean;
  typeClient: TypeClient | null;
  convoyeurStatut: ConvoyeurStatut | null;
  /** route de destination calculée selon role + typeClient + statut */
  homeRoute: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

interface ResolvedProfile {
  role: AppRole | null;
  roleActif: boolean;
  typeClient: TypeClient | null;
  convoyeurStatut: ConvoyeurStatut | null;
}

function computeHomeRoute(p: ResolvedProfile, isAuthenticated: boolean): string {
  if (!isAuthenticated) return "/login";
  if (!p.roleActif) return "/login";
  if (p.role === "admin") return "/admin";
  if (p.role === "convoyeur") {
    if (p.convoyeurStatut === "valide" || p.convoyeurStatut === "actif") return "/convoyeur";
    return "/attente-validation";
  }
  // client (par défaut)
  if (p.typeClient === "b2b") return "/dashboard-pro";
  return "/dashboard-client";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ResolvedProfile>({
    role: null,
    roleActif: true,
    typeClient: null,
    convoyeurStatut: null,
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);

  /** Charge en une seule passe rôle + profile + statut convoyeur (si applicable). */
  const loadProfile = useCallback(async (userId: string): Promise<ResolvedProfile> => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role, actif")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("type_client")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const role = (rolesRes.data?.role as AppRole | undefined) ?? null;
      const roleActif = rolesRes.data?.actif !== false;
      const typeClient = ((profileRes.data as { type_client?: string } | null)?.type_client as TypeClient | undefined) ?? "particulier";

      let convoyeurStatut: ConvoyeurStatut | null = null;
      if (role === "convoyeur") {
        const { data: convData } = await supabase
          .from("convoyeurs")
          .select("statut")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        convoyeurStatut = (convData?.statut as ConvoyeurStatut | undefined) ?? "en_attente";
      }

      return { role, roleActif, typeClient, convoyeurStatut };
    } catch (err) {
      console.warn("[useAuth] loadProfile error:", err);
      return { role: null, roleActif: true, typeClient: null, convoyeurStatut: null };
    }
  }, []);

  /** Hydrate l'état pour un user donné. Annule si un autre user est arrivé entre-temps. */
  const hydrateForUser = useCallback(
    async (u: User | null) => {
      const userId = u?.id ?? null;
      currentUserIdRef.current = userId;

      if (!userId) {
        setProfile({ role: null, roleActif: true, typeClient: null, convoyeurStatut: null });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const resolved = await loadProfile(userId);

      // Race-guard : un autre auth state change a pu arriver entretemps
      if (currentUserIdRef.current !== userId) return;

      setProfile(resolved);
      setIsLoading(false);
    },
    [loadProfile],
  );

  useEffect(() => {
    // 1) S'abonner AVANT de charger la session pour ne rater aucun event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // hydrate de manière non bloquante
      void hydrateForUser(newSession?.user ?? null);
    });

    // 2) Charger la session existante
    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      await hydrateForUser(existing?.user ?? null);
      setIsInitializing(false);
    }).catch(() => {
      setIsInitializing(false);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [hydrateForUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange déclenchera l'hydratation
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange remettra les états à zéro
  }, []);

  const refresh = useCallback(async () => {
    if (user) await hydrateForUser(user);
  }, [user, hydrateForUser]);

  const hasRole = useCallback((r: string) => profile.role === r, [profile.role]);
  const hasAnyRole = useCallback((roles: string[]) => roles.includes(profile.role ?? ""), [profile.role]);

  const isAuthenticated = !!session;
  const homeRoute = computeHomeRoute(profile, isAuthenticated);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        session,
        role: profile.role,
        roleActif: profile.roleActif,
        typeClient: profile.typeClient,
        convoyeurStatut: profile.convoyeurStatut,
        isLoading: isInitializing || isLoading,
        isInitializing,
        homeRoute,
        login,
        logout,
        refresh,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
