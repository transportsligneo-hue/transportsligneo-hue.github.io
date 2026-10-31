/**
 * Parcours d'activation du convoyeur : inscription → documents → validation →
 * contrat signé → actif. L'affichage lit la règle d'accès calculée en base
 * (mon_acces_missions) : l'interface ne décide de rien, elle informe.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, FileSignature, FolderOpen, Lock, ShieldCheck, UserRound, Zap } from "lucide-react";
import { monAccesMissions, type MonAcces } from "@/lib/contrat-acces.functions";

const VERT = "#10b981";

export function useAccesMissions() {
  const fetchAcces = useServerFn(monAccesMissions);
  const [acces, setAcces] = useState<MonAcces | null>(null);
  const refresh = useCallback(() => {
    void fetchAcces({}).then(setAcces).catch(() => undefined);
  }, [fetchAcces]);
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(t); };
  }, [refresh]);
  return { acces, refresh };
}

type Etape = { key: string; label: string; detail: string; icon: typeof Check; etat: "fait" | "encours" | "avenir" };

function etapes(a: MonAcces): Etape[] {
  const dossierValide = a.statut === "valide";
  const contratOk = a.acces === "ok";
  const nouvelleVersion = a.acces === "nouvelle_version";
  const e = (fait: boolean, encours: boolean): Etape["etat"] => (fait ? "fait" : encours ? "encours" : "avenir");
  return [
    { key: "inscription", label: "Inscription", detail: "Compte créé", icon: UserRound, etat: "fait" },
    { key: "documents", label: "Documents", detail: dossierValide ? "Pièces transmises" : "Déposez vos pièces obligatoires", icon: FolderOpen, etat: e(dossierValide, !dossierValide) },
    { key: "validation", label: "Validation", detail: dossierValide ? "Dossier validé par Ligneo" : "Vérification par l'équipe Ligneo", icon: ShieldCheck, etat: e(dossierValide, false) },
    {
      key: "contrat", label: "Contrat",
      detail: contratOk ? `Signé (version ${a.versionSignee ?? a.versionCourante})` : nouvelleVersion ? `Nouvelle version ${a.versionCourante} à signer` : "Signature électronique",
      icon: FileSignature, etat: e(contratOk, dossierValide && !contratOk),
    },
    { key: "actif", label: "Actif", detail: contratOk ? "Accès aux missions" : "Missions débloquées", icon: Zap, etat: e(contratOk, false) },
  ];
}

export function messageAcces(a: MonAcces | null): { titre: string; texte: string; cta: { to: "/convoyeur/documents" | "/convoyeur/contrat"; label: string } } | null {
  if (!a || a.acces === "ok") return null;
  switch (a.acces) {
    case "suspendu":
      return { titre: "Compte suspendu", texte: "Votre compte ne permet pas de prendre de missions. Contactez l'équipe Ligneo.", cta: { to: "/convoyeur/documents", label: "Mes documents" } };
    case "dossier":
      return { titre: "Dossier en cours de validation", texte: "Déposez toutes vos pièces obligatoires. Dès que l'équipe Ligneo a validé votre dossier, vous recevez votre contrat à signer.", cta: { to: "/convoyeur/documents", label: "Compléter mon dossier" } };
    case "contrat":
      return { titre: "Dernière étape : votre contrat", texte: "Votre dossier est validé. Signez votre contrat de partenariat pour accéder aux missions.", cta: { to: "/convoyeur/contrat", label: "Signer mon contrat" } };
    case "nouvelle_version":
      return { titre: "Nouvelle version du contrat", texte: `Le contrat de partenariat évolue (version ${a.versionCourante}). Signez-la pour continuer à prendre des missions. Vos missions déjà acceptées restent accessibles.`, cta: { to: "/convoyeur/contrat", label: "Voir mon contrat" } };
  }
  return null;
}

/** Frise des 5 étapes, lisible sur téléphone comme sur ordinateur. */
export function ParcoursActivation({ acces }: { acces: MonAcces }) {
  const list = etapes(acces);
  return (
    <div className="rounded-3xl border border-[#e3e8f2] bg-white p-5 shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
      <p className="text-[15px] font-semibold text-[#0a1638]">Activation de votre compte</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-5">
        {list.map((et, i) => {
          const Icon = et.etat === "fait" ? Check : et.icon;
          const ring = et.etat === "fait" ? { background: VERT, color: "#fff" }
            : et.etat === "encours" ? { background: "#ecfdf5", color: VERT, boxShadow: `0 0 0 2px ${VERT}` }
            : { background: "#f1f4fa", color: "#8a96b3" };
          return (
            <li key={et.key} className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center">
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full" style={ring}>
                <Icon size={19} strokeWidth={2.4} />
                {i < list.length - 1 && <span aria-hidden className="absolute left-full top-1/2 hidden h-[2px] w-[calc(100%+2.5rem)] -translate-y-1/2 sm:block" style={{ background: et.etat === "fait" ? VERT : "#e3e8f2", marginLeft: 6 }} />}
              </span>
              <div className="min-w-0">
                <p className={`text-[15px] font-semibold ${et.etat === "avenir" ? "text-[#8a96b3]" : "text-[#0a1638]"}`}>{et.label}</p>
                <p className="text-[13px] leading-snug text-[#5a6788]">{et.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Bandeau compact affiché tant que l'accès aux missions est bloqué. */
export function AccesMissionsBanner({ acces }: { acces: MonAcces | null }) {
  const m = messageAcces(acces);
  if (!m) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-200"><Lock size={18} /></span>
      <div className="min-w-[200px] flex-1">
        <p className="text-[15px] font-semibold text-[#0a1638]">{m.titre}</p>
        <p className="text-[13px] leading-snug text-[#3f4b66]">{m.texte}</p>
      </div>
      <Link to={m.cta.to as never} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white active:scale-[.98]">
        {m.cta.label}
      </Link>
    </div>
  );
}

/** Écran plein qui remplace les pages de missions tant que l'accès est bloqué. */
export function AccesMissionsGate({ acces }: { acces: MonAcces }) {
  const m = messageAcces(acces);
  if (!m) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="rounded-3xl border border-[#e3e8f2] bg-white p-6 text-center shadow-[0_10px_30px_-22px_rgba(10,22,56,.45)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"><Lock size={24} /></span>
        <h1 className="mt-3 text-xl font-bold text-[#0a1638]">{m.titre}</h1>
        <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-relaxed text-[#3f4b66]">{m.texte}</p>
        <Link to={m.cta.to as never} className="mt-4 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,.9)] active:scale-[.98]">
          {m.cta.label}
        </Link>
      </div>
      <ParcoursActivation acces={acces} />
    </div>
  );
}
