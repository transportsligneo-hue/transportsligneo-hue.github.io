/**
 * Fenêtre d'information affichée AVANT la demande de localisation Android
 * (exigée par Google Play pour la collecte de position en arrière-plan).
 * Renvoie true si le convoyeur accepte, false s'il refuse.
 */
export function showLocationDisclosure(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "lg-loc-title");
    root.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,18,12,.72);font-family:Poppins,system-ui,sans-serif";
    root.innerHTML = `
      <div style="width:100%;max-width:380px;background:#fff;color:#0f172a;border-radius:22px;padding:24px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.45)">
        <div style="width:48px;height:48px;border-radius:14px;background:#e6f7ee;display:flex;align-items:center;justify-content:center;margin-bottom:14px">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>
        </div>
        <h2 id="lg-loc-title" style="margin:0 0 10px;font-size:18px;line-height:1.25;font-weight:700">Suivi de votre position pendant la mission</h2>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#334155">
          Ligneo Driver collecte la position de votre téléphone <b>pendant une mission en cours</b>, y compris lorsque l'application est en arrière-plan ou que l'écran est éteint.
        </p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#334155">
          Elle est partagée en direct avec Transports Ligneo et le client, pour suivre le véhicule jusqu'à l'arrivée. Une notification reste affichée tant que le suivi est actif.
        </p>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.45;color:#64748b">
          Aucune position n'est collectée en dehors d'une mission.
        </p>
        <div style="display:flex;gap:10px">
          <button type="button" data-a="no" style="flex:1;height:46px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;color:#334155;font:600 14px Poppins,system-ui,sans-serif">Refuser</button>
          <button type="button" data-a="yes" style="flex:1;height:46px;border-radius:14px;border:0;background:#16a34a;color:#fff;font:700 14px Poppins,system-ui,sans-serif">Accepter</button>
        </div>
      </div>`;
    const done = (v: boolean) => { root.remove(); resolve(v); };
    root.querySelector('[data-a="yes"]')?.addEventListener("click", () => done(true));
    root.querySelector('[data-a="no"]')?.addEventListener("click", () => done(false));
    document.body.appendChild(root);
  });
}
