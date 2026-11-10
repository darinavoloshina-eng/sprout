// OwlMark.tsx
// The app icon's owl as a vector, so it stays crisp at any size: the splash
// screen and Home's seed-season card both use it.

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

export function OwlMark({ size }: { size: number }) {
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
