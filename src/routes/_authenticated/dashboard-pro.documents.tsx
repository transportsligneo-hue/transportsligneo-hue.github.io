import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Loader2, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard-pro/documents")({
  component: ProDocuments,
});

interface DevisRow {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  prix_estime: number;
  statut: string;
  pdf_url: string | null;
  created_at: string;
}

const statutPill: Record<string, string> = {
  envoye: "bg-blue-50 text-blue-700",
  accepte: "bg-emerald-50 text-emerald-700",
  refuse: "bg-red-50 text-red-700",
  expire: "bg-slate-100 text-slate-700",
};

function ProDocuments() {
  const { user } = useAuth();
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    supabase
      .from("devis")
      .select("id, numero, depart, arrivee, prix_estime, statut, pdf_url, created_at")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDevis((data ?? []) as DevisRow[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-pro-text">Factures & devis</h1>
        <p className="text-pro-muted text-sm mt-0.5">Tous vos documents commerciaux</p>
      </div>

      <div className="bg-white rounded-xl border border-pro-border overflow-hidden">
        <div className="px-5 py-4 border-b border-pro-border flex items-center gap-2.5">
          <Receipt size={17} className="text-pro-accent" />
          <h2 className="font-semibold text-pro-text text-sm">Vos devis</h2>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
        ) : devis.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="text-slate-300 mx-auto mb-3" size={36} />
            <p className="text-pro-text-soft text-sm">Aucun devis pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pro-bg-soft text-pro-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">N°</th>
                  <th className="text-left px-5 py-3 font-medium">Trajet</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Statut</th>
                  <th className="text-right px-5 py-3 font-medium">Montant</th>
                  <th className="text-right px-5 py-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {devis.map((d) => (
                  <tr key={d.id} className="border-t border-pro-border hover:bg-pro-bg-soft/60">
                    <td className="px-5 py-3 text-pro-text-soft font-mono text-xs">{d.numero}</td>
                    <td className="px-5 py-3 text-pro-text">{d.depart} → {d.arrivee}</td>
                    <td className="px-5 py-3 text-pro-text-soft">
                      {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statutPill[d.statut] ?? "bg-slate-100 text-slate-700"}`}>
                        {d.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-pro-text">
                      {Number(d.prix_estime).toFixed(2)} €
                    </td>
                    <td className="px-5 py-3 text-right">
                      {d.pdf_url ? (
                        <a
                          href={d.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-pro-accent hover:underline text-xs font-medium"
                        >
                          <Download size={13} /> Télécharger
                        </a>
                      ) : (
                        <span className="text-pro-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
