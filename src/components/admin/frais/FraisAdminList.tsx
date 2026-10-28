/**
 * FraisAdminList · liste des frais de mission avec contrôles anti-fraude.
 * Utilisé (1) dans la page /admin/frais (tous les frais) et (2) dans la fiche
 * d'une mission (prop trajetId).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle, Camera, Check, Download, Fuel, Loader2, MapPin, Plus, Receipt, RotateCcw, ScanSearch,
  ShieldCheck, X, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FRAIS_LABEL, FRAIS_STATUT_LABEL, eur, fraisAlertes, signedTicketUrl, tvaFromTtc,
  type FraisMission, type FraisStatut, type FraisType,
} from "@/lib/frais-mission";
import { analyserTicketIA, notifyFraisDecision } from "@/lib/frais-mission.functions";

interface Row extends FraisMission {
  convoyeurs: { prenom: string | null; nom: string | null } | null;
  trajets: { depart: string | null; arrivee: string | null } | null;
}

interface Props {
  /** Limite à une mission. */
  trajetId?: string;
  /** Pour pouvoir ajouter un frais à la place du convoyeur (fiche mission). */
  convoyeurId?: string | null;
  onChanged?: () => void;
}

const num = (s: string) => {
  const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function FraisAdminList({ trajetId, convoyeurId, onChanged }: Props) {
  const analyse = useServerFn(analyserTicketIA);
  const notif = useServerFn(notifyFraisDecision);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"all" | FraisStatut | "suspect">(trajetId ? "all" : "attente");
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ url: string; row: Row } | null>(null);
  const [refus, setRefus] = useState<Row | null>(null);
  const [motif, setMotif] = useState("");
  const [add, setAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("frais_mission" as never)
      .select("*, convoyeurs(prenom, nom), trajets(depart, arrivee)")
      .order("created_at" as never, { ascending: false })
      .limit(500);
    if (trajetId) q = q.eq("trajet_id" as never, trajetId as never);
    const { data, error } = await q;
    if (error) toast.error("Frais indisponibles", { description: error.message });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [trajetId]);
  useEffect(() => { void load(); }, [load]);

  const done = () => { void load(); onChanged?.(); };
  const nbSuspects = rows.filter((r) => fraisAlertes(r).length > 0 && r.statut === "attente").length;
  const visible = useMemo(
    () => rows.filter((r) =>
      filtre === "all" ? true : filtre === "suspect" ? fraisAlertes(r).length > 0 : r.statut === filtre),
    [rows, filtre],
  );
  const totalValide = rows.filter((r) => r.statut === "valide").reduce((s, r) => s + Number(r.montant_ttc), 0);
  const totalTva = rows.filter((r) => r.statut === "valide").reduce((s, r) => s + Number(r.montant_tva), 0);

  const rpc = async (name: string, args: Record<string, unknown>, id: string, notify: boolean, okMsg: string) => {
    setBusy(id);
    const { error } = await (supabase as any).rpc(name, args);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(okMsg);
    if (notify) void notif({ data: { fraisId: id } }).catch(() => {});
    done();
  };

  const valider = (r: Row) => rpc("valider_frais_mission", { _id: r.id, _refacturer: r.refacturer_client }, r.id, true, "Frais validé, ajouté à la rémunération");
  const rouvrir = (r: Row) => rpc("rouvrir_frais_mission", { _id: r.id }, r.id, false, "Remis à valider");
  const refuser = async () => {
    if (!refus) return;
    if (!motif.trim()) return toast.error("Indiquez un motif");
    await rpc("refuser_frais_mission", { _id: refus.id, _motif: motif.trim() }, refus.id, true, "Frais refusé");
    setRefus(null); setMotif("");
  };

  const toggleRefac = async (r: Row) => {
    const { error } = await (supabase as any).from("frais_mission").update({ refacturer_client: !r.refacturer_client }).eq("id", r.id);
    if (error) toast.error(error.message); else done();
  };

  const lancerIA = async (r: Row) => {
    setBusy(r.id);
    try {
      const res: any = await analyse({ data: { fraisId: r.id } });
      if (res.ok) toast.success(`Analyse IA : ${Math.round(res.score * 100)} % de probabilité`);
      else if (res.raison === "non_configure") toast.message("Détecteur d'IA pas encore branché (clés Sightengine manquantes).");
      else toast.error("Analyse impossible");
    } catch { toast.error("Analyse impossible"); }
    setBusy(null);
    done();
  };

  const voir = async (r: Row) => {
    const url = await signedTicketUrl(r.photo_path);
    if (!url) return toast.error("Photo introuvable");
    setZoom({ url, row: r });
  };

  const exportCsv = () => {
    const head = ["Date", "Convoyeur", "Mission", "Type", "TTC", "TVA", "HT", "Statut", "Refacturé", "Alertes"];
    const lines = visible.map((r) => [
      new Date(r.created_at).toLocaleDateString("fr-FR"),
      `${r.convoyeurs?.prenom ?? ""} ${r.convoyeurs?.nom ?? ""}`.trim(),
      `${r.trajets?.depart ?? ""} → ${r.trajets?.arrivee ?? ""}`,
      FRAIS_LABEL[r.type],
      String(r.montant_ttc).replace(".", ","),
      String(r.montant_tva).replace(".", ","),
      (Number(r.montant_ttc) - Number(r.montant_tva)).toFixed(2).replace(".", ","),
      FRAIS_STATUT_LABEL[r.statut],
      r.refacturer_client ? "Oui" : "Non",
      fraisAlertes(r).join(" | "),
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `frais-mission-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="fa-wrap">
      <style>{CSS}</style>

      <div className="fa-bar">
        {([["attente", "À valider"], ["suspect", "Suspects"], ["valide", "Validés"], ["refuse", "Refusés"], ["all", "Tous"]] as [string, string][])
          .map(([k, l]) => (
            <button key={k} type="button" className={`fa-chip ${filtre === k ? "on" : ""}`} onClick={() => setFiltre(k as typeof filtre)}>
              {l}
              {k === "suspect" && nbSuspects > 0 && <b className="warn">{nbSuspects}</b>}
              {k === "attente" && <b>{rows.filter((r) => r.statut === "attente").length}</b>}
            </button>
          ))}
        <span className="fa-sp" />
        {trajetId && convoyeurId && (
          <button type="button" className="fa-b" onClick={() => setAdd(true)}><Plus size={14} />Ajouter</button>
        )}
        <button type="button" className="fa-b" onClick={exportCsv}><Download size={14} />CSV</button>
      </div>

      {totalValide > 0 && (
        <div className="fa-sum">
          Validés : <b>{eur(totalValide)}</b> TTC · dont TVA récupérable <b>{eur(totalTva)}</b>
        </div>
      )}

      {loading ? (
        <div className="fa-empty"><Loader2 className="animate-spin" size={18} /></div>
      ) : visible.length === 0 ? (
        <div className="fa-empty">Aucun frais ici.</div>
      ) : (
        visible.map((r) => {
          const al = fraisAlertes(r);
          const c = r.controles ?? {};
          return (
            <div key={r.id} className={`fa-card ${al.length ? "sus" : ""}`}>
              <div className="fa-top">
                <span className="fa-ic">{r.type === "peage" ? <Receipt size={16} /> : <Fuel size={16} />}</span>
                <div className="fa-ti">
                  <b>{FRAIS_LABEL[r.type]} · {eur(r.montant_ttc)}</b>
                  <small>
                    {`${r.convoyeurs?.prenom ?? ""} ${r.convoyeurs?.nom ?? ""}`.trim() || "Convoyeur"}
                    {!trajetId && r.trajets ? ` · ${r.trajets.depart ?? "?"} → ${r.trajets.arrivee ?? "?"}` : ""}
                    {" · "}{new Date(r.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </small>
                </div>
                <span className={`fa-st ${r.statut}`}>{FRAIS_STATUT_LABEL[r.statut]}</span>
              </div>

              <div className="fa-ctl">
                <Ctl ok={c.camera !== false} label="Caméra" Icon={Camera} />
                <Ctl ok={c.gps !== false} label="GPS" Icon={MapPin} />
                <Ctl ok={c.recent !== false} label="Récent" Icon={Check} />
                <Ctl ok={c.tva_ok !== false} label={`TVA ${eur(r.montant_tva)}`} Icon={ShieldCheck} />
                <Ctl ok={(c.doublons?.length ?? 0) === 0} label="Unique" Icon={ScanSearch} />
                {typeof c.ia === "number" && <Ctl ok={c.ia < 0.5} label={`IA ${Math.round(c.ia * 100)} %`} Icon={ScanSearch} />}
              </div>

              {al.length > 0 && (
                <div className="fa-al"><AlertTriangle size={14} />{al.join(" · ")}</div>
              )}
              {r.statut === "refuse" && r.motif_refus && <div className="fa-al"><X size={14} />{r.motif_refus}</div>}

              <div className="fa-act">
                {r.photo_path && <button type="button" className="fa-b" onClick={() => voir(r)}><ZoomIn size={14} />Ticket</button>}
                {r.photo_path && typeof c.ia !== "number" && (
                  <button type="button" className="fa-b" disabled={busy === r.id} onClick={() => lancerIA(r)}><ScanSearch size={14} />Détecteur IA</button>
                )}
                <label className="fa-tg">
                  <input type="checkbox" checked={r.refacturer_client} onChange={() => toggleRefac(r)} /> Refacturer au client
                </label>
                <span className="fa-sp" />
                {r.statut === "attente" && (<>
                  <button type="button" className="fa-b ko" disabled={busy === r.id} onClick={() => { setRefus(r); setMotif(""); }}><X size={14} />Refuser</button>
                  <button type="button" className="fa-b ok" disabled={busy === r.id} onClick={() => valider(r)}>
                    {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Valider
                  </button>
                </>)}
                {r.statut !== "attente" && (
                  <button type="button" className="fa-b" disabled={busy === r.id} onClick={() => rouvrir(r)}><RotateCcw size={14} />Remettre à valider</button>
                )}
              </div>
            </div>
          );
        })
      )}

      {zoom && (
        <div className="fa-modal" onClick={() => setZoom(null)}>
          <div className="fa-mb" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.url} alt="Ticket" />
            <div className="fa-meta">
              <b>{FRAIS_LABEL[zoom.row.type]} · {eur(zoom.row.montant_ttc)}</b>
              <span>Pris le {zoom.row.capture_at ? new Date(zoom.row.capture_at).toLocaleString("fr-FR") : "—"}</span>
              {zoom.row.capture_lat != null && (
                <a target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${zoom.row.capture_lat}&mlon=${zoom.row.capture_lng}#map=17/${zoom.row.capture_lat}/${zoom.row.capture_lng}`}>
                  <MapPin size={12} /> Voir le lieu de la photo
                </a>
              )}
            </div>
            <button type="button" className="fa-b" onClick={() => setZoom(null)}>Fermer</button>
          </div>
        </div>
      )}

      {refus && (
        <div className="fa-modal" onClick={() => setRefus(null)}>
          <div className="fa-mb sm" onClick={(e) => e.stopPropagation()}>
            <h4>Refuser ce frais</h4>
            <p>Le convoyeur sera prévenu avec ce motif.</p>
            <textarea value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. ticket illisible, montant différent…" rows={3} />
            <div className="fa-act">
              <span className="fa-sp" />
              <button type="button" className="fa-b" onClick={() => setRefus(null)}>Annuler</button>
              <button type="button" className="fa-b ko" onClick={refuser}>Refuser</button>
            </div>
          </div>
        </div>
      )}

      {add && trajetId && convoyeurId && (
        <AddFrais trajetId={trajetId} convoyeurId={convoyeurId} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); done(); }} />
      )}
    </div>
  );
}

function Ctl({ ok, label, Icon }: { ok: boolean; label: string; Icon: typeof Camera }) {
  return <span className={`fa-c ${ok ? "ok" : "ko"}`}><Icon size={12} />{label}</span>;
}

/** Saisie par l'admin à la place du convoyeur (ticket papier remis en main propre, par ex.). */
function AddFrais({ trajetId, convoyeurId, onClose, onSaved }: { trajetId: string; convoyeurId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<FraisType>("peage");
  const [ttc, setTtc] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const m = num(ttc);
    if (m <= 0) return toast.error("Montant invalide");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("frais_mission" as never).insert({
      trajet_id: trajetId, convoyeur_id: convoyeurId, type, montant_ttc: m, montant_tva: tvaFromTtc(m),
      capture_source: "camera", capture_at: new Date().toISOString(), saisi_par_admin: true, decided_by: auth.user?.id,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Frais ajouté (à valider)");
    onSaved();
  };
  return (
    <div className="fa-modal" onClick={onClose}>
      <div className="fa-mb sm" onClick={(e) => e.stopPropagation()}>
        <h4>Ajouter un frais</h4>
        <div className="fa-act">
          {(["peage", "carburant"] as FraisType[]).map((t) => (
            <button key={t} type="button" className={`fa-b ${type === t ? "ok" : ""}`} onClick={() => setType(t)}>{FRAIS_LABEL[t]}</button>
          ))}
        </div>
        <input value={ttc} onChange={(e) => setTtc(e.target.value)} placeholder="Montant TTC (€)" inputMode="decimal" />
        <div className="fa-act">
          <span className="fa-sp" />
          <button type="button" className="fa-b" onClick={onClose}>Annuler</button>
          <button type="button" className="fa-b ok" disabled={busy} onClick={save}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Ajouter</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.fa-wrap{display:flex;flex-direction:column;gap:10px;color:#0f172a}
.fa-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.fa-sp{flex:1}
.fa-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:99px;border:1px solid #dbe4f5;background:#fff;font-size:12.5px;font-weight:600;color:#334155}
.fa-chip b{font-size:11px;background:#e8efff;color:#2F5FFF;border-radius:99px;padding:1px 7px}
.fa-chip b.warn{background:#ffe3e5;color:#d6303b}
.fa-chip.on{background:#2F5FFF;border-color:#2F5FFF;color:#fff}
.fa-chip.on b{background:rgba(255,255,255,.22);color:#fff}
.fa-b{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid #dbe4f5;background:#fff;font-size:12.5px;font-weight:600;color:#334155}
.fa-b.ok{background:#2F5FFF;border-color:#2F5FFF;color:#fff}
.fa-b.ko{background:#fff;border-color:#f3b4b9;color:#d6303b}
.fa-b:disabled{opacity:.5}
.fa-sum{font-size:12.5px;color:#475569;background:#f1f6ff;border:1px solid #dbe4f5;border-radius:10px;padding:8px 12px}
.fa-empty{padding:28px;text-align:center;font-size:13px;color:#64748b}
.fa-card{background:#fff;border:1px solid #dbe4f5;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:9px}
.fa-card.sus{border-color:#f3b4b9;box-shadow:0 0 0 3px rgba(214,48,59,.06)}
.fa-top{display:flex;align-items:center;gap:10px}
.fa-ic{width:34px;height:34px;border-radius:10px;background:#e8efff;color:#2F5FFF;display:grid;place-items:center;flex:none}
.fa-ti{display:flex;flex-direction:column;min-width:0}
.fa-ti b{font-size:14px}
.fa-ti small{font-size:11.5px;color:#64748b}
.fa-st{margin-left:auto;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px}
.fa-st.attente{background:#e8efff;color:#2F5FFF}
.fa-st.valide{background:#dcf7ea;color:#0f9d58}
.fa-st.refuse{background:#ffe3e5;color:#d6303b}
.fa-ctl{display:flex;flex-wrap:wrap;gap:5px}
.fa-c{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px}
.fa-c.ok{background:#e8f8f0;color:#0f9d58}
.fa-c.ko{background:#ffe3e5;color:#d6303b}
.fa-al{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#d6303b;background:#fff3f4;border-radius:9px;padding:7px 10px}
.fa-act{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.fa-tg{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#475569}
.fa-modal{position:fixed;inset:0;z-index:120;background:rgba(2,8,23,.66);display:grid;place-items:center;padding:16px}
.fa-mb{background:#fff;border-radius:16px;padding:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;display:flex;flex-direction:column;gap:10px}
.fa-mb.sm{max-width:400px}
.fa-mb img{width:100%;max-height:62vh;object-fit:contain;background:#0b1230;border-radius:10px}
.fa-mb h4{font-size:16px;font-weight:700}
.fa-mb p{font-size:13px;color:#64748b}
.fa-mb textarea,.fa-mb input{width:100%;border:1px solid #dbe4f5;border-radius:10px;padding:10px;font-size:14px}
.fa-meta{display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:#475569}
.fa-meta a{color:#2F5FFF;display:inline-flex;align-items:center;gap:4px}
`;
