import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ClipboardCheck, Truck, MoreHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ConvoyeurSidebarItem } from "@/components/convoyeur/ConvoyeurSidebar";

const CATALOGUE_SEEN_KEY = "ldock-catalogue-seen";

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
  onOpenPlus,
  plusOpen,
}: {
  items: ConvoyeurSidebarItem[];
  isActive: (item: ConvoyeurSidebarItem) => boolean;
  onOpenPlus: () => void;
  plusOpen: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [catalogueCount, setCatalogueCount] = useState(0);
  // Nombre de missions catalogue déjà vues : le badge disparaît après consultation.
  const [catalogueSeen, setCatalogueSeen] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(CATALOGUE_SEEN_KEY) ?? 0) || 0;
  });
  const [active, setActive] = useState<ActiveMission | null>(null);
  // Dock rétractable : se cache en descendant dans la page, revient en remontant,
  // et peut être replié / rouvert à la main avec la languette.
  const [collapsed, setCollapsed] = useState(false);
  const manualRef = useRef(false);
  const lastY = useRef(new WeakMap<object, number>());

  useEffect(() => {
    const onScroll = (e: Event) => {
      const t = (e.target === document ? document.scrollingElement : e.target) as HTMLElement | null;
      if (!t || typeof t.scrollTop !== "number") return;
      if (t.scrollHeight - t.clientHeight < 120) return; // page trop courte : on laisse le dock
      const y = t.scrollTop;
      const prev = lastY.current.get(t) ?? 0;
      const dy = y - prev;
      if (Math.abs(dy) < 8) return;
      lastY.current.set(t, y);
      if (dy > 0 && y > 80) {
        manualRef.current = false;
        setCollapsed(true);
      } else if (dy < 0 || y <= 24) {
        manualRef.current = false;
        setCollapsed(false);
      }
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
  }, []);

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

  const markCatalogueSeen = (count: number) => {
    setCatalogueSeen(count);
    try { window.localStorage.setItem(CATALOGUE_SEEN_KEY, String(count)); } catch { /* ignore */ }
  };

  // Consultation en cours du catalogue → on considère tout comme vu.
  useEffect(() => {
    if (activeCatalogue && catalogueCount !== catalogueSeen) markCatalogueSeen(catalogueCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCatalogue, catalogueCount]);

  const catalogueNew = Math.max(0, catalogueCount - catalogueSeen);

  const city = (s: string) => s.split(",")[0].trim();

  return (
    <>
      <nav aria-label="Navigation convoyeur" className={`md:hidden ldock-zone drv2${collapsed ? " is-collapsed" : ""}`}>
        <div className="ldock">
          <Link to="/convoyeur" className={`ldock-item${activeDash ? " is-active" : ""}`}>
            <span className="ldock-ic">
              <LayoutDashboard strokeWidth={2} />
            </span>
            <span>Tableau de bord</span>
            <i className="ldock-dot" />
          </Link>

          <Link to="/convoyeur/missions" className="ldock-item is-raised" aria-label="Mes missions">
            <span className="ldock-fab" data-active={activeMissions ? "1" : undefined}>
              <ClipboardCheck strokeWidth={2.2} />
            </span>
            <span>Mes missions</span>
          </Link>

          <Link
            to="/convoyeur/catalogue"
            onClick={() => markCatalogueSeen(catalogueCount)}
            className={`ldock-item${activeCatalogue ? " is-active" : ""}`}
          >
            {catalogueNew > 0 && <i className="ldock-badge not-italic">{catalogueNew > 9 ? "9+" : catalogueNew}</i>}
            <span className="ldock-ic">
              <Truck strokeWidth={2} />
            </span>
            <span>Catalogue</span>
            <i className="ldock-dot" />
          </Link>

          <button
            onClick={onOpenPlus}
            className={`ldock-item${activeOverflow || plusOpen ? " is-active" : ""}`}
            aria-label="Plus"
          >
            <span className="ldock-ic">
              <MoreHorizontal strokeWidth={2} />
            </span>
            <span>Plus</span>
            <i className="ldock-dot" />
          </button>
        </div>
        <button
          type="button"
          className="ldock-handle"
          aria-label={collapsed ? "Afficher la barre de navigation" : "Masquer la barre de navigation"}
          onClick={() => {
            manualRef.current = true;
            setCollapsed((c) => !c);
          }}
        >
          {collapsed ? <ChevronUp strokeWidth={2.6} /> : <ChevronDown strokeWidth={2.6} />}
        </button>
      </nav>

    </>
  );
}
