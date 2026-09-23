import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGpsTracking } from "@/hooks/useGpsTracking";

// Mounted in the Driver layout: navigating away from a mission must not stop its GPS.
export function DriverGpsTracker() {
  const { user } = useAuth();
  const [missionId, setMissionId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setMissionId(null); return; }
    let cancelled = false;
    const refresh = async () => {
      const { data: driver, error: driverError } = await supabase
        .from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled || driverError) return;
      if (!driver) { setMissionId(null); return; }
      const { data, error } = await supabase
        .from("attributions")
        .select("id, etape_courante")
        .eq("convoyeur_id", driver.id)
        .in("statut", ["en_cours", "livraison", "en_livraison"])
        .in("etape_courante", ["en_route", "sur_place", "en_livraison", "arrive_destination", "arrive_livraison"])
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!cancelled && !error) setMissionId(data?.[0]?.id ?? null);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const resume = () => { void refresh(); };
    document.addEventListener("visibilitychange", resume);
    const channel = supabase.channel(`driver-gps-stage-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "attributions" }, () => void refresh())
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useGpsTracking({ attributionId: missionId, active: !!missionId });
  return null;
}