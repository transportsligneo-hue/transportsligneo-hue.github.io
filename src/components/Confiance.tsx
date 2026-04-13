import logoPartners from "@/assets/logo-partners.png";

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

        <div className="flex justify-center">
          <div className="card-premium px-12 py-8 rounded flex items-center justify-center">
            <img
              src={logoPartners}
              alt="CAT France et TransakAuto — Partenaires de confiance"
              className="h-12 md:h-16 w-auto"
              loading="lazy"
              width={636}
              height={120}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
