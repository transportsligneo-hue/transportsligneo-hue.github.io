import { useEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { isDriverPath, isMaintenanceExempt, useMaintenance } from "@/lib/maintenance";
import { MaintenanceBanner, MaintenanceScreen } from "./MaintenanceViews";

const DISMISS_KEY = "ligneo-maint-banner-closed";

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

  const variant = driver ? "driver" : "site";
  return (
    <>
      {banner && (
        <div ref={bannerRef} className="mtn-bn-wrap">
          <MaintenanceBanner s={s!} variant={variant} onClose={() => { try { sessionStorage.setItem(DISMISS_KEY, `${s!.title}|${s!.reason}`); } catch { /* ignore */ } setClosed(true); }} />
        </div>
      )}
      {full ? <MaintenanceScreen s={s!} variant={variant} /> : (children ?? <Outlet />)}
    </>
  );
}
