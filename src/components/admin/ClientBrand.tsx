import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrgLogo } from "@/components/OrgLogo";
import { MissionPvBadges } from "@/components/admin/MissionPvBadges";

export interface ClientBrandInfo {
  societe: string | null;
  logoUrl: string | null;
  contact: string | null;
}

const cache = new Map<string, ClientBrandInfo>();

/** Récupère société + logo des clients à partir de leurs emails (profiles). */
export function useClientBrands(emails: (string | null | undefined)[]) {
  const key = Array.from(
    new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean)),
  ).sort().join("|");
  const [brands, setBrands] = useState<Map<string, ClientBrandInfo>>(new Map(cache));

  useEffect(() => {
    const list = key ? key.split("|") : [];
    const missing = list.filter((e) => !cache.has(e));
    if (missing.length === 0) {
      setBrands(new Map(cache));
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("email, societe, logo_url, nom, prenom")
      .in("email", missing)
      .then(({ data }) => {
        ((data ?? []) as { email: string | null; societe: string | null; logo_url: string | null; nom: string | null; prenom: string | null }[])
          .forEach((p) => {
            const e = (p.email ?? "").trim().toLowerCase();
            if (!e) return;
            cache.set(e, {
              societe: p.societe?.trim() || null,
              logoUrl: p.logo_url ?? null,
              contact: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || null,
            });
          });
        missing.forEach((e) => {
          if (!cache.has(e)) cache.set(e, { societe: null, logoUrl: null, contact: null });
        });
        if (!cancelled) setBrands(new Map(cache));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return brands;
}

export function clientBrandOf(
  brands: Map<string, ClientBrandInfo>,
  email: string | null | undefined,
): ClientBrandInfo | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return null;
  return brands.get(e) ?? null;
}

/** Nettoie « CAT FRANCE (Tours, 37) » → « CAT FRANCE ». */
export function cleanSociete(societe: string | null | undefined) {
  return (societe ?? "").replace(/\s*\(.*?\)\s*$/, "").trim();
}

/**
 * Affiche le client : logo de la société + raison sociale en évidence,
 * et le nom du contact en tout petit dessous.
 */
export function ClientBrand({
  brand,
  fallbackName,
  size = 20,
  className = "",
  inline = false,
  pv = [],
}: {
  brand: ClientBrandInfo | null;
  fallbackName?: string | null;
  size?: number;
  className?: string;
  inline?: boolean;
  /** Plateformes de PV digitalisés actives (moDel, Welcome Auto) */
  pv?: string[];
}) {
  const societe = cleanSociete(brand?.societe);
  const contact = brand?.contact || fallbackName || null;
  const title = societe || fallbackName || "Client non renseigné";

  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <OrgLogo name={title} url={brand?.logoUrl ?? null} size={size} rounded="rounded-md" />
      <span className="inline-flex flex-col leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-pro-text">
          {title}
        </span>
        {contact && societe && (
          <span className="text-[9px] font-medium text-pro-muted">
            Contact : {contact}
          </span>
        )}
      </span>
      <MissionPvBadges plateformes={pv} size={Math.max(14, size - 4)} />
      {inline ? null : null}
    </span>
  );
}
