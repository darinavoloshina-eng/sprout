// DeleteAccountScreen.tsx
// Screen 6a from the design handoff. The mockup's "you will lose" numbers
// (31 photos, 41 lbs, 86 tasks, a streak) are fabricated example content for
// data this app doesn't track yet — showing them here would lie to a real
// user about to delete their real data. Adapted to what's actually saved:
// crop count, scheduled reminders, and garden setup. The export row and the
// App-Store-subscription warning are dropped for the same reason — there's
// no export feature and no subscription system to warn about.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';

const CONFIRM_WORD = 'DELETE';

export interface DeleteAccountScreenProps {
  profile: GardenProfile;
  onBack: () => void;
  onConfirmDelete: () => void;
}

export default function DeleteAccountScreen({
  profile,
  onBack,
  onConfirmDelete,
}: DeleteAccountScreenProps) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const cropCount = profile.crops.filter((c) => c !== 'other').length;
  const reminderCount = profile.scheduledReminders.length;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} accessibilityRole="button" style={styles.backCircle}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Delete account</Text>
        </View>

        <Text style={styles.warning}>
          This erases your garden from this phone. It cannot be undone, and we can't recover it
          for you later.
        </Text>

        <View style={styles.loseCard}>
          <Text style={styles.loseEyebrow}>You will lose</Text>
          <View style={{ gap: 8 }}>
            <View style={styles.loseRow}>
              <Text style={styles.loseNumber}>{cropCount}</Text>
              <Text style={styles.loseText}>
                {cropCount === 1 ? 'crop and its' : 'crops and their'} care schedule
              </Text>
            </View>
            <View style={styles.loseRow}>
              <Text style={styles.loseNumber}>{reminderCount}</Text>
              <Text style={styles.loseText}>
                scheduled {reminderCount === 1 ? 'reminder' : 'reminders'}
              </Text>
            </View>
            <View style={styles.loseRow}>
              <Text style={styles.loseNumberSmall}>•</Text>
              <Text style={styles.loseText}>your saved location and bed setup</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>Type DELETE to confirm</Text>
          <TextInput
            style={styles.confirmInput}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
          onPress={onConfirmDelete}
          disabled={!canDelete}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDelete }}
        >
          <Text style={[styles.deleteButtonText, !canDelete && styles.deleteButtonTextDisabled]}>
            Delete my account
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.keepText}>Keep my garden</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  backCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 22, color: colors.pine },
  warning: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
  loseCard: {
    backgroundColor: colors.sevSoonBg,
    borderRadius: radius.xl,
    padding: 15,
  },
  loseEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.clay,
    marginBottom: 11,
  },
  loseRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  loseNumber: { fontFamily: fonts.monoSemiBold, fontSize: 15, color: colors.clay, width: 32 },
  loseNumberSmall: { fontFamily: fonts.monoSemiBold, fontSize: 15, color: colors.clay, width: 32 },
  loseText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
  confirmBlock: {},
  confirmLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: 8,
  },
  confirmInput: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: fonts.monoSemiBold,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 1,
  },
  deleteButton: {
    backgroundColor: colors.clay,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.seasonTrack,
  },
  deleteButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
  deleteButtonTextDisabled: { color: colors.disabled },
  keepText: {
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 13.5,
    color: colors.pine,
    paddingVertical: 12,
  },
});
