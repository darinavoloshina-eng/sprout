import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { triageTree, TriageCause } from '../engines/triageEngine';
import { GardenProfile } from '../types';
import { colors, radius, space } from '../theme';
import { cropIcon } from '../cropMeta';
import { OptionRow, PrimaryButton } from '../components/ui';

type Step = 'crop' | 'symptom' | 'q1' | 'q2' | 'result';

export default function TriageScreen({
  profile,
  onDone,
}: {
  profile: GardenProfile;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('crop');
  const [crop, setCrop] = useState<string | null>(null);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [q1, setQ1] = useState<string | null>(null);
  const [results, setResults] = useState<TriageCause[]>([]);
  const [resultIdx, setResultIdx] = useState(0);

  const crops = profile.crops.length
    ? profile.crops
    : ['tomatoes', 'cucumbers', 'lettuce', 'carrots'];

  function goBack() {
    if (step === 'crop') onDone();
    else if (step === 'symptom') setStep('crop');
    else if (step === 'q1') setStep('symptom');
    else if (step === 'q2') setStep('q1');
    else setStep('q2');
  }

  const current = symptom ? triageTree[symptom] : null;
  const cause = results[resultIdx];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={goBack} accessibilityRole="button">
        <Text style={styles.back}>{step === 'crop' ? '‹ Back to my garden' : '‹ Back'}</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Plant check</Text>

      {step === 'crop' && (
        <>
          <Text style={styles.h1}>Which plant?</Text>
          <Text style={styles.sub}>Pick the one that's having trouble.</Text>
          {crops.map((c) => (
            <OptionRow
              key={c}
              icon={cropIcon(c)}
              label={cap(c)}
              onPress={() => {
                setCrop(c);
                setStep('symptom');
              }}
            />
          ))}
        </>
      )}

      {step === 'symptom' && (
        <>
          <Text style={styles.h1}>What are you seeing?</Text>
          <Text style={styles.sub}>Pick the closest match.</Text>
          {Object.entries(triageTree).map(([key, s]) => (
            <OptionRow
              key={key}
              icon={s.icon}
              label={s.label}
              onPress={() => {
                setSymptom(key);
                setStep('q1');
              }}
            />
          ))}
        </>
      )}

      {step === 'q1' && current && (
        <>
          <Text style={styles.h1}>{current.q1.text}</Text>
          {current.q1.options.map((o) => (
            <OptionRow
              key={o.key}
              label={o.label}
              onPress={() => {
                setQ1(o.key);
                setStep('q2');
              }}
            />
          ))}
        </>
      )}

      {step === 'q2' && current && q1 && (
        <>
          <Text style={styles.h1}>{current.q2.text}</Text>
          {current.q2.options.map((o) => (
            <OptionRow
              key={o.key}
              label={o.label}
              onPress={() => {
                setResults(current.resolve({ q1, q2: o.key }));
                setResultIdx(0);
                setStep('result');
              }}
            />
          ))}
        </>
      )}

      {step === 'result' && cause && (
        <>
          <Text style={styles.h1}>Likely cause · {cap(crop ?? '')}</Text>
          <View style={styles.resultCard}>
            <Text
              style={[
                styles.confidence,
                cause.confidence === 'Likely' ? styles.confidenceLikely : styles.confidencePossible,
              ]}
            >
              {cause.confidence}
            </Text>
            <Text style={[styles.risk, cause.risk === 'low' ? styles.riskLow : styles.riskSoon]}>
              {cause.risk === 'low' ? 'Low risk · keep an eye on it' : 'Worth addressing soon'}
            </Text>
            <Text style={styles.resultTitle}>{cause.title}</Text>
            <Text style={styles.resultExplain}>{cause.explain}</Text>
            <View style={styles.resultAction}>
              <Text style={styles.resultActionText}>
                <Text style={styles.bold}>Try this: </Text>
                {cause.action}
              </Text>
            </View>
            {resultIdx < results.length - 1 && (
              <TouchableOpacity onPress={() => setResultIdx(resultIdx + 1)} accessibilityRole="button">
                <Text style={styles.other}>Not quite? See another possibility</Text>
              </TouchableOpacity>
            )}
          </View>
          <PrimaryButton label="Done" onPress={onDone} />
        </>
      )}
    </ScrollView>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: space.xl, paddingBottom: 60 },
  back: { color: colors.inkSoft, marginBottom: space.md, fontSize: 13 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    fontWeight: '600',
    marginBottom: space.xs,
  },
  h1: { fontSize: 24, fontWeight: '700', color: colors.pine, marginBottom: space.xs },
  sub: { fontSize: 14, color: colors.inkSoft, marginBottom: space.lg, lineHeight: 21 },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.xl,
    marginBottom: space.lg,
  },
  confidence: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: space.sm,
    fontWeight: '700',
  },
  confidenceLikely: { backgroundColor: colors.sevLowBg, color: colors.pine },
  confidencePossible: { backgroundColor: colors.sevFyiBg, color: colors.sevFyiText },
  risk: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  riskLow: { color: colors.mossGreen },
  riskSoon: { color: colors.clay },
  resultTitle: { fontSize: 19, fontWeight: '700', color: colors.pine, marginBottom: space.sm },
  resultExplain: { fontSize: 13, marginBottom: space.md, lineHeight: 20, color: colors.ink },
  resultAction: { backgroundColor: colors.paper, borderRadius: radius.sm, padding: space.md },
  resultActionText: { fontSize: 13, color: colors.inkSoft, lineHeight: 20 },
  bold: { fontWeight: '700', color: colors.ink },
  other: {
    color: colors.mossGreen,
    marginTop: space.md,
    textDecorationLine: 'underline',
    fontSize: 12.5,
  },
});
