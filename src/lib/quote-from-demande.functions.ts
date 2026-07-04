import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Phase 2 — Devis auto depuis une demande client.
 * Génère un devis lié à la demande (origine='demande_client'), sans supprimer
 * les données existantes. Idempotent : renvoie le devis existant si déjà généré.
 */
export const createQuoteFromDemande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ demandeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Vérifier rôle admin (RLS ferait aussi barrage, mais on court-circuite proprement)
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: demande, error: dErr } = await supabase
      .from("demandes_convoyage")
      .select("*")
      .eq("id", data.demandeId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!demande) throw new Error("Demande introuvable");

    // Idempotent
    if (demande.devis_id) {
      const { data: existing } = await supabase
        .from("devis")
        .select("id, numero, statut, prix_estime")
        .eq("id", demande.devis_id)
        .maybeSingle();
      if (existing) return { ok: true, devis: existing, created: false };
    }

    const prix = Number(demande.prix_estime ?? 0);
    if (!prix || prix <= 0) throw new Error("Prix estimé absent sur la demande — impossible de générer le devis automatiquement.");

    const { data: devis, error: insErr } = await supabase
      .from("devis")
      .insert({
        nom: demande.nom,
        prenom: demande.prenom,
        email: demande.email,
        telephone: demande.telephone,
        depart: demande.depart,
        arrivee: demande.arrivee,
        distance_km: demande.distance_km,
        marque: demande.vehicule_marque ?? demande.marque,
        modele: demande.vehicule_modele ?? demande.modele,
        immatriculation: demande.vehicule_immatriculation ?? demande.immatriculation,
        prix_estime: prix,
        statut: "envoye",
        origine: "demande_client",
        demande_id: demande.id,
      })
      .select("id, numero, statut, prix_estime")
      .single();
    if (insErr) throw insErr;

    await supabase
      .from("demandes_convoyage")
      .update({ devis_id: devis.id, devis_genere_at: new Date().toISOString(), statut: "a_traiter" })
      .eq("id", demande.id);

    return { ok: true, devis, created: true };
  });
