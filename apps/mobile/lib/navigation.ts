import { colors } from "./theme";

// Shared header look for every stack inside the tabs.
export const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.gold,
  headerTitleStyle: { color: colors.text },
  contentStyle: { backgroundColor: colors.bg },
} as const;
