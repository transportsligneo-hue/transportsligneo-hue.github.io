import * as React from 'react'
import type { TemplateEntry } from './registry'
import { LigneoEmailShell, RecapCard, HighlightBox, Divider, InfoParagraph } from './_ligneo-header'

interface Props {
  prenom?: string
  numero?: string
  quand?: string
  vehicule?: string
  immatriculation?: string
  depart?: string
  heureDepart?: string
  contactDepart?: string
  arrivee?: string
  heureArrivee?: string
  contactArrivee?: string
  roulant?: string
  securite?: string[]
  documents?: Array<{ label: string; note?: string }>
  docsUrl?: string
  appUrl?: string
}

const empty = (v?: string) => (v && String(v).trim() ? String(v) : '—')

const Email = ({
  prenom,
  numero,
  quand,
  vehicule,
  immatriculation,
  depart,
  heureDepart,
  contactDepart,
  arrivee,
  heureArrivee,
  contactArrivee,
  roulant,
  securite = [],
  documents = [],
  docsUrl,
  appUrl,
}: Props) => (
  <LigneoEmailShell
    preview={`Rappel : mission ${numero ?? ''} ${quand ? `— ${quand}` : ''}`.trim()}
    tagline="Rappel de mission"
    title="Votre mission est prévue demain"
    greeting={prenom ? `Bonjour ${prenom},` : 'Bonjour,'}
    intro={
      <>
        Voici le récapitulatif de votre mission{numero ? ` n° ${numero}` : ''}
        {quand ? ` prévue ${quand}` : ''}, les règles de sécurité à respecter et les documents à
        prévoir.
      </>
    }
    primaryCta={docsUrl ? { label: 'Documents papier à imprimer', href: docsUrl } : null}
    secondaryCta={appUrl ? { label: 'Ouvrir dans l’app', href: appUrl } : null}
    footnote="Gardez toujours une version papier des documents sur vous : elle sert de secours en cas de panne, de batterie vide ou d’absence de réseau."
  >
    <HighlightBox
      label="Véhicule"
      value={`${empty(vehicule)}${immatriculation ? ` — ${immatriculation}` : ''}`}
      meta={roulant}
      tone="navy"
    />

    <RecapCard
      title="Récapitulatif"
      rows={[
        { label: 'Mission', value: empty(numero) },
        { label: 'Prise en charge', value: empty(depart) },
        { label: 'Heure de départ', value: empty(heureDepart) },
        { label: 'Contact remettant', value: empty(contactDepart) },
        { label: 'Livraison', value: empty(arrivee) },
        { label: 'Heure de livraison', value: empty(heureArrivee) },
        { label: 'Contact destinataire', value: empty(contactArrivee) },
      ]}
    />

    <Divider />

    <RecapCard
      title="Règles de sécurité obligatoires"
      rows={securite.map((s, i) => ({ label: `${i + 1}.`, value: s }))}
    />

    {documents.length ? (
      <RecapCard
        title="Documents utiles à cette mission"
        rows={documents.map((d) => ({ label: d.label, value: d.note ?? 'À imprimer avant le départ' }))}
      />
    ) : null}

    <InfoParagraph>
      Les documents papier sont téléchargeables en un clic depuis le bouton ci-dessus. La version
      digitalisée reste disponible dans l’app si vous préférez l’utiliser sur place.
    </InfoParagraph>
  </LigneoEmailShell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Rappel mission${d.numero ? ` n° ${d.numero}` : ''} — départ demain${d.heureDepart ? ` à ${d.heureDepart}` : ''}`,
  displayName: 'Rappel mission J-1 (convoyeur)',
  previewData: {
    prenom: 'Olivier',
    numero: 'MIS-TLG-2026-114',
    quand: 'demain 16/08/2026',
    vehicule: 'Peugeot 3008',
    immatriculation: 'AB-123-CD',
    depart: '12 rue de la Gare, 37000 Tours',
    heureDepart: '08:30',
    contactDepart: 'M. Martin — 06 12 34 56 78',
    arrivee: '4 avenue Foch, 75116 Paris',
    heureArrivee: '12:00',
    contactArrivee: 'Mme Durand — 06 98 76 54 32',
    roulant: 'Véhicule roulant',
    securite: [
      'Gilet jaune haute visibilité à bord et porté dès tout arrêt sur la voie publique.',
      'Triangle de signalisation présent dans le véhicule.',
      'Permis de conduire original en cours de validité, sur vous.',
    ],
    documents: [{ label: 'État des lieux papier', note: 'Version roulante' }],
    docsUrl: 'https://transportsligneo.fr/convoyeur/documents-mission/xxx',
    appUrl: 'https://transportsligneo.fr/convoyeur/missions?open=xxx',
  },
} satisfies TemplateEntry
