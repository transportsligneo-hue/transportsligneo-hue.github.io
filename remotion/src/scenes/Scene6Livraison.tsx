import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, body, display, creamBg } from "../theme";
import { Panel, StepLabel, Badge, useRise, usePop } from "../components/Kit";

const Doc: React.FC<{ title: string; sub: string; delay: number; tilt: number }> = ({ title, sub, delay, tilt }) => {
  const st = usePop(delay);
  return (
    <Panel
      style={{
        ...st,
        width: 330,
        height: 400,
        transform: `${st.transform} rotate(${tilt}deg)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ width: 54, height: 3, background: C.gold, marginBottom: 20 }} />
        <div style={{ fontFamily: display, fontSize: 34, color: C.text, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontFamily: body, fontSize: 20, color: C.mutedDark, marginTop: 10 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[0.9, 0.7, 0.55].map((w, i) => (
          <div key={i} style={{ height: 8, width: `${w * 100}%`, background: "rgba(11,16,38,0.07)", borderRadius: 4 }} />
        ))}
      </div>
    </Panel>
  );
};

export const Scene6Livraison: React.FC = () => {
  const frame = useCurrentFrame();
  const sign = interpolate(frame, [10, 46], [0, 1], { extrapolateRight: "clamp" });
  const head = useRise(0, 20);
  const outro = interpolate(frame, [96, 118], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: creamBg }}>
      <AbsoluteFill style={{ padding: "80px 120px", opacity: 1 - outro }}>
        <div style={head}>
          <StepLabel index="05" title="Livraison et clôture" dark />
        </div>
        <div style={{ display: "flex", gap: 34, marginTop: 46, alignItems: "center" }}>
          <Panel style={{ width: 430, height: 400, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ fontFamily: body, fontSize: 20, letterSpacing: "0.2em", color: C.mutedDark }}>
              SIGNATURE CLIENT
            </div>
            <svg width={360} height={150} viewBox="0 0 360 150">
              <path
                d="M 20 110 C 70 20, 100 140, 140 70 S 210 10, 250 90 S 320 60, 340 40"
                stroke={C.navy}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={480}
                strokeDashoffset={480 * (1 - sign)}
              />
            </svg>
            <div style={{ display: "flex", gap: 12 }}>
              <Badge label="Mission terminée" color={C.green} />
            </div>
          </Panel>
          <Doc title="PV de livraison" sub="Signé et horodaté" delay={40} tilt={-2} />
          <Doc title="Facture FAC-2026-#418" sub="486 € HT · PO 4471" delay={56} tilt={2} />
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: C.navy,
          opacity: outro,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div style={{ fontFamily: display, fontSize: 84, color: C.cream, letterSpacing: "0.14em" }}>
          TRANSPORTS <span style={{ color: C.gold }}>LIGNEO</span>
        </div>
        <div style={{ width: 240, height: 1, background: C.gold, opacity: 0.8 }} />
        <div style={{ fontFamily: body, fontWeight: 300, fontSize: 30, color: C.muted, letterSpacing: "0.1em" }}>
          transportsligneo.fr · 07 82 45 61 81
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
