import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const COLS: Record<string, string> = {
  immatriculation: "immatriculation", plaque: "immatriculation", marque: "marque", modele: "modele", "modèle": "modele",
  vin: "vin", energie: "energie", "énergie": "energie", couleur: "couleur", kilometrage: "kilometrage", "kilométrage": "kilometrage",
};

function parse(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(sep).map((h) => COLS[h.trim().toLowerCase()] ?? "");
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    const row: Record<string, string> = {};
    head.forEach((h, i) => { if (h && cells[i]?.trim()) row[h] = cells[i].trim().replace(/^"|"$/g, ""); });
    return row;
  });
}

/** Import d'un fichier CSV/Excel (enregistré en CSV) de véhicules dans le parc. */
export function VehicleCsvImport({ orgId }: { orgId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const rows = parse(await f.text())
        .filter((r) => r.immatriculation || r.vin)
        .map((r) => ({
          organization_id: orgId,
          immatriculation: r.immatriculation?.toUpperCase() ?? null,
          marque: r.marque ?? null, modele: r.modele ?? null, vin: r.vin?.toUpperCase() ?? null,
          energie: r.energie ?? null, couleur: r.couleur ?? null,
          kilometrage: r.kilometrage ? Number(r.kilometrage.replace(/\s/g, "")) || null : null,
        }));
      if (!rows.length) { toast.error("Aucun véhicule trouvé. Colonnes attendues : immatriculation, marque, modele, vin, energie, couleur, kilometrage."); return; }
      const { error } = await supabase.from("vehicles").insert(rows);
      if (error) toast.error("Import impossible : " + error.message);
      else toast.success(`${rows.length} véhicule(s) importé(s)`);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        title="Fichier CSV (Excel : Enregistrer sous > CSV) avec les colonnes immatriculation, marque, modele, vin, energie, couleur, kilometrage"
        className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#14161c] hover:border-[#2f5fff]">
        <Upload size={14} /> {busy ? "Import…" : "Importer un fichier"}
      </button>
    </>
  );
}
