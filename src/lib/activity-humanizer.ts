// Phase 4 — Turn raw activity_logs rows into readable French sentences.
// Never throw; always return a string. Falls back to a generic phrasing.

type Meta = Record<string, unknown> | null | undefined;

const ENTITY_LABEL: Record<string, string> = {
  user: "l'utilisateur",
  devis: "le devis",
  facture: "la facture",
  trajet: "le trajet",
  attribution: "l'attribution",
  paiement: "le paiement",
  message: "le message",
  incident: "l'incident",
  parametre: "le paramètre",
  mission: "la mission",
  offre: "l'offre",
  organisation: "l'organisation",
  demande: "la demande",
};

const ACTION_TEMPLATES: Record<string, (m: Meta) => string> = {
  "admin.create_user": (m) => {
    const role = (m?.role as string) ?? "utilisateur";
    const email = (m?.email as string) ?? "";
    return `a créé un compte ${roleLabel(role)}${email ? ` (${email})` : ""}`;
  },
  "admin.delete_user": (m) => `a supprimé un compte${m?.email ? ` (${m.email})` : ""}`,
  "admin.delete": (m) => `a supprimé un compte${m?.email ? ` (${m.email})` : ""}`,
  "admin.role_assigned": (m) => `a attribué le rôle ${roleLabel((m?.role as string) ?? "")}`,
  "admin.role_revoked": (m) => `a retiré le rôle ${roleLabel((m?.role as string) ?? "")}`,
  "admin.change_role": (m) => `a modifié le rôle en ${roleLabel((m?.role as string) ?? "")}`,
  "admin.activate_role": (m) => `a réactivé le rôle ${roleLabel((m?.role as string) ?? "")}`,
  "admin.deactivate_role": (m) => `a suspendu le rôle ${roleLabel((m?.role as string) ?? "")}`,
  "admin.change_type_client": (m) => {
    const t = (m?.type_client as string) ?? "";
    const label = t === "b2b" ? "B2B" : t === "flotte" ? "Flotte" : t === "particulier" ? "Particulier" : t;
    return `a défini le type de client sur ${label || "—"}`;
  },
  "admin.reset_password": () => `a envoyé un lien de réinitialisation de mot de passe`,
  "admin.change_email": (m) => `a modifié l'email${m?.email ? ` en ${m.email}` : ""}`,
  "admin.suspend": () => `a suspendu le compte`,
  "admin.reactivate": () => `a réactivé le compte`,
  "devis.created": (m) => `a créé ${numeroLabel(m, "le devis")}`,
  "devis.sent": (m) => `a envoyé ${numeroLabel(m, "le devis")} au client`,
  "devis.accepted": (m) => `a accepté ${numeroLabel(m, "le devis")}`,
  "devis.refused": (m) => `a refusé ${numeroLabel(m, "le devis")}`,
  "devis.paid": (m) => `a payé ${numeroLabel(m, "le devis")}`,
  "facture.created": (m) => `a émis ${numeroLabel(m, "la facture")}`,
  "facture.paid": (m) => `a payé ${numeroLabel(m, "la facture")}`,
  "trajet.published": (m) => `a publié ${numeroLabel(m, "le trajet")} au catalogue`,
  "trajet.attributed": (m) => `a attribué ${numeroLabel(m, "le trajet")}`,
  "attribution.accepted": () => `a accepté une mission`,
  "attribution.refused": (m) => `a refusé une mission${m?.motif ? ` (${m.motif})` : ""}`,
  "offer.submitted": (m) =>
    `a proposé un prix${m?.prix_propose ? ` de ${m.prix_propose} €` : ""}`,
  "offer.counter": (m) =>
    `a contre-proposé${m?.admin_counter_offer ? ` ${m.admin_counter_offer} €` : ""}`,
  "message.received": () => `a reçu un nouveau message`,
  "incident.reported": () => `a signalé un incident`,
  "settings.updated": (m) =>
    `a mis à jour les paramètres${m?.field ? ` (${m.field})` : ""}`,
};

const ACTION_FALLBACKS: Record<string, string> = {
  activate_role: "a réactivé un rôle utilisateur",
  deactivate_role: "a suspendu un rôle utilisateur",
  change_role: "a modifié le rôle d'un utilisateur",
  change_type_client: "a modifié le type d'un client",
  reset_password: "a envoyé une réinitialisation de mot de passe",
  change_email: "a modifié l'email d'un utilisateur",
  create_user: "a créé un compte",
  delete_user: "a supprimé un compte",
  delete: "a supprimé un compte",
  suspend: "a suspendu un compte",
  reactivate: "a réactivé un compte",
};

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Administrateur";
    case "super_admin":
      return "Super Administrateur";
    case "convoyeur":
      return "Convoyeur";
    case "client":
      return "Client";
    case "manager":
      return "Manager";
    case "sous_traitant":
      return "Sous-traitant";
    default:
      return role || "utilisateur";
  }
}

function numeroLabel(m: Meta, fallback: string): string {
  const num = m && (m.numero || m.number);
  return num ? `${fallback} ${num}` : fallback;
}

export function humanizeAction(
  action: string,
  entity_type: string,
  metadata: Meta,
): string {
  const tpl = ACTION_TEMPLATES[action];
  if (tpl) return tpl(metadata ?? null);
  const [, ...rest] = action.split(".");
  const suffix = rest.join(".");
  if (suffix && ACTION_FALLBACKS[suffix]) return ACTION_FALLBACKS[suffix];
  const label = ENTITY_LABEL[entity_type] ?? "un élément";
  // Dernier recours : phrase française neutre, sans jargon technique.
  const pretty = suffix
    ? suffix.replace(/_/g, " ")
    : action.replace(/_/g, " ");
  return `a effectué « ${pretty} » sur ${label}`;
}

export function actorLabel(row: {
  actor_label?: string | null;
  actor_user_id?: string | null;
  metadata?: Meta;
}): string {
  if (row.actor_label && !row.actor_label.match(/^[0-9a-f-]{8,}$/i)) return row.actor_label;
  const meta = row.metadata ?? {};
  const prenom = (meta as Record<string, unknown>).prenom as string | undefined;
  const nom = (meta as Record<string, unknown>).nom as string | undefined;
  if (prenom || nom) return `${prenom ?? ""} ${nom ?? ""}`.trim();
  const email = (meta as Record<string, unknown>).email as string | undefined;
  if (email) return email;
  return "Système";
}
