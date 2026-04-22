import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Mail, FileText, Upload, LogOut, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/attente-validation")({
  component: AttenteValidation,
  head: () => ({
    meta: [
      { title: "Compte en attente de validation — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const DOCS_REQUIS_SALARIE = [
  { type: "Permis de conduire", critique: true },
  { type: "Pièce d'identité", critique: true },
  { type: "Justificatif de domicile", critique: false },
  { type: "RIB", critique: false },
];

const DOCS_REQUIS_INDEPENDANT = [
  ...DOCS_REQUIS_SALARIE,
  { type: "KBIS", critique: true },
  { type: "Assurance RC professionnelle", critique: true },
];

interface DocStatus {
  type_document: string;
  statut_validation: string;
  motif_refus: string | null;
}

interface ConvoyeurInfo {
  id: string;
  prenom: string;
  type_convoyeur: string;
  statut: string;
  created_at: string;
}

function AttenteValidation() {
  const { user, logout, refresh, homeRoute, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [convoyeur, setConvoyeur] = useState<ConvoyeurInfo | null>(null);
  const [docs, setDocs] = useState<DocStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (uid: string) => {
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("id, prenom, type_convoyeur, statut, created_at")
      .eq("user_id", uid)
      .maybeSingle();

    if (!conv) {
      setLoading(false);
      return;
    }
    setConvoyeur(conv as ConvoyeurInfo);

    const { data: documents } = await supabase
      .from("documents_convoyeurs")
      .select("type_document, statut_validation, motif_refus")
      .eq("convoyeur_id", conv.id);

    setDocs((documents ?? []) as DocStatus[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    loadData(user.id);
  }, [user, isAuthenticated]);

  // Si déjà validé, redirect auto vers l'espace
  useEffect(() => {
    if (convoyeur?.statut === "valide" || convoyeur?.statut === "actif") {
      void refresh().then(() => navigate({ to: "/convoyeur" }));
    }
  }, [convoyeur?.statut, navigate, refresh]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await loadData(user.id);
    await refresh();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const docsRequis = convoyeur?.type_convoyeur === "independant" ? DOCS_REQUIS_INDEPENDANT : DOCS_REQUIS_SALARIE;

  // Mapping souple : on tente de matcher par nom, insensible à la casse, partiellement
  const findDoc = (typeRecherche: string): DocStatus | undefined => {
    const norm = (s: string) => s.toLowerCase().trim();
    const t = norm(typeRecherche);
    return docs.find((d) => {
      const dt = norm(d.type_document);
      // Match exact ou inclusion (ex: "Permis" matche "Permis de conduire")
      return dt === t || dt.includes(t.split(" ")[0]) || t.includes(dt.split(" ")[0]);
    });
  };

  const docsAvecStatut = docsRequis.map((req) => {
    const found = findDoc(req.type);
    return {
      type: req.type,
      critique: req.critique,
      statut: found?.statut_validation ?? "manquant",
      motif: found?.motif_refus ?? null,
    };
  });

  const totalRequis = docsAvecStatut.length;
  const totalApprouves = docsAvecStatut.filter((d) => d.statut === "approuve").length;
  const totalRefuses = docsAvecStatut.filter((d) => d.statut === "refuse").length;
  const progression = totalRequis > 0 ? Math.round((totalApprouves / totalRequis) * 100) : 0;

  const refuse = convoyeur?.statut === "refuse";
  const suspendu = convoyeur?.statut === "suspendu";

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-10">
      <div className="max-w-2xl w-full">
        <div className="card-premium rounded p-6 md:p-10 space-y-6">
          <div className="gold-divider-short mx-auto" />

          <div className="text-center space-y-3">
            <div
              className={`w-20 h-20 rounded-full border flex items-center justify-center mx-auto ${
                refuse
                  ? "bg-red-500/10 border-red-500/30"
                  : suspendu
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-primary/10 border-primary/30"
              }`}
            >
              {refuse ? (
                <AlertCircle size={40} className="text-red-400" />
              ) : suspendu ? (
                <AlertCircle size={40} className="text-amber-400" />
              ) : (
                <Clock size={40} className="text-primary" />
              )}
            </div>

            <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
              {refuse
                ? "Compte refusé"
                : suspendu
                ? "Compte suspendu"
                : "Compte en cours de validation"}
            </h1>

            {convoyeur?.prenom && !refuse && !suspendu && (
              <p className="text-cream/70 text-sm">
                Bonjour {convoyeur.prenom}, votre dossier est en cours d'examen.
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : refuse ? (
            <div className="bg-red-500/5 border border-red-500/20 rounded p-5 space-y-2">
              <p className="text-cream/80 text-sm leading-relaxed">
                Votre dossier n'a pas pu être validé par notre équipe. Vous pouvez nous contacter pour
                en savoir plus ou refaire une demande avec un dossier complet.
              </p>
              <a
                href="mailto:contact@transportsligneo.fr"
                className="inline-block text-primary text-sm hover:text-gold-light transition-colors"
              >
                contact@transportsligneo.fr
              </a>
            </div>
          ) : suspendu ? (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded p-5 space-y-2">
              <p className="text-cream/80 text-sm leading-relaxed">
                Votre compte est temporairement suspendu. Contactez notre équipe pour plus
                d'informations.
              </p>
              <a
                href="mailto:contact@transportsligneo.fr"
                className="inline-block text-primary text-sm hover:text-gold-light transition-colors"
              >
                contact@transportsligneo.fr
              </a>
            </div>
          ) : (
            <>
              {/* Progression */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider">
                  <span className="text-cream/60">Progression du dossier</span>
                  <span className="text-primary font-medium">
                    {totalApprouves} / {totalRequis} validés
                  </span>
                </div>
                <div className="h-2 bg-navy/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-gold-light transition-all duration-500"
                    style={{ width: `${progression}%` }}
                  />
                </div>
              </div>

              {/* Checklist documents */}
              <div className="space-y-2">
                <h2 className="text-xs uppercase tracking-wider text-cream/60 mb-2 flex items-center gap-2">
                  <FileText size={13} />
                  Pièces à fournir
                </h2>
                {docsAvecStatut.map((d) => (
                  <div
                    key={d.type}
                    className={`flex items-start gap-3 p-3 rounded border ${
                      d.statut === "approuve"
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : d.statut === "refuse"
                        ? "bg-red-500/5 border-red-500/20"
                        : d.statut === "en_attente"
                        ? "bg-blue-500/5 border-blue-500/20"
                        : "bg-navy/40 border-cream/10"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {d.statut === "approuve" ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : d.statut === "refuse" ? (
                        <AlertCircle size={18} className="text-red-400" />
                      ) : d.statut === "en_attente" ? (
                        <Clock size={18} className="text-blue-400" />
                      ) : (
                        <Upload size={18} className="text-cream/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-cream text-sm font-medium">{d.type}</p>
                        {d.critique && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider">
                            Obligatoire
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 text-cream/50">
                        {d.statut === "approuve" && "Document validé par notre équipe"}
                        {d.statut === "en_attente" && "Reçu — en cours d'examen"}
                        {d.statut === "refuse" && (d.motif || "Document refusé — à renvoyer")}
                        {d.statut === "manquant" && "À envoyer depuis votre espace"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {totalRefuses > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded p-3 text-xs text-cream/70">
                  ⚠ {totalRefuses} document(s) refusé(s). Renvoyez-les pour compléter votre dossier.
                </div>
              )}

              {/* Infos délai */}
              <div className="bg-navy/40 p-4 rounded border border-primary/10 space-y-2">
                <div className="flex items-start gap-3">
                  <Clock size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-cream/70 text-xs">
                    <span className="text-cream font-medium">Délai habituel :</span> 24 à 48h ouvrées
                    après réception de toutes les pièces.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Mail size={16} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-cream/70 text-xs">
                    Vous recevrez un email automatique dès la validation de votre compte.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            {!refuse && !suspendu && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 border border-primary/30 text-primary rounded text-xs uppercase tracking-[0.15em] hover:bg-primary/20 transition disabled:opacity-50"
              >
                {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Actualiser
              </button>
            )}
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-navy/60 border border-cream/10 text-cream/70 rounded text-xs uppercase tracking-[0.15em] hover:bg-navy/80 transition"
              >
                <LogOut size={14} />
                Se déconnecter
              </button>
            ) : (
              <Link
                to="/"
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-navy/60 border border-cream/10 text-cream/70 rounded text-xs uppercase tracking-[0.15em] hover:bg-navy/80 transition"
              >
                Retour au site
              </Link>
            )}
          </div>

          {convoyeur && (
            <p className="text-cream/30 text-[10px] text-center">
              Inscrit le {new Date(convoyeur.created_at).toLocaleDateString("fr-FR")} ·
              Statut : {convoyeur.statut}
              {homeRoute && homeRoute !== "/attente-validation" && " · Compte actif détecté"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
