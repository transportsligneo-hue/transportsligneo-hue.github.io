import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, body, display, navyBg } from "../theme";
import { Panel, StepLabel, useRise } from "../components/Kit";
import { PersistentAccents } from "../components/PersistentBackground";

const PATH = "M 90 470 C 260 380, 430 470, 580 360 S 860 210, 1020 130";
const LEN = 1250;

export const Scene5Trajet: React.FC = () => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [18, 105], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const dash = LEN * (1 - p);
  const km = Math.round(interpolate(p, [0, 1], [0, 486]));
  const stats = useRise(40, 26);

  // approximate marker position along a similar curve
  const mx = interpolate(p, [0, 0.5, 1], [90, 580, 1020]);
  const my = interpolate(p, [0, 0.5, 1], [470, 360, 130]);

  return (
    <AbsoluteFill style={{ background: navyBg, padding: "80px 120px" }}>
      <PersistentAccents />
      <StepLabel index="04" title="Suivi GPS en temps réel" />
      <div style={{ display: "flex", gap: 50, marginTop: 30, alignItems: "center" }}>
        <Panel dark style={{ width: 1120, height: 560, position: "relative", padding: 0, overflow: "hidden" }}>
          <svg width={1120} height={560} viewBox="0 0 1120 560">
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0%" stopColor={C.blue} />
                <stop offset="100%" stopColor={C.gold} />
              </linearGradient>
            </defs>
            {[...Array(9)].map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 62} x2={1120} y2={i * 62} stroke="rgba(255,255,255,0.05)" />
            ))}
            {[...Array(18)].map((_, i) => (
              <line key={`v${i}`} x1={i * 62} y1={0} x2={i * 62} y2={560} stroke="rgba(255,255,255,0.05)" />
            ))}
            <path d={PATH} stroke="rgba(255,255,255,0.12)" strokeWidth={6} fill="none" strokeLinecap="round" />
            <path
              d={PATH}
              stroke="url(#g)"
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={LEN}
              strokeDashoffset={dash}
            />
            <circle cx={90} cy={470} r={12} fill={C.cream} />
            <circle cx={1020} cy={130} r={12} fill={C.gold} />
            <circle cx={mx} cy={my} r={26} fill={C.blue} opacity={0.22} />
            <circle cx={mx} cy={my} r={12} fill={C.blue} />
            <text x={110} y={512} fill={C.muted} fontFamily={body} fontSize={24}>
              Tours
            </text>
            <text x={950} y={110} fill={C.goldSoft} fontFamily={body} fontSize={24}>
              Lyon
            </text>
          </svg>
        </Panel>

        <div style={{ ...stats, display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
          {[
            { l: "Distance parcourue", v: `${km} km` },
            { l: "Statut", v: p < 0.98 ? "En route" : "Arrivé" },
            { l: "Arrivée estimée", v: "16 h 40" },
            { l: "Signal", v: "Frais · 12 s" },
          ].map((s) => (
            <Panel key={s.l} dark style={{ padding: 22 }}>
              <div style={{ fontFamily: body, fontSize: 18, letterSpacing: "0.18em", color: C.muted }}>
                {s.l.toUpperCase()}
              </div>
              <div style={{ fontFamily: display, fontSize: 42, color: C.cream }}>{s.v}</div>
            </Panel>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
