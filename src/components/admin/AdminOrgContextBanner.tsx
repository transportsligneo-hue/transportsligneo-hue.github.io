import { Link } from "@tanstack/react-router";
import { Building2, User, Mail, Phone, ExternalLink } from "lucide-react";
import { ClientLogo } from "./ClientLogo";

/**
 * Bandeau contextuel affiché en tête des sous-pages admin qui portent sur
 * une organisation ou un client spécifique (mission, devis, facture...).
 * Rappelle l'identité du compte (logo, nom, type B2B/Flotte/Particulier)
 * et fournit un accès direct à la fiche client.
 */
export type OrgContextKind = "flotte" | "b2b" | "particulier";

export interface AdminOrgContextBannerProps {
  clientId?: string | null;
  name: string;
  kind: OrgContextKind;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  societe?: string | null;
}

const THEME: Record<OrgContextKind, { label: string; bg: string; ring: string; chipBg: string; chipText: string }> = {
  flotte: {
    label: "Flotte partenaire",
    bg: "linear-gradient(120deg,#3b1f78,#5b2ea8 55%,#7c3aed)",
    ring: "rgba(167,139,250,.35)",
    chipBg: "rgba(255,255,255,.16)",
    chipText: "#f5f3ff",
  },
  b2b: {
    label: "B2B Standard",
    bg: "linear-gradient(120deg,#062a9e,#0a3ad1 55%,#2f5fff)",
    ring: "rgba(91,141,255,.35)",
    chipBg: "rgba(255,255,255,.16)",
    chipText: "#eef4ff",
  },
  particulier: {
    label: "Client particulier",
    bg: "linear-gradient(120deg,#0b1338,#111a3d 55%,#1a2555)",
    ring: "rgba(212,175,55,.30)",
    chipBg: "rgba(212,175,55,.18)",
    chipText: "#f7e2a1",
  },
};

export function AdminOrgContextBanner({
  clientId,
  name,
  kind,
  email,
  phone,
  logoUrl,
  societe,
}: AdminOrgContextBannerProps) {
  const t = THEME[kind];
  const isCompany = kind !== "particulier";
  return (
    <section
      className="relative overflow-hidden rounded-2xl border text-white p-4 sm:p-5"
      style={{ background: t.bg, borderColor: t.ring, boxShadow: `0 10px 30px -18px ${t.ring}` }}
      aria-label={`Contexte : ${name}`}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="shrink-0">
          <ClientLogo src={logoUrl ?? null} name={societe || name} isCompany={isCompany} size="lg" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ background: t.chipBg, color: t.chipText, border: "1px solid rgba(255,255,255,.22)" }}
            >
              {isCompany ? <Building2 size={11} /> : <User size={11} />}
              {t.label}
            </span>
            {societe && <span className="text-[11px] font-medium text-white/80 truncate">{societe}</span>}
          </div>
          <h2 className="mt-1.5 text-lg sm:text-xl font-semibold truncate tracking-tight">{name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-white/85">
            {email && (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Mail size={12} className="opacity-80" />
                <span className="truncate">{email}</span>
              </span>
            )}
            {phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={12} className="opacity-80" /> {phone}
              </span>
            )}
          </div>
        </div>
        {clientId && (
          <Link
            to="/admin/clients/$clientId"
            params={{ clientId }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Fiche client <ExternalLink size={12} />
          </Link>
        )}
      </div>
    </section>
  );
}
