import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import driverLogo from "@/assets/driver-v2/logo.png";
import "@/styles/driver-update.css";

// Table créée par la migration 20261026000300 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any };

/** Page Google Play officielle de l'appli Ligneo Driver */
export const DRIVER_PLAY_URL = "https://play.google.com/store/apps/details?id=com.transportsligneo.driver";

export type DriverUpdate = { id: string; version: string; titre: string; message: string; store_url: string };

const ACK_KEY = "ligneo:driver-update-ack";

/** Compare deux numéros de version « 2.4.0 » : renvoie <0, 0 ou >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Fenêtre de mise à jour OBLIGATOIRE (aucun bouton pour la fermer). Aussi utilisée en aperçu dans l'admin. */
export function DriverUpdateCard({ update, native, preview = false }: { update: Omit<DriverUpdate, "id"> & { id?: string }; native: boolean; preview?: boolean }) {
  const label = native ? "Mettre à jour sur Google Play" : "Recharger maintenant";
  const onWeb = () => {
    try { if (update.id) localStorage.setItem(ACK_KEY, update.id); } catch { /* */ }
    window.location.reload();
  };
  return (
    <div className={`dux${preview ? " is-static" : ""}`} role="alertdialog" aria-modal={!preview} aria-labelledby="dux-t">
      <div className="dux-card">
        <div className="dux-lg"><img src={driverLogo} alt="" /></div>
        <h4 id="dux-t">{update.titre || "Nouvelle version disponible"}</h4>
        {update.message && <p>{update.message}</p>}
        <div className="dux-v">Version {update.version || "—"} requise</div>
        {native ? (
          <a className="dux-go" href={update.store_url || DRIVER_PLAY_URL} target="_blank" rel="noopener noreferrer">{label}</a>
        ) : (
          <button type="button" className="dux-go" onClick={preview ? undefined : onWeb}>{label}</button>
        )}
        <div className="dux-nb">Cette mise à jour est nécessaire pour continuer.</div>
      </div>
    </div>
  );
}

/**
 * Bloque l'espace convoyeur tant que la mise à jour obligatoire publiée par l'admin n'est pas installée.
 * - Appli Android : bloqué si la version installée est plus ancienne que celle exigée.
 * - Site (PC ou navigateur) : bloqué jusqu'au rechargement de la page (la nouvelle version se charge toute seule).
 */
export function DriverUpdateGate() {
  const [upd, setUpd] = useState<DriverUpdate | null>(null);
  const [native, setNative] = useState(false);

  const check = useCallback(async () => {
    let row: DriverUpdate | null = null;
    try {
      const { data, error } = await db.from("driver_app_updates").select("id, version, titre, message, store_url").eq("active", true).maybeSingle();
      if (error) { console.warn("[mise à jour Driver] lecture impossible :", error); return; }
      row = data as DriverUpdate | null;
    } catch (e) { console.warn("[mise à jour Driver] réseau :", e); return; } // jamais de blocage sur une erreur réseau
    if (!row) { setUpd(null); return; }

    const isApp = Capacitor.isNativePlatform() || /LigneoDriverApp/i.test(navigator.userAgent);
    if (isApp) {
      // Version installée. Si le téléphone ne sait pas la donner (ancienne build), on la considère dépassée :
      // la fenêtre s'affiche et le bouton envoie sur Google Play.
      let cur = "";
      try {
        const { App } = await import("@capacitor/app");
        cur = String((await App.getInfo()).version || "");
      } catch (e) { console.warn("[mise à jour Driver] version installée introuvable :", e); }
      setNative(true);
      setUpd(!cur || compareVersions(cur, row.version) < 0 ? row : null);
    } else {
      let ack = "";
      try { ack = localStorage.getItem(ACK_KEY) || ""; } catch { /* */ }
      setNative(false);
      setUpd(ack === row.id ? null : row);
    }
  }, []);

  useEffect(() => {
    void check();
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    const iv = window.setInterval(() => void check(), 5 * 60_000);
    return () => { document.removeEventListener("visibilitychange", onVis); window.clearInterval(iv); };
  }, [check]);

  if (!upd) return null;
  return <DriverUpdateCard update={upd} native={native} />;
}
