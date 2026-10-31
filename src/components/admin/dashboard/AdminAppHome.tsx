import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Search, Truck, type LucideIcon } from "lucide-react";
import { LiveMissionMap } from "@/components/map/LiveMissionMap";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { supabase } from "@/integrations/supabase/client";
import { SIGNAL_STALE_MIN } from "@/lib/mission-live-metrics";

const FINISHED = ["terminee", "termine", "validee", "livree", "annulee", "annule", "refusee", "refuse"];

type Live = { id: string; numero: string | null; depart: string | null; arrivee: string | null; plaque: string | null; statut: string | null; etape: string | null;
  lat: number | null; lng: number | null; recordedAt: string | null };

export type AppHomeAlert = { to: string; icon: LucideIcon; title: string; count: number; tone: "warning" | "danger" | "info" };
export type AppHomeKpi = { label: string; value: string | number; delta?: string; to: string };
export type AppHomeNotif = { id: string; titre: string; message: string | null; lu: boolean; created_at: string };

const TONE: Record<AppHomeAlert["tone"], string> = { danger: "#e5484d", warning: "#e8960c", info: "#2f5fff" };

/** Accueil de l'appli : carte plein écran toujours visible + volet tableau de bord qu'on tire vers le haut. */
export function AdminAppHome({ kpis, alerts, notifs, alertCount }: { kpis: AppHomeKpi[]; alerts: AppHomeAlert[]; notifs: AppHomeNotif[]; alertCount: number }) {
  const [live, setLive] = useState<Live[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(640);
  const [h, setH] = useState(330);
  const [drag, setDrag] = useState(false);
  const start = useRef({ y: 0, h: 0 });

  const refresh = useCallback(async () => {
    const { data: attrs } = await supabase.from("attributions")
      .select("id, numero_mission, statut, etape_courante, trajets(depart, arrivee, statut, immatriculation, vehicule_immatriculation)")
      .not("statut", "in", `(${FINISHED.map((s) => `"${s}"`).join(",")})`)
      .order("created_at", { ascending: false }).limit(60);
    const ids = (attrs ?? []).map((a) => a.id);
    const { data: positions } = ids.length
      ? await supabase.from("mission_locations").select("attribution_id, latitude, longitude, recorded_at")
        .in("attribution_id", ids).order("recorded_at", { ascending: false }).limit(1500)
      : { data: [] };
    const latest = new Map<string, { latitude: number; longitude: number; recorded_at: string }>();
    for (const p of positions ?? []) if (!latest.has(p.attribution_id)) latest.set(p.attribution_id, p);
    setLive((attrs ?? []).flatMap((a) => {
      const t = (Array.isArray(a.trajets) ? a.trajets[0] : a.trajets) as { depart: string | null; arrivee: string | null; statut: string | null; immatriculation?: string | null; vehicule_immatriculation?: string | null } | null;
      if (!t || FINISHED.includes(t.statut ?? "")) return [];
      const pos = latest.get(a.id);
      if (!pos) return [];
      return [{ id: a.id, numero: a.numero_mission, depart: t.depart, arrivee: t.arrivee, plaque: t.immatriculation ?? t.vehicule_immatriculation ?? null,
        statut: a.statut, etape: a.etape_courante, lat: pos.latitude, lng: pos.longitude, recordedAt: pos.recorded_at }];
    }));
  }, []);

  useEffect(() => {
    void refresh();
    const iv = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxH(el.clientHeight));
    ro.observe(el);
    setBoxH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const fleet = useMemo(() => live.map((m) => ({
    lat: m.lat as number, lng: m.lng as number,
    label: `${m.numero ?? "Mission"} · ${m.depart ?? "?"} → ${m.arrivee ?? "?"}`,
    stale: Date.now() - new Date(m.recordedAt as string).getTime() > SIGNAL_STALE_MIN * 60_000,
  })), [live]);

  const minH = 128;
  const maxH = Math.max(minH + 120, boxH - 70);
  const snaps = [minH, Math.min(340, maxH), maxH];
  const onDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); start.current = { y: e.clientY, h }; setDrag(true); };
  const onMove = (e: React.PointerEvent) => { if (!drag) return; setH(Math.max(minH, Math.min(maxH, start.current.h + (start.current.y - e.clientY)))); };
  const onUp = (e: React.PointerEvent) => {
    setDrag(false);
    if (Math.abs(e.clientY - start.current.y) < 5) { toggle(); return; }
    setH((cur) => snaps.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a)));
  };
  const toggle = () => setH((cur) => (cur >= snaps[2] - 4 ? snaps[1] : snaps[2]));

  return (
    <div ref={boxRef} className="adm-app-home fixed left-0 right-0 z-30 overflow-hidden bg-[#eaf0fc]"
      style={{ top: "calc(56px + env(safe-area-inset-top))", bottom: "calc(68px + env(safe-area-inset-bottom))" }}>
      <div className="absolute inset-0">
        <LiveMissionMap points={[]} fleet={fleet} worldOverview hideOverlay className="absolute inset-0 !rounded-none" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 p-3">
        <Link to="/admin/missions" className="pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 text-[13px] font-medium text-[#6b7aa3] shadow-[0_8px_24px_-12px_rgba(20,40,110,.45)] backdrop-blur">
          <Search size={17} className="shrink-0" /><span className="truncate">Rechercher missions, convoyeurs…</span>
        </Link>
        <Link to="/admin/alertes" aria-label="Alertes" className="pointer-events-auto relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white/95 text-[#1c2c58] shadow-[0_8px_24px_-12px_rgba(20,40,110,.45)] backdrop-blur">
          <Bell size={19} />
          {alertCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#e5484d] px-1 text-center text-[10px] font-bold leading-[18px] text-white">{alertCount > 99 ? "99+" : alertCount}</span>}
        </Link>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[26px] border border-b-0 border-white/80 bg-white shadow-[0_-18px_44px_-18px_rgba(20,40,110,.5)]"
        style={{ height: h, transition: drag ? "none" : "height .28s cubic-bezier(.2,.9,.3,1)" }}>
        <div className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="h-1.5 w-11 rounded-full bg-[#cfd8ee]" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#0a1638]">Tableau de bord</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <Link key={k.label} to={k.to as never} className="rounded-2xl border border-[#e3e9f7] bg-[#f6f8fe] px-3 py-2.5 active:scale-[.98]">
                <small className="block truncate text-[10.5px] font-semibold text-[#6b7aa3]">{k.label}</small>
                <b className="block truncate text-[19px] font-extrabold leading-tight text-[#0a1638]">{k.value}</b>
                {k.delta && <u className="text-[10.5px] font-bold text-[#0b9a5c] no-underline">{k.delta}</u>}
              </Link>
            ))}
          </div>

          <h3 className="mb-1.5 mt-5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#5a6788]">À traiter en priorité</h3>
          {alerts.length === 0 ? <p className="text-[13px] text-[#6b7aa3]">Tout est à jour.</p> : alerts.map((a) => (
            <Link key={a.to} to={a.to as never} className="flex items-center gap-3 border-t border-[#e9eef9] py-3 first:border-t-0 active:bg-slate-50">
              <span className="grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] font-extrabold text-white" style={{ background: TONE[a.tone] }}>{a.count}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#0a1638]">{a.title}</span>
              <ChevronRight size={17} className="shrink-0 text-[#9aa6c4]" />
            </Link>
          ))}

          <h3 className="mb-1.5 mt-5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#5a6788]">En direct</h3>
          {live.length === 0 ? <p className="text-[13px] text-[#6b7aa3]">Aucune mission en cours avec position GPS.</p> : live.slice(0, 8).map((m) => (
            <Link key={m.id} to="/admin/exploitation" className="flex items-center gap-3 border-t border-[#e9eef9] py-3 first:border-t-0 active:bg-slate-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e1f7ec] text-[#0b7a45]"><Truck size={19} /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px] text-[#0a1638]">{m.depart ?? "?"} → {m.arrivee ?? "?"}</b>
                <small className="block truncate text-[12px] text-[#6b7aa3]">{m.numero ?? "Mission"}{m.etape ? ` · ${m.etape.replace(/_/g, " ")}` : ""}</small>
              </span>
              {m.plaque && <PlateBadge plate={m.plaque} size="sm" />}
            </Link>
          ))}

          <div className="mb-1.5 mt-5 flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#5a6788]">Activité</h3>
            <Link to="/admin/notifications" className="text-xs font-semibold text-[#2f5fff]">Tout voir</Link>
          </div>
          {notifs.slice(0, 5).map((n) => (
            <div key={n.id} className="flex items-start gap-3 border-t border-[#e9eef9] py-2.5 first:border-t-0">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lu ? "bg-slate-300" : "bg-[#2f5fff]"}`} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-[#0a1638]">{n.titre}</p>
                {n.message && <p className="truncate text-[12px] text-[#6b7aa3]">{n.message}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
