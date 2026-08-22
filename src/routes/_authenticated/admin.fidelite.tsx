import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wallet, Gauge, Settings2, Pencil, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader, Card, KpiCard, Badge, Button, EmptyState, Select, SearchInput,
  Table, THead, TH, TR, TD, TextInput, FormField,
} from "@/components/admin/AdminUI";
import {
  adminListLoyalty,
  adminAdjustLoyalty,
  adminUpdateLoyaltyTier,
  type AdminLoyaltyRow,
} from "@/lib/loyalty.functions";
import { currentTier, formatEur, formatKm, formatDateFr, DEFAULT_TIERS, type LoyaltyTier } from "@/lib/loyalty";

export const Route = createFileRoute("/_authenticated/admin/fidelite")({
  component: AdminFidelite,
  head: () => ({
    meta: [
      { title: "Compte Kilomètres — Administration Transports Ligneo" },
      { name: "description", content: "Suivi des comptes fidélité, avoirs et paliers kilométriques." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
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
      !q ? true : `${r.clientNom} ${r.clientEmail} ${r.societe ?? ""}`.toLowerCase().includes(q),
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compte Kilomètres"
        eyebrow="Fidélité"
        subtitle="Programme interne — non visible sur le site public."
        actions={
          <Button
            variant={showBareme ? "primary" : "secondary"}
            icon={showBareme ? <X size={15} /> : <Settings2 size={15} />}
            onClick={() => setShowBareme((v) => !v)}
          >
            {showBareme ? "Fermer le barème" : "Barème"}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Comptes actifs" value={totals.comptes} icon={Users} tone="info" />
        <KpiCard label="Avoirs en circulation" value={formatEur(totals.avoir)} icon={Wallet} tone="primary" />
        <KpiCard label="Km cumulés (périodes en cours)" value={formatKm(totals.km)} icon={Gauge} tone="success" />
      </div>

      {showBareme && (
        <Card>
          <h2 className="text-sm font-semibold text-pro-text mb-4">Paliers et taux</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <TierEditor key={t.id} tier={t} onSave={(v) => tierMutation.mutate(v)} saving={tierMutation.isPending} />
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Client, email, société…" />
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="avoir">Tri : solde d'avoir</option>
          <option value="km">Tri : kilomètres cumulés</option>
          <option value="client">Tri : client</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Aucun compte fidélité"
          description="Les comptes se créent automatiquement dès la première mission terminée."
        />
      ) : (
        <Table>
          <THead>
            <TH>Client</TH>
            <TH>Type</TH>
            <TH>Km période</TH>
            <TH>HT période</TH>
            <TH>Palier</TH>
            <TH>Avoir</TH>
            <TH>Début période</TH>
            <TH className="text-right">Actions</TH>
          </THead>
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
        </Table>
      )}
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
    <div className="rounded-xl border border-pro-border bg-pro-bg-soft/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-pro-text-soft">{tier.label}</span>
        <Badge tone="primary">{tier.taux} %</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Km min">
          <TextInput value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="Km max">
          <TextInput value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" />
        </FormField>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label="Taux %">
            <TextInput value={taux} onChange={(e) => setTaux(e.target.value)} placeholder="1" />
          </FormField>
        </div>
        <Button
          size="sm"
          disabled={saving}
          onClick={() =>
            onSave({
              id: tier.id,
              seuil_km_min: Number(min) || 0,
              seuil_km_max: max.trim() === "" ? null : Number(max),
              taux: Number(taux) || 0,
            })
          }
        >
          OK
        </Button>
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
  const avoir = Number(row.account.solde_avoir);

  return (
    <>
      <TR>
        <TD>
          <div className="font-medium text-pro-text">{row.clientNom}</div>
          <div className="text-xs text-pro-muted">{row.societe || row.clientEmail}</div>
        </TD>
        <TD>
          <Badge tone={row.typeClient === "professionnel" ? "purple" : "neutral"}>
            {row.typeClient ?? "—"}
          </Badge>
        </TD>
        <TD>{formatKm(km)}</TD>
        <TD>{formatEur(Number(row.account.montant_ht_cumule_periode))}</TD>
        <TD>
          <Badge tone="info">{tier.taux} %</Badge>
        </TD>
        <TD className="font-semibold">
          {avoir > 0 ? <Badge tone="success">{formatEur(avoir)}</Badge> : formatEur(avoir)}
        </TD>
        <TD className="text-pro-text-soft">{formatDateFr(row.account.date_debut_periode)}</TD>
        <TD className="text-right">
          <Button size="sm" variant={open ? "secondary" : "ghost"} icon={<Pencil size={13} />} onClick={onToggle}>
            {open ? "Fermer" : "Ajuster"}
          </Button>
        </TD>
      </TR>
      {open && (
        <tr className="border-b border-pro-border bg-pro-bg-soft/50">
          <td colSpan={8} className="p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-[11px] uppercase tracking-wider font-semibold text-pro-text-soft">
                  Ajustement manuel
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Montant d'avoir (€)" required>
                    <TextInput
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      placeholder="ex : 120 ou -50"
                    />
                  </FormField>
                  <FormField label="Taux appliqué (%)">
                    <TextInput value={taux} onChange={(e) => setTaux(e.target.value)} placeholder="ex : 2" />
                  </FormField>
                </div>
                <FormField label="Note justificative" required>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Volume exceptionnel, geste commercial…"
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none"
                  />
                </FormField>
                <Button
                  disabled={saving || note.trim().length < 3 || !montant}
                  onClick={() => {
                    onAdjust({ montantAvoir: Number(montant) || 0, taux: Number(taux) || 0, note: note.trim() });
                    setMontant("");
                    setTaux("");
                    setNote("");
                  }}
                >
                  Enregistrer l'ajustement
                </Button>
              </div>
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-semibold text-pro-text-soft mb-2">
                  Historique des primes
                </h3>
                {row.rewards.length === 0 ? (
                  <p className="text-sm text-pro-muted">Aucune prime pour le moment.</p>
                ) : (
                  <ul className="space-y-2">
                    {row.rewards.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-pro-border bg-white px-3 py-2 text-sm"
                      >
                        <span className="text-pro-text-soft">
                          {formatDateFr(r.date_calcul)} — {formatKm(Number(r.km_au_calcul))} · {r.taux_applique} %
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-pro-text">{formatEur(Number(r.montant_avoir_genere))}</span>
                          <Badge tone={r.statut === "actif" ? "success" : "neutral"}>{r.statut}</Badge>
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
