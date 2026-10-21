/**
 * /verifier-signature · vérifie qu'un PDF est bien un document signé chez Ligneo
 * et qu'il n'a pas été modifié. Le fichier n'est jamais envoyé : seule son empreinte
 * SHA-256 (calculée dans le navigateur) est transmise.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileSearch, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { esignVerifyHash } from "@/lib/esign.functions";

export const Route = createFileRoute("/verifier-signature")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vérifier un document signé · Transports Ligneo" },
      { name: "description", content: "Vérifiez l'authenticité et l'intégrité d'un document signé électroniquement avec Transports Ligneo." },
    ],
  }),
  component: VerifierPage,
});

type Res = Awaited<ReturnType<typeof esignVerifyHash>>;

function VerifierPage() {
  const verify = useServerFn(esignVerifyHash);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setBusy(true); setErr(null); setRes(null); setName(f.name);
    try {
      const buf = await f.arrayBuffer();
      const d = await crypto.subtle.digest("SHA-256", buf);
      const hash = Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
      setRes(await verify({ data: { hash } }));
    } catch { setErr("Vérification impossible. Réessayez."); } finally { setBusy(false); }
  };
  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef3ff] to-white text-[#0a1638] px-4 py-10" style={{ fontFamily: "Poppins, system-ui, sans-serif" }}>
      <div className="max-w-xl mx-auto space-y-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#eaf0ff] text-[#2f5fff] grid place-items-center"><FileSearch size={24} /></div>
          <h1 className="text-2xl font-semibold mt-3">Vérifier un document signé</h1>
          <p className="text-sm text-[#5a6788] mt-1">Déposez le PDF reçu : nous contrôlons qu'il est identique à l'original signé. Le fichier reste sur votre appareil.</p>
        </div>
        <label className="block rounded-2xl border-2 border-dashed border-[#9db6ff] bg-white p-8 text-center cursor-pointer hover:bg-[#f5f8ff]">
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          {busy ? <Loader2 className="mx-auto animate-spin text-[#2f5fff]" /> : <span className="text-[#2f5fff] font-medium">{name || "Choisir un fichier PDF"}</span>}
        </label>
        {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
        {res?.match === "none" && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex gap-3"><ShieldAlert className="text-red-500 shrink-0" />
            <div><div className="font-semibold text-red-700">Document non reconnu</div><p className="text-sm text-red-700/80 mt-1">Ce fichier ne correspond à aucun document signé chez Transports Ligneo. Il a peut-être été modifié, ou il ne provient pas de nous.</p></div></div>
        )}
        {res && res.match !== "none" && (
          <div className={"rounded-2xl border p-5 space-y-3 " + (res.match === "signed" && res.chainOk && res.sealOk ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
            <div className="flex gap-3">
              {res.match === "signed" && res.chainOk && res.sealOk ? <ShieldCheck className="text-emerald-600 shrink-0" size={28} /> : <ShieldAlert className="text-amber-600 shrink-0" size={28} />}
              <div>
                <div className="font-semibold">{res.match === "signed" ? (res.chainOk && res.sealOk ? "Document authentique et non modifié" : "Document reconnu, vérification incomplète") : "Version d'origine, non signée"}</div>
                <div className="text-sm text-[#33415f]">{res.title}</div>
              </div>
            </div>
            <ul className="text-sm space-y-1.5 text-[#33415f]">
              <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-600 mt-0.5" /> Signataire : {res.signerName}</li>
              {res.signedAt && <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-600 mt-0.5" /> Signé le {fmt(res.signedAt)}</li>}
              <li className="flex gap-2"><CheckCircle2 size={16} className={res.chainOk ? "text-emerald-600 mt-0.5" : "text-amber-600 mt-0.5"} /> Journal de preuve {res.chainOk ? "intact" : "à contrôler"}</li>
              {res.match === "signed" && <li className="flex gap-2"><CheckCircle2 size={16} className={res.sealOk ? "text-emerald-600 mt-0.5" : "text-amber-600 mt-0.5"} /> Sceau Ligneo {res.sealOk ? "valide" : "non confirmé"}</li>}
              <li className="text-xs text-[#6b7aa3] break-all">Référence : {res.reference}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
