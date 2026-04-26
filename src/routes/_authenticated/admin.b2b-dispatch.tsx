import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Calendar, Clock, Euro, Building2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/b2b-dispatch")({
  component: AdminB2BDispatch,
});

interface Request {
  id: string;
  numero: string;
  pickup_address: string;
  dropoff_address: string;
  scheduled_date: string;
  scheduled_time: string;
  vehicle_type: string;
  urgency: string;
  estimated_price_ttc: number | null;
  payment_status: string;
  operational_status: string;
  created_at: string;
  company_id: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  a_dispatcher: "À dispatcher",
  attribue: "Attribué",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

const PAYMENT_BADGES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-slate-100 text-slate-700",
};

function AdminB2BDispatch() {
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("b2b_transport_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Request[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase
      .from("b2b_transport_requests")
      .update({ operational_status: status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Statut mis à jour");
    void load();
  }

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.operational_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.numero.toLowerCase().includes(q) ||
        r.pickup_address.toLowerCase().includes(q) ||
        r.dropoff_address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pro-text">Dispatch B2B — Transports ponctuels</h1>
        <p className="mt-1 text-sm text-pro-muted">
          Pilotage opérationnel des demandes payées, à attribuer et en cours.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pro-muted" />
          <Input
            placeholder="Rechercher (n°, adresse)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pro-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-pro-border bg-white p-10 text-center text-sm text-pro-muted">
          Aucune demande trouvée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-pro-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-pro-bg-soft text-xs uppercase tracking-wide text-pro-muted">
              <tr>
                <th className="px-4 py-3 text-left">N°</th>
                <th className="px-4 py-3 text-left">Trajet</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Prix</th>
                <th className="px-4 py-3 text-left">Paiement</th>
                <th className="px-4 py-3 text-left">Statut opé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pro-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-pro-bg-soft/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.numero}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-pro-muted" />{r.pickup_address}</div>
                    <div className="flex items-center gap-1.5 text-pro-muted"><MapPin className="h-3 w-3" />{r.dropoff_address}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.scheduled_date}</div>
                    <div className="flex items-center gap-1 text-pro-muted"><Clock className="h-3 w-3" />{r.scheduled_time}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.estimated_price_ttc ? `${Number(r.estimated_price_ttc).toFixed(0)} €` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${PAYMENT_BADGES[r.payment_status] ?? "bg-slate-100"}`}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={r.operational_status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
