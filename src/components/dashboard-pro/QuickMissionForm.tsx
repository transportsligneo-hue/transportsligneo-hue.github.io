import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  MapPin, MapPinned, User, Phone, Calendar, Clock, Car,
  Loader2, Send, CheckCircle, Info, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlacesInput from "@/components/PlacesInput";
import { notifyAdmin } from "@/lib/admin-notifications";
import { resolveClientPrice } from "@/lib/client-pricing";
import { calculateBasePrice, type TripType } from "@/lib/reservation-pricing";

type TripOption = "aller-simple" | "aller-retour" | "express";
type DisplayMode = "ttc" | "ht" | "exempt";

interface ProfileInfo {
  email: string;
  prenom: string;
  nom: string;
  telephone: string;
  societe: string;
  pricing_display_mode: DisplayMode;
  tva_exemption_note: string | null;
}

const VEHICLE_TYPES = [
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "utilitaire", label: "Utilitaire" },
  { value: "autre", label: "Autre" },
];

const VAT_RATE = 0.20;

interface Props {
  /** Redirection après création de la demande (défaut: /dashboard-pro/missions) */
  successRedirect?: string;
}

export default function QuickMissionForm({ successRedirect = "/dashboard-pro/missions" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Form
  const [tripType, setTripType] = useState<TripOption>("aller-simple");
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [contactDepartNom, setContactDepartNom] = useState("");
  const [contactDepartTel, setContactDepartTel] = useState("");
  const [contactDepartNote, setContactDepartNote] = useState("");
  const [contactArriveeNom, setContactArriveeNom] = useState("");
  const [contactArriveeTel, setContactArriveeTel] = useState("");
  const [contactArriveeNote, setContactArriveeNote] = useState("");
  const [vehicleType, setVehicleType] = useState("berline");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [message, setMessage] = useState("");

  // Pricing
  const [customPrice, setCustomPrice] = useState<{ ttc: number; ht: number | null; label: string } | null>(null);
  const [resolving, setResolving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile (silently — no fields shown)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email, prenom, nom, telephone, societe, pricing_display_mode, tva_exemption_note")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = data as Partial<ProfileInfo> | null;
      setProfile({
        email: p?.email ?? user.email ?? "",
        prenom: p?.prenom ?? "",
        nom: p?.nom ?? "",
        telephone: p?.telephone ?? "",
        societe: p?.societe ?? "",
        pricing_display_mode: (p?.pricing_display_mode as DisplayMode) ?? "ttc",
        tva_exemption_note: p?.tva_exemption_note ?? null,
      });
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Resolve custom price + fallback whenever inputs change
  useEffect(() => {
    if (!profile || !depart || !arrivee) {
      setCustomPrice(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const resolverTrip = tripType === "aller-retour" ? "aller_retour" : "aller";
      // 1) Tarif personnalisé
      const custom = await resolveClientPrice({
        userId: user?.id ?? null,
        email: profile.email,
        depart, arrivee, tripType: resolverTrip,
      });
      if (cancelled) return;
      if (custom) {
        setCustomPrice({
          ttc: custom.prix_ttc,
          ht: custom.prix_ht,
          label: custom.zone_label
            ? `Tarif personnalisé · ${custom.zone_label}`
            : "Tarif personnalisé",
        });
        setResolving(false);
        return;
      }
      // 2) Fallback standard
      const tt: TripType = tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : "aller_simple";
      const std = calculateBasePrice(depart, arrivee, tt);
      if (std.base > 0) {
        setCustomPrice({ ttc: std.base, ht: null, label: std.label });
      } else {
        setCustomPrice(null);
      }
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [depart, arrivee, tripType, profile, user]);

  // Computed displayed pricing
  const priceView = useMemo(() => {
    if (!customPrice) return null;
    const mode: DisplayMode = profile?.pricing_display_mode ?? "ttc";
    const ttc = customPrice.ttc;
    const ht = customPrice.ht ?? Math.round((ttc / (1 + VAT_RATE)) * 100) / 100;
    const tva = Math.round((ttc - ht) * 100) / 100;
    return { ttc, ht, tva, mode, label: customPrice.label };
  }, [customPrice, profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setError(null);

    if (!depart || !arrivee || !date) {
      setError("Merci de renseigner départ, arrivée et date.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        nom: profile.nom || "Client",
        prenom: profile.prenom || "",
        email: profile.email,
        telephone: profile.telephone || "",
        depart,
        arrivee,
        date_souhaitee: date,
        heure_souhaitee: heure || "",
        message: [
          message,
          profile.societe ? `Société : ${profile.societe}` : "",
        ].filter(Boolean).join("\n"),
        options: tripType,
        statut: "nouvelle",
        prix_estime: priceView?.ttc ?? null,
        contact_depart_nom: contactDepartNom || null,
        contact_depart_tel: contactDepartTel || null,
        contact_depart_note: contactDepartNote || null,
        contact_arrivee_nom: contactArriveeNom || null,
        contact_arrivee_tel: contactArriveeTel || null,
        contact_arrivee_note: contactArriveeNote || null,
      } as never;

      const { data: inserted, error: insErr } = await supabase
        .from("demandes_convoyage")
        .insert(payload)
        .select("id")
        .single();

      if (insErr) throw insErr;

      // Notif admin (best-effort)
      notifyAdmin({
        type: "client_action",
        titre: `Nouvelle demande — ${profile.societe || profile.nom || profile.email}`,
        message: `${depart} → ${arrivee}${priceView ? ` · ${priceView.ttc.toFixed(0)} €` : ""}`,
        link: "/admin/demandes",
        entityType: "demande",
        entityId: inserted?.id,
      }).catch(() => { /* best-effort */ });

      setSuccess(true);
      // Redirect after a short delay
      setTimeout(() => {
        navigate({ to: successRedirect });
      }, 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
        <CheckCircle className="text-emerald-500 mx-auto mb-3" size={40} />
        <h2 className="text-lg font-semibold text-pro-text">Demande envoyée</h2>
        <p className="text-pro-text-soft text-sm mt-2">
          Votre demande a bien été transmise à notre équipe. Vous la retrouverez dans vos missions.
        </p>
      </div>
    );
  }

  const inp = "w-full rounded-lg border border-pro-border bg-white px-3.5 py-2.5 text-sm text-pro-text placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pro-accent/20 focus:border-pro-accent transition-colors";
  const lbl = "block text-xs font-medium text-pro-text-soft uppercase tracking-wide mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type de prestation */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-pro-accent" /> Type de prestation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { v: "aller-simple", label: "Aller simple", desc: "Livraison à destination" },
            { v: "aller-retour", label: "Aller-retour", desc: "Livraison + restitution" },
            { v: "express", label: "Express", desc: "Sous 24h" },
          ].map((opt) => {
            const active = tripType === (opt.v as TripOption);
            return (
              <button
                key={opt.v} type="button"
                onClick={() => setTripType(opt.v as TripOption)}
                className={`text-left rounded-lg border px-4 py-3 transition-all ${
                  active
                    ? "border-pro-accent bg-pro-accent/5 ring-1 ring-pro-accent/30"
                    : "border-pro-border hover:border-pro-accent/40 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-pro-text">{opt.label}</p>
                <p className="text-xs text-pro-text-soft mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Départ */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-1.5">
          <MapPin size={14} className="text-pro-accent" /> Lieu d'enlèvement
        </h2>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Adresse de départ</label>
            <PlacesInput
              value={depart}
              onChange={setDepart}
              placeholder="Ex : 14 rue Nationale, Tours"
              className={inp}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><User size={11} className="inline mr-1" /> Contact sur place</label>
              <input className={inp} value={contactDepartNom} onChange={(e) => setContactDepartNom(e.target.value)} placeholder="Nom du contact" />
            </div>
            <div>
              <label className={lbl}><Phone size={11} className="inline mr-1" /> Téléphone</label>
              <input className={inp} value={contactDepartTel} onChange={(e) => setContactDepartTel(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" />
            </div>
          </div>
          <div>
            <label className={lbl}>Commentaire (clés, horaires, parking...)</label>
            <input className={inp} value={contactDepartNote} onChange={(e) => setContactDepartNote(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
      </section>

      {/* Arrivée */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-1.5">
          <MapPinned size={14} className="text-pro-accent" /> Lieu de livraison
        </h2>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Adresse d'arrivée</label>
            <PlacesInput
              value={arrivee}
              onChange={setArrivee}
              placeholder="Ex : 5 avenue de la République, Le Mans"
              className={inp}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><User size={11} className="inline mr-1" /> Contact sur place</label>
              <input className={inp} value={contactArriveeNom} onChange={(e) => setContactArriveeNom(e.target.value)} placeholder="Nom du contact" />
            </div>
            <div>
              <label className={lbl}><Phone size={11} className="inline mr-1" /> Téléphone</label>
              <input className={inp} value={contactArriveeTel} onChange={(e) => setContactArriveeTel(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" />
            </div>
          </div>
          <div>
            <label className={lbl}>Commentaire (horaires, code, étage...)</label>
            <input className={inp} value={contactArriveeNote} onChange={(e) => setContactArriveeNote(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
      </section>

      {/* Véhicule & planning */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-1.5">
          <Car size={14} className="text-pro-accent" /> Véhicule & planning
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={lbl}>Type de véhicule</label>
            <select className={inp} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date souhaitée</label>
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure souhaitée</label>
            <input type="time" className={inp} value={heure} onChange={(e) => setHeure(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <label className={lbl}>Informations complémentaires</label>
          <textarea className={`${inp} min-h-[80px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Particularités, accès, conditions..." />
        </div>
      </section>

      {/* Récap prix */}
      <section className="bg-pro-bg rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3">Estimation</h2>
        {resolving ? (
          <div className="flex items-center gap-2 text-pro-text-soft text-sm">
            <Loader2 size={14} className="animate-spin" /> Calcul en cours...
          </div>
        ) : !priceView ? (
          <p className="text-pro-text-soft text-sm">
            Renseignez les adresses pour obtenir une estimation.
          </p>
        ) : (
          <PriceRecap view={priceView} note={profile?.tva_exemption_note ?? null} />
        )}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-xs text-pro-text-soft flex items-center gap-1.5">
          <Info size={12} /> Votre demande sera traitée sous 24h par notre équipe.
        </p>
        <button
          type="submit"
          disabled={submitting || !depart || !arrivee || !date}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Créer la demande de mission
        </button>
      </div>
    </form>
  );
}

function PriceRecap({
  view, note,
}: {
  view: { ttc: number; ht: number; tva: number; mode: DisplayMode; label: string };
  note: string | null;
}) {
  const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  const isExempt = view.mode === "exempt";

  return (
    <div className="space-y-3">
      <p className="text-xs text-pro-text-soft uppercase tracking-wide">{view.label}</p>

      <div className="flex items-end justify-between flex-wrap gap-3 border-t border-pro-border pt-3">
        {isExempt ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase">Montant</p>
              <p className="text-3xl font-semibold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-xs text-pro-text-soft mt-1">Non soumis à TVA</p>
            </div>
          </>
        ) : view.mode === "ht" ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase">HT</p>
              <p className="text-3xl font-semibold text-pro-text">{fmt(view.ht)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-pro-text-soft">TVA 20%</p>
              <p className="text-sm font-medium text-pro-text">{fmt(view.tva)}</p>
              <p className="text-xs text-pro-text-soft mt-1">TTC</p>
              <p className="text-base font-semibold text-pro-text">{fmt(view.ttc)}</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase">Prix TTC</p>
              <p className="text-3xl font-semibold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-xs text-pro-text-soft mt-1">dont TVA 20% : {fmt(view.tva)} · HT : {fmt(view.ht)}</p>
            </div>
          </>
        )}
      </div>

      {isExempt && note && (
        <p className="text-[11px] text-pro-text-soft italic border-t border-pro-border pt-3 leading-relaxed">
          {note}
        </p>
      )}
    </div>
  );
}
