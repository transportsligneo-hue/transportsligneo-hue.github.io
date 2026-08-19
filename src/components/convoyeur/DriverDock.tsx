import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, ClipboardCheck, Truck, MoreHorizontal, X, ArrowRight, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ConvoyeurSidebarItem } from "@/components/convoyeur/ConvoyeurSidebar";

interface ActiveMission {
  id: string;
  depart: string;
  arrivee: string;
  progress: number;
}

const PROGRESS_BY_ETAPE: Record<string, number> = {
  acceptee: 15,
  en_route_depart: 30,
  edl_depart: 45,
  en_route: 65,
  arrivee: 85,
  edl_arrivee: 92,
};

/**
 * Dock de navigation bas d'écran de l'app convoyeur.
 * Tableau de bord · Mes missions (CTA central surélevé) · Catalogue (badge) · Plus.
 * Affiche un bandeau "mission en cours" au-dessus du dock lorsqu'une mission est active.
 */
export default function DriverDock({
  items,
  isActive,
}: {
  items: ConvoyeurSidebarItem[];
  isActive: (item: ConvoyeurSidebarItem) => boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [catalogueCount, setCatalogueCount] = useState(0);
  const [active, setActive] = useState<ActiveMission | null>(null);
  // Masquage temporaire du dock (étapes critiques : signature, EDL).
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const { data: conv } = await supabase
          .from("convoyeurs")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        const { count } = await supabase
          .from("trajets_publies_safe" as never)
          .select("id", { count: "exact", head: true });
        if (!cancelled) setCatalogueCount(count ?? 0);

        if (!conv?.id) return;
        const { data: attrs } = await supabase
          .from("attributions")
          .select("id, statut, trajet_id, etape_courante" as never)
          .eq("convoyeur_id", conv.id)
          .in("statut", ["accepte", "en_cours"])
          .order("created_at", { ascending: false })
          .limit(1);

        const attr = (attrs as unknown as Array<{ id: string; statut: string; trajet_id: string; etape_courante: string | null }> | null)?.[0];
        if (!attr) {
          if (!cancelled) setActive(null);
          return;
        }
        const { data: trajet } = await supabase
          .from("trajets_assigned_safe" as never)
          .select("depart, arrivee")
          .eq("id", attr.trajet_id)
          .maybeSingle();
        const t = trajet as unknown as { depart?: string; arrivee?: string } | null;
        if (cancelled) return;
        setActive({
          id: attr.id,
          depart: t?.depart ?? "Départ",
          arrivee: t?.arrivee ?? "Arrivée",
          progress:
            PROGRESS_BY_ETAPE[attr.etape_courante ?? ""] ??
            (attr.statut === "en_cours" ? 60 : 15),
        });
      } catch {
        if (!cancelled) setActive(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const find = (to: string) => items.find((i) => i.to === to);
  const dashboard = find("/convoyeur");
  const missions = find("/convoyeur/missions");
  const catalogue = find("/convoyeur/catalogue");
  const mainTabs = new Set(["/convoyeur", "/convoyeur/missions", "/convoyeur/catalogue"]);
  const overflow = items.filter((i) => !mainTabs.has(i.to));

  const activeDash = dashboard ? isActive(dashboard) : false;
  const activeMissions = missions ? isActive(missions) : false;
  const activeCatalogue = catalogue ? isActive(catalogue) : false;
  const activeOverflow = overflow.some(isActive);

  const city = (s: string) => s.split(",")[0].trim();

  return (
    <>
      <nav aria-label="Navigation convoyeur" className={`md:hidden ldock-zone${collapsed ? " is-collapsed" : ""}`}>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Afficher la barre de navigation" : "Masquer la barre de navigation"}
          aria-expanded={!collapsed}
          className="ldock-toggle"
        >
          <ChevronDown size={16} />
        </button>

        <div className="ldock">
          <Link to="/convoyeur" className={`ldock-item${activeDash ? " is-active" : ""}`}>
            <span className="ldock-ic">
              <LayoutDashboard strokeWidth={2} />
            </span>
            <span>Tableau de bord</span>
            <i className="ldock-dot" />
          </Link>

          <Link to="/convoyeur/missions" className="ldock-item is-raised" aria-label="Mes missions">
            <span className="ldock-fab" style={activeMissions ? { boxShadow: "0 14px 30px rgba(47,95,255,0.75), 0 0 0 6px #040b28" } : undefined}>
              <ClipboardCheck strokeWidth={2.2} />
            </span>
            <span>Mes missions</span>
          </Link>

          <Link to="/convoyeur/catalogue" className={`ldock-item${activeCatalogue ? " is-active" : ""}`}>
            {catalogueCount > 0 && <i className="ldock-badge not-italic">{catalogueCount > 9 ? "9+" : catalogueCount}</i>}
            <span className="ldock-ic">
              <Truck strokeWidth={2} />
            </span>
            <span>Catalogue</span>
            <i className="ldock-dot" />
          </Link>

          <button
            onClick={() => setMoreOpen(true)}
            className={`ldock-item${activeOverflow ? " is-active" : ""}`}
            aria-label="Plus"
          >
            <span className="ldock-ic">
              <MoreHorizontal strokeWidth={2} />
            </span>
            <span>Plus</span>
            <i className="ldock-dot" />
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-[55] bg-[#041B52]/70 backdrop-blur-md" onClick={() => setMoreOpen(false)} />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[60] safe-bottom animate-sheet-up">
            <div className="bg-[rgba(6,18,56,0.96)] backdrop-blur-2xl border-t border-[rgba(140,170,255,0.28)] rounded-t-3xl p-4 pb-6">
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-white font-semibold text-sm">Menu</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-9 h-9 rounded-2xl bg-white/[0.06] border border-[rgba(140,170,255,0.28)] flex items-center justify-center text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {overflow.map((item) => {
                  const on = isActive(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMoreOpen(false)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 min-h-[80px] rounded-2xl border transition-all ${
                        on
                          ? "border-[rgba(91,131,255,0.55)] bg-[rgba(47,95,255,0.18)] text-white shadow-[0_0_24px_rgba(47,95,255,0.30)]"
                          : "border-[rgba(140,170,255,0.18)] bg-white/[0.05] text-[#D6E4FF]"
                      }`}
                    >
                      <item.icon size={20} className={on ? "text-[#5b83ff]" : "text-[#9aa8d9]"} />
                      <span className="text-[10px] text-center leading-tight tracking-wide font-semibold">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
