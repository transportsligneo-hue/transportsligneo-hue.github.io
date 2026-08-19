import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal, Badge, Button, TextInput, Select, FormField } from "@/components/admin/AdminUI";
import {
  AJUSTEMENT_LABEL,
  REMU_STATUT_LABEL,
  REMU_STATUT_TONE,
  SOURCE_CALCUL_LABEL,
  decomposer,
  eur,
  dateFr,
  type Ajustement,
  type AjustementCategorie,
  type CatalogPenalite,
  type Remuneration,
  type RemuStatut,
} from "@/lib/finances-convoyeurs";

/**
 * Détail complet d'une rémunération de mission côté admin :
 * décomposition du calcul, ajustements (catalogue de pénalités + lignes libres),
 * annulation tracée, changement de statut.
 */
export function RemunerationDetailModal({
  remunerationId,
  open,
  onClose,
  onChanged,
}: {
  remunerationId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remu, setRemu] = useState<Remuneration | null>(null);
  const [ajustements, setAjustements] = useState<Ajustement[]>([]);
  const [penalites, setPenalites] = useState<CatalogPenalite[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Formulaire d'ajustement
  const [categorie, setCategorie] = useState<AjustementCategorie>("penalite");
  const [penaliteId, setPenaliteId] = useState("");
  const [libelle, setLibelle] = useState("");
  const [motif, setMotif] = useState("");
  const [montant, setMontant] = useState("");
  const [justificatif, setJustificatif] = useState("");

  const load = useCallback(async () => {
    if (!remunerationId) return;
    setLoading(true);
    const [rRes, aRes, pRes] = await Promise.all([
      supabase.from("remunerations_missions").select("*").eq("id", remunerationId).maybeSingle(),
      supabase
        .from("remuneration_ajustements")
        .select("*")
        .eq("remuneration_id", remunerationId)
        .order("created_at", { ascending: true }),
      supabase.from("catalogue_penalites").select("*").eq("actif", true).order("libelle"),
    ]);
    setRemu((rRes.data ?? null) as unknown as Remuneration | null);
    setAjustements((aRes.data ?? []) as unknown as Ajustement[]);
    setPenalites((pRes.data ?? []) as unknown as CatalogPenalite[]);
    setLoading(false);
  }, [remunerationId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function resetForm() {
    setCategorie("penalite");
    setPenaliteId("");
    setLibelle("");
    setMotif("");
    setMontant("");
    setJustificatif("");
    setShowForm(false);
  }

  const selectedPenalite = penalites.find((p) => p.id === penaliteId);

  function computedMontant(): number | null {
    if (categorie === "penalite" && selectedPenalite && remu) {
      const v =
        selectedPenalite.type_montant === "pourcentage"
          ? (Number(remu.montant_base) * Number(selectedPenalite.valeur)) / 100
          : Number(selectedPenalite.valeur);
      return -Math.abs(Math.round(v * 100) / 100);
    }
    const n = Number(montant.replace(",", "."));
    if (!Number.isFinite(n) || n === 0) return null;
    const abs = Math.abs(n);
    return categorie === "deduction_libre" ? -abs : abs;
  }

  async function addAjustement() {
    if (!remu) return;
    const m = computedMontant();
    if (m === null) return toast.error("Montant invalide");
    if (!motif.trim()) return toast.error("Le motif est obligatoire (traçabilité comptable)");
    const lib = categorie === "penalite" ? selectedPenalite?.libelle ?? "" : libelle.trim();
    if (!lib) return toast.error("Libellé requis");

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("remuneration_ajustements").insert({
      remuneration_id: remu.id,
      categorie,
      penalite_id: categorie === "penalite" ? penaliteId || null : null,
      libelle: lib,
      motif: motif.trim(),
      article_reference: categorie === "penalite" ? selectedPenalite?.article_reference ?? null : null,
      justificatif_url: justificatif.trim() || null,
      montant: m,
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ajustement enregistré");
    resetForm();
    await load();
    onChanged?.();
  }

  async function cancelAjustement(a: Ajustement) {
    const raison = window.prompt("Motif de l'annulation (obligatoire, conservé dans l'historique) :");
    if (!raison || !raison.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("remuneration_ajustements")
      .update({
        annule: true,
        annule_at: new Date().toISOString(),
        annule_par: userData.user?.id ?? null,
        annulation_motif: raison.trim(),
      })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Ajustement annulé (trace conservée)");
    await load();
    onChanged?.();
  }

  async function setStatut(statut: RemuStatut) {
    if (!remu) return;
    const { data: userData } = await supabase.auth.getUser();
    const patch: Record<string, unknown> = { statut };
    if (statut === "valide") {
      patch.valide_par = userData.user?.id ?? null;
      patch.valide_at = new Date().toISOString();
    }
    const { error } = await supabase.from("remunerations_missions").update(patch).eq("id", remu.id);
    if (error) return toast.error(error.message);
    toast.success(`Statut : ${REMU_STATUT_LABEL[statut]}`);
    await load();
    onChanged?.();
  }

  async function setMontantManuel() {
    if (!remu) return;
    const val = window.prompt("Nouveau montant de base (€) :", String(remu.montant_base));
    if (val === null) return;
    const n = Number(val.replace(",", "."));
    if (!Number.isFinite(n)) return toast.error("Montant invalide");
    const raison = window.prompt("Justification de cette saisie manuelle (obligatoire) :");
    if (!raison || !raison.trim()) return toast.error("Justification obligatoire");
    const { data: userData } = await supabase.auth.getUser();
    const detail = {
      ...(remu.calcul_detail ?? {}),
      saisie_manuelle: {
        ancien_montant_base: remu.montant_base,
        nouveau_montant_base: n,
        motif: raison.trim(),
        par: userData.user?.id ?? null,
        le: new Date().toISOString(),
      },
    };
    const { error } = await supabase
      .from("remunerations_missions")
      .update({
        montant_base: n,
        montant_total: Math.round((n + Number(remu.total_ajustements)) * 100) / 100,
        source_calcul: "manuel",
        statut: "en_attente",
        calcul_detail: detail as never,
      })
      .eq("id", remu.id);
    if (error) return toast.error(error.message);
    toast.success("Montant de base corrigé (justification enregistrée)");
    await load();
    onChanged?.();
  }

  async function recalculer() {
    if (!remu) return;
    const { error } = await supabase.rpc("calculer_remuneration_mission" as never, {
      _trajet_id: remu.trajet_id,
      _force: true,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Rémunération recalculée");
    await load();
    onChanged?.();
  }

  return (
    <Modal open={open} onClose={onClose} title="Détail de la rémunération" size="xl">
      {loading || !remu ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin text-pro-muted" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-pro-text">{remu.numero_mission ?? "Mission"}</span>
            <Badge tone={REMU_STATUT_TONE[remu.statut]}>{REMU_STATUT_LABEL[remu.statut]}</Badge>
            <Badge tone="neutral">{SOURCE_CALCUL_LABEL[remu.source_calcul] ?? remu.source_calcul}</Badge>
            <span className="text-xs text-pro-muted">Mission du {dateFr(remu.date_mission)}</span>
            <span className="text-xs text-pro-muted">Calculé le {dateFr(remu.calcule_at)}</span>
          </div>

          {remu.statut === "a_valider" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Aucune règle de rémunération active ne couvre cette mission et aucun prix convoyeur n'était
                négocié. Corrigez le montant de base (avec justification) ou créez la règle manquante.
              </span>
            </div>
          )}

          {/* Décomposition */}
          <div className="rounded-lg border border-pro-border overflow-hidden">
            <div className="px-4 py-2 bg-pro-bg-soft text-xs uppercase tracking-wider text-pro-muted font-semibold">
              Décomposition du calcul
            </div>
            <div className="divide-y divide-pro-border">
              {decomposer(remu, ajustements).map((l, i) => (
                <div key={i} className="px-4 py-2 flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="text-pro-text">{l.label}</p>
                    {l.detail && <p className="text-xs text-pro-muted">{l.detail}</p>}
                  </div>
                  <span className={l.montant < 0 ? "text-red-600 font-medium" : "text-pro-text font-medium"}>
                    {eur(l.montant)}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3 flex items-center justify-between bg-pro-bg-soft">
                <span className="font-semibold text-pro-text">Total dû au convoyeur</span>
                <span className="text-lg font-bold text-pro-text">{eur(remu.montant_total)}</span>
              </div>
            </div>
          </div>

          {/* Ajustements annulés (trace) */}
          {ajustements.some((a) => a.annule) && (
            <div className="rounded-lg border border-pro-border p-3">
              <p className="text-xs uppercase tracking-wider text-pro-muted font-semibold mb-2">
                Ajustements annulés (historique conservé)
              </p>
              <ul className="space-y-1 text-xs text-pro-muted">
                {ajustements
                  .filter((a) => a.annule)
                  .map((a) => (
                    <li key={a.id} className="line-through/none">
                      <span className="line-through">
                        {AJUSTEMENT_LABEL[a.categorie]} — {a.libelle} ({eur(a.montant)})
                      </span>{" "}
                      · annulé le {dateFr(a.annule_at)} — {a.annulation_motif}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Ajustements actifs : actions */}
          {ajustements.filter((a) => !a.annule).length > 0 && (
            <div className="space-y-1">
              {ajustements
                .filter((a) => !a.annule)
                .map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-md bg-pro-bg-soft"
                  >
                    <span className="text-pro-muted">
                      {AJUSTEMENT_LABEL[a.categorie]} — {a.libelle} · {eur(a.montant)}
                      {a.article_reference ? ` · ${a.article_reference}` : ""}
                    </span>
                    <button
                      onClick={() => void cancelAjustement(a)}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline"
                    >
                      <Ban size={12} /> Annuler
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Ajout d'ajustement */}
          {!showForm ? (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Ajouter un ajustement
            </Button>
          ) : (
            <div className="rounded-lg border border-pro-border p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField label="Type">
                  <Select value={categorie} onChange={(e) => setCategorie(e.target.value as AjustementCategorie)}>
                    {(Object.keys(AJUSTEMENT_LABEL) as AjustementCategorie[]).map((k) => (
                      <option key={k} value={k}>
                        {AJUSTEMENT_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {categorie === "penalite" ? (
                  <FormField label="Pénalité du catalogue">
                    <Select value={penaliteId} onChange={(e) => setPenaliteId(e.target.value)}>
                      <option value="">— Choisir —</option>
                      {penalites.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.libelle} (
                          {p.type_montant === "pourcentage" ? `${p.valeur} %` : eur(p.valeur)})
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Libellé">
                    <TextInput value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Remboursement péage" />
                  </FormField>
                )}
              </div>

              {categorie !== "penalite" && (
                <FormField label="Montant (€)">
                  <TextInput value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0,00" />
                </FormField>
              )}

              <FormField label="Motif (obligatoire)">
                <TextInput value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Justification conservée dans l'historique" />
              </FormField>
              <FormField label="Pièce justificative (URL, optionnel)">
                <TextInput value={justificatif} onChange={(e) => setJustificatif(e.target.value)} placeholder="https://…" />
              </FormField>

              {selectedPenalite?.article_reference && categorie === "penalite" && (
                <p className="text-xs text-pro-muted">Référence : {selectedPenalite.article_reference}</p>
              )}
              <p className="text-sm text-pro-text">
                Impact : <strong>{computedMontant() === null ? "—" : eur(computedMontant())}</strong>
              </p>

              <div className="flex gap-2">
                <Button onClick={() => void addAjustement()} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer
                </Button>
                <Button variant="ghost" onClick={resetForm}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {/* Actions statut */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-pro-border">
            <Button variant="secondary" onClick={() => void recalculer()}>
              <RotateCcw size={14} /> Recalculer
            </Button>
            <Button variant="secondary" onClick={() => void setMontantManuel()}>
              Corriger le montant de base
            </Button>
            {remu.statut !== "valide" && remu.statut !== "paye" && (
              <Button onClick={() => void setStatut("valide")}>
                <CheckCircle2 size={14} /> Valider
              </Button>
            )}
            {remu.statut !== "litige" && (
              <Button variant="danger" onClick={() => void setStatut("litige")}>
                Mettre en litige
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
