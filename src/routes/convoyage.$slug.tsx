import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Camera, ShieldCheck, MapPin, KeyRound, FileCheck2, Route as RouteIcon, Clock, Euro } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import R4Hero from "@/components/marketing/R4Hero";
import { getTrajet } from "@/lib/trajets-seo";

export const Route = createFileRoute("/convoyage/$slug")({
  loader: ({ params }) => {
    const t = getTrajet(params.slug);
    if (!t) throw notFound();
    return t;
  },
  component: TrajetPage,
  head: ({ loaderData }) => {
    const t = loaderData;
    if (!t) return {};
    const title = `Convoyage ${t.depart} → ${t.arrivee} · dès ${t.prixDepuis} € TTC · Transports Ligneo`;
    const description = `Convoyage de véhicule ${t.depart} → ${t.arrivee} (≈ ${t.km} km, ${t.dureeLabel}) : dès ${t.prixDepuis} € TTC, assurance, carburant et péages inclus. Suivi GPS, photos horodatées, devis en 2 minutes.`;
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `https://transportsligneo.fr/convoyage/${t.slug}` }],
    };
  },
});

const ETAPES = [
  { Icon: FileCheck2, t: "Devis en 2 minutes", d: "Vous indiquez les adresses, le véhicule et la date. Le prix est ferme, sans surprise." },
  { Icon: KeyRound, t: "Prise en charge", d: "Un convoyeur vérifié récupère le véhicule. État des lieux photo horodaté et signature." },
  { Icon: MapPin, t: "Suivi en direct", d: "Position GPS en temps réel, partageable avec votre client final par un simple lien." },
  { Icon: Camera, t: "Livraison prouvée", d: "Photos à l'arrivée, signature, code de remise, puis dossier PDF envoyé automatiquement." },
];

function TrajetPage() {
  const t = Route.useLoaderData();
  const [open, setOpen] = useState<number>(0);
  const faq = [
    { q: `Combien coûte un convoyage ${t.depart} → ${t.arrivee} ?`, a: `À partir de ${t.prixDepuis} € TTC pour un véhicule standard sur environ ${t.km} km. Le prix exact dépend du véhicule, de la date et des options (aller-retour, express) : votre devis est calculé en 2 minutes, avec assurance, carburant et péages inclus.` },
    { q: "Quel est le délai de livraison ?", a: `Le trajet représente environ ${t.dureeLabel} de route. La prise en charge se planifie à la date et à l'heure de votre choix, 7 jours sur 7.` },
    { q: "Mon véhicule est-il assuré pendant le trajet ?", a: "Oui, l'assurance est incluse dans le tarif. Un état des lieux photo horodaté est réalisé à l'enlèvement et à la livraison." },
    { q: "Puis-je suivre mon véhicule ?", a: "Oui. Vous suivez la position du véhicule en direct et pouvez partager le lien à votre client final. Vous recevez ensuite le dossier de livraison complet." },
  ];
  return (
    <>
      <Navbar />
      <main className="r4-page" data-audience="pro">
        <R4Hero
          eyebrow="Convoyage"
          title={<>Convoyage {t.depart} → <span className="v4-accent">{t.arrivee}</span></>}
          subtitle={`Un convoyeur professionnel conduit votre véhicule de ${t.depart} à ${t.arrivee}. Assurance, carburant et péages inclus.`}
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/tarifs" hash="devis" className="v4-btn-primary">Obtenir mon devis</Link>
            <Link to="/contact" className="v4-btn-outline">Parler à un conseiller</Link>
          </div>
        </R4Hero>

        <section className="v4-section">
          <div className="hx-benefits hx-benefits--4">
            {[
              { Icon: RouteIcon, t: `≈ ${t.km} km`, d: "Distance routière" },
              { Icon: Clock, t: t.dureeLabel, d: "Durée de route estimée" },
              { Icon: Euro, t: `dès ${t.prixDepuis} € TTC`, d: "Véhicule standard, tout inclus" },
              { Icon: ShieldCheck, t: "Assuré", d: "Assurance, carburant et péages inclus" },
            ].map(({ Icon, t: tt, d }) => (
              <div key={tt} className="hx-benefit">
                <span className="hx-benefit-ic"><Icon size={20} /></span>
                <h3>{tt}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 14, fontSize: 12.5, opacity: 0.7 }}>
            Tarif indicatif calculé avec notre grille kilométrique. Votre devis exact est instantané.
          </p>
        </section>

        <section className="v4-section">
          <div className="v4-section-head">
            <div className="v4-hero-eyebrow" style={{ justifyContent: "center", width: "100%" }}><span className="dot" />Comment ça se passe</div>
            <h2 className="v4-h2">De {t.depart} à {t.arrivee} <span className="v4-accent">en 4 étapes</span></h2>
          </div>
          <div className="hx-benefits hx-benefits--4">
            {ETAPES.map(({ Icon, t: tt, d }, i) => (
              <div key={tt} className="hx-benefit">
                <span className="hx-benefit-ic"><Icon size={20} /></span>
                <h3>{i + 1}. {tt}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="v4-section">
          <div className="v4-cta-box" style={{ marginTop: 0 }}>
            <h2>Livré avec photos et signature, <span className="v4-accent">preuve à l'appui</span></h2>
            <p>À chaque convoyage : état des lieux photo horodaté au départ et à l'arrivée, signature électronique du destinataire, code de remise sécurisé et dossier de livraison PDF.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center", marginBottom: 22, position: "relative" }}>
              {["Photos horodatées", "Signature électronique", "Code de remise", "Dossier PDF"].map((x) => (
                <span key={x} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13.5 }}><Check size={16} />{x}</span>
              ))}
            </div>
            <Link to="/tarifs" hash="devis" className="v4-btn-primary inline-flex items-center gap-2">Calculer mon prix <ArrowRight size={16} /></Link>
          </div>
        </section>

        <section className="v4-faq-section">
          <div className="v4-faq-head"><h2>Questions fréquentes</h2></div>
          {faq.map((f, i) => (
            <div key={f.q} className={`v4-faq-item ${open === i ? "v4-open" : ""}`}>
              <button type="button" className="v4-faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span>{f.q}</span>
                <span className="plus" aria-hidden="true"><ChevronDown size={13} style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} /></span>
              </button>
              <div className="v4-faq-a" hidden={open !== i}>{f.a}</div>
            </div>
          ))}
        </section>

        <section className="v4-section">
          <div className="v4-section-head">
            <h2 className="v4-h2">Autres trajets <span className="v4-accent">au départ de Tours</span></h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {t.autres.map((a) => (
              <Link key={a.slug} to="/convoyage/$slug" params={{ slug: a.slug }} className="v4-btn-outline">{a.label}</Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
