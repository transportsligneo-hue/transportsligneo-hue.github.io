import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Calendar, Clock, Search, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  Card,
  Badge,
  Table,
  THead,
  TH,
  TR,
  TD,
  EmptyState,
  IconButton,
  Button,
  Select,
  SearchInput,
} from "@/components/admin/AdminUI";
import { PriceBlock } from "@/components/admin/PriceBlock";
import { AssignDriverDialog } from "@/components/admin/AssignDriverDialog";

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
  estimated_price_ht: number | null;
  payment_status: string;
  operational_status: string;
  created_at: string;
  company_id: string | null;
  assigned_convoyeur_id: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  a_dispatcher: "À dispatcher",
  attribue: "Attribué",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

const STATUS_TONES: Record<string, "info" | "warning" | "purple" | "success" | "danger" | "neutral"> = {
  nouveau: "info",
  a_dispatcher: "warning",
  attribue: "purple",
  en_cours: "purple",
  termine: "success",
  annule: "danger",
};

const PAYMENT_TONES: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  paid: "success",
  failed: "danger",
  refunded: "neutral",
};

function AdminB2BDispatch() {
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignTarget, setAssignTarget] = useState<Request | null>(null);

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

  useEffect(() => {
    void load();
  }, []);

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
    <div>
      <PageHeader
        title="Dispatch B2B"
        subtitle="Pilotage opérationnel des transports ponctuels payés"
        actions={
          <>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous statuts</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <IconButton onClick={load} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher (n°, adresse)…" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-pro-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Aucune demande" description="Aucune demande B2B ne correspond aux filtres." />
      ) : (
        <Table>
          <THead>
            <TH>N°</TH>
            <TH>Trajet</TH>
            <TH className="hidden md:table-cell">Date</TH>
            <TH>Prix</TH>
            <TH className="hidden lg:table-cell">Paiement</TH>
            <TH>Statut</TH>
            <TH className="text-right">Actions</TH>
          </THead>
          <tbody>
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD className="font-mono text-xs text-pro-text-soft">{r.numero}</TD>
                <TD>
                  <div className="flex items-center gap-1.5 text-sm text-pro-text">
                    <MapPin size={12} className="text-pro-muted" />
                    {r.pickup_address}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-pro-muted mt-0.5">
                    <MapPin size={11} /> {r.dropoff_address}
                  </div>
                </TD>
                <TD className="hidden md:table-cell text-xs">
                  <div className="flex items-center gap-1 text-pro-text-soft">
                    <Calendar size={11} /> {r.scheduled_date}
                  </div>
                  <div className="flex items-center gap-1 text-pro-muted mt-0.5">
                    <Clock size={11} /> {r.scheduled_time}
                  </div>
                </TD>
                <TD>
                  <PriceBlock
                    variant="compact"
                    priceTtc={r.estimated_price_ttc != null ? Number(r.estimated_price_ttc) : null}
                    priceHt={r.estimated_price_ht != null ? Number(r.estimated_price_ht) : null}
                  />
                </TD>
                <TD className="hidden lg:table-cell">
                  <Badge tone={PAYMENT_TONES[r.payment_status] ?? "neutral"}>
                    {r.payment_status}
                  </Badge>
                </TD>
                <TD>
                  <Select
                    value={r.operational_status}
                    onChange={(e) => updateStatus(r.id, e.target.value)}
                    className="text-xs py-1.5"
                  >
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant={r.assigned_convoyeur_id ? "secondary" : "primary"}
                      icon={<UserPlus size={13} />}
                      onClick={() => setAssignTarget(r)}
                    >
                      {r.assigned_convoyeur_id ? "Réassigner" : "Assigner"}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      {assignTarget && (
        <AssignDriverDialog
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          trip={{
            id: assignTarget.id,
            depart: assignTarget.pickup_address,
            arrivee: assignTarget.dropoff_address,
            date: assignTarget.scheduled_date,
            source: "b2b_request",
          }}
          onAssigned={(t) => {
            toast.success(`Demande assignée à ${t.label}`);
            void load();
          }}
        />
      )}
    </div>
  );
}
