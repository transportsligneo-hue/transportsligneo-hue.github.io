import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Route as RouteIcon, X } from "lucide-react";
import PlacesInput from "@/components/PlacesInput";
import { supabase } from "@/integrations/supabase/client";
import {
  CRENEAUX,
  VEHICULE_OPTIONS,
  clearDraft,
  emptyDraft,
  estimateDraft,
  exportPrefillToClassicForm,
  loadDraft,
  saveDraft,
  submitVroomyOrder,
  tripTypeLabel,
  type OrderStepId,
  type VroomyOrderDraft,
} from "@/lib/vroomy-order";

const CITIES_FALLBACK = [
  "Tours","Paris","Lyon","Marseille","Bordeaux","Nantes","Lille","Strasbourg","Toulouse","Nice",
  "Montpellier","Rennes","Orléans","Poitiers","Limoges","Clermont-Ferrand","Angers","Le Mans",
  "Blois","Chartres","Rouen","Caen","Dijon","Reims","Metz","Nancy","Brest","La Rochelle",
  "Perpignan","Grenoble","Saint-Étienne","Amiens","Bourges","Châteauroux",
];

const STEP_ORDER: OrderStepId[] = ["depart", "arrivee", "vehicule", "date", "contacts", "instructions", "recap"];

const STEP_QUESTION: Record<OrderStepId, string> = {
  depart: "Première étape : d'où part le véhicule ?",
  arrivee: "Parfait. Où doit-il être livré ?",
  vehicule: "Quel type de véhicule convoyons-nous ?",
  date: "Quelle date et quel créneau vous arrangent ?",
  contacts: "Vos coordonnées, pour établir le devis officiel.",
  instructions: "Une consigne particulière ? (accès, digicode, étage…) C'est facultatif.",
  recap: "Voici le récapitulatif complet avant confirmation.",
};

interface Props {
  initial?: Partial<VroomyOrderDraft>;
  onExit: () => void;
  onFinished: (numero: string, prix: number) => void;
}

export default function VroomyOrderFlow({ initial, onExit, onFinished }: Props) {
  const [draft, setDraft] = useState<VroomyOrderDraft>(() => ({
    ...emptyDraft(),
    ...(loadDraft() ?? {}),
    ...(initial ?? {}),
  }));
  const [identity, setIdentity] = useState({ nom: "", prenom: "", email: "", telephone: "" });
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Reprise / persistance du brouillon */
  useEffect(() => { saveDraft(draft); }, [draft]);

  /* Pré-remplissage des coordonnées si le client est connecté */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || !alive) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("nom, prenom, telephone, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setConnected(true);
      setIdentity({
        nom: prof?.nom ?? "",
        prenom: prof?.prenom ?? "",
        telephone: prof?.telephone ?? "",
        email: prof?.email ?? user.email ?? "",
      });
    })();
    return () => { alive = false; };
  }, []);

  const set = useCallback((patch: Partial<VroomyOrderDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const goTo = useCallback((step: OrderStepId) => set({ step }), [set]);

  const next = useCallback(() => {
    setDraft((d) => {
      const i = STEP_ORDER.indexOf(d.step);
      return { ...d, step: STEP_ORDER[Math.min(i + 1, STEP_ORDER.length - 1)] };
    });
  }, []);

  const back = useCallback(() => {
    setDraft((d) => {
      const i = STEP_ORDER.indexOf(d.step);
      return { ...d, step: STEP_ORDER[Math.max(i - 1, 0)] };
    });
  }, []);

  const estimate = useMemo(() => estimateDraft(draft), [draft]);

  const confirmed = useMemo(() => {
    const rows: Array<{ id: OrderStepId; label: string; value: string }> = [];
    if (draft.depart) rows.push({ id: "depart", label: "Départ", value: draft.depart });
    if (draft.arrivee) rows.push({ id: "arrivee", label: "Arrivée", value: draft.arrivee });
    if (draft.vehicule)
      rows.push({
        id: "vehicule",
        label: "Véhicule",
        value: `${VEHICULE_OPTIONS.find((v) => v.value === draft.vehicule)?.label ?? draft.vehicule} · ${tripTypeLabel(draft.tripType)}`,
      });
    if (draft.date || draft.creneau)
      rows.push({ id: "date", label: "Date", value: [draft.date, draft.creneau].filter(Boolean).join(" · ") });
    if (identity.nom || identity.telephone)
      rows.push({ id: "contacts", label: "Contact", value: `${identity.prenom} ${identity.nom} · ${identity.telephone}`.trim() });
    if (draft.instructions) rows.push({ id: "instructions", label: "Consignes", value: draft.instructions });
    return rows;
  }, [draft, identity]);

  const handleClassicForm = () => {
    exportPrefillToClassicForm(draft);
    window.location.href = "/tarifs#estimateur";
  };

  const handleConfirm = async () => {
    setError(null);
    if (!identity.nom.trim() || !identity.email.trim() || !identity.telephone.trim()) {
      setError("Nom, email et téléphone sont nécessaires pour établir le devis.");
      goTo("contacts");
      return;
    }
    setSending(true);
    const res = await submitVroomyOrder(draft, identity);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "La commande n'a pas pu être enregistrée.");
      return;
    }
    clearDraft();
    onFinished(res.numero ?? "", res.prixTtc ?? 0);
  };

  const inputCls = "vrm-field";

  return (
    <section className="vrm-flow" aria-label="Commande guidée par Vroomy">
      <header className="vrm-flow-head">
        <span className="vrm-flow-badge">
          <RouteIcon size={13} aria-hidden="true" /> Commande guidée
        </span>
        <button type="button" className="vrm-flow-quit" onClick={onExit} aria-label="Quitter le parcours guidé">
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      {confirmed.length > 0 && draft.step !== "recap" && (
        <ul className="vrm-flow-recap" aria-label="Informations déjà confirmées">
          {confirmed.map((r) => (
            <li key={r.id}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
              <button type="button" onClick={() => goTo(r.id)} aria-label={`Modifier ${r.label}`}>
                <Pencil size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="vrm-flow-question">{STEP_QUESTION[draft.step]}</p>

      {estimate && draft.step !== "recap" && (
        <div className="vrm-flow-estimate" role="status">
          <span>Estimation en direct</span>
          <strong>{Math.round(estimate.priceTtc)} € TTC</strong>
          <em>
            {estimate.distanceKm != null ? `${estimate.distanceKm} km · ` : ""}
            {estimate.delai}
          </em>
        </div>
      )}

      {draft.step === "depart" && (
        <div className="vrm-flow-field">
          <PlacesInput
            value={draft.depart}
            onChange={(v) => set({ depart: v })}
            onSelect={(v) => set({ depart: v })}
            placeholder="Adresse ou ville de départ"
            className={inputCls}
            fallbackOptions={CITIES_FALLBACK}
            inputId="vrm-flow-depart"
          />
          <button type="button" className="vrm-flow-next" disabled={!draft.depart.trim()} onClick={next}>
            Continuer
          </button>
        </div>
      )}

      {draft.step === "arrivee" && (
        <div className="vrm-flow-field">
          <PlacesInput
            value={draft.arrivee}
            onChange={(v) => set({ arrivee: v })}
            onSelect={(v) => set({ arrivee: v })}
            placeholder="Adresse ou ville d'arrivée"
            className={inputCls}
            fallbackOptions={CITIES_FALLBACK}
            inputId="vrm-flow-arrivee"
          />
          <button type="button" className="vrm-flow-next" disabled={!draft.arrivee.trim()} onClick={next}>
            Continuer
          </button>
        </div>
      )}

      {draft.step === "vehicule" && (
        <div className="vrm-flow-field">
          <div className="vrm-flow-opts" role="group" aria-label="Type de véhicule">
            {VEHICULE_OPTIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={`vrm-flow-opt${draft.vehicule === v.value ? " is-on" : ""}`}
                aria-pressed={draft.vehicule === v.value}
                onClick={() => set({ vehicule: v.value })}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="vrm-flow-opts" role="group" aria-label="Type de prestation">
            {(["aller_simple", "aller_retour", "express"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`vrm-flow-opt${draft.tripType === t ? " is-on" : ""}`}
                aria-pressed={draft.tripType === t}
                onClick={() => set({ tripType: t })}
              >
                {tripTypeLabel(t)}
              </button>
            ))}
          </div>
          <button type="button" className="vrm-flow-next" disabled={!draft.vehicule} onClick={next}>
            Continuer
          </button>
        </div>
      )}

      {draft.step === "date" && (
        <div className="vrm-flow-field">
          <label className="sr-only" htmlFor="vrm-flow-date">Date souhaitée</label>
          <input
            id="vrm-flow-date"
            type="date"
            className={inputCls}
            min={new Date().toISOString().slice(0, 10)}
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
          />
          <div className="vrm-flow-opts" role="group" aria-label="Créneau souhaité">
            {CRENEAUX.map((c) => (
              <button
                key={c}
                type="button"
                className={`vrm-flow-opt${draft.creneau === c ? " is-on" : ""}`}
                aria-pressed={draft.creneau === c}
                onClick={() => set({ creneau: c })}
              >
                {c}
              </button>
            ))}
          </div>
          <button type="button" className="vrm-flow-next" disabled={!draft.date} onClick={next}>
            Continuer
          </button>
        </div>
      )}

      {draft.step === "contacts" && (
        <div className="vrm-flow-field">
          {connected && <p className="vrm-flow-hint">Coordonnées de votre compte client, modifiables si besoin.</p>}
          <label className="sr-only" htmlFor="vrm-flow-prenom">Prénom</label>
          <input id="vrm-flow-prenom" className={inputCls} placeholder="Prénom" autoComplete="given-name"
            value={identity.prenom} onChange={(e) => setIdentity((i) => ({ ...i, prenom: e.target.value }))} />
          <label className="sr-only" htmlFor="vrm-flow-nom">Nom</label>
          <input id="vrm-flow-nom" className={inputCls} placeholder="Nom" autoComplete="family-name"
            value={identity.nom} onChange={(e) => setIdentity((i) => ({ ...i, nom: e.target.value }))} />
          <label className="sr-only" htmlFor="vrm-flow-email">Email</label>
          <input id="vrm-flow-email" className={inputCls} type="email" placeholder="Email" autoComplete="email"
            value={identity.email} onChange={(e) => setIdentity((i) => ({ ...i, email: e.target.value }))} />
          <label className="sr-only" htmlFor="vrm-flow-tel">Téléphone</label>
          <input id="vrm-flow-tel" className={inputCls} inputMode="tel" placeholder="Téléphone" autoComplete="tel"
            value={identity.telephone} onChange={(e) => setIdentity((i) => ({ ...i, telephone: e.target.value }))} />

          <p className="vrm-flow-hint">Contacts sur place, si différents de vous (facultatif).</p>
          <label className="sr-only" htmlFor="vrm-flow-cdn">Contact au départ</label>
          <input id="vrm-flow-cdn" className={inputCls} placeholder="Contact au départ (nom et téléphone)"
            value={draft.contactDepartNom}
            onChange={(e) => set({ contactDepartNom: e.target.value })} />
          <label className="sr-only" htmlFor="vrm-flow-can">Contact à l'arrivée</label>
          <input id="vrm-flow-can" className={inputCls} placeholder="Contact à l'arrivée (nom et téléphone)"
            value={draft.contactArriveeNom}
            onChange={(e) => set({ contactArriveeNom: e.target.value })} />

          <button
            type="button"
            className="vrm-flow-next"
            disabled={!identity.nom.trim() || !identity.email.trim() || !identity.telephone.trim()}
            onClick={next}
          >
            Continuer
          </button>
        </div>
      )}

      {draft.step === "instructions" && (
        <div className="vrm-flow-field">
          <label className="sr-only" htmlFor="vrm-flow-instr">Instructions particulières</label>
          <textarea
            id="vrm-flow-instr"
            className={inputCls}
            rows={3}
            placeholder="Accès, digicode, étage, horaires du garage…"
            value={draft.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
          />
          <button type="button" className="vrm-flow-next" onClick={next}>
            Voir le récapitulatif
          </button>
        </div>
      )}

      {draft.step === "recap" && (
        <div className="vrm-flow-field">
          <ul className="vrm-flow-recap vrm-flow-recap-full" aria-label="Récapitulatif de la commande">
            {confirmed.map((r) => (
              <li key={r.id}>
                <span>{r.label}</span>
                <strong>{r.value}</strong>
                <button type="button" onClick={() => goTo(r.id)} aria-label={`Modifier ${r.label}`}>
                  <Pencil size={11} aria-hidden="true" /> Modifier
                </button>
              </li>
            ))}
            <li>
              <span>Prix estimé</span>
              <strong>{estimate ? `${Math.round(estimate.priceTtc)} € TTC` : "Sur devis"}</strong>
            </li>
          </ul>
          {error && <p className="vrm-flow-error" role="alert">{error}</p>}
          <button type="button" className="vrm-flow-confirm" onClick={() => void handleConfirm()} disabled={sending}>
            {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
            {sending ? "Enregistrement…" : "Confirmer la commande"}
          </button>
        </div>
      )}

      <div className="vrm-flow-foot">
        {draft.step !== "depart" && (
          <button type="button" className="vrm-flow-back" onClick={back}>
            <ArrowLeft size={12} aria-hidden="true" /> Étape précédente
          </button>
        )}
        <button type="button" className="vrm-flow-escape" onClick={handleClassicForm}>
          Continuer sur le formulaire classique
        </button>
      </div>
    </section>
  );
}
