import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Search, ChevronDown, LogOut, UserCog, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Variant = "light" | "dark";

interface SearchResult {
  id: string;
  type: "demande" | "trajet" | "client" | "convoyeur";
  title: string;
  subtitle?: string;
  to: string;
}

interface Notification {
  id: string;
  title: string;
  description?: string;
  date: string;
  to?: string;
}

interface Props {
  variant?: Variant;
  /** Lien profil (ex: /dashboard-client/profil) */
  profileTo?: string;
  /** Active la recherche multi-entités (admin) */
  enableGlobalSearch?: boolean;
  /** Sources de notifications custom (sinon, fallback automatique) */
  notifications?: Notification[];
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
  notifications,
}: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [autoNotifs, setAutoNotifs] = useState<Notification[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const isDark = variant === "dark";

  // === Notifs auto (fallback générique : 5 dernières demandes pour admin) ===
  useEffect(() => {
    if (notifications) return;
    if (!enableGlobalSearch) return;
    supabase
      .from("demandes_convoyage")
      .select("id, prenom, nom, depart, arrivee, created_at, statut")
      .eq("statut", "nouvelle")
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (!data) return;
        setAutoNotifs(
          data.map((d) => ({
            id: d.id,
            title: `Nouvelle demande — ${d.prenom} ${d.nom}`,
            description: `${d.depart} → ${d.arrivee}`,
            date: d.created_at,
            to: "/admin/demandes",
          }))
        );
      });
  }, [notifications, enableGlobalSearch]);

  const finalNotifs = notifications ?? autoNotifs;
  const unreadCount = finalNotifs.length;

  // === Recherche globale (debounce léger) ===
  useEffect(() => {
    if (!enableGlobalSearch) return;
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = `%${query}%`;
      const [demandes, trajets, clients, convoyeurs] = await Promise.all([
        supabase
          .from("demandes_convoyage")
          .select("id, prenom, nom, depart, arrivee")
          .or(`nom.ilike.${q},prenom.ilike.${q},depart.ilike.${q},arrivee.ilike.${q}`)
          .limit(4),
        supabase
          .from("trajets")
          .select("id, depart, arrivee, client_nom")
          .or(`depart.ilike.${q},arrivee.ilike.${q},client_nom.ilike.${q}`)
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
      ]);

      const merged: SearchResult[] = [
        ...(demandes.data ?? []).map((d) => ({
          id: d.id,
          type: "demande" as const,
          title: `${d.prenom} ${d.nom}`,
          subtitle: `${d.depart} → ${d.arrivee}`,
          to: "/admin/demandes",
        })),
        ...(trajets.data ?? []).map((t) => ({
          id: t.id,
          type: "trajet" as const,
          title: `${t.depart} → ${t.arrivee}`,
          subtitle: t.client_nom ?? "Sans client",
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
      if (notifRef.current && !notifRef.current.contains(t)) setNotifOpen(false);
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

  const typeLabel: Record<SearchResult["type"], string> = {
    demande: "Demande",
    trajet: "Trajet",
    client: "Client",
    convoyeur: "Convoyeur",
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

        {/* === Notifications === */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className={`relative w-9 h-9 rounded-md flex items-center justify-center transition-colors ${iconBtn}`}
            aria-label="Notifications"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className={`absolute right-0 mt-2 w-80 rounded-lg overflow-hidden ${dropdownBg}`}>
              <div className={`px-4 py-3 border-b ${isDark ? "border-primary/15" : "border-pro-border"}`}>
                <p className={`text-sm font-semibold ${isDark ? "text-cream" : "text-pro-text"}`}>
                  Notifications
                </p>
              </div>
              {finalNotifs.length === 0 ? (
                <div className={`px-4 py-8 text-center text-sm ${isDark ? "text-cream/50" : "text-pro-muted"}`}>
                  Aucune notification
                </div>
              ) : (
                <ul className="max-h-96 overflow-y-auto">
                  {finalNotifs.map((n) => {
                    const content = (
                      <div className={`px-4 py-3 border-b last:border-0 transition-colors ${
                        isDark
                          ? "border-primary/10 hover:bg-primary/10"
                          : "border-pro-border hover:bg-pro-bg-soft"
                      }`}>
                        <p className={`text-sm font-medium ${isDark ? "text-cream" : "text-pro-text"}`}>
                          {n.title}
                        </p>
                        {n.description && (
                          <p className={`text-xs mt-0.5 ${isDark ? "text-cream/60" : "text-pro-text-soft"}`}>
                            {n.description}
                          </p>
                        )}
                        <p className={`text-[10px] mt-1 ${isDark ? "text-cream/40" : "text-pro-muted"}`}>
                          {new Date(n.date).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {n.to ? (
                          <Link to={n.to} onClick={() => setNotifOpen(false)} className="block">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* === Profil === */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-md transition-colors ${iconBtn}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                isDark
                  ? "bg-primary text-navy"
                  : "bg-pro-accent text-white"
              }`}
            >
              {initial}
            </div>
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
