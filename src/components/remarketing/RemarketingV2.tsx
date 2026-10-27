/**
 * Ligneo Remarketing V2 : devis comparés, chantier en direct, dossier final.
 * Partagé par l'espace flotte (client) et l'admin.
 */
import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Overlay, Pill } from "./RemarketingUI";
import { useIsDemoAccount } from "@/components/demo/demo-guard";
import {
  CHANTIER, MOTIFS, dateFr, dateTimeFr, downloadDoc, errText, eur, eur2, lineTtc, rdb, scoreDevis, saving,
  type DevisRecu, type Dossier, type RmkEvent, type RmkSettings,
} from "@/lib/remarketing";

/* ------------------------------------------------------------------ */
/*  Chantier en direct (lecture seule côté client)                     */
/* ------------------------------------------------------------------ */
export function ChantierLive({ d, events, presta }: { d: Dossier; events: RmkEvent[]; presta?: string | null }) {
  if (d.chantier_step == null) return null;
  const step = d.chantier_step;
  const feed = events.filter((e) => e.kind === "chantier");
  return (
    <div className="card">
      <h3>
        Chantier en direct <span className="live">En direct{d.chantier_maj ? ` · mis à jour ${dateTimeFr(d.chantier_maj)}` : ""}</span>
      </h3>
      <div className="stp2">
        {CHANTIER.map((s, k) => (
          <div key={s} className={k < step ? "d" : k === step ? "c" : ""}><i>{k < step ? "✓" : k + 1}</i>{s}</div>
        ))}
      </div>
      <div className="mt">
        {presta && <div><small>Atelier</small><b>{presta}</b></div>}
        {d.chantier_prevu && <div><small>Livraison prévue</small><b>{dateFr(d.chantier_prevu)}</b></div>}
        <div><small>Montant validé</small><b>{eur(d.devis_ligneo)}</b></div>
      </div>
      {d.chantier_note && <p style={{ fontSize: 13, color: "var(--ink2)", margin: "4px 0 8px" }}>Dernier message de l'atelier : « {d.chantier_note} »</p>}
      {feed.length > 0 && (
        <div className="feed">
          {feed.map((e) => (
            <div key={e.id}><time>{dateTimeFr(e.created_at)}</time><div><b>{e.message}</b><small>{e.acteur}</small></div></div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparateur de devis                                               */
/* ------------------------------------------------------------------ */
export function DevisCompareDrawer({ d, open, onClose, onDone, settings }: {
  d: Dossier | null; open: boolean; onClose: () => void; onDone: () => void; settings: RmkSettings;
}) {
  const demo = useIsDemoAccount();
  const [list, setList] = useState<DevisRecu[]>([]);
  const [loading, setLoading] = useState(false);
  const [cur, setCur] = useState(0);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !d) return;
    setLoading(true); setOff(new Set()); setAck(false);
    void (async () => {
      const { data, error } = await rdb.rpc("remarketing_devis_du_dossier", { p_dossier: d.id });
      setLoading(false);
      if (error) { toast.error("Devis indisponibles", { description: errText(error) }); return; }
      const rows = ((data ?? []) as DevisRecu[]).filter((x) => x.statut === "recu");
      setList(rows);
      let best = 0, bestScore = -1;
      rows.forEach((q, i) => { const sc = scoreDevis(q, rows); if (sc > bestScore) { bestScore = sc; best = i; } });
      setCur(best);
    })();
  }, [open, d]);

  const scores = useMemo(() => list.map((q) => scoreDevis(q, list)), [list]);
  const bestIdx = scores.length ? scores.indexOf(Math.max(...scores)) : -1;
  const q = list[cur];
  const total = q ? q.lignes.reduce((s, l, i) => (off.has(i) ? s : s + lineTtc(l)), 0) : 0;
  const classique = Number(d?.devis_classique ?? 0);
  const eco = classique > 0 ? Math.max(0, classique - total) : 0;
  const seuil = settings.seuil_auto_eur;
  const sous = total > 0 && total < seuil;

  const pick = (i: number) => { setCur(i); setOff(new Set()); setAck(false); };
  const toggle = (i: number) => setOff((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const accept = async () => {
    if (!q) return;
    if (demo) { toast.info("Mode démonstration : la validation est désactivée. Aucun devis n'est enregistré."); return; }
    if (!sous && !ack) { toast.error("Confirme que tu valides cette dépense."); return; }
    setBusy(true);
    const { error } = await rdb.rpc("remarketing_choisir_devis", { p_devis: q.id, p_lignes_off: Array.from(off) });
    setBusy(false);
    if (error) { toast.error("Action impossible", { description: errText(error) }); return; }
    toast.success(`Devis de ${q.prestataire.nom} accepté : le prestataire est prévenu`);
    onDone(); onClose();
  };
  const refuse = async () => {
    if (!d) return;
    if (demo) { toast.info("Mode démonstration : le refus est désactivé."); return; }
    if (!confirm("Refuser tous les devis ? Un conseiller vous proposera des alternatives.")) return;
    setBusy(true);
    const { error } = await rdb.rpc("remarketing_refuser_devis", { p_id: d.id });
    setBusy(false);
    if (error) { toast.error("Action impossible", { description: errText(error) }); return; }
    toast.success("Devis refusés : un conseiller va vous rappeler"); onDone(); onClose();
  };

  return (
    <Overlay open={open} onClose={onClose} kind="drawer" wide>
      {d && (
        <>
          <div className="h"><span className="vt" style={{ background: "rgba(255,255,255,.2)", color: "#fff", margin: 0 }}><Camera size={20} /></span><h2>Comparer les devis · {d.modele} · {d.immatriculation}</h2><button type="button" className="x" onClick={onClose}>×</button></div>
          <div className="b">
            {loading && <div className="card" style={{ textAlign: "center", color: "var(--ink3)" }}>Chargement des devis…</div>}
            {!loading && list.length === 0 && <div className="card" style={{ color: "var(--ink3)" }}>Aucun devis reçu pour le moment. Nous vous prévenons dès qu'un prestataire répond.</div>}
            {q && (
              <>
                <div className={`rule${sous ? "" : " n"}`}>
                  <span>⚡</span>
                  <span>{sous
                    ? `Sous le seuil de ${eur(seuil)} fixé par votre société : ce devis peut être accepté directement.`
                    : `Règle de votre société : les devis de moins de ${eur(seuil)} sont acceptés directement. Celui-ci dépasse le seuil : votre accord est nécessaire.`}</span>
                </div>
                <div className="qcols" style={{ marginTop: 6 }}>
                  {list.map((x, i) => (
                    <div key={x.id} className={`q${i === cur ? " best" : ""}`}>
                      {i === bestIdx && <span className="tag">Meilleur rapport qualité / prix</span>}
                      <div className="top2"><span className="av">{x.prestataire.nom.slice(0, 2).toUpperCase()}</span><div><h4>{x.prestataire.nom}</h4><div className="sub">{x.prestataire.ville ?? "—"} · partenaire Ligneo</div></div></div>
                      <div className="score"><div className="r" style={{ ["--p" as string]: scores[i] }}><span>{scores[i]}</span></div><div><b>Score Ligneo</b><div className="sv2">★ {x.prestataire.note ?? "—"} · {x.prestataire.chantiers} chantier{x.prestataire.chantiers > 1 ? "s" : ""} réalisé{x.prestataire.chantiers > 1 ? "s" : ""}</div></div></div>
                      {x.lignes.map((l, k) => <div className="ln" key={k}><span>{l.label}</span><span>{eur(lineTtc(l))}</span></div>)}
                      <div className="tot">{eur(x.total_ttc)}<small>TTC</small></div>
                      <div className="hts">{eur(x.total_ht)} HT · TVA {eur(Number(x.total_ttc) - Number(x.total_ht))}{x.delai_jours ? ` · ${x.delai_jours} j` : ""}{x.garantie_mois ? ` · garantie ${x.garantie_mois} mois` : ""}</div>
                      <div className="sel"><button type="button" className={`btn s${i === cur ? "" : " o"}`} style={{ width: "100%", justifyContent: "center" }} onClick={() => pick(i)}>{i === cur ? "Devis choisi" : "Choisir ce devis"}</button></div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ overflowX: "auto" }}><h3>Comparatif détaillé</h3>
                  <table className="crit">
                    <thead><tr><th>Critère</th>{list.map((x) => <th key={x.id}>{x.prestataire.nom}</th>)}</tr></thead>
                    <tbody>
                      <Row label="Prix total TTC" vals={list.map((x) => eur(x.total_ttc))} best={list.map((x) => Number(x.total_ttc) === Math.min(...list.map((y) => Number(y.total_ttc))))} />
                      <Row label="Délai annoncé" vals={list.map((x) => (x.delai_jours ? `${x.delai_jours} jours` : "—"))} best={list.map((x) => !!x.delai_jours && x.delai_jours === Math.min(...list.map((y) => y.delai_jours ?? 999)))} />
                      <Row label="Début possible" vals={list.map((x) => (x.debut_possible ? dateFr(x.debut_possible) : "—"))} />
                      <Row label="Note des clients" vals={list.map((x) => (x.prestataire.note ? `★ ${x.prestataire.note}` : "—"))} best={list.map((x) => !!x.prestataire.note && x.prestataire.note === Math.max(...list.map((y) => y.prestataire.note ?? 0)))} />
                      <Row label="Chantiers réalisés" vals={list.map((x) => String(x.prestataire.chantiers))} />
                      <Row label="Garantie travaux" vals={list.map((x) => (x.garantie_mois ? `${x.garantie_mois} mois` : "—"))} best={list.map((x) => !!x.garantie_mois && x.garantie_mois === Math.max(...list.map((y) => y.garantie_mois ?? 0)))} />
                      <Row label="Peinture en cabine" vals={list.map((x) => (x.peinture_cabine ? "Oui" : "Non"))} />
                      <Row label="Véhicule de courtoisie" vals={list.map((x) => (x.courtoisie ? "Oui" : "Non"))} />
                      <Row label="Validité du devis" vals={list.map((x) => `${x.validite_jours} jours`)} />
                    </tbody>
                  </table>
                  {q.commentaire && <p style={{ fontSize: 13, color: "var(--ink2)", marginTop: 10 }}>Message de {q.prestataire.nom} : « {q.commentaire} »</p>}
                  <p className="sv2">Score Ligneo : 40 % qualité, 35 % prix, 25 % délai, calculé sur les devis comparés.</p>
                </div>

                <div className="two">
                  <div className="card"><h3>Validation ligne par ligne · <span style={{ color: "var(--acc)" }}>{q.prestataire.nom}</span></h3>
                    {q.lignes.map((l, i) => (
                      <div key={i} className={`lrow${off.has(i) ? " off" : ""}`}>
                        <span className="th"><Camera size={20} /></span>
                        <div><b>{l.label}</b><small>{l.type}{l.qte > 1 ? ` · ${l.qte} ×` : ""}</small></div>
                        <div className="r"><span className="am">{eur(lineTtc(l))}</span><button type="button" className={`btn s${off.has(i) ? "" : " o"}`} onClick={() => toggle(i)}>{off.has(i) ? "Remettre" : "Retirer"}</button></div>
                      </div>
                    ))}
                  </div>
                  <div className="card"><h3>Comparaison avec une remise en état classique</h3>
                    <div className="cmp"><div><small>Classique</small><b>{classique > 0 ? eur(classique) : "—"}</b></div><div className="l"><small>Via Ligneo</small><b>{eur(total)}</b></div></div>
                    {classique > 0 && <div className="sav"><span>Vous économisez</span><span>{eur(eco)} · −{Math.round((eco / classique) * 100)} %</span></div>}
                    <div className="ln" style={{ marginTop: 10 }}><span>Trajets entre prestataires</span><span style={{ color: "var(--ok)" }}>{settings.trajets_charge_ligneo ? "À notre charge" : "Selon devis"}</span></div>
                    <div className="ln"><span>Délai annoncé</span><span>{q.delai_jours ? `${q.delai_jours} jours` : "—"}</span></div>
                    <div className="ln"><span>Garantie</span><span>{q.garantie_mois ? `${q.garantie_mois} mois` : "—"}</span></div>
                  </div>
                </div>

                {!sous && (
                  <label className="chk" style={{ display: "block" }}>
                    <label><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Je confirme que je suis autorisé à valider cette dépense de {eur(total)}.</label>
                  </label>
                )}
                <div className="sum">
                  <div><small>Lignes retenues</small><b>{eur(total)}</b></div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn r s" disabled={busy} onClick={() => void refuse()}>Refuser les devis</button>
                    <button type="button" className="btn g" disabled={busy || total <= 0} onClick={() => void accept()}>{busy ? "Envoi…" : "Accepter ce devis"}</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
}

function Row({ label, vals, best }: { label: string; vals: string[]; best?: boolean[] }) {
  return <tr><td>{label}</td>{vals.map((v, i) => <td key={i} className={best?.[i] ? "best w" : ""}>{v}</td>)}</tr>;
}

/* ------------------------------------------------------------------ */
/*  Dossier final                                                      */
/* ------------------------------------------------------------------ */
const KIND_TAG: Record<string, [string, boolean]> = {
  dossier: ["Demande", false], prise_en_charge: ["PV d'enlèvement", true], appel_offres: ["Appel d'offres", false], devis: ["Devis", true],
  trajet: ["Trajet GPS", false], chantier: ["Atelier", false], parc: ["Parc", false], livraison: ["PV de livraison", true], cloture: ["Clos", true],
};

async function loadRetained(d: Dossier): Promise<DevisRecu | null> {
  const { data } = await rdb.rpc("remarketing_devis_du_dossier", { p_dossier: d.id });
  return ((data ?? []) as DevisRecu[]).find((x) => x.statut === "retenu") ?? null;
}

export function DossierFinalDrawer({ d, events, open, onClose }: { d: Dossier | null; events: RmkEvent[]; open: boolean; onClose: () => void }) {
  const [retained, setRetained] = useState<DevisRecu | null>(null);
  useEffect(() => { setRetained(null); if (open && d) void loadRetained(d).then(setRetained); }, [open, d]);
  if (!d) return <Overlay open={false} onClose={onClose} kind="drawer" wide>{null}</Overlay>;

  const hist = [...events].filter((e) => e.visible_client !== false).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  const factures = d.factures?.length ? d.factures : d.facture_ref ? [{ ref: d.facture_ref, emetteur: "Transports Ligneo", objet: "Remise en état", statut: d.facture_statut ?? "a_regler", ttc: Number(d.devis_ligneo ?? 0) }] : [];
  const paye = factures.reduce((s, f) => s + Number(f.ttc || 0), 0);
  const classique = Number(d.devis_classique ?? 0);
  const eco = classique > 0 && paye > 0 ? Math.max(0, classique - paye) : saving(d);
  const lignes = d.devis_lignes ?? [];
  const jours = d.livre_le ? Math.max(1, Math.round((+new Date(d.livre_le) - +new Date(d.created_at)) / 864e5)) : null;
  const statutFac = (s: string) => (s === "payee" ? "Payée" : s === "offert" ? "Offert" : "À régler");

  return (
    <Overlay open={open} onClose={onClose} kind="drawer" wide>
      <div className="h"><span className="vt" style={{ background: "rgba(255,255,255,.2)", color: "#fff", margin: 0 }}><Camera size={20} /></span><h2>Dossier final · {d.ref}</h2><button type="button" className="x" onClick={onClose}>×</button></div>
      <div className="b">
        <div className="noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn o s" onClick={() => { void navigator.clipboard?.writeText(window.location.href); toast.success("Lien copié"); }}>Copier le lien</button>
          <button type="button" className="btn s" onClick={() => printDossier(d, hist, retained, factures)}>Imprimer / enregistrer en PDF</button>
        </div>
        <div className="doc">
          <div className="dh">
            <div><h2>Dossier de remise en état</h2><small>{d.ref} · ouvert le {dateFr(d.created_at)}{d.livre_le ? ` · clos le ${dateFr(d.livre_le)}` : ""}</small></div>
            <div style={{ textAlign: "right" }}><b style={{ color: "#2f5fff" }}>TRANSPORTS LIGNEO</b><br /><small>Tours · 07 82 45 61 81 · contact@transportsligneo.fr</small><br />{d.statut === "livre" && <span className="stamp">DOSSIER CLOS</span>}</div>
          </div>
          <div className="kp">
            <div><small>Véhicule</small><b>{d.modele}</b></div><div><small>Plaque</small><b>{d.immatriculation}</b></div>
            <div><small>Motif</small><b>{MOTIFS[d.motif] ?? d.motif}</b></div><div><small>Kilométrage</small><b>{d.kilometrage ? `${d.kilometrage.toLocaleString("fr-FR")} km` : "—"}</b></div>
          </div>
          {d.dommages.length > 0 && <><h5>1 · Dégâts constatés à l'enlèvement</h5><div className="dmg" style={{ margin: 0 }}>{d.dommages.map((x) => <span key={x}>{x}</span>)}</div></>}

          <h5>2 · Historique complet de la mission</h5>
          <ul className="tlx">
            {hist.map((e, i) => {
              const [tag, green] = KIND_TAG[e.kind] ?? ["", false];
              return (
                <li key={e.id}>
                  <time>{dateTimeFr(e.created_at)}</time><span className="n">{i === hist.length - 1 && d.statut === "livre" ? "✓" : i + 1}</span>
                  <div><b>{e.message}</b><small>{e.acteur ?? ""}</small></div>
                  {tag ? <span className={`tag${green ? " vv" : ""}`}>{tag}</span> : <span />}
                </li>
              );
            })}
            {hist.length === 0 && <li><span /><span /><div><small>Aucun évènement enregistré.</small></div><span /></li>}
          </ul>

          <h5>3 · Interventions et devis{retained ? ` · ${retained.prestataire.nom}` : ""}</h5>
          <table className="inv"><thead><tr><th>Intervention</th><th>Statut</th><th style={{ textAlign: "right" }}>Montant TTC</th></tr></thead>
            <tbody>
              {lignes.map((l, i) => <tr key={i}><td>{l.label}</td><td className={d.statut === "livre" ? "ok" : ""}>{d.statut === "livre" ? "Réalisé" : "Validé"}</td><td style={{ textAlign: "right" }}>{eur2(l.montant)}</td></tr>)}
              {lignes.length === 0 && <tr><td colSpan={3} style={{ color: "#667599" }}>Aucun devis validé pour le moment.</td></tr>}
            </tbody></table>
          {lignes.length > 0 && <div className="tt"><span>Total des interventions</span><span>{eur2(d.devis_ligneo)}</span></div>}

          <h5>4 · Factures</h5>
          <table className="inv"><thead><tr><th>N°</th><th>Émetteur</th><th>Objet</th><th>Statut</th><th style={{ textAlign: "right" }}>TTC</th></tr></thead>
            <tbody>
              {factures.map((f) => <tr key={f.ref}><td>{f.ref}</td><td>{f.emetteur}</td><td>{f.objet}</td><td className={f.statut === "a_regler" ? "" : "ok"}>{statutFac(f.statut)}</td><td style={{ textAlign: "right" }}>{eur2(f.ttc)}</td></tr>)}
              {factures.length === 0 && <tr><td colSpan={5} style={{ color: "#667599" }}>Aucune facture émise pour le moment.</td></tr>}
            </tbody></table>
          {factures.length > 0 && <div className="tt"><span>Total facturé</span><span>{eur2(paye)} TTC</span></div>}

          {(classique > 0 || jours) && (
            <>
              <h5>5 · Bilan</h5>
              <table className="inv"><tbody>
                {classique > 0 && <tr><td>Remise en état classique estimée</td><td style={{ textAlign: "right" }}>{eur2(classique)}</td></tr>}
                {paye > 0 && <tr><td>Via Ligneo</td><td style={{ textAlign: "right" }}>{eur2(paye)}</td></tr>}
                {classique > 0 && <tr><td><b>Économie réalisée</b></td><td style={{ textAlign: "right" }} className="ok"><b>{eur2(eco)} · −{Math.round((eco / classique) * 100)} %</b></td></tr>}
                {jours && <tr><td>Durée totale, de la demande à la livraison</td><td style={{ textAlign: "right" }}>{jours} jour{jours > 1 ? "s" : ""}</td></tr>}
              </tbody></table>
            </>
          )}

          <h5>6 · Documents</h5>
          <div className="docs">
            {d.devis_statut === "valide" && <div>📄 Devis accepté<b role="button" style={{ cursor: "pointer" }} onClick={() => downloadDoc(d, "devis")}>Télécharger</b></div>}
            {factures.map((f) => <div key={f.ref}>🧾 Facture {f.ref}<b role="button" style={{ cursor: "pointer" }} onClick={() => downloadDoc({ ...d, facture_ref: f.ref }, "facture")}>Télécharger</b></div>)}
          </div>
          <div className="sg"><div>Signature du client</div><div>Transports Ligneo</div></div>
        </div>
      </div>
    </Overlay>
  );
}

function printDossier(d: Dossier, hist: RmkEvent[], retained: DevisRecu | null, factures: Array<{ ref: string; emetteur: string; objet: string; statut: string; ttc: number }>) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const row = (a: string, b: string) => `<tr><td style="padding:7px;border-bottom:1px solid #e7ebf3">${esc(a)}</td><td style="padding:7px;border-bottom:1px solid #e7ebf3;text-align:right">${esc(b)}</td></tr>`;
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Dossier ${d.ref}</title><body style="font-family:Poppins,Arial,sans-serif;max-width:780px;margin:30px auto;color:#14161c;font-size:13px">
<h1 style="color:#1c3fc4;margin:0">Dossier de remise en état</h1><p style="color:#667599">${d.ref} · ${esc(d.modele)} · ${esc(d.immatriculation)} · ${esc(MOTIFS[d.motif] ?? d.motif)}<br>Transports Ligneo · Tours · contact@transportsligneo.fr · 07 82 45 61 81</p>
<h3 style="color:#2f5fff">Historique</h3><table style="width:100%;border-collapse:collapse">${hist.map((e) => row(`${dateTimeFr(e.created_at)} · ${e.message}`, e.acteur ?? "")).join("")}</table>
<h3 style="color:#2f5fff">Interventions${retained ? ` · ${esc(retained.prestataire.nom)}` : ""}</h3><table style="width:100%;border-collapse:collapse">${(d.devis_lignes ?? []).map((l) => row(l.label, eur2(l.montant))).join("")}${row("Total", eur2(d.devis_ligneo))}</table>
<h3 style="color:#2f5fff">Factures</h3><table style="width:100%;border-collapse:collapse">${factures.map((f) => row(`${f.ref} · ${f.emetteur} · ${f.objet}`, eur2(f.ttc))).join("")}</table>
<script>setTimeout(function(){window.print()},300)</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Autorise l'ouverture de fenêtres pour imprimer."); return; }
  w.document.write(html); w.document.close();
}

export const DemoBadge = () => <span className="demo-b">Démo</span>;
export { Pill };
