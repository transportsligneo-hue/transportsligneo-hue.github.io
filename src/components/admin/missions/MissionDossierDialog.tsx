import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Download, Mail, FileArchive, X } from "lucide-react";
import { Button } from "@/components/admin/AdminUI";
import { useServerFn } from "@tanstack/react-start";
import { sendMissionDossierEmail } from "@/lib/mission-dossier-email.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Numéro de mission affiché et utilisé pour le nom du fichier. */
  numero: string;
  /** Construit le PDF compilé (couverture + EDL + PV + carte grise). */
  buildPdf: () => Promise<Blob>;
  /** Adresses proposées en un clic. */
  suggestions?: { label: string; email: string }[];
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const res = String(r.result ?? "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    r.onerror = () => reject(new Error("Lecture du PDF impossible"));
    r.readAsDataURL(blob);
  });

export function MissionDossierDialog({ open, onClose, numero, buildPdf, suggestions = [] }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(`Dossier complet — mission ${numero}`);
  const [message, setMessage] = useState(
    `Bonjour,\n\nVeuillez trouver ci-joint le dossier complet de la mission ${numero} : état des lieux départ et arrivée, PV de livraison signé et documents du véhicule.\n\nBien cordialement,\nTransports Ligneo`,
  );
  const sendFn = useServerFn(sendMissionDossierEmail);

  useEffect(() => {
    if (!open) return;
    setSubject(`Dossier complet — mission ${numero}`);
    let cancelled = false;
    setBuilding(true);
    setBlob(null);
    buildPdf()
      .then((b) => {
        if (!cancelled) setBlob(b);
      })
      .catch((e) => {
        if (!cancelled) toast.error("Génération impossible", { description: (e as Error).message });
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, numero]);

  if (!open) return null;

  const filename = `Dossier-${numero.replace(/[^\w.-]/g, "_")}.pdf`;

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const send = async () => {
    if (!blob) return;
    if (!to.includes("@")) {
      toast.error("Adresse email invalide");
      return;
    }
    setSending(true);
    try {
      const pdfBase64 = await blobToBase64(blob);
      await sendFn({ data: { to: to.trim(), subject, message, filename, pdfBase64 } });
      toast.success("Dossier envoyé", { description: to.trim() });
      onClose();
    } catch (e) {
      toast.error("Envoi impossible", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const sizeMb = blob ? (blob.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="mt-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1330] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileArchive size={18} className="text-[#2F5FFF]" />
            <div>
              <h3 className="text-sm font-semibold">Dossier complet — {numero}</h3>
              <p className="text-xs text-white/50">
                Couverture, état des lieux, PV de livraison signé et carte grise si disponible.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          {building ? (
            <span className="flex items-center gap-2 text-white/70">
              <Loader2 size={14} className="animate-spin" /> Compilation du dossier en cours…
            </span>
          ) : blob ? (
            <span className="text-emerald-400">Dossier prêt ({sizeMb} Mo)</span>
          ) : (
            <span className="text-red-400">Dossier indisponible.</span>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/50">Destinataire</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="adresse@email.fr"
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#2F5FFF]"
            />
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    onClick={() => setTo(s.email)}
                    className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70 hover:border-[#2F5FFF] hover:text-white"
                  >
                    {s.label} · {s.email}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/50">Objet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#2F5FFF]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-white/50">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#2F5FFF]"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Download size={14} />} onClick={download} disabled={!blob || building}>
            Télécharger
          </Button>
          <Button
            icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            onClick={send}
            disabled={!blob || building || sending}
          >
            Envoyer par email
          </Button>
        </div>
      </div>
    </div>
  );
}
