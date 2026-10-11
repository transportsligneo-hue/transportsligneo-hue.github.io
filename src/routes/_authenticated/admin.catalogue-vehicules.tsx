import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Plus, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type CatalogEntry, catalogPhotoUrl, loadCatalog } from "@/lib/vehicle-catalog";

export const Route = createFileRoute("/_authenticated/admin/catalogue-vehicules")({
  head: () => ({ meta: [{ title: "Catalogue véhicules — Admin Ligneo" }, { name: "description", content: "Photos officielles des modèles affichées dans les espaces flotte." }] }),
  component: CataloguePage,
});

const SUGGESTIONS: [string, string][] = [
  ["Renault", "Clio"], ["Renault", "Captur"], ["Renault", "Mégane E-Tech"], ["Renault", "R5 E-Tech"], ["Renault", "Austral"], ["Renault", "Kangoo"], ["Renault", "Trafic"],
  ["Peugeot", "208"], ["Peugeot", "2008"], ["Peugeot", "308"], ["Peugeot", "3008"], ["Peugeot", "e-208"], ["Peugeot", "Partner"], ["Peugeot", "Expert"],
  ["Citroën", "C3"], ["Citroën", "ë-C4"], ["Citroën", "Berlingo"], ["Dacia", "Sandero"], ["Dacia", "Duster"], ["Dacia", "Spring"],
  ["Tesla", "Model 3"], ["Tesla", "Model Y"], ["Volkswagen", "Golf"], ["Volkswagen", "Polo"], ["Volkswagen", "ID.3"], ["Volkswagen", "ID.4"],
  ["Toyota", "Yaris"], ["Toyota", "C-HR"], ["Fiat", "500e"], ["Kia", "EV6"], ["Kia", "Niro"], ["Hyundai", "Kona"],
  ["BMW", "Série 1"], ["BMW", "iX1"], ["Mercedes-Benz", "Classe A"], ["Audi", "A3"], ["MG", "MG4"], ["Skoda", "Octavia"],
];

function Thumb({ path }: { path: string | null }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { if (path) void catalogPhotoUrl(path).then(setU); else setU(null); }, [path]);
  return u ? <img src={u} alt="" className="h-full w-full object-contain" /> : <Car className="h-10 w-10 text-muted-foreground" />;
}

function CataloguePage() {
  const [rows, setRows] = useState<CatalogEntry[]>([]);
  const [f, setF] = useState({ marque: "", modele: "" });
  const [q, setQ] = useState("");
  const reload = () => void loadCatalog().then(setRows);
  useEffect(reload, []);

  const add = async (marque: string, modele: string) => {
    if (!marque.trim() || !modele.trim()) return toast.error("Marque et modèle obligatoires");
    const { error } = await supabase.from("vehicle_catalog").insert({ marque: marque.trim(), modele: modele.trim() });
    if (error) return toast.error(error.code === "23505" ? "Ce modèle existe déjà" : error.message);
    setF({ marque: "", modele: "" }); reload();
  };
  const addAll = async () => {
    const have = new Set(rows.map((r) => `${r.marque}|${r.modele}`.toLowerCase()));
    const list = SUGGESTIONS.filter(([m, mo]) => !have.has(`${m}|${mo}`.toLowerCase())).map(([marque, modele]) => ({ marque, modele }));
    if (!list.length) return toast.info("Tous les modèles courants sont déjà présents");
    const { error } = await supabase.from("vehicle_catalog").insert(list);
    if (error) return toast.error(error.message);
    toast.success(`${list.length} modèles ajoutés, il ne reste qu'à mettre les photos`); reload();
  };
  const upload = async (r: CatalogEntry, file: File) => {
    const path = `${r.id}/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("vehicle-catalog").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error(error.message);
    await supabase.from("vehicle_catalog").update({ photo_path: path, updated_at: new Date().toISOString() }).eq("id", r.id);
    toast.success("Photo enregistrée"); reload();
  };
  const del = async (r: CatalogEntry) => {
    if (!confirm(`Supprimer ${r.marque} ${r.modele} ?`)) return;
    await supabase.from("vehicle_catalog").delete().eq("id", r.id); reload();
  };

  const shown = rows.filter((r) => `${r.marque} ${r.modele}`.toLowerCase().includes(q.toLowerCase()));
  const withPhoto = rows.filter((r) => r.photo_path).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catalogue véhicules</h1>
          <p className="text-muted-foreground">Ajoutez les modèles et leur photo. Elle s'affiche automatiquement dans « Ajouter un véhicule » dès que la marque et le modèle correspondent. {withPhoto}/{rows.length} avec photo.</p>
        </div>
        <button onClick={() => void addAll()} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">Ajouter les modèles de leasing courants</button>
      </div>
      <div className="flex flex-wrap gap-2 rounded-xl border p-4">
        <input className="h-10 rounded-md border bg-background px-3" placeholder="Marque" value={f.marque} onChange={(e) => setF({ ...f, marque: e.target.value })} />
        <input className="h-10 rounded-md border bg-background px-3" placeholder="Modèle" value={f.modele} onChange={(e) => setF({ ...f, modele: e.target.value })} />
        <button onClick={() => void add(f.marque, f.modele)} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-primary-foreground"><Plus className="h-4 w-4" />Ajouter</button>
        <input className="ml-auto h-10 rounded-md border bg-background px-3" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((r) => (
          <div key={r.id} className="overflow-hidden rounded-xl border">
            <div className="flex h-36 items-center justify-center bg-muted/40 p-2"><Thumb path={r.photo_path} /></div>
            <div className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold">{r.marque} {r.modele}</p><p className="text-xs text-muted-foreground">{r.photo_path ? "Photo en ligne" : "Photo à ajouter"}</p></div>
                <button onClick={() => void del(r)} aria-label="Supprimer" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />{r.photo_path ? "Changer la photo" : "Mettre la photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const x = e.target.files?.[0]; if (x) void upload(r, x); }} />
              </label>
            </div>
          </div>
        ))}
        {!shown.length && <p className="text-muted-foreground">Aucun modèle. Cliquez sur « Ajouter les modèles de leasing courants » pour démarrer.</p>}
      </div>
    </div>
  );
}
