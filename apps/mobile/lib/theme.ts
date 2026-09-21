// Man Up brand colors, sampled from assets/logo.jpg. The app is dark-first to
// match the logo. Gold is for the main action on a screen; navy for structure.
export const colors = {
  bg: "#000000", // black: screen background (same as the logo's)
  navy: "#0A2A62", // brand navy: headers, selected states, secondary buttons
  surface: "#0B1A3A", // deep navy: cards and inputs
  border: "#1F3668",
  gold: "#D4A034", // brand gold: primary buttons, active tab, highlights
  onGold: "#000000", // text on gold
  text: "#FFFFFF",
  muted: "#A9B3C6",
  error: "#FF8A80",
} as const;
