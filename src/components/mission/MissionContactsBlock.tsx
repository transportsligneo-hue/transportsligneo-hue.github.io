import { useEffect, useState } from "react";
import { Phone, MessageSquare, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContactRow {
  contact_depart_nom: string | null;
  contact_depart_tel: string | null;
  contact_depart_note: string | null;
  contact_arrivee_nom: string | null;
  contact_arrivee_tel: string | null;
  contact_arrivee_note: string | null;
  depart: string | null;
  arrivee: string | null;
}

interface Props {
  attributionId: string;
  /** Étape active : "depart" pour afficher seulement le contact d'enlèvement, "arrivee" pour celui de livraison, "both" pour les 2. */
  focus?: "depart" | "arrivee" | "both";
}

export function MissionContactsBlock({ attributionId, focus = "both" }: Props) {
  const [data, setData] = useState<ContactRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // attribution -> trajet -> contacts
      const { data: attr } = await supabase
        .from("attributions")
        .select("trajet_id")
        .eq("id", attributionId)
        .maybeSingle();
      const trajetId = (attr as { trajet_id?: string } | null)?.trajet_id;
      if (!trajetId) return;
      const { data: traj } = await supabase
        .from("trajets_assigned_safe" as never)
        .select(
          "contact_depart_nom, contact_depart_tel, contact_depart_note, contact_arrivee_nom, contact_arrivee_tel, contact_arrivee_note, depart, arrivee",
        )
        .eq("id", trajetId)
        .maybeSingle();
      if (!cancelled && traj) setData(traj as ContactRow);
    })();
    return () => { cancelled = true; };
  }, [attributionId]);

  if (!data) return null;

  const showDepart = focus !== "arrivee" && (data.contact_depart_nom || data.contact_depart_tel);
  const showArrivee = focus !== "depart" && (data.contact_arrivee_nom || data.contact_arrivee_tel);
  if (!showDepart && !showArrivee) return null;

  return (
    <div className="space-y-2 mt-3">
      {showDepart && (
        <ContactCard
          title="Contact enlèvement"
          place={data.depart}
          nom={data.contact_depart_nom}
          tel={data.contact_depart_tel}
          note={data.contact_depart_note}
        />
      )}
      {showArrivee && (
        <ContactCard
          title="Contact livraison"
          place={data.arrivee}
          nom={data.contact_arrivee_nom}
          tel={data.contact_arrivee_tel}
          note={data.contact_arrivee_note}
        />
      )}
    </div>
  );
}

function ContactCard({
  title, place, nom, tel, note,
}: { title: string; place: string | null; nom: string | null; tel: string | null; note: string | null }) {
  const telClean = tel?.replace(/[^+\d]/g, "");
  return (
    <div className="rounded-xl border border-pro-border bg-white p-3">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#0b1026] text-[#d4af37] flex items-center justify-center shrink-0">
          <User size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-pro-muted font-semibold">{title}</p>
          {nom && <p className="text-pro-text font-semibold text-sm leading-tight mt-0.5">{nom}</p>}
          {place && (
            <p className="text-pro-text-soft text-xs mt-0.5 inline-flex items-center gap-1">
              <MapPin size={11} /> {place}
            </p>
          )}
          {note && <p className="text-pro-text-soft text-xs mt-1 italic">{note}</p>}
        </div>
      </div>
      {telClean && (
        <div className="flex gap-2 mt-2">
          <a
            href={`tel:${telClean}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition"
          >
            <Phone size={14} /> Appeler
          </a>
          <a
            href={`sms:${telClean}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-pro-border text-pro-text rounded-lg text-sm font-medium hover:bg-pro-bg-soft active:scale-[0.98] transition"
          >
            <MessageSquare size={14} /> SMS
          </a>
        </div>
      )}
    </div>
  );
}
