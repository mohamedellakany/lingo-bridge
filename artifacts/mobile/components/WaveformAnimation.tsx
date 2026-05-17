import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const BAR_CONFIGS = [
  { maxHeight: 18, delay: 0 },
  { maxHeight: 32, delay: 100 },
  { maxHeight: 24, delay: 200 },
  { maxHeight: 44, delay: 300 },
  { maxHeight: 20, delay: 100 },
  { maxHeight: 38, delay: 200 },
  { maxHeight: 28, delay: 50 },
  { maxHeight: 46, delay: 150 },
  { maxHeight: 22, delay: 250 },
  { maxHeight: 34, delay: 0 },
  { maxHeight: 18, delay: 100 },
];

function AnimatedBar({
  maxHeight,
  delay,
  isActive,
  primaryColor,
  accentColor,
  index,
}: {
  maxHeight: number;
  delay: number;
  isActive: boolean;
  primaryColor: string;
  accentColor: string;
  index: number;
}) {
  const height = useSharedValue(5);
  const duration = 380 + index * 15;

  useEffect(() => {
    if (isActive) {
      height.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(maxHeight, { duration }),
            withTiming(5, { duration })
          ),
          -1,
          false
        )
      );
    } else {
      height.value = withTiming(5, { duration: 350 });
    }
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const color = index % 3 === 0 ? accentColor : primaryColor;

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color }, animStyle]}
    />
  );
}

interface WaveformAnimationProps {
  isActive: boolean;
  primaryColor: string;
  accentColor: string;
  height?: number;
}

export function WaveformAnimation({
  isActive,
  primaryColor,
  accentColor,
  height = 56,
}: WaveformAnimationProps) {
  return (
    <View style={[styles.container, { height }]}>
      {BAR_CONFIGS.map((config, index) => (
        <AnimatedBar
          key={index}
          index={index}
          maxHeight={config.maxHeight}
          delay={config.delay}
          isActive={isActive}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 3,
    minHeight: 5,
  },
});
