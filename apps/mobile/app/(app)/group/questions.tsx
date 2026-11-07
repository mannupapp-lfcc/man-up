import { router } from "expo-router";
import { Body, Button, Card, Loading, Screen, Title } from "@/components/ui";
import { useGroup } from "@/lib/group";
import { mondayOf, useGroupQuestions, weekLabel } from "@/lib/questions";

// This week's discussion questions, written by the group's leader or co-leader.
export default function Questions() {
  const { state: groupState } = useGroup();
  const group = groupState.status === "ready" ? groupState.group : null;
  const { state } = useGroupQuestions(group?.groupId ?? null);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Screen><Body>{"Could not load this week's questions."}</Body></Screen>;

  const { current, next } = state.data;
  const iLead = !!group?.iLead;
  const thisWeek = mondayOf();
  const isThisWeek = current?.weekOf === thisWeek;
  const edit = (week: "this" | "next") => router.push({ pathname: "/group/questions-edit", params: { week } });

  return (
    <Screen>
      {current ? (
        <>
          <Title>{current.title ?? "This week's questions"}</Title>
          <Body muted>Week of {weekLabel(current.weekOf)}</Body>
          <Card>
            {current.questions.map((text, i) => (
              <Body key={i}>{i + 1}. {text}</Body>
            ))}
          </Card>
        </>
      ) : (
        <Body muted>
          {iLead ? "You have not posted questions for your group yet." : "Your leader has not posted this week's questions yet."}
        </Body>
      )}

      {iLead ? (
        <>
          <Button title={isThisWeek ? "Edit this week's questions" : "Write this week's questions"} onPress={() => edit("this")} />
          <Button
            variant="secondary"
            title={next ? "Edit next week's questions" : "Write next week's questions"}
            onPress={() => edit("next")}
          />
        </>
      ) : null}
    </Screen>
  );
}
