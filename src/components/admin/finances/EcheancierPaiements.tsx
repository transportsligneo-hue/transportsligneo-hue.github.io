import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Flame,
  Loader2, Wallet, FileDown,
} from "lucide-react";
import {
  Card, KpiCard, Badge, Button, EmptyState, Select, SearchInput, TextInput,
  Table, THead, TH, TR, TD, Modal, FormField,
} from "@/components/admin/AdminUI";
import { DriverAvatar } from "@/components/admin/DriverAvatar";
import { eur, dateFr, toCsv, downloadFile } from "@/lib/finances-convoyeurs";

/* ---------- Types ---------- */

export type DelaiPaiement = "j15" | "j30" | "manuel";
export type EcheanceStatut = "paye" | "a_payer" | "en_retard";

export const DELAI_LABEL: Record<DelaiPaiement, string> = {
  j15: "J+15",
  j30: "J+30",
  manuel: "Manuel",
};

interface RemuRow {
  id: string;
  trajet_id: string;
  convoyeur_id: string | null;
  numero_mission: string | null;
  date_mission: string | null;
  montant_total: number;
  statut: string;
  paiement_id: string | null;
  calcule_at: string;
  delai_paiement: DelaiPaiement;
  echeance_paiement: string | null;
  urgent: boolean;
  paye_manuellement: boolean;
  paye_at: string | null;
  paiement_reference: string | null;
  paiement_note: string | null;
}

interface TrajetRow {
  id: string;
  depart: string | null;
  arrivee: string | null;
  date_trajet: string | null;
  updated_at: string | null;
}

interface ConvRow {
  id: string;
  nom: string | null;
  prenom: string | null;
  email?: string | null;
  telephone?: string | null;
  ville?: string | null;
  statut?: string | null;
  niveau?: string | null;
  delai_paiement_defaut?: string | null;
}

/* ---------- Helpers ---------- */

const todayIso = () => new Date().toISOString().slice(0, 10);

export function echeanceStatut(r: RemuRow): EcheanceStatut {
  if (r.paye_manuellement || r.statut === "paye") return "paye";
  if (r.echeance_paiement && r.echeance_paiement < todayIso()) return "en_retard";
  return "a_payer";
}

const STATUT_LABEL: Record<EcheanceStatut, string> = {
  paye: "Payé",
  a_payer: "À payer",
  en_retard: "En retard",
};
const STATUT_TONE: Record<EcheanceStatut, "success" | "warning" | "danger"> = {
  paye: "success",
  a_payer: "warning",
  en_retard: "danger",
};

function ville(v: string | null) {
  if (!v) return "—";
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || v;
}

/* ---------- Composant principal ---------- */

export function EcheancierPaiements() {
  const [loading, setLoading] = useState(true);
  const [remus, setRemus] = useState<RemuRow[]>([]);
  const [trajets, setTrajets] = useState<Record<string, TrajetRow>>({});
  const [convoyeurs, setConvoyeurs] = useState<ConvRow[]>([]);
  const [search, setSearch] = useState("");
  const [convFilter, setConvFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [delaiFilter, setDelaiFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [payModal, setPayModal] = useState<RemuRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rRes, cRes] = await Promise.all([
      supabase
        .from("remunerations_missions")
        .select(
          "id, trajet_id, convoyeur_id, numero_mission, date_mission, montant_total, statut, paiement_id, calcule_at, delai_paiement, echeance_paiement, urgent, paye_manuellement, paye_at, paiement_reference, paiement_note",
        )
        .order("date_mission", { ascending: false })
        .limit(2000),
      supabase.from("convoyeurs").select("id, nom, prenom, photo_url, delai_paiement_defaut"),
    ]);
    const list = (rRes.data ?? []) as unknown as RemuRow[];
    setRemus(list);
    setConvoyeurs((cRes.data ?? []) as unknown as ConvRow[]);
    const ids = [...new Set(list.map((r) => r.trajet_id).filter(Boolean))];
    if (ids.length) {
      const { data: tj } = await supabase
        .from("trajets")
        .select("id, depart, arrivee, date_trajet, updated_at")
        .in("id", ids);
      const map: Record<string, TrajetRow> = {};
      for (const t of (tj ?? []) as unknown as TrajetRow[]) map[t.id] = t;
      setTrajets(map);
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

  /* ---------- Mise à jour d'une ligne ---------- */
  async function patch(row: RemuRow, values: Partial<RemuRow>) {
    setRemus((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...values } : r)));
    const { data, error } = await supabase
      .from("remunerations_missions")
      .update(values as never)
      .eq("id", row.id)
      .select(
        "id, delai_paiement, echeance_paiement, urgent, paye_manuellement, paye_at, paiement_reference, paiement_note, statut",
      )
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      await load();
      return;
    }
    if (data) {
      const fresh = data as unknown as Partial<RemuRow>;
      setRemus((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...fresh } : r)));
    }

  }

  /* ---------- Filtres ---------- */
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return remus.filter((r) => {
      if (convFilter && r.convoyeur_id !== convFilter) return false;
      if (delaiFilter && r.delai_paiement !== delaiFilter) return false;
      if (statutFilter && echeanceStatut(r) !== statutFilter) return false;
      const d = r.date_mission ?? r.calcule_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (q) {
        const t = trajets[r.trajet_id];
        const hay = [r.numero_mission, convName(r.convoyeur_id), t?.depart, t?.arrivee]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [remus, convFilter, delaiFilter, statutFilter, from, to, q, trajets, convName]);

  const sortRows = useCallback((rows: RemuRow[]) => {
    const rank = (r: RemuRow) => {
      const s = echeanceStatut(r);
      if (r.urgent && s !== "paye") return 0;
      if (s === "en_retard") return 1;
      if (s === "a_payer") return 2;
      return 3;
    };
    return [...rows].sort((a, b) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return (a.echeance_paiement ?? "9999").localeCompare(b.echeance_paiement ?? "9999");
    });
  }, []);

  /* ---------- Vue globale ---------- */
  const month = new Date().toISOString().slice(0, 7);
  const globals = useMemo(() => {
    let duMois = 0, retard = 0, urgentes = 0, totalDu = 0;
    for (const r of remus) {
      const s = echeanceStatut(r);
      if (s === "paye") continue;
      totalDu += Number(r.montant_total);
      if ((r.echeance_paiement ?? "").startsWith(month)) duMois += Number(r.montant_total);
      if (s === "en_retard") retard += 1;
      if (r.urgent) urgentes += 1;
    }
    return { duMois, retard, urgentes, totalDu };
  }, [remus, month]);

  /* ---------- Groupes par convoyeur ---------- */
  const groups = useMemo(() => {
    const map = new Map<string, RemuRow[]>();
    for (const r of filtered) {
      const key = r.convoyeur_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries())
      .map(([id, rows]) => {
        const paye = rows.filter((r) => echeanceStatut(r) === "paye");
        const attente = rows.filter((r) => echeanceStatut(r) !== "paye");
        return {
          id,
          rows: sortRows(rows),
          totalPaye: paye.reduce((s, r) => s + Number(r.montant_total), 0),
          totalAttente: attente.reduce((s, r) => s + Number(r.montant_total), 0),
          nbRetard: rows.filter((r) => echeanceStatut(r) === "en_retard").length,
          nbUrgent: rows.filter((r) => r.urgent && echeanceStatut(r) !== "paye").length,
        };
      })
      .sort((a, b) => b.nbUrgent - a.nbUrgent || b.nbRetard - a.nbRetard || b.totalAttente - a.totalAttente);
  }, [filtered, sortRows]);

  function exportCsv() {
    const rows = sortRows(filtered).map((r) => {
      const t = trajets[r.trajet_id];
      return {
        mission: r.numero_mission ?? "",
        convoyeur: convName(r.convoyeur_id),
        depart: ville(t?.depart ?? null),
        arrivee: ville(t?.arrivee ?? null),
        date_mission: r.date_mission ?? "",
        montant: Number(r.montant_total).toFixed(2),
        delai: DELAI_LABEL[r.delai_paiement],
        echeance: r.echeance_paiement ?? "",
        statut: STATUT_LABEL[echeanceStatut(r)],
        urgent: r.urgent ? "oui" : "",
        paye_le: r.paye_at?.slice(0, 10) ?? "",
        reference: r.paiement_reference ?? "",
      };
    });
    downloadFile(
      toCsv(rows, ["mission", "convoyeur", "depart", "arrivee", "date_mission", "montant", "delai", "echeance", "statut", "urgent", "paye_le", "reference"]),
      `echeancier-convoyeurs-${todayIso()}.csv`,
    );
  }

  if (loading) {
    return <div className="py-24 flex justify-center"><Loader2 className="animate-spin text-pro-muted" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* 7. Vue globale */}
      <div className="grid sm:grid-cols-4 gap-4">
        <KpiCard label="À payer ce mois-ci" value={eur(globals.duMois)} icon={CalendarClock} tone="primary" hint="Échéances du mois en cours" />
        <KpiCard label="Total restant dû" value={eur(globals.totalDu)} icon={Wallet} />
        <KpiCard label="Paiements en retard" value={globals.retard} icon={AlertTriangle} tone={globals.retard ? "danger" : "default"} />
        <KpiCard label="Missions urgentes" value={globals.urgentes} icon={Flame} tone={globals.urgentes ? "warning" : "default"} />
      </div>

      {/* 6. Filtres */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64"><SearchInput value={search} onChange={setSearch} placeholder="Mission, convoyeur, ville…" /></div>
          <Select value={convFilter} onChange={(e) => setConvFilter(e.target.value)}>
            <option value="">Tous les convoyeurs</option>
            {convoyeurs.map((c) => (
              <option key={c.id} value={c.id}>{`${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Convoyeur"}</option>
            ))}
          </Select>
          <Select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="a_payer">À payer</option>
            <option value="en_retard">En retard</option>
            <option value="paye">Payé</option>
          </Select>
          <Select value={delaiFilter} onChange={(e) => setDelaiFilter(e.target.value)}>
            <option value="">Tous les délais</option>
            <option value="j15">J+15</option>
            <option value="j30">J+30</option>
            <option value="manuel">Manuel</option>
          </Select>
          <div className="flex items-center gap-2">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <span className="text-pro-muted text-xs">→</span>
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="secondary" onClick={exportCsv}><FileDown size={14} /> Export</Button>
        </div>
      </Card>

      {/* 1. Vue par convoyeur */}
      {groups.length === 0 ? (
        <EmptyState title="Aucune mission" description="Aucune rémunération ne correspond à ces filtres." />
      ) : (
        groups.map((g) => {
          const isOpen = open.has(g.id);
          const conv = convoyeurs.find((c) => c.id === g.id);
          return (
            <Card key={g.id} padded={false} className="overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => {
                    const n = new Set(prev);
                    n.has(g.id) ? n.delete(g.id) : n.add(g.id);
                    return n;
                  })
                }
                className="w-full flex flex-wrap items-center gap-3 px-4 py-4 text-left hover:bg-pro-bg-soft/60 transition-colors"
              >
                {isOpen ? <ChevronDown size={16} className="text-pro-muted" /> : <ChevronRight size={16} className="text-pro-muted" />}
                <DriverAvatar convoyeurId={g.id === "none" ? null : g.id} name={convName(g.id === "none" ? null : g.id)} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-pro-text truncate">{convName(g.id === "none" ? null : g.id)}</p>
                  <p className="text-[11px] text-pro-muted">{g.rows.length} mission(s)</p>
                </div>
                {/* 5. Totaux par convoyeur */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge tone="success">Payé {eur(g.totalPaye)}</Badge>
                  <Badge tone="warning">En attente {eur(g.totalAttente)}</Badge>
                  {g.nbRetard > 0 && <Badge tone="danger">{g.nbRetard} en retard</Badge>}
                  {g.nbUrgent > 0 && <Badge tone="danger">{g.nbUrgent} urgent(s)</Badge>}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-pro-border">
                  <Table>
                    <THead>
                      <TH>Mission</TH><TH>Trajet</TH><TH>Dates</TH><TH>Montant</TH>
                      <TH>Délai</TH><TH>Échéance</TH><TH>Statut</TH><TH>Payé le</TH><TH>Actions</TH>
                    </THead>
                    <tbody>
                      {g.rows.map((r) => {
                        const st = echeanceStatut(r);
                        const t = trajets[r.trajet_id];
                        return (
                          <TR
                            key={r.id}
                            className={
                              st === "en_retard"
                                ? "bg-red-50/70"
                                : r.urgent && st !== "paye"
                                  ? "bg-amber-50/70"
                                  : ""
                            }
                          >
                            <TD>
                              <div className="flex items-center gap-2">
                                {r.urgent && st !== "paye" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                    <Flame size={10} /> Urgent
                                  </span>
                                )}
                                <span className="font-medium">{r.numero_mission ?? "—"}</span>
                              </div>
                            </TD>
                            <TD className="text-xs text-pro-text-soft">
                              {ville(t?.depart ?? null)} → {ville(t?.arrivee ?? null)}
                            </TD>
                            <TD className="text-xs text-pro-text-soft whitespace-nowrap">
                              {dateFr(r.date_mission ?? t?.date_trajet ?? null)}
                              <br />
                              <span className="text-pro-muted">fin {dateFr((t?.updated_at ?? r.calcule_at)?.slice(0, 10))}</span>
                            </TD>
                            <TD className="font-semibold whitespace-nowrap">{eur(Number(r.montant_total))}</TD>
                            <TD>
                              {/* 2. Règle de paiement */}
                              <Select
                                value={r.delai_paiement}
                                onChange={(e) => void patch(r, { delai_paiement: e.target.value as DelaiPaiement })}
                                className="!py-1 !px-2 text-xs"
                              >
                                <option value="j15">J+15</option>
                                <option value="j30">J+30</option>
                                <option value="manuel">Manuel</option>
                              </Select>
                            </TD>
                            <TD>
                              {r.delai_paiement === "manuel" ? (
                                <TextInput
                                  type="date"
                                  value={r.echeance_paiement ?? ""}
                                  onChange={(e) => void patch(r, { echeance_paiement: e.target.value })}
                                  className="!py-1 !px-2 text-xs w-36"
                                />
                              ) : (
                                <span className={`text-xs font-medium ${st === "en_retard" ? "text-red-600" : "text-pro-text-soft"}`}>
                                  {dateFr(r.echeance_paiement)}
                                </span>
                              )}
                            </TD>
                            <TD><Badge tone={STATUT_TONE[st]}>{STATUT_LABEL[st]}</Badge></TD>
                            <TD className="text-xs text-pro-text-soft whitespace-nowrap">
                              {r.paye_at ? dateFr(r.paye_at.slice(0, 10)) : "—"}
                              {r.paiement_reference ? <><br /><span className="text-pro-muted">{r.paiement_reference}</span></> : null}
                            </TD>
                            <TD>
                              <div className="flex items-center gap-3">
                                {/* 3. Urgent */}
                                <label className="inline-flex items-center gap-1.5 text-[11px] text-pro-text-soft cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={r.urgent}
                                    onChange={(e) => void patch(r, { urgent: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  Urgent
                                </label>
                                {/* 4. Validation manuelle */}
                                {r.paye_manuellement ? (
                                  <button
                                    type="button"
                                    onClick={() => void patch(r, { paye_manuellement: false, paye_at: null })}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                                  >
                                    <CheckCircle2 size={12} /> Payé
                                  </button>
                                ) : (
                                  <Button size="sm" variant="secondary" onClick={() => setPayModal(r)}>
                                    Marquer payé
                                  </Button>
                                )}
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card>
          );
        })
      )}

      {payModal && (
        <PaiementManuelModal
          row={payModal}
          onClose={() => setPayModal(null)}
          onConfirm={async (values) => {
            await patch(payModal, { paye_manuellement: true, paye_at: new Date().toISOString(), ...values });
            toast.success("Paiement enregistré");
            setPayModal(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Modal de validation manuelle ---------- */

function PaiementManuelModal({
  row,
  onClose,
  onConfirm,
}: {
  row: RemuRow;
  onClose: () => void;
  onConfirm: (values: { paiement_reference: string | null; paiement_note: string | null }) => Promise<void>;
}) {
  const [ref, setRef] = useState(row.paiement_reference ?? "");
  const [note, setNote] = useState(row.paiement_note ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Paiement manuel — ${row.numero_mission ?? "mission"}`}>
      <div className="space-y-4">
        <p className="text-sm text-pro-text-soft">
          Montant réglé : <b className="text-pro-text">{eur(Number(row.montant_total))}</b> — horodatage automatique à la validation.
        </p>
        <FormField label="Référence de virement">
          <TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="VIR-2026-0142" />
        </FormField>
        <FormField label="Note (moyen de paiement, commentaire)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Virement SEPA — banque X" />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm({ paiement_reference: ref.trim() || null, paiement_note: note.trim() || null });
              setBusy(false);
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmer le paiement
          </Button>
        </div>
      </div>
    </Modal>
  );
}
