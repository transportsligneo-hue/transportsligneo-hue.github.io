import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { Loader2, CheckCircle, User, Mail, Phone, MapPin, Calendar, FileText, Lock, Upload, BadgeCheck } from "lucide-react";

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
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", telephone: "",
    password: "", ville: "", disponibilite: "", permis: "", message: "",
    permis_numero: "", annees_experience: "",
  });
  const [permisFile, setPermisFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("La photo du permis ne doit pas dépasser 5 Mo.");
        return;
      }
      setPermisFile(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.nom || !form.prenom || !form.email || !form.telephone || !form.password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!form.permis_numero || !form.annees_experience) {
      setError("Le numéro de permis et les années d'expérience sont obligatoires.");
      return;
    }
    if (!permisFile) {
      setError("Veuillez ajouter une photo de votre permis de conduire.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { role: "convoyeur", nom: form.nom, prenom: form.prenom },
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
        const userId = authData.user.id;
        let permisPhotoUrl: string | null = null;

        // Upload permis photo (requires session — works if email auto-confirm enabled)
        if (authData.session) {
          const ext = permisFile.name.split(".").pop() || "jpg";
          const filePath = `${userId}/permis-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("convoyeur-permis")
            .upload(filePath, permisFile, { upsert: true });
          if (!uploadError) {
            permisPhotoUrl = filePath;
          } else {
            console.error("Upload permis:", uploadError);
          }
        }

        const { error: convError } = await supabase.from("convoyeurs").insert({
          user_id: userId,
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone,
          ville: form.ville,
          disponibilite: form.disponibilite,
          permis: form.permis,
          message: form.message,
          permis_numero: form.permis_numero,
          annees_experience: parseInt(form.annees_experience, 10) || 0,
          permis_photo_url: permisPhotoUrl,
          statut: "en_attente",
        });

        if (convError) {
          console.error("Erreur insertion convoyeur:", convError);
          setError("Erreur lors de l'enregistrement. Veuillez réessayer.");
          setLoading(false);
          return;
        }

        await supabase.from("user_roles").insert({
          user_id: userId,
          role: "convoyeur" as const,
        });

        try {
          await sendTransactionalEmail({
            templateName: "inscription-convoyeur",
            recipientEmail: "contact@transportsligneo.fr",
            idempotencyKey: `inscription-${userId}`,
            templateData: {
              prenom: form.prenom, nom: form.nom, email: form.email,
              telephone: form.telephone, ville: form.ville,
            },
          });
        } catch (emailErr) {
          console.error("Erreur envoi email notification:", emailErr);
        }

        await supabase.auth.signOut();
      }

      navigate({ to: "/attente-validation" });
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
    setLoading(false);
  };

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

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
          {/* Identité */}
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

          {/* Contact */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Mail size={12} className="inline mr-1" /> Email *
            </label>
            <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Phone size={12} className="inline mr-1" /> Téléphone *
              </label>
              <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <MapPin size={12} className="inline mr-1" /> Ville
              </label>
              <input type="text" value={form.ville} onChange={update("ville")} className={inputClass} placeholder="Ex: Tours" />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Lock size={12} className="inline mr-1" /> Mot de passe *
            </label>
            <input type="password" value={form.password} onChange={update("password")} className={inputClass} required minLength={8} placeholder="Minimum 8 caractères" />
          </div>

          {/* Infos pro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <FileText size={12} className="inline mr-1" /> Permis / infos
              </label>
              <input type="text" value={form.permis} onChange={update("permis")} className={inputClass} placeholder="Ex: Permis B, 10 ans" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Calendar size={12} className="inline mr-1" /> Disponibilité
              </label>
              <select value={form.disponibilite} onChange={update("disponibilite")} className={inputClass}>
                <option value="">Non précisé</option>
                <option value="temps_plein">Temps plein</option>
                <option value="temps_partiel">Temps partiel</option>
                <option value="weekend">Weekends</option>
                <option value="ponctuel">Ponctuel</option>
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Message (optionnel)</label>
            <textarea
              value={form.message} onChange={update("message")}
              rows={3} className={`${inputClass} resize-none`}
              placeholder="Présentez-vous brièvement..."
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : null}
            {loading ? "Envoi en cours..." : "S'inscrire comme convoyeur"}
          </button>

          <p className="text-cream/30 text-xs text-center">
            Votre inscription sera soumise à validation par notre équipe.
          </p>
        </form>

        <div className="text-center mt-6 space-y-2">
          <Link to="/login" className="block text-primary text-xs hover:text-gold-light transition-colors">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}
