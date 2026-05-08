import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendTransactionalEmail } from "@/lib/email/send";
import {
  MapPin,
  Calendar,
  Car,
  Euro,
  CheckCircle2,
  Send,
  Clock,
  XCircle,
  Loader2,
  Gavel,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/disponibles")({
  component: ConvoyeurDisponibles,
});

interface TrajetDispo {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  prix_suggere: number | null;
  statut_publication: string;
  created_at: string;
  // B1 — pricing mode
  pricing_mode: "fixe" | "enchere" | null;
  prix_convoyeur_fixe: number | null;
  prix_convoyeur_min: number | null;
  prix_convoyeur_max: number | null;
}

interface MyOffre {
  id: string;
  trajet_id: string;
  prix_propose: number;
  statut: string;
  type_offre: string;
  message: string | null;
}

const offreStatutLabel: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  retiree: "Retirée",
};

function ConvoyeurDisponibles() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [trajets, setTrajets] = useState<TrajetDispo[]>([]);
  const [myOffres, setMyOffres] = useState<Record<string, MyOffre>>({});
  const [loading, setLoading] = useState(true);
  const [openTrajetId, setOpenTrajetId] = useState<string | null>(null);
  const [contrePrix, setContrePrix] = useState<string>("");
  const [contreMessage, setContreMessage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Charger l'id du convoyeur connecté
  useEffect(() => {
    if (!user) return;
    supabase
      .from("convoyeurs")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConvoyeurId(data.id);
      });
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!convoyeurId) return;
    setLoading(true);
    const [{ data: trajetsData }, { data: offresData }] = await Promise.all([
      supabase
        .from("trajets")
        .select("id, depart, arrivee, date_trajet, heure_trajet, marque, modele, immatriculation, prix_suggere, statut_publication, created_at, pricing_mode, prix_convoyeur_fixe, prix_convoyeur_min, prix_convoyeur_max" as never)
        .eq("statut_publication" as never, "publie" as never)
        .order("created_at", { ascending: false }),
      supabase
        .from("mission_offres" as never)
        .select("*")
        .eq("convoyeur_id" as never, convoyeurId as never),
    ]);
    if (trajetsData) setTrajets(trajetsData as unknown as TrajetDispo[]);
    if (offresData) {
      const map: Record<string, MyOffre> = {};
      (offresData as unknown as MyOffre[]).forEach((o) => {
        map[o.trajet_id] = o;
      });
      setMyOffres(map);
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    if (convoyeurId) fetchData();
  }, [convoyeurId, fetchData]);

  const notifyAdmin = async (
    trajet: TrajetDispo,
    prix: number,
    typeOffre: string,
    message?: string,
  ) => {
    if (!convoyeurId) return;
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("prenom, nom")
      .eq("id", convoyeurId)
      .maybeSingle();
    const convoyeurNom = conv ? `${conv.prenom} ${conv.nom}` : "Convoyeur";

    // Notification interne admin (feed temps réel) — via RPC sécurisée
    await supabase.rpc("create_admin_notification" as never, {
      _type: "mission_offre",
      _titre: typeOffre === "acceptation_directe"
        ? `${convoyeurNom} accepte la mission ${trajet.depart} → ${trajet.arrivee}`
        : `${convoyeurNom} propose ${prix}€ pour ${trajet.depart} → ${trajet.arrivee}`,
      _message: message ?? null,
      _link: "/admin/attributions",
      _entity_type: "trajet",
      _entity_id: trajet.id,
      _metadata: { prix, type_offre: typeOffre, prix_suggere: trajet.prix_suggere } as never,
    } as never);

    sendTransactionalEmail({
      templateName: "nouvelle-offre-admin",
      recipientEmail: "contact@transportsligneo.fr",
      idempotencyKey: `nouvelle-offre-${trajet.id}-${convoyeurId}-${Date.now()}`,
      templateData: {
        convoyeurNom,
        depart: trajet.depart,
        arrivee: trajet.arrivee,
        date: trajet.date_trajet
          ? new Date(trajet.date_trajet).toLocaleDateString("fr-FR")
          : "—",
        prixSuggere: trajet.prix_suggere,
        prixPropose: prix,
        typeOffre,
        message: message ?? null,
      },
    }).catch(() => {});
  };

  /** Prix net convoyeur effectif d'un trajet (selon le mode). */
  const prixDriverEffectif = (t: TrajetDispo): number | null => {
    if (t.pricing_mode === "fixe" && t.prix_convoyeur_fixe != null) return t.prix_convoyeur_fixe;
    return t.prix_suggere ?? null;
  };

  const accepterPrixSuggere = async (trajet: TrajetDispo) => {
    const prix = prixDriverEffectif(trajet);
    if (!convoyeurId || prix == null) return;
    setSubmitting(true);
    await supabase.from("mission_offres" as never).insert({
      trajet_id: trajet.id,
      convoyeur_id: convoyeurId,
      prix_propose: prix,
      prix_suggere_snapshot: prix,
      type_offre: "acceptation_directe",
      statut: "en_attente",
    } as never);
    notifyAdmin(trajet, prix, "acceptation_directe");
    setSubmitting(false);
    setOpenTrajetId(null);
    fetchData();
  };

  const envoyerContreProposition = async (trajet: TrajetDispo) => {
    if (trajet.pricing_mode === "fixe") {
      alert("Cette mission est en prix fixe, vous ne pouvez pas proposer un autre prix.");
      return;
    }
    if (!convoyeurId || !contrePrix) return;
    const prix = parseFloat(contrePrix);
    if (isNaN(prix) || prix <= 0) return;
    if (trajet.prix_convoyeur_min != null && prix < trajet.prix_convoyeur_min) {
      alert(`Votre prix doit être au moins ${trajet.prix_convoyeur_min} €.`);
      return;
    }
    if (trajet.prix_convoyeur_max != null && prix > trajet.prix_convoyeur_max) {
      alert(`Votre prix doit être au maximum ${trajet.prix_convoyeur_max} €.`);
      return;
    }
    setSubmitting(true);
    await supabase.from("mission_offres" as never).insert({
      trajet_id: trajet.id,
      convoyeur_id: convoyeurId,
      prix_propose: prix,
      prix_suggere_snapshot: trajet.prix_suggere,
      type_offre: "contre_proposition",
      statut: "en_attente",
      message: contreMessage || null,
    } as never);
    notifyAdmin(trajet, prix, "contre_proposition", contreMessage || undefined);
    setSubmitting(false);
    setContrePrix("");
    setContreMessage("");
    setOpenTrajetId(null);
    fetchData();
  };

  const retirerOffre = async (offreId: string) => {
    await supabase
      .from("mission_offres" as never)
      .update({ statut: "retiree" } as never)
      .eq("id" as never, offreId as never);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text flex items-center gap-2">
          <Gavel size={22} className="text-emerald-600" /> Missions disponibles
        </h1>
        <p className="text-pro-muted text-sm mt-1">
          {trajets.length === 0
            ? "Aucune mission disponible pour le moment."
            : `${trajets.length} mission${trajets.length > 1 ? "s" : ""} ouverte${trajets.length > 1 ? "s" : ""} aux propositions.`}
        </p>
      </div>

      {trajets.length === 0 ? (
        <div className="bg-white border border-pro-border rounded-xl p-10 text-center">
          <Gavel className="mx-auto text-pro-muted mb-3" size={32} />
          <p className="text-pro-text-soft">Revenez plus tard, de nouvelles missions sont publiées régulièrement.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trajets.map((t) => {
            const offre = myOffres[t.id];
            const open = openTrajetId === t.id;
            return (
              <div
                key={t.id}
                className="bg-white border border-pro-border rounded-xl overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-pro-text font-semibold text-base">
                        <MapPin size={15} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{t.depart}</span>
                        <span className="text-pro-muted">→</span>
                        <span className="truncate">{t.arrivee}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-pro-text-soft">
                        {t.date_trajet && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(t.date_trajet).toLocaleDateString("fr-FR")}
                            {t.heure_trajet && ` · ${t.heure_trajet}`}
                          </span>
                        )}
                        {(t.marque || t.modele) && (
                          <span className="inline-flex items-center gap-1">
                            <Car size={12} />
                            {[t.marque, t.modele].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const prixAffiche = prixDriverEffectif(t);
                      const isFixe = t.pricing_mode === "fixe";
                      return prixAffiche != null ? (
                        <div className="text-right shrink-0">
                          <p className="text-pro-muted text-[10px] uppercase tracking-wider">
                            {isFixe ? "Prix fixe" : "À partir de"}
                          </p>
                          <p className="text-emerald-700 font-bold text-lg leading-tight">{prixAffiche} €</p>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isFixe ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {isFixe ? "Fixe" : "Enchère"}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Statut de mon offre */}
                  {offre && (
                    <div
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs mb-3 ${
                        offre.statut === "acceptee"
                          ? "bg-emerald-50 text-emerald-700"
                          : offre.statut === "refusee"
                          ? "bg-red-50 text-red-700"
                          : offre.statut === "retiree"
                          ? "bg-slate-50 text-slate-600"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        {offre.statut === "acceptee" ? (
                          <CheckCircle2 size={14} />
                        ) : offre.statut === "refusee" ? (
                          <XCircle size={14} />
                        ) : (
                          <Clock size={14} />
                        )}
                        Votre offre : <strong>{offre.prix_propose} €</strong> · {offreStatutLabel[offre.statut]}
                      </span>
                      {offre.statut === "en_attente" && (
                        <button
                          onClick={() => retirerOffre(offre.id)}
                          className="text-red-600 hover:underline font-medium"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {!offre || offre.statut === "retiree" || offre.statut === "refusee" ? (
                    !open ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        {(() => {
                          const prixAcc = prixDriverEffectif(t);
                          const isFixe = t.pricing_mode === "fixe";
                          return (
                            <>
                              {prixAcc != null && (
                                <button
                                  onClick={() => accepterPrixSuggere(t)}
                                  disabled={submitting}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
                                >
                                  <CheckCircle2 size={15} />
                                  {isFixe ? `Accepter à ${prixAcc} €` : `Accepter à ${prixAcc} €`}
                                </button>
                              )}
                              {!isFixe && (
                                <button
                                  onClick={() => {
                                    setOpenTrajetId(t.id);
                                    setContrePrix(prixAcc?.toString() ?? "");
                                    setContreMessage("");
                                  }}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-600 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 active:scale-95 transition"
                                >
                                  <Euro size={15} />
                                  {t.prix_convoyeur_min != null || t.prix_convoyeur_max != null
                                    ? `Proposer (${t.prix_convoyeur_min ?? "—"}–${t.prix_convoyeur_max ?? "—"} €)`
                                    : "Proposer un autre prix"}
                                </button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-2 border-t border-pro-border pt-3">
                        <label className="block text-xs font-medium text-pro-text-soft">
                          Votre prix (€)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={contrePrix}
                          onChange={(e) => setContrePrix(e.target.value)}
                          placeholder="ex: 250"
                          className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <label className="block text-xs font-medium text-pro-text-soft pt-1">
                          Message (optionnel)
                        </label>
                        <textarea
                          value={contreMessage}
                          onChange={(e) => setContreMessage(e.target.value)}
                          rows={2}
                          placeholder="Justification, conditions, disponibilité..."
                          className="w-full px-3 py-2 border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setOpenTrajetId(null)}
                            className="flex-1 px-3 py-2 bg-pro-bg-soft text-pro-text-soft rounded-lg text-sm font-medium hover:bg-slate-200"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => envoyerContreProposition(t)}
                            disabled={submitting || !contrePrix}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Send size={14} />
                            Envoyer
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
