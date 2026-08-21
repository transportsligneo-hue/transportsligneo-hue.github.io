const STEPS = [
  {
    title: "Estimation & devis en ligne",
    desc: "Vous renseignez le trajet, le véhicule et la date souhaitée.",
    points: [
      "Tarif instantané, péages et carburant inclus",
      "Devis simple ou groupé (plusieurs véhicules)",
      "Envoi du devis PDF par email",
    ],
  },
  {
    title: "Validation par notre équipe",
    desc: "Un exploitant contrôle la faisabilité et confirme la mission.",
    points: [
      "Vérification des créneaux et des contraintes",
      "Ajustement des contacts et des accès sur site",
      "Confirmation écrite et bon de commande archivé",
    ],
  },
  {
    title: "Recherche du convoyeur & prise en charge",
    desc: "Un convoyeur professionnel est affecté puis se déplace sur site.",
    points: [
      "Convoyeur assuré, formé et identifiable",
      "État des lieux photo 360° et signature à l'enlèvement",
      "Suivi GPS activé dès le départ",
    ],
  },
  {
    title: "Livraison ou restitution",
    desc: "Le véhicule est remis au destinataire, dossier complet à l'appui.",
    points: [
      "État des lieux d'arrivée et signature du réceptionnaire",
      "Rapport PDF disponible immédiatement",
      "Facturation consolidée par site ou par mission",
    ],
  },
];

export default function ProTimeline() {
  return (
    <div className="v4-section">
      <div className="v4-section-head">
        <div className="v4-hero-eyebrow v" style={{ justifyContent: "center", width: "100%" }}>
          <span className="dot" />Comment ça marche
        </div>
        <h2>Quatre étapes, du devis à la livraison</h2>
        <p>Un process industrialisé et traçable, conçu pour les volumes professionnels.</p>
      </div>

      <ol className="pro-tl">
        {STEPS.map((s, i) => (
          <li key={s.title} className="pro-tl-item">
            <div className="pro-tl-marker">
              <span className="pro-tl-num">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div className="pro-tl-body">
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              <ul>
                {s.points.map((p) => (
                  <li key={p}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
