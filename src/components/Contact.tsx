import { Phone, Mail, Globe, Send, CheckCircle, AlertCircle, Loader2, User, Building2 } from "lucide-react";
import { useState } from "react";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type FormStatus = "idle" | "sending" | "success" | "error";
type Profil = "particulier" | "pro";

export default function Contact() {
  const [profil, setProfil] = useState<Profil>("particulier");
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "", message: "",
    // Pro uniquement
    societe: "", segment: "concessionnaire", volume: "",
  });
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    const messageEnrichi =
      profil === "pro"
        ? `[B2B - ${form.segment.toUpperCase()}]
Société : ${form.societe}
Volume mensuel estimé : ${form.volume || "non précisé"}

${form.message}`
        : `[PARTICULIER]

${form.message}`;

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone,
          email: form.email,
          message: messageEnrichi,
          profil: profil === "pro" ? "Professionnel" : "Particulier",
          societe: form.societe,
        },
        EMAILJS_PUBLIC_KEY
      );
      setStatus("success");
      setForm({
        nom: "", prenom: "", telephone: "", email: "", message: "",
        societe: "", segment: "concessionnaire", volume: "",
      });
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Formulaire de contact
          </h2>
          <p className="text-cream/60 mt-4 text-sm tracking-wide">
            Une question ? Contactez-nous, nous vous répondons sous 24h.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Infos de contact */}
          <div className="space-y-8">
            <div className="space-y-6">
              <a href="tel:0782456181" className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-full gold-border flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Phone className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-cream/50 text-xs uppercase tracking-wider">Téléphone</p>
                  <p className="text-cream text-lg">07 82 45 61 81</p>
                </div>
              </a>

              <a href="mailto:contact@transportsligneo.fr" className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-full gold-border flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Mail className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-cream/50 text-xs uppercase tracking-wider">Email</p>
                  <p className="text-cream text-lg">contact@transportsligneo.fr</p>
                </div>
              </a>

              <a href="https://www.transportsligneo.fr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-full gold-border flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Globe className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-cream/50 text-xs uppercase tracking-wider">Site</p>
                  <p className="text-cream text-lg">www.transportsligneo.fr</p>
                </div>
              </a>
            </div>

            <a
              href="tel:0782456181"
              className="md:hidden inline-flex items-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase"
            >
              <Phone size={16} />
              Appeler maintenant
            </a>
          </div>

          {/* Formulaire avec sélecteur profil */}
          <form
            onSubmit={handleSubmit}
            className="card-premium p-6 md:p-8 rounded space-y-5"
          >
            {/* Tabs Particulier / Pro */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-navy/60 border border-primary/20 rounded">
              <button
                type="button"
                onClick={() => setProfil("particulier")}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs tracking-[0.15em] uppercase font-heading transition-all rounded ${
                  profil === "particulier"
                    ? "bg-primary text-primary-foreground"
                    : "text-cream/55 hover:text-cream"
                }`}
              >
                <User size={14} />
                Particulier
              </button>
              <button
                type="button"
                onClick={() => setProfil("pro")}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs tracking-[0.15em] uppercase font-heading transition-all rounded ${
                  profil === "pro"
                    ? "bg-primary text-primary-foreground"
                    : "text-cream/55 hover:text-cream"
                }`}
              >
                <Building2 size={14} />
                Professionnel
              </button>
            </div>

            <p className="text-cream/45 text-xs leading-relaxed -mt-1">
              {profil === "pro"
                ? "Concessionnaire, loueur, assureur ? Demandez une offre volume sur-mesure."
                : "Une question, un devis, un trajet ponctuel : nous vous répondons rapidement."}
            </p>

            {status === "success" && (
              <div className="flex items-center gap-3 p-4 rounded bg-green-900/30 border border-green-500/30">
                <CheckCircle className="text-green-400 shrink-0" size={20} />
                <p className="text-green-300 text-sm">Votre message a bien été envoyé. Nous vous répondrons rapidement.</p>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-3 p-4 rounded bg-red-900/30 border border-red-500/30">
                <AlertCircle className="text-red-400 shrink-0" size={20} />
                <p className="text-red-300 text-sm">Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.</p>
              </div>
            )}

            {/* Champs spécifiques PRO */}
            {profil === "pro" && (
              <div className="space-y-4 p-4 rounded border border-primary/15 bg-primary/5">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Société *</label>
                  <input
                    type="text"
                    name="societe"
                    value={form.societe}
                    onChange={handleChange}
                    required={profil === "pro"}
                    maxLength={120}
                    className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Type d'activité</label>
                    <select
                      name="segment"
                      value={form.segment}
                      onChange={handleChange}
                      className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                    >
                      <option value="concessionnaire">Concessionnaire</option>
                      <option value="loueur">Loueur</option>
                      <option value="assureur">Assureur / Expert</option>
                      <option value="garage">Garage / Réparateur</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Volume mensuel</label>
                    <input
                      type="text"
                      name="volume"
                      value={form.volume}
                      onChange={handleChange}
                      maxLength={60}
                      placeholder="Ex : 10 à 30 trajets"
                      className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary/60 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Identité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Nom *</label>
                <input type="text" name="nom" value={form.nom} onChange={handleChange} required maxLength={60} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Prénom *</label>
                <input type="text" name="prenom" value={form.prenom} onChange={handleChange} required maxLength={60} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Téléphone</label>
                <input type="tel" name="telephone" value={form.telephone} onChange={handleChange} maxLength={20} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                  Email {profil === "pro" ? "professionnel " : ""}*
                </label>
                <input type="email" name="email" value={form.email} onChange={handleChange} required maxLength={150} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                {profil === "pro" ? "Votre besoin *" : "Message *"}
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                required
                rows={4}
                maxLength={2000}
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors resize-none"
                placeholder={
                  profil === "pro"
                    ? "Zones géographiques, types de véhicules, fréquence..."
                    : "Votre message..."
                }
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300 disabled:opacity-60"
            >
              {status === "sending" ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} />
                  {profil === "pro" ? "Envoyer ma demande pro" : "Envoyer mon message"}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
