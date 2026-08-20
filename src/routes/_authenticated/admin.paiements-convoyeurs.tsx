import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Wallet, Users, AlertTriangle, CalendarClock, FileDown, Banknote,
  Gavel, Settings2, Plus, Check, X, Search, Pencil, Trash2,
} from "lucide-react";
import {
  PageHeader, Card, KpiCard, Badge, Button, EmptyState, Select, SearchInput,
  Table, THead, TH, TR, TD, Modal, TextInput, FormField,
} from "@/components/admin/AdminUI";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { ConvoyeurFinancesPanel } from "@/components/admin/finances/ConvoyeurFinancesPanel";
import { RemunerationDetailModal } from "@/components/admin/finances/RemunerationDetailModal";
import { EcheancierPaiements } from "@/components/admin/finances/EcheancierPaiements";
import {
  REMU_STATUT_LABEL, REMU_STATUT_TONE, PAIEMENT_STATUT_LABEL, PAIEMENT_STATUT_TONE,
  AJUSTEMENT_LABEL, eur, dateFr, toCsv, downloadFile, buildSepaXml,
  type Ajustement, type CatalogPenalite, type PaiementConvoyeur, type RegleRemuneration,
  type Remuneration, type PaiementStatut,
} from "@/lib/finances-convoyeurs";

export const Route = createFileRoute("/_authenticated/admin/paiements-convoyeurs")({
  component: AdminPaiementsConvoyeurs,
  head: () => ({
    meta: [
      { title: "Paiements convoyeurs — Administration Transports Ligneo" },
      { name: "description", content: "Calcul, validation et virement des rémunérations convoyeurs." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type Tab = "overview" | "echeancier" | "apayer" | "lots" | "penalites" | "reglages";

interface ConvoyeurRow {
  id: string; nom: string | null; prenom: string | null;
  iban: string | null; bic: string | null; titulaire_compte: string | null;
}

function AdminPaiementsConvoyeurs() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [remus, setRemus] = useState<Remuneration[]>([]);
  const [ajust, setAjust] = useState<Ajustement[]>([]);
  const [paiements, setPaiements] = useState<PaiementConvoyeur[]>([]);
  const [convoyeurs, setConvoyeurs] = useState<ConvoyeurRow[]>([]);
  const [penalites, setPenalites] = useState<CatalogPenalite[]>([]);
  const [regles, setRegles] = useState<RegleRemuneration[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ficheConvoyeur, setFicheConvoyeur] = useState<ConvoyeurRow | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [statutFilter, setStatutFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, pRes, cRes, penRes, regRes] = await Promise.all([
      supabase.from("remunerations_missions").select("*").order("date_mission", { ascending: false }),
      supabase.from("paiements_convoyeurs").select("*").order("created_at", { ascending: false }),
      supabase.from("convoyeurs").select("id, nom, prenom, iban, bic, titulaire_compte"),
      supabase.from("catalogue_penalites").select("*").order("libelle"),
      supabase.from("regles_remuneration").select("*").order("priorite", { ascending: false }),
    ]);
    const list = (rRes.data ?? []) as unknown as Remuneration[];
    setRemus(list);
    setPaiements((pRes.data ?? []) as unknown as PaiementConvoyeur[]);
    setConvoyeurs((cRes.data ?? []) as unknown as ConvoyeurRow[]);
    setPenalites((penRes.data ?? []) as unknown as CatalogPenalite[]);
    setRegles((regRes.data ?? []) as unknown as RegleRemuneration[]);
    if (list.length) {
      const { data: aj } = await supabase
        .from("remuneration_ajustements").select("*").in("remuneration_id", list.map((r) => r.id));
      setAjust((aj ?? []) as unknown as Ajustement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const convName = useCallback(
    (id: string | null) => {
      const c = convoyeurs.find((x) => x.id === id);
      return c ? `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Convoyeur" : "Non attribué";
    },
    [convoyeurs],
  );

  /* ---------- Agrégats ---------- */
  const duesByConvoyeur = useMemo(() => {
    const map = new Map<string, { conv: ConvoyeurRow | undefined; remus: Remuneration[]; total: number; oldest: string | null }>();
    for (const r of remus) {
      if (!r.convoyeur_id) continue;
      if (!["en_attente", "valide"].includes(r.statut)) continue;
      if (r.paiement_id) continue;
      const e = map.get(r.convoyeur_id) ?? {
        conv: convoyeurs.find((c) => c.id === r.convoyeur_id), remus: [], total: 0, oldest: null,
      };
      e.remus.push(r);
      e.total += Number(r.montant_total);
      if (r.date_mission && (!e.oldest || r.date_mission < e.oldest)) e.oldest = r.date_mission;
      map.set(r.convoyeur_id, e);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ convoyeurId: id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [remus, convoyeurs]);

  const totalDu = duesByConvoyeur.reduce((s, x) => s + x.total, 0);
  const aValider = remus.filter((r) => r.statut === "a_valider");
  const enLitige = remus.filter((r) => r.statut === "litige");

  const prochaineEcheance = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); // vendredi suivant
    return d;
  }, []);

  const q = search.trim().toLowerCase();
  const matches = (...vals: (string | null | undefined)[]) =>
    !q || vals.some((v) => (v ?? "").toLowerCase().includes(q));

  /* ---------- Préparation d'un lot ---------- */
  const selectedRows = duesByConvoyeur.filter((d) => selected.has(d.convoyeurId));
  const selectedTotal = selectedRows.reduce((s, x) => s + x.total, 0);

  async function creerLots() {
    if (!selectedRows.length) return;
    const { data: userData } = await supabase.auth.getUser();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let i = 0;
    for (const row of selectedRows) {
      i += 1;
      const dates = row.remus.map((r) => r.date_mission).filter(Boolean).sort() as string[];
      const { data: pay, error } = await supabase
        .from("paiements_convoyeurs")
        .insert({
          numero: `PAY-${stamp}-${String(i).padStart(2, "0")}`,
          convoyeur_id: row.convoyeurId,
          montant_total: Math.round(row.total * 100) / 100,
          nb_missions: row.remus.length,
          methode: "virement",
          statut: "prepare",
          periode_debut: dates[0] ?? null,
          periode_fin: dates[dates.length - 1] ?? null,
          created_by: userData.user?.id ?? null,
        })
        .select("id")
        .maybeSingle();
      if (error || !pay) { toast.error(error?.message ?? "Erreur lot"); continue; }
      const { error: upErr } = await supabase
        .from("remunerations_missions")
        .update({ paiement_id: pay.id, statut: "valide" })
        .in("id", row.remus.map((r) => r.id));
      if (upErr) toast.error(upErr.message);
    }
    toast.success(`${selectedRows.length} lot(s) de paiement préparé(s)`);
    setSelected(new Set());
    setPrepOpen(false);
    await load();
  }

  function exportLotCsv() {
    const rows = selectedRows.flatMap((row) =>
      row.remus.map((r) => ({
        convoyeur: convName(row.convoyeurId),
        iban: row.conv?.iban ?? "",
        mission: r.numero_mission ?? "",
        date: r.date_mission ?? "",
        montant: Number(r.montant_total).toFixed(2),
      })),
    );
    downloadFile(toCsv(rows, ["convoyeur", "iban", "mission", "date", "montant"]), `lot-paiement-${Date.now()}.csv`);
  }

  async function exportSepa() {
    const { data: cs } = await supabase
      .from("company_settings").select("raison_sociale, iban, bic").limit(1).maybeSingle();
    const sansIban = selectedRows.filter((r) => !r.conv?.iban);
    if (!cs?.iban) return toast.error("IBAN de la Société manquant (Informations légales)");
    if (sansIban.length) return toast.error(`IBAN manquant pour : ${sansIban.map((r) => convName(r.convoyeurId)).join(", ")}`);
    const xml = buildSepaXml({
      debiteurNom: cs.raison_sociale ?? "Transports Ligneo",
      debiteurIban: cs.iban,
      debiteurBic: cs.bic ?? undefined,
      executionDate: new Date().toISOString().slice(0, 10),
      lignes: selectedRows.map((r) => ({
        nom: r.conv?.titulaire_compte || convName(r.convoyeurId),
        iban: r.conv!.iban!,
        bic: r.conv?.bic,
        montant: Math.round(r.total * 100) / 100,
        libelle: `Ligneo - ${r.remus.length} mission(s)`,
      })),
    });
    downloadFile(xml, `virements-sepa-${Date.now()}.xml`, "application/xml");
  }

  async function setPaiementStatut(p: PaiementConvoyeur, statut: PaiementStatut) {
    const patch: Record<string, unknown> = { statut };
    if (statut === "confirme") patch.date_execution = new Date().toISOString();
    const { error } = await supabase.from("paiements_convoyeurs").update(patch as never).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (statut === "confirme") {
      await supabase.from("remunerations_missions").update({ statut: "paye" }).eq("paiement_id", p.id);
    }
    if (statut === "annule") {
      await supabase.from("remunerations_missions")
        .update({ paiement_id: null, statut: "valide" }).eq("paiement_id", p.id);
    }
    toast.success(`Paiement ${PAIEMENT_STATUT_LABEL[statut].toLowerCase()}`);
    await load();
  }

  function exportComptable() {
    const rows = remus.map((r) => ({
      mission: r.numero_mission ?? "",
      convoyeur: convName(r.convoyeur_id),
      date_mission: r.date_mission ?? "",
      base_ht: Number(r.montant_base).toFixed(2),
      ajustements: Number(r.total_ajustements).toFixed(2),
      total_ht: Number(r.montant_total).toFixed(2),
      statut: REMU_STATUT_LABEL[r.statut],
      paiement: paiements.find((p) => p.id === r.paiement_id)?.numero ?? "",
      date_paiement: paiements.find((p) => p.id === r.paiement_id)?.date_execution?.slice(0, 10) ?? "",
    }));
    downloadFile(
      toCsv(rows, ["mission", "convoyeur", "date_mission", "base_ht", "ajustements", "total_ht", "statut", "paiement", "date_paiement"]),
      `export-comptable-remunerations-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  const penalitesAppliquees = ajust.filter((a) => a.categorie === "penalite");

  if (loading) {
    return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-pro-muted" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements convoyeurs"
        subtitle="Rémunérations calculées, ajustements tracés, lots de virement et export comptable."
        actions={
          <Button variant="secondary" onClick={exportComptable}>
            <FileDown size={14} /> Export comptable
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {([
          ["overview", "Vue d'ensemble"],
          ["echeancier", "Par convoyeur"],
          ["apayer", `À payer (${duesByConvoyeur.length})`],
          ["lots", `Paiements (${paiements.length})`],
          ["penalites", `Pénalités (${penalitesAppliquees.filter((a) => !a.annule).length})`],
          ["reglages", "Règles & catalogue"],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
              tab === k ? "admin-btn-blue text-white border-transparent" : "bg-white border-pro-border text-pro-text-soft hover:bg-pro-bg-soft"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto w-full sm:w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="Mission, convoyeur, motif…" />
        </div>
      </div>

      {tab === "echeancier" && <EcheancierPaiements />}

      {tab === "overview" && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-4 gap-4">
            <KpiCard label="Total dû aux convoyeurs" value={eur(totalDu)} icon={Wallet} tone="primary" />
            <KpiCard label="Convoyeurs à payer" value={duesByConvoyeur.length} icon={Users} />
            <KpiCard
              label="À valider manuellement"
              value={aValider.length}
              icon={AlertTriangle}
              tone={aValider.length ? "warning" : "default"}
              hint="Aucune règle applicable"
            />
            <KpiCard
              label="Prochaine échéance"
              value={prochaineEcheance.toLocaleDateString("fr-FR")}
              icon={CalendarClock}
              hint="Rythme hebdomadaire (vendredi)"
            />
          </div>

          {aValider.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-pro-text mb-3">
                File de validation manuelle ({aValider.length})
              </h3>
              <Table>
                <THead><TH>Mission</TH><TH>Convoyeur</TH><TH>Date</TH><TH>Motif</TH></THead>
                <tbody>
                  {aValider.map((r) => (
                    <TR key={r.id} onClick={() => setDetailId(r.id)}>
                      <TD>{r.numero_mission ?? "—"}</TD>
                      <TD>{convName(r.convoyeur_id)}</TD>
                      <TD>{dateFr(r.date_mission)}</TD>
                      <TD>Aucune règle de rémunération applicable</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {enLitige.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-pro-text mb-3">Rémunérations en litige ({enLitige.length})</h3>
              <ul className="text-sm space-y-1">
                {enLitige.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <button className="text-pro-accent hover:underline" onClick={() => setDetailId(r.id)}>
                      {r.numero_mission} — {convName(r.convoyeur_id)}
                    </button>
                    <span>{eur(r.montant_total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "apayer" && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              disabled={!selectedRows.length}
              onClick={() => setPrepOpen(true)}
            >
              <Banknote size={14} /> Préparer le paiement ({selectedRows.length})
            </Button>
            <span className="text-sm text-pro-muted">Sélection : {eur(selectedTotal)}</span>
          </div>
          {duesByConvoyeur.length === 0 ? (
            <EmptyState title="Aucune rémunération en attente de paiement" />
          ) : (
            <Table>
              <THead>
                <TH>
                  <input
                    type="checkbox"
                    checked={selected.size === duesByConvoyeur.length && selected.size > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(duesByConvoyeur.map((d) => d.convoyeurId)) : new Set())
                    }
                  />
                </TH>
                <TH>Convoyeur</TH>
                <TH>Missions</TH>
                <TH>Plus ancienne</TH>
                <TH>Montant dû</TH>
                <TH>IBAN</TH>
                <TH> </TH>
              </THead>
              <tbody>
                {duesByConvoyeur
                  .filter((d) => matches(convName(d.convoyeurId)))
                  .map((d) => (
                    <TR key={d.convoyeurId}>
                      <TD>
                        <input
                          type="checkbox"
                          checked={selected.has(d.convoyeurId)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(d.convoyeurId); else next.delete(d.convoyeurId);
                            setSelected(next);
                          }}
                        />
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-2">
                          <DriverAvatar convoyeurId={d.convoyeurId} name={convName(d.convoyeurId)} size="sm" />
                          {convName(d.convoyeurId)}
                        </span>
                      </TD>
                      <TD>{d.remus.length}</TD>
                      <TD>{dateFr(d.oldest)}</TD>
                      <TD><strong>{eur(d.total)}</strong></TD>
                      <TD>
                        {d.conv?.iban
                          ? <Badge tone="success">Renseigné</Badge>
                          : <Badge tone="danger">Manquant</Badge>}
                      </TD>
                      <TD>
                        <Button size="sm" variant="secondary" onClick={() => setFicheConvoyeur(d.conv ?? null)}>
                          Fiche finances
                        </Button>
                      </TD>
                    </TR>
                  ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "lots" && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(PAIEMENT_STATUT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          {paiements.length === 0 ? (
            <EmptyState title="Aucun paiement enregistré" description="Préparez un lot depuis l'onglet « À payer »." />
          ) : (
            <Table>
              <THead>
                <TH>Référence</TH><TH>Convoyeur</TH><TH>Période</TH><TH>Missions</TH>
                <TH>Montant</TH><TH>Statut</TH><TH>Actions</TH>
              </THead>
              <tbody>
                {paiements
                  .filter((p) => !statutFilter || p.statut === statutFilter)
                  .filter((p) => matches(p.numero, convName(p.convoyeur_id), p.reference_bancaire))
                  .map((p) => (
                    <TR key={p.id}>
                      <TD>{p.numero ?? "—"}</TD>
                      <TD>{convName(p.convoyeur_id)}</TD>
                      <TD>{dateFr(p.periode_debut)} → {dateFr(p.periode_fin)}</TD>
                      <TD>{p.nb_missions}</TD>
                      <TD><strong>{eur(p.montant_total)}</strong></TD>
                      <TD><Badge tone={PAIEMENT_STATUT_TONE[p.statut]}>{PAIEMENT_STATUT_LABEL[p.statut]}</Badge></TD>
                      <TD>
                        <div className="flex gap-1">
                          {p.statut === "prepare" && (
                            <Button size="sm" variant="secondary" onClick={() => void setPaiementStatut(p, "envoye")}>Envoyé</Button>
                          )}
                          {(p.statut === "prepare" || p.statut === "envoye") && (
                            <>
                              <Button size="sm" onClick={() => void setPaiementStatut(p, "confirme")}>
                                <Check size={13} /> Confirmer
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => void setPaiementStatut(p, "annule")}>
                                <X size={13} />
                              </Button>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "penalites" && (
        <Card>
          <h3 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-2">
            <Gavel size={15} /> Toutes les pénalités et ajustements
          </h3>
          {ajust.length === 0 ? (
            <EmptyState title="Aucun ajustement appliqué" />
          ) : (
            <Table>
              <THead>
                <TH>Date</TH><TH>Type</TH><TH>Libellé</TH><TH>Convoyeur</TH>
                <TH>Motif</TH><TH>Article</TH><TH>Montant</TH><TH>État</TH>
              </THead>
              <tbody>
                {ajust
                  .filter((a) => {
                    const r = remus.find((x) => x.id === a.remuneration_id);
                    return matches(a.libelle, a.motif, r?.numero_mission, convName(r?.convoyeur_id ?? null));
                  })
                  .map((a) => {
                    const r = remus.find((x) => x.id === a.remuneration_id);
                    return (
                      <TR key={a.id} onClick={() => setDetailId(a.remuneration_id)}>
                        <TD>{dateFr(a.created_at)}</TD>
                        <TD>{AJUSTEMENT_LABEL[a.categorie]}</TD>
                        <TD>{a.libelle}</TD>
                        <TD>{convName(r?.convoyeur_id ?? null)}</TD>
                        <TD>{a.motif}</TD>
                        <TD>{a.article_reference ?? "—"}</TD>
                        <TD>
                          <span className={Number(a.montant) < 0 ? "text-red-600 font-medium" : "font-medium"}>
                            {eur(a.montant)}
                          </span>
                        </TD>
                        <TD>
                          {a.annule
                            ? <Badge tone="neutral">Annulé</Badge>
                            : <Badge tone="success">Actif</Badge>}
                        </TD>
                      </TR>
                    );
                  })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "reglages" && (
        <ReglagesTab regles={regles} penalites={penalites} onChanged={() => void load()} />
      )}

      {/* Préparation de lot */}
      <Modal open={prepOpen} onClose={() => setPrepOpen(false)} title="Préparer un lot de paiement" size="lg">
        <div className="space-y-4">
          <Table>
            <THead><TH>Convoyeur</TH><TH>Missions</TH><TH>Montant</TH><TH>IBAN</TH></THead>
            <tbody>
              {selectedRows.map((r) => (
                <TR key={r.convoyeurId}>
                  <TD>{convName(r.convoyeurId)}</TD>
                  <TD>{r.remus.length}</TD>
                  <TD>{eur(r.total)}</TD>
                  <TD>{r.conv?.iban ? "OK" : <span className="text-red-600">Manquant</span>}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <p className="text-sm text-pro-text">
            Total du lot : <strong>{eur(selectedTotal)}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void creerLots()}><Banknote size={14} /> Créer les lots</Button>
            <Button variant="secondary" onClick={exportLotCsv}><FileDown size={14} /> Export CSV</Button>
            <Button variant="secondary" onClick={() => void exportSepa()}><FileDown size={14} /> Export SEPA (XML)</Button>
          </div>
        </div>
      </Modal>

      {/* Fiche financière convoyeur */}
      <Modal
        open={!!ficheConvoyeur}
        onClose={() => setFicheConvoyeur(null)}
        title={`Finances — ${ficheConvoyeur ? `${ficheConvoyeur.prenom ?? ""} ${ficheConvoyeur.nom ?? ""}`.trim() : ""}`}
        size="xl"
      >
        {ficheConvoyeur && (
          <ConvoyeurFinancesPanel
            convoyeurId={ficheConvoyeur.id}
            nom={`${ficheConvoyeur.prenom ?? ""} ${ficheConvoyeur.nom ?? ""}`.trim()}
          />
        )}
      </Modal>

      <RemunerationDetailModal
        remunerationId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

/* ================= Règles & catalogue ================= */
function ReglagesTab({
  regles, penalites, onChanged,
}: { regles: RegleRemuneration[]; penalites: CatalogPenalite[]; onChanged: () => void }) {
  const [openRegle, setOpenRegle] = useState(false);
  const [openPen, setOpenPen] = useState(false);
  const [rf, setRf] = useState({ libelle: "", type_regle: "forfait_km", montant_forfait: "", taux_km: "", seuil_km: "", montant_min: "", cond_type_mission: "", priorite: "0", date_debut: new Date().toISOString().slice(0, 10) });
  const emptyPf = { id: "", libelle: "", type_montant: "forfait", valeur: "", article_reference: "", description: "" };
  const [pf, setPf] = useState(emptyPf);

  function openNewPenalite() {
    setPf(emptyPf);
    setOpenPen(true);
  }

  function openEditPenalite(p: CatalogPenalite) {
    setPf({
      id: p.id,
      libelle: p.libelle,
      type_montant: p.type_montant,
      valeur: String(p.valeur ?? ""),
      article_reference: p.article_reference ?? "",
      description: p.description ?? "",
    });
    setOpenPen(true);
  }

  async function deletePenalite(p: CatalogPenalite) {
    if (!window.confirm(`Supprimer définitivement la pénalité « ${p.libelle} » ?`)) return;
    const { error } = await supabase.from("catalogue_penalites").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pénalité supprimée");
    onChanged();
  }

  async function saveRegle() {
    if (!rf.libelle.trim()) return toast.error("Libellé requis");
    const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")));
    const { error } = await supabase.from("regles_remuneration").insert({
      libelle: rf.libelle.trim(),
      type_regle: rf.type_regle,
      montant_forfait: num(rf.montant_forfait),
      taux_km: num(rf.taux_km),
      seuil_km: num(rf.seuil_km),
      montant_min: rf.montant_min.trim() ? num(rf.montant_min) : null,
      cond_type_mission: rf.cond_type_mission.trim() || null,
      priorite: Math.round(num(rf.priorite)),
      date_debut: rf.date_debut,
    });
    if (error) return toast.error(error.message);
    toast.success("Règle créée");
    setOpenRegle(false);
    onChanged();
  }

  async function savePenalite() {
    if (!pf.libelle.trim()) return toast.error("Libellé requis");
    const payload = {
      libelle: pf.libelle.trim(),
      type_montant: pf.type_montant,
      valeur: Number(String(pf.valeur).replace(",", ".") || 0),
      article_reference: pf.article_reference.trim() || null,
      description: pf.description.trim() || null,
    };
    const { error } = pf.id
      ? await supabase.from("catalogue_penalites").update(payload).eq("id", pf.id)
      : await supabase.from("catalogue_penalites").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(pf.id ? "Pénalité mise à jour" : "Pénalité ajoutée au catalogue");
    setOpenPen(false);
    setPf(emptyPf);
    onChanged();
  }

  async function toggle(table: "regles_remuneration" | "catalogue_penalites", id: string, actif: boolean) {
    const { error } = await supabase.from(table).update({ actif: !actif }).eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-pro-text flex items-center gap-2">
            <Settings2 size={15} /> Règles de rémunération
          </h3>
          <Button size="sm" onClick={() => setOpenRegle(true)}><Plus size={13} /> Nouvelle règle</Button>
        </div>
        {regles.length === 0 ? (
          <EmptyState
            title="Aucune règle de rémunération"
            description="Sans règle active, les missions terminées sans prix négocié partent en validation manuelle."
          />
        ) : (
          <Table>
            <THead>
              <TH>Libellé</TH><TH>Type</TH><TH>Paramètres</TH><TH>Validité</TH><TH>Priorité</TH><TH>État</TH>
            </THead>
            <tbody>
              {regles.map((r) => (
                <TR key={r.id}>
                  <TD>{r.libelle}</TD>
                  <TD>{r.type_regle}</TD>
                  <TD className="text-xs">
                    {r.montant_forfait ? `Forfait ${eur(r.montant_forfait)} · ` : ""}
                    {r.taux_km ? `${r.taux_km} €/km` : ""}
                    {r.seuil_km ? ` au-delà de ${r.seuil_km} km` : ""}
                    {r.montant_min ? ` · mini ${eur(r.montant_min)}` : ""}
                  </TD>
                  <TD className="text-xs">{dateFr(r.date_debut)} → {r.date_fin ? dateFr(r.date_fin) : "—"}</TD>
                  <TD>{r.priorite}</TD>
                  <TD>
                    <button onClick={() => void toggle("regles_remuneration", r.id, r.actif)}>
                      <Badge tone={r.actif ? "success" : "neutral"}>{r.actif ? "Active" : "Inactive"}</Badge>
                    </button>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-pro-text flex items-center gap-2">
            <Gavel size={15} /> Catalogue de pénalités
          </h3>
          <Button size="sm" onClick={openNewPenalite}><Plus size={13} /> Nouvelle pénalité</Button>
        </div>
        {penalites.length === 0 ? (
          <EmptyState title="Catalogue vide" description="Ajoutez vos pénalités contractuelles pour les appliquer aux rémunérations." />
        ) : (
        <Table>
          <THead><TH>Libellé</TH><TH>Montant</TH><TH>Article de référence</TH><TH>Description</TH><TH>État</TH><TH>Actions</TH></THead>
          <tbody>
            {penalites.map((p) => (
              <TR key={p.id}>
                <TD>{p.libelle}</TD>
                <TD>{p.type_montant === "pourcentage" ? `${p.valeur} %` : eur(p.valeur)}</TD>
                <TD className="text-xs">{p.article_reference ?? "—"}</TD>
                <TD className="text-xs max-w-[280px] truncate">{p.description ?? "—"}</TD>
                <TD>
                  <button onClick={() => void toggle("catalogue_penalites", p.id, p.actif)} title="Activer / désactiver">
                    <Badge tone={p.actif ? "success" : "neutral"}>{p.actif ? "Active" : "Inactive"}</Badge>
                  </button>
                </TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEditPenalite(p)} title="Modifier">
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void deletePenalite(p)} title="Supprimer">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
        )}
      </Card>

      <Modal open={openRegle} onClose={() => setOpenRegle(false)} title="Nouvelle règle de rémunération" size="lg">
        <div className="grid sm:grid-cols-2 gap-3">
          <FormField label="Libellé" required>
            <TextInput value={rf.libelle} onChange={(e) => setRf({ ...rf, libelle: e.target.value })} />
          </FormField>
          <FormField label="Type">
            <Select value={rf.type_regle} onChange={(e) => setRf({ ...rf, type_regle: e.target.value })} className="w-full">
              <option value="forfait">Forfait par mission</option>
              <option value="km">Au kilomètre</option>
              <option value="forfait_km">Forfait + km au-delà d'un seuil</option>
            </Select>
          </FormField>
          <FormField label="Forfait (€)">
            <TextInput value={rf.montant_forfait} onChange={(e) => setRf({ ...rf, montant_forfait: e.target.value })} />
          </FormField>
          <FormField label="Taux au km (€)">
            <TextInput value={rf.taux_km} onChange={(e) => setRf({ ...rf, taux_km: e.target.value })} />
          </FormField>
          <FormField label="Seuil km">
            <TextInput value={rf.seuil_km} onChange={(e) => setRf({ ...rf, seuil_km: e.target.value })} />
          </FormField>
          <FormField label="Montant minimum (€)">
            <TextInput value={rf.montant_min} onChange={(e) => setRf({ ...rf, montant_min: e.target.value })} />
          </FormField>
          <FormField label="Type de mission (optionnel)">
            <TextInput value={rf.cond_type_mission} onChange={(e) => setRf({ ...rf, cond_type_mission: e.target.value })} placeholder="ex. recharge_seule" />
          </FormField>
          <FormField label="Priorité">
            <TextInput value={rf.priorite} onChange={(e) => setRf({ ...rf, priorite: e.target.value })} />
          </FormField>
          <FormField label="Date de début">
            <TextInput type="date" value={rf.date_debut} onChange={(e) => setRf({ ...rf, date_debut: e.target.value })} />
          </FormField>
        </div>
        <div className="mt-4">
          <Button onClick={() => void saveRegle()}>Créer la règle</Button>
        </div>
      </Modal>

      <Modal open={openPen} onClose={() => setOpenPen(false)} title="Nouvelle pénalité" size="md">
        <div className="space-y-3">
          <FormField label="Libellé" required>
            <TextInput value={pf.libelle} onChange={(e) => setPf({ ...pf, libelle: e.target.value })} />
          </FormField>
          <FormField label="Type de montant">
            <Select value={pf.type_montant} onChange={(e) => setPf({ ...pf, type_montant: e.target.value })} className="w-full">
              <option value="forfait">Forfait fixe (€)</option>
              <option value="pourcentage">Pourcentage de la rémunération</option>
            </Select>
          </FormField>
          <FormField label="Valeur">
            <TextInput value={pf.valeur} onChange={(e) => setPf({ ...pf, valeur: e.target.value })} />
          </FormField>
          <FormField label="Article de référence (contrat / charte)">
            <TextInput value={pf.article_reference} onChange={(e) => setPf({ ...pf, article_reference: e.target.value })} />
          </FormField>
          <FormField label="Description">
            <TextInput value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} />
          </FormField>
          <Button onClick={() => void savePenalite()}>Ajouter au catalogue</Button>
        </div>
      </Modal>
    </div>
  );
}
