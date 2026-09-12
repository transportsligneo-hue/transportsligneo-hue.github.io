import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { fade } from "@remotion/transitions/fade";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Demande } from "./scenes/Scene2Demande";
import { Scene3Admin } from "./scenes/Scene3Admin";
import { Scene4Driver } from "./scenes/Scene4Driver";
import { Scene5Trajet } from "./scenes/Scene5Trajet";
import { Scene6Livraison } from "./scenes/Scene6Livraison";

const timing = springTiming({ config: { damping: 200 }, durationInFrames: 20 });

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#0b1026" }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={95}>
        <Scene1Intro />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-bottom" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={150}>
        <Scene2Demande />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={125}>
        <Scene3Admin />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={155}>
        <Scene4Driver />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={wipe({ direction: "from-right" })} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={130}>
        <Scene5Trajet />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timing} />
      <TransitionSeries.Sequence durationInFrames={145}>
        <Scene6Livraison />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
