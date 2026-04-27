import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: AdminPaiements,
});

function AdminPaiements() {
  const [b2b, setB2b] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [b2bRes, missionsRes] = await Promise.all([
        supabase
          .from("b2b_transport_requests")
          .select("id, numero, pickup_address, dropoff_address, payment_status, estimated_price_ttc, stripe_payment_intent_id, created_at, company_id")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("missions")
          .select("id, numero, ville_depart, ville_arrivee, statut, prix_total, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setB2b(b2bRes.data ?? []);
      setMissions(missionsRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const paid = b2b.filter((r) => r.payment_status === "paid");
    const pending = b2b.filter((r) => r.payment_status === "pending");
    const totalPaid = paid.reduce((s, r) => s + (Number(r.estimated_price_ttc) || 0), 0);
    const missionsRevenue = missions.reduce((s, m) => s + (Number(m.prix_total) || 0), 0);
    return {
      paidCount: paid.length,
      pendingCount: pending.length,
      totalPaid,
      missionsRevenue,
      total: totalPaid + missionsRevenue,
    };
  }, [b2b, missions]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <CreditCard className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Paiements &amp; facturation</h1>
            <p className="text-sm text-pro-muted">Synthèse Stripe et facturation par mission.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="CA total" value={`${stats.total.toFixed(0)} €`} icon={TrendingUp} />
        <Kpi label="B2B encaissés" value={`${stats.totalPaid.toFixed(0)} €`} icon={CheckCircle2} />
        <Kpi label="B2B en attente" value={stats.pendingCount} icon={Clock} />
        <Kpi label="Missions B2C" value={`${stats.missionsRevenue.toFixed(0)} €`} icon={CreditCard} />
      </div>

      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pro-border">
          <h2 className="font-semibold text-pro-text">Demandes B2B (Stripe)</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-pro-accent" size={20} />
          </div>
        ) : b2b.length === 0 ? (
          <div className="text-center py-12 text-sm text-pro-muted">Aucune demande B2B.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Montant TTC</TableHead>
                <TableHead>Statut paiement</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {b2b.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.numero}</TableCell>
                  <TableCell className="text-xs text-pro-muted">{r.pickup_address} → {r.dropoff_address}</TableCell>
                  <TableCell>{r.estimated_price_ttc ? `${Number(r.estimated_price_ttc).toFixed(2)} €` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      r.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : r.payment_status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                    }>{r.payment_status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-pro-muted">{r.stripe_payment_intent_id?.slice(0, 16) ?? "—"}</TableCell>
                  <TableCell className="text-xs text-pro-muted">{new Date(r.created_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-pro-border">
          <h2 className="font-semibold text-pro-text">Missions facturées (B2C)</h2>
        </div>
        {missions.length === 0 ? (
          <div className="text-center py-12 text-sm text-pro-muted">Aucune mission.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Trajet</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missions.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.numero}</TableCell>
                  <TableCell className="text-xs text-pro-muted">{m.ville_depart} → {m.ville_arrivee}</TableCell>
                  <TableCell>{Number(m.prix_total).toFixed(2)} €</TableCell>
                  <TableCell><Badge variant="outline">{m.statut}</Badge></TableCell>
                  <TableCell className="text-xs text-pro-muted">{new Date(m.created_at).toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof CreditCard }) {
  return (
    <div className="bg-white border border-pro-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-pro-muted">{label}</p>
        <Icon size={16} className="text-pro-muted" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-pro-text">{value}</p>
    </div>
  );
}
