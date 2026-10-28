/**
 * /signature/$token · parcours de signature électronique (public, lien secret).
 * Lecture du document → code à usage unique (SMS ou e-mail) → consentement →
 * signature au doigt. Possibilité de refuser à chaque étape.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { CheckCircle2, Download, QrCode, FileText, Loader2, Mail, PenLine, ShieldCheck, Smartphone, XCircle, Eraser, ExternalLink } from "lucide-react";
import {
  esignPublicGet, esignPublicSendOtp, esignPublicVerifyOtp, esignPublicSign, esignPublicDecline,
  esignHandoffStart, esignHandoffPoll,
} from "@/lib/esign.functions";

export const Route = createFileRoute("/signature/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signature d'un document · Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: SignaturePage,
});

type Info = {
  id: string; kind: string; title: string; status: string; signerName: string; signerCompany: string | null;
  expiresAt: string; signedAt: string | null; declinedAt: string | null; docHash: string; consentText: string;
  maskedEmail?: string; maskedPhone?: string;
};
type Step = "read" | "code" | "sign" | "done" | "declined";

const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

function SignaturePage() {
  const { token } = Route.useParams();
  const get = useServerFn(esignPublicGet);
  const sendOtp = useServerFn(esignPublicSendOtp);
  const verifyOtp = useServerFn(esignPublicVerifyOtp);
  const sign = useServerFn(esignPublicSign);
  const decline = useServerFn(esignPublicDecline);
  const handoffStart = useServerFn(esignHandoffStart);
  const handoffPoll = useServerFn(esignHandoffPoll);
  const [qr, setQr] = useState<{ img: string; ht: string; exp: number } | null>(null);
  const [fromPhone, setFromPhone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await get({ data: { token } });
      if (!r.found) { setInfo(null); return; }
      setInfo(r.request as Info);
      setDocUrl(r.docUrl);
      setMissing(r.missingDocs ?? []);
      const st = r.request.status;
      if (st === "signed") setStep("done");
      else if (st === "declined") setStep("declined");
    } catch { setInfo(null); } finally { setLoading(false); }
  }, [get, token]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Une erreur est survenue."); }
    finally { setBusy(false); }
  };

  /* ---- canvas ---- */
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = cvs.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cvs.current!.width, y: ((e.clientY - r.top) / r.height) * cvs.current!.height };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!cvs.current) return;
    cvs.current.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = pos(e);
    const ctx = cvs.current.getContext("2d")!; const p = last.current;
    ctx.fillStyle = "#0a1638"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); setHasInk(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !cvs.current || !last.current) return;
    const ctx = cvs.current.getContext("2d")!; const p = pos(e);
    ctx.strokeStyle = "#0a1638"; ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p; setHasInk(true);
  };
  const onUp = () => { drawing.current = false; last.current = null; };
  const openQr = () => run(async () => {
    const r = await handoffStart({ data: { token } });
    const url = `${window.location.origin}/signature-mobile/${r.ht}`;
    setQr({ img: await QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#0a1638", light: "#ffffff" } }), ht: r.ht, exp: Date.now() + r.ttlSeconds * 1000 });
  });
  useEffect(() => {
    if (!qr) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (Date.now() > qr.exp) { setQr(null); return; }
      try {
        const r = await handoffPoll({ data: { token, ht: qr.ht } });
        if (r.ready && !stop) {
          const img = new Image();
          img.onload = () => {
            const c = cvs.current; if (!c) return;
            const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
            const k = Math.min(c.width / img.width, c.height / img.height);
            const w = img.width * k, h = img.height * k;
            ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
            setHasInk(true); setFromPhone(true); setQr(null);
          };
          img.src = r.png; return;
        }
      } catch { /* on réessaie */ }
      setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 2000);
    return () => { stop = true; clearTimeout(t); };
  }, [qr, token, handoffPoll]);
  const clear = () => { const c = cvs.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasInk(false); };

  /* ---- actions ---- */
  const askCode = () => run(async () => {
    const r = await sendOtp({ data: { token, channel: info?.kind === "contrat_convoyeur" && info?.maskedPhone ? "sms" : channel } });
    setSentTo(r.to); setStep("code"); setCode("");
  });
  const checkCode = () => run(async () => {
    await verifyOtp({ data: { token, code } });
    setStep("sign");
  });
  const submit = () => run(async () => {
    if (!cvs.current) return;
    const out = document.createElement("canvas");
    out.width = cvs.current.width; out.height = cvs.current.height;
    out.getContext("2d")!.drawImage(cvs.current, 0, 0);
    await sign({ data: { token, signaturePng: out.toDataURL("image/png"), consent, typedName } });
    await load(); setStep("done");
  });
  const refuse = () => run(async () => { await decline({ data: { token, reason } }); setStep("declined"); setShowDecline(false); });

  /* ---- rendu ---- */
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-b from-[#eef3ff] to-white text-[#0a1638]" style={{ fontFamily: "Poppins, system-ui, sans-serif" }}>
      <header className="bg-gradient-to-r from-[#0a1638] to-[#132a6b] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/logo-ligneo.png" alt="" className="h-8 w-8 rounded-lg bg-white p-1" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          <div className="leading-tight"><div className="font-semibold">Transports Ligneo</div><div className="text-xs text-white/70">Signature électronique sécurisée</div></div>
          <ShieldCheck className="ml-auto text-[#8fb0ff]" size={22} />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">{children}</main>
    </div>
  );
  const smsOnly = info?.kind === "contrat_convoyeur" && !!info?.maskedPhone;
  const card = "rounded-2xl bg-white border border-[#dfe6fb] shadow-[0_6px_24px_-12px_rgba(47,95,255,.25)] p-5";
  const btn = "w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3b6bff] to-[#2450e6] text-white font-semibold py-3.5 px-5 shadow-[0_8px_20px_-8px_rgba(47,95,255,.7)] disabled:opacity-50 disabled:shadow-none active:scale-[.99] transition";
  const btn2 = "inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-[#cfd9f7] text-[#1f3a8a] font-medium py-2.5 px-4";

  if (loading) return shell(<div className="py-24 flex justify-center"><Loader2 className="animate-spin text-[#2f5fff]" /></div>);
  if (!info) return shell(<div className={card + " text-center"}><XCircle className="mx-auto text-red-500" size={36} /><h1 className="mt-3 text-lg font-semibold">Lien invalide ou remplacé</h1><p className="text-sm text-[#5a6788] mt-1">Ce lien n'existe pas ou a été remplacé par une relance plus récente. Contactez Transports Ligneo au 07 82 45 61 81.</p></div>);
  if (["expired", "cancelled"].includes(info.status)) return shell(<div className={card + " text-center"}><XCircle className="mx-auto text-amber-500" size={36} /><h1 className="mt-3 text-lg font-semibold">{info.status === "expired" ? "Lien expiré" : "Demande annulée"}</h1><p className="text-sm text-[#5a6788] mt-1">{info.status === "expired" ? "Le délai pour signer est dépassé." : "Cette demande de signature a été annulée."} Contactez Transports Ligneo pour recevoir un nouveau lien.</p></div>);

  const titleCard = (
    <div className={card}>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-[#eaf0ff] text-[#2f5fff] grid place-items-center"><FileText size={22} /></div>
        <div className="min-w-0">
          <div className="text-xs text-[#6b7aa3]">Document à signer</div>
          <h1 className="font-semibold text-lg leading-snug break-words">{info.title}</h1>
          <div className="text-sm text-[#5a6788] mt-0.5">Signataire : {info.signerName}{info.signerCompany ? ` · ${info.signerCompany}` : ""}</div>
        </div>
      </div>
    </div>
  );

  if (step === "done") return shell(<>
    <div className={card + " text-center"}>
      <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
      <h1 className="mt-3 text-xl font-semibold">Document signé</h1>
      <p className="text-sm text-[#5a6788] mt-1">Merci {info.signerName.split(" ")[0]}, votre signature a été enregistrée{info.signedAt ? ` le ${fmt(info.signedAt)}` : ""}. Une copie vous a été envoyée par e-mail.</p>
      {docUrl && <a className={btn + " mt-5"} href={docUrl} target="_blank" rel="noreferrer"><Download size={18} /> Télécharger mon exemplaire signé</a>}
    </div>
    {titleCard}
  </>);
  if (step === "declined") return shell(<div className={card + " text-center"}><XCircle className="mx-auto text-slate-400" size={40} /><h1 className="mt-3 text-lg font-semibold">Signature refusée</h1><p className="text-sm text-[#5a6788] mt-1">Votre refus a été transmis à Transports Ligneo. Vous pouvez fermer cette page.</p></div>);

  if (missing.length > 0) return shell(<>
    {titleCard}
    <div className={card + " space-y-2"}>
      <div className="font-semibold text-amber-700">Documents à déposer avant de signer</div>
      <p className="text-sm text-[#5a6788]">Pour pouvoir signer votre contrat, déposez d'abord dans votre espace convoyeur (Documents) : <b>{missing.join(", ")}</b>. Revenez ensuite sur ce lien.</p>
      <a className={btn} href="/convoyeur/documents">Aller à mes documents</a>
    </div>
  </>);

  const declineBox = (
    <div className="text-center">
      {!showDecline ? <button className="text-sm text-[#6b7aa3] underline underline-offset-2" onClick={() => setShowDecline(true)}>Je refuse de signer ce document</button> : (
        <div className={card + " text-left space-y-3"}>
          <div className="font-medium">Refuser de signer</div>
          <textarea className="w-full rounded-xl border border-[#cfd9f7] p-3 text-sm" rows={3} placeholder="Motif (facultatif)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2"><button className={btn2} onClick={() => setShowDecline(false)}>Annuler</button><button className={btn2 + " !text-red-600 !border-red-200"} disabled={busy} onClick={refuse}>Confirmer le refus</button></div>
        </div>
      )}
    </div>
  );
  const errBox = err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{err}</div>;
  const stepper = (
    <ol className="flex items-center gap-2 text-xs text-[#6b7aa3]">
      {(["read", "code", "sign"] as Step[]).map((s, i) => (
        <li key={s} className={"flex-1 rounded-full px-3 py-1.5 text-center " + (step === s ? "bg-[#2f5fff] text-white font-medium" : (["read", "code", "sign"].indexOf(step) > i ? "bg-[#dfe9ff] text-[#2f5fff]" : "bg-white border border-[#dfe6fb]"))}>
          {i + 1}. {s === "read" ? "Lire" : s === "code" ? "Vérifier" : "Signer"}
        </li>
      ))}
    </ol>
  );

  return shell(<>
    {stepper}
    {titleCard}
    {step === "read" && <>
      <div className={card + " space-y-3"}>
        <div className="font-medium">1. Lisez le document</div>
        {docUrl ? <>
          <iframe title="Document" src={docUrl} className="hidden sm:block w-full h-[520px] rounded-xl border border-[#dfe6fb]" />
          <a className={btn2 + " w-full"} href={docUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Ouvrir le document en plein écran</a>
        </> : <p className="text-sm text-[#5a6788]">Document indisponible.</p>}
        <p className="text-xs text-[#6b7aa3] break-all">Empreinte numérique (SHA-256) : {info.docHash}</p>
      </div>
      <div className={card + " space-y-3"}>
        <div className="font-medium">Recevoir mon code de vérification</div>
        {smsOnly ? (
          <div className="rounded-xl border border-[#2f5fff] bg-[#eef3ff] p-3">
            <Smartphone size={18} className="text-[#2f5fff]" />
            <div className="text-sm font-medium mt-1">Par SMS</div>
            <div className="text-xs text-[#6b7aa3]">{info.maskedPhone} · par sécurité, le code est envoyé uniquement par SMS.</div>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setChannel("email")} className={"rounded-xl border p-3 text-left " + (channel === "email" ? "border-[#2f5fff] bg-[#eef3ff]" : "border-[#dfe6fb]")}><Mail size={18} className="text-[#2f5fff]" /><div className="text-sm font-medium mt-1">Par e-mail</div><div className="text-xs text-[#6b7aa3] break-all">{info.maskedEmail}</div></button>
          <button disabled={!info.maskedPhone} onClick={() => setChannel("sms")} className={"rounded-xl border p-3 text-left disabled:opacity-40 " + (channel === "sms" ? "border-[#2f5fff] bg-[#eef3ff]" : "border-[#dfe6fb]")}><Smartphone size={18} className="text-[#2f5fff]" /><div className="text-sm font-medium mt-1">Par SMS</div><div className="text-xs text-[#6b7aa3]">{info.maskedPhone ?? "Numéro non renseigné"}</div></button>
        </div>
        )}
        <label className="flex gap-3 items-start text-sm rounded-xl bg-[#f5f8ff] border border-[#dfe6fb] p-3">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#2f5fff]" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
          <span className="text-[#33415f]">J'ai lu l'intégralité du document et je l'approuve.</span>
        </label>
        {errBox}
        <button className={btn} disabled={busy || !approved} onClick={askCode}>{busy ? <Loader2 className="animate-spin" size={18} /> : null} J'ai lu le document · Envoyer le code</button>
      </div>
    </>}
    {step === "code" && (
      <div className={card + " space-y-3"}>
        <div className="font-medium">2. Saisissez votre code</div>
        <p className="text-sm text-[#5a6788]">Code à 6 chiffres envoyé à {sentTo}. Valable 10 minutes.</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-full text-center text-3xl tracking-[.5em] font-semibold rounded-xl border border-[#cfd9f7] py-3 focus:outline-none focus:ring-2 focus:ring-[#2f5fff]" placeholder="••••••" />
        {errBox}
        <button className={btn} disabled={busy || code.length !== 6} onClick={checkCode}>{busy ? <Loader2 className="animate-spin" size={18} /> : null} Valider le code</button>
        <button className="w-full text-sm text-[#2f5fff] underline" disabled={busy} onClick={askCode}>Renvoyer un code</button>
      </div>
    )}
    {step === "sign" && (
      <div className={card + " space-y-4"}>
        <div className="font-medium">3. Signez</div>
        <label className="flex gap-3 items-start text-sm rounded-xl bg-[#f5f8ff] border border-[#dfe6fb] p-3">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#2f5fff]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-[#33415f]">{info.consentText}</span>
        </label>
        <div>
          <div className="text-sm text-[#5a6788] mb-1">Saisissez votre nom complet</div>
          <input value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder={info.signerName} className="w-full rounded-xl border border-[#cfd9f7] px-3 py-3 text-base text-[#0a1638] bg-white focus:outline-none focus:ring-2 focus:ring-[#2f5fff]" />
        </div>
        <div className="rounded-xl border border-[#dfe6fb] bg-[#f5f8ff] p-3">
          {!qr ? (
            <button type="button" className={btn2 + " w-full"} disabled={busy} onClick={openQr}><QrCode size={18} /> Signer avec mon téléphone (QR code)</button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <img src={qr.img} alt="QR code" className="h-40 w-40 rounded-lg bg-white p-1" />
              <div className="text-sm text-[#33415f] space-y-1">
                <div className="font-medium flex items-center gap-2"><Loader2 className="animate-spin text-[#2f5fff]" size={16} /> En attente de votre signature…</div>
                <p>1. Scannez ce QR code avec l'appareil photo de votre téléphone.</p>
                <p>2. Signez avec le doigt, puis touchez « Envoyer ».</p>
                <p>3. Votre signature apparaît ici automatiquement.</p>
                <button type="button" className="text-[#2f5fff] underline" onClick={() => setQr(null)}>Annuler</button>
              </div>
            </div>
          )}
          {fromPhone && !qr && <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> Signature reçue depuis votre téléphone.</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-sm text-[#5a6788]">Ou signez ici avec le doigt / la souris</span>
            <button className="text-sm text-[#2f5fff] inline-flex items-center gap-1" onClick={clear}><Eraser size={14} /> Effacer</button></div>
          <canvas ref={cvs} width={900} height={360} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            className="w-full h-44 sm:h-52 rounded-xl border-2 border-dashed border-[#9db6ff] bg-white touch-none" />
        </div>
        {errBox}
        {(() => {
          const m: string[] = [];
          if (!consent) m.push("cochez la case de consentement");
          if (!hasInk) m.push("signez dans le cadre");
          if (typedName.trim().length < 2) m.push("saisissez votre nom");
          return <p className={"text-xs text-center font-medium " + (m.length ? "text-amber-700" : "text-emerald-700")}>{m.length ? `Pour activer le bouton : ${m.join(", ")}.` : "Tout est prêt : vous pouvez signer."}</p>;
        })()}
        <button className={btn} disabled={busy || !consent || !hasInk || typedName.trim().length < 2} onClick={submit}>
          {busy ? <><Loader2 className="animate-spin" size={18} /> Signature en cours…</> : <><PenLine size={18} /> Signer le document</>}
        </button>
        <p className="text-xs text-[#6b7aa3] text-center">Votre adresse IP et l'heure de signature sont enregistrées à titre de preuve.</p>
      </div>
    )}
    {declineBox}
  </>);
}
