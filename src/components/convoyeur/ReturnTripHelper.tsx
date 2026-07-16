import { Train, Bus, Globe2 } from "lucide-react";

interface Props {
  depart: string;
  arrivee: string;
}

/**
 * Aide au retour : pour un aller simple, l'usager part de `arrivee`
 * et rentre vers `depart`. Les liens sont pré-remplis dans ce sens.
 */
export function ReturnTripHelper({ depart, arrivee }: Props) {
  const from = encodeURIComponent(arrivee);
  const to = encodeURIComponent(depart);

  const links = [
    {
      label: "SNCF Connect",
      sub: "Train",
      icon: Train,
      href: `https://www.sncf-connect.com/app/home/search?origin=${from}&destination=${to}`,
      color:
        "from-violet-500/20 to-fuchsia-500/10 border-violet-300/40 text-violet-100",
    },
    {
      label: "Moovit",
      sub: "Transports urbains",
      icon: Bus,
      href: `https://moovitapp.com/tripplan/?from=${from}&to=${to}`,
      color:
        "from-sky-500/20 to-cyan-500/10 border-sky-300/40 text-sky-100",
    },
    {
      label: "Rome2Rio",
      sub: "Comparateur",
      icon: Globe2,
      href: `https://www.rome2rio.com/map/${from}/${to}`,
      color:
        "from-emerald-500/20 to-teal-500/10 border-emerald-300/40 text-emerald-100",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-white">Préparer mon retour</h4>
        <span className="text-[11px] text-white/60">
          {arrivee} → {depart}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {links.map(({ label, sub, icon: Icon, href, color }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${color} p-3 flex items-center gap-3 transition-transform hover:-translate-y-0.5`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 border border-white/15">
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{label}</span>
              <span className="block text-[11px] opacity-80 truncate">{sub}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
