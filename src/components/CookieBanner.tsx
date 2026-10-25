import { useEffect, useState } from "react";
import logo from "@/assets/logo-transports-ligneo-officiel.png";
import "@/styles-cookie.css";
import {
  applyConsent,
  getConsent,
  openCookiePreferences,
  OPEN_PREFS_EVENT,
  saveConsent,
} from "@/lib/cookie-consent";

function Switch({
  on,
  disabled,
  onToggle,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
        on ? "bg-[#2F5FFF]" : "bg-white/15"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-all ${
          on ? "left-[20px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [audience, setAudience] = useState(true);
  const [perso, setPerso] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (existing) {
      applyConsent(existing);
      setAudience(existing.audience);
      setPerso(existing.personnalisation);
    } else {
      setVisible(true);
    }
    const openHandler = () => {
      const c = getConsent();
      if (c) {
        setAudience(c.audience);
        setPerso(c.personnalisation);
      }
      setShowPrefs(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_PREFS_EVENT, openHandler);
    return () => window.removeEventListener(OPEN_PREFS_EVENT, openHandler);
  }, []);

  if (!visible) return null;

  const close = () => {
    setVisible(false);
    setShowPrefs(false);
  };

  const acceptAll = () => {
    saveConsent({ audience: true, personnalisation: true });
    close();
  };
  const refuseAll = () => {
    saveConsent({ audience: false, personnalisation: false });
    close();
  };
  const saveCustom = () => {
    saveConsent({ audience, personnalisation: perso });
    close();
  };

  return (
    <div role="dialog" aria-label="Consentement aux cookies" className="ckb cookie-banner-compact">
      <div className="ckb-main">
        <div className="ckb-logo" aria-hidden="true"><img src={logo} alt="" /></div>
        <div className="ckb-txt">
          <p className="ckb-kick"><i />Votre vie privée</p>
          <p className="ckb-title">Nous respectons vos données</p>
          <p className="ckb-desc">
            Cookies utiles au fonctionnement du site, à la mesure d'audience et, avec votre accord, à la personnalisation.{" "}
            <a href="/confidentialite">En savoir plus</a>
          </p>
        </div>
        <div className="ckb-actions">
          {showPrefs ? (
            <button type="button" onClick={saveCustom} className="ckb-btn ckb-ghost">Enregistrer mes choix</button>
          ) : (
            <button type="button" onClick={() => setShowPrefs(true)} className="ckb-btn ckb-ghost">Personnaliser</button>
          )}
          <button type="button" onClick={refuseAll} className="ckb-btn ckb-ghost">Refuser</button>
          <button type="button" onClick={acceptAll} className="ckb-btn ckb-main-btn">Tout accepter</button>
        </div>
      </div>

      {showPrefs && (
        <div className="ckb-prefs">
          <div className="ckb-row">
            <div><b>Cookies essentiels</b><span>Nécessaires au fonctionnement du site</span></div>
            <Switch on disabled />
          </div>
          <div className="ckb-row">
            <div><b>Mesure d'audience</b><span>Statistiques de visite anonymisées</span></div>
            <Switch on={audience} onToggle={() => setAudience((v) => !v)} />
          </div>
          <div className="ckb-row">
            <div><b>Personnalisation</b><span>Contenu et suggestions adaptés</span></div>
            <Switch on={perso} onToggle={() => setPerso((v) => !v)} />
          </div>
        </div>
      )}
    </div>
  );
}
