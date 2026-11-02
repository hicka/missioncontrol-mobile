// A pushed screen: it slides in from the right over whatever is beneath,
// leaves the same way, and follows a finger dragged from the left edge, so
// going back feels like the rest of the phone.
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, PanResponder } from "react-native";
import { T } from "../theme";

export default function StackLayer({ leaving, onRemoved, children }) {
  const w = Dimensions.get("window").width;
  const x = useRef(new Animated.Value(w)).current;
  const gone = useRef(false);
  const remove = () => { if (!gone.current) { gone.current = true; onRemoved(); } };

  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(x, { toValue: w, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => remove());
  }, [leaving]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => g.x0 < 28 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      if (g.dx > w / 3 || g.vx > 0.6) {
        Animated.timing(x, { toValue: w, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true })
          .start(() => remove());
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
  })).current;

  return (
    <Animated.View {...pan.panHandlers} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
      backgroundColor: T.bg, transform: [{ translateX: x }], shadowColor: "#000", shadowOpacity: 0.22,
      shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 8 }}>
      {children}
    </Animated.View>
  );
}
