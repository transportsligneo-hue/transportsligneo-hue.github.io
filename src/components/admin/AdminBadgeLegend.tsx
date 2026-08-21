/**
 * Légende des badges de l'admin : explique chaque pastille de statut
 * (demande, devis, mission/attribution, facture) et son critère exact.
 */
import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { AdminBadge } from "@/components/admin/ui";
import { MissionStatusBadge } from "@/components/admin/MissionStatusBadge";

interface Entry {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "accent" | "violet" | "gold" | "neutral";
  criteria: string;
}

const DEMANDES: Entry[] = [
  { label: "Nouvelle", tone: "info", criteria: "Demande reçue via le site ou l'espace client, jamais ouverte par un admin." },
  { label: "À traiter", tone: "warning", criteria: "Demande lue mais sans devis ni mission créée : action admin attendue." },
  { label: "Convertie", tone: "violet", criteria: "Un devis ou une mission a été généré à partir de cette demande." },
  { label: "Annulée", tone: "danger", criteria: "Demande abandonnée par le client ou refusée par l'admin." },
  { label: "Infos véhicule incomplètes", tone: "danger", criteria: "Marque ou modèle manquant dans le formulaire : à compléter avant devis." },
  { label: "Plaque à confirmer", tone: "warning", criteria: "Le client a coché « plaque inconnue » ou n'a pas renseigné d'immatriculation." },
];

const DEVIS: Entry[] = [
  { label: "Brouillon", tone: "warning", criteria: "Devis créé en interne, pas encore envoyé au client." },
  { label: "Envoyé", tone: "info", criteria: "Devis transmis par email, en attente de réponse du client." },
  { label: "Accepté", tone: "success", criteria: "Devis validé par le client (signature ou code de confirmation)." },
  { label: "Refusé", tone: "danger", criteria: "Devis explicitement refusé, ou expiré sans réponse." },
  { label: "Payé", tone: "success", criteria: "Paiement encaissé (acompte ou totalité) sur le devis." },
];

const MISSIONS: { statut: string; criteria: string }[] = [
  { statut: "brouillon", criteria: "Mission créée dans l'admin, pas encore proposée ni publiée." },
  { statut: "publie", criteria: "Mission visible dans le catalogue des convoyeurs validés." },
  { statut: "propose", criteria: "Mission proposée à un convoyeur précis : il doit accepter ou refuser." },
  { statut: "accepte", criteria: "Le convoyeur a accepté ; la mission n'a pas encore démarré." },
  { statut: "attribue", criteria: "Mission planifiée et attribuée : dates et convoyeur figés." },
  { statut: "refusee", criteria: "Le convoyeur a refusé : à réattribuer ou republier au catalogue." },
  { statut: "expire", criteria: "La proposition n'a pas reçu de réponse dans le délai imparti." },
  { statut: "en_cours", criteria: "Le convoyeur a démarré le trajet (état des lieux départ effectué)." },
  { statut: "en_attente_validation", criteria: "État des lieux d'arrivée envoyé : l'admin doit contrôler et valider." },
  { statut: "validee", criteria: "Contrôle admin effectué : documents et photos conformes." },
  { statut: "termine", criteria: "Mission clôturée : facturable et prise en compte dans le CA." },
  { statut: "annule", criteria: "Mission annulée (client ou interne) : non facturée sauf clôture facturable." },
];

const FACTURATION: Entry[] = [
  { label: "En attente", tone: "warning", criteria: "Facture émise, paiement non reçu et échéance non dépassée." },
  { label: "Payée", tone: "success", criteria: "Paiement encaissé et rapproché (virement, carte ou lien de paiement)." },
  { label: "En retard", tone: "danger", criteria: "Échéance dépassée sans paiement enregistré." },
  { label: "Urgent", tone: "danger", criteria: "Paiement convoyeur marqué prioritaire : à virer au prochain lot." },
];

function Row({ badge, criteria }: { badge: React.ReactNode; criteria: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-[190px] shrink-0">{badge}</div>
      <p className="text-xs text-[color:var(--admin-muted)] leading-relaxed">{criteria}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="admin-eyebrow mb-1">{title}</p>
      <div className="divide-y divide-[color:var(--admin-border,#e2e8f0)]/60">{children}</div>
    </div>
  );
}

export function AdminBadgeLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="admin-card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-[color:var(--admin-text,#0f172a)]">
          <HelpCircle size={16} className="text-[color:var(--admin-accent-strong)]" />
          Légende des badges — que signifie chaque statut ?
        </span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <Group title="Demandes clients">
            {DEMANDES.map((e) => (
              <Row key={e.label} badge={<AdminBadge label={e.label} tone={e.tone} />} criteria={e.criteria} />
            ))}
          </Group>

          <Group title="Devis">
            {DEVIS.map((e) => (
              <Row key={e.label} badge={<AdminBadge label={e.label} tone={e.tone} />} criteria={e.criteria} />
            ))}
          </Group>

          <Group title="Missions & attributions">
            {MISSIONS.map((m) => (
              <Row key={m.statut} badge={<MissionStatusBadge status={m.statut} short />} criteria={m.criteria} />
            ))}
          </Group>

          <Group title="Facturation & paiements">
            {FACTURATION.map((e) => (
              <Row key={e.label} badge={<AdminBadge label={e.label} tone={e.tone} />} criteria={e.criteria} />
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}
