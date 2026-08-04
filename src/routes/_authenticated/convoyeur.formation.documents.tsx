import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderOpen, FileText, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/convoyeur/formation/documents")({
  head: () => ({
    meta: [
      { title: "Mes documents convoyeur — Transports Ligneo" },
      { name: "description", content: "Suivi des documents obligatoires du convoyeur Transports Ligneo." },
    ],
  }),
  component: DocumentsPage,
});

type Doc = { id: string; type_document: string; statut: string | null; date_expiration: string | null; created_at: string };

function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      const { data: conv } = await supabase.from("convoyeurs").select("id").eq("user_id", user.id).maybeSingle();
      if (conv?.id) {
        const { data } = await supabase
          .from("documents_convoyeurs")
          .select("id, type_document, statut, date_expiration, created_at")
          .eq("convoyeur_id", conv.id)
          .order("created_at", { ascending: false });
        setDocs((data as Doc[]) ?? []);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#2F5FFF]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-pro-text flex items-center gap-2">
        <FolderOpen size={18} className="text-[#2F5FFF]" /> Mes documents
      </h1>
      <p className="text-sm text-pro-muted">
        Rappel du module conformité : vos documents doivent être valides en permanence pour rester éligible aux missions.
      </p>
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-pro-border bg-white p-8 text-center text-sm text-pro-muted">
          Aucun document enregistré pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => {
            const exp = d.date_expiration ? new Date(d.date_expiration) : null;
            const expiring = exp ? exp.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30 : false;
            const valid = (d.statut ?? "").toLowerCase().includes("valid");
            return (
              <li key={d.id} className="rounded-xl border border-pro-border bg-white p-4 flex items-center gap-3">
                <FileText size={16} className="text-pro-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pro-text capitalize">{d.type_document.replace(/_/g, " ")}</p>
                  <p className="text-xs text-pro-muted">
                    {exp ? `Expire le ${exp.toLocaleDateString("fr-FR")}` : "Sans date d'expiration"}
                  </p>
                </div>
                {expiring ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-semibold">
                    <AlertTriangle size={12} /> À renouveler
                  </span>
                ) : valid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-[11px] font-semibold">
                    <ShieldCheck size={12} /> Valide
                  </span>
                ) : (
                  <span className="rounded-full bg-pro-bg-soft text-pro-muted px-2.5 py-1 text-[11px] font-semibold">
                    {d.statut ?? "En attente"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
