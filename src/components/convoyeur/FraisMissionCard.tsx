/**
 * FraisMissionCard · frais de la mission (péage / carburant) dans le cockpit convoyeur.
 * Le ticket se prend UNIQUEMENT avec l'appareil photo (pas de galerie).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Fuel, Loader2, Receipt, Trash2, X, Check, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FRAIS_LABEL, FRAIS_STATUT_LABEL, eur, tvaFromTtc, prepareTicket, createFrais,
  type FraisMission, type FraisType, type PreparedTicket,
} from "@/lib/frais-mission";

interface Props {
  attributionId: string;
  userId: string;
}

const parseNum = (s: string) => {
  const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function FraisMissionCard({ attributionId, userId }: Props) {
  const [ctx, setCtx] = useState<{ trajetId: string; convoyeurId: string } | null>(null);
  const [rows, setRows] = useState<FraisMission[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from("attributions").select("trajet_id, convoyeur_id").eq("id", attributionId).maybeSingle();
    if (!a) return;
    setCtx({ trajetId: a.trajet_id as string, convoyeurId: a.convoyeur_id as string });
    const { data } = await supabase
      .from("frais_mission" as never).select("*")
      .eq("trajet_id" as never, a.trajet_id as never)
      .eq("convoyeur_id" as never, a.convoyeur_id as never)
      .order("created_at" as never, { ascending: false });
    setRows((data as unknown as FraisMission[]) ?? []);
  }, [attributionId]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("frais_mission" as never).delete().eq("id" as never, id as never);
    if (error) toast.error("Suppression impossible");
    else void load();
  };

  const total = rows.filter((r) => r.statut !== "refuse").reduce((s, r) => s + Number(r.montant_ttc), 0);

  return (
    <div className="fr-card">
      <style>{`
        .fr-card{background:rgba(255,255,255,.03);border:1px solid rgba(120,180,255,.10);border-radius:16px;padding:14px;color:#e8efff}
        .fr-head{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px}
        .fr-head small{margin-left:auto;font-weight:600;color:#7fb2ff}
        .fr-hint{font-size:12px;color:rgba(232,239,255,.6);margin:6px 0 10px}
        .fr-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(120,180,255,.08);font-size:13px}
        .fr-row b{font-weight:700}
        .fr-st{margin-left:auto;font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px}
        .fr-st.attente{background:rgba(120,180,255,.14);color:#9cc4ff}
        .fr-st.valide{background:rgba(60,220,140,.16);color:#58e3a0}
        .fr-st.refuse{background:rgba(255,80,90,.16);color:#ff8088}
        .fr-motif{font-size:11px;color:#ff8088;margin-top:2px}
        .fr-add{width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;border:0;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(135deg,#2F5FFF,#00A3FF)}
        .fr-x{background:none;border:0;color:rgba(232,239,255,.5);padding:4px}
      `}</style>
      <div className="fr-head">
        <Receipt size={16} /> Frais de la mission
        {total > 0 && <small>{eur(total)}</small>}
      </div>
      <div className="fr-hint">Péage ou carburant avancé ? Photographiez le ticket, il est remboursé après validation.</div>

      {rows.map((r) => (
        <div key={r.id} className="fr-row">
          {r.type === "peage" ? <Receipt size={15} /> : <Fuel size={15} />}
          <div>
            <b>{FRAIS_LABEL[r.type]}</b> · {eur(r.montant_ttc)}
            {r.statut === "refuse" && r.motif_refus && <div className="fr-motif">{r.motif_refus}</div>}
          </div>
          <span className={`fr-st ${r.statut}`}>{FRAIS_STATUT_LABEL[r.statut]}</span>
          {r.statut === "attente" && (
            <button className="fr-x" aria-label="Supprimer" onClick={() => remove(r.id)}><Trash2 size={14} /></button>
          )}
        </div>
      ))}

      <button className="fr-add" onClick={() => setOpen(true)} disabled={!ctx}>
        <Camera size={16} /> Ajouter un frais
      </button>

      {open && ctx && (
        <FraisSheet
          ctx={ctx}
          attributionId={attributionId}
          userId={userId}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); void load(); }}
        />
      )}
    </div>
  );
}

function FraisSheet({
  ctx, attributionId, userId, onClose, onSaved,
}: {
  ctx: { trajetId: string; convoyeurId: string };
  attributionId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<FraisType>("peage");
  const [ttc, setTtc] = useState("");
  const [tva, setTva] = useState("");
  const [tvaTouched, setTvaTouched] = useState(false);
  const [ticket, setTicket] = useState<PreparedTicket | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onTtc = (v: string) => {
    setTtc(v);
    if (!tvaTouched) {
      const n = parseNum(v);
      setTva(n > 0 ? tvaFromTtc(n).toFixed(2).replace(".", ",") : "");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const t = await prepareTicket(f);
      setTicket(t);
      setPreview(URL.createObjectURL(t.file));
      if (!t.lat) toast.message("Position GPS non disponible : le frais sera marqué à vérifier.");
    } catch (ex) {
      setTicket(null);
      setPreview(null);
      setErr(ex instanceof Error ? ex.message : "Photo impossible");
    } finally {
      setBusy(false);
    }
  };

  const montant = parseNum(ttc);
  const canSend = !!ticket && montant > 0 && !busy;

  const send = async () => {
    if (!ticket) return;
    setBusy(true);
    try {
      let tvaN = parseNum(tva);
      if (tvaN > montant) tvaN = montant;
      await createFrais({
        trajetId: ctx.trajetId, attributionId, convoyeurId: ctx.convoyeurId, userId,
        type, ttc: montant, tva: tvaN, ticket,
      });
      toast.success("Frais envoyé, il sera vérifié.");
      onSaved();
    } catch (ex) {
      toast.error(ex instanceof Error ? ex.message : "Envoi impossible");
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(3,8,24,.72)", display: "flex", alignItems: "flex-end" }}
    >
      <div style={{
        width: "100%", maxHeight: "92vh", overflow: "auto", background: "#0b1230", color: "#e8efff",
        borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, border: "1px solid rgba(120,180,255,.14)",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <b style={{ fontSize: 16 }}>Nouveau frais</b>
          <button onClick={onClose} aria-label="Fermer" style={{ marginLeft: "auto", background: "none", border: 0, color: "inherit" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(["peage", "carburant"] as FraisType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: 11, borderRadius: 12, fontWeight: 700, color: "#fff",
                border: type === t ? "1px solid #2F8CFF" : "1px solid rgba(120,180,255,.18)",
                background: type === t ? "rgba(47,95,255,.28)" : "rgba(255,255,255,.03)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {t === "peage" ? <Receipt size={15} /> : <Fuel size={15} />} {FRAIS_LABEL[t]}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 12, opacity: 0.7 }}>Total TTC du ticket (€)</label>
        <input
          inputMode="decimal" value={ttc} onChange={(e) => onTtc(e.target.value)} placeholder="0,00"
          style={inp}
        />
        <label style={{ fontSize: 12, opacity: 0.7 }}>dont TVA (€) — indiquée sur le ticket</label>
        <input
          inputMode="decimal" value={tva} placeholder="0,00"
          onChange={(e) => { setTvaTouched(true); setTva(e.target.value); }}
          style={inp}
        />

        {preview && (
          <img src={preview} alt="Ticket" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, margin: "6px 0 10px", background: "#000" }} />
        )}
        {err && (
          <div style={{ display: "flex", gap: 8, color: "#ff8088", fontSize: 13, margin: "6px 0 10px" }}>
            <AlertTriangle size={16} /> {err}
          </div>
        )}

        {/* capture="environment" : ouvre directement l'appareil photo, sans galerie */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...btn, background: "rgba(255,255,255,.07)" }}>
          {busy && !ticket ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {ticket ? "Reprendre la photo" : "Photographier le ticket"}
        </button>

        <button onClick={send} disabled={!canSend} style={{ ...btn, marginTop: 10, background: "linear-gradient(135deg,#2F5FFF,#00A3FF)", opacity: canSend ? 1 : 0.45 }}>
          {busy && ticket ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Envoyer
        </button>
        <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, opacity: 0.6, marginTop: 10 }}>
          <Clock size={12} /> La date, l'heure et la position sont enregistrées avec la photo.
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: 12, borderRadius: 12, margin: "4px 0 12px", fontSize: 16,
  background: "rgba(255,255,255,.05)", border: "1px solid rgba(120,180,255,.18)", color: "#fff",
};
const btn: React.CSSProperties = {
  width: "100%", padding: 13, borderRadius: 12, border: 0, color: "#fff", fontWeight: 700, fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
