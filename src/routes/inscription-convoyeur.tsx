import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { finalizeSignup, validateUploadFile, formatFileSize, MAX_UPLOAD_FILES } from "@/lib/signup-finalize";
import {
  Loader2, Mail, Phone, User, MapPin, Calendar, FileText, Lock,
  Upload, BadgeCheck, ChevronLeft, ChevronRight, Check, ShieldCheck,
  Eye, EyeOff, Image as ImageIcon,
} from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";
import { getFleetInvitation, acceptFleetInvitation } from "@/lib/fleet-drivers.functions";
import { DocScanButton } from "@/components/scanner/DocScanButton";
import { useRegistrationGate } from "@/hooks/useRegistrationGate";
import { RegistrationClosed } from "@/components/RegistrationClosed";

export const Route = createFileRoute("/inscription-convoyeur")({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search["invite"] === "string" ? (search["invite"] as string) : undefined,
  }),
  component: InscriptionConvoyeur,
  head: () => ({
    meta: [
      { title: "Devenir convoyeur · Transports Ligneo" },
      { name: "description", content: "Rejoignez le réseau de convoyeurs Transports Ligneo. Inscription en 4 étapes, validation par notre équipe sous 24 à 48 h." },
    ],
  }),
});

const STEPS = [
  { id: 1, label: "Identité", icon: User },
  { id: 2, label: "Permis", icon: BadgeCheck },
  { id: 3, label: "Documents", icon: FileText },
  { id: 4, label: "Récap", icon: ShieldCheck },
] as const;

const PREREQUIS = [
  "Permis B valide depuis 3 ans minimum",
  "21 ans minimum",
  "Casier judiciaire vierge",
  "Statut auto-entrepreneur ou société (créé ou en cours)",
  "Attestation RC Pro couvrant l'activité de convoyage",
];

const inputClass = "auth-input !pl-4";

function InscriptionConvoyeur() {
  const navigate = useNavigate();
  const { invite: inviteToken } = Route.useSearch();
  const [inviteOrg, setInviteOrg] = useState<string | null>(null);
  const [prerequisOk, setPrerequisOk] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", telephone: "",
    password: "", ville: "", disponibilite: "", permis: "", message: "",
    permis_numero: "", annees_experience: "", type_convoyeur: "independant",
    permis_date_obtention: "",
  });
  const [permisFile, setPermisFile] = useState<File | null>(null);
  const [permisVersoFile, setPermisVersoFile] = useState<File | null>(null);
  const [cniFile, setCniFile] = useState<File | null>(null);
  const [ribFile, setRibFile] = useState<File | null>(null);
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [rcProFile, setRcProFile] = useState<File | null>(null);
  const [photoProfilFile, setPhotoProfilFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const { loading: gateLoading, isOpen } = useRegistrationGate();

  // Pré-remplissage depuis une invitation flotte
  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      try {
        const inv = await getFleetInvitation({ data: { token: inviteToken } });
        if (!inv) return;
        setInviteOrg(inv.organizationName);
        setForm((f) => ({
          ...f,
          email: inv.email,
          prenom: inv.prenom || f.prenom,
          nom: inv.nom || f.nom,
          telephone: inv.telephone || f.telephone,
        }));
      } catch (e) {
        console.warn("[inscription-convoyeur] invitation introuvable", e);
      }
    })();
  }, [inviteToken]);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const selectedFiles = () => [permisFile, permisVersoFile, cniFile, ribFile, kbisFile, rcProFile, photoProfilFile].filter(Boolean).length;

  const makeFileHandler = (key: string, setter: (f: File | null) => void, current: File | null) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const invalid = validateUploadFile(file);
      if (invalid) {
        e.target.value = "";
        setter(null);
        setFileErrors((f) => ({ ...f, [key]: invalid }));
        return;
      }
      if (!current && selectedFiles() >= MAX_UPLOAD_FILES) {
        e.target.value = "";
        setFileErrors((f) => ({ ...f, [key]: `Maximum ${MAX_UPLOAD_FILES} documents.` }));
        return;
      }
      setter(file);
      setFileErrors((f) => { const n = { ...f }; delete n[key]; return n; });
      setError("");
    };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.prenom || !form.nom) return "Prénom et nom obligatoires.";
      if (!form.email) return "Email obligatoire.";
      if (!form.telephone) return "Téléphone obligatoire.";
      if (form.password.length < 8) return "Mot de passe : minimum 8 caractères.";
    }
    if (s === 2) {
      if (!form.permis_numero) return "Numéro de permis obligatoire.";
      if (!form.annees_experience) return "Années d'expérience obligatoires.";
      if (!form.permis_date_obtention) return "Date d'obtention du permis obligatoire.";
      // Vérification 3 ans mini
      const d = new Date(form.permis_date_obtention);
      if (!Number.isNaN(d.getTime())) {
        const now = new Date();
        const diffYears = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (diffYears < 3) return "Le permis doit être valide depuis 3 ans minimum.";
      }
      if (!permisFile) return "Ajoutez la photo du permis (recto).";
      if (!permisVersoFile) return "Ajoutez la photo du permis (verso).";
    }
    if (s === 3) {
      if (!cniFile) return "Ajoutez la pièce d'identité.";
      if (!ribFile) return "Ajoutez le RIB.";
      if (!rcProFile) return "Ajoutez l'attestation RC Pro.";
      if (form.type_convoyeur === "independant" && !kbisFile) return "Ajoutez le Kbis ou l'avis de situation SIRENE.";
      if (!photoProfilFile) return "Ajoutez une photo de profil.";
      if (Object.keys(fileErrors).length > 0) return "Corrigez les documents refusés avant de continuer.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(4, s + 1));
  };
  const prev = () => { setError(""); setStep((s) => Math.max(1, s - 1)); };

  const handleSubmit = async () => {
    setError("");
    for (let s = 1; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); setError(err); return; }
    }
    setLoading(true);
    try {
      try {
        const rcToken = await getRecaptchaToken("signup_convoyeur");
        if (rcToken) {
          const r = await verifyRecaptcha({ data: { token: rcToken, action: "signup_convoyeur", minScore: 0.3 } });
          if (!r.ok && !r.skipped) console.warn("[signup_convoyeur] recaptcha low score", r);
        }
      } catch (e) { console.warn("[signup_convoyeur] recaptcha error", e); }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/email-confirmation`,
          data: {
            role: "convoyeur",
            nom: form.nom, prenom: form.prenom, telephone: form.telephone,
            ville: form.ville, disponibilite: form.disponibilite,
            permis: form.permis, message: form.message,
            permis_numero: form.permis_numero,
            annees_experience: form.annees_experience,
            type_convoyeur: form.type_convoyeur,
            permis_date_obtention: form.permis_date_obtention,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message || "";
        if (msg.includes("already registered") || msg.includes("already been registered")) {
          setError("Cette adresse email est déjà utilisée.");
        } else if (msg.toLowerCase().includes("rate limit") || /after \d+ second/i.test(msg)) {
          setError("Trop de tentatives récentes. Patientez 1 minute et réessayez.");
        } else {
          setError(`Erreur d'inscription : ${msg}`);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Erreur inattendue : aucun utilisateur créé.");
        setLoading(false);
        return;
      }

      const userId = authData.user.id;

      // Les champs métier sont déjà posés par le trigger handle_new_user à partir
      // des métadonnées ; on ne complète ici que si une session existe.
      if (authData.session) {
        await supabase.from("convoyeurs").update({
          ville: form.ville, disponibilite: form.disponibilite,
          permis: form.permis, message: form.message,
          permis_numero: form.permis_numero,
          annees_experience: parseInt(form.annees_experience, 10) || 0,
          type_convoyeur: form.type_convoyeur,
        }).eq("user_id", userId);
      }

      // Upload des documents + emails + notification admin côté serveur :
      // sans confirmation d'email il n'y a pas de session, donc rien ne pouvait
      // passer par le navigateur (storage RLS + endpoint email authentifié).
      setUploadProgress(0);
      await finalizeSignup(userId, "convoyeur", {
        permis: permisFile,
        permis_verso: permisVersoFile,
        identite: cniFile,
        rib: ribFile,
        kbis: kbisFile,
        assurance: rcProFile,
        photo_profil: photoProfilFile,
      }, setUploadProgress);
      setUploadProgress(100);

      // Rattachement automatique à l'organisation Flotte invitante
      if (inviteToken) {
        try {
          await acceptFleetInvitation({ data: { token: inviteToken, email: form.email } });
        } catch (e) {
          console.warn("[inscription-convoyeur] rattachement flotte échoué", e);
        }
      }


      if (authData.session) {
        await supabase.auth.signOut();
        navigate({ to: "/attente-validation" });
      } else {
        setSubmittedEmail(form.email);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? `Erreur : ${err.message}` : "Une erreur inattendue est survenue.");
      setLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="auth-shell flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5 auth-card p-8">
          <div className="mx-auto h-14 w-14 rounded-full bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
            <Mail className="text-blue-300" size={28} />
          </div>
          <h1 className="auth-title text-xl md:text-2xl">Vérifiez votre email</h1>
          <p className="auth-subtle text-sm leading-relaxed">
            Nous venons d'envoyer un lien de confirmation à <span className="text-white font-medium">{submittedEmail}</span>.
            Cliquez dessus pour activer votre compte.
          </p>
          <div className="text-white/60 text-xs space-y-1 pt-2 border-t border-primary/10">
            <p>Pas reçu ? Vérifiez vos spams.</p>
            <p>Notre équipe traite votre dossier sous 24 à 48 h ouvrées, pas des semaines.</p>
          </div>
          <Link to="/login" className="auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
            Aller à la connexion →
          </Link>
        </div>
      </div>
    );
  }

  // === Écran Prérequis avant le formulaire ===
  if (!prerequisOk) {
    return (
      <div className="auth-shell flex items-center justify-center px-4 py-12">
        {/* Lien de connexion en haut à droite */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-8 py-5">
          <Link to="/" className="auth-link-lg text-[13px]">
            <ChevronLeft size={14} className="arrow-back rotate-180" />
            Retour au site
          </Link>
          <div className="flex items-center gap-2 md:gap-3 text-[13px]">
            <span className="text-white/55 hidden sm:inline">Déjà un compte ?</span>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 font-semibold text-white bg-white/[0.08] border border-blue-300/25 px-4 py-2 rounded-full hover:bg-white/[0.14] hover:border-blue-300/50 transition-all"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="max-w-2xl w-full pt-8">
          <div className="text-center mb-8">
            <div className="auth-eyebrow justify-center">Réseau Ligneo</div>
            <h1 className="auth-title text-2xl md:text-[34px]">Devenir <span className="auth-accent">convoyeur</span></h1>
            <p className="auth-subtle text-sm mt-2">Avant de commencer, vérifiez que vous remplissez ces conditions.</p>
          </div>
          <div className="auth-card p-6 md:p-8 space-y-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200">Conditions d'éligibilité</p>
            <ul className="space-y-3">
              {PREREQUIS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm text-white/85">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200">
                    <Check size={13} />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 text-xs text-white/60 leading-relaxed border-t border-white/10">
              Pas encore d'assurance RC Pro ou de statut ?{" "}
              <Link to="/contact" className="text-blue-200 underline hover:text-blue-100">Contactez-nous</Link>, on vous oriente.
            </div>
            <button
              type="button"
              onClick={() => setPrerequisOk(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white font-bold text-xs tracking-[0.14em] uppercase hover:brightness-110 transition-all shadow-[0_10px_25px_-10px_rgba(59,130,246,0.7)]"
            >
              Je remplis les conditions <ChevronRight size={14} />
            </button>
          </div>
          <div className="text-center mt-6">
            <p className="text-[13px] text-white/55">
              Vous avez déjà un compte convoyeur ?{" "}
              <Link to="/login" className="text-white font-bold underline hover:text-blue-200 transition-colors">
                Connectez-vous ici
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /** Applique un fichier issu du scanner natif avec les mêmes validations. */
  const applyScannedFile = (key: string, setter: (f: File | null) => void, current: File | null) =>
    (file: File) => {
      const invalid = validateUploadFile(file);
      if (invalid) { setFileErrors((f) => ({ ...f, [key]: invalid })); return; }
      if (!current && selectedFiles() >= MAX_UPLOAD_FILES) {
        setFileErrors((f) => ({ ...f, [key]: `Maximum ${MAX_UPLOAD_FILES} documents.` }));
        return;
      }
      setter(file);
      setFileErrors((f) => { const n = { ...f }; delete n[key]; return n; });
      setError("");
    };

  const FileUpload = ({ label, file, onChange, hint, errorKey, scanKey, setFile }: { label: string; file: File | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; hint?: string; errorKey?: string; scanKey?: string; setFile?: (f: File | null) => void }) => (
    <div>
      <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
        <Upload size={12} className="inline mr-1" /> {label}
      </label>
      <input
        type="file" accept="image/*,application/pdf" onChange={onChange}
        className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white/90 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-blue-400 file:text-white file:text-xs file:uppercase file:tracking-wider file:cursor-pointer hover:file:brightness-110 transition-colors focus:border-blue-300/60 focus:outline-none"
      />
      {scanKey && setFile && (
        <div className="mt-2">
          <DocScanButton
            label="Scanner ce document"
            maxPages={4}
            mergeToPdf
            filenameBase={scanKey}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 border border-blue-300/30 text-white"
            onFiles={(files) => { if (files[0]) applyScannedFile(scanKey, setFile, file)(files[0]); }}
          />
        </div>
      )}
      {errorKey && fileErrors[errorKey]
        ? <p className="text-red-300 text-[11px] mt-1">{fileErrors[errorKey]}</p>
        : file
          ? <p className="text-primary text-xs mt-1 flex items-center gap-1"><Check size={12}/> {file.name} · {formatFileSize(file.size)}</p>
          : hint && <p className="text-white/40 text-[10px] mt-1">{hint}</p>}
    </div>
  );


  return (
    <div className="auth-shell flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="auth-eyebrow justify-center">Réseau Ligneo</div>
          <h1 className="auth-title text-2xl md:text-[34px]">Devenir <span className="auth-accent">convoyeur</span></h1>
          <p className="auth-subtle text-sm mt-2">Un parcours d'inscription clair, rapide et sécurisé · validation sous 24 à 48 h.</p>
        </div>

        {inviteOrg && (
          <div className="mb-6 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-center text-sm text-white/90">
            Vous avez été invité(e) par <strong>{inviteOrg}</strong> — votre compte sera automatiquement rattaché à cette flotte après validation.
          </div>
        )}



        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 max-w-lg mx-auto">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                    done ? "bg-primary/20 border-primary text-primary"
                    : active ? "bg-primary text-primary-foreground border-primary shadow-[0_0_18px_rgba(212,175,55,0.35)]"
                    : "bg-navy/60 border-primary/20 text-white/60"
                  }`}>
                    {done ? <Check size={16} /> : <Icon size={15} />}
                  </div>
                  <span className={`text-[10px] uppercase tracking-[0.15em] mt-2 ${active || done ? "text-primary" : "text-white/60"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 -mt-6 ${step > s.id ? "bg-blue-300/60" : "bg-white/10"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="auth-card p-6 md:p-7 space-y-5">
          {/* STEP 1 : Identité */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <User size={12} className="inline mr-1" /> Prénom *
                  </label>
                  <input type="text" value={form.prenom} onChange={update("prenom")} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <User size={12} className="inline mr-1" /> Nom *
                  </label>
                  <input type="text" value={form.nom} onChange={update("nom")} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <Mail size={12} className="inline mr-1" /> Email *
                </label>
                <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <Phone size={12} className="inline mr-1" /> Téléphone *
                  </label>
                  <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <MapPin size={12} className="inline mr-1" /> Ville
                  </label>
                  <input type="text" value={form.ville} onChange={update("ville")} className={inputClass} placeholder="Ex: Tours" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <Lock size={12} className="inline mr-1" /> Mot de passe *
                </label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} value={form.password} onChange={update("password")} className={`${inputClass} pr-11`} required minLength={8} placeholder="Minimum 8 caractères" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/50 hover:text-cream transition-colors">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <ShieldCheck size={12} className="inline mr-1" /> Statut professionnel
                </label>
                <div className={`${inputClass} flex items-center gap-2 opacity-90 !py-3`}>Convoyeur indépendant</div>
                <p className="text-[10px] text-white/50 mt-1">Ligneo travaille exclusivement avec des convoyeurs indépendants.</p>
              </div>
            </div>
          )}

          {/* STEP 2 : Permis */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <BadgeCheck size={12} className="inline mr-1" /> N° permis *
                  </label>
                  <input type="text" value={form.permis_numero} onChange={update("permis_numero")} className={inputClass} required placeholder="Ex: 1234567890123" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                    <Calendar size={12} className="inline mr-1" /> Années d'expérience *
                  </label>
                  <input type="number" min="0" max="70" value={form.annees_experience} onChange={update("annees_experience")} className={inputClass} required placeholder="Ex: 10" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <Calendar size={12} className="inline mr-1" /> Date d'obtention du permis *
                </label>
                <input
                  type="date"
                  value={form.permis_date_obtention}
                  onChange={update("permis_date_obtention")}
                  className={inputClass}
                  required
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-[10px] text-white/50 mt-1">Permis B requis depuis 3 ans minimum.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileUpload label="Permis (recto) *" file={permisFile} errorKey="permis" scanKey="permis" setFile={setPermisFile} onChange={makeFileHandler("permis", setPermisFile, permisFile)} hint="JPG, PNG ou PDF · 5 Mo max." />
                <FileUpload label="Permis (verso) *" file={permisVersoFile} errorKey="permis_verso" scanKey="permis_verso" setFile={setPermisVersoFile} onChange={makeFileHandler("permis_verso", setPermisVersoFile, permisVersoFile)} hint="JPG, PNG ou PDF · 5 Mo max." />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <FileText size={12} className="inline mr-1" /> Catégories additionnelles
                </label>
                <input type="text" value={form.permis} onChange={update("permis")} className={inputClass} placeholder="Ex: Permis B + EB" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <Calendar size={12} className="inline mr-1" /> Disponibilité
                </label>
                <select value={form.disponibilite} onChange={update("disponibilite")} className={inputClass}>
                  <option value="">Non précisé</option>
                  <option value="temps_plein">Temps plein</option>
                  <option value="temps_partiel">Temps partiel</option>
                  <option value="weekend">Weekends</option>
                  <option value="ponctuel">Ponctuel</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3 : Documents */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-[0.15em] text-blue-200">Documents officiels</p>
              <FileUpload label="Pièce d'identité (CNI ou passeport) *" file={cniFile} errorKey="identite" scanKey="identite" setFile={setCniFile} onChange={makeFileHandler("identite", setCniFile, cniFile)} />
              {form.type_convoyeur === "independant" && (
                <FileUpload label="Kbis ou avis de situation SIRENE (moins de 3 mois) *" file={kbisFile} errorKey="kbis" scanKey="kbis" setFile={setKbisFile} onChange={makeFileHandler("kbis", setKbisFile, kbisFile)} />
              )}
              <FileUpload label="RIB *" file={ribFile} errorKey="rib" scanKey="rib" setFile={setRibFile} onChange={makeFileHandler("rib", setRibFile, ribFile)} />
              <div>
                <FileUpload label="Attestation RC Pro *" file={rcProFile} errorKey="assurance" scanKey="assurance" setFile={setRcProFile} onChange={makeFileHandler("assurance", setRcProFile, rcProFile)} />
                <p className="text-[11px] text-white/55 mt-1.5">
                  Pas encore d'assurance RC Pro ?{" "}
                  <Link to="/contact" className="text-blue-200 underline hover:text-blue-100">Contactez-nous</Link>, on vous accompagne.
                </p>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">
                  <ImageIcon size={12} className="inline mr-1" /> Photo de profil *
                </label>
                <input
                  type="file" accept="image/*" onChange={makeFileHandler("photo_profil", setPhotoProfilFile, photoProfilFile)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-white/90 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-500 file:to-blue-400 file:text-white file:text-xs file:uppercase file:tracking-wider file:cursor-pointer hover:file:brightness-110 transition-colors focus:border-blue-300/60 focus:outline-none"
                />
                {photoProfilFile
                  ? <p className="text-primary text-xs mt-1 flex items-center gap-1"><Check size={12}/> {photoProfilFile.name} · {formatFileSize(photoProfilFile.size)}</p>
                  : <p className="text-white/40 text-[10px] mt-1">Portrait clair, format carré recommandé.</p>}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Message (optionnel)</label>
                <textarea value={form.message} onChange={update("message")} rows={3} className={`${inputClass} resize-none`} placeholder="Présentez-vous brièvement..." />
              </div>
              <p className="text-white/40 text-[10px]">Format JPG, PNG ou PDF · 5 Mo max par document.</p>
            </div>
          )}

          {/* STEP 4 : Récap */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <RecapRow label="Prénom" value={form.prenom} />
                <RecapRow label="Nom" value={form.nom} />
                <RecapRow label="Email" value={form.email} />
                <RecapRow label="Téléphone" value={form.telephone} />
                <RecapRow label="Ville" value={form.ville || " · "} />
                <RecapRow label="Statut" value="Indépendant" />
                <RecapRow label="Disponibilité" value={form.disponibilite || " · "} />
                <RecapRow label="N° permis" value={form.permis_numero} />
                <RecapRow label="Années d'expérience" value={form.annees_experience} />
                <RecapRow label="Date d'obtention permis" value={form.permis_date_obtention || " · "} />
              </div>
              <div className="pt-4 border-t border-white/10 space-y-1.5 text-xs">
                <DocRow label="Permis (recto)" ok={!!permisFile} />
                <DocRow label="Permis (verso)" ok={!!permisVersoFile} />
                <DocRow label="Pièce d'identité" ok={!!cniFile} />
                {form.type_convoyeur === "independant" && <DocRow label="Kbis / SIRENE" ok={!!kbisFile} />}
                <DocRow label="RIB" ok={!!ribFile} />
                <DocRow label="RC Pro" ok={!!rcProFile} />
                <DocRow label="Photo de profil" ok={!!photoProfilFile} />
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded p-3 text-xs text-cream/70 leading-relaxed">
                <ShieldCheck size={14} className="inline text-blue-300 mr-1" />
                Votre dossier est étudié par notre équipe sous 24 à 48 h ouvrées, pas des semaines. Après validation, vous recevrez le contrat de partenariat à signer électroniquement.
              </div>
            </div>
          )}

          {uploadProgress !== null && (
            <div className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-blue-100 mb-2">
                <span>{uploadProgress < 100 ? "Envoi des documents…" : "Documents transmis"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-300 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {error && <div className="auth-alert auth-alert-error">{error}</div>}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button" onClick={prev} disabled={step === 1 || loading}
              className="flex items-center gap-1 px-4 py-2 text-white/60 hover:text-primary text-sm uppercase tracking-[0.1em] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Retour
            </button>
            {step < 4 ? (
              <button
                type="button" onClick={next}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white font-bold text-xs tracking-[0.14em] uppercase hover:brightness-110 transition-all shadow-[0_10px_25px_-10px_rgba(59,130,246,0.7)]"
              >
                Continuer <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button" onClick={handleSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 text-white font-bold text-xs tracking-[0.14em] uppercase hover:brightness-110 transition-all shadow-[0_10px_25px_-10px_rgba(59,130,246,0.7)] disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {loading ? "Envoi..." : "Valider mon inscription"}
              </button>
            )}
          </div>
        </div>

        <div className="text-center mt-6 space-y-3">
          <p className="text-[10px] leading-relaxed text-white/45 px-2">
            Protégé par reCAPTCHA et soumis à la{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">Politique de Confidentialité</a>
            {" "}et aux{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">Termes d'Utilisation</a>
            {" "}de Google.
          </p>
          <Link to="/login" className="block auth-link uppercase tracking-[0.14em] text-[11px] font-semibold">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/" className="block text-white/60 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">{label}</p>
      <p className="text-white text-sm mt-0.5 truncate">{value || " · "}</p>
    </div>
  );
}

function DocRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-1.5">
      <span className="text-white/80">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-blue-200">
          <Check size={12} /> fourni
        </span>
      ) : (
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">manquant</span>
      )}
    </div>
  );
}
