/** Vrais avis Google de Transports Ligneo (copiés depuis la fiche Google, octobre 2026). */
export type GoogleReview = {
  id: string;
  name: string;
  note: number;
  text: string;
  role: string;
  color: string;
};

export const GOOGLE_RATING = 4.8;

export const GOOGLE_REVIEWS: GoogleReview[] = [
  {
    id: "g-emmanuel-maurin",
    name: "Emmanuel M.",
    note: 5,
    text: "Ponctualité, réactivité… service impeccable ! Le convoyeur est très sympathique, ce qui ne gâche rien.",
    role: "Particulier",
    color: "#0f6b4f",
  },
  {
    id: "g-ju-bougzer",
    name: "Ju B.",
    note: 5,
    text: "Très bonne expérience avec Transports Ligneo ! Équipe sérieuse, réactive et professionnelle. Le suivi est impeccable, les délais respectés et la prestation s’est déroulée sans aucun souci. Un service de confiance que je recommande sans hésitation.",
    role: "Concessionnaire auto, professionnel de l’automobile",
    color: "#1d5fa8",
  },
  {
    id: "g-steph-fernand",
    name: "Steph F.",
    note: 4,
    text: "Beaucoup de réactivité dans la communication.",
    role: "Particulier",
    color: "#8e3fb0",
  },
];
