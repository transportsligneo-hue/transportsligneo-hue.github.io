import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  filename: string
  /** Génère le PDF à afficher (appelé à l'ouverture). */
  generate: () => Promise<Blob>
  onClose: () => void
}

/** Aperçu plein écran d'un PDF (devis, facture, EDL) avant envoi ou téléchargement. */
export function PdfPreviewDialog({ open, title, filename, generate, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let revoked: string | null = null
    let cancelled = false
    setError(null)
    setUrl(null)
    generate()
      .then((blob) => {
        if (cancelled) return
        revoked = URL.createObjectURL(blob)
        setUrl(revoked)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Génération impossible')
      })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0b1026]">{title}</p>
            <p className="truncate text-xs text-black/50">Aperçu avant envoi — {filename}</p>
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                download={filename}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2F5FFF] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2450e0]"
              >
                <Download size={14} /> Télécharger
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 p-2 text-black/60 hover:bg-black/5"
              aria-label="Fermer l'aperçu"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#f5f7fc]">
          {error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">{error}</div>
          ) : url ? (
            <iframe src={url} title={title} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-black/50">
              <Loader2 className="animate-spin" size={26} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
