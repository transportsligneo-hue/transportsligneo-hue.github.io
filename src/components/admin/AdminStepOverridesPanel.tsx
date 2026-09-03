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
 *
 * Écrit dans public.mission_step_overrides (RLS admin only).
 */
import { useEffect, useState } from "react";
import {
  Shield, ShieldOff, Loader2, RotateCcw, SkipForward, CheckCircle2, Camera,
  PenLine, ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, Badge, Button, Modal, TextInput } from "@/components/admin/AdminUI";

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

type StepDef = { key: string; label: string; group: string; icon: typeof Camera };

const STEPS: StepDef[] = [
  { key: "selfie", label: "Selfie identité", group: "Départ", icon: Camera },
  { key: "driver_start", label: "Signature convoyeur", group: "Départ", icon: PenLine },
  { key: "client_start", label: "Signature client", group: "Départ", icon: PenLine },
  { key: "edl_depart", label: "État des lieux", group: "Départ", icon: ClipboardCheck },
  { key: "driver_end", label: "Signature convoyeur", group: "Arrivée", icon: PenLine },
  { key: "client_end", label: "Signature client", group: "Arrivée", icon: PenLine },
  { key: "edl_arrivee", label: "État des lieux", group: "Arrivée", icon: ClipboardCheck },
];

const GROUPS = ["Départ", "Arrivée"];

export function AdminStepOverridesPanel({ attributionId }: Props) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ step: StepDef; mode: "skip" | "disable" } | null>(null);
  const [reason, setReason] = useState("Décision admin");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("mission_step_overrides" as never)
      .select("id,step_key,override_mode,reason,created_at")
      .eq("attribution_id" as never, attributionId as never);
    if (error) toast.error("Chargement des bypass impossible", { description: error.message });
    setOverrides((data as unknown as Override[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [attributionId]);

  const applyOverride = async () => {
    if (!pending) return;
    const { step, mode } = pending;
    setBusy(step.key);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("mission_step_overrides" as never).upsert({
        attribution_id: attributionId,
        step_key: step.key,
        override_mode: mode,
        reason: reason.trim() || null,
        created_by: u.user?.id ?? null,
      } as never, { onConflict: "attribution_id,step_key" });
      if (error) throw error;
      toast.success(mode === "skip" ? "Étape ignorée pour cette mission" : "Étape désactivée");
      setPending(null);
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
      toast.success("Étape réactivée");
      await load();
    } catch (e) {
      toast.error("Échec", { description: e instanceof Error ? e.message : "" });
    } finally { setBusy(null); }
  };

  const findOverride = (key: string) => overrides.find((o) => o.step_key === key);
  const activeCount = overrides.length;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-pro-accent/10 flex items-center justify-center">
          <Shield size={16} className="text-pro-accent" />
        </span>
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Contrôle des étapes
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <Badge tone="warning" icon={<ShieldOff size={11} />}>
              {activeCount} bypass
            </Badge>
          )}
          {loading && <Loader2 size={14} className="animate-spin text-pro-muted" />}
        </div>
      </div>
      <p className="text-xs text-pro-muted mb-4">
        Ignorer ou désactiver une étape obligatoire pour cette mission. Prise en compte
        immédiate côté convoyeur, action tracée et réversible.
      </p>

      <div className="space-y-4">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pro-muted mb-2">
              {group}
            </p>
            <div className="rounded-xl border border-pro-border overflow-hidden divide-y divide-pro-border">
              {STEPS.filter((s) => s.group === group).map((s) => {
                const ov = findOverride(s.key);
                const Icon = s.icon;
                const rowBusy = busy === s.key || (ov && busy === ov.id);
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${ov ? "bg-amber-50/60" : "bg-white hover:bg-pro-bg-soft"}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ov ? "bg-amber-100 text-amber-700" : "bg-pro-bg-soft text-pro-muted"}`}>
                      <Icon size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-pro-text truncate">{s.label}</p>
                      {ov ? (
                        <p className="text-[11px] text-amber-700 truncate">
                          {ov.override_mode === "skip" ? "Ignorée" : "Désactivée"}
                          {ov.reason ? ` · ${ov.reason}` : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] text-pro-muted flex items-center gap-1">
                          <CheckCircle2 size={11} className="text-emerald-500" /> Étape active
                        </p>
                      )}
                    </div>
                    {ov ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!!rowBusy}
                        onClick={() => removeOverride(ov.id)}
                        icon={rowBusy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                      >
                        Réactiver
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!!rowBusy}
                          onClick={() => { setReason("Décision admin"); setPending({ step: s, mode: "skip" }); }}
                          icon={<SkipForward size={12} />}
                        >
                          Ignorer
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!!rowBusy}
                          onClick={() => { setReason("Décision admin"); setPending({ step: s, mode: "disable" }); }}
                          icon={<ShieldOff size={12} />}
                        >
                          Désactiver
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.mode === "disable" ? "Désactiver l'étape" : "Ignorer l'étape"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-pro-text-soft">
            {pending?.step.group} · <strong>{pending?.step.label}</strong> —{" "}
            {pending?.mode === "disable"
              ? "l'étape sera totalement retirée du parcours convoyeur."
              : "le convoyeur pourra passer à l'étape suivante sans la réaliser."}
          </p>
          <div>
            <label className="block text-xs font-medium text-pro-muted mb-1">Motif (tracé)</label>
            <TextInput
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif du bypass"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPending(null)}>Annuler</Button>
            <Button
              variant={pending?.mode === "disable" ? "danger" : "primary"}
              disabled={!!busy}
              onClick={applyOverride}
              icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
