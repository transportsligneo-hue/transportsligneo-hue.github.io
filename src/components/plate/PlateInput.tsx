import { useId, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { formatSivPlate, plateValidity } from "@/lib/plate-format";
import { HelpTip } from "@/components/ui/HelpTip";

const COUNTRIES = ["F", "B", "D", "E", "I", "L", "NL", "CH", "P", "GB"];

function EuStars() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={12 + Math.cos(a) * 8} cy={12 + Math.sin(a) * 8} r="1.25" fill="#fff" />;
      })}
    </svg>
  );
}

export function PlateBand({ country = "F", size = 44 }: { country?: string; size?: number }) {
  return (
    <span className="plate-band" style={{ width: size }}>
      <EuStars />
      <b>{country}</b>
    </span>
  );
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSearch?: () => void;
  searching?: boolean;
  label?: string;
  help?: string;
  tone?: "violet" | "blue";
  found?: boolean;
  id?: string;
};

export function PlateInput({ value, onChange, onSearch, searching, label = "Immatriculation", help, tone = "blue", found, id }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [foreign, setForeign] = useState(false);
  const [country, setCountry] = useState("F");
  const state = plateValidity(value, foreign);
  return (
    <div className={`plate-field plate-tone-${tone}`}>
      {label !== "" && (
        <div className="plate-label-row">
          <label htmlFor={inputId} className="plate-label">{label}</label>
          {help && <HelpTip title={label} text={help} tone={tone} />}
        </div>
      )}
      <div className="plate-row">
        <div className={`plate-shell plate-${state}`}>
          {foreign ? (
            <span className="plate-band" style={{ width: 44 }}>
              <EuStars />
              <select aria-label="Pays" value={country} onChange={(e) => setCountry(e.target.value)} className="plate-country">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
          ) : <PlateBand />}
          <input
            id={inputId}
            value={value}
            onChange={(e) => onChange(foreign ? e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 14) : formatSivPlate(e.target.value))}
            placeholder="AA-123-BB"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={state === "invalid"}
            aria-describedby={`${inputId}-msg`}
            className="plate-text"
          />
        </div>
        {onSearch && (
          <button type="button" onClick={onSearch} disabled={searching || value.trim().length < 4} className="plate-search">
            {searching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            Rechercher
          </button>
        )}
      </div>
      <div id={`${inputId}-msg`} className="plate-msg" aria-live="polite">
        {state === "valid" && <span className="plate-ok"><Check className="h-4 w-4" /> Format valide</span>}
        {state === "invalid" && !foreign && <span className="plate-err">Format de plaque non reconnu</span>}
        <button type="button" className="plate-foreign" onClick={() => { setForeign((f) => !f); onChange(""); }}>
          {foreign ? "Plaque française" : "Plaque étrangère ou ancienne"}
        </button>
      </div>
      {found && (
        <p className="plate-found">Véhicule trouvé : marque, modèle, VIN, énergie et mise en circulation ont été renseignés.</p>
      )}
    </div>
  );
}
