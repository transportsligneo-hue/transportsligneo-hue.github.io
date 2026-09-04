/**
 * EditDevisDialog · édition complète d'un devis existant (admin).
 *
 * - Modifie client, adresses, date/heure, véhicule, option de trajet et prix
 * - Recalcule automatiquement la distance et le prix conseillé si les adresses
 *   ou l'option de trajet changent (sauf prix verrouillé manuellement)
 * - Conserve le même numéro de devis et incrémente la révision (v2, v3…)
 * - La fenêtre ne se ferme QUE via Fermer / Annuler (jamais au clic extérieur)
 */
import { useMemo, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, RefreshCw, Save, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/admin/AdminUI'
import PlacesInput from '@/components/PlacesInput'
import { calculateBasePrice, getDistance, type TripType } from '@/lib/reservation-pricing'
import { geocodeDistanceKm, normalizeAddress } from '@/lib/distance-fallback'
import { parseDevisSupplements } from '@/lib/devis-pdf'
import { lookupPlate } from '@/lib/plate.functions'
import {
  applyPlateauPoidsToMessage,
  HEAVY_CHECKBOX_LABEL,
  HEAVY_SURCHARGE,
  HEAVY_THRESHOLD_KG,
  parsePlateauPoids,
} from '@/lib/plateau-poids'


interface Props {
  devis: Record<string, any>
  onClose: () => void
  onSaved: (patch: Record<string, unknown>) => void
}

/** Libellés proposés — la valeur d'origine du devis est toujours conservée. */
const OPTIONS = [
  'Livraison simple',
  'Livraison + restitution',
  'Recharge uniquement (sans livraison)',
  'Aller simple',
  'Aller-retour',
  'Express',
] as const

/** Traduit un libellé libre en type tarifaire pour le recalcul. */
function toTripType(label: string): TripType {
  const t = label.toLowerCase()
  if (t.includes('express')) return 'express'
  if (t.includes('retour') || t.includes('restitution')) return 'aller_retour'
  return 'aller_simple'
}

/** Réécrit la ligne « Transport sur plateau » dans le récapitulatif message. */
function applyPlateauToMessage(message: string, plateau: boolean): string {
  const lines = message.split('\n').filter((l) => !/^\s*Transport sur plateau\s*:/i.test(l))
  lines.push(`Transport sur plateau : ${plateau ? 'oui (véhicule non roulant)' : 'non'}`)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Réécrit le libellé de la prestation principale et les lignes de suppléments. */
function applyLignesToMessage(
  message: string,
  principalLabel: string,
  supplements: Array<{ label: string; montant: string }>,
): string {
  const lines = message
    .split('\n')
    .filter((l) => !/^\s*Libell[ée] prestation\s*:/i.test(l) && !/^\s*Suppl[ée]ment\s*:/i.test(l))
  if (principalLabel.trim()) lines.push(`Libellé prestation : ${principalLabel.trim()}`)
  supplements.forEach((s) => {
    const montant = parseFloat(String(s.montant).replace(/\s/g, '').replace(',', '.'))
    if (s.label.trim() && Number.isFinite(montant) && montant > 0) {
      lines.push(`Supplément : ${s.label.trim()} = ${montant} €`)
    }
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const inputCls =
  'w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-pro-muted">{label}</span>
      {children}
    </label>
  )
}

export function EditDevisDialog({ devis, onClose, onSaved }: Props) {
  const initialOption = String(devis.option_trajet ?? 'Livraison simple')
  const initialParsed = parseDevisSupplements(devis.message)
  const initialPlateau = initialParsed.plateau
  const initialPoids = parsePlateauPoids(devis.message)
  /** Suppléments éditables : la majoration « > 1,1 t » reste pilotée par la case à cocher. */
  const initialSupplements = initialParsed.supplements
    .filter((s) => !/plus de 1[,.]1\s*t/i.test(s.label))
    .map((s) => ({ label: s.label, montant: String(s.montant) }))
  const initialPrincipalLabel =
    parseDevisPrestationLabel(devis.message) ??
    (initialPlateau ? 'Transport sur plateau porte-voiture' : 'Convoyage routier par conducteur professionnel')
  const suppTotal =
    initialSupplements.reduce((s, x) => s + (Number(x.montant) || 0), 0) + (initialPoids.lourd ? HEAVY_SURCHARGE : 0)
  const initialPrincipal = Math.max(0, +(Number(devis.prix_estime ?? 0) - suppTotal).toFixed(2))

  const [f, setF] = useState({
    prenom: devis.prenom ?? '',
    nom: devis.nom ?? '',
    email: devis.email ?? '',
    telephone: devis.telephone ?? '',
    depart: devis.depart ?? '',
    arrivee: devis.arrivee ?? '',
    date_souhaitee: devis.date_souhaitee ?? '',
    heure_souhaitee: devis.heure_souhaitee ?? '',
    date_a_determiner: !devis.date_souhaitee,
    option_trajet: initialOption,
    plateau: initialPlateau,
    lourd: initialPoids.lourd,
    poids_kg: initialPoids.poidsKg != null ? String(initialPoids.poidsKg) : '',
    marque: devis.marque ?? '',
    modele: devis.modele ?? '',
    type_vehicule: devis.type_vehicule ?? '',
    carburant: devis.carburant ?? '',
    immatriculation: devis.immatriculation ?? '',
    distance_km: devis.distance_km != null ? String(devis.distance_km) : '',
    principal_label: initialPrincipalLabel,
    principal_montant: String(initialPrincipal),
    prix_manuel: !!devis.prix_manuel,
    tarif_label: devis.tarif_label ?? '',
    message: devis.message ?? '',
  })
  const [supplements, setSupplements] = useState(initialSupplements)
  const [saving, setSaving] = useState(false)
  const [recalcul, setRecalcul] = useState(false)
  const [plateLoading, setPlateLoading] = useState(false)
  const lookupPlateFn = useServerFn(lookupPlate)

  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  const num = (v: string) => {
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  /** Total TTC affiché sur le devis = prestation principale + suppléments. */
  const totalTtc = useMemo(
    () =>
      +(
        num(f.principal_montant) +
        supplements.reduce((s, x) => s + num(x.montant), 0) +
        (f.plateau && f.lourd ? HEAVY_SURCHARGE : 0)
      ).toFixed(2),
    [f.principal_montant, f.plateau, f.lourd, supplements],
  )

  const updateSupp = (i: number, patch: Partial<{ label: string; montant: string }>) =>
    setSupplements((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const addSupp = () => setSupplements((p) => [...p, { label: '', montant: '' }])
  const removeSupp = (i: number) => setSupplements((p) => p.filter((_, idx) => idx !== i))

  /** Active ou retire la majoration « plus de 1,1 t » (ligne dédiée du devis). */
  const toggleLourd = (checked: boolean) => {
    set('lourd', checked)
    toast.info(
      checked
        ? `Majoration véhicule > 1,1 t appliquée (+${HEAVY_SURCHARGE} €)`
        : `Majoration véhicule > 1,1 t retirée (−${HEAVY_SURCHARGE} €)`,
    )
  }

  /** Récupère le poids (et les infos véhicule) via la plaque. */
  const rechercherPlaque = async () => {
    const plaque = f.immatriculation.trim().toUpperCase()
    if (plaque.replace(/[^A-Z0-9]/g, '').length < 4) {
      toast.error('Renseignez une immatriculation valide')
      return
    }
    setPlateLoading(true)
    try {
      const res = await lookupPlateFn({ data: { plate: plaque } })
      if (!res.ok || !res.data) {
        toast.error('Véhicule introuvable', { description: res.error ?? '' })
        return
      }
      const d = res.data
      const poids = d.poids ? Number(d.poids) : null
      setF((p) => ({
        ...p,
        marque: p.marque || d.marque || '',
        modele: p.modele || d.modele || '',
        carburant: p.carburant || d.carburant || '',
        poids_kg: poids != null && Number.isFinite(poids) ? String(poids) : p.poids_kg,
      }))
      if (poids != null && Number.isFinite(poids)) {
        toast.success(`Poids récupéré : ${poids} kg`, {
          description:
            poids > HEAVY_THRESHOLD_KG
              ? 'Au-dessus de 1,1 t — pensez à cocher la majoration.'
              : 'En dessous de 1,1 t — pas de majoration.',
        })
      } else {
        toast.warning('Poids non communiqué par le fichier véhicule', { description: 'Saisissez-le manuellement.' })
      }
    } catch (e) {
      toast.error('Recherche impossible', { description: e instanceof Error ? e.message : '' })
    } finally {
      setPlateLoading(false)
    }
  }


  /** Liste des options : les valeurs standard + celle du devis si elle diffère. */
  const optionList = useMemo(() => {
    const all = [...OPTIONS] as string[]
    if (initialOption && !all.some((o) => o.toLowerCase() === initialOption.toLowerCase())) {
      all.unshift(initialOption)
    }
    return all
  }, [initialOption])

  const trajetChanged = useMemo(
    () =>
      normalizeAddress(f.depart) !== normalizeAddress(devis.depart ?? '') ||
      normalizeAddress(f.arrivee) !== normalizeAddress(devis.arrivee ?? '') ||
      f.option_trajet !== initialOption,
    [f.depart, f.arrivee, f.option_trajet, devis, initialOption],
  )

  const recalculer = async () => {
    if (!f.depart.trim() || !f.arrivee.trim()) {
      toast.error('Renseignez les deux adresses')
      return
    }
    setRecalcul(true)
    try {
      const type = toTripType(f.option_trajet)
      let km = getDistance(f.depart, f.arrivee)
      if (km == null) km = await geocodeDistanceKm(f.depart, f.arrivee)
      const res = calculateBasePrice(f.depart, f.arrivee, type, km)
      setF((p) => ({
        ...p,
        distance_km: res.distance != null ? String(res.distance) : km != null ? String(km) : p.distance_km,
        tarif_label: res.label,
        principal_montant: res.base > 0 ? String(+res.base.toFixed(2)) : p.principal_montant,
        prix_manuel: false,
      }))

      if (res.base > 0) toast.success('Prix recalculé', { description: res.label })
      else toast.warning('Distance introuvable', { description: 'Saisissez le montant manuellement.' })
    } catch (e) {
      toast.error('Recalcul impossible', { description: e instanceof Error ? e.message : '' })
    } finally {
      setRecalcul(false)
    }
  }

  const save = async () => {
    const prix = totalTtc
    if (!Number.isFinite(prix) || prix <= 0) {
      toast.error('Montant TTC invalide')
      return
    }
    if (!f.depart.trim() || !f.arrivee.trim() || !f.email.trim() || !f.nom.trim()) {
      toast.error('Nom, email, départ et arrivée sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const km = f.distance_km === '' ? null : Number(String(f.distance_km).replace(',', '.'))
      const priceChanged = Number(devis.prix_estime ?? 0) !== prix
      const poidsKg = f.poids_kg === '' ? null : Number(String(f.poids_kg).replace(',', '.'))
      const message = applyPlateauPoidsToMessage(
        applyLignesToMessage(applyPlateauToMessage(f.message, f.plateau), f.principal_label, supplements),
        {
          plateau: f.plateau,
          lourd: f.plateau && f.lourd,
          poidsKg: poidsKg != null && Number.isFinite(poidsKg) ? poidsKg : null,
        },
      )

      const patch: Record<string, unknown> = {
        prenom: f.prenom.trim(),
        nom: f.nom.trim(),
        email: f.email.trim(),
        telephone: f.telephone.trim() || null,
        depart: f.depart.trim(),
        arrivee: f.arrivee.trim(),
        date_souhaitee: f.date_a_determiner ? null : f.date_souhaitee || null,
        heure_souhaitee: f.date_a_determiner ? null : f.heure_souhaitee || null,
        option_trajet: f.option_trajet,
        marque: f.marque.trim() || null,
        modele: f.modele.trim() || null,
        type_vehicule: f.type_vehicule.trim() || null,
        carburant: f.carburant.trim() || null,
        immatriculation: f.immatriculation.trim().toUpperCase() || null,
        distance_km: km != null && Number.isFinite(km) ? km : null,
        tarif_label: f.tarif_label || null,
        message: message || null,
        prix_estime: prix,
        prix_manuel: f.prix_manuel || (priceChanged && !trajetChanged),
        version: Number(devis.version ?? 1) + 1,
      }
      if (priceChanged) {
        patch.prix_aller = null
        patch.prix_retour = null
      }
      const { data, error } = await supabase
        .from('devis')
        .update(patch as never)
        .eq('id', devis.id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      onSaved((data as Record<string, unknown>) ?? patch)
      toast.success('Devis modifié', {
        description: `${devis.numero} · révision ${Number(devis.version ?? 1) + 1} · PDF régénéré`,
      })
      onClose()
    } catch (e) {
      toast.error('Enregistrement impossible', { description: e instanceof Error ? e.message : '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-pro-border px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted">Modifier le devis</p>
            <p className="text-sm font-semibold text-pro-text">
              {devis.numero} · révision actuelle v{devis.version ?? 1}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-pro-muted hover:bg-black/5" aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Prénom"><input className={inputCls} value={f.prenom} onChange={(e) => set('prenom', e.target.value)} /></Field>
            <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => set('nom', e.target.value)} /></Field>
            <Field label="Email"><input className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Téléphone"><input className={inputCls} value={f.telephone} onChange={(e) => set('telephone', e.target.value)} /></Field>
          </section>

          <section className="space-y-3 rounded-xl border border-pro-border p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-pro-muted">Trajet</p>
            <Field label="Adresse de départ">
              <PlacesInput
                value={f.depart}
                onChange={(v) => set('depart', v)}
                onSelect={(v) => set('depart', v)}
                placeholder="Ville, code postal ou adresse complète"
                className={inputCls}
              />
            </Field>
            <Field label="Adresse d'arrivée">
              <PlacesInput
                value={f.arrivee}
                onChange={(v) => set('arrivee', v)}
                onSelect={(v) => set('arrivee', v)}
                placeholder="Ville, code postal ou adresse complète"
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Date">
                <input
                  type="date"
                  className={`${inputCls} disabled:bg-pro-surface disabled:text-pro-muted`}
                  disabled={f.date_a_determiner}
                  value={f.date_souhaitee ?? ''}
                  onChange={(e) => set('date_souhaitee', e.target.value)}
                />
              </Field>
              <Field label="Heure">
                <input
                  type="time"
                  className={`${inputCls} disabled:bg-pro-surface disabled:text-pro-muted`}
                  disabled={f.date_a_determiner}
                  value={f.heure_souhaitee ?? ''}
                  onChange={(e) => set('heure_souhaitee', e.target.value)}
                />
              </Field>
              <Field label="Option de trajet">
                <select className={inputCls} value={f.option_trajet} onChange={(e) => set('option_trajet', e.target.value)}>
                  {optionList.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-pro-text">
              <input
                type="checkbox"
                className="accent-pro-accent"
                checked={f.date_a_determiner}
                onChange={(e) =>
                  setF((p) => ({
                    ...p,
                    date_a_determiner: e.target.checked,
                    ...(e.target.checked ? { date_souhaitee: '', heure_souhaitee: '' } : {}),
                  }))
                }
              />
              Date et heure à déterminer (rendez-vous à convenir avec le client)
            </label>
            <label className="flex items-center gap-2 text-xs text-pro-text">
              <input
                type="checkbox"
                className="accent-pro-accent"
                checked={f.plateau}
                onChange={(e) => set('plateau', e.target.checked)}
              />
              Véhicule non roulant — transport sur plateau porte-voiture
            </label>
            {f.plateau && (
              <div className="space-y-3 rounded-lg border border-pro-border bg-pro-surface/60 p-3">
                <label className="flex items-start gap-2 text-xs text-pro-text">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-pro-accent"
                    checked={f.lourd}
                    onChange={(e) => toggleLourd(e.target.checked)}
                  />
                  <span>
                    {HEAVY_CHECKBOX_LABEL}
                    <span className="block text-[11px] text-pro-muted">
                      Porte-voiture plus puissant : majoration carburant / consommation.
                    </span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Poids du véhicule (kg)">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      placeholder="ex. 1600"
                      value={f.poids_kg}
                      onChange={(e) => set('poids_kg', e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={rechercherPlaque}
                    disabled={plateLoading}
                    icon={plateLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  >
                    Rechercher par plaque
                  </Button>
                </div>
                {f.poids_kg !== '' && Number(f.poids_kg) > HEAVY_THRESHOLD_KG && !f.lourd && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    Ce véhicule dépasse 1,1 t : la majoration de {HEAVY_SURCHARGE} € devrait être cochée.
                  </p>
                )}
              </div>
            )}

            {trajetChanged && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Le trajet a changé : recalculez la distance et le prix avant d'enregistrer.
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 rounded-xl border border-pro-border p-3 sm:grid-cols-2">
            <p className="col-span-full text-[10px] font-medium uppercase tracking-wider text-pro-muted">Véhicule</p>
            <Field label="Marque"><input className={inputCls} value={f.marque} onChange={(e) => set('marque', e.target.value)} /></Field>
            <Field label="Modèle"><input className={inputCls} value={f.modele} onChange={(e) => set('modele', e.target.value)} /></Field>
            <Field label="Type"><input className={inputCls} value={f.type_vehicule} onChange={(e) => set('type_vehicule', e.target.value)} /></Field>
            <Field label="Carburant"><input className={inputCls} value={f.carburant} onChange={(e) => set('carburant', e.target.value)} /></Field>
            <Field label="Immatriculation"><input className={inputCls} value={f.immatriculation} onChange={(e) => set('immatriculation', e.target.value)} /></Field>
          </section>

          <section className="space-y-3 rounded-xl border border-pro-border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-pro-muted">Distance & prix</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={recalculer}
                disabled={recalcul}
                icon={recalcul ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              >
                Recalculer
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Distance (km)"><input className={inputCls} inputMode="decimal" value={f.distance_km} onChange={(e) => set('distance_km', e.target.value)} /></Field>
              <Field label="Montant TTC (€)"><input className={inputCls} inputMode="decimal" value={f.prix_estime} onChange={(e) => set('prix_estime', e.target.value)} /></Field>
              <Field label="Libellé tarifaire"><input className={inputCls} value={f.tarif_label} onChange={(e) => set('tarif_label', e.target.value)} /></Field>
            </div>
            <label className="flex items-center gap-2 text-xs text-pro-text">
              <input type="checkbox" className="accent-pro-accent" checked={f.prix_manuel} onChange={(e) => set('prix_manuel', e.target.checked)} />
              Prix imposé manuellement (aucun recalcul automatique)
            </label>
          </section>

          <Field label="Note interne / message">
            <textarea className={`${inputCls} min-h-20`} value={f.message} onChange={(e) => set('message', e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-pro-border px-4 py-3">
          <p className="text-[11px] text-pro-muted">
            Le numéro {devis.numero} est conservé — le document passera en révision v{Number(devis.version ?? 1) + 1}.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Fermer</Button>
            <Button size="sm" onClick={save} disabled={saving} icon={saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}>
              Enregistrer & régénérer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
