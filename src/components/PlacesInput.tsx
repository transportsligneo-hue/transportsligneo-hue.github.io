import { useEffect, useRef, useState } from "react";
import {
  getAutocompleteSuggestions,
  isGoogleAvailable,
  loadGoogle,
  resetPlacesSession,
  type PlaceSuggestion,
} from "@/lib/google-places";

interface PlacesInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void;
  placeholder?: string;
  className?: string;
  dropdownClassName?: string;
  fallbackOptions?: string[];
  autoFocus?: boolean;
  required?: boolean;
  inputId?: string;
}

/**
 * Champ d'adresse avec autocomplete Google Places + fallback :
 * - tape librement (saisie manuelle toujours valide)
 * - propose des suggestions Google si la clé est dispo
 * - sinon, filtre la liste fallbackOptions (villes connues)
 * - le design est piloté par className / dropdownClassName du parent
 */
export default function PlacesInput({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  dropdownClassName,
  fallbackOptions,
  autoFocus,
  required,
  inputId,
}: PlacesInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Précharge Google dès qu'on monte (silencieux si pas de clé)
  useEffect(() => {
    if (isGoogleAvailable()) loadGoogle().catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOut);
    return () => document.removeEventListener("mousedown", onClickOut);
  }, []);

  const runSearch = (val: string) => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!val || val.length < 2) {
        setSuggestions([]);
        return;
      }
      let results: PlaceSuggestion[] = [];
      if (isGoogleAvailable()) {
        results = await getAutocompleteSuggestions(val);
      }
      if (results.length === 0 && fallbackOptions && fallbackOptions.length > 0) {
        const q = val.toLowerCase();
        results = fallbackOptions
          .filter((o) => o.toLowerCase().includes(q))
          .slice(0, 8)
          .map((label) => ({ label }));
      }
      setSuggestions(results);
    }, 220);
  };

  const handleChange = (val: string) => {
    onChange(val);
    setOpen(true);
    runSearch(val);
  };

  const select = (s: PlaceSuggestion) => {
    onChange(s.label);
    onSelect?.(s.label);
    setSuggestions([]);
    setOpen(false);
    resetPlacesSession();
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (value.length >= 2) {
            runSearch(value);
            setOpen(true);
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
      />
      {open && suggestions.length > 0 && (
        <div
          className={
            dropdownClassName ||
            "absolute z-40 left-0 right-0 top-full mt-1 bg-[#0b1026] border border-[#5fb6ff]/25 rounded-xl max-h-64 overflow-y-auto shadow-2xl"
          }
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.placeId ?? s.label}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
              className="w-full text-left px-4 py-3 text-sm font-semibold text-[#4d8dff] hover:bg-[#4d8dff]/12 hover:text-[#7db1ff] border-b border-[#4d8dff]/15 last:border-0 transition-colors"
            >
              <p className="truncate">{s.label}</p>
              {s.secondary && <p className="text-[11px] font-normal text-[#4d8dff]/65 truncate">{s.secondary}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
