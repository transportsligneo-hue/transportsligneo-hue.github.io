import { Scene, isScene } from "@/components/NavScenes";
import { VroomyAvatar } from "@/components/VroomyAvatar";
import gpsCar from "@/assets/ligneo-gps-car.png";
import driverLogo from "@/assets/driver-v2/logo.png";

export type StoryArtKind =
  | "driver" | "gps" | "shield" | "plate" | "code" | "quote" | "photo" | "vroomy" | "google"
  | "linkedin" | "wheel" | "verified" | "card" | "api" | "demo" | "invoice";

const EU = Array.from({ length: 12 }).map((_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return <circle key={i} cx={12 + Math.cos(a) * 8} cy={12 + Math.sin(a) * 8} r="1.25" fill="#fff" />;
});

const ROUTE = "M30 190 C 90 190, 70 120, 150 118 S 232 60, 274 44";

function GpsArt() {
  return (
    <div className="gmap" style={{ ["--stv-car" as string]: `url(${gpsCar})` }}>
      <svg className="bgm" viewBox="0 0 310 226" aria-hidden="true">
        <rect width="310" height="226" fill="#0a1a4a" />
        <g stroke="rgba(120,160,255,.12)" strokeWidth="1"><path d="M0 40H310M0 90H310M0 140H310M0 190H310M50 0V226M110 0V226M170 0V226M230 0V226M290 0V226" /></g>
        <g stroke="rgba(150,190,255,.28)" strokeWidth="7" fill="none" strokeLinecap="round"><path d="M-10 120 330 70M60 -10 120 240M200 -10 230 240" /></g>
        <path d="M0 200c60-30 120 6 200-14s90-10 110 0v40H0z" fill="rgba(60,120,255,.14)" />
        <path d={ROUTE} fill="none" stroke="rgba(120,170,255,.28)" strokeWidth="6" strokeLinecap="round" />
        <path className="tr" pathLength={100} d={ROUTE} fill="none" stroke="#5aa0ff" strokeWidth="6" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px #3b8cff)" }} />
      </svg>
      <div className="st" />
      <div className="pin"><b /><i /></div>
      <div className="car" />
      <div className="chip"><em />Suivi en direct<span>Arrivée 14:32</span></div>
    </div>
  );
}

function PlateArt() {
  return (
    <div className="plq">
      <div className="pl-shell">
        <div className="pl-band"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">{EU}</svg><b>F</b></div>
        <span className="pl-t">AB-123-CD</span>
      </div>
      <div className="pl-ok">✓ Format valide</div>
      <div className="pl-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        Rechercher
      </div>
      <div className="pl-res">
        <h5><i />Véhicule trouvé</h5>
        <div className="pl-rw"><span>Marque</span><b>Renault</b></div>
        <div className="pl-rw"><span>Modèle</span><b>5 E-Tech</b></div>
        <div className="pl-rw"><span>VIN</span><b className="m">VF1…K4821</b></div>
        <div className="pl-rw"><span>Énergie</span><span className="pl-ev">⚡ ÉLECTRIQUE</span></div>
        <div className="pl-rw"><span>Mise en circulation</span><b>03/2024</b></div>
      </div>
    </div>
  );
}

const tic = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

function Brand() {
  return (
    <div className="br">
      <img src={driverLogo} alt="" />
      <div><b>TRANSPORTS LIGNEO</b><em>DRIVER</em></div>
    </div>
  );
}

function DriverPhone() {
  return (
    <div className="wph">
      <div className="in">
        <div className="sb"><span>9:41</span><i /><span>●●●</span></div>
        <div className="scr">
          <Brand />
          <h4>Bonjour Karim</h4><div className="sub">3 missions disponibles</div>
          <div className="st"><div><small>Ce mois</small><b>12</b></div><div><small>Gains</small><b>1 840 €</b></div></div>
          <div className="mc"><span className="ev">⚡ ÉLECTRIQUE</span>
            <div className="rt">Tours<u />Paris</div>
            <div className="mt"><span>238 km · 8h</span><b>186 €</b></div>
            <div className="cta">Accepter</div>
          </div>
        </div>
        <div className="scr">
          <Brand />
          <h4>Mission en cours</h4><div className="sub">Renault 5 · AB-123-CD</div>
          <div className="mp">
            <svg viewBox="0 0 154 98" aria-hidden="true"><path d="M0 60 154 30M44 0 60 98M100 0 118 98" stroke="#fff" strokeWidth="7" fill="none" /><path d="M14 80 C 40 80, 36 46, 72 46 S 104 20, 140 16" stroke="#14b866" strokeWidth="3.5" strokeLinecap="round" fill="none" /><circle cx="140" cy="16" r="5" fill="#ff5d73" /></svg>
            <div className="dot" />
          </div>
          <div className="pb"><i /></div>
          <div className="stp"><span>Prise en charge</span><span className="n">En route · 62 %</span><span className="f">Livraison</span></div>
          <div className="cta o">État des lieux photo</div>
        </div>
        <div className="scr">
          <Brand />
          <div className="okc"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
          <h4 style={{ textAlign: "center" }}>Mission terminée</h4>
          <div className="am">186,00 €</div><div className="ct">Paiement sous 7 jours</div>
        </div>
        <div className="tb">
          <span className="a">{tic(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)}</span>
          <span>{tic(<><path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>)}</span>
          <span>{tic(<><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /></>)}</span>
          <span>{tic(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>)}</span>
        </div>
      </div>
    </div>
  );
}

function GooglePlay() {
  return (
    <div className="gp">
      <svg width="26" height="28" viewBox="0 0 26 28" aria-hidden="true"><path d="M2 1.5v25l13-12.5z" fill="#00d6ff" /><path d="M2 1.5 15 14l4-4z" fill="#00f076" /><path d="M2 26.5 15 14l4 4z" fill="#ff3a44" /><path d="M19 10l5 3a1.3 1.3 0 0 1 0 2l-5 3-4-4z" fill="#ffd400" /></svg>
      <div><small>Bientôt sur</small><b>Google Play</b></div>
    </div>
  );
}

function CardArt() {
  return (
    <svg className="cardart" width="300" height="207" viewBox="0 0 66 46" aria-hidden="true">
      <defs><linearGradient id="stvcbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e3a8a" /><stop offset=".55" stopColor="#2563eb" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
      <rect x="3" y="5" width="60" height="38" rx="6" fill="url(#stvcbg)" stroke="rgba(255,255,255,.55)" strokeWidth="1" />
      <path d="M3 30c14-9 30-9 60-2v9a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" fill="rgba(255,255,255,.08)" />
      <rect x="9" y="13" width="11" height="8.5" rx="2" fill="#fbbf24" />
      <path d="M9 17.2h11M14.5 13v8.5" stroke="#b45309" strokeWidth=".7" />
      <path d="M26 14.5a5 5 0 0 1 0 5M29 12.5a8 8 0 0 1 0 9" stroke="#fff" strokeOpacity=".85" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <text x="9" y="31" fontSize="5.6" fontWeight="700" fill="#fff" fontFamily="'IBM Plex Mono',monospace" letterSpacing=".6">4242 4242 4242</text>
      <text x="9" y="38.5" fontSize="3.8" fontWeight="600" fill="#cfe0ff" fontFamily="Poppins,sans-serif" letterSpacing=".4">TRANSPORTS LIGNEO</text>
      <circle cx="50" cy="36" r="5" fill="#ef4444" fillOpacity=".95" /><circle cx="55.5" cy="36" r="5" fill="#f59e0b" fillOpacity=".95" />
    </svg>
  );
}

export function StoryArt({ kind }: { kind: StoryArtKind }) {
  if (kind === "gps") return <GpsArt />;
  if (kind === "plate") return <PlateArt />;
  if (kind === "vroomy") return <div className="vwrap"><VroomyAvatar size={228} /></div>;
  if (kind === "card") return <CardArt />;
  if (kind === "driver") return <div className="dcol"><DriverPhone /><GooglePlay /></div>;
  if (kind === "wheel") return <div className="dv"><div className="sc"><Scene kind="wheel" /></div><DriverPhone /></div>;
  if (isScene(kind)) return <div className="sc"><Scene kind={kind} /></div>;
  return null;
}
