import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getIdVerificationStatus } from "@/lib/id-verification.functions";
import IdVerifyCard from "@/components/convoyeur/IdVerifyCard";

/**
 * Bloque l'espace d'un nouveau convoyeur (en attente de validation) tant que son identité
 * n'est pas vérifiée. Les convoyeurs déjà validés ne sont pas concernés.
 * En cas d'erreur de service, on ne bloque jamais (pas de blocage involontaire).
 */
export function IdVerifyGate({ active, children }: { active: boolean; children: ReactNode }) {
  const statusFn = useServerFn(getIdVerificationStatus);
  const [status, setStatus] = useState<string | null>(null);
  const [checked, setChecked] = useState(!active);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    statusFn().then((r) => { if (alive) { setStatus(r.status); setChecked(true); } })
      .catch(() => { if (alive) { setStatus("approved"); setChecked(true); } });
    return () => { alive = false; };
  }, [active, statusFn]);

  if (!active) return <>{children}</>;
  if (!checked) return null;
  // « review » = dossier envoyé, en cours d'examen : on laisse passer.
  if (status === "approved" || status === "review") return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl py-10">
      <h1 className="mb-1 text-2xl font-bold text-[#0a1638]">Dernière étape : vérifiez votre identité</h1>
      <p className="mb-5 text-sm text-[#5a6788]">
        Pour sécuriser votre compte convoyeur, nous vérifions votre pièce d'identité (carte d'identité ou passeport) et un selfie. Cela prend environ une minute.
      </p>
      <IdVerifyCard large onStatus={setStatus} />
    </div>
  );
}
