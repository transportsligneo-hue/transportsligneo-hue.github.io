import { useState } from "react";
import { Phone, Mail, Globe, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type FormStatus = "idle" | "sending" | "success" | "error";
type Profil = "particulier" | "pro";

export default function Contact() {
  const [profil, setProfil] = useState<Profil>("particulier");
  const [form, setForm] = useState({
    nom: "", prenom: "", telephone: "", email: "", message: "",
    societe: "", siret: "", segment: "concessionnaire", volume: "",
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
SIRET / SIREN : ${form.siret || "non précisé"}
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
        societe: "", siret: "", segment: "concessionnaire", volume: "",
      });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="r4-page">
      <div className="v4-hero">
        <div className="v4-hero-eyebrow"><span className="dot" />Contact</div>
        <h1 className="v4-h1">Parlons de votre <span className="v4-accent">trajet</span>.</h1>
        <p className="v4-hero-p">Une question, un devis, un partenariat : notre équipe vous répond sous 24h.</p>
      </div>

      <div className="v4-split">
        <div className="v4-glass v4-contact-card">
          <span className="v4-status-badge"><span className="d" />Disponible 7j/7</span>
          <h3>Nous joindre</h3>
          <p>Un interlocuteur dédié, joignable directement. Réponse rapide et personnalisée.</p>

          <a href="tel:0782456181" className="v4-contact-row">
            <div className="v4-c-ic"><Phone size={18} /></div>
            <div><div className="v4-c-label">Téléphone</div><div className="v4-c-value">07 82 45 61 81</div></div>
          </a>
          <a href="mailto:contact@transportsligneo.fr" className="v4-contact-row">
            <div className="v4-c-ic"><Mail size={18} /></div>
            <div><div className="v4-c-label">Email</div><div className="v4-c-value">contact@transportsligneo.fr</div></div>
          </a>
          <a href="https://www.transportsligneo.fr" target="_blank" rel="noopener noreferrer" className="v4-contact-row">
            <div className="v4-c-ic"><Globe size={18} /></div>
            <div><div className="v4-c-label">Site</div><div className="v4-c-value">www.transportsligneo.fr</div></div>
          </a>

          <a href="tel:0782456181" className="v4-call-btn">Appeler maintenant</a>
        </div>

        <form onSubmit={handleSubmit} className="v4-glass v4-form-card">
          <div className="v4-form-tabs">
            <button type="button" className={`t ${profil === "particulier" ? "active" : ""}`} onClick={() => setProfil("particulier")}>Particulier</button>
            <button type="button" className={`t t-pro ${profil === "pro" ? "active" : ""}`} onClick={() => setProfil("pro")}>Professionnel</button>
          </div>
          <p className="intro">
            {profil === "pro"
              ? "Concessionnaire, loueur, assureur ? Demandez une offre volume sur-mesure."
              : "Une question, un devis, un trajet ponctuel : nous vous répondons rapidement."}
          </p>

          {status === "success" && (
            <div className="v4-field full" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "rgba(74,208,160,0.12)", border: "1px solid rgba(74,208,160,0.35)", color: "#a7ecc7", marginBottom: 16 }}>
              <CheckCircle size={18} /> Votre message a bien été envoyé. Nous vous répondrons rapidement.
            </div>
          )}
          {status === "error" && (
            <div className="v4-field full" style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, background: "rgba(255,99,99,0.12)", border: "1px solid rgba(255,99,99,0.35)", color: "#ffb0b0", marginBottom: 16 }}>
              <AlertCircle size={18} /> Une erreur est survenue. Veuillez réessayer ou nous contacter par téléphone.
            </div>
          )}

          {profil === "pro" && (
            <div className="v4-form-grid" style={{ marginBottom: 16 }}>
              <div className="v4-field">
                <label>Société <span className="req">*</span></label>
                <input type="text" name="societe" value={form.societe} onChange={handleChange} required maxLength={120} placeholder="Nom de la société" />
              </div>
              <div className="v4-field">
                <label>SIRET / SIREN</label>
                <input type="text" name="siret" value={form.siret} onChange={handleChange} maxLength={20} placeholder="14 chiffres (SIRET) ou 9 (SIREN)" inputMode="numeric" />
              </div>
              <div className="v4-field">
                <label>Type d'activité</label>
                <select name="segment" value={form.segment} onChange={handleChange}>
                  <option value="concessionnaire">Concessionnaire</option>
                  <option value="loueur">Loueur</option>
                  <option value="assureur">Assureur / Expert</option>
                  <option value="garage">Garage / Réparateur</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className="v4-field">
                <label>Volume mensuel</label>
                <input type="text" name="volume" value={form.volume} onChange={handleChange} maxLength={60} placeholder="Ex : 10 à 30 trajets" />
              </div>
            </div>
          )}

          <div className="v4-form-grid">
            <div className="v4-field">
              <label>Nom <span className="req">*</span></label>
              <input type="text" name="nom" value={form.nom} onChange={handleChange} required maxLength={60} placeholder="Votre nom" />
            </div>
            <div className="v4-field">
              <label>Prénom <span className="req">*</span></label>
              <input type="text" name="prenom" value={form.prenom} onChange={handleChange} required maxLength={60} placeholder="Votre prénom" />
            </div>
            <div className="v4-field">
              <label>Téléphone</label>
              <input type="tel" name="telephone" value={form.telephone} onChange={handleChange} maxLength={20} placeholder="06 12 34 56 78" />
            </div>
            <div className="v4-field">
              <label>Email {profil === "pro" ? "professionnel " : ""}<span className="req">*</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange} required maxLength={150} placeholder="vous@email.fr" />
            </div>
            <div className="v4-field full">
              <label>{profil === "pro" ? "Votre besoin " : "Message "}<span className="req">*</span></label>
              <textarea name="message" value={form.message} onChange={handleChange} required maxLength={2000}
                placeholder={profil === "pro" ? "Zones géographiques, types de véhicules, fréquence…" : "Décrivez votre besoin de convoyage…"} />
            </div>
          </div>

          <button type="submit" disabled={status === "sending"} className={`v4-submit-btn${profil === "pro" ? " is-pro" : ""}`}>
            {status === "sending" ? (<><Loader2 size={16} className="animate-spin" /> Envoi en cours…</>)
              : (<><Send size={14} /> {profil === "pro" ? "Envoyer ma demande pro" : "Envoyer mon message"}</>)}
          </button>
        </form>
      </div>
    </div>
  );
}
