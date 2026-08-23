import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AdminField } from '@/components/admin/ui'
import { CampaignEditor, type CampaignDraft } from '@/components/admin/campaigns/CampaignEditor'
import { sendDirectEmail } from '@/lib/direct-email.functions'

const EMPTY: CampaignDraft = {
  name: 'Email direct',
  subject: '',
  sender_name: 'Transports Ligneo',
  title: '',
  message: '',
  cta_text: '',
  cta_url: '',
  visual_url: null,
  preheader: '',
}

interface Props {
  defaultTo?: string
  defaultPrenom?: string
  defaultNom?: string
}

/** Éditeur d'email ponctuel : même rendu que les campagnes, un seul destinataire. */
export function DirectEmailComposer({ defaultTo = '', defaultPrenom = '', defaultNom = '' }: Props) {
  const send = useServerFn(sendDirectEmail)
  const [draft, setDraft] = useState<CampaignDraft>(EMPTY)
  const [to, setTo] = useState(defaultTo)
  const [prenom, setPrenom] = useState(defaultPrenom)
  const [nom, setNom] = useState(defaultNom)
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)
    try {
      await send({
        data: {
          ...draft,
          to: to.trim(),
          prenom,
          nom,
          entreprise: '',
        },
      })
      toast.success(`Email envoyé à ${to.trim()}`)
      setDraft({ ...EMPTY })
    } catch (e: any) {
      toast.error(e?.message ?? "Envoi impossible")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminField label="Destinataire (email)">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@exemple.fr" />
        </AdminField>
        <AdminField label="Prénom (variable {{prenom}})">
          <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Morgane" />
        </AdminField>
        <AdminField label="Nom (variable {{nom}})">
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Landais" />
        </AdminField>
      </div>

      <CampaignEditor value={draft} onChange={setDraft} />

      <div className="flex justify-end">
        <Button
          onClick={() => void submit()}
          disabled={sending || !to.trim() || !draft.subject?.trim() || !draft.message?.trim()}
          className="bg-[#2F5FFF] hover:bg-[#2450e0] text-white"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Envoyer l'email
        </Button>
      </div>
    </div>
  )
}
