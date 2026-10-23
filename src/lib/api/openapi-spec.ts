/**
 * Description unique de l'API Développeur v1.
 * Sert à la fois à la documentation publique (/developpeurs) et au fichier OpenAPI 3.0
 * (/api/public/v1/openapi.json). Aucun import serveur : utilisable côté navigateur.
 */

export const API_BASE_URL = "https://transportsligneo.fr/api/public/v1";

export type Field = { name: string; type: string; required?: boolean; description: string };

export interface Endpoint {
  id: string;
  method: "GET" | "POST" | "DELETE";
  path: string;
  tag: "Devis" | "Missions" | "Documents";
  summary: string;
  description: string;
  idempotent?: boolean;
  query?: Field[];
  body?: Field[];
  example: unknown;
  sampleBody?: unknown;
}

export const ENDPOINTS: Endpoint[] = [
  {
    id: "estimate",
    method: "POST",
    path: "/quotes/estimate",
    tag: "Devis",
    summary: "Estimation instantanée",
    description: "Renvoie un prix indicatif en temps réel, sans engagement. Valable 7 jours.",
    body: [
      { name: "pickup_address", type: "string", required: true, description: "Adresse ou ville d'enlèvement." },
      { name: "delivery_address", type: "string", required: true, description: "Adresse ou ville de livraison." },
      { name: "vehicle_type", type: "string", required: true, description: "leger, utilitaire, luxe, suv ou electrique." },
      { name: "pickup_date", type: "string (YYYY-MM-DD)", description: "Date souhaitée d'enlèvement." },
    ],
    sampleBody: { pickup_address: "Tours", delivery_address: "Bordeaux", vehicle_type: "leger" },
    example: {
      estimate_id: "est_test_3f9a1c7b2d10",
      livemode: false,
      distance_km: 350,
      duration_estimate: "4h22",
      price_ht: 285,
      price_ttc: 342,
      currency: "EUR",
      valid_until: "2026-11-01T10:00:00.000Z",
    },
  },
  {
    id: "quotes-create",
    method: "POST",
    path: "/quotes",
    tag: "Devis",
    summary: "Créer un devis",
    description: "Crée un devis formel, rattaché à votre organisation. Il apparaît dans votre espace pro.",
    idempotent: true,
    body: [
      { name: "pickup_address", type: "string", required: true, description: "Adresse d'enlèvement." },
      { name: "delivery_address", type: "string", required: true, description: "Adresse de livraison." },
      { name: "vehicle_type", type: "string", required: true, description: "leger, utilitaire, luxe, suv ou electrique." },
      { name: "pickup_date", type: "string (YYYY-MM-DD)", description: "Date souhaitée." },
      { name: "customer", type: "object", description: "first_name, last_name, email, phone du destinataire du devis." },
      { name: "vehicle", type: "object", description: "brand, model du véhicule." },
      { name: "notes", type: "string", description: "Message libre pour l'équipe." },
    ],
    sampleBody: { pickup_address: "Tours", delivery_address: "Bordeaux", vehicle_type: "leger", pickup_date: "2026-11-18" },
    example: {
      id: "qt_test_a41c9d03e2b7",
      object: "quote",
      livemode: false,
      reference: "DEV-TEST-0001",
      status: "envoye",
      pickup_address: "Tours",
      delivery_address: "Bordeaux",
      distance_km: 350,
      price_ht: 285,
      price_ttc: 342,
      currency: "EUR",
      valid_until: "2026-11-01T10:00:00.000Z",
    },
  },
  {
    id: "quotes-list",
    method: "GET",
    path: "/quotes",
    tag: "Devis",
    summary: "Lister les devis",
    description: "Les 50 devis les plus récents de votre organisation.",
    example: { object: "list", livemode: false, data: [], has_more: false },
  },
  {
    id: "quotes-get",
    method: "GET",
    path: "/quotes/{quoteId}",
    tag: "Devis",
    summary: "Récupérer un devis",
    description: "Détail d'un devis (statut, prix, validité).",
    example: { id: "qt_test_a41c9d03e2b7", object: "quote", status: "envoye", price_ttc: 342, currency: "EUR" },
  },
  {
    id: "missions-create",
    method: "POST",
    path: "/missions",
    tag: "Missions",
    summary: "Créer une mission",
    description:
      "Transforme un devis en mission de convoyage. Envoyez toujours une Idempotency-Key : en cas de coupure réseau, vous pouvez renvoyer la même requête sans créer de doublon.",
    idempotent: true,
    body: [
      { name: "quote_id", type: "string", required: true, description: "Identifiant du devis à transformer." },
      { name: "pickup_date", type: "string (YYYY-MM-DD)", description: "Date d'enlèvement (sinon celle du devis)." },
      { name: "vehicle", type: "object", description: "brand, model, plate, vin." },
      { name: "contact", type: "object", description: "pickup_name, pickup_phone, delivery_name, delivery_phone." },
      { name: "po_number", type: "string", description: "Votre numéro de bon de commande." },
      { name: "webhook_url", type: "string (https)", description: "URL qui reçoit les événements de cette mission." },
    ],
    sampleBody: {
      quote_id: "qt_test_a41c9d03e2b7",
      vehicle: { plate: "AB-123-CD" },
      contact: { pickup_name: "Marc Dubois", pickup_phone: "06 12 34 56 78" },
      po_number: "BC-2026-044",
    },
    example: {
      id: "mis_test_7be2d91c04aa",
      object: "mission",
      livemode: false,
      status: "pending",
      reference: "MIS-TEST-4821",
      pickup_address: "Tours",
      delivery_address: "Bordeaux",
      vehicle_plate: "AB-123-CD",
      price_ttc: 342,
      currency: "EUR",
    },
  },
  {
    id: "missions-list",
    method: "GET",
    path: "/missions",
    tag: "Missions",
    summary: "Lister les missions",
    description: "Liste paginée de vos missions, plus récentes en premier.",
    query: [
      { name: "limit", type: "integer", description: "1 à 100 (20 par défaut)." },
      { name: "offset", type: "integer", description: "Décalage de pagination." },
      { name: "status", type: "string", description: "pending, assigned, in_transit, delivered ou cancelled." },
      { name: "created_after", type: "string (ISO 8601)", description: "Missions créées après cette date." },
      { name: "created_before", type: "string (ISO 8601)", description: "Missions créées avant cette date." },
    ],
    example: { object: "list", livemode: false, data: [], has_more: false, limit: 20, offset: 0 },
  },
  {
    id: "missions-get",
    method: "GET",
    path: "/missions/{missionId}",
    tag: "Missions",
    summary: "Récupérer une mission",
    description: "Statut, adresses, véhicule et prix d'une mission.",
    example: { id: "mis_test_7be2d91c04aa", object: "mission", status: "in_transit", reference: "MIS-TEST-4821" },
  },
  {
    id: "missions-cancel",
    method: "DELETE",
    path: "/missions/{missionId}",
    tag: "Missions",
    summary: "Annuler une mission",
    description: "Annule une mission non terminée. Un webhook mission.cancelled est envoyé.",
    example: { id: "mis_test_7be2d91c04aa", object: "mission", status: "cancelled" },
  },
  {
    id: "missions-tracking",
    method: "GET",
    path: "/missions/{missionId}/tracking",
    tag: "Missions",
    summary: "Suivi GPS",
    description: "Étape en cours, prénom du convoyeur et dernière position connue.",
    example: {
      mission_id: "mis_test_7be2d91c04aa",
      object: "tracking",
      status: "in_transit",
      driver: { name: "Julien" },
      current_location: { latitude: 47.2, longitude: 0.52, recorded_at: "2026-10-24T09:12:00Z" },
    },
  },
  {
    id: "missions-pod",
    method: "GET",
    path: "/missions/{missionId}/proof-of-delivery",
    tag: "Documents",
    summary: "Preuve de livraison",
    description: "Lien temporaire (1 h) vers le PV de livraison signé, avec photos et signatures.",
    example: {
      mission_id: "mis_test_7be2d91c04aa",
      object: "document",
      type: "proof_of_delivery",
      url: "https://…/pod_sample.pdf",
      expires_at: "2026-10-24T10:00:00Z",
    },
  },
  {
    id: "invoices-get",
    method: "GET",
    path: "/invoices/{invoiceId}",
    tag: "Documents",
    summary: "Récupérer une facture",
    description: "Montants, statut de paiement et lien de téléchargement.",
    example: { id: "inv_test", object: "invoice", number: "FA-TEST-0001", status: "paid", amount_ttc: 342, currency: "EUR" },
  },
];

export const WEBHOOK_DOC = [
  { event: "mission.assigned", description: "Un convoyeur a été attribué à la mission." },
  { event: "mission.started", description: "Le convoyeur a démarré la mission." },
  { event: "mission.delivered", description: "Le véhicule est livré (preuve de livraison disponible)." },
  { event: "mission.cancelled", description: "La mission a été annulée." },
  { event: "invoice.available", description: "La facture de la mission est disponible." },
  { event: "webhook.test", description: "Événement de test envoyé depuis votre espace pro." },
] as const;

export const ERROR_DOC = [
  { status: 400, type: "invalid_request_error", description: "Paramètre manquant ou invalide." },
  { status: 401, type: "authentication_error", description: "Clé absente, invalide ou révoquée." },
  { status: 404, type: "not_found", description: "Ressource introuvable pour votre organisation." },
  { status: 409, type: "invalid_request_error / idempotency_error", description: "Conflit : devis déjà converti, ou requête identique en cours." },
  { status: 422, type: "idempotency_error", description: "Idempotency-Key déjà utilisée avec des paramètres différents." },
  { status: 429, type: "rate_limit_error", description: "100 requêtes par minute dépassées. Voir Retry-After." },
  { status: 500, type: "api_error", description: "Erreur côté Ligneo. Réessayez avec la même Idempotency-Key." },
] as const;

export function curlExample(e: Endpoint, key = "sk_test_••••••••••••"): string {
  const url = `${API_BASE_URL}${e.path}`;
  const lines = [`curl ${e.method === "GET" ? "" : `-X ${e.method} `}${url} \\`, `  -H "Authorization: Bearer ${key}"`];
  if (e.sampleBody) {
    lines[1] += " \\";
    lines.push('  -H "Content-Type: application/json" \\');
    if (e.idempotent) lines.push('  -H "Idempotency-Key: 7d1c2c52-9e3b-4f0a-8e16-0c5b8d2a4f10" \\');
    lines.push(`  -d '${JSON.stringify(e.sampleBody)}'`);
  }
  return lines.join("\n");
}

function schemaFor(fields: Field[] | undefined) {
  if (!fields) return undefined;
  return {
    type: "object",
    required: fields.filter((f) => f.required).map((f) => f.name),
    properties: Object.fromEntries(
      fields.map((f) => [
        f.name,
        { type: f.type.startsWith("integer") ? "integer" : f.type.startsWith("object") ? "object" : "string", description: f.description },
      ]),
    ),
  };
}

/** Fichier OpenAPI 3.0 complet, importable dans Postman, Insomnia, Swagger UI ou un générateur de client. */
export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = [
      ...(e.path.match(/\{(\w+)\}/g) ?? []).map((p) => ({
        name: p.slice(1, -1),
        in: "path",
        required: true,
        schema: { type: "string" },
      })),
      ...(e.query ?? []).map((q) => ({ name: q.name, in: "query", description: q.description, schema: { type: q.type.startsWith("integer") ? "integer" : "string" } })),
      ...(e.idempotent
        ? [{ name: "Idempotency-Key", in: "header", description: "Clé unique (UUID conseillé) pour éviter tout doublon en cas de nouvel envoi.", schema: { type: "string", maxLength: 200 } }]
        : []),
    ];
    const op: Record<string, unknown> = {
      tags: [e.tag],
      summary: e.summary,
      description: e.description,
      operationId: e.id.replace(/-/g, "_"),
      parameters: params.length ? params : undefined,
      requestBody: e.body
        ? { required: true, content: { "application/json": { schema: schemaFor(e.body), example: e.sampleBody } } }
        : undefined,
      responses: {
        "200": { description: "Succès", content: { "application/json": { example: e.example } } },
        "400": { $ref: "#/components/responses/Error" },
        "401": { $ref: "#/components/responses/Error" },
        "429": { $ref: "#/components/responses/Error" },
      },
    };
    (paths[e.path] ??= {})[e.method.toLowerCase()] = op;
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "API Développeur Transports Ligneo",
      version: "1.0.0",
      description:
        "Devis, missions de convoyage, suivi GPS et documents. Clés sk_test_… (sandbox, sans effet réel) et sk_live_… (production). 100 requêtes par minute et par clé.",
      contact: { name: "Transports Ligneo", email: "contact@transportsligneo.fr", url: "https://transportsligneo.fr/developpeurs" },
    },
    servers: [{ url: API_BASE_URL, description: "Production et sandbox (selon la clé utilisée)" }],
    security: [{ bearerAuth: [] }],
    tags: [{ name: "Devis" }, { name: "Missions" }, { name: "Documents" }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Authorization: Bearer sk_live_…" },
      },
      responses: {
        Error: {
          description: "Erreur",
          content: {
            "application/json": {
              example: { error: { type: "invalid_request_error", message: "pickup_address est requis.", request_id: "req_9f2a41c0d3e8b712" } },
            },
          },
        },
      },
    },
  };
}
