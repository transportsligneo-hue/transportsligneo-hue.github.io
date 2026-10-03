/**
 * Système de notifications néon unifié.
 * Driver → vert · particulier → bleu · professionnel/flotte → violet.
 */
import { toast } from "sonner";
import type { ReactNode } from "react";
import type { AppRole } from "@/lib/roles";

export type NeonVariant = "driver" | "client" | "admin";
export type NeonActor = "driver" | "client" | "pro";
export type NeonTone = "green" | "blue" | "violet";

export function variantFromRole(role: AppRole | string | null | undefined): NeonVariant {
  if (role === "convoyeur") return "driver";
  if (role === "admin" || role === "super_admin") return "admin";
  return "client";
}

const DRIVER_WORDS = /(convoyeur|driver|chauffeur|exp[ée]diteur|accept[ée]e? par|prise en charge|[ée]tat des lieux|edl|en route|trajet d[ée]marr|candidature|disponibilit)/i;
const PRO_WORDS = /(flotte|gestionnaire|professionnel|\bpro\b|\bb2b\b|entreprise|soci[ée]t[ée]|concessionnaire|loueur|parc automobile|groupe cat|cat france)/i;

/** Détecte l'acteur concerné d'après un texte (utilisé côté admin). */
export function detectActor(text: string): NeonActor {
  if (DRIVER_WORDS.test(text)) return "driver";
  return PRO_WORDS.test(text) ? "pro" : "client";
}

export function resolveTone(variant: NeonVariant, actor?: NeonActor, text = "", clientType?: string | null): NeonTone {
  if (variant === "driver") return "green";
  if (variant === "client") return clientType === "flotte" || clientType === "b2b" ? "violet" : "blue";
  const a = actor ?? detectActor(text);
  return a === "driver" ? "green" : a === "pro" ? "violet" : "blue";
}

export function neonClass(tone: NeonTone) {
  return `neon-${tone}`;
}

export interface ShowToastInput {
  variant: NeonVariant;
  actor?: NeonActor;
  clientType?: "particulier" | "b2b" | "flotte" | null;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  duration?: number;
}

const CheckIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function showToast({ variant, actor, clientType, title, subtitle, icon, duration = 3500 }: ShowToastInput) {
  const tone = resolveTone(variant, actor, `${title} ${typeof subtitle === "string" ? subtitle : ""}`, clientType);
  return toast(title, {
    description: subtitle,
    icon: icon ?? CheckIcon,
    duration,
    className: neonClass(tone),
  });
}
