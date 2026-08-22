import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMyLoyalty, applyAvoirToDevis } from "@/lib/loyalty.functions";
import { formatEur } from "@/lib/loyalty";

interface Props {
  devisId: string;
  /** Montant TTC du devis. */
  prixTtc: number;
  /** Avoir déjà appliqué sur ce devis. */
  dejaApplique?: number;
  onApplied?: () => void;
}

/**
 * Compte Kilomètres — déduction de l'avoir disponible du montant à payer.
 * Affiché uniquement dans l'espace client authentifié (programme non public).
 */
export default function AvoirRedemption({ devisId, prixTtc, dejaApplique = 0, onApplied }: Props) {
  const qc = useQueryClient();
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const apply = useServerFn(applyAvoirToDevis);
  const { data, isLoading } = useQuery({ queryKey: ["loyalty", "me"], queryFn: () => fetchLoyalty() });

  const solde = Number(data?.account?.solde_avoir ?? 0);
  const restantDu = Math.max(prixTtc - dejaApplique, 0);
  const max = Math.min(solde, restantDu);
  const [montant, setMontant] = useState("");

  const mutation = useMutation({
    mutationFn: (value: number) => apply({ data: { devisId, montant: value } }),
    onSuccess: (res) => {
      toast.success(`Avoir de ${formatEur(res.montant)} appliqué`);
      qc.invalidateQueries({ queryKey: ["loyalty", "me"] });
      setMontant("");
      onApplied?.();
    },
    onError: (e: any) => toast.error(e?.message || "Impossible d'appliquer l'avoir"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-cream/60 text-sm py-3">
        <Loader2 size={14} className="animate-spin" /> Chargement de votre Compte Kilomètres…
      </div>
    );
  }
  if (solde <= 0 && dejaApplique <= 0) return null;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 mb-4">
      <div className="flex items-center gap-2 text-primary text-[11px] uppercase tracking-[0.18em]">
        <Wallet size={14} /> Compte Kilomètres
      </div>
      <p className="text-cream/80 text-sm mt-2">
        Avoir disponible : <strong>{formatEur(solde)}</strong>
        {dejaApplique > 0 && <> · déjà déduit sur ce devis : <strong>{formatEur(dejaApplique)}</strong></>}
      </p>
      {max > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            value={montant}
            onChange={(e) => setMontant(e.target.value.replace(",", "."))}
            placeholder={`Montant à déduire (max ${max.toFixed(2)} €)`}
            className="flex-1 min-w-[180px] rounded-lg border border-cream/15 bg-navy/40 px-3 py-2 text-sm text-cream"
          />
          <button
            type="button"
            onClick={() => setMontant(max.toFixed(2))}
            className="rounded-lg border border-primary/30 px-3 py-2 text-xs uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            Tout utiliser
          </button>
          <button
            type="button"
            disabled={mutation.isPending || !montant || Number(montant) <= 0}
            onClick={() => mutation.mutate(Math.min(Number(montant), max))}
            className="rounded-lg bg-primary px-4 py-2 text-xs uppercase tracking-wider text-navy disabled:opacity-50"
          >
            {mutation.isPending ? "…" : "Appliquer"}
          </button>
        </div>
      )}
      <p className="text-cream/50 text-[11px] mt-2">
        Le montant déduit est retiré de votre solde et du montant à régler. Avoirs valables 24 mois.
      </p>
    </div>
  );
}
