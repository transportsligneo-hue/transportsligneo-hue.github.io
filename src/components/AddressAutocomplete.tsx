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

const GOOGLE_KEY = (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

/** Google Places loader (singleton) */
let googleLoadPromise: Promise<any> | null = null;
function loadGooglePlaces(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if ((window as any).google?.maps?.places) return Promise.resolve((window as any).google);
  if (googleLoadPromise) return googleLoadPromise;
  if (!GOOGLE_KEY) return Promise.reject(new Error("no-key"));

  googleLoadPromise = new Promise((resolve, reject) => {
    const cbName = `__gplaces_cb_${Date.now()}`;
    (window as any)[cbName] = () => resolve((window as any).google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places&callback=${cbName}&language=fr&region=FR`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("script-error"));
    document.head.appendChild(s);
  });
  return googleLoadPromise;
}

export default function AddressAutocomplete({ name, label, value, onChange, required }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sessionTokenRef = useRef<any>(null);

  const fetchFromFrenchApi = useCallback(async (query: string): Promise<Suggestion[]> => {
    const [resAll, resMunicipality, resStreet] = await Promise.all([
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5&autocomplete=1`),
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=3&type=municipality&autocomplete=1`),
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=3&type=street&autocomplete=1`),
    ]);
    const [dataAll, dataMunicipality, dataStreet] = await Promise.all([
      resAll.json(), resMunicipality.json(), resStreet.json(),
    ]);
    const seen = new Set<string>();
    const results: Suggestion[] = [];
    const addResults = (features: any[]) => {
      for (const f of features) {
        const lbl = f.properties.label;
        if (!seen.has(lbl)) {
          seen.add(lbl);
          results.push({ label: lbl, context: f.properties.context });
        }
      }
    };
    addResults(dataAll.features ?? []);
    addResults(dataMunicipality.features ?? []);
    addResults(dataStreet.features ?? []);
    return results.slice(0, 8);
  }, []);

  const fetchFromGoogle = useCallback(async (query: string): Promise<Suggestion[]> => {
    const google = await loadGooglePlaces();
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }
    const service = new google.maps.places.AutocompleteService();
    return await new Promise((resolve) => {
      service.getPlacePredictions(
        {
          input: query,
          sessionToken: sessionTokenRef.current,
          componentRestrictions: { country: ["fr", "be", "lu", "ch", "es", "it", "de", "nl", "pt", "gb"] },
          language: "fr",
        },
        (predictions: any[] | null) => {
          if (!predictions) return resolve([]);
          resolve(
            predictions.slice(0, 8).map((p) => ({
              label: p.description,
              context: p.structured_formatting?.secondary_text ?? "",
            })),
          );
        },
      );
    });
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      let results: Suggestion[] = [];
      if (GOOGLE_KEY) {
        try {
          results = await fetchFromGoogle(query);
        } catch {
          results = await fetchFromFrenchApi(query);
        }
      } else {
        results = await fetchFromFrenchApi(query);
      }
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFromGoogle, fetchFromFrenchApi]);

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
    sessionTokenRef.current = null; // new session after selection
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
              {s.context && <p className="text-cream/40 text-xs mt-0.5">{s.context}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
