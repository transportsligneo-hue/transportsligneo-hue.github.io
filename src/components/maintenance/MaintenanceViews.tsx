import { Clock, MessageCircle, Mail, Phone } from "lucide-react";
import { formatReturn, type MaintenanceSettings } from "@/lib/maintenance";
import "./maintenance.css";

const LOGO = "/icons/icon-192.png";
const LOGO_DRIVER = "/icons/logo-driver-app.png";

type Variant = "site" | "driver";

/** Bandeau voyant affiché en haut du site ou de l'application Driver. */
export function MaintenanceBanner({ s, variant, onClose, preview }: { s: MaintenanceSettings; variant: Variant; onClose?: () => void; preview?: boolean }) {
  const ret = formatReturn(s.return_at);
  return (
    <div className={`mtn-bn mtn-bn--${variant}${preview ? " is-preview" : ""}`} role="status" aria-live="polite">
      <span className="mtn-bn-logo"><img src={variant === "driver" ? LOGO_DRIVER : LOGO} alt={variant === "driver" ? "Ligneo Driver" : "Transports Ligneo"} /></span>
      <div className="mtn-bn-tx">
        <span className="mtn-tag"><i /> Maintenance</span>
        <h4>{s.title}</h4>
        {s.reason && <p>{s.reason}{variant === "driver" && ret ? ` Retour prévu : ${ret}.` : ""}</p>}
      </div>
      {variant === "site" && ret && (
        <div className="mtn-bn-ret">
          <Clock size={22} aria-hidden="true" />
          <div><small>Retour prévu</small><b>{ret}</b></div>
        </div>
      )}
      {onClose && <button type="button" className="mtn-bn-x" aria-label="Fermer le bandeau" onClick={onClose}>×</button>}
      <div className="mtn-bn-ld" aria-hidden="true"><span /></div>
    </div>
  );
}

function openChat() {
  window.dispatchEvent(new Event("ligneo:assistant-open"));
}

/** Écran de maintenance complète (remplace le contenu des pages pour les visiteurs). */
export function MaintenanceScreen({ s, variant, preview }: { s: MaintenanceSettings; variant: Variant; preview?: boolean }) {
  const ret = formatReturn(s.return_at);
  const words = s.title.split(" ");
  const last = words.pop() ?? "";
  const head = words.join(" ");
  if (variant === "driver") {
    return (
      <main className={`mtn-dv${preview ? " is-preview" : ""}`}>
        <div className="mtn-dv-card">
          <img src={LOGO_DRIVER} alt="Ligneo Driver" />
          <div><span className="mtn-dv-kk"><i /> Maintenance</span></div>
          <h1>{head} <b>{last}</b></h1>
          {s.reason && <div className="mtn-dv-why"><small>Pourquoi ?</small>{s.reason}</div>}
          <div className="mtn-dv-br"><span /></div>
          <p className="mtn-dv-rt">{ret ? <>Retour prévu le <b>{ret}</b></> : "Nous revenons très vite."}</p>
          <a className="mtn-dv-btn" href="mailto:contact@transportsligneo.fr"><MessageCircle size={18} aria-hidden="true" />Écrire à Ligneo</a>
        </div>
      </main>
    );
  }
  return (
    <main className={`mtn-fl${preview ? " is-preview" : ""}`}>
      <div className="mtn-fl-card">
        <img className="mtn-fl-logo" src={LOGO} alt="Transports Ligneo" />
        <div><span className="mtn-fl-kick"><i /> Maintenance</span></div>
        <h1>{head} <b>{last}</b></h1>
        {s.reason && <div className="mtn-fl-why"><small>Pourquoi ?</small>{s.reason}</div>}
        <div className="mtn-fl-bar"><span /></div>
        <p className="mtn-fl-ret">{ret ? <>Retour prévu le <b>{ret}</b></> : "Nous revenons très vite."}</p>
        <button type="button" className="mtn-fl-chat" onClick={openChat}><MessageCircle size={20} aria-hidden="true" />Discuter avec nous</button>
        <p className="mtn-fl-note">Notre assistant et notre équipe restent disponibles sur le chat.</p>
        <div className="mtn-fl-ct">
          <a href="mailto:contact@transportsligneo.fr"><Mail size={16} aria-hidden="true" />contact@transportsligneo.fr</a>
          <a href="tel:+33782456181"><Phone size={16} aria-hidden="true" />07 82 45 61 81</a>
        </div>
      </div>
    </main>
  );
}

