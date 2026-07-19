import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Mail, Phone, Lock, CheckCircle, Building2, Hash, Car, MapPin } from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";

export const Route = createFileRoute("/inscription-flotte")({
  component: InscriptionFlotte,
  head: () => ({
    meta: [
      { title: "Inscription flotte & grand compte · Transports Ligneo" },
      { name: "description", content: "Inscription dédiée aux flottes : concessionnaires multi-sites, loueurs, partenaires assureurs. Tarifs négociés et dashboard flotte." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const VEHICLE_BUCKETS = [
  { value: "1-10", label: "1 à 10 véhicules / mois" },
  { value: "11-50", label: "11 à 50 véhicules / mois" },
  { value: "51-200", label: "51 à 200 véhicules / mois" },
  { value: "200+", label: "Plus de 200 véhicules / mois" },
];

const FREQUENCIES = [
  { value: "ponctuelle", label: "Ponctuelle" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "mensuelle", label: "Mensuelle régulière" },
  { value: "contrat", label: "Contrat-cadre annuel" },
];

function InscriptionFlotte() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    societe: "",
    siret: "",
    prenom: "",
    nom: "",
    fonction: "",
    email: "",
    telephone: "",
    password: "",
    volume: "11-50",
    frequence: "mensuelle",
    geographie: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  type Field = keyof typeof form;
  const update = (field: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.societe || !form.prenom || !form.nom || !form.email || !form.telephone || !form.password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      try {
        const token = await getRecaptchaToken("signup_flotte");
        if (token) {
          const r = await verifyRecaptcha({ data: { token, action: "signup_flotte", minScore: 0.3 } });
          if (!r.ok && !r.skipped) console.warn("[signup_flotte] recaptcha low score", r);
        }
      } catch (e) { console.warn("[signup_flotte] recaptcha error", e); }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role: "client",
            type_client: "flotte",
            nom: form.nom,
            prenom: form.prenom,
            telephone: form.telephone,
            societe: form.societe,
            siret: form.siret,
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

      // Crée un lead flotte (anonyme autorisé par RLS)
      try {
        const estVolume = (() => {
          const v = form.volume;
          if (v === "1-10") return 5;
          if (v === "11-50") return 30;
          if (v === "51-200") return 100;
          return 250;
        })();
        await supabase.from("b2b_fleet_leads").insert({
          numero: `FLEET-${Date.now().toString(36).toUpperCase()}`,
          need_type: "flotte",
          structure_type: "entreprise",
          estimated_vehicle_count: estVolume,
          frequency: form.frequence,
          geography: form.geographie || null,
          description: `Inscription Flotte: ${form.societe} · ${form.nom} ${form.prenom}${form.fonction ? ` (${form.fonction})` : ""} · ${form.email} / ${form.telephone}`,
        });
      } catch { /* non bloquant */ }

      if (authData.user && authData.session) {
        await supabase.from("profiles").update({
          telephone: form.telephone,
          nom: form.nom,
          prenom: form.prenom,
          societe: form.societe,
          siret: form.siret,
          type_client: "flotte",
        } as never).eq("user_id", authData.user.id);
      }

      setSuccess(true);
      if (authData.session) {
        setTimeout(() => navigate({ to: "/flotte" }), 1500);
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen section-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="gold-divider-short mx-auto" />
          <CheckCircle className="mx-auto text-primary" size={48} />
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">
            Compte flotte créé
          </h1>
          <p className="text-cream/70 text-sm">
            Vérifiez votre boîte mail pour confirmer votre adresse. Notre équipe commerciale vous contactera sous 24 h pour finaliser votre contrat-cadre.
          </p>
          <Link to="/login" className="inline-block text-primary text-sm hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Se connecter →
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
          <div className="gold-divider-short mx-auto mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">
            Inscription Flotte
          </h1>
          <p className="text-cream/50 text-sm mt-2">Grand compte · concessionnaires multi-sites, loueurs, assureurs</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium p-6 md:p-8 rounded space-y-5">
          {/* Société */}
          <div className="space-y-4 pb-4 border-b border-primary/10">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Building2 size={12} className="inline mr-1" /> Raison sociale *
              </label>
              <input type="text" value={form.societe} onChange={update("societe")} className={inputClass} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  <Hash size={12} className="inline mr-1" /> SIRET
                </label>
                <input type="text" value={form.siret} onChange={update("siret")} className={inputClass} placeholder="14 chiffres" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Fonction
                </label>
                <input type="text" value={form.fonction} onChange={update("fonction")} className={inputClass} placeholder="Resp. flotte, achats…" />
              </div>
            </div>
          </div>

          {/* Contact */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Mail size={12} className="inline mr-1" /> Email pro *
              </label>
              <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <Phone size={12} className="inline mr-1" /> Téléphone *
              </label>
              <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
            </div>
          </div>

          {/* Besoin flotte */}
          <div className="space-y-4 pt-4 border-t border-primary/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  <Car size={12} className="inline mr-1" /> Volume estimé
                </label>
                <select value={form.volume} onChange={update("volume")} className={inputClass}>
                  {VEHICLE_BUCKETS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  Fréquence
                </label>
                <select value={form.frequence} onChange={update("frequence")} className={inputClass}>
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                <MapPin size={12} className="inline mr-1" /> Zones géographiques
              </label>
              <input type="text" value={form.geographie} onChange={update("geographie")} className={inputClass} placeholder="Ex : Île-de-France + Centre-Val de Loire" />
            </div>
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
            {loading ? "Création..." : "Créer mon compte flotte"}
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
