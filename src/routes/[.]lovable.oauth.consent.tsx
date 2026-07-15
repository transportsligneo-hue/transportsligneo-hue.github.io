import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string } | null;
  scope?: string;
  redirect_uri?: string;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function authOAuth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id manquant");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0b1026] text-cream">
      <div className="max-w-md card-premium-light p-6">
        <h1 className="text-xl font-semibold mb-2">Autorisation impossible</h1>
        <p className="text-sm opacity-80">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
  head: () => ({ meta: [{ title: "Autoriser une application — Transports Ligneo" }, { name: "robots", content: "noindex,nofollow" }] }),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "cette application";

  async function decide(approve: boolean) {
    setError(null);
    setBusy(approve ? "approve" : "deny");
    const { data, error } = approve
      ? await authOAuth().approveAuthorization(authorization_id)
      : await authOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("Le serveur d'autorisation n'a pas renvoyé d'URL de redirection.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#0b1026]">
      <div className="w-full max-w-md rounded-2xl bg-[#fdfcf8] p-8 shadow-2xl border border-[#e7c76a]/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-[#0b1026] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-[#e7c76a]" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-[#0b1026]/60">Transports Ligneo</div>
            <div className="text-lg font-serif text-[#0b1026]">Autoriser l'accès</div>
          </div>
        </div>
        <p className="text-sm text-[#0b1026]/80 mb-4">
          <span className="font-semibold">{clientName}</span> souhaite se connecter à votre compte Transports Ligneo
          et utiliser les outils disponibles en votre nom.
        </p>
        <ul className="text-xs text-[#0b1026]/70 space-y-1 mb-6 list-disc list-inside">
          <li>Consulter vos informations de profil et votre email</li>
          <li>Utiliser les outils Ligneo (missions, devis, catalogue) avec vos permissions</li>
        </ul>
        <p className="text-[11px] text-[#0b1026]/50 mb-6">
          Cette autorisation ne contourne aucune règle d'accès de la plateforme. Vous pouvez la révoquer à tout moment.
        </p>
        {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <Button
            onClick={() => decide(true)}
            disabled={busy !== null}
            className="flex-1 bg-[#0b1026] hover:bg-[#111a3d] text-[#faf7ef]"
          >
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Autoriser"}
          </Button>
          <Button
            onClick={() => decide(false)}
            disabled={busy !== null}
            variant="outline"
            className="flex-1 border-[#0b1026]/20 text-[#0b1026]"
          >
            {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refuser"}
          </Button>
        </div>
      </div>
    </main>
  );
}
