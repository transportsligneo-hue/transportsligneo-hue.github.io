import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C, body, display, creamBg } from "../theme";
import { Panel, StepLabel, Badge, useRise } from "../components/Kit";

const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 120 } });
  const float = Math.sin(frame / 26) * 8;

  const steps = [
    { label: "Prise en charge", at: 22 },
    { label: "État des lieux départ", at: 46 },
    { label: "Photos 360° (12)", at: 70 },
    { label: "Signature convoyeur", at: 96 },
  ];

  return (
    <div
      style={{
        width: 400,
        height: 810,
        borderRadius: 52,
        background: C.navy,
        border: `2px solid ${C.gold}66`,
        padding: 26,
        boxShadow: "0 40px 90px rgba(11,16,38,0.35)",
        transform: `translateY(${interpolate(enter, [0, 1], [80, float])}px)`,
        opacity: enter,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ fontFamily: body, fontSize: 17, letterSpacing: "0.26em", color: C.goldSoft }}>
        LIGNEO DRIVER
      </div>
      <div style={{ fontFamily: display, fontSize: 32, color: C.cream }}>MIS-2026-#212</div>
      {steps.map((s, i) => {
        const p = spring({ frame: frame - s.at, fps, config: { damping: 200 } });
        return (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "18px 16px",
              borderRadius: 16,
              background: `rgba(47,191,113,${0.06 + p * 0.1})`,
              border: `1px solid rgba(47,191,113,${0.15 + p * 0.5})`,
              opacity: 0.35 + p * 0.65,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: p > 0.5 ? C.green : "rgba(255,255,255,0.08)",
                color: C.navy,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontFamily: body,
              }}
            >
              {p > 0.5 ? "✓" : i + 1}
            </div>
            <span style={{ fontFamily: body, fontSize: 22, color: C.cream }}>{s.label}</span>
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <div
        style={{
          borderRadius: 18,
          padding: "20px 0",
          textAlign: "center",
          background: C.gold,
          color: C.navy,
          fontFamily: body,
          fontWeight: 600,
          fontSize: 24,
          opacity: interpolate(frame, [110, 130], [0.3, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Démarrer le trajet
      </div>
    </div>
  );
};

export const Scene4Driver: React.FC = () => {
  const t = useRise(30, 30);
  const t2 = useRise(48, 30);
  return (
    <AbsoluteFill style={{ background: creamBg, padding: "80px 120px" }}>
      <StepLabel index="03" title="Le convoyeur exécute la mission" dark />
      <div style={{ display: "flex", gap: 80, marginTop: 40, alignItems: "flex-start" }}>
        <Phone />
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1, paddingTop: 40 }}>
          <Panel style={{ ...t }}>
            <div style={{ fontFamily: display, fontSize: 40, color: C.text }}>État des lieux guidé</div>
            <div style={{ fontFamily: body, fontSize: 24, color: C.mutedDark, marginTop: 10, lineHeight: 1.5 }}>
              Photos horodatées, dommages annotés, carte grise scannée
              automatiquement (plaque, VIN, énergie).
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <Badge label="12 photos" color={C.blue} />
              <Badge label="Scan carte grise" color={C.green} />
              <Badge label="Horodaté" color={C.gold} />
            </div>
          </Panel>
          <Panel style={{ ...t2 }}>
            <div style={{ fontFamily: display, fontSize: 40, color: C.text }}>Signatures électroniques</div>
            <div style={{ fontFamily: body, fontSize: 24, color: C.mutedDark, marginTop: 10, lineHeight: 1.5 }}>
              Convoyeur puis client : chaque étape verrouille le PV correspondant.
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};
