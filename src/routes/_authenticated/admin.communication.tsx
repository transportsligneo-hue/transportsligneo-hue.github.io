import { createFileRoute } from '@tanstack/react-router'
import { AdminManualCommunication } from '@/components/admin/AdminManualCommunication'
import { AdminSection } from '@/components/admin/ui'

export const Route = createFileRoute('/_authenticated/admin/communication')({
  component: AdminCommunicationPage,
})

function AdminCommunicationPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-[color:var(--admin-text)]">Emails & notifications</h1>
        <p className="text-sm text-[color:var(--admin-muted)]">Envoyer un email manuel avec template ou afficher une notification en haut des espaces convoyeur et client.</p>
      </div>
      <AdminSection title="Nouvel envoi" description="Les emails restent individuels. Les notifications peuvent cibler un utilisateur, tous les convoyeurs ou tous les clients.">
        <AdminManualCommunication />
      </AdminSection>
    </div>
  )
}
