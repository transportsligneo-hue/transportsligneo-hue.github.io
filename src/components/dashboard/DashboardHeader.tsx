import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, ChevronDown, LogOut, UserCog, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentOrgAccountType } from "@/hooks/useCurrentOrgAccountType";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { NotificationBell } from "@/components/notifications/NotificationBell";


type Variant = "light" | "dark";

interface SearchResult {
  id: string;
  type: "demande" | "trajet" | "client" | "convoyeur" | "mission" | "devis" | "vehicle";
  title: string;
  subtitle?: string;
  to: string;
}

interface Props {
  variant?: Variant;
  /** Lien profil (ex: /dashboard-client/profil) */
  profileTo?: string;
  /** Active la recherche multi-entités (admin) */
  enableGlobalSearch?: boolean;
}

/**
 * Header global réutilisable pour tous les dashboards.
 * - variant "light" : SaaS clair (admin, pro)
 * - variant "dark"  : Sombre dorée (client, convoyeur dark)
 *
 * Logique non-bloquante : si la recherche échoue, le header reste fonctionnel.
 */
export function DashboardHeader({
  variant = "light",
  profileTo,
  enableGlobalSearch = false,
}: Props) {
  const { user, logout, role } = useAuth();
  const [ownAvatar, setOwnAvatar] = useState<string | null>(null);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDark = variant === "dark";

  // === Recherche globale (debounce léger) ===
  useEffect(() => {
    if (!enableGlobalSearch) return;
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = `%${query}%`;
      const [demandes, trajets, clients, convoyeurs, missions, devis, vehicles] = await Promise.all([
        supabase
          .from("demandes_convoyage")
          .select("id, prenom, nom, depart, arrivee, immatriculation")
          .or(`nom.ilike.${q},prenom.ilike.${q},depart.ilike.${q},arrivee.ilike.${q},immatriculation.ilike.${q}`)
          .limit(4),
        supabase
          .from("trajets")
          .select("id, depart, arrivee, client_nom, vin, immatriculation")
          .or(`depart.ilike.${q},arrivee.ilike.${q},client_nom.ilike.${q},vin.ilike.${q},immatriculation.ilike.${q}`)
          .limit(4),
        supabase
          .from("profiles")
          .select("id, prenom, nom, email, societe")
          .or(`nom.ilike.${q},prenom.ilike.${q},email.ilike.${q},societe.ilike.${q}`)
          .limit(4),
        supabase
          .from("convoyeurs")
          .select("id, prenom, nom, email, ville")
          .or(`nom.ilike.${q},prenom.ilike.${q},email.ilike.${q},ville.ilike.${q}`)
          .limit(4),
        supabase
          .from("missions")
          .select("id, numero, vin, immatriculation, ville_depart, ville_arrivee")
          .or(`numero.ilike.${q},vin.ilike.${q},immatriculation.ilike.${q}`)
          .limit(4),
        supabase
          .from("devis")
          .select("id, numero, vin, prenom, nom")
          .or(`numero.ilike.${q},vin.ilike.${q}`)
          .limit(4),
        supabase
          .from("vehicles" as never)
          .select("id, vin, immatriculation, marque, modele")
          .or(`vin.ilike.${q},immatriculation.ilike.${q},marque.ilike.${q},modele.ilike.${q}`)
          .limit(4),
      ]);

      const merged: SearchResult[] = [
        ...((missions.data ?? []) as Array<{ id: string; numero: string; vin: string | null; immatriculation: string | null; ville_depart: string; ville_arrivee: string }>).map((m) => ({
          id: m.id,
          type: "mission" as const,
          title: m.numero || "Mission",
          subtitle: [m.immatriculation, m.vin, `${m.ville_depart} → ${m.ville_arrivee}`].filter(Boolean).join(" · "),
          to: `/admin/missions/${m.id}`,
        })),
        ...((trajets.data ?? []) as Array<{ id: string; depart: string; arrivee: string; client_nom: string | null; vin: string | null; immatriculation: string | null }>).map((tr) => ({
          id: tr.id,
          type: "trajet" as const,
          title: `${tr.depart} → ${tr.arrivee}`,
          subtitle: [tr.immatriculation, tr.vin, tr.client_nom].filter(Boolean).join(" · ") || "Sans véhicule",
          to: "/admin/trajets",
        })),
        ...((demandes.data ?? []) as Array<{ id: string; prenom: string | null; nom: string | null; depart: string; arrivee: string; immatriculation: string | null }>).map((d) => ({
          id: d.id,
          type: "demande" as const,
          title: `${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "Demande",
          subtitle: [d.immatriculation, `${d.depart} → ${d.arrivee}`].filter(Boolean).join(" · "),
          to: "/admin/demandes",
        })),
        ...((devis.data ?? []) as Array<{ id: string; numero: string; vin: string | null; prenom: string | null; nom: string | null }>).map((dv) => ({
          id: dv.id,
          type: "devis" as const,
          title: dv.numero || "Devis",
          subtitle: [dv.vin, `${dv.prenom ?? ""} ${dv.nom ?? ""}`.trim()].filter(Boolean).join(" · "),
          to: `/admin/devis/${dv.id}`,
        })),
        ...((vehicles.data ?? []) as Array<{ id: string; vin: string | null; immatriculation: string | null; marque: string | null; modele: string | null }>).map((v) => ({
          id: v.id,
          type: "vehicle" as const,
          title: `${v.marque ?? ""} ${v.modele ?? ""}`.trim() || v.immatriculation || v.vin || "Véhicule",
          subtitle: [v.immatriculation, v.vin].filter(Boolean).join(" · "),
          to: "/admin/trajets",
        })),
        ...(clients.data ?? []).map((c) => ({
          id: c.id,
          type: "client" as const,
          title: `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.email || "Client",
          subtitle: c.societe ?? c.email ?? undefined,
          to: "/admin/clients",
        })),
        ...(convoyeurs.data ?? []).map((c) => ({
          id: c.id,
          type: "convoyeur" as const,
          title: `${c.prenom} ${c.nom}`,
          subtitle: c.ville ?? c.email,
          to: "/admin/convoyeurs",
        })),
      ];
      setResults(merged);
    }, 250);
    return () => clearTimeout(t);
  }, [query, enableGlobalSearch]);

  // === Click outside ===
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // === Styles par variante ===
  const wrapper = isDark
    ? "bg-navy/85 border-b border-primary/15 backdrop-blur-md"
    : "bg-white border-b border-pro-border";

  const inputBg = isDark
    ? "bg-navy-light/60 border-primary/20 text-cream placeholder:text-cream/40 focus:border-primary/60"
    : "bg-pro-bg-soft border-pro-border text-pro-text placeholder:text-pro-muted focus:border-pro-accent";

  const iconBtn = isDark
    ? "text-cream/60 hover:text-primary hover:bg-primary/10"
    : "text-pro-text-soft hover:text-pro-text hover:bg-pro-bg-soft";

  const dropdownBg = isDark
    ? "bg-navy-light border border-primary/25 shadow-2xl"
    : "bg-white border border-pro-border shadow-xl";

  const initial = (user?.email ?? "U").charAt(0).toUpperCase();
  const { data: orgInfo } = useCurrentOrgAccountType();
  const isAdminUser = role === "admin" || role === "super_admin";
  const orgName = orgInfo?.name ?? null;

  // Avatar personnel (photo convoyeur / client) — prioritaire sur le logo d'organisation
  useEffect(() => {
    if (!user?.id) { setOwnAvatar(null); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setOwnAvatar((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 1) photo perso  2) admin → logo Transports Ligneo  3) logo organisation  4) initiale
  const avatarSrc = ownAvatar ?? (isAdminUser ? logoLigneo : orgInfo?.logoUrl ?? null);
  const avatarAlt = ownAvatar ? "Ma photo" : isAdminUser ? "Transports Ligneo" : orgName ?? "Logo";
  const avatarClass = ownAvatar ? "object-cover" : "object-contain";


  const typeLabel: Record<SearchResult["type"], string> = {
    demande: "Demande",
    trajet: "Trajet",
    client: "Client",
    convoyeur: "Convoyeur",
    mission: "Mission",
    devis: "Devis",
    vehicle: "Véhicule",
  };

  return (
    <header
      className={`sticky top-0 z-30 ${wrapper}`}
    >
      <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
        {/* === Recherche === */}
        {enableGlobalSearch ? (
          <div ref={searchRef} className="relative flex-1 max-w-xl">
            <Search
              size={15}
              className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? "text-cream/40" : "text-pro-muted"
              }`}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Rechercher demandes, trajets, clients, convoyeurs..."
              className={`w-full pl-9 pr-9 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-pro-accent/20 ${inputBg}`}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center ${iconBtn}`}
                aria-label="Effacer"
              >
                <X size={13} />
              </button>
            )}

            {/* Résultats */}
            {searchOpen && query.length >= 2 && (
              <div className={`absolute left-0 right-0 mt-2 rounded-lg overflow-hidden ${dropdownBg}`}>
                {results.length === 0 ? (
                  <div className={`px-4 py-6 text-center text-sm ${isDark ? "text-cream/50" : "text-pro-muted"}`}>
                    Aucun résultat
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {results.map((r) => (
                      <li key={`${r.type}-${r.id}`}>
                        <button
                          onClick={() => {
                            setSearchOpen(false);
                            setQuery("");
                            navigate({ to: r.to });
                          }}
                          className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                            isDark ? "hover:bg-primary/10" : "hover:bg-pro-bg-soft"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? "text-cream" : "text-pro-text"}`}>
                              {r.title}
                            </p>
                            {r.subtitle && (
                              <p className={`text-xs truncate ${isDark ? "text-cream/50" : "text-pro-muted"}`}>
                                {r.subtitle}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                              isDark
                                ? "bg-primary/15 text-primary"
                                : "bg-pro-accent/10 text-pro-accent"
                            }`}
                          >
                            {typeLabel[r.type]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* === Notifications (cloche unifiée, navigation interne) === */}
        <NotificationBell className={isDark ? "text-cream" : "text-pro-text-soft"} />



        {/* === Profil === */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-md transition-colors ${iconBtn}`}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={avatarAlt}
                className={`w-7 h-7 rounded-full ${avatarClass} bg-white border border-pro-border`}
                loading="lazy"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isDark
                    ? "bg-primary text-navy"
                    : "bg-pro-accent text-white"
                }`}
              >
                {initial}
              </div>
            )}
            <ChevronDown size={14} className="hidden sm:inline" />
          </button>

          {profileOpen && (
            <div className={`absolute right-0 mt-2 w-56 rounded-lg overflow-hidden ${dropdownBg}`}>
              <div className={`px-4 py-3 border-b ${isDark ? "border-primary/15" : "border-pro-border"}`}>
                <p className={`text-sm font-medium truncate ${isDark ? "text-cream" : "text-pro-text"}`}>
                  {user?.email}
                </p>
              </div>
              <div className="py-1">
                {profileTo && (
                  <Link
                    to={profileTo}
                    onClick={() => setProfileOpen(false)}
                    className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                      isDark
                        ? "text-cream/80 hover:bg-primary/10 hover:text-primary"
                        : "text-pro-text-soft hover:bg-pro-bg-soft hover:text-pro-text"
                    }`}
                  >
                    <UserCog size={15} />
                    Mon profil
                  </Link>
                )}
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className={`flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors ${
                    isDark
                      ? "text-cream/80 hover:bg-red-500/10 hover:text-red-400"
                      : "text-pro-text-soft hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  <LogOut size={15} />
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
