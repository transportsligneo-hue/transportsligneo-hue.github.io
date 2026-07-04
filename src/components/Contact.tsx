import { Phone, Mail, Globe, Send, CheckCircle, AlertCircle, Loader2, User, Building2 } from "lucide-react";
import { useState } from "react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type FormStatus = "idle" | "sending" | "success" | "error";
type Profil = "particulier" | "pro";

const inputCls =
  "w-full bg-white border border-[#0b1026]/15 rounded-xl px-4 py-3 text-[#0b1026] text-sm focus:border-[#d4af37] focus:ring-2 focus:ring-[#e7c76a]/30 focus:outline-none transition-all";
const labelCls = "block text-[10.5px] uppercase tracking-[0.22em] text-[#0b1026]/55 font-heading mb-2";

export default function Contact() {
  const [profil, setProfil] = useState<Profil>("particulier");
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "", message: "",
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
      const messageL = form.message.toLowerCase();
      let type_demande: "convoyage" | "devis" | "b2b" | "partenariat" = "convoyage";
      if (profil === "pro") {
        type_demande = "b2b";
      } else if (messageL.includes("partenariat") || messageL.includes("partenaire")) {
        type_demande = "partenariat";
      } else if (messageL.includes("devis") || messageL.includes("tarif") || messageL.includes("prix")) {
        type_demande = "devis";
      }

      const { error: dbError } = await supabase.from("contact_messages").insert({
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        telephone: form.telephone,
        profil,
        societe: profil === "pro" ? form.societe : "",
        segment: profil === "pro" ? form.segment : "",
        volume: profil === "pro" ? form.volume : "",
        message: form.message,
        type_demande,
      });
      if (dbError) throw dbError;

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
    <>
      {/* ===== HERO navy ===== */}
      <section
        className="relative overflow-hidden pt-28 pb-28 lg:pt-36 lg:pb-32"
        style={{ background: "linear-gradient(160deg, #061238 0%, #0a1f5c 50%, #0f2d80 100%)" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%)" }} />
        <div aria-hidden className="cyber-aurora" />
        <div aria-hidden className="cyber-grid opacity-60" />
        <div aria-hidden className="cyber-scanline" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="cyber-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] font-heading">
            Contact
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Parlons de votre <span className="cyber-title-accent">trajet.</span>
          </h1>

          <p className="text-cream/70 mt-6 text-base lg:text-lg leading-relaxed">
            Une question, un devis, un partenariat : notre équipe vous répond sous 24h.
          </p>
        </div>

        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)" />
          </svg>
        </div>
      </section>

      {/* ===== Coordonnées + formulaire — section cream ===== */}
      <section id="contact" className="py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-[1fr_1.3fr] gap-10 lg:gap-14">
            {/* Coordonnées */}
            <div className="space-y-6">
              <div>
                <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">Nous joindre</span>
                <h2 className="font-heading text-2xl lg:text-3xl text-[#0b1026] mt-3">
                  Disponible 7j/7
                </h2>
                <p className="text-[#0b1026]/65 text-[14.5px] leading-relaxed mt-3">
                  Un interlocuteur dédié, joignable directement. Réponse rapide et personnalisée.
                </p>
              </div>

              <div className="space-y-3">
                <a href="tel:0782456181" className="card-premium-light flex items-center gap-4 p-5 group hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b] flex items-center justify-center shrink-0">
                    <Phone size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#0b1026]/50 text-[10px] uppercase tracking-[0.22em] font-heading">Téléphone</p>
                    <p className="text-[#0b1026] text-[17px] font-heading tracking-wide mt-0.5">07 82 45 61 81</p>
                  </div>
                </a>

                <a href="mailto:contact@transportsligneo.fr" className="card-premium-light flex items-center gap-4 p-5 group hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b] flex items-center justify-center shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#0b1026]/50 text-[10px] uppercase tracking-[0.22em] font-heading">Email</p>
                    <p className="text-[#0b1026] text-[15px] font-heading tracking-wide mt-0.5 truncate">contact@transportsligneo.fr</p>
                  </div>
                </a>

                <a href="https://www.transportsligneo.fr" target="_blank" rel="noopener noreferrer" className="card-premium-light flex items-center gap-4 p-5 group hover:-translate-y-0.5 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b] flex items-center justify-center shrink-0">
                    <Globe size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[#0b1026]/50 text-[10px] uppercase tracking-[0.22em] font-heading">Site</p>
                    <p className="text-[#0b1026] text-[15px] font-heading tracking-wide mt-0.5">www.transportsligneo.fr</p>
                  </div>
                </a>
              </div>

              <a
                href="tel:0782456181"
                className="md:hidden inline-flex items-center justify-center gap-3 w-full px-8 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300"
              >
                <Phone size={14} />
                Appeler maintenant
              </a>
            </div>

            {/* Formulaire */}
            <form
              onSubmit={handleSubmit}
              className="card-premium-light p-7 lg:p-9 space-y-5"
            >
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0b1026]/[0.04] border border-[#0b1026]/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setProfil("particulier")}
                  className={`flex items-center justify-center gap-2 py-2.5 text-[11px] tracking-[0.22em] uppercase font-heading transition-all rounded-lg ${
                    profil === "particulier"
                      ? "bg-[#0b1026] text-[#e7c76a] shadow-[0_4px_16px_-4px_rgba(11,16,38,0.4)]"
                      : "text-[#0b1026]/55 hover:text-[#0b1026]"
                  }`}
                >
                  <User size={13} />
                  Particulier
                </button>
                <button
                  type="button"
                  onClick={() => setProfil("pro")}
                  className={`flex items-center justify-center gap-2 py-2.5 text-[11px] tracking-[0.22em] uppercase font-heading transition-all rounded-lg ${
                    profil === "pro"
                      ? "bg-[#0b1026] text-[#e7c76a] shadow-[0_4px_16px_-4px_rgba(11,16,38,0.4)]"
                      : "text-[#0b1026]/55 hover:text-[#0b1026]"
                  }`}
                >
                  <Building2 size={13} />
                  Professionnel
                </button>
              </div>

              <p className="text-[#0b1026]/55 text-[12.5px] leading-relaxed">
                {profil === "pro"
                  ? "Concessionnaire, loueur, assureur ? Demandez une offre volume sur-mesure."
                  : "Une question, un devis, un trajet ponctuel : nous vous répondons rapidement."}
              </p>

              {status === "success" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <CheckCircle className="text-emerald-600 shrink-0" size={18} />
                  <p className="text-emerald-800 text-sm">Votre message a bien été envoyé. Nous vous répondrons rapidement.</p>
                </div>
              )}

              {status === "error" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle className="text-red-600 shrink-0" size={18} />
                  <p className="text-red-800 text-sm">Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.</p>
                </div>
              )}

              {profil === "pro" && (
                <div className="space-y-4 p-5 rounded-xl border border-[#e7c76a]/30 bg-[#e7c76a]/[0.05]">
                  <div>
                    <label className={labelCls}>Société *</label>
                    <input type="text" name="societe" value={form.societe} onChange={handleChange} required={profil === "pro"} maxLength={120} className={inputCls} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Type d'activité</label>
                      <select name="segment" value={form.segment} onChange={handleChange} className={inputCls}>
                        <option value="concessionnaire">Concessionnaire</option>
                        <option value="loueur">Loueur</option>
                        <option value="assureur">Assureur / Expert</option>
                        <option value="garage">Garage / Réparateur</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Volume mensuel</label>
                      <input type="text" name="volume" value={form.volume} onChange={handleChange} maxLength={60} placeholder="Ex : 10 à 30 trajets" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input type="text" name="nom" value={form.nom} onChange={handleChange} required maxLength={60} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Prénom *</label>
                  <input type="text" name="prenom" value={form.prenom} onChange={handleChange} required maxLength={60} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input type="tel" name="telephone" value={form.telephone} onChange={handleChange} maxLength={20} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email {profil === "pro" ? "professionnel " : ""}*</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} required maxLength={150} className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>{profil === "pro" ? "Votre besoin *" : "Message *"}</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  maxLength={2000}
                  className={inputCls + " resize-none"}
                  placeholder={profil === "pro" ? "Zones géographiques, types de véhicules, fréquence..." : "Votre message..."}
                />
              </div>

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[12px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300 disabled:opacity-60"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    {profil === "pro" ? "Envoyer ma demande pro" : "Envoyer mon message"}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
