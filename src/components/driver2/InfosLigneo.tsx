import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ic } from "@/components/driver2/icons";
import { useInfosLigneo, type InfoKind, type InfoLigneo } from "@/hooks/useInfosLigneo";
import { VroomyAvatar } from "@/components/VroomyAvatar";
const logo = "/icons/logo-driver-app.png";

// Teintes sourdes et sobres : un simple point de couleur identifie le type, pas de pictogramme.
const KIND: Record<InfoKind, { label: string; tone: string }> = {
  urgent: { label: "Urgent", tone: "#d6685f" },
  maintenance: { label: "Maintenance", tone: "#7f9bc9" },
  changement: { label: "Changement", tone: "#9a8cd9" },
  nouveau: { label: "Nouveauté", tone: "#4aa886" },
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");

/** Bandeau « Infos Ligneo » de l'accueil : les infos non lues, ouvrables en plein écran. */
export function InfosLigneoBar() {
  const { infos, markRead } = useInfosLigneo();
  const [openId, setOpenId] = useState<string | null>(null);
  // Les bulles restent affichées jusqu'à la fin de la lecture, puis disparaissent.
  const [shown, setShown] = useState<string[] | null>(null);
  useEffect(() => {
    if (shown === null && infos.length) setShown(infos.filter((i) => !i.lue).map((i) => i.id));
  }, [infos, shown]);

  const queue = infos; // lecture dans l'ordre de publication
  const list = infos.filter((i) => (shown ?? []).includes(i.id) && !i.lue);

  return (
    <>
      {list.length > 0 && (
        <div className="drv2">
          <section className="inf2">
            <header><span>Infos Ligneo</span><em>{list.length} à lire</em></header>
            {list.slice(0, 3).map((x) => {
              const k = KIND[x.kind];
              return (
                <button key={x.id} className="inf2-row" style={{ ["--tone" as string]: k.tone }} onClick={() => setOpenId(x.id)}>
                  <i />
                  <span><small>{k.label}</small><b>{x.titre}</b></span>
                  <Ic n="chev" s={14} sw={2.2} />
                </button>
              );
            })}
            {list.length > 3 && <p className="inf2-more">+ {list.length - 3} autre{list.length - 3 > 1 ? "s" : ""}</p>}
          </section>
        </div>
      )}
      {openId && typeof document !== "undefined" &&
        createPortal(
          <StoryViewer queue={queue} startId={openId} onSeen={(id) => void markRead(id)} onClose={() => setOpenId(null)} />,
          document.body,
        )}
    </>
  );
}

function StoryViewer({ queue, startId, onSeen, onClose }: { queue: InfoLigneo[]; startId: string; onSeen: (id: string) => void; onClose: () => void }) {
  const [i, setI] = useState(Math.max(0, queue.findIndex((q) => q.id === startId)));
  const timer = useRef<number | undefined>(undefined);
  const x = queue[i];

  const next = useCallback(() => {
    if (i < queue.length - 1) setI(i + 1); else onClose();
  }, [i, queue.length, onClose]);

  useEffect(() => {
    if (!x) return;
    onSeen(x.id);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(next, 8000);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!x) return null;
  const k = KIND[x.kind];
  const paras = x.corps.split(/\n\n/).map((p) => p.split("\n"));

  return (
    <div className="drv2">
      <div className="inf2-story" style={{ ["--tone" as string]: k.tone }}>
        <div className="inf2-prog">
          {queue.map((q, n) => (<i key={q.id} className={n < i ? "done" : n === i ? "run" : ""}><b /></i>))}
        </div>
        <div className="inf2-top">
          <img src={logo} alt="" />
          <div><b>Infos Ligneo</b><small>{x.publieLe ? `Publié le ${fmtDate(x.publieLe)}` : "Transports Ligneo"}</small></div>
          <button onClick={onClose} aria-label="Fermer"><Ic n="x" s={20} sw={2.2} /></button>
        </div>
        <div className="inf2-body">
          <span className="inf2-tag"><i />{k.label}</span>
          <h2>{x.titre}</h2>
          <div className="inf2-text">
            {paras.map((lines, n) => (
              <p key={n}>{lines.map((l, m) => (<span key={m}>{l}{m < lines.length - 1 && <br />}</span>))}</p>
            ))}
          </div>
          <div className="inf2-vroomy"><VroomyAvatar size={72} /></div>
        </div>
        <button className="inf2-tap l" onClick={() => setI(Math.max(0, i - 1))} aria-label="Précédent" />
        <button className="inf2-tap r" onClick={next} aria-label="Suivant" />
      </div>
    </div>
  );
}
