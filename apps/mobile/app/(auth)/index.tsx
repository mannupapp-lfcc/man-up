import { router } from "expo-router";
import { Image, StyleSheet } from "react-native";
import { Body, Button, Screen } from "@/components/ui";

export default function Welcome() {
  return (
    <Screen>
      <Image
        source={require("@/assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Man Up. Men of faith, leaders of purpose. Be a man of God."
      />
      <Body muted>Stay connected with your brothers between Saturdays.</Body>
      <Button title="Create account" onPress={() => router.push("/sign-up")} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A fixed square (never wider than the screen) so it is not cropped on iPad.
  logo: { width: 320, maxWidth: "100%", aspectRatio: 1, alignSelf: "center" },
});
