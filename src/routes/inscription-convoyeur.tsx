import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyAdmin } from "@/lib/admin-notifications";
import {
  Loader2, Mail, Phone, User, MapPin, Calendar, FileText, Lock,
  Upload, BadgeCheck, ChevronLeft, ChevronRight, Check, ShieldCheck,
  Eye, EyeOff,
} from "lucide-react";
import { getRecaptchaToken } from "@/lib/recaptcha";
import { verifyRecaptcha } from "@/lib/recaptcha.functions";

export const Route = createFileRoute("/inscription-convoyeur")({
  component: InscriptionConvoyeur,
  head: () => ({
    meta: [
      { title: "Devenir convoyeur · Transports Ligneo" },
      { name: "description", content: "Rejoignez le réseau de convoyeurs Transports Ligneo. Inscription premium en 4 étapes, validation par notre équipe sous 24 h." },
    ],
  }),
});

const STEPS = [
  { id: 1, label: "Identité", icon: User },
  { id: 2, label: "Permis", icon: BadgeCheck },
  { id: 3, label: "Documents", icon: FileText },
  { id: 4, label: "Récap", icon: ShieldCheck },
] as const;

const inputClass =
  "w-full bg-navy/60 border border-primary/20 rounded px-3 py-2.5 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

function InscriptionConvoyeur() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    nom: "", prenom: "", email: "", telephone: "",
    password: "", ville: "", disponibilite: "", permis: "", message: "",
    permis_numero: "", annees_experience: "", type_convoyeur: "independant",
  });
  const [permisFile, setPermisFile] = useState<File | null>(null);
  const [cniFile, setCniFile] = useState<File | null>(null);
  const [ribFile, setRibFile] = useState<File | null>(null);
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [rcProFile, setRcProFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const makeFileHandler = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Chaque document ne doit pas dépasser 5 Mo.");
      return;
    }
    setter(file);
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
    }
    if (s === 3) {
      if (!permisFile) return "Ajoutez le permis de conduire.";
      if (!cniFile) return "Ajoutez la pièce d'identité.";
      if (!ribFile) return "Ajoutez le RIB.";
      if (!rcProFile) return "Ajoutez l'attestation RC Pro.";
      if (form.type_convoyeur === "independant" && !kbisFile) return "Ajoutez le KBIS pour un convoyeur indépendant.";
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
      let permisPhotoUrl: string | null = null;

      if (permisFile && authData.session) {
        try {
          const ext = permisFile.name.split(".").pop() || "jpg";
          const filePath = `${userId}/permis-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("convoyeur-permis").upload(filePath, permisFile, { upsert: true });
          if (!uploadError) permisPhotoUrl = filePath;
        } catch (e) { console.warn("[inscription] upload permis:", e); }
      }

      const { data: convoyeurRow } = authData.session
        ? await supabase.from("convoyeurs").update({
            ville: form.ville, disponibilite: form.disponibilite,
            permis: form.permis, message: form.message,
            permis_numero: form.permis_numero,
            annees_experience: parseInt(form.annees_experience, 10) || 0,
            permis_photo_url: permisPhotoUrl,
            type_convoyeur: form.type_convoyeur,
          }).eq("user_id", userId).select("id").maybeSingle()
        : { data: null };

      const convoyeurId = convoyeurRow?.id ?? null;
      if (convoyeurId && authData.session) {
        const uploadDoc = async (file: File | null, type: string) => {
          if (!file) return;
          try {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${userId}/${type}-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("convoyeur-documents").upload(path, file, { upsert: true });
            if (upErr) return;
            await supabase.from("documents_convoyeurs").insert({
              convoyeur_id: convoyeurId,
              type_document: type,
              nom_fichier: file.name,
              url_fichier: path,
              statut_validation: "en_attente",
            });
          } catch (e) { console.warn(`[inscription] doc ${type}:`, e); }
        };
        await Promise.all([
          uploadDoc(permisFile, "permis"),
          uploadDoc(cniFile, "identite"),
          uploadDoc(ribFile, "rib"),
          uploadDoc(kbisFile, "kbis"),
          uploadDoc(rcProFile, "assurance"),
        ]);
      }

      try {
        await sendTransactionalEmail({
          templateName: "inscription-convoyeur",
          recipientEmail: "contact@transportsligneo.fr",
          idempotencyKey: `inscription-${userId}`,
          templateData: {
            prenom: form.prenom, nom: form.nom, email: form.email,
            telephone: form.telephone, ville: form.ville,
          },
        });
      } catch (e) { console.warn("[inscription] email:", e); }

      void notifyAdmin({
        type: "driver_action",
        titre: "Nouvelle inscription convoyeur",
        message: `${form.prenom} ${form.nom} · ${form.email} · ${form.ville}`,
        link: "/admin/convoyeurs",
        entityType: "convoyeur",
        entityId: userId,
      });

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
      <div className="min-h-screen section-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5 card-premium p-8 rounded">
          <div className="gold-divider-short mx-auto" />
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Mail className="text-primary" size={28} />
          </div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Vérifiez votre email</h1>
          <p className="text-cream/70 text-sm leading-relaxed">
            Nous venons d'envoyer un lien de confirmation à <span className="text-primary font-medium">{submittedEmail}</span>.
            Cliquez dessus pour activer votre compte.
          </p>
          <div className="text-cream/40 text-xs space-y-1 pt-2 border-t border-primary/10">
            <p>Pas reçu ? Vérifiez vos spams.</p>
            <p>Notre équipe traite votre dossier sous 24-48 h ouvrées.</p>
          </div>
          <Link to="/login" className="inline-block text-primary text-sm hover:text-gold-light transition-colors uppercase tracking-[0.15em]">
            Aller à la connexion →
          </Link>
        </div>
      </div>
    );
  }

  const FileUpload = ({ label, file, onChange, hint }: { label: string; file: File | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; hint?: string }) => (
    <div>
      <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
        <Upload size={12} className="inline mr-1" /> {label}
      </label>
      <input
        type="file" accept="image/*,application/pdf" onChange={onChange}
        className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:uppercase file:tracking-wider file:cursor-pointer hover:file:bg-gold-light"
      />
      {file
        ? <p className="text-primary text-xs mt-1 flex items-center gap-1"><Check size={12}/> {file.name}</p>
        : hint && <p className="text-cream/30 text-[10px] mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen section-bg flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="gold-divider-short mb-4" />
          <h1 className="font-heading text-2xl md:text-3xl text-primary tracking-[0.1em] uppercase">Devenir convoyeur</h1>
          <p className="text-cream/50 text-sm mt-2">Un parcours d'inscription clair, rapide et sécurisé.</p>
        </div>

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
                    : "bg-navy/60 border-primary/20 text-cream/40"
                  }`}>
                    {done ? <Check size={16} /> : <Icon size={15} />}
                  </div>
                  <span className={`text-[10px] uppercase tracking-[0.15em] mt-2 ${active || done ? "text-primary" : "text-cream/40"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 -mt-6 ${step > s.id ? "bg-primary/60" : "bg-primary/10"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="card-premium p-6 md:p-8 rounded space-y-5">
          {/* STEP 1 : Identité */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <User size={12} className="inline mr-1" /> Prénom *
                  </label>
                  <input type="text" value={form.prenom} onChange={update("prenom")} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <User size={12} className="inline mr-1" /> Nom *
                  </label>
                  <input type="text" value={form.nom} onChange={update("nom")} className={inputClass} required />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  <Mail size={12} className="inline mr-1" /> Email *
                </label>
                <input type="email" value={form.email} onChange={update("email")} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <Phone size={12} className="inline mr-1" /> Téléphone *
                  </label>
                  <input type="tel" value={form.telephone} onChange={update("telephone")} className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <MapPin size={12} className="inline mr-1" /> Ville
                  </label>
                  <input type="text" value={form.ville} onChange={update("ville")} className={inputClass} placeholder="Ex: Tours" />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
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
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  <ShieldCheck size={12} className="inline mr-1" /> Statut professionnel
                </label>
                <div className={`${inputClass} flex items-center gap-2 opacity-90`}>Convoyeur indépendant</div>
                <p className="text-[10px] text-cream/50 mt-1">Ligneo travaille exclusivement avec des convoyeurs indépendants.</p>
              </div>
            </div>
          )}

          {/* STEP 2 : Permis */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <BadgeCheck size={12} className="inline mr-1" /> N° permis *
                  </label>
                  <input type="text" value={form.permis_numero} onChange={update("permis_numero")} className={inputClass} required placeholder="Ex: 1234567890123" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                    <Calendar size={12} className="inline mr-1" /> Années d'expérience *
                  </label>
                  <input type="number" min="0" max="70" value={form.annees_experience} onChange={update("annees_experience")} className={inputClass} required placeholder="Ex: 10" />
                </div>
              </div>
              <FileUpload label="Photo du permis (recto/verso)" file={permisFile} onChange={makeFileHandler(setPermisFile)} hint="Format JPG, PNG ou PDF · 5 Mo max." />
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
                  <FileText size={12} className="inline mr-1" /> Catégories additionnelles
                </label>
                <input type="text" value={form.permis} onChange={update("permis")} className={inputClass} placeholder="Ex: Permis B + EB" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">
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
              <p className="text-[11px] uppercase tracking-[0.15em] text-primary/80">Documents officiels</p>
              <FileUpload label="Pièce d'identité *" file={cniFile} onChange={makeFileHandler(setCniFile)} />
              <FileUpload label="RIB *" file={ribFile} onChange={makeFileHandler(setRibFile)} />
              <FileUpload label="Attestation RC Pro *" file={rcProFile} onChange={makeFileHandler(setRcProFile)} />
              {form.type_convoyeur === "independant" && (
                <FileUpload label="KBIS *" file={kbisFile} onChange={makeFileHandler(setKbisFile)} />
              )}
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Message (optionnel)</label>
                <textarea value={form.message} onChange={update("message")} rows={3} className={`${inputClass} resize-none`} placeholder="Présentez-vous brièvement..." />
              </div>
              <p className="text-cream/30 text-[10px]">Format JPG, PNG ou PDF · 5 Mo max par document.</p>
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
              </div>
              <div className="pt-4 border-t border-primary/10 space-y-1 text-xs text-cream/60">
                <p className="flex items-center gap-2">{permisFile ? <Check size={12} className="text-primary"/> : <span className="text-cream/30">·</span>} Photo permis {permisFile ? "✓" : "(non fournie)"}</p>
                <p className="flex items-center gap-2">{cniFile ? <Check size={12} className="text-primary"/> : <span className="text-cream/30">·</span>} Pièce d'identité {cniFile ? "✓" : "(non fournie)"}</p>
                <p className="flex items-center gap-2">{ribFile ? <Check size={12} className="text-primary"/> : <span className="text-cream/30">·</span>} RIB {ribFile ? "✓" : "(non fourni)"}</p>
                {form.type_convoyeur === "independant" && <p className="flex items-center gap-2">{kbisFile ? <Check size={12} className="text-primary"/> : <span className="text-cream/30">·</span>} KBIS {kbisFile ? "✓" : "(non fourni)"}</p>}
                <p className="flex items-center gap-2">{rcProFile ? <Check size={12} className="text-primary"/> : <span className="text-cream/30">·</span>} RC Pro {rcProFile ? "✓" : "(non fournie)"}</p>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded p-3 text-xs text-cream/70 leading-relaxed">
                <ShieldCheck size={14} className="inline text-primary mr-1" />
                Votre inscription sera validée par notre équipe sous 24-48 h ouvrées. Vous recevrez un email de confirmation.
              </div>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button" onClick={prev} disabled={step === 1 || loading}
              className="flex items-center gap-1 px-4 py-2 text-cream/60 hover:text-primary text-sm uppercase tracking-[0.1em] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> Retour
            </button>
            {step < 4 ? (
              <button
                type="button" onClick={next}
                className="flex items-center gap-1 px-6 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors"
              >
                Continuer <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button" onClick={handleSubmit} disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {loading ? "Envoi..." : "Valider mon inscription"}
              </button>
            )}
          </div>
        </div>

        <div className="text-center mt-6 space-y-3">
          <p className="text-[10px] leading-relaxed text-cream/40 px-2">
            Protégé par reCAPTCHA et soumis à la{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Politique de Confidentialité</a>
            {" "}et aux{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Termes d'Utilisation</a>
            {" "}de Google.
          </p>
          <Link to="/login" className="block text-primary text-xs hover:text-gold-light transition-colors">
            Déjà inscrit ? Se connecter
          </Link>
          <Link to="/" className="block text-cream/40 text-xs hover:text-primary transition-colors">
            ← Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy/40 border border-primary/10 rounded px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-cream/40">{label}</p>
      <p className="text-cream text-sm mt-0.5 truncate">{value || " · "}</p>
    </div>
  );
}
