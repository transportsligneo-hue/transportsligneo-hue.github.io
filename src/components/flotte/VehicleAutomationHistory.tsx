import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Km = { id: string; kilometrage: number; source: string; statut: string; created_at: string };
type Log = { id: string; automatisme: string; message: string; created_at: string };

const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR");
const SOURCE: Record<string, string> = { mission: "Mission", manuel: "Saisie", import: "Import" };

/** Historique du compteur et journal des automatismes d'un véhicule. */
export function VehicleAutomationHistory({ vehicleId, canManage, onChanged }: { vehicleId: string; canManage?: boolean; onChanged?: () => void }) {
  const [km, setKm] = useState<Km[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("vehicle_km_history").select("id, kilometrage, source, statut, created_at").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(30),
      supabase.from("vehicle_automation_logs").select("id, automatisme, message, created_at").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(30),
    ]);
    setKm((a.data ?? []) as Km[]);
    setLogs((b.data ?? []) as Log[]);
  }, [vehicleId]);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, value?: number) => {
    const { error } = await supabase.rpc("flotte_resolve_km", { _history_id: id, _km: value ?? null } as never);
    if (error) { toast.error("Mise à jour impossible"); return; }
    toast.success("Kilométrage mis à jour");
    void load(); onChanged?.();
  };

  const pts = [...km].filter((k) => k.statut !== "a_verifier").reverse();
  const min = Math.min(...pts.map((p) => p.kilometrage)), max = Math.max(...pts.map((p) => p.kilometrage));
  const path = pts.map((p, i) => `${(i / Math.max(1, pts.length - 1)) * 300},${60 - ((p.kilometrage - min) / Math.max(1, max - min)) * 56 - 2}`).join(" ");

  return (
    <div className="col-span-2 space-y-4 pt-2">
      <div>
        <p className="mb-2 text-sm font-semibold">Historique du kilométrage</p>
        {pts.length > 1 && (
          <svg viewBox="0 0 300 60" className="mb-2 h-16 w-full" aria-hidden>
            <polyline points={path} fill="none" stroke="#8b5cff" strokeWidth="2" />
          </svg>
        )}
        {km.length === 0 ? <p className="text-sm text-muted-foreground">Aucun relevé pour l'instant.</p> : (
          <ul className="divide-y text-sm">
            {km.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-mono">{k.kilometrage.toLocaleString("fr-FR")} km</span>
                <span className="text-muted-foreground">{SOURCE[k.source] ?? k.source} · {fmt(k.created_at)}</span>
                {k.statut === "a_verifier" && (
                  <>
                    <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700">À vérifier</span>
                    {canManage && (
                      <span className="ml-auto flex gap-2">
                        <button className="rounded-md border px-2 py-1 text-xs font-semibold" onClick={() => void resolve(k.id)}>Confirmer</button>
                        <button className="rounded-md border px-2 py-1 text-xs font-semibold" onClick={() => {
                          const v = Number(window.prompt("Kilométrage correct", String(k.kilometrage)));
                          if (Number.isFinite(v) && v > 0) void resolve(k.id, Math.round(v));
                        }}>Corriger</button>
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Journal des automatismes</p>
        {logs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun événement.</p> : (
          <ul className="divide-y text-sm">
            {logs.map((l) => <li key={l.id} className="py-2"><span className="text-muted-foreground">{fmt(l.created_at)}</span> · {l.message}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
