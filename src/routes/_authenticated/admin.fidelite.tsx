import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, Gauge, Search, Settings2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  adminListLoyalty,
  adminAdjustLoyalty,
  adminUpdateLoyaltyTier,
  type AdminLoyaltyRow,
} from "@/lib/loyalty.functions";
import { currentTier, formatEur, formatKm, formatDateFr, DEFAULT_TIERS, type LoyaltyTier } from "@/lib/loyalty";

export const Route = createFileRoute("/_authenticated/admin/fidelite")({
  component: AdminFidelite,
});

type SortKey = "avoir" | "km" | "client";

function AdminFidelite() {
  const qc = useQueryClient();
  const list = useServerFn(adminListLoyalty);
  const adjust = useServerFn(adminAdjustLoyalty);
  const updateTier = useServerFn(adminUpdateLoyaltyTier);

  const { data, isLoading } = useQuery({ queryKey: ["admin", "loyalty"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("avoir");
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [showBareme, setShowBareme] = useState(false);

  const adjustMutation = useMutation({
    mutationFn: (input: { accountId: string; montantAvoir: number; taux: number; note: string }) =>
      adjust({ data: input }),
    onSuccess: () => {
      toast.success("Ajustement enregistré");
      qc.invalidateQueries({ queryKey: ["admin", "loyalty"] });
    },
    onError: (e: any) => toast.error(e?.message || "Échec de l'ajustement"),
  });

  const tierMutation = useMutation({
    mutationFn: (input: { id: string; seuil_km_min: number; seuil_km_max: number | null; taux: number }) =>
      updateTier({ data: input }),
    onSuccess: () => {
      toast.success("Barème mis à jour");
      qc.invalidateQueries({ queryKey: ["admin", "loyalty"] });
    },
    onError: (e: any) => toast.error(e?.message || "Échec de la mise à jour"),
  });

  const tiers: LoyaltyTier[] = (data?.tiers?.length ? data.tiers : DEFAULT_TIERS) as LoyaltyTier[];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (data?.rows ?? []).filter((r) =>
      !q
        ? true
        : `${r.clientNom} ${r.clientEmail} ${r.societe ?? ""}`.toLowerCase().includes(q),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "client") return a.clientNom.localeCompare(b.clientNom);
      if (sort === "km") return Number(b.account.km_cumules_periode) - Number(a.account.km_cumules_periode);
      return Number(b.account.solde_avoir) - Number(a.account.solde_avoir);
    });
  }, [data, search, sort]);

  const totals = useMemo(() => {
    const rws = data?.rows ?? [];
    return {
      comptes: rws.length,
      avoir: rws.reduce((s, r) => s + Number(r.account.solde_avoir), 0),
      km: rws.reduce((s, r) => s + Number(r.account.km_cumules_periode), 0),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-pro-accent" size={30} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-pro-accent">Fidélité</p>
          <h1 className="font-heading text-2xl">Compte Kilomètres</h1>
          <p className="text-sm text-pro-muted">
            Programme interne — non visible sur le site public.
          </p>
        </div>
        <button
          onClick={() => setShowBareme((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.14em] hover:bg-black/5"
        >
          <Settings2 size={14} /> Barème
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Comptes actifs" value={String(totals.comptes)} icon={<Wallet size={16} />} />
        <MiniStat label="Avoirs en circulation" value={formatEur(totals.avoir)} icon={<Wallet size={16} />} />
        <MiniStat label="Km cumulés (périodes en cours)" value={formatKm(totals.km)} icon={<Gauge size={16} />} />
      </div>

      {showBareme && (
        <div className="card-premium rounded-2xl p-5">
          <h2 className="font-heading text-sm uppercase tracking-[0.14em] mb-3">Paliers et taux</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <TierEditor key={t.id} tier={t} onSave={(v) => tierMutation.mutate(v)} saving={tierMutation.isPending} />
            ))}
          </div>
        </div>
      )}

      <div className="card-premium rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client, un email, une société…"
              className="w-full rounded-xl border border-black/10 bg-transparent pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm"
          >
            <option value="avoir">Tri : solde d'avoir</option>
            <option value="km">Tri : kilomètres cumulés</option>
            <option value="client">Tri : client</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-pro-muted">Aucun compte fidélité pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-pro-muted">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Km période</th>
                  <th className="py-2 pr-3">HT période</th>
                  <th className="py-2 pr-3">Palier</th>
                  <th className="py-2 pr-3">Avoir</th>
                  <th className="py-2 pr-3">Début période</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <AccountRow
                    key={r.account.id}
                    row={r}
                    tiers={tiers}
                    open={openAccount === r.account.id}
                    onToggle={() => setOpenAccount(openAccount === r.account.id ? null : r.account.id)}
                    onAdjust={(v) => adjustMutation.mutate({ accountId: r.account.id, ...v })}
                    saving={adjustMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="card-premium rounded-2xl p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-pro-accent">
        {icon} {label}
      </div>
      <div className="mt-2 font-heading text-2xl">{value}</div>
    </div>
  );
}

function TierEditor({
  tier,
  onSave,
  saving,
}: {
  tier: LoyaltyTier;
  onSave: (v: { id: string; seuil_km_min: number; seuil_km_max: number | null; taux: number }) => void;
  saving: boolean;
}) {
  const [min, setMin] = useState(String(tier.seuil_km_min));
  const [max, setMax] = useState(tier.seuil_km_max == null ? "" : String(tier.seuil_km_max));
  const [taux, setTaux] = useState(String(tier.taux));
  return (
    <div className="rounded-xl border border-black/10 p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-pro-muted">{tier.label}</div>
      <div className="flex gap-2">
        <input value={min} onChange={(e) => setMin(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm" placeholder="km min" />
        <input value={max} onChange={(e) => setMax(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm" placeholder="km max (vide = ∞)" />
      </div>
      <div className="flex gap-2 items-center">
        <input value={taux} onChange={(e) => setTaux(e.target.value)} className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm" placeholder="taux %" />
        <button
          disabled={saving}
          onClick={() =>
            onSave({
              id: tier.id,
              seuil_km_min: Number(min) || 0,
              seuil_km_max: max.trim() === "" ? null : Number(max),
              taux: Number(taux) || 0,
            })
          }
          className="rounded-lg bg-pro-accent px-3 py-1 text-xs text-white"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function AccountRow({
  row,
  tiers,
  open,
  onToggle,
  onAdjust,
  saving,
}: {
  row: AdminLoyaltyRow;
  tiers: LoyaltyTier[];
  open: boolean;
  onToggle: () => void;
  onAdjust: (v: { montantAvoir: number; taux: number; note: string }) => void;
  saving: boolean;
}) {
  const [montant, setMontant] = useState("");
  const [taux, setTaux] = useState("");
  const [note, setNote] = useState("");
  const km = Number(row.account.km_cumules_periode);
  const tier = currentTier(km, tiers);

  return (
    <>
      <tr className="border-t border-black/5">
        <td className="py-2 pr-3">
          <div className="font-medium">{row.clientNom}</div>
          <div className="text-xs text-pro-muted">{row.societe || row.clientEmail}</div>
        </td>
        <td className="py-2 pr-3 text-xs uppercase tracking-wider text-pro-muted">{row.typeClient ?? "—"}</td>
        <td className="py-2 pr-3">{formatKm(km)}</td>
        <td className="py-2 pr-3">{formatEur(Number(row.account.montant_ht_cumule_periode))}</td>
        <td className="py-2 pr-3">{tier.taux} %</td>
        <td className="py-2 pr-3 font-semibold">{formatEur(Number(row.account.solde_avoir))}</td>
        <td className="py-2 pr-3">{formatDateFr(row.account.date_debut_periode)}</td>
        <td className="py-2 text-right">
          <button onClick={onToggle} className="inline-flex items-center gap-1 text-xs text-pro-accent hover:underline">
            <Pencil size={12} /> {open ? "Fermer" : "Ajuster"}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-black/5 bg-black/[0.02]">
          <td colSpan={8} className="p-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-[11px] uppercase tracking-wider text-pro-muted">Ajustement manuel</h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="Montant d'avoir (€, négatif possible)"
                    className="flex-1 min-w-[180px] rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm"
                  />
                  <input
                    value={taux}
                    onChange={(e) => setTaux(e.target.value)}
                    placeholder="Taux appliqué (%)"
                    className="w-40 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note justificative (obligatoire) — volume exceptionnel, geste commercial…"
                  rows={2}
                  className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm"
                />
                <button
                  disabled={saving || note.trim().length < 3 || !montant}
                  onClick={() => {
                    onAdjust({ montantAvoir: Number(montant) || 0, taux: Number(taux) || 0, note: note.trim() });
                    setMontant("");
                    setTaux("");
                    setNote("");
                  }}
                  className="rounded-xl bg-pro-accent px-4 py-2 text-xs uppercase tracking-[0.14em] text-white disabled:opacity-50"
                >
                  Enregistrer l'ajustement
                </button>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-wider text-pro-muted mb-2">Historique des primes</h3>
                {row.rewards.length === 0 ? (
                  <p className="text-sm text-pro-muted">Aucune prime.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {row.rewards.map((r) => (
                      <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-black/5 py-1">
                        <span>
                          {formatDateFr(r.date_calcul)} — {formatKm(Number(r.km_au_calcul))} · {r.taux_applique} %
                        </span>
                        <span className="font-medium">
                          {formatEur(Number(r.montant_avoir_genere))} · {r.statut}
                          {r.note ? ` · ${r.note}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
