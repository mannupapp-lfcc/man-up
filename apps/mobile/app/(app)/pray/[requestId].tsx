import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { PrayerCard } from "@/components/PrayerCard";
import { openSafetyMenu } from "@/components/safety";
import { Body, Button, Card, ErrorText, Field, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useMyGroup } from "@/lib/group";
import {
  addComment,
  changeVisibility,
  deleteRequest,
  loadComments,
  markAnswered,
  setPrayed,
  timeAgo,
  usePrayerWall,
  type PrayerComment,
} from "@/lib/pray";

export default function PrayerRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const c = useColors();
  const { state: auth } = useAuth();
  const { state, reload, ministryId } = usePrayerWall();
  const { state: group } = useMyGroup();
  const [comments, setComments] = useState<PrayerComment[] | null>(null);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const groupId = group.status === "ready" ? group.group?.groupId ?? null : null;

  const refreshComments = useCallback(async () => setComments(await loadComments(requestId)), [requestId]);
  useEffect(() => {
    void refreshComments();
  }, [refreshComments]);

  if (state.status === "loading" || !me || !ministryId) return <Loading />;
  const r = state.status === "ready" ? state.requests.find((x) => x.id === requestId) : undefined;
  if (!r)
    return (
      <Screen>
        <Body>This request is no longer available.</Body>
      </Screen>
    );

  const act = async (fn: () => Promise<string | null>) => {
    setError(null);
    const err = await fn();
    if (err) setError(err);
    await reload();
  };

  return (
    <Screen>
      <PrayerCard
        full
        request={r}
        onTogglePrayed={() => act(() => setPrayed(ministryId, r.id, me, !r.iPrayed))}
        onLongPress={r.isMine ? undefined : () => openSafetyMenu({ ministryId, me, targetType: "prayer_request", targetId: r.id, authorId: r.authorId, authorName: r.authorName, onBlocked: () => router.back() })}
      />

      {r.isMine ? (
        <Card title="Your request">
          {!r.answered ? (
            <>
              <Field label="How did God answer? (optional)" value={note} onChangeText={setNote} multiline />
              <Button title="Mark answered" onPress={() => act(() => markAnswered(r.id, note))} />
            </>
          ) : null}
          {r.visibility === "group" ? (
            <Button title="Share with the whole ministry" variant="secondary" onPress={() => act(() => changeVisibility(r.id, "ministry", groupId))} />
          ) : groupId ? (
            <Button title="Limit to my group" variant="secondary" onPress={() => act(() => changeVisibility(r.id, "group", groupId))} />
          ) : null}
          <Button
            title="Delete request"
            variant="secondary"
            onPress={() =>
              Alert.alert("Delete this request?", "Prayers and comments on it are removed too.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => { await deleteRequest(r.id); router.back(); } },
              ])
            }
          />
        </Card>
      ) : null}

      <Card title="Comments">
        {comments === null ? <Body muted>Loading...</Body> : null}
        {comments?.length === 0 ? <Body muted>No comments yet.</Body> : null}
        {comments?.map((cm) => (
          <Pressable
            key={cm.id}
            onLongPress={cm.isMine ? undefined : () => openSafetyMenu({ ministryId, me, targetType: "prayer_comment", targetId: cm.id, authorId: cm.authorId, authorName: cm.authorName, onBlocked: refreshComments })}
            style={styles.comment}
          >
            <Text style={{ color: c.text, fontWeight: "600" }}>
              {cm.isMine ? "You" : cm.authorName} <Text style={{ color: c.muted, fontWeight: "400" }}>{timeAgo(cm.createdAt)}</Text>
            </Text>
            <Text style={{ color: c.text, fontSize: 15 }}>{cm.body}</Text>
          </Pressable>
        ))}
        <View style={styles.compose}>
          <Field label="Add a comment" value={comment} onChangeText={setComment} multiline />
          <Button
            title="Post comment"
            variant="secondary"
            onPress={async () => {
              if (!comment.trim()) return;
              const err = await addComment(ministryId, r.id, me, comment);
              if (err) return setError(err);
              setComment("");
              await Promise.all([refreshComments(), reload()]);
            }}
          />
        </View>
      </Card>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  comment: { paddingVertical: 6, gap: 2 },
  compose: { gap: 8, marginTop: 4 },
});
