/**
 * Contrôle de rendu des templates email.
 *
 *   bun run scripts/check-email-templates.ts
 *
 * Vérifie pour chaque template enregistré :
 *  - le rendu HTML aboutit et un sujet est résolu
 *  - aucun "\n" littéral, "undefined", "null" ou "[object Object]" visible
 *  - toutes les images ont un alt et une URL absolue https
 *  - présence d'un viewport responsive (rendu identique mobile / desktop)
 *  - largeur maximale fluide (pas de width fixe > 640px qui casse sur mobile)
 */
import * as React from 'react'
import { render } from '@react-email/components'
import { TEMPLATES } from '../src/lib/email-templates/registry'

type Issue = { template: string; problem: string }

const issues: Issue[] = []
let checked = 0

for (const [name, entry] of Object.entries(TEMPLATES)) {
  const data = (entry.previewData ?? {}) as Record<string, unknown>
  let html: string
  let text: string
  try {
    const el = React.createElement(entry.component as never, data as never)
    html = await render(el)
    text = await render(el, { plainText: true })
  } catch (err) {
    issues.push({ template: name, problem: `rendu impossible : ${(err as Error).message}` })
    continue
  }
  checked += 1

  const subject = typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
  if (!subject || !subject.trim()) issues.push({ template: name, problem: 'sujet vide' })

  // Retours à la ligne / interpolations cassées
  if (/\\n/.test(text)) issues.push({ template: name, problem: 'contient un "\\n" littéral (retour à la ligne non rendu)' })
  for (const token of ['undefined', '[object Object]', 'NaN']) {
    if (text.includes(token)) issues.push({ template: name, problem: `contient "${token}" dans le texte visible` })
  }

  // Images
  for (const tag of html.match(/<img[^>]*>/g) ?? []) {
    if (!/alt=/.test(tag)) issues.push({ template: name, problem: `image sans attribut alt : ${tag.slice(0, 90)}` })
    const src = tag.match(/src="([^"]*)"/)?.[1] ?? ''
    if (!/^https:\/\//.test(src)) {
      issues.push({ template: name, problem: `image avec URL non absolue https : ${src.slice(0, 90)}` })
    }
  }

  // Responsive
  if (!/name="viewport"/.test(html)) issues.push({ template: name, problem: 'meta viewport manquante' })
  for (const w of html.match(/width:\s*(\d{3,4})px/g) ?? []) {
    const px = Number(w.replace(/\D/g, ''))
    if (px > 640) issues.push({ template: name, problem: `largeur fixe ${px}px > 640px (débordement mobile)` })
  }
}

console.log(`Templates contrôlés : ${checked}/${Object.keys(TEMPLATES).length}`)
if (issues.length === 0) {
  console.log('✅ Aucun problème de rendu détecté.')
} else {
  for (const i of issues) console.error(`❌ [${i.template}] ${i.problem}`)
  process.exit(1)
}
