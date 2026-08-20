import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { BellRing, Eye, Loader2, Mail, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { sendTransactionalEmail } from '@/lib/email/send'
import { renderEmailPreview } from '@/lib/email-preview.functions'
import {
  getCommunicationRecipients,
  getEmailTemplateCatalog,
  sendAdminPushNotification,
} from '@/lib/admin-communication.functions'

type TemplateInfo = {
  name: string
  displayName: string
  subject: string
  fields: string[]
  previewData: Record<string, any>
}

type Recipient = {
  userId: string
  label: string
  email: string | null
  meta?: string
  role: 'convoyeur' | 'client'
}

type SingleRecipient = {
  userId?: string | null
  email?: string | null
  label?: string
  prenom?: string | null
  nom?: string | null
  role?: 'convoyeur' | 'client'
}

export function AdminManualCommunication({ recipient }: { recipient?: SingleRecipient }) {
  const listTemplates = useServerFn(getEmailTemplateCatalog)
  const listRecipients = useServerFn(getCommunicationRecipients)
  const sendPush = useServerFn(sendAdminPushNotification)
  const renderPreview = useServerFn(renderEmailPreview)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipientScope, setRecipientScope] = useState<'convoyeurs' | 'clients'>(recipient?.role === 'client' ? 'clients' : 'convoyeurs')
  const [selectedTemplate, setSelectedTemplate] = useState('message-manuel')
  const [emailTo, setEmailTo] = useState(recipient?.email ?? '')
  const [templateData, setTemplateData] = useState<Record<string, string>>({})
  const [sendingEmail, setSendingEmail] = useState(false)
  const [preview, setPreview] = useState<{ html: string; subject: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [pushTarget, setPushTarget] = useState<'single' | 'convoyeurs' | 'clients' | 'all'>(recipient ? 'single' : 'convoyeurs')
  const [selectedUserId, setSelectedUserId] = useState(recipient?.userId ?? '')
  const [pushTitle, setPushTitle] = useState('Message Transports Ligneo')
  const [pushBody, setPushBody] = useState('')
  const [pushUrl, setPushUrl] = useState(recipient?.role === 'convoyeur' ? '/convoyeur' : '/dashboard-client')
  const [pushPriority, setPushPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [sendingPush, setSendingPush] = useState(false)

  useEffect(() => {
    listTemplates().then((items) => setTemplates(items as TemplateInfo[])).catch(() => toast.error('Templates indisponibles'))
  }, [listTemplates])

  useEffect(() => {
    if (recipient?.userId) return
    listRecipients({ data: { scope: recipientScope } })
      .then((items) => setRecipients(items as Recipient[]))
      .catch(() => setRecipients([]))
  }, [listRecipients, recipient?.userId, recipientScope])

  const template = useMemo(
    () => templates.find((t) => t.name === selectedTemplate) ?? templates[0],
    [templates, selectedTemplate],
  )

  useEffect(() => {
    if (!template) return
    const next: Record<string, string> = {}
    for (const field of template.fields) {
      const lower = field.toLowerCase()
      if (lower === 'prenom') next[field] = recipient?.prenom ?? ''
      else if (lower === 'nom') next[field] = recipient?.nom ?? ''
      else if (lower === 'titre') next[field] = 'Information concernant votre dossier'
      else if (lower === 'message') next[field] = ''
      else next[field] = String(template.previewData?.[field] ?? '')
    }
    setTemplateData(next)
  }, [template?.name, recipient?.prenom, recipient?.nom])

  const chooseRecipient = (userId: string) => {
    setSelectedUserId(userId)
    const found = recipients.find((r) => r.userId === userId)
    if (found?.email) setEmailTo(found.email)
  }

  const openPreview = async () => {
    if (!selectedTemplate) return
    setPreviewLoading(true)
    try {
      const result = await renderPreview({ data: { templateName: selectedTemplate, templateData } })
      setPreview(result as { html: string; subject: string })
    } catch (error: any) {
      toast.error(error?.message || 'Aperçu indisponible')
    } finally {
      setPreviewLoading(false)
    }
  }

  const submitEmail = async () => {
    if (!emailTo || !selectedTemplate) {
      toast.error('Choisissez un template et une adresse email.')
      return
    }
    setSendingEmail(true)
    try {
      await sendTransactionalEmail({
        templateName: selectedTemplate,
        recipientEmail: emailTo,
        idempotencyKey: `admin-manual-${selectedTemplate}-${emailTo}-${Date.now()}`,
        templateData,
      })
      toast.success('Email ajouté à la file d’envoi')
    } catch (error: any) {
      toast.error(error?.message || 'Envoi email impossible')
    } finally {
      setSendingEmail(false)
    }
  }

  const submitPush = async () => {
    if (!pushTitle.trim()) {
      toast.error('Le titre est obligatoire.')
      return
    }
    if (pushTarget === 'single' && !selectedUserId) {
      toast.error('Sélectionnez un destinataire.')
      return
    }
    setSendingPush(true)
    try {
      const target = pushTarget === 'single'
        ? { mode: 'user' as const, userId: selectedUserId }
        : pushTarget === 'all'
          ? { mode: 'all' as const }
          : { mode: 'role' as const, role: pushTarget === 'convoyeurs' ? 'convoyeur' as const : 'client' as const }
      const result = await sendPush({
        data: {
          target,
          payload: { title: pushTitle, body: pushBody, url: pushUrl, priority: pushPriority },
        },
      })
      toast.success(`${result.inserted} notification${result.inserted > 1 ? 's' : ''} créée${result.sent ? ` · ${result.sent} push envoyé${result.sent > 1 ? 's' : ''}` : ''}`)
    } catch (error: any) {
      toast.error(error?.message || 'Notification impossible')
    } finally {
      setSendingPush(false)
    }
  }

  const fieldInput = (field: string) => {
    const lower = field.toLowerCase()
    const multiline = ['message', 'motif', 'commentaire', 'notes', 'instructions', 'intro'].some((k) => lower.includes(k))
    const common = {
      value: templateData[field] ?? '',
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setTemplateData((prev) => ({ ...prev, [field]: e.target.value })),
      className: 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/25',
      placeholder: field,
    }
    return multiline ? <textarea {...common} className={`${common.className} min-h-[110px]`} /> : <input {...common} />
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Mail size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Email manuel depuis template</h3>
            <p className="text-xs text-slate-500">Un email à un destinataire précis, avec champs remplis manuellement.</p>
          </div>
        </div>

        {!recipient?.userId && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <select value={recipientScope} onChange={(e) => setRecipientScope(e.target.value as 'convoyeurs' | 'clients')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="convoyeurs">Convoyeurs</option>
              <option value="clients">Clients</option>
            </select>
            <select value={selectedUserId} onChange={(e) => chooseRecipient(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="">Choisir un destinataire…</option>
              {recipients.map((r) => <option key={r.userId} value={r.userId}>{r.label} · {r.email}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Destinataire email</label>
          <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="email@exemple.fr" />

          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Template</label>
          <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
            {templates.map((t) => <option key={t.name} value={t.name}>{t.displayName}</option>)}
          </select>
          {template?.subject && <p className="text-xs text-slate-500">Sujet : {template.subject}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            {template?.fields.map((field) => (
              <div key={field} className={field.toLowerCase().includes('message') ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{field}</label>
                {fieldInput(field)}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={submitEmail} disabled={sendingEmail} className="admin-btn-primary inline-flex items-center gap-2">
              {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Envoyer l'email
            </button>
            <button
              onClick={openPreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              Prévisualiser
            </button>
          </div>
        </div>

        {preview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={() => setPreview(null)}>
            <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">Aperçu email — {template?.displayName}</p>
                  <p className="truncate text-xs text-slate-500">Objet : {preview.subject}</p>
                </div>
                <button type="button" onClick={() => setPreview(null)} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer l'aperçu">
                  <X size={16} />
                </button>
              </div>
              <iframe srcDoc={preview.html} title="Aperçu email" className="min-h-0 flex-1 w-full bg-slate-100" />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <BellRing size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Notification en haut de l'application</h3>
            <p className="text-xs text-slate-500">Crée une notification in-app et déclenche le push si l'utilisateur l'a activé.</p>
          </div>
        </div>

        <div className="space-y-3">
          {!recipient?.userId && (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Cible</label>
              <select value={pushTarget} onChange={(e) => setPushTarget(e.target.value as typeof pushTarget)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                <option value="convoyeurs">Tous les convoyeurs</option>
                <option value="clients">Tous les clients</option>
                <option value="all">Convoyeurs + clients</option>
                <option value="single">Un destinataire précis</option>
              </select>
              {pushTarget === 'single' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={recipientScope} onChange={(e) => setRecipientScope(e.target.value as 'convoyeurs' | 'clients')} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <option value="convoyeurs">Convoyeurs</option>
                    <option value="clients">Clients</option>
                  </select>
                  <select value={selectedUserId} onChange={(e) => chooseRecipient(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Choisir…</option>
                    {recipients.map((r) => <option key={r.userId} value={r.userId}>{r.label}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          {recipient?.label && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Destinataire : <strong>{recipient.label}</strong></p>}
          <input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Titre" />
          <textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} className="min-h-[110px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Message" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={pushUrl} onChange={(e) => setPushUrl(e.target.value)} className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Lien interne ex. /convoyeur/missions" />
            <select value={pushPriority} onChange={(e) => setPushPriority(e.target.value as typeof pushPriority)} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="normal">Normal</option>
              <option value="high">Important</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <button onClick={submitPush} disabled={sendingPush} className="admin-btn-primary inline-flex items-center gap-2">
            {sendingPush ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
            Envoyer la notification
          </button>
        </div>
      </section>
    </div>
  )
}