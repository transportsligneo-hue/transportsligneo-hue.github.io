/**
 * Détection automatique des bords d'un document (feuille, carte grise, PV…).
 *
 * Approche 100% locale, sans dépendance :
 *  1. image réduite en niveaux de gris + léger lissage
 *  2. seuil d'Otsu, testé sur les deux polarités (document clair sur fond sombre
 *     ET document sombre sur fond clair)
 *  3. plus grande composante connexe
 *  4. coins extrêmes (x+y / x−y) → quadrilatère, validé par sa "rectangularité"
 *
 * Retourne les 4 coins normalisés (0..1) dans l'ordre TL, TR, BR, BL, ou null.
 */

export interface QuadPt { x: number; y: number }

function toGray(img: ImageData): Uint8ClampedArray {
  const { data, width, height } = img;
  const g = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  }
  // lissage 3x3 (box blur) pour limiter le bruit
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += g[yy * width + xx]; n++;
        }
      }
      out[y * width + x] = sum / n;
    }
  }
  return out;
}

function otsu(gray: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = i; }
  }
  return thr;
}

interface Candidate { quad: QuadPt[]; score: number }

function largestComponentQuad(
  mask: Uint8Array, width: number, height: number,
): Candidate | null {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let best: Candidate | null = null;

  for (let start = 0; start < total; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    labels[start] = start;
    let area = 0;
    let tl = Infinity, br = -Infinity, tr = -Infinity, bl = Infinity;
    let ptl = start, pbr = start, ptr = start, pbl = start;

    while (head < tail) {
      const p = queue[head++];
      area++;
      const x = p % width, y = (p / width) | 0;
      const s = x + y, d = x - y;
      if (s < tl) { tl = s; ptl = p; }
      if (s > br) { br = s; pbr = p; }
      if (d > tr) { tr = d; ptr = p; }
      if (d < bl) { bl = d; pbl = p; }

      if (x > 0 && mask[p - 1] && labels[p - 1] === -1) { labels[p - 1] = start; queue[tail++] = p - 1; }
      if (x < width - 1 && mask[p + 1] && labels[p + 1] === -1) { labels[p + 1] = start; queue[tail++] = p + 1; }
      if (y > 0 && mask[p - width] && labels[p - width] === -1) { labels[p - width] = start; queue[tail++] = p - width; }
      if (y < height - 1 && mask[p + width] && labels[p + width] === -1) { labels[p + width] = start; queue[tail++] = p + width; }
    }

    if (area < total * 0.06 || area > total * 0.985) continue;

    const pt = (p: number): QuadPt => ({ x: p % width, y: (p / width) | 0 });
    const quad = [pt(ptl), pt(ptr), pt(pbr), pt(pbl)];
    // aire du quadrilatère (shoelace)
    let qa = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4];
      qa += a.x * b.y - b.x * a.y;
    }
    qa = Math.abs(qa) / 2;
    if (qa < total * 0.06) continue;
    const rectangularity = area / qa;
    if (rectangularity < 0.72) continue;
    // côtés minimaux (évite les bandes dégénérées)
    const side = (a: QuadPt, b: QuadPt) => Math.hypot(a.x - b.x, a.y - b.y);
    const minSide = Math.min(
      side(quad[0], quad[1]), side(quad[1], quad[2]),
      side(quad[2], quad[3]), side(quad[3], quad[0]),
    );
    if (minSide < Math.min(width, height) * 0.18) continue;

    const score = qa * Math.min(1, rectangularity);
    if (!best || score > best.score) {
      best = {
        score,
        quad: quad.map((p) => ({ x: p.x / (width - 1), y: p.y / (height - 1) })),
      };
    }
  }
  return best;
}

/** Détecte le document dans une ImageData réduite. Coins normalisés 0..1 ou null. */
export function detectQuadFromImageData(img: ImageData): QuadPt[] | null {
  const { width, height } = img;
  if (width < 40 || height < 40) return null;
  const gray = toGray(img);
  const thr = otsu(gray);
  const bright = new Uint8Array(gray.length);
  const dark = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] > thr) bright[i] = 1; else dark[i] = 1;
  }
  const a = largestComponentQuad(bright, width, height);
  const b = largestComponentQuad(dark, width, height);
  const best = !a ? b : !b ? a : (a.score >= b.score ? a : b);
  if (!best) return null;
  // légère marge extérieure pour ne pas rogner le bord du document
  const pad = 0.006;
  const cx = best.quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = best.quad.reduce((s, p) => s + p.y, 0) / 4;
  return best.quad.map((p) => ({
    x: Math.max(0, Math.min(1, p.x + (p.x - cx) * pad * 4)),
    y: Math.max(0, Math.min(1, p.y + (p.y - cy) * pad * 4)),
  }));
}

/** Détecte le document dans un canvas plein format. Coins en pixels source, ou null. */
export function detectQuadFromCanvas(src: HTMLCanvasElement): QuadPt[] | null {
  const maxSide = 260;
  const ratio = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.max(40, Math.round(src.width * ratio));
  const h = Math.max(40, Math.round(src.height * ratio));
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, w, h);
  const quad = detectQuadFromImageData(ctx.getImageData(0, 0, w, h));
  if (!quad) return null;
  return quad.map((p) => ({ x: p.x * src.width, y: p.y * src.height }));
}

/** Refuse un recadrage présélectionné si les bords détectés sont incomplets. */
export function isReliableDocumentQuad(quad: QuadPt[], width: number, height: number): boolean {
  if (quad.length !== 4 || width <= 0 || height <= 0) return false;
  if (quad.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  const xs = quad.map((p) => p.x / width), ys = quad.map((p) => p.y / height);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  if (left < 0.015 || top < 0.015 || right > 0.985 || bottom > 0.985) return false;
  if (right - left < 0.42 || bottom - top < 0.42) return false;
  const cross = (a: QuadPt, b: QuadPt, c: QuadPt) =>
    (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const turns = quad.map((p, i) => cross(p, quad[(i + 1) % 4], quad[(i + 2) % 4]));
  return turns.every((v) => v > 0) || turns.every((v) => v < 0);
}
