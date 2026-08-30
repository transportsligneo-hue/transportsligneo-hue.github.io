import { createFileRoute } from '@tanstack/react-router'
import { AdminManualCommunication } from '@/components/admin/AdminManualCommunication'
import { AdminEmailHistory } from '@/components/admin/AdminEmailHistory'
import { AdminAlertSettings } from '@/components/admin/AdminAlertSettings'
import { AdminSection } from '@/components/admin/ui'
import { PageHeader } from '@/components/admin/AdminUI'

export const Route = createFileRoute('/_authenticated/admin/communication')({
  component: AdminCommunicationPage,
})

function AdminCommunicationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espace administration"
        title="Emails & notifications"
        subtitle="Envoyer un email manuel avec template ou afficher une notification en haut des espaces convoyeur et client."
      />
      <AdminSection
        title="Alertes automatiques"
        description="Ne plus rater une demande client : chaque nouvelle demande déclenche un email vers votre boîte."
      >
        <AdminAlertSettings />
      </AdminSection>
      <AdminSection title="Nouvel envoi" description="Les emails restent individuels. Les notifications peuvent cibler un utilisateur, tous les convoyeurs ou tous les clients.">
        <AdminManualCommunication />
      </AdminSection>
    </div>
  )
}

