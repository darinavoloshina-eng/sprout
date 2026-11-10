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
// OwlMark (components/OwlMark.tsx) is a vector redraw of the real app icon (see
// ios/Sprout/Images.xcassets/AppIcon.appiconset) — same shapes, same
// colors, same cream background — so the icon a user just tapped and this
// screen read as the same mark, not two different ones. It's built with
// react-native-svg rather than a bundled image asset so it stays crisp at
// any device scale with nothing extra to ship.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';
import { OwlMark } from '../components/OwlMark';

// The tagline is fully in by ~1s; this leaves about a second to read it.
const MIN_DISPLAY_MS = 2100;

export interface SplashScreenProps {
  onFinish: () => void;
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
        Grow your own food.
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
  // Full-width and centered for the same reason as the wordmark above: an
  // auto-sized box measured in the fallback font clipped the last letters
  // ("Grow your own fo") once the real font swapped in.
  tagline: {
    position: 'absolute',
    bottom: space.xxl * 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
});
