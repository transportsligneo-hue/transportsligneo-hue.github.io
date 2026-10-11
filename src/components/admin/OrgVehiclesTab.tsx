import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AddVehicleDialog } from "@/components/flotte/AddVehicleDialog";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { Button } from "@/components/ui/button";

type Row = { id: string; immatriculation: string | null; marque: string | null; modele: string | null; statut: string; kilometrage: number | null; immobilisation_motif: string | null };

/** Parc véhicules d'une organisation cliente, géré par l'admin avec la même fenêtre que l'espace flotte. */
export function OrgVehiclesTab({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [simDate, setSimDate] = useState("");
  const [running, setRunning] = useState(false);
  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("admin_run_vehicle_automations", { _today: simDate || undefined } as never);
    setRunning(false);
    if (error) { toast.error("Vérification impossible"); return; }
    const r = data as { immobilises: number; remis: number; vehicules: number };
    toast.success(`${r.vehicules} véhicules vérifiés : ${r.immobilises} immobilisés, ${r.remis} remis en service`);
    void load();
  };
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("id, immatriculation, marque, modele, statut, kilometrage, immobilisation_motif")
      .eq("organization_id", organizationId).order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="bg-white border border-pro-border rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{rows.length} véhicule{rows.length > 1 ? "s" : ""}</p>
        <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Date simulée
          <input type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} className="ml-2 rounded-md border px-2 py-1 text-sm" />
        </label>
        <Button variant="outline" onClick={() => void runNow()} disabled={running} className="gap-2">
          {running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Lancer la vérification maintenant
        </Button>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus size={16} /> Ajouter un véhicule</Button>
        </div>
      </div>
      {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucun véhicule dans ce parc.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 py-2.5 text-sm">
              <PlateBadge plate={r.immatriculation} />
              <span className="font-medium">{[r.marque, r.modele].filter(Boolean).join(" ") || "Véhicule"}</span>
              {r.statut === "indispo" && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700" title={r.immobilisation_motif ?? undefined}>Immobilisé{r.immobilisation_motif ? ` : ${r.immobilisation_motif}` : ""}</span>}
              <span className="ml-auto text-muted-foreground">{r.kilometrage != null ? `${r.kilometrage.toLocaleString("fr-FR")} km` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {open && <AddVehicleDialog organizationId={organizationId} onClose={() => setOpen(false)} onSaved={() => void load()} />}
    </div>
  );
}
