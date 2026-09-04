import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, FileText, Monitor, Receipt, RefreshCw, Smartphone, Tablet, Truck, UserRound } from "lucide-react";
import { LogoLoader } from "@/components/brand/LogoLoader";

export const Route = createFileRoute("/_authenticated/admin/apercu-client/$userId")({
  component: ApercuClient,
});

interface Profile {
  user_id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  societe: string | null;
  type_client: string | null;
}

interface MissionRow {
  id: string;
  numero: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  date_prise_en_charge: string | null;
  statut: string | null;
  prix_total: number | null;
}

interface DevisRow {
  id: string;
  numero: string | null;
  statut: string | null;
  created_at: string;
  prix_estime: number | null;
}

interface FactureRow {
  id: string;
  numero: string | null;
  statut: string | null;
  date_facture: string | null;
  prix_ttc: number | null;
}

const eur = (v: number | null | undefined) =>
  v == null ? "—" : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

const dateFr = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function ApercuClient() {
  const { userId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [factures, setFactures] = useState<FactureRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom, email, telephone, societe, type_client")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile((p ?? null) as Profile | null);

    const email = (p as Profile | null)?.email ?? null;

    const missionsQuery = supabase
      .from("missions")
      .select("id, numero, ville_depart, ville_arrivee, date_prise_en_charge, statut, prix_total")
      .order("date_prise_en_charge", { ascending: false })
      .limit(100);
    const { data: m } = email
      ? await missionsQuery.or(`user_id.eq.${userId},email.eq.${email}`)
      : await missionsQuery.eq("user_id", userId);
    setMissions((m ?? []) as MissionRow[]);

    const devisQuery = supabase
      .from("devis")
      .select("id, numero, statut, created_at, prix_estime")
      .order("created_at", { ascending: false })
      .limit(50);
    const { data: d } = email
      ? await devisQuery.or(`user_id.eq.${userId},email.eq.${email}`)
      : await devisQuery.eq("user_id", userId);
    setDevis((d ?? []) as DevisRow[]);

    if (email) {
      const { data: f } = await supabase
        .from("factures")
        .select("id, numero, statut, date_facture, prix_ttc")
        .eq("client_email", email)
        .order("date_facture", { ascending: false })
        .limit(50);
      setFactures((f ?? []) as FactureRow[]);
    } else {
      setFactures([]);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const nom = `${profile?.prenom ?? ""} ${profile?.nom ?? ""}`.trim() || profile?.societe || "Client";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/admin/clients"
          className="inline-flex items-center gap-1.5 text-sm text-pro-text-soft hover:text-pro-accent transition-colors"
        >
          <ArrowLeft size={14} /> Tous les clients
        </Link>
      </div>

      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 flex items-center gap-2">
        <Eye size={15} className="shrink-0" />
        Aperçu de l'espace client — lecture seule. Vous voyez ce que ce client voit dans son espace.
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LogoLoader label="Chargement de l'espace client…" />
        </div>
      ) : !profile ? (
        <p className="text-sm text-slate-500 py-8 text-center">Compte introuvable.</p>
      ) : (
        <>
          <div className="dvx-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="dvx-stat-ic blue"><UserRound size={17} /></span>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-[#14161c]">{nom}</p>
                <p className="text-[12.5px] text-[#70727d]">
                  {profile.email ?? "sans email"}
                  {profile.telephone ? ` · ${profile.telephone}` : ""}
                  {profile.societe ? ` · ${profile.societe}` : ""}
                </p>
              </div>
            </div>
          </div>

          <Section title={`Missions (${missions.length})`} icon={<Truck size={14} />}>
            {missions.length === 0 ? (
              <Empty>Aucune mission dans son espace.</Empty>
            ) : (
              missions.map((m) => (
                <Row
                  key={m.id}
                  main={`${m.ville_depart ?? "?"} → ${m.ville_arrivee ?? "?"}`}
                  sub={`${m.numero ?? "—"} · ${m.statut ?? "—"} · ${dateFr(m.date_prise_en_charge)}`}
                  right={eur(m.prix_total)}
                />
              ))
            )}
          </Section>

          <Section title={`Devis (${devis.length})`} icon={<FileText size={14} />}>
            {devis.length === 0 ? (
              <Empty>Aucun devis.</Empty>
            ) : (
              devis.map((d) => (
                <Row
                  key={d.id}
                  main={d.numero ?? "Devis"}
                  sub={`${d.statut ?? "—"} · ${dateFr(d.created_at)}`}
                  right={eur(d.prix_estime)}
                />
              ))
            )}
          </Section>

          <Section title={`Factures (${factures.length})`} icon={<Receipt size={14} />}>
            {factures.length === 0 ? (
              <Empty>Aucune facture.</Empty>
            ) : (
              factures.map((f) => (
                <Row
                  key={f.id}
                  main={f.numero ?? "Facture"}
                  sub={`${f.statut ?? "—"} · ${dateFr(f.date_facture)}`}
                  right={eur(f.prix_ttc)}
                />
              ))
            )}
          </Section>

          <InterfacePreview typeClient={profile.type_client} />
        </>
      )}
    </div>
  );
}

const DEVICES = [
  { key: "mobile", label: "Mobile", width: 390, height: 780, icon: <Smartphone size={14} /> },
  { key: "tablette", label: "Tablette", width: 834, height: 900, icon: <Tablet size={14} /> },
  { key: "ordinateur", label: "Ordinateur", width: 1440, height: 900, icon: <Monitor size={14} /> },
] as const;

const ESPACES = [
  {
    key: "particulier",
    label: "Particulier",
    suffix: "?apercu=1",
    pages: [
      { label: "Accueil", path: "/dashboard-client" },
      { label: "Missions", path: "/dashboard-client/missions" },
      { label: "Nouvelle réservation", path: "/dashboard-client/nouvelle-reservation" },
      { label: "Factures & devis", path: "/dashboard-client/devis" },
      { label: "Compte Kilomètres", path: "/dashboard-client/fidelite" },
      { label: "Documents", path: "/dashboard-client/documents" },
      { label: "Profil", path: "/dashboard-client/profil" },
    ],
  },
  {
    key: "flotte",
    label: "Flotte",
    suffix: "?apercu=1&apercu_type=flotte",
    pages: [
      { label: "Accueil", path: "/dashboard-pro" },
      { label: "Missions", path: "/dashboard-pro/missions" },
      { label: "Nouvelle mission", path: "/dashboard-pro/nouvelle-mission" },
      { label: "Parc véhicules", path: "/dashboard-pro/flotte" },
      { label: "Conducteurs", path: "/dashboard-pro/conducteurs" },
      { label: "Factures & devis", path: "/dashboard-pro/documents" },
      { label: "Société", path: "/dashboard-pro/societe" },
    ],
  },
  {
    key: "b2b",
    label: "B2B ponctuel",
    suffix: "?apercu=1&apercu_type=b2b_standard",
    pages: [
      { label: "Accueil", path: "/dashboard-pro" },
      { label: "Missions", path: "/dashboard-pro/missions" },
      { label: "Nouvelle mission", path: "/dashboard-pro/nouvelle-mission" },
      { label: "Adresses", path: "/dashboard-pro/adresses" },
      { label: "Factures & devis", path: "/dashboard-pro/documents" },
      { label: "API & Intégrations", path: "/dashboard-pro/api" },
      { label: "Société", path: "/dashboard-pro/societe" },
    ],
  },
] as const;

function InterfacePreview({ typeClient }: { typeClient: string | null }) {
  const defaultEspace: (typeof ESPACES)[number]["key"] = typeClient === "b2b" ? "b2b" : "particulier";
  const [espaceKey, setEspaceKey] = useState<(typeof ESPACES)[number]["key"]>(defaultEspace);
  const espace = ESPACES.find((e) => e.key === espaceKey)!;
  const pages = espace.pages;

  const [page, setPage] = useState<string>(espace.pages[0]!.path);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("ordinateur");
  const [reload, setReload] = useState(0);
  const current = DEVICES.find((d) => d.key === device)!;
  const scale = Math.min(1, 900 / current.width);

  const selectEspace = (key: (typeof ESPACES)[number]["key"]) => {
    const next = ESPACES.find((e) => e.key === key)!;
    setEspaceKey(key);
    setPage(next.pages[0]!.path);
  };

  return (
    <section className="dvx-card">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[#70727d]"><Eye size={14} /></span>
        <h2 className="text-[13.5px] font-bold text-[#14161c]">
          Aperçu des espaces client
        </h2>
        <button
          type="button"
          onClick={() => setReload((r) => r + 1)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-[#14161c] hover:bg-slate-50"
        >
          <RefreshCw size={13} /> Rafraîchir
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {ESPACES.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => selectEspace(e.key)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              espaceKey === e.key
                ? "bg-[#2F5FFF] text-white"
                : "border border-slate-200 text-[#5a5c66] hover:bg-slate-50"
            }`}
          >
            Espace {e.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {pages.map((p) => (
          <button
            key={p.path}
            type="button"
            onClick={() => setPage(p.path)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              page === p.path
                ? "bg-[#14161c] text-white"
                : "border border-slate-200 text-[#5a5c66] hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>


      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {DEVICES.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDevice(d.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
              device === d.key
                ? "bg-[#eef1ff] text-[#2F5FFF] border border-[#2F5FFF]/30"
                : "border border-slate-200 text-[#5a5c66] hover:bg-slate-50"
            }`}
          >
            {d.icon} {d.label}
            <span className="text-[10.5px] text-[#a3a4ac]">{d.width}px</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3">
        <div
          className="mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm"
          style={{ width: current.width * scale, height: current.height * scale }}
        >
          <iframe
            key={`${page}-${device}-${reload}`}
            src={page}
            title="Aperçu de l'interface"
            className="origin-top-left border-0 bg-white"
            style={{
              width: current.width,
              height: current.height,
              transform: `scale(${scale})`,
            }}
          />
        </div>
      </div>

      <p className="mt-2 text-[11.5px] text-[#a3a4ac]">
        Rendu réel des écrans, avec vos propres accès : utile pour repérer un défaut d'affichage ou
        valider une modification. Les données affichées sont les vôtres, pas celles du client.
      </p>
    </section>
  );
}


function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="dvx-card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#70727d]">{icon}</span>
        <h2 className="text-[13.5px] font-bold text-[#14161c]">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-[#a3a4ac] py-3 text-center">{children}</p>;
}

function Row({ main, sub, right }: { main: string; sub: string; right: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#14161c] truncate">{main}</p>
        <p className="text-[11.5px] text-[#70727d] truncate">{sub}</p>
      </div>
      <p className="text-[13px] font-semibold text-[#14161c] shrink-0">{right}</p>
    </div>
  );
}
