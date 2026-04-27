import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function AdminHistorique() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as LogRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  const entityTypes = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.entity_type))).sort();
  }, [rows]);

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

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-pro-accent/10 flex items-center justify-center">
            <History className="text-pro-accent" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-pro-text">Historique &amp; activité</h1>
            <p className="text-sm text-pro-muted">Audit log centralisé de toutes les actions de la plateforme.</p>
          </div>
        </div>
      </header>

      <div className="bg-white border border-pro-border rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (action, acteur, entité)…"
            className="pl-9"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Type d'entité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les entités</SelectItem>
            {entityTypes.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-pro-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-pro-accent" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-pro-muted text-sm">Aucune activité.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Acteur</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-pro-muted whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                  <TableCell className="text-sm">{r.entity_type}</TableCell>
                  <TableCell className="text-xs text-pro-text-soft">{r.actor_label ?? r.actor_user_id?.slice(0, 8) ?? "système"}</TableCell>
                  <TableCell className="text-xs text-pro-muted max-w-md truncate">
                    {r.metadata ? JSON.stringify(r.metadata) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
