import logoLigneo from "@/assets/logo-ligneo.png";

export default function Hero() {
  return (
    <section id="accueil" className="relative min-h-screen flex items-center justify-center overflow-hidden section-bg">
      {/* Decorative corner frames */}
      <div className="absolute top-8 left-8 w-20 h-20 border-t border-l border-primary/30 hidden md:block" />
      <div className="absolute top-8 right-8 w-20 h-20 border-t border-r border-primary/30 hidden md:block" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-b border-l border-primary/30 hidden md:block" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-b border-r border-primary/30 hidden md:block" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-16">
        <div>
          <img
            src={logoLigneo}
            alt="Transports Ligneo"
            className="mx-auto w-80 md:w-[28rem] mb-8"
            width={636}
            height={241}
          />
        </div>

        <div>
          <div className="gold-divider-short mb-6" />
        </div>

        <div className="space-y-4">
          <p className="font-heading text-xl md:text-2xl text-primary italic">
            « La tranquillité sur toute la ligne. »
          </p>
          <p className="text-lg text-gold-light tracking-wide">
            Votre véhicule, notre priorité.
          </p>
          <p className="text-cream/70 max-w-xl mx-auto leading-relaxed mt-6">
            De la prise en charge à la restitution, nous vous tenons informés à chaque étape.
          </p>
          <p className="text-cream/60 max-w-xl mx-auto text-sm">
            Un service premium, assuré avec rigueur et discrétion.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
          <a
            href="#contact"
            className="px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300"
          >
            Demander un devis
          </a>
          <a
            href="#tarifs"
            className="px-8 py-3 gold-border text-primary font-heading text-sm tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors duration-300"
          >
            Voir les tarifs
          </a>
        </div>
      </div>
    </section>
  );
}
