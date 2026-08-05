import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Check,
  FileText,
  Mail,
  Download,
  Save,
  Search,
  ArrowLeft,
} from "lucide-react";
import { PageHeader, Card, Button } from "@/components/admin/AdminUI";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/admin/nouveau-devis")({
  component: AdminNouveauDevisPage,
});

interface ClientRow {
  user_id: string;
  email: string | null;
  prenom: string;
  nom: string;
  societe: string | null;
  telephone: string | null;
  logo_url: string | null;
  adresse: string | null;
  type_client: string;
}

interface CreatedDevis {
  id: string;
  numero: string;
  prix: number;
}

function initials(c: ClientRow) {
  const src = c.societe || `${c.prenom} ${c.nom}`;
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-pro-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-pro-border bg-white px-3.5 py-2.5 text-sm text-pro-text focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
      />
    </div>
  );
}

const OPTIONS_LIST = [
  { id: "recharge", label: "Recharge / plein de carburant" },
  { id: "mise_en_main", label: "Mise en main du véhicule" },
  { id: "lavage_ext", label: "Lavage extérieur" },
  { id: "lavage_int", label: "Lavage intérieur" },
  { id: "lavage_full", label: "Lavage extérieur + intérieur" },
] as const;

const TRAJET_TYPES = [
  "Aller simple",
  "Aller-retour",
  "Livraison + restitution",
] as const;

const PV_OPTIONS = ["Aucun", "WelcomeAuto", "Model"] as const;

function AdminNouveauDevisPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);

  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [vehicule, setVehicule] = useState("");
  const [montant, setMontant] = useState("");
  const [typeTrajet, setTypeTrajet] = useState<string>(TRAJET_TYPES[0]);
  const [immat, setImmat] = useState("");
  const [modele, setModele] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [pvDigital, setPvDigital] = useState<string>(PV_OPTIONS[0]);
  const [destNom, setDestNom] = useState("");
  const [destTel, setDestTel] = useState("");
  const [destNote, setDestNote] = useState("");

  const toggleOption = (label: string) =>
    setOptions((prev) =>
      prev.includes(label) ? prev.filter((o) => o !== label) : [...prev, label],
    );

  const [generating, setGenerating] = useState(false);
  const [created, setCreated] = useState<CreatedDevis | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  // Recherche client (debounce)
  useEffect(() => {
    if (client) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, email, prenom, nom, societe, telephone, logo_url, adresse, type_client")
        .or(
          `nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%,societe.ilike.%${q}%`,
        )
        .limit(8);
      setResults((data ?? []) as ClientRow[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, client]);

  const selectClient = async (c: ClientRow) => {
    setClient(c);
    setResults([]);
    setSearch("");
    setEmailTo(c.email ?? "");
    setAutofillNote(null);

    const { data } = await supabase
      .from("client_default_addresses")
      .select("address, ville, code_postal, is_default, address_type, active")
      .eq("client_email", c.email ?? "")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(10);

    const fav = (data ?? []).find(
      (a) => a.address_type === "depart" || a.address_type === "both",
    );
    if (fav) {
      const full = [fav.address, [fav.code_postal, fav.ville].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      setDepart(full);
      setAutofillNote(`Adresse favorite préremplie automatiquement : ${full}`);
    } else if (c.adresse) {
      setDepart(c.adresse);
      setAutofillNote(`Adresse du profil préremplie : ${c.adresse}`);
    }
  };

  const prix = useMemo(() => {
    const n = parseFloat(montant.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [montant]);

  const pvLabel = pvDigital === "Aucun" ? null : pvDigital;

  const recapMessage = [
    `Type de trajet : ${typeTrajet}`,
    immat ? `Immatriculation : ${immat}` : null,
    options.length ? `Options : ${options.join(", ")}` : null,
    pvLabel ? `PV de livraison digitalisé : ${pvLabel}` : null,
    destNom ? `Destinataire : ${[destNom, destTel].filter(Boolean).join(" - ")}` : null,
    destNote ? `Note livraison : ${destNote}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const buildPdfData = (numero: string): DevisData => ({
    numero,
    nom: client?.nom ?? "",
    prenom: client?.prenom ?? "",
    email: client?.email ?? "",
    telephone: client?.telephone ?? null,
    adresse: client?.adresse ?? null,
    societe: client?.societe ?? null,
    logo_url: client?.logo_url ?? null,
    depart,
    arrivee,
    marque: vehicule || null,
    modele: modele || null,
    immatriculation: immat || null,
    option_trajet: typeTrajet,
    options,
    pv_digital: pvLabel,
    destinataire_nom: destNom || null,
    destinataire_tel: destTel || null,
    destinataire_note: destNote || null,
    prestation: "Convoyage automobile",
    prix_estime: prix,
    validite_jours: 15,
    created_at: new Date().toISOString(),
    version: 1,
  });

  const handleGenerate = async () => {
    if (!client) return toast.error("Sélectionnez un client");
    if (!depart.trim() || !arrivee.trim()) return toast.error("Départ et arrivée requis");
    if (!Number.isFinite(prix) || prix <= 0) return toast.error("Montant TTC invalide");

    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from("devis")
        .insert({
          nom: client.nom,
          prenom: client.prenom,
          email: client.email ?? "",
          telephone: client.telephone,
          depart: depart.trim(),
          arrivee: arrivee.trim(),
          marque: vehicule || null,
          modele: modele || null,
          option_trajet: typeTrajet,
          contact_arrivee_nom: destNom || null,
          contact_arrivee_tel: destTel || null,
          contact_arrivee_note: destNote || null,
          message: recapMessage || null,
          prestation: "Convoyage automobile",
          prix_estime: prix,
          statut: "brouillon",
          origine: "admin",
          user_id: client.user_id,
        } as never)
        .select("id, numero, prix_estime")
        .single();
      if (error) throw error;

      const row = data as unknown as { id: string; numero: string; prix_estime: number };
      const blob = await generateDevisPdf(buildPdfData(row.numero));
      setPdfBlob(blob);
      setCreated({ id: row.id, numero: row.numero, prix: Number(row.prix_estime) });
      toast.success(`Devis ${row.numero} généré`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfBlob && created) downloadDevisPdf(pdfBlob, created.numero);
  };

  const handleSaveToAccount = async () => {
    if (!created) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("devis")
        .update({ statut: "genere" } as never)
        .eq("id", created.id);
      if (error) throw error;
      toast.success("Devis enregistré sur le compte client");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!created || !client) return;
    if (!emailTo.trim()) return toast.error("Adresse email requise");
    setSending(true);
    try {
      await sendTransactionalEmail({
        templateName: "devis-client",
        recipientEmail: emailTo.trim(),
        idempotencyKey: `devis-admin-${created.id}`,
        templateData: {
          prenom: client.prenom,
          nom: client.nom,
          numero: created.numero,
          depart,
          arrivee,
          prix: created.prix,
        },
      });
      await supabase
        .from("devis")
        .update({ statut: "envoye", email_envoye: true, sent_at: new Date().toISOString() } as never)
        .eq("id", created.id);
      toast.success("Devis envoyé par email");
      setEmailOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Créer un devis"
        eyebrow="Devis"
        subtitle="Sélectionnez un client existant pour préremplir automatiquement ses informations."
        actions={
          <Link to="/admin/devis">
            <Button variant="secondary" icon={<ArrowLeft size={14} />}>
              Retour aux devis
            </Button>
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-5">
        {/* 1. Client */}
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pro-accent/10 text-[11px] font-bold text-pro-accent">
              1
            </span>
            <h3 className="text-[15px] font-bold text-pro-text">Client</h3>
          </div>

          {client ? (
            <div className="rounded-xl border border-pro-border bg-pro-bg-soft p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pro-accent/10 text-[13px] font-bold text-pro-accent">
                  {initials(client)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-pro-text">
                    {client.societe || `${client.prenom} ${client.nom}`}
                  </p>
                  <p className="truncate text-[11.5px] text-pro-muted">
                    {client.type_client === "flotte"
                      ? "Flotte partenaire"
                      : client.type_client === "b2b"
                        ? "Professionnel"
                        : "Particulier"}{" "}
                    · {client.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClient(null);
                    setAutofillNote(null);
                  }}
                  className="ml-auto text-[11.5px] font-semibold text-pro-accent"
                >
                  Changer
                </button>
              </div>
              {autofillNote && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
                  <Check size={14} className="shrink-0" />
                  {autofillNote}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client (nom, société, email)…"
                className="w-full rounded-lg border border-pro-border bg-white py-2.5 pl-9 pr-3 text-sm focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
              />
              {searching && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-pro-muted" />
              )}
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-pro-border overflow-hidden rounded-xl border border-pro-border">
                  {results.map((c) => (
                    <li key={c.user_id}>
                      <button
                        type="button"
                        onClick={() => selectClient(c)}
                        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-pro-bg-soft"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pro-accent/10 text-[11px] font-bold text-pro-accent">
                          {initials(c)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-pro-text">
                            {c.societe || `${c.prenom} ${c.nom}`}
                          </span>
                          <span className="block truncate text-[11.5px] text-pro-muted">{c.email}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        {/* 2. Trajet */}
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pro-accent/10 text-[11px] font-bold text-pro-accent">
              2
            </span>
            <h3 className="text-[15px] font-bold text-pro-text">Trajet</h3>
          </div>
          <div className="space-y-4">
            <Field label="Adresse de départ" value={depart} onChange={setDepart} placeholder="Ex : 6 rue du pont libert, 37520 La Riche" />
            <Field label="Adresse d'arrivée" value={arrivee} onChange={setArrivee} placeholder="Ex : 5 avenue de la République, Le Mans" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Véhicule" value={vehicule} onChange={setVehicule} placeholder="Modèle, plaque…" />
              <Field label="Montant TTC (€)" value={montant} onChange={setMontant} placeholder="120,00" />
            </div>
          </div>
        </Card>

        {/* Génération */}
        <Card className="text-center">
          <Button onClick={handleGenerate} disabled={generating} icon={generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} className="mx-auto">
            {generating ? "Génération…" : "Générer le PDF du devis"}
          </Button>
        </Card>

        {created && (
          <>
            <div className="flex items-center gap-4 rounded-2xl border-[1.5px] border-emerald-500 bg-white p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Check size={22} />
              </div>
              <div>
                <b className="block text-sm text-pro-text">Devis {created.numero} généré</b>
                <span className="text-[12px] text-pro-muted">
                  {created.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} ·{" "}
                  {client?.societe || `${client?.prenom} ${client?.nom}`}
                </span>
              </div>
            </div>

            <Card>
              <h3 className="mb-4 text-[15px] font-bold text-pro-text">Que souhaitez-vous faire ?</h3>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setEmailOpen((v) => !v)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-pro-border bg-white px-3 py-4 transition hover:border-pro-accent hover:bg-pro-accent/5"
                >
                  <Mail size={20} className="text-pro-accent" />
                  <span className="text-[12px] font-semibold text-pro-text">Envoyer par email</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex flex-col items-center gap-2 rounded-xl border border-pro-border bg-white px-3 py-4 transition hover:border-pro-accent hover:bg-pro-accent/5"
                >
                  <Download size={20} className="text-pro-accent" />
                  <span className="text-[12px] font-semibold text-pro-text">Télécharger le PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToAccount}
                  disabled={saving}
                  className="flex flex-col items-center gap-2 rounded-xl border border-pro-border bg-white px-3 py-4 transition hover:border-pro-accent hover:bg-pro-accent/5 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={20} className="animate-spin text-pro-accent" /> : <Save size={20} className="text-pro-accent" />}
                  <span className="text-[12px] font-semibold text-pro-text">Enregistrer sur le compte</span>
                </button>
              </div>

              {emailOpen && (
                <div className="mt-3.5 flex flex-wrap gap-2.5">
                  <input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="min-w-[220px] flex-1 rounded-lg border border-pro-border bg-white px-3.5 py-2.5 text-sm focus:border-pro-accent focus:outline-none focus:ring-2 focus:ring-pro-accent/20"
                  />
                  <Button onClick={handleSendEmail} disabled={sending} icon={sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}>
                    Envoyer
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
