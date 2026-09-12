import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { C, body, display } from "../theme";

export const useRise = (delay = 0, distance = 34) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return {
    opacity: interpolate(s, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)`,
  } as React.CSSProperties;
};

export const usePop = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 190 } });
  return {
    opacity: interpolate(s, [0, 0.4, 1], [0, 1, 1]),
    transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`,
  } as React.CSSProperties;
};

export const StepLabel: React.FC<{ index: string; title: string; dark?: boolean; delay?: number }> = ({
  index,
  title,
  dark,
  delay = 0,
}) => {
  const st = useRise(delay, 22);
  return (
    <div style={{ ...st, display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          fontFamily: body,
          fontSize: 20,
          letterSpacing: "0.34em",
          color: C.gold,
          fontWeight: 500,
        }}
      >
        {index}
      </div>
      <div style={{ width: 54, height: 1, background: C.gold, opacity: 0.7 }} />
      <div
        style={{
          fontFamily: display,
          fontSize: 46,
          color: dark ? C.text : C.cream,
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </div>
    </div>
  );
};

export const Panel: React.FC<{
  style?: React.CSSProperties;
  dark?: boolean;
  children?: React.ReactNode;
}> = ({ style, dark, children }) => (
  <div
    style={{
      borderRadius: 26,
      padding: 30,
      background: dark ? "rgba(255,255,255,0.05)" : "#ffffff",
      border: dark ? "1px solid rgba(231,199,106,0.28)" : "1px solid rgba(11,16,38,0.08)",
      boxShadow: dark ? "0 30px 70px rgba(0,0,0,0.35)" : "0 26px 60px rgba(11,16,38,0.12)",
      backdropFilter: undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Badge: React.FC<{ label: string; color?: string; style?: React.CSSProperties }> = ({
  label,
  color = C.blue,
  style,
}) => (
  <span
    style={{
      fontFamily: body,
      fontSize: 20,
      fontWeight: 500,
      padding: "8px 18px",
      borderRadius: 999,
      color,
      background: `${color}1f`,
      border: `1px solid ${color}55`,
      ...style,
    }}
  >
    {label}
  </span>
);

export const Field: React.FC<{ label: string; value: string; dark?: boolean }> = ({ label, value, dark }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span
      style={{
        fontFamily: body,
        fontSize: 17,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: dark ? C.muted : C.mutedDark,
      }}
    >
      {label}
    </span>
    <span style={{ fontFamily: body, fontSize: 28, fontWeight: 500, color: dark ? C.cream : C.text }}>
      {value}
    </span>
  </div>
);

export const Plate: React.FC<{ value: string; scale?: number }> = ({ value, scale = 1 }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      background: "#ffffff",
      border: "2px solid #0b1026",
      borderRadius: 8,
      overflow: "hidden",
      transform: `scale(${scale})`,
      transformOrigin: "left center",
    }}
  >
    <div style={{ background: "#003399", color: "#ffd200", fontFamily: body, fontSize: 16, padding: "10px 8px" }}>
      F
    </div>
    <div
      style={{
        fontFamily: body,
        fontWeight: 600,
        fontSize: 30,
        letterSpacing: "0.08em",
        color: "#0b1026",
        padding: "8px 16px 8px 2px",
      }}
    >
      {value}
    </div>
  </div>
);
