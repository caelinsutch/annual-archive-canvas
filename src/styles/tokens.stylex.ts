import * as stylex from "@stylexjs/stylex";
export const colors = stylex.defineVars({
  canvas: "#ffffff",
  text: "#242424",
  muted: "#777777",
  subtle: "#aaaaaa",
  border: "#ededed",
  hover: "#f3f3f3",
  solid: "#171717",
  onSolid: "#ffffff",
  overlay: "#25291e36",
  floating: "#fffffff5",
});
export const space = stylex.defineVars({
  xxs: "4px",
  xs: "8px",
  sm: "12px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
});
export const type = stylex.defineVars({
  family: '"DM Sans", sans-serif',
  body: "12px",
  small: "11px",
  micro: "9px",
  title: "30px",
  brand: "23px",
  line: "1.7",
});
export const radii = stylex.defineVars({
  small: "4px",
  panel: "12px",
  pill: "999px",
});
export const shadows = stylex.defineVars({
  paper: "0 2px 7px #0000000a",
  paperHover: "0 3px 13px #00000013",
  dock: "0 3px 15px #00000006",
  modal: "0 30px 100px #27271e30",
});
export const timing = stylex.defineVars({
  fast: "160ms",
  normal: "240ms",
  ease: "cubic-bezier(.22,1,.36,1)",
});

export const controls = stylex.defineVars({
  height: "40px",
  radius: "999px",
  text: "12px",
  focus: "#343434",
  hover: "#f0f0f2c9",
  selection: "#f5f5f6",
  pressed: "#ccccd2d9",
});
