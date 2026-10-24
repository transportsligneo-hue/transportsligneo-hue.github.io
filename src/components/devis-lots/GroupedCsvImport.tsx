import { useRef, useState } from "react";
import { Upload, Download } from "lucide-react";
import { toast } from "sonner";

export type ImportedVehicle = {
  immat: string; marque: string; modele: string; vin: string; energie: string; km: string; arrivee: string; notes: string;
};

const COLS: Record<string, keyof ImportedVehicle> = {
  immatriculation: "immat", plaque: "immat", immat: "immat",
  marque: "marque", modele: "modele", "modèle": "modele", vin: "vin",
  energie: "energie", "énergie": "energie", carburant: "energie",
  kilometrage: "km", "kilométrage": "km", km: "km",
  arrivee: "arrivee", "arrivée": "arrivee", destination: "arrivee", adresse_arrivee: "arrivee",
  notes: "notes", remarques: "notes", commentaire: "notes",
};

function splitLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === sep && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseVehiclesCsv(text: string): ImportedVehicle[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = [";", "\t", ","].map((s) => [s, lines[0].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const head = splitLine(lines[0], sep).map((h) => COLS[h.toLowerCase().replace(/\s+/g, "_")]);
  return lines.slice(1).map((l) => {
    const cells = splitLine(l, sep);
    const v: ImportedVehicle = { immat: "", marque: "", modele: "", vin: "", energie: "", km: "", arrivee: "", notes: "" };
    head.forEach((h, i) => { if (h && cells[i]) v[h] = cells[i]; });
    v.immat = v.immat.toUpperCase().replace(/\s+/g, "-");
    v.vin = v.vin.toUpperCase();
    v.km = v.km.replace(/[^\d]/g, "");
    return v;
  }).filter((v) => v.immat || v.vin || v.marque || v.modele);
}

const MODELE =
  "immatriculation;marque;modele;vin;energie;kilometrage;arrivee;notes\n" +
  "AB-123-CD;Renault;Clio V;;Essence;12500;Concession Nantes, 12 rue des Chantiers, 44000 Nantes;Clés à l'accueil\n" +
  "EF-456-GH;Peugeot;308;;Diesel;8300;Concession Rennes, 3 av. de la Gare, 35000 Rennes;\n";

/** Import d'un fichier CSV (Excel : Enregistrer sous > CSV) pour remplir d'un coup la liste des véhicules d'une commande groupée. */
export function GroupedCsvImport({ onImport }: { onImport: (v: ImportedVehicle[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const rows = parseVehiclesCsv(await f.text());
      if (!rows.length) { toast.error("Aucun véhicule trouvé. Utilisez le modèle CSV (colonnes : immatriculation, marque, modele, vin, energie, kilometrage, arrivee, notes)."); return; }
      onImport(rows.slice(0, 100));
      toast.success(`${Math.min(rows.length, 100)} véhicule(s) ajouté(s) à la commande${rows.length > 100 ? " (100 maximum par commande)" : ""}.`);
    } catch {
      toast.error("Fichier illisible. Enregistrez votre tableau Excel au format CSV puis réessayez.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input ref={ref} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 rounded-[11px] bg-[#2f5fff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#2450e0] disabled:opacity-60">
        <Upload className="h-4 w-4" /> {busy ? "Import en cours" : "Importer un fichier (CSV / Excel)"}
      </button>
      <a href={"data:text/csv;charset=utf-8,﻿" + encodeURIComponent(MODELE)} download="modele-import-missions.csv"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2f5fff] underline">
        <Download className="h-3.5 w-3.5" /> Télécharger le modèle
      </a>
      <span className="text-[12px] text-slate-500">Un véhicule par ligne, jusqu'à 100. Excel : « Enregistrer sous » puis CSV.</span>
    </div>
  );
}
