/**
 * Vérification publique d'un certificat de convoyeur Ligneo.
 * Accessible sans authentification via le QR code du certificat.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/verify-certificat/$token")({
  component: VerifyCertificat,
  head: () => ({ meta: [{ title: "Vérification de certificat — Transports Ligneo" }] }),
});

type Cert = { certificate_number: string; full_name: string; issued_at: string; revoked_at: string | null };

function VerifyCertificat() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | { ok: true; cert: Cert } | { ok: false }>("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("formation_certificates" as never)
        .select("certificate_number, full_name, issued_at, revoked_at" as never)
        .eq("verification_token" as never, token as never)
        .maybeSingle();
      const cert = data as unknown as Cert | null;
      if (!cert || cert.revoked_at) setState({ ok: false });
      else setState({ ok: true, cert });
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1026] to-[#111a3d] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        {state === "loading" && <Loader2 className="mx-auto animate-spin text-pro-accent" size={36} />}
        {state !== "loading" && state.ok && (
          <>
            <ShieldCheck className="mx-auto text-emerald-600" size={56} />
            <h1 className="text-xl font-bold mt-4">Certificat valide</h1>
            <p className="text-sm text-pro-text-soft mt-2">Ce certificat a bien été délivré par Transports Ligneo.</p>
            <div className="mt-6 rounded-xl border border-pro-border bg-pro-bg-soft p-4 text-left">
              <p className="text-[11px] uppercase text-pro-muted">Titulaire</p>
              <p className="font-semibold text-pro-text">{state.cert.full_name}</p>
              <p className="text-[11px] uppercase text-pro-muted mt-3">N° certificat</p>
              <p className="font-mono text-sm">{state.cert.certificate_number}</p>
              <p className="text-[11px] uppercase text-pro-muted mt-3">Délivré le</p>
              <p className="text-sm">{new Date(state.cert.issued_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </>
        )}
        {state !== "loading" && !state.ok && (
          <>
            <ShieldAlert className="mx-auto text-red-600" size={56} />
            <h1 className="text-xl font-bold mt-4">Certificat introuvable</h1>
            <p className="text-sm text-pro-text-soft mt-2">Ce certificat n'existe pas ou a été révoqué.</p>
          </>
        )}
      </div>
    </div>
  );
}
