import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns3, Check, ChevronDown, FileText, UserRound } from "lucide-react";
import { useDriverAvatar } from "@/components/admin/DriverAvatar";

/* ------------------------------------------------------------------ */
/* Types partagés du tableau missions                                  */
/* ------------------------------------------------------------------ */

export interface ConvoyeurOption {
  id: string;
  nom: string;
}

export interface FactureLite {
  id: string;
  numero: string;
  statut: string | null;
  total: number | null;
  echeance: string | null;
  pdfUrl: string | null;
}

export interface MissionMeta {
  convoyeurId: string | null;
  convoyeurNom: string | null;
  attributionStatut: string | null;
  facture: FactureLite | null;
  vin: string | null;
  energie: string | null;
  missionId: string | null;
  attributionId?: string | null;
}

export const MISSION_COLUMNS = [
  { key: "ref", label: "Référence", locked: true },
  { key: "trajet", label: "Trajet" },
  { key: "plaque", label: "Plaque / VIN" },
  { key: "vehicule", label: "Véhicule" },
  { key: "client", label: "Client" },
  { key: "convoyeur", label: "Convoyeur" },
  { key: "date", label: "Date" },
  { key: "prix", label: "Prix" },
  { key: "paiement", label: "Facture" },
  { key: "statut", label: "Statut", locked: true },
] as const;

export type MissionColumnKey = (typeof MISSION_COLUMNS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Badge paiement                                                      */
/* ------------------------------------------------------------------ */

export function paymentState(f: FactureLite | null): "payee" | "retard" | "attente" | "aucune" {
  if (!f) return "aucune";
  const s = (f.statut ?? "").toLowerCase();
  if (["payee", "paye", "paid", "reglee"].includes(s)) return "payee";
  if (f.echeance && new Date(f.echeance) < new Date(new Date().toDateString())) return "retard";
  return "attente";
}

const PAY_META: Record<string, { label: string; cls: string }> = {
  payee: { label: "Payée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  retard: { label: "En retard", cls: "bg-red-50 text-red-700 border-red-200" },
  attente: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  aucune: { label: "—", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export function PaymentBadge({ facture }: { facture: FactureLite | null }) {
  const state = paymentState(facture);
  const meta = PAY_META[state];
  if (state === "aucune") return <span className="text-[11px] text-[var(--a6-dim)]">Aucune facture</span>;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
        {meta.label}
      </span>
      <span className="a6-mono text-[10px] text-[var(--a6-dim)]">
        {facture?.numero}
        {facture?.total != null ? ` · ${Number(facture.total).toFixed(2)} €` : ""}
      </span>
    </span>
  );
}

export function FactureQuickLink({ facture }: { facture: FactureLite | null }) {
  if (!facture?.pdfUrl) return null;
  return (
    <a
      href={facture.pdfUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Ouvrir la facture"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#eaeaee] bg-white text-[#2f5fff] hover:bg-[#f4f7ff]"
    >
      <FileText size={12} />
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar convoyeur                                                    */
/* ------------------------------------------------------------------ */

export function ConvoyeurAvatar({
  nom,
  convoyeurId,
}: {
  nom: string | null;
  convoyeurId?: string | null;
}) {
  const photo = useDriverAvatar(convoyeurId);
  const initials = (nom ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  if (photo) {
    return (
      <img
        src={photo}
        alt={nom ?? "Convoyeur"}
        title={nom ?? undefined}
        loading="lazy"
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-[#2f5fff]/30"
      />
    );
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e5e9ff] text-[10px] font-bold text-[#2f5fff]">
      {initials || <UserRound size={12} />}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de convoyeur inline                                       */
/* ------------------------------------------------------------------ */

export function ConvoyeurCell({
  meta,
  convoyeurs,
  disabled,
  locked,
  onAssign,
}: {
  meta: MissionMeta | undefined;
  convoyeurs: ConvoyeurOption[];
  disabled?: boolean;
  /** Mission terminée ou annulée : convoyeur conservé mais non modifiable */
  locked?: boolean;
  onAssign: (convoyeurId: string) => void;
}) {
  const [pending, setPending] = useState<{ id: string; nom: string } | null>(null);
  const current = meta?.convoyeurId ?? "";

  if (locked) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <ConvoyeurAvatar nom={meta?.convoyeurNom ?? null} convoyeurId={meta?.convoyeurId ?? null} />
        <span className="text-[11.5px] font-medium text-[var(--a6-text)]">
          {meta?.convoyeurNom ?? "Non attribué"}
        </span>
        <span
          title="Mission clôturée : attribution verrouillée"
          className="rounded-md border border-[#eaeaee] bg-[#f6f7fb] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-[var(--a6-dim)]"
        >
          Verrouillé
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <ConvoyeurAvatar nom={meta?.convoyeurNom ?? null} convoyeurId={meta?.convoyeurId ?? null} />
        <select
          value={current}
          disabled={disabled || !!pending}
          onChange={(e) => {
            const id = e.target.value;
            if (!id || id === current) return;
            const nom = convoyeurs.find((c) => c.id === id)?.nom ?? "ce convoyeur";
            setPending({ id, nom });
          }}
          className="max-w-[132px] rounded-md border border-[#eaeaee] bg-white px-1.5 py-1 text-[11px] text-[var(--a6-text)] outline-none focus:border-[var(--a6-blue)] disabled:opacity-50"
        >
          <option value="">Non attribué</option>
          {convoyeurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </div>
      {pending && (
        <div className="rounded-md border border-[var(--a6-blue)]/40 bg-[#f2f6ff] px-2 py-1.5 text-[10.5px] leading-snug text-[var(--a6-text)]">
          <p className="mb-1">
            {current ? "Remplacer le convoyeur par " : "Attribuer à "}
            <strong>{pending.nom}</strong> ?
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { onAssign(pending.id); setPending(null); }}
              className="rounded-md bg-[var(--a6-blue)] px-2 py-0.5 text-[10.5px] font-semibold text-white hover:brightness-110"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md border border-[#eaeaee] bg-white px-2 py-0.5 text-[10.5px] text-[var(--a6-muted)] hover:border-[var(--a6-blue)]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Menu colonnes                                                       */
/* ------------------------------------------------------------------ */

export function ColumnsMenu({
  hidden,
  onToggle,
}: {
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 224;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#eaeaee] bg-white px-3 text-[13px] font-medium text-[#2f5fff] hover:bg-[#f4f7ff]"
      >
        <Columns3 size={15} /> Colonnes <ChevronDown size={13} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              style={{ top: pos.top, left: pos.left, width: 224, maxHeight: "60vh" }}
              className="fixed z-[9999] overflow-y-auto rounded-xl border border-[#eaeaee] bg-white p-1.5 shadow-xl"
            >
              {MISSION_COLUMNS.map((c) => {
                const visible = !hidden.has(c.key);
                const locked = "locked" in c && c.locked;
                return (
                  <button
                    key={c.key}
                    disabled={locked}
                    onClick={() => onToggle(c.key)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] ${
                      locked ? "cursor-not-allowed text-[var(--a6-dim)]" : "text-[var(--a6-text)] hover:bg-[#f4f7ff]"
                    }`}
                  >
                    {c.label}
                    {visible && <Check size={13} className="text-[#2f5fff]" />}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
