// Parcours de commande guidé par Vroomy.
// Réutilise le MÊME moteur de tarification et la MÊME création de devis/demande
// que le formulaire classique (DevisGenerator) : aucune divergence de données.

import { supabase } from "@/integrations/supabase/client";
import { quoteB2C } from "@/lib/pricing-engine";
import { getDistance, type TripType } from "@/lib/reservation-pricing";
import { notifyAdmin } from "@/lib/admin-notifications";
import { sendTransactionalEmail } from "@/lib/email/send";

export const VROOMY_ORDER_STORAGE_KEY = "ligneo_vroomy_order_draft";
/** Clé lue par le formulaire classique (DevisGenerator) pour le pré-remplissage. */
export const VROOMY_PREFILL_KEY = "ligneo_vroomy_order_prefill";

export type VehiculeType = "citadine" | "berline" | "suv" | "utilitaire" | "luxe";

export const VEHICULE_OPTIONS: Array<{ value: VehiculeType; label: string }> = [
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "utilitaire", label: "Utilitaire" },
  { value: "luxe", label: "Luxe" },
];

export const CRENEAUX = ["Matin (8h — 12h)", "Après-midi (12h — 17h)", "Fin de journée (17h — 20h)"] as const;

export type OrderStepId =
  | "depart"
  | "arrivee"
  | "vehicule"
  | "date"
  | "contacts"
  | "instructions"
  | "recap";

export interface VroomyOrderDraft {
  depart: string;
  arrivee: string;
  vehicule: VehiculeType | null;
  tripType: TripType;
  date: string; // yyyy-mm-dd
  creneau: string;
  contactDepartNom: string;
  contactDepartTel: string;
  contactArriveeNom: string;
  contactArriveeTel: string;
  instructions: string;
  step: OrderStepId;
  updatedAt: string;
}

export function emptyDraft(): VroomyOrderDraft {
  return {
    depart: "",
    arrivee: "",
    vehicule: null,
    tripType: "aller_simple",
    date: "",
    creneau: "",
    contactDepartNom: "",
    contactDepartTel: "",
    contactArriveeNom: "",
    contactArriveeTel: "",
    instructions: "",
    step: "depart",
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Persistance (interruption / reprise)                                */
/* ------------------------------------------------------------------ */

export function loadDraft(): VroomyOrderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VROOMY_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VroomyOrderDraft>;
    return { ...emptyDraft(), ...parsed };
  } catch {
    return null;
  }
}

export function saveDraft(draft: VroomyOrderDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      VROOMY_ORDER_STORAGE_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota / navigation privée : le parcours reste utilisable en mémoire */
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VROOMY_ORDER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Extraction depuis un message en langage naturel                     */
/* ------------------------------------------------------------------ */

const CITIES = [
  "Tours","Paris","Lyon","Marseille","Bordeaux","Nantes","Lille","Strasbourg","Toulouse","Nice",
  "Montpellier","Rennes","Orléans","Poitiers","Limoges","Clermont-Ferrand","Angers","Le Mans",
  "Blois","Chartres","Rouen","Caen","Dijon","Reims","Metz","Nancy","Brest","La Rochelle",
  "Perpignan","Grenoble","Saint-Étienne","Amiens","Bourges","Châteauroux",
];

const ORDER_INTENT = [
  /convoyer/i, /faire\s+transporter/i, /faire\s+livrer/i, /commander/i, /r[ée]server/i,
  /besoin\s+d['’]un\s+(devis|convoyage|transport)/i, /transporter\s+ma\s+(voiture|auto)/i,
  /d[ée]placer\s+(ma|mon)\s+(voiture|v[ée]hicule)/i, /guid[ée]/i,
];

export function detectOrderIntent(message: string): boolean {
  return ORDER_INTENT.some((re) => re.test(message));
}

function normalize(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function findCities(message: string): string[] {
  const n = normalize(message);
  const hits: Array<{ city: string; index: number }> = [];
  for (const c of CITIES) {
    const idx = n.indexOf(normalize(c));
    if (idx >= 0) hits.push({ city: c, index: idx });
  }
  return hits.sort((a, b) => a.index - b.index).map((h) => h.city);
}

export interface ExtractedOrder {
  depart?: string;
  arrivee?: string;
  vehicule?: VehiculeType;
  tripType?: TripType;
  date?: string;
}

/** Extrait départ / arrivée / véhicule / date d'un message libre. */
export function extractOrderInfo(message: string): ExtractedOrder {
  const out: ExtractedOrder = {};
  const cities = findCities(message);
  if (cities[0]) out.depart = cities[0];
  if (cities[1]) out.arrivee = cities[1];

  const n = normalize(message);
  if (/citadine|petite voiture/.test(n)) out.vehicule = "citadine";
  else if (/berline/.test(n)) out.vehicule = "berline";
  else if (/suv|4x4/.test(n)) out.vehicule = "suv";
  else if (/utilitaire|camionnette|fourgon/.test(n)) out.vehicule = "utilitaire";
  else if (/luxe|sportive|prestige/.test(n)) out.vehicule = "luxe";

  if (/aller[- ]?retour|restitution/.test(n)) out.tripType = "aller_retour";
  else if (/express|urgent|au plus vite/.test(n)) out.tripType = "express";

  const iso = message.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) out.date = iso[0];
  else {
    const fr = message.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
    if (fr) {
      const yyyy = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
      out.date = `${yyyy}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Estimation en direct (même moteur que le formulaire classique)      */
/* ------------------------------------------------------------------ */

export interface LiveEstimate {
  priceTtc: number;
  priceHt: number;
  distanceKm: number | null;
  label: string;
  delai: string;
}

export function estimateDraft(draft: VroomyOrderDraft): LiveEstimate | null {
  if (!draft.depart || !draft.arrivee || !draft.vehicule) return null;
  const quote = quoteB2C({ depart: draft.depart, arrivee: draft.arrivee, type: draft.tripType });
  if (!quote.isEstimable) return null;
  const km = quote.distanceKm ?? getDistance(draft.depart, draft.arrivee);
  const delai = draft.tripType === "express" ? "24 h" : km && km > 500 ? "48 à 72 h" : "24 à 48 h";
  return {
    priceTtc: quote.priceTtc,
    priceHt: quote.priceHt,
    distanceKm: km,
    label: quote.meta.label ?? "",
    delai,
  };
}

export function tripTypeLabel(t: TripType) {
  return t === "aller_retour" ? "Livraison + restitution" : t === "express" ? "Express" : "Livraison simple";
}

function optionTrajet(t: TripType) {
  return t === "aller_retour" ? "aller-retour" : t === "express" ? "express" : "aller-simple";
}

/* ------------------------------------------------------------------ */
/* Sortie de secours : pré-remplir le formulaire classique             */
/* ------------------------------------------------------------------ */

export function exportPrefillToClassicForm(draft: VroomyOrderDraft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      VROOMY_PREFILL_KEY,
      JSON.stringify({
        departure: draft.depart,
        arrival: draft.arrivee,
        vehicleType: draft.vehicule === "luxe" ? "autre" : draft.vehicule ?? "",
        date: draft.date,
        option: optionTrajet(draft.tripType),
        comment: [
          draft.instructions,
          draft.creneau && `Créneau souhaité : ${draft.creneau}`,
          draft.contactDepartNom && `Contact départ : ${draft.contactDepartNom} ${draft.contactDepartTel}`,
          draft.contactArriveeNom && `Contact arrivée : ${draft.contactArriveeNom} ${draft.contactArriveeTel}`,
        ]
          .filter(Boolean)
          .join(" · "),
        nom: draft.contactDepartNom,
        telephone: draft.contactDepartTel,
      }),
    );
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Finalisation : même création de devis + demande que le formulaire   */
/* ------------------------------------------------------------------ */

export interface OrderIdentity {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  societe?: string;
}

export interface OrderResult {
  ok: boolean;
  numero?: string;
  devisId?: string;
  prixTtc?: number;
  error?: string;
}

function duree(distance: number | null): string {
  if (!distance) return "—";
  const hours = distance / 80;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export async function submitVroomyOrder(
  draft: VroomyOrderDraft,
  identity: OrderIdentity,
): Promise<OrderResult> {
  const est = estimateDraft(draft);
  if (!est) return { ok: false, error: "Estimation indisponible pour ce trajet." };

  const distance = est.distanceKm;
  const option = optionTrajet(draft.tripType);
  const message = [
    draft.instructions,
    draft.creneau && `Créneau : ${draft.creneau}`,
    draft.contactDepartNom && `Contact départ : ${draft.contactDepartNom} ${draft.contactDepartTel}`,
    draft.contactArriveeNom && `Contact arrivée : ${draft.contactArriveeNom} ${draft.contactArriveeTel}`,
    "Commande guidée par Vroomy",
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const { data: devisRow, error } = await supabase
      .from("devis")
      .insert({
        nom: identity.nom,
        prenom: identity.prenom,
        telephone: identity.telephone,
        email: identity.email,
        depart: draft.depart,
        arrivee: draft.arrivee,
        distance_km: distance,
        duree_estimee: duree(distance),
        type_vehicule: draft.vehicule,
        prestation: null,
        option_trajet: option,
        date_souhaitee: draft.date || null,
        heure_souhaitee: draft.creneau || null,
        prix_estime: est.priceTtc,
        prix_base: est.priceTtc,
        tarif_label: est.label,
        message,
      })
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    await supabase.from("demandes_convoyage").insert({
      nom: identity.nom,
      prenom: identity.prenom,
      telephone: identity.telephone,
      email: identity.email,
      depart: draft.depart,
      arrivee: draft.arrivee,
      date_souhaitee: draft.date || null,
      heure_souhaitee: draft.creneau || null,
      prix_estime: est.priceTtc,
      distance_km: distance,
      options: [
        devisRow?.numero && `Devis: ${devisRow.numero}`,
        draft.vehicule && `Type: ${draft.vehicule}`,
        `Prestation: ${tripTypeLabel(draft.tripType)}`,
        `Estimation: ${est.priceTtc}€`,
        distance != null && `Distance: ${distance}km`,
        "Canal: Vroomy (parcours guidé)",
      ]
        .filter(Boolean)
        .join(" | "),
      message,
    });

    await notifyAdmin({
      type: "estimation",
      titre: `Commande guidée Vroomy ${devisRow?.numero ?? ""} · ${identity.prenom} ${identity.nom}`,
      message: `${draft.depart} → ${draft.arrivee} · ${distance ?? "?"} km · ${est.priceTtc} €`,
      link: "/admin/devis",
      entityType: "devis",
      entityId: devisRow?.id,
      metadata: {
        email: identity.email,
        telephone: identity.telephone,
        prix: est.priceTtc,
        canal: "vroomy",
      },
    });

    try {
      await Promise.allSettled([
        sendTransactionalEmail({
          templateName: "devis-client",
          recipientEmail: identity.email,
          idempotencyKey: `devis-${devisRow?.id ?? devisRow?.numero}`,
          templateData: {
            prenom: identity.prenom,
            nom: identity.nom,
            numero: devisRow?.numero,
            depart: draft.depart,
            arrivee: draft.arrivee,
            distance,
            prix: est.priceTtc,
            optionTrajet: option,
          },
        }),
        sendTransactionalEmail({
          templateName: "devis-cree-admin",
          idempotencyKey: `admin-devis-${devisRow?.id ?? devisRow?.numero}`,
          templateData: {
            prenom: identity.prenom,
            nom: identity.nom,
            email: identity.email,
            telephone: identity.telephone,
            numero: devisRow?.numero,
            depart: draft.depart,
            arrivee: draft.arrivee,
            date: draft.date || " · ",
            prix: est.priceTtc,
          },
        }),
      ]);
      if (devisRow?.id) await supabase.from("devis").update({ email_envoye: true }).eq("id", devisRow.id);
    } catch {
      /* l'email ne bloque jamais la commande */
    }

    clearDraft();
    return { ok: true, numero: devisRow?.numero ?? undefined, devisId: devisRow?.id, prixTtc: est.priceTtc };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
