import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Mail, Phone, Lock } from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";
import { notifyAdmin } from "@/lib/admin-notifications";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/inscription-client")({
  component: InscriptionClient,
  head: () => ({
    meta: [
      { title: "Inscription client — Transports Ligneo" },
      { name: "description", content: "Créez votre compte client pour réserver vos convoyages en toute simplicité." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InscriptionClient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    prenom: "", nom: "", email: "", telephone: "", password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.prenom || !form.nom || !form.email || !form.telephone || !form.password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      try {
        const token = await getRecaptchaToken("signup_client");
        if (token) {
          const r = await verifyRecaptcha({ data: { token, action: "signup_client", minScore: 0.3 } });
          if (!r.ok && !r.skipped) console.warn("[signup_client] recaptcha low score", r);
        }
      } catch (e) { console.warn("[signup_client] recaptcha error", e); }
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/email-confirmation`,
          data: {
            role: "client",
            type_client: "particulier",
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message.includes("already registered")
          ? "Cette adresse email est déjà utilisée."
          : signUpError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Le trigger handle_new_user crée automatiquement profile + user_roles.
        // On met juste à jour le téléphone si l'utilisateur a une session active.
        if (authData.session) {
          await supabase.from("profiles").update({
            telephone: form.telephone,
            nom: form.nom,
            prenom: form.prenom,
          }).eq("user_id", authData.user.id);
        }

        // Notification admin (push + visible /admin)
        void notifyAdmin({
          type: "client_action",
          titre: "Nouvelle inscription client",
          message: `${form.prenom} ${form.nom} — ${form.email}`,
          link: "/admin/clients",
          entityType: "user",
          entityId: authData.user.id,
        });

        // Email de bienvenue (best-effort, fixed-to admin not required car welcome a recipientEmail)
        if (authData.session) {
          void sendTransactionalEmail({
            templateName: "welcome-client",
            recipientEmail: form.email,
            idempotencyKey: `welcome-${authData.user.id}`,
            templateData: { prenom: form.prenom },
          }).catch(() => {});
        }



        setSuccess(true);
        if (authData.session) {
          setTimeout(() => navigate({ to: "/dashboard-client" }), 1500);
        }
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen section-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5 card-premium p-8 rounded">
          <div className="gold-divider-short mx-auto" />
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Mail className="text-primary" size={28} />
          </div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
            Vérifiez votre email
          </h1>
          <p className="text-cream/70 text-sm leading-relaxed">
            Nous venons d'envoyer un lien de confirmation à <span className="text-primary font-medium">{form.email}</span>.
            Cliquez dessus pour activer votre compte, puis revenez vous connecter.
          </p>
          <div className="text-cream/40 text-xs space-y-1 pt-2 border-t border-primary/10">
            <p>Pas reçu ? Vérifiez vos spams.</p>
            <p>Le lien expire dans 24 heures.</p>
          </div>
          <Link to="/login" className="inline-block text-primary text-sm hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Aller à la connexion →
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="gold-divider-short mx-auto mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
            Inscription client
          </h1>
          <p className="text-cream/50 text-sm mt-2">Créez votre espace réservation</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-6 md:p-8 rounded space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Prénom *
              </label>
              <input type="text" value={form.prenom} onChange={update("prenom")} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Nom *
              </label>
              <input type="text" value={form.nom} onChange={update("nom")} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Mail size={12} className="inline mr-1" /> Email *
            </label>
            <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Phone size={12} className="inline mr-1" /> Téléphone *
            </label>
            <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Lock size={12} className="inline mr-1" /> Mot de passe *
            </label>
            <input type="password" value={form.password} onChange={update("password")} className={inputClass} required minLength={8} placeholder="Minimum 8 caractères" />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <div className="text-center mt-6 space-y-3">
          <p className="text-[10px] leading-relaxed text-cream/40 px-2">
            Protégé par reCAPTCHA et soumis à la{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Politique de Confidentialité</a>
            {" "}et aux{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Termes d'Utilisation</a>
            {" "}de Google.
          </p>
          <Link to="/login" className="block text-primary text-xs hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/choisir-compte" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Choisir un autre type de compte
          </Link>
        </div>
      </div>
    </div>
  );
}
