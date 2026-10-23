import { useState } from "react";
import { Download, ShieldCheck, Gauge, Repeat, Webhook, AlertTriangle, KeyRound, FlaskConical } from "lucide-react";
import {
  API_BASE_URL, ENDPOINTS, ERROR_DOC, WEBHOOK_DOC, curlExample, type Endpoint,
} from "@/lib/api/openapi-spec";

const TAGS: Endpoint["tag"][] = ["Devis", "Missions", "Documents"];

const VERIFY_SNIPPET = `import crypto from "node:crypto";

// En-tête reçu : X-Ligneo-Signature: t=1761300000,v1=3a1f…
export function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // rejette les envois rejoués trop tard
  const expected = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`;

function EndpointCard({ e }: { e: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`devdoc-ep${open ? " is-open" : ""}`}>
      <button type="button" className="devdoc-ep-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`devdoc-method devdoc-method--${e.method.toLowerCase()}`}>{e.method}</span>
        <code>{e.path}</code>
        <span className="devdoc-ep-sum">{e.summary}</span>
        {e.idempotent && <span className="devdoc-badge">Idempotent</span>}
        <span className="devdoc-chev">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="devdoc-ep-body">
          <p>{e.description}</p>
          {(e.query || e.body) && (
            <table className="devdoc-table">
              <thead><tr><th>Paramètre</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                {[...(e.query ?? []), ...(e.body ?? [])].map((f) => (
                  <tr key={f.name}>
                    <td><code>{f.name}</code>{f.required && <em>requis</em>}</td>
                    <td>{f.type}</td>
                    <td>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="devdoc-cols">
            <div><h4>Requête</h4><pre>{curlExample(e)}</pre></div>
            <div><h4>Réponse</h4><pre>{JSON.stringify(e.example, null, 2)}</pre></div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ApiReference() {
  return (
    <section className="devdoc" id="documentation">
      <div className="developer-section-head">
        <span>Documentation</span>
        <h2>Tout ce qu'il faut pour intégrer l'API</h2>
        <p>Consultable sans compte. Pour obtenir vos clés (sandbox gratuite), demandez un accès : votre espace professionnel les génère en un clic.</p>
        <div className="devdoc-actions">
          <a className="developer-button developer-button-primary" href="/api/public/v1/openapi.json" download="ligneo-openapi.json"><Download size={16} /> Fichier OpenAPI (JSON)</a>
          <a className="developer-button developer-button-outline" href="/api/public/v1/openapi.json" target="_blank" rel="noreferrer">Voir la spécification</a>
        </div>
        <p className="devdoc-small">Importez-le dans Postman, Insomnia ou Swagger : tous les appels sont prêts à tester.</p>
      </div>

      <div className="devdoc-grid">
        <div className="devdoc-card"><KeyRound size={20} /><h3>Authentification</h3><p>Une clé secrète par environnement, envoyée depuis votre serveur : <code>Authorization: Bearer sk_live_…</code>. Les clés sont stockées chiffrées chez nous ; la valeur n'est affichée qu'une seule fois.</p></div>
        <div className="devdoc-card"><FlaskConical size={20} /><h3>Sandbox</h3><p>Avec une clé <code>sk_test_…</code>, aucune mission réelle n'est créée et aucun convoyeur n'est attribué. Mêmes formats de réponse, idéal pour valider votre intégration.</p></div>
        <div className="devdoc-card"><Gauge size={20} /><h3>Limites et en-têtes</h3><p>100 requêtes par minute et par clé. Chaque réponse contient <code>X-Request-Id</code>, <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> et <code>Retry-After</code> en cas de dépassement.</p></div>
        <div className="devdoc-card"><Repeat size={20} /><h3>Zéro doublon</h3><p>Ajoutez <code>Idempotency-Key</code> aux créations de devis et de missions. Si vous renvoyez la même requête (coupure réseau, nouvel essai), vous recevez la première réponse avec <code>Idempotent-Replayed: true</code> : rien n'est créé deux fois.</p></div>
      </div>

      <h3 className="devdoc-h">Référence des endpoints</h3>
      <p className="devdoc-small">Base : <code>{API_BASE_URL}</code> · cliquez sur un endpoint pour voir les paramètres et un exemple.</p>
      {TAGS.map((tag) => (
        <div key={tag} className="devdoc-group">
          <h4>{tag}</h4>
          {ENDPOINTS.filter((e) => e.tag === tag).map((e) => <EndpointCard key={e.id} e={e} />)}
        </div>
      ))}

      <h3 className="devdoc-h"><Webhook size={20} /> Webhooks</h3>
      <p className="devdoc-small">Un message JSON signé (HMAC SHA-256) est envoyé à votre URL HTTPS à chaque changement. En cas d'échec, 3 tentatives (1 s puis 4 s) ; chaque envoi est visible dans votre journal et peut être rejoué en un clic.</p>
      <table className="devdoc-table">
        <thead><tr><th>Événement</th><th>Quand</th></tr></thead>
        <tbody>{WEBHOOK_DOC.map((w) => <tr key={w.event}><td><code>{w.event}</code></td><td>{w.description}</td></tr>)}</tbody>
      </table>
      <div className="devdoc-cols">
        <div><h4>Vérifier la signature</h4><pre>{VERIFY_SNIPPET}</pre></div>
        <div><h4>Contenu d'un événement</h4><pre>{JSON.stringify({ id: "evt_8f2c41d0a9b3e7c5", type: "mission.delivered", created_at: "2026-10-24T09:30:00Z", livemode: true, data: { mission_id: "mis_…", status: "delivered" } }, null, 2)}</pre></div>
      </div>

      <h3 className="devdoc-h"><AlertTriangle size={20} /> Erreurs</h3>
      <table className="devdoc-table">
        <thead><tr><th>HTTP</th><th>Type</th><th>Signification</th></tr></thead>
        <tbody>{ERROR_DOC.map((r) => <tr key={r.status}><td><code>{r.status}</code></td><td><code>{r.type}</code></td><td>{r.description}</td></tr>)}</tbody>
      </table>
      <p className="devdoc-small">Toutes les erreurs ont le même format : <code>{`{ "error": { "type", "message", "request_id" } }`}</code>. Communiquez le <code>request_id</code> à notre support pour un diagnostic immédiat.</p>

      <div className="devdoc-secure"><ShieldCheck size={22} /><div><b>Pensé pour les grands comptes</b><span>Clés chiffrées et révocables, sandbox séparée, quotas par clé, journal des requêtes sur 90 jours, webhooks signés avec horodatage, et traçabilité par identifiant de requête.</span></div></div>
    </section>
  );
}
