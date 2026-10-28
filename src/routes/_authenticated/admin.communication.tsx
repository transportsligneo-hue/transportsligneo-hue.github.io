import { createFileRoute } from '@tanstack/react-router'
import { AdminBulkCommunication } from '@/components/admin/AdminBulkCommunication'
import AdminSectionHeader from '@/components/admin/AdminSectionHeader'
import { AdminEmailHistory } from '@/components/admin/AdminEmailHistory'
import { AdminAlertSettings } from '@/components/admin/AdminAlertSettings'
import { AdminSection } from '@/components/admin/ui'

export const Route = createFileRoute('/_authenticated/admin/communication')({
  component: AdminCommunicationPage,
})

function AdminCommunicationPage() {
  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Emails"
        eyebrow="Réglages & outils"
        title="Emails &"
        highlight="push"
      />
      <AdminSection title="Nouvel envoi" description="Modèle Ligneo appliqué automatiquement. Chaque destinataire reçoit un email individuel.">
        <AdminBulkCommunication />
      </AdminSection>
      <AdminSection
        title="Alertes automatiques"
        description="Ne plus rater une demande client : chaque nouvelle demande déclenche un email vers votre boîte."
      >
        <AdminAlertSettings />
      </AdminSection>
      <AdminSection
        title="Historique des emails envoyés"
        description="Tous les emails partis depuis la plateforme : devis, documents, envois directs et alertes."
      >
        <AdminEmailHistory />
      </AdminSection>
    </div>
  )
}

