import { router } from "expo-router";
import { Image, StyleSheet } from "react-native";
import { Body, Button, Screen } from "@/components/ui";

export default function Welcome() {
  return (
    <Screen>
      <Image
        source={require("@/assets/logo.png")}
        style={styles.logo}
        accessibilityLabel="Man Up. Men of faith, leaders of purpose. Love First Christian Center Men's Fellowship."
      />
      <Body muted>Stay connected with your brothers between Saturdays.</Body>
      <Button title="Create account" onPress={() => router.push("/sign-up")} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The logo has a black background, so it sits in a rounded square in light mode too.
  logo: { width: "100%", maxWidth: 320, aspectRatio: 1, alignSelf: "center", borderRadius: 24 },
});
