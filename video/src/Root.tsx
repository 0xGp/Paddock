import { Composition } from "remotion";
import { FPS } from "./data";
import { Paddock, totalFrames } from "./Video";

export function Root() {
  return <Composition id="Paddock" component={Paddock} durationInFrames={totalFrames()} fps={FPS} width={1920} height={1080} />;
}
