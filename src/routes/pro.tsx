import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Building2, Car, ShieldCheck, TrendingUp, Clock, FileCheck, Mail, Phone, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pro")({
  component: ProPage,
  head: () => ({
    meta: [
      { title: "Solution B2B convoyage — Concessionnaires, loueurs, assureurs | Transports Ligneo" },
      { name: "description", content: "Partenaire convoyage dédié aux concessionnaires, loueurs et assureurs. Volumes, tarifs négociés, facturation mensuelle. Demandez votre offre sur-mesure." },
      { property: "og:title", content: "Solution B2B convoyage — Transports Ligneo" },
      { property: "og:description", content: "Tarifs volume, facturation mensuelle, interlocuteur dédié pour les pros de l'auto." },
    ],
  }),
});

const segments = [
  { icon: Car, title: "Concessionnaires", desc: "Livraisons clients, transferts inter-sites, retours leasing. Service à la marque, traçabilité totale." },
  { icon: Building2, title: "Loueurs", desc: "Repositionnement de flotte, retours longue durée, livraisons clients pro. Volumes négociés." },
  { icon: ShieldCheck, title: "Assureurs & experts", desc: "Convoyage post-sinistre vers réparateurs agréés, restitutions véhicules. Prise en charge rapide." },
];

const benefits = [
  { icon: TrendingUp, title: "Tarifs dégressifs", desc: "Grille négociée selon le volume mensuel. Plus vous confiez, moins ça coûte." },
  { icon: FileCheck, title: "Facturation mensuelle", desc: "Une seule facture récap, regroupée par site ou par centre de coûts." },
  { icon: Clock, title: "Disponibilité prioritaire", desc: "Délai de prise en charge garanti : 24 à 48 h selon engagement." },
  { icon: ShieldCheck, title: "Interlocuteur dédié", desc: "Un account manager unique. Plus de standard, plus d'attente." },
];

function ProPage() {
  const [form, setForm] = useState({
    societe: "", nom: "", email: "", telephone: "", segment: "concessionnaire",
    volume: "", message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.from("demandes_convoyage").insert({
        nom: form.societe || form.nom,
        prenom: form.nom,
        email: form.email,
        telephone: form.telephone,
        depart: "Demande partenariat B2B",
        arrivee: form.segment,
        message: `[B2B] Société: ${form.societe} | Segment: ${form.segment} | Volume estimé: ${form.volume || "n/c"}\n\n${form.message}`,
        statut: "nouvelle",
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="py-20 md:py-28 section-bg">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="gold-divider-short mb-4 mx-auto" />
            <p className="font-heading text-cream/55 text-xs tracking-[0.3em] uppercase">Espace professionnels</p>
            <h1 className="font-heading text-3xl md:text-5xl tracking-[0.1em] uppercase text-primary mt-4">
              Votre partenaire<br />convoyage dédié
            </h1>
            <p className="text-cream/75 text-base md:text-lg mt-6 leading-relaxed max-w-2xl mx-auto">
              Concessionnaires, loueurs, assureurs : externalisez vos convoyages avec un acteur premium,
              fiable et transparent. Tarifs volume, facturation mensuelle, interlocuteur unique.
            </p>
            <div className="gold-divider-short mt-6 mx-auto" />
          </div>
        </section>

        {/* Segments */}
        <section className="py-16 section-bg-alt">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary text-center mb-10">
              Pour qui ?
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {segments.map((s, i) => (
                <div key={i} className="card-premium p-6 rounded">
                  <div className="w-12 h-12 rounded-full gold-border flex items-center justify-center mb-4 bg-primary/5">
                    <s.icon className="text-primary" size={22} />
                  </div>
                  <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-sm mb-3">{s.title}</h3>
                  <p className="text-cream/70 text-sm leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bénéfices */}
        <section className="py-16 section-bg">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary text-center mb-10">
              Vos avantages
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {benefits.map((b, i) => (
                <div key={i} className="card-premium p-6 rounded flex gap-4">
                  <div className="w-11 h-11 shrink-0 rounded-full gold-border flex items-center justify-center bg-primary/5">
                    <b.icon className="text-primary" size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-xs mb-2">{b.title}</h3>
                    <p className="text-cream/70 text-sm leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Formulaire */}
        <section className="py-16 section-bg-alt">
          <div className="max-w-2xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="gold-divider-short mb-4 mx-auto" />
              <h2 className="font-heading text-2xl md:text-3xl tracking-[0.15em] uppercase text-primary">
                Demande de partenariat
              </h2>
              <p className="text-cream/60 text-sm mt-3">
                Réponse sous 24 h ouvrées avec une proposition tarifaire personnalisée.
              </p>
            </div>

            {sent ? (
              <div className="card-premium p-8 rounded text-center">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <Check className="text-primary" size={28} />
                </div>
                <h3 className="font-heading text-primary tracking-[0.1em] uppercase text-base mb-2">Demande envoyée</h3>
                <p className="text-cream/70 text-sm">Notre équipe vous recontacte rapidement.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="card-premium p-6 md:p-8 rounded space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input required value={form.societe} onChange={(e) => setForm({ ...form, societe: e.target.value })} placeholder="Société *" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors" />
                  <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Votre nom *" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email pro *" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors" />
                  <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="Téléphone" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors" />
                </div>
                <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary outline-none transition-colors">
                  <option value="concessionnaire">Concessionnaire</option>
                  <option value="loueur">Loueur</option>
                  <option value="assureur">Assureur / Expert</option>
                  <option value="autre">Autre</option>
                </select>
                <input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} placeholder="Volume mensuel estimé (ex : 10 à 30 trajets)" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors" />
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Votre besoin (zones géographiques, types de véhicules, fréquence...)" className="w-full bg-navy/40 border border-primary/20 rounded px-4 py-3 text-cream text-sm placeholder-cream/30 focus:border-primary outline-none transition-colors resize-none" />

                {error && <p className="text-destructive text-xs">{error}</p>}

                <button type="submit" disabled={loading} className="w-full py-3.5 bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
                  {loading ? <><Loader2 className="animate-spin" size={14} /> Envoi…</> : "Envoyer ma demande"}
                </button>

                <div className="flex items-center justify-center gap-6 pt-2 text-cream/45 text-xs">
                  <span className="inline-flex items-center gap-1.5"><Phone size={12} /> 07 82 45 61 81</span>
                  <span className="inline-flex items-center gap-1.5"><Mail size={12} /> contact@transportsligneo.fr</span>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
