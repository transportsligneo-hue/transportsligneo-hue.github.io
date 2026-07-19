/**
 * AdminStepOverridesPanel · Surcouche admin contrôle total.
 *
 * Permet à l'admin de bypasser / désactiver les étapes obligatoires d'une
 * mission (selfie identité, double signature départ, double signature arrivée,
 * EDL départ, EDL arrivée).
 *
 * Modes :
 *   - skip    : étape ignorée pour cette mission (le driver n'est pas bloqué)
 *   - disable : étape totalement désactivée et masquée
 *   - force   : étape forcée même si le système l'aurait sautée (réservé futur)
 *
 * Écrit dans public.mission_step_overrides (RLS admin only).
 */
import { useEffect, useState } from "react";
import { Shield, ShieldOff, Loader2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/admin/AdminUI";

interface Props {
  attributionId: string;
}

interface Override {
  id: string;
  step_key: string;
  override_mode: "skip" | "force" | "disable";
  reason: string | null;
  created_at: string;
}

const STEPS: { key: string; label: string }[] = [
  { key: "selfie", label: "Selfie identité (Étape 0)" },
  { key: "driver_start", label: "Signature convoyeur · départ" },
  { key: "client_start", label: "Signature client · départ" },
  { key: "edl_depart", label: "État des lieux · départ" },
  { key: "driver_end", label: "Signature convoyeur · arrivée" },
  { key: "client_end", label: "Signature client · arrivée" },
  { key: "edl_arrivee", label: "État des lieux · arrivée" },
];

export function AdminStepOverridesPanel({ attributionId }: Props) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mission_step_overrides" as never)
      .select("id,step_key,override_mode,reason,created_at")
      .eq("attribution_id" as never, attributionId as never);
    setOverrides((data as unknown as Override[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [attributionId]);

  const setOverride = async (step_key: string, mode: "skip" | "disable") => {
    setBusy(step_key);
    try {
      const reason = window.prompt(`Motif du bypass admin pour "${step_key}" ?`, "Décision admin") ?? "";
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("mission_step_overrides" as never).upsert({
        attribution_id: attributionId,
        step_key,
        override_mode: mode,
        reason: reason || null,
        created_by: u.user?.id ?? null,
      } as never, { onConflict: "attribution_id,step_key" });
      if (error) throw error;
      toast.success("Override appliqué");
      await load();
    } catch (e) {
      toast.error("Échec", { description: e instanceof Error ? e.message : "" });
    } finally { setBusy(null); }
  };

  const removeOverride = async (id: string) => {
    setBusy(id);
    try {
      const { error } = await supabase.from("mission_step_overrides" as never).delete().eq("id" as never, id as never);
      if (error) throw error;
      toast.success("Override retiré");
      await load();
    } catch (e) {
      toast.error("Échec", { description: e instanceof Error ? e.message : "" });
    } finally { setBusy(null); }
  };

  const findOverride = (key: string) => overrides.find(o => o.step_key === key);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-[#d4af37]" />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Contrôle étapes · Bypass admin
        </h3>
        {loading && <Loader2 size={14} className="animate-spin text-pro-muted ml-auto" />}
      </div>
      <p className="text-xs text-pro-muted mb-3">
        Désactiver ou ignorer une étape obligatoire pour cette mission. Action tracée et réversible.
      </p>
      <div className="space-y-1.5">
        {STEPS.map(s => {
          const ov = findOverride(s.key);
          return (
            <div key={s.key} className="flex items-center gap-2 p-2 rounded-lg border border-pro-border bg-white">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-pro-text truncate">{s.label}</p>
                {ov ? (
                  <p className="text-[10px] text-amber-700 flex items-center gap-1">
                    <ShieldOff size={10}/> {ov.override_mode}{ov.reason ? ` · ${ov.reason}` : ""}
                  </p>
                ) : (
                  <p className="text-[10px] text-pro-muted">Étape active</p>
                )}
              </div>
              {ov ? (
                <button
                  onClick={() => removeOverride(ov.id)}
                  disabled={busy === ov.id}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded flex items-center gap-1 disabled:opacity-50"
                >
                  {busy === ov.id ? <Loader2 size={11} className="animate-spin"/> : <Trash2 size={11}/>} Retirer
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setOverride(s.key, "skip")}
                    disabled={busy === s.key}
                    className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 disabled:opacity-50 flex items-center gap-1"
                  >
                    {busy === s.key ? <Loader2 size={11} className="animate-spin"/> : <Check size={11}/>} Skip
                  </button>
                  <button
                    onClick={() => setOverride(s.key, "disable")}
                    disabled={busy === s.key}
                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
                  >
                    <ShieldOff size={11}/> Désactiver
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
