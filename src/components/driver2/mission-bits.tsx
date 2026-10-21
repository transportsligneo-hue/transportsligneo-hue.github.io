import { useEffect, useState } from "react";
import { Ic } from "@/components/driver2/icons";
import { vehicleCategory, type VehicleCategory } from "@/lib/vehicle-category";
import citadine from "@/assets/driver-v2/cat-citadine.png";
import berline from "@/assets/driver-v2/cat-berline.png";
import suv from "@/assets/driver-v2/cat-suv.png";
import utilitaire from "@/assets/driver-v2/cat-utilitaire.png";
import fourgon from "@/assets/driver-v2/cat-fourgon.png";

const CATIMG: Record<VehicleCategory, string> = { Citadine: citadine, Berline: berline, SUV: suv, Utilitaire: utilitaire, Fourgon: fourgon };
export const shortCity = (x: string) => String(x).split(",").pop()!.trim();

/** Pastille de catégorie du véhicule (éclair si électrique). */
export function VehicleTile({ marque, modele, ev }: { marque?: string | null; modele?: string | null; ev: boolean }) {
  const cat = vehicleCategory(marque, modele);
  return (
    <span className={`vtile${ev ? " vtile--ev" : ""}`}>
      <img src={CATIMG[cat]} alt={cat} />
      {ev && <b className="vbolt"><Ic n="bolt" s={11} sw={2.6} /></b>}
      <em>{cat}{ev ? " électrique" : ""}</em>
    </span>
  );
}

export function EnchTile() {
  return (
    <span className="vtile vtile--ench" title="Enchère : proposez votre prix">
      <span className="vup"><span className="vdn"><Ic n="up" s={22} sw={2.6} /></span><i>€</i></span>
      <em>Enchère</em>
    </span>
  );
}

export const EQUIP_LABEL: Record<string, { label: string; icon: string }> = {
  plateau: { label: "Plateau", icon: "ramp" },
  wg: { label: "W Garage", icon: "plateW" },
  elec: { label: "Câble recharge", icon: "bolt" },
};

/** Puces de la mission : énergie, carburant, mise en main, équipements requis. */
export function MissionChips({ ev, categorie, carburant, miseEnMain, requis }: {
  ev: boolean; categorie: string; carburant?: string | null; miseEnMain?: boolean; requis?: string[];
}) {
  return (
    <div className="mchips">
      {ev
        ? <span className="mchip mchip--ev"><Ic n="bolt" s={12} sw={2.6} />{categorie} électrique</span>
        : <span className="mchip mchip--th"><Ic n="engine" s={13} sw={2.2} />Thermique</span>}
      {carburant === "rembourse" && <span className="mchip mchip--ok"><Ic n="pumpok" s={13} sw={2.3} />Carburant remboursé</span>}
      {carburant === "plein" && <span className="mchip"><Ic n="pump" s={13} sw={2.3} />Plein à faire</span>}
      {miseEnMain && <span className="mchip"><Ic n="key" s={12} sw={2.4} />Mise en main</span>}
      {(requis ?? []).map((r) => {
        const q = EQUIP_LABEL[r];
        return q ? <span key={r} className="mchip mchip--eq"><Ic n={q.icon} s={12} sw={2.4} />{q.label} requis</span> : null;
      })}
    </div>
  );
}

/** Mini-carte décorative du trajet (mêmes tracés que l'appli validée). */
export function RouteMap({ dep, arr, km, near }: { dep: string; arr: string; km?: number | null; near?: number | null }) {
  const id = `rm${dep.length}${arr.length}${Math.round(km ?? 0)}`;
  const pill: React.CSSProperties = { position: "absolute", fontSize: 10.5, fontWeight: 800, background: "rgba(255,255,255,.92)", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 9px" };
  return (
    <div className="rmap" style={{ position: "relative", margin: "2px 0 4px", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)", background: "linear-gradient(135deg,rgba(20,184,102,.08),rgba(79,232,160,.05) 55%,rgba(47,95,255,.06))" }}>
      <svg viewBox="0 0 320 96" width="100%" height="96" style={{ display: "block" }} aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#14B866" /><stop offset="1" stopColor="#2f5fff" /></linearGradient></defs>
        <g stroke="rgba(20,120,90,.12)" strokeWidth="1" fill="none">
          <path d="M0 70 C80 60 120 90 200 66 S300 40 320 46" /><path d="M40 0 C50 30 30 60 60 96" /><path d="M150 0 C140 30 170 50 150 96" /><path d="M250 0 C260 28 240 60 270 96" /><path d="M0 28 L320 20" />
        </g>
        <path d="M34 66 C90 18 150 82 200 44 S262 30 286 36" stroke="rgba(255,255,255,.9)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M34 66 C90 18 150 82 200 44 S262 30 286 36" stroke={`url(#${id})`} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M34 66 C90 18 150 82 200 44 S262 30 286 36" stroke="rgba(255,255,255,.85)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeDasharray="1 9">
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.1s" repeatCount="indefinite" />
        </path>
        <circle cx="34" cy="66" r="8" fill="#fff" stroke="#14B866" strokeWidth="3.5" />
        <g transform="translate(286 36)">
          <circle r="12" fill="#2f5fff" opacity=".18"><animate attributeName="r" values="8;15;8" dur="2s" repeatCount="indefinite" /></circle>
          <path d="M0 8 C-8 -2 -9 -8 -9 -11 a9 9 0 0 1 18 0 c0 3-1 9-9 19z" transform="translate(0 -10)" fill="#2f5fff" />
          <circle cy="-13" r="3.4" fill="#fff" />
        </g>
      </svg>
      <span style={{ ...pill, left: 10, top: 8, color: "#0b6b46" }}>{shortCity(dep)}</span>
      <span style={{ ...pill, right: 10, bottom: 8, color: "#1e40af" }}>{shortCity(arr)}</span>
      {km ? <span style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", fontSize: 11, fontWeight: 800, color: "#08243f", background: "#fff", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 10px" }}>{Math.round(km)} km</span> : null}
      {near != null ? <span style={{ position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#14B866", borderRadius: 999, padding: "2px 9px" }}>📍 à {Math.round(near)} km de vous</span> : null}
    </div>
  );
}

export const fmtCountdown = (ms: number) => {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Compte à rebours en direct jusqu'à une échéance (ISO) ; null si pas d'échéance. */
export function Countdown({ fin }: { fin: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fin) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [fin]);
  if (!fin) return <>Sans limite</>;
  return <>{fmtCountdown(new Date(fin).getTime() - now)}</>;
}

export interface AuctionInfo {
  prix: number;
  plafond: number | null;
  fin: string | null;
  nb_offres: number;
  mon_offre: number | null;
}

/** Plafond effectif : celui de l'admin, sinon +25 % du prix de la mission. */
export const auctionCap = (a: AuctionInfo) => a.plafond ?? Math.round(a.prix * 1.25);

export function AuctionStrip({ a }: { a: AuctionInfo }) {
  return (
    <div className="aucstrip">
      <div><small>Prix mission</small><b>{Math.round(a.prix)} €</b></div>
      <div><small>Plafond</small><b className="grn">{auctionCap(a)} €</b></div>
      <div><small>Offres</small><b>{a.nb_offres}</b></div>
      <div className="aucend"><Ic n="clock" s={12} sw={2.4} /><span><Countdown fin={a.fin} /></span></div>
    </div>
  );
}
