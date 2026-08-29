// theme.ts
// Design tokens lifted directly from the HTML mockup so the app and the
// prototype stay visually in sync. Import these instead of hardcoding hexes.

export const colors = {
  paper: '#EDF0E2', // app background
  card: '#F7F5EC', // raised surfaces
  pine: '#1F3D2B', // primary / dark card
  pineDeep: '#2C4E38', // "prune" calendar-dot color
  mossGreen: '#4C7A52', // accent, selection borders
  mustard: '#D9A62E', // "watering day" highlight
  clay: '#B85C38', // act-soon severity
  ink: '#26291F', // body text
  inkSoft: '#5B5F4F', // secondary text
  line: '#D8DCC9', // borders, dividers
  selectedBg: '#E7EFDF', // selected chip/pill fill
  disabled: '#B9C2AC', // disabled button fill

  onPine: '#F7F5EC', // text on pine
  pineTag: '#B7D6BC', // eyebrow text on pine
  pineFoot: '#CFE0CD', // caption text on pine

  sevSoonBg: '#F3E6DE',
  sevFyiBg: '#F0E3C8',
  sevFyiText: '#7A5A17',
  sevLowBg: '#DCE9D6',

  seasonTrack: '#E3E7D5', // season-progress bar background (My Garden crop cards)
} as const;

export const fonts = {
  heading: 'Fraunces_600SemiBold',
  body: 'WorkSans_400Regular',
  bodyMedium: 'WorkSans_500Medium',
  bodySemiBold: 'WorkSans_600SemiBold',
  bodyBold: 'WorkSans_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  pill: 20,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;
