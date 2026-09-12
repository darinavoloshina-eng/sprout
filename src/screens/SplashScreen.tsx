// SplashScreen.tsx
// The in-app brand moment shown on every cold start, right after the native
// launch screen hands off to JS and before onboarding or Home appears. Not
// to be confused with the native launch screen (ios/Sprout/SplashScreen.
// storyboard) — that one is a single static frame the OS shows instantly,
// before any JS has even run, and can't animate. This one can, so the fade
// + rise lives here instead.
//
// Runs on a fixed minimum timer rather than tying its duration to font/
// profile loading (see App.tsx) — those two are usually near-instant on a
// warm start, and racing the animation against them would make the brand
// moment flicker by unpredictably fast on a fast device instead of reading
// as a deliberate beat. App.tsx waits for both this timer AND the real data
// to be ready before moving on, so a slow load just holds here a little
// longer rather than cutting away mid-animation.
//
// OwlMark below is a vector redraw of the real app icon (see
// ios/Sprout/Images.xcassets/AppIcon.appiconset) — same shapes, same
// colors, same cream background — so the icon a user just tapped and this
// screen read as the same mark, not two different ones. It's built with
// react-native-svg rather than a bundled image asset so it stays crisp at
// any device scale with nothing extra to ship.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, space } from '../theme';

const MIN_DISPLAY_MS = 1400;

export interface SplashScreenProps {
  onFinish: () => void;
}

function OwlMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {/* ear tufts — the same leaf silhouette as the original sprout mark, scaled down */}
      <Path
        transform="translate(406.02,347.75) rotate(-32)"
        d="M0,0 C-51.2,-19.71 -51.2,-92.93 0,-112.64 C51.2,-92.93 51.2,-19.71 0,0 Z"
        fill={colors.mossGreen}
      />
      <Path
        transform="translate(617.98,347.75) rotate(32)"
        d="M0,0 C-51.2,-19.71 -51.2,-92.93 0,-112.64 C51.2,-92.93 51.2,-19.71 0,0 Z"
        fill={colors.pine}
      />
      {/* body, two-tone split */}
      <Path
        d="M512,327.68 C281.6,327.68 240.13,704.0 350.72,829.44 C442.88,874.6 512,874.6 512,834.46 Z"
        fill={colors.pine}
      />
      <Path
        d="M512,327.68 C742.4,327.68 782.87,704.0 673.28,829.44 C581.12,874.6 512,874.6 512,834.46 Z"
        fill={colors.mossGreen}
      />
      {/* eyes */}
      <Circle cx={415.23} cy={548.45} r={76.8} fill={colors.card} />
      <Circle cx={608.77} cy={548.45} r={76.8} fill={colors.card} />
      <Circle cx={415.23} cy={548.45} r={32.77} fill={colors.pine} />
      <Circle cx={608.77} cy={548.45} r={32.77} fill={colors.pine} />
      {/* beak */}
      <Path d="M487.42,593.61 L536.58,593.61 L512,623.72 Z" fill={colors.mustard} />
    </Svg>
  );
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markRise = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(markRise, {
          toValue: 0,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(onFinish, MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
    // onFinish is passed a fresh inline callback from App.tsx on every
    // render; keying this off it would restart the timer, so it's
    // deliberately excluded — this effect is meant to run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View
        style={{
          opacity: markOpacity,
          transform: [{ translateY: markRise }],
          alignItems: 'center',
        }}
      >
        <OwlMark size={96} />
        <Text style={styles.wordmark}>GardenWise</Text>
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Grow with the season, not against it.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.iconCream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed width + centered text, not auto-sized to content — Fraunces
  // loads asynchronously (see useFonts in App.tsx, which only gates the
  // transition away from this screen, not this screen's own first paint),
  // so this can briefly render in the system fallback font before Fraunces
  // swaps in. An auto-sized container computed from the fallback font's
  // metrics doesn't reliably widen when the swap happens, which clipped
  // "GardenWise" to "GardenWis" on real devices. A fixed width wide enough
  // for either font sidesteps the reflow entirely.
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.pine,
    marginTop: space.md,
    width: 280,
    textAlign: 'center',
  },
  tagline: {
    position: 'absolute',
    bottom: space.xxl * 2,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
});
