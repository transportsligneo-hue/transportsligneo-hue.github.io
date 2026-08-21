import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Ban, AlertTriangle, RotateCcw, FileWarning } from "lucide-react";

/**
 * Clôture administrative d'une mission :
 * annulation motivée (catégorie normalisée), facturation, indemnité convoyeur,
 * génération d'un passage à vide, et réactivation.
 */

export type ClotureCategorie = {
  key: string;
  label: string;
  description: string;
  /** Suggère la génération d'un passage à vide (déplacement effectué pour rien) */
  passageVide?: boolean;
  /** Par défaut facturable au client */
  facturable?: boolean;
};

export const CLOTURE_CATEGORIES: ClotureCategorie[] = [
  {
    key: "annulee_client",
    label: "Annulée par le client",
    description: "Le donneur d'ordre annule la commande avant ou pendant la mission.",
    facturable: true,
  },
  {
    key: "annulee_client_tardive",
    label: "Annulation tardive client (< 24 h)",
    description: "Annulation hors délai : frais d'annulation applicables.",
    facturable: true,
  },
  {
    key: "vehicule_indisponible",
    label: "Véhicule non disponible",
    description: "Le véhicule n'était pas présent ou pas remis au convoyeur.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "vehicule_non_roulant",
    label: "Véhicule non roulant / non conforme",
    description: "Panne, batterie, pneus, absence de clés, défaut de sécurité.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "documents_manquants",
    label: "Documents manquants",
    description: "Carte grise, assurance, W-garage ou bon de sortie indisponibles.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "interlocuteur_absent",
    label: "Interlocuteur absent au RDV",
    description: "Personne sur place pour remettre ou réceptionner le véhicule.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "convoyeur_defaillant",
    label: "Convoyeur défaillant",
    description: "Abandon, retard majeur ou non-présentation du convoyeur.",
    facturable: false,
  },
  {
    key: "convoyeur_indisponible",
    label: "Convoyeur indisponible (excusé)",
    description: "Maladie, accident ou empêchement justifié : mission à réattribuer.",
    facturable: false,
  },
  {
    key: "incident_route",
    label: "Incident / accident en route",
    description: "Sinistre, immobilisation ou dépannage pendant le convoyage.",
    facturable: false,
  },
  {
    key: "meteo_force_majeure",
    label: "Météo / force majeure",
    description: "Intempéries, blocage routier, grève, événement exceptionnel.",
    facturable: false,
  },
  {
    key: "report_date",
    label: "Reportée à une autre date",
    description: "Mission décalée : une nouvelle mission sera recréée.",
    facturable: false,
  },
  {
    key: "doublon",
    label: "Doublon / erreur de saisie",
    description: "Mission créée en double ou par erreur : sans impact facturation.",
    facturable: false,
  },
  {
    key: "test",
    label: "Mission de test",
    description: "Donnée de démonstration à retirer du suivi opérationnel.",
    facturable: false,
  },
  {
    key: "autre",
    label: "Autre motif",
    description: "Motif libre à préciser dans le commentaire.",
    facturable: false,
  },
];

export const CLOTURE_LABEL: Record<string, string> = Object.fromEntries(
  CLOTURE_CATEGORIES.map((c) => [c.key, c.label]),
);

/**
 * Mission non réalisée sur le terrain mais DUE au client :
 * la mission reste « Terminée » et facturable (pas d'annulation).
 */
export const CLOTURE_FACTURABLE_CATEGORIES: ClotureCategorie[] = [
  {
    key: "client_absent",
    label: "Client absent au rendez-vous",
    description: "Déplacement effectué, personne sur place : prestation due.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "vehicule_non_remis",
    label: "Véhicule non remis / non conforme",
    description: "Véhicule absent, non roulant ou documents manquants sur place.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "mission_reportee_facturee",
    label: "Mission reportée (déplacement facturé)",
    description: "Nouvelle date à planifier, le déplacement du jour reste facturé.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "double_facturation",
    label: "Double facturation (aller + retour à vide)",
    description: "Deux prestations facturées : convoyage prévu + retour à vide.",
    passageVide: true,
    facturable: true,
  },
  {
    key: "attente_immobilisation",
    label: "Attente / immobilisation sur site",
    description: "Temps d'attente prolongé facturé au client.",
    facturable: true,
  },
  {
    key: "annulation_tardive_facturee",
    label: "Annulation tardive facturée (< 24 h)",
    description: "Annulée hors délai : frais d'annulation intégralement dus.",
    facturable: true,
  },
  {
    key: "autre_facturable",
    label: "Autre motif facturable",
    description: "Motif libre à préciser dans le commentaire.",
    facturable: true,
  },
];

type Props = {
  attributionId: string;
  statut: string;
  /** Duo Livraison–Restitution : l'annulation s'applique aux deux volets. */
  isGroup?: boolean;
  /** Pré-remplissage déclenché depuis un incident. */
  prefill?: { categorie: string; motif: string } | null;
  prefillKey?: number;
  onChanged?: () => void;
  /** Ouvre le formulaire « Passage à vide » pré-rempli */
  onPassageAVide?: (motif: string) => void;
};

type AnnulationRow = {
  statut: string;
  annulation_categorie: string | null;
  annulation_motif: string | null;
  annulation_at: string | null;
  annulation_facturable: boolean | null;
  annulation_indemnite: number | null;
  annulation_passage_vide: boolean | null;
};

export function MissionClotureAdminPanel({ attributionId, statut, isGroup, prefill, prefillKey, onChanged, onPassageAVide }: Props) {
  const [row, setRow] = useState<AnnulationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [categorie, setCategorie] = useState<string>("");
  const [motif, setMotif] = useState("");
  const [facturable, setFacturable] = useState(false);
  const [indemnite, setIndemnite] = useState("");
  const [passageVide, setPassageVide] = useState(false);
  const [cancelTrajet, setCancelTrajet] = useState(true);
  const [applyGroup, setApplyGroup] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"annulation" | "facturable">("annulation");
  const [montantFacture, setMontantFacture] = useState("");

  const catalogue = mode === "facturable" ? CLOTURE_FACTURABLE_CATEGORIES : CLOTURE_CATEGORIES;

  const selected = useMemo(
    () => catalogue.find((c) => c.key === categorie) ?? null,
    [categorie, catalogue],
  );

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attributions")
      .select(
        "statut, annulation_categorie, annulation_motif, annulation_at, annulation_facturable, annulation_indemnite, annulation_passage_vide",
      )
      .eq("id", attributionId)
      .maybeSingle();
    setRow((data as AnnulationRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributionId, statut]);

  useEffect(() => {
    if (!prefillKey || !prefill) return;
    setOpen(true);
    setCategorie(prefill.categorie);
    const cat = CLOTURE_CATEGORIES.find((c) => c.key === prefill.categorie);
    setFacturable(Boolean(cat?.facturable));
    setPassageVide(Boolean(cat?.passageVide));
    setMotif(prefill.motif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const pickCategorie = (key: string) => {
    setCategorie(key);
    const cat = catalogue.find((c) => c.key === key);
    setFacturable(Boolean(cat?.facturable));
    setPassageVide(Boolean(cat?.passageVide));
  };

  const switchMode = (next: "annulation" | "facturable") => {
    setMode(next);
    setCategorie("");
    setFacturable(next === "facturable");
    setPassageVide(false);
  };

  const submitFacturable = async () => {
    if (!categorie) {
      toast.error("Choisissez un motif de clôture");
      return;
    }
    if (categorie === "autre_facturable" && motif.trim().length < 3) {
      toast.error("Précisez le motif dans le commentaire");
      return;
    }
    const cat = CLOTURE_FACTURABLE_CATEGORIES.find((c) => c.key === categorie);
    const ok = await confirmToast(`Clôturer et facturer — ${cat?.label} ?`, {
      description:
        "La mission reste Terminée et facturable au client (aucune annulation). Action tracée dans l'historique.",
      confirmLabel: "Clôturer & facturer",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_close_mission_facturable" as never, {
        _attribution_id: attributionId,
        _categorie: cat?.label ?? categorie,
        _motif: motif.trim() || null,
        _montant_facture: montantFacture ? Number(montantFacture) : null,
        _indemnite: indemnite ? Number(indemnite) : null,
        _passage_vide: passageVide,
        _apply_group: isGroup ? applyGroup : false,
      } as never);
      if (error) throw error;
      toast.success("Mission clôturée et facturable", { description: cat?.label });
      setOpen(false);
      setMotif("");
      await load();
      onChanged?.();
      if (passageVide) {
        onPassageAVide?.(`${cat?.label}${motif.trim() ? ` — ${motif.trim()}` : ""}`);
      }
    } catch (e) {
      toast.error("Échec de la clôture", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (mode === "facturable") return submitFacturable();
    if (!categorie) {
      toast.error("Choisissez un motif d'annulation");
      return;
    }
    if (categorie === "autre" && motif.trim().length < 3) {
      toast.error("Précisez le motif dans le commentaire");
      return;
    }
    const cat = CLOTURE_CATEGORIES.find((c) => c.key === categorie);
    const ok = await confirmToast(`Annuler la mission — ${cat?.label} ?`, {
      description: isGroup && applyGroup
        ? "Les deux volets (Livraison + Restitution) passent en statut Annulé. Action tracée dans l'historique."
        : "La mission passe en statut Annulé et le trajet est mis à jour. Action tracée dans l'historique.",
      confirmLabel: "Confirmer l'annulation",
      variant: "danger",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_cancel_mission" as never, {
        _attribution_id: attributionId,
        _categorie: cat?.label ?? categorie,
        _motif: motif.trim() || null,
        _facturable: facturable,
        _indemnite: indemnite ? Number(indemnite) : null,
        _passage_vide: passageVide,
        _cancel_trajet: cancelTrajet,
        _apply_group: isGroup ? applyGroup : false,
      } as never);
      if (error) throw error;
      toast.success("Mission annulée", { description: cat?.label });
      setOpen(false);
      setMotif("");
      await load();
      onChanged?.();
      if (passageVide) {
        onPassageAVide?.(`${cat?.label}${motif.trim() ? ` — ${motif.trim()}` : ""}`);
      }
    } catch (e) {
      toast.error("Échec de l'annulation", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async () => {
    const ok = await confirmToast("Réactiver cette mission ?", {
      description: "La mission repasse en cours et le motif d'annulation est effacé.",
      confirmLabel: "Réactiver",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("attributions")
        .update({
          statut: "en_cours",
          annulation_categorie: null,
          annulation_motif: null,
          annulation_at: null,
          annulation_facturable: false,
          annulation_indemnite: null,
          annulation_passage_vide: false,
        } as never)
        .eq("id", attributionId);
      if (error) throw error;
      toast.success("Mission réactivée");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error("Échec de la réactivation", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const isCancelled = (row?.statut ?? statut) === "annule";

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Ban size={15} className="text-red-600" />
        <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
          Clôture administrative
        </h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-pro-muted">
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </div>
      ) : isCancelled ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle size={14} />
              Mission annulée
              {row?.annulation_categorie ? <span>· {row.annulation_categorie}</span> : null}
            </div>
            {row?.annulation_motif && (
              <p className="mt-1 text-sm text-red-800/90 whitespace-pre-wrap">{row.annulation_motif}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-white px-2 py-0.5 border border-red-200 text-red-700">
                {row?.annulation_facturable ? "Facturable au client" : "Non facturable"}
              </span>
              {row?.annulation_indemnite != null && (
                <span className="rounded-full bg-white px-2 py-0.5 border border-red-200 text-red-700">
                  Indemnité convoyeur : {row.annulation_indemnite} €
                </span>
              )}
              {row?.annulation_at && (
                <span className="rounded-full bg-white px-2 py-0.5 border border-red-200 text-red-700">
                  {new Date(row.annulation_at).toLocaleString("fr-FR")}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onPassageAVide?.(
                  `${row?.annulation_categorie ?? "Mission annulée"}${row?.annulation_motif ? ` — ${row.annulation_motif}` : ""}`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              <FileWarning size={13} /> Générer un passage à vide
            </button>
            <button
              onClick={reactivate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-pro-border bg-white px-3 py-2 text-xs font-semibold text-pro-text hover:bg-pro-surface disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Réactiver la mission
            </button>
          </div>
        </div>
      ) : !open ? (
        <div className="space-y-2">
          <p className="text-sm text-pro-text-soft">
            Annulez la mission avec un motif normalisé (client, véhicule, convoyeur, force majeure…), en précisant
            la facturation et l'indemnité éventuelle du convoyeur.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            <Ban size={13} /> Annuler / clôturer la mission
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pro-muted mb-2">Motif</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CLOTURE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => pickCategorie(c.key)}
                  className={`text-left rounded-lg border px-3 py-2 transition ${
                    categorie === c.key
                      ? "border-red-400 bg-red-50 ring-1 ring-red-300"
                      : "border-pro-border bg-white hover:bg-pro-surface"
                  }`}
                >
                  <span className="block text-sm font-semibold text-pro-text">{c.label}</span>
                  <span className="block text-[11px] text-pro-muted leading-snug">{c.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-pro-muted mb-1">
              Commentaire {selected?.key === "autre" ? "(obligatoire)" : "(optionnel)"}
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Détail transmis à l'historique de mission (visible côté admin)…"
              className="w-full rounded-lg border border-pro-border bg-white px-3 py-2 text-sm text-pro-text"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-pro-text">
              <input type="checkbox" checked={facturable} onChange={(e) => setFacturable(e.target.checked)} />
              Facturable au client
            </label>
            <label className="flex items-center gap-2 text-sm text-pro-text">
              <input type="checkbox" checked={passageVide} onChange={(e) => setPassageVide(e.target.checked)} />
              Générer un passage à vide
            </label>
            <label className="flex items-center gap-2 text-sm text-pro-text">
              <input type="checkbox" checked={cancelTrajet} onChange={(e) => setCancelTrajet(e.target.checked)} />
              Annuler aussi le trajet (sinon republiable)
            </label>
            {isGroup && (
              <label className="flex items-center gap-2 text-sm font-semibold text-pro-text sm:col-span-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2">
                <input type="checkbox" checked={applyGroup} onChange={(e) => setApplyGroup(e.target.checked)} />
                Appliquer aux deux volets (Livraison + Restitution)
              </label>
            )}

            <label className="flex items-center gap-2 text-sm text-pro-text">
              <span className="shrink-0">Indemnité convoyeur</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={indemnite}
                onChange={(e) => setIndemnite(e.target.value)}
                placeholder="0"
                className="w-24 rounded border border-pro-border bg-white px-2 py-1 text-sm"
              />
              <span>€</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={submit}
              disabled={saving || !categorie}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />} Confirmer l'annulation
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-pro-border bg-white px-4 py-2 text-xs font-semibold text-pro-text hover:bg-pro-surface"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
