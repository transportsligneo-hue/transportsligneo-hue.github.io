import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight } from "lucide-react";

const LABELS: Record<RegistrationClosedProps["kind"], string> = {
  client: "compte particulier",
  pro: "compte professionnel",
  flotte: "compte flotte",
  convoyeur: "inscription convoyeur",
};

interface RegistrationClosedProps {
  kind: "client" | "pro" | "flotte" | "convoyeur";
}

export function RegistrationClosed({ kind }: RegistrationClosedProps) {
  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full auth-fade-in">
        <div className="auth-card p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <Lock className="text-white/80" size={28} />
          </div>
          <h1 className="auth-title text-xl md:text-2xl">Inscriptions fermées</h1>
          <p className="auth-subtle text-sm leading-relaxed">
            Les inscriptions pour un {LABELS[kind]} sont momentanément fermées. Revenez bientôt ou contactez-nous.
          </p>
          <div className="text-white/50 text-xs space-y-1 pt-3 border-t border-white/10">
            <p>Pour toute question : contact@transportsligneo.fr</p>
          </div>
          <div className="pt-3 flex flex-col gap-2">
            <Link to="/login" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold inline-flex items-center justify-center gap-1">
              Se connecter <ArrowRight size={11} />
            </Link>
            {kind === "convoyeur" && (
              <Link to="/devenir-convoyeur" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold inline-flex items-center justify-center gap-1">
                Liste d'attente convoyeur <ArrowRight size={11} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
