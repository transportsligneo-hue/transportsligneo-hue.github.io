import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/invitation-equipe/$token")({
  head: () => ({
    meta: [
      { title: "Invitation équipe — Transports Ligneo" },
      { name: "description", content: "Rejoignez l'espace professionnel de votre société sur Transports Ligneo." },
      { property: "og:title", content: "Invitation équipe — Transports Ligneo" },
      { property: "og:description", content: "Rejoignez l'espace professionnel de votre société." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitationPage,
});

const ERR: Record<string, string> = {
  invalid_invitation: "Cette invitation est expirée ou déjà utilisée.",
  email_mismatch: "Connectez-vous avec l'adresse e-mail qui a reçu l'invitation.",
};

function InvitationPage() {
  const { token } = Route.useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("accept_org_invitation", { _token: token });
    setBusy(false);
    if (error) {
      const k = Object.keys(ERR).find((x) => error.message.includes(x));
      setMsg(k ? ERR[k] : "Impossible d'accepter l'invitation.");
      return;
    }
    navigate({ to: "/dashboard-pro" });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="mission-surface max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Rejoindre votre équipe</h1>
        <p className="text-sm text-muted-foreground">Vous avez été invité sur l'espace professionnel Transports Ligneo de votre société.</p>
        {isAuthenticated ? (
          <button onClick={accept} disabled={busy} className="pp-btn-primary w-full">{busy ? "…" : "Accepter l'invitation"}</button>
        ) : (
          <div className="space-y-2">
            <Link to="/login" className="pp-btn-primary block">Se connecter</Link>
            <Link to="/inscription-pro" className="text-sm underline">Créer mon compte</Link>
            <p className="text-xs text-muted-foreground">Utilisez l'adresse qui a reçu l'invitation, puis revenez sur ce lien.</p>
          </div>
        )}
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    </main>
  );
}
