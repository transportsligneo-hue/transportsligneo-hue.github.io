/**
 * Système de notifications néon unifié.
 * driver → vert néon · client → bleu néon · admin → bleu, vert si l'acteur est un driver/expéditeur.
 */
import { toast } from "sonner";
import type { ReactNode } from "react";
import type { AppRole } from "@/lib/roles";

export type NeonVariant = "driver" | "client" | "admin";
export type NeonActor = "driver" | "client";
export type NeonTone = "green" | "blue";

export function variantFromRole(role: AppRole | string | null | undefined): NeonVariant {
  if (role === "convoyeur") return "driver";
  if (role === "admin" || role === "super_admin") return "admin";
  return "client";
}

const DRIVER_WORDS = /(convoyeur|driver|chauffeur|exp[ée]diteur|accept[ée]e? par|prise en charge|[ée]tat des lieux|edl|en route|trajet d[ée]marr|candidature|disponibilit)/i;

/** Détecte l'acteur concerné d'après un texte (utilisé côté admin). */
export function detectActor(text: string): NeonActor {
  return DRIVER_WORDS.test(text) ? "driver" : "client";
}

export function resolveTone(variant: NeonVariant, actor?: NeonActor, text = ""): NeonTone {
  if (variant === "driver") return "green";
  if (variant === "client") return "blue";
  const a = actor ?? detectActor(text);
  return a === "driver" ? "green" : "blue";
}

export function neonClass(tone: NeonTone) {
  return tone === "green" ? "neon-green" : "neon-blue";
}

export interface ShowToastInput {
  variant: NeonVariant;
  actor?: NeonActor;
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

export function showToast({ variant, actor, title, subtitle, icon, duration = 3500 }: ShowToastInput) {
  const tone = resolveTone(variant, actor, `${title} ${typeof subtitle === "string" ? subtitle : ""}`);
  return toast(title, {
    description: subtitle,
    icon: icon ?? CheckIcon,
    duration,
    className: neonClass(tone),
  });
}
