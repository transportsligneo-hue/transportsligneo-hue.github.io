import { createFileRoute } from "@tanstack/react-router";
import { DemoProModules } from "@/components/demo/DemoProModules";
import type { ProMission } from "@/hooks/useProMissions";

const now = new Date();
const iso = (o: number) => new Date(now.getTime() + o * 86400000).toISOString().slice(0, 10);
const ts = (o: number) => new Date(now.getTime() + o * 86400000).toISOString();

const MISSIONS: ProMission[] = [
  { id: "d1", numero: "MIS-TLG-2026-301", ville_depart: "Tours", ville_arrivee: "Lyon", date_prise_en_charge: iso(-1), heure_prise_en_charge: "08:30", statut: "en_cours", prix_total: 420, created_at: ts(-6), updated_at: ts(-1), immatriculation: "GH-214-KL", marque: "Peugeot", modele: "3008", site_id: null },
  { id: "d4", numero: "MIS-TLG-2026-287", ville_depart: "Le Mans", ville_arrivee: "Tours", date_prise_en_charge: iso(-12), heure_prise_en_charge: "09:00", statut: "livree", prix_total: 120, created_at: ts(-14), updated_at: ts(-12), immatriculation: "DL-330-QP", marque: "Volkswagen", modele: "Golf 8", site_id: null },
];

export const Route = createFileRoute("/demo-test")({
  component: () => (
    <main className="demo-pro">
      <DemoProModules missions={MISSIONS} now={now} />
      <div className="demo-pro-cta">
        <p>Envie de piloter vos propres véhicules comme ceci ?</p>
        <span className="btn-onyx">Créer mon compte professionnel</span>
      </div>
    </main>
  ),
});
