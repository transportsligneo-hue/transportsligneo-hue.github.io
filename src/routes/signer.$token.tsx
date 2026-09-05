/**
 * /signer/$token · page mobile de signature d'un document.
 *
 * Ouverte depuis le QR code affiché sur l'ordinateur. Le lien est secret,
 * valable 15 minutes et à usage unique : on affiche uniquement le document et
 * l'emplacement concernés, puis on renvoie la signature au poste de travail.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";

export const Route = createFileRoute("/signer/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signature du document · Transports Ligneo" },
      { name: "description", content: "Signez le document de mission depuis votre téléphone." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: SignerPage,
});

interface Info {
  doc_label: string | null;
  slot: string;
  signer_name: string | null;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Lecture impossible"));
    r.readAsDataURL(file);
  });
}

function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

function SignerPage() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public/sign/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resolve", token }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? "Lien invalide");
          return;
        }
        setInfo({ doc_label: json.doc_label, slot: json.slot, signer_name: json.signer_name });
        if (json.signer_name) setName(String(json.signer_name));
      } catch {
        setError("Connexion impossible");
      }
    })();
  }, [token]);

  const submit = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        const dataUrl = await fileToDataUrl(file);
        const pos = await getPosition();
        const res = await fetch("/api/public/sign/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            token,
            signature_data: dataUrl,
            signer_name: name.trim() || null,
            latitude: pos?.latitude ?? null,
            longitude: pos?.longitude ?? null,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.error ?? "Enregistrement impossible");
          return;
        }
        setDone(true);
      } catch {
        setError("Connexion impossible");
      } finally {
        setBusy(false);
      }
    },
    [name, token],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1026] to-[#111a3d] p-5 text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pt-8">
        <div className="flex items-center gap-2 text-[#e7c76a]">
          <ShieldCheck size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>

        {done ? (
          <div className="rounded-2xl border border-[#d4af37]/30 bg-white/5 p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-400" size={38} />
            <p className="mt-3 text-lg font-semibold">Signature envoyée</p>
            <p className="mt-1 text-sm text-white/60">
              Elle apparaît maintenant sur le document ouvert sur l'ordinateur. Vous pouvez fermer cette page.
            </p>
          </div>
        ) : error && !info ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center text-sm text-red-100">
            {error}
          </div>
        ) : !info ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#e7c76a]" size={26} />
          </div>
        ) : (
          <div className="rounded-2xl border border-[#d4af37]/30 bg-white/5 p-5">
            <h1 className="text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {info.doc_label ?? "Document de mission"}
            </h1>
            <p className="mt-1 text-sm text-white/60">Emplacement à signer : {info.slot}</p>

            <label className="mt-4 block text-xs uppercase tracking-widest text-white/50" htmlFor="signer-name">
              Nom du signataire
            </label>
            <input
              id="signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#d4af37]"
            />

            <div className="admin-drawer-body mt-4 h-48 rounded-xl bg-white">
              <SignatureCanvas onValidate={(file) => void submit(file)} disabled={busy} />
            </div>

            <p className="mt-3 flex items-center gap-2 text-xs text-white/50">
              <PenLine size={14} /> Signez avec le doigt puis validez. La position est enregistrée comme preuve.
            </p>
            {busy && (
              <p className="mt-2 flex items-center gap-2 text-xs text-[#e7c76a]">
                <Loader2 className="animate-spin" size={14} /> Envoi en cours…
              </p>
            )}
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
