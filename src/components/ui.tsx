// ui.tsx
// Small shared primitives. The scaffold repeated the same chip/pill/button
// StyleSheet in every screen, which is how three screens quietly drift apart.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { CropKey } from '../engines/scheduleEngine';
import { CROP_BADGE, cropIcon } from '../cropMeta';

/** A crop's visual identity, wherever it's more than decorative (grids,
 * cards, pickers). Most crops just render their real emoji; the handful
 * with no real emoji of their own (see CROP_BADGE in cropMeta.ts) get a
 * colored two-letter monogram instead of a generic, indistinguishable dot. */
export function CropIcon({ crop, size = 22 }: { crop: CropKey | string; size?: number }) {
  const badge = CROP_BADGE[crop as CropKey];
  if (!badge) {
    return <Text style={{ fontSize: size }}>{cropIcon(crop)}</Text>;
  }
  return (
    <View
      style={[
        styles.cropBadge,
        { width: size * 1.3, height: size * 1.3, borderRadius: (size * 1.3) / 2, backgroundColor: badge.color },
      ]}
    >
      <Text style={[styles.cropBadgeText, { fontSize: size * 0.4 }]}>{badge.letters}</Text>
    </View>
  );
}

export type TabKey = 'home' | 'garden' | 'calendar' | 'log' | 'settings';

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: '🏡', label: 'Home' },
  { key: 'garden', icon: '🌿', label: 'My Garden' },
  { key: 'calendar', icon: '🗓', label: 'Calendar' },
  { key: 'log', icon: '🧺', label: 'Log' },
  { key: 'settings', icon: '⚙️', label: 'Settings' },
];

export function TabBar({
  active,
  onPress,
}: {
  active: TabKey;
  onPress?: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onPress?.(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={selected ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={styles.chipLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={selected ? styles.pillTextSelected : styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function OptionRow({
  icon,
  label,
  description,
  selected,
  onPress,
}: {
  icon?: string;
  label: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
    >
      {icon ? <Text style={styles.optionIcon}>{icon}</Text> : null}
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {description ? <Text style={styles.optionDescription}>{description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || busy) && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPine} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
    marginTop: space.xl,
    marginBottom: space.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    marginRight: space.sm,
    marginBottom: space.sm,
    alignItems: 'center',
    minWidth: 96,
  },
  chipSelected: { borderColor: colors.mossGreen, backgroundColor: colors.selectedBg },
  chipIcon: { fontSize: 20, marginBottom: space.xs },
  chipLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  pillSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  pillTextSelected: { fontSize: 13, fontWeight: '600', color: colors.onPine },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSelected: { borderColor: colors.mossGreen, backgroundColor: colors.selectedBg },
  optionIcon: { fontSize: 20, marginRight: space.md },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  optionDescription: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  button: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: space.lg,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: { color: colors.onPine, fontWeight: '700', fontSize: 15 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 9,
    paddingHorizontal: 6,
    paddingBottom: 18,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.inkSoft },
  tabLabelActive: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.pine },
  cropBadge: { alignItems: 'center', justifyContent: 'center' },
  cropBadgeText: { fontFamily: fonts.monoSemiBold, color: colors.onPine, letterSpacing: 0.3 },
});
