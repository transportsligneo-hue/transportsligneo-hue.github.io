import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useApprovalGate, sbAny } from "@/hooks/useApprovalGate";

type Req = {
  id: string; requester_label: string | null; resume: string | null; status: "pending" | "approved" | "refused";
  motif: string | null; created_at: string; requested_by: string;
};

const STATUS: Record<Req["status"], { label: string; cls: string }> = {
  pending: { label: "En attente de validation", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Validée · envoyée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  refused: { label: "Refusée", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

/** Validation interne : l'administrateur active l'option et valide les demandes de son équipe ; les autres suivent leurs demandes. */
export function ApprovalSection() {
  const gate = useApprovalGate();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Req[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gate.orgId) return;
    const { data } = await sbAny.from("org_approval_requests")
      .select("id, requester_label, resume, status, motif, created_at, requested_by")
      .eq("organization_id", gate.orgId).order("created_at", { ascending: false }).limit(50);
    setRows((data ?? []) as Req[]);
  }, [gate.orgId]);
  useEffect(() => { void load(); }, [load]);

  if (!gate.orgId || gate.loading) return null;
  // Rien à montrer à un collaborateur tant que l'option n'est pas activée.
  if (!gate.isAdmin && !gate.enabled && rows.length === 0) return null;

  const toggle = async () => {
    setBusy("toggle");
    const { error } = await sbAny.rpc("set_org_validation_required", { _org: gate.orgId, _on: !gate.enabled });
    setBusy(null);
    if (error) { toast.error(error.message || "Modification impossible"); return; }
    toast.success(!gate.enabled ? "Validation activée : vos collaborateurs soumettent, vous validez." : "Validation désactivée.");
    void qc.invalidateQueries({ queryKey: ["approval-gate"] });
  };
  const decide = async (r: Req, approve: boolean) => {
    const motif = approve ? null : window.prompt("Motif du refus (visible par le demandeur, facultatif) :") ?? null;
    setBusy(r.id);
    const { error } = await sbAny.rpc("decide_org_request", { _id: r.id, _approve: approve, _motif: motif });
    setBusy(null);
    if (error) { toast.error(error.message || "Action impossible"); return; }
    toast.success(approve ? "Demande validée et transmise à Transports Ligneo" : "Demande refusée");
    void load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const visible = gate.isAdmin ? rows : rows.filter((r) => r.requested_by);

  return (
    <section className="mission-surface p-5 space-y-4">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} /> Validation interne {pending.length > 0 && gate.isAdmin && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{pending.length} à valider</span>}</h2>

      {gate.isAdmin && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3.5 text-sm">
          <input type="checkbox" checked={gate.enabled} disabled={busy === "toggle"} onChange={toggle} className="mt-0.5 h-4 w-4 accent-[#2f5fff]" />
          <span>
            <strong>Exiger ma validation avant l'envoi des demandes de l'équipe</strong>
            <span className="mt-0.5 block text-muted-foreground">Les demandes créées par vos collaborateurs (logistique, comptabilité) n'arrivent chez Transports Ligneo qu'une fois validées ici. Les administrateurs envoient directement.</span>
          </span>
        </label>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{gate.isAdmin ? "Aucune demande en attente." : "Vos demandes soumises à validation apparaîtront ici."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{r.resume ?? "Demande de convoyage"}</div>
                <div className="text-xs text-muted-foreground">
                  {r.requester_label ? `${r.requester_label} · ` : ""}{new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {r.status === "refused" && r.motif ? ` · Motif : ${r.motif}` : ""}
                </div>
              </div>
              {r.status === "pending" && gate.isAdmin ? (
                <div className="flex gap-2">
                  <button disabled={busy === r.id} onClick={() => decide(r, true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={14} /> Valider</button>
                  <button disabled={busy === r.id} onClick={() => decide(r, false)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"><XCircle size={14} /> Refuser</button>
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${STATUS[r.status].cls}`}>
                  {r.status === "pending" && <Clock size={12} />}{STATUS[r.status].label}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
