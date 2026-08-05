import { useEffect, useState } from "react";
import { Cookie, ShieldCheck } from "lucide-react";
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
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      className="fixed bottom-4 left-4 right-4 z-[9998] mx-auto w-auto max-w-[430px] rounded-2xl border border-white/10 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:left-auto sm:right-5 sm:bottom-5"
      style={{ background: "linear-gradient(160deg,rgba(11,19,56,0.97),rgba(8,14,42,0.97))" }}
    >
      <div className="flex gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2F5FFF]/15 text-[#7aa3ff]">
          <Cookie size={19} />
        </div>
        <div>
          <p className="text-[14px] font-bold text-white">Nous respectons votre vie privée</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#9aa6c9]">
            Nous utilisons des cookies pour assurer le fonctionnement du site, mesurer l'audience et,
            avec votre accord, personnaliser votre expérience.{" "}
            <a href="/confidentialite" className="text-[#7aa3ff] underline underline-offset-2">
              En savoir plus
            </a>
          </p>
        </div>
      </div>

      {showPrefs && (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold text-white">Cookies essentiels</p>
              <p className="text-[11px] text-[#9aa6c9]">Nécessaires au fonctionnement du site</p>
            </div>
            <Switch on disabled />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold text-white">Mesure d'audience</p>
              <p className="text-[11px] text-[#9aa6c9]">Statistiques de visite anonymisées</p>
            </div>
            <Switch on={audience} onToggle={() => setAudience((v) => !v)} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[12.5px] font-semibold text-white">Personnalisation</p>
              <p className="text-[11px] text-[#9aa6c9]">Contenu et suggestions adaptés</p>
            </div>
            <Switch on={perso} onToggle={() => setPerso((v) => !v)} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        {showPrefs ? (
          <button
            type="button"
            onClick={saveCustom}
            className="flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-[12.5px] font-bold text-[#c8d2ec] transition hover:bg-white/[0.1]"
          >
            Enregistrer mes choix
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowPrefs(true)}
            className="flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-[12.5px] font-bold text-[#c8d2ec] transition hover:bg-white/[0.1]"
          >
            Personnaliser
          </button>
        )}
        <button
          type="button"
          onClick={refuseAll}
          className="flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2.5 text-[12.5px] font-bold text-[#c8d2ec] transition hover:bg-white/[0.1]"
        >
          Refuser
        </button>
        <button
          type="button"
          onClick={acceptAll}
          className="flex-1 rounded-xl px-3 py-2.5 text-[12.5px] font-bold text-white shadow-[0_8px_18px_rgba(47,95,255,0.35)]"
          style={{ background: "linear-gradient(120deg,#2F5FFF,#4f8cff)" }}
        >
          Tout accepter
        </button>
      </div>

      <button
        type="button"
        onClick={() => openCookiePreferences()}
        className="mx-auto mt-2.5 flex items-center gap-1.5 text-[11px] text-[#9aa6c9] underline"
      >
        <ShieldCheck size={12} /> Gérer mes cookies
      </button>
    </div>
  );
}
