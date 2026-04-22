/**
 * VehicleInspectionMap — représentation visuelle interactive du véhicule.
 *
 * 3 vues :
 *   - top    (vue de dessus : capot, pare-brise, toit, coffre, 4 portes, 4 jantes)
 *   - sides  (vues latérales gauche/droite simplifiées)
 *   - inside (intérieur : compteur, sièges avant, banquette arrière, coffre)
 *
 * Chaque zone est cliquable et porte un état (ok / defaut / a_verifier / na).
 * Les états sont gérés en frontend (callback onZoneChange) pour ne pas casser
 * la persistance existante (inspection_photos). Le parent peut sérialiser
 * l'état dans inspections.notes (jsonb-friendly) si souhaité.
 */
import { useState } from "react";
import { Camera, MessageSquare } from "lucide-react";

export type ZoneState = "ok" | "defaut" | "a_verifier" | "na";

export interface ZoneStatus {
  state: ZoneState;
  comment?: string;
  photoUrl?: string;
}

export type VehicleView = "top" | "sides" | "inside";

interface Props {
  view: VehicleView;
  zones: Record<string, ZoneStatus>;
  onZoneClick: (zoneId: string, zoneLabel: string) => void;
}

const STATE_FILL: Record<ZoneState, string> = {
  ok: "rgba(16,185,129,0.35)",
  defaut: "rgba(239,68,68,0.55)",
  a_verifier: "rgba(245,158,11,0.45)",
  na: "rgba(148,163,184,0.25)",
};
const STATE_STROKE: Record<ZoneState, string> = {
  ok: "rgb(16,185,129)",
  defaut: "rgb(239,68,68)",
  a_verifier: "rgb(245,158,11)",
  na: "rgb(148,163,184)",
};
const DEFAULT_FILL = "rgba(255,255,255,0.04)";
const DEFAULT_STROKE = "rgba(212,175,55,0.5)";

function Zone({
  id, label, d, zones, onZoneClick, cx, cy,
}: {
  id: string; label: string; d: string;
  zones: Record<string, ZoneStatus>;
  onZoneClick: Props["onZoneClick"];
  cx?: number; cy?: number;
}) {
  const z = zones[id];
  const fill = z ? STATE_FILL[z.state] : DEFAULT_FILL;
  const stroke = z ? STATE_STROKE[z.state] : DEFAULT_STROKE;
  return (
    <g
      onClick={() => onZoneClick(id, label)}
      style={{ cursor: "pointer" }}
      className="transition-opacity hover:opacity-80"
    >
      <path d={d} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      {z?.photoUrl && cx !== undefined && cy !== undefined && (
        <circle cx={cx} cy={cy} r={6} fill="rgb(16,185,129)" stroke="white" strokeWidth={2} />
      )}
    </g>
  );
}

export function VehicleInspectionMap({ view, zones, onZoneClick }: Props) {
  if (view === "top") {
    return (
      <svg viewBox="0 0 300 600" className="w-full h-full">
        {/* Silhouette voiture vue de dessus */}
        <rect x={50} y={20} width={200} height={560} rx={50} fill="rgba(11,16,38,0.4)" stroke={DEFAULT_STROKE} strokeWidth={2} />

        {/* Capot */}
        <Zone id="capot" label="Capot" d="M70 50 L230 50 L225 160 L75 160 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={105} />
        {/* Pare-brise */}
        <Zone id="pare_brise" label="Pare-brise" d="M75 165 L225 165 L220 230 L80 230 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={197} />
        {/* Toit */}
        <Zone id="toit" label="Toit" d="M80 235 L220 235 L220 380 L80 380 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={307} />
        {/* Lunette arrière */}
        <Zone id="lunette" label="Lunette arrière" d="M80 385 L220 385 L225 445 L75 445 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={415} />
        {/* Coffre */}
        <Zone id="coffre_ext" label="Coffre extérieur" d="M75 450 L225 450 L230 555 L70 555 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={500} />

        {/* Portes & jantes (latéral gauche) */}
        <Zone id="porte_av_g" label="Porte avant gauche" d="M30 165 L70 165 L70 300 L30 300 Z" zones={zones} onZoneClick={onZoneClick} cx={50} cy={232} />
        <Zone id="porte_ar_g" label="Porte arrière gauche" d="M30 305 L70 305 L70 440 L30 440 Z" zones={zones} onZoneClick={onZoneClick} cx={50} cy={372} />
        <Zone id="jante_av_g" label="Jante avant gauche" d="M15 110 L45 110 L45 160 L15 160 Z" zones={zones} onZoneClick={onZoneClick} cx={30} cy={135} />
        <Zone id="jante_ar_g" label="Jante arrière gauche" d="M15 445 L45 445 L45 500 L15 500 Z" zones={zones} onZoneClick={onZoneClick} cx={30} cy={472} />

        {/* Portes & jantes (latéral droit) */}
        <Zone id="porte_av_d" label="Porte avant droite" d="M230 165 L270 165 L270 300 L230 300 Z" zones={zones} onZoneClick={onZoneClick} cx={250} cy={232} />
        <Zone id="porte_ar_d" label="Porte arrière droite" d="M230 305 L270 305 L270 440 L230 440 Z" zones={zones} onZoneClick={onZoneClick} cx={250} cy={372} />
        <Zone id="jante_av_d" label="Jante avant droite" d="M255 110 L285 110 L285 160 L255 160 Z" zones={zones} onZoneClick={onZoneClick} cx={270} cy={135} />
        <Zone id="jante_ar_d" label="Jante arrière droite" d="M255 445 L285 445 L285 500 L255 500 Z" zones={zones} onZoneClick={onZoneClick} cx={270} cy={472} />

        {/* Pare-chocs */}
        <Zone id="pare_choc_av" label="Pare-chocs avant" d="M70 30 L230 30 L228 48 L72 48 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={39} />
        <Zone id="pare_choc_ar" label="Pare-chocs arrière" d="M70 560 L230 560 L232 580 L68 580 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={570} />
      </svg>
    );
  }

  if (view === "sides") {
    return (
      <svg viewBox="0 0 600 300" className="w-full h-full">
        {/* Côté gauche */}
        <text x={70} y={20} className="fill-current text-[10px]" fill={DEFAULT_STROKE}>Côté gauche</text>
        <Zone id="cote_g_capot" label="Aile avant gauche" d="M30 100 L120 70 L150 100 L150 150 L30 150 Z" zones={zones} onZoneClick={onZoneClick} cx={90} cy={120} />
        <Zone id="cote_g_porte_av" label="Porte avant gauche" d="M150 70 L240 70 L240 200 L150 200 Z" zones={zones} onZoneClick={onZoneClick} cx={195} cy={135} />
        <Zone id="cote_g_porte_ar" label="Porte arrière gauche" d="M240 70 L320 70 L320 200 L240 200 Z" zones={zones} onZoneClick={onZoneClick} cx={280} cy={135} />
        <Zone id="cote_g_aile_ar" label="Aile arrière gauche" d="M320 70 L350 100 L350 200 L320 200 Z" zones={zones} onZoneClick={onZoneClick} cx={335} cy={150} />
        <Zone id="cote_g_retro" label="Rétroviseur gauche" d="M155 60 L185 50 L195 65 L165 70 Z" zones={zones} onZoneClick={onZoneClick} cx={175} cy={60} />

        {/* Côté droit */}
        <text x={420} y={20} className="fill-current text-[10px]" fill={DEFAULT_STROKE}>Côté droit</text>
        <Zone id="cote_d_capot" label="Aile avant droite" d="M380 100 L470 70 L500 100 L500 150 L380 150 Z" zones={zones} onZoneClick={onZoneClick} cx={440} cy={120} />
        <Zone id="cote_d_porte_av" label="Porte avant droite" d="M500 70 L555 70 L555 200 L500 200 Z" zones={zones} onZoneClick={onZoneClick} cx={527} cy={135} />
      </svg>
    );
  }

  // inside
  return (
    <svg viewBox="0 0 300 600" className="w-full h-full">
      <rect x={30} y={20} width={240} height={560} rx={30} fill="rgba(11,16,38,0.4)" stroke={DEFAULT_STROKE} strokeWidth={2} />
      {/* Tableau de bord */}
      <Zone id="tableau_bord" label="Tableau de bord" d="M40 30 L260 30 L255 110 L45 110 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={70} />
      {/* Compteur */}
      <Zone id="compteur" label="Compteur kilométrique" d="M85 50 L215 50 L210 100 L90 100 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={75} />
      {/* Volant */}
      <Zone id="volant" label="Volant" d="M50 130 L130 130 L130 200 L50 200 Z" zones={zones} onZoneClick={onZoneClick} cx={90} cy={165} />
      {/* Console centrale */}
      <Zone id="console" label="Console centrale" d="M135 130 L165 130 L165 280 L135 280 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={205} />
      {/* Sièges avant */}
      <Zone id="siege_av_g" label="Siège conducteur" d="M50 220 L130 220 L130 350 L50 350 Z" zones={zones} onZoneClick={onZoneClick} cx={90} cy={285} />
      <Zone id="siege_av_d" label="Siège passager" d="M170 130 L250 130 L250 350 L170 350 Z" zones={zones} onZoneClick={onZoneClick} cx={210} cy={240} />
      {/* Banquette arrière */}
      <Zone id="banquette" label="Banquette arrière" d="M40 370 L260 370 L260 480 L40 480 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={425} />
      {/* Coffre intérieur */}
      <Zone id="coffre_int" label="Coffre intérieur" d="M40 490 L260 490 L260 570 L40 570 Z" zones={zones} onZoneClick={onZoneClick} cx={150} cy={530} />
    </svg>
  );
}

/** Modal d'évaluation rapide d'une zone */
export function ZoneEvalModal({
  zoneId, zoneLabel, current, onChange, onClose, onPhoto,
}: {
  zoneId: string;
  zoneLabel: string;
  current?: ZoneStatus;
  onChange: (zoneId: string, status: ZoneStatus) => void;
  onClose: () => void;
  onPhoto: (zoneId: string) => void;
}) {
  const [state, setState] = useState<ZoneState>(current?.state ?? "ok");
  const [comment, setComment] = useState(current?.comment ?? "");
  const [defectTag, setDefectTag] = useState<string | null>(null);

  const defects = ["Rayure", "Choc", "Fissure", "Salissure", "Usure", "Autre"];
  const states: { key: ZoneState; label: string; cls: string }[] = [
    { key: "ok", label: "OK", cls: "bg-emerald-600 text-white" },
    { key: "defaut", label: "Défaut", cls: "bg-red-600 text-white" },
    { key: "a_verifier", label: "À vérifier", cls: "bg-amber-500 text-white" },
    { key: "na", label: "N/A", cls: "bg-slate-400 text-white" },
  ];

  const save = () => {
    const finalComment = defectTag ? `${defectTag}${comment ? ` — ${comment}` : ""}` : comment;
    onChange(zoneId, { state, comment: finalComment || undefined, photoUrl: current?.photoUrl });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 safe-bottom" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-pro-muted">Zone</p>
          <h3 className="font-semibold text-pro-text text-lg">{zoneLabel}</h3>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {states.map(s => (
            <button
              key={s.key}
              onClick={() => setState(s.key)}
              className={`py-2.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                state === s.key ? s.cls : "bg-pro-bg-soft text-pro-text-soft hover:bg-pro-bg-soft/70"
              }`}
            >{s.label}</button>
          ))}
        </div>

        {state === "defaut" && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted mb-1.5">Type de défaut</p>
            <div className="flex flex-wrap gap-1.5">
              {defects.map(d => (
                <button
                  key={d}
                  onClick={() => setDefectTag(defectTag === d ? null : d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    defectTag === d ? "bg-red-600 text-white" : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >{d}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-wider text-pro-muted mb-1.5">Commentaire</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="Optionnel — détails utiles"
            className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        <button
          onClick={() => onPhoto(zoneId)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-pro-bg-soft text-pro-text rounded-xl text-sm font-medium hover:bg-pro-bg-soft/70"
        >
          <Camera size={16} /> {current?.photoUrl ? "Reprendre la photo" : "Prendre une photo"}
        </button>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 bg-pro-bg-soft text-pro-text-soft rounded-xl text-sm font-medium">Annuler</button>
          <button onClick={save} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">Enregistrer</button>
        </div>

        <p className="flex items-center gap-1.5 text-[10px] text-pro-muted pt-1">
          <MessageSquare size={11} /> Les photos sont rattachées automatiquement à cette zone.
        </p>
      </div>
    </div>
  );
}
