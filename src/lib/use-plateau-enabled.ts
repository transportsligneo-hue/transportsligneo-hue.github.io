import { useEffect, useState } from "react";
import { getPlateauEnabled } from "@/lib/public-config.functions";

let cache: boolean | null = null;
/** true si l'admin a activé le convoyage sur plateau (désactivé par défaut). */
export function usePlateauEnabled(): boolean {
  const [on, setOn] = useState<boolean>(cache ?? false);
  useEffect(() => {
    if (cache !== null) return;
    getPlateauEnabled().then((v) => { cache = v; setOn(v); }).catch(() => {});
  }, []);
  return on;
}
