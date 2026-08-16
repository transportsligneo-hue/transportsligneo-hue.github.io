import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Source = "missions" | "trajets";

type Row = { id: string; leg_type: string | null; numero?: string | null };

export function MissionTwinLink({
  source,
  groupId,
  currentId,
  linkTo,
  className,
}: {
  source: Source;
  groupId: string | null | undefined;
  currentId: string;
  /** Fonction qui, à partir du twin, retourne l'URL de sa page détail. */
  linkTo: (twinId: string, twinLeg: string | null) => { to: string; params?: Record<string, string> };
  className?: string;
}) {
  const [twin, setTwin] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!groupId) {
      setTwin(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q =
      source === "missions"
        ? supabase.from("missions").select("id, leg_type, numero").eq("mission_group_id", groupId).neq("id", currentId).limit(1).maybeSingle()
        : supabase.from("trajets_client_safe").select("id, leg_type").eq("mission_group_id", groupId).neq("id", currentId).limit(1).maybeSingle();
    q.then(({ data }) => {
      if (cancelled) return;
      setTwin(data ? ({ id: (data as { id: string }).id, leg_type: (data as { leg_type?: string | null }).leg_type ?? null, numero: (data as { numero?: string | null }).numero ?? null }) : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [source, groupId, currentId]);

  if (!groupId) return null;
  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-slate-500 ${className ?? ""}`}>
        <Loader2 size={12} className="animate-spin" /> Recherche du jumeau…
      </span>
    );
  }
  if (!twin) return null;

  const label = twin.leg_type === "retour" ? "Voir le volet Restitution (R)" : twin.leg_type === "aller" ? "Voir le volet Livraison (L)" : "Voir la mission jumelle";
  const dest = linkTo(twin.id, twin.leg_type);

  return (
    <Link
      to={dest.to as never}
      params={dest.params as never}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 underline-offset-2 hover:underline ${className ?? ""}`}
    >
      <ArrowLeftRight size={12} />
      {label}
      {twin.numero ? <span className="font-mono text-[11px] text-slate-500">{twin.numero}</span> : null}
    </Link>
  );
}
