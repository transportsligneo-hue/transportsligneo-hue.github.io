import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, Loader2, Save, Lock } from "lucide-react";
import { Card, Button, FormField, TextInput } from "@/components/admin/AdminUI";

/**
 * Édition du prix d'une mission (admin) — disponible sur TOUTES les missions
 * (simple, livraison, restitution, livraison + restitution).
 *
 * - Prix client : écrit sur le trajet (prix / prix_client) et figé sur la mission
 *   côté client via l'RPC admin_set_mission_prix (prix par client, mission par mission).
 * - Rémunération convoyeur : écrite sur le trajet (prix_convoyeur / tarif_convoyeur).
 */
export function MissionPriceCard({
  trajetId,
  groupId,
  legType,
  currentPrix,
  currentPrixConvoyeur,
  onSaved,
}: {
  trajetId: string;
  groupId?: string | null;
  legType?: string | null;
  currentPrix: number | null;
  currentPrixConvoyeur?: number | null;
  onSaved?: (next: { prix: number | null; prixConvoyeur: number | null }) => void;
}) {
  const [prixClient, setPrixClient] = useState(currentPrix != null ? String(currentPrix) : "");
  const [prixConvoyeur, setPrixConvoyeur] = useState(
    currentPrixConvoyeur != null ? String(currentPrixConvoyeur) : "",
  );
  const [missionId, setMissionId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrixClient(currentPrix != null ? String(currentPrix) : "");
  }, [currentPrix]);

  useEffect(() => {
    setPrixConvoyeur(currentPrixConvoyeur != null ? String(currentPrixConvoyeur) : "");
  }, [currentPrixConvoyeur]);

  // Retrouve la mission côté client liée à ce trajet (via mission_id, sinon via le groupe A/R)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: tj } = await supabase
        .from("trajets")
        .select("mission_id")
        .eq("id", trajetId)
        .maybeSingle();
      let id = (tj as { mission_id?: string | null } | null)?.mission_id ?? null;

      if (!id && groupId) {
        const { data: m } = await supabase
          .from("missions")
          .select("id")
          .eq("mission_group_id", groupId)
          .eq("leg_type", legType ?? "simple")
          .limit(1)
          .maybeSingle();
        id = (m as { id?: string } | null)?.id ?? null;
      }
      if (cancelled) return;
      setMissionId(id);
      if (!id) return;
      const { data: mm } = await supabase
        .from("missions")
        .select("prix_locked")
        .eq("id", id)
        .maybeSingle();
      if (!cancelled) setLocked(Boolean((mm as { prix_locked?: boolean | null } | null)?.prix_locked));
    })();
    return () => {
      cancelled = true;
    };
  }, [trajetId, groupId, legType]);

  const parse = (v: string) => {
    const t = v.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const save = async () => {
    const pc = parse(prixClient);
    const pv = parse(prixConvoyeur);
    if (Number.isNaN(pc) || Number.isNaN(pv) || pc == null) {
      toast.error("Prix client invalide");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc(
        "admin_update_trajet_prix" as never,
        { _trajet_id: trajetId, _prix: pc, _prix_convoyeur: pv } as never,
      );
      if (error) throw error;
      const res = (data ?? {}) as {
        devis_updated?: boolean;
        facture_updated?: boolean;
        facture_blocked?: boolean;
      };
      setLocked(true);
      const sync: string[] = ["Espace client", "Admin — Attributions & Missions"];
      if (res.devis_updated) sync.unshift("Devis client");
      if (res.facture_updated) sync.unshift("Facture");
      toast.success("Prix mis à jour et synchronisé", { description: sync.join(" · ") });
      if (res.facture_blocked) {
        toast.warning("Facture déjà émise", {
          description: "Le montant de la facture n'a pas été modifié : émettez un avoir ou une facture rectificative.",
        });
      }
      onSaved?.({ prix: pc, prixConvoyeur: pv });
    } catch (e) {
      toast.error("Impossible d'enregistrer le prix", {
        description: e instanceof Error ? e.message : "",
      });
    } finally {
      setSaving(false);
    }
  };

  const pc = parse(prixClient);
  const pv = parse(prixConvoyeur);
  const marge =
    typeof pc === "number" && pc > 0 && typeof pv === "number"
      ? { eur: pc - pv, pct: ((pc - pv) / pc) * 100 }
      : null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-pro-text flex items-center gap-2">
          <Banknote size={15} className="text-pro-accent" />
          Prix de la mission
        </h3>
        {locked && (
          <span className="inline-flex items-center gap-1 text-[11px] text-pro-muted">
            <Lock size={11} /> Prix figé côté client
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Prix client TTC (€)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={prixClient}
            onChange={(e) => setPrixClient(e.target.value)}
            placeholder="ex: 380"
          />
        </FormField>
        <FormField label="Rémunération convoyeur (€)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={prixConvoyeur}
            onChange={(e) => setPrixConvoyeur(e.target.value)}
            placeholder="ex: 240"
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <p className="text-[12px] text-pro-text-soft">
          {marge
            ? `Marge : ${marge.eur.toFixed(0)} € (${marge.pct.toFixed(1)} %)`
            : "Saisissez le prix client et la rémunération convoyeur pour voir la marge."}
        </p>
        <Button
          variant="primary"
          onClick={save}
          disabled={saving}
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        >
          {saving ? "Enregistrement…" : "Enregistrer le prix"}
        </Button>
      </div>
    </Card>
  );
}
