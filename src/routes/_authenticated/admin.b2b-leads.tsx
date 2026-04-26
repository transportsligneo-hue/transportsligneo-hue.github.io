import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Flame, ThermometerSun, Snowflake, Building2, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/b2b-leads")({
  component: AdminB2BLeads,
});

interface Lead {
  id: string;
  numero: string;
  status: string;
  structure_type: string;
  need_type: string;
  estimated_vehicle_count: number;
  frequency: string | null;
  geography: string | null;
  start_delay: string | null;
  budget: string | null;
  description: string | null;
  lead_score: number;
  score_category: string;
  company_id: string | null;
  created_at: string;
}

const PIPELINE = [
  { key: "nouveau", label: "Nouveau" },
  { key: "qualifie", label: "Qualifié" },
  { key: "rdv", label: "RDV" },
  { key: "proposition", label: "Proposition" },
  { key: "gagne", label: "Gagné" },
  { key: "perdu", label: "Perdu" },
];

const SCORE_BADGES: Record<string, { c: string; icon: any; label: string }> = {
  hot: { c: "bg-red-100 text-red-800 border-red-200", icon: Flame, label: "Hot" },
  warm: { c: "bg-amber-100 text-amber-800 border-amber-200", icon: ThermometerSun, label: "Warm" },
  cold: { c: "bg-slate-100 text-slate-700 border-slate-200", icon: Snowflake, label: "Cold" },
};

function AdminB2BLeads() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("b2b_fleet_leads")
      .select("*")
      .order("lead_score", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("b2b_fleet_leads").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Statut mis à jour");
    void load();
  }

  const filtered = rows.filter((r) => {
    if (scoreFilter !== "all" && r.score_category !== scoreFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.numero.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  // Kanban columns
  const byStatus = PIPELINE.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col.key] = filtered.filter((r) => r.status === col.key);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pro-text">CRM B2B — Leads flotte</h1>
        <p className="mt-1 text-sm text-pro-muted">
          Pipeline commercial des partenariats flotte. Triés par score de qualification.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pro-muted" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous scores</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">☀️ Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pro-accent" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {PIPELINE.map((col) => (
            <div key={col.key} className="flex flex-col rounded-lg border border-pro-border bg-pro-bg-soft/40">
              <div className="flex items-center justify-between border-b border-pro-border px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-pro-text-soft">{col.label}</span>
                <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-pro-muted">
                  {byStatus[col.key]?.length ?? 0}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2 max-h-[60vh]">
                {(byStatus[col.key] ?? []).map((lead) => {
                  const badge = SCORE_BADGES[lead.score_category] ?? SCORE_BADGES.cold;
                  const Icon = badge.icon;
                  return (
                    <div key={lead.id} className="rounded-md border border-pro-border bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-pro-muted">{lead.numero}</span>
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${badge.c}`}>
                          <Icon className="h-2.5 w-2.5" /> {lead.lead_score}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-pro-text">
                        <Building2 className="h-3 w-3 text-pro-muted" />
                        <span className="capitalize">{lead.structure_type}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-pro-muted">
                        <Truck className="h-3 w-3" />
                        {lead.estimated_vehicle_count} véhicules
                      </div>
                      {lead.geography && <div className="mt-1 text-[11px] text-pro-muted truncate">📍 {lead.geography}</div>}
                      <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                        <SelectTrigger className="mt-2 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PIPELINE.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {(byStatus[col.key]?.length ?? 0) === 0 && (
                  <div className="py-6 text-center text-[11px] text-pro-muted">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
