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

import React, { useMemo, useState } from 'react';
import { Linking, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { CropKey, computeSchedule } from '../engines/scheduleEngine';
import { PlantedBucket } from '../engines/alertsEngine';
import {
  DailyTask,
  WateringNote,
  computeLongestStreak,
  computeStreak,
  effectiveBucket,
  getTodayTasks,
  isSeedStartTask,
  nextSeedStep,
  activeSeedStartPlan,
  dateKey,
  isTaskComplete,
  isWateringTask,
  seedSeasonCard,
  nextBedWatering,
  toggleTask,
  wateringNotes,
} from '../engines/taskEngine';
import { useLiveWeather } from '../hooks/useLiveWeather';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { formatTemp, formatWeightLbs, UnitSystem } from '../utils/units';
import { saveProfile } from '../api/storage';
import { GardenProfile } from '../types';
import { colors, fonts, radius, space } from '../theme';
import { bedCrops, cropLabel } from '../cropMeta';
import { NEXT_ACTION, STAGE_HEADLINE, BUCKET_LABEL } from '../plantStageContent';
import { plantingGuidanceFor } from '../engines/plantingGuide';
import { CropIcon, TabBar, TabKey } from '../components/ui';
import { OwlMark } from '../components/OwlMark';
import { useToday } from '../hooks/useToday';

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

// Added to the cold-season "Get ready" list only when at least one crop is
// being started from seed, so a buy-seedlings garden never sees it.
const SEED_SUPPLIES_TASK: DailyTask = {
  id: 'coldstart-seed-supplies',
  icon: '🪴',
  iconBg: colors.selectedBg,
  title: 'Gather seed-starting supplies',
  detail: 'A tray with a lid, seed-starting mix, a heat mat, and a grow light',
  category: 'tend',
  guide: true,
};

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
  onOpenSeedGuide,
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
  /** 'steps' opens the guide at its five steps; default is the supply list. */
  onOpenSeedGuide: (startAt?: 'kit' | 'steps') => void;
  onOpenMyGarden: () => void;
  onOpenLog: () => void;
  onOpenAddHarvest: () => void;
  onAddPhotoFor: (crop: CropKey) => void;
  activeTab?: TabKey;
  onTabPress?: (tab: TabKey) => void;
}) {
  const { refreshing, error, refresh } = useLiveWeather(profile, onProfileChange);
  const { isOnline } = useNetworkStatus();
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);

  const today = useToday();
  // Something checked off on an earlier day drops off Home. Most tasks get
  // a fresh id each day, but seed-starting steps and the "Get ready" prep
  // list keep theirs for weeks, so they used to sit on Home crossed out
  // ("Done 10:00 AM", no date) long after the day they were done.
  const doneBeforeToday = (id: string) => {
    const at = isTaskComplete(profile, id);
    return !!at && dateKey(new Date(at)) !== dateKey(today);
  };
  const tasks = useMemo(
    () => getTodayTasks(profile, today).filter((t) => !doneBeforeToday(t.id)),
    [profile, today]
  );
  const streak = computeStreak(profile, today);
  const longestStreak = computeLongestStreak(profile);

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

  // Seed starting happens in exactly the cold weeks Home otherwise calls
  // "not planting season yet", so its steps get their own section there.
  const seedTasks = tasks.filter((t) => isSeedStartTask(t.id));
  // Care for what's already in the ground — winter greens, overwintering
  // garlic, perennials — keeps going through the cold months too, so it
  // gets its own section rather than being hidden behind the frost
  // countdown.
  // Watering is scheduled from the garden's crop list whether or not
  // anything's planted yet; in the cold months that would mean watering an
  // empty bed, so it only shows once something is actually in the ground.
  const anythingInBed = bedCrops(profile.crops).some((c) => effectiveBucket(profile, c, today) !== 'w0');
  // Watering is one card, not several tasks: the bed's schedule and any
  // tree soil checks due today, plus each crop's watering advice as a
  // short note. It counts as one item, done once everything in it is.
  const waterTasks = tasks.filter(
    (t) => isWateringTask(t.id) && (!isColdStart || anythingInBed || !t.id.startsWith('water-'))
  );
  const waterNotes = useMemo(() => wateringNotes(profile, today), [profile, today]);
  const nextWater = useMemo(() => nextBedWatering(profile, today), [profile, today]);
  const waterDone = waterTasks.length > 0 && waterTasks.every((t) => isTaskComplete(profile, t.id));
  const showWaterCard = waterTasks.length > 0 || waterNotes.length > 0 || (anythingInBed && !!nextWater);
  const jobTasks = tasks.filter((t) => !isWateringTask(t.id));
  const careTasks = jobTasks.filter((t) => !isSeedStartTask(t.id));
  const waterItems = waterTasks.length > 0 ? 1 : 0;
  const doneCount = jobTasks.filter((t) => isTaskComplete(profile, t.id)).length + (waterDone ? 1 : 0);
  const totalCount = jobTasks.length + waterItems;
  const leftCount = totalCount - doneCount;

  function toggleWatering() {
    let updated = profile;
    for (const t of waterTasks) {
      const done = !!isTaskComplete(updated, t.id);
      if (waterDone ? done : !done) updated = toggleTask(updated, t.id);
    }
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }

  const waterCard = showWaterCard ? (
    <WateringCard
      waterTasks={waterTasks}
      notes={waterNotes}
      next={nextWater}
      done={waterDone}
      onToggle={toggleWatering}
    />
  ) : null;
  const nextSeed = useMemo(() => nextSeedStep(profile, today), [profile, today]);
  // "Seed season is coming": from three weeks before the first sowing.
  const seedSeason = useMemo(() => seedSeasonCard(profile, today), [profile, today]);
  function dismissSeedSeason() {
    if (!seedSeason) return;
    const updated = { ...profile, seedSeasonCardDismissed: dateKey(seedSeason.date) };
    onProfileChange(updated);
    saveProfile(updated).catch(() => {});
  }
  const seedSeasonDays = seedSeason
    ? Math.round((seedSeason.date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000)
    : 0;
  const seedSeasonCardEl = seedSeason ? (
    <View style={styles.seedCard}>
      <TouchableOpacity onPress={dismissSeedSeason} style={styles.seedClose} accessibilityRole="button" accessibilityLabel="Hide this card">
        <Text style={styles.seedCloseText}>×</Text>
      </TouchableOpacity>
      <View style={styles.seedHead}>
        <OwlMark size={84} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.seedEyebrow}>Seed season is coming</Text>
          <Text style={styles.seedTitle}>
            {seedSeasonDays === 0
              ? 'Your first seeds go in today'
              : `Your first seeds go in ${seedSeasonDays === 1 ? 'tomorrow' : `on ${seedSeason.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}`}
          </Text>
        </View>
      </View>
      <Text style={styles.seedBody}>
        Starting from seed is easier than it looks. Here's what to get ready, and how to do it in five short steps.
      </Text>
      <View style={styles.seedButtons}>
        <TouchableOpacity style={styles.seedPrimary} onPress={() => onOpenSeedGuide('steps')} accessibilityRole="button">
          <Text style={styles.seedPrimaryText}>See the 5 steps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.seedSecondary} onPress={() => onOpenSeedGuide('kit')} accessibilityRole="button">
          <Text style={styles.seedSecondaryText}>Get your kit</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;
  const startingFromSeed = profile.crops.some((c) => c !== 'other' && activeSeedStartPlan(profile, c as CropKey, today));
  const coldStartTasks = (startingFromSeed ? [SEED_SUPPLIES_TASK, ...COLD_START_TASKS] : COLD_START_TASKS).filter(
    (t) => !doneBeforeToday(t.id)
  );

  // "Getting ready to grow" only when there's genuinely nothing to do.
  const coldShown = [...careTasks, ...seedTasks];
  const coldLeft = coldShown.filter((t) => !isTaskComplete(profile, t.id)).length + (waterItems && !waterDone ? 1 : 0);
  const title = isColdStart
    ? coldLeft > 0
      ? `${coldLeft} ${coldLeft === 1 ? 'thing' : 'things'} left`
      : coldShown.length + waterItems > 0
        ? 'All done for today'
        : 'Getting ready to grow'
    : totalCount === 0
      ? 'Nothing to do today. Enjoy the garden 🌱'
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
    const bucket = effectiveBucket(profile, c, today);
    if (bucket !== 'w0') return true;
    return plantingGuidanceFor(c, profile.frostDates).isPastDue;
  });
  const sortedByStage = [...featurableCrops].sort((a, b) => {
    const ba = effectiveBucket(profile, a, today);
    const bb = effectiveBucket(profile, b, today);
    return BUCKET_RANK[bb] - BUCKET_RANK[ba];
  });
  const topCrop = sortedByStage[0];
  const topBucket = topCrop ? effectiveBucket(profile, topCrop, today) : null;

  // "Add a photo" used to always jump straight to topCrop with no way to
  // pick a different one — fine with one crop, but with several there was
  // no way to photograph anything but whichever one Home happened to
  // feature. Skip the picker when there's nothing to choose between.
  function openAddPhoto() {
    if (gardenCrops.length > 1) {
      setPhotoPickerOpen(true);
    } else if (topCrop) {
      onAddPhotoFor(topCrop);
    } else {
      onOpenMyGarden();
    }
  }
  const topNotPlanted = topBucket === 'w0';
  const topGuidance =
    topCrop && topNotPlanted ? plantingGuidanceFor(topCrop, profile.frostDates) : null;
  const readyToPick = gardenCrops.filter((c) => effectiveBucket(profile, c, today) === 'w8');

  const nextReminder = [...profile.scheduledReminders]
    .filter((r) => new Date(r.dateISO).getTime() > today.getTime())
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())[0];

  const weatherAlert = useMemo(
    () =>
      computeSchedule({
        crops: bedCrops(profile.crops),
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

        {seedSeasonCardEl}

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

            {waterCard}

            {careTasks.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>In your garden</Text>
                <View style={{ gap: space.sm }}>
                  {careTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      completedAt={isTaskComplete(profile, t.id)}
                      onToggle={() => handleToggle(t.id)}
                      onOpenGuide={() => onOpenSeedGuide()}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {seedTasks.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Seed starting</Text>
                <View style={{ gap: space.sm }}>
                  {seedTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      completedAt={isTaskComplete(profile, t.id)}
                      onToggle={() => handleToggle(t.id)}
                      onOpenGuide={() => onOpenSeedGuide()}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {nextSeed ? (
              <TouchableOpacity style={styles.nextUpCard} onPress={() => onOpenSeedGuide()} accessibilityRole="button">
                <View style={styles.nextUpHead}>
                  <Text style={styles.nextUpLabel}>Next up</Text>
                  <Text style={styles.nextUpDate}>
                    {nextSeed.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.nextUpTitle}>{nextSeed.task.title}</Text>
                <Text style={styles.nextUpBody}>{nextSeed.task.detail}</Text>
              </TouchableOpacity>
            ) : null}

            {coldStartTasks.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Get ready</Text>
                <View style={{ gap: space.sm }}>
                  {coldStartTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      completedAt={isTaskComplete(profile, t.id)}
                      onToggle={() => handleToggle(t.id)}
                      onOpenGuide={() => onOpenSeedGuide()}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.frostFootnote}>
              Estimated from your area's weather history over the past few years. Check back as
              the date gets closer.
            </Text>
          </>
        ) : totalCount > 0 ? (
          <>
            <View style={styles.progressCard}>
              <ProgressRing fraction={totalCount ? doneCount / totalCount : 0} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.progressTitle}>
                  {leftCount === 0 ? "Nice, everything's done" : 'Finish today to keep your streak'}
                </Text>
                {longestStreak > 0 ? (
                  <Text style={styles.progressSub}>Your longest run is {longestStreak} days.</Text>
                ) : null}
              </View>
            </View>

            {waterCard}

            {jobTasks.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Today</Text>
                <View style={{ gap: space.sm }}>
                  {jobTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      completedAt={isTaskComplete(profile, t.id)}
                      onToggle={() => handleToggle(t.id)}
                      onOpenGuide={() => onOpenSeedGuide()}
                    />
                  ))}
                </View>
              </>
            ) : null}

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
            {waterCard}
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
                onPress={openAddPhoto}
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

        {isColdStart || totalCount > 0 ? (
          <View style={styles.shortcutRow}>
            <TouchableOpacity
              style={styles.shortcut}
              onPress={openAddPhoto}
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

        <TouchableOpacity style={styles.diagnoseRow} onPress={onOpenTriage} accessibilityRole="button">
          <View style={styles.diagnoseIconWrap}>
            <Text style={styles.diagnoseIconText}>🔍</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.diagnoseTitle}>Diagnose a plant</Text>
            <Text style={styles.diagnoseSub}>Something look wrong? Figure out what's going on.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      <TabBar active={activeTab} onPress={onTabPress} />

      <Modal
        visible={photoPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setPhotoPickerOpen(false)}
          accessible={false}
        >
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet} accessible={false}>
            <Text style={styles.pickerTitle}>Add a photo of…</Text>
            <View style={styles.pillRow}>
              {gardenCrops.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={styles.pill}
                  onPress={() => {
                    setPhotoPickerOpen(false);
                    onAddPhotoFor(c);
                  }}
                  accessibilityRole="button"
                >
                  <CropIcon crop={c} size={14} />
                  <Text style={styles.pillText}>{cropLabel(c)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** All of today's watering in one place: the bed's schedule, any tree
 * soil checks, and each crop's watering advice, with one check for the
 * lot. On a day with nothing to water it shrinks to when the next one is. */
function WateringCard({
  waterTasks,
  notes,
  next,
  done,
  onToggle,
}: {
  waterTasks: DailyTask[];
  notes: WateringNote[];
  next: { date: Date; detail: string } | null;
  done: boolean;
  onToggle: () => void;
}) {
  const bed = waterTasks.find((t) => t.id.startsWith('water-'));
  const trees = waterTasks.filter((t) => t.id.startsWith('treewater-'));
  const due = waterTasks.length > 0;
  const title = bed ? 'Water the garden' : trees.length > 0 ? 'Check your trees' : 'No watering today';
  const sub = bed
    ? bed.detail
    : !due && next
      ? `Next: ${next.date.toLocaleDateString(undefined, { weekday: 'long' })}, ${next.detail}`
      : null;
  const lines = [
    ...trees.map((t) => `${t.title.replace(/^Water /, '')}: check the soil, water if dry`),
    ...notes.map((n) => `${cropLabel(n.crop)}: ${lowerFirst(n.text)}`),
  ];
  // The notes run the card's full width, starting under the 💧, so they
  // don't wrap in a narrow column beside it.
  const body = (
    <>
      <View style={styles.waterHead}>
        <Text style={styles.waterIcon}>💧</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.waterEyebrow}>Today's watering</Text>
          <Text style={[styles.waterTitle, done && styles.taskTitleDone]}>{title}</Text>
          {sub ? <Text style={styles.waterSub}>{sub}</Text> : null}
        </View>
        {due ? (
          <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
            {done ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        ) : null}
      </View>
      {lines.map((l) => (
        <Text key={l} style={styles.waterLine}>
          • {l}
        </Text>
      ))}
    </>
  );
  return due ? (
    <TouchableOpacity
      style={[styles.waterCard, done && styles.taskRowDone]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${title}${sub ? `, ${sub}` : ''}`}
    >
      {body}
    </TouchableOpacity>
  ) : (
    <View style={styles.waterCard}>{body}</View>
  );
}

function TaskRow({
  task,
  completedAt,
  onToggle,
  onOpenGuide,
}: {
  task: DailyTask;
  completedAt: string | null;
  onToggle: () => void;
  onOpenGuide?: () => void;
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
        {!done && task.buyUrl ? (
          <View style={styles.buyRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL(task.buyUrl!)}
              style={styles.buyNowPill}
              accessibilityRole="button"
              accessibilityLabel="Buy now on Amazon"
            >
              <Text style={styles.buyNowText}>Buy now →</Text>
            </TouchableOpacity>
            <Text style={styles.affiliateNote}>Affiliate link</Text>
          </View>
        ) : null}
        {!done && task.guide && onOpenGuide ? (
          <TouchableOpacity onPress={onOpenGuide} style={styles.guidePill} accessibilityRole="button">
            <Text style={styles.guideText}>How to start seeds →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {!done ? <Text style={styles.taskIcon}>{task.icon}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  seedCard: {
    backgroundColor: colors.iconCream,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
  },
  seedClose: { position: 'absolute', top: 6, right: 10, padding: 6, zIndex: 1 },
  seedCloseText: { fontSize: 20, color: colors.inkSoft },
  seedHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -10, paddingRight: 20 },
  seedEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 3,
  },
  seedTitle: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24, color: colors.pine },
  seedBody: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  seedButtons: { flexDirection: 'row', gap: 10 },
  seedPrimary: { flex: 1, backgroundColor: colors.pine, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  seedPrimaryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.onPine },
  seedSecondary: { flex: 1, borderWidth: 1.5, borderColor: colors.pine, borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center' },
  seedSecondaryText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.pine },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  affiliateNote: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, marginTop: 8 },
  waterCard: {
    backgroundColor: colors.selectedBg,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
  },
  waterHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  waterIcon: { fontSize: 22, marginTop: 2 },
  waterEyebrow: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.mossGreen,
    marginBottom: 3,
  },
  waterTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  waterSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  waterLine: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink, marginTop: 6 },
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
  diagnoseRow: {
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
  diagnoseIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.selectedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagnoseIconText: { fontSize: 17 },
  diagnoseTitle: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
  diagnoseSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  chevron: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,41,33,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: space.xl + 16,
  },
  pickerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.pine,
    marginBottom: space.md,
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
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
});
