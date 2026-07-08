import { createFileRoute } from '@tanstack/react-router'
import { Megaphone } from 'lucide-react'
import { AdminManualCommunication } from '@/components/admin/AdminManualCommunication'
import { AdminPageHeader, AdminSection } from '@/components/admin/ui'

export const Route = createFileRoute('/_authenticated/admin/communication')({
  component: AdminCommunicationPage,
})

function AdminCommunicationPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Centre de communication"
        title="Emails & notifications"
        subtitle="Envoyer un email manuel avec template ou afficher une notification en haut des espaces convoyeur et client."
        status={<span className="admin-badge admin-badge--accent inline-flex items-center gap-1"><Megaphone size={12} /> Manuel admin</span>}
      />
      <AdminSection title="Nouvel envoi" description="Les emails restent individuels. Les notifications peuvent cibler un utilisateur, tous les convoyeurs ou tous les clients.">
        <AdminManualCommunication />
      </AdminSection>
    </div>
  )
}