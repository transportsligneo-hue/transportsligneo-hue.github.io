import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Loader2, Unlink, Ban, Save, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MissionLegBadge } from "@/components/mission/MissionLegBadge";
import { confirmToast } from "@/lib/confirm-toast";

type Twin = { attributionId: string | null; trajetId: string; leg_type: string | null; numero: string | null };

export function AdminMissionARBanner({
  trajetId,
  groupId,
  legType,
  currentPrix,
  onPriceSaved,
  onGroupChanged,
}: {
  trajetId: string;
  groupId: string | null;
  legType: string | null;
  currentPrix: number | null;
  onPriceSaved?: (nextPrice: number) => void;
  onGroupChanged?: () => void;
}) {
  const [twin, setTwin] = useState<Twin | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [priceInput, setPriceInput] = useState(String(currentPrix ?? ""));
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [working, setWorking] = useState<"" | "unlink" | "cancel">("");

  useEffect(() => {
    setPriceInput(String(currentPrix ?? ""));
  }, [currentPrix]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Trouve la mission côté client correspondante (même group, même leg)
      if (groupId) {
        const { data: mine } = await supabase
          .from("missions")
          .select("id, prix_locked, prix_total")
          .eq("mission_group_id", groupId)
          .eq("leg_type", legType ?? "simple")
          .limit(1)
          .maybeSingle();
        if (!cancelled && mine) {
          setMissionId((mine as { id: string }).id);
          setLocked(Boolean((mine as { prix_locked?: boolean | null }).prix_locked));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, legType]);

  useEffect(() => {
    if (!groupId) { setTwin(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: tj } = await supabase
        .from("trajets")
        .select("id, leg_type")
        .eq("mission_group_id", groupId)
        .neq("id", trajetId)
        .limit(1)
        .maybeSingle();
      if (cancelled || !tj) { if (!cancelled) { setTwin(null); setLoading(false); } return; }
      const twinTrajetId = (tj as { id: string }).id;
      const twinLeg = (tj as { leg_type?: string | null }).leg_type ?? null;
      const { data: attr } = await supabase
        .from("attributions")
        .select("id, numero_mission")
        .eq("trajet_id", twinTrajetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setTwin({
        attributionId: (attr as { id?: string } | null)?.id ?? null,
        trajetId: twinTrajetId,
        leg_type: twinLeg,
        numero: (attr as { numero_mission?: string } | null)?.numero_mission ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [groupId, trajetId]);

  if (!groupId || legType === "simple" || !legType) return null;

  const savePrice = async () => {
    const parsed = Number(priceInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Prix invalide");
      return;
    }
    setSaving(true);
    try {
      // Trajet : source opérationnelle
      const { error: tErr } = await supabase
        .from("trajets")
        .update({ prix: parsed, prix_client: parsed } as never)
        .eq("id", trajetId);
      if (tErr) throw tErr;
      // Mission côté client : figée
      if (missionId) {
        const { error: mErr } = await supabase.rpc(
          "admin_set_mission_prix" as never,
          { _mission_id: missionId, _prix: parsed } as never,
        );
        if (mErr) throw mErr;
        setLocked(true);
      }
      toast.success("Prix mis à jour", { description: "Prix figé sur cette mission uniquement." });
      onPriceSaved?.(parsed);
      setEditing(false);
    } catch (e) {
      toast.error("Impossible d'enregistrer", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const doUnlink = async () => {
    const ok = await confirmToast("Dissocier ce groupe aller-retour ?", {
      description: "Les deux missions deviennent totalement indépendantes. Elles conservent leur numéro et leurs données.",
      confirmLabel: "Dissocier",
    });
    if (!ok) return;
    setWorking("unlink");
    try {
      if (missionId) {
        const { error } = await supabase.rpc(
          "admin_unlink_mission_from_group" as never,
          { _mission_id: missionId } as never,
        );
        if (error) throw error;
      }
      // Nettoie aussi le groupe côté trajets
      const { error: tErr } = await supabase
        .from("trajets")
        .update({ mission_group_id: null, leg_type: "simple", leg_index: 1 } as never)
        .eq("mission_group_id", groupId);
      if (tErr) throw tErr;
      toast.success("Groupe dissocié");
      onGroupChanged?.();
    } catch (e) {
      toast.error("Échec de la dissociation", { description: e instanceof Error ? e.message : "" });
    } finally {
      setWorking("");
    }
  };

  const doCancelLeg = async () => {
    const ok = await confirmToast({
      title: `Annuler la mission ${legType === "aller" ? "Aller" : "Retour"} ?`,
      message: "L'autre sens reste actif et opérationnel.",
      confirmLabel: "Annuler ce sens",
    });
    if (!ok) return;
    setWorking("cancel");
    try {
      const { error: tErr } = await supabase
        .from("trajets")
        .update({ statut: "annule", statut_publication: "annule" } as never)
        .eq("id", trajetId);
      if (tErr) throw tErr;
      if (missionId) {
        const { error } = await supabase.rpc(
          "admin_cancel_mission_leg" as never,
          { _mission_id: missionId } as never,
        );
        if (error) throw error;
      }
      toast.success("Sens annulé");
      onGroupChanged?.();
    } catch (e) {
      toast.error("Échec de l'annulation", { description: e instanceof Error ? e.message : "" });
    } finally {
      setWorking("");
    }
  };

  return (
    <div className="rounded-xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-amber-500/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <MissionLegBadge leg={legType as "aller" | "retour"} />
        <div className="text-sm text-white/85">
          <span className="font-medium">Mission {legType === "aller" ? "Aller" : "Retour"}</span>
          <span className="text-white/50"> · fait partie d'un aller-retour éclaté</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {loading ? (
            <span className="inline-flex items-center gap-1 text-xs text-white/60">
              <Loader2 size={12} className="animate-spin" /> Recherche du jumeau…
            </span>
          ) : twin?.attributionId ? (
            <Link
              to="/admin/missions/$missionId"
              params={{ missionId: twin.attributionId }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-100 underline-offset-2 hover:underline"
            >
              <ArrowLeftRight size={12} />
              Voir la mission {twin.leg_type === "retour" ? "Retour" : "Aller"}
              {twin.numero ? <span className="font-mono text-[11px] text-white/60">{twin.numero}</span> : null}
            </Link>
          ) : twin ? (
            <span className="text-xs text-white/50">Jumelle sans attribution</span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-white/60">Prix ce sens</span>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="w-24 px-2 py-1 rounded bg-black/30 border border-white/15 text-white text-sm"
              />
              <span className="text-white/60 text-sm">€</span>
              <button
                onClick={savePrice}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-xs disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Enregistrer
              </button>
              <button
                onClick={() => { setEditing(false); setPriceInput(String(currentPrix ?? "")); }}
                className="px-2 py-1 rounded text-xs text-white/60 hover:text-white"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-indigo-300"
              title="Modifier le prix de ce sens"
            >
              {Number(currentPrix ?? 0).toFixed(2)} €
              {locked ? <Lock size={11} className="text-amber-400" /> : null}
            </button>
          )}
          {locked && !editing ? (
            <span className="text-[10px] uppercase tracking-wider text-amber-300/90">figé manuellement</span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={doCancelLeg}
            disabled={!!working}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border border-red-400/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {working === "cancel" ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
            Annuler ce sens
          </button>
          <button
            onClick={doUnlink}
            disabled={!!working}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border border-white/20 text-white/80 hover:bg-white/5 disabled:opacity-50"
          >
            {working === "unlink" ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
            Dissocier
          </button>
        </div>
      </div>
    </div>
  );
}
