import { Phone, Mail, Globe, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type FormStatus = "idle" | "sending" | "success" | "error";

export default function Contact() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "",
    depart: "", arrivee: "", date: "", type_vehicule: "", message: "",
  });
  const [status, setStatus] = useState<FormStatus>("idle");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: `${form.prenom} ${form.nom}`,
          from_email: form.email,
          phone: form.telephone,
          depart: form.depart,
          arrivee: form.arrivee,
          date: form.date,
          type_vehicule: form.type_vehicule,
          message: form.message,
        },
        EMAILJS_PUBLIC_KEY
      );
      setStatus("success");
      setForm({ nom: "", prenom: "", telephone: "", email: "", depart: "", arrivee: "", date: "", type_vehicule: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  const fields = [
    { name: "nom", label: "Nom *", type: "text", required: true },
    { name: "prenom", label: "Prénom *", type: "text", required: true },
    { name: "telephone", label: "Téléphone", type: "tel", required: false },
    { name: "email", label: "Email *", type: "email", required: true },
    { name: "depart", label: "Adresse de départ *", type: "text", required: true },
    { name: "arrivee", label: "Adresse d'arrivée *", type: "text", required: true },
    { name: "date", label: "Date du convoyage", type: "date", required: false },
  ];

  const vehicleTypes = ["Citadine", "Berline", "SUV", "Utilitaire", "Autre"];

  return (
    <section id="contact" className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Demander un devis
          </h2>
          <p className="text-cream/60 mt-4 text-sm tracking-wide">
            Remplissez le formulaire ci-dessous, nous vous recontactons sous 24h.
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

          {/* Formulaire */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="card-premium p-8 rounded space-y-5"
          >
            {status === "success" && (
              <div className="flex items-center gap-3 p-4 rounded bg-green-900/30 border border-green-500/30">
                <CheckCircle className="text-green-400 shrink-0" size={20} />
                <p className="text-green-300 text-sm">Votre demande a bien été envoyée. Nous vous recontactons rapidement.</p>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-center gap-3 p-4 rounded bg-red-900/30 border border-red-500/30">
                <AlertCircle className="text-red-400 shrink-0" size={20} />
                <p className="text-red-300 text-sm">Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.name} className={f.name === "depart" || f.name === "arrivee" ? "sm:col-span-2" : ""}>
                  <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    name={f.name}
                    value={form[f.name as keyof typeof form]}
                    onChange={handleChange}
                    required={f.required}
                    className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                Type de véhicule
              </label>
              <select
                name="type_vehicule"
                value={form.type_vehicule}
                onChange={handleChange}
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors appearance-none"
              >
                <option value="" className="bg-navy">Sélectionner...</option>
                {vehicleTypes.map((t) => (
                  <option key={t} value={t} className="bg-navy">{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                Message
              </label>
              <textarea
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={4}
                className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors resize-none"
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
                  Envoyer ma demande
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
