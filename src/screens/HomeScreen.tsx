// HomeScreen.tsx
// Screens 4a (active day) and 4b (quiet day) from the design handoff —
// replaces the old watering-schedule dashboard entirely, per the README:
// "a task list personalized by crop is a commodity." Task completion,
// streaks, and today's task list are all real (see taskEngine.ts).
//
// 5e (offline) is real too: this app is already local-storage-first, so
// task completion, harvest logging, and photo capture all keep working
// with zero connectivity — nothing here was ever blocking on network. The
// only thing that actually depends on a connection is the weather fetch,
// so that's the only thing the offline banner talks about, using the real
// last-fetched timestamp rather than the mockup's generic "syncs when
// you're back" (there's no sync destination to promise here — see
// storage.ts).
//
// 5d (cold-start) is real too, now that frost.ts exists: it triggers when
// today is before the user's real, historically-estimated last frost date
// for their actual coordinates (not a calendar-month guess, which would be
// wrong for the Southern Hemisphere and any non-temperate climate). The
// mockup's "one nudge a month until spring" promise is dropped — there's no
// scheduled-notification system built for that, and promising proactive
// pings the app doesn't send would be worse than not mentioning it.

import React, { useEffect, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { CropKey, computeSchedule } from '../engines/scheduleEngine';
import { PlantedBucket } from '../engines/alertsEngine';
import {
  DailyTask,
  computeLongestStreak,
  computeStreak,
  getTodayTasks,
  isTaskComplete,
  toggleTask,
} from '../engines/taskEngine';
import { useLiveWeather } from '../hooks/useLiveWeather';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { formatTemp, formatWeightLbs, UnitSystem } from '../utils/units';
import { saveProfile } from '../api/storage';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { cropLabel } from '../cropMeta';
import { NEXT_ACTION, STAGE_HEADLINE, BUCKET_LABEL } from '../plantStageContent';
import { plantingGuidanceFor } from '../engines/plantingGuide';
import { TabBar, TabKey } from '../components/ui';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BUCKET_RANK: Record<PlantedBucket, number> = { w0: 0, w2: 1, w4: 2, w8: 3 };

// Not date-scoped like daily tasks — one-time prep, so a check-off sticks
// for the whole cold season rather than resetting every day.
const COLD_START_TASKS: DailyTask[] = [
  {
    id: 'coldstart-order-seeds',
    icon: '🌱',
    iconBg: colors.selectedBg,
    title: 'Order or check your seeds',
    detail: 'Confirm what you already have before buying more',
    category: 'tend',
  },
  {
    id: 'coldstart-prep-bed',
    icon: '🧤',
    iconBg: colors.selectedBg,
    title: 'Clean and prep your bed',
    detail: "Clear old growth and refresh the soil while it's easy to reach",
    category: 'tend',
  },
  {
    id: 'coldstart-plan-layout',
    icon: '📐',
    iconBg: colors.selectedBg,
    title: 'Plan out your bed layout',
    detail: "Decide what goes where before you're rushing to plant",
    category: 'tend',
  },
];

function todayMonthDay(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthDay(monthDay: string): string {
  const [m, d] = monthDay.split('-').map(Number);
  return new Date(2021, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

function ProgressRing({ fraction }: { fraction: number }) {
  const size = 52;
  const strokeWidth = 13;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.mustard}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - clamped)}
        fill="none"
      />
    </Svg>
  );
}

export default function HomeScreen({
  profile,
  onProfileChange,
  onOpenTriage,
  onOpenMyGarden,
  onOpenLog,
  onOpenAddHarvest,
  onAddPhotoFor,
  activeTab = 'home',
  onTabPress,
}: {
  profile: GardenProfile;
  onProfileChange: (p: GardenProfile) => void;
  onOpenTriage: () => void;
  onOpenMyGarden: () => void;
  onOpenLog: () => void;
  onOpenAddHarvest: () => void;
  onAddPhotoFor: (crop: CropKey) => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}) {
  const { refreshing, error, refresh } = useLiveWeather(profile, onProfileChange);
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  const today = useMemo(() => new Date(), []);
  const tasks = useMemo(() => getTodayTasks(profile, today), [profile, today]);
  const streak = computeStreak(profile, today);
  const longestStreak = computeLongestStreak(profile);
  const doneCount = tasks.filter((t) => isTaskComplete(profile, t.id)).length;
  const leftCount = tasks.length - doneCount;

  function handleToggle(taskId: string) {
    const updated = toggleTask(profile, taskId);
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const lastFrostMD = profile.frostDates?.lastFrostMonthDay ?? null;
  const isColdStart = !!lastFrostMD && todayMonthDay(today) < lastFrostMD;
  const daysToFrost = useMemo(() => {
    if (!lastFrostMD) return null;
    const [m, d] = lastFrostMD.split('-').map(Number);
    const target = new Date(today.getFullYear(), m - 1, d);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((target.getTime() - startOfToday.getTime()) / 86400000);
  }, [lastFrostMD, today]);

  const title = isColdStart
    ? 'Not planting season yet'
    : tasks.length === 0
      ? 'Nothing due today'
      : leftCount === 0
        ? 'All done for today'
        : `${leftCount} ${leftCount === 1 ? 'thing' : 'things'} left`;

  const totalLbs = (profile.harvests ?? []).reduce((sum, h) => sum + h.weightLbs, 0);
  const units: UnitSystem = profile.units ?? 'imperial';

  // For the quiet-day card and "ready to pick" list — the crop furthest
  // along its (coarse) planted bucket. Home is strictly today's to-do
  // list, so a not-planted-yet crop only qualifies once its planting date
  // is actually today or already past due — never a preview of something
  // due later this week or beyond (see plantingGuidanceFor's isPastDue in
  // engines/plantingGuide.ts), otherwise a crop that isn't plantable for
  // months would get featured as if it were today's business.
  const gardenCrops = profile.crops.filter((c): c is CropKey => c !== 'other');
  const featurableCrops = gardenCrops.filter((c) => {
    const bucket = (profile.plantedWeeks[c] ?? 'w2') as PlantedBucket;
    if (bucket !== 'w0') return true;
    return plantingGuidanceFor(c, profile.frostDates).isPastDue;
  });
  const sortedByStage = [...featurableCrops].sort((a, b) => {
    const ba = (profile.plantedWeeks[a] ?? 'w2') as PlantedBucket;
    const bb = (profile.plantedWeeks[b] ?? 'w2') as PlantedBucket;
    return BUCKET_RANK[bb] - BUCKET_RANK[ba];
  });
  const topCrop = sortedByStage[0];
  const topBucket = topCrop ? ((profile.plantedWeeks[topCrop] ?? 'w2') as PlantedBucket) : null;
  const topNotPlanted = topBucket === 'w0';
  const topGuidance =
    topCrop && topNotPlanted ? plantingGuidanceFor(topCrop, profile.frostDates) : null;
  const readyToPick = gardenCrops.filter(
    (c) => ((profile.plantedWeeks[c] ?? 'w2') as PlantedBucket) === 'w8'
  );

  const nextReminder = [...profile.scheduledReminders]
    .filter((r) => new Date(r.dateISO).getTime() > today.getTime())
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())[0];

  const weatherAlert = useMemo(
    () =>
      computeSchedule({
        crops: profile.crops,
        sun: profile.sun,
        bedWidthFt: profile.bedWidthFt,
        bedLengthFt: profile.bedLengthFt,
        method: profile.method,
        lineSpacingIn: profile.lineSpacingIn,
        emitterSpacingIn: profile.emitterSpacingIn,
        emitterGph: profile.emitterGph,
        weather: profile.weather,
      }).weatherAlert,
    [profile]
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={colors.mossGreen} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>{dateLabel}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          {streak > 0 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 {streak} {streak === 1 ? 'day' : 'days'}</Text>
            </View>
          ) : null}
        </View>

        {profile.weather ? (
          <View style={styles.currentWeatherRow}>
            <Text style={styles.currentWeatherIcon}>{weatherEmoji(profile.weather.weatherCode)}</Text>
            {profile.weather.tempF != null ? (
              <Text style={styles.currentWeatherTemp}>{formatTemp(profile.weather.tempF, units)}</Text>
            ) : null}
            {profile.weather.todayHighF != null && profile.weather.todayLowF != null ? (
              <Text style={styles.currentWeatherHL}>
                H:{formatTemp(profile.weather.todayHighF, units)} L:{formatTemp(profile.weather.todayLowF, units)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isOnline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineIcon}>📡</Text>
            <Text style={styles.offlineText}>
              You're offline, {weatherAgeLabel(profile.weatherFetchedAt)}. Tasks and photos still
              save normally.
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isColdStart && daysToFrost != null ? (
          <>
            <View style={styles.frostCard}>
              <Text style={styles.frostCountdown}>
                {daysToFrost} {daysToFrost === 1 ? 'day' : 'days'}
              </Text>
              <Text style={styles.frostSub}>
                to your estimated last frost: {formatMonthDay(lastFrostMD!)}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Get ready</Text>
            <View style={{ gap: space.sm }}>
              {COLD_START_TASKS.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  completedAt={isTaskComplete(profile, t.id)}
                  onToggle={() => handleToggle(t.id)}
                />
              ))}
            </View>

            <Text style={styles.frostFootnote}>
              Estimated from your area's weather history over the past few years. Check back as
              the date gets closer.
            </Text>
          </>
        ) : tasks.length > 0 ? (
          <>
            <View style={styles.progressCard}>
              <ProgressRing fraction={tasks.length ? doneCount / tasks.length : 0} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.progressTitle}>
                  {leftCount === 0 ? "Nice, everything's done" : 'Finish today to keep the streak'}
                </Text>
                {longestStreak > 0 ? (
                  <Text style={styles.progressSub}>Your longest run is {longestStreak} days.</Text>
                ) : null}
              </View>
            </View>

            <Text style={styles.sectionLabel}>Today</Text>
            <View style={{ gap: space.sm }}>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} completedAt={isTaskComplete(profile, t.id)} onToggle={() => handleToggle(t.id)} />
              ))}
            </View>

            {weatherAlert ? (
              <View style={styles.weatherCard}>
                <Text style={styles.weatherIcon}>🌡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weatherTitle}>
                    {profile.weather?.tempF != null
                      ? `${formatTemp(profile.weather.tempF, units)} today`
                      : 'Weather note'}
                  </Text>
                  <Text style={styles.weatherBody}>{weatherAlert}</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {topCrop && topBucket ? (
              <View style={styles.reasonCard}>
                <Text style={styles.reasonTitle}>
                  {topNotPlanted ? `Plant the ${cropLabel(topCrop)}` : `Go check on the ${cropLabel(topCrop)}`}
                </Text>
                <Text style={styles.reasonBody}>
                  {topNotPlanted ? topGuidance!.detail : NEXT_ACTION[topCrop]?.[topBucket] ?? ''}
                </Text>
              </View>
            ) : null}

            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={[styles.shortcut, styles.shortcutHighlight]}
                onPress={() => (topCrop ? onAddPhotoFor(topCrop) : onOpenMyGarden())}
                accessibilityRole="button"
              >
                <Text style={styles.shortcutIcon}>{topNotPlanted ? '🌱' : '📷'}</Text>
                <Text style={styles.shortcutLabel}>{topNotPlanted ? 'Plant it' : 'Add a photo'}</Text>
                {topNotPlanted ? (
                  <Text style={styles.shortcutSub}>{topGuidance!.headline}</Text>
                ) : topBucket ? (
                  <Text style={styles.shortcutSub}>{BUCKET_LABEL[topBucket]}</Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcut} onPress={onOpenAddHarvest} accessibilityRole="button">
                <Text style={styles.shortcutIcon}>🧺</Text>
                <Text style={styles.shortcutLabel}>Log a pick</Text>
                <Text style={styles.shortcutSub}>
                  {totalLbs > 0 ? `${formatWeightLbs(totalLbs, units)} so far` : 'Nothing yet'}
                </Text>
              </TouchableOpacity>
            </View>

            {readyToPick.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Ready to pick right now</Text>
                <View style={{ gap: space.sm }}>
                  {readyToPick.map((c) => (
                    <View key={c} style={styles.pickRow}>
                      <Text style={styles.pickTitle}>{cropLabel(c)}</Text>
                      <Text style={styles.pickSub}>{STAGE_HEADLINE[c]?.w8 ?? ''}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {nextReminder ? (
              <View style={styles.nextUpCard}>
                <View style={styles.nextUpHead}>
                  <Text style={styles.nextUpLabel}>Next up</Text>
                  <Text style={styles.nextUpDate}>
                    {new Date(nextReminder.dateISO)
                      .toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
                      .toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.nextUpTitle}>{nextReminder.title}</Text>
                <Text style={styles.nextUpBody}>{nextReminder.body}</Text>
              </View>
            ) : null}
          </>
        )}

        <View style={styles.spacer} />

        {isColdStart || tasks.length > 0 ? (
          <View style={styles.shortcutRow}>
            <TouchableOpacity
              style={styles.shortcut}
              onPress={() => (topCrop ? onAddPhotoFor(topCrop) : onOpenMyGarden())}
              accessibilityRole="button"
            >
              <Text style={styles.shortcutIcon}>{topNotPlanted ? '🌱' : '📷'}</Text>
              <Text style={styles.shortcutLabel}>{topNotPlanted ? 'Plant it' : 'Add a photo'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shortcut} onPress={onOpenAddHarvest} accessibilityRole="button">
              <Text style={styles.shortcutIcon}>🧺</Text>
              <Text style={styles.shortcutLabel}>Log a pick</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity onPress={onOpenTriage} accessibilityRole="button">
          <Text style={styles.triageLink}>Something look wrong? Diagnose a plant ›</Text>
        </TouchableOpacity>
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />
    </View>
  );
}

// WMO weather interpretation codes (what Open-Meteo's `weather_code` returns)
// grouped into the handful of icons that actually read as distinct at a
// glance — see https://open-meteo.com/en/docs for the full code list.
function weatherEmoji(code: number | null): string {
  if (code == null) return '🌡️';
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌡️';
}

function weatherAgeLabel(weatherFetchedAt: string | null): string {
  if (!weatherFetchedAt) return 'weather hasn\'t loaded yet';
  const ageMs = Date.now() - new Date(weatherFetchedAt).getTime();
  const ageMin = Math.round(ageMs / 60000);
  if (ageMin < 1) return 'showing weather from just now';
  if (ageMin < 60) return `showing weather from ${ageMin} min ago`;
  const ageHr = Math.round(ageMin / 60);
  if (ageHr < 24) return `showing weather from ${ageHr} hr ago`;
  const ageDays = Math.round(ageHr / 24);
  return `showing weather from ${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`;
}

function TaskRow({
  task,
  completedAt,
  onToggle,
}: {
  task: DailyTask;
  completedAt: string | null;
  onToggle: () => void;
}) {
  const done = !!completedAt;
  return (
    <TouchableOpacity
      style={[styles.taskRow, done && styles.taskRowDone]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
    >
      <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
        {done ? (
          <Text style={styles.taskDone}>
            Done{' '}
            {new Date(completedAt as string).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            · logged
          </Text>
        ) : (
          <Text style={styles.taskDetail}>{task.detail}</Text>
        )}
      </View>
      {!done ? <Text style={styles.taskIcon}>{task.icon}</Text> : null}
    </TouchableOpacity>
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
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, color: colors.pine },
  streakPill: {
    backgroundColor: colors.sevFyiBg,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  streakText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: colors.sevFyiText },
  currentWeatherRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currentWeatherIcon: { fontSize: 13 },
  currentWeatherTemp: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  currentWeatherHL: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  errorText: { fontFamily: fonts.body, fontSize: 12, color: colors.clay },
  offlineBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.sevFyiBg,
    borderRadius: 15,
    padding: 12,
    paddingHorizontal: 14,
  },
  offlineIcon: { fontSize: 14 },
  offlineText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.sevFyiText },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 14,
  },
  progressTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.onPine },
  progressSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.pineFoot, marginTop: 3 },
  sectionLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 14,
  },
  taskRowDone: { backgroundColor: colors.paper, borderColor: colors.seasonTrack },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.mossGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: { backgroundColor: colors.mossGreen, borderColor: colors.mossGreen },
  checkMark: { color: colors.onPine, fontFamily: fonts.bodyBold, fontSize: 12 },
  taskTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  taskTitleDone: {
    fontFamily: fonts.bodySemiBold,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  taskDetail: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
  taskDone: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  taskIcon: { fontSize: 16 },
  weatherCard: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    backgroundColor: colors.sevSoonBg,
    borderRadius: 15,
    padding: 12,
    paddingHorizontal: 14,
  },
  weatherIcon: { fontSize: 15 },
  weatherTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.clay },
  weatherBody: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft, marginTop: 2 },
  frostCard: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 17,
    alignItems: 'center',
  },
  frostCountdown: { fontFamily: fonts.monoSemiBold, fontSize: 30, color: colors.onPine },
  frostSub: { fontFamily: fonts.body, fontSize: 12, color: colors.pineFoot, marginTop: 4, textAlign: 'center' },
  frostFootnote: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.inkSoft },
  reasonCard: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: 17,
  },
  reasonTitle: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.onPine, marginBottom: 7 },
  reasonBody: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.pineFoot },
  shortcutRow: { flexDirection: 'row', gap: space.sm },
  shortcut: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  shortcutHighlight: { borderColor: colors.mossGreen },
  shortcutIcon: { fontSize: 21 },
  shortcutLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.ink },
  shortcutSub: { fontFamily: fonts.body, fontSize: 10.5, color: colors.inkSoft },
  pickRow: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    paddingHorizontal: 14,
  },
  pickTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  pickSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  nextUpCard: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: 14,
  },
  nextUpHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  nextUpLabel: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
  },
  nextUpDate: { fontFamily: fonts.monoSemiBold, fontSize: 11, color: colors.inkSoft },
  nextUpTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  nextUpBody: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: colors.inkSoft, marginTop: 3 },
  spacer: { height: space.sm },
  triageLink: {
    textAlign: 'center',
    fontFamily: fonts.bodySemiBold,
    fontSize: 12.5,
    color: colors.mossGreen,
    paddingVertical: space.sm,
  },
});
