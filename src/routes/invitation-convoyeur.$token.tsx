import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invitation-convoyeur/$token")({
  ssr: false,
  component: InvitationConvoyeurPage,
  head: () => ({
    meta: [
      { title: "Créer mon compte convoyeur | Transports Ligneo" },
      {
        name: "description",
        content:
          "Finalisez votre invitation et créez votre compte convoyeur Transports Ligneo en quelques secondes.",
      },
      { property: "og:title", content: "Créer mon compte convoyeur | Transports Ligneo" },
      {
        property: "og:description",
        content: "Invitation personnelle pour rejoindre les convoyeurs Transports Ligneo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface InvitationInfo {
  email: string;
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  status: string;
  expired: boolean;
}

function InvitationConvoyeurPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [telephone, setTelephone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("get_convoyeur_invitation" as never, {
        _token: token,
      } as never);
      const row = Array.isArray(data) ? (data[0] as InvitationInfo | undefined) : undefined;
      if (rpcError || !row) setInvitation(null);
      else {
        setInvitation(row);
        setTelephone(row.telephone ?? "");
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!invitation) return;
    setError("");
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");
    setSubmitting(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: {
            role: "convoyeur",
            nom: invitation.nom,
            prenom: invitation.prenom,
            telephone,
            type_convoyeur: "independant",
          },
        },
      });
      if (signUpError) {
        const msg = signUpError.message || "";
        if (msg.toLowerCase().includes("already")) {
          // Compte déjà existant : on tente une connexion pour rattacher l'invitation
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          });
          if (signInError) {
            setError("Un compte existe déjà avec cet email. Connectez-vous pour finaliser.");
            setSubmitting(false);
            return;
          }
        } else {
          setError(`Erreur : ${msg}`);
          setSubmitting(false);
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await supabase.auth.signInWithPassword({ email: invitation.email, password }).catch(() => null);
      }

      const { data: result, error: acceptError } = await supabase.rpc(
        "accept_convoyeur_invitation" as never,
        { _token: token } as never,
      );
      const res = result as { ok?: boolean; error?: string } | null;
      if (acceptError || !res?.ok) {
        setError(
          res?.error === "email_non_correspondant"
            ? "L'adresse email de votre compte ne correspond pas à l'invitation."
            : "Impossible de finaliser l'invitation. Contactez notre équipe.",
        );
        setSubmitting(false);
        return;
      }

      setDone(true);
      toast.success("Compte créé — bienvenue chez Transports Ligneo !");
      setTimeout(() => navigate({ to: "/convoyeur" }), 1400);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050b1f] text-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 shadow-2xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-lg font-semibold tracking-wide">
            TRANSPORTS <span className="text-[#4d8bff]">LIGNEO</span>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/70 py-8">
            <Loader2 className="animate-spin" size={18} /> Vérification de l'invitation…
          </div>
        ) : !invitation ? (
          <InvalidState message="Cette invitation est introuvable." />
        ) : invitation.status === "accepted" ? (
          <InvalidState message="Cette invitation a déjà été utilisée. Connectez-vous à votre compte." />
        ) : invitation.status !== "pending" || invitation.expired ? (
          <InvalidState message="Cette invitation a expiré ou a été annulée. Demandez-en une nouvelle à notre équipe." />
        ) : done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="mx-auto text-emerald-400 mb-3" size={40} />
            <h1 className="text-xl font-semibold mb-1">Compte créé</h1>
            <p className="text-white/60 text-sm">Redirection vers votre espace convoyeur…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-1">Créer mon compte</h1>
            <p className="text-white/60 text-sm mb-6">
              Invitation personnelle pour rejoindre les convoyeurs Transports Ligneo.
            </p>

            <div className="space-y-3">
              <Field label="Email">
                <input
                  value={invitation.email}
                  readOnly
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/70"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prénom">
                  <input
                    value={invitation.prenom ?? ""}
                    readOnly
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/70"
                  />
                </Field>
                <Field label="Nom">
                  <input
                    value={invitation.nom ?? ""}
                    readOnly
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white/70"
                  />
                </Field>
              </div>
              <Field label="Téléphone">
                <input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-[#4d8bff]"
                />
              </Field>
              <Field label="Mot de passe">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-[#4d8bff]"
                />
              </Field>
              <Field label="Confirmer le mot de passe">
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-[#4d8bff]"
                />
              </Field>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-300 flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-[#0066ff] hover:bg-[#0a5be0] transition-colors py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Créer mon compte convoyeur
            </button>

            <p className="mt-4 text-center text-xs text-white/45">
              Déjà un compte ?{" "}
              <Link to="/login" className="text-[#4d8bff] hover:underline">
                Se connecter
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-white/45 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function InvalidState({ message }: { message: string }) {
  return (
    <div className="text-center py-6">
      <AlertTriangle className="mx-auto text-amber-400 mb-3" size={36} />
      <h1 className="text-lg font-semibold mb-1">Invitation indisponible</h1>
      <p className="text-white/60 text-sm mb-5">{message}</p>
      <Link
        to="/login"
        className="inline-block rounded-xl bg-[#0066ff] px-5 py-2.5 text-sm font-semibold"
      >
        Aller à la connexion
      </Link>
    </div>
  );
}
