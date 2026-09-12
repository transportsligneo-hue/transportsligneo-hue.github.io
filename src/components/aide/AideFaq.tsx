import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Phone, Mail, MessageCircleQuestion, Sparkles } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  getAideCategories,
  aideHero,
  aideToolsClient,
  aideToolsPro,
  type AideAudience,
} from "./aide-data";

/**
 * Centre d'aide / FAQ des espaces clients (particulier & pro).
 * Clair, premium, identité Ligneo (navy / doré / bleu électrique).
 */
export default function AideFaq({ audience = "pro" }: { audience?: AideAudience }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const categories = useMemo(() => getAideCategories(audience), [audience]);
  const hero = aideHero[audience];
  const tools = audience === "pro" ? aideToolsPro : aideToolsClient;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => !activeCat || c.id === activeCat)
      .map((c) => ({
        ...c,
        items: q
          ? c.items.filter(
              (it) =>
                it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
            )
          : c.items,
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, activeCat]);

  const total = filtered.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="space-y-8">
      {/* Bandeau outils */}
      <div className="rounded-2xl border border-pro-border bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
            <Sparkles size={14} className="text-blue-600" />
          </span>
          <h2 className="text-sm font-semibold tracking-wide text-pro-text uppercase">
            Vos outils en un coup d'œil
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {tools.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2.5 rounded-xl border border-pro-border bg-pro-bg px-3 py-2.5 hover:border-blue-500/40 hover:bg-blue-50/50 transition-colors"
            >
              <span className="w-8 h-8 shrink-0 rounded-lg bg-white border border-pro-border flex items-center justify-center text-blue-600">
                <t.icon size={15} />
              </span>
              <span className="text-[12.5px] font-medium text-pro-text leading-tight">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="space-y-4">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-pro-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une question, un outil… (ex : plaque, devis, GPS, conducteur)"
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-pro-border bg-white text-sm text-pro-text placeholder:text-pro-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat(null)}
            className={`px-3.5 h-8 rounded-full text-xs font-semibold border transition-all ${
              activeCat === null
                ? "bg-[#0b1026] text-white border-[#0b1026]"
                : "bg-white text-pro-text-soft border-pro-border hover:border-blue-500/40"
            }`}
          >
            Tout
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-semibold border transition-all ${
                activeCat === c.id
                  ? "bg-[#0b1026] text-white border-[#0b1026]"
                  : `bg-white border hover:shadow-sm ${c.color}`
              }`}
            >
              <c.icon size={12} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-pro-border bg-white p-10 text-center">
          <MessageCircleQuestion size={28} className="mx-auto text-pro-muted mb-3" />
          <p className="text-sm font-medium text-pro-text">
            Aucune réponse ne correspond à « {query} »
          </p>
          <p className="text-xs text-pro-muted mt-1">
            Essayez un autre mot-clé ou contactez-nous directement ci-dessous.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((cat) => (
            <section key={cat.id} className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold border ${cat.color} bg-white`}
                >
                  <cat.icon size={12} />
                  {cat.label}
                </span>
                <span className="h-px flex-1 bg-pro-border" />
                <span className="text-[11px] text-pro-muted">
                  {cat.items.length} réponse{cat.items.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="rounded-2xl border border-pro-border bg-white shadow-sm overflow-hidden">
                <Accordion type="single" collapsible>
                  {cat.items.map((it, i) => (
                    <AccordionItem
                      key={i}
                      value={`${cat.id}-${i}`}
                      className="border-b border-pro-border last:border-b-0"
                    >
                      <AccordionTrigger className="px-5 py-4 text-[14px] font-semibold text-pro-text hover:no-underline hover:bg-pro-bg/60 transition-colors">
                        {it.q}
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5 text-[13.5px] leading-relaxed text-pro-text-soft">
                        {it.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Contact */}
      <div className="relative overflow-hidden rounded-2xl border border-pro-border bg-white p-6 shadow-sm sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-blue-600" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
              Une question reste sans réponse ?
            </p>
            <h3 className="text-lg font-bold text-pro-text sm:text-xl">
              Notre équipe vous répond 7j/7
            </h3>
            <p className="mt-1.5 max-w-md text-sm text-pro-text-soft">
              Un doute sur une mission, une facture ou un document ? Contactez-nous,
              on s'occupe du reste.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="h-11 bg-blue-600 px-5 font-bold text-primary-foreground shadow-sm hover:bg-blue-700">
              <a href="tel:+33782456181">
                <Phone size={15} />
                07 82 45 61 81
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 border-pro-border bg-white px-5 font-semibold text-pro-text hover:bg-pro-bg">
              <Link to="/contact">
                <Mail size={15} />
                Nous écrire
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
