import { useState } from "react";
import { toast } from "sonner";
import { Ic } from "@/components/driver2/icons";
import { RETOUR_APPS, buildRechargeLink, buildRetourLink, resolveRetourPoints, type RetourKey } from "@/lib/return-trip-links";
import blablacar from "@/assets/retour/blablacar.png";
import bolt from "@/assets/retour/bolt.png";
import flixbus from "@/assets/retour/flixbus.png";
import gmaps from "@/assets/retour/gmaps.png";
import moovit from "@/assets/retour/moovit.png";
import rome2rio from "@/assets/retour/rome2rio.png";
import sncf from "@/assets/retour/sncf.png";
import trainline from "@/assets/retour/trainline.png";
import uber from "@/assets/retour/uber.png";
import waze from "@/assets/retour/waze.png";

const LOGOS: Record<RetourKey, string> = { blablacar, bolt, flixbus, gmaps, moovit, rome2rio, sncf, trainline, uber, waze };

/**
 * « Préparer mon retour » : départ = adresse de livraison, arrivée saisie par le convoyeur
 * (il ne rentre pas forcément chez lui). Affiché dans la mission et à la fin de l'EDL d'arrivée.
 */
export function RetourBlock({ livraison, electrique = false, vehicule }: { livraison: string; electrique?: boolean; vehicule?: string | null }) {
  const [dest, setDest] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState<RetourKey | null>(null);

  const groupes = Array.from(new Set(RETOUR_APPS.map((a) => a.groupe)));

  async function ouvrir(key: RetourKey) {
    const to = dest.trim();
    if (!to) {
      toast.error("Indiquez d'abord où vous rentrez (arrivée)");
      setShake(true);
      window.setTimeout(() => setShake(false), 600);
      return;
    }
    setBusy(key);
    try {
      const needsGeo = key === "moovit" || key === "uber";
      const { f, t } = needsGeo ? await resolveRetourPoints(livraison, to) : { f: null, t: null };
      const link = buildRetourLink(key, livraison, to, f, t);
      if (link.copier) {
        try { await navigator.clipboard.writeText(`${livraison} → ${to}`); toast.success("Trajet copié, collez-le dans l'application"); } catch { /* copie impossible : on ouvre quand même */ }
      }
      if (link.app) {
        // Application installée : elle s'ouvre. Sinon, on bascule sur le site au bout d'un instant.
        let quitte = false;
        const onHide = () => { quitte = true; };
        document.addEventListener("visibilitychange", onHide, { once: true });
        window.location.href = link.app;
        window.setTimeout(() => {
          document.removeEventListener("visibilitychange", onHide);
          if (!quitte && !document.hidden) window.open(link.web, "_blank", "noopener,noreferrer");
        }, 1400);
      } else {
        window.open(link.web, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="drv2">
      <div className="ret-route">
        <div className="ret-r"><i className="a" /><div><small>Départ · lieu de livraison</small><b>{livraison || "Adresse de livraison"}</b></div></div>
        <div className="ret-line" />
        <div className="ret-r">
          <i className="b" />
          <div>
            <small>Arrivée · où rentrez-vous ?</small>
            <input
              className={`ret-in${shake ? " shake" : ""}`}
              placeholder="Votre ville ou votre adresse"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
            />
          </div>
        </div>
      </div>

      {electrique && (
        <button className="ret-ev" onClick={() => window.open(buildRechargeLink(livraison), "_blank", "noopener,noreferrer")}>
          <span><Ic n="bolt" s={18} sw={2.2} /></span>
          <div><b>Planifier les recharges du trajet</b><small>Véhicule électrique : bornes de recharge près de la livraison</small></div>
          <Ic n="chev" s={14} sw={2.4} />
        </button>
      )}

      {electrique && (
        <button
          className="ret-ev"
          onClick={async () => {
            const txt = `${vehicule ? `Véhicule : ${vehicule}\n` : ""}Départ : ${livraison}${dest.trim() ? `\nArrivée : ${dest.trim()}` : ""}`;
            try { await navigator.clipboard.writeText(txt); toast.success("Trajet copié : collez-le dans ABRP"); } catch { /* ignore */ }
            window.open("https://abetterrouteplanner.com/", "_blank", "noopener,noreferrer");
          }}
        >
          <span><Ic n="pin" s={18} sw={2.2} /></span>
          <div><b>Optimiser avec A Better Routeplanner</b><small>Planificateur dédié aux électriques : arrêts de recharge selon le modèle</small></div>
          <Ic n="chev" s={14} sw={2.4} />
        </button>
      )}

      {groupes.map((g) => (
        <div key={g}>
          <div className="ret-g"><span>{g}</span><i /></div>
          <div className="ret-grid">
            {RETOUR_APPS.filter((a) => a.groupe === g).map((a) => (
              <button key={a.key} className="rt" onClick={() => void ouvrir(a.key)} aria-label={a.nom} disabled={busy === a.key}>
                <span className="rt-l" style={{ background: a.fond }}><img src={LOGOS[a.key]} alt={a.nom} /></span>
                <span className="rt-n"><b>{a.nom}</b><small>{a.sous}</small></span>
                <em><Ic n="up" s={13} sw={2.4} /></em>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="ret-note">Le départ est rempli avec l'adresse de livraison. Vous choisissez l'arrivée, puis l'application s'ouvre avec le trajet.</p>
    </div>
  );
}
