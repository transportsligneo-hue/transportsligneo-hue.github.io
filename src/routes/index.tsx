import { createFileRoute } from "@tanstack/react-router";
import Navbar from "@/components/Navbar";
import HeroDesktop from "@/components/HeroDesktop";
import PourquoiNousChoisir from "@/components/PourquoiNousChoisir";
import CommentCaMarche from "@/components/CommentCaMarche";
import PartnersMarquee from "@/components/PartnersMarquee";
import { Award, ShieldCheck, Headphones } from "lucide-react";
import Footer from "@/components/Footer";
import MobileHomeScreen from "@/components/mobile/MobileHomeScreen";


export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Transports LIGNEO — Estimation convoyage automobile premium" },
      { name: "description", content: "Estimez votre convoyage automobile en 30 secondes. Service premium au départ de Tours, péages et carburant inclus. Disponible 7j/7." },
      { property: "og:title", content: "Transports LIGNEO — Estimation convoyage automobile premium" },
      { property: "og:description", content: "Estimation instantanée. Votre véhicule, notre priorité. La tranquillité sur toute la ligne." },
    ],
  }),
});

const heroTrustStats = [
  {
    icon: Award,
    title: "6+ ans d'expérience",
    desc: "Un savoir-faire terrain auprès des professionnels et particuliers.",
  },
  {
    icon: ShieldCheck,
    title: "0 annulation de notre part",
    desc: "Chaque mission validée est assurée jusqu'au bout.",
  },
  {
    icon: Headphones,
    title: "7j/7 disponible",
    desc: "Un interlocuteur dédié pour vos demandes urgentes.",
  },
];

function Index() {
  return (
    <>
      {/* Mobile : écran d'app dédié */}
      <MobileHomeScreen />

      {/* Desktop : layout premium */}
      <div className="hidden md:block">
        <Navbar />

        {/* Hero avec simulateur intégré à droite + courbe blanc cassé en bas */}
        <HeroDesktop />

        {/* === BANDE STATS BLANCHE PREMIUM (façon maquette) === */}
        <section className="bg-[#faf7ef] pt-4 pb-16 lg:pb-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_4px_rgba(11,16,38,0.04),0_24px_60px_-30px_rgba(11,16,38,0.20)] px-8 lg:px-14 py-10 lg:py-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-12 divide-y md:divide-y-0 md:divide-x divide-[rgba(11,16,38,0.08)]">
                {heroTrustStats.map(({ icon: Icon, title, desc }, i) => (
                  <div
                    key={title}
                    className={`flex items-start gap-5 ${i > 0 ? "pt-8 md:pt-0 md:pl-12" : ""}`}
                  >
                    <span className="shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-xl border border-[rgba(212,175,55,0.45)] bg-gradient-to-br from-[rgba(212,175,55,0.14)] to-[rgba(212,175,55,0.04)]">
                      <Icon size={24} className="text-[#b8902e]" strokeWidth={1.7} />
                    </span>
                    <div>
                      <h3 className="font-heading text-[#0b1026] text-[15px] tracking-[0.08em] uppercase">
                        {title}
                      </h3>
                      <p className="text-[#5b6485] text-[13.5px] leading-relaxed mt-2">
                        {desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PartnersMarquee — INTOUCHÉ */}
        <PartnersMarquee />

        {/* Pourquoi nous choisir — version claire */}
        <PourquoiNousChoisir />

        {/* Comment ça marche — version navy premium */}
        <CommentCaMarche />

        <Footer />
      </div>
    </>
  );
}
