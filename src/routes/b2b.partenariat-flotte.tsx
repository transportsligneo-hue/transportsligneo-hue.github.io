import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Building2, Users, Target, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateLeadScore } from "@/lib/b2b-pricing";

export const Route = createFileRoute("/b2b/partenariat-flotte")({
  component: FleetPartnershipPage,
  head: () => ({
    meta: [
      { title: "Partenariat flotte B2B — Transports Ligneo" },
      { name: "description", content: "Étude flotte sur-mesure pour entreprises, loueurs, concessions et grands comptes. Tarifs négociés, account manager dédié, facturation centralisée." },
      { property: "og:title", content: "Partenariat flotte B2B — Transports Ligneo" },
      { property: "og:description", content: "Solution récurrente avec tarifs négociés et account manager dédié pour grands comptes." },
    ],
  }),
});

const STRUCTURE_TYPES = [
  { value: "grand_compte", label: "Grand compte" },
  { value: "concession", label: "Concession" },
  { value: "loueur", label: "Loueur" },
  { value: "gestionnaire_flotte", label: "Gestionnaire de flotte" },
  { value: "garage", label: "Garage" },
  { value: "societe", label: "Société" },
  { value: "autre", label: "Autre" },
] as const;

const COMPANY_SIZES = [
  { value: "1-10", label: "1–10 salariés" },
  { value: "11-50", label: "11–50 salariés" },
  { value: "51-250", label: "51–250 salariés" },
  { value: "250+", label: "250+ salariés" },
] as const;

const NEED_TYPES = [
  { value: "gestion_flotte", label: "Gestion de flotte" },
  { value: "transport_recurrent", label: "Transport récurrent" },
  { value: "convoyage_regulier", label: "Convoyage régulier" },
  { value: "partenariat_concession", label: "Partenariat concession" },
  { value: "partenariat_loueur", label: "Partenariat loueur" },
  { value: "appel_offres", label: "Appel d'offres" },
  { value: "autre", label: "Autre" },
] as const;

const FREQUENCIES = [
  { value: "ponctuelle_recurrente", label: "Ponctuelle mais récurrente" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "mensuelle", label: "Mensuelle" },
  { value: "gros_volume", label: "Gros volume" },
] as const;

const VEHICLE_TYPES = [
  { value: "leger", label: "Véhicules légers" },
  { value: "utilitaire", label: "Utilitaires" },
  { value: "premium", label: "Premium" },
  { value: "electrique", label: "Électriques" },
  { value: "mix", label: "Mix" },
] as const;

const START_DELAYS = [
  { value: "immediat", label: "Immédiat" },
  { value: "1-3mois", label: "1–3 mois" },
  { value: "3-6mois", label: "3–6 mois" },
  { value: "6mois+", label: "6 mois +" },
] as const;

const schema = z.object({
  companyName: z.string().trim().min(1).max(200),
  structureType: z.string(),
  siret: z.string().trim().max(20).optional(),
  sector: z.string().trim().max(120).optional(),
  size: z.string(),
  contactName: z.string().trim().min(1).max(200),
  contactFunction: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().trim().min(1).max(50),
  needType: z.string(),
  vehicleCount: z.coerce.number().int().min(1).max(100000),
  frequency: z.string(),
  geography: z.string().trim().max(255).optional(),
  vehicleTypes: z.string(),
  startDelay: z.string(),
  description: z.string().trim().max(5000).optional(),
  budget: z.string().trim().max(120).optional(),
  constraints: z.string().trim().max(2000).optional(),
});

function FleetPartnershipPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    structureType: "grand_compte",
    siret: "",
    sector: "",
    size: "11-50",
    contactName: "",
    contactFunction: "",
    contactEmail: "",
    contactPhone: "",
    needType: "gestion_flotte",
    vehicleCount: "",
    frequency: "mensuelle",
    geography: "",
    vehicleTypes: "mix",
    startDelay: "1-3mois",
    description: "",
    budget: "",
    constraints: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const previewScore = calculateLeadScore({
    vehicleCount: Number(form.vehicleCount) || 0,
    companySize: form.size,
    startDelay: form.startDelay,
    budget: form.budget,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        toast.error("Vérifie les champs obligatoires");
        setSubmitting(false);
        return;
      }
      const v = parsed.data;

      // 1) Trouver ou créer la société via RPC sécurisée
      const { data: companyId, error: cErr } = await supabase.rpc("find_or_create_company", {
        _name: v.companyName,
        _type: v.structureType,
        _contact_name: v.contactName,
        _contact_email: v.contactEmail.toLowerCase(),
        _contact_phone: v.contactPhone,
        _siret: v.siret || undefined,
        _sector: v.sector || undefined,
        _size: v.size,
        _contact_function: v.contactFunction || undefined,
      });
      if (cErr || !companyId) throw cErr ?? new Error("Société introuvable");

      // 2) Créer le lead flotte
      const score = calculateLeadScore({
        vehicleCount: v.vehicleCount,
        companySize: v.size,
        startDelay: v.startDelay,
        budget: v.budget,
      });

      const { data: insertedLead, error: lErr } = await supabase.from("b2b_fleet_leads").insert({
        company_id: companyId,
        structure_type: v.structureType,
        need_type: v.needType,
        estimated_vehicle_count: v.vehicleCount,
        frequency: v.frequency,
        geography: v.geography || null,
        vehicle_types: v.vehicleTypes,
        start_delay: v.startDelay,
        budget: v.budget || null,
        description: v.description || null,
        constraints: v.constraints || null,
        lead_score: score.score,
        score_category: score.category,
      }).select("id").maybeSingle();
      if (lErr) throw lErr;

      // Notify admin (server-side, fire-and-forget — UX should not depend on it)
      if (insertedLead?.id) {
        fetch("/api/public/b2b/lead-created", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: insertedLead.id }),
        }).catch((e) => console.warn("notify failed", e));
      }

      setSubmitted(true);
      toast.success("Demande envoyée — nous vous recontactons sous 24h ouvrées");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Demande reçue</h1>
          <p className="mt-3 text-slate-600">
            Merci. Notre équipe commerciale étudie votre besoin flotte et vous recontacte sous <strong>24h ouvrées</strong> avec une proposition personnalisée.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button onClick={() => navigate({ to: "/b2b" })} variant="outline">
              Retour B2B
            </Button>
            <Button onClick={() => navigate({ to: "/" })}>Accueil</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link to="/b2b" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Retour aux solutions B2B
        </Link>

        <div className="mb-8">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            <Users className="h-3.5 w-3.5" /> Partenariat flotte
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Demander une étude flotte</h1>
          <p className="mt-2 text-slate-600">
            Solution sur-mesure pour grands comptes, concessions et loueurs. Réponse commerciale sous 24h ouvrées.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section Entreprise */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Building2 className="h-5 w-5 text-blue-600" /> Entreprise
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="companyName">Nom entreprise *</Label>
                <Input id="companyName" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="structureType">Type de structure *</Label>
                <select id="structureType" value={form.structureType} onChange={(e) => update("structureType", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {STRUCTURE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="size">Taille entreprise *</Label>
                <select id="size" value={form.size} onChange={(e) => update("size", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {COMPANY_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="siret">SIRET (optionnel)</Label>
                <Input id="siret" value={form.siret} onChange={(e) => update("siret", e.target.value)} maxLength={20} />
              </div>
              <div>
                <Label htmlFor="sector">Secteur d'activité</Label>
                <Input id="sector" value={form.sector} onChange={(e) => update("sector", e.target.value)} maxLength={120} />
              </div>
            </div>
          </section>

          {/* Section Contact */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="h-5 w-5 text-blue-600" /> Contact
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactName">Nom et prénom *</Label>
                <Input id="contactName" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="contactFunction">Fonction</Label>
                <Input id="contactFunction" value={form.contactFunction} onChange={(e) => update("contactFunction", e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="contactEmail">Email professionnel *</Label>
                <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} required maxLength={254} />
              </div>
              <div>
                <Label htmlFor="contactPhone">Téléphone *</Label>
                <Input id="contactPhone" type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} required maxLength={50} />
              </div>
            </div>
          </section>

          {/* Section Besoin */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Target className="h-5 w-5 text-blue-600" /> Besoin flotte
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="needType">Type de besoin *</Label>
                <select id="needType" value={form.needType} onChange={(e) => update("needType", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {NEED_TYPES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="vehicleCount">Nombre de véhicules estimé *</Label>
                <Input id="vehicleCount" type="number" min={1} value={form.vehicleCount} onChange={(e) => update("vehicleCount", e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="frequency">Fréquence estimée *</Label>
                <select id="frequency" value={form.frequency} onChange={(e) => update("frequency", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="vehicleTypes">Type de véhicules *</Label>
                <select id="vehicleTypes" value={form.vehicleTypes} onChange={(e) => update("vehicleTypes", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="geography">Zone géographique</Label>
                <Input id="geography" value={form.geography} onChange={(e) => update("geography", e.target.value)} placeholder="France entière, Île-de-France…" maxLength={255} />
              </div>
              <div>
                <Label htmlFor="startDelay">Délai de démarrage *</Label>
                <select id="startDelay" value={form.startDelay} onChange={(e) => update("startDelay", e.target.value)} className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm">
                  {START_DELAYS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Section Objectifs */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Objectifs et contexte</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="description">Description détaillée du besoin</Label>
                <Textarea id="description" value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} maxLength={5000} placeholder="Décrivez votre activité, vos volumes, vos contraintes opérationnelles…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="budget">Budget estimé (optionnel)</Label>
                  <Input id="budget" value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="ex : 5 000 €/mois" maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="constraints">Contraintes spécifiques</Label>
                  <Input id="constraints" value={form.constraints} onChange={(e) => update("constraints", e.target.value)} maxLength={2000} />
                </div>
              </div>
            </div>
          </section>

          {/* Preview score */}
          {Number(form.vehicleCount) > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <strong>Score lead estimé :</strong> {previewScore.score}/100 — catégorie{" "}
              <span className={`font-semibold ${previewScore.category === "hot" ? "text-red-600" : previewScore.category === "warm" ? "text-amber-600" : "text-slate-600"}`}>
                {previewScore.category.toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" size="lg" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</>) : "Demander une étude flotte"}
            </Button>
          </div>
          <p className="text-center text-xs text-slate-500">
            Réponse commerciale sous 24h ouvrées. Aucun engagement.
          </p>
        </form>
      </div>
      <Footer />
    </div>
  );
}
