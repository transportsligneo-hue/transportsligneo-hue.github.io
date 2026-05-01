import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, AlertTriangle, RotateCcw, PlayCircle, PauseCircle, CheckCircle2, XCircle, Send } from "lucide-react";
import { Button } from "@/components/admin/AdminUI";

interface AdminLiveControlProps {
  attributionId: string;
  currentStatut: string | null;
  currentEtape: string | null;
  onChange?: () => void;
}

const QUICK_ETAPES = [
  { key: "prise_en_charge", label: "Prise en charge", icon: PlayCircle },
  { key: "edl_depart", label: "EDL Départ", icon: Activity },
  { key: "en_route", label: "En route", icon: Send },
  { key: "edl_arrivee", label: "EDL Arrivée", icon: Activity },
  { key: "livraison", label: "Livraison", icon: CheckCircle2 },
];

const QUICK_STATUTS = [
  { key: "en_cours", label: "Démarrer", icon: PlayCircle, tone: "primary" as const },
  { key: "en_attente_validation", label: "À valider", icon: PauseCircle, tone: "primary" as const },
  { key: "termine", label: "Terminer", icon: CheckCircle2, tone: "primary" as const },
  { key: "annule", label: "Annuler", icon: XCircle, tone: "danger" as const },
];

/**
 * Panneau de contrôle admin live — agit en direct sur l'attribution.
 * Toutes les modifs passent par realtime → Driver et Client voient l'effet immédiatement.
 */
export function AdminLiveControl({ attributionId, currentStatut, currentEtape, onChange }: AdminLiveControlProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const setStatut = async (statut: string) => {
    setBusy(statut);
    const { error } = await supabase.from("attributions").update({ statut }).eq("id", attributionId);
    setBusy(null);
    if (error) {
      toast.error("Échec mise à jour statut");
      return;
    }
    toast.success(`Statut → ${statut}`);
    await supabase.from("mission_etape_history").insert({
      attribution_id: attributionId,
      etape: `admin_statut_${statut}`,
      notes: "Modifié par admin",
    });
    onChange?.();
  };

  const forceEtape = async (etape: string) => {
    setBusy(etape);
    const { error } = await supabase
      .from("attributions")
      .update({ etape_courante: etape })
      .eq("id", attributionId);
    if (!error) {
      await supabase.from("mission_etape_history").insert({
        attribution_id: attributionId,
        etape: `admin_force_${etape}`,
        notes: "Étape forcée par admin",
      });
      toast.success(`Étape → ${etape}`);
      onChange?.();
    } else toast.error("Échec mise à jour étape");
    setBusy(null);
  };

  const reopenMission = async () => {
    setBusy("reopen");
    const { error } = await supabase.from("attributions").update({ statut: "en_cours" }).eq("id", attributionId);
    if (!error) {
      await supabase.from("mission_etape_history").insert({
        attribution_id: attributionId,
        etape: "admin_reopen",
        notes: "Mission ré-ouverte par admin",
      });
      toast.success("Mission ré-ouverte");
      onChange?.();
    }
    setBusy(null);
  };

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <h3 className="text-pro-text font-semibold text-sm">Contrôle live admin</h3>
        <span className="ml-auto text-[11px] text-pro-muted">
          Statut : <strong className="text-pro-text-soft">{currentStatut ?? "—"}</strong> · Étape :{" "}
          <strong className="text-pro-text-soft">{currentEtape ?? "—"}</strong>
        </span>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-pro-muted mb-2">Changer le statut</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_STATUTS.map((s) => (
            <Button
              key={s.key}
              tone={s.tone}
              icon={<s.icon size={13} />}
              onClick={() => setStatut(s.key)}
              disabled={busy === s.key || currentStatut === s.key}
              className="text-xs"
            >
              {s.label}
            </Button>
          ))}
          {currentStatut === "termine" && (
            <Button tone="primary" icon={<RotateCcw size={13} />} onClick={reopenMission} disabled={busy === "reopen"} className="text-xs">
              Ré-ouvrir
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wide text-pro-muted mb-2">Forcer l'étape courante</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ETAPES.map((e) => (
            <button
              key={e.key}
              onClick={() => forceEtape(e.key)}
              disabled={busy === e.key || currentEtape === e.key}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                currentEtape === e.key
                  ? "border-pro-accent/40 bg-pro-accent/10 text-pro-accent"
                  : "border-pro-border text-pro-text-soft hover:border-pro-accent/30 hover:text-pro-text"
              } disabled:opacity-50`}
            >
              <e.icon size={12} />
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
        <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[11px] text-amber-900 leading-snug">
          Toutes les actions sont propagées en temps réel au convoyeur et au client. Une trace est ajoutée à l'historique.
        </p>
      </div>
    </div>
  );
}
