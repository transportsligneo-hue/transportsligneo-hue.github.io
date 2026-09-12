import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { C, body, display, navyBg } from "../theme";
import { Panel, StepLabel, Badge, useRise, usePop, Plate } from "../components/Kit";
import { PersistentAccents } from "../components/PersistentBackground";

const Row: React.FC<{ delay: number; ref_: string; trajet: string; plate: string; status: string; color: string }> = ({
  delay,
  ref_,
  trajet,
  plate,
  status,
  color,
}) => {
  const st = useRise(delay, 26);
  return (
    <div
      style={{
        ...st,
        display: "grid",
        gridTemplateColumns: "260px 1fr 260px 260px",
        alignItems: "center",
        padding: "22px 26px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ fontFamily: body, fontSize: 24, color: C.goldSoft }}>{ref_}</span>
      <span style={{ fontFamily: body, fontSize: 26, color: C.cream }}>{trajet}</span>
      <Plate value={plate} scale={0.7} />
      <div style={{ justifySelf: "end" }}>
        <Badge label={status} color={color} />
      </div>
    </div>
  );
};

export const Scene3Admin: React.FC = () => {
  const frame = useCurrentFrame();
  const assign = usePop(66);
  const glow = interpolate(frame % 60, [0, 30, 60], [0.25, 0.6, 0.25]);

  return (
    <AbsoluteFill style={{ background: navyBg, padding: "90px 120px" }}>
      <PersistentAccents />
      <StepLabel index="02" title="Réception et attribution côté Ligneo" />
      <Panel dark style={{ marginTop: 48, padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row delay={14} ref_="MIS-TLG-2026-#212" trajet="Tours → Lyon" plate="HM-850-HF" status="Nouvelle demande" color={C.gold} />
        <Row delay={26} ref_="MIS-TLG-2026-#211" trajet="Orléans → Nantes" plate="GE-402-KD" status="En cours" color={C.blue} />
        <Row delay={36} ref_="MIS-TLG-2026-#208" trajet="Tours → Tours" plate="FT-118-QS" status="Recharge uniquement" color={C.green} />
      </Panel>

      <Sequence from={60}>
        <div
          style={{
            ...assign,
            position: "absolute",
            right: 120,
            bottom: 90,
            width: 620,
          }}
        >
          <Panel dark style={{ boxShadow: `0 0 ${40 + glow * 60}px rgba(212,175,55,${glow * 0.5})` }}>
            <div style={{ fontFamily: body, fontSize: 20, letterSpacing: "0.22em", color: C.goldSoft }}>
              ATTRIBUTION
            </div>
            <div style={{ fontFamily: display, fontSize: 46, color: C.cream, marginTop: 10 }}>
              Convoyeur Julien M.
            </div>
            <div style={{ fontFamily: body, fontSize: 22, color: C.muted, marginTop: 8 }}>
              Notification envoyée · Mission acceptée
            </div>
          </Panel>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
