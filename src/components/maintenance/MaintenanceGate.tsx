import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { isDriverPath, isMaintenanceExempt, useMaintenance } from "@/lib/maintenance";
import { MaintenanceBanner, MaintenanceScreen } from "./MaintenanceViews";

const DISMISS_KEY = "ligneo-maint-banner-closed";

/** Si l'écran de maintenance ne peut pas s'afficher, on montre un message simple au lieu de faire planter l'appli. */
class MaintenanceSafe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("Écran de maintenance :", e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "Poppins, system-ui, sans-serif", background: "#eef3fb", color: "#0b2342" }}>
        <div><h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Maintenance en cours</h1><p style={{ margin: 0, color: "#4b5d7d" }}>Nous revenons très vite.</p></div>
      </main>
    );
  }
}

/** Remplace <Outlet /> : affiche le bandeau ou la page de maintenance selon le réglage admin. */
export default function MaintenanceGate({ children }: { children?: ReactNode }) {
  const s = useMaintenance();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useAuth();
  const [closed, setClosed] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  const driver = isDriverPath(pathname);
  const targeted = !!s && s.enabled && (driver ? s.driver : s.site);
  const isAdmin = role === "admin" || role === "super_admin";
  const bypass = !!s && s.admin_bypass && isAdmin;
  const exempt = !!s && isMaintenanceExempt(pathname, s);
  const full = targeted && s!.mode === "full" && !exempt && !bypass;
  const banner = targeted && !full && !exempt && !closed && (s!.mode === "banner" || bypass);

  useEffect(() => {
    try { setClosed(sessionStorage.getItem(DISMISS_KEY) === `${s?.title}|${s?.reason}`); } catch { /* ignore */ }
  }, [s?.title, s?.reason]);

  // Décale la barre de navigation sous le bandeau.
  useEffect(() => {
    const root = document.documentElement;
    if (!banner || !bannerRef.current) { root.removeAttribute("data-maint-banner"); root.style.removeProperty("--mt-h"); return; }
    const el = bannerRef.current;
    const set = () => { root.style.setProperty("--mt-h", `${el.offsetHeight}px`); root.setAttribute("data-maint-banner", "1"); };
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => { ro.disconnect(); root.removeAttribute("data-maint-banner"); root.style.removeProperty("--mt-h"); };
  }, [banner]);

  // Fin de la page de maintenance : rechargement complet pour repartir d'un état propre
  // (évite l'écran d'erreur quand les pages reviennent d'un coup).
  const wasFull = useRef(false);
  useEffect(() => {
    if (wasFull.current && !full) { window.location.reload(); return; }
    wasFull.current = full;
  }, [full]);

  const variant = driver ? "driver" : "site";
  return (
    <>
      {banner && (
        <div ref={bannerRef} className="mtn-bn-wrap">
          <MaintenanceBanner s={s!} variant={variant} onClose={() => { try { sessionStorage.setItem(DISMISS_KEY, `${s!.title}|${s!.reason}`); } catch { /* ignore */ } setClosed(true); }} />
        </div>
      )}
      {full ? <MaintenanceSafe><MaintenanceScreen s={s!} variant={variant} /></MaintenanceSafe> : (children ?? <Outlet />)}
    </>
  );
}
