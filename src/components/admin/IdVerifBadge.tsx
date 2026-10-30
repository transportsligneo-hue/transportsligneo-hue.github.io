import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { adminGetIdVerifications } from "@/lib/id-verification.functions";

export type IdVerifMap = Record<string, { status: string; updated_at: string | null }>;

/** Récupère en une fois le statut de vérification d'identité d'une liste de comptes. */
export function useIdVerifications(userIds: Array<string | null | undefined>): IdVerifMap {
  const fn = useServerFn(adminGetIdVerifications);
  const [map, setMap] = useState<IdVerifMap>({});
  const key = userIds.filter(Boolean).sort().join(",");
  useEffect(() => {
    const ids = key ? key.split(",").slice(0, 500) : [];
    if (!ids.length) return;
    let alive = true;
    fn({ data: { userIds: ids } }).then((r) => { if (alive) setMap(r as IdVerifMap); }).catch(() => {});
    return () => { alive = false; };
  }, [key, fn]);
  return map;
}

const LABEL: Record<string, { text: string; cls: string }> = {
  approved: { text: "Identité vérifiée", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  review: { text: "Identité : examen en cours", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  declined: { text: "Identité refusée", cls: "border-red-200 bg-red-50 text-red-700" },
  pending: { text: "Identité : en cours", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  abandoned: { text: "Identité : interrompue", cls: "border-slate-200 bg-slate-50 text-slate-600" },
  none: { text: "Identité non vérifiée", cls: "border-slate-200 bg-slate-50 text-slate-500" },
};

export function IdVerifBadge({ status }: { status?: string }) {
  const l = LABEL[status ?? "none"] ?? LABEL.none;
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold " + l.cls}>
      <ShieldCheck size={12} /> {l.text}
    </span>
  );
}
