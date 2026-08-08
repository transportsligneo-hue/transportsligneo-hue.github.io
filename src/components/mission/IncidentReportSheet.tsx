/**
 * IncidentReportSheet · écran plein écran "Signaler un incident" (app convoyeur).
 *
 * Sélection par TYPE d'incident concret (remplace l'ancienne échelle de gravité
 * abstraite), pré-remplissage du titre, barre de contexte mission + GPS,
 * preuves photo (caméra / galerie) compressées côté client, et notification
 * admin immédiate pour les types critiques (accident, vol).
 */
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, X, MapPin, Loader2, CheckCircle2, Check, Clock, Car, Wrench,
  PhoneOff, ShieldAlert, CarFront, Camera, Image as ImageIcon, Send, Trash2,
  MoreHorizontal, Hash, PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyAdmin } from "@/lib/admin-notifications";

const ASSISTANCE_TEL = "+33782456181";
const MAX_PHOTOS = 5;

interface Props {
  attributionId: string;
  userId: string;
  numeroMission?: string | null;
  driverName?: string;
  onClose: () => void;
  onReported?: () => void;
}

type IncidentType = {
  key: string;
  name: string;
  desc: string;
  titre: string;
  gravite: "mineur" | "moyen" | "grave" | "critique";
  icon: typeof Clock;
  /** couleur d'accent (hex) */
  color: string;
  critique?: boolean;
};

const TYPES: IncidentType[] = [
  { key: "retard", name: "Retard", desc: "Circulation, accès difficile", titre: "Retard — circulation / accès", gravite: "mineur", icon: Clock, color: "#4f8cff" },
  { key: "vehicule_non_dispo", name: "Véhicule non disponible", desc: "Absent au point de RDV", titre: "Véhicule non disponible au point de RDV", gravite: "grave", icon: Car, color: "#d9b54a" },
  { key: "vehicule_non_roulant", name: "Véhicule non roulant", desc: "Panne, ne démarre pas", titre: "Véhicule non roulant — ne démarre pas", gravite: "grave", icon: Wrench, color: "#ff9a4f" },
  { key: "probleme_vehicule", name: "Problème véhicule", desc: "Voyant, dégât, état", titre: "Problème véhicule — voyant / dégât constaté", gravite: "moyen", icon: CarFront, color: "#ff9a4f" },
  { key: "client_injoignable", name: "Client injoignable", desc: "Absent, ne répond pas", titre: "Client injoignable sur place", gravite: "moyen", icon: PhoneOff, color: "#7c5cff" },
  { key: "acces_difficile", name: "Accès difficile", desc: "Parking, route bloquée", titre: "Accès difficile — parking / route bloquée", gravite: "mineur", icon: MapPin, color: "#d9b54a" },
  { key: "accident", name: "Accident", desc: "Collision, dommage tiers", titre: "Accident — collision / dommage tiers", gravite: "critique", icon: AlertTriangle, color: "#ff4f5e", critique: true },
  { key: "vol_securite", name: "Vol / Sécurité", desc: "Effraction, agression", titre: "Vol / Sécurité — effraction ou agression", gravite: "critique", icon: ShieldAlert, color: "#ff4f5e", critique: true },
  { key: "autre", name: "Autre type d'incident", desc: "Cas non couvert", titre: "", gravite: "moyen", icon: MoreHorizontal, color: "#8a93b8" },
];

/** Compression client : max 1400px, JPEG 0.72. */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1400;
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.72));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function IncidentReportSheet({
  attributionId, userId, numeroMission, driverName, onClose, onReported,
}: Props) {
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [showAutre, setShowAutre] = useState(false);
  const [autreLabel, setAutreLabel] = useState("");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: Blob; preview: string }[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const selected = TYPES.find((t) => t.key === typeKey) ?? null;
  const isCritique = selected?.critique === true;

  // GPS auto (barre de contexte)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { timeout: 8000, enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => () => { photos.forEach((p) => URL.revokeObjectURL(p.preview)); }, [photos]);

  const pickType = (t: IncidentType) => {
    setTypeKey(t.key);
    if (t.key === "autre") setShowAutre(true);
    if (t.titre) setTitre(t.titre);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`Maximum ${MAX_PHOTOS} photos`); return; }
    const picked = Array.from(files).slice(0, room);
    const compressed = await Promise.all(picked.map(async (f) => {
      const blob = await compressImage(f);
      return { file: blob, preview: URL.createObjectURL(blob) };
    }));
    setPhotos((prev) => [...prev, ...compressed]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const p = prev[idx];
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const canSubmit = !!selected && titre.trim().length > 0 && description.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!selected || !canSubmit) return;
    setSubmitting(true);

    // Position au moment du signalement (rafraîchie best-effort)
    let latitude = coords?.lat ?? null;
    let longitude = coords?.lng ?? null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true }),
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch { /* géoloc optionnelle */ }

    // Upload des preuves
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p) continue;
      const path = `${userId}/${attributionId}/${Date.now()}-${i}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("incident-photos")
        .upload(path, p.file, { contentType: "image/jpeg", upsert: false });
      if (upErr) continue;
      const { data: signed } = await supabase.storage
        .from("incident-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) urls.push(signed.signedUrl);
    }

    const typeLabel = selected.key === "autre" && autreLabel.trim() ? autreLabel.trim() : selected.name;

    const { data: incident, error } = await supabase
      .from("mission_incidents" as never)
      .insert({
        attribution_id: attributionId,
        convoyeur_user_id: userId,
        titre: titre.trim(),
        description: description.trim(),
        gravite: selected.gravite,
        type_incident: selected.key === "autre" ? `autre:${typeLabel}` : selected.key,
        latitude,
        longitude,
        photos: urls,
      } as never)
      .select("id")
      .single();

    if (error || !incident) {
      toast.error("Échec d'envoi", { description: error?.message });
      setSubmitting(false);
      return;
    }

    const incId = (incident as { id: string }).id;
    await notifyAdmin({
      type: "incident",
      titre: `${isCritique ? "URGENT · " : ""}${typeLabel} · ${numeroMission ?? "mission"}`,
      message: titre.trim(),
      link: `/admin/missions/${attributionId}?tab=incidents`,
      entityType: "incident",
      entityId: incId,
      metadata: {
        type_incident: selected.key,
        type_label: typeLabel,
        gravite: selected.gravite,
        urgent: isCritique,
        driver: driverName ?? null,
        latitude,
        longitude,
        photos: urls.length,
      },
    });

    setDone(true);
    setSubmitting(false);
    toast.success("Incident signalé à l'admin");
    onReported?.();
    setTimeout(onClose, 1400);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-[#03060f]/95 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-6">
      <div className="w-full sm:max-w-[440px] flex flex-col max-h-screen overflow-hidden sm:rounded-3xl shadow-2xl"
           style={{ background: "linear-gradient(180deg,#0a1230 0%, #070c22 60%, #050818 100%)" }}>
        {/* ===== HEADER ===== */}
        <div className="relative overflow-hidden px-5 pt-5 pb-5 border-b border-[rgba(255,79,94,0.3)]"
             style={{ background: "linear-gradient(135deg,#7a1420,#3d0a12 70%)" }}>
          <div className="absolute -top-10 -right-8 w-44 h-44 rounded-full pointer-events-none"
               style={{ background: "radial-gradient(circle, rgba(255,79,94,0.35), transparent 70%)" }} />
          <div className="relative flex items-center gap-3.5">
            <div className="relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0"
                 style={{ background: "linear-gradient(135deg,#ff4f5e,#c81f30)", boxShadow: "0 8px 22px rgba(255,79,94,0.5)" }}>
              <AlertTriangle size={24} className="text-white" />
              <span className="incident-ring absolute -inset-1.5 rounded-[18px] border-[1.5px] border-[rgba(255,79,94,0.5)]" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#ffb3ba] mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f5e] animate-pulse" />
                Signalement urgent
              </div>
              <h2 className="text-[19px] font-extrabold text-white leading-tight">Signaler un incident</h2>
            </div>
            <button onClick={onClose} aria-label="Fermer"
                    className="w-[34px] h-[34px] rounded-[10px] bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <X size={17} />
            </button>
          </div>

          {/* Barre de contexte auto : mission + GPS */}
          <div className="relative mt-4 flex items-center gap-2 px-3 py-2.5 rounded-[11px] bg-black/25 border border-white/10 text-[11px] text-[#ffd7da]">
            <Hash size={13} className="text-[#ff9aa2] shrink-0" />
            Mission <b className="text-white font-bold">{numeroMission ?? "en cours"}</b>
            <span className="w-[3px] h-[3px] rounded-full bg-white/30" />
            <MapPin size={13} className="text-[#ff9aa2] shrink-0" />
            <span className="truncate">
              {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Position en cours…"}
            </span>
          </div>
        </div>

        {/* ===== BODY ===== */}
        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white">Incident transmis à l'admin</p>
            <p className="text-sm text-[#8f9ac2] mt-2">Vous serez recontacté rapidement.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Types */}
            <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#c3cbe8] mb-3">
              Type d'incident <span className="text-[#ff8a92]">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {TYPES.filter((t) => t.key !== "autre" || showAutre).map((t) => {
                const Icon = t.icon;
                const active = typeKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => pickType(t)}
                    aria-pressed={active}
                    className={`relative overflow-hidden text-left rounded-[15px] p-3 pb-3 border-[1.5px] transition-all ${
                      active ? "bg-white/[0.06] -translate-y-px" : "bg-white/[0.035] border-[rgba(122,163,255,0.18)]"
                    } ${active && t.critique ? "incident-crit-pulse" : ""}`}
                    style={active ? { borderColor: t.color, boxShadow: `0 0 0 1px ${t.color}, 0 10px 22px ${t.color}38` } : undefined}
                  >
                    <span className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-2.5"
                          style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}bb)` }}>
                      <Icon size={18} className="text-white" />
                    </span>
                    <span className="block text-[13.5px] font-bold text-white leading-tight">{t.name}</span>
                    <span className="block text-[10px] text-[#8f9ac2] leading-snug mt-0.5">{t.desc}</span>
                    {active && (
                      <span className="absolute bottom-3 right-3 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                            style={{ background: t.color }}>
                        <Check size={10} strokeWidth={3} className="text-[#0a1230]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {!showAutre && (
              <button type="button" onClick={() => { setShowAutre(true); }}
                      className="w-full text-center text-[11.5px] font-bold text-[#4f8cff] py-3">
                + Autre type d'incident
              </button>
            )}
            {showAutre && (
              <input
                type="text"
                value={autreLabel}
                onChange={(e) => setAutreLabel(e.target.value.slice(0, 60))}
                placeholder="Précisez le type d'incident"
                className="incident-input mt-3"
              />
            )}

            {/* Titre */}
            <div className="mt-6">
              <label htmlFor="inc-titre" className="block text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#c3cbe8] mb-3">
                Titre <span className="text-[#ff8a92]">*</span>
              </label>
              <input
                id="inc-titre"
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value.slice(0, 120))}
                placeholder="Résumé court de l'incident"
                className="incident-input"
              />
            </div>

            {/* Description */}
            <div className="mt-6">
              <label htmlFor="inc-desc" className="block text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#c3cbe8] mb-3">
                Description détaillée <span className="text-[#ff8a92]">*</span>
              </label>
              <textarea
                id="inc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
                rows={5}
                placeholder="Décrivez le contexte, ce qui s'est passé, où vous êtes actuellement, et ce dont vous avez besoin…"
                className="incident-input resize-none leading-relaxed"
              />
              <p className="text-right text-[10.5px] text-[#8f9ac2] mt-1.5">
                <b className="text-[#c3cbe8]">{description.length}</b> / 1500
              </p>
            </div>

            {/* Preuves */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#c3cbe8]">Preuves</p>
                <span className="text-[10px] font-semibold text-[#8f9ac2]">{photos.length}/{MAX_PHOTOS} · recommandé</span>
              </div>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => cameraRef.current?.click()} className="incident-attach">
                  <span className="incident-attach-ic"><Camera size={17} /></span>
                  <span>Prendre une photo</span>
                </button>
                <button type="button" onClick={() => galleryRef.current?.click()} className="incident-attach">
                  <span className="incident-attach-ic"><ImageIcon size={17} /></span>
                  <span>Depuis la galerie</span>
                </button>
              </div>
              <div className="mt-2.5">
                <DocScanButton
                  label="Scanner un document justificatif"
                  maxPages={4}
                  filenameBase="incident"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white border border-white/15"
                  onFiles={(files) => {
                    const dt = new DataTransfer();
                    files.forEach((f) => dt.items.add(f));
                    void addFiles(dt.files);
                  }}
                />
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                     onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
                     onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />

              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {photos.map((p, i) => (
                    <div key={p.preview} className="relative rounded-xl overflow-hidden border border-white/10 aspect-square">
                      <img src={p.preview} alt={`Preuve ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)} aria-label={`Supprimer la photo ${i + 1}`}
                              className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-black/70 flex items-center justify-center text-[#ff9aa2]">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isCritique && (
              <a href={`tel:${ASSISTANCE_TEL}`}
                 className="mt-6 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-[rgba(255,79,94,0.5)] bg-[rgba(255,79,94,0.12)]">
                <span className="w-9 h-9 rounded-xl bg-[#ff4f5e] flex items-center justify-center text-white shrink-0">
                  <PhoneCall size={17} />
                </span>
                <span>
                  <span className="block text-[13px] font-bold text-white">Urgence vitale ? Appeler l'assistance</span>
                  <span className="block text-[11px] text-[#ffb3ba]">Ligne 24/7 · réponse immédiate</span>
                </span>
              </a>
            )}
          </div>
        )}

        {/* ===== FOOTER ===== */}
        {!done && (
          <div className="px-5 pt-4 pb-5 border-t border-white/5"
               style={{ background: "linear-gradient(180deg, rgba(7,12,34,0.4) 0%, #070c22 40%)" }}>
            <div className="flex gap-2.5">
              <button onClick={onClose} disabled={submitting}
                      className="basis-[34%] shrink-0 py-3.5 rounded-[14px] border-[1.5px] border-[rgba(122,163,255,0.18)] bg-white/[0.03] text-[13.5px] font-bold text-[#c3cbe8]">
                Annuler
              </button>
              <button onClick={submit} disabled={!canSubmit}
                      className="incident-send flex-1 py-3.5 rounded-[14px] text-[13.5px] font-extrabold text-white inline-flex items-center justify-center gap-2 disabled:opacity-45">
                {submitting ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                Envoyer à l'admin
              </button>
            </div>
            <a href={`tel:${ASSISTANCE_TEL}`}
               className="flex items-center justify-center gap-1.5 mt-3 text-[11px] text-[#8f9ac2]">
              Urgence vitale ? <b className="text-[#ff9aa2] underline font-bold">Appeler l'assistance 24/7</b>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
