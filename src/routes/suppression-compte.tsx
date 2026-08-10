import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2, Shield, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { requestAccountDeletion } from "@/lib/account-deletion.functions";

export const Route = createFileRoute("/suppression-compte")({
  component: SuppressionComptePage,
  head: () => ({
    meta: [
      { title: "Supprimer mon compte · Transports Ligneo" },
      { name: "description", content: "Demandez la suppression de votre compte et de vos données personnelles sur l'application Transports Ligneo Driver." },
      { property: "og:title", content: "Supprimer mon compte · Transports Ligneo" },
      { property: "og:description", content: "Demandez la suppression de votre compte et de vos données personnelles sur l'application Transports Ligneo Driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://transportsligneo.fr/suppression-compte" }],
  }),
});

const conseils = [
  "Vos données de mission (photos, états des lieux, signatures) seront supprimées ou anonymisées dans les 30 jours, sous réserve des obligations légales de conservation.",
  "Les documents contractuels pouvant être exigés par la réglementation seront conservés pendant la durée légale, puis supprimés.",
  "Une fois la suppression confirmée, vous ne pourrez plus vous connecter à l'application Transports Ligneo Driver.",
];

function SuppressionComptePage() {
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [raison, setRaison] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const result = await requestAccountDeletion({ data: { email, telephone, raison } });
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg("La demande n'a pas pu être envoyée. Vérifiez votre adresse e-mail ou réessayez plus tard.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.");
    }
  };

  return (
    <div className="r4-page min-h-screen">
      <section className="mx-auto max-w-2xl px-6 pb-24 pt-28">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#9aa6c9] transition-colors hover:text-white"
        >
          <ArrowLeft size={16} /> Retour à l'accueil
        </Link>

        <div className="r4-eyebrow mb-5 inline-flex">
          <span className="r4-eyebrow-dot" />
          Application convoyeur
        </div>
        <h1
          className="mb-4 font-heading text-3xl font-extrabold leading-[1.05] tracking-tight text-white md:text-4xl"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Supprimer mon compte
        </h1>
        <p className="mb-10 max-w-xl text-[15px] leading-relaxed text-[#9aa6c9]">
          Demandez la suppression de votre compte Transports Ligneo Driver et de vos données associées.
        </p>

        <div className="glass-onyx rounded-2xl border border-white/5 p-6 md:p-8">
          {status === "success" ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/10 text-[#22c55e]">
                <CheckCircle2 size={28} />
              </div>
              <h2 className="mb-2 font-heading text-xl text-white">Demande envoyée</h2>
              <p className="mb-6 text-[14px] leading-relaxed text-[#c8d0e6]">
                Nous avons bien reçu votre demande de suppression. Notre équipe la traitera dans un délai maximum de 30 jours et vous contactera à l'adresse <strong className="text-white">{email}</strong> si nécessaire.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-[#2f5fff] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#2450e0]"
              >
                Retour à l'accueil
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Adresse e-mail du compte <span className="text-[#e7c76a]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="convoyeur@exemple.fr"
                  className="w-full rounded-xl border border-[#7aa3ff]/20 bg-[#0b1026]/60 px-4 py-3 text-[14px] text-white placeholder:text-[#9aa6c9]/50 focus:border-[#4f8cff] focus:outline-none focus:ring-1 focus:ring-[#4f8cff]/30"
                />
              </div>

              <div>
                <label htmlFor="telephone" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Numéro de téléphone associé
                </label>
                <input
                  id="telephone"
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full rounded-xl border border-[#7aa3ff]/20 bg-[#0b1026]/60 px-4 py-3 text-[14px] text-white placeholder:text-[#9aa6c9]/50 focus:border-[#4f8cff] focus:outline-none focus:ring-1 focus:ring-[#4f8cff]/30"
                />
              </div>

              <div>
                <label htmlFor="raison" className="mb-1.5 block text-[13px] font-semibold text-white">
                  Motif de la suppression (optionnel)
                </label>
                <textarea
                  id="raison"
                  rows={3}
                  value={raison}
                  onChange={(e) => setRaison(e.target.value)}
                  placeholder="Expliquez brièvement pourquoi vous souhaitez supprimer votre compte..."
                  className="w-full resize-none rounded-xl border border-[#7aa3ff]/20 bg-[#0b1026]/60 px-4 py-3 text-[14px] text-white placeholder:text-[#9aa6c9]/50 focus:border-[#4f8cff] focus:outline-none focus:ring-1 focus:ring-[#4f8cff]/30"
                />
              </div>

              {status === "error" && (
                <div className="flex items-start gap-2 rounded-xl bg-[#ef4444]/10 p-3 text-[13px] text-[#ef4444]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ef4444] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Confirmer la suppression
                  </>
                )}
              </button>

              <p className="text-center text-[12px] text-[#9aa6c9]">
                Vous préférez envoyer directement un e-mail ?{" "}
                <a
                  href="mailto:contact@transportsligneo.fr?subject=Demande%20de%20suppression%20de%20compte"
                  className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors"
                >
                  contact@transportsligneo.fr
                </a>
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 space-y-4 rounded-2xl border border-[#7aa3ff]/15 bg-[#3f7bff]/5 p-6">
          <div className="flex items-center gap-2 text-[#d9b54a]">
            <Shield size={18} />
            <span className="text-[13px] font-bold uppercase tracking-[0.1em]">Informations importantes</span>
          </div>
          <ul className="space-y-3 text-[13.5px] leading-relaxed text-[#c8d0e6]">
            {conseils.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f8cff]" />
                {c}
              </li>
            ))}
          </ul>
          <p className="pt-2 text-[13px] text-[#9aa6c9]">
            Consultez notre{" "}
            <Link to="/confidentialite" className="text-[#4f8cff] underline underline-offset-2 hover:text-white transition-colors">
              politique de confidentialité
            </Link>{" "}
            pour en savoir plus sur la gestion de vos données.
          </p>
        </div>
      </section>
    </div>
  );
}
