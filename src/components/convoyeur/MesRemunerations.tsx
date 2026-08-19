import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Loader2, Wallet, Clock3, CheckCircle2 } from "lucide-react";
import {
  REMU_STATUT_LABEL,
  PAIEMENT_STATUT_LABEL,
  decomposer,
  eur,
  dateFr,
  type Ajustement,
  type PaiementConvoyeur,
  type Remuneration,
} from "@/lib/finances-convoyeurs";

/**
 * Vue convoyeur des rémunérations : exactement les mêmes chiffres que l'admin
 * (calculés une seule fois en base), avec la décomposition détaillée et le
 * libellé + article de référence de chaque pénalité appliquée.
 */
export function MesRemunerations({ userId }: { userId: string | undefined }) {
  const [loading, setLoading] = useState(true);
  const [remus, setRemus] = useState<Remuneration[]>([]);
  const [ajust, setAjust] = useState<Ajustement[]>([]);
  const [paiements, setPaiements] = useState<PaiementConvoyeur[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from("remunerations_missions")
        .select("*")
        .order("date_mission", { ascending: false })
        .limit(200);
      const list = (rows ?? []) as unknown as Remuneration[];
      setRemus(list);
      if (list.length) {
        const { data: aj } = await supabase
          .from("remuneration_ajustements")
          .select("*")
          .in("remuneration_id", list.map((r) => r.id));
        setAjust((aj ?? []) as unknown as Ajustement[]);
      }
      const { data: pays } = await supabase
        .from("paiements_convoyeurs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setPaiements((pays ?? []) as unknown as PaiementConvoyeur[]);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="animate-spin opacity-60" />
      </div>
    );
  }

  const enAttente = remus.filter((r) => !["paye", "annule"].includes(r.statut));
  const totalAttente = enAttente.reduce((s, r) => s + Number(r.montant_total), 0);
  const totalPaye = remus.filter((r) => r.statut === "paye").reduce((s, r) => s + Number(r.montant_total), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider opacity-60 flex items-center gap-1">
            <Clock3 size={12} /> En attente de paiement
          </p>
          <p className="text-xl font-bold mt-1">{eur(totalAttente)}</p>
          <p className="text-xs opacity-60">{enAttente.length} mission(s)</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider opacity-60 flex items-center gap-1">
            <CheckCircle2 size={12} /> Déjà payé
          </p>
          <p className="text-xl font-bold mt-1">{eur(totalPaye)}</p>
          <p className="text-xs opacity-60">{paiements.length} virement(s)</p>
        </div>
      </div>

      <div className="space-y-2">
        {remus.length === 0 && <p className="text-sm opacity-60">Aucune rémunération enregistrée pour le moment.</p>}
        {remus.map((r) => {
          const lignes = decomposer(r, ajust.filter((a) => a.remuneration_id === r.id));
          const isOpen = openId === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                onClick={() => setOpenId(isOpen ? null : r.id)}
              >
                <div>
                  <p className="text-sm font-semibold">{r.numero_mission ?? "Mission"}</p>
                  <p className="text-xs opacity-60">
                    {dateFr(r.date_mission)} · {REMU_STATUT_LABEL[r.statut]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{eur(r.montant_total)}</span>
                  <ChevronDown size={16} className={isOpen ? "rotate-180 transition" : "transition"} />
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-1">
                  {lignes.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 text-xs">
                      <span className="opacity-80">
                        {l.label}
                        {l.detail ? <span className="block opacity-50">{l.detail}</span> : null}
                      </span>
                      <span className={l.montant < 0 ? "text-red-400 font-medium" : "font-medium"}>
                        {eur(l.montant)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-sm font-semibold">
                    <span>Total</span>
                    <span>{eur(r.montant_total)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {paiements.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-wider opacity-60 flex items-center gap-1 mb-2">
            <Wallet size={12} /> Mes paiements reçus
          </p>
          <div className="space-y-2">
            {paiements.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="opacity-70">
                  {p.numero ?? "Virement"} · {dateFr(p.date_execution ?? p.created_at)} ·{" "}
                  {PAIEMENT_STATUT_LABEL[p.statut]}
                </span>
                <span className="font-semibold">{eur(p.montant_total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
