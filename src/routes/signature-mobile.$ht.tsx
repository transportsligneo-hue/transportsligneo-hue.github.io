/**
 * /signature-mobile/$ht · page téléphone ouverte depuis le QR code de la page de signature.
 * On dessine la signature ici ; elle apparaît automatiquement sur l'ordinateur,
 * où le signataire valide (consentement + bouton « Signer le document »).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eraser, Loader2, PenLine, ShieldCheck, XCircle } from "lucide-react";
import { esignHandoffResolve, esignHandoffSubmit } from "@/lib/esign.functions";

export const Route = createFileRoute("/signature-mobile/$ht")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signer sur mon téléphone · Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: Page,
});

function Page() {
  const { ht } = Route.useParams();
  const resolve = useServerFn(esignHandoffResolve);
  const submit = useServerFn(esignHandoffSubmit);
  const [info, setInfo] = useState<{ title: string; signerName: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const pcv = useRef<HTMLCanvasElement | null>(null);
  const [hasPInk, setHasPInk] = useState(false);
  const pDrawing = useRef(false);
  const pLast = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    resolve({ data: { ht } }).then(setInfo).catch((e) => setErr(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Lien invalide."));
  }, [ht, resolve]);

  const pos = (e: React.PointerEvent) => {
    const r = cvs.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cvs.current!.width, y: ((e.clientY - r.top) / r.height) * cvs.current!.height };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!cvs.current) return;
    cvs.current.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = pos(e);
    const ctx = cvs.current.getContext("2d")!; const p = last.current;
    ctx.fillStyle = "#0a1638"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill(); setHasInk(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !cvs.current || !last.current) return;
    const ctx = cvs.current.getContext("2d")!; const p = pos(e);
    ctx.strokeStyle = "#0a1638"; ctx.lineWidth = 3.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p;
  };
  const onUp = () => { drawing.current = false; last.current = null; };
  const clear = () => { const c = cvs.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasInk(false); };

  const pPos = (e: React.PointerEvent) => {
    const r = pcv.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * pcv.current!.width, y: ((e.clientY - r.top) / r.height) * pcv.current!.height };
  };
  const pDown = (e: React.PointerEvent) => { if (!pcv.current) return; pcv.current.setPointerCapture(e.pointerId); pDrawing.current = true; pLast.current = pPos(e); setHasPInk(true); };
  const pMove = (e: React.PointerEvent) => {
    if (!pDrawing.current || !pcv.current || !pLast.current) return;
    const ctx = pcv.current.getContext("2d")!; const p = pPos(e);
    ctx.strokeStyle = "#0a1638"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pLast.current.x, pLast.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); pLast.current = p;
  };
  const pUp = () => { pDrawing.current = false; pLast.current = null; };
  const pClear = () => { const c = pcv.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasPInk(false); };

  const send = async () => {
    if (!cvs.current) return;
    setBusy(true); setErr(null);
    try {
      await submit({ data: { ht, signaturePng: cvs.current.toDataURL("image/png"), initialsPng: pcv.current?.toDataURL("image/png") } });
      setDone(true);
    } catch (e) { setErr(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Erreur."); }
    finally { setBusy(false); }
  };

  const card = "rounded-2xl bg-white border border-[#dfe6fb] shadow-[0_6px_24px_-12px_rgba(47,95,255,.25)] p-5";
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef3ff] to-white text-[#0a1638]" style={{ fontFamily: "Poppins, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-[#0a1638] to-[#132a6b] text-white">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <div className="leading-tight"><div className="font-semibold">Transports Ligneo</div><div className="text-xs text-white/70">Paraphe et signature sur téléphone</div></div>
          <ShieldCheck className="ml-auto text-[#8fb0ff]" size={22} />
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {done ? (
          <div className={card + " text-center"}>
            <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
            <h1 className="mt-3 text-lg font-semibold">Paraphe et signature envoyés</h1>
            <p className="text-sm text-[#5a6788] mt-1">Retournez sur votre ordinateur : votre paraphe et votre signature sont apparus. Continuez le parcours (votre signature sera apposée à la toute fin, après le code).</p>
          </div>
        ) : !info ? (
          err ? <div className={card + " text-center"}><XCircle className="mx-auto text-red-500" size={36} /><p className="mt-3 text-sm text-[#5a6788]">{err}</p></div>
          : <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-[#2f5fff]" /></div>
        ) : (
          <div className={card + " space-y-4"}>
            <div>
              <div className="text-xs text-[#6b7aa3]">Document</div>
              <h1 className="font-semibold leading-snug">{info.title}</h1>
              <div className="text-sm text-[#5a6788]">Signataire : {info.signerName}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><span className="text-sm text-[#5a6788]">1. Dessinez vos initiales (paraphe)</span>
                <button className="text-sm text-[#2f5fff] inline-flex items-center gap-1" onClick={pClear}><Eraser size={14} /> Effacer</button></div>
              <canvas ref={pcv} width={500} height={220} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp}
                className="w-full h-32 rounded-xl border-2 border-dashed border-[#9db6ff] bg-white touch-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1"><span className="text-sm text-[#5a6788]">2. Signez avec le doigt dans le cadre</span>
                <button className="text-sm text-[#2f5fff] inline-flex items-center gap-1" onClick={clear}><Eraser size={14} /> Effacer</button></div>
              <canvas ref={cvs} width={900} height={500} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                className="w-full h-60 rounded-xl border-2 border-dashed border-[#9db6ff] bg-white touch-none" />
            </div>
            {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>}
            <button disabled={busy || !hasInk || !hasPInk} onClick={send}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3b6bff] to-[#2450e6] text-white font-semibold py-3.5 px-5 disabled:opacity-50">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <PenLine size={18} />} Envoyer à l'ordinateur
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
