import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 95+150+125+155+130+145 = 800 frames, minus 5 transitions x 20 = 700
export const RemotionRoot: React.FC = () => (
  <Composition id="main" component={MainVideo} durationInFrames={700} fps={30} width={1920} height={1080} />
);
