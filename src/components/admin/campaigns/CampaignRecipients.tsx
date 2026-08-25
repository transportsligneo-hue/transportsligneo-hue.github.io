import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AdminBadge, AdminEmpty } from '@/components/admin/ui'
import type { AudienceContact } from '@/lib/campaigns.functions'
import { Search, Users, UserPlus, Plus } from 'lucide-react'

interface Props {
  contacts: AudienceContact[]
  tiers: { name: string }[]
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  onAddManual?: (contact: { email: string; prenom: string; nom: string; entreprise: string }) => void
}


const SEGMENTS = [
  { key: 'all', label: 'Tous' },
  { key: 'b2b', label: 'Concessions / B2B' },
  { key: 'flotte', label: 'Flottes' },
  { key: 'organisation', label: 'Organisations' },
  { key: 'particulier', label: 'Particuliers' },
] as const

export function CampaignRecipients({ contacts, tiers, selected, onSelectedChange, onAddManual }: Props) {
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<string>('all')
  const [tier, setTier] = useState<string>('all')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [manualPrenom, setManualPrenom] = useState('')
  const [manualNom, setManualNom] = useState('')
  const [manualEntreprise, setManualEntreprise] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  const submitManual = () => {
    const email = manualEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setManualError('Adresse email invalide')
      return
    }
    setManualError(null)
    onAddManual?.({
      email,
      prenom: manualPrenom.trim(),
      nom: manualNom.trim(),
      entreprise: manualEntreprise.trim(),
    })
    setManualEmail('')
    setManualPrenom('')
    setManualNom('')
    setManualEntreprise('')
  }

  const eligible = useMemo(() => contacts.filter((c) => !c.unsubscribed), [contacts])


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return eligible.filter((c) => {
      if (segment !== 'all' && c.segment !== segment) return false
      if (tier !== 'all' && (c.tier ?? '—') !== tier) return false
      if (!q) return true
      return [c.email, c.prenom, c.nom, c.entreprise].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [eligible, search, segment, tier])

  const toggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectedChange(next)
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.key))

  const toggleAll = () => {
    const next = new Set(selected)
    if (allFilteredSelected) filtered.forEach((c) => next.delete(c.key))
    else filtered.forEach((c) => next.add(c.key))
    onSelectedChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un nom, une entreprise, un email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{selected.size}</span>
          <span className="text-muted-foreground">sélectionné(s) / {filtered.length} affiché(s)</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
          {allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <Button
            key={s.key}
            type="button"
            size="sm"
            variant={segment === s.key ? 'default' : 'outline'}
            onClick={() => setSegment(s.key)}
          >
            {s.label}
          </Button>
        ))}
        <span className="mx-2 h-6 w-px bg-border" />
        <Button
          type="button"
          size="sm"
          variant={tier === 'all' ? 'default' : 'outline'}
          onClick={() => setTier('all')}
        >
          Tous paliers km
        </Button>
        {tiers.map((t) => (
          <Button
            key={t.name}
            type="button"
            size="sm"
            variant={tier === t.name ? 'default' : 'outline'}
            onClick={() => setTier(t.name)}
          >
            {t.name}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <AdminEmpty icon={Users} title="Aucun destinataire" description="Ajustez la recherche ou les filtres." />
      ) : (
        <div className="rounded-xl border divide-y max-h-[480px] overflow-auto">
          {filtered.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40"
            >
              <Checkbox checked={selected.has(c.key)} onCheckedChange={() => toggle(c.key)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {c.entreprise || `${c.prenom} ${c.nom}`.trim() || c.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.email}
                  {c.entreprise && (c.prenom || c.nom) ? ` • ${c.prenom} ${c.nom}`.trimEnd() : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.tier && <AdminBadge label={c.tier} tone="info" />}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(c.totalKm).toLocaleString('fr-FR')} km
                </span>
              </div>
            </label>
          ))}
        </div>
      )}

      {contacts.some((c) => c.unsubscribed) && (
        <p className="text-xs text-muted-foreground">
          {contacts.filter((c) => c.unsubscribed).length} contact(s) désinscrit(s) sont exclus
          automatiquement.
        </p>
      )}
    </div>
  )
}
