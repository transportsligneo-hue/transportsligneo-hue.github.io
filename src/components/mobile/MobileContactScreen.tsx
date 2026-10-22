import { useEffect, useState } from "react";
import { Briefcase, Building2, CheckCircle2, Globe, Mail, Phone, Send, User, AlertCircle } from "lucide-react";
import emailjs from "@emailjs/browser";
import { supabase } from "@/integrations/supabase/client";
import { faqs } from "@/components/FAQ";
import MobileFooter from "@/components/mobile/MobileFooter";
import { PageHero } from "@/components/mobile/MobilePageBits";

const EMAILJS_SERVICE_ID = "service_ctxuphf";
const EMAILJS_TEMPLATE_ID = "template_g0a5cad";
const EMAILJS_PUBLIC_KEY = "tTvDX_OgATR0pXFUr";

type Profil = "particulier" | "pro";
type Status = "idle" | "sending" | "success" | "error";
const EMPTY = { nom: "", prenom: "", telephone: "", email: "", message: "", societe: "", siret: "", segment: "concessionnaire", volume: "" };

/** Contact mobile · gros boutons d'action + formulaire clair + FAQ. Même envoi que la version PC. */
export default function MobileContactScreen() {
  const [profil, setProfil] = useState<Profil>("particulier");
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(-1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("audience") === "pro") setProfil("pro");
    const formule = params.get("formule");
    const prefills: Record<string, string> = {
      ponctuel: "Bonjour, nous souhaitons commander un transport ponctuel pour notre entreprise.",
      flotte: "Bonjour, nous souhaitons étudier un partenariat flotte (tarifs négociés, facturation centralisée).",
    };
    const message = formule ? prefills[formule] : undefined;
    if (message) setForm((p) => (p.message ? p : { ...p, message }));
  }, []);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trap = (e.currentTarget as HTMLFormElement).elements.namedItem("site_web") as HTMLInputElement | null;
    if (trap?.value) { setStatus("success"); return; }
    setStatus("sending");
    const messageEnrichi =
      profil === "pro"
        ? `[B2B - ${form.segment.toUpperCase()}]\nSociété : ${form.societe}\nSIRET / SIREN : ${form.siret || "non précisé"}\nVolume mensuel estimé : ${form.volume || "non précisé"}\n\n${form.message}`
        : `[PARTICULIER]\n\n${form.message}`;
    try {
      const messageL = form.message.toLowerCase();
      let type_demande: "convoyage" | "devis" | "b2b" | "partenariat" = "convoyage";
      if (profil === "pro") type_demande = "b2b";
      else if (messageL.includes("partenariat") || messageL.includes("partenaire")) type_demande = "partenariat";
      else if (messageL.includes("devis") || messageL.includes("tarif") || messageL.includes("prix")) type_demande = "devis";

      const { error: dbError } = await supabase.from("contact_messages").insert({
        nom: form.nom, prenom: form.prenom, email: form.email, telephone: form.telephone, profil,
        societe: profil === "pro" ? form.societe : "",
        segment: profil === "pro" ? form.segment : "",
        volume: profil === "pro" ? form.volume : "",
        message: form.message, type_demande,
      });
      if (dbError) throw dbError;
      await emailjs.send(
        EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
        { nom: form.nom, prenom: form.prenom, telephone: form.telephone, email: form.email, message: messageEnrichi, profil: profil === "pro" ? "Professionnel" : "Particulier", societe: form.societe },
        EMAILJS_PUBLIC_KEY,
      );
      setStatus("success");
      setForm(EMPTY);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mh2-root md:hidden">
      <PageHero
        kicker="Contact"
        title={<>Parlons de <em>votre convoyage</em></>}
        text="Nous répondons vite, 7j/7."
      />

      <div className="mp-acts">
        <a href="tel:0782456181" className="mp-act g">
          <span className="mp-ic"><Phone size={19} /></span>Appeler
        </a>
        <a href="mailto:contact@transportsligneo.fr" className="mp-act">
          <span className="mp-ic"><Mail size={19} /></span>Écrire
        </a>
        <a href="https://www.transportsligneo.fr" target="_blank" rel="noopener noreferrer" className="mp-act">
          <span className="mp-ic"><Globe size={19} /></span>Site
        </a>
      </div>
      <div className="mp-info">
        <span><CheckCircle2 size={14} />Disponible 7j/7</span>
        <span><CheckCircle2 size={14} />Réponse sous 24 h</span>
      </div>

      <form onSubmit={submit} className="mp-fm">
        <div className="mp-seg wide">
          <button type="button" className={profil === "particulier" ? "on" : ""} onClick={() => setProfil("particulier")}>
            <User size={14} /> Particulier
          </button>
          <button type="button" className={profil === "pro" ? "on pro" : ""} onClick={() => setProfil("pro")}>
            <Briefcase size={14} /> Professionnel
          </button>
        </div>

        {profil === "pro" && (
          <>
            <label className="mp-f2"><span>Société</span>
              <div className="mp-in"><Building2 size={16} /><input name="societe" value={form.societe} onChange={change} required maxLength={120} placeholder="Nom de la société" /></div>
            </label>
            <div className="mp-r2">
              <label className="mp-f2"><span>SIRET / SIREN</span>
                <div className="mp-in"><input name="siret" value={form.siret} onChange={change} maxLength={20} inputMode="numeric" placeholder="14 ou 9 chiffres" /></div>
              </label>
              <label className="mp-f2"><span>Activité</span>
                <div className="mp-in">
                  <select name="segment" value={form.segment} onChange={change}>
                    <option value="concessionnaire">Concessionnaire</option>
                    <option value="loueur">Loueur</option>
                    <option value="assureur">Assureur / Expert</option>
                    <option value="garage">Garage / Réparateur</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </label>
            </div>
            <label className="mp-f2"><span>Volume mensuel</span>
              <div className="mp-in"><input name="volume" value={form.volume} onChange={change} maxLength={60} placeholder="Ex : 10 à 30 trajets" /></div>
            </label>
          </>
        )}

        <div className="mp-r2">
          <label className="mp-f2"><span>Nom</span>
            <div className="mp-in"><User size={16} /><input name="nom" value={form.nom} onChange={change} required maxLength={80} autoComplete="family-name" placeholder="Dupont" /></div>
          </label>
          <label className="mp-f2"><span>Prénom</span>
            <div className="mp-in"><input name="prenom" value={form.prenom} onChange={change} required maxLength={80} autoComplete="given-name" placeholder="Marie" /></div>
          </label>
        </div>
        <label className="mp-f2"><span>Téléphone</span>
          <div className="mp-in"><Phone size={16} /><input name="telephone" type="tel" value={form.telephone} onChange={change} required maxLength={30} autoComplete="tel" placeholder="06 12 34 56 78" /></div>
        </label>
        <label className="mp-f2"><span>Email</span>
          <div className="mp-in"><Mail size={16} /><input name="email" type="email" value={form.email} onChange={change} required maxLength={160} autoComplete="email" placeholder="marie@mail.fr" /></div>
        </label>
        <label className="mp-f2"><span>Message</span>
          <div className="mp-in mp-ta"><Send size={16} style={{ marginTop: 2 }} /><textarea name="message" value={form.message} onChange={change} required maxLength={2000} placeholder="Décrivez votre besoin…" /></div>
        </label>
        <input type="text" name="site_web" tabIndex={-1} autoComplete="off" aria-hidden="true" className="mp-trap" />

        <button type="submit" disabled={status === "sending"} className="mh2-cbtn mp-send">
          {status === "sending" ? "Envoi en cours…" : <>Envoyer <Send size={15} /></>}
        </button>
        {status === "success" && <div className="mp-msg ok"><CheckCircle2 size={16} /> Message envoyé, nous vous répondons très vite.</div>}
        {status === "error" && <div className="mp-msg err"><AlertCircle size={16} /> Envoi impossible. Appelez-nous au 07 82 45 61 81.</div>}
      </form>

      <section className="mh2-sec">
        <div className="mh2-h2">FAQ</div>
        <h2 className="mh2-t2">Questions fréquentes</h2>
        {faqs.map((f, i) => (
          <div key={f.q} className={`mh2-faq${open === i ? " is-open" : ""}`}>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{f.q}</span>
              <span className="mh2-pl">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <div className="mh2-a">{f.a}</div>}
          </div>
        ))}
      </section>

      <MobileFooter />
    </div>
  );
}
