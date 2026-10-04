import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Photo { vue_type: string; url: string; zone_id: string | null; notes: string | null }

const VUE_LABEL = (v: string) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Un dégât = photo rattachée à une zone ou annotée. */
const isDamage = (p: Photo) => !!p.zone_id || !!p.notes?.trim();
const damageKey = (p: Photo) => p.zone_id ?? `${p.vue_type}:${(p.notes ?? "").trim().toLowerCase()}`;

/** Compare les photos EDL départ / arrivée et alerte en cas de nouveau dégât. */
export function EdlComparison({ attributionId }: { attributionId: string }) {
  const [depart, setDepart] = useState<Photo[]>([]);
  const [arrivee, setArrivee] = useState<Photo[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: insps } = await supabase
        .from("inspections")
        .select("id, type")
        .eq("attribution_id", attributionId);
      const list = (insps ?? []) as { id: string; type: string }[];
      if (!list.some((i) => i.type === "arrivee")) { setReady(true); return; }
      const { data: raw } = await supabase
        .from("inspection_photos")
        .select("inspection_id, vue_type, url_photo, zone_id, notes, created_at")
        .in("inspection_id", list.map((i) => i.id))
        .order("created_at", { ascending: true });
      const rows = ((raw ?? []) as { inspection_id: string; vue_type: string; url_photo: string; zone_id: string | null; notes: string | null }[])
        .filter((p) => !p.vue_type.startsWith("signature"));
      const toSign = Array.from(new Set(rows.filter((p) => !/^https?:\/\//i.test(p.url_photo)).map((p) => p.url_photo)));
      const signed = new Map<string, string>();
      if (toSign.length) {
        const { data } = await supabase.storage.from("inspection-photos").createSignedUrls(toSign, 3600);
        (data ?? []).forEach((s, i) => { if (s?.signedUrl) signed.set(toSign[i], s.signedUrl); });
      }
      const d: Photo[] = [], a: Photo[] = [];
      for (const p of rows) {
        const url = /^https?:\/\//i.test(p.url_photo) ? p.url_photo : signed.get(p.url_photo) ?? "";
        const target = list.find((i) => i.id === p.inspection_id)?.type === "arrivee" ? a : d;
        target.push({ vue_type: p.vue_type, url, zone_id: p.zone_id, notes: p.notes });
      }
      if (!cancelled) { setDepart(d); setArrivee(a); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  if (!ready || arrivee.length === 0) return null;

  const knownDamages = new Set(depart.filter(isDamage).map(damageKey));
  const newDamages = arrivee.filter((p) => isDamage(p) && !knownDamages.has(damageKey(p)));
  const vues = Array.from(new Set([...depart, ...arrivee].filter((p) => !isDamage(p)).map((p) => p.vue_type)));

  return (
    <div className="mission-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight size={16} className="edl-cmp-icon" />
        <p className="font-heading text-sm mission-text tracking-wider">Comparaison départ / arrivée</p>
      </div>

      {newDamages.length > 0 ? (
        <div className="edl-cmp-alert" role="alert">
          <AlertTriangle size={16} />
          <div>
            <p className="font-semibold">
              {newDamages.length} nouveau{newDamages.length > 1 ? "x" : ""} dégât{newDamages.length > 1 ? "s" : ""} constaté{newDamages.length > 1 ? "s" : ""} à l'arrivée
            </p>
            <ul className="mt-1 text-xs space-y-0.5">
              {newDamages.map((p, i) => (
                <li key={i}>• {VUE_LABEL(p.vue_type)}{p.notes ? ` — ${p.notes}` : ""}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="edl-cmp-ok">
          <CheckCircle2 size={16} /> Aucun nouveau dégât signalé entre le départ et l'arrivée.
        </div>
      )}

      {newDamages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {newDamages.map((p, i) => p.url && (
            <a key={i} href={p.url} target="_blank" rel="noreferrer" className="edl-cmp-thumb edl-cmp-thumb--alert">
              <img src={p.url} alt={`Dégât ${VUE_LABEL(p.vue_type)}`} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {vues.slice(0, 12).map((v) => {
          const d = depart.find((p) => p.vue_type === v && !isDamage(p));
          const a = arrivee.find((p) => p.vue_type === v && !isDamage(p));
          return (
            <div key={v} className="grid grid-cols-[90px_1fr_1fr] items-center gap-2">
              <span className="text-xs mission-text-soft">{VUE_LABEL(v)}</span>
              {[d, a].map((p, i) => (
                <div key={i} className="edl-cmp-thumb">
                  {p?.url ? <img src={p.url} alt={`${VUE_LABEL(v)} ${i ? "arrivée" : "départ"}`} loading="lazy" /> : <span className="text-[11px] mission-text-soft">—</span>}
                </div>
              ))}
            </div>
          );
        })}
        {vues.length > 0 && (
          <div className="grid grid-cols-[90px_1fr_1fr] gap-2 text-[11px] mission-text-soft">
            <span /> <span className="text-center">Départ</span> <span className="text-center">Arrivée</span>
          </div>
        )}
      </div>
    </div>
  );
}
