import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Terminal, Truck, Webhook, FileText, ShieldCheck, Boxes } from "lucide-react";

export const Route = createFileRoute("/developpeurs")({
  component: DeveloperDocs,
  head: () => ({
    meta: [
      { title: "API Développeur — Transports Ligneo" },
      {
        name: "description",
        content:
          "Documentation de l'API Transports Ligneo : créez devis et missions de convoyage depuis votre DMS, ERP ou plateforme de gestion de flotte.",
      },
      { property: "og:title", content: "API Développeur — Transports Ligneo" },
      {
        property: "og:description",
        content: "Endpoints devis, missions, suivi temps réel, documents et webhooks signés HMAC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SECTIONS = [
  { id: "authentification", label: "Authentification", icon: ShieldCheck },
  { id: "devis", label: "Devis", icon: FileText },
  { id: "missions", label: "Missions", icon: Truck },
  { id: "documents", label: "Documents", icon: Boxes },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "statuts", label: "Codes de statut", icon: Terminal },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#070b1c] p-4 font-mono text-[12.5px] leading-relaxed text-[#c9d6ff]">
      {children}
    </pre>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  const tone =
    method === "GET" ? "bg-[#16a34a]/15 text-[#4ade80]"
    : method === "DELETE" ? "bg-[#dc2626]/15 text-[#f87171]"
    : "bg-[#2f5fff]/20 text-[#7ea2ff]";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold ${tone}`}>{method}</span>
      <code className="font-mono text-sm text-white/90">{path}</code>
    </div>
  );
}

function DeveloperDocs() {
  const [env, setEnv] = useState<"sandbox" | "live">("sandbox");
  const baseUrl =
    env === "sandbox"
      ? "https://api-sandbox.transportsligneo.fr/v1"
      : "https://api.transportsligneo.fr/v1";
  const sampleKey = env === "sandbox" ? "sk_test_VotreCle" : "sk_live_VotreCle";

  return (
    <div className="min-h-screen bg-[#0b1026] text-white/85">
      <div className="mx-auto flex max-w-7xl gap-10 px-6 py-12 lg:px-10">
        <aside className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b8862a]">Référence API</div>
          <nav className="mt-4 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                <s.icon size={15} className="text-[#2f5fff]" />
                {s.label}
              </a>
            ))}
          </nav>
          <Link
            to="/dashboard-pro/api"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#2f5fff] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <KeyRound size={15} /> Mes clés API
          </Link>
        </aside>

        <main className="min-w-0 flex-1 space-y-12">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b8862a]">Transports Ligneo</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">API Développeur</h1>
            <p className="mt-4 max-w-2xl text-white/70">
              Intégrez la création de devis et de missions de convoyage directement dans votre DMS, ERP ou
              plateforme de gestion de flotte. API REST, réponses JSON, authentification par clé secrète.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-white/10 p-1">
                {(["sandbox", "live"] as const).map((e) => (
                  <button
                    key={e}
                    onClick={() => setEnv(e)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${env === e ? "bg-[#2f5fff] text-white" : "text-white/60"}`}
                  >
                    {e === "sandbox" ? "Sandbox" : "Production"}
                  </button>
                ))}
              </div>
              <Link
                to="/dashboard-pro/api"
                className="inline-flex items-center gap-2 rounded-xl border border-[#b8862a]/60 px-4 py-2 text-sm font-semibold text-[#e7c76a] hover:bg-[#b8862a]/10 lg:hidden"
              >
                <KeyRound size={15} /> Mes clés API
              </Link>
            </div>
            <Code>{`Base URL\n${baseUrl}`}</Code>
          </header>

          <section id="authentification">
            <h2 className="text-2xl font-semibold text-white">Authentification</h2>
            <p className="mt-3 text-white/70">
              Chaque requête doit porter votre clé secrète dans l'en-tête <code className="font-mono text-[#7ea2ff]">Authorization</code>.
              Les clés sont générées depuis votre espace B2B et ne doivent jamais transiter côté navigateur : tous les
              appels se font de serveur à serveur. Limite par défaut : 100 requêtes/minute et par clé.
            </p>
            <Code>{`curl ${baseUrl}/quotes/estimate \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pickup_address": "12 rue de la Paix, 75002 Paris",
    "delivery_address": "45 av. Jean Jaurès, 69007 Lyon",
    "vehicle_type": "berline"
  }'`}</Code>
          </section>

          <section id="devis">
            <h2 className="text-2xl font-semibold text-white">Devis</h2>
            <Endpoint method="POST" path="/v1/quotes/estimate" />
            <p className="mt-2 text-sm text-white/60">Estimation instantanée, sans engagement.</p>
            <Code>{`{
  "estimate_id": "est_...",
  "distance_km": 465,
  "duration_estimate": "5h48",
  "price_ht": 285.00,
  "price_ttc": 342.00,
  "currency": "EUR",
  "valid_until": "2026-08-12T10:00:00Z"
}`}</Code>
            <Endpoint method="POST" path="/v1/quotes" />
            <p className="mt-2 text-sm text-white/60">Création d'un devis formel, rattaché à votre organisation.</p>
            <Endpoint method="GET" path="/v1/quotes/{id}" />
          </section>

          <section id="missions">
            <h2 className="text-2xl font-semibold text-white">Missions</h2>
            <Endpoint method="POST" path="/v1/missions" />
            <p className="mt-2 text-sm text-white/60">
              Création d'une mission à partir d'un devis accepté (<code className="font-mono">quote_id</code> requis).
            </p>
            <Code>{`curl ${baseUrl}/missions \\
  -H "Authorization: Bearer ${sampleKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "quote_id": "qt_...",
    "pickup_date": "2026-08-12",
    "vehicle": { "brand": "Peugeot", "model": "308", "plate": "AA-123-BB" },
    "contact": { "pickup_name": "M. Martin", "pickup_phone": "+33600000000" },
    "po_number": "PO-2026-0042",
    "webhook_url": "https://votre-domaine.fr/webhooks/ligneo"
  }'`}</Code>
            <Endpoint method="GET" path="/v1/missions" />
            <p className="mt-2 text-sm text-white/60">
              Pagination <code className="font-mono">limit</code> / <code className="font-mono">offset</code>, filtres{" "}
              <code className="font-mono">status</code>, <code className="font-mono">created_after</code>,{" "}
              <code className="font-mono">created_before</code>.
            </p>
            <Endpoint method="GET" path="/v1/missions/{id}" />
            <Endpoint method="GET" path="/v1/missions/{id}/tracking" />
            <p className="mt-2 text-sm text-white/60">Position GPS du convoyeur et statut en temps réel.</p>
            <Endpoint method="DELETE" path="/v1/missions/{id}" />
            <p className="mt-2 text-sm text-white/60">Annulation possible tant que la mission n'a pas démarré.</p>
          </section>

          <section id="documents">
            <h2 className="text-2xl font-semibold text-white">Documents</h2>
            <Endpoint method="GET" path="/v1/missions/{id}/proof-of-delivery" />
            <p className="mt-2 text-sm text-white/60">Bon de livraison signé (état des lieux final) au format PDF.</p>
            <Endpoint method="GET" path="/v1/invoices/{id}" />
          </section>

          <section id="webhooks">
            <h2 className="text-2xl font-semibold text-white">Webhooks</h2>
            <p className="mt-3 text-white/70">
              Configurez votre URL de réception dans l'espace B2B. Chaque envoi est signé en HMAC SHA-256
              (en-tête <code className="font-mono text-[#7ea2ff]">X-Ligneo-Signature</code>, format{" "}
              <code className="font-mono">t=timestamp,v1=signature</code> calculée sur{" "}
              <code className="font-mono">timestamp + "." + body</code>). En cas de réponse non-2xx, 3 tentatives sont
              effectuées avec backoff exponentiel.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {["mission.assigned", "mission.started", "mission.delivered", "mission.cancelled", "invoice.available"].map((e) => (
                <li key={e} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-[#7ea2ff]">
                  {e}
                </li>
              ))}
            </ul>
          </section>

          <section id="statuts">
            <h2 className="text-2xl font-semibold text-white">Codes de statut</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              {[
                ["200 / 201", "Requête traitée avec succès"],
                ["400", "Paramètres manquants ou invalides"],
                ["401", "Clé API absente, invalide ou révoquée"],
                ["404", "Ressource introuvable pour votre organisation"],
                ["409", "Conflit : devis déjà converti, mission déjà démarrée"],
                ["429", "Quota dépassé — consultez l'en-tête Retry-After"],
                ["500", "Erreur interne, réessayez"],
              ].map(([code, desc]) => (
                <div key={code} className="flex gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0">
                  <code className="w-24 shrink-0 font-mono text-[#e7c76a]">{code}</code>
                  <span className="text-white/70">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <footer className="border-t border-white/10 pt-8 text-sm text-white/50">
            Une question d'intégration ? Écrivez à contact@transportsligneo.fr — nous accompagnons chaque client pilote.
          </footer>
        </main>
      </div>
    </div>
  );
}
