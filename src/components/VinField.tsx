import { useMemo } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { normalizeVin, validateVin } from "@/lib/vin";

interface VinFieldProps {
  value: string;
  onChange: (v: string) => void;
  /** VIN bloquant (admin, formulaires flotte). */
  required?: boolean;
  className?: string;
  placeholder?: string;
  /** Affiche l'état de validation sous le champ. */
  showStatus?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Champ VIN unique et réutilisable (estimateur public, dashboards, admin).
 * Normalise la saisie et affiche la validation de format en temps réel.
 */
export function VinField({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "VF3XXXXXXXXXXXXXX",
  showStatus = true,
  id,
  disabled,
}: VinFieldProps) {
  const check = useMemo(() => validateVin(value, required), [value, required]);
  const touched = normalizeVin(value).length > 0;

  return (
    <div className="space-y-1">
      <input
        id={id}
        value={value}
        disabled={disabled}
        maxLength={17}
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={touched && !check.valid}
        onChange={(e) => onChange(normalizeVin(e.target.value))}
        placeholder={placeholder}
        className={`${className} uppercase tracking-widest`}
      />
      {showStatus && touched && (
        <p
          className={`text-[11px] flex items-center gap-1 ${
            !check.valid ? "text-red-500" : check.warning ? "text-amber-500" : "text-emerald-500"
          }`}
        >
          {!check.valid ? <AlertTriangle size={12} /> : check.warning ? <AlertTriangle size={12} /> : <Check size={12} />}
          {check.error ?? check.warning ?? "VIN valide"}
        </p>
      )}
      {showStatus && !touched && required && (
        <p className="text-[11px] text-red-500 flex items-center gap-1">
          <AlertTriangle size={12} /> VIN obligatoire (17 caractères)
        </p>
      )}
    </div>
  );
}

export default VinField;
