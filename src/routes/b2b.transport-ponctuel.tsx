import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Building2, MapPin, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { estimateB2BPrice, B2B_VEHICLE_LABELS, B2B_URGENCY_LABELS, type B2BVehicleType, type B2BUrgency } from "@/lib/b2b-pricing";
import { toast } from "sonner";

export const Route = createFileRoute("/b2b/transport-ponctuel")({
  component: TransportPonctuelPage,
  head: () => ({
    meta: [
      { title: "Transport ponctuel B2B — Devis et paiement | Transports Ligneo" },
      { name: "description", content: "Commandez un transport ponctuel B2B en 3 étapes avec devis instantané et paiement en ligne sécurisé." },
    ],
  }),
});

type Step = 1 | 2 | 3;

interface FormData {
  // Étape 1 — Entreprise
  companyName: string;
  companyType: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  // Étape 2 — Transport
  pickupAddress: string;
  dropoffAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  vehicleType: B2BVehicleType;
  vehicleRunning: "oui" | "non";
  urgency: B2BUrgency;
  notes: string;
}

const COMPANY_TYPES = [
  { value: "garage", label: "Garage" },
  { value: "concession", label: "Concession" },
  { value: "loueur", label: "Loueur" },
  { value: "societe", label: "Société" },
  { value: "autre", label: "Autre" },
];

function TransportPonctuelPage() {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormData>({
    companyName: "",
    companyType: "garage",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    pickupAddress: "",
    dropoffAddress: "",
    scheduledDate: "",
    scheduledTime: "",
    vehicleType: "leger",
    vehicleRunning: "oui",
    urgency: "planifie",
    notes: "",
  });

  // Si retour depuis Stripe (success ou cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Paiement confirmé. Votre demande est enregistrée.");
    } else if (params.get("canceled") === "1") {
      toast.error("Paiement annulé. Vous pouvez réessayer.");
    }
  }, []);

  const estimate = useMemo(() => {
    if (!form.pickupAddress || !form.dropoffAddress) return null;
    return estimateB2BPrice({
      pickup: form.pickupAddress,
      dropoff: form.dropoffAddress,
      vehicleType: form.vehicleType,
      vehicleRunning: form.vehicleRunning === "oui",
      urgency: form.urgency,
    });
  }, [form.pickupAddress, form.dropoffAddress, form.vehicleType, form.vehicleRunning, form.urgency]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validateStep(s: Step): boolean {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.companyName.trim()) e.companyName = "Nom entreprise requis";
      if (!form.contactName.trim()) e.contactName = "Nom contact requis";
      if (!form.contactPhone.trim()) e.contactPhone = "Téléphone requis";
      if (!form.contactEmail.trim() || !/^\S+@\S+\.\S+$/.test(form.contactEmail))
        e.contactEmail = "Email professionnel valide requis";
    }
    if (s === 2) {
      if (!form.pickupAddress.trim()) e.pickupAddress = "Adresse départ requise";
      if (!form.dropoffAddress.trim()) e.dropoffAddress = "Adresse arrivée requise";
      if (!form.scheduledDate) e.scheduledDate = "Date requise";
      if (!form.scheduledTime) e.scheduledTime = "Heure requise";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) {
      toast.error("Merci de corriger les erreurs avant de continuer");
      return;
    }
    setStep((s) => Math.min(3, s + 1) as Step);
  }
  function prev() { setStep((s) => Math.max(1, s - 1) as Step); }

  async function handlePayAndConfirm() {
    if (!estimate || !estimate.isEstimable) {
      toast.error("Devis non calculable automatiquement, contactez-nous au 02 47 XX XX XX");
      return;
    }
    setSubmitting(true);
    
    try {
      // 1) Créer/récupérer company
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("contact_email", form.contactEmail.trim().toLowerCase())
        .maybeSingle();

      let companyId = existingCompany?.id;
      if (!companyId) {
        const { data: newCompany, error: cErr } = await supabase
          .from("companies")
          .insert({
            name: form.companyName.trim(),
            type: form.companyType,
            contact_name: form.contactName.trim(),
            contact_email: form.contactEmail.trim().toLowerCase(),
            contact_phone: form.contactPhone.trim(),
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        companyId = newCompany.id;
      }

      // 2) Créer demande
      const { data: request, error: rErr } = await supabase
        .from("b2b_transport_requests")
        .insert({
          company_id: companyId,
          pickup_address: form.pickupAddress.trim(),
          dropoff_address: form.dropoffAddress.trim(),
          scheduled_date: form.scheduledDate,
          scheduled_time: form.scheduledTime,
          vehicle_type: form.vehicleType,
          vehicle_running: form.vehicleRunning === "oui",
          urgency: form.urgency,
          notes: form.notes.trim() || null,
          distance_km: estimate.distanceKm,
          estimated_price_ht: estimate.priceHt,
          estimated_price_ttc: estimate.priceTtc,
        })
        .select("id, numero")
        .single();
      if (rErr) throw rErr;

      // 3) Lancer Stripe Checkout via server function
      const res = await fetch("/api/b2b/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          amountTtc: estimate.priceTtc,
          description: `Transport B2B ${form.pickupAddress} → ${form.dropoffAddress}`,
          customerEmail: form.contactEmail.trim().toLowerCase(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur création session de paiement");
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de la soumission");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Link to="/b2b" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Retour aux solutions B2B
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Transport ponctuel B2B</h1>
          <p className="mt-2 text-slate-600">Devis instantané et paiement sécurisé en 3 étapes.</p>
        </div>

        {/* Stepper */}
        <ol className="mb-8 flex items-center gap-3 text-xs sm:text-sm">
          {([
            { n: 1, label: "Entreprise", icon: Building2 },
            { n: 2, label: "Transport", icon: MapPin },
            { n: 3, label: "Paiement", icon: CreditCard },
          ] as const).map((s, i, arr) => (
            <li key={s.n} className="flex flex-1 items-center gap-3">
              <div className={`flex items-center gap-2 ${step >= s.n ? "text-emerald-600" : "text-slate-400"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= s.n ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-white"}`}>
                  {step > s.n ? <CheckCircle2 className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className="hidden font-medium sm:inline">{s.label}</span>
              </div>
              {i < arr.length - 1 && <div className={`h-px flex-1 ${step > s.n ? "bg-emerald-600" : "bg-slate-200"}`} />}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-slate-900">Informations entreprise</h2>

              <div>
                <Label htmlFor="companyName">Nom entreprise *</Label>
                <Input id="companyName" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
                {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName}</p>}
              </div>

              <div>
                <Label>Type entreprise</Label>
                <Select value={form.companyType} onValueChange={(v) => update("companyType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contactName">Nom contact *</Label>
                  <Input id="contactName" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} />
                  {errors.contactName && <p className="mt-1 text-xs text-red-600">{errors.contactName}</p>}
                </div>
                <div>
                  <Label htmlFor="contactPhone">Téléphone *</Label>
                  <Input id="contactPhone" type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} />
                  {errors.contactPhone && <p className="mt-1 text-xs text-red-600">{errors.contactPhone}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="contactEmail">Email professionnel *</Label>
                <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} />
                {errors.contactEmail && <p className="mt-1 text-xs text-red-600">{errors.contactEmail}</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-slate-900">Détails du transport</h2>

              <div>
                <Label htmlFor="pickupAddress">Adresse de départ *</Label>
                <Input id="pickupAddress" placeholder="Ville, code postal, adresse" value={form.pickupAddress} onChange={(e) => update("pickupAddress", e.target.value)} />
                {errors.pickupAddress && <p className="mt-1 text-xs text-red-600">{errors.pickupAddress}</p>}
              </div>

              <div>
                <Label htmlFor="dropoffAddress">Adresse d'arrivée *</Label>
                <Input id="dropoffAddress" placeholder="Ville, code postal, adresse" value={form.dropoffAddress} onChange={(e) => update("dropoffAddress", e.target.value)} />
                {errors.dropoffAddress && <p className="mt-1 text-xs text-red-600">{errors.dropoffAddress}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="scheduledDate">Date souhaitée *</Label>
                  <Input id="scheduledDate" type="date" value={form.scheduledDate} onChange={(e) => update("scheduledDate", e.target.value)} />
                  {errors.scheduledDate && <p className="mt-1 text-xs text-red-600">{errors.scheduledDate}</p>}
                </div>
                <div>
                  <Label htmlFor="scheduledTime">Heure souhaitée *</Label>
                  <Input id="scheduledTime" type="time" value={form.scheduledTime} onChange={(e) => update("scheduledTime", e.target.value)} />
                  {errors.scheduledTime && <p className="mt-1 text-xs text-red-600">{errors.scheduledTime}</p>}
                </div>
              </div>

              <div>
                <Label>Type de véhicule</Label>
                <Select value={form.vehicleType} onValueChange={(v) => update("vehicleType", v as B2BVehicleType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(B2B_VEHICLE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Le véhicule est-il roulant ?</Label>
                <RadioGroup value={form.vehicleRunning} onValueChange={(v) => update("vehicleRunning", v as "oui" | "non")} className="mt-2 flex gap-6">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="oui" id="r-oui" /><Label htmlFor="r-oui" className="cursor-pointer">Oui</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="non" id="r-non" /><Label htmlFor="r-non" className="cursor-pointer">Non</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Urgence</Label>
                <Select value={form.urgency} onValueChange={(v) => update("urgency", v as B2BUrgency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(B2B_URGENCY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Notes complémentaires</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-slate-900">Estimation et paiement</h2>

              {estimate?.isEstimable ? (
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Distance estimée</span><strong>{estimate.distanceKm} km</strong></div>
                    {estimate.breakdown.map((b, i) => (
                      <div key={i} className="text-xs text-slate-500">{b}</div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-1 border-t border-emerald-200 pt-4 text-sm">
                    <div className="flex justify-between"><span>Prix HT</span><span>{estimate.priceHt.toFixed(2)} €</span></div>
                    <div className="flex justify-between"><span>TVA 20%</span><span>{estimate.vat.toFixed(2)} €</span></div>
                    <div className="flex justify-between text-lg font-bold text-emerald-700"><span>Total TTC</span><span>{estimate.priceTtc.toFixed(2)} €</span></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Estimation indicative, sous réserve de validation opérationnelle.</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Devis manuel requis</p>
                    <p className="mt-1 text-xs">La distance n'a pas pu être calculée automatiquement. Notre équipe vous contactera sous 24h pour un devis personnalisé.</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-4 text-sm">
                <h3 className="mb-2 font-semibold text-slate-900">Récapitulatif</h3>
                <div className="space-y-1 text-slate-600">
                  <div><strong>{form.companyName}</strong> — {form.contactName}</div>
                  <div>{form.pickupAddress} → {form.dropoffAddress}</div>
                  <div>{form.scheduledDate} à {form.scheduledTime}</div>
                  <div>{B2B_VEHICLE_LABELS[form.vehicleType]} · {form.vehicleRunning === "oui" ? "Roulant" : "Non roulant"} · {B2B_URGENCY_LABELS[form.urgency]}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button variant="ghost" onClick={prev} disabled={step === 1 || submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Précédent
            </Button>
            {step < 3 ? (
              <Button onClick={next} className="bg-emerald-600 hover:bg-emerald-700">
                Suivant <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handlePayAndConfirm} disabled={submitting || !estimate?.isEstimable} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirection…</> : <><CreditCard className="mr-2 h-4 w-4" /> Payer et confirmer la demande</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
