import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContratCadre {
  id: string;
  user_id: string;
  actif: boolean;
  demandes_sans_devis: boolean;
  validation_auto: boolean;
  signe_le: string | null;
  valable_jusqua: string | null;
  remise_pct: number;
  plafond_ttc: number | null;
  pdf_path: string | null;
  notes: string | null;
}

/** Vrai si le contrat autorise aujourd'hui les demandes rapides. */
export function contratActif(c: ContratCadre | null | undefined): boolean {
  if (!c || !c.actif || !c.demandes_sans_devis) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (c.signe_le && c.signe_le > today) return false;
  if (c.valable_jusqua && c.valable_jusqua < today) return false;
  return true;
}

/** Contrat-cadre du client connecté (null s'il n'en a pas ou s'il n'est plus valable). */
export function useMonContratCadre(userId: string | undefined) {
  const [contrat, setContrat] = useState<ContratCadre | null>(null);
  useEffect(() => {
    if (!userId) return;
    let off = false;
    void (async () => {
      const { data } = await supabase.from("contrats_cadres" as never).select("*").eq("user_id" as never, userId as never).maybeSingle();
      if (!off) setContrat(contratActif(data as unknown as ContratCadre) ? (data as unknown as ContratCadre) : null);
    })();
    return () => { off = true; };
  }, [userId]);
  return contrat;
}

export const prixContrat = (ttc: number, remisePct: number) =>
  Math.round(ttc * (1 - (remisePct || 0) / 100) * 100) / 100;
