import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Invite à mettre à jour l'application Android quand une version plus récente
 * est publiée (public/app-version.json → latestBuild).
 * Le site lui-même (écrans, correctifs) se met à jour tout seul à chaque ouverture :
 * ce bandeau ne concerne que les nouvelles versions de l'application native.
 */
export function AppUpdatePrompt() {
  const [info, setInfo] = useState<{ storeUrl: string; build: number } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let off = false;
    const check = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const cur = Number((await App.getInfo()).build);
        const res = await fetch(`/app-version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { latestBuild?: number; storeUrl?: string };
        let dismissed = 0;
        try { dismissed = Number(localStorage.getItem("ligneo:update-dismissed") || 0); } catch { /* */ }
        if (!off && j.latestBuild && cur && cur < j.latestBuild && j.latestBuild > dismissed && j.storeUrl) setInfo({ storeUrl: j.storeUrl, build: j.latestBuild });
      } catch { /* silencieux */ }
    };
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { off = true; document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!info) return null;
  return (
    <div style={{ position: "fixed", left: 12, right: 12, bottom: 96, zIndex: 60, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 16, background: "#0b2a1f", color: "#fff", boxShadow: "0 14px 34px -10px rgba(0,0,0,.5)", border: "1px solid rgba(52,230,140,.45)" }}>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.3 }}>
        <b style={{ display: "block", fontSize: 14 }}>Nouvelle version disponible</b>
        Mettez à jour l'application pour profiter des dernières améliorations.
      </div>
      <button
        type="button"
        onClick={() => { try { localStorage.setItem("ligneo:update-dismissed", String(info.build)); } catch { /* */ } setInfo(null); }}
        style={{ flex: "none", padding: "10px 8px", background: "transparent", color: "#9fd8c0", fontWeight: 700, fontSize: 12 }}
      >
        Plus tard
      </button>
      <a href={info.storeUrl} onClick={() => setInfo(null)} style={{ flex: "none", padding: "10px 14px", borderRadius: 12, background: "linear-gradient(135deg,#14B866,#34E68C)", color: "#04261a", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
        Mettre à jour
      </a>
    </div>
  );
}
