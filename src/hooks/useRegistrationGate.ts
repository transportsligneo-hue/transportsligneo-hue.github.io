import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRegistrationGate } from "@/lib/public-content.functions";

export type RegistrationGateKind = "client" | "pro" | "flotte" | "convoyeur";

export function useRegistrationGate() {
  const fetchGate = useServerFn(getRegistrationGate);
  const [gate, setGate] = useState({
    client: true,
    pro: true,
    flotte: true,
    convoyeur: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchGate()
      .then((g) => {
        if (mounted) setGate(g);
      })
      .catch(() => {
        // keep defaults
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchGate]);

  const isOpen = (kind: RegistrationGateKind) => gate[kind];

  return { gate, loading, isOpen };
}
