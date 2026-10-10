import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, FileDown, Layers, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignatureCanvas } from "@/components/inspection/SignatureCanvas";
import { downloadBlob, generateLotRecapPdf } from "@/lib/documents-officiels";
import {
  champsManquants,
  computeLignePrix,
  devisGlobalStatut,
  GLOBAL_LABEL,
  LIGNE_TYPES,
  lignePrix,
  ligneTypeLabel,
  parseLigneType,
  totalLignes,
  type DevisLigne,
  type LigneType,
} from "@/lib/devis-lots";

type Devis = {
  id: string;
  numero: string | null;
  user_id: string | null;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  depart: string | null;
  arrivee: string | null;
  date_souhaitee: string | null;
  heure_souhaitee: string | null;
  expires_at: string | null;
  paiement_immediat: boolean | null;
  vehicules: unknown;
};

type Lot = {
  id: string;
  numero: number;
  nom: string | null;
  nb_lignes: number;
  nb_missions: number;
  total_ttc: number;
  total_ht: number;
  signer_name: string | null;
  signature_data: string | null;
  signed_at: string | null;
  paiement_statut: string;
  statut: string;
  created_at: string;
};

type Filter = "tous" | LigneType | "a_valider" | "validee";
const FILTERS: { v: Filter; l: string }[] = [
  { v: "tous", l: "Tous" },
  ...LIGNE_TYPES.map((t) => ({ v: t.value as Filter, l: t.label })),
  { v: "a_valider", l: "À valider" },
  { v: "validee", l: "Validés" },
];

const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => any };

/**
 * Devis groupé validé par lots successifs. Côté client : sélection, actions en lot,
 * signature et validation. Côté admin (readOnly) : mêmes lignes, lots et statuts en lecture.
 */
export function GroupedDevisLots({ devisId, readOnly = false }: { devisId: string; readOnly?: boolean }) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [lignes, setLignes] = useState<DevisLigne[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [tab, setTab] = useState<"lignes" | "lots">("lignes");
  const [filter, setFilter] = useState<Filter>("tous");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [errIds, setErrIds] = useState<Set<string>>(new Set());
  const [recap, setRecap] = useState(false);
  const [loading, setLoading] = useState(true);
  const selKey = `devis-lots-sel:${devisId}`;

  const load = useCallback(async () => {
    const { data: d } = await db.from("devis").select("id, numero, user_id, email, nom, prenom, depart, arrivee, date_souhaitee, heure_souhaitee, expires_at, paiement_immediat, vehicules").eq("id", devisId).maybeSingle();
    if (!d) { setLoading(false); return; }
    setDevis(d as Devis);
    let { data: ls } = await db.from("devis_lignes").select("*").eq("devis_id", devisId).order("position");
    // Premier affichage : les lignes sont créées depuis les véhicules du devis groupé.
    if (!readOnly && (!ls || ls.length === 0) && Array.isArray(d.vehicules) && d.vehicules.length > 0) {
      const seed = [];
      for (const [i, v] of (d.vehicules as Record<string, unknown>[]).entries()) {
        const type = parseLigneType(v.type_trajet);
        const prix = Number(v.prix ?? 0);
        // Partage aller/retour existant pour un prix restitution et livraison déjà devisé.
        let split = { aller: prix, retour: 0 };
        if (type === "livraison_restitution" && prix > 0) {
          const { data: sp } = await db.rpc("split_ar_prices", { _total: prix });
          const row = Array.isArray(sp) ? sp[0] : sp;
          if (row) split = { aller: Number(row.aller), retour: Number(row.retour) };
        }
        seed.push({
          devis_id: devisId, position: i + 1, type_ligne: type,
          depart: d.depart, arrivee: (v.arrivee as string) ?? d.arrivee,
          date_enlevement: d.date_souhaitee, heure_enlevement: d.heure_souhaitee,
          adresse_retour: type === "livraison_restitution" ? d.depart : null,
          immatriculation: (v.immatriculation as string) ?? null, vin: (v.vin as string) ?? null,
          marque: (v.marque as string) ?? null, modele: (v.modele as string) ?? null,
          prix_aller: split.aller,
          prix_retour: split.retour,
        });
      }
      await db.from("devis_lignes").insert(seed);
      ({ data: ls } = await db.from("devis_lignes").select("*").eq("devis_id", devisId).order("position"));
    }
    setLignes((ls ?? []) as DevisLigne[]);
    const { data: lt } = await db.from("devis_lots").select("*").eq("devis_id", devisId).order("numero");
    setLots((lt ?? []) as Lot[]);
    setLoading(false);
  }, [devisId, readOnly]);

  useEffect(() => { void load(); }, [load]);
  // Sélection en cours conservée si l'utilisateur quitte la page.
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(selKey) ?? "[]"); if (Array.isArray(s)) setSel(new Set(s)); } catch { /* ignore */ }
  }, [selKey]);
  useEffect(() => { try { localStorage.setItem(selKey, JSON.stringify([...sel])); } catch { /* ignore */ } }, [sel, selKey]);

  const filtered = useMemo(() => lignes.filter((l) =>
    filter === "tous" ? true : filter === "a_valider" || filter === "validee" ? l.statut === filter : l.type_ligne === filter,
  ), [lignes, filter]);
  const selected = lignes.filter((l) => sel.has(l.id) && l.statut === "a_valider");
  const validated = lignes.filter((l) => l.statut === "validee");
  const status = devisGlobalStatut(lignes, devis?.expires_at);
  const total = totalLignes(lignes);
  const totalOk = totalLignes(validated);
  const lotById = new Map(lots.map((l) => [l.id, l]));

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectable = filtered.filter((l) => l.statut === "a_valider");
  const allFilteredSelected = selectable.length > 0 && selectable.every((l) => sel.has(l.id));
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (allFilteredSelected) selectable.forEach((l) => n.delete(l.id)); else selectable.forEach((l) => n.add(l.id));
    return n;
  });

  const patch = async (ids: string[], values: Partial<DevisLigne>) => {
    const { error } = await db.from("devis_lignes").update(values).in("id", ids).eq("statut", "a_valider");
    if (error) { toast.error("Modification impossible"); return; }
    await load();
  };

  const reprice = async (rows: DevisLigne[]) => {
    for (const l of rows) {
      const p = await computeLignePrix(l, { userId: devis?.user_id, email: devis?.email });
      if (p) await db.from("devis_lignes").update({ prix_aller: p.aller, prix_retour: p.retour }).eq("id", l.id).eq("statut", "a_valider");
    }
    await load();
  };

  const changeType = async (ids: string[], type: LigneType) => {
    const rows = lignes.filter((l) => ids.includes(l.id) && l.statut === "a_valider");
    for (const l of rows) {
      await db.from("devis_lignes").update({
        type_ligne: type,
        adresse_retour: type === "livraison_restitution" ? l.adresse_retour ?? l.depart : l.adresse_retour,
      }).eq("id", l.id).eq("statut", "a_valider");
    }
    await reprice(rows.map((l) => ({ ...l, type_ligne: type, adresse_retour: l.adresse_retour ?? l.depart })));
  };

  const addLigne = async () => {
    const pos = Math.max(0, ...lignes.map((l) => l.position)) + 1;
    const { error } = await db.from("devis_lignes").insert({
      devis_id: devisId, position: pos, type_ligne: "aller_simple",
      depart: devis?.depart, date_enlevement: devis?.date_souhaitee, heure_enlevement: devis?.heure_souhaitee,
    });
    if (error) toast.error("Ajout impossible"); else await load();
  };

  const removeLignes = async (ids: string[]) => {
    const { error } = await db.from("devis_lignes").delete().in("id", ids).eq("statut", "a_valider");
    if (error) toast.error("Suppression impossible");
    setSel(new Set());
    await load();
  };

  const openValidation = () => {
    if (selected.length === 0) { toast.error("Sélectionnez au moins une ligne à valider."); return; }
    const bad = selected.filter((l) => champsManquants(l).length > 0);
    if (bad.length) {
      setErrIds(new Set(bad.map((l) => l.id)));
      setFilter("tous");
      toast.error(`${bad.length} ligne${bad.length > 1 ? "s" : ""} à compléter (adresse, date, plaque), surlignée${bad.length > 1 ? "s" : ""} en rouge.`);
      document.getElementById(`ligne-${bad[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrIds(new Set());
    setRecap(true);
  };

  const cancelLot = async (lot: Lot) => {
    if (!confirm(`Annuler le lot ${lot.numero} ? Les lignes redeviendront « À valider ».`)) return;
    const { error } = await db.rpc("cancel_devis_lot", { _lot_id: lot.id });
    if (error) toast.error(error.message); else { toast.success("Lot annulé"); await load(); }
  };

  const lotPdf = async (lot: Lot) => {
    const rows = lignes.filter((l) => l.lot_id === lot.id);
    const blob = await generateLotRecapPdf({
      devisNumero: devis?.numero ?? "", lotNumero: lot.numero, lotNom: lot.nom,
      client: [devis?.prenom, devis?.nom].filter(Boolean).join(" "),
      signedAt: lot.signed_at, signerName: lot.signer_name, signature: lot.signature_data,
      totalTtc: Number(lot.total_ttc), totalHt: Number(lot.total_ht),
      lignes: rows.map((l) => ({
        reference: l.mission_numero ?? "", type: ligneTypeLabel(l.type_ligne),
        plaque: l.immatriculation ?? "", vehicule: [l.marque, l.modele].filter(Boolean).join(" "),
        trajet: l.type_ligne === "livraison_restitution" ? `${l.depart} > ${l.arrivee} > ${l.adresse_retour || l.depart}` : `${l.depart} > ${l.arrivee}`,
        date: [l.date_enlevement, l.date_restitution].filter(Boolean).join(" / "), prix: lignePrix(l),
      })),
    });
    await downloadBlob(blob, `bon-de-commande-${devis?.numero}-lot-${lot.numero}.pdf`);
  };

  if (loading) return <div className="dl-root dl-card">Chargement du devis groupé…</div>;
  if (!devis || lignes.length === 0) return null;
  const pct = lignes.length ? Math.round((validated.length / lignes.length) * 100) : 0;
  const byType = (rows: DevisLigne[]) => LIGNE_TYPES.map((t) => ({ ...t, n: rows.filter((r) => r.type_ligne === t.value).length })).filter((t) => t.n > 0);

  return (
    <div className="dl-root">
      <section className="dl-card dl-summary">
        <div className="dl-row-between">
          <div>
            <p className="dl-eyebrow">Devis groupé <span className="dl-mono">{devis.numero}</span></p>
            <h2 className="dl-title">{validated.length} sur {lignes.length} validées</h2>
          </div>
          <span className={`dl-pill dl-pill--${status}`}>{GLOBAL_LABEL[status]}</span>
        </div>
        <div className="dl-progress"><span style={{ width: `${pct}%` }} /></div>
        <div className="dl-kpis">
          <div><small>Montant validé</small><strong>{eur(totalOk)}</strong></div>
          <div><small>Restant à valider</small><strong>{eur(total - totalOk)}</strong></div>
          <div><small>Total du devis</small><strong>{eur(total)}</strong></div>
        </div>
      </section>

      <div className="dl-tabs">
        <button className={tab === "lignes" ? "is-on" : ""} onClick={() => setTab("lignes")}>Lignes ({lignes.length})</button>
        <button className={tab === "lots" ? "is-on" : ""} onClick={() => setTab("lots")}>Lots ({lots.filter((l) => l.statut === "valide").length})</button>
      </div>

      {tab === "lignes" && (
        <>
          <div className="dl-filters">
            {FILTERS.map((f) => (
              <button key={f.v} className={filter === f.v ? "is-on" : ""} onClick={() => setFilter(f.v)}>{f.l}</button>
            ))}
            {!readOnly && selectable.length > 0 && (
              <button className="dl-link" onClick={toggleAll}>
                {allFilteredSelected ? "Désélectionner tout ce qui est filtré" : "Sélectionner tout ce qui est filtré"}
              </button>
            )}
          </div>

          {!readOnly && (
            <label className="dl-checkall">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} /> Tout sélectionner
            </label>
          )}

          <div className="dl-list">
            {filtered.map((l) => (
              <LigneCard key={l.id} l={l} readOnly={readOnly} checked={sel.has(l.id)} error={errIds.has(l.id)}
                lot={l.lot_id ? lotById.get(l.lot_id) : undefined}
                onToggle={() => toggle(l.id)}
                onType={(t) => void changeType([l.id], t)}
                onSave={async (v) => { await patch([l.id], v); if ("depart" in v || "arrivee" in v || "adresse_retour" in v) await reprice([{ ...l, ...v } as DevisLigne]); }}
                readOnlyAdmin={readOnly}
              />
            ))}
          </div>

          {!readOnly && (
            <button className="dl-add" onClick={() => void addLigne()}><Plus size={16} /> Ajouter une ligne</button>
          )}
        </>
      )}

      {tab === "lots" && (
        <div className="dl-list">
          {lots.length === 0 && <p className="dl-muted">Aucun lot validé pour le moment.</p>}
          {lots.map((lot) => {
            const rows = lignes.filter((l) => l.lot_id === lot.id);
            return (
              <div key={lot.id} className="dl-card dl-lot">
                <div className="dl-row-between">
                  <div>
                    <p className="dl-eyebrow">Lot {lot.numero} · {new Date(lot.created_at).toLocaleDateString("fr-FR")}</p>
                    <h3 className="dl-subtitle">{lot.nom || `Lot ${lot.numero}`}</h3>
                  </div>
                  <span className={`dl-pill ${lot.statut === "valide" ? "dl-pill--complet" : "dl-pill--expire"}`}>{lot.statut === "valide" ? "Validé" : "Annulé"}</span>
                </div>
                <p className="dl-muted">
                  {lot.nb_lignes} ligne{lot.nb_lignes > 1 ? "s" : ""} · {lot.nb_missions} mission{lot.nb_missions > 1 ? "s" : ""} · {eur(Number(lot.total_ttc))} TTC
                  {" · "}Signé {lot.signed_at ? `le ${new Date(lot.signed_at).toLocaleDateString("fr-FR")}` : "non"}{lot.signer_name ? ` par ${lot.signer_name}` : ""}
                  {" · "}Paiement {lot.paiement_statut === "a_payer" ? "à régler" : "sur facture"}
                </p>
                <div className="dl-chips">
                  {rows.map((r) => <span key={r.id} className="dl-mono dl-chip">{r.mission_numero}</span>)}
                </div>
                <div className="dl-actions">
                  <button className="dl-btn-ghost" onClick={() => void lotPdf(lot)}><FileDown size={15} /> Bon de commande PDF</button>
                  {readOnly && <Link className="dl-btn-ghost" to="/admin/missions">Missions (filtre Lot)</Link>}
                  {!readOnly && lot.statut === "valide" && <button className="dl-btn-ghost" onClick={() => void cancelLot(lot)}><X size={15} /> Annuler le lot</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && selected.length > 0 && (
        <div className="dl-bar">
          <div className="dl-bar-info">
            <strong>{selected.length} ligne{selected.length > 1 ? "s" : ""} sélectionnée{selected.length > 1 ? "s" : ""}</strong>
            <span>{byType(selected).map((t) => `${t.n} ${t.label.toLowerCase()}`).join(" · ")}</span>
            <strong className="dl-bar-total">{eur(totalLignes(selected))}</strong>
          </div>
          <div className="dl-bar-tools">
            <select aria-label="Changer le type" value="" onChange={(e) => e.target.value && void changeType(selected.map((s) => s.id), e.target.value as LigneType)}>
              <option value="">Changer le type</option>
              {LIGNE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input aria-label="Date d'enlèvement" type="date" onChange={(e) => e.target.value && void patch(selected.map((s) => s.id), { date_enlevement: e.target.value })} />
            <button className="dl-btn-ghost" onClick={() => confirm("Supprimer les lignes sélectionnées ?") && void removeLignes(selected.map((s) => s.id))}><Trash2 size={15} /> Supprimer</button>
          </div>
          <div className="dl-bar-btns">
            <button className="dl-btn-ghost" onClick={() => setSel(new Set())}>Retirer de la sélection</button>
            <button className="dl-btn-primary" onClick={openValidation}><Check size={16} /> Valider la sélection</button>
          </div>
        </div>
      )}

      {recap && devis && (
        <LotRecapDialog devis={devis} rows={selected} byType={byType(selected)} onClose={() => setRecap(false)}
          onDone={async () => { setRecap(false); setSel(new Set()); await load(); }} />
      )}
    </div>
  );
}

function LigneCard({ l, checked, error, lot, readOnly, readOnlyAdmin, onToggle, onType, onSave }: {
  l: DevisLigne; checked: boolean; error: boolean; lot?: Lot; readOnly: boolean; readOnlyAdmin: boolean;
  onToggle: () => void; onType: (t: LigneType) => void; onSave: (v: Partial<DevisLigne>) => Promise<void>;
}) {
  const locked = readOnly || l.statut === "validee";
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(l);
  useEffect(() => setF(l), [l]);
  const ar = l.type_ligne === "livraison_restitution";
  const missing = champsManquants(l);
  const field = (k: keyof DevisLigne, label: string, type = "text") => (
    <label className="dl-field"><span>{label}</span>
      <input type={type} value={(f[k] as string) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value || null })} />
    </label>
  );
  return (
    <div id={`ligne-${l.id}`} className={`dl-card dl-ligne ${checked ? "is-sel" : ""} ${error ? "is-err" : ""} ${l.statut === "validee" ? "is-ok" : ""}`}>
      <div className="dl-ligne-head">
        {!readOnly && <input type="checkbox" aria-label="Sélectionner" disabled={l.statut === "validee"} checked={checked && l.statut !== "validee"} onChange={onToggle} />}
        {locked ? (
          <span className="dl-type">{ligneTypeLabel(l.type_ligne)}</span>
        ) : (
          <select className="dl-type" value={l.type_ligne} onChange={(e) => onType(e.target.value as LigneType)} aria-label="Type de ligne">
            {LIGNE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
        {l.immatriculation && <span className="dl-mono dl-plate">{l.immatriculation}</span>}
        <span className="dl-muted">{[l.marque, l.modele].filter(Boolean).join(" ")}</span>
        <span className={`dl-pill ${l.statut === "validee" ? "dl-pill--complet" : "dl-pill--a_valider"}`}>{l.statut === "validee" ? "Validée" : "À valider"}</span>
        <strong className="dl-price">{eur(lignePrix(l))}</strong>
      </div>
      <div className="dl-ligne-body">
        <p>{l.depart || "Départ à préciser"} <span className="dl-muted">vers</span> {l.arrivee || "Arrivée à préciser"} <span className="dl-muted">· {l.date_enlevement ?? "date à préciser"} {l.heure_enlevement ?? ""}</span></p>
        {ar && (
          <p>Restitution vers {l.adresse_retour || l.depart || "adresse à préciser"} <span className="dl-muted">· {l.date_restitution ?? "date à préciser"} {l.heure_restitution ?? ""}</span>
            <span className="dl-muted"> · aller {eur(Number(l.prix_aller))} + retour {eur(Number(l.prix_retour))}</span></p>
        )}
        {error && missing.length > 0 && <p className="dl-err"><AlertCircle size={14} /> À compléter : {missing.join(", ")}</p>}
        {l.statut === "validee" && (
          <p className="dl-ok"><Check size={14} /> Mission <span className="dl-mono">{l.mission_numero}</span>{lot ? ` · ${lot.nom || `Lot ${lot.numero}`}` : ""}
            {l.mission_ids?.[0] && (readOnlyAdmin
              ? <Link to="/admin/missions/$missionId" params={{ missionId: l.mission_ids[0] }} className="dl-link"> Voir la mission</Link>
              : <Link to="/dashboard-pro/missions/$missionId" params={{ missionId: l.mission_ids[0] }} className="dl-link"> Voir la mission</Link>)}
          </p>
        )}
        {!locked && (
          <button className="dl-link" onClick={() => setEdit((e) => !e)}>{edit ? "Fermer" : missing.length ? "Corriger la ligne" : "Modifier"}</button>
        )}
      </div>
      {edit && !locked && (
        <div className="dl-edit">
          {field("immatriculation", "Plaque")}{field("marque", "Marque")}{field("modele", "Modèle")}
          {field("depart", "Adresse d'enlèvement")}{field("arrivee", "Adresse de livraison")}
          {field("date_enlevement", "Date d'enlèvement", "date")}{field("heure_enlevement", "Heure d'enlèvement", "time")}
          {field("date_livraison", "Date de livraison", "date")}{field("heure_livraison", "Heure de livraison", "time")}
          {ar && <>{field("adresse_retour", "Adresse de retour")}{field("date_restitution", "Date de restitution", "date")}{field("heure_restitution", "Heure de restitution", "time")}{field("contact_nom", "Contact sur place")}{field("contact_tel", "Téléphone du contact", "tel")}</>}
          <button className="dl-btn-primary" onClick={async () => {
            const { id: _i, devis_id: _d, statut: _s, lot_id: _l, mission_ids: _m, mission_numero: _n, position: _p, prix_aller: _a, prix_retour: _r, type_ligne: _t, ...v } = f;
            await onSave(v); setEdit(false);
          }}>Enregistrer</button>
        </div>
      )}
    </div>
  );
}

function LotRecapDialog({ devis, rows, byType, onClose, onDone }: {
  devis: Devis; rows: DevisLigne[]; byType: { label: string; n: number }[]; onClose: () => void; onDone: () => Promise<void>;
}) {
  const [nom, setNom] = useState("");
  const [signer, setSigner] = useState([devis.prenom, devis.nom].filter(Boolean).join(" "));
  const [busy, setBusy] = useState(false);
  const ttc = totalLignes(rows);
  const ht = Math.round((ttc / 1.2) * 100) / 100;

  const sign = async (file: File) => {
    if (!signer.trim()) { toast.error("Indiquez le nom du signataire."); return; }
    setBusy(true);
    const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
    const { error } = await db.rpc("validate_devis_lot", {
      _devis_id: devis.id, _ligne_ids: rows.map((r) => r.id), _nom: nom.trim() || null, _signer_name: signer.trim(), _signature: dataUrl,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lot validé, missions créées");
    await onDone();
  };

  return (
    <div className="dl-modal" role="dialog" aria-modal="true">
      <div className="dl-modal-card">
        <div className="dl-row-between">
          <h3 className="dl-subtitle"><Layers size={18} /> Récapitulatif du lot</h3>
          <button className="dl-btn-ghost" onClick={onClose} aria-label="Fermer"><X size={16} /></button>
        </div>
        <ul className="dl-recap">
          {rows.map((r) => (
            <li key={r.id}><span className="dl-type">{ligneTypeLabel(r.type_ligne)}</span> <span className="dl-mono">{r.immatriculation}</span> <span className="dl-muted">{r.arrivee}</span> <strong>{eur(lignePrix(r))}</strong></li>
          ))}
        </ul>
        <p className="dl-muted">{byType.map((t) => `${t.n} ${t.label.toLowerCase()}`).join(" · ")}</p>
        <div className="dl-kpis">
          <div><small>Total HT</small><strong>{eur(ht)}</strong></div>
          <div><small>Total TTC</small><strong>{eur(ttc)}</strong></div>
        </div>
        <p className="dl-muted">
          {devis.paiement_immediat ? "Conditions de votre compte : paiement du lot à la validation." : "Conditions de votre compte : règlement sur facture, à réception."}
        </p>
        <label className="dl-field"><span>Nom du lot (facultatif)</span><input value={nom} placeholder="Lot 1, livraisons du 12 octobre" onChange={(e) => setNom(e.target.value)} /></label>
        <label className="dl-field"><span>Nom du signataire</span><input value={signer} onChange={(e) => setSigner(e.target.value)} /></label>
        <p className="dl-muted">Signez ci-dessous pour valider ce lot (bon pour accord).</p>
        <SignatureCanvas onValidate={(f) => void sign(f)} disabled={busy} />
      </div>
    </div>
  );
}
