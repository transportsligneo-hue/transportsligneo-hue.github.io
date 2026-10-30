import { useCallback, useEffect, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Loader2, Send, Inbox } from 'lucide-react'
import {
  addInboundContactReply,
  getContactThread,
  replyToContact,
  type ContactReply,
} from '@/lib/contact-thread.functions'

interface Contact {
  id: string
  prenom: string
  nom: string
  email: string
  message: string
  created_at: string
  type_demande: string
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Conversation façon chat avec un contact : sa demande, vos réponses envoyées par mail (gabarit Ligneo) et les réponses reçues. */
export function ContactThread({ contact, onReplied }: { contact: Contact; onReplied?: () => void }) {
  const getFn = useServerFn(getContactThread)
  const replyFn = useServerFn(replyToContact)
  const inboundFn = useServerFn(addInboundContactReply)
  const [replies, setReplies] = useState<ContactReply[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState('Re : votre demande de contact')
  const [body, setBody] = useState('')
  const [mode, setMode] = useState<'reply' | 'inbound'>('reply')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try { setReplies(await getFn({ data: { contactId: contact.id } })) }
    catch (e: any) { toast.error(e?.message ?? "Historique indisponible (la table n'est pas encore créée ?)") }
    finally { setLoading(false) }
  }, [getFn, contact.id])

  useEffect(() => { setLoading(true); setReplies([]); setBody(''); setMode('reply'); void load() }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [replies.length])

  const submit = async () => {
    setBusy(true)
    try {
      const row = mode === 'reply'
        ? await replyFn({ data: { contactId: contact.id, subject, body } })
        : await inboundFn({ data: { contactId: contact.id, body } })
      setReplies((r) => [...r, row])
      setBody('')
      toast.success(mode === 'reply' ? `Réponse envoyée à ${contact.email}` : 'Réponse reçue ajoutée au fil')
      onReplied?.()
    } catch (e: any) {
      toast.error(e?.message ?? 'Action impossible')
    } finally { setBusy(false) }
  }

  const bubble = (side: 'in' | 'out', text: string, meta: string, subjectLine?: string | null) => (
    <div className={`flex ${side === 'out' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
        side === 'out' ? 'rounded-br-sm bg-[#2f5fff] text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
      }`}>
        {subjectLine ? <p className={`mb-1 text-[11px] font-semibold ${side === 'out' ? 'text-white/80' : 'text-slate-500'}`}>{subjectLine}</p> : null}
        <p className="whitespace-pre-wrap">{text}</p>
        <p className={`mt-1 text-[10.5px] ${side === 'out' ? 'text-white/70' : 'text-slate-400'}`}>{meta}</p>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70">
      <div className="max-h-[340px] space-y-3 overflow-y-auto p-3">
        {bubble('in', contact.message, `${contact.prenom} ${contact.nom} · demande initiale · ${fmt(contact.created_at)}`)}
        {loading ? (
          <div className="flex justify-center py-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : replies.map((r) =>
          bubble(
            r.direction === 'out' ? 'out' : 'in',
            r.body,
            r.direction === 'out' ? `Envoyé par mail · ${fmt(r.created_at)}` : `Réponse reçue · ${fmt(r.created_at)}`,
            r.direction === 'out' ? r.subject : null,
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-slate-200 bg-white p-3">
        <div className="flex gap-1.5 text-[11.5px] font-semibold">
          <button onClick={() => setMode('reply')} className={`rounded-full px-3 py-1 ${mode === 'reply' ? 'bg-[#2f5fff] text-white' : 'bg-slate-100 text-slate-600'}`}>
            Répondre par mail
          </button>
          <button onClick={() => setMode('inbound')} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${mode === 'inbound' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <Inbox size={12} /> Noter sa réponse reçue
          </button>
        </div>
        {mode === 'reply' && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2f5fff]"
            placeholder="Objet du mail"
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#2f5fff]"
          placeholder={mode === 'reply'
            ? `Votre réponse à ${contact.prenom || 'ce contact'}… (envoyée avec le gabarit Ligneo, il répond directement par mail)`
            : 'Collez ici la réponse reçue par mail pour la garder dans l’historique'}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            {mode === 'reply' ? `Envoyé à ${contact.email} · ses réponses arrivent sur contact@transportsligneo.fr` : 'Rien n’est envoyé : simple note dans le fil.'}
          </p>
          <button
            onClick={() => void submit()}
            disabled={busy || !body.trim() || (mode === 'reply' && subject.trim().length < 2)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f5fff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#2450e0] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {mode === 'reply' ? 'Envoyer' : 'Ajouter au fil'}
          </button>
        </div>
      </div>
    </div>
  )
}
