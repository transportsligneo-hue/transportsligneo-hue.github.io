import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C, display, body, creamBg } from "../theme";
import { Panel, StepLabel, Field, Badge, useRise, usePop, Plate } from "../components/Kit";

export const Scene2Demande: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = useRise(10, 44);
  const price = spring({ frame: frame - 64, fps, config: { damping: 16, stiffness: 160 } });
  const amount = Math.round(interpolate(price, [0, 1], [0, 486]));
  const devis = usePop(96);

  return (
    <AbsoluteFill style={{ background: creamBg, padding: "90px 120px" }}>
      <StepLabel index="01" title="Le client demande son convoyage" dark />
      <div style={{ display: "flex", gap: 40, marginTop: 54 }}>
        <Panel style={{ ...card, width: 760, display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ fontFamily: body, fontSize: 22, letterSpacing: "0.2em", color: C.mutedDark }}>
            ESTIMATEUR EN LIGNE
          </div>
          <Field label="Départ" value="Tours (37)" />
          <div style={{ height: 1, background: "rgba(11,16,38,0.08)" }} />
          <Field label="Livraison" value="Lyon (69)" />
          <div style={{ height: 1, background: "rgba(11,16,38,0.08)" }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
            <Field label="Véhicule" value="Audi A3 Sportback" />
            <Plate value="HM-850-HF" scale={0.85} />
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <Badge label="Roulant" color={C.green} />
            <Badge label="Livraison simple" color={C.blue} />
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, flex: 1 }}>
          <Panel style={{ background: C.navy, border: `1px solid ${C.gold}55` }} dark>
            <div style={{ fontFamily: body, fontSize: 20, letterSpacing: "0.22em", color: C.goldSoft }}>
              ESTIMATION IMMÉDIATE
            </div>
            <div style={{ fontFamily: display, fontSize: 96, color: C.cream, lineHeight: 1.1 }}>
              {amount} €
            </div>
            <div style={{ fontFamily: body, fontSize: 22, color: C.muted }}>HT · 486 km · 1 j 2 h</div>
          </Panel>
          <Panel style={{ ...devis, display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: `${C.green}1f`,
                border: `1px solid ${C.green}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                color: C.green,
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontFamily: body, fontSize: 28, fontWeight: 500, color: C.text }}>
                Devis DEV-2026-#418 généré
              </div>
              <div style={{ fontFamily: body, fontSize: 20, color: C.mutedDark }}>
                Classé dans « Factures &amp; devis »
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
};
