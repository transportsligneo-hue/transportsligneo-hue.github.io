import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldCheck, PenLine, CreditCard } from "lucide-react";
import { DevisEmbeddedCheckout } from "@/components/devis/DevisEmbeddedCheckout";

type PublicDevis = {
  numero: string;
  statut: string;
  prenom: string | null;
  nom: string | null;
  depart: string;
  arrivee: string;
  distanceKm: number | null;
  optionTrajet: string | null;
  dateSouhaitee: string | null;
  prix: number;
  avoir: number;
  aRegler: number;
  signed: boolean;
  signedAt: string | null;
  paid: boolean;
  refused: boolean;
  expiresAt: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  lienPaiementExterne?: string | null;
};

export const Route = createFileRoute("/devis/$token")({
  component: DevisPublicPage,
  head: () => ({
    meta: [
      { title: "Votre devis de convoyage — Transports Ligneo" },
      {
        name: "description",
        content:
          "Consultez, signez électroniquement et réglez votre devis de convoyage Transports Ligneo en toute sécurité.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Votre devis de convoyage — Transports Ligneo" },
      {
        property: "og:description",
        content: "Signature électronique par code et paiement sécurisé de votre devis de convoyage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DevisPublicPage() {
  const { token } = Route.useParams();
  const [devis, setDevis] = useState<PublicDevis | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ method: "sms" | "email"; destination: string } | null>(null);
  const [showPay, setShowPay] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/devis/view?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = (await res.json()) as PublicDevis;
      setDevis(data);
      if (data.signed && !data.paid && data.aRegler >= 1) setShowPay(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showPay && typeof window !== "undefined" && window.location.hash === "#paiement") {
      document.getElementById("paiement")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [showPay]);

  const requestCode = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/public/devis/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "request" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Envoi impossible");
      setSent({ method: data.method, destination: data.destination });
      toast.success(
        data.method === "sms"
          ? `Code envoyé par SMS au ${data.destination}`
          : `Code envoyé par e-mail à ${data.destination}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Saisissez les 6 chiffres du code");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/public/devis/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "verify", code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Vérification impossible");
      setCode("");
      toast.success("Devis signé — merci !");
      await load();
      if (data.requiresPayment) setShowPay(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vérification impossible");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </main>
    );
  }

  if (notFound || !devis) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Devis introuvable</h1>
          <p className="mt-2 text-muted-foreground">Ce lien est invalide ou a expiré.</p>
        </div>
      </main>
    );
  }

  const returnUrl =
    typeof window !== "undefined" ? `${window.location.origin}/devis/${token}?paye=1` : "/";

  return (
    <main className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Transports Ligneo</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Devis {devis.numero}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {devis.prenom ? `Bonjour ${devis.prenom}, ` : ""}voici le récapitulatif de votre convoyage.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <dl className="space-y-3 text-sm">
            <Row label="Trajet" value={`${devis.depart} → ${devis.arrivee}`} />
            {devis.optionTrajet ? <Row label="Prestation" value={devis.optionTrajet} /> : null}
            {devis.distanceKm ? <Row label="Distance" value={`${devis.distanceKm} km`} /> : null}
            {devis.dateSouhaitee ? (
              <Row
                label="Date souhaitée"
                value={new Date(devis.dateSouhaitee).toLocaleDateString("fr-FR")}
              />
            ) : null}
            {devis.avoir > 0 ? <Row label="Avoir fidélité" value={`− ${devis.avoir.toFixed(2)} €`} /> : null}
          </dl>
          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Montant TTC</span>
            <span className="text-2xl font-semibold text-foreground">
              {devis.aRegler.toFixed(2)} €
            </span>
          </div>
        </section>

        {devis.refused ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Ce devis a été refusé. Contactez-nous pour une nouvelle proposition.
          </p>
        ) : devis.signed ? (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 size={18} /> Devis signé
              {devis.signedAt
                ? ` le ${new Date(devis.signedAt).toLocaleString("fr-FR")}`
                : ""}
            </p>
            {devis.paid ? (
              <p className="mt-1 text-sm text-muted-foreground">Paiement reçu — merci !</p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <PenLine size={18} className="text-primary" /> Accepter et signer le devis
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nous vous envoyons un code à 6 chiffres
              {devis.maskedPhone ? ` par SMS au ${devis.maskedPhone}` : devis.maskedEmail ? ` par e-mail à ${devis.maskedEmail}` : ""}.
              Il est valable 10 minutes.
            </p>

            {!sent ? (
              <button
                type="button"
                onClick={requestCode}
                disabled={sending}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Recevoir mon code de signature
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Code envoyé {sent.method === "sms" ? "par SMS au" : "par e-mail à"}{" "}
                  <strong>{sent.destination}</strong>.
                </p>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] text-foreground"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={verifying || code.length !== 6}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {verifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Valider ma signature
                  </button>
                  <button
                    type="button"
                    onClick={requestCode}
                    disabled={sending}
                    className="rounded-lg border border-border px-5 py-3 text-sm text-foreground disabled:opacity-60"
                  >
                    Renvoyer le code
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  5 tentatives maximum, 3 renvois par tranche de 10 minutes.
                </p>
              </div>
            )}
          </section>
        )}

        {showPay && !devis.paid && devis.aRegler >= 1 ? (
          <section id="paiement" className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <CreditCard size={18} className="text-primary" /> Paiement sécurisé
            </h2>
            <DevisEmbeddedCheckout token={token} returnUrl={returnUrl} />
          </section>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Lien personnel et confidentiel — ne le transmettez pas.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
