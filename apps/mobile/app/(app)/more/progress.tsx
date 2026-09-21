import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Body, Card, Loading, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Progress = {
  tier: string | null;
  trend: string | null;
  isNew: boolean | null;
  meetings: number;
  lessons: number;
  served: number;
  gatherings: number;
};

// His own standing framed as a next step, never a grade and never a number
// (scoring plan section 6, Non-negotiable 5).
const NEXT_STEP: Record<string, { title: string; body: string }> = {
  New: { title: "You're just getting started", body: "Keep showing up to your group. The first month is about getting to know your brothers." },
  Thriving: { title: "You're engaged and consistent", body: "Keep going. Think about who you could invite, or whether serving as a co-leader is your next step." },
  Steady: { title: "You're connected", body: "Your next step: serve with your group, or start a course." },
  Drifting: { title: "A good week to reconnect", body: "Show up to your next meeting, or reach out to a brother. Small steps count." },
  Disconnected: { title: "Your brothers miss you", body: "Your group would love to see you. Your leader is glad to hear from you anytime." },
};

export default function MyProgress() {
  const { state: auth } = useAuth();
  const [p, setP] = useState<Progress | null>(null);
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;

  const load = useCallback(async () => {
    if (!ministryId) return;
    const { data } = await supabase.rpc("my_progress", { p_ministry: ministryId });
    const r = data?.[0];
    setP({
      tier: r?.tier ?? null,
      trend: r?.trend ?? null,
      isNew: r?.is_new ?? null,
      meetings: r?.meetings_attended_90d ?? 0,
      lessons: r?.lessons_completed ?? 0,
      served: r?.times_served ?? 0,
      gatherings: r?.gatherings_attended_90d ?? 0,
    });
  }, [ministryId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (!p) return <Loading />;
  const step = p.tier ? NEXT_STEP[p.tier] : undefined;

  return (
    <Screen>
      <Title>My Progress</Title>
      <Card title={step?.title ?? "Your path"}>
        <Body>{step?.body ?? "Your progress shows here after your first week in a group."}</Body>
        {p.trend === "up" && p.tier !== "New" ? <Body muted>You've been building momentum. Well done.</Body> : null}
      </Card>
      <Card title="L: Learn God's Word">
        <Body>{p.lessons} {p.lessons === 1 ? "lesson" : "lessons"} completed</Body>
        <Body>{p.gatherings} Saturday {p.gatherings === 1 ? "gathering" : "gatherings"} in the last 90 days</Body>
      </Card>
      <Card title="E: Encourage one another">
        <Body>{p.meetings} group {p.meetings === 1 ? "meeting" : "meetings"} in the last 90 days</Body>
      </Card>
      <Card title="A: Act with integrity">
        <Body>Served {p.served} {p.served === 1 ? "time" : "times"}</Body>
      </Card>
      <Card title="D: Disciple future leaders">
        <Body muted>When you're ready to help lead, your leader will talk with you about co-leading.</Body>
      </Card>
      <Body muted>Only you see this page. No one sees a score, and no one is compared.</Body>
    </Screen>
  );
}
