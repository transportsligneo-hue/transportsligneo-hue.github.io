import type { ReactNode } from "react";

interface R4HeroProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  children?: ReactNode;
}

/**
 * Hero unifié pour les pages marketing (Services, À propos, B2B, Contact,
 * Comment ça marche). Applique le fond navy V4 avec halos radiaux, eyebrow
 * bleu électrique, titre Poppins massif + accent bleu néon pulsant.
 */
export default function R4Hero({ eyebrow, title, subtitle, children }: R4HeroProps) {
  return (
    <div className="r4-page">
      <section className="max-w-6xl mx-auto px-8 pt-32 pb-16 text-center">
        <div className="r4-eyebrow mb-5 justify-center inline-flex">
          <span className="r4-eyebrow-dot" />
          {eyebrow}
        </div>
        <h1
          className="font-heading font-extrabold text-white text-4xl md:text-5xl lg:text-[46px] leading-[1.05] tracking-tight mb-4"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[#9aa6c9] text-[15.5px] leading-relaxed max-w-xl mx-auto">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </section>
    </div>
  );
}
