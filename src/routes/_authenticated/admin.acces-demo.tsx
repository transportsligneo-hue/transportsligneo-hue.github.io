import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendDemoAccess } from "@/lib/demo-access.functions";

export const Route = createFileRoute("/_authenticated/admin/acces-demo")({
  head: () => ({ meta: [{ title: "Accès démo — Admin Ligneo" }] }),
  component: AccesDemoPage,
});

const STATUT: Record<string, string> = {
  demande_recue: "Demande reçue",
  lien_envoye: "Lien envoyé",
  consulte: "Consulté",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

function AccesDemoPage() {
  const qc = useQueryClient();
  const send = useServerFn(sendDemoAccess);
  const [busy, setBusy] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", societe: "", nom: "" });

  const { data: rows = [] } = useQuery({
    queryKey: ["pro-demo-access"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pro_demo_access").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  async function go(payload: { id?: string; email?: string; societe?: string; nom?: string }, key: string) {
    setBusy(key);
    try {
      await send({ data: { ...payload, origin: window.location.origin } });
      toast.success("Accès démo envoyé par e-mail.");
      qc.invalidateQueries({ queryKey: ["pro-demo-access"] });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Accès démo</h1>
        <p className="text-sm text-muted-foreground">Envoyez un lien privé (valable 7 jours) vers la démonstration de l'espace professionnel.</p>
      </div>

      <form
        className="grid gap-2 rounded-xl border p-4 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await go(f, "new")) setF({ email: "", societe: "", nom: "" });
        }}
      >
        <input className="rounded-md border bg-background px-3 py-2 text-sm" required type="email" placeholder="E-mail du prospect" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Société (facultatif)" value={f.societe} onChange={(e) => setF({ ...f, societe: e.target.value })} />
        <input className="rounded-md border bg-background px-3 py-2 text-sm" placeholder="Nom (facultatif)" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={busy === "new"}>
          <Send size={14} /> Envoyer l'accès
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Prospect</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Envoyé</th>
              <th className="p-3">Ouvert</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune demande pour le moment.</td></tr>
            )}
            {rows.map((r) => {
              const expired = r.expires_at && new Date(r.expires_at) < new Date();
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-3"><div className="font-medium">{r.societe || "—"}</div><div className="text-xs text-muted-foreground">{r.nom_contact || ""} · {fmt(r.created_at)}</div></td>
                  <td className="p-3"><div>{r.email}</div><div className="text-xs text-muted-foreground">{r.telephone || ""}</div></td>
                  <td className="p-3">{expired ? "Expiré" : STATUT[r.statut] ?? r.statut}</td>
                  <td className="p-3">{fmt(r.sent_at)}</td>
                  <td className="p-3">{r.opened_at ? `${fmt(r.opened_at)} (${r.open_count}×)` : "—"}</td>
                  <td className="p-3 text-right">
                    <button className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60" disabled={busy === r.id} onClick={() => go({ id: r.id }, r.id)}>
                      {r.sent_at ? "Renvoyer" : "Envoyer l'accès"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
