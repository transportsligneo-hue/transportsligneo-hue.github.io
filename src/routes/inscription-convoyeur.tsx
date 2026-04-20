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
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      console.log("[inscription-convoyeur] signUp →", form.email);
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role: "convoyeur",
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
          },
        },
      });

      if (signUpError) {
        console.error("[inscription-convoyeur] signUp error:", signUpError);
        const msg = signUpError.message || "";
        if (msg.includes("already registered") || msg.includes("already been registered")) {
          setError("Cette adresse email est déjà utilisée.");
        } else if (msg.toLowerCase().includes("rate limit") || /after \d+ second/i.test(msg)) {
          setError("Trop de tentatives récentes. Patientez 1 minute et réessayez.");
        } else {
          setError(`Erreur d'inscription : ${msg}`);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Erreur inattendue : aucun utilisateur créé.");
        setLoading(false);
        return;
      }

      const userId = authData.user.id;
      let permisPhotoUrl: string | null = null;

      // Upload permis (optionnel — n'empêche pas l'inscription si échoue)
      if (permisFile && authData.session) {
        try {
          const ext = permisFile.name.split(".").pop() || "jpg";
          const filePath = `${userId}/permis-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("convoyeur-permis")
            .upload(filePath, permisFile, { upsert: true });
          if (uploadError) {
            console.warn("[inscription-convoyeur] upload permis failed:", uploadError);
          } else {
            permisPhotoUrl = filePath;
          }
        } catch (uploadErr) {
          console.warn("[inscription-convoyeur] upload exception:", uploadErr);
        }
      }

      // Insert convoyeur record (le trigger handle_new_user a déjà créé profile + user_roles)
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
        console.error("[inscription-convoyeur] insert convoyeur error:", convError);
        setError(`Erreur d'enregistrement : ${convError.message}`);
        setLoading(false);
        return;
      }

      // Notification email (best-effort)
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
        console.warn("[inscription-convoyeur] email notification failed:", emailErr);
      }

      await supabase.auth.signOut();
      navigate({ to: "/attente-validation" });
    } catch (err) {
      console.error("[inscription-convoyeur] unexpected error:", err);
      setError(err instanceof Error ? `Erreur : ${err.message}` : "Une erreur inattendue est survenue.");
      setLoading(false);
    }
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

          {/* Permis officiel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <BadgeCheck size={12} className="inline mr-1" /> N° permis *
              </label>
              <input type="text" value={form.permis_numero} onChange={update("permis_numero")} className={inputClass} required placeholder="Ex: 1234567890123" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Calendar size={12} className="inline mr-1" /> Années d'expérience *
              </label>
              <input type="number" min="0" max="70" value={form.annees_experience} onChange={update("annees_experience")} className={inputClass} required placeholder="Ex: 10" />
            </div>
          </div>

          {/* Upload photo permis (optionnel) */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
              <Upload size={12} className="inline mr-1" /> Photo du permis (optionnel)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:uppercase file:tracking-wider file:cursor-pointer hover:file:bg-gold-light"
            />
            {permisFile && (
              <p className="text-primary text-xs mt-1">✓ {permisFile.name}</p>
            )}
            <p className="text-cream/30 text-xs mt-1">Format JPG, PNG ou PDF. Max 5 Mo. Ajoutable plus tard depuis votre espace.</p>
          </div>

          {/* Infos complémentaires */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <FileText size={12} className="inline mr-1" /> Infos complémentaires
              </label>
              <input type="text" value={form.permis} onChange={update("permis")} className={inputClass} placeholder="Ex: Permis B + EB" />
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
