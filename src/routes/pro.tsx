import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Building2, Car, ShieldCheck, TrendingUp, Clock, FileCheck,
  Mail, Phone, Loader2, Check, Sparkles, Zap, BarChart3, FileText,
} from "lucide-react";
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

const engagements = [
  { icon: Zap, title: "Réactivité", desc: "Prise en charge sous 24-48h, immédiat possible." },
  { icon: ShieldCheck, title: "Conformité", desc: "Convoyeurs assurés, papiers à jour, RC pro." },
  { icon: FileText, title: "Traçabilité", desc: "État des lieux photo, signature numérique, PDF." },
  { icon: BarChart3, title: "Reporting", desc: "Tableau de bord pro, exports, facturation claire." },
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

  const inputCls = "w-full bg-white border border-[#0b1026]/15 rounded-xl px-4 py-3 text-[#0b1026] text-sm placeholder-[#0b1026]/40 focus:border-[#5fb6ff] focus:ring-2 focus:ring-[#5fb6ff]/20 outline-none transition-all";

  return (
    <>
      <Navbar />

      {/* === HERO navy premium === */}
      <section
        className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32"
        style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(231,199,106,0.10), transparent 70%), radial-gradient(40% 40% at 80% 20%, rgba(95,182,255,0.12), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/[0.08] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">
            <ShieldCheck className="h-3 w-3" />
            Solution professionnelle
          </span>
          <h1 className="font-heading text-4xl lg:text-6xl tracking-wide text-cream mt-6 leading-[1.1]">
            Votre partenaire convoyage,
            <br />
            <span className="gold-gradient-text">pensé pour les pros.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-cream/70 text-base lg:text-lg leading-relaxed">
            Concessionnaires, loueurs, assureurs : externalisez vos convoyages
            avec un acteur premium, fiable et transparent. Tarifs volume,
            facturation mensuelle, interlocuteur unique.
          </p>
          <div className="electric-divider mx-auto mt-10 w-40" />
        </div>

        {/* Courbe cream */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: "120px" }}>
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full block">
            <path
              d="M0,80 C320,20 760,5 1080,30 C1240,42 1360,70 1440,55 L1440,120 L0,120 Z"
              fill="var(--surface-cream, #faf7ef)"
            />
          </svg>
        </div>
      </section>

      {/* === Segments — cream === */}
      <section className="px-4 py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">Pour qui ?</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-2">Une offre dédiée à chaque métier</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {segments.map((s) => (
              <article key={s.title} className="card-premium-light group relative flex flex-col overflow-hidden p-8 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a] to-transparent" />
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#b8860b]">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-xl text-[#0b1026]">{s.title}</h3>
                <p className="mt-3 text-[#0b1026]/65 text-sm leading-relaxed">{s.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* === Bénéfices — navy === */}
      <section className="relative px-4 py-20 lg:py-24" style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}>
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">Vos avantages</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-2">Une relation pensée long terme</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-7 transition-all duration-500 hover:border-[#5fb6ff]/40 hover:bg-white/[0.05]">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-[17px] text-cream tracking-wide">{b.title}</h3>
                <p className="mt-2 text-[13.5px] text-cream/60 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === Formulaire — cream premium === */}
      <section className="px-4 py-20 lg:py-24" style={{ background: "var(--surface-cream, #faf7ef)" }}>
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#b8860b] font-heading">Demande de partenariat</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-[#0b1026] mt-2">Parlons de votre besoin</h2>
            <p className="text-[#0b1026]/60 text-sm mt-4">Réponse sous 24h ouvrées avec une proposition tarifaire personnalisée.</p>
          </div>

          {sent ? (
            <div className="card-premium-light p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-[#e7c76a]/15 flex items-center justify-center mx-auto mb-4">
                <Check className="text-[#b8860b]" size={28} />
              </div>
              <h3 className="font-heading text-[#0b1026] text-xl mb-2">Demande envoyée</h3>
              <p className="text-[#0b1026]/65 text-sm">Notre équipe vous recontacte rapidement.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="card-premium-light p-7 md:p-10 space-y-4">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a] to-transparent" />
              <div className="grid sm:grid-cols-2 gap-4">
                <input required value={form.societe} onChange={(e) => setForm({ ...form, societe: e.target.value })} placeholder="Société *" className={inputCls} />
                <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Votre nom *" className={inputCls} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email pro *" className={inputCls} />
                <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="Téléphone" className={inputCls} />
              </div>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className={inputCls}>
                <option value="concessionnaire">Concessionnaire</option>
                <option value="loueur">Loueur</option>
                <option value="assureur">Assureur / Expert</option>
                <option value="autre">Autre</option>
              </select>
              <input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} placeholder="Volume mensuel estimé (ex : 10 à 30 trajets)" className={inputCls} />
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} placeholder="Votre besoin (zones géographiques, types de véhicules, fréquence...)" className={`${inputCls} resize-none`} />

              {error && <p className="text-destructive text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-xl bg-gradient-to-r from-[#e7c76a] via-[#d4af37] to-[#e7c76a] bg-[length:200%_100%] hover:bg-[position:100%_0] text-[#0b1026] font-heading text-[11.5px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-12px_rgba(231,199,106,0.55)] transition-all duration-300 disabled:opacity-60"
              >
                {loading ? <><Loader2 className="animate-spin" size={14} /> Envoi…</> : <><Sparkles size={14} /> Envoyer ma demande</>}
              </button>

              <div className="flex items-center justify-center gap-6 pt-2 text-[#0b1026]/50 text-xs">
                <a href="tel:+33782456181" className="inline-flex items-center gap-1.5 hover:text-[#5fb6ff] transition-colors"><Phone size={12} /><span>07 82 45 61 81</span></a>
                <a href="mailto:contact@transportsligneo.fr" className="inline-flex items-center gap-1.5 hover:text-[#5fb6ff] transition-colors"><Mail size={12} /><span>contact@transportsligneo.fr</span></a>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* === Engagements — navy final === */}
      <section className="relative px-4 py-20 lg:py-24" style={{ background: "linear-gradient(180deg, #0b1026 0%, #111a3d 100%)" }}>
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/40 to-transparent" />
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <span className="text-[10.5px] uppercase tracking-[0.28em] text-[#e7c76a] font-heading">Engagement Ligneo</span>
            <h2 className="font-heading text-3xl lg:text-4xl text-cream mt-2">Pourquoi les pros nous choisissent</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {engagements.map((v) => (
              <div key={v.title} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-7 transition-all duration-500 hover:border-[#5fb6ff]/40 hover:bg-white/[0.05]">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 text-[#e7c76a]">
                  <v.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-[17px] text-cream tracking-wide">{v.title}</h3>
                <p className="mt-2 text-[13.5px] text-cream/60 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
