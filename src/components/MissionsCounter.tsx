import { Truck, Route, Users, Calendar } from "lucide-react";

interface Stat {
  icon: typeof Truck;
  value: string;
  label: string;
}

export default function MissionsCounter() {
  const stats: Stat[] = [
    { icon: Truck, value: "2 300+", label: "Missions réalisées" },
    { icon: Route, value: "400 000+ km", label: "Kilomètres parcourus" },
    { icon: Users, value: "600+", label: "Clients accompagnés" },
    { icon: Calendar, value: "6 ans", label: "D'expérience terrain" },
  ];

  return (
    <section className="py-16 section-bg-alt">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <div key={i} className="card-premium p-5 md:p-6 rounded text-center">
              <s.icon className="text-primary mx-auto mb-3" size={22} />
              <p className="font-heading text-primary text-2xl md:text-3xl tracking-wide">
                {s.value}
              </p>
              <p className="text-cream/55 text-[11px] md:text-xs tracking-[0.1em] uppercase mt-2">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
