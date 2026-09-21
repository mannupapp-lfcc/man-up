import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Card, Loading, Screen, Title, useColors } from "@/components/ui";
import { useCourse } from "@/lib/content";

export default function Course() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const c = useColors();
  const { state } = useCourse(courseId);
  if (state.status === "loading") return <Loading />;
  if (state.status === "error") return <Screen><Body>This course is not available.</Body></Screen>;
  const course = state.data;
  const next = course.lessons.find((l) => !l.completed);
  return (
    <Screen>
      <Title>{course.title}</Title>
      {course.description ? <Body muted>{course.description}</Body> : null}
      <Card title="Lessons">
        {course.lessons.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/more/courses/[courseId]/[lessonId]", params: { courseId, lessonId: l.id } })}
            style={styles.row}
          >
            <Text style={{ color: l.completed ? c.accent : c.muted, width: 28, fontWeight: "700" }}>{l.completed ? "Done" : l.order}</Text>
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: l === next ? "700" : "400" }}>{l.title}</Text>
              {l === next ? <Text style={{ color: c.accent, fontSize: 13 }}>Up next</Text> : null}
            </View>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 44 },
  flex: { flex: 1 },
});
