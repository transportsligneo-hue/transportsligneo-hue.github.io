/**
 * Parcours « paraphes » façon Yousign : le document s'affiche page par page,
 * le signataire appose ses initiales sur chaque page puis passe à la signature.
 * Rendu des pages avec pdf.js (servi depuis /pdfjs, aucune dépendance externe).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eraser, Loader2, PenLine } from "lucide-react";

type Props = {
  docUrl: string | null;
  signerName: string;
  btn: string;
  btn2: string;
  card: string;
  onDone: (initialsPng: string, pages: number) => void;
};

const initialsOf = (name: string) =>
  name.split(/[\s-]+/).filter(Boolean).slice(0, 3).map((w) => w[0]!.toUpperCase()).join("") || "—";

export function PagedInitials({ docUrl, signerName, btn, btn2, card, onDone }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [n, setN] = useState(0);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<"make" | "pages">("make");
  const [page, setPage] = useState(1);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [paraphe, setParaphe] = useState<string>("");
  const [rendering, setRendering] = useState(false);
  const pageCvs = useRef<HTMLCanvasElement | null>(null);

  /* ---- chargement du PDF ---- */
  useEffect(() => {
    if (!docUrl) { setFailed(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const libUrl = "/pdfjs/pdf.min.mjs";
        const lib: any = await import(/* @vite-ignore */ libUrl);
        lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        const buf = await (await fetch(docUrl)).arrayBuffer();
        const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        setPdf(doc); setN(doc.numPages);
      } catch (e) {
        console.error("[paraphes] lecture du PDF impossible", e);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [docUrl]);

  // document d'une seule page : la signature suffit, pas de paraphe
  useEffect(() => { if (pdf && n === 1) onDone("", 1); }, [pdf, n]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- création du paraphe ---- */
  const pCvs = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const generate = useCallback(() => {
    const c = pCvs.current; if (!c) return;
    const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#0a1638"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "italic 600 120px 'Segoe Script','Brush Script MT','Snell Roundhand',cursive,Georgia,serif";
    ctx.fillText(initialsOf(signerName), c.width / 2, c.height / 2 + 6);
  }, [signerName]);
  useEffect(() => { if (phase === "make") generate(); }, [phase, generate]);
  const pos = (e: React.PointerEvent) => {
    const r = pCvs.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * pCvs.current!.width, y: ((e.clientY - r.top) / r.height) * pCvs.current!.height };
  };
  const onDown = (e: React.PointerEvent) => {
    if (!pCvs.current) return;
    pCvs.current.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !pCvs.current || !last.current) return;
    const ctx = pCvs.current.getContext("2d")!; const p = pos(e);
    ctx.strokeStyle = "#0a1638"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p;
  };
  const onUp = () => { drawing.current = false; last.current = null; };
  const redraw = () => { const c = pCvs.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); };
  const validateParaphe = () => {
    const c = pCvs.current; if (!c) return;
    setParaphe(c.toDataURL("image/png")); setPhase("pages"); setPage(1);
  };

  /* ---- rendu de la page courante ---- */
  useEffect(() => {
    if (!pdf || phase !== "pages") return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const p = await pdf.getPage(page);
        const c = pageCvs.current; if (!c || cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const cssW = Math.min(c.parentElement?.clientWidth || 700, 760);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = p.getViewport({ scale: (cssW / base.width) * dpr });
        c.width = vp.width; c.height = vp.height;
        c.style.width = `${cssW}px`; c.style.height = `${(vp.height / vp.width) * cssW}px`;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      } catch (e) { console.error("[paraphes] rendu", e); }
      finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [pdf, page, phase]);

  const finish = (pages: number) => onDone(paraphe, pages);

  /* ---- repli : PDF illisible dans le navigateur ---- */
  if (failed) {
    return (
      <div className={card + " space-y-3"}>
        <div className="font-medium">2. Paraphez le document</div>
        <p className="text-sm text-[#5a6788]">L'affichage page par page n'est pas disponible sur cet appareil. Ouvrez le document, lisez-le, puis créez votre paraphe : il sera apposé automatiquement sur chaque page.</p>
        {docUrl && <a className={btn2 + " w-full"} href={docUrl} target="_blank" rel="noreferrer">Ouvrir le document</a>}
        {phase === "make" ? (
          <ParapheMaker cvsRef={pCvs} onDown={onDown} onMove={onMove} onUp={onUp} redraw={redraw} generate={generate} />
        ) : null}
        <button className={btn} onClick={() => { if (phase === "make") { const c = pCvs.current; if (c) { setParaphe(c.toDataURL("image/png")); onDone(c.toDataURL("image/png"), 0); } } }}>
          <PenLine size={18} /> Parapher toutes les pages et continuer
        </button>
      </div>
    );
  }

  if (!pdf) return <div className={card + " py-16 flex justify-center"}><Loader2 className="animate-spin text-[#2f5fff]" /></div>;

  if (phase === "make") {
    return (
      <div className={card + " space-y-4"}>
        <div className="font-medium">2. Créez votre paraphe</div>
        <p className="text-sm text-[#5a6788]">Votre paraphe (vos initiales) sera apposé sur chacune des {n} pages du document. Vous pouvez garder celui proposé ou le redessiner.</p>
        <ParapheMaker cvsRef={pCvs} onDown={onDown} onMove={onMove} onUp={onUp} redraw={redraw} generate={generate} />
        <button className={btn} onClick={validateParaphe}><ArrowRight size={18} /> Utiliser ce paraphe et commencer</button>
      </div>
    );
  }

  const allDone = done.size >= n;
  const here = done.has(page);
  const validate = () => {
    const nd = new Set(done); nd.add(page); setDone(nd);
    if (page < n) setPage(page + 1);
    else if (nd.size >= n) finish(n);
  };
  return (
    <div className={card + " space-y-3"}>
      <div className="flex items-center justify-between">
        <div className="font-medium">2. Parapher · page {page} sur {n}</div>
        <div className="text-xs text-[#6b7aa3]">{done.size}/{n} paraphées</div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: n }, (_, i) => (
          <button key={i} onClick={() => setPage(i + 1)} aria-label={`Page ${i + 1}`}
            className={"h-1.5 flex-1 rounded-full " + (done.has(i + 1) ? "bg-emerald-500" : i + 1 === page ? "bg-[#2f5fff]" : "bg-[#dfe6fb]")} />
        ))}
      </div>
      <div className="relative mx-auto w-fit max-w-full rounded-xl border border-[#dfe6fb] bg-white overflow-hidden shadow-sm">
        <canvas ref={pageCvs} className="block max-w-full" />
        {rendering && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="animate-spin text-[#2f5fff]" /></div>}
        {here && paraphe && (
          <div className="absolute bottom-2 right-2 rounded-md border border-emerald-300 bg-white/90 px-1.5 py-0.5 flex items-center gap-1">
            <img src={paraphe} alt="Paraphe" className="h-7 w-auto" />
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button className={btn2} disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={16} /> Précédent</button>
        {here ? (
          <button className={btn2 + " flex-1"} onClick={() => (page < n ? setPage(page + 1) : allDone ? finish(n) : undefined)}>
            {page < n ? <>Page suivante <ArrowRight size={16} /></> : "Continuer vers la signature"}
          </button>
        ) : (
          <button className={btn + " !w-auto flex-1"} onClick={validate}>
            <PenLine size={18} /> {page < n ? "Parapher et continuer" : "Parapher la dernière page"}
          </button>
        )}
      </div>
      {!allDone && <p className="text-xs text-center text-amber-700 font-medium">Toutes les pages doivent être paraphées pour passer à la signature.</p>}
    </div>
  );
}

function ParapheMaker(p: {
  cvsRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onDown: (e: React.PointerEvent) => void; onMove: (e: React.PointerEvent) => void; onUp: () => void;
  redraw: () => void; generate: () => void;
}) {
  return (
    <div>
      <canvas ref={p.cvsRef} width={500} height={220} onPointerDown={p.onDown} onPointerMove={p.onMove} onPointerUp={p.onUp} onPointerCancel={p.onUp}
        className="w-full h-32 rounded-xl border-2 border-dashed border-[#9db6ff] bg-white touch-none" />
      <div className="mt-1.5 flex gap-3 text-sm text-[#2f5fff]">
        <button type="button" className="inline-flex items-center gap-1" onClick={p.redraw}><Eraser size={14} /> Effacer et dessiner</button>
        <button type="button" className="underline" onClick={p.generate}>Remettre mes initiales</button>
      </div>
    </div>
  );
}
