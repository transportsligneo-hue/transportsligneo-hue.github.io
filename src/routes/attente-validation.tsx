import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, CheckCircle, Mail } from "lucide-react";

export const Route = createFileRoute("/attente-validation")({
  component: AttenteValidation,
  head: () => ({
    meta: [
      { title: "Compte en attente de validation — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AttenteValidation() {
  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="card-premium rounded p-8 md:p-10 text-center space-y-6">
          <div className="gold-divider-short mx-auto" />

          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Clock size={40} className="text-primary" />
          </div>

          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
            Compte en cours de validation
          </h1>

          <p className="text-cream/70 text-sm md:text-base leading-relaxed">
            Merci pour votre inscription en tant que convoyeur. Notre équipe vérifie actuellement votre dossier ainsi que votre photo de permis de conduire.
          </p>

          <div className="space-y-3 text-left bg-navy/40 p-5 rounded border border-primary/10">
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-cream/70 text-sm">
                <span className="text-cream font-medium">Délai habituel :</span> 24 à 48h ouvrées
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Mail size={18} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-cream/70 text-sm">
                <span className="text-cream font-medium">Notification :</span> vous recevrez un email dès la validation de votre compte
              </p>
            </div>
          </div>

          <p className="text-cream/40 text-xs">
            Vous ne pourrez accéder à votre espace convoyeur qu'une fois votre profil validé par notre équipe.
          </p>

          <div className="pt-4 space-y-2">
            <Link to="/" className="inline-block text-primary text-sm hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
              ← Retour au site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
