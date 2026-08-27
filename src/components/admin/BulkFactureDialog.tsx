import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  X,
  Receipt,
  Download,
  Search,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listFactureCandidates,
  ensureFacture,
  factureRowToPdfData,
  mergePdfBlobs,
  type FactureCandidate,
} from "@/lib/facture-batch";
import { generateFacturePdf, downloadFacturePdf } from "@/lib/facture-pdf";
import { logPoEvent } from "@/lib/po-history";
import { supabase } from "@/integrations/supabase/client";

const PO_LABELS = [
  "Référence client",
  "N° de commande",
  "N° BC",
  "N° dossier",
  "N° de marché",
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Rafraîchit la page appelante après émission. */
  onDone?: () => void;
  /** Pré-sélectionne des missions (ids de trajets). */
  preselectTrajetIds?: string[];
}

/** Génération groupée de factures PDF depuis Missions ou Attributions (avec PO par mission). */
export function BulkFactureDialog({
  open,
  onClose,
  onDone,
  preselectTrajetIds,
}: Props) {
  const [rows, setRows] = useState<FactureCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [onlyUnbilled, setOnlyUnbilled] = useState(false);
  const [merge, setMerge] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [po, setPo] = useState<Record<string, { ref: string; label: string }>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listFactureCandidates()
      .then((list) => {
        setRows(list);
        const nextPo: Record<string, { ref: string; label: string }> = {};
        list.forEach((r) => {
          nextPo[r.trajetId] = {
            ref: r.referenceClient ?? "",
            label: r.referenceLabel ?? "Référence client",
          };
        });
        setPo(nextPo);
        if (preselectTrajetIds?.length) {
          const pre: Record<string, boolean> = {};
          preselectTrajetIds.forEach((id) => {
            if (list.some((r) => r.trajetId === id)) pre[id] = true;
          });
          setChecked(pre);
        }
      })
      .catch((e: unknown) =>
        toast.error("Chargement impossible", {
          description: (e as Error).message,
        }),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyUnbilled && r.factureId) return false;
      if (!q) return true;
      return `${r.numeroMission ?? ""} ${r.clientLabel} ${r.itineraire} ${r.factureNumero ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, onlyUnbilled, checked]);

  const selectedIds = Object.keys(checked).filter((k) => checked[k]);
  const totalSelected = rows
    .filter((r) => checked[r.trajetId])
    .reduce((s, r) => s + Number(r.montantTtc || 0), 0);

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = { ...checked };
    filtered.forEach((r) => {
      next[r.trajetId] = v;
    });
    setChecked(next);
  };

  const run = async () => {
    const targets = rows.filter((r) => checked[r.trajetId]);
    if (!targets.length) return toast.info("Sélectionnez au moins une mission");
    setBusy(true);
    setProgress({ done: 0, total: targets.length });
    const blobs: { numero: string; blob: Blob }[] = [];
    const failures: string[] = [];

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      try {
        const entry = po[t.trajetId];
        const { row, created } = await ensureFacture(
          t.trajetId,
          t.attributionId,
          {
            referenceClient: entry?.ref ?? null,
            referenceLabel: entry?.label ?? null,
          },
        );
        const newPo = (entry?.ref ?? "").trim() || null;
        if ((t.referenceClient ?? "") !== (newPo ?? "")) {
          await logPoEvent({
            action: created ? "pdf_regenerate" : "po_change",
            factureId: row.id,
            factureNumero: row.numero,
            oldPo: t.referenceClient ?? null,
            newPo,
          });
          // Synchronise le PO sur la fiche mission (tous les volets du duo)
          if (t.attributionId) {
            await supabase.rpc("admin_set_mission_po" as never, {
              _attribution_id: t.attributionId,
              _po: newPo,
              _apply_group: true,
            } as never);
          }
        }
        const blob = await generateFacturePdf(factureRowToPdfData(row));
        blobs.push({ numero: row.numero, blob });
      } catch (e) {
        failures.push(
          `${t.numeroMission ?? t.trajetId} : ${(e as Error).message}`,
        );
      }
      setProgress({ done: i + 1, total: targets.length });
    }

    try {
      if (blobs.length === 1) {
        downloadFacturePdf(blobs[0].blob, blobs[0].numero);
      } else if (blobs.length > 1 && merge) {
        const single = await mergePdfBlobs(blobs.map((b) => b.blob));
        downloadFacturePdf(
          single,
          `lot-${blobs.length}-factures-${new Date().toISOString().slice(0, 10)}`,
        );
      } else {
        for (const b of blobs) {
          downloadFacturePdf(b.blob, b.numero);
          await new Promise((r) => setTimeout(r, 350));
        }
      }
      if (blobs.length)
        toast.success(
          `${blobs.length} facture${blobs.length > 1 ? "s" : ""} générée${blobs.length > 1 ? "s" : ""}`,
        );
      if (failures.length)
        toast.error(`${failures.length} échec(s)`, {
          description: failures.slice(0, 3).join(" · "),
        });
    } catch (e) {
      toast.error("Assemblage PDF impossible", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
      setProgress(null);
      onDone?.();
      try {
        setRows(await listFactureCandidates());
      } catch {
        /* ignore */
      }
    }
  };

  if (!open) return null;
  const eur = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0b1026]">
              <Receipt size={15} /> Facturation en lot
            </p>
            <p className="truncate text-xs text-black/50">
              Sélectionnez plusieurs missions terminées, renseignez les PO,
              générez les PDF en une fois.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-black/10 p-2 text-black/60 hover:bg-black/5 disabled:opacity-40"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-black/5 px-4 py-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher mission, client, n° facture…"
              className="w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-[13px] text-[#0b1026] outline-none focus:border-[#2F5FFF]"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-black/70">
            <input
              type="checkbox"
              checked={onlyUnbilled}
              onChange={(e) => setOnlyUnbilled(e.target.checked)}
            />{" "}
            Non facturées
          </label>
          <label className="flex items-center gap-1.5 text-xs text-black/70">
            <input
              type="checkbox"
              checked={merge}
              onChange={(e) => setMerge(e.target.checked)}
            />{" "}
            Fusionner en un seul PDF
          </label>
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-[#2F5FFF] hover:bg-[#f4f7ff]"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs text-black/60 hover:bg-black/5"
          >
            Tout décocher
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f7f8fc] px-3 py-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-black/50">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-black/50">
              Aucune mission facturable.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const on = !!checked[r.trajetId];
                const entry = po[r.trajetId] ?? {
                  ref: "",
                  label: "Référence client",
                };
                return (
                  <div
                    key={r.trajetId}
                    className={`rounded-xl border bg-white p-3 ${on ? "border-[#2F5FFF]" : "border-black/10"}`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setChecked((c) => ({
                            ...c,
                            [r.trajetId]: e.target.checked,
                          }))
                        }
                        className="mt-1"
                      />
                      <div className="min-w-[180px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#0b1026]">
                            {r.numeroMission ?? "Mission sans numéro"}
                          </span>
                          {r.isGroup && (
                            <span className="rounded-full bg-[#eef3ff] px-2 py-0.5 text-[10px] font-semibold text-[#2F5FFF]">
                              Duo L + R
                            </span>
                          )}
                          {r.factureNumero && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <CheckCircle2 size={10} /> {r.factureNumero}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-black/60">
                          {r.clientLabel} · {r.itineraire}
                        </p>
                        <p className="text-[11px] text-black/45">
                          {r.dateMission ?? "—"} ·{" "}
                          {eur(Number(r.montantTtc || 0))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={entry.label}
                          onChange={(e) =>
                            setPo((p) => ({
                              ...p,
                              [r.trajetId]: { ...entry, label: e.target.value },
                            }))
                          }
                          className="h-9 rounded-lg border border-black/10 bg-white px-2 text-[12px] text-[#0b1026]"
                        >
                          {PO_LABELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <input
                          value={entry.ref}
                          onChange={(e) =>
                            setPo((p) => ({
                              ...p,
                              [r.trajetId]: { ...entry, ref: e.target.value },
                            }))
                          }
                          placeholder="PO / réf. client"
                          className="h-9 w-40 rounded-lg border border-black/10 bg-white px-2.5 text-[12px] text-[#0b1026] outline-none focus:border-[#2F5FFF]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-4 py-3">
          <p className="text-xs text-black/60">
            {selectedIds.length} mission{selectedIds.length > 1 ? "s" : ""}{" "}
            sélectionnée{selectedIds.length > 1 ? "s" : ""} ·{" "}
            {eur(totalSelected)}
            {progress && (
              <>
                {" "}
                · {progress.done}/{progress.total} traitée(s)
              </>
            )}
          </p>
          <button
            type="button"
            onClick={run}
            disabled={busy || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2F5FFF] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#2450e0] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            Générer les factures
          </button>
        </div>
      </div>
    </div>
  );
}
