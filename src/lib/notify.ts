/**
 * Helper unifié de notifications in-app — surcouche sonner avec 10 types premium
 * (info, success, warning, error + 6 métiers Transports Ligneo).
 *
 * Rétrocompatible : `toast.*` continue de fonctionner tel quel. Ce helper ajoute
 * uniquement une couche typée + effets natifs (vibration douce, son opt-in).
 */
import { toast, type ExternalToast } from "sonner";
import React, { type ReactNode } from "react";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Truck,
  FileText,
  CreditCard,
  Star,
  BellRing,
  type LucideIcon,
} from "lucide-react";

export type NotifyType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "mission"
  | "convoyage"
  | "document"
  | "paiement"
  | "avis"
  | "rappel";

export interface NotifyOptions {
  description?: ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  duration?: number;
  id?: string | number;
  priority?: "normal" | "urgent";
}

const ICONS: Record<NotifyType, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  mission: Sparkles,
  convoyage: Truck,
  document: FileText,
  paiement: CreditCard,
  avis: Star,
  rappel: BellRing,
};

/** Types déclenchant une vibration légère sur mobile (silencieux desktop). */
const VIBRATION_TYPES: NotifyType[] = ["warning", "error", "mission", "rappel"];

function isCoarsePointer() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}

function triggerVibration(type: NotifyType, priority?: "normal" | "urgent") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!isCoarsePointer()) return;
  if (priority === "urgent") {
    navigator.vibrate([20, 40, 20]);
    return;
  }
  if (VIBRATION_TYPES.includes(type)) navigator.vibrate([15]);
}

function triggerSound() {
  // Opt-in explicite via localStorage.setItem('notify_sound', '1').
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("notify_sound") !== "1") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    /* silencieux */
  }
}

function toExternal(opts?: NotifyOptions): ExternalToast {
  const ext: ExternalToast = {
    description: opts?.description,
    duration: opts?.duration ?? (opts?.priority === "urgent" ? 8000 : 5000),
    id: opts?.id,
  };
  if (opts?.action) {
    ext.action = opts.action.href
      ? {
          label: opts.action.label,
          onClick: () => {
            if (typeof window !== "undefined") window.location.assign(opts.action!.href!);
          },
        }
      : { label: opts.action.label, onClick: opts.action.onClick ?? (() => {}) };
  }
  return ext;
}

/**
 * Overrides visuels par type métier (au-delà des 4 base success/error/warning/info).
 * Utilise les classes utilitaires Tailwind pour teinter icône + bordure.
 */
const METIER_STYLE: Record<
  Exclude<NotifyType, "info" | "success" | "warning" | "error">,
  string
> = {
  mission:
    "!border-[#c084fc]/45 !shadow-[0_20px_50px_-20px_rgba(192,132,252,0.4)] [&_[data-icon]]:!bg-[#c084fc]/15 [&_[data-icon]]:!text-[#e0c9ff] [&_[data-icon]]:!border-[#c084fc]/30",
  convoyage:
    "!border-[#38bdf8]/45 !shadow-[0_20px_50px_-20px_rgba(56,189,248,0.4)] [&_[data-icon]]:!bg-[#38bdf8]/15 [&_[data-icon]]:!text-[#a8dcff] [&_[data-icon]]:!border-[#38bdf8]/30",
  document:
    "!border-[#f5b544]/40 !shadow-[0_20px_50px_-20px_rgba(245,181,68,0.35)] [&_[data-icon]]:!bg-[#f5b544]/15 [&_[data-icon]]:!text-[#ffd989] [&_[data-icon]]:!border-[#f5b544]/30",
  paiement:
    "!border-[#3dd68c]/45 !shadow-[0_20px_50px_-20px_rgba(61,214,140,0.35)] [&_[data-icon]]:!bg-[#3dd68c]/15 [&_[data-icon]]:!text-[#7ee5b0] [&_[data-icon]]:!border-[#3dd68c]/30",
  avis:
    "!border-[#e7c76a]/50 !shadow-[0_20px_50px_-20px_rgba(231,199,106,0.4)] [&_[data-icon]]:!bg-[#e7c76a]/18 [&_[data-icon]]:!text-[#f0d78c] [&_[data-icon]]:!border-[#e7c76a]/40",
  rappel:
    "!border-[#4d9aff]/45 !shadow-[0_20px_50px_-20px_rgba(77,154,255,0.35)] [&_[data-icon]]:!bg-[#4d9aff]/15 [&_[data-icon]]:!text-[#a8caff] [&_[data-icon]]:!border-[#4d9aff]/30",
};

function fireBase(
  type: "info" | "success" | "warning" | "error",
  title: string,
  opts?: NotifyOptions,
) {
  const ext = toExternal(opts);
  triggerVibration(type, opts?.priority);
  triggerSound();
  return toast[type](title, ext);
}

function fireMetier(
  type: Exclude<NotifyType, "info" | "success" | "warning" | "error">,
  title: string,
  opts?: NotifyOptions,
) {
  const Icon = ICONS[type];
  const ext = toExternal(opts);
  triggerVibration(type, opts?.priority);
  triggerSound();
  return toast(title, {
    ...ext,
    icon: React.createElement(Icon, { size: 18, strokeWidth: 2.2 }),
    className: METIER_STYLE[type],
  });
}

export const notify = {
  info: (title: string, opts?: NotifyOptions) => fireBase("info", title, opts),
  success: (title: string, opts?: NotifyOptions) => fireBase("success", title, opts),
  warning: (title: string, opts?: NotifyOptions) => fireBase("warning", title, opts),
  error: (title: string, opts?: NotifyOptions) => fireBase("error", title, opts),
  mission: (title: string, opts?: NotifyOptions) => fireMetier("mission", title, opts),
  convoyage: (title: string, opts?: NotifyOptions) => fireMetier("convoyage", title, opts),
  document: (title: string, opts?: NotifyOptions) => fireMetier("document", title, opts),
  paiement: (title: string, opts?: NotifyOptions) => fireMetier("paiement", title, opts),
  avis: (title: string, opts?: NotifyOptions) => fireMetier("avis", title, opts),
  rappel: (title: string, opts?: NotifyOptions) => fireMetier("rappel", title, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
};

/** Formatte une date en français façon "à l'instant", "il y a 5 min", "hier", "12/03". */
export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "à l'instant";
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.round(hr / 24);
  if (day === 1) return "hier";
  if (day < 7) return `il y a ${day} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
