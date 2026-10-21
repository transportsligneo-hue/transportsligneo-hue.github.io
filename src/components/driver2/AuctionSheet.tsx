import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Ic } from "@/components/driver2/icons";
import { Countdown, auctionCap, type AuctionInfo } from "@/components/driver2/mission-bits";

interface State extends AuctionInfo {
  active: boolean;
  classement_visible: boolean;
  autres_offres: number[];
}

interface Props {
  trajetId: string;
  depart: string;
  arrivee: string;
  marque?: string | null;
  km?: number | null;
  dateLabel?: string | null;
  initial: AuctionInfo;
  onClose: () => void;
  onChanged: () => void;
}

const rankText = (r: number, n: number) =>
  `${r === 1 ? "🥇 Vous seriez 1er, offre la plus basse" : r === 2 ? "Vous seriez 2e" : `Vous seriez ${r}e`} sur ${n}`;

/** Fiche d'enchère : le convoyeur propose son prix (l'offre la plus basse passe en tête), dans la limite du plafond. */
export function AuctionSheet({ trajetId, depart, arrivee, marque, km, dateLabel, initial, onClose, onChanged }: Props) {
  const [st, setSt] = useState<State | null>(null);
  const [v, setV] = useState<number>(initial.mon_offre ?? Math.round(initial.prix));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_auction_state" as never, { _trajet_id: trajetId } as never);
    if (!error && data) setSt(data as unknown as State);
  }, [trajetId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [load]);

  const info: AuctionInfo = st ?? initial;
  const prix = Math.round(info.prix);
  const cap = auctionCap(info);
  const others = st?.autres_offres ?? [];
  const visible = st?.classement_visible ?? true;
  const dejaMoi = info.mon_offre != null;
  const best = others.length ? Math.min(...others) : null;
  const clamp = (x: number) => Math.min(cap, Math.max(prix, Math.round(x)));
  const set = (x: number) => setV(clamp(x));

  const rank = useMemo(() => others.filter((x) => x < v).length + 1, [others, v]);
  const n = others.length + 1;
  const rows = useMemo(() => {
    const r = others.map((b, k) => ({ b, me: false, l: `Convoyeur ${String.fromCharCode(65 + k)}` }));
    r.push({ b: v, me: true, l: "Votre offre" });
    return r.sort((a, b) => a.b - b.b || (a.me ? -1 : 1));
  }, [others, v]);

  async function place() {
    setBusy(true);
    const { error } = await supabase.rpc("place_auction_bid" as never, { _trajet_id: trajetId, _prix: v } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Offre de ${v} € enregistrée`);
    onChanged();
    onClose();
  }

  return createPortal(
    <div className="drv2">
      <div className="overlay" onClick={onClose}>
        <div className="sheet aucs" onClick={(e) => e.stopPropagation()}>
          <div className="grab" />
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="sp">
              <span className="auclive"><i />Enchère en direct</span>
              <h2 className="auctt">{depart} → {arrivee}</h2>
              <p className="tiny mut">{[marque, km ? `${Math.round(km)} km` : null, dateLabel].filter(Boolean).join(" · ")}</p>
            </div>
            <button className="hbtn" onClick={onClose} aria-label="Fermer"><Ic n="x" s={16} /></button>
          </div>

          <div className="auccd"><small>Fin de l'enchère dans</small><b><Countdown fin={info.fin} /></b></div>

          <div className="aucstrip" style={{ marginTop: 10 }}>
            <div><small>Prix de la mission</small><b>{prix} €</b></div>
            <div><small>Plafond</small><b className="grn">{cap} €</b></div>
            <div><small>Offres</small><b>{info.nb_offres}</b></div>
          </div>

          <div className="aucpick">
            <small>Votre offre · entre {prix} € et {cap} €</small>
            <div className="aucnum">
              <button onClick={() => set(v - 1)} aria-label="Moins"><Ic n="minus" s={20} sw={2.6} /></button>
              <div><b>{v}</b><em>€</em></div>
              <button onClick={() => set(v + 1)} aria-label="Plus"><Ic n="plusi" s={20} sw={2.6} /></button>
            </div>
            <input type="range" min={prix} max={cap} value={v} onChange={(e) => set(Number(e.target.value))} />
            <div className="aucquick">
              <button onClick={() => set(prix)}>Prix mission</button>
              <button onClick={() => set(v + 5)}>+5 €</button>
              <button onClick={() => set(v + 10)}>+10 €</button>
              {best != null && <button onClick={() => set(best - 1)}>Passer 1er</button>}
              <button onClick={() => set(cap)}>Plafond</button>
            </div>
            {visible && <div className={`aucrank ${rank === 1 ? "first" : rank === 2 ? "second" : "low"}`}>{rankText(rank, n)}</div>}
            <p className="tiny mut" style={{ textAlign: "center", marginTop: 6 }}>
              {v > prix ? `+${v - prix} € par rapport au prix mission` : "Au prix de la mission"}
              {km ? ` · ${(v / km).toFixed(2).replace(".", ",")} € / km` : ""}
            </p>
          </div>

          {visible && (
            <>
              <div className="cl-lb" style={{ margin: "14px 0 6px" }}>Classement (offre la plus basse en tête)</div>
              <div className="auclist">
                {rows.map((r, k) => (
                  <div key={k} className={`aucrow${r.me ? " me" : ""}`}>
                    <span className="aucpos">{k + 1}</span><span className="sp">{r.l}</span><b>{r.b} €</b>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="tiny mut" style={{ margin: "10px 2px 0" }}>
            Proposez le prix auquel vous acceptez cette mission, dans la limite du plafond fixé par Ligneo. Plus votre offre est proche du prix de la mission, plus vous avez de chances d'être retenu. L'admin tient aussi compte de votre note et de votre proximité.
          </p>
          <button className="btn aucbtn" style={{ marginTop: 14 }} disabled={busy} onClick={() => void place()}>
            <Ic n="hammer" s={17} sw={2.3} /> {dejaMoi ? "Mettre à jour" : "Placer mon offre"} à {v} €
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
