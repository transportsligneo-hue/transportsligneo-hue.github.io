import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, User, Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/inscription-convoyeur")({
  component: InscriptionConvoyeur,
  head: () => ({
    meta: [
      { title: "Devenir convoyeur — Transports Ligneo" },
      { name: "description", content: "Rejoignez l'équipe Transports Ligneo en tant que convoyeur automobile. Inscription rapide, validation par notre équipe." },
    ],
  }),
});

function InscriptionConvoyeur() {
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.nom || !form.prenom || !form.email || !form.telephone) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    try {
      // Create auth account (email confirmation required)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: crypto.randomUUID().slice(0, 16) + "Aa1!",
        options: { data: { role: "convoyeur", nom: form.nom, prenom: form.prenom } },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("Cette adresse email est déjà utilisée.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Create convoyeur record (status: en_attente = pending admin validation)
        await supabase.from("convoyeurs").insert({
          user_id: authData.user.id,
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone,
          statut: "en_attente",
        });

        // Assign convoyeur role
        await supabase.from("user_roles").insert({
          user_id: authData.user.id,
          role: "convoyeur" as const,
        });
      }

      setSuccess(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen section-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="gold-divider-short" />
          <CheckCircle className="mx-auto text-green-400" size={48} />
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
            Inscription envoyée !
          </h1>
          <p className="text-cream/70 text-sm">
            Merci pour votre candidature. Un email de confirmation vous a été envoyé.
            Notre équipe validera votre profil dans les meilleurs délais.
          </p>
          <Link to="/" className="inline-block text-primary text-sm hover:text-gold-light transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
            Devenir convoyeur
          </h1>
          <p className="text-cream/50 text-sm mt-2">
            Rejoignez notre réseau de convoyeurs professionnels
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-6 md:p-8 rounded space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Prénom *
              </label>
              <input
                type="text"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <User size={12} className="inline mr-1" /> Nom *
              </label>
              <input
                type="text"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Mail size={12} className="inline mr-1" /> Email *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Phone size={12} className="inline mr-1" /> Téléphone *
            </label>
            <input
              type="tel"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Message (optionnel)</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={3}
              className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none resize-none"
              placeholder="Présentez-vous brièvement..."
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
            {loading ? "Envoi en cours..." : "S'inscrire comme convoyeur"}
          </button>

          <p className="text-cream/30 text-xs text-center">
            Votre inscription sera soumise à validation par notre équipe.
          </p>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
