import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { PageHeader } from '@/components/admin/AdminUI'
import { AdminSection, AdminStatCard, AdminBadge, AdminEmpty } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CampaignEditor, type CampaignDraft } from '@/components/admin/campaigns/CampaignEditor'
import { CampaignRecipients } from '@/components/admin/campaigns/CampaignRecipients'
import { listCampaignAudience, sendCampaign, type AudienceContact } from '@/lib/campaigns.functions'
import { Loader2, Mail, MousePointerClick, Send, Eye, Save, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/campagnes')({
  component: AdminCampagnesPage,
})

const EMPTY_DRAFT: CampaignDraft = {
  name: '',
  subject: '',
  sender_name: 'Transports Ligneo',
  title: '',
  message: '',
  cta_text: '',
  cta_url: '',
  visual_url: null,
  preheader: '',
}

interface CampaignRow {
  id: string
  name: string
  subject: string | null
  status: string
  sent_at: string | null
  created_at: string
}

function AdminCampagnesPage() {
  const queryClient = useQueryClient()
  const fetchAudience = useServerFn(listCampaignAudience)
  const send = useServerFn(sendCampaign)

  const [draft, setDraft] = useState<CampaignDraft>(EMPTY_DRAFT)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const audienceQuery = useQuery({
    queryKey: ['campaign-audience'],
    queryFn: () => fetchAudience(),
  })

  const tiersQuery = useQuery({
    queryKey: ['km-tiers'],
    queryFn: async () => {
      const { data } = await supabase.from('km_tiers').select('name, min_km').order('sort_order')
      return (data ?? []) as { name: string; min_km: number }[]
    },
  })

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, subject, status, sent_at, created_at')
        .order('created_at', { ascending: false })
      return (data ?? []) as CampaignRow[]
    },
  })

  const statsQuery = useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async () => {
      const [{ data: recipients }, { data: events }] = await Promise.all([
        supabase.from('campaign_recipients').select('id, campaign_id, status'),
        supabase.from('campaign_events').select('campaign_id, recipient_id, event_type'),
      ])
      const map = new Map<string, { sent: number; opens: Set<string>; clicks: Set<string> }>()
      for (const r of recipients ?? []) {
        const entry = map.get(r.campaign_id) ?? { sent: 0, opens: new Set(), clicks: new Set() }
        if (r.status === 'sent') entry.sent += 1
        map.set(r.campaign_id, entry)
      }
      for (const e of events ?? []) {
        const entry = map.get(e.campaign_id) ?? { sent: 0, opens: new Set(), clicks: new Set() }
        if (e.event_type === 'open') entry.opens.add(e.recipient_id as string)
        if (e.event_type === 'click') entry.clicks.add(e.recipient_id as string)
        map.set(e.campaign_id, entry)
      }
      return map
    },
  })

  const contacts = audienceQuery.data ?? []
  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.key)),
    [contacts, selected],
  )

  useEffect(() => {
    if (audienceQuery.error) toast.error("Impossible de charger l'audience")
  }, [audienceQuery.error])

  const saveDraft = async (): Promise<string | null> => {
    if (!draft.name.trim()) {
      toast.error('Donnez un nom interne à la campagne')
      return null
    }
    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        subject: draft.subject ?? '',
        sender_name: draft.sender_name ?? 'Transports Ligneo',
        title: draft.title ?? '',
        message: draft.message ?? '',
        cta_text: draft.cta_text ?? '',
        cta_url: draft.cta_url ?? '',
        visual_url: draft.visual_url ?? null,
        preheader: draft.preheader ?? '',
      }
      if (draft.id) {
        const { error } = await supabase.from('campaigns').update(payload).eq('id', draft.id)
        if (error) throw error
        return draft.id
      }
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...payload, status: 'draft' })
        .select('id')
        .single()
      if (error) throw error
      setDraft({ ...draft, id: data.id })
      return data.id
    } catch (error) {
      console.error(error)
      toast.error("Échec de l'enregistrement")
      return null
    } finally {
      setSaving(false)
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    }
  }

  const handleSend = async () => {
    if (selectedContacts.length === 0) {
      toast.error('Sélectionnez au moins un destinataire')
      return
    }
    const campaignId = await saveDraft()
    if (!campaignId) return
    setSending(true)
    try {
      const result = await send({
        data: {
          campaignId,
          contacts: selectedContacts.map((c) => ({
            email: c.email,
            prenom: c.prenom,
            nom: c.nom,
            entreprise: c.entreprise,
            clientId: c.clientId,
            organizationId: c.organizationId,
            totalKm: c.totalKm,
          })),
        },
      })
      toast.success(
        `Campagne envoyée : ${result.sent} envoi(s), ${result.failed} échec(s), ${result.skipped} exclu(s)`,
      )
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      void queryClient.invalidateQueries({ queryKey: ['campaign-stats'] })
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Échec de l'envoi")
    } finally {
      setSending(false)
    }
  }

  const loadCampaign = async (id: string) => {
    const { data } = await supabase.from('campaigns').select('*').eq('id', id).maybeSingle()
    if (!data) return
    setDraft({
      id: data.id,
      name: data.name,
      subject: data.subject,
      sender_name: data.sender_name,
      title: data.title,
      message: data.message,
      cta_text: data.cta_text,
      cta_url: data.cta_url,
      visual_url: data.visual_url,
      preheader: data.preheader,
    })
    toast.success('Campagne chargée dans l\u2019éditeur')
  }

  const totals = useMemo(() => {
    let sent = 0
    let opens = 0
    let clicks = 0
    statsQuery.data?.forEach((s) => {
      sent += s.sent
      opens += s.opens.size
      clicks += s.clicks.size
    })
    return { sent, opens, clicks }
  }, [statsQuery.data])

  const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : '—')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Campagnes"
        subtitle="Créer, envoyer et suivre les campagnes email (ouvertures, clics, désinscriptions)."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Emails envoyés" value={String(totals.sent)} icon={Mail} />
        <AdminStatCard
          label="Taux d'ouverture"
          value={pct(totals.opens, totals.sent)}
          hint={`${totals.opens} ouverture(s)`}
          icon={Eye}
        />
        <AdminStatCard
          label="Taux de clic"
          value={pct(totals.clicks, totals.sent)}
          hint={`${totals.clicks} clic(s)`}
          icon={MousePointerClick}
        />
      </div>

      <Tabs defaultValue="editeur">
        <TabsList>
          <TabsTrigger value="editeur">Éditeur</TabsTrigger>
          <TabsTrigger value="destinataires">
            Destinataires{selected.size > 0 ? ` (${selected.size})` : ''}
          </TabsTrigger>
          <TabsTrigger value="historique">Campagnes précédentes</TabsTrigger>
        </TabsList>

        <TabsContent value="editeur" className="mt-4">
          <AdminSection
            title={draft.id ? 'Modifier la campagne' : 'Nouvelle campagne'}
            description="L'aperçu reprend l'en-tête navy des emails Ligneo."
            actions={
              <div className="flex gap-2">
                {draft.id && (
                  <Button variant="ghost" size="sm" onClick={() => setDraft(EMPTY_DRAFT)}>
                    Nouvelle
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void saveDraft()}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Enregistrer
                </Button>
              </div>
            }
          >
            <CampaignEditor value={draft} onChange={setDraft} />
          </AdminSection>
        </TabsContent>

        <TabsContent value="destinataires" className="mt-4">
          <AdminSection
            title="Sélection des destinataires"
            description="Clients et contacts d'organisations, segmentés par type de compte et palier du Compte Kilomètres."
            actions={
              <Button size="sm" disabled={sending} onClick={() => void handleSend()}>
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer à {selected.size}
              </Button>
            }
          >
            {audienceQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> Chargement de l'audience…
              </div>
            ) : (
              <CampaignRecipients
                contacts={contacts}
                tiers={tiersQuery.data ?? []}
                selected={selected}
                onSelectedChange={setSelected}
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="historique" className="mt-4">
          <AdminSection title="Campagnes précédentes" description="Statistiques d'ouverture et de clic par campagne.">
            {(campaignsQuery.data ?? []).length === 0 ? (
              <AdminEmpty icon={Megaphone} title="Aucune campagne" description="Créez votre première campagne dans l'éditeur." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4">Campagne</th>
                      <th className="py-2 pr-4">Statut</th>
                      <th className="py-2 pr-4">Envoyés</th>
                      <th className="py-2 pr-4">Ouvertures</th>
                      <th className="py-2 pr-4">Clics</th>
                      <th className="py-2 pr-4">Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(campaignsQuery.data ?? []).map((c) => {
                      const s = statsQuery.data?.get(c.id)
                      const sent = s?.sent ?? 0
                      return (
                        <tr key={c.id}>
                          <td className="py-3 pr-4">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.subject}</p>
                          </td>
                          <td className="py-3 pr-4"><AdminBadge label={c.status === 'sent' ? 'Envoyée' : 'Brouillon'} /></td>
                          <td className="py-3 pr-4 tabular-nums">{sent}</td>
                          <td className="py-3 pr-4 tabular-nums">
                            {s?.opens.size ?? 0} <span className="text-muted-foreground">({pct(s?.opens.size ?? 0, sent)})</span>
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {s?.clicks.size ?? 0} <span className="text-muted-foreground">({pct(s?.clicks.size ?? 0, sent)})</span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground">
                            {new Date(c.sent_at ?? c.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-3">
                            <Button size="sm" variant="ghost" onClick={() => void loadCampaign(c.id)}>
                              Ouvrir
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>
    </div>
  )
}
