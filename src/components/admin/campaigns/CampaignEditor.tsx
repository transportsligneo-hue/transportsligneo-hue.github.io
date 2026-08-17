import { useMemo, useRef, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AdminField } from '@/components/admin/ui'
import { CAMPAIGN_VARIABLES, buildCampaignHtml, type CampaignContent } from '@/lib/campaigns/render'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export interface CampaignDraft extends CampaignContent {
  id?: string
  name: string
}

interface Props {
  value: CampaignDraft
  onChange: (next: CampaignDraft) => void
}

export function CampaignEditor({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<CampaignDraft>) => onChange({ ...value, ...patch })

  const previewHtml = useMemo(
    () =>
      buildCampaignHtml({
        campaign: value,
        vars: { prenom: 'Morgane', nom: 'Landais', entreprise: 'CAT FRANCE', solde_km: 12450 },
      }),
    [value],
  )

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const path = `visuels/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage.from('campaign-assets').upload(path, file, {
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) throw error
      const { data, error: signError } = await supabase.storage
        .from('campaign-assets')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (signError || !data?.signedUrl) throw signError ?? new Error('URL indisponible')
      const absolute = data.signedUrl.startsWith('http')
        ? data.signedUrl
        : `${window.location.origin}${data.signedUrl}`
      set({ visual_url: absolute })
      toast.success('Visuel ajouté')
    } catch (error) {
      console.error(error)
      toast.error("Échec de l'upload du visuel")
    } finally {
      setUploading(false)
    }
  }

  const insertVariable = (token: string) => {
    set({ message: `${value.message ?? ''}${token}` })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Nom interne">
            <Input
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Relance clients concessions — mars"
            />
          </AdminField>
          <AdminField label="Nom expéditeur">
            <Input
              value={value.sender_name ?? ''}
              onChange={(e) => set({ sender_name: e.target.value })}
              placeholder="Transports Ligneo"
            />
          </AdminField>
        </div>

        <AdminField label="Objet de l'email">
          <Input
            value={value.subject ?? ''}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="Votre Compte Kilomètres passe au niveau supérieur"
          />
        </AdminField>

        <AdminField label="Pré-header (aperçu boîte de réception)">
          <Input
            value={value.preheader ?? ''}
            onChange={(e) => set({ preheader: e.target.value })}
            placeholder="Découvrez vos avantages convoyage 2026"
          />
        </AdminField>

        <AdminField label="Titre affiché">
          <Input
            value={value.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Bonjour {{prenom}}, vos convoyages en un clic"
          />
        </AdminField>

        <AdminField label="Message">
          <Textarea
            rows={9}
            value={value.message ?? ''}
            onChange={(e) => set({ message: e.target.value })}
            placeholder="Bonjour {{prenom}},&#10;&#10;Votre entreprise {{entreprise}} cumule {{solde_km}} km convoyés avec Ligneo…"
          />
        </AdminField>

        <div className="flex flex-wrap gap-2">
          {CAMPAIGN_VARIABLES.map((v) => (
            <Button
              key={v.token}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => insertVariable(v.token)}
            >
              {v.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Texte du bouton">
            <Input
              value={value.cta_text ?? ''}
              onChange={(e) => set({ cta_text: e.target.value })}
              placeholder="Demander un convoyage"
            />
          </AdminField>
          <AdminField label="Lien du bouton">
            <Input
              value={value.cta_url ?? ''}
              onChange={(e) => set({ cta_url: e.target.value })}
              placeholder="https://www.transportsligneo.fr/reserver"
            />
          </AdminField>
        </div>

        <AdminField label="Visuel de campagne">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-2" />
              )}
              {value.visual_url ? 'Remplacer' : 'Ajouter un visuel'}
            </Button>
            {value.visual_url && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ visual_url: null })}>
                <Trash2 className="h-4 w-4 mr-1" /> Retirer
              </Button>
            )}
          </div>
        </AdminField>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Aperçu en direct</p>
        <div className="rounded-xl border overflow-hidden bg-muted/40">
          <iframe
            title="Aperçu de la campagne"
            srcDoc={previewHtml}
            className="w-full h-[720px] bg-white"
          />
        </div>
      </div>
    </div>
  )
}
