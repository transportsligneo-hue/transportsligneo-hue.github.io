/**
 * Portail prestataire · Ligneo Remarketing.
 * Le garage / carrossier répond aux demandes de devis, suit ses chantiers et tient le client informé en direct.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Kpi, Overlay, Pill, Tabs } from "@/components/remarketing/RemarketingUI";
import {
  CHANTIER, MOTIFS, dateFr, dateTimeFr, errText, eur, eur2, rdb,
  type LigneHT, type PrestaChantier, type PrestaDemande, type PrestaOverview,
} from "@/lib/remarketing";
import "@/components/remarketing/remarketing-ui.css";

export const Route = createFileRoute("/_authenticated/prestataire")({ component: PortailPrestataire });

type Tab = "dem" | "cha" | "pla" | "tar";
const TYPES = ["Main d’œuvre", "Peinture", "Pièce", "Forfait"];
const hoursLeft = (iso: string | null) => {
  if (!iso) return null;
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 36e5);
  if (h <= 0) return "délai dépassé";
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} j`;
};

function PortailPrestataire() {
  const { logout } = useAuth();
  const [ov, setOv] = useState<PrestaOverview | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("dem");
  const [dem, setDem] = useState<PrestaDemande | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await rdb.rpc("remarketing_presta_overview");
    if (error) { toast.error("Chargement impossible", { description: errText(error) }); setOv(null); return; }
    setOv((data ?? null) as PrestaOverview | null);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, [load]);

  if (ov === undefined) return <div className="rmkx" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}><div className="dl-bar" style={{ width: 140, height: 5, borderRadius: 9, background: "rgba(47,95,255,.18)", overflow: "hidden" }}><i style={{ display: "block", width: "40%", height: "100%", background: "linear-gradient(90deg,#2f5fff,#6ea1ff)", animation: "pf 1.2s ease-in-out infinite" }} /><style>{"@keyframes pf{0%{margin-left:-40%}100%{margin-left:100%}}"}</style></div></div>;

  if (ov === null) {
    return (
      <div className="rmkx" style={{ minHeight: "100vh", background: "var(--bg)", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="card" style={{ maxWidth: 460, textAlign: "center" }}>
          <h3 style={{ justifyContent: "center" }}>Espace prestataire</h3>
          <p style={{ color: "var(--ink2)", margin: "8px 0 14px" }}>Ce compte n'est relié à aucun prestataire. Contactez Transports Ligneo (07 82 45 61 81) pour activer votre accès.</p>
          <button type="button" className="btn o s" onClick={() => void logout()}>Se déconnecter</button>
        </div>
      </div>
    );
  }

  const p = ov.prestataire;
  const aChiffrer = ov.demandes.filter((x) => x.statut === "demande");
  const taux = ov.devis_envoyes_30j ? Math.round((ov.devis_acceptes_30j / ov.devis_envoyes_30j) * 100) : null;
  const initiales = p.nom.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rmkx" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div className="pstop"><img src="/icons/icon-192.png" alt="Transports Ligneo" /><b>Transports Ligneo · Espace prestataire</b><span className="sp" /><button type="button" className="btn o s" onClick={() => void logout()}><LogOut size={14} />Déconnexion</button></div>
      <div className="pwrap">
        <div className="phead"><span className="lg">{initiales}</span>
          <div><b>{p.nom}</b><small>Prestataire partenaire Ligneo{p.ville ? ` · ${p.ville}` : ""}</small>
            <div className="chips">{(p.specialite ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => <span key={x} className="chip a">{x}</span>)}<span className="chip">Rayon {p.rayon_km} km</span></div></div>
          <span className="sp" /><Pill tone="k">Compte actif</Pill></div>

        <header className="hd"><div className="hl"><div><div className="eb"><i />Ligneo Remarketing · Portail prestataire</div><h1>Vos demandes, <span>vos chantiers</span></h1><p>Répondez aux demandes de devis, suivez vos chantiers en direct et tenez le client informé à chaque étape. Tout est visible par le client et par Ligneo.</p></div></div></header>

        <div className="kpis" style={{ margin: 0 }}>
          <Kpi icon={<Car />} label="Demandes à chiffrer" value={aChiffrer.length} sub={aChiffrer.length ? "répondez avant la date limite" : "rien en attente"} tone="warn" />
          <Kpi icon={<Car />} label="Chantiers en cours" value={ov.chantiers.length} sub={`${ov.chantiers.filter((c) => c.chantier_step >= 6).length} prêt${ov.chantiers.filter((c) => c.chantier_step >= 6).length > 1 ? "s" : ""} à récupérer`} />
          <Kpi icon={<Car />} label="Devis acceptés (30 j)" value={taux != null ? `${taux} %` : "—"} sub={`${ov.devis_acceptes_30j} sur ${ov.devis_envoyes_30j}`} tone="ok" />
          <Kpi icon={<Car />} label="Note des clients" value={p.note ? `★ ${p.note}` : "—"} sub={p.delai_moyen_jours ? `délai moyen ${p.delai_moyen_jours} j` : ""} />
        </div>

        <Tabs<Tab> value={tab} onChange={setTab} items={[["dem", "Demandes de devis", ov.demandes.length], ["cha", "Chantiers", ov.chantiers.length], ["pla", "Planning"], ["tar", "Mes tarifs"]]} />

        {tab === "dem" && (
          <div>
            {ov.demandes.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--ink3)" }}>Aucune demande pour le moment. Vous serez prévenu dès qu'un véhicule est à chiffrer.</div>}
            {ov.demandes.map((x) => {
              const left = hoursLeft(x.date_limite);
              const urgent = x.statut === "demande" && x.date_limite && new Date(x.date_limite).getTime() - Date.now() < 36e5 * 36;
              return (
                <div key={x.devis_id} className={`req${urgent ? " u" : ""}`}>
                  <span className="vt"><Car /></span>
                  <div>
                    <h4>{x.modele} <span className="plate">{x.immatriculation}</span>{x.statut === "recu" ? <Pill tone="k">Devis envoyé</Pill> : <Pill tone={urgent ? "w" : "n"}>{left ? `Reste ${left}` : "À chiffrer"}</Pill>}</h4>
                    <p>{MOTIFS[x.motif] ?? x.motif}{x.lieu ? ` · ${x.lieu}` : ""}{x.kilometrage ? ` · ${x.kilometrage.toLocaleString("fr-FR")} km` : ""}</p>
                    <div className="dmg">{x.dommages.map((dm) => <span key={dm}>{dm}</span>)}</div>
                    <div className="chips"><span className="chip">Convoyeur Ligneo inclus</span><span className="chip a">Comparé avec d'autres ateliers</span></div>
                  </div>
                  <div className="rt"><small style={{ color: "var(--ink3)" }}>{x.date_limite ? `Réponse avant le ${dateTimeFr(x.date_limite)}` : ""}</small>
                    <button type="button" className="btn s" onClick={() => setDem(x)}>{x.statut === "recu" ? "Modifier mon devis" : "Répondre"}</button></div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "cha" && (
          <div>
            {ov.chantiers.length === 0 && <div className="card" style={{ textAlign: "center", color: "var(--ink3)" }}>Aucun chantier en cours. Les devis acceptés par les clients apparaissent ici.</div>}
            {ov.chantiers.map((c) => <Chantier key={c.dossier_id} c={c} onDone={() => void load()} />)}
          </div>
        )}

        {tab === "pla" && <Planning ov={ov} />}
        {tab === "tar" && <Tarifs ov={ov} onDone={() => void load()} />}
      </div>

      <DevisDrawer dem={dem} tarifs={p.tarifs} garantieDefaut={p.garantie_mois} onClose={() => setDem(null)} onDone={() => { setDem(null); void load(); }} />
    </div>
  );
}

/* ------------------------------ Chantier ------------------------------ */
function Chantier({ c, onDone }: { c: PrestaChantier; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [prevu, setPrevu] = useState(c.chantier_prevu ?? "");
  const [busy, setBusy] = useState(false);
  const set = async (step: number) => {
    setBusy(true);
    const { error } = await rdb.rpc("remarketing_presta_maj_chantier", { p_dossier: c.dossier_id, p_step: step, p_note: note || null, p_prevu: prevu || null });
    setBusy(false);
    if (error) { toast.error("Mise à jour impossible", { description: errText(error) }); return; }
    toast.success(`Statut « ${CHANTIER[step]} » envoyé au client et à Ligneo`); setNote(""); onDone();
  };
  const step = c.chantier_step;
  return (
    <div className="ch">
      <div className="t">
        <span className="vt"><Car /></span>
        <div><h4>{c.modele} <span className="plate">{c.immatriculation}</span><span className="live">En direct{c.chantier_maj ? ` · mis à jour ${dateTimeFr(c.chantier_maj)}` : ""}</span></h4><small>{c.dommages.join(", ")} · devis validé {eur(c.montant)} TTC</small></div>
        <span className="sp" /><Pill tone={step >= 6 ? "k" : "b"}>{step >= 6 ? "Prêt à récupérer" : `En ${CHANTIER[step].toLowerCase()}`}</Pill>
      </div>
      <div className="g">
        <div>
          <div className="sect">Avancement du chantier</div>
          <div className="stp2">{CHANTIER.map((s, k) => <div key={s} className={k < step ? "d" : k === step ? "c" : ""}><i>{k < step ? "✓" : k + 1}</i>{s}</div>)}</div>
          <div className="mt"><div><small>Dossier</small><b>{c.ref}</b></div><div><small>Livraison prévue</small><b>{c.chantier_prevu ? dateFr(c.chantier_prevu) : "À indiquer"}</b></div><div><small>Montant validé</small><b>{eur(c.montant)} TTC</b></div></div>
          <div className="sect" style={{ marginTop: 14 }}>Lignes du devis accepté</div>
          {(c.lignes ?? []).map((l, i) => <div className="ln" key={i}><span>{l.label}</span><span>{eur2(l.montant)}</span></div>)}
        </div>
        <div>
          <div className="sect">Journal en direct · partagé avec le client et Ligneo</div>
          <div className="feed">
            {c.events.length === 0 && <small style={{ color: "var(--ink3)" }}>Aucune mise à jour pour le moment.</small>}
            {c.events.map((e, i) => <div key={i}><time>{dateTimeFr(e.at)}</time><div><b>{e.message}</b></div></div>)}
          </div>
          <div className="card" style={{ marginTop: 14, background: "var(--card2)", boxShadow: "none" }}>
            <div className="f">
              <label>Mettre à jour le statut</label>
              <div className="seg">{CHANTIER.map((s, k) => <button key={s} type="button" disabled={busy} className={k === step ? "on" : ""} onClick={() => void set(k)}>{s}</button>)}</div>
              <div className="r2" style={{ marginTop: 10 }}>
                <div><label>Livraison prévue</label><input type="date" value={prevu} onChange={(e) => setPrevu(e.target.value)} /></div>
                <div><label>Message pour le client</label><input value={note} placeholder="Ex : peinture en cabine jeudi matin" onChange={(e) => setNote(e.target.value)} /></div>
              </div>
              <div className="act" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn s" disabled={busy || step >= 6} onClick={() => void set(Math.min(6, step + 1))}>Passer à l'étape suivante</button>
                <button type="button" className="btn g s" disabled={busy || step >= 6} onClick={() => void set(6)}>Déclarer prêt</button>
                <button type="button" className="btn o s" disabled={busy} onClick={() => void set(step)}>Envoyer un message</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Planning ------------------------------ */
function Planning({ ov }: { ov: PrestaOverview }) {
  const items = useMemo(() => {
    const a = ov.chantiers.filter((c) => c.chantier_prevu).map((c) => ({ at: c.chantier_prevu!, t: `${c.modele} prêt à être récupéré`, s: `${c.immatriculation} · convoyeur Ligneo`, tone: "k" as const }));
    const b = ov.demandes.filter((x) => x.statut === "demande" && x.date_limite).map((x) => ({ at: x.date_limite!, t: `Répondre pour ${x.modele}`, s: `${x.immatriculation} · demande de devis`, tone: "w" as const }));
    return [...a, ...b].sort((x, y) => +new Date(x.at) - +new Date(y.at));
  }, [ov]);
  return (
    <div className="card"><h3>À venir</h3>
      {items.length === 0 && <p style={{ color: "var(--ink3)" }}>Rien de planifié.</p>}
      {items.map((x, i) => <div className="mini" key={i}><span className={`pill ${x.tone}`}>{dateFr(x.at)}</span><div><b>{x.t}</b><small>{x.s}</small></div></div>)}
    </div>
  );
}

/* ------------------------------ Tarifs ------------------------------ */
const TARIF_FIELDS: Array<[string, string]> = [["taux_horaire", "Taux horaire carrosserie (€ HT / h)"], ["peinture_element", "Peinture, élément standard (€ HT)"], ["jante", "Rénovation jante (€ HT)"], ["polissage", "Polissage complet (€ HT)"]];
function Tarifs({ ov, onDone }: { ov: PrestaOverview; onDone: () => void }) {
  const [t, setT] = useState<Record<string, number | "">>({ ...ov.prestataire.tarifs });
  const [g, setG] = useState(ov.prestataire.garantie_mois);
  const save = async () => {
    const clean: Record<string, number> = {};
    Object.entries(t).forEach(([k, v]) => { if (v !== "" && Number(v) >= 0) clean[k] = Number(v); });
    const { error } = await rdb.rpc("remarketing_presta_save_tarifs", { p_tarifs: clean, p_garantie: g });
    if (error) { toast.error("Enregistrement impossible", { description: errText(error) }); return; }
    toast.success("Tarifs enregistrés"); onDone();
  };
  return (
    <div className="card"><h3>Mes tarifs négociés</h3>
      <div className="f">
        {TARIF_FIELDS.map(([k, label]) => <div key={k}><label>{label}</label><input type="number" value={t[k] ?? ""} onChange={(e) => setT({ ...t, [k]: e.target.value === "" ? "" : Number(e.target.value) })} /></div>)}
        <div><label>Garantie travaux par défaut (mois)</label><input type="number" value={g} onChange={(e) => setG(Number(e.target.value) || 0)} /></div>
      </div>
      <p style={{ color: "var(--ink3)", fontSize: 12.5, margin: "10px 0" }}>Ces tarifs servent de repère quand vous répondez à une demande. Vous les modifiez librement à chaque devis.</p>
      <div className="act"><button type="button" className="btn" onClick={() => void save()}>Enregistrer</button></div>
    </div>
  );
}

/* ------------------------------ Devis ------------------------------ */
function DevisDrawer({ dem, tarifs, garantieDefaut, onClose, onDone }: { dem: PrestaDemande | null; tarifs: Record<string, number>; garantieDefaut: number; onClose: () => void; onDone: () => void }) {
  const [lignes, setLignes] = useState<LigneHT[]>([]);
  const [delai, setDelai] = useState("4");
  const [debut, setDebut] = useState("");
  const [validite, setValidite] = useState("15");
  const [garantie, setGarantie] = useState(String(garantieDefaut));
  const [cabine, setCabine] = useState(true);
  const [courtoisie, setCourtoisie] = useState(false);
  const [comm, setComm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dem) return;
    setLignes(dem.lignes?.length ? dem.lignes : dem.dommages.map((x) => ({ label: x, type: "Main d’œuvre", qte: 1, prix_ht: 0 })));
    setDelai(String(dem.delai_jours ?? 4)); setDebut(dem.debut_possible ?? ""); setValidite(String(dem.validite_jours ?? 15));
    setGarantie(String(dem.garantie_mois ?? garantieDefaut)); setCabine(dem.statut === "recu" ? dem.peinture_cabine : true); setCourtoisie(dem.courtoisie); setComm(dem.commentaire ?? "");
  }, [dem, garantieDefaut]);

  const ht = lignes.reduce((s, l) => s + Number(l.qte || 1) * Number(l.prix_ht || 0), 0);
  const upd = (i: number, k: keyof LigneHT, v: string) => setLignes(lignes.map((l, j) => (j === i ? { ...l, [k]: k === "qte" || k === "prix_ht" ? Number(v) : v } : l)));
  const send = async () => {
    if (!dem) return;
    setBusy(true);
    const { error } = await rdb.rpc("remarketing_presta_envoyer_devis", {
      p_devis: dem.devis_id,
      p_payload: { lignes, delai_jours: delai, debut_possible: debut || null, validite_jours: validite, garantie_mois: garantie, peinture_cabine: cabine, courtoisie, commentaire: comm || null },
    });
    setBusy(false);
    if (error) { toast.error("Envoi impossible", { description: errText(error) }); return; }
    toast.success("Devis envoyé à Ligneo et au client"); onDone();
  };

  return (
    <Overlay open={!!dem} onClose={onClose} kind="drawer" wide>
      {dem && (
        <>
          <div className="h"><span className="vt" style={{ background: "rgba(255,255,255,.2)", color: "#fff", margin: 0 }}><Car /></span><h2>Répondre · {dem.modele} · {dem.immatriculation}</h2>{dem.date_limite && <span className="pill w">Reste {hoursLeft(dem.date_limite)}</span>}<button type="button" className="x" onClick={onClose}>×</button></div>
          <div className="b">
            <div className="sec"><h3><i>1</i>La demande</h3>
              <div className="kv"><div><small>Motif</small><b>{MOTIFS[dem.motif] ?? dem.motif}</b></div><div><small>Kilométrage</small><b>{dem.kilometrage ? `${dem.kilometrage.toLocaleString("fr-FR")} km` : "—"}</b></div><div><small>Lieu du véhicule</small><b>{dem.lieu ?? "—"}</b></div><div><small>Transport</small><b>Convoyeur Ligneo, à notre charge</b></div></div>
              <div className="dmg" style={{ marginTop: 12 }}>{dem.dommages.map((x) => <span key={x}>{x}</span>)}</div>
              {dem.remarques && <p style={{ fontSize: 12.5, color: "var(--ink3)" }}>Commentaire du client : « {dem.remarques} »</p>}
            </div>

            <div className="sec"><h3><i>2</i>Votre devis</h3>
              <div className="f">
                <div className="qlh"><span>Désignation</span><span>Type</span><span>Qté</span><span>Prix HT</span><span /></div>
                {lignes.map((l, i) => (
                  <div className="ql" key={i}>
                    <input value={l.label} onChange={(e) => upd(i, "label", e.target.value)} />
                    <select value={l.type} onChange={(e) => upd(i, "type", e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                    <input type="number" min={1} value={l.qte} onChange={(e) => upd(i, "qte", e.target.value)} />
                    <input type="number" step="0.01" min={0} value={l.prix_ht} onChange={(e) => upd(i, "prix_ht", e.target.value)} />
                    <button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
                <button type="button" className="btn o s" style={{ justifySelf: "start" }} onClick={() => setLignes([...lignes, { label: "", type: "Main d’œuvre", qte: 1, prix_ht: 0 }])}>+ Ajouter une ligne</button>
                {tarifs.taux_horaire ? <p className="sv2">Rappel de vos tarifs : {tarifs.taux_horaire} € HT / h{tarifs.peinture_element ? ` · peinture ${tarifs.peinture_element} €` : ""}{tarifs.jante ? ` · jante ${tarifs.jante} €` : ""}{tarifs.polissage ? ` · polissage ${tarifs.polissage} €` : ""}</p> : null}
                <div className="tots">
                  <div className="ln"><span>Total HT</span><span>{eur2(ht)}</span></div>
                  <div className="ln"><span>TVA 20 %</span><span>{eur2(ht * 0.2)}</span></div>
                  <div className="ln g"><span>Total TTC</span><span>{eur2(ht * 1.2)}</span></div>
                </div>
              </div>
            </div>

            <div className="sec"><h3><i>3</i>Délai et conditions</h3>
              <div className="f">
                <div className="r2"><div><label>Date de début possible</label><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} /></div><div><label>Durée des travaux (jours)</label><input type="number" min={1} value={delai} onChange={(e) => setDelai(e.target.value)} /></div></div>
                <div className="r2"><div><label>Validité du devis (jours)</label><input type="number" min={1} value={validite} onChange={(e) => setValidite(e.target.value)} /></div><div><label>Garantie travaux (mois)</label><input type="number" min={0} value={garantie} onChange={(e) => setGarantie(e.target.value)} /></div></div>
                <div className="chk">
                  <label><input type="checkbox" checked={cabine} onChange={(e) => setCabine(e.target.checked)} /> Peinture en cabine</label>
                  <label><input type="checkbox" checked={courtoisie} onChange={(e) => setCourtoisie(e.target.checked)} /> Véhicule de courtoisie disponible</label>
                </div>
              </div>
            </div>

            <div className="sec"><h3><i>4</i>Commentaire</h3>
              <div className="f"><div><label>Message pour le client</label><textarea rows={3} value={comm} onChange={(e) => setComm(e.target.value)} placeholder="Précisions sur la réparation, pièces, délais" /></div></div>
            </div>

            <div className="act" style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn o" onClick={onClose}>Fermer</button>
              <button type="button" className="btn g" disabled={busy || ht <= 0} onClick={() => void send()}>{busy ? "Envoi…" : dem.statut === "recu" ? "Mettre à jour le devis" : "Envoyer le devis"}</button>
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
}
