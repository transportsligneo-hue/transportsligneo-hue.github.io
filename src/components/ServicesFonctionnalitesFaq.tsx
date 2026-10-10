import { useMemo, useState } from "react";
import { ChevronDown, Search, MessageCircleQuestion } from "lucide-react";

type Faq = { label: string; q: string; a: string };
type Cat = { title: string; items: Faq[] };

const CATS: Cat[] = [
  {
    title: "Réservation & devis",
    items: [
      {
        label: "Devis instantané",
        q: "Comment obtenir un devis instantané ?",
        a: "Renseignez les adresses de départ et d'arrivée, le véhicule et vos options : le tarif s'affiche immédiatement. Après validation de votre demande, le devis PDF est généré et classé automatiquement dans « Factures & devis » de votre espace.",
      },
      {
        label: "Commande en 2 clics",
        q: "Comment commander un convoyage en quelques clics ?",
        a: "Depuis votre espace, « Nouvelle réservation » vous guide étape par étape : adresses (vos adresses favorites sont proposées), véhicule, créneau. Vous validez, signez le devis en ligne, et la mission est programmée.",
      },
      {
        label: "Missions groupées (flotte)",
        q: "À quoi servent les missions groupées ?",
        a: "Pour les flottes : demandez le transport de plusieurs véhicules en une seule fois. Chaque véhicule reçoit son propre devis, téléchargeable immédiatement, et l'ensemble reste regroupé dans votre suivi.",
      },
      {
        label: "Planification à l'avance",
        q: "Puis-je planifier une mission à l'avance ?",
        a: "Oui : choisissez la date et le créneau horaire qui vous conviennent lors de la demande. Vos missions planifiées apparaissent dans votre vue planning, les plus récentes en haut.",
      },
      {
        label: "Livraison simple / + restitution",
        q: "Livraison simple ou restitution et livraison : quelle différence ?",
        a: "La livraison simple déplace votre véhicule une fois. Avec la restitution, les deux trajets sont liés dans le même dossier : la livraison (L) s'affiche en premier, la restitution (R) ensuite, avec le montant total combiné.",
      },
      {
        label: "Multi-comptes (Perso/Pro/Flotte)",
        q: "Puis-je avoir plusieurs types de compte ?",
        a: "Oui : un même accès peut regrouper un espace particulier, un espace professionnel et un espace flotte. Vous basculez de l'un à l'autre sans re-saisir vos informations.",
      },
      {
        label: "Adresses favorites",
        q: "Comment fonctionnent les adresses favorites ?",
        a: "Enregistrez vos lieux habituels (domicile, dépôt, agence) dans « Mes adresses » : ils sont proposés automatiquement dans vos nouvelles demandes, pour aller plus vite et éviter les erreurs de saisie.",
      },
      {
        label: "Tarifs transparents",
        q: "Comment sont calculés les tarifs ?",
        a: "Le prix est calculé à partir de la distance réelle, du type de véhicule, des options choisies et du délai souhaité. Le montant affiché au devis est ferme : pas de frais cachés, pas de surprise à la livraison.",
      },
      {
        label: "Numéro de commande (PO) archivé",
        q: "Où renseigner mon numéro de commande (PO) ?",
        a: "Ajoutez votre référence PO / bon de commande à la demande : elle est conservée dans le dossier, visible sur la mission et reprise sur la facture pour votre comptabilité.",
      },
    ],
  },
  {
    title: "Suivi & traçabilité",
    items: [
      {
        label: "Suivi GPS en direct",
        q: "Comment suivre mon véhicule en temps réel ?",
        a: "Ouvrez la mission : la carte affiche la position du convoyeur en direct, la progression du trajet et l'heure d'arrivée estimée. Si le signal est interrompu plus de 15 minutes (zone blanche), un statut « signal perdu » s'affiche jusqu'au retour du réseau.",
      },
      {
        label: "Notifications en temps réel",
        q: "Quelles notifications vais-je recevoir ?",
        a: "Vous êtes informé à chaque moment clé : devis prêt, convoyeur attribué, départ, véhicule récupéré, arrivée proche, livraison effectuée, facture disponible.",
      },
      {
        label: "Historique complet des missions",
        q: "Où retrouver l'historique de mes missions ?",
        a: "Dans « Missions », en vue planning ou liste : chaque mission conserve date, heure, plaque, type (livraison, restitution, recharge uniquement) et, le cas échéant, le motif d'annulation.",
      },
      {
        label: "Rapports & exports en direct",
        q: "Puis-je exporter mes données ?",
        a: "Oui : vos missions, factures et rapports sont exportables depuis votre espace pour votre suivi interne et votre comptabilité.",
      },
      {
        label: "Convoyeur dédié",
        q: "Qui conduit mon véhicule ?",
        a: "Un convoyeur du réseau Transports Ligneo, identifié et attribué à votre mission. Son nom et ses informations de contact apparaissent sur la fiche mission dès l'attribution.",
      },
      {
        label: "Notification à chaque étape",
        q: "Puis-je choisir mes notifications ?",
        a: "Oui : depuis votre profil, activez ou désactivez l'email et le SMS selon vos préférences. Les alertes importantes restent visibles dans la cloche de notification de votre espace.",
      },
    ],
  },
  {
    title: "Documents & sécurité",
    items: [
      {
        label: "État des lieux photo 360°",
        q: "Comment se déroule l'état des lieux ?",
        a: "Au départ comme à la livraison, le convoyeur photographie le véhicule sous tous les angles et note chaque élément sur son application. Vous recevez le document horodaté en PDF, téléchargeable depuis la mission.",
      },
      {
        label: "Signature électronique",
        q: "Comment signe-t-on les documents ?",
        a: "Directement sur l'écran du convoyeur (ou depuis votre lien) : états des lieux, PV et devis sont signés électroniquement, horodatés et archivés automatiquement dans votre espace.",
      },
      {
        label: "Devis & factures archivés",
        q: "Où sont rangés mes devis et factures ?",
        a: "Dans « Factures & devis » : vue planning ou liste, avec le type de mission, la date, l'heure et la plaque du véhicule. Chaque document est téléchargeable en PDF.",
      },
      {
        label: "Scan de documents",
        q: "Comment fonctionne le scan de carte grise ?",
        a: "Photographiez la carte grise : le scanner détecte automatiquement les contours du document, le recadre et pré-remplit plaque, VIN, marque, modèle, couleur et énergie. Vous n'avez qu'à vérifier.",
      },
      {
        label: "Assurance tous risques incluse",
        q: "Mon véhicule est-il assuré pendant le transport ?",
        a: "Oui : chaque mission est couverte par notre assurance tous risques, sans surcoût. Les éventuels dégâts sont identifiés et documentés par photo à chaque étape.",
      },
      {
        label: "Recherche par plaque",
        q: "Puis-je retrouver une mission par plaque d'immatriculation ?",
        a: "Oui : la recherche par plaque vous permet de retrouver instantanément une mission, un devis ou une facture dans vos listes.",
      },
      {
        label: "Identification des dégâts",
        q: "Que se passe-t-il en cas de dégât constaté ?",
        a: "Tout dégât est photographié et documenté dans l'état des lieux, au départ et à l'arrivée. La comparaison des deux documents permet d'identifier précisément toute anomalie et de déclencher la prise en charge.",
      },
    ],
  },
  {
    title: "Gestion de compte",
    items: [
      {
        label: "Tableau de bord dédié",
        q: "Que contient mon tableau de bord ?",
        a: "Une vue d'ensemble de vos missions en cours, vos prochains rendez-vous et vos indicateurs. C'est le point de départ de votre espace à chaque connexion.",
      },
      {
        label: "Accès par site (flotte)",
        q: "Comment gérer plusieurs sites ou agences ?",
        a: "Si votre organisation regroupe plusieurs agences, un sélecteur de site apparaît automatiquement : véhicules, missions et conducteurs sont filtrables par site. Avec un seul site, rien ne change à votre écran.",
      },
      {
        label: "Facturation consolidée",
        q: "Puis-je regrouper la facturation de plusieurs sites ?",
        a: "Oui : choisissez une facturation consolidée pour toute l'organisation, ou une facture par site. Dans les deux cas, chaque facture reprend les missions et références correspondantes.",
      },
      {
        label: "Support dédié 7j/7",
        q: "Comment contacter le support ?",
        a: "Notre équipe est joignable 7j/7 par téléphone au 07 82 45 61 81, par email ou via la page contact. Un interlocuteur dédié suit les comptes professionnels et flottes.",
      },
      {
        label: "Joignable rapidement",
        q: "En combien de temps ai-je une réponse ?",
        a: "Nous répondons rapidement pendant toute la semaine, week-ends compris. Pour une mission en cours, le convoyeur reste joignable directement via les coordonnées de la fiche mission.",
      },
      {
        label: "Gestion des conducteurs par flotte",
        q: "Qui sont les « conducteurs » de ma flotte ?",
        a: "Vos conducteurs sont vos salariés ou collaborateurs : vous les ajoutez, retirez et associez à vos véhicules depuis « Conducteurs », avec l'historique complet des affectations. À ne pas confondre avec les convoyeurs, qui sont nos prestataires.",
      },
    ],
  },
  {
    title: "Gestion de parc & pilotage",
    items: [
      {
        label: "Gestion de parc avec alertes (CT, entretien, documents)",
        q: "Que fait la gestion de parc ?",
        a: "Votre parc est centralisé : état, localisation, documents de chaque véhicule. Des alertes vous préviennent avant les échéances importantes (contrôle technique, entretien, documents à renouveler).",
      },
      {
        label: "TCO par véhicule",
        q: "Qu'est-ce que le TCO par véhicule ?",
        a: "Le coût total de possession : entretien, carburant, assurance, convoyages… agrégés par véhicule pour piloter vos dépenses réelles et comparer vos modèles.",
      },
      {
        label: "Suivi des coûts et des mouvements",
        q: "Comment suivre les coûts et mouvements de mon parc ?",
        a: "Chaque entrée, sortie et dépense est enregistrée par véhicule : vous visualisez les mouvements et les coûts cumulés, exportables pour votre pilotage.",
      },
    ],
  },
  {
    title: "Intelligence & intégrations",
    items: [
      {
        label: "Vroomy, l'assistant IA Ligneo 24/7 (devis, suivi, missions)",
        q: "Que peut faire Vroomy, l'assistant IA ?",
        a: "Disponible 24/7, Vroomy répond à vos questions, vous aide à estimer un transport, suivre une mission ou comprendre un document — directement depuis le site et votre espace.",
      },
      {
        label: "API développeurs",
        q: "Puis-je connecter la plateforme à mes outils ?",
        a: "Oui : l'API développeurs permet de créer des missions, suivre les statuts et recevoir des notifications automatiques (webhooks) à chaque événement — idéal pour intégrer Ligneo à votre DMS, ERP ou site.",
      },
    ],
  },
];

const PERSONAL_QUESTIONS = new Set([
  "Devis instantané", "Commande en 2 clics", "Planification à l'avance", "Livraison simple / + restitution", "Tarifs transparents",
  "Suivi GPS en direct", "Notifications en temps réel", "Historique complet des missions", "Convoyeur dédié",
  "État des lieux photo 360°", "Signature électronique", "Devis & factures archivés", "Assurance tous risques incluse", "Identification des dégâts", "Joignable rapidement",
]);

export default function ServicesFonctionnalitesFaq({ variant = "particuliers" }: { variant?: "particuliers" | "pro" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const audienceCats = variant === "pro" ? CATS : CATS.map((c) => ({ ...c, items: c.items.filter((it) => PERSONAL_QUESTIONS.has(it.label)) })).filter((c) => c.items.length);
    if (!q) return audienceCats;
    return audienceCats.map((c) => ({
      ...c,
      items: c.items.filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          it.q.toLowerCase().includes(q) ||
          it.a.toLowerCase().includes(q),
      ),
    })).filter((c) => c.items.length > 0);
  }, [query, variant]);

  const total = filtered.reduce((n, c) => n + c.items.length, 0);

  return (
    <section className="v4-faq-section services-faq" aria-label={variant === "pro" ? "Questions fréquentes professionnels" : "Questions fréquentes particuliers"}>
      <button type="button" className="feat-toggle services-faq-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="services-faq-content">
        <span className="feat-toggle-label">{variant === "pro" ? "Questions fréquentes des professionnels" : "Questions fréquentes des particuliers"}</span>
        <span className="feat-toggle-chevron" aria-hidden="true"><ChevronDown size={18} /></span>
      </button>
      <div id="services-faq-content" hidden={!expanded}>

      <div style={{ position: "relative", maxWidth: 520, margin: "0 auto 30px" }}>
        <Search
          size={16}
          style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--v4-text-muted)", pointerEvents: "none" }}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une fonctionnalité… (ex : GPS, devis, conducteur)"
          aria-label="Rechercher dans la FAQ"
          style={{
            width: "100%",
            height: 46,
            paddingLeft: 42,
            paddingRight: 16,
            borderRadius: 14,
            border: "1px solid var(--v4-border)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
            fontSize: 13.5,
            outline: "none",
          }}
        />
      </div>

      {total === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 0", color: "var(--v4-text-muted)" }}>
          <MessageCircleQuestion size={26} style={{ margin: "0 auto 10px", display: "block" }} />
          <p style={{ fontSize: 13.5 }}>Aucune réponse pour « {query} » — essayez un autre mot-clé.</p>
        </div>
      ) : (
        filtered.map((cat) => (
          <div key={cat.title} style={{ marginBottom: 26 }}>
            <div
              className="feat-cat-title"
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}
            >
              {cat.title}
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {cat.items.length} question{cat.items.length > 1 ? "s" : ""}
              </span>
            </div>
            {cat.items.map((it) => {
              const key = `${cat.title}::${it.label}`;
              const isOpen = open === key;
              return (
                <div key={key} className={`v4-faq-item ${isOpen ? "v4-open" : ""}`}>
                  <button
                    type="button"
                    className="v4-faq-q"
                    onClick={() => setOpen(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span>{it.q}</span>
                    <span className="plus" aria-hidden="true">
                      <ChevronDown
                        size={13}
                        style={{
                          transition: "transform .25s ease",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          display: "block",
                          margin: "auto",
                        }}
                      />
                    </span>
                  </button>
                  {isOpen && <div className="v4-faq-a">{it.a}</div>}
                </div>
              );
            })}
          </div>
        ))
      )}
      </div>
    </section>
  );
}
