import { PageSkeleton } from "@/components/driver2/PageSkeleton";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderOpen, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
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

type Doc = { id: string; type_document: string; nom_fichier: string; statut_validation: string; created_at: string };

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
          .select("id, type_document, nom_fichier, statut_validation, created_at")
          .eq("convoyeur_id", conv.id)
          .order("created_at", { ascending: false });
        setDocs((data as Doc[]) ?? []);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="fm-card">
      <div className="fm-card-h" style={{ marginBottom: 6 }}>
        <h1 className="fm-card-t"><span className="fm-ic"><FolderOpen size={16} /></span> Mes documents</h1>
      </div>
      <p className="fm-fine" style={{ marginBottom: 14 }}>
        Vos documents doivent rester valides en permanence pour que vous puissiez accepter des missions.
      </p>
      {docs.length === 0 ? (
        <p className="fm-empty" style={{ textAlign: "center", padding: "18px 0" }}>Aucun document enregistré pour le moment.</p>
      ) : (
        <ul className="fm-docs">
          {docs.map((d) => {
            const valid = d.statut_validation === "approuve";
            const refused = d.statut_validation === "refuse";
            return (
              <li key={d.id} className="fm-doc">
                <span className="fm-doc-i"><FileText size={18} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{d.type_document.replace(/_/g, " ")}</b>
                  <small>{d.nom_fichier} · déposé le {new Date(d.created_at).toLocaleDateString("fr-FR")}</small>
                </div>
                {refused ? (
                  <span className="fm-badge ko"><AlertTriangle size={12} /> Refusé</span>
                ) : valid ? (
                  <span className="fm-badge ok"><ShieldCheck size={12} /> Valide</span>
                ) : (
                  <span className="fm-badge">En attente</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
