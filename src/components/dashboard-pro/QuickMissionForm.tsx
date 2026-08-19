import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  MapPin, MapPinned, User, Phone, Calendar, Clock, Car,
  Loader2, Send, CheckCircle, Info, Sparkles, Star, Search, Zap, Fuel, Sparkle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlacesInput from "@/components/PlacesInput";
import { notifyAdmin } from "@/lib/admin-notifications";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveClientPrice, computeOptionSupplements, type OptionKey } from "@/lib/client-pricing";
import { calculateBasePrice, type TripType } from "@/lib/reservation-pricing";
import { lookupPlate } from "@/lib/plate.functions";
import { ScanToPrefill } from "@/components/scanner/ScanToPrefill";
import { QrHandoffButton } from "@/components/scanner/QrHandoffButton";
import type { ExtractedFields } from "@/lib/scanner/types";
import { toast } from "sonner";
import { PV_PLATEFORMES, PvLogo, pvDef, type PvChoice } from "@/components/mission/pv-plateformes";

type TripOption = "aller-simple" | "aller-retour" | "express" | "recharge";
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

interface FavoriteAddress {
  id: string;
  label: string;
  address: string;
  ville: string | null;
  code_postal: string | null;
  address_type: "depart" | "arrivee" | "both";
  contact_nom: string | null;
  contact_tel: string | null;
  contact_email: string | null;
  notes_acces: string | null;
  is_default: boolean;
}


const VEHICLE_TYPES = [
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "break", label: "Break" },
  { value: "monospace", label: "Monospace" },
  { value: "coupe", label: "Coupé" },
  { value: "cabriolet", label: "Cabriolet" },
  { value: "luxe", label: "Luxe / Supercar" },
  { value: "utilitaire", label: "Utilitaire" },
  { value: "autre", label: "Autre" },
];

const ENERGIES = [
  { value: "essence", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybride", label: "Hybride" },
  { value: "hybride_rechargeable", label: "Hybride rechargeable" },
  { value: "electrique", label: "Électrique" },
  { value: "gpl", label: "GPL" },
  { value: "autre", label: "Autre" },
];

const OPTIONS_DEF: { key: OptionKey; label: string; desc: string; Icon: typeof Zap }[] = [
  { key: "recharge_electrique", label: "Recharge électrique", desc: "Brancher pour le trajet", Icon: Zap },
  { key: "plein_essence", label: "Appoint carburant", desc: "Carburant ajouté selon le niveau souhaité", Icon: Fuel },
  { key: "nettoyage", label: "Nettoyage véhicule", desc: "Lavage extérieur si utile", Icon: Sparkle },
];

const VAT_RATE = 0.20;

interface Props {
  successRedirect?: string;
}

export default function QuickMissionForm({ successRedirect = "/dashboard-pro/missions" }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteAddress[]>([]);

  // Form
  const [tripType, setTripType] = useState<TripOption>("aller-simple");
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [contactDepartNom, setContactDepartNom] = useState("");
  const [contactDepartTel, setContactDepartTel] = useState("");
  const [contactDepartNote, setContactDepartNote] = useState("");
  const [contactArriveeNom, setContactArriveeNom] = useState("");
  const [contactArriveeTel, setContactArriveeTel] = useState("");
  const [contactArriveeNote, setContactArriveeNote] = useState("");

  // Véhicule
  const [vehicleType, setVehicleType] = useState("berline");
  const [immat, setImmat] = useState("");
  const [vin, setVin] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [energie, setEnergie] = useState("");
  const [couleur, setCouleur] = useState("");
  const [km, setKm] = useState("");
  const [vehNotes, setVehNotes] = useState("");
  const [plateBusy, setPlateBusy] = useState(false);

  // Restitution (Aller-retour) · 2e véhicule + adresses différentes
  const [sameRetourAddress, setSameRetourAddress] = useState(true);
  const [departRetour, setDepartRetour] = useState("");
  const [arriveeRetour, setArriveeRetour] = useState("");
  const [sameRetourVehicle, setSameRetourVehicle] = useState(true);
  const [immatRetour, setImmatRetour] = useState("");
  const [marqueRetour, setMarqueRetour] = useState("");
  const [modeleRetour, setModeleRetour] = useState("");
  const [vinRetour, setVinRetour] = useState("");
  const [dateRetour, setDateRetour] = useState("");
  const [heureRetour, setHeureRetour] = useState("");
  const [plateRetourBusy, setPlateRetourBusy] = useState(false);

  // Options
  const [options, setOptions] = useState<Partial<Record<OptionKey, boolean>>>({});
  const [autreNote, setAutreNote] = useState("");
  const [pvDigitalise, setPvDigitalise] = useState<PvChoice>("aucun");

  // Planning
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [message, setMessage] = useState("");

  // Pricing
  const [pricing, setPricing] = useState<{
    base: number;
    baseLabel: string;
    supplements: Partial<Record<OptionKey, number>>;
  } | null>(null);
  const [resolving, setResolving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile + favorites
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: fav }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, prenom, nom, telephone, societe, pricing_display_mode, tva_exemption_note")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("client_default_addresses" as never)
          .select("id, label, address, ville, code_postal, address_type, contact_nom, contact_tel, contact_email, notes_acces, is_default")
          .eq("active", true)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),

      ]);
      if (cancelled) return;
      const pp = p as Partial<ProfileInfo> | null;
      setProfile({
        email: pp?.email ?? user.email ?? "",
        prenom: pp?.prenom ?? "",
        nom: pp?.nom ?? "",
        telephone: pp?.telephone ?? "",
        societe: pp?.societe ?? "",
        pricing_display_mode: (pp?.pricing_display_mode as DisplayMode) ?? "ttc",
        tva_exemption_note: pp?.tva_exemption_note ?? null,
      });
      setFavorites((fav as unknown as FavoriteAddress[]) ?? []);
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Apply favorite address (departure or arrival, depending on type)
  const applyFavorite = (f: FavoriteAddress, forceTarget?: "depart" | "arrivee") => {
    setDefaultAddressId(f.id);
    const target = forceTarget ?? (f.address_type === "arrivee" ? "arrivee" : "depart");
    const fullAddr = [f.address, [f.code_postal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (target === "depart") {
      setDepart(fullAddr);
      if (f.contact_nom) setContactDepartNom(f.contact_nom);
      if (f.contact_tel) setContactDepartTel(f.contact_tel);
      if (f.notes_acces) setContactDepartNote(f.notes_acces);
    } else {
      setArrivee(fullAddr);
      if (f.contact_nom) setContactArriveeNom(f.contact_nom);
      if (f.contact_tel) setContactArriveeTel(f.contact_tel);
      if (f.notes_acces) setContactArriveeNote(f.notes_acces);
    }
    toast.success(`Adresse « ${f.label} » utilisée (${target === "depart" ? "départ" : "arrivée"})`);
  };

  // Auto-prefill default addresses on first load
  useEffect(() => {
    if (favorites.length === 0) return;
    const defDep = favorites.find(f => f.is_default && (f.address_type === "depart" || f.address_type === "both"));
    const defArr = favorites.find(f => f.is_default && (f.address_type === "arrivee" || f.address_type === "both"));
    if (defDep && !depart) applyFavorite(defDep, "depart");
    if (defArr && !arrivee) applyFavorite(defArr, "arrivee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites]);


  // Resolve price whenever inputs change
  useEffect(() => {
    if (!profile || !depart || !arrivee) {
      setPricing(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const resolverTrip = tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : "aller";
      const custom = await resolveClientPrice({
        userId: user?.id ?? null,
        email: profile.email,
        depart, arrivee, tripType: resolverTrip,
      });
      if (cancelled) return;
      if (custom) {
        setPricing({
          base: custom.prix_ttc,
          baseLabel: custom.zone_label
            ? `Tarif personnalisé · ${custom.zone_label}`
            : "Tarif personnalisé",
          supplements: custom.supplements,
        });
        setResolving(false);
        return;
      }
      const tt: TripType = tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : "aller_simple";
      const std = calculateBasePrice(depart, arrivee, tt);
      if (std.base > 0) {
        setPricing({ base: std.base, baseLabel: std.label, supplements: {} });
      } else {
        setPricing(null);
      }
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [depart, arrivee, tripType, profile, user]);

  // Recharge uniquement : pas de livraison, l'adresse d'arrivée = adresse d'intervention
  useEffect(() => {
    if (tripType === "recharge") setArrivee(depart);
  }, [tripType, depart]);

  // Auto-set express option when tripType is express
  useEffect(() => {
    if (tripType === "express") {
      setOptions((o) => ({ ...o, express: true }));
    }
  }, [tripType]);

  // Computed pricing view (incl. supplements)
  const priceView = useMemo(() => {
    if (!pricing) return null;
    const mode: DisplayMode = profile?.pricing_display_mode ?? "ttc";
    const sup = computeOptionSupplements(pricing.supplements, options);
    const ttc = Math.round((pricing.base + sup.total) * 100) / 100;
    const ht = Math.round((ttc / (1 + VAT_RATE)) * 100) / 100;
    const tva = Math.round((ttc - ht) * 100) / 100;
    return { base: pricing.base, baseLabel: pricing.baseLabel, supLines: sup.lines, ttc, ht, tva, mode };
  }, [pricing, options, profile]);

  // Plate lookup
  const handlePlateLookup = async () => {
    if (!immat || immat.length < 4) {
      toast.error("Saisissez une plaque valide");
      return;
    }
    setPlateBusy(true);
    try {
      const result = await lookupPlate({ data: { plate: immat } });
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée · vous pouvez remplir manuellement");
        return;
      }
      const d = result.data;
      if (d.marque && !marque) setMarque(d.marque);
      if (d.modele && !modele) setModele(d.modele);
      if (d.vin && !vin) setVin(d.vin);
      if (!energie) {
        if (d.energie) setEnergie(d.energie === "hydrogene" || d.energie === "gnv" ? "autre" : d.energie);
        else if (d.carburant) {
          const c = d.carburant.toLowerCase();
          if (c.includes("élec") || c.includes("elec") || c.includes("ev")) setEnergie("electrique");
          else if (c.includes("hyb") && c.includes("rech")) setEnergie("hybride_rechargeable");
          else if (c.includes("hyb")) setEnergie("hybride");
          else if (c.includes("diesel") || c.includes("go") || c.includes("gazole")) setEnergie("diesel");
          else if (c.includes("gpl")) setEnergie("gpl");
          else if (c.includes("ess")) setEnergie("essence");
        }
      }
      if (d.categorie) {
        setVehicleType(VEHICLE_TYPES.some((v) => v.value === d.categorie) ? d.categorie : "autre");
      }
      toast.success("Informations véhicule récupérées");

    } catch {
      toast.error("Service indisponible · vous pouvez remplir manuellement");
    } finally {
      setPlateBusy(false);
    }
  };

  // Plate lookup for return vehicle
  const handlePlateRetourLookup = async () => {
    if (!immatRetour || immatRetour.length < 4) {
      toast.error("Saisissez une plaque retour valide");
      return;
    }
    setPlateRetourBusy(true);
    try {
      const result = await lookupPlate({ data: { plate: immatRetour } });
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée");
        return;
      }
      const d = result.data;
      if (d.marque) setMarqueRetour(d.marque);
      if (d.modele) setModeleRetour(d.modele);
      if (d.vin) setVinRetour(d.vin);
      toast.success("Véhicule retour récupéré");
    } catch {
      toast.error("Service indisponible");
    } finally {
      setPlateRetourBusy(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setError(null);

    if (!depart || !arrivee || !date || !heure) {
      setError("Merci de renseigner départ, arrivée, date et heure.");
      return;
    }
    if (tripType === "aller-retour" && (!dateRetour || !heureRetour)) {
      setError("Merci de renseigner la date et l'heure de restitution.");
      return;
    }


    setSubmitting(true);
    try {
      const optionsMeta: Record<string, unknown> = {};
      (Object.keys(options) as OptionKey[]).forEach((k) => {
        if (options[k]) optionsMeta[k] = true;
      });
      if (autreNote.trim()) optionsMeta.autre_note = autreNote.trim();

      const prixTtc = priceView?.ttc ?? null;

      // 1) Crée d'abord un DEVIS (statut "envoye") pour que le client reçoive
      //    immédiatement son estimation par email et le retrouve dans son espace.
      let devisId: string | null = null;
      let devisNumero: string | null = null;
      if (prixTtc && prixTtc > 0) {
        const { data: devisRow, error: devisErr } = await supabase
          .from("devis")
          .insert({
            user_id: user.id,
            nom: profile.nom || "Client",
            prenom: profile.prenom || "",
            email: profile.email,
            telephone: profile.telephone || "",
            depart,
            arrivee,
            date_souhaitee: date || null,
            heure_souhaitee: heure || null,
            marque: marque || null,
            modele: modele || null,
            vin: vin || null,
            carburant: energie || null,
            option_trajet: tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : tripType === "recharge" ? "recharge_seule" : "aller_simple",
            prix_estime: prixTtc,
            statut: "envoye",
            origine: "demande_client",
            message: message || null,
          } as never)
          .select("id, numero")
          .single();
        if (devisErr) {
          console.warn("[QuickMissionForm] devis insert failed", devisErr);
        } else {
          devisId = (devisRow as { id: string } | null)?.id ?? null;
          devisNumero = (devisRow as { numero: string } | null)?.numero ?? null;
        }
      }

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
        options_meta: optionsMeta,
        statut: "nouvelle",
        prix_estime: prixTtc,
        pricing_display_mode: profile.pricing_display_mode,
        default_address_id: defaultAddressId,
        contact_depart_nom: contactDepartNom || null,
        contact_depart_tel: contactDepartTel || null,
        contact_depart_note: contactDepartNote || null,
        contact_arrivee_nom: contactArriveeNom || null,
        contact_arrivee_tel: contactArriveeTel || null,
        contact_arrivee_note: contactArriveeNote || null,
        // Véhicule détaillé
        vehicule_immatriculation: immat || null,
        vehicule_vin: vin || null,
        vehicule_marque: marque || null,
        vehicule_modele: modele || null,
        vehicule_energie: energie || null,
        vehicule_type: vehicleType || null,
        vehicule_couleur: couleur || null,
        vehicule_km: km ? parseInt(km, 10) : null,
        vehicule_notes: vehNotes || null,
        // Rétro-compat
        immatriculation: immat || "",
        marque: marque || "",
        modele: modele || "",
        carburant: energie || "",
        // PV de livraison digitalisé demandé par le client
        pv_digitalise: pvDigitalise,
        // Lien vers le devis auto-généré
        ...(devisId ? { devis_id: devisId, devis_genere_at: new Date().toISOString() } : {}),
        // Restitution (Aller-retour)
        ...(tripType === "aller-retour"
          ? {
              depart_retour: departRetour || arrivee,
              arrivee_retour: sameRetourAddress ? depart : (arriveeRetour || depart),
              recuperation_retour_identique: sameRetourAddress,
              adresse_recuperation_retour: sameRetourAddress ? null : (departRetour || null),
              immatriculation_retour: sameRetourVehicle ? (immat || null) : (immatRetour || null),
              marque_retour: sameRetourVehicle ? (marque || null) : (marqueRetour || null),
              modele_retour: sameRetourVehicle ? (modele || null) : (modeleRetour || null),
              vin_retour: sameRetourVehicle ? (vin || null) : (vinRetour || null),
              date_retour: dateRetour || null,
              heure_retour: heureRetour || null,
            }
          : {}),
      } as never;

      const { data: inserted, error: insErr } = await supabase
        .from("demandes_convoyage")
        .insert(payload)
        .select("id")
        .single();

      if (insErr) throw insErr;

      const demandeId = inserted?.id;
      const numero = devisNumero ?? (demandeId ? `DEM-${String(demandeId).slice(0, 8).toUpperCase()}` : "");
      const clientLabel = profile.societe || `${profile.prenom} ${profile.nom}`.trim() || profile.email;

      // Lier la demande au devis côté devis également (best-effort)
      if (devisId && demandeId) {
        void supabase.from("devis").update({ demande_id: demandeId }).eq("id", devisId);
      }

      // Notification admin (in-app + push web)
      notifyAdmin({
        type: "client_action",
        titre: `Nouvelle demande · ${clientLabel}`,
        message: `${depart} → ${arrivee}${prixTtc ? ` · ${prixTtc.toFixed(0)} €` : ""}${devisNumero ? ` · Devis ${devisNumero}` : ""}`,
        link: devisId ? "/admin/devis" : "/admin/demandes",
        entityType: devisId ? "devis" : "demande",
        entityId: devisId ?? demandeId,
      }).catch(() => {});

      // Emails transactionnels : devis client + notif admin · non bloquants
      void Promise.allSettled([
        devisId
          ? sendTransactionalEmail({
              templateName: "devis-client",
              recipientEmail: profile.email,
              idempotencyKey: `devis-${devisId}`,
              templateData: {
                prenom: profile.prenom,
                nom: profile.nom,
                numero,
                depart,
                arrivee,
                prix: prixTtc,
                optionTrajet: tripType,
              },
            })
          : sendTransactionalEmail({
              templateName: "demande-confirmation",
              recipientEmail: profile.email,
              idempotencyKey: demandeId ? `demande-confirm-${demandeId}` : undefined,
              templateData: {
                prenom: profile.prenom,
                nom: profile.nom,
                depart,
                arrivee,
              },
            }),
        sendTransactionalEmail({
          templateName: devisId ? "devis-cree-admin" : "nouvelle-demande-admin",
          idempotencyKey: devisId
            ? `admin-devis-${devisId}`
            : (demandeId ? `admin-demande-${demandeId}` : undefined),
          templateData: {
            prenom: profile.prenom,
            nom: profile.nom,
            email: profile.email,
            telephone: profile.telephone,
            depart,
            arrivee,
            date: date || " · ",
            prix: prixTtc,
            numero,
            type: tripType,
          },
        }),
      ]).then(() => {
        if (devisId) void supabase.from("devis").update({ email_envoye: true }).eq("id", devisId);
      }).catch(() => {});


      setSuccess(true);
      setTimeout(() => navigate({ to: successRedirect }), 1600);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { v: "aller-simple", label: "Aller simple", desc: "Livraison à destination" },
            { v: "aller-retour", label: "Aller-retour", desc: "Livraison + restitution" },
            { v: "recharge", label: "Recharge uniquement", desc: "Recharge du véhicule, sans livraison" },
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

        {favorites.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-pro-text-soft mb-2 flex items-center gap-1">
              <Star size={11} className="text-amber-500" /> Adresses favorites
            </p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => applyFavorite(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    defaultAddressId === f.id
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-white border-pro-border text-pro-text hover:border-pro-accent/50"
                  }`}
                  title={f.address}
                >
                  {f.is_default && <Star size={11} className="fill-amber-500 text-amber-500" />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={lbl}>Adresse de départ</label>
            <PlacesInput
              value={depart}
              onChange={(v) => { setDepart(v); if (defaultAddressId) setDefaultAddressId(null); }}
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
      {tripType === "recharge" ? (
        <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
          <h2 className="text-sm font-semibold text-pro-text mb-2 flex items-center gap-1.5">
            <MapPinned size={14} className="text-pro-accent" /> Pas de livraison
          </h2>
          <p className="text-xs text-pro-text-soft">
            Recharge uniquement : le véhicule est rechargé puis restitué à la même adresse
            ({depart || "adresse d'enlèvement"}). Aucune adresse de livraison n'est nécessaire.
          </p>
        </section>
      ) : (
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
      )}


      {/* Véhicule */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-sm font-semibold text-pro-text flex items-center gap-1.5">
            <Car size={14} className="text-pro-accent" /> Véhicule
          </h2>
          {(() => {
            const applyExtracted = (f: ExtractedFields) => {
              if (f.immatriculation && !immat) setImmat(f.immatriculation.toUpperCase());
              if (f.vin && !vin) setVin(f.vin.toUpperCase());
              if (f.marque && !marque) setMarque(f.marque);
              if (f.modele && !modele) setModele(f.modele);
              if (f.energie && !energie) setEnergie(f.energie.toLowerCase());
              if (f.couleur && !couleur) setCouleur(f.couleur);
              if (f.kilometrage && !km) setKm(f.kilometrage.replace(/\D/g, ""));
              if (f.lieu_depart && !depart) setDepart(f.lieu_depart);
              if (f.lieu_arrivee && !arrivee) setArrivee(f.lieu_arrivee);
              if (f.client_nom && !contactArriveeNom) setContactArriveeNom(f.client_nom);
              if (f.client_telephone && !contactArriveeTel) setContactArriveeTel(f.client_telephone);
              toast.success("Champs pré-remplis depuis le document");
            };
            return (
              <div className="flex flex-wrap gap-2">
                <ScanToPrefill label="Scanner" multiPage onExtracted={applyExtracted} />
                <QrHandoffButton context="pro_demande" onExtracted={applyExtracted} />
              </div>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className={lbl}>Immatriculation</label>
            <div className="flex gap-2">
              <input
                className={`${inp} uppercase`}
                value={immat}
                onChange={(e) => setImmat(e.target.value.toUpperCase())}
                placeholder="AA-123-BB"
                maxLength={15}
              />
              <button
                type="button"
                onClick={handlePlateLookup}
                disabled={plateBusy || !immat}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pro-accent text-white text-xs font-medium hover:bg-pro-accent-hover disabled:opacity-50 whitespace-nowrap"
              >
                {plateBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Récupérer
              </button>
            </div>
            <p className="text-[11px] text-pro-text-soft mt-1">
              Récupération automatique des infos véhicule (marque, modèle, énergie). Modifiez si nécessaire.
            </p>
          </div>
          <div>
            <label className={lbl}>VIN / châssis</label>
            <input className={inp} value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17 caractères" maxLength={17} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Marque</label>
            <input className={inp} value={marque} onChange={(e) => setMarque(e.target.value)} placeholder="Peugeot" />
          </div>
          <div>
            <label className={lbl}>Modèle</label>
            <input className={inp} value={modele} onChange={(e) => setModele(e.target.value)} placeholder="3008" />
          </div>
          <div>
            <label className={lbl}>Énergie</label>
            <select className={inp} value={energie} onChange={(e) => setEnergie(e.target.value)}>
              <option value=""> · </option>
              {ENERGIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select className={inp} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Couleur</label>
            <input className={inp} value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="Optionnel" />
          </div>
          <div>
            <label className={lbl}>Kilométrage</label>
            <input type="number" className={inp} value={km} onChange={(e) => setKm(e.target.value)} placeholder="Optionnel" />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Notes véhicule</label>
            <input className={inp} value={vehNotes} onChange={(e) => setVehNotes(e.target.value)} placeholder="Particularités, état..." />
          </div>
        </div>
      </section>

      {/* Restitution (Aller-retour) */}
      {tripType === "aller-retour" && (
        <section className="bg-white rounded-xl border border-amber-200 ring-1 ring-amber-100 p-5 md:p-6">
          <h2 className="text-sm font-semibold text-pro-text mb-1 flex items-center gap-1.5">
            <MapPinned size={14} className="text-amber-600" /> Restitution (trajet retour)
          </h2>
          <p className="text-[12px] text-pro-text-soft mb-4">
            Par défaut, on reprend le véhicule à l'adresse de livraison et on le ramène au point de départ.
            Cochez les cases si l'adresse ou le véhicule diffèrent.
          </p>

          {/* Adresse de récupération retour */}
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-2 text-sm text-pro-text cursor-pointer">
              <input
                type="checkbox"
                checked={!sameRetourAddress}
                onChange={(e) => setSameRetourAddress(!e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pro-accent"
              />
              <span>
                Adresse de récupération retour <em className="text-pro-text-soft">différente</em> de la livraison
              </span>
            </label>
            {!sameRetourAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                <div>
                  <label className={lbl}>Adresse de récupération retour</label>
                  <PlacesInput value={departRetour} onChange={setDepartRetour} placeholder="Où récupérer le véhicule ?" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Adresse de retour (livraison finale)</label>
                  <PlacesInput value={arriveeRetour} onChange={setArriveeRetour} placeholder={`Par défaut : ${depart || "départ initial"}`} className={inp} />
                </div>
              </div>
            )}
          </div>

          {/* Véhicule retour */}
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-2 text-sm text-pro-text cursor-pointer">
              <input
                type="checkbox"
                checked={!sameRetourVehicle}
                onChange={(e) => setSameRetourVehicle(!e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pro-accent"
              />
              <span>
                Véhicule retour <em className="text-pro-text-soft">différent</em> du véhicule livré (2<sup>e</sup> plaque)
              </span>
            </label>
            {!sameRetourVehicle && (
              <div className="pl-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className={lbl}>Plaque retour</label>
                    <div className="flex gap-2">
                      <input
                        className={`${inp} uppercase`}
                        value={immatRetour}
                        onChange={(e) => setImmatRetour(e.target.value.toUpperCase())}
                        placeholder="AA-123-BB"
                        maxLength={15}
                      />
                      <button
                        type="button"
                        onClick={handlePlateRetourLookup}
                        disabled={plateRetourBusy || !immatRetour}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pro-accent text-white text-xs font-medium hover:bg-pro-accent-hover disabled:opacity-50 whitespace-nowrap"
                      >
                        {plateRetourBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Récupérer
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>VIN retour</label>
                    <input className={inp} value={vinRetour} onChange={(e) => setVinRetour(e.target.value.toUpperCase())} maxLength={17} placeholder="Optionnel" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Marque retour</label>
                    <input className={inp} value={marqueRetour} onChange={(e) => setMarqueRetour(e.target.value)} placeholder="Peugeot" />
                  </div>
                  <div>
                    <label className={lbl}>Modèle retour</label>
                    <input className={inp} value={modeleRetour} onChange={(e) => setModeleRetour(e.target.value)} placeholder="208" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date et heure retour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date retour *</label>
              <input type="date" className={inp} value={dateRetour} onChange={(e) => setDateRetour(e.target.value)} required min={date || new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure retour *</label>
              <input type="time" className={inp} value={heureRetour} onChange={(e) => setHeureRetour(e.target.value)} required />
            </div>
          </div>

        </section>
      )}

      {/* Options & planning */}
      <section className="bg-white rounded-xl border border-pro-border p-5 md:p-6">
        <h2 className="text-sm font-semibold text-pro-text mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-pro-accent" /> Options & planning
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {OPTIONS_DEF.map(({ key, label, desc, Icon }) => {
            const checked = !!options[key];
            const sup = pricing?.supplements?.[key];
            return (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? "border-pro-accent bg-pro-accent/5"
                    : "border-pro-border hover:border-pro-accent/40 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-pro-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-pro-text flex items-center gap-1.5">
                    <Icon size={13} className="text-pro-accent" /> {label}
                    {sup != null && sup > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        +{sup} €
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-pro-text-soft mt-0.5">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* PV de livraison digitalisé */}
        <div className="mb-4">
          <label className={lbl}>PV de livraison digitalisé</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([{ key: "aucun" as const, label: "Aucun" }, ...PV_PLATEFORMES.map((p) => ({ key: p.key, label: p.label }))]).map(({ key, label }) => {
              const def = pvDef(key);
              const checked = pvDigitalise === key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "border-pro-accent bg-pro-accent/5" : "border-pro-border hover:border-pro-accent/40 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="pv_digitalise"
                    checked={checked}
                    onChange={() => setPvDigitalise(key)}
                    className="h-4 w-4 accent-pro-accent"
                  />
                  {def ? <PvLogo def={def} size={24} /> : null}
                  <span className="text-sm font-medium text-pro-text">{label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-pro-text-soft mt-1.5">
            Model s'ouvre directement dans l'application mobile du convoyeur, Welcome Auto sur le site internet.
          </p>
        </div>

        <div className="mb-4">
          <label className={lbl}>Autre demande / commentaire</label>
          <input className={inp} value={autreNote} onChange={(e) => setAutreNote(e.target.value)} placeholder="Optionnel" />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date souhaitée *</label>
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure souhaitée *</label>
            <input type="time" className={inp} value={heure} onChange={(e) => setHeure(e.target.value)} required />
          </div>
        </div>

        <div className="mt-3">
          <label className={lbl}>Informations complémentaires</label>
          <textarea className={`${inp} min-h-[70px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Particularités, accès, conditions..." />
        </div>
      </section>

      {/* Récap prix */}
      <section className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-pro-border p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-pro-text">Récapitulatif & estimation</h2>
          {priceView && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
              priceView.mode === "exempt"
                ? "bg-slate-200 text-slate-800"
                : priceView.mode === "ht"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}>
              {priceView.mode === "exempt" ? "Non soumis TVA" : priceView.mode === "ht" ? "Affichage HT" : "Affichage TTC"}
            </span>
          )}
        </div>
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

      {/* CTA sticky mobile */}
      <div className="sticky bottom-0 -mx-3 sm:mx-0 sm:static z-10 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-t border-pro-border sm:border-0 px-3 sm:px-0 py-3 sm:py-0 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-xs text-pro-text-soft flex items-center gap-1.5">
          <Info size={12} /> Votre demande sera traitée sous 24h par notre équipe.
        </p>
        <button
          type="submit"
          disabled={submitting || !depart || !arrivee || !date || !heure || (tripType === "aller-retour" && (!dateRetour || !heureRetour))}
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
  view: {
    base: number;
    baseLabel: string;
    supLines: { key: OptionKey; label: string; amount: number }[];
    ttc: number;
    ht: number;
    tva: number;
    mode: DisplayMode;
  };
  note: string | null;
}) {
  const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  const isExempt = view.mode === "exempt";

  return (
    <div className="space-y-3 text-pro-text">
      <p className="text-xs text-pro-text-soft uppercase tracking-wide">{view.baseLabel}</p>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-pro-text-soft">Prestation de base</span>
          <span className="font-medium text-pro-text">{fmt(view.base)}</span>
        </div>
        {view.supLines.map((l) => (
          <div key={l.key} className="flex items-center justify-between text-emerald-700">
            <span>+ {l.label}</span>
            <span className="font-medium">{fmt(l.amount)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3 border-t border-pro-border pt-3">
        {isExempt ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Montant</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-[11px] text-pro-text-soft">{note || "TVA non applicable"}</p>
            </div>
          </>
        ) : view.mode === "ht" ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Total HT</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ht)}</p>
              <p className="text-[11px] text-pro-text-soft">TVA 20 % : {fmt(view.tva)} · TTC : {fmt(view.ttc)}</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Total TTC</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-[11px] text-pro-text-soft">HT : {fmt(view.ht)} · TVA 20 % : {fmt(view.tva)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
