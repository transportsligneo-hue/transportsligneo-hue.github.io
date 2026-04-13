import { motion } from "framer-motion";

const placeholderPartners = [
  "Partenaire 1", "Partenaire 2", "Partenaire 3", "Partenaire 4",
];

export default function Confiance() {
  return (
    <section className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Ils nous font confiance
          </h2>
          <div className="gold-divider-short mt-4" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="flex flex-wrap justify-center gap-8"
        >
          {placeholderPartners.map((name, i) => (
            <div
              key={i}
              className="card-premium w-44 h-24 rounded flex items-center justify-center"
            >
              <span className="text-cream/30 font-heading text-xs tracking-widest uppercase">
                {name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
