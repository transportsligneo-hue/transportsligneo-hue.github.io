import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const vehicleSchema = z.object({
  vehicleId: z.string().max(64).nullable().optional(),
  immatriculation: z.string().max(32).nullable().optional(),
  vin: z.string().max(64).nullable().optional(),
  marque: z.string().max(120).nullable().optional(),
  modele: z.string().max(120).nullable().optional(),
  energie: z.string().max(60).nullable().optional(),
  type: z.string().max(60).nullable().optional(),
  km: z.number().int().min(0).max(3000000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  arrivee: z.string().min(2).max(400),
  prixTtc: z.number().min(0).max(100000),
  optionsMeta: z.record(z.string(), z.boolean()).optional().default({}),
});

const inputSchema = z.object({
  depart: z.string().min(2).max(400),
  date: z.string().min(1).max(20),
  heure: z.string().max(20).optional().default(""),
  timeSlot: z.enum(["matin", "apres_midi", "journee"]).optional(),
  contactDepartNom: z.string().max(160).optional().default(""),
  contactDepartTel: z.string().max(40).optional().default(""),
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

    // L'email peut venir du profil ou du token JWT (comptes flotte créés par un admin)
    const email = (profile?.email || (context.claims?.email as string | undefined) || "").trim();
    if (!email) throw new Error("Profil client incomplet : aucune adresse email");

    // La policy RLS d'insertion exige nom ET prénom non vides.
    const nom = (profile?.nom || profile?.societe || email.split("@")[0] || "Client").trim();
    const prenom = (profile?.prenom || profile?.societe || "Pro").trim();

    // Génère group_id + group_reference
    const groupId = crypto.randomUUID();
    const { data: refData, error: refErr } = await supabase.rpc(
      "generate_group_reference",
    );
    if (refErr) throw refErr;
    const groupReference = refData as unknown as string;

    const heureText =
      data.heure ||
      (data.timeSlot === "matin"
        ? "Matin (8h-12h)"
        : data.timeSlot === "apres_midi"
          ? "Après-midi (13h-18h)"
          : data.timeSlot === "journee"
            ? "Journée complète"
            : "");

    // 1) Devis unique couvrant l'ensemble du groupe (visible immédiatement
    //    côté client dans "Factures & devis" et côté admin dans "Devis").
    const totalTtc =
      Math.round(data.vehicles.reduce((s, v) => s + (v.prixTtc || 0), 0) * 100) / 100;
    const firstVehicle = data.vehicles[0];

    const { data: devisRow } = await supabase
      .from("devis")
      .insert({
        user_id: userId,
        nom,
        prenom,
        email,
        telephone: profile?.telephone || "",
        depart: data.depart,
        arrivee: firstVehicle?.arrivee ?? data.depart,
        date_souhaitee: data.date || null,
        heure_souhaitee: heureText || null,
        marque: firstVehicle?.marque ?? null,
        modele: firstVehicle?.modele ?? null,
        immatriculation: firstVehicle?.immatriculation ?? null,
        vin: firstVehicle?.vin ?? null,
        carburant: firstVehicle?.energie ?? null,
        option_trajet: "aller_simple",
        prestation: `Mission groupée ${groupReference} · ${data.vehicles.length} véhicule${data.vehicles.length > 1 ? "s" : ""}`,
        prix_estime: totalTtc,
        statut: "envoye",
        origine: "demande_client",
        mission_group_id: groupId,
        vehicules: data.vehicles.map((v) => ({
          immatriculation: v.immatriculation ?? null,
          marque: v.marque ?? null,
          modele: v.modele ?? null,
          vin: v.vin ?? null,
          arrivee: v.arrivee,
          prix: v.prixTtc,
        })),
        message: [
          `[Mission groupée ${groupReference}]`,
          data.message,
          profile?.societe ? `Société : ${profile.societe}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id, numero")
      .maybeSingle();

    const devisId = (devisRow as { id?: string } | null)?.id ?? null;
    const devisNumero = (devisRow as { numero?: string } | null)?.numero ?? null;

    const rows = data.vehicles.map((v) => ({
      user_id: userId,
      nom,
      prenom,
      email,
      telephone: profile?.telephone || "",

      depart: data.depart,
      arrivee: v.arrivee,
      date_souhaitee: data.date,
      heure_souhaitee: heureText,
      message: [
        `[Mission groupée ${groupReference}]`,
        data.message,
        v.notes ? `Notes véhicule : ${v.notes}` : "",
        profile?.societe ? `Société : ${profile.societe}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      options: "aller-simple",
      options_meta: v.optionsMeta ?? {},
      statut: "nouvelle",
      prix_estime: v.prixTtc,
      pricing_display_mode: profile?.pricing_display_mode ?? "ttc",
      contact_depart_nom: data.contactDepartNom || null,
      contact_depart_tel: data.contactDepartTel || null,
      vehicule_immatriculation: v.immatriculation ?? null,
      vehicule_vin: v.vin ?? null,
      vehicule_marque: v.marque ?? null,
      vehicule_modele: v.modele ?? null,
      vehicule_energie: v.energie ?? null,
      vehicule_type: v.type ?? null,
      vehicule_km: v.km ?? null,
      vehicule_notes: v.notes ?? null,
      immatriculation: v.immatriculation ?? "",
      marque: v.marque ?? "",
      modele: v.modele ?? "",
      carburant: v.energie ?? "",
      mission_group_id: groupId,
      group_reference: groupReference,
      ...(devisId ? { devis_id: devisId, devis_genere_at: new Date().toISOString() } : {}),
    }));

    const { data: inserted, error: insErr } = await supabase
      .from("demandes_convoyage")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any)
      .select("id");
    if (insErr) throw insErr;

    const demandeIds = (inserted ?? []).map((r) => r.id as string);
    if (devisId && demandeIds[0]) {
      await supabase.from("devis").update({ demande_id: demandeIds[0] }).eq("id", devisId);
    }

    return {
      groupReference,
      groupId,
      demandeIds,
      count: rows.length,
      devisId,
      devisNumero,
    };
  });

