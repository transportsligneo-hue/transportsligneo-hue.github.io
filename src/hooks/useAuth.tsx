import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getHighestActiveRole, type AppRole } from "@/lib/roles";

type TypeClient = "particulier" | "b2b" | "flotte";
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
  orgRole: "client_b2b" | "flotte_partenaire" | "sous_traitant" | null;
}

function computeHomeRoute(p: ResolvedProfile, isAuthenticated: boolean): string {
  if (!isAuthenticated) return "/login";
  if (!p.roleActif) return "/login";
  if (p.role === "admin" || p.role === "super_admin") return "/admin";
  if (p.role === "convoyeur") {
    if (p.convoyeurStatut === "valide" || p.convoyeurStatut === "actif") return "/convoyeur";
    return "/attente-validation";
  }
  // Org-based redirection (flotte / entreprise)
  // Espace pro unifié — B2B + Flotte partagent /dashboard-pro
  if (p.orgRole === "flotte_partenaire" || p.orgRole === "client_b2b") return "/dashboard-pro";
  if (p.typeClient === "flotte" || p.typeClient === "b2b") return "/dashboard-pro";
  return "/dashboard-client";
}

/* ---------- Cache local du profil : permet l'accès hors connexion ---------- */
const PROFILE_CACHE_PREFIX = "ligneo_profile_cache_";

function readCachedProfile(userId: string): ResolvedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResolvedProfile;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, p: ResolvedProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROFILE_CACHE_PREFIX + userId, JSON.stringify(p));
  } catch {
    /* quota — ignore */
  }
}

/** Rejette après `ms` pour ne jamais bloquer l'UI sur un réseau mort. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ResolvedProfile>({
    role: null,
    roleActif: true,
    typeClient: null,
    convoyeurStatut: null,
    orgRole: null,
  });
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserIdRef = useRef<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  /**
   * Charge en une seule passe rôle + profile + statut convoyeur (si applicable).
   * Retourne `null` si le réseau est indisponible → on retombera sur le cache local.
   */
  const loadProfile = useCallback(async (userId: string): Promise<ResolvedProfile | null> => {
    try {
      const [rolesRes, profileRes] = await withTimeout(
        Promise.all([
          supabase
            .from("user_roles")
            .select("role, actif")
            .eq("user_id", userId)
            .eq("actif", true),
          supabase
            .from("profiles")
            .select("type_client")
            .eq("user_id", userId)
            .maybeSingle(),
        ]),
        8000,
      );

      if (rolesRes.error) throw rolesRes.error;
      if (profileRes.error) throw profileRes.error;

      const activeRoles = ((rolesRes.data as Array<{ role: string; actif?: boolean | null }> | null) ?? []);
      const role = getHighestActiveRole(activeRoles);
      const roleActif = activeRoles.length > 0;
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

      // Détecter le rôle d'organisation prioritaire (flotte_partenaire > client_b2b > sous_traitant)
      let orgRole: ResolvedProfile["orgRole"] = null;
      if (role === "client" || role === "manager" || role === "sous_traitant") {
        const { data: mems } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .eq("status", "active");
        const orgIds = (mems ?? []).map((m) => m.organization_id);
        if (orgIds.length > 0) {
          const { data: orgRoles } = await supabase
            .from("organization_roles")
            .select("role")
            .in("organization_id", orgIds)
            .eq("active", true);
          const list = (orgRoles ?? []).map((r) => r.role);
          if (list.includes("flotte_partenaire")) orgRole = "flotte_partenaire";
          else if (list.includes("client_b2b")) orgRole = "client_b2b";
          else if (list.includes("sous_traitant")) orgRole = "sous_traitant";
        }
      }

      return { role, roleActif, typeClient, convoyeurStatut, orgRole };
    } catch (err) {
      console.warn("[useAuth] loadProfile error (offline ?):", err);
      return null;
    }
  }, []);

  /** Hydrate l'état pour un user donné. Annule si un autre user est arrivé entre-temps. */
  const hydrateForUser = useCallback(
    async (u: User | null) => {
      const userId = u?.id ?? null;
      currentUserIdRef.current = userId;

      if (!userId) {
        setProfile({ role: null, roleActif: true, typeClient: null, convoyeurStatut: null, orgRole: null });
        setProfileUserId(null);
        setIsLoading(false);
        return;
      }

      // Ne jamais laisser le profil de l'utilisateur précédent piloter une redirection.
      setIsLoading(true);
      setProfileUserId(null);

      // 1) Cache local → l'app est utilisable immédiatement, même sans réseau.
      const cached = readCachedProfile(userId);
      if (cached) {
        setProfile(cached);
      }

      // 2) Hors ligne : on s'arrête là (le cache fait foi).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (cached) setProfileUserId(userId);
        setIsLoading(false);
        return;
      }

      // 3) Rafraîchissement réseau (en arrière-plan si on avait un cache).
      const resolved = await loadProfile(userId);

      // Race-guard : un autre auth state change a pu arriver entretemps
      if (currentUserIdRef.current !== userId) return;

      if (resolved) {
        setProfile(resolved);
        setProfileUserId(userId);
        writeCachedProfile(userId, resolved);
      }
      setIsLoading(false);
    },
    [loadProfile],
  );


  useEffect(() => {
    // 1) S'abonner AVANT de charger la session pour ne rater aucun event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const nextUserId = newSession?.user?.id ?? null;
      if (nextUserId === currentUserIdRef.current) return;
      // Ferme immédiatement la fenêtre où une nouvelle session pouvait être
      // redirigée avec le rôle/type du compte précédent.
      setIsLoading(true);
      setProfileUserId(null);
      // IMPORTANT : ne jamais appeler Supabase dans le callback (verrou auth → blocage).
      const nextUser = newSession?.user ?? null;
      setTimeout(() => { void hydrateForUser(nextUser); }, 0);
    });


    // 2) Charger la session existante — sauf si "Rester connecté" avait été décoché
    //    et que l'onglet a été fermé depuis (aucune sessionStorage sentinel).
    const rememberFlag = typeof window !== "undefined" ? localStorage.getItem("ligneo_remember") : null;
    const tabAlive = typeof window !== "undefined" ? sessionStorage.getItem("ligneo_tab_alive") : null;
    const shouldPurge = rememberFlag === "false" && !tabAlive;

    const boot = async () => {
      if (shouldPurge) {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        setIsInitializing(false);
        setIsLoading(false);
        return;
      }
      try {
        // Hors ligne, getSession() peut tenter un refresh réseau : on borne l'attente.
        const { data: { session: existing } } = await withTimeout(supabase.auth.getSession(), 6000)
          .catch(() => ({ data: { session: null } }) as Awaited<ReturnType<typeof supabase.auth.getSession>>);
        setSession(existing);
        setUser(existing?.user ?? null);
        await hydrateForUser(existing?.user ?? null);
      } finally {
        setIsInitializing(false);
      }

    };
    void boot();

    // Marqueur d'onglet vivant : survit aux reloads mais disparaît à la fermeture de l'onglet.
    if (typeof window !== "undefined") {
      try { sessionStorage.setItem("ligneo_tab_alive", "1"); } catch { /* ignore */ }
    }

    return () => subscription.unsubscribe();
  }, [hydrateForUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange déclenchera l'hydratation
  }, []);

  const logout = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (uid && typeof window !== "undefined") {
      try { localStorage.removeItem(PROFILE_CACHE_PREFIX + uid); } catch { /* ignore */ }
    }
    await supabase.auth.signOut();
    // onAuthStateChange remettra les états à zéro
  }, []);


  const refresh = useCallback(async () => {
    if (user) await hydrateForUser(user);
  }, [user, hydrateForUser]);

  const hasRole = useCallback((r: string) => profile.role === r, [profile.role]);
  const hasAnyRole = useCallback((roles: string[]) => roles.includes(profile.role ?? ""), [profile.role]);

  const isAuthenticated = !!session;
  const isProfilePending = !!user?.id && profileUserId !== user.id;
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
        isLoading: isInitializing || isLoading || isProfilePending,
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
