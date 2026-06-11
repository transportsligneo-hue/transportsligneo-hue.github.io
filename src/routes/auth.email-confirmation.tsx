import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export const Route = createFileRoute("/auth/email-confirmation")({
  head: () => ({
    meta: [
      { title: "Email validé — Transports Ligneo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailConfirmationPage,
});

function EmailConfirmationPage() {
  return (
    <div className="min-h-screen bg-[#0b1026] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-[#111a3d] border border-primary/30 flex items-center justify-center mb-6 overflow-hidden">
          <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain p-2" />
        </div>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 mb-5">
          <CheckCircle2 className="text-emerald-400" size={30} />
        </div>
        <h1 className="font-heading text-3xl text-cream tracking-[0.08em] mb-3">
          Email validé <span className="text-emerald-400">✓</span>
        </h1>
        <p className="text-cream/70 text-sm leading-relaxed mb-8">
          Votre adresse email est confirmée et votre compte est activé.
          Vous pouvez maintenant accéder à votre espace.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center px-8 py-3.5 bg-primary text-navy font-heading text-xs tracking-[0.2em] uppercase rounded hover:bg-gold-light transition-colors"
        >
          Aller à mon espace
        </Link>
        <p className="mt-6">
          <Link to="/" className="text-cream/40 text-xs hover:text-cream/70 transition-colors">
            ← Retour au site
          </Link>
        </p>
      </div>
    </div>
  );
}
