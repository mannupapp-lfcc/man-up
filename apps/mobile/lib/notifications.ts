import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "./supabase";

// Pushes come from the admin app's Inngest sender via Expo (push_outbox, 0014).
// Every push carries data.url (where a tap lands), data.kind, and data.ministryId.

// Show pushes while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const CHECKIN_CATEGORY = "checkin";
const SCALE = ["1", "2", "3", "4", "5"] as const;

// This phone's token, kept so sign-out can take it back.
let currentToken: string | null = null;

// Asks for permission (the system prompt appears once), saves this phone's token
// for him in this ministry, and sets up the check-in buttons. Quietly does nothing
// on a simulator, without permission, or offline.
export async function registerForPush(ministryId: string) {
  if (!Device.isDevice) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Man Up",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    // The check-in push answers from the notification: 1 to 5. Each button opens the
    // app, which saves the answer and shows his group's check-ins.
    await Notifications.setNotificationCategoryAsync(
      CHECKIN_CATEGORY,
      SCALE.map((n) => ({ identifier: n, buttonTitle: n, options: { opensAppToForeground: true } })),
    );

    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const { error } = await supabase.rpc("register_push_token", { p_ministry: ministryId, p_token: token });
    if (!error) currentToken = token;
  } catch {
    // No network or no push service on this device: try again next launch.
  }
}

// Called before sign-out so this phone stops getting his pushes.
export async function unregisterPush() {
  if (!currentToken) return;
  await supabase.from("push_tokens").delete().eq("expo_token", currentToken);
  currentToken = null;
}

const handled = new Set<string>();

async function handleResponse(response: Notifications.NotificationResponse) {
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  const data = response.notification.request.content.data as { url?: string; kind?: string; ministryId?: string } | undefined;

  const answer = SCALE.find((n) => n === response.actionIdentifier);
  if (data?.kind === "checkin_prompt" && answer && data.ministryId) {
    const { error } = await supabase.rpc("submit_checkin", { p_ministry: data.ministryId, p_scale: Number(answer) });
    if (error) Alert.alert("Check-in not saved", error.message);
    router.push({ pathname: "/group/checkin", params: { saved: error ? undefined : answer } });
    return;
  }
  if (data?.url?.startsWith("/")) router.push(data.url as Href);
}

// Routes taps on pushes, including the one that launched the app.
export function usePushResponses() {
  useEffect(() => {
    // The launch tap is kept by the OS until cleared; clear it so the next launch
    // does not open the same screen again.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (!r) return;
      void handleResponse(r);
      void Notifications.clearLastNotificationResponseAsync();
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handleResponse(r));
    return () => sub.remove();
  }, []);
}
