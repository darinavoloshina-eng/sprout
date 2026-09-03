// AddHarvestScreen.tsx
// Not in the design handoff — the mockup's "+" button on the Log screen had
// no destination screen designed (form validation was explicitly called out
// as not-yet-designed in the README). Built to match the new screens'
// visual language so it doesn't look like a bolt-on.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { GardenProfile, HarvestEntry } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropLabel } from '../cropMeta';
import { CropIcon } from '../components/ui';
import { parseWeightToLbs, UnitSystem } from '../utils/units';

export interface AddHarvestScreenProps {
  profile: GardenProfile;
  onCancel: () => void;
  onSave: (entry: HarvestEntry) => void;
}

export default function AddHarvestScreen({ profile, onCancel, onSave }: AddHarvestScreenProps) {
  const crops = profile.crops.filter((c): c is CropKey => c !== 'other');
  const [crop, setCrop] = useState<CropKey | null>(crops[0] ?? null);
  const [weightText, setWeightText] = useState('');
  const [note, setNote] = useState('');

  const units: UnitSystem = profile.units ?? 'imperial';
  const weight = parseFloat(weightText);
  const canSave = !!crop && !Number.isNaN(weight) && weight > 0;

  function save() {
    if (!crop || !canSave) return;
    onSave({
      id: `${Date.now()}`,
      crop,
      weightLbs: parseWeightToLbs(weight, units),
      note: note.trim(),
      dateISO: new Date().toISOString(),
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onCancel} accessibilityRole="button">
          <Text style={styles.back}>‹ Back to log</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Log a pick</Text>

        <Text style={styles.fieldLabel}>Crop</Text>
        <View style={styles.pillRow}>
          {crops.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.pill, crop === c && styles.pillSelected]}
              onPress={() => setCrop(c)}
              accessibilityRole="radio"
              accessibilityState={{ selected: crop === c }}
            >
              <CropIcon crop={c} size={14} />
              <Text style={crop === c ? styles.pillTextSelected : styles.pillText}>
                {cropLabel(c)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Weight ({units === 'imperial' ? 'lbs' : 'kg'})</Text>
        <TextInput
          style={styles.input}
          value={weightText}
          onChangeText={setWeightText}
          placeholder="0"
          placeholderTextColor={colors.inkSoft}
          keyboardType="decimal-pad"
          accessibilityLabel={units === 'imperial' ? 'Weight in pounds' : 'Weight in kilograms'}
        />

        <Text style={styles.fieldLabel}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. 4 cucumbers"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel="Note"
        />

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.saveButtonText}>Save pick</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  back: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginBottom: space.md },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 26,
    color: colors.pine,
    marginBottom: space.lg,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillSelected: { backgroundColor: colors.pine, borderColor: colors.pine },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
  pillTextSelected: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.onPine },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  spacer: { flex: 1, minHeight: space.xxl },
  saveButton: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: space.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: colors.disabled },
  saveButtonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPine },
});
