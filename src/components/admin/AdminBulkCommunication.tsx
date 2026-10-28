import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { BellRing, Check, Loader2, Mail, Send, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { renderEmailPreview } from '@/lib/email-preview.functions'
import { getBulkAudience, sendBulkMessage, type BulkAudienceRow } from '@/lib/admin-bulk-communication.functions'

type Scope = 'convoyeurs' | 'clients' | 'waitlist'
type Channel = 'both' | 'mail' | 'push'

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'convoyeurs', label: 'Convoyeurs' },
  { key: 'clients', label: 'Clients' },
  { key: 'waitlist', label: "Liste d'attente" },
]

const PRESETS: Record<string, { label: string; subject: string; title: string; body: string }> = {
  libre: { label: 'Message libre (modèle Ligneo)', subject: 'Information de Transports Ligneo', title: 'Information de Transports Ligneo', body: 'Bonjour {prenom},\n\n' },
  playstore: {
    label: 'Annonce — appli Driver sur Google Play',
    subject: 'Votre appli Ligneo Driver arrive sur Google Play',
    title: 'Ligneo Driver bientôt sur Google Play',
    body: "Bonjour {prenom},\n\nD'ici une dizaine de jours, l'application Ligneo Driver sera disponible sur Google Play.\nEn attendant, vous pouvez déjà l'utiliser depuis notre site, en téléchargement web.",
  },
  maintenance: {
    label: 'Maintenance programmée',
    subject: 'Maintenance programmée',
    title: 'Maintenance programmée',
    body: "Bonjour {prenom},\n\nL'application sera indisponible quelques minutes pour une mise à jour. Merci de votre compréhension.",
  },
  documents: {
    label: 'Rappel — documents manquants',
    subject: 'Il manque des documents à votre dossier',
    title: 'Documents manquants',
    body: 'Bonjour {prenom},\n\nIl manque des documents à votre dossier. Merci de les déposer depuis votre espace pour finaliser votre validation.',
  },
}

const TAG_LABELS: Record<string, string> = {
  'docs:manquants': 'Documents manquants',
  recent: 'Inscrits < 30 j',
  'statut:valide': 'Validés',
  'statut:en_attente': 'En attente',
  'statut:refuse': 'Refusés',
  'statut:suspendu': 'Suspendus',
  'statut:a_contacter': 'À contacter',
  'statut:contacte': 'Contactés',
  'statut:invite': 'Invités',
  'type:independant': 'Indépendants',
  'type:salarie': 'Salariés',
  'type:flotte': 'Flotte',
  'type:pro': 'Professionnels',
  'type:particulier': 'Particuliers',
}
const tagLabel = (t: string) => TAG_LABELS[t] ?? t.split(':').pop()!.replace(/_/g, ' ')
const groupOf = (t: string) => (t.includes(':') ? t.split(':')[0] : t)

export function AdminBulkCommunication() {
  const fetchAudience = useServerFn(getBulkAudience)
  const sendBulk = useServerFn(sendBulkMessage)
  const renderPreview = useServerFn(renderEmailPreview)

  const [scope, setScope] = useState<Scope>('convoyeurs')
  const [rows, setRows] = useState<BulkAudienceRow[]>([])
  const [loadingAud, setLoadingAud] = useState(false)
  const [tagsOn, setTagsOn] = useState<Set<string>>(new Set())
  const [ville, setVille] = useState('')
  const [lastSeen, setLastSeen] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [showList, setShowList] = useState(false)

  const [channel, setChannel] = useState<Channel>('both')
  const [preset, setPreset] = useState('playstore')
  const [subject, setSubject] = useState(PRESETS.playstore.subject)
  const [title, setTitle] = useState(PRESETS.playstore.title)
  const [body, setBody] = useState(PRESETS.playstore.body)
  const [visualUrl, setVisualUrl] = useState('')
  const [ctaLabel, setCtaLabel] = useState("Installer l'application")
  const [ctaUrl, setCtaUrl] = useState('https://transportsligneo.fr/convoyeur')
  const [pushText, setPushText] = useState('')
  const [library, setLibrary] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [pvMode, setPvMode] = useState<'mail' | 'push'>('mail')
  const [pvWidth, setPvWidth] = useState<'d' | 'm'>('d')
  const [pvHtml, setPvHtml] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [sending, setSending] = useState(false)

  // ---- Audience
  useEffect(() => {
    let alive = true
    setLoadingAud(true)
    setTagsOn(new Set())
    setVille('')
    setLastSeen('')
    setExcluded(new Set())
    fetchAudience({ data: { scope } })
      .then((r) => alive && setRows(r as BulkAudienceRow[]))
      .catch((e) => {
        toast.error(e?.message || 'Impossible de charger les destinataires')
        if (alive) setRows([])
      })
      .finally(() => alive && setLoadingAud(false))
    return () => {
      alive = false
    }
  }, [scope, fetchAudience])

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])
  const villes = useMemo(() => [...new Set(rows.map((r) => r.ville).filter(Boolean) as string[])].sort(), [rows])

  const filtered = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const t of tagsOn) groups.set(groupOf(t), [...(groups.get(groupOf(t)) ?? []), t])
    const now = Date.now()
    return rows.filter((r) => {
      for (const [, list] of groups) if (!list.some((t) => r.tags.includes(t))) return false
      if (ville && r.ville !== ville) return false
      if (lastSeen) {
        const ts = r.lastSignIn ? new Date(r.lastSignIn).getTime() : null
        if (lastSeen === '7' && !(ts && now - ts < 7 * 86400000)) return false
        if (lastSeen === '30+' && !(ts && now - ts > 30 * 86400000)) return false
        if (lastSeen === 'never' && ts) return false
      }
      return true
    })
  }, [rows, tagsOn, ville, lastSeen])

  // Doublons d'email exclus
  const finalRecipients = useMemo(() => {
    const seen = new Set<string>()
    return filtered.filter((r) => {
      const k = r.email.toLowerCase()
      if (excluded.has(r.key) || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [filtered, excluded])

  const toggleTag = (t: string) =>
    setTagsOn((prev) => {
      const n = new Set(prev)
      n.has(t) ? n.delete(t) : n.add(t)
      return n
    })

  // ---- Images
  const loadLibrary = useCallback(async () => {
    const { data } = await supabase.storage.from('email-visuals').list('', { limit: 24, sortBy: { column: 'created_at', order: 'desc' } })
    setLibrary(
      (data ?? [])
        .filter((f) => f.name && !f.name.startsWith('.'))
        .map((f) => ({ name: f.name, url: supabase.storage.from('email-visuals').getPublicUrl(f.name).data.publicUrl })),
    )
  }, [])
  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  const upload = async (file: File | undefined | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Choisissez une image (JPG, PNG, WebP).')
    if (file.size > 5 * 1024 * 1024) return toast.error('Image trop lourde (5 Mo maximum).')
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const name = `${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, '-').slice(0, 40) || 'image'}.${ext}`.replace(/\.(\w+)\.\1$/, '.$1')
    const { error } = await supabase.storage.from('email-visuals').upload(name, file, { contentType: file.type, upsert: false })
    setUploading(false)
    if (error) return toast.error("Envoi de l'image impossible", { description: error.message })
    setVisualUrl(supabase.storage.from('email-visuals').getPublicUrl(name).data.publicUrl)
    void loadLibrary()
  }

  // ---- Présets
  const applyPreset = (key: string) => {
    setPreset(key)
    const p = PRESETS[key]
    setSubject(p.subject)
    setTitle(p.title)
    setBody(p.body)
  }
  const insertPrenom = () => {
    const el = bodyRef.current
    const pos = el?.selectionStart ?? body.length
    setBody(body.slice(0, pos) + '{prenom}' + body.slice(pos))
  }

  // ---- Prévisualisation (vrai modèle email, rendu serveur)
  const sample = finalRecipients[0]
  useEffect(() => {
    if (channel === 'push') return
    const t = setTimeout(async () => {
      try {
        const r = (await renderPreview({
          data: {
            templateName: 'message-manuel',
            templateData: {
              prenom: sample?.prenom || 'Thomas',
              subject,
              titre: title,
              message: body.replace(/\{prenom\}/gi, sample?.prenom || 'Thomas'),
              ctaLabel: ctaLabel || undefined,
              ctaUrl: ctaLabel ? ctaUrl : undefined,
              visualUrl: visualUrl || undefined,
            },
          },
        })) as { html: string }
        setPvHtml(r.html)
      } catch {
        /* aperçu indisponible */
      }
    }, 450)
    return () => clearTimeout(t)
  }, [renderPreview, subject, title, body, ctaLabel, ctaUrl, visualUrl, sample?.prenom, channel])

  const channels = { email: channel !== 'push', app: channel !== 'mail' }
  const n = finalRecipients.length
  const role = scope === 'clients' ? 'client' : scope === 'convoyeurs' ? 'convoyeur' : null

  const payload = () => ({
    recipients: finalRecipients.map((r) => ({ userId: r.userId, email: r.email, prenom: r.prenom })),
    role,
    channels: scope === 'waitlist' ? { email: true, app: false } : channels,
    subject,
    title,
    body,
    ctaLabel: ctaLabel || undefined,
    ctaUrl: ctaLabel && ctaUrl ? ctaUrl : undefined,
    visualUrl: visualUrl || undefined,
    pushText: pushText || undefined,
  })

  const send = async (testOnly = false) => {
    if (!testOnly && !n) return toast.error('Aucun destinataire.')
    if (!subject.trim() || !body.trim()) return toast.error("L'objet et le message sont obligatoires.")
    setSending(true)
    try {
      const base = payload()
      const res = (await sendBulk({
        data: testOnly ? { ...base, recipients: [{ email: 'test@example.com' }], testOnly: true } : base,
      })) as { emails: number; emailsFailed: number; notifications: number }
      if (testOnly) toast.success("Test envoyé à l'adresse d'alerte admin")
      else {
        toast.success(
          `${res.emails ? `${res.emails} email${res.emails > 1 ? 's' : ''}` : ''}${res.emails && res.notifications ? ' · ' : ''}${res.notifications ? `${res.notifications} notification${res.notifications > 1 ? 's' : ''}` : ''} envoyé${res.emails + res.notifications > 1 ? 's' : ''}`,
        )
        if (res.emailsFailed) toast.error(`${res.emailsFailed} email(s) en échec — voir l'historique`)
      }
      setConfirm(false)
    } catch (e: any) {
      toast.error(e?.message || 'Envoi impossible')
    } finally {
      setSending(false)
    }
  }

  const sendLabel =
    channel === 'push' && scope !== 'waitlist'
      ? `Envoyer la notification à ${n}`
      : `Envoyer à ${n} destinataire${n > 1 ? 's' : ''}`
  const whoLabel = { convoyeurs: 'convoyeurs', clients: 'clients', waitlist: "candidats en liste d'attente" }[scope]

  return (
    <div className="bkc grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
      <div className="space-y-4">
        {/* 1 · Destinataires */}
        <section className="bkc-card">
          <h3><i>1</i>Destinataires</h3>
          <div className="bkc-seg">
            {SCOPES.map((s) => (
              <button key={s.key} type="button" className={scope === s.key ? 'act' : ''} onClick={() => setScope(s.key)}>{s.label}</button>
            ))}
          </div>

          <label className="bkc-l">Filtres</label>
          <div className="bkc-chips">
            {loadingAud && <span className="text-xs text-slate-500"><Loader2 size={13} className="inline animate-spin" /> Chargement…</span>}
            {tagCounts.map(([t, c]) => (
              <button key={t} type="button" className={`bkc-chip ${tagsOn.has(t) ? 'act' : ''}`} onClick={() => toggleTag(t)}>
                {tagLabel(t)}<b>{c}</b>
              </button>
            ))}
          </div>
          <div className="bkc-row2">
            <div>
              <label className="bkc-l">Ville</label>
              <select className="bkc-in" value={ville} onChange={(e) => setVille(e.target.value)}>
                <option value="">Toutes</option>
                {villes.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            {scope !== 'waitlist' && (
              <div>
                <label className="bkc-l">Dernière connexion</label>
                <select className="bkc-in" value={lastSeen} onChange={(e) => setLastSeen(e.target.value)}>
                  <option value="">Peu importe</option>
                  <option value="7">Moins de 7 jours</option>
                  <option value="30+">Plus de 30 jours</option>
                  <option value="never">Jamais connecté</option>
                </select>
              </div>
            )}
          </div>

          <div className="bkc-cnt">
            <div className="n">{n}</div>
            <div className="min-w-0">
              <b>{n} {whoLabel}</b>
              <small>Les doublons sont exclus automatiquement. Décochez dans la liste pour retirer quelqu'un.</small>
            </div>
            <button type="button" className="bkc-b g sm ml-auto" onClick={() => setShowList((v) => !v)}>{showList ? 'Masquer' : 'Voir la liste'}</button>
          </div>
          {showList && (
            <div className="bkc-list">
              {filtered.slice(0, 300).map((r) => {
                const off = excluded.has(r.key)
                return (
                  <button type="button" key={r.key} onClick={() => setExcluded((p) => { const x = new Set(p); x.has(r.key) ? x.delete(r.key) : x.add(r.key); return x })}>
                    <span className={`bkc-chk ${off ? '' : 'on'}`}><Check size={12} strokeWidth={3} /></span>
                    <span className="truncate">{`${r.prenom} ${r.nom}`.trim() || r.email}</span>
                    <small>{r.ville ?? r.email}</small>
                  </button>
                )
              })}
              {filtered.length > 300 && <div className="p-2 text-center text-xs text-slate-500">… et {filtered.length - 300} autres</div>}
            </div>
          )}
        </section>

        {/* 2 · Message */}
        <section className="bkc-card">
          <h3><i>2</i>Message</h3>
          {scope !== 'waitlist' && (
            <div className="bkc-seg">
              <button type="button" className={channel === 'both' ? 'act' : ''} onClick={() => { setChannel('both'); setPvMode('mail') }}>Email + notification</button>
              <button type="button" className={channel === 'mail' ? 'act' : ''} onClick={() => { setChannel('mail'); setPvMode('mail') }}>Email seulement</button>
              <button type="button" className={channel === 'push' ? 'act' : ''} onClick={() => { setChannel('push'); setPvMode('push') }}>Notification seulement</button>
            </div>
          )}
          <label className="bkc-l">Modèle</label>
          <select className="bkc-in" value={preset} onChange={(e) => applyPreset(e.target.value)}>
            {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
          <label className="bkc-l">Objet de l'email</label>
          <input className="bkc-in" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label className="bkc-l">Titre dans le message</label>
          <input className="bkc-in" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="bkc-l">Message</label>
          <div className="bkc-tb">
            <button type="button" onClick={insertPrenom} className="wide">+ Prénom</button>
          </div>
          <textarea ref={bodyRef} className="bkc-in bkc-ta" value={body} onChange={(e) => setBody(e.target.value)} />

          <label className="bkc-l">Image (pub, visuel)</label>
          <div
            className="bkc-drop"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files?.[0]) }}
          >
            {uploading ? <><Loader2 size={15} className="inline animate-spin" /> Envoi…</> : <><Upload size={15} className="inline" /> Glissez une image ici ou <b>parcourir</b> (5 Mo max)</>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          <div className="bkc-lib">
            <button type="button" className={`th none ${!visualUrl ? 'on' : ''}`} onClick={() => setVisualUrl('')}><span>Aucune</span></button>
            {library.map((f) => (
              <button type="button" key={f.name} className={`th ${visualUrl === f.url ? 'on' : ''}`} onClick={() => setVisualUrl(f.url)}>
                <img src={f.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>

          <div className="bkc-row2">
            <div><label className="bkc-l">Bouton — texte</label><input className="bkc-in" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="(vide = pas de bouton)" /></div>
            <div><label className="bkc-l">Bouton — lien</label><input className="bkc-in" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} /></div>
          </div>
          {channel !== 'mail' && scope !== 'waitlist' && (
            <>
              <label className="bkc-l">Texte de la notification (facultatif)</label>
              <input className="bkc-in" value={pushText} onChange={(e) => setPushText(e.target.value)} placeholder="Par défaut : début du message" />
            </>
          )}
        </section>
      </div>

      {/* Prévisualisation */}
      <div className="bkc-pv">
        <div className="bkc-pvh">
          <b>Prévisualisation</b>
          {scope !== 'waitlist' && channel === 'both' && (
            <div className="bkc-seg">
              <button type="button" className={pvMode === 'mail' ? 'act' : ''} onClick={() => setPvMode('mail')}><Mail size={13} className="inline" /> Email</button>
              <button type="button" className={pvMode === 'push' ? 'act' : ''} onClick={() => setPvMode('push')}><BellRing size={13} className="inline" /> Notification</button>
            </div>
          )}
          {pvMode === 'mail' && (
            <div className="bkc-seg">
              <button type="button" className={pvWidth === 'd' ? 'act' : ''} onClick={() => setPvWidth('d')}>PC</button>
              <button type="button" className={pvWidth === 'm' ? 'act' : ''} onClick={() => setPvWidth('m')}>Mobile</button>
            </div>
          )}
        </div>
        <div className="bkc-dev">
          {pvMode === 'mail' ? (
            <iframe title="Aperçu email" srcDoc={pvHtml} style={{ width: pvWidth === 'm' ? 360 : '100%', height: 620 }} />
          ) : (
            <div className="bkc-push">
              <img src="/icons/icon-192.png" alt="" />
              <div className="min-w-0">
                <b>{title}</b>
                <p>{pushText || body.replace(/\{prenom\}/gi, sample?.prenom || 'Thomas').slice(0, 120)}</p>
              </div>
              <small>maintenant</small>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="bkc-b g" disabled={sending} onClick={() => send(true)}><Mail size={14} />Envoyer un test à moi</button>
          <button type="button" className="bkc-b pr ml-auto" disabled={sending || !n} onClick={() => setConfirm(true)}>
            <Send size={14} />{sendLabel}
          </button>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" onClick={() => !sending && setConfirm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[17px] font-bold text-slate-900">Confirmer l'envoi</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              {n} destinataire{n > 1 ? 's' : ''} ({whoLabel}) vont recevoir ce message par{' '}
              {scope === 'waitlist' ? 'email' : channel === 'both' ? 'email et notification' : channel === 'mail' ? 'email' : 'notification'}.
              L'envoi ne peut pas être annulé.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="bkc-b g" disabled={sending} onClick={() => setConfirm(false)}>Annuler</button>
              <button type="button" className="bkc-b pr" disabled={sending} onClick={() => send(false)}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Oui, envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
