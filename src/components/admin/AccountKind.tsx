import { useQuery } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccountKind = "particulier" | "b2b" | "flotte" | "inconnu";

export const ACCOUNT_KINDS: { key: AccountKind; label: string; desc: string; color: string }[] = [
  { key: "particulier", label: "Particulier", desc: "Client individuel, réservation à l'unité, paiement en ligne.", color: "#2f5fff" },
  { key: "b2b", label: "Professionnel B2B", desc: "Concession, loueur, agence : missions à l'unité ou en petit volume, carte bancaire par défaut.", color: "#0891b2" },
  { key: "flotte", label: "Flotte / Grand compte", desc: "Multi-sites, parc de véhicules, missions groupées, facture à 15 / 30 jours.", color: "#7c5cff" },
  { key: "inconnu", label: "Non identifié", desc: "Demande sans compte rattaché.", color: "#a3a4ac" },
];

/** Charge une fois la correspondance email → type de compte (profils clients). */
export function useAccountKindResolver() {
  const { data } = useQuery({
    queryKey: ["admin-account-kinds"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, AccountKind>();
      const { data: rows } = await supabase.from("profiles").select("email, type_client").limit(5000);
      for (const r of (rows ?? []) as { email: string | null; type_client: string | null }[]) {
        if (!r.email) continue;
        const t = r.type_client === "flotte" ? "flotte" : r.type_client === "b2b" ? "b2b" : "particulier";
        map.set(r.email.trim().toLowerCase(), t);
      }
      return map;
    },
  });
  return (email?: string | null, fallback?: string | null): AccountKind => {
    const k = email ? data?.get(email.trim().toLowerCase()) : undefined;
    if (k) return k;
    if (fallback === "flotte") return "flotte";
    if (fallback === "b2b" || fallback === "pro") return "b2b";
    if (fallback === "particulier") return "particulier";
    return "inconnu";
  };
}

export const kindClass = (k: AccountKind) => `kind-${k}`;

/** Bouton « ? » : légende des couleurs par type de compte. */
export function AccountKindLegend() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Légende des couleurs par type de compte"
        title="Légende des couleurs"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#dedee4] bg-white text-[#2f5fff] shadow-sm hover:bg-[#eaf0ff]"
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[300px] rounded-2xl border border-[#eaeaee] bg-white p-4 text-left shadow-[0_18px_40px_rgba(20,22,28,0.16)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a3a4ac]">Barre colorée = type de compte</p>
          <ul className="space-y-3">
            {ACCOUNT_KINDS.map((k) => (
              <li key={k.key} className="flex items-start gap-3">
                <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full" style={{ background: k.color }} />
                <span>
                  <span className="block text-[13px] font-semibold text-[#14161c]">{k.label}</span>
                  <span className="block text-[12px] leading-snug text-[#70727d]">{k.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}
