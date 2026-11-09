// CalendarScreen.tsx
// The month grid: each day's tasks, harvest and seed-collection windows,
// dotted by category. There used to be a Pro "Season" lane chart behind a
// Month/Season toggle; it was removed as more confusing than helpful.
//
// The mockup's day dots assume a full per-day task-generation engine that
// doesn't exist here. What's real and shown instead: watering days (from
// scheduleEngine, recurring weekly) and scheduled reminders (real dated
// entries), category-tagged by a keyword read of their own headline text.

import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  TaskCategory,
  getTasksForDate,
  harvestWindowsFor,
  mergeWateringTasks,
  seedCollectionWindowsFor,
} from '../engines/taskEngine';
import { cropIcon, cropLabel } from '../cropMeta';
import { NEXT_ACTION } from '../plantStageContent';
import { TabBar, TabKey } from '../components/ui';
import { useToday } from '../hooks/useToday';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface CalendarScreenProps {
  profile: GardenProfile;
  onOpenPaywall: () => void;
  onOpenLocation: () => void;
  onOpenSeedGuide?: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function CalendarScreen({
  profile,
  onOpenPaywall,
  onOpenLocation,
  onOpenSeedGuide,
  activeTab = 'calendar',
  onTabPress,
}: CalendarScreenProps) {
  const today = useToday();
  const [selected, setSelected] = useState(today);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // A new day arrived while Calendar was open (or suspended) on "today":
  // follow it, rather than leaving the selection on yesterday.
  const [shownToday, setShownToday] = useState(today);
  if (shownToday !== today) {
    setShownToday(today);
    if (sameDay(selected, shownToday)) {
      setSelected(today);
      setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    }
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  function goToMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setViewDate(next);
    setSelected(next);
  }

  function goToToday() {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  }

  function categoriesForDay(day: number): TaskCategory[] {
    const cats = new Set(getTasksForDate(profile, new Date(year, month, day), today).map((t) => t.category));
    return Array.from(cats);
  }

  function hasHarvestWindow(day: number): boolean {
    return harvestWindowsFor(profile, new Date(year, month, day)).length > 0;
  }

  function hasSeedWindow(day: number): boolean {
    return seedCollectionWindowsFor(profile, new Date(year, month, day)).length > 0;
  }

  const selectedTasks = useMemo(
    () => mergeWateringTasks(getTasksForDate(profile, selected, today)),
    [profile, selected, today]
  );
  const selectedHarvestWindows = useMemo(() => harvestWindowsFor(profile, selected), [profile, selected]);
  const selectedSeedWindows = useMemo(() => seedCollectionWindowsFor(profile, selected), [profile, selected]);
  const dayHeader = `${selected.toLocaleDateString(undefined, { weekday: 'short' })} ${selected.getDate()} · ${
    selectedTasks.length
  } ${selectedTasks.length === 1 ? 'task' : 'tasks'}`;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.monthNavRow}>
              <TouchableOpacity
                onPress={() => goToMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={styles.monthNavBtn}
              >
                <Text style={styles.monthNavArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{monthLabel}</Text>
              <TouchableOpacity
                onPress={() => goToMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                style={styles.monthNavBtn}
              >
                <Text style={styles.monthNavArrow}>›</Text>
              </TouchableOpacity>
            </View>
        </View>

        {!isCurrentMonth ? (
          <TouchableOpacity onPress={goToToday} accessibilityRole="button" style={styles.todayLink}>
            <Text style={styles.todayLinkText}>‹ Back to today</Text>
          </TouchableOpacity>
        ) : null}

          <>
            <View style={styles.gridCard}>
              <View style={styles.weekRow}>
                {WEEKDAY_LETTERS.map((l, i) => (
                  <Text key={i} style={styles.weekLetter}>
                    {l}
                  </Text>
                ))}
              </View>
              <View style={styles.daysGrid}>
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <View key={`pad-${i}`} style={styles.dayCell} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const date = new Date(year, month, day);
                  const isToday = sameDay(date, today);
                  const isSelected = sameDay(date, selected);
                  const cats = categoriesForDay(day);
                  const inSeedWindow = hasSeedWindow(day);
                  // A day inside both windows at once is rare (a final
                  // harvest's seed window and another crop's harvest window
                  // overlapping), and the two tints can't be shown at once
                  // in a cell this small — seeds wins arbitrarily since a
                  // one-time seed window is shorter-lived and easier to
                  // miss than a multi-week harvest window.
                  const inHarvestWindow = !inSeedWindow && hasHarvestWindow(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell,
                        inHarvestWindow && styles.dayCellHarvestWindow,
                        inSeedWindow && styles.dayCellSeedWindow,
                      ]}
                      onPress={() => setSelected(date)}
                      accessibilityRole="button"
                    >
                      {isToday ? (
                        <View style={styles.todayCircle}>
                          <Text style={styles.todayNumber}>{day}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                          {day}
                        </Text>
                      )}
                      <View style={styles.dotRow}>
                        {cats.slice(0, 3).map((c) => (
                          <View
                            key={c}
                            style={[styles.dot, { backgroundColor: CATEGORY_COLOR[c] }]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.legendRow}>
                {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((c) => (
                  <View key={c} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLOR[c] }]} />
                    <Text style={styles.legendText}>{CATEGORY_LABEL[c]}</Text>
                  </View>
                ))}
                <View style={styles.legendItem}>
                  <View style={styles.legendSwatch} />
                  <Text style={styles.legendText}>Likely harvest window</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: colors.seedBrownBg }]} />
                  <Text style={styles.legendText}>Likely seed window</Text>
                </View>
                <Text style={styles.legendHint}>· tap a day</Text>
              </View>
            </View>

            <Text style={styles.dayHeader}>{dayHeader}</Text>
            {selectedHarvestWindows.length > 0 ? (
              <View style={styles.harvestWindowCard}>
                {selectedHarvestWindows.map((w) => (
                  <View key={w.crop} style={styles.harvestWindowRow}>
                    <Text style={styles.harvestWindowIcon}>{cropIcon(w.crop)}</Text>
                    <Text style={styles.harvestWindowText}>
                      {cropLabel(w.crop)} may be ready to harvest around now
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {selectedSeedWindows.length > 0 ? (
              <View style={styles.seedWindowCard}>
                {selectedSeedWindows.map((w) => (
                  <View key={w.harvestId} style={styles.harvestWindowRow}>
                    <Text style={styles.harvestWindowIcon}>{cropIcon(w.crop)}</Text>
                    <Text style={styles.seedWindowText}>
                      {cropLabel(w.crop)} seeds may be ready to collect around now
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {selectedTasks.length === 0 && selectedHarvestWindows.length === 0 && selectedSeedWindows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No tasks this day, a quiet one 🌱</Text>
              </View>
            ) : selectedTasks.length > 0 ? (
              <View style={{ gap: space.sm }}>
                {selectedTasks.map((t, i) => (
                  <View key={i} style={styles.taskRow}>
                    <View style={[styles.taskIconWrap, { backgroundColor: t.iconBg }]}>
                      <Text style={styles.taskIconText}>{t.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle}>{t.title}</Text>
                      <Text style={styles.taskDetail}>{t.detail}</Text>
                      {t.buyUrl ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(t.buyUrl!)}
                          style={styles.buyNowPill}
                          accessibilityRole="button"
                          accessibilityLabel="Buy now on Amazon"
                        >
                          <Text style={styles.buyNowText}>Buy now →</Text>
                        </TouchableOpacity>
                      ) : null}
                      {t.guide && onOpenSeedGuide ? (
                        <TouchableOpacity onPress={onOpenSeedGuide} style={styles.guidePill} accessibilityRole="button">
                          <Text style={styles.guideText}>How to start seeds →</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />
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
    gap: space.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthNavBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavArrow: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.pine, marginTop: -1 },
  title: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 24, color: colors.pine },
  todayLink: { alignSelf: 'flex-start' },
  todayLinkText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.mossGreen },
  toggle: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: colors.seasonTrack,
    borderRadius: 11,
    padding: 3,
  },
  toggleBtn: { borderRadius: 9, paddingVertical: 5, paddingHorizontal: 11 },
  toggleBtnActive: { backgroundColor: colors.pine },
  toggleText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.inkSoft },
  toggleTextActive: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.onPine },
  gridCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 13,
  },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekLetter: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkSoft,
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, gap: 2 },
  dayCellHarvestWindow: { backgroundColor: colors.sevFyiBg, borderRadius: 10 },
  dayCellSeedWindow: { backgroundColor: colors.seedBrownBg, borderRadius: 10 },
  dayNumber: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
  dayNumberSelected: { color: colors.mossGreen, fontFamily: fonts.bodyBold },
  todayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.pine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNumber: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.onPine },
  dotRow: { flexDirection: 'row', gap: 2, height: 5, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, backgroundColor: colors.sevFyiBg },
  legendText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.inkSoft },
  legendHint: { fontFamily: fonts.body, fontSize: 10, color: colors.inkSoft },
  harvestWindowCard: {
    backgroundColor: colors.sevFyiBg,
    borderRadius: 15,
    padding: 13,
    gap: 8,
  },
  harvestWindowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  harvestWindowIcon: { fontSize: 18 },
  harvestWindowText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.sevFyiText },
  seedWindowCard: {
    backgroundColor: colors.seedBrownBg,
    borderRadius: 15,
    padding: 13,
    gap: 8,
  },
  seedWindowText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.seedBrown },
  dayHeader: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 15,
  },
  emptyText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 12,
    paddingHorizontal: 14,
  },
  taskIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIconText: { fontSize: 16 },
  taskTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  taskDetail: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  buyNowPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.clay,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  buyNowText: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.clay },
  guidePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.mossGreen,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  guideText: { fontFamily: fonts.bodySemiBold, fontSize: 11.5, color: colors.mossGreen },
  seasonLockCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
  },
  seasonLockIcon: { fontSize: 22 },
  seasonLockTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  seasonLockBody: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  seasonLockCta: {
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    color: colors.mossGreen,
    marginTop: 4,
  },
  seasonChartCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 13,
    marginTop: space.sm,
  },
  seasonMonthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 84,
    marginBottom: 8,
  },
  seasonMonthLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.inkSoft },
  seasonLanesWrap: { flexDirection: 'row', gap: 8 },
  seasonLabelCol: { width: 76, gap: 8 },
  seasonLaneLabelRow: { justifyContent: 'center', height: 20 },
  seasonLaneLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.ink },
  seasonTrackCol: { flex: 1, position: 'relative', gap: 8 },
  seasonLaneTrack: {
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.seasonTrack,
    position: 'relative',
    overflow: 'hidden',
  },
  seasonSeg: { position: 'absolute', top: 0, bottom: 0 },
  seasonSegSow: { backgroundColor: colors.mossGreen, opacity: 0.4 },
  seasonSegGrow: { backgroundColor: colors.mossGreen },
  seasonSegHarvest: { backgroundColor: colors.mustard },
  seasonNowLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: colors.clay },
  seasonNowLabelWrap: { position: 'absolute', top: -13, marginLeft: -11 },
  seasonNowLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.clay,
  },
  milestoneRowNext: { backgroundColor: colors.selectedBg, borderColor: colors.mossGreen },
  milestoneDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkSoft },
});
