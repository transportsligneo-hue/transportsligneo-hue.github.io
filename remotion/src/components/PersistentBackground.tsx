import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C } from "../theme";

export const PersistentAccents: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (speed: number, amp: number, phase = 0) =>
    Math.sin((frame / speed) + phase) * amp;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          border: `1px solid ${C.gold}`,
          opacity: 0.1,
          left: -180 + drift(90, 24),
          top: -160 + drift(70, 18),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 380,
          height: 380,
          borderRadius: "50%",
          border: `1px solid ${C.gold}`,
          opacity: 0.09,
          right: -90 + drift(110, 30, 1.4),
          bottom: -120 + drift(85, 20, 0.6),
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(120deg, transparent 40%, rgba(212,175,55,0.05) 50%, transparent 60%)`,
          transform: `translateX(${interpolate(frame % 300, [0, 300], [-400, 400])}px)`,
        }}
      />
    </AbsoluteFill>
  );
};
