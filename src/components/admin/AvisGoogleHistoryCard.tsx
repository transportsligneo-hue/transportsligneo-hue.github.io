/**
 * Historique des demandes d'avis Google (email / SMS).
 * Affiche chaque envoi et permet de visualiser le rendu exact du template envoyé.
 */
import { useEffect, useMemo, useState } from "react";
import { History, Mail, Smartphone, Eye, RefreshCw, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Badge } from "@/components/admin/AdminUI";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Row {
  id: string;
  attribution_id: string;
  trajet_id: string | null;
  recipient_type: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_name: string | null;
  channel: string;
  status: string;
  sent_at: string;
  auto: boolean;
}

interface Enriched extends Row {
  numero: string | null;
  depart: string | null;
  arrivee: string | null;
}

const STATUS: Record<string, { label: string; tone: "success" | "danger" | "info" }> = {
  sent: { label: "Envoyé", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
  review_left: { label: "Avis laissé", tone: "info" },
};

function buildSmsBody(shortUrl: string): string {
  return `Transports Ligneo - Bonjour, votre véhicule a bien été livré par notre convoyeur. Si vous êtes satisfait, un avis nous aiderait beaucoup : ${shortUrl}`;
}

export function AvisGoogleHistoryCard() {
  const [rows, setRows] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewUrl, setReviewUrl] = useState("");
  const [preview, setPreview] = useState<{ row: Enriched; html: string | null; sms: string | null } | null>(null);
  const [filter, setFilter] = useState<"all" | "email" | "sms">("all");

  const load = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: setting }] = await Promise.all([
      supabase
        .from("mission_review_requests")
        .select(
          "id, attribution_id, trajet_id, recipient_type, recipient_email, recipient_phone, recipient_name, channel, status, sent_at, auto",
        )
        .order("sent_at", { ascending: false })
        .limit(200),
      supabase.from("app_settings").select("value").eq("key", "google_review").maybeSingle(),
    ]);
    setReviewUrl(((setting as { value?: { url?: string } } | null)?.value?.url ?? "") as string);

    const list = ((reqs as Row[] | null) ?? []);
    const attrIds = [...new Set(list.map((r) => r.attribution_id))];
    const trajetIds = [...new Set(list.map((r) => r.trajet_id).filter(Boolean))] as string[];

    const [{ data: attrs }, { data: trajets }] = await Promise.all([
      attrIds.length
        ? supabase.from("attributions").select("id, numero_mission").in("id", attrIds)
        : Promise.resolve({ data: [] as { id: string; numero_mission: string | null }[] }),
      trajetIds.length
        ? supabase.from("trajets").select("id, depart, arrivee").in("id", trajetIds)
        : Promise.resolve({ data: [] as { id: string; depart: string | null; arrivee: string | null }[] }),
    ]);

    const attrMap = new Map((attrs ?? []).map((a) => [a.id, a.numero_mission]));
    const trajetMap = new Map((trajets ?? []).map((t) => [t.id, t]));

    setRows(
      list.map((r) => {
        const t = r.trajet_id ? trajetMap.get(r.trajet_id) : undefined;
        return {
          ...r,
          numero: attrMap.get(r.attribution_id) ?? null,
          depart: t?.depart ?? null,
          arrivee: t?.arrivee ?? null,
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : r.channel.includes(filter))),
    [rows, filter],
  );

  const openPreview = async (row: Enriched) => {
    setPreview({ row, html: null, sms: null });
    const isSmsOnly = row.channel === "sms";
    const sms = row.channel.includes("sms") ? buildSmsBody(reviewUrl || "https://…") : null;
    let html: string | null = null;
    if (!isSmsOnly) {
      const [{ render }, mod, React] = await Promise.all([
        import("@react-email/components"),
        import("@/lib/email-templates/avis-google"),
        import("react"),
      ]);
      html = await render(
        React.createElement(mod.template.component as never, {
          prenom: (row.recipient_name ?? "").trim().split(" ")[0] || undefined,
          numero: row.numero ?? undefined,
          depart: row.depart ?? undefined,
          arrivee: row.arrivee ?? undefined,
          reviewUrl: reviewUrl || undefined,
          isContactLivraison: row.recipient_type === "contact_livraison",
        } as never),
      );
    }
    setPreview({ row, html, sms });
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-pro-text flex items-center gap-2">
          <History size={16} className="text-pro-accent" />
          Historique des demandes d'avis
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "email" | "sms")}
            className="rounded-md border border-pro-border bg-transparent px-2 py-1 text-xs text-pro-text outline-none focus:border-pro-accent"
          >
            <option value="all">Tous les canaux</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()} disabled={loading}>
            Actualiser
          </Button>
        </div>
      </div>

      <p className="text-xs text-pro-muted mt-1">
        Toutes les demandes envoyées (manuelles et automatiques), avec le contenu exact du message reçu.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-pro-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Mission</th>
              <th className="py-2 pr-3 font-medium">Destinataire</th>
              <th className="py-2 pr-3 font-medium">Canal</th>
              <th className="py-2 pr-3 font-medium">Statut</th>
              <th className="py-2 pr-3 font-medium">Origine</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-pro-muted">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-pro-muted">
                  Aucune demande d'avis envoyée pour le moment.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, tone: "info" as const };
              return (
                <tr key={r.id} className="border-t border-pro-border/60">
                  <td className="py-2 pr-3 whitespace-nowrap text-pro-muted">
                    {new Date(r.sent_at).toLocaleDateString("fr-FR")}{" "}
                    {new Date(r.sent_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap font-medium text-pro-text">{r.numero ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className="block text-pro-text">
                      {r.recipient_name || (r.recipient_type === "client" ? "Client" : "Contact livraison")}
                    </span>
                    <span className="block text-[11px] text-pro-muted">
                      {[r.recipient_email, r.recipient_phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1 text-pro-text">
                      {r.channel.includes("email") && <Mail size={12} />}
                      {r.channel.includes("sms") && <Smartphone size={12} />}
                      {r.channel}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={st.tone}>
                      {r.status === "failed" ? <AlertTriangle size={11} /> : r.status === "review_left" ? <Star size={11} /> : <CheckCircle2 size={11} />}
                      <span className="ml-1">{st.label}</span>
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-pro-muted">{r.auto ? "Automatique" : "Manuel"}</td>
                  <td className="py-2 text-right">
                    <Button icon={<Eye size={13} />} onClick={() => void openPreview(r)}>
                      Voir le message
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Message envoyé {preview?.row.numero ? `— ${preview.row.numero}` : ""}
            </DialogTitle>
          </DialogHeader>
          {preview?.sms && (
            <div className="rounded-lg border border-pro-border bg-pro-surface p-3 text-xs text-pro-text">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-pro-muted">SMS</p>
              {preview.sms}
            </div>
          )}
          {preview && preview.row.channel !== "sms" && (
            <div className="rounded-lg border border-pro-border overflow-hidden bg-white">
              {preview.html ? (
                <iframe title="Aperçu email" srcDoc={preview.html} className="h-[60vh] w-full border-0" />
              ) : (
                <div className="p-6 text-center text-xs text-pro-muted">Génération de l'aperçu…</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
