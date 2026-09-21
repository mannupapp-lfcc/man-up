import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ActionRow, Body, Button, Card, Eyebrow, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatGathering, nextGathering, useGatherings } from "@/lib/gatherings";
import { formatMeeting, useMyGroup } from "@/lib/group";
import { colors } from "@/lib/theme";

export default function Home() {
  const { state } = useAuth();
  const { state: group, reload: reloadGroup } = useMyGroup();
  const { state: gatherings, reload: reloadGatherings } = useGatherings();
  if (state.status !== "ready") return null;

  const next = group.status === "ready" ? group.group?.upcoming[0] : undefined;
  const gathering = gatherings.status === "ready" ? nextGathering(gatherings.upcoming) : undefined;

  return (
    <Screen>
      <View style={styles.welcome}>
        <View style={{ flex: 1, gap: 6 }}>
          <Eyebrow>{state.membership.ministryName}</Eyebrow>
          <Title>Welcome, {state.fullName.split(" ")[0]}.</Title>
          <Body muted>Keep showing up. Grow together.</Body>
        </View>
        <View style={styles.avatar}><Text style={styles.initial}>{state.fullName.trim().charAt(0).toUpperCase()}</Text></View>
      </View>

      <View style={styles.hero}>
        <View pointerEvents="none" accessible={false} style={styles.orbit} />
        <View style={styles.heroLabel}><Ionicons name="calendar-outline" size={17} color={colors.gold} /><Eyebrow>Next gathering</Eyebrow></View>
        {gatherings.status === "loading" ? <Body muted>Loading your next gathering…</Body> : gatherings.status === "error" ? (
          <><Body>We couldn’t load gatherings.</Body><Button title="Try again" variant="secondary" onPress={() => void reloadGatherings()} /></>
        ) : gathering ? (
          <>
            <Text accessibilityRole="header" style={styles.heroTitle}>{gathering.title}</Text>
            <Body>{formatGathering(gathering)}</Body>
            {gathering.location ? <View style={styles.location}><Ionicons name="location-outline" size={16} color={colors.muted} /><Text style={styles.locationText}>{gathering.location}</Text></View> : null}
            <Button title="View gathering" onPress={() => router.push({ pathname: "/gatherings/[gatheringId]", params: { gatheringId: gathering.id } })} />
          </>
        ) : (
          <><Text style={styles.heroTitle}>There’s more ahead.</Text><Body muted>Your next gathering will appear here once it’s scheduled.</Body><Button title="Explore gatherings" onPress={() => router.push("/gatherings")} /></>
        )}
      </View>

      <Eyebrow>Your brotherhood</Eyebrow>
      {group.status === "loading" ? <Card><Body muted>Loading your group…</Body></Card> : group.status === "error" ? (
        <Card><Body>We couldn’t load your group.</Body><Button title="Try again" variant="secondary" onPress={() => void reloadGroup()} /></Card>
      ) : group.group ? (
        <Card>
          <View style={styles.heroLabel}><Ionicons name="people-outline" size={20} color={colors.gold} /><Eyebrow>My group</Eyebrow></View>
          <Text style={styles.groupTitle}>{group.group.name}</Text>
          <Body muted>{next ? formatMeeting(next.meetingAt) : "No meetings scheduled yet."}</Body>
          <Button title="Connect with your group" variant="secondary" onPress={() => router.push("/group")} />
        </Card>
      ) : (
        <Card title="A place to belong"><Body muted>Groups of 4 to 8 men meet every week. A ministry leader will place you in a group soon.</Body></Card>
      )}
      <ActionRow title="Ministry chat" subtitle="Talk with every man in the ministry." icon="megaphone-outline" href="/group/ministry-chat" />

      <Eyebrow>Faith in action</Eyebrow>
      <View style={{ gap: 12 }}>
        <ActionRow title="Pray for a brother" subtitle="Share a request. Stand with someone." icon="heart-outline" href="/pray" />
        <ActionRow title="Keep growing" subtitle="Make time for your next lesson." icon="book-outline" href="/more/courses" />
        <ActionRow title="Show up and serve" subtitle="Put your faith into action." icon="hand-left-outline" href="/more/serve" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 20, fontWeight: "700", color: colors.gold },
  hero: { backgroundColor: colors.navy, borderRadius: 26, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.gold, padding: 24, gap: 16, overflow: "hidden" },
  heroLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroTitle: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  orbit: { position: "absolute", width: 230, height: 230, borderRadius: 115, borderWidth: 35, borderColor: "rgba(255,255,255,0.035)", top: -100, right: -105 },
  location: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { color: colors.muted, fontSize: 14, lineHeight: 21, flex: 1 },
  groupTitle: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: "700" },
});
