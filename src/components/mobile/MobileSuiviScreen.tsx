import { useRef, type ReactNode } from "react";
import { CarFront, CheckCircle2, Lock, Search } from "lucide-react";
import { formatSivPlate } from "@/lib/plate-format";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageHero } from "@/components/mobile/MobilePageBits";

const CODE_LEN = 6;

/** Bandeau européen : 12 étoiles jaunes en cercle + F. */
function EuBand() {
  return (
    <span className="eu" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={12 + Math.cos(a) * 8.5} cy={12 + Math.sin(a) * 8.5} r="1.3" fill="#ffd400" />;
        })}
      </svg>
      <b>F</b>
    </span>
  );
}

/** Suivi mobile · plaque avec bandeau européen, code confidentiel en 6 cases. La logique reste dans la route. */
export default function MobileSuiviScreen({
  plaque, setPlaque, code, setCode, onSubmit, loading, error, children,
}: {
  plaque: string;
  setPlaque: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
  children?: ReactNode;
}) {
  const codeRef = useRef<HTMLInputElement>(null);
  const chars = code.padEnd(CODE_LEN, " ").slice(0, CODE_LEN).split("");
  const focusIdx = Math.min(code.length, CODE_LEN - 1);

  return (
    <div className="mh2-root md:hidden">
      <PageHero
        kicker="Suivi de mission"
        title={<>Où est <em>mon véhicule ?</em></>}
        text="Plaque + code reçu par e-mail. Aucune donnée personnelle n'est affichée."
      />

      <form onSubmit={onSubmit} className="mp-panel">
        <label htmlFor="mp-plaque" className="mp-lab"><CarFront />Plaque d'immatriculation</label>
        <div className="mp-plate">
          <EuBand />
          <input
            id="mp-plaque"
            value={plaque}
            onChange={(e) => setPlaque(formatSivPlate(e.target.value))}
            placeholder="AB-123-CD"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <label htmlFor="mp-code" className="mp-lab" style={{ marginTop: 16 }}><Lock />Code confidentiel</label>
        <div className="mp-otp" onClick={() => codeRef.current?.focus()}>
          {chars.map((c, i) => (
            <i key={i} className={i === focusIdx && code.length < CODE_LEN ? "f" : ""}>{c.trim()}</i>
          ))}
          <input
            id="mp-code"
            ref={codeRef}
            value={code}
            maxLength={CODE_LEN}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN))}
            aria-label="Code confidentiel à 6 caractères"
          />
        </div>
        <div className="mp-hint2">6 caractères, indiqués dans votre e-mail de suivi.</div>

        <button type="submit" disabled={loading} className="mh2-cbtn mp-send" style={{ height: 52 }}>
          <Search size={16} /> {loading ? "Recherche…" : "Suivre mon véhicule"}
        </button>
      </form>

      {error && <div className="mp-err" role="alert">{error}</div>}
      {children ? <div className="mp-res mp-panel" style={{ margin: "16px" }}>{children}</div> : null}

      <div className="mp-trust">
        {["Assurance incluse", "Disponible 7j/7", "0 frais caché", "Devis en 2 min"].map((t) => (
          <span key={t}><CheckCircle2 />{t}</span>
        ))}
      </div>
      <MobileFooter />
    </div>
  );
}
