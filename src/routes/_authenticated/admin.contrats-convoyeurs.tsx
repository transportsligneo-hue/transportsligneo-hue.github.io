import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, Download, ExternalLink, FileSignature, Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/AdminUI";
import ContratYousignCard from "@/components/admin/ContratYousignCard";
import { esignConvoyeurPermisInfo, esignConvoyeurKbisInfo, esignDownloadUrls, esignList } from "@/lib/esign.functions";
import { generateContratConvoyeurPdf } from "@/lib/documents-officiels";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { adresseDe, composeAdresse, splitAdresse } from "@/lib/adresse";
import { SiretBadge } from "@/components/SiretBadge";
import { isDemoOrTestIdentity } from "@/lib/demo-detect";

export const Route = createFileRoute("/_authenticated/admin/contrats-convoyeurs")({
  component: ContratsConvoyeursPage,
});

type Conv = {
  id: string; nom: string | null; prenom: string | null; email: string | null; telephone: string | null;
  permis: string | null; permis_numero?: string | null; siret?: string | null; adresse?: string | null; statut: string | null; created_at: string;
};
type Req = { id: string; ref_id: string | null; kind: string; status: string; signed_at: string | null; sent_at: string; expires_at: string };

type Etat = "a_envoyer" | "envoye" | "signe" | "expire" | "refuse";
const ETATS: Record<Etat, { label: string; cls: string }> = {
  a_envoyer: { label: "À envoyer", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  envoye: { label: "Envoyé, en attente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  signe: { label: "Signé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expire: { label: "Lien expiré", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  refuse: { label: "Refusé", cls: "bg-red-50 text-red-700 border-red-200" },
};

function etatOf(r?: Req): Etat {
  if (!r) return "a_envoyer";
  if (r.status === "signed") return "signe";
  if (r.status === "declined") return "refuse";
  if (r.status === "cancelled") return "a_envoyer";
  if (r.status === "expired") return "expire";
  return "envoye";
}

function ContratsConvoyeursPage() {
  const list = useServerFn(esignList);
  const dl = useServerFn(esignDownloadUrls);
  const kbis = useServerFn(esignConvoyeurKbisInfo);
  const permisFn = useServerFn(esignConvoyeurPermisInfo);
  const { data: company } = useCompanyInfo();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"reel" | "demo">("reel");
  const [filtre, setFiltre] = useState<Etat | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: c }, r] = await Promise.all([
        supabase.from("convoyeurs").select("*").order("created_at", { ascending: false }),
        list({ data: { refType: "convoyeur", limit: 300 } }),
      ]);
      setConvs((c ?? []) as unknown as Conv[]);
      setReqs((r.items as Req[]).filter((x) => x.kind === "contrat_convoyeur"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    }
    setLoading(false);
  }, [list]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const last = new Map<string, Req>();
    for (const r of reqs) if (r.ref_id && !last.has(r.ref_id)) last.set(r.ref_id, r); // déjà triés du plus récent
    return convs.map((c) => ({
      c, req: last.get(c.id), etat: etatOf(last.get(c.id)),
      demo: isDemoOrTestIdentity({ email: c.email, nom: c.nom, prenom: c.prenom }),
      nom: [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "—",
    }));
  }, [convs, reqs]);

  const visibles = rows.filter((r) => (tab === "demo" ? r.demo : !r.demo));
  const compte = (e: Etat) => rows.filter((r) => !r.demo && r.etat === e).length;
  const filtered = visibles.filter((r) => {
    if (filtre !== "all" && r.etat !== filtre) return false;
    const s = q.trim().toLowerCase();
    return !s || r.nom.toLowerCase().includes(s) || (r.c.email ?? "").toLowerCase().includes(s);
  });

  /** Aperçu du contrat, rempli avec les infos du convoyeur (fiche, sinon Kbis), sans rien envoyer. */
  const [bulk, setBulk] = useState(false);
  /** Lit le Kbis de chaque convoyeur sans SIRET/adresse et l'enregistre sur sa fiche. */
  const recupererKbis = async () => {
    const cibles = convs.filter((c) => !isDemoOrTestIdentity({ email: c.email, nom: c.nom, prenom: c.prenom }) && (!c.siret || !c.adresse || !c.permis_numero));
    if (!cibles.length) { toast.info("Tous les convoyeurs ont déjà leur SIRET et leur adresse."); return; }
    setBulk(true);
    let ok = 0; const ko: string[] = [];
    for (const c of cibles) {
      const nom = [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "convoyeur";
      const k = await kbis({ data: { convoyeurId: c.id } }).catch(() => null);
      const pi = c.permis_numero ? null : await permisFn({ data: { convoyeurId: c.id } }).catch(() => null);
      if (k?.ok || pi?.ok) {
        await (supabase as any).from("convoyeurs").update({
          siret: c.siret || k?.siret || null, adresse: c.adresse || k?.adresse || null,
          ...(!(c as any).adresse_rue && !c.adresse && k?.adresse ? (() => { const a = splitAdresse(k.adresse); return { adresse_rue: a.rue || null, code_postal: a.cp || null, ...(!(c as any).ville && a.ville ? { ville: a.ville } : {}) }; })() : {}),
          ...(pi?.ok && pi.numero ? { permis_numero: pi.numero } : {}),
        }).eq("id", c.id);
        ok++;
      } else ko.push(`${nom} (${k?.error ?? pi?.error ?? "illisible"})`);
    }
    setBulk(false);
    if (ok) toast.success(`${ok} convoyeur(s) mis à jour depuis leurs documents.`);
    if (ko.length) toast.error(`Non récupéré : ${ko.join(" · ")}`, { duration: 12000 });
    void load();
  };
  const apercu = async (c: Conv, nom: string) => {
    const w = window.open("", "_blank");
    setBusy("apercu" + c.id);
    try {
      let siret = c.siret ?? "";
      let adresse = composeAdresse(adresseDe(c as any)) || c.adresse || "";
      if (!siret || !adresse) {
        const k = await kbis({ data: { convoyeurId: c.id } }).catch(() => null);
        siret = siret || k?.siret || "";
        adresse = adresse || k?.adresse || "";
        if (siret || adresse) {
          await (supabase as any).from("convoyeurs").update({ siret: siret || null, adresse: adresse || null }).eq("id", c.id);
        }
      }
      let permisNum: string | null = c.permis_numero ?? null;
      let permisDate: string | null = (c as any).permis_date_obtention ? String((c as any).permis_date_obtention).split("-").reverse().join("/") : null;
      if (!permisNum) {
        const pi = await permisFn({ data: { convoyeurId: c.id } }).catch(() => null);
        if (pi?.ok && pi.numero) {
          permisNum = pi.numero; permisDate = pi.delivre;
          await (supabase as any).from("convoyeurs").update({ permis_numero: pi.numero }).eq("id", c.id);
        }
      }
      const blob = await generateContratConvoyeurPdf(
        { nom_complet: nom, siret: siret || null, adresse: adresse || null, permis_numero: permisNum, permis_date: permisDate, date_naissance: (c as any).date_naissance ?? null, lieu_naissance: (c as any).lieu_naissance ?? null },
        company,
      );
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.open(url, "_blank");
      void load();
    } catch (e) { w?.close(); toast.error(e instanceof Error ? e.message : "Aperçu impossible"); }
    setBusy(null);
  };

  const download = async (id: string, which: "signed" | "dossier") => {
    setBusy(id + which);
    try {
      const u = await dl({ data: { id } });
      const url = which === "signed" ? u.signed : u.dossier;
      if (!url) throw new Error("Fichier indisponible");
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible"); }
    setBusy(null);
  };

  const chip = (k: Etat | "all", label: string, n?: number) => (
    <button key={k} onClick={() => setFiltre(k)}
      className={`px-3 py-1.5 rounded-full text-sm border ${filtre === k ? "bg-[#2F5FFF] text-white border-[#2F5FFF]" : "bg-white text-pro-text border-pro-border"}`}>
      {label}{n !== undefined ? ` · ${n}` : ""}
    </button>
  );

  return (
    <div className="space-y-6">
      <style>{`.btn-mini{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid var(--pro-border,#dfe6fb);background:#fff;font-size:12px;font-weight:500;color:#1f3a8a}.btn-mini:disabled{opacity:.5}`}</style>
      <PageHeader title="Contrats convoyeurs" />
      <p className="text-sm text-pro-text-soft -mt-3">
        L'envoi est toujours manuel : rien ne part tout seul. Ouvre un convoyeur pour envoyer son contrat (ses informations sont déjà remplies), relancer, ou récupérer le contrat signé et sa preuve.
      </p>

      <div className="flex flex-wrap gap-2">
        {chip("all", "Tous", rows.filter((r) => !r.demo).length)}
        {chip("a_envoyer", "À envoyer", compte("a_envoyer"))}
        {chip("envoye", "En attente", compte("envoye"))}
        {chip("signe", "Signés", compte("signe"))}
        {chip("expire", "Expirés", compte("expire"))}
        {chip("refuse", "Refusés", compte("refuse"))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => void recupererKbis()} disabled={bulk} className="btn-mini">
          {bulk ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />} Récupérer SIRET, adresse et n° de permis
        </button>
        <div className="inline-flex rounded-lg border border-pro-border overflow-hidden text-sm">
          <button onClick={() => setTab("reel")} className={`px-3 py-1.5 ${tab === "reel" ? "bg-[#2F5FFF] text-white" : "bg-white"}`}>Convoyeurs</button>
          <button onClick={() => setTab("demo")} className={`px-3 py-1.5 ${tab === "demo" ? "bg-[#2F5FFF] text-white" : "bg-white"}`}>Démo / Test · {rows.filter((r) => r.demo).length}</button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-text-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un convoyeur"
            className="w-full pl-8 pr-3 py-2 border border-pro-border rounded-lg text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-pro-text-soft" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-pro-text-soft py-8 text-center">Aucun convoyeur pour ce filtre.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ c, req, etat, nom }) => (
            <div key={c.id} className="rounded-2xl border border-pro-border bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="w-9 h-9 rounded-lg bg-[#2F5FFF]/10 text-[#2F5FFF] flex items-center justify-center"><FileSignature size={16} /></span>
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-pro-text">{nom}</div>
                  <div className="text-xs text-pro-text-soft">{c.email}{c.telephone ? ` · ${c.telephone}` : ""}</div>
                  {c.siret && <SiretBadge admin siret={c.siret} />}
                  {req && (
                    <div className="text-xs text-pro-text-soft mt-0.5">
                      Envoyé le {new Date(req.sent_at).toLocaleDateString("fr-FR")}{req.signed_at ? ` · signé le ${new Date(req.signed_at).toLocaleDateString("fr-FR")}` : ""}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${ETATS[etat].cls}`}>{ETATS[etat].label}</span>
                {etat === "signe" && req && (
                  <>
                    <button onClick={() => void download(req.id, "signed")} disabled={busy === req.id + "signed"} className="btn-mini"><Download size={14} /> Contrat signé</button>
                    <button onClick={() => void download(req.id, "dossier")} disabled={busy === req.id + "dossier"} className="btn-mini"><ShieldCheck size={14} /> Preuve</button>
                  </>
                )}
                <button onClick={() => void apercu(c, nom)} disabled={busy === "apercu" + c.id} className="btn-mini">
                  {busy === "apercu" + c.id ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />} Aperçu du contrat
                </button>
                <Link to="/admin/convoyeurs/$convoyeurId" params={{ convoyeurId: c.id }} className="btn-mini"><ExternalLink size={14} /> Fiche</Link>
                <button onClick={() => setOpen(open === c.id ? null : c.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2F5FFF] text-white text-sm font-medium">
                  {etat === "a_envoyer" ? "Envoyer le contrat" : "Gérer"} <ChevronDown size={14} className={open === c.id ? "rotate-180" : ""} />
                </button>
              </div>
              {open === c.id && (
                <div className="border-t border-pro-border p-4 bg-slate-50/60 rounded-b-2xl" onClick={() => undefined}>
                  <ContratYousignCard
                    convoyeurId={c.id}
                    nomComplet={nom}
                    email={c.email}
                    telephone={c.telephone}
                    permisNumero={c.permis_numero ?? null}
                    permisDate={(c as any).permis_date_obtention ?? null}
                    dateNaissance={(c as any).date_naissance} lieuNaissance={(c as any).lieu_naissance}
                    siret={c.siret}
                    adresse={composeAdresse(adresseDe(c as any)) || c.adresse}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
