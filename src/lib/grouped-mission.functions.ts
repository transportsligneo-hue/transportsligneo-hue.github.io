import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const vehicleSchema = z.object({
  vehicleId: z.string().uuid(),
  immatriculation: z.string().max(32).nullable().optional(),
  marque: z.string().max(120).nullable().optional(),
  modele: z.string().max(120).nullable().optional(),
  energie: z.string().max(60).nullable().optional(),
  arrivee: z.string().min(2).max(400),
  prixTtc: z.number().min(0).max(100000),
});

const inputSchema = z.object({
  depart: z.string().min(2).max(400),
  date: z.string().min(1).max(20),
  timeSlot: z.enum(["matin", "apres_midi", "journee"]),
  message: z.string().max(2000).optional().default(""),
  vehicles: z.array(vehicleSchema).min(1).max(50),
});

/**
 * Crée N demandes de convoyage liées par un mission_group_id + group_reference commun.
 * Chaque ligne suit ensuite le cycle de vie normal (devis, attribution, etc.).
 */
export const createGroupedMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Profil client
    const { data: profile } = await supabase
      .from("profiles")
      .select("nom, prenom, email, telephone, societe, pricing_display_mode")
      .eq("user_id", userId)
      .maybeSingle();

    const email = profile?.email;
    if (!email) throw new Error("Profil client incomplet");

    // Génère group_id + group_reference
    const groupId = crypto.randomUUID();
    const { data: refData, error: refErr } = await supabase.rpc(
      "generate_group_reference",
    );
    if (refErr) throw refErr;
    const groupReference = refData as unknown as string;

    const heureText =
      data.timeSlot === "matin"
        ? "Matin (8h-12h)"
        : data.timeSlot === "apres_midi"
          ? "Après-midi (13h-18h)"
          : "Journée complète";

    const rows = data.vehicles.map((v) => ({
      user_id: userId,
      nom: profile?.nom || "Client",
      prenom: profile?.prenom || "",
      email,
      telephone: profile?.telephone || "",
      depart: data.depart,
      arrivee: v.arrivee,
      date_souhaitee: data.date,
      heure_souhaitee: heureText,
      message: [
        `[Mission groupée ${groupReference}]`,
        data.message,
        profile?.societe ? `Société : ${profile.societe}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      options: "aller-simple",
      options_meta: {},
      statut: "nouvelle",
      prix_estime: v.prixTtc,
      pricing_display_mode: profile?.pricing_display_mode ?? "ttc",
      vehicule_immatriculation: v.immatriculation ?? null,
      vehicule_marque: v.marque ?? null,
      vehicule_modele: v.modele ?? null,
      vehicule_energie: v.energie ?? null,
      immatriculation: v.immatriculation ?? "",
      marque: v.marque ?? "",
      modele: v.modele ?? "",
      carburant: v.energie ?? "",
      mission_group_id: groupId,
      group_reference: groupReference,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("demandes_convoyage")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any)
      .select("id");
    if (insErr) throw insErr;

    return {
      groupReference,
      groupId,
      demandeIds: (inserted ?? []).map((r) => r.id as string),
      count: rows.length,
    };
  });
