// CalendarScreen.tsx
// Screens 1f (month grid, free) and 1e (season lane chart, Pro) from the
// design handoff, combined behind one Month/Season toggle as designed.
//
// The mockup's day dots assume a full per-day task-generation engine that
// doesn't exist here. What's real and shown instead: watering days (from
// scheduleEngine, recurring weekly) and scheduled reminders (real dated
// entries), category-tagged by a keyword read of their own headline text.
//
// The season lane chart is real now (see computeSeasonChart below) — sow/
// grow/harvest bars are derived from real frost dates (api/frost.ts) and
// each crop's real season shape (plantStageContent.ts), and the "coming up"
// milestones are the real harvest-start and first-frost dates, not
// fabricated horticultural advice like "topping" or "last feed" which
// nothing in this app models. It's gated behind profile.isPro, which the
// paywall's trial button sets locally — see PaywallScreen.tsx for why
// that's a local preview flag, not a real subscription check.

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CropKey } from '../engines/scheduleEngine';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  TaskCategory,
  getTasksForDate,
} from '../engines/taskEngine';
import { cropIcon, cropLabel } from '../cropMeta';
import { NEXT_ACTION, SEASON_SHAPE } from '../plantStageContent';
import { TabBar, TabKey } from '../components/ui';

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthDayToDate(monthDay: string, year: number): Date {
  const [m, d] = monthDay.split('-').map(Number);
  return new Date(year, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatMonthDay(monthDay: string): string {
  const [m, d] = monthDay.split('-').map(Number);
  return new Date(2021, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

interface SeasonLane {
  crop: CropKey;
  icon: string;
  label: string;
  sowFrac: number;
  growFrac: number;
  harvestFrac: number;
}

interface SeasonMilestone {
  date: Date;
  title: string;
  detail: string;
}

interface SeasonChartData {
  monthLabels: string[];
  lanes: SeasonLane[];
  nowFrac: number;
  milestones: SeasonMilestone[];
}

function computeSeasonChart(profile: GardenProfile, today: Date): SeasonChartData | null {
  const frostDates = profile.frostDates;
  if (!frostDates) return null;

  const year = today.getFullYear();
  const seasonStart = monthDayToDate(frostDates.lastFrostMonthDay, year);
  const cropsList = profile.crops.filter((c): c is CropKey => c !== 'other');
  const cropWeeks = cropsList.map((c) => SEASON_SHAPE[c]?.weeks ?? 12);
  const maxWeeks = cropWeeks.length ? Math.max(...cropWeeks) : 12;
  const cropBasedEnd = addDays(seasonStart, maxWeeks * 7);

  let seasonEnd = cropBasedEnd;
  if (frostDates.firstFrostMonthDay) {
    const fallFrost = monthDayToDate(frostDates.firstFrostMonthDay, year);
    if (fallFrost > seasonStart && fallFrost > seasonEnd) seasonEnd = fallFrost;
  }

  const totalDays = (seasonEnd.getTime() - seasonStart.getTime()) / 86400000;
  if (totalDays <= 0) return null;

  const lanes: SeasonLane[] = cropsList
    .map((crop) => {
      const shape = SEASON_SHAPE[crop];
      if (!shape) return null;
      const cropDays = shape.weeks * 7;
      return {
        crop,
        icon: cropIcon(crop),
        label: cropLabel(crop),
        sowFrac: (cropDays * (shape.sow / 100)) / totalDays,
        growFrac: (cropDays * (shape.grow / 100)) / totalDays,
        harvestFrac: (cropDays * (shape.harvest / 100)) / totalDays,
      };
    })
    .filter((l): l is SeasonLane => l !== null);

  const nowFrac = Math.max(0, Math.min(1, (today.getTime() - seasonStart.getTime()) / (totalDays * 86400000)));

  const monthLabels = [0, 0.25, 0.5, 0.75, 1].map((f) =>
    new Date(seasonStart.getTime() + f * totalDays * 86400000)
      .toLocaleDateString(undefined, { month: 'short' })
      .toUpperCase()
  );

  const milestones: SeasonMilestone[] = [];
  for (const crop of cropsList) {
    const shape = SEASON_SHAPE[crop];
    if (!shape) continue;
    const cropDays = shape.weeks * 7;
    const harvestStart = addDays(seasonStart, cropDays * ((shape.sow + shape.grow) / 100));
    if (harvestStart >= today) {
      milestones.push({
        date: harvestStart,
        title: `${cropLabel(crop)} harvest begins`,
        detail: NEXT_ACTION[crop]?.w8 ?? '',
      });
    }
  }
  if (frostDates.firstFrostMonthDay) {
    const fallFrost = monthDayToDate(frostDates.firstFrostMonthDay, year);
    if (fallFrost >= today) {
      milestones.push({
        date: fallFrost,
        title: 'First frost expected',
        detail: `Plan your last picks before ${formatMonthDay(frostDates.firstFrostMonthDay)}.`,
      });
    }
  }
  milestones.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { monthLabels, lanes, nowFrac, milestones: milestones.slice(0, 3) };
}

function SeasonChartView({ data }: { data: SeasonChartData }) {
  return (
    <View>
      <View style={styles.seasonChartCard}>
        <View style={styles.seasonMonthRow}>
          {data.monthLabels.map((m, i) => (
            <Text key={i} style={styles.seasonMonthLabel}>
              {m}
            </Text>
          ))}
        </View>
        <View style={styles.seasonLanesWrap}>
          <View style={styles.seasonLabelCol}>
            {data.lanes.map((lane) => (
              <View key={lane.crop} style={styles.seasonLaneLabelRow}>
                <Text style={styles.seasonLaneLabel} numberOfLines={1}>
                  {lane.icon} {lane.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.seasonTrackCol}>
            {data.lanes.map((lane) => (
              <View key={lane.crop} style={styles.seasonLaneTrack}>
                <View
                  style={[
                    styles.seasonSeg,
                    styles.seasonSegSow,
                    { left: '0%', width: `${lane.sowFrac * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.seasonSeg,
                    styles.seasonSegGrow,
                    { left: `${lane.sowFrac * 100}%`, width: `${lane.growFrac * 100}%` },
                  ]}
                />
                <View
                  style={[
                    styles.seasonSeg,
                    styles.seasonSegHarvest,
                    {
                      left: `${(lane.sowFrac + lane.growFrac) * 100}%`,
                      width: `${lane.harvestFrac * 100}%`,
                    },
                  ]}
                />
              </View>
            ))}
            <View style={[styles.seasonNowLine, { left: `${data.nowFrac * 100}%` }]} />
            <View style={[styles.seasonNowLabelWrap, { left: `${data.nowFrac * 100}%` }]}>
              <Text style={styles.seasonNowLabel}>NOW</Text>
            </View>
          </View>
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.mossGreen, opacity: 0.4 }]} />
            <Text style={styles.legendText}>Sow</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.mossGreen }]} />
            <Text style={styles.legendText}>Grow</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.mustard }]} />
            <Text style={styles.legendText}>Harvest</Text>
          </View>
        </View>
      </View>

      {data.milestones.length > 0 && (
        <>
          <Text style={styles.dayHeader}>Coming up this season</Text>
          <View style={{ gap: space.sm }}>
            {data.milestones.map((m, i) => (
              <View key={i} style={[styles.taskRow, i === 0 && styles.milestoneRowNext]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{m.title}</Text>
                  {m.detail ? <Text style={styles.taskDetail}>{m.detail}</Text> : null}
                </View>
                <Text style={styles.milestoneDate}>
                  {m.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

export interface CalendarScreenProps {
  profile: GardenProfile;
  onOpenPaywall: () => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}

export default function CalendarScreen({
  profile,
  onOpenPaywall,
  activeTab = 'calendar',
  onTabPress,
}: CalendarScreenProps) {
  const [view, setView] = useState<'month' | 'season'>('month');
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(today);
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

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

  const selectedTasks = useMemo(() => getTasksForDate(profile, selected, today), [profile, selected, today]);
  const dayHeader = `${selected.toLocaleDateString(undefined, { weekday: 'short' })} ${selected.getDate()} · ${
    selectedTasks.length
  } ${selectedTasks.length === 1 ? 'task' : 'tasks'}`;

  const seasonChartData = useMemo(
    () => (profile.isPro ? computeSeasonChart(profile, today) : null),
    [profile, today]
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          {view === 'month' ? (
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
          ) : (
            <Text style={styles.title}>{monthLabel}</Text>
          )}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'month' && styles.toggleBtnActive]}
              onPress={() => setView('month')}
              accessibilityRole="button"
            >
              <Text style={view === 'month' ? styles.toggleTextActive : styles.toggleText}>
                Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, view === 'season' && styles.toggleBtnActive]}
              onPress={() => setView('season')}
              accessibilityRole="button"
            >
              <Text style={view === 'season' ? styles.toggleTextActive : styles.toggleText}>
                Season
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {view === 'month' && !isCurrentMonth ? (
          <TouchableOpacity onPress={goToToday} accessibilityRole="button" style={styles.todayLink}>
            <Text style={styles.todayLinkText}>‹ Back to today</Text>
          </TouchableOpacity>
        ) : null}

        {view === 'season' ? (
          seasonChartData ? (
            <SeasonChartView data={seasonChartData} />
          ) : (
            <TouchableOpacity style={styles.seasonLockCard} onPress={onOpenPaywall} accessibilityRole="button">
              <Text style={styles.seasonLockIcon}>🔒</Text>
              <Text style={styles.seasonLockTitle}>Season view is Pro</Text>
              <Text style={styles.seasonLockBody}>
                See every crop's sow-to-harvest window on one timeline, with a NOW marker and the
                milestones coming up the rest of the season.
              </Text>
              <Text style={styles.seasonLockCta}>Try Pro free for 14 days ›</Text>
            </TouchableOpacity>
          )
        ) : (
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
                  return (
                    <TouchableOpacity
                      key={day}
                      style={styles.dayCell}
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
                <Text style={styles.legendHint}>· tap a day</Text>
              </View>
            </View>

            <Text style={styles.dayHeader}>{dayHeader}</Text>
            {selectedTasks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No tasks this day, a quiet one 🌱</Text>
              </View>
            ) : (
              <View style={{ gap: space.sm }}>
                {selectedTasks.map((t, i) => (
                  <View key={i} style={styles.taskRow}>
                    <View style={[styles.taskIconWrap, { backgroundColor: t.iconBg }]}>
                      <Text style={styles.taskIconText}>{t.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskTitle}>{t.title}</Text>
                      <Text style={styles.taskDetail}>{t.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
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
  legendText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.inkSoft },
  legendHint: { fontFamily: fonts.body, fontSize: 10, color: colors.inkSoft },
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
