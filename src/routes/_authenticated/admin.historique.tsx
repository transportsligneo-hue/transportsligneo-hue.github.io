import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Search, History, FileText, Receipt, Route as RouteIcon,
  UserRound, CreditCard, ShieldCheck, AlertCircle, Mail, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { humanizeAction, actorLabel } from "@/lib/activity-humanizer";

export const Route = createFileRoute("/_authenticated/admin/historique")({
  component: AdminHistorique,
});

type LogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_label: string | null;
  actor_user_id: string | null;
  organization_id: string | null;
  metadata: any;
  created_at: string;
};

const ICONS: Record<string, { icon: typeof FileText; tone: string }> = {
  user: { icon: UserRound, tone: "bg-blue-100 text-blue-700" },
  devis: { icon: FileText, tone: "bg-purple-100 text-purple-700" },
  facture: { icon: Receipt, tone: "bg-emerald-100 text-emerald-700" },
  trajet: { icon: RouteIcon, tone: "bg-amber-100 text-amber-700" },
  attribution: { icon: ShieldCheck, tone: "bg-indigo-100 text-indigo-700" },
  paiement: { icon: CreditCard, tone: "bg-teal-100 text-teal-700" },
  message: { icon: Mail, tone: "bg-slate-100 text-slate-700" },
  incident: { icon: AlertCircle, tone: "bg-red-100 text-red-700" },
  parametre: { icon: Settings, tone: "bg-gray-100 text-gray-700" },
};

function iconFor(entity: string) {
  return ICONS[entity] ?? { icon: History, tone: "bg-gray-100 text-gray-700" };
}

function AdminHistorique() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as LogRow[]) ?? []);
    } finally { setLoading(false); }
  }

  const entityTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity_type))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (entityFilter !== "all" && r.entity_type !== entityFilter) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.entity_type.toLowerCase().includes(q) ||
        (r.actor_label ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, entityFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    filtered.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(r);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <History className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Historique d'activité</h1>
            <p className="text-sm text-pro-muted">Toutes les actions de la plateforme, chronologiquement.</p>
          </div>
        </div>
      </header>

      <div className="bg-white border border-pro-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" size={16} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (action, acteur, entité)…" className="pl-9" />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Type d'entité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {entityTypes.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-pro-border rounded-xl text-center py-16 text-pro-muted text-sm">
          Aucune activité enregistrée pour le moment.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="text-xs uppercase tracking-wider text-pro-muted font-semibold mb-3 capitalize">{day}</p>
              <div className="bg-white border border-pro-border rounded-xl divide-y divide-pro-border">
                {items.map((r) => {
                  const { icon: Icon, tone } = iconFor(r.entity_type);
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                          <span className="text-xs text-pro-muted">{r.entity_type}</span>
                        </div>
                        <p className="text-sm text-pro-text mt-1">
                          {r.actor_label ?? r.actor_user_id?.slice(0, 8) ?? "système"}
                          {r.metadata?.email && <span className="text-pro-muted"> · {r.metadata.email}</span>}
                        </p>
                        {r.metadata && Object.keys(r.metadata).length > 0 && (
                          <p className="text-[11px] text-pro-muted truncate mt-0.5">{JSON.stringify(r.metadata)}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-pro-muted shrink-0">
                        {new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
