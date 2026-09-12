import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { C, display, body, navyBg } from "../theme";
import { useRise, usePop } from "../components/Kit";
import { PersistentAccents } from "../components/PersistentBackground";

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = usePop(4);
  const t1 = useRise(18, 26);
  const t2 = useRise(28, 26);
  const line = interpolate(frame, [34, 62], [0, 620], { extrapolateRight: "clamp" });
  const tag = useRise(48, 18);

  return (
    <AbsoluteFill style={{ background: navyBg }}>
      <PersistentAccents />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 150 }}>
        <div style={{ ...logo, marginBottom: 40 }}>
          <Img src={staticFile("images/logo.png")} style={{ height: 130 }} />
        </div>
        <div
          style={{
            ...t1,
            fontFamily: display,
            fontSize: 96,
            color: C.cream,
            letterSpacing: "0.16em",
            lineHeight: 1,
          }}
        >
          TRANSPORTS
        </div>
        <div
          style={{
            ...t2,
            fontFamily: display,
            fontSize: 96,
            color: C.gold,
            letterSpacing: "0.16em",
            lineHeight: 1.15,
          }}
        >
          LIGNEO
        </div>
        <div style={{ width: line, height: 1, background: C.gold, opacity: 0.8, margin: "34px 0 26px" }} />
        <div
          style={{
            ...tag,
            fontFamily: body,
            fontWeight: 300,
            fontSize: 32,
            color: C.muted,
            letterSpacing: "0.12em",
          }}
        >
          Votre logistique automobile sur toute la ligne
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
