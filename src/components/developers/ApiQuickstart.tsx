import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Copy, KeyRound, Play, Terminal } from "lucide-react";
import { ENDPOINTS, curlExample } from "@/lib/api/openapi-spec";

/** « Testez en 5 minutes » : trois étapes, une commande à copier, une réponse réelle. */
export default function ApiQuickstart() {
  const est = ENDPOINTS.find((e) => e.id === "estimate")!;
  const cmd = curlExample(est, "sk_test_VOTRE_CLE");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const steps = [
    { Icon: KeyRound, t: "1 · Créez votre clé sandbox", d: "Dans votre espace pro, onglet API : une clé de test gratuite en un clic. Aucune mission réelle n'est créée." },
    { Icon: Terminal, t: "2 · Lancez une requête", d: "Copiez la commande ci-dessous dans votre terminal, en remplaçant la clé." },
    { Icon: Play, t: "3 · Recevez votre devis", d: "Le prix, la distance et la durée reviennent en JSON, au même format qu'en production." },
  ];
  return (
    <section className="developer-section dq-section" id="demarrage-rapide">
      <div className="developer-section-head">
        <span>Démarrage rapide</span>
        <h2>Testez en 5 minutes</h2>
        <p>Une clé sandbox, une commande, un devis. Sans engagement et sans facturation.</p>
      </div>
      <div className="dq-steps">
        {steps.map(({ Icon, t, d }) => (
          <div key={t} className="dq-step"><span className="dq-ic"><Icon size={19} /></span><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>
      <div className="dq-term">
        <div className="dq-term-bar">
          <span className="dq-dots"><i /><i /><i /></span>
          <b>Terminal</b>
          <button type="button" onClick={copy} className="dq-copy">{copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}</button>
        </div>
        <pre>{cmd}</pre>
        <div className="dq-res-label">Réponse</div>
        <pre className="dq-res">{JSON.stringify(est.example, null, 2)}</pre>
      </div>
      <div className="dq-cta">
        <Link className="developer-button developer-button-primary" to="/dashboard-pro/api">Créer ma clé sandbox <ArrowRight size={17} /></Link>
        <Link className="developer-button developer-button-outline" to="/contact">Demander un accès API</Link>
      </div>
    </section>
  );
}
