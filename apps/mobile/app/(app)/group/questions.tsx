import { Body, Card, Loading, Screen, Title } from "@/components/ui";
import { useWeeklyQuestions } from "@/lib/content";

export default function Questions() {
  const { state } = useWeeklyQuestions();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Screen><Body>Could not load this week's questions.</Body></Screen>;
  const q = state.data;
  if (!q)
    return (
      <Screen>
        <Body muted>No questions posted for this week yet.</Body>
      </Screen>
    );
  const week = new Date(`${q.weekOf}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <Screen>
      <Title>{q.title ?? "This week's questions"}</Title>
      <Body muted>Week of {week}</Body>
      <Card>
        {q.questions.map((text, i) => (
          <Body key={i}>{i + 1}. {text}</Body>
        ))}
      </Card>
    </Screen>
  );
}
