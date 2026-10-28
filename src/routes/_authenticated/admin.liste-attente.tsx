import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, Loader2, Mail, MessageSquare, Phone, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { confirmToast } from "@/lib/confirm-toast";
import { isDemoOrTestIdentity } from "@/lib/demo-detect";
import { trouverDoublons } from "@/lib/doublons";
import { inviteWaitlistBatch } from "@/lib/admin-bulk-communication.functions";

export const Route = createFileRoute("/_authenticated/admin/liste-attente")({
  head: () => ({ meta: [{ title: "Liste d'attente — Admin Ligneo" }] }),
  component: WaitlistPage,
});

type Statut = "a_contacter" | "contacte" | "invite" | "refuse";
interface Row {
  id: string;
  email: string;
  nom: string | null;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  statut: Statut;
  note: string | null;
  created_at: string;
}

const LABEL: Record<Statut, string> = { a_contacter: "À contacter", contacte: "Contacté", invite: "Invité", refuse: "Refusé" };
const TONE: Record<Statut, string> = { a_contacter: "n", contacte: "c", invite: "i", refuse: "r" };

function WaitlistPage() {
  const invite = useServerFn(inviteWaitlistBatch);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"all" | Statut>("all");
  const [q, setQ] = useState("");
  const [ville, setVille] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [vue, setVue] = useState<"reels" | "doublons" | "demo">("reels");
  const [busy, setBusy] = useState(false);
  const [confirmInv, setConfirmInv] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("convoyeur_waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Liste d'attente indisponible", { description: error.message });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const count = (s: Statut) => rows.filter((r) => r.statut === s).length;
  const villes = useMemo(() => [...new Set(rows.map((r) => r.ville).filter(Boolean) as string[])].sort(), [rows]);
  const demoIds = useMemo(() => new Set(rows.filter((r) => isDemoOrTestIdentity({ email: r.email, nom: r.nom })).map((r) => r.id)), [rows]);
  const doublons = useMemo(
    () => trouverDoublons(rows.filter((r) => !demoIds.has(r.id)).map((r) => ({ id: r.id, email: r.email, telephone: r.telephone, nom: r.nom }))),
    [rows, demoIds],
  );
  const visible = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (vue === "demo" ? demoIds.has(r.id) : !demoIds.has(r.id)) &&
        (vue !== "doublons" || doublons.has(r.id)) &&
        (filtre === "all" || r.statut === filtre) &&
        (!ville || r.ville === ville) &&
        (!t || `${r.nom ?? ""} ${r.ville ?? ""} ${r.telephone ?? ""} ${r.email}`.toLowerCase().includes(t)),
    );
  }, [rows, filtre, ville, q, vue, demoIds, doublons]);
  const allSel = visible.length > 0 && visible.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setStatut = async (ids: string[], statut: Statut) => {
    const patch: Record<string, unknown> = { statut, updated_at: new Date().toISOString() };
    if (statut === "contacte") patch.contacted_at = new Date().toISOString();
    const { error } = await (supabase as any).from("convoyeur_waitlist").update(patch).in("id", ids);
    if (error) return toast.error("Mise à jour impossible", { description: error.message });
    setRows((p) => p.map((r) => (ids.includes(r.id) ? { ...r, statut } : r)));
    setSel(new Set());
    toast.success(`${ids.length} candidat${ids.length > 1 ? "s" : ""} mis à jour`);
  };

  const doInvite = async () => {
    if (!confirmInv) return;
    setBusy(true);
    try {
      const res = (await invite({ data: { ids: confirmInv, origin: window.location.origin } })) as { sent: number; failed: string[] };
      if (res.sent) toast.success(`${res.sent} invitation${res.sent > 1 ? "s" : ""} envoyée${res.sent > 1 ? "s" : ""}`);
      if (res.failed.length) toast.error(`${res.failed.length} échec(s) : ${res.failed.slice(0, 3).join(", ")}`);
      setConfirmInv(null);
      setSel(new Set());
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Invitation impossible");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ids: string[]) => {
    if (!(await confirmToast(`Supprimer ${ids.length} candidat${ids.length > 1 ? "s" : ""} de la liste ?`))) return;
    const { error } = await (supabase as any).from("convoyeur_waitlist").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setRows((p) => p.filter((r) => !ids.includes(r.id)));
    setSel(new Set());
  };

  const exportCsv = () => {
    const list = (sel.size ? rows.filter((r) => sel.has(r.id)) : visible);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["Nom;Email;Téléphone;Ville;Adresse;Statut;Inscrit le", ...list.map((r) => [r.nom, r.email, r.telephone, r.ville, r.adresse, LABEL[r.statut], new Date(r.created_at).toLocaleDateString("fr-FR")].map(esc).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "liste-attente-convoyeurs.csv";
    a.click();
  };

  const selIds = [...sel];
  return (
    <div className="space-y-4 pb-28">
      <AdminSectionHeader
        breadcrumb="Liste d'attente convoyeurs"
        eyebrow="Convoyeurs"
        title="Liste d'attente "
        highlight="convoyeurs"
        stats={[
          { label: "Total", value: rows.length - demoIds.size },
          { label: "À contacter", value: count("a_contacter"), tone: "accent" },
          { label: "Contactés", value: count("contacte") },
          { label: "Invités", value: count("invite") },
        ]}
      />

      <div className="wl-tool">
        <button type="button" className="wl-all" onClick={() => setSel(allSel ? new Set() : new Set(visible.map((r) => r.id)))} disabled={!visible.length}>
          <span className={`wl-chk ${allSel ? "on" : ""}`}><Check size={13} strokeWidth={3} /></span>
          {allSel ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        <input className="wl-in" placeholder="Rechercher nom, ville, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="wl-in" style={{ width: 170 }} value={ville} onChange={(e) => setVille(e.target.value)}>
          <option value="">Toutes les villes</option>
          {villes.map((v) => <option key={v}>{v}</option>)}
        </select>
        <div className="wl-chips">
          {([["reels", "Candidats", rows.length - demoIds.size], ["doublons", "Doublons", doublons.size], ["demo", "Démo / Test", demoIds.size]] as [string, string, number][]).map(([k, l, n]) => (
            <button key={k} type="button" className={`wl-chip ${vue === k ? "act" : ""}`} onClick={() => setVue(k as typeof vue)}>{l}<b>{n}</b></button>
          ))}
          <span style={{ width: 10 }} />
          {([["all", "Tous", rows.length], ["a_contacter", "À contacter", count("a_contacter")], ["contacte", "Contactés", count("contacte")], ["invite", "Invités", count("invite")], ["refuse", "Refusés", count("refuse")]] as [string, string, number][]).map(([k, l, n]) => (
            <button key={k} type="button" className={`wl-chip ${filtre === k ? "act" : ""}`} onClick={() => setFiltre(k as "all" | Statut)}>{l}<b>{n}</b></button>
          ))}
        </div>
      </div>

      <div className="wl-tw">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 animate-spin" size={18} />Chargement…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Personne dans cette liste pour le moment.</div>
        ) : (
          <table>
            <thead><tr><th style={{ width: 44 }} /><th>Candidat</th><th>Téléphone</th><th>Ville · adresse</th><th>Inscrit le</th><th>Statut</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {visible.map((r) => {
                const ini = (r.nom ?? r.email).split(/[ @]/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
                return (
                  <tr key={r.id} className={sel.has(r.id) ? "on" : ""}>
                    <td><button type="button" className={`wl-chk ${sel.has(r.id) ? "on" : ""}`} onClick={() => toggle(r.id)} aria-label="Sélectionner"><Check size={13} strokeWidth={3} /></button></td>
                    <td><div className="wl-nm"><span className="wl-av">{ini}</span><div><b>{r.nom || "—"}</b>{doublons.has(r.id) && <em style={{ marginLeft: 6, fontSize: 10, fontStyle: "normal", fontWeight: 700, color: "#d6303b" }}>Doublon · {doublons.get(r.id)}</em>}<small>{r.email}</small></div></div></td>
                    <td>{r.telephone || "—"}</td>
                    <td><b style={{ fontSize: 12.5 }}>{r.ville || "—"}</b><br /><small className="text-slate-400">{r.adresse}</small></td>
                    <td>{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                    <td><span className={`wl-st ${TONE[r.statut]}`}><i />{LABEL[r.statut]}</span></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.telephone && <a className="wl-b g sm" href={`tel:${r.telephone.replace(/\s/g, "")}`}><Phone size={13} />Appeler</a>}{" "}
                      <button type="button" className="wl-b ok sm" onClick={() => setConfirmInv([r.id])}><Send size={13} />Inviter</button>{" "}
                      <button type="button" className="wl-b g sm" onClick={() => remove([r.id])} aria-label="Supprimer"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={`wl-bar ${selIds.length ? "show" : ""}`} role="toolbar">
        <div><span className="n">{selIds.length}</span><small>sélectionné{selIds.length > 1 ? "s" : ""}</small></div>
        <button type="button" className="wl-b ok" onClick={() => setConfirmInv(selIds)}><Send size={14} />Inviter à s'inscrire</button>
        <button type="button" className="wl-b g" onClick={() => setStatut(selIds, "contacte")}>Marquer contacté</button>
        <Link to="/admin/communication" className="wl-b g"><MessageSquare size={14} />Écrire un message</Link>
        <button type="button" className="wl-b g" onClick={exportCsv}><Download size={14} />Exporter CSV</button>
        <button type="button" className="wl-b ko" onClick={() => setStatut(selIds, "refuse")}>Refuser</button>
        <button type="button" className="wl-b g" onClick={() => setSel(new Set())}><X size={14} />Annuler</button>
      </div>

      {confirmInv && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" onClick={() => !busy && setConfirmInv(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[17px] font-bold text-slate-900">Inviter à s'inscrire</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              {confirmInv.length} candidat{confirmInv.length > 1 ? "s" : ""} recevr{confirmInv.length > 1 ? "ont" : "a"} un email Ligneo avec un lien d'inscription personnel (valable 7 jours). Leur statut passera à « Invité ».
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="wl-b g" disabled={busy} onClick={() => setConfirmInv(null)}>Annuler</button>
              <button type="button" className="wl-b ok" disabled={busy} onClick={doInvite}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}Envoyer les invitations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
