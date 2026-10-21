import { Link } from "@tanstack/react-router";
import { Ic } from "@/components/driver2/icons";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useDriverIdentity } from "@/hooks/useDriverIdentity";

interface Entry {
  to: string;
  label: string;
  sub: string;
  icon: string;
}

const ACTIVITE: Entry[] = [
  { to: "/convoyeur/disponibilites", label: "Disponibilités", sub: "Mon agenda", icon: "cal" },
  { to: "/convoyeur/historique", label: "Historique", sub: "Missions terminées", icon: "hist" },
  { to: "/convoyeur/finances", label: "Finances", sub: "Revenus et paiements", icon: "wallet" },
];

const ESPACE: Entry[] = [
  { to: "/convoyeur/documents", label: "Documents", sub: "Permis, RIB, KBis…", icon: "folder" },
  { to: "/convoyeur/materiel", label: "Mon matériel", sub: "Véhicules, plateau, W Garage…", icon: "truck" },
  { to: "/convoyeur/formation", label: "Formation", sub: "Se former chez Ligneo", icon: "grad" },
  { to: "/convoyeur/profil", label: "Mon profil", sub: "Informations personnelles", icon: "user" },
];

/** Menu « Plus » de l'appli Driver. Ouvert par le dock et par le bouton menu de l'en-tête. */
export function DriverPlusSheet({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const me = useDriverIdentity();
  const dark = theme === "dark";

  const row = (e: Entry) => (
    <Link key={e.to} to={e.to} className="pl-it" onClick={onClose}>
      <span className="pl-ic"><Ic n={e.icon} s={19} sw={2.1} /></span>
      <div className="sp"><b>{e.label}</b><small>{e.sub}</small></div>
      <span className="pl-ch"><Ic n="chev" s={14} sw={2.4} /></span>
    </Link>
  );

  return (
    <div className="drv2">
      <div className="overlay" onClick={onClose}>
        <div className="sheet plus" onClick={(e) => e.stopPropagation()}>
          <div className="grab" />
          <div className="pl-head">
            {me.avatarUrl ? (
              <div className="hm-av has-photo" style={{ backgroundImage: `url(${me.avatarUrl})` }} />
            ) : (
              <div className="hm-av">{me.initiales}</div>
            )}
            <div className="sp">
              <b>{`${me.prenom} ${me.nom}`.trim() || "Mon compte"}</b>
              <small>Convoyeur{me.ville ? ` · ${me.ville}` : ""}</small>
            </div>
            <button className="hbtn" onClick={onClose} aria-label="Fermer"><Ic n="x" s={16} /></button>
          </div>

          <div className="pl-sec">Mon activité</div>
          <div className="pl-card">{ACTIVITE.map(row)}</div>

          <div className="pl-sec">Mon espace</div>
          <div className="pl-card">{ESPACE.map(row)}</div>

          <div className="pl-sec">Préférences</div>
          <div className="pl-card">
            <a className="pl-it" onClick={() => setTheme(dark ? "light" : "dark")}>
              <span className="pl-ic"><Ic n={dark ? "sun" : "moon"} s={19} sw={2.1} /></span>
              <div className="sp"><b>{dark ? "Thème clair" : "Thème sombre"}</b><small>Changer l'apparence</small></div>
              <span className={`pl-sw${dark ? " on" : ""}`}><i /></span>
            </a>
            <a className="pl-it pl-out" onClick={() => { onClose(); void logout(); }}>
              <span className="pl-ic"><Ic n="out" s={19} sw={2.1} /></span>
              <div className="sp"><b>Se déconnecter</b><small>Fermer la session</small></div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
