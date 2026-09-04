import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, FileText, Receipt, Truck, UserRound } from "lucide-react";
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
        </>
      )}
    </div>
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
