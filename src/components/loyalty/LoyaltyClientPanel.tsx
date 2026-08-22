import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Gauge, Wallet, Gift, TrendingUp } from "lucide-react";
import { getMyLoyalty } from "@/lib/loyalty.functions";
import {
  currentTier,
  nextTier,
  periodEnd,
  formatEur,
  formatKm,
  formatDateFr,
  DEFAULT_TIERS,
  type LoyaltyTier,
} from "@/lib/loyalty";

const STATUT_LABEL: Record<string, string> = {
  actif: "Actif",
  partiel: "Partiellement utilisé",
  utilise: "Utilisé",
  expire: "Expiré",
};

/** Panneau « Compte Kilomètres » — espace client particulier & professionnel. */
export default function LoyaltyClientPanel({ accent = "blue" }: { accent?: "blue" | "violet" }) {
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const { data, isLoading } = useQuery({
    queryKey: ["loyalty", "me"],
    queryFn: () => fetchLoyalty(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  const account = data?.account ?? null;
  const tiers: LoyaltyTier[] = (data?.tiers?.length ? data.tiers : DEFAULT_TIERS) as LoyaltyTier[];
  const km = Number(account?.km_cumules_periode ?? 0);
  const tier = currentTier(km, tiers);
  const next = nextTier(km, tiers);
  const progress = next ? Math.min(100, Math.round((km / next.seuil_km_min) * 100)) : 100;
  const accentText = accent === "violet" ? "text-violet-600" : "text-pro-accent";
  const accentBg = accent === "violet" ? "bg-violet-600" : "bg-pro-accent";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Gauge size={18} />}
          label="Kilomètres cumulés"
          value={formatKm(km)}
          hint={account ? `Période depuis le ${formatDateFr(account.date_debut_periode)}` : ""}
          accentText={accentText}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Palier actuel"
          value={`${tier.taux} %`}
          hint={tier.label}
          accentText={accentText}
        />
        <StatCard
          icon={<Wallet size={18} />}
          label="Avoir disponible"
          value={formatEur(Number(account?.solde_avoir ?? 0))}
          hint="Déductible de vos prochains convoyages"
          accentText={accentText}
        />
      </div>

      <div className="card-premium rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-heading text-sm uppercase tracking-[0.14em]">Progression de la période</h2>
          {account && (
            <span className="text-xs text-pro-muted">
              Clôture le {formatDateFr(periodEnd(account.date_debut_periode).toISOString())}
            </span>
          )}
        </div>
        <div className="h-2.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div className={`h-full rounded-full ${accentBg} transition-all`} style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-sm text-pro-muted">
          {next
            ? `Encore ${formatKm(Math.max(next.seuil_km_min - km, 0))} pour atteindre le palier ${next.taux} % (${next.label}).`
            : "Vous êtes au palier maximum du programme (4 %)."}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-3 py-2 text-xs ${
                t.id === tier.id ? "border-current font-semibold " + accentText : "border-black/10 text-pro-muted"
              }`}
            >
              <div className="text-[11px] uppercase tracking-wider">{t.label}</div>
              <div className="text-base font-heading">{t.taux} %</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-premium rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift size={16} className={accentText} />
          <h2 className="font-heading text-sm uppercase tracking-[0.14em]">Historique des primes</h2>
        </div>
        {!data?.rewards?.length ? (
          <p className="text-sm text-pro-muted">
            Aucune prime générée pour le moment. Votre première prime sera calculée à la clôture de votre
            période de 12 mois.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-pro-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Km période</th>
                  <th className="py-2 pr-3">Montant HT</th>
                  <th className="py-2 pr-3">Taux</th>
                  <th className="py-2 pr-3">Avoir</th>
                  <th className="py-2 pr-3">Expire le</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.rewards.map((r) => (
                  <tr key={r.id} className="border-t border-black/5">
                    <td className="py-2 pr-3">{formatDateFr(r.date_calcul)}</td>
                    <td className="py-2 pr-3">{formatKm(Number(r.km_au_calcul))}</td>
                    <td className="py-2 pr-3">{formatEur(Number(r.montant_ht_periode))}</td>
                    <td className="py-2 pr-3">{r.taux_applique} %</td>
                    <td className="py-2 pr-3 font-semibold">{formatEur(Number(r.montant_avoir_genere))}</td>
                    <td className="py-2 pr-3">{formatDateFr(r.date_expiration_avoir)}</td>
                    <td className="py-2">{STATUT_LABEL[r.statut] ?? r.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accentText,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accentText: string;
}) {
  return (
    <div className="card-premium rounded-2xl p-5">
      <div className={`flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] ${accentText}`}>
        {icon}
        {label}
      </div>
      <div className="mt-2 font-heading text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-pro-muted">{hint}</div>}
    </div>
  );
}
