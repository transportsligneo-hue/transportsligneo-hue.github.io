import { useEffect, useRef, useState } from "react";
import { X, Mail, UserPlus, Loader2, Upload, CheckCircle2 } from "lucide-react";
import { createFleetDriver } from "@/lib/fleet-drivers.functions";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";

export interface OrgSiteOption {
  id: string;
  nom: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  sites: OrgSiteOption[];
  onCreated: () => void;
}

const inputCls =
  "w-full px-3 py-2 bg-white border border-pro-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-pro-muted mb-1.5";

export default function AddDriverModal({ open, onClose, sites, onCreated }: Props) {
  const [method, setMethod] = useState<"invitation" | "direct">("invitation");
  const [form, setForm] = useState({
    email: "", prenom: "", nom: "", telephone: "",
    permisNumero: "", permisDateObtention: "", siteId: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMethod("invitation");
      setForm({ email: "", prenom: "", nom: "", telephone: "", permisNumero: "", permisDateObtention: "", siteId: "" });
      setFile(null); setError(""); setDone(false); setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Lecture du fichier impossible"));
      r.readAsDataURL(f);
    });

  const submit = async () => {
    setError("");
    if (!form.prenom.trim() || !form.nom.trim()) return setError("Prénom et nom obligatoires.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Email invalide.");
    if (method === "direct") {
      if (!form.telephone.trim()) return setError("Téléphone obligatoire.");
      if (!form.permisNumero.trim()) return setError("Numéro de permis obligatoire.");
      if (!form.permisDateObtention) return setError("Date d'obtention du permis obligatoire.");
      if (!file) return setError("Ajoutez la copie du permis (PDF, JPG ou PNG).");
      if (file.size > 6 * 1024 * 1024) return setError("Fichier trop lourd (6 Mo maximum).");
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        method,
        email: form.email.trim(),
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        siteId: form.siteId || null,
        permisNumero: form.permisNumero.trim(),
        permisDateObtention: form.permisDateObtention,
      };
      if (method === "direct" && file) {
        payload.permisFile = await toDataUrl(file);
        payload.permisFileName = file.name;
      }
      const res = await createFleetDriver({ data: payload as never });

      if (method === "invitation") {
        const url = `${window.location.origin}/inscription-convoyeur?invite=${res.token}`;
        try {
          await sendTransactionalEmail({
            templateName: "invite",
            recipientEmail: form.email.trim(),
            idempotencyKey: `fleet-driver-invite-${res.id}`,
            templateData: {
              confirmationUrl: url,
              organizationName: res.organizationName,
              prenom: form.prenom.trim(),
            },
          });
        } catch (e) {
          console.error("[fleet-driver] envoi invitation", e);
          toast.warning("Conducteur enregistré, mais l'email d'invitation n'a pas pu partir.");
        }
      }

      setDone(true);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-pro-border shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-250">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-pro-border sticky top-0 bg-white rounded-t-2xl">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-violet-600">Flotte partenaire</p>
            <h2 className="text-lg font-semibold text-pro-text">Ajouter un conducteur</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-pro-muted" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto text-emerald-600" size={38} />
            <p className="font-semibold text-pro-text">
              {method === "invitation" ? "Invitation envoyée" : "Conducteur enregistré"}
            </p>
            <p className="text-sm text-pro-text-soft">
              {method === "invitation"
                ? "Le conducteur va recevoir un email pour compléter son profil (permis, documents, RC Pro). Il sera rattaché à votre flotte dès validation."
                : "Le conducteur apparaît avec le statut « À valider ». L'équipe Ligneo vérifie ses documents avant activation."}
            </p>
            <button onClick={onClose} className="fleet-btn-violet mt-2">Fermer</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Bascule méthode */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              {([
                { k: "invitation", label: "Inviter par email", icon: Mail, hint: "Recommandé" },
                { k: "direct", label: "Ajouter directement", icon: UserPlus, hint: "" },
              ] as const).map(({ k, label, icon: Icon, hint }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setMethod(k); setError(""); }}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-all ${
                    method === k ? "bg-white text-violet-700 shadow-sm border border-violet-200" : "text-pro-muted"
                  }`}
                >
                  <Icon size={14} />
                  <span className="truncate">{label}</span>
                  {hint && method === k && (
                    <span className="hidden sm:inline text-[9.5px] uppercase tracking-wide text-violet-500">{hint}</span>
                  )}
                </button>
              ))}
            </div>

            <p className="text-xs text-pro-text-soft leading-relaxed">
              {method === "invitation"
                ? "Le conducteur complète lui-même son dossier convoyeur (permis, pièce d'identité, RC Pro) via le parcours d'inscription Ligneo, puis il est automatiquement rattaché à votre flotte."
                : "Vous saisissez les informations à sa place. Le conducteur reste « À valider » tant que l'équipe Ligneo n'a pas vérifié ses documents."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Prénom *</label>
                <input className={inputCls} value={form.prenom} onChange={set("prenom")} />
              </div>
              <div>
                <label className={labelCls}>Nom *</label>
                <input className={inputCls} value={form.nom} onChange={set("nom")} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" className={inputCls} value={form.email} onChange={set("email")} placeholder="conducteur@exemple.fr" />
            </div>

            {method === "direct" && (
              <>
                <div>
                  <label className={labelCls}>Téléphone *</label>
                  <input className={inputCls} value={form.telephone} onChange={set("telephone")} placeholder="06 12 34 56 78" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>N° de permis *</label>
                    <input className={inputCls} value={form.permisNumero} onChange={set("permisNumero")} />
                  </div>
                  <div>
                    <label className={labelCls}>Date d'obtention *</label>
                    <input type="date" className={inputCls} value={form.permisDateObtention} onChange={set("permisDateObtention")} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Copie du permis * (PDF, JPG, PNG)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-pro-border rounded-lg text-sm text-pro-text-soft hover:border-violet-400 hover:text-violet-700 transition-colors"
                  >
                    <Upload size={15} />
                    <span className="truncate">{file ? file.name : "Sélectionner un fichier"}</span>
                  </button>
                </div>
              </>
            )}

            {sites.length > 0 && (
              <div>
                <label className={labelCls}>Site de rattachement</label>
                <select className={inputCls} value={form.siteId} onChange={set("siteId")}>
                  <option value="">— Aucun —</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-pro-muted hover:text-pro-text">
                Annuler
              </button>
              <button onClick={submit} disabled={loading} className="fleet-btn-violet disabled:opacity-60">
                {loading ? <Loader2 size={15} className="animate-spin" /> : method === "invitation" ? <Mail size={15} /> : <UserPlus size={15} />}
                {method === "invitation" ? "Envoyer l'invitation" : "Ajouter le conducteur"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
