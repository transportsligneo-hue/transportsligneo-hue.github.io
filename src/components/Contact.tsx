import { motion } from "framer-motion";
import { Phone, Mail, Globe } from "lucide-react";
import { useState } from "react";

export default function Contact() {
  const [form, setForm] = useState({ nom: "", entreprise: "", telephone: "", email: "", message: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Merci pour votre demande. Nous vous recontactons rapidement.");
  };

  return (
    <section id="contact" className="py-24 section-bg-alt">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Contact
          </h2>
          <div className="gold-divider-short mt-4" />
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
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

            {/* Mobile CTA */}
            <a
              href="tel:0782456181"
              className="md:hidden inline-flex items-center gap-3 px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase"
            >
              <Phone size={16} />
              Appeler maintenant
            </a>
          </motion.div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="card-premium p-8 rounded space-y-5"
          >
            {[
              { name: "nom", label: "Nom", type: "text" },
              { name: "entreprise", label: "Entreprise", type: "text" },
              { name: "telephone", label: "Téléphone", type: "tel" },
              { name: "email", label: "Email", type: "email" },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  name={f.name}
                  value={form[f.name as keyof typeof form]}
                  onChange={handleChange}
                  required={f.name === "nom" || f.name === "email"}
                  className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
                />
              </div>
            ))}
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
              className="w-full px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300"
            >
              Envoyer ma demande
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
