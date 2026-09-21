import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

// Measure the unpadded viewport, not the composer: measuring a moving composer
// would alternate between adding and removing the same keyboard space.
export function ChatKeyboardView({ children }: { children: ReactNode }) {
  const headerHeight = useHeaderHeight();
  const viewport = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  const measurement = useRef(0);

  const measureOverlap = useCallback(() => {
    if (Platform.OS !== "android") return;
    const version = ++measurement.current;
    viewport.current?.measureInWindow((_x, y, _width, height) => {
      if (!viewport.current || version !== measurement.current) return;
      const keyboard = Keyboard.metrics();
      setOverlap(keyboard ? Math.max(0, y + height - keyboard.screenY) : 0);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", measureOverlap);
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      ++measurement.current;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measureOverlap]);

  if (Platform.OS !== "android") {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={headerHeight}>
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View ref={viewport} collapsable={false} onLayout={measureOverlap} style={styles.flex}>
      <View style={[styles.flex, { paddingBottom: overlap }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
