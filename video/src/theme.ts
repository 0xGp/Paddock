import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadSans } from "@remotion/google-fonts/PlusJakartaSans";
import { Easing } from "remotion";

export const sans = loadSans("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;

export const C = {
  navy: "#0F1D45",
  blue: "#1F4FB8",
  teal: "#4FD4CF",
  tealDeep: "#1D7D86",
  ink: "#1B2340",
  muted: "#5B6478",
  owes: "#D9485F",
  line: "rgba(27, 35, 64, 0.10)",
  glass: "rgba(255, 255, 255, 0.72)",
};

export const LIGHT_BG = "linear-gradient(135deg, #E6FBFA 0%, #DCE7FF 100%)";
export const DARK_BG = "radial-gradient(120% 120% at 15% 10%, #1F4FB8 0%, #0F1D45 55%, #0A1433 100%)";

export const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export const MEMBER_COLOR: Record<string, string> = {
  godspower: "#1F4FB8",
  tolu: "#4FD4CF",
  ada: "#E0A43A",
  emeka: "#D9485F",
};
