import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ShieldAlert, Loader2 } from "lucide-react";
import { siretVerify, type SiretCheck } from "@/lib/siret.functions";

/** Vérifie un SIRET auprès de l'API officielle et affiche un badge. `onResult` renvoie le résultat. */
export function SiretBadge({ siret, onResult, dark }: { siret: string; onResult?: (r: SiretCheck | null) => void; dark?: boolean }) {
  const verify = useServerFn(siretVerify);
  const digits = (siret ?? "").replace(/\D/g, "");
  const [res, setRes] = useState<SiretCheck | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (digits.length !== 14) { setRes(null); onResult?.(null); return; }
    let dead = false;
    setBusy(true);
    const t = setTimeout(() => {
      verify({ data: { siret: digits } })
        .then((r) => { if (!dead) { setRes(r); onResult?.(r); } })
        .catch(() => { if (!dead) { const r: SiretCheck = { status: "indisponible" }; setRes(r); onResult?.(r); } })
        .finally(() => { if (!dead) setBusy(false); });
    }, 350);
    return () => { dead = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, verify]);

  if (digits.length === 0) return null;
  if (digits.length !== 14) return <p className={"text-xs mt-1 " + (dark ? "text-white/50" : "text-pro-text-soft")}>Le SIRET comporte 14 chiffres.</p>;
  if (busy || !res) return <p className={"text-xs mt-1 flex items-center gap-1 " + (dark ? "text-white/60" : "text-pro-text-soft")}><Loader2 size={12} className="animate-spin" /> Vérification officielle…</p>;
  if (res.status === "ok" && res.actif)
    return <p className="text-xs mt-1 flex items-start gap-1 text-emerald-600 font-medium"><BadgeCheck size={14} className="shrink-0" /> SIRET vérifié, entreprise active{res.nom ? ` : ${res.nom}` : ""}</p>;
  if (res.status === "ok")
    return <p className="text-xs mt-1 flex items-start gap-1 text-red-600 font-medium"><ShieldAlert size={14} className="shrink-0" /> Entreprise radiée / établissement fermé{res.nom ? ` (${res.nom})` : ""}</p>;
  if (res.status === "invalide")
    return <p className="text-xs mt-1 flex items-start gap-1 text-red-600 font-medium"><ShieldAlert size={14} className="shrink-0" /> Numéro SIRET invalide (faute de frappe ?)</p>;
  if (res.status === "inconnu")
    return <p className="text-xs mt-1 flex items-start gap-1 text-red-600 font-medium"><ShieldAlert size={14} className="shrink-0" /> SIRET introuvable dans la base officielle</p>;
  return <p className="text-xs mt-1 text-amber-600">Vérification officielle indisponible pour le moment.</p>;
}
