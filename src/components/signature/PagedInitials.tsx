/**
 * Parcours « paraphes » façon Yousign : le document s'affiche page par page,
 * le signataire appose son paraphe (créé à l'étape précédente) sur chaque page.
 * Rendu des pages avec pdf.js (servi depuis /pdfjs, aucune dépendance externe).
 */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, PenLine } from "lucide-react";

type Props = {
  docUrl: string | null;
  initialsPng: string;
  btn: string;
  btn2: string;
  card: string;
  onDone: () => void;
  onBack: () => void;
};

export function PagedInitials({ docUrl, initialsPng, btn, btn2, card, onDone, onBack }: Props) {
  const [pdf, setPdf] = useState<any>(null);
  const [n, setN] = useState(0);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [rendering, setRendering] = useState(false);
  const pageCvs = useRef<HTMLCanvasElement | null>(null);

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

  // document d'une seule page : la signature suffit, pas de paraphe page par page
  useEffect(() => { if (pdf && n === 1) onDone(); }, [pdf, n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const p = await pdf.getPage(page);
        const c = pageCvs.current; if (!c || cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const cssW = Math.min(c.parentElement?.parentElement?.clientWidth || 700, 760);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = p.getViewport({ scale: (cssW / base.width) * dpr });
        c.width = vp.width; c.height = vp.height;
        c.style.width = `${cssW}px`; c.style.height = `${(vp.height / vp.width) * cssW}px`;
        await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      } catch (e) { console.error("[paraphes] rendu", e); }
      finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [pdf, page]);

  if (failed) {
    return (
      <div className={card + " space-y-3"}>
        <div className="font-medium">3. Parapher le document</div>
        <p className="text-sm text-[#5a6788]">L'affichage page par page n'est pas disponible sur cet appareil. Ouvrez le document, lisez-le : votre paraphe sera apposé automatiquement sur chaque page.</p>
        {docUrl && <a className={btn2 + " w-full"} href={docUrl} target="_blank" rel="noreferrer">Ouvrir le document</a>}
        <button className={btn} onClick={onDone}><PenLine size={18} /> Parapher toutes les pages et continuer</button>
        <button className="w-full text-sm text-[#6b7aa3] underline" onClick={onBack}>Modifier mon paraphe</button>
      </div>
    );
  }
  if (!pdf) return <div className={card + " py-16 flex justify-center"}><Loader2 className="animate-spin text-[#2f5fff]" /></div>;

  const allDone = done.size >= n;
  const here = done.has(page);
  const validate = () => {
    const nd = new Set(done); nd.add(page); setDone(nd);
    if (page < n) setPage(page + 1);
    else if (nd.size >= n) onDone();
  };
  return (
    <div className={card + " space-y-3"}>
      <div className="flex items-center justify-between">
        <div className="font-medium">3. Parapher · page {page} sur {n}</div>
        <div className="text-xs text-[#6b7aa3]">{done.size}/{n} paraphées</div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: n }, (_, i) => (
          <button key={i} onClick={() => setPage(i + 1)} aria-label={`Page ${i + 1}`}
            className={"h-1.5 flex-1 rounded-full " + (done.has(i + 1) ? "bg-emerald-500" : i + 1 === page ? "bg-[#2f5fff]" : "bg-[#dfe6fb]")} />
        ))}
      </div>
      <div className="flex justify-center">
        <div className="relative w-fit max-w-full rounded-xl border border-[#dfe6fb] bg-white overflow-hidden shadow-sm">
          <canvas ref={pageCvs} className="block max-w-full" />
          {rendering && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="animate-spin text-[#2f5fff]" /></div>}
          {here && initialsPng && (
            <img src={initialsPng} alt="Paraphe" className="absolute right-[8%] bottom-[5.5%] h-[5%] min-h-8 w-auto pointer-events-none" />
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button className={btn2} disabled={page <= 1} onClick={() => setPage(page - 1)}><ArrowLeft size={16} /> Précédent</button>
        {here ? (
          <button className={btn2 + " flex-1"} onClick={() => (page < n ? setPage(page + 1) : allDone ? onDone() : undefined)}>
            {page < n ? <>Page suivante <ArrowRight size={16} /></> : "Continuer"}
          </button>
        ) : (
          <button className={btn + " !w-auto flex-1"} onClick={validate}>
            <PenLine size={18} /> {page < n ? "Parapher et continuer" : "Parapher la dernière page"}
          </button>
        )}
      </div>
      {!allDone && <p className="text-xs text-center text-amber-700 font-medium">Toutes les pages doivent être paraphées.</p>}
      <button className="w-full text-xs text-[#6b7aa3] underline" onClick={onBack}>Modifier mon paraphe ou ma signature</button>
    </div>
  );
}
