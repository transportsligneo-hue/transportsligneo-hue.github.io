import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn } from "lucide-react";

const OUTPUT = 512;
const BOX = 300;

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
  busy?: boolean;
}

/**
 * Recadrage circulaire (zoom + déplacement) d'une photo de profil.
 * Rend un JPEG carré 512×512 centré sur le cadrage choisi.
 */
export function AvatarCropDialog({ open, file, onCancel, onConfirm, busy }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) { setImg(null); return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Échelle de base : la plus petite dimension remplit le cadre.
  const baseScale = img ? BOX / Math.min(img.width, img.height) : 1;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, BOX, BOX);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, BOX, BOX);
    const scale = baseScale * zoom;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, BOX / 2 - w / 2 + offset.x, BOX / 2 - h / 2 + offset.y, w, h);
  }, [img, baseScale, zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const confirm = async () => {
    if (!img) return;
    const out = document.createElement("canvas");
    out.width = OUTPUT;
    out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT / BOX;
    const scale = baseScale * zoom * ratio;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
    ctx.drawImage(img, OUTPUT / 2 - w / 2 + offset.x * ratio, OUTPUT / 2 - h / 2 + offset.y * ratio, w, h);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
    if (blob) await onConfirm(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recadrer la photo de profil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative touch-none select-none rounded-full overflow-hidden ring-2 ring-slate-200"
            style={{ width: BOX, height: BOX, maxWidth: "100%" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={canvasRef} width={BOX} height={BOX} className="cursor-grab active:cursor-grabbing" />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/50" />
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomIn size={16} className="text-slate-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#2F5FFF]"
            />
          </div>
          <p className="text-xs text-slate-500 text-center">
            Faites glisser la photo pour la centrer, puis ajustez le zoom.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Annuler</Button>
          <Button onClick={() => void confirm()} disabled={busy || !img} className="bg-[#2F5FFF] hover:bg-[#2450e0] text-white">
            {busy ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
            Valider la photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
