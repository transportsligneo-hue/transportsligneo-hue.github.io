import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Car, History, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/flotte/conducteurs")({
  component: FlotteConducteurs,
});

interface ConducteurRow {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  numero_permis: string | null;
  permis_categorie: string | null;
  permis_expiration: string | null;
  statut: string;
}

interface VehicleRow {
  id: string;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
}

interface AffectationRow {
  id: string;
  conducteur_id: string;
  vehicle_id: string;
  is_principal: boolean;
  date_debut: string;
  date_fin: string | null;
}

const EMPTY_FORM = {
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  numero_permis: "",
  permis_categorie: "B",
  permis_expiration: "",
};

function vehicleLabel(v: VehicleRow | undefined) {
  if (!v) return "Véhicule supprimé";
  const modele = [v.marque, v.modele].filter(Boolean).join(" ");
  return `${v.immatriculation ?? "—"}${modele ? ` · ${modele}` : ""}`;
}

function frDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function FlotteConducteurs() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<ConducteurRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [affectations, setAffectations] = useState<AffectationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newVehicleId, setNewVehicleId] = useState("");

  const load = useCallback(async (organizationId: string) => {
    const [{ data: cond }, { data: veh }] = await Promise.all([
      supabase
        .from("conducteurs_flotte")
        .select("id, prenom, nom, email, telephone, numero_permis, permis_categorie, permis_expiration, statut")
        .eq("organization_id", organizationId)
        .order("nom", { ascending: true }),
      supabase
        .from("vehicles")
        .select("id, immatriculation, marque, modele")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("immatriculation", { ascending: true }),
    ]);
    const conducteurs = (cond ?? []) as ConducteurRow[];
    setRows(conducteurs);
    setVehicles((veh ?? []) as VehicleRow[]);

    if (conducteurs.length) {
      const { data: aff } = await supabase
        .from("conducteur_vehicules")
        .select("id, conducteur_id, vehicle_id, is_principal, date_debut, date_fin")
        .in("conducteur_id", conducteurs.map((c) => c.id))
        .order("date_debut", { ascending: false });
      setAffectations((aff ?? []) as AffectationRow[]);
    } else {
      setAffectations([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mem } = await supabase
        .from("organization_members").select("organization_id")
        .eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem) { setLoading(false); return; }
      setOrgId(mem.organization_id);
      await load(mem.organization_id);
    })();
  }, [user, load]);

  const vehicleById = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v])),
    [vehicles],
  );

  const activeByConducteur = useMemo(() => {
    const map = new Map<string, AffectationRow[]>();
    affectations.filter((a) => !a.date_fin).forEach((a) => {
      map.set(a.conducteur_id, [...(map.get(a.conducteur_id) ?? []), a]);
    });
    return map;
  }, [affectations]);

  const detail = rows.find((r) => r.id === detailId) ?? null;
  const detailAffectations = detailId
    ? affectations.filter((a) => a.conducteur_id === detailId)
    : [];

  const addConducteur = async () => {
    if (!orgId || !form.prenom.trim() || !form.nom.trim()) {
      toast.error("Prénom et nom obligatoires");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("conducteurs_flotte").insert({
      organization_id: orgId,
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      email: form.email.trim() || null,
      telephone: form.telephone.trim() || null,
      numero_permis: form.numero_permis.trim() || null,
      permis_categorie: form.permis_categorie.trim() || null,
      permis_expiration: form.permis_expiration || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conducteur ajouté");
    setForm({ ...EMPTY_FORM });
    setOpenAdd(false);
    await load(orgId);
  };

  const removeConducteur = async (id: string) => {
    if (!orgId) return;
    const { error } = await supabase.from("conducteurs_flotte").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Conducteur retiré");
    setDetailId(null);
    await load(orgId);
  };

  const assignVehicle = async () => {
    if (!orgId || !detailId || !newVehicleId) return;
    const { error } = await supabase.from("conducteur_vehicules").insert({
      conducteur_id: detailId,
      vehicle_id: newVehicleId,
      is_principal: (activeByConducteur.get(detailId) ?? []).length === 0,
    });
    if (error) { toast.error(error.message); return; }
    setNewVehicleId("");
    toast.success("Véhicule associé");
    await load(orgId);
  };

  const endAssignment = async (affectationId: string) => {
    if (!orgId) return;
    const { error } = await supabase
      .from("conducteur_vehicules")
      .update({ date_fin: new Date().toISOString().slice(0, 10) })
      .eq("id", affectationId);
    if (error) { toast.error(error.message); return; }
    toast.success("Affectation clôturée");
    await load(orgId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-pro-text">Conducteurs de votre société</h1>
          <p className="text-sm text-pro-muted mt-1">
            Salariés et collaborateurs qui utilisent les véhicules de votre parc au quotidien.
            Ils n'interviennent pas sur les missions de convoyage Ligneo.
          </p>
        </div>
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Ajouter un conducteur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau conducteur</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prénom *</Label>
                <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Nom *</Label>
                <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Email (notifications)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Téléphone</Label>
                <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>N° de permis</Label>
                <Input value={form.numero_permis} onChange={(e) => setForm({ ...form, numero_permis: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Catégorie</Label>
                <Input value={form.permis_categorie} onChange={(e) => setForm({ ...form, permis_categorie: e.target.value })} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Validité du permis</Label>
                <Input type="date" value={form.permis_expiration} onChange={(e) => setForm({ ...form, permis_expiration: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenAdd(false)}>Annuler</Button>
              <Button onClick={addConducteur} disabled={saving}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conducteur</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Permis</TableHead>
              <TableHead>Véhicules attribués</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-pro-muted">Chargement…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-pro-muted">Aucun conducteur enregistré</TableCell></TableRow>
            ) : rows.map((r) => {
              const actifs = activeByConducteur.get(r.id) ?? [];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2"><UserRound size={14} className="text-pro-muted" />{r.prenom} {r.nom}</span>
                  </TableCell>
                  <TableCell className="text-pro-muted">{r.email ?? "—"}</TableCell>
                  <TableCell className="text-pro-muted">{r.telephone ?? "—"}</TableCell>
                  <TableCell className="text-pro-muted">
                    {r.permis_categorie ?? "—"}
                    {r.permis_expiration ? ` · ${frDate(r.permis_expiration)}` : ""}
                  </TableCell>
                  <TableCell>
                    {actifs.length === 0 ? <span className="text-pro-muted">Aucun</span> : (
                      <span className="inline-flex flex-wrap gap-1">
                        {actifs.map((a) => (
                          <span key={a.id} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]">
                            <Car size={11} />{vehicleLabel(vehicleById.get(a.vehicle_id))}
                          </span>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind={r.statut === "actif" ? "success" : "neutral"}>
                      {r.statut === "actif" ? "Actif" : r.statut}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setDetailId(r.id)}>
                      <History size={13} /> Gérer
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.prenom} ${detail.nom}` : "Conducteur"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">Associer un véhicule du parc</p>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
                  value={newVehicleId}
                  onChange={(e) => setNewVehicleId(e.target.value)}
                >
                  <option value="">Choisir un véhicule…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>
                  ))}
                </select>
                <Button onClick={assignVehicle} disabled={!newVehicleId}>Associer</Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Historique d'utilisation des véhicules</p>
              <div className="rounded-md border divide-y">
                {detailAffectations.length === 0 ? (
                  <p className="p-3 text-sm text-pro-muted">Aucune affectation enregistrée.</p>
                ) : detailAffectations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <Car size={14} className="text-pro-muted" />
                      {vehicleLabel(vehicleById.get(a.vehicle_id))}
                    </span>
                    <span className="text-pro-muted text-xs">
                      Du {frDate(a.date_debut)} {a.date_fin ? `au ${frDate(a.date_fin)}` : "· en cours"}
                    </span>
                    {!a.date_fin && (
                      <Button size="sm" variant="ghost" onClick={() => endAssignment(a.id)}>Clôturer</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="justify-between">
            <Button
              variant="destructive"
              className="gap-1"
              onClick={() => detailId && removeConducteur(detailId)}
            >
              <Trash2 size={14} /> Retirer ce conducteur
            </Button>
            <Button variant="outline" onClick={() => setDetailId(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
