import { useState } from "react";
import {
  CarFront, ShieldCheck, Copy, Check, Palette, Gauge, Calendar,
  Phone, MapPin, Info, Navigation, ArrowUpRight,
  Navigation as NavIcon, ClipboardCheck, Package, Send, Search, Flag,
} from "lucide-react";

export interface V3TimelineStep {
  label: string;
  state: "done" | "current" | "todo";
  icon?: "nav" | "clip" | "search" | "package" | "pin" | "shield" | "send" | "flag";
}

interface Props {
  vehicule: {
    marque?: string | null;
    modele?: string | null;
    immatriculation?: string | null;
    vin?: string | null;
    energie?: string | null;
    type?: string | null;
    couleur?: string | null;
    km?: number | string | null;
    annee?: number | string | null;
  };
  client: {
    nom?: string | null;
    telephone?: string | null;
    type?: string | null; // "PARTICULIER" / "PRO"
  };
  depart: { ville: string; adresse?: string };
  arrivee: { ville: string; adresse?: string };
  instructions?: string | null;
  contactDepartTel?: string | null;
  contactArriveeTel?: string | null;
  gpsTarget?: string | null;
  timeline: V3TimelineStep[];
  currentIndex: number; // 1-based
  totalSteps: number;
  progressPct: number;
}

function initials(name?: string | null) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function IconFor({ kind }: { kind?: V3TimelineStep["icon"] }) {
  const cls = { size: 16, strokeWidth: 2.2 };
  switch (kind) {
    case "nav": return <NavIcon {...cls} />;
    case "clip": return <ClipboardCheck {...cls} />;
    case "search": return <Search {...cls} />;
    case "package": return <Package {...cls} />;
    case "pin": return <MapPin {...cls} />;
    case "shield": return <ShieldCheck {...cls} />;
    case "send": return <Send {...cls} />;
    case "flag": return <Flag {...cls} />;
    default: return <NavIcon {...cls} />;
  }
}

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
      className="v3-copy-btn"
      aria-label="Copier"
    >
      {ok ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export function MissionV3InfoPane({
  vehicule, client, depart, arrivee, instructions,
  contactDepartTel, contactArriveeTel, gpsTarget,
  timeline, currentIndex, totalSteps, progressPct,
}: Props) {
  const ring = 96;
  const stroke = 7;
  const r = (ring - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gpsHref = gpsTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(gpsTarget)}`
    : "#";

  const vehiculeTitle = [vehicule.marque, vehicule.modele].filter(Boolean).join(" ") || "Véhicule";

  return (
    <div className="v3-info-root">
      <style>{`
        .v3-info-root { display: flex; flex-direction: column; gap: 14px; }

        .v3-card { position: relative; background: linear-gradient(155deg, rgba(20,32,72,0.55), rgba(10,18,48,0.55));
          border: 1px solid rgba(120,180,255,0.14); border-radius: 22px; padding: 18px; overflow: hidden; }
        .v3-card::before { content:""; position: absolute; top:-40%; right:-30%; width:80%; height:120%;
          background: radial-gradient(closest-side, rgba(47,216,255,0.10), transparent 70%); pointer-events:none; }

        .v3-head-row { display: flex; align-items: center; justify-content: space-between; position: relative; z-index:1; }
        .v3-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800;
          letter-spacing: .8px; color: #9098AE; text-transform: uppercase; }
        .v3-badge-verif { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700;
          color: #34E8B0; background: rgba(52,232,176,0.10); border: 1px solid rgba(52,232,176,0.32);
          padding: 5px 11px; border-radius: 999px; }

        .v3-veh-title { font-size: 26px; font-weight: 800; margin-top: 12px; letter-spacing: -0.5px;
          background: linear-gradient(90deg,#EAF3FF,#B9D7FF); -webkit-background-clip: text; background-clip: text; color: transparent; position: relative; z-index:1; }

        .v3-chip-row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; position: relative; z-index:1; }
        .v3-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
          color: #C7CCDA; background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.16);
          padding: 8px 12px; border-radius: 999px; }
        .v3-chip.eco { color: #34E8B0; background: rgba(52,232,176,0.08); border-color: rgba(52,232,176,0.32); }

        .v3-field { margin-top: 12px; padding: 12px 14px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(120,180,255,0.14); border-radius: 14px; position: relative; z-index:1;
          display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .v3-field-lbl { font-size: 10.5px; font-weight: 800; color: #7C93C2; letter-spacing: .8px; text-transform: uppercase; }
        .v3-field-val { font-size: 16px; font-weight: 700; color: #EAF3FF; font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 1px; margin-top: 3px; }
        .v3-copy-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.18);
          color: #9098AE; width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .v3-copy-btn:hover { color: #EAF3FF; background: rgba(255,255,255,0.08); }

        .v3-veh-foot { display: flex; align-items: center; gap: 14px; margin-top: 14px; font-size: 12.5px; color: #9098AE; position: relative; z-index:1; }
        .v3-veh-foot > span { display: inline-flex; align-items: center; gap: 6px; }
        .v3-veh-foot .sep { width: 1px; height: 12px; background: rgba(120,180,255,0.2); }

        /* Client card */
        .v3-client-head { display: flex; align-items: center; gap: 12px; position: relative; z-index:1; }
        .v3-avatar { width: 54px; height: 54px; border-radius: 16px;
          background: linear-gradient(135deg,#2F6BFF,#2FD8FF); color: #06070C;
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;
          box-shadow: 0 8px 20px rgba(47,107,255,0.35); }
        .v3-client-name { font-size: 17px; font-weight: 800; color: #EAF3FF; }
        .v3-client-type { display: inline-flex; margin-top: 4px; font-size: 10.5px; font-weight: 800; letter-spacing: .5px;
          color: #9098AE; background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.16);
          padding: 3px 10px; border-radius: 999px; text-transform: uppercase; }

        .v3-phone { margin-top: 14px; display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          border-radius: 14px; background: rgba(47,216,255,0.05); border: 1px solid rgba(47,216,255,0.28);
          color: #EAF3FF; font-size: 15px; font-weight: 700; text-decoration: none; position: relative; z-index:1; }
        .v3-phone svg { color: #2FD8FF; }

        .v3-route { margin-top: 14px; position: relative; z-index:1; }
        .v3-route-row { display: flex; gap: 12px; align-items: flex-start; }
        .v3-route-dot { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; }
        .v3-route-dot.dep { background: rgba(47,107,255,0.18); color: #6A9BFF; border: 1px solid rgba(47,107,255,0.35); }
        .v3-route-dot.arr { background: rgba(255,158,68,0.14); color: #F0A554; border: 1px solid rgba(255,158,68,0.35); }
        .v3-route-connector { width: 34px; display: flex; justify-content: center; }
        .v3-route-connector span { width: 1.5px; height: 14px; background: repeating-linear-gradient(to bottom, rgba(120,180,255,0.3) 0 3px, transparent 3px 6px); }
        .v3-route-lbl { font-size: 10.5px; font-weight: 800; color: #7C93C2; letter-spacing: .7px; text-transform: uppercase; }
        .v3-route-addr { font-size: 14px; font-weight: 700; color: #EAF3FF; margin-top: 3px; }

        .v3-instructions { margin-top: 14px; display: flex; gap: 10px; align-items: flex-start;
          padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(120,180,255,0.14); position: relative; z-index:1; }
        .v3-instructions svg { color: #2FD8FF; margin-top: 2px; flex-shrink: 0; }
        .v3-instructions p { font-size: 12.5px; color: #C7CCDA; line-height: 1.5; margin: 0; }

        /* Quick grid */
        .v3-quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .v3-quick { display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; padding: 18px 8px; border-radius: 18px; text-align: center; text-decoration: none;
          color: #EAF3FF; font-size: 12px; font-weight: 700; min-height: 108px; position: relative; overflow: hidden;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(120,180,255,0.14); }
        .v3-quick.primary { background: linear-gradient(140deg,#2F6BFF,#2FD8FF); color: #06070C;
          border: none; box-shadow: 0 10px 26px rgba(47,107,255,0.35); }
        .v3-quick.primary .v3-quick-corner { color: #06070C; }
        .v3-quick-corner { position: absolute; top: 10px; right: 10px; color: #9098AE; }
        .v3-quick svg.big { }

        /* Timeline */
        .v3-tl-head { display: flex; align-items: center; justify-content: space-between; }
        .v3-tl-title { font-size: 15px; font-weight: 800; color: #EAF3FF; }
        .v3-tl-sub { font-size: 12px; color: #9098AE; margin-top: 3px; }
        .v3-tl-ring { position: relative; width: 96px; height: 96px; flex-shrink: 0; }
        .v3-tl-ring-pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-size: 17px; font-weight: 800; color: #EAF3FF; }

        .v3-tl-list { margin-top: 18px; position: relative; padding-left: 8px; }
        .v3-tl-line { position: absolute; left: 25px; top: 22px; bottom: 22px; width: 2px;
          background: linear-gradient(to bottom, rgba(47,216,255,0.4) 0%, rgba(120,180,255,0.10) 100%); }
        .v3-tl-item { display: flex; gap: 14px; align-items: flex-start; padding: 8px 0 18px; position: relative; }
        .v3-tl-item:last-child { padding-bottom: 0; }
        .v3-tl-dot { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; display: flex;
          align-items: center; justify-content: center; background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(120,180,255,0.20); color: #6A78A0; z-index: 1; }
        .v3-tl-dot.done { background: rgba(52,232,176,0.15); border-color: rgba(52,232,176,0.5); color: #34E8B0; }
        .v3-tl-dot.current { background: linear-gradient(135deg,#2F6BFF,#2FD8FF); border-color: transparent;
          color: #06070C; box-shadow: 0 0 0 5px rgba(47,216,255,0.18), 0 8px 24px rgba(47,107,255,0.4); }
        .v3-tl-body { padding-top: 6px; }
        .v3-tl-lbl { font-size: 14px; font-weight: 700; color: #EAF3FF; }
        .v3-tl-lbl.todo { color: #7C859C; }
        .v3-tl-pill { display: inline-flex; margin-top: 4px; font-size: 10px; font-weight: 800; letter-spacing: .5px;
          padding: 3px 9px; border-radius: 999px; text-transform: uppercase;
          background: rgba(255,255,255,0.04); color: #6A78A0; border: 1px solid rgba(120,180,255,0.14); }
        .v3-tl-pill.done { background: rgba(52,232,176,0.10); color: #34E8B0; border-color: rgba(52,232,176,0.32); }
        .v3-tl-pill.current { background: rgba(47,216,255,0.10); color: #2FD8FF; border-color: rgba(47,216,255,0.35); }
      `}</style>

      {/* Véhicule */}
      <div className="v3-card">
        <div className="v3-head-row">
          <span className="v3-eyebrow"><CarFront size={14} /> Véhicule</span>
          <span className="v3-badge-verif"><ShieldCheck size={13} /> Vérifié</span>
        </div>
        <div className="v3-veh-title">{vehiculeTitle}</div>
        <div className="v3-chip-row">
          {vehicule.energie && (
            <span className={`v3-chip ${/[eé]lect/i.test(vehicule.energie) ? "eco" : ""}`}>
              {/[eé]lect/i.test(vehicule.energie) && "⚡ "}
              {vehicule.energie}
            </span>
          )}
          {vehicule.type && <span className="v3-chip">{vehicule.type}</span>}
          {vehicule.annee && <span className="v3-chip"><Calendar size={12} /> {vehicule.annee}</span>}
        </div>

        <div className="v3-field">
          <div style={{ minWidth: 0 }}>
            <div className="v3-field-lbl">Plaque d'immatriculation</div>
            <div className="v3-field-val" style={{ opacity: vehicule.immatriculation ? 1 : 0.45 }}>
              {vehicule.immatriculation || "Non renseignée"}
            </div>
          </div>
          {vehicule.immatriculation && <CopyBtn value={vehicule.immatriculation} />}
        </div>

        <div className="v3-field">
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div className="v3-field-lbl">Numéro VIN</div>
            <div
              className="v3-field-val"
              style={{ overflow: "hidden", textOverflow: "ellipsis", opacity: vehicule.vin ? 1 : 0.45 }}
            >
              {vehicule.vin || "Non renseigné"}
            </div>
          </div>
          {vehicule.vin && <CopyBtn value={vehicule.vin} />}
        </div>

        {(vehicule.couleur || vehicule.km) && (
          <div className="v3-veh-foot">
            {vehicule.couleur && <span><Palette size={14} /> {vehicule.couleur}</span>}
            {vehicule.couleur && vehicule.km && <span className="sep" />}
            {vehicule.km && <span><Gauge size={14} /> {typeof vehicule.km === "number" ? vehicule.km.toLocaleString("fr-FR") : vehicule.km} km</span>}
          </div>
        )}
      </div>

      {/* Client / Route */}
      <div className="v3-card">
        <div className="v3-client-head">
          <div className="v3-avatar">{initials(client.nom)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="v3-client-name">{client.nom ?? "Contact mission"}</div>
            <div className="v3-client-type">{client.type ?? "Particulier"}</div>
          </div>
        </div>

        {client.telephone && (
          <a href={`tel:${client.telephone}`} className="v3-phone">
            <Phone size={16} strokeWidth={2.2} />
            {client.telephone}
          </a>
        )}

        <div className="v3-route">
          <div className="v3-route-row">
            <div className="v3-route-dot dep"><MapPin size={16} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="v3-route-lbl">Enlèvement</div>
              <div className="v3-route-addr">{depart.adresse ? `${depart.adresse}, ${depart.ville}` : depart.ville}</div>
            </div>
          </div>
          <div className="v3-route-connector"><span /></div>
          <div className="v3-route-row">
            <div className="v3-route-dot arr"><MapPin size={16} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="v3-route-lbl">Livraison</div>
              <div className="v3-route-addr">{arrivee.adresse ? `${arrivee.adresse}, ${arrivee.ville}` : arrivee.ville}</div>
            </div>
          </div>
        </div>

        {instructions && (
          <div className="v3-instructions">
            <Info size={16} strokeWidth={2.2} />
            <p>{instructions}</p>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="v3-quick-grid">
        <a href={gpsHref} target="_blank" rel="noreferrer" className="v3-quick primary">
          <ArrowUpRight size={14} className="v3-quick-corner" />
          <Navigation size={26} strokeWidth={2.2} />
          Ouvrir GPS
        </a>
        <a href={contactDepartTel ? `tel:${contactDepartTel}` : "#"} className="v3-quick" aria-disabled={!contactDepartTel}>
          <Phone size={26} strokeWidth={2.2} />
          Appeler<br />enlèvement
        </a>
        <a href={contactArriveeTel ? `tel:${contactArriveeTel}` : "#"} className="v3-quick" aria-disabled={!contactArriveeTel}>
          <Phone size={26} strokeWidth={2.2} />
          Appeler<br />livraison
        </a>
      </div>

      {/* Timeline */}
      <div className="v3-card">
        <div className="v3-head-row">
          <div>
            <div className="v3-tl-title">Avancement</div>
            <div className="v3-tl-sub">Étape {currentIndex} sur {totalSteps}</div>
          </div>
          <div className="v3-tl-ring">
            <svg width={ring} height={ring}>
              <circle cx={ring/2} cy={ring/2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
              <circle cx={ring/2} cy={ring/2} r={r} stroke="url(#v3TlGrad)" strokeWidth={stroke} fill="none"
                strokeDasharray={c} strokeDashoffset={c - (progressPct/100) * c} strokeLinecap="round"
                transform={`rotate(-90 ${ring/2} ${ring/2})`} />
              <defs>
                <linearGradient id="v3TlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2F6BFF" />
                  <stop offset="100%" stopColor="#2FD8FF" />
                </linearGradient>
              </defs>
            </svg>
            <div className="v3-tl-ring-pct">{progressPct}%</div>
          </div>
        </div>

        <div className="v3-tl-list">
          <div className="v3-tl-line" />
          {timeline.map((step, i) => (
            <div key={i} className="v3-tl-item">
              <div className={`v3-tl-dot ${step.state}`}>
                <IconFor kind={step.icon} />
              </div>
              <div className="v3-tl-body">
                <div className={`v3-tl-lbl ${step.state === "todo" ? "todo" : ""}`}>{step.label}</div>
                <div className={`v3-tl-pill ${step.state}`}>
                  {step.state === "done" ? "Terminée" : step.state === "current" ? "En cours" : "À venir"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
