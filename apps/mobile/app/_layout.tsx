import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";

// Keep the splash up until we know whether he is signed in, so a signed-in man
// never sees the welcome screen flash on launch.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}

function RootStack() {
  const { state } = useAuth();
  const loading = state.status === "loading";

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === "ready"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === "needsMinistry"}>
        <Stack.Screen name="join" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === "offline"}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === "signedOut" || loading}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
