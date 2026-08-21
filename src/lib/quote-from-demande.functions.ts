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

    const [{ data: isAdmin, error: adminRoleError }, { data: isSuperAdmin, error: superRoleError }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (adminRoleError) throw adminRoleError;
    if (superRoleError) throw superRoleError;
    if (!isAdmin && !isSuperAdmin) throw new Error("Accès administrateur requis");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: demande, error: dErr } = await supabaseAdmin
      .from("demandes_convoyage")
      .select("*")
      .eq("id", data.demandeId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!demande) throw new Error("Demande introuvable");

    // Idempotent
    if (demande.devis_id) {
      const { data: existing } = await supabaseAdmin
        .from("devis")
        .select("id, numero, statut, prix_estime")
        .eq("id", demande.devis_id)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("devis")
          .update({ demande_id: demande.id })
          .eq("id", existing.id)
          .is("demande_id", null);
        return { ok: true, devis: existing, created: false };
      }
    }

    const prix = Number(demande.prix_estime ?? 0);
    if (!prix || prix <= 0) throw new Error("Prix estimé absent sur la demande — impossible de générer le devis automatiquement.");

    const { data: devis, error: insErr } = await supabaseAdmin
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
        vin: demande.vehicule_vin ?? null,
        option_trajet: demande.options,
        date_souhaitee: demande.date_souhaitee,
        heure_souhaitee: demande.heure_souhaitee,
        depart_retour: demande.depart_retour,
        arrivee_retour: demande.arrivee_retour,
        date_retour: demande.date_retour,
        heure_retour: demande.heure_retour,
        recuperation_retour_identique: demande.recuperation_retour_identique,
        adresse_recuperation_retour: demande.adresse_recuperation_retour,
        marque_retour: demande.marque_retour,
        modele_retour: demande.modele_retour,
        immatriculation_retour: demande.immatriculation_retour,
        vin_retour: demande.vin_retour,
        prix_estime: prix,
        statut: "envoye",
        origine: "demande_client",
        demande_id: demande.id,
        mission_group_id: demande.mission_group_id,
        group_reference: demande.group_reference,
      })
      .select("id, numero, statut, prix_estime")
      .single();
    if (insErr) throw insErr;

    const { error: linkError } = await supabaseAdmin
      .from("demandes_convoyage")
      .update({ devis_id: devis.id, devis_genere_at: new Date().toISOString(), statut: "a_traiter" })
      .eq("id", demande.id);
    if (linkError) throw linkError;

    return { ok: true, devis, created: true };
  });
