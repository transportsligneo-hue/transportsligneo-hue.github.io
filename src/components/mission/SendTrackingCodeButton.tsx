import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, X, Radar } from "lucide-react";
import { toast } from "sonner";
import { getTrackingShareInfo, sendTrackingCode } from "@/lib/tracking-share.functions";

type Info = Awaited<ReturnType<typeof getTrackingShareInfo>>;

export function SendTrackingCodeButton({
  missionId,
  trajetId,
  label = "Envoyer le lien de suivi au destinataire",
  className,
}: {
  missionId?: string;
  trajetId?: string;
  label?: string;
  className?: string;
}) {
  const fetchInfo = useServerFn(getTrackingShareInfo);
  const send = useServerFn(sendTrackingCode);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const i = await fetchInfo({ data: { missionId, trajetId } });
      setInfo(i);
      setEmail(i.email);
    } catch (e) {
      toast.error((e as Error).message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!info || sending) return;
    setSending(true);
    try {
      await send({ data: { missionId: info.missionId, email } });
      toast.success("Lien de suivi envoyé", { description: `Email envoyé à ${email}` });
      setInfo(await fetchInfo({ data: { missionId: info.missionId } }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const last = info?.history.find((h) => h.status === "sent");

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={className ?? "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2f5fff] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#1c3fc4] transition-colors"}
      >
        <Radar size={14} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="tc-title">
          <div className="w-full max-w-md rounded-2xl border border-[#2f5fff]/50 bg-[#0b1026] p-6 text-[#e8edfb] shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 id="tc-title" className="text-lg font-bold">Suivi GPS du destinataire</h2>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-[#9aa6c9] hover:text-white"><X size={18} /></button>
            </div>
            {loading || !info ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#9aa6c9]">Mission</p>
                    <p className="font-mono text-sm font-bold mt-1 break-all">{info.numero}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#9aa6c9]">Code confidentiel</p>
                    <p className="font-mono text-sm font-bold mt-1 tracking-[0.2em] text-[#7fb0ff]">{info.code}</p>
                  </div>
                </div>
                {info.closed ? (
                  <p className="text-sm text-[#9aa6c9]">Mission terminée ou annulée : le suivi GPS n'est plus disponible.</p>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs text-[#9aa6c9]">Email du destinataire</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="destinataire@exemple.fr"
                        maxLength={255}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-[#6b7699] focus:border-[#2f5fff] focus:outline-none"
                      />
                    </label>
                    <p className="text-xs text-[#9aa6c9]">
                      Le destinataire recevra le numéro de mission, le code et un bouton « Suivre mon véhicule ». Il ne verra que la position du véhicule.
                    </p>
                  </>
                )}
                {last && (
                  <p className="text-xs text-[#9aa6c9]">
                    Dernier envoi : {new Date(last.created_at).toLocaleString("fr-FR")} à {last.recipient_email} ({last.actor_role === "admin" ? "administrateur" : "client"})
                  </p>
                )}
                {!info.closed && (
                  <button
                    onClick={submit}
                    disabled={sending || !email.includes("@")}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2f5fff] py-2.5 text-sm font-bold text-white hover:bg-[#1c3fc4] disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {last ? "Renvoyer l'email" : "Confirmer l'envoi"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
