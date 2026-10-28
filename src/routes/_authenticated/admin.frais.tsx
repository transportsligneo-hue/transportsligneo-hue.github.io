import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { FraisAdminList } from "@/components/admin/frais/FraisAdminList";

export const Route = createFileRoute("/_authenticated/admin/frais")({
  head: () => ({ meta: [{ title: "Frais de mission — Admin Ligneo" }] }),
  component: FraisPage,
});

function FraisPage() {
  const [stats, setStats] = useState({ attente: 0, valide: 0, refuse: 0 });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("frais_mission" as never).select("statut");
      const rows = (data as unknown as { statut: string }[]) ?? [];
      setStats({
        attente: rows.filter((r) => r.statut === "attente").length,
        valide: rows.filter((r) => r.statut === "valide").length,
        refuse: rows.filter((r) => r.statut === "refuse").length,
      });
    })();
  }, [tick]);
  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <AdminSectionHeader
        breadcrumb="Frais de mission"
        eyebrow="Finance"
        title="Frais de "
        highlight="mission"
        stats={[
          { label: "À valider", value: stats.attente, tone: "accent" },
          { label: "Validés", value: stats.valide },
          { label: "Refusés", value: stats.refuse },
        ]}
      />
      <div className="mt-4">
        <FraisAdminList onChanged={() => setTick((t) => t + 1)} />
      </div>
    </div>
  );
}
