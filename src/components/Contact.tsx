import { Phone, Mail, Globe, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";
import AddressAutocomplete from "./AddressAutocomplete";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type FormStatus = "idle" | "sending" | "success" | "error";

export default function Contact() {
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "",
    depart: "", arrivee: "", date: "", heure: "",
    marque: "", modele: "", immatriculation: "", carburant: "", options: "",
    message: "",
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
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone,
          email: form.email,
          depart: form.depart,
          arrivee: form.arrivee,
          date: form.date,
          heure: form.heure,
          marque: form.marque,
          modele: form.modele,
          immatriculation: form.immatriculation,
          carburant: form.carburant,
          options: form.options,
          message: form.message,
        },
        EMAILJS_PUBLIC_KEY
      );
      setStatus("success");
      setForm({ nom: "", prenom: "", telephone: "", email: "", depart: "", arrivee: "", date: "", heure: "", marque: "", modele: "", immatriculation: "", carburant: "", options: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  const personalFields = [
    { name: "nom", label: "Nom *", type: "text", required: true },
    { name: "prenom", label: "Prénom *", type: "text", required: true },
    { name: "telephone", label: "Téléphone", type: "tel", required: false },
    { name: "email", label: "Email *", type: "email", required: true },
  ];

  const handleFieldChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const trajetFields = [
    { name: "date", label: "Date souhaitée", type: "date", required: false },
  ];

  const heureOptions = Array.from({ length: 29 }, (_, i) => {
    const h = Math.floor(i / 2) + 7;
    const m = i % 2 === 0 ? "00" : "30";
    return `${String(h).padStart(2, "0")}:${m}`;
  });

  const vehicleFields = [
    { name: "marque", label: "Marque", type: "text", required: false },
    { name: "modele", label: "Modèle", type: "text", required: false },
    { name: "immatriculation", label: "Immatriculation", type: "text", required: false },
  ];

  const carburantTypes = ["Essence", "Diesel", "Hybride", "Électrique", "Autre"];

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

            {/* Informations personnelles */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading">Informations personnelles</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personalFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">{f.label}</label>
                  <input type={f.type} name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange} required={f.required} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
                </div>
              ))}
            </div>

            {/* Trajet */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading pt-2">Trajet demandé</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AddressAutocomplete
                name="depart"
                label="Adresse de départ *"
                value={form.depart}
                onChange={handleFieldChange}
                required
              />
              <AddressAutocomplete
                name="arrivee"
                label="Adresse d'arrivée *"
                value={form.arrivee}
                onChange={handleFieldChange}
                required
              />
              {trajetFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">{f.label}</label>
                  <input type={f.type} name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange} required={f.required} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Heure souhaitée</label>
                <select name="heure" value={form.heure} onChange={handleChange} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors appearance-none">
                  <option value="" className="bg-navy">Sélectionner un horaire...</option>
                  {heureOptions.map((h) => (
                    <option key={h} value={h} className="bg-navy">{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Véhicule */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading pt-2">Informations véhicule</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicleFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">{f.label}</label>
                  <input type={f.type} name={f.name} value={form[f.name as keyof typeof form]} onChange={handleChange} required={f.required} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors" />
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Carburant</label>
                <select name="carburant" value={form.carburant} onChange={handleChange} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors appearance-none">
                  <option value="" className="bg-navy">Sélectionner...</option>
                  {carburantTypes.map((t) => (<option key={t} value={t} className="bg-navy">{t}</option>))}
                </select>
              </div>
            </div>

            {/* Options & Message */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading pt-2">Informations complémentaires</p>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Options / précisions véhicule</label>
              <textarea name="options" value={form.options} onChange={handleChange} rows={2} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors resize-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Message</label>
              <textarea name="message" value={form.message} onChange={handleChange} rows={3} className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors resize-none" />
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
