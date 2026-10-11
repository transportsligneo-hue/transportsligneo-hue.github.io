import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Upload, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { type CatalogEntry, catalogPhotoUrl, loadCatalog, matchCatalog } from "@/lib/vehicle-catalog";
import { supabase } from "@/integrations/supabase/client";
import { lookupPlate } from "@/lib/plate.functions";
import { PlateInput } from "@/components/plate/PlateInput";
import { PlateBadge } from "@/components/plate/PlateBadge";
import { HelpTip } from "@/components/ui/HelpTip";
import { logoLigneoSeasonal } from "@/lib/seasonal-logo";
import { plateKey, plateValidity } from "@/lib/plate-format";
import { annualCost, daysUntil, dueTone, firstTechnicalControl, nextRevision } from "@/lib/vehicle-schedule";
import { confirmToast } from "@/lib/confirm-toast";
import { GuidedTour, type TourStep } from "@/components/onboarding/GuidedTour";
import imgCitadine from "@/assets/vehicule-citadine.png.asset.json";
import imgBerline from "@/assets/vehicule-berline.png.asset.json";
import imgSuv from "@/assets/vehicule-suv.png.asset.json";
import imgUtilitaire from "@/assets/vehicule-utilitaire.png.asset.json";
import imgFourgon from "@/assets/vehicule-fourgon.png.asset.json";

const CAT_IMG: Record<string, string> = { citadine: imgCitadine.url, berline: imgBerline.url, suv: imgSuv.url, utilitaire: imgUtilitaire.url, fourgon: imgFourgon.url };

const AVD_TOUR: TourStep[] = [
  { target: ".avd-pills", title: "Sept étapes, dans l'ordre", body: "Identification, caractéristiques, échéances, entretien, contrat, affectation et automatismes. Cliquez sur une pastille pour aller directement à une étape, rien n'est perdu." },
  { target: '[data-avd-sec="0"]', title: "Commencez par la plaque", body: "Tapez la plaque dans le cadre, les tirets se placent tout seuls. La loupe retrouve la marque, le modèle et la motorisation." },
  { target: ".avd-vcard", title: "Aperçu en direct", body: "La fiche se construit pendant la saisie. L'image suit la catégorie choisie : citadine, berline, SUV, utilitaire ou fourgon. Une vraie photo ajoutée remplace l'image." },
  { target: ".avd-ring", title: "Dossier complet", body: "Ce cercle montre ce qui reste à remplir. Plus le dossier est complet, plus les rappels sont précis." },
  { target: ".avd-timeline", title: "Prochaines échéances", body: "Contrôle technique, assurance, révision : les dates se calculent toutes seules et passent au rouge une fois dépassées." },
  { target: ".avd-autocount", title: "Automatismes", body: "Rappels, relevé du kilométrage après chaque mission, proposition de convoyage au garage : tout se règle à la dernière étape." },
  { target: ".avd-foot", title: "Avancez ou enregistrez", body: "Passez d'une étape à l'autre avec les boutons du bas. Enregistrer maintenant garde le véhicule tout de suite, vous compléterez plus tard." },
];

type Site = { id: string; nom: string };
type Driver = { id: string; label: string };

type Auto = {
  ct: { on: boolean; days: number[] };
  assurance: { on: boolean; days: number[] };
  revision: { on: boolean; opts: string[] };
  convoyage: { on: boolean; cible: string };
  kmAuto: { on: boolean };
  immobiliser: { on: boolean };
  calendrier: { on: boolean };
  canaux: string[];
  destinataires: string[];
};

const AUTO_DEFAULT: Auto = {
  ct: { on: true, days: [60, 30, 7] },
  assurance: { on: true, days: [30, 7] },
  revision: { on: true, opts: ["2000km", "30j"] },
  convoyage: { on: false, cible: "garage" },
  kmAuto: { on: true },
  immobiliser: { on: false },
  calendrier: { on: true },
  canaux: ["email", "notification"],
  destinataires: ["gestionnaire"],
};

const EMPTY = {
  immatriculation: "", vin: "", marque: "", modele: "", version: "", energie: "", categorie: "", couleur: "",
  kilometrage: "", statut: "actif", mise_en_circulation: "", ct: "", assurance: "", assureur: "", contrat: "",
  derniere_revision_le: "", derniere_revision_km: "", intervalle_km: 15000, intervalle_mois: 12, km_mois: "1500", pneus: "",
  mode: "", fin_contrat: "", loyer: "", km_contrat: "", assurance_an: "", entretien_an: "",
  site_id: "", conducteur_id: "", notes: "",
};
type Form = typeof EMPTY;

const SECTIONS = ["Identification", "Caractéristiques", "Échéances", "Entretien", "Contrat et coûts", "Affectation", "Automatismes"];
const ENERGIES = [["essence", "Essence"], ["diesel", "Diesel"], ["hybride", "Hybride"], ["electrique", "Électrique"], ["gpl", "GPL"]];
const CATS = [["citadine", "Citadine"], ["berline", "Berline"], ["suv", "SUV"], ["utilitaire", "Utilitaire"], ["fourgon", "Fourgon"]];
const COLORS = [["noir", "#111"], ["blanc", "#f4f4f4"], ["gris", "#8a8f9c"], ["bleu", "#2f5fff"], ["rouge", "#e0344b"], ["vert", "#1f9d6a"]];
const STATUTS = [["actif", "Disponible", "#5de0ff"], ["en_mission", "En mission", "#2f5fff"], ["indispo", "Immobilisé", "#ff5fd2"], ["archive", "Archivé", "#8a8f9c"]];
const MODES = [["achat", "Achat"], ["lld", "Location longue durée"], ["loa", "Location avec option d’achat"], ["lcd", "Location courte durée"]];
const TONE_LABEL: Record<string, string> = { empty: "À renseigner" };

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR");

function Chips<T extends string | number>({ items, value, onChange, multi }: { items: [T, string, string?][]; value: T | T[]; onChange: (v: any) => void; multi?: boolean }) {
  return (
    <div className="avd-chips">
      {items.map(([v, l, dot]) => {
        const on = multi ? (value as T[]).includes(v) : value === v;
        return (
          <button key={String(v)} type="button" aria-pressed={on} className={`avd-chip ${on ? "on" : ""}`}
            onClick={() => onChange(multi ? (on ? (value as T[]).filter((x) => x !== v) : [...(value as T[]), v]) : on ? "" : v)}>
            {dot && <i style={{ background: dot }} />}{l}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, help, children, req }: { label: string; help?: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div className="avd-field">
      <div className="avd-lbl"><span>{label}{req && " *"}</span>{help && <HelpTip title={label} text={help} tone="violet" />}</div>
      {children}
    </div>
  );
}

function DueBadge({ date }: { date: string }) {
  const d = daysUntil(date);
  const t = dueTone(d);
  const label = t === "empty" ? TONE_LABEL.empty : t === "late" ? "Expiré" : `Dans ${d} jours`;
  return <span className={`avd-due avd-due-${t}`}>{label}</span>;
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`avd-switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}

export function AddVehicleDialog({ organizationId, onClose, onSaved, onOpenExisting }: {
  organizationId: string; onClose: () => void; onSaved: () => void; onOpenExisting?: (vehicleId: string) => void;
}) {
  const lookup = useServerFn(lookupPlate);
  const [f, setF] = useState<Form>(EMPTY);
  const [auto, setAuto] = useState<Auto>(AUTO_DEFAULT);
  const [sites, setSites] = useState<Site[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [existing, setExisting] = useState<{ id: string; immatriculation: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState<{ cg?: File; ct?: File; assurance?: File; photos: File[] }>({ photos: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    void (async () => {
      const [{ data: s }, { data: c }, { data: v }] = await Promise.all([
        supabase.from("organization_sites").select("id, nom").eq("organization_id", organizationId),
        supabase.from("conducteurs_flotte").select("id, prenom, nom").eq("organization_id", organizationId),
        supabase.from("vehicles").select("id, immatriculation").eq("organization_id", organizationId),
      ]);
      setSites(((s ?? []) as { id: string; nom: string | null }[]).map((x) => ({ id: x.id, nom: x.nom || "Site" })));
      setDrivers(((c ?? []) as { id: string; prenom: string | null; nom: string | null }[]).map((x) => ({ id: x.id, label: [x.prenom, x.nom].filter(Boolean).join(" ") || "Conducteur" })));
      setExisting((v ?? []) as { id: string; immatriculation: string | null }[]);
    })();
  }, [organizationId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") void requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Photo officielle du modèle depuis le catalogue admin
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => { void loadCatalog().then(setCatalog); }, []);
  useEffect(() => {
    const m = matchCatalog(catalog, f.marque, f.modele);
    if (!m?.photo_path) { setPhotoUrl(null); return; }
    let live = true;
    void catalogPhotoUrl(m.photo_path).then((u) => { if (live) setPhotoUrl(u); });
    return () => { live = false; };
  }, [catalog, f.marque, f.modele]);

  // Parcours étape par étape : une seule section visible à la fois
  const goto = (i: number) => {
    setActive(Math.max(0, Math.min(SECTIONS.length - 1, i)));
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const duplicate = useMemo(() => {
    const k = plateKey(f.immatriculation);
    return k.length >= 4 ? existing.find((v) => plateKey(v.immatriculation) === k) ?? null : null;
  }, [f.immatriculation, existing]);

  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const requestClose = async () => {
    if (dirty && !(await confirmToast("Quitter sans enregistrer ?"))) return;
    onClose();
  };

  const search = async () => {
    setBusy(true); setFound(false);
    try {
      const r = await lookup({ data: { plate: f.immatriculation.trim() } });
      if (!r.ok || !r.data) { toast.error(r.error || "Aucune donnée trouvée, remplissez manuellement"); return; }
      const d = r.data;
      const mec = d.annee && /^\d{4}-\d{2}-\d{2}/.test(d.annee) ? d.annee.slice(0, 10) : d.annee && /^\d{2}\/\d{2}\/\d{4}$/.test(d.annee) ? d.annee.split("/").reverse().join("-") : "";
      setF((x) => ({
        ...x,
        marque: x.marque || d.marque || "", modele: x.modele || d.modele || "", vin: x.vin || (d.vin || "").toUpperCase(),
        version: x.version || d.finition || "", energie: x.energie || d.energie || "",
        categorie: x.categorie || (CATS.some(([c]) => c === d.categorie) ? d.categorie! : ""),
        mise_en_circulation: x.mise_en_circulation || mec,
      }));
      setFound(true);
    } catch { toast.error("Service indisponible, remplissez manuellement"); }
    finally { setBusy(false); }
  };

  const rev = nextRevision({
    lastDate: f.derniere_revision_le || null, lastKm: num(f.derniere_revision_km), currentKm: num(f.kilometrage),
    intervalKm: f.intervalle_km, intervalMonths: f.intervalle_mois, kmPerMonth: num(f.km_mois) ?? 1500,
  });
  const hasRevBase = !!(f.kilometrage || f.derniere_revision_km);
  const cost = annualCost(num(f.loyer), num(f.assurance_an), num(f.entretien_an));
  const ctSuggestion = f.mise_en_circulation && !f.ct ? firstTechnicalControl(f.mise_en_circulation) : null;

  const done = [
    plateValidity(f.immatriculation) !== "empty" && plateValidity(f.immatriculation) !== "invalid",
    !!(f.marque && f.modele), !!(f.ct || f.assurance || f.mise_en_circulation), !!f.derniere_revision_le,
    !!f.mode, !!f.site_id, auto.ct.on || auto.assurance.on || auto.revision.on,
  ];
  const checklist = [f.immatriculation, f.marque, f.modele, f.energie, f.kilometrage, f.mise_en_circulation, f.ct, f.assurance, f.derniere_revision_le, f.site_id];
  const pct = Math.round((checklist.filter(Boolean).length / checklist.length) * 100);
  const autoCount = [auto.ct.on, auto.assurance.on, auto.revision.on, auto.convoyage.on, auto.kmAuto.on, auto.immobiliser.on, auto.calendrier.on].filter(Boolean).length;
  const timeline = [
    f.ct && { k: "Contrôle technique", d: f.ct },
    f.assurance && { k: "Assurance", d: f.assurance },
    hasRevBase && { k: "Révision estimée", d: rev.date },
    f.fin_contrat && { k: "Fin de contrat", d: f.fin_contrat },
  ].filter(Boolean).sort((a: any, b: any) => a.d.localeCompare(b.d)) as { k: string; d: string }[];

  const upload = async (vehicleId: string, file: File, docType: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${organizationId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("vehicle-documents").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(`Fichier non envoyé : ${file.name}`); return; }
    const { error: insErr } = await supabase.from("vehicle_documents").insert({ vehicle_id: vehicleId, doc_type: docType, nom: file.name, storage_path: path, mime_type: file.type, taille_octets: file.size });
    if (insErr) await supabase.storage.from("vehicle-documents").remove([path]);
  };

  const save = async (again: boolean) => {
    const e: Record<string, string> = {};
    if (!f.immatriculation.trim()) e.immatriculation = "La plaque est obligatoire";
    if (!f.marque.trim()) e.marque = "La marque est obligatoire";
    if (!f.modele.trim()) e.modele = "Le modèle est obligatoire";
    if (f.vin && f.vin.length !== 17) e.vin = "Le VIN contient 17 caractères";
    setErrors(e);
    if (Object.keys(e).length) { goto(e.immatriculation ? 0 : 1); return; }
    if (duplicate && !(await confirmToast("Cette plaque existe déjà dans la flotte. Enregistrer quand même ?"))) return;
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      immatriculation: f.immatriculation.trim().toUpperCase(), vin: f.vin || null, marque: f.marque.trim(), modele: f.modele.trim(),
      version: f.version || null, energie: f.energie || null, type_vehicule: f.categorie || null, couleur: f.couleur || null,
      kilometrage: num(f.kilometrage), statut: f.statut as "actif", notes: f.notes || null, site_id: f.site_id || null,
      mise_en_circulation: f.mise_en_circulation || null, controle_technique_expire_le: f.ct || null, assurance_expire_le: f.assurance || null,
      assureur: f.assureur || null, assurance_numero_contrat: f.contrat || null,
      derniere_revision_le: f.derniere_revision_le || null, derniere_revision_km: num(f.derniere_revision_km),
      intervalle_revision_km: f.intervalle_km, intervalle_revision_mois: f.intervalle_mois, km_moyen_mois: num(f.km_mois),
      prochaine_revision_km: hasRevBase ? rev.nextKm : null, pneumatiques: f.pneus || null,
      mode_detention: f.mode || null, fin_contrat_le: f.fin_contrat || null, loyer_mensuel: num(f.loyer), km_contrat: num(f.km_contrat),
      assurance_cout_annuel: num(f.assurance_an), entretien_cout_annuel: num(f.entretien_an),
      automatismes: auto as unknown as Record<string, unknown>,
    };
    const { data, error } = await supabase.from("vehicles").insert(payload as never).select("id").single();
    if (error || !data) { setSaving(false); toast.error(error?.message || "Enregistrement impossible"); return; }
    const vid = (data as { id: string }).id;
    if (f.conducteur_id) await supabase.from("conducteur_vehicules").insert({ conducteur_id: f.conducteur_id, vehicle_id: vid, is_principal: true } as never);
    if (files.cg) await upload(vid, files.cg, "carte_grise");
    if (files.ct) await upload(vid, files.ct, "controle_technique");
    if (files.assurance) await upload(vid, files.assurance, "assurance");
    for (const p of files.photos) await upload(vid, p, "autre");
    setSaving(false);
    toast.success("Véhicule enregistré");
    onSaved();
    if (again) {
      setF({ ...EMPTY, site_id: f.site_id, conducteur_id: f.conducteur_id });
      setFiles({ photos: [] }); setFound(false);
      setExisting((x) => [...x, { id: vid, immatriculation: payload.immatriculation }]);
      scrollRef.current?.scrollTo({ top: 0 });
      setTimeout(() => plateRef.current?.querySelector("input")?.focus(), 50);
    } else onClose();
  };

  const FileDrop = ({ label, onFile, accept = "image/*,application/pdf", multiple }: { label: string; onFile: (f: File[]) => void; accept?: string; multiple?: boolean }) => (
    <label className="avd-drop">
      <Upload className="h-5 w-5" /> <span>{label}</span>
      <input type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onFile(Array.from(e.target.files ?? []))} />
    </label>
  );

  const AutoCard = ({ title, help, on, onToggle, children, soon }: { title: string; help: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode; soon?: boolean }) => (
    <div className={`avd-auto ${on ? "on" : ""}`}>
      <div className="avd-auto-head">
        <div className="avd-lbl"><span>{title}</span><HelpTip title={title} text={help} tone="violet" /></div>
        {soon && <span className="avd-soon">Bientôt disponible</span>}
        <Toggle on={on} onChange={onToggle} label={title} disabled={soon} />
      </div>
      {on && children && <div className="avd-auto-body">{children}</div>}
    </div>
  );

  return (
    <div className="avd-overlay" role="dialog" aria-modal="true" aria-labelledby="avd-title">
      <GuidedTour id="add-vehicle" steps={AVD_TOUR} delay={700} />
      <div className="avd-modal">
        <header className="avd-head">
          <img src={logoLigneoSeasonal()} alt="Transports Ligneo" className="avd-logo" />
          <div>
            <h1 id="avd-title">Ajouter un véhicule</h1>
            <p>Saisissez la plaque, on remplit le reste. Échéances, rappels et révisions se calculent tout seuls.</p>
          </div>
          <button type="button" className="avd-x" aria-label="Fermer" onClick={() => void requestClose()}><X className="h-5 w-5" /></button>
        </header>
        <nav className="avd-pills" aria-label="Sections">
          {SECTIONS.map((s, i) => (
            <button key={s} type="button" className={`avd-pill ${active === i ? "on" : ""} ${done[i] ? "done" : ""}`} onClick={() => goto(i)}>
              <i>{done[i] ? <Check className="h-3 w-3" /> : i + 1}</i>{s}
            </button>
          ))}
        </nav>

        <div className="avd-body">
          <div className="avd-scroll avd-steps" ref={scrollRef} data-active={active}>
            <section data-avd-sec="0">
              <h2>Identification</h2>
              <div ref={plateRef}>
                <PlateInput value={f.immatriculation} onChange={(v) => { set({ immatriculation: v }); setFound(false); }} onSearch={search} searching={busy} tone="violet" found={found}
                  help="Saisissez la plaque, le tiret s’ajoute tout seul. Le bouton Rechercher retrouve automatiquement la marque, le modèle, le VIN, l’énergie et la date de mise en circulation. Vous pouvez tout corriger ensuite." />
              </div>
              {errors.immatriculation && <p className="avd-err">{errors.immatriculation}</p>}
              {duplicate && (
                <p className="avd-warn">Cette plaque existe déjà dans votre flotte.{onOpenExisting && <button type="button" onClick={() => onOpenExisting(duplicate.id)}>Ouvrir la fiche existante</button>}</p>
              )}
              <div className="mt-4"><FileDrop label={files.cg ? `Carte grise : ${files.cg.name}` : "Ou déposez la carte grise (photo ou PDF)"} onFile={([x]) => setFiles((p) => ({ ...p, cg: x }))} /></div>
            </section>

            <section data-avd-sec="1">
              <h2>Caractéristiques</h2>
              <div className="avd-grid">
                <Field label="VIN" help="Numéro d’identification du véhicule, 17 caractères. Il figure sur la carte grise (champ E) et au bas du pare-brise. Il sert à retrouver l’historique du véhicule.">
                  <input className="avd-input mono" maxLength={17} value={f.vin} onChange={(e) => set({ vin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="17 caractères" />
                  {errors.vin && <p className="avd-err">{errors.vin}</p>}
                </Field>
                <Field label="Version ou finition"><input className="avd-input" value={f.version} onChange={(e) => set({ version: e.target.value })} /></Field>
                <Field label="Marque" req><input className="avd-input" value={f.marque} onChange={(e) => set({ marque: e.target.value })} />{errors.marque && <p className="avd-err">{errors.marque}</p>}</Field>
                <Field label="Modèle" req><input className="avd-input" value={f.modele} onChange={(e) => set({ modele: e.target.value })} />{errors.modele && <p className="avd-err">{errors.modele}</p>}</Field>
                <div className="full"><Field label="Énergie" help="Le type de carburant ou de motorisation. Il sert à adapter le suivi et les rappels (par exemple pour un véhicule électrique)."><Chips items={ENERGIES as [string, string][]} value={f.energie} onChange={(v) => set({ energie: v })} /></Field></div>
                <div className="full"><Field label="Catégorie" help="Aide à classer votre parc et à choisir le bon mode de transport (chauffeur ou plateau) pour les missions."><Chips items={CATS as [string, string][]} value={f.categorie} onChange={(v) => set({ categorie: v })} /></Field></div>
                <Field label="Couleur">
                  <div className="avd-colors">{COLORS.map(([c, hex]) => <button key={c} type="button" aria-label={c} aria-pressed={f.couleur === c} className={f.couleur === c ? "on" : ""} style={{ background: hex }} onClick={() => set({ couleur: f.couleur === c ? "" : c })} />)}</div>
                </Field>
                <Field label="Kilométrage actuel" help="Le compteur aujourd’hui. Il est mis à jour automatiquement après chaque mission si l’option est activée, et sert à calculer la prochaine révision.">
                  <div className="avd-unit"><input className="avd-input mono" inputMode="numeric" value={f.kilometrage} onChange={(e) => set({ kilometrage: e.target.value.replace(/\D/g, "") })} /><span>km</span></div>
                </Field>
                <div className="full"><Field label="Statut" help="Disponible : prêt pour une mission. En mission : en cours de convoyage. Immobilisé : ne doit pas rouler (panne, document expiré, réparation). Archivé : sorti du parc, conservé pour l’historique."><Chips items={STATUTS as [string, string, string][]} value={f.statut} onChange={(v) => set({ statut: v || "actif" })} /></Field></div>
              </div>
            </section>

            <section data-avd-sec="2">
              <h2>Échéances</h2>
              <div className="avd-grid">
                <div className="avd-card">
                  <Field label="Mise en circulation" help="Date de première immatriculation, indiquée sur la carte grise (champ B). Elle sert à calculer la date du premier contrôle technique."><input type="date" className="avd-input" value={f.mise_en_circulation} onChange={(e) => set({ mise_en_circulation: e.target.value })} /></Field>
                </div>
                <div className="avd-card">
                  <div className="avd-card-top"><DueBadge date={f.ct} /></div>
                  <Field label="Contrôle technique expire le" help="Date limite de validité du contrôle en cours. Pour un véhicule léger, le premier contrôle est en général à faire dans les 4 ans qui suivent la mise en circulation, puis régulièrement ensuite. Vérifiez la règle de votre catégorie de véhicule, nous vous prévenons avant l’échéance.">
                    <input type="date" className="avd-input" value={f.ct} onChange={(e) => set({ ct: e.target.value })} />
                  </Field>
                  {ctSuggestion && <button type="button" className="avd-suggest" onClick={() => set({ ct: ctSuggestion })}>Premier contrôle avant le {fmtDate(ctSuggestion)} (4 ans après la mise en circulation). Utiliser cette date</button>}
                  <FileDrop label={files.ct ? files.ct.name : "Joindre le procès-verbal"} onFile={([x]) => setFiles((p) => ({ ...p, ct: x }))} />
                </div>
                <div className="avd-card">
                  <div className="avd-card-top"><DueBadge date={f.assurance} /></div>
                  <Field label="Assurance expire le" help="Date de fin ou de renouvellement du contrat d’assurance. Vous êtes prévenu avant, pour ne jamais rouler sans assurance."><input type="date" className="avd-input" value={f.assurance} onChange={(e) => set({ assurance: e.target.value })} /></Field>
                  <div className="avd-grid mt-3">
                    <input className="avd-input" placeholder="Assureur" value={f.assureur} onChange={(e) => set({ assureur: e.target.value })} />
                    <input className="avd-input" placeholder="Numéro de contrat" value={f.contrat} onChange={(e) => set({ contrat: e.target.value })} />
                  </div>
                  <FileDrop label={files.assurance ? files.assurance.name : "Joindre l’attestation"} onFile={([x]) => setFiles((p) => ({ ...p, assurance: x }))} />
                </div>
                <div className="avd-card">
                  <Field label="Carte grise" help="Ajoutez une photo ou un PDF. Elle reste accessible dans la fiche du véhicule et pour le convoyeur pendant la mission.">
                    <FileDrop label={files.cg ? files.cg.name : "Déposer la carte grise"} onFile={([x]) => setFiles((p) => ({ ...p, cg: x }))} />
                  </Field>
                </div>
              </div>
            </section>

            <section data-avd-sec="3">
              <h2>Entretien et révisions</h2>
              <div className="avd-grid">
                <Field label="Dernière révision" help="Date et compteur de la dernière révision faite. À partir de là, la prochaine révision est calculée toute seule."><input type="date" className="avd-input" value={f.derniere_revision_le} onChange={(e) => set({ derniere_revision_le: e.target.value })} /></Field>
                <Field label="Kilométrage à la dernière révision"><div className="avd-unit"><input className="avd-input mono" inputMode="numeric" value={f.derniere_revision_km} onChange={(e) => set({ derniere_revision_km: e.target.value.replace(/\D/g, "") })} /><span>km</span></div></Field>
                <Field label="Intervalle en km" help="Fréquence indiquée par le constructeur dans le carnet d’entretien : tous les X kilomètres ou tous les Y mois, au premier atteint."><Chips items={[[10000, "10 000"], [15000, "15 000"], [20000, "20 000"], [30000, "30 000"]]} value={f.intervalle_km} onChange={(v) => set({ intervalle_km: v || 15000 })} /></Field>
                <Field label="Intervalle en mois"><Chips items={[[12, "12"], [24, "24"], [36, "36"]]} value={f.intervalle_mois} onChange={(v) => set({ intervalle_mois: v || 12 })} /></Field>
                <Field label="Kilométrage moyen par mois" help="Sert uniquement à estimer la DATE de la prochaine révision. Vous pouvez le laisser tel quel, il s’affine ensuite avec les missions."><div className="avd-unit"><input className="avd-input mono" inputMode="numeric" value={f.km_mois} onChange={(e) => set({ km_mois: e.target.value.replace(/\D/g, "") })} /><span>km</span></div></Field>
                <Field label="Pneumatiques" help="Type de pneus actuellement montés, pour penser au changement de saison."><Chips items={[["ete", "Été"], ["4saisons", "Toutes saisons"], ["hiver", "Hiver"]]} value={f.pneus} onChange={(v) => set({ pneus: v })} /></Field>
              </div>
              <div className="avd-rev">
                <strong>Prochaine révision calculée</strong>
                {hasRevBase ? (
                  <>
                    <div className="avd-gauge"><i style={{ width: `${rev.progress * 100}%` }} /></div>
                    <div className="avd-rev-vals">
                      <span><b className="mono">{rev.nextKm.toLocaleString("fr-FR")} km</b> prochaine révision</span>
                      <span><b>{fmtDate(rev.date)}</b> date estimée</span>
                      <span>Il reste <b className="mono">{rev.remainingKm.toLocaleString("fr-FR")} km</b></span>
                    </div>
                  </>
                ) : <p>Renseignez le kilométrage pour lancer le calcul.</p>}
              </div>
            </section>

            <section data-avd-sec="4">
              <h2>Contrat et coûts</h2>
              <Field label="Mode de détention" help="Achat, location longue durée (LLD), location avec option d’achat (LOA) ou location courte durée. Sert à suivre les fins de contrat et les coûts."><Chips items={MODES as [string, string][]} value={f.mode} onChange={(v) => set({ mode: v })} /></Field>
              <div className="avd-grid mt-4">
                <Field label="Fin de contrat"><input type="date" className="avd-input" value={f.fin_contrat} onChange={(e) => set({ fin_contrat: e.target.value })} /></Field>
                <Field label="Loyer mensuel"><div className="avd-unit"><input className="avd-input mono" inputMode="decimal" value={f.loyer} onChange={(e) => set({ loyer: e.target.value })} /><span>€</span></div></Field>
                <Field label="Kilomètres du contrat" help="Kilométrage total autorisé par le contrat de location. Permet de voir si le véhicule risque de le dépasser."><div className="avd-unit"><input className="avd-input mono" inputMode="numeric" value={f.km_contrat} onChange={(e) => set({ km_contrat: e.target.value.replace(/\D/g, "") })} /><span>km</span></div></Field>
                <Field label="Assurance annuelle"><div className="avd-unit"><input className="avd-input mono" inputMode="decimal" value={f.assurance_an} onChange={(e) => set({ assurance_an: e.target.value })} /><span>€</span></div></Field>
                <Field label="Entretien annuel prévu"><div className="avd-unit"><input className="avd-input mono" inputMode="decimal" value={f.entretien_an} onChange={(e) => set({ entretien_an: e.target.value })} /><span>€</span></div></Field>
                <Field label="Coût annuel estimé" help="Calculé automatiquement : loyer mensuel x 12, plus assurance annuelle, plus entretien annuel prévu."><div className="avd-cost mono">{cost.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</div></Field>
              </div>
            </section>

            <section data-avd-sec="5">
              <h2>Affectation</h2>
              <div className="avd-grid">
                <Field label="Site ou agence" help="Où le véhicule est habituellement stationné. Il sert à pré-remplir l’adresse de départ des missions et aux droits d’accès par site.">
                  <select className="avd-input" value={f.site_id} onChange={(e) => set({ site_id: e.target.value })}><option value="">Aucun site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}</select>
                </Field>
                <Field label="Conducteur habituel" help="La personne qui utilise le véhicule au quotidien. Elle peut recevoir les rappels si vous le choisissez.">
                  <select className="avd-input" value={f.conducteur_id} onChange={(e) => set({ conducteur_id: e.target.value })}><option value="">Aucun conducteur</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select>
                </Field>
                <div className="full"><Field label="Notes"><textarea className="avd-input avd-area" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
                <div className="full"><Field label="Photos du véhicule" help="Elles servent de référence pour l’état des lieux au départ et à l’arrivée, et protègent en cas de litige.">
                  <FileDrop label={files.photos.length ? `${files.photos.length} photo(s) ajoutée(s)` : "Ajouter des photos"} accept="image/*" multiple onFile={(x) => setFiles((p) => ({ ...p, photos: [...p.photos, ...x] }))} />
                </Field></div>
              </div>
            </section>

            <section data-avd-sec="6">
              <h2>Automatismes</h2>
              <div className="avd-autos">
                <AutoCard title="Rappels du contrôle technique" help="Vous êtes prévenu avant la date limite du contrôle technique, aux délais choisis." on={auto.ct.on} onToggle={(v) => setAuto((a) => ({ ...a, ct: { ...a.ct, on: v } }))}>
                  <Chips multi items={[[60, "60 jours"], [30, "30 jours"], [15, "15 jours"], [7, "7 jours"]]} value={auto.ct.days} onChange={(v) => setAuto((a) => ({ ...a, ct: { ...a.ct, days: v } }))} />
                </AutoCard>
                <AutoCard title="Rappels de l’assurance" help="Vous êtes prévenu avant la fin du contrat d’assurance, aux délais choisis." on={auto.assurance.on} onToggle={(v) => setAuto((a) => ({ ...a, assurance: { ...a.assurance, on: v } }))}>
                  <Chips multi items={[[30, "30 jours"], [15, "15 jours"], [7, "7 jours"]]} value={auto.assurance.days} onChange={(v) => setAuto((a) => ({ ...a, assurance: { ...a.assurance, days: v } }))} />
                </AutoCard>
                <AutoCard title="Rappels de révision" help="Vous êtes prévenu à l’approche de la prochaine révision calculée, en kilomètres ou en jours." on={auto.revision.on} onToggle={(v) => setAuto((a) => ({ ...a, revision: { ...a.revision, on: v } }))}>
                  <Chips multi items={[["2000km", "2 000 km avant"], ["1000km", "1 000 km avant"], ["30j", "30 jours avant"]]} value={auto.revision.opts} onChange={(v) => setAuto((a) => ({ ...a, revision: { ...a.revision, opts: v } }))} />
                </AutoCard>
                <AutoCard title="Proposer un convoyage vers le garage" help="Un brouillon de mission est préparé quand une échéance approche. Rien n’est commandé ni facturé tant que vous ne l’avez pas validé." on={auto.convoyage.on} onToggle={(v) => setAuto((a) => ({ ...a, convoyage: { ...a.convoyage, on: v } }))} />
                <AutoCard title="Kilométrage mis à jour après chaque mission" help="À la fin de l’état des lieux d’arrivée, le relevé du convoyeur met à jour le compteur et la prochaine révision. Un relevé plus faible ou anormalement élevé n’est jamais appliqué seul : vous recevez une alerte pour confirmer ou corriger." on={auto.kmAuto.on} onToggle={(v) => setAuto((a) => ({ ...a, kmAuto: { on: v } }))} />
                <AutoCard title="Immobiliser si un document est expiré" help="Chaque matin et à chaque changement de date, si le contrôle technique ou l’assurance est dépassé, le véhicule passe en Immobilisé. Il reprend son statut précédent dès que la date est mise à jour. Les missions déjà planifiées ne sont jamais annulées. N’empêche jamais un convoyage vers un garage ou un centre de contrôle." on={auto.immobiliser.on} onToggle={(v) => setAuto((a) => ({ ...a, immobiliser: { on: v } }))} />
                <AutoCard title="Ajouter les échéances au calendrier de la flotte" help="Contrôle technique, assurance, révision estimée et fin de contrat apparaissent dans le calendrier de la flotte et se déplacent tout seuls quand la date change." on={auto.calendrier.on} onToggle={(v) => setAuto((a) => ({ ...a, calendrier: { on: v } }))} />
                <div className="avd-auto on">
                  <div className="avd-lbl"><span>Comment et qui prévenir</span><HelpTip title="Canaux et destinataires" text="Choisissez comment et qui est prévenu. Ces réglages s’appliquent à tous les rappels du véhicule." tone="violet" /></div>
                  <div className="avd-auto-body">
                    <Chips multi items={[["email", "Email"], ["notification", "Notification"], ["sms", "SMS"]]} value={auto.canaux} onChange={(v) => setAuto((a) => ({ ...a, canaux: v }))} />
                    <Chips multi items={[["gestionnaire", "Gestionnaire"], ["conducteur", "Conducteur affecté"]]} value={auto.destinataires} onChange={(v) => setAuto((a) => ({ ...a, destinataires: v }))} />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="avd-side" aria-label="Aperçu en direct">
            <p className="avd-side-title">Aperçu en direct</p>
            <div className="avd-vcard">
              {photoUrl ? <img src={photoUrl} alt={[f.marque, f.modele].join(" ")} className="avd-photo" /> : CAT_IMG[f.categorie] ? <img src={CAT_IMG[f.categorie]} alt={CATS.find(([c]) => c === f.categorie)?.[1] ?? ""} className="avd-photo avd-cat-img" /> : <svg viewBox="0 0 120 48" className="avd-car" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M8 34h104M14 34l6-12c2-4 5-6 10-6h50c5 0 8 2 11 6l9 12" /><circle cx="32" cy="36" r="6" /><circle cx="88" cy="36" r="6" /><path d="M36 16l-4 10h56l-6-10" /></svg>}
              <strong>{[f.marque, f.modele].filter(Boolean).join(" ") || "Nouveau véhicule"}</strong>
              <span>{[ENERGIES.find(([e]) => e === f.energie)?.[1], CATS.find(([c]) => c === f.categorie)?.[1], f.couleur, f.kilometrage && `${Number(f.kilometrage).toLocaleString("fr-FR")} km`].filter(Boolean).join(" · ") || "Caractéristiques à renseigner"}</span>
              {f.immatriculation && <PlateBadge plate={f.immatriculation} size="md" />}
              <span className="avd-status"><i style={{ background: STATUTS.find(([s]) => s === f.statut)?.[2] }} />{STATUTS.find(([s]) => s === f.statut)?.[1]}</span>
            </div>
            <div className="avd-ring" style={{ ["--p" as string]: `${pct * 3.6}deg` }}><b>{pct} %</b><span>Dossier complet</span></div>
            <p className="avd-side-title">Prochaines échéances</p>
            <ol className="avd-timeline">
              {timeline.length === 0 && <li className="avd-empty">Aucune échéance renseignée</li>}
              {timeline.map((t) => { const d = daysUntil(t.d); return <li key={t.k} className={`avd-due-${dueTone(d)}`}><i /><div><b>{t.k}</b><span>{fmtDate(t.d)} · {d !== null && d < 0 ? "dépassée" : `dans ${d} jours`}</span></div></li>; })}
            </ol>
            <p className="avd-autocount"><b className="mono">{autoCount}</b> automatismes actifs</p>
          </aside>
        </div>

        <footer className="avd-foot">
          <span>Étape {active + 1} sur {SECTIONS.length} · * Champs obligatoires</span>
          <button type="button" className="avd-btn ghost" onClick={() => (active === 0 ? void requestClose() : goto(active - 1))}>{active === 0 ? "Annuler" : <><ChevronLeft className="h-5 w-5" /> Étape précédente</>}</button>
          {active < SECTIONS.length - 1 ? (
            <>
              <button type="button" className="avd-btn blue" disabled={saving} onClick={() => void save(false)}>Enregistrer maintenant</button>
              <button type="button" className="avd-btn main" onClick={() => goto(active + 1)}>Étape suivante : {SECTIONS[active + 1]} <ChevronRight className="h-5 w-5" /></button>
            </>
          ) : (
            <>
              <button type="button" className="avd-btn blue" disabled={saving} onClick={() => void save(true)}>Enregistrer et en ajouter un autre</button>
              <button type="button" className="avd-btn main" disabled={saving} onClick={() => void save(false)}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Enregistrer le véhicule</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
