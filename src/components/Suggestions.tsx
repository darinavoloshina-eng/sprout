// Suggestions.tsx
// The "what grows well near you right now" list (see engines/suggestions.ts),
// shared by setup's crop step and the crop picker. Each crop gets one
// short reason and an Add button; tapping Add again removes it.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { Suggestions, SuggestionGroup } from '../engines/suggestions';
import { cropLabel } from '../cropMeta';
import { colors, fonts, radius, space } from '../theme';
import { CropIcon } from './ui';

const GROUP_TITLE: Record<'indoors' | 'outside', string> = {
  indoors: 'Start indoors now',
  outside: 'Plant outside now',
};

/** Only what can go in now: "Coming up" is left out, so the list is a
 * plain answer to "what should I plant?". In the quiet weeks when nothing
 * is plantable right now, the nearest upcoming picks are shown instead
 * (each reason carries its own date) rather than an empty list. */
export function SuggestionsList({
  suggestions,
  isAdded,
  onToggle,
}: {
  suggestions: Suggestions;
  isAdded: (crop: CropKey) => boolean;
  onToggle: (crop: CropKey) => void;
}) {
  const nowGroups = (Object.keys(GROUP_TITLE) as ('indoors' | 'outside')[]).filter((g) => suggestions[g].length > 0);
  const groups: { title: string; items: Suggestions[SuggestionGroup] }[] =
    nowGroups.length > 0
      ? nowGroups.map((g) => ({ title: GROUP_TITLE[g], items: suggestions[g] }))
      : suggestions.soon.length > 0
        ? [{ title: 'Best to plant next', items: suggestions.soon }]
        : [];
  if (groups.length === 0) {
    return (
      <Text style={styles.empty}>
        Nothing new to plant right now. Tap "See all crops" to pick anything you'd love to eat, and GardenWise
        will tell you when.
      </Text>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      {groups.map((g) => (
        <View key={g.title}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          <View style={styles.card}>
            {g.items.map((s, i) => {
              const added = isAdded(s.crop);
              return (
                <View key={s.crop} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <CropIcon crop={s.crop} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{cropLabel(s.crop)}</Text>
                    <Text style={styles.reason}>{s.reason}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onToggle(s.crop)}
                    style={[styles.add, added && styles.added]}
                    accessibilityRole="button"
                    accessibilityLabel={added ? `Remove ${cropLabel(s.crop)}` : `Add ${cropLabel(s.crop)}`}
                  >
                    <Text style={[styles.addText, added && styles.addedText]}>{added ? '✓ Added' : '+ Add'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: space.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingHorizontal: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  reason: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  add: {
    borderWidth: 1.5,
    borderColor: colors.mossGreen,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  added: { backgroundColor: colors.mossGreen },
  addText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.mossGreen },
  addedText: { color: colors.onPine },
  empty: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
});
