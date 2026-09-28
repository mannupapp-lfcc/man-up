import { createContext, useCallback, useEffect, useRef, type ComponentProps } from "react";
import { Keyboard, ScrollView, View, type TextInput } from "react-native";
import { KeyboardView } from "./KeyboardView";

export const RevealInputContext = createContext<(input: TextInput | null) => void>(() => {});

// Keep the focused field inside the actual scroll viewport after the keyboard,
// tab bar, or a growing multiline input changes the available space.
export function KeyboardScrollView(props: ComponentProps<typeof ScrollView>) {
  const scroll = useRef<ScrollView>(null);
  const viewportRef = useRef<View>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const measurement = useRef(0);

  const reveal = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const version = ++measurement.current;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = focusedInput.current;
      const viewport = viewportRef.current;
      if (!input || !viewport || !input.isFocused()) return;

      viewport.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!scroll.current || version !== measurement.current || focusedInput.current !== input || !input.isFocused()) return;
          const keyboardTop = Keyboard.metrics()?.screenY ?? Infinity;
          const bottom = Math.min(top + height, keyboardTop) - 16;
          const visibleTop = top + 16;
          if (bottom <= visibleTop) return;
          // A field taller than the viewport keeps its top visible; TextInput
          // handles scrolling its own text to the caret.
          const visibleHeight = Math.min(inputHeight, bottom - visibleTop);
          const delta = inputTop < visibleTop
            ? inputTop - visibleTop
            : Math.max(0, inputTop + visibleHeight - bottom);
          if (Math.abs(delta) < 1) return;
          offset.current = Math.max(0, offset.current + delta);
          scroll.current.scrollTo({ y: offset.current, animated: false });
        });
      });
    });
  }, []);

  const focus = useCallback((input: TextInput | null) => {
    focusedInput.current = input;
    reveal();
  }, [reveal]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", reveal);
    const change = Keyboard.addListener("keyboardDidChangeFrame", reveal);
    return () => {
      show.remove();
      change.remove();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [reveal]);

  return (
    <KeyboardView>
      <RevealInputContext.Provider value={focus}>
        <View ref={viewportRef} collapsable={false} style={{ flex: 1 }} onLayout={reveal}>
          <ScrollView
            {...props}
            ref={scroll}
            onLayout={(event) => { props.onLayout?.(event); reveal(); }}
            onContentSizeChange={(width, height) => { props.onContentSizeChange?.(width, height); reveal(); }}
            onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }}
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </RevealInputContext.Provider>
    </KeyboardView>
  );
}
