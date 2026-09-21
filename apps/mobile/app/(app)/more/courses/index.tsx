import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Body, Button, Card, Loading, Screen, useColors } from "@/components/ui";
import { useCourses } from "@/lib/content";

export default function Courses() {
  const c = useColors();
  const { state, reload } = useCourses();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <Screen>
        <Body>Could not load courses.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );
  return (
    <Screen>
      {state.data.length === 0 ? <Body muted>No courses yet.</Body> : null}
      {state.data.map((course) => (
        <Pressable
          key={course.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/more/courses/[courseId]", params: { courseId: course.id } })}
        >
          <Card title={course.title}>
            {course.description ? <Body muted>{course.description}</Body> : null}
            <Text style={{ color: course.completed === course.lessons && course.lessons > 0 ? c.accent : c.muted }}>
              {course.completed} of {course.lessons} lessons done
            </Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
