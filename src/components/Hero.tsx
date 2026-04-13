import { motion } from "framer-motion";
import heroCarImg from "@/assets/hero-car.png";

export default function Hero() {
  return (
    <section id="accueil" className="relative min-h-screen flex items-center justify-center overflow-hidden section-bg">
      {/* Decorative corner frames */}
      <div className="absolute top-8 left-8 w-20 h-20 border-t border-l border-primary/30 hidden md:block" />
      <div className="absolute top-8 right-8 w-20 h-20 border-t border-r border-primary/30 hidden md:block" />
      <div className="absolute bottom-8 left-8 w-20 h-20 border-b border-l border-primary/30 hidden md:block" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-b border-r border-primary/30 hidden md:block" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <img
            src={heroCarImg}
            alt="Voiture premium"
            className="mx-auto w-72 md:w-96 mb-8 opacity-80"
            width={384}
            height={153}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="gold-divider-short mb-6" />
          <h1 className="font-heading text-4xl md:text-6xl tracking-[0.25em] uppercase gold-gradient-text mb-4">
            Transports Ligneo
          </h1>
          <div className="gold-divider-short mt-6 mb-8" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="space-y-4"
        >
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mt-12"
        >
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
        </motion.div>
      </div>
    </section>
  );
}
