import { supabaseAdmin } from "./src/integrations/supabase/client.server";
import { ensureFactureForMission } from "./src/lib/facture-auto.server";
const { data, error } = await supabaseAdmin.from("attributions").select("id, numero_mission, trajet_id, trajets(*)").eq("id","9b4ac83b-348e-47c6-9202-5dc71af8166f").maybeSingle();
console.log("embed err", error?.message, "trajet?", !!(data as any)?.trajets);
const f = await ensureFactureForMission("9b4ac83b-348e-47c6-9202-5dc71af8166f", { amountCents: 201005 });
console.log("facture", f?.["numero"] ?? null);
