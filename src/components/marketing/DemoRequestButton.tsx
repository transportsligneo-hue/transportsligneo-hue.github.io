import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { MonitorPlay, X } from "lucide-react";
import { toast } from "sonner";
import { requestDemo } from "@/lib/demo-access.functions";

export function DemoRequestForm({ onDone }: { onDone?: () => void }) {
  const send = useServerFn(requestDemo);
  const [f, setF] = useState({ nom: "", societe: "", email: "", telephone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await send({ data: f });
      setDone(true);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible, vérifiez les champs.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <p className="demo-req-ok">
        Votre demande a bien été transmise. Un conseiller Ligneo vous envoie vos accès sous peu — pensez à regarder dans vos spams.
      </p>
    );

  return (
    <form onSubmit={submit} className="demo-req-form">
      <input required minLength={2} placeholder="Nom et prénom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
      <input required placeholder="Société" value={f.societe} onChange={(e) => setF({ ...f, societe: e.target.value })} />
      <input required type="email" placeholder="E-mail professionnel" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input type="tel" placeholder="Téléphone (facultatif)" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      <button type="submit" className="demo-req-submit" disabled={busy}>
        {busy ? "Envoi…" : "Recevoir mon accès démo"}
      </button>
    </form>
  );
}

export function DemoRequestButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return (
    <>
      <button type="button" className={`demo-req-btn ${className}`} onClick={() => setOpen(true)}>
        <MonitorPlay size={15} aria-hidden /> Demander une démo
      </button>
      {open && createPortal(
        <div className="demo-req-overlay" role="dialog" aria-modal="true" aria-label="Demander une démo" onClick={() => setOpen(false)}>
          <div className="demo-req-modal demo-req-modal--pro" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="demo-req-close" aria-label="Fermer" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
            <p className="demo-req-eyebrow"><MonitorPlay size={13} aria-hidden /> Espace professionnel</p>
            <h3 className="demo-req-title">Demandez votre <span>démo privée</span></h3>
            <p className="demo-req-sub">Recevez par e-mail un lien personnel pour découvrir l'espace pro Ligneo.</p>
            <ul className="demo-req-features">
              <li>Tableau de bord, indicateurs et missions en direct</li>
              <li>Suivi GPS et comparaison des photos départ / arrivée</li>
              <li>Calendrier, rapports et export pour la comptabilité</li>
              <li>Gestion d'équipe : administrateur, logistique, comptabilité</li>
            </ul>
            <div className="demo-req-badges">
              <span>Sans engagement</span><span>Lien valable 7 jours</span><span>Sans mot de passe</span>
            </div>
            <DemoRequestForm />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
