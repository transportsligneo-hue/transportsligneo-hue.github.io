/**
 * useMissionGates — récupère les selfies, signatures et overrides admin
 * pour une mission donnée. Sert à savoir si une étape obligatoire est
 * remplie ou bypassée par un admin.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SignatureKind = "driver_start" | "client_start" | "driver_end" | "client_end";
export type StepKey = "selfie" | "driver_start" | "client_start" | "driver_end" | "client_end" | "edl_depart" | "edl_arrivee" | "pv_livraison" | "carte_grise" | string;
export type OverrideMode = "skip" | "force" | "disable";

interface Selfie { id: string; storage_path: string; taken_at: string }
interface Signature { id: string; kind: SignatureKind; signer_name: string; signed_at: string }
interface Override { step_key: string; override_mode: OverrideMode }

export function useMissionGates(attributionId: string | null) {
  const [selfies, setSelfies] = useState<Selfie[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!attributionId) return;
    setLoading(true);
    const [s1, s2, s3] = await Promise.all([
      supabase.from("mission_selfies" as never).select("id,storage_path,taken_at").eq("attribution_id" as never, attributionId as never),
      supabase.from("mission_signatures" as never).select("id,kind,signer_name,signed_at").eq("attribution_id" as never, attributionId as never),
      supabase.from("mission_step_overrides" as never).select("step_key,override_mode").eq("attribution_id" as never, attributionId as never),
    ]);
    setSelfies((s1.data as unknown as Selfie[]) ?? []);
    setSignatures((s2.data as unknown as Signature[]) ?? []);
    setOverrides((s3.data as unknown as Override[]) ?? []);
    setLoading(false);
  }, [attributionId]);

  useEffect(() => { reload(); }, [reload]);

  const isOverridden = (key: StepKey, mode: OverrideMode = "skip") =>
    overrides.some(o => o.step_key === key && o.override_mode === mode);
  const isDisabled = (key: StepKey) => isOverridden(key, "disable") || isOverridden(key, "skip");

  const hasSelfie = selfies.length > 0;
  const hasSignature = (k: SignatureKind) => signatures.some(s => s.kind === k);

  return { selfies, signatures, overrides, loading, reload, isOverridden, isDisabled, hasSelfie, hasSignature };
}
