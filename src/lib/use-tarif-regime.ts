import { useEffect, useSyncExternalStore } from "react";
import { fetchActiveRegime } from "@/lib/pricing/fetch";
import { getTarifRegime, setTarifRegime, subscribeTarifRegime, type TarifRegime } from "@/lib/km-tarif";

let loaded: Promise<void> | null = null;
function loadOnce() {
  if (!loaded) {
    loaded = fetchActiveRegime()
      .then((r) => setTarifRegime(r.regime === "societe" ? "societe" : "micro"))
      .catch(() => { loaded = null; });
  }
  return loaded;
}

/** Régime tarifaire actif (micro / société) : les composants qui calculent un prix se mettent à jour tout seuls. */
export function useTarifRegime(): TarifRegime {
  useEffect(() => { void loadOnce(); }, []);
  return useSyncExternalStore(subscribeTarifRegime, getTarifRegime, () => "micro" as TarifRegime);
}
