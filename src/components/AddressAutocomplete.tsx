import { useState, useRef, useEffect, useCallback } from "react";

interface AddressAutocompleteProps {
  name: string;
  label: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
}

interface Suggestion {
  label: string;
  context: string;
}

export default function AddressAutocomplete({ name, label, value, onChange, required }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&type=housenumber&autocomplete=1`
      );
      const data = await res.json();
      const results: Suggestion[] = data.features?.map((f: any) => ({
        label: f.properties.label,
        context: f.properties.context,
      })) ?? [];

      if (results.length < 4) {
        const res2 = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5&type=municipality&autocomplete=1`
        );
        const data2 = await res2.json();
        const cities: Suggestion[] = data2.features?.map((f: any) => ({
          label: f.properties.label,
          context: f.properties.context,
        })) ?? [];
        const existingLabels = new Set(results.map(r => r.label));
        cities.forEach(c => {
          if (!existingLabels.has(c.label)) results.push(c);
        });
      }

      setSuggestions(results.slice(0, 6));
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(name, val);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(name, suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative sm:col-span-2">
      <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        required={required}
        autoComplete="off"
        className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
        placeholder="Commencez à taper une adresse..."
      />
      {loading && (
        <div className="absolute right-3 top-[38px]">
          <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[#0d1a2e] border border-primary/30 rounded shadow-xl max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSelect(s)}
              className="px-4 py-3 cursor-pointer hover:bg-primary/10 transition-colors border-b border-primary/10 last:border-0"
            >
              <p className="text-cream text-sm">{s.label}</p>
              <p className="text-cream/40 text-xs mt-0.5">{s.context}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
