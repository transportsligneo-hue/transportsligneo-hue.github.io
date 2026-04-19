import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Calendar, Car, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendTransactionalEmail } from "@/lib/email/send";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import {
  calculateBasePrice,
  calculateOptionsTotal,
  RESERVATION_OPTIONS,
  type TripType,
} from "@/lib/reservation-pricing";

const STEPS = ["Trajet", "Options", "Véhicule", "Coordonnées", "Confirmation"];

interface FormState {
  ville_depart: string;
  ville_arrivee: string;
  date_prise_en_charge: string;
  type_trajet: TripType;
  options: string[];
  marque: string;
  modele: string;
  immatriculation: string;
  carburant: string;
  remarques: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  cgv: boolean;
}

const initialState: FormState = {
  ville_depart: "",
  ville_arrivee: "",
  date_prise_en_charge: "",
  type_trajet: "aller_simple",
  options: [],
  marque: "",
  modele: "",
  immatriculation: "",
  carburant: "essence",
  remarques: "",
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  cgv: false,
};

interface Props {
  /** Si fourni, callback à la fermeture (mode modal). */
  onClose?: () => void;
}

export default function TunnelReservation({ onClose }: Props) {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialState,
    email: user?.email ?? "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missionNumero, setMissionNumero] = useState<string | null>(null);

  const { base: basePrice, label: priceLabel } = useMemo(
    () => calculateBasePrice(form.ville_depart, form.ville_arrivee, form.type_trajet),
    [form.ville_depart, form.ville_arrivee, form.type_trajet]
  );
  const optionsTotal = useMemo(() => calculateOptionsTotal(form.options), [form.options]);
  const total = basePrice + optionsTotal;

  // Auth gate
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="text-center py-12 px-6">
        <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
        <h3 className="font-heading text-2xl text-cream mb-3">Connexion requise</h3>
        <p className="text-cream/70 text-sm mb-6 max-w-md mx-auto">
          Pour réserver un convoyage, connectez-vous ou créez votre compte.
        </p>
        <button
          onClick={() => {
            onClose?.();
            navigate({ to: "/login" });
          }}
          className="px-8 py-3 bg-primary text-navy font-medium tracking-wider uppercase text-sm hover:bg-primary/90 transition-colors"
        >
          Se connecter
        </button>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
      </div>
    );
  }

  const update = (name: string, value: any) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const toggleOption = (id: string) => {
    setForm((f) => ({
      ...f,
      options: f.options.includes(id)
        ? f.options.filter((o) => o !== id)
        : [...f.options, id],
    }));
  };

  const canNext = (): boolean => {
    if (step === 1) return !!(form.ville_depart && form.ville_arrivee && form.date_prise_en_charge);
    if (step === 2) return true;
    if (step === 3) return !!(form.marque && form.modele && form.immatriculation && form.carburant);
    if (step === 4) return !!(form.nom && form.prenom && form.email && form.cgv);
    return true;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const optionsLabels = form.options.map((id) => {
        const opt = RESERVATION_OPTIONS.find((o) => o.id === id);
        return opt ? { id, label: opt.label, price: opt.price } : null;
      }).filter(Boolean);

      // Cast en any car la table missions est nouvelle (types.ts auto-régénéré ensuite)
      const { data, error: insertError } = await (supabase as any)
        .from("missions")
        .insert({
          user_id: user.id,
          ville_depart: form.ville_depart,
          ville_arrivee: form.ville_arrivee,
          date_prise_en_charge: form.date_prise_en_charge,
          type_trajet: form.type_trajet,
          options: optionsLabels,
          marque: form.marque,
          modele: form.modele,
          immatriculation: form.immatriculation,
          carburant: form.carburant,
          remarques: form.remarques || null,
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone || null,
          prix_total: total,
          statut: "en_attente",
        })
        .select("id, numero")
        .single();

      if (insertError) throw insertError;

      const numero = data?.numero as string;
      setMissionNumero(numero);

      // Email de confirmation (best-effort)
      try {
        await sendTransactionalEmail({
          templateName: "mission-confirmation",
          recipientEmail: form.email,
          idempotencyKey: `mission-${data?.id}`,
          templateData: {
            prenom: form.prenom,
            numero,
            villeDepart: form.ville_depart,
            villeArrivee: form.ville_arrivee,
            date: new Date(form.date_prise_en_charge).toLocaleDateString("fr-FR"),
            prixTotal: total,
            typeTrajet: tripTypeLabel(form.type_trajet),
          },
        });
      } catch (emailErr) {
        console.error("Email confirmation failed:", emailErr);
      }

      setStep(5);
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="text-cream">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-primary/80">
            Étape {step}/5 — {STEPS[step - 1]}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-cream/60 hover:text-primary text-xs uppercase tracking-wider"
            >
              Fermer
            </button>
          )}
        </div>
        <div className="h-1 bg-navy-light rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {step === 1 && <Step1 form={form} update={update} />}
      {step === 2 && (
        <Step2
          form={form}
          update={update}
          toggleOption={toggleOption}
          basePrice={basePrice}
          priceLabel={priceLabel}
          optionsTotal={optionsTotal}
          total={total}
        />
      )}
      {step === 3 && <Step3 form={form} update={update} />}
      {step === 4 && (
        <Step4
          form={form}
          update={update}
          basePrice={basePrice}
          priceLabel={priceLabel}
          optionsTotal={optionsTotal}
          total={total}
        />
      )}
      {step === 5 && missionNumero && (
        <Step5 numero={missionNumero} form={form} total={total} onClose={onClose} />
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-4 py-2">
          {error}
        </p>
      )}

      {/* Navigation */}
      {step < 5 && (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-primary/15">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
            className="flex items-center gap-2 px-5 py-2.5 text-sm uppercase tracking-wider text-cream/70 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-7 py-3 bg-primary text-navy font-medium text-sm uppercase tracking-wider hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canNext() || submitting}
              className="flex items-center gap-2 px-7 py-3 bg-primary text-navy font-medium text-sm uppercase tracking-wider hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmer la réservation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function tripTypeLabel(t: TripType): string {
  return t === "aller_simple" ? "Aller simple" : t === "aller_retour" ? "Aller-retour" : "Express (+20%)";
}

// ----- Steps -----

function Step1({ form, update }: { form: FormState; update: (n: string, v: any) => void }) {
  const today = new Date().toISOString().split("T")[0];
  return (
    <div>
      <SectionTitle icon={<MapPin className="w-5 h-5" />} title="Votre trajet" />
      <div className="grid sm:grid-cols-2 gap-5">
        <AddressAutocomplete
          name="ville_depart"
          label="Ville de départ"
          value={form.ville_depart}
          onChange={update}
          required
        />
        <AddressAutocomplete
          name="ville_arrivee"
          label="Ville d'arrivée"
          value={form.ville_arrivee}
          onChange={update}
          required
        />
        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">
            <Calendar className="w-3 h-3 inline mr-1" /> Date de prise en charge
          </label>
          <input
            type="date"
            min={today}
            value={form.date_prise_en_charge}
            onChange={(e) => update("date_prise_en_charge", e.target.value)}
            required
            className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

function Step2({
  form, update, toggleOption, basePrice, priceLabel, optionsTotal, total,
}: {
  form: FormState; update: (n: string, v: any) => void; toggleOption: (id: string) => void;
  basePrice: number; priceLabel: string; optionsTotal: number; total: number;
}) {
  const types: { value: TripType; label: string; desc: string }[] = [
    { value: "aller_simple", label: "Aller simple", desc: "Convoyage A → B" },
    { value: "aller_retour", label: "Aller-retour", desc: "Tarif avantageux" },
    { value: "express", label: "Express", desc: "+20% prioritaire" },
  ];
  return (
    <div>
      <SectionTitle icon={<Sparkles className="w-5 h-5" />} title="Options de service" />
      <p className="text-xs uppercase tracking-wider text-cream/50 mb-3">Type de trajet</p>
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {types.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => update("type_trajet", t.value)}
            className={`text-left p-4 border rounded transition-all ${
              form.type_trajet === t.value
                ? "border-primary bg-primary/10"
                : "border-primary/20 hover:border-primary/50 bg-navy/40"
            }`}
          >
            <p className="text-cream font-medium text-sm">{t.label}</p>
            <p className="text-cream/50 text-xs mt-1">{t.desc}</p>
          </button>
        ))}
      </div>

      <p className="text-xs uppercase tracking-wider text-cream/50 mb-3">Prestations supplémentaires</p>
      <div className="space-y-2 mb-6">
        {RESERVATION_OPTIONS.map((opt) => {
          const checked = form.options.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                checked ? "border-primary bg-primary/10" : "border-primary/20 hover:border-primary/40 bg-navy/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOption(opt.id)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-cream text-sm">{opt.label}</span>
              </div>
              <span className="text-primary text-sm font-medium">+ {opt.price.toFixed(2)} €</span>
            </label>
          );
        })}
      </div>

      <PriceBox basePrice={basePrice} priceLabel={priceLabel} optionsTotal={optionsTotal} total={total} />
    </div>
  );
}

function Step3({ form, update }: { form: FormState; update: (n: string, v: any) => void }) {
  const carburants = [
    { v: "essence", l: "Essence" },
    { v: "diesel", l: "Diesel" },
    { v: "electrique", l: "Électrique" },
    { v: "hybride", l: "Hybride" },
  ];
  return (
    <div>
      <SectionTitle icon={<Car className="w-5 h-5" />} title="Votre véhicule" />
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Marque" name="marque" value={form.marque} onChange={update} required />
        <Field label="Modèle" name="modele" value={form.modele} onChange={update} required />
        <Field label="Immatriculation" name="immatriculation" value={form.immatriculation} onChange={update} required />
        <div>
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Carburant</label>
          <select
            value={form.carburant}
            onChange={(e) => update("carburant", e.target.value)}
            className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none"
          >
            {carburants.map((c) => (
              <option key={c.v} value={c.v} className="bg-navy">{c.l}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">Remarques particulières (optionnel)</label>
          <textarea
            value={form.remarques}
            onChange={(e) => update("remarques", e.target.value)}
            rows={3}
            className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none resize-none"
            placeholder="Accès difficile, code portail, contact spécifique..."
          />
        </div>
      </div>
    </div>
  );
}

function Step4({
  form, update, basePrice, priceLabel, optionsTotal, total,
}: {
  form: FormState; update: (n: string, v: any) => void;
  basePrice: number; priceLabel: string; optionsTotal: number; total: number;
}) {
  return (
    <div>
      <SectionTitle icon={<User className="w-5 h-5" />} title="Vos coordonnées" />
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <Field label="Prénom" name="prenom" value={form.prenom} onChange={update} required />
        <Field label="Nom" name="nom" value={form.nom} onChange={update} required />
        <Field label="Email" name="email" type="email" value={form.email} onChange={update} required />
        <Field label="Téléphone" name="telephone" type="tel" value={form.telephone} onChange={update} />
      </div>

      <div className="bg-navy-light/60 border border-primary/30 rounded p-5 mb-5">
        <p className="text-xs uppercase tracking-wider text-primary mb-3">Récapitulatif de la commande</p>
        <RecapLine label="Trajet" value={`${form.ville_depart} → ${form.ville_arrivee}`} />
        <RecapLine label="Date" value={form.date_prise_en_charge ? new Date(form.date_prise_en_charge).toLocaleDateString("fr-FR") : "—"} />
        <RecapLine label="Type" value={tripTypeLabel(form.type_trajet)} />
        {form.options.length > 0 && (
          <RecapLine
            label="Options"
            value={form.options.map((id) => RESERVATION_OPTIONS.find((o) => o.id === id)?.label).join(", ")}
          />
        )}
        <RecapLine label="Véhicule" value={`${form.marque} ${form.modele}`.trim() || "—"} />
        <div className="border-t border-primary/20 mt-3 pt-3 flex items-baseline justify-between">
          <span className="text-cream/70 text-xs uppercase tracking-wider">Total TTC</span>
          <span className="font-heading text-2xl text-primary">{total.toFixed(2)} €</span>
        </div>
        <p className="text-cream/40 text-xs mt-1">Base : {basePrice.toFixed(2)} € — {priceLabel}{optionsTotal > 0 ? ` · Options : +${optionsTotal.toFixed(2)} €` : ""}</p>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.cgv}
          onChange={(e) => update("cgv", e.target.checked)}
          className="mt-1 w-4 h-4 accent-primary"
        />
        <span className="text-cream/80 text-sm">
          J'accepte les{" "}
          <a href="/cgv" target="_blank" className="text-primary hover:underline">conditions générales de vente</a>{" "}
          et la{" "}
          <a href="/confidentialite" target="_blank" className="text-primary hover:underline">politique de confidentialité</a>.
        </span>
      </label>
    </div>
  );
}

function Step5({ numero, form, total, onClose }: { numero: string; form: FormState; total: number; onClose?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
        <Check className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-heading text-3xl text-cream mb-2">Réservation confirmée !</h3>
      <p className="text-cream/60 text-sm mb-6">Un email de confirmation vient de vous être envoyé.</p>

      <div className="bg-navy-light/60 border border-primary/30 rounded p-5 max-w-md mx-auto text-left mb-6">
        <p className="text-xs uppercase tracking-wider text-primary mb-3">Mission</p>
        <RecapLine label="N°" value={numero} />
        <RecapLine label="Trajet" value={`${form.ville_depart} → ${form.ville_arrivee}`} />
        <RecapLine label="Date" value={new Date(form.date_prise_en_charge).toLocaleDateString("fr-FR")} />
        <RecapLine label="Statut" value="En attente de validation" />
        <div className="border-t border-primary/20 mt-3 pt-3 flex items-baseline justify-between">
          <span className="text-cream/70 text-xs uppercase tracking-wider">Total TTC</span>
          <span className="font-heading text-xl text-primary">{total.toFixed(2)} €</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => { onClose?.(); navigate({ to: "/" }); }}
          className="px-6 py-2.5 text-sm uppercase tracking-wider text-cream/80 hover:text-primary border border-primary/30 rounded transition-colors"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}

// ----- Helpers UI -----

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-primary">{icon}</span>
      <h3 className="font-heading text-xl text-cream">{title}</h3>
    </div>
  );
}

function Field({
  label, name, value, onChange, required, type = "text",
}: {
  label: string; name: string; value: string; onChange: (n: string, v: any) => void;
  required?: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-cream/50 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        className="w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors"
      />
    </div>
  );
}

function RecapLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-cream/60">{label}</span>
      <span className="text-cream text-right">{value}</span>
    </div>
  );
}

function PriceBox({
  basePrice, priceLabel, optionsTotal, total,
}: { basePrice: number; priceLabel: string; optionsTotal: number; total: number }) {
  return (
    <div className="bg-navy-light/60 border border-primary/30 rounded p-5">
      <p className="text-xs uppercase tracking-wider text-primary mb-3">Prix estimé</p>
      <div className="flex justify-between text-sm py-1">
        <span className="text-cream/70">Base ({priceLabel})</span>
        <span className="text-cream">{basePrice.toFixed(2)} €</span>
      </div>
      {optionsTotal > 0 && (
        <div className="flex justify-between text-sm py-1">
          <span className="text-cream/70">Options</span>
          <span className="text-cream">+ {optionsTotal.toFixed(2)} €</span>
        </div>
      )}
      <div className="border-t border-primary/20 mt-3 pt-3 flex items-baseline justify-between">
        <span className="text-cream/70 text-xs uppercase tracking-wider">Total TTC</span>
        <span className="font-heading text-2xl text-primary">{total.toFixed(2)} €</span>
      </div>
    </div>
  );
}
