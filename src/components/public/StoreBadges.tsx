import { useEffect, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import { getStoreLinks, type StoreLinks } from "@/lib/public-content.functions";

/**
 * Badges de téléchargement de l'app convoyeur.
 * N'affiche que les liens réellement renseignés (clé `store_links` des réglages).
 */
export default function StoreBadges({ className = "" }: { className?: string }) {
  const [links, setLinks] = useState<StoreLinks>({ ios: null, android: null });

  useEffect(() => {
    let mounted = true;
    getStoreLinks()
      .then((l) => {
        if (mounted) setLinks(l);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  if (!links.ios && !links.android) return null;

  const badge = "inline-flex items-center gap-2 rounded-xl border border-[#7aa3ff]/25 bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.08]";

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {links.ios && (
        <a href={links.ios} target="_blank" rel="noopener noreferrer" className={badge}>
          <Apple size={16} className="text-[#4f8cff]" />
          <span>
            <span className="block text-[9.5px] font-normal uppercase tracking-[0.12em] text-[#9aa6c9]">
              Télécharger sur
            </span>
            App Store
          </span>
        </a>
      )}
      {links.android && (
        <a href={links.android} target="_blank" rel="noopener noreferrer" className={badge}>
          <Smartphone size={16} className="text-[#4f8cff]" />
          <span>
            <span className="block text-[9.5px] font-normal uppercase tracking-[0.12em] text-[#9aa6c9]">
              Disponible sur
            </span>
            Google Play
          </span>
        </a>
      )}
    </div>
  );
}
