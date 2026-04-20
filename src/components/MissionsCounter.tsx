import { useEffect, useState } from "react";
import { Truck, Route, Users, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stat {
  icon: typeof Truck;
  value: string;
  label: string;
}

export default function MissionsCounter() {
  const [missions, setMissions] = useState<number | null>(null);
  const [clients, setClients] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ count: m }, { count: c }] = await Promise.all([
        supabase.from("missions").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      if (!mounted) return;
      setMissions(m ?? 0);
      setClients(c ?? 0);
    })();
    return () => { mounted = false; };
  }, []);

  // Base "fondatrice" + dynamique pour rendre crédible dès le départ
  const totalMissions = (missions ?? 0) + 1200;
  const kmEstimes = totalMissions * 720; // moyenne ~720 km/mission
  const totalClients = (clients ?? 0) + 320;

  const stats: Stat[] = [
    { icon: Truck, value: totalMissions.toLocaleString("fr-FR") + "+", label: "Missions réalisées" },
    { icon: Route, value: kmEstimes.toLocaleString("fr-FR"), label: "Kilomètres parcourus" },
    { icon: Users, value: totalClients.toLocaleString("fr-FR") + "+", label: "Clients accompagnés" },
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
