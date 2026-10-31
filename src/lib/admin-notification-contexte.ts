/**
 * Détails des notifications admin : à partir de l'entité liée (convoyeur,
 * mission, devis, facture, compte, conversation), on va chercher le nom,
 * le téléphone, le trajet, la plaque, le montant… en quelques requêtes groupées.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotifDetail = { label: string; value: string };
export type NotifContexte = {
  /** Qui est concerné (nom complet ou société). */
  qui?: string;
  /** Rôle affiché sous le nom : Convoyeur, Client pro, Visiteur… */
  role?: "convoyeur" | "client" | "visiteur";
  avatar?: string | null;
  telephone?: string | null;
  email?: string | null;
  plaque?: string | null;
  details: NotifDetail[];
};

type N = { id: string; type: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown> | null };

const db = supabase as unknown as { from: (t: string) => any };
const uuid = (v: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const nomDe = (p?: string | null, n?: string | null) => [p, n].filter(Boolean).join(" ").trim();
const euros = (v: unknown) => (v == null || v === "" ? null : `${Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`);
const ville = (adr?: string | null) => {
  if (!adr) return "";
  const m = adr.match(/\d{5}\s+([^,]+)/);
  return (m ? m[1] : adr.split(",").pop() ?? adr).trim();
};
const trajet = (a?: string | null, b?: string | null) => (a || b ? `${ville(a) || "?"} → ${ville(b) || "?"}` : null);

async function parIds(table: string, cols: string, ids: string[], key = "id") {
  if (!ids.length) return [] as any[];
  const { data } = await db.from(table).select(cols).in(key, ids);
  return (data ?? []) as any[];
}

export function useNotifContexte(items: N[]) {
  const [ctx, setCtx] = useState<Record<string, NotifContexte>>({});
  const cle = useMemo(() => items.map((n) => `${n.id}:${n.entity_type}:${n.entity_id}`).join("|"), [items]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const ids = (t: string[]) => [...new Set(items.filter((n) => n.entity_type && t.includes(n.entity_type) && uuid(n.entity_id)).map((n) => n.entity_id as string))];
      const docIds = ids(["document_convoyeur"]);
      const chatIds = [...new Set(items.filter((n) => (n.entity_type?.startsWith("chat") || n.type.startsWith("chat")) && uuid(n.entity_id)).map((n) => n.entity_id as string))];

      const [docs, attribs, devis, factures, profils, chats] = await Promise.all([
        parIds("documents_convoyeurs", "id, convoyeur_id, type_document", docIds),
        parIds("attributions", "id, convoyeur_id, numero_mission, trajet_id, statut", ids(["attribution"])),
        parIds("devis", "id, numero, prenom, nom, email, telephone, depart, arrivee, total_ttc, prix_estime, immatriculation, statut", ids(["devis"])),
        parIds("factures", "id, numero, client_prenom, client_nom, client_societe, client_email, total_ttc, numero_mission, depart, arrivee, immatriculation, statut", ids(["facture"])),
        parIds("profiles", "user_id, prenom, nom, email, telephone, societe, type_client, avatar_url", ids(["user", "client"]), "user_id"),
        parIds("chat_conversations", "id, kind, visitor_name, visitor_email, mission_reference, client_user_id, convoyeur_user_id", chatIds),
      ]);
      const trajets = await parIds("trajets", "id, depart, arrivee, immatriculation, vehicule_immatriculation, date_trajet, marque, modele", [...new Set(attribs.map((a) => a.trajet_id).filter(Boolean))]);
      const convIds = [...new Set([...ids(["convoyeur"]), ...docs.map((d) => d.convoyeur_id), ...attribs.map((a) => a.convoyeur_id)].filter(Boolean))];
      const chatUsers = [...new Set(chats.flatMap((c) => [c.client_user_id, c.convoyeur_user_id]).filter(Boolean))];
      const [convs, chatProfils] = await Promise.all([
        parIds("convoyeurs", "id, user_id, prenom, nom, telephone, email, ville, avatar_url, statut", convIds),
        parIds("profiles", "user_id, prenom, nom, email, telephone, societe", chatUsers, "user_id"),
      ]);
      const by = <T,>(arr: T[], k: keyof T) => new Map(arr.map((x) => [String(x[k]), x]));
      const C = by(convs, "id" as never), D = by(docs, "id" as never), A = by(attribs, "id" as never), T = by(trajets, "id" as never);
      const DV = by(devis, "id" as never), F = by(factures, "id" as never), P = by(profils, "user_id" as never), CH = by(chats, "id" as never);
      const CP = by(chatProfils, "user_id" as never);

      const fiche = (c: any, extra: NotifDetail[] = []): NotifContexte => ({
        qui: nomDe(c?.prenom, c?.nom) || c?.email, role: "convoyeur", avatar: c?.avatar_url ?? null,
        telephone: c?.telephone, email: c?.email,
        details: [...(c?.ville ? [{ label: "Ville", value: c.ville }] : []), ...extra],
      });

      const out: Record<string, NotifContexte> = {};
      for (const n of items) {
        const m = (n.metadata ?? {}) as Record<string, any>;
        const id = n.entity_id ?? "";
        let r: NotifContexte | null = null;
        switch (n.entity_type) {
          case "convoyeur":
          case "convoyeur_waitlist":
            if (C.has(id)) r = fiche(C.get(id));
            break;
          case "document_convoyeur": {
            const d = D.get(id);
            if (d) r = fiche(C.get(String(d.convoyeur_id)), [{ label: "Document", value: String(d.type_document).replace(/_/g, " ") }]);
            break;
          }
          case "attribution": {
            const a = A.get(id); const t = a ? T.get(String(a.trajet_id)) : null; const c = a ? C.get(String(a.convoyeur_id)) : null;
            if (a) {
              r = fiche(c, [
                ...(a.numero_mission ? [{ label: "Mission", value: a.numero_mission }] : []),
                ...(trajet(t?.depart, t?.arrivee) ? [{ label: "Trajet", value: trajet(t?.depart, t?.arrivee)! }] : []),
                ...(t?.date_trajet ? [{ label: "Date", value: new Date(t.date_trajet).toLocaleDateString("fr-FR") }] : []),
                ...(t?.marque ? [{ label: "Véhicule", value: [t.marque, t.modele].filter(Boolean).join(" ") }] : []),
              ]);
              r.plaque = t?.vehicule_immatriculation || t?.immatriculation || null;
            }
            break;
          }
          case "devis": {
            const v = DV.get(id);
            if (v) r = {
              qui: nomDe(v.prenom, v.nom) || v.email, role: "client", telephone: v.telephone, email: v.email, plaque: v.immatriculation,
              details: [
                { label: "Devis", value: v.numero },
                ...(trajet(v.depart, v.arrivee) ? [{ label: "Trajet", value: trajet(v.depart, v.arrivee)! }] : []),
                ...(euros(v.total_ttc ?? v.prix_estime) ? [{ label: "Montant", value: euros(v.total_ttc ?? v.prix_estime)! }] : []),
              ],
            };
            break;
          }
          case "facture": {
            const f = F.get(id);
            if (f) r = {
              qui: f.client_societe || nomDe(f.client_prenom, f.client_nom), role: "client", email: f.client_email, plaque: f.immatriculation,
              details: [
                { label: "Facture", value: f.numero },
                ...(f.numero_mission ? [{ label: "Mission", value: f.numero_mission }] : []),
                ...(euros(f.total_ttc) ? [{ label: "Montant TTC", value: euros(f.total_ttc)! }] : []),
              ],
            };
            break;
          }
          case "user":
          case "client": {
            const p = P.get(id);
            if (p) r = {
              qui: p.societe || nomDe(p.prenom, p.nom) || p.email, role: "client", avatar: p.avatar_url, telephone: p.telephone, email: p.email,
              details: [
                ...(p.societe && nomDe(p.prenom, p.nom) ? [{ label: "Contact", value: nomDe(p.prenom, p.nom) }] : []),
                ...(p.type_client ? [{ label: "Compte", value: p.type_client === "particulier" ? "Particulier" : p.type_client === "flotte" ? "Flotte" : "Professionnel" }] : []),
              ],
            };
            break;
          }
        }
        if (!r && CH.has(id)) {
          const ch = CH.get(id);
          const p = CP.get(String(ch.client_user_id ?? ch.convoyeur_user_id ?? ""));
          r = {
            qui: ch.visitor_name || nomDe(p?.prenom, p?.nom) || p?.societe || ch.visitor_email || "Visiteur",
            role: ch.convoyeur_user_id ? "convoyeur" : ch.client_user_id ? "client" : "visiteur",
            email: ch.visitor_email || p?.email, telephone: p?.telephone,
            details: ch.mission_reference ? [{ label: "Mission", value: ch.mission_reference }] : [],
          };
        }
        // à défaut, ce que la notification transporte déjà
        if (!r) {
          const qui = m.nom_complet || m.clientName || m.societe || nomDe(m.prenom, m.nom) || m.visitor_name;
          if (qui || m.email || m.telephone) r = { qui, email: m.email, telephone: m.telephone, details: [] };
        }
        if (r) {
          if (Array.isArray(m.documents) && m.documents.length) r.details.push({ label: "Documents", value: m.documents.join(", ").replace(/_/g, " ") });
          if (m.motif) r.details.push({ label: "Motif", value: String(m.motif) });
          out[n.id] = r;
        }
      }
      if (vivant) setCtx(out);
    })().catch(() => undefined);
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return ctx;
}
