import type { DbEnum } from "@manup/shared";
import { Alert } from "react-native";
import { block, report } from "@/lib/pray";

// Long-press menu for anything another man wrote (App Store UGC requirement).
// Report sends that one item to ministry admins; block hides his posts from you.
export function openSafetyMenu(opts: {
  ministryId: string;
  me: string;
  targetType: DbEnum<"report_target">;
  targetId: string;
  authorId: string | null; // null for anonymous posts: report only
  authorName?: string | null;
  onBlocked?: () => void;
}) {
  const doReport = () =>
    Alert.alert("Report this?", "A ministry admin will see only this post, never the rest of the conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          const err = await report(opts.ministryId, opts.me, opts.targetType, opts.targetId);
          Alert.alert(err ? "Could not report" : "Reported", err ?? "Thank you. An admin will review it.");
        },
      },
    ]);

  const doBlock = () =>
    Alert.alert(`Block ${opts.authorName ?? "him"}?`, "You will no longer see his messages or prayer requests. He is not told.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          const err = await block(opts.ministryId, opts.me, opts.authorId!);
          if (err) Alert.alert("Could not block", err);
          else opts.onBlocked?.();
        },
      },
    ]);

  Alert.alert("Options", undefined, [
    { text: "Report", onPress: doReport },
    ...(opts.authorId && opts.authorId !== opts.me ? [{ text: `Block ${opts.authorName ?? "this man"}`, onPress: doBlock }] : []),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
