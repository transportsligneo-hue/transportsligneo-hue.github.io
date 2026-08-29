import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, TrendingUp, Wallet, AlertTriangle, BarChart3, Search, Plus } from "lucide-react";
import { EmptyState } from "@/components/admin/AdminUI";
import { LogoLoader } from "@/components/brand/LogoLoader";

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

  const stripeStatutTone = (s: string) => (s === "paye" ? "green" : s === "expire" ? "red" : "orange");
  const b2bStatutTone = (s: string) => (s === "paid" ? "green" : s === "pending" ? "orange" : "red");
  const factStatutTone = (s: string) => (s === "payee" ? "green" : s === "en_retard" ? "red" : s === "annulee" ? "grey" : "orange");

  return (
    <div>
      {/* ===== En-tête ===== */}
      <div className="dvx-head">
        <div className="min-w-0">
          <h1 className="dvx-title">Paiements & facturation</h1>
          <p className="dvx-sub">Cockpit financier — Stripe, B2B, factures émises</p>
        </div>
      </div>

      {/* ===== Statistiques ===== */}
      <div className="dvx-stats">
        <div className="dvx-stat">
          <span className="dvx-stat-ic green"><TrendingUp size={17} /></span>
          <p className="dvx-stat-k">CA TTC encaissé</p>
          <p className="dvx-stat-v">{eur(kpis.caTTC)}</p>
          <p className="dvx-stat-t dim">Factures payées</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic blue"><BarChart3 size={17} /></span>
          <p className="dvx-stat-k">CA HT</p>
          <p className="dvx-stat-v">{eur(kpis.caHT)}</p>
          <p className="dvx-stat-t dim">Hors taxes</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic violet"><Wallet size={17} /></span>
          <p className="dvx-stat-k">TVA collectée</p>
          <p className="dvx-stat-v">{eur(kpis.tva)}</p>
          <p className="dvx-stat-t dim">Sur factures payées</p>
        </div>
        <div className="dvx-stat">
          <span className="dvx-stat-ic orange"><AlertTriangle size={17} /></span>
          <p className="dvx-stat-k">Encours à percevoir</p>
          <p className="dvx-stat-v">{eur(kpis.encours)}</p>
          <p className={`dvx-stat-t ${kpis.encours > 0 ? "warn" : "dim"}`}>
            {kpis.encours > 0 ? "Factures émises / en retard" : "Aucun encours"}
          </p>
        </div>
      </div>

      {/* ===== Mini chart 12 mois ===== */}
      <div className="dvx-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13.5px] font-bold text-[#14161c]">Revenus facturés (12 derniers mois)</h3>
            <p className="dvx-col-k mb-0">Factures au statut payée</p>
          </div>
          <span className="dvx-badge blue">{eur(chart.months.reduce((s, m) => s + m.total, 0))}</span>
        </div>
        <div className="flex items-end gap-2 h-32">
          {chart.months.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="text-[10px] text-[#a3a4ac] opacity-0 group-hover:opacity-100 transition">
                {m.total > 0 ? eur(m.total) : ""}
              </div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-[#2f5fff]/30 to-[#2f5fff] transition-all"
                style={{ height: `${(m.total / chart.max) * 100}%`, minHeight: m.total > 0 ? 4 : 2 }}
              />
              <div className="text-[10px] text-[#a3a4ac]">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Onglets ===== */}
      <div className="dvx-filters">
        {([
          ["stripe", `Stripe B2C (${devis.filter(d => d.statut === "paye" || d.amount_paid_cents).length})`],
          ["b2b", `B2B (${b2b.length})`],
          ["factures", `Factures (${factures.length})`],
        ] as [Tab, string][]).map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); setStatutFilter(""); }}
            className={`dvx-btn ${tab === k ? "solid" : "outline"}`}
          >
            {lbl}
          </button>
        ))}
        <div className="dvx-search">
          <Search size={15} />
          <input
            className="dvx-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
          />
        </div>
        <select className="dvx-select" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
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
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement des paiements…" />
        </div>
      ) : tab === "stripe" ? (
        filterStripe.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucun paiement Stripe" description="Les devis payés par les clients apparaîtront ici." />
        ) : (
          <div className="space-y-3.5">
            {filterStripe.map(d => (
              <div key={d.id} className="dvx-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="dvx-ref">{d.numero}</span>
                    <span className={`dvx-badge ${stripeStatutTone(d.statut)}`}>{d.statut}</span>
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      {new Date(d.paid_at ?? d.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="dvx-price">
                    {eur((d.amount_paid_cents ?? 0) / 100 || Number(d.prix_estime))}
                    <small>TTC</small>
                  </p>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="dvx-col-k">Client</p>
                    <p className="text-[13px] font-semibold text-[#14161c] truncate">
                      {`${d.prenom ?? ""} ${d.nom ?? ""}`.trim() || "—"}
                    </p>
                    <p className="text-[11.5px] text-[#70727d] truncate">{d.email}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="dvx-col-k">Trajet</p>
                    <p className="text-[12.5px] text-[#14161c]">{d.depart} → {d.arrivee}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "b2b" ? (
        filterB2B.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucune demande B2B" />
        ) : (
          <div className="space-y-3.5">
            {filterB2B.map(r => (
              <div key={r.id} className="dvx-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="dvx-ref">{r.numero}</span>
                    <span className={`dvx-badge ${b2bStatutTone(r.payment_status)}`}>{r.payment_status}</span>
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="dvx-price">
                    {r.estimated_price_ttc ? eur(Number(r.estimated_price_ttc)) : "—"}
                    <small>TTC</small>
                  </p>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="dvx-col-k">Trajet</p>
                    <p className="text-[12.5px] text-[#14161c]">{r.pickup_address} → {r.dropoff_address}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="dvx-col-k">Stripe</p>
                    <p className="dvx-vin">{r.stripe_payment_intent_id?.slice(0, 24) ?? "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        filterFact.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucune facture" />
        ) : (
          <div className="space-y-3.5">
            {filterFact.map(f => (
              <div key={f.id} className="dvx-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="dvx-ref">{f.numero}</span>
                    <span className={`dvx-badge ${f.type_facture === "b2b" ? "violet" : "blue"}`}>{f.type_facture}</span>
                    <span className={`dvx-badge ${factStatutTone(f.statut)}`}>{f.statut}</span>
                    <span className="text-[11.5px] text-[#a3a4ac]">
                      {new Date(f.date_facture ?? f.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <p className="dvx-price">
                    {eur(Number(f.prix_ttc))}
                    <small>TTC</small>
                  </p>
                </div>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="dvx-col-k">HT</p>
                    <p className="text-[12.5px] text-[#14161c]">{eur(Number(f.prix_ht))}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="dvx-col-k">TVA</p>
                    <p className="text-[12.5px] text-[#14161c]">{eur(Number(f.prix_tva))}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
