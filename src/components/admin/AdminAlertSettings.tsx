import React, { useCallback, useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { BellRing, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card } from '@/components/admin/AdminUI'
import {
  getAdminAlertSettings,
  saveAdminAlertSettings,
  runAdminAlertDispatch,
} from '@/lib/admin-alerts.functions'

type Recent = {
  id: string
  type: string
  titre: string
  message: string | null
  created_at: string
  email_sent_at: string | null
}

export function AdminAlertSettings() {
  const load = useServerFn(getAdminAlertSettings)
  const save = useServerFn(saveAdminAlertSettings)
  const dispatch = useServerFn(runAdminAlertDispatch)

  const [enabled, setEnabled] = useState(true)
  const [emails, setEmails] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(0)
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = (await load()) as {
        enabled: boolean
        emails: string[]
        pending: number
        recent: Recent[]
      }
      setEnabled(r.enabled)
      setEmails(r.emails)
      setPending(r.pending)
      setRecent(r.recent)
    } catch {
      toast.error('Réglages des alertes indisponibles')
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const persist = async (nextEmails: string[], nextEnabled: boolean) => {
    setSaving(true)
    try {
      await save({ data: { enabled: nextEnabled, emails: nextEmails } })
      setEmails(nextEmails)
      setEnabled(nextEnabled)
      toast.success('Alertes enregistrées')
    } catch (e: any) {
      toast.error(e?.message || 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const addEmail = () => {
    const value = draft.trim().toLowerCase()
    if (!value.includes('@')) return toast.error('Adresse email invalide')
    if (emails.includes(value)) return toast.error('Adresse déjà présente')
    setDraft('')
    void persist([...emails, value], enabled)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-pro-accent" />
          <div>
            <h3 className="text-sm font-semibold text-pro-text">Alertes email automatiques</h3>
            <p className="text-xs text-pro-muted">
              Chaque nouvelle demande, devis, message de contact ou demande B2B déclenche un email
              vers les adresses ci-dessous (vérification toutes les 2 minutes).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && <Badge tone="warning">{pending} en attente</Badge>}
          <Button
            variant="secondary"
            icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            disabled={sending}
            onClick={async () => {
              setSending(true)
              try {
                const r = (await dispatch()) as { sent: number }
                toast.success(r.sent ? `${r.sent} alerte(s) envoyée(s)` : 'Aucune alerte en attente')
                await refresh()
              } catch (e: any) {
                toast.error(e?.message || 'Envoi impossible')
              } finally {
                setSending(false)
              }
            }}
          >
            Envoyer maintenant
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-pro-text-soft mb-4">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void persist(emails, e.target.checked)}
          className="accent-pro-accent"
        />
        Activer les alertes email
      </label>

      <div className="space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-pro-muted">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        ) : emails.length === 0 ? (
          <p className="text-sm text-pro-muted">Aucun destinataire — ajoutez au moins une adresse.</p>
        ) : (
          emails.map((email) => (
            <div
              key={email}
              className="flex items-center justify-between gap-3 rounded-xl border border-pro-border bg-pro-surface px-3 py-2"
            >
              <span className="text-sm text-pro-text truncate">{email}</span>
              <button
                type="button"
                className="text-pro-muted hover:text-red-500 transition-colors"
                onClick={() => void persist(emails.filter((e) => e !== email), enabled)}
                title="Retirer"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={draft}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addEmail()
            }
          }}
          placeholder="alerte@transportsligneo.fr"
          className="flex-1 rounded-xl border border-pro-border bg-pro-surface px-3 py-2 text-sm text-pro-text outline-none focus:border-pro-accent"
        />
        <Button
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          disabled={saving}
          onClick={addEmail}
        >
          Ajouter
        </Button>
      </div>

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider text-pro-muted mb-2">Dernières alertes</p>
          <div className="space-y-1.5">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-pro-text-soft">
                  {r.titre}
                  <span className="text-pro-muted"> · {new Date(r.created_at).toLocaleString('fr-FR')}</span>
                </span>
                <Badge tone={r.email_sent_at ? 'success' : 'warning'}>
                  {r.email_sent_at ? 'Envoyée' : 'En attente'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
      <input type="hidden" data-save-marker={String(saving)} />
      <span className="sr-only">
        <Save size={0} />
      </span>
    </Card>
  )
}
