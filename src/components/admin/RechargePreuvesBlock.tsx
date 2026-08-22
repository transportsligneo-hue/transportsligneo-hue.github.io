/**
 * RechargePreuvesBlock — affiche les preuves des missions "Recharge seule".
 *
 * Le cockpit recharge du convoyeur ne crée pas d'inspection classique :
 * les photos et validations sont stockées dans attributions.options_completion
 * (clé -> { done, at, photo_url }). Ce bloc lit ces données et génère
 * des URLs signées pour le bucket privé "inspection-photos".
 */
import { useCallback, useEffect, useState } from "react";
import { BatteryCharging, Camera, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CompletionItem = { done?: boolean; at?: string; photo_url?: string | null };
type CompletionMap = Record<string, CompletionItem>;

const LABELS: Record<string, string> = {
  recharge_cles_depart: "Clés récupérées (départ)",
  recharge_compteur_depart: "Compteur / véhicule au départ",
  recharge_trajet_aller: "Trajet aller effectué",
  recharge_branchee: "Véhicule en charge",
  recharge_terminee: "Charge terminée",
  recharge_trajet_retour: "Retour au site",
  recharge_compteur_retour: "Compteur au retour",
  recharge_cles_retour: "Clés restituées",
  recharge_signature: "Signature",
};

const ORDER = Object.keys(LABELS);

export function RechargePreuvesBlock({
  attributionId,
  variant = "light",
}: {
  attributionId: string | null;
  variant?: "light" | "dark";
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<{ key: string; label: string; at?: string; url?: string | null }[]>([]);

  const load = useCallback(async () => {
    if (!attributionId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("attributions")
      .select("options_completion")
      .eq("id", attributionId)
      .maybeSingle();

    const map = ((data as { options_completion?: CompletionMap } | null)?.options_completion ?? {}) as CompletionMap;
    const keys = Object.keys(map).filter((k) => k.startsWith("recharge_"));
    if (!keys.length) { setItems([]); setLoading(false); return; }

    const paths = keys
      .map((k) => map[k]?.photo_url)
      .filter((p): p is string => !!p && !/^https?:\/\//i.test(p));
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("inspection-photos").createSignedUrls(paths, 3600);
      (urls ?? []).forEach((u, i) => { if (u?.signedUrl) signed.set(paths[i], u.signedUrl); });
    }

    const sorted = keys.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
    setItems(
      sorted.map((k) => {
        const raw = map[k]?.photo_url ?? null;
        return {
          key: k,
          label: LABELS[k] ?? k.replace(/_/g, " "),
          at: map[k]?.at,
          url: raw ? (/^https?:\/\//i.test(raw) ? raw : signed.get(raw) ?? null) : null,
        };
      }),
    );
    setLoading(false);
  }, [attributionId]);

  useEffect(() => { void load(); }, [load]);

  if (!attributionId) return null;
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs py-3 ${variant === "dark" ? "text-white/60" : "text-pro-muted"}`}>
        <Loader2 size={14} className="animate-spin" /> Chargement des preuves recharge…
      </div>
    );
  }
  if (!items.length) return null;

  const photos = items.filter((i) => i.url);
  const steps = items.filter((i) => !i.url);
  const dark = variant === "dark";

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 text-[11px] font-semibold ${dark ? "text-blue-200/90" : "text-pro-text"}`}>
        <BatteryCharging size={13} />
        <span>Recharge — photos &amp; étapes</span>
        <span className={`ml-auto text-[10px] ${dark ? "text-white/40" : "text-pro-muted"}`}>{photos.length} photo(s)</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <a
              key={p.key}
              href={p.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <img
                src={p.url ?? ""}
                alt={p.label}
                loading="lazy"
                className={`w-full aspect-[3/4] object-cover rounded-md border transition-colors ${
                  dark ? "border-white/10 group-hover:border-blue-300/50" : "border-pro-border group-hover:border-pro-accent"
                }`}
              />
              <p className={`text-[10px] mt-1 truncate ${dark ? "text-white/70" : "text-pro-text-soft"}`}>{p.label}</p>
              {p.at && (
                <p className={`text-[9px] truncate ${dark ? "text-white/40" : "text-pro-muted"}`}>
                  {new Date(p.at).toLocaleString("fr-FR")}
                </p>
              )}
            </a>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {steps.map((s) => (
            <li
              key={s.key}
              className={`flex items-center gap-1.5 text-[11px] ${dark ? "text-white/70" : "text-pro-text-soft"}`}
            >
              <Check size={12} className="text-emerald-500 shrink-0" />
              <span className="truncate">{s.label}</span>
              {s.at && (
                <span className={`ml-auto text-[10px] ${dark ? "text-white/40" : "text-pro-muted"}`}>
                  {new Date(s.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 && (
        <p className={`text-[11px] italic ${dark ? "text-white/35" : "text-pro-muted"} flex items-center gap-1`}>
          <Camera size={11} /> Aucune photo recharge transmise pour l'instant.
        </p>
      )}
    </div>
  );
}
