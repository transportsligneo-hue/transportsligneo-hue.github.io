import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, TrendingUp, Wallet, AlertTriangle, BarChart3 } from "lucide-react";
import { PageHeader, Card, KpiCard, Badge, EmptyState, Select, SearchInput } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: AdminPaiements,
});

type Tab = "stripe" | "b2b" | "factures";

interface DevisPaid {
  id: string; numero: string; nom: string | null; prenom: string | null; email: string | null;
  depart: string; arrivee: string; prix_estime: number; amount_paid_cents: number | null;
  paid_at: string | null; created_at: string; stripe_payment_intent_id: string | null;
  stripe_session_id: string | null; statut: string;
}
interface B2BRow {
  id: string; numero: string; pickup_address: string; dropoff_address: string;
  payment_status: string; estimated_price_ttc: number | null;
  stripe_payment_intent_id: string | null; created_at: string;
}
interface FactRow {
  id: string; numero: string; statut: string; type_facture: string;
  prix_ht: number; prix_tva: number; prix_ttc: number; date_facture: string | null; created_at: string;
}

const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function AdminPaiements() {
  const [tab, setTab] = useState<Tab>("stripe");
  const [devis, setDevis] = useState<DevisPaid[]>([]);
  const [b2b, setB2b] = useState<B2BRow[]>([]);
  const [factures, setFactures] = useState<FactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [dRes, bRes, fRes] = await Promise.all([
        supabase.from("devis")
          .select("id, numero, nom, prenom, email, depart, arrivee, prix_estime, amount_paid_cents, paid_at, created_at, stripe_payment_intent_id, stripe_session_id, statut")
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("b2b_transport_requests")
          .select("id, numero, pickup_address, dropoff_address, payment_status, estimated_price_ttc, stripe_payment_intent_id, created_at")
          .order("created_at", { ascending: false }).limit(200),
        supabase.from("factures")
          .select("id, numero, statut, type_facture, prix_ht, prix_tva, prix_ttc, date_facture, created_at")
          .order("created_at", { ascending: false }).limit(200),
      ]);
      setDevis((dRes.data ?? []) as DevisPaid[]);
      setB2b((bRes.data ?? []) as B2BRow[]);
      setFactures((fRes.data ?? []) as FactRow[]);
    } finally {
      setLoading(false);
    }
  }

  const kpis = useMemo(() => {
    const factPaid = factures.filter(f => f.statut === "payee");
    const caHT = factPaid.reduce((s, f) => s + Number(f.prix_ht || 0), 0);
    const caTTC = factPaid.reduce((s, f) => s + Number(f.prix_ttc || 0), 0);
    const tva = factPaid.reduce((s, f) => s + Number(f.prix_tva || 0), 0);
    const encours = factures
      .filter(f => f.statut === "emise" || f.statut === "en_retard")
      .reduce((s, f) => s + Number(f.prix_ttc || 0), 0);
    const stripePaid = devis.filter(d => d.statut === "paye" || d.amount_paid_cents);
    const stripeRevenue = stripePaid.reduce((s, d) => s + ((d.amount_paid_cents ?? 0) / 100 || Number(d.prix_estime) || 0), 0);
    const b2bPending = b2b.filter(r => r.payment_status === "pending").length;
    return { caHT, caTTC, tva, encours, stripeRevenue, stripePaidCount: stripePaid.length, b2bPending };
  }, [devis, b2b, factures]);

  // 12 derniers mois — somme TTC facturée payée
  const chart = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        total: 0,
      });
    }
    for (const f of factures) {
      if (f.statut !== "payee") continue;
      const dt = f.date_facture ?? f.created_at;
      if (!dt) continue;
      const k = dt.slice(0, 7);
      const m = months.find(x => x.key === k);
      if (m) m.total += Number(f.prix_ttc || 0);
    }
    const max = Math.max(1, ...months.map(m => m.total));
    return { months, max };
  }, [factures]);

  const filterStripe = devis.filter(d => {
    if (statutFilter && d.statut !== statutFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${d.numero} ${d.nom ?? ""} ${d.prenom ?? ""} ${d.email ?? ""} ${d.depart} ${d.arrivee}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filterB2B = b2b.filter(r => {
    if (statutFilter && r.payment_status !== statutFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.numero} ${r.pickup_address} ${r.dropoff_address}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const filterFact = factures.filter(f => {
    if (statutFilter && f.statut !== statutFilter) return false;
    if (search && !f.numero.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Paiements & facturation"
        subtitle="Cockpit financier — Stripe, B2B, factures émises"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="CA TTC encaissé" value={eur(kpis.caTTC)} icon={TrendingUp} tone="success" />
        <KpiCard label="CA HT" value={eur(kpis.caHT)} icon={BarChart3} />
        <KpiCard label="TVA collectée" value={eur(kpis.tva)} icon={Wallet} />
        <KpiCard label="Encours à percevoir" value={eur(kpis.encours)} icon={AlertTriangle} tone={kpis.encours > 0 ? "warning" : "neutral"} />
      </div>

      {/* Mini chart 12 mois */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-pro-text">Revenus facturés (12 derniers mois)</h3>
            <p className="text-xs text-pro-muted">Factures au statut payée</p>
          </div>
          <Badge tone="info">{eur(chart.months.reduce((s, m) => s + m.total, 0))}</Badge>
        </div>
        <div className="flex items-end gap-2 h-32">
          {chart.months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-[10px] text-pro-muted opacity-0 group-hover:opacity-100 transition">
                {m.total > 0 ? eur(m.total) : ""}
              </div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-pro-accent/30 to-pro-accent transition-all"
                style={{ height: `${(m.total / chart.max) * 100}%`, minHeight: m.total > 0 ? 4 : 2 }}
              />
              <div className="text-[10px] text-pro-muted">{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-pro-border">
        {([
          ["stripe", `Stripe B2C (${devis.filter(d => d.statut === "paye" || d.amount_paid_cents).length})`],
          ["b2b", `B2B (${b2b.length})`],
          ["factures", `Factures (${factures.length})`],
        ] as [Tab, string][]).map(([k, lbl]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setStatutFilter(""); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === k ? "text-pro-accent border-pro-accent" : "text-pro-muted border-transparent hover:text-pro-text"}`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher…" />
          </div>
          <Select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="text-sm">
            <option value="">Tous statuts</option>
            {tab === "stripe" && <>
              <option value="paye">Payé</option>
              <option value="envoye">En attente</option>
              <option value="expire">Expiré</option>
            </>}
            {tab === "b2b" && <>
              <option value="paid">Payé</option>
              <option value="pending">En attente</option>
              <option value="failed">Échoué</option>
            </>}
            {tab === "factures" && <>
              <option value="payee">Payée</option>
              <option value="emise">Émise</option>
              <option value="en_retard">En retard</option>
              <option value="annulee">Annulée</option>
            </>}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-pro-muted" size={28} />
        </div>
      ) : tab === "stripe" ? (
        filterStripe.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucun paiement Stripe" description="Les devis payés par les clients apparaîtront ici." />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pro-surface-2 text-pro-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">N° devis</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Trajet</th>
                  <th className="text-right px-4 py-3">Montant</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filterStripe.map(d => (
                  <tr key={d.id} className="border-t border-pro-border hover:bg-pro-surface-2/50">
                    <td className="px-4 py-3 font-medium text-pro-text">{d.numero}</td>
                    <td className="px-4 py-3 text-pro-text-soft">
                      {`${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "—"}
                      <div className="text-xs text-pro-muted">{d.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-pro-muted">{d.depart} → {d.arrivee}</td>
                    <td className="px-4 py-3 text-right font-semibold text-pro-text">
                      {eur((d.amount_paid_cents ?? 0) / 100 || Number(d.prix_estime))}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={d.statut === "paye" ? "success" : d.statut === "expire" ? "danger" : "warning"}>
                        {d.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-pro-muted">
                      {new Date(d.paid_at ?? d.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : tab === "b2b" ? (
        filterB2B.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucune demande B2B" />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pro-surface-2 text-pro-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">N°</th>
                  <th className="text-left px-4 py-3">Trajet</th>
                  <th className="text-right px-4 py-3">TTC</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Stripe</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filterB2B.map(r => (
                  <tr key={r.id} className="border-t border-pro-border hover:bg-pro-surface-2/50">
                    <td className="px-4 py-3 font-medium text-pro-text">{r.numero}</td>
                    <td className="px-4 py-3 text-xs text-pro-muted">{r.pickup_address} → {r.dropoff_address}</td>
                    <td className="px-4 py-3 text-right font-semibold">{r.estimated_price_ttc ? eur(Number(r.estimated_price_ttc)) : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.payment_status === "paid" ? "success" : r.payment_status === "pending" ? "warning" : "danger"}>
                        {r.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-pro-muted">{r.stripe_payment_intent_id?.slice(0, 18) ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-pro-muted">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        filterFact.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucune facture" />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-pro-surface-2 text-pro-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">N°</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">HT</th>
                  <th className="text-right px-4 py-3">TVA</th>
                  <th className="text-right px-4 py-3">TTC</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filterFact.map(f => (
                  <tr key={f.id} className="border-t border-pro-border hover:bg-pro-surface-2/50">
                    <td className="px-4 py-3 font-medium text-pro-text">{f.numero}</td>
                    <td className="px-4 py-3"><Badge tone={f.type_facture === "b2b" ? "primary" : "info"}>{f.type_facture}</Badge></td>
                    <td className="px-4 py-3 text-right">{eur(Number(f.prix_ht))}</td>
                    <td className="px-4 py-3 text-right text-pro-muted">{eur(Number(f.prix_tva))}</td>
                    <td className="px-4 py-3 text-right font-semibold">{eur(Number(f.prix_ttc))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={f.statut === "payee" ? "success" : f.statut === "en_retard" ? "danger" : f.statut === "annulee" ? "neutral" : "warning"}>
                        {f.statut}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-pro-muted">
                      {new Date(f.date_facture ?? f.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}
    </div>
  );
}
