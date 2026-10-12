import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from '@expo-google-fonts/work-sans';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import TriageScreen from './src/screens/TriageScreen';
import MyGardenScreen from './src/screens/MyGardenScreen';
import EditCropsScreen from './src/screens/EditCropsScreen';
import EditLocationScreen from './src/screens/EditLocationScreen';
import PlantDetailScreen from './src/screens/PlantDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import LogScreen from './src/screens/LogScreen';
import AddHarvestScreen from './src/screens/AddHarvestScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import ProWelcomeScreen from './src/screens/ProWelcomeScreen';
import SeasonRecapScreen from './src/screens/SeasonRecapScreen';
import { clearProfile, loadProfile, saveProfile } from './src/api/storage';
import { deletePhotoFile, pickPlantPhoto } from './src/api/photos';
import { CropNote, GardenProfile, PlantPhoto } from './src/types';
import { CropKey } from './src/engines/scheduleEngine';
import { effectiveBackdate, effectiveBucket, plantedAgoLabel } from './src/engines/taskEngine';
import { formatWeightLbs, UnitSystem } from './src/utils/units';
import { colors } from './src/theme';
import { cropLabel, cropIcon as getCropIcon, CropCategory } from './src/cropMeta';
import { BUCKET_LABEL, NEXT_ACTION, SEASON_SHAPE, STAGE_HEADLINE } from './src/plantStageContent';
import { plantingGuidanceFor } from './src/engines/plantingGuide';
import { useFrostDates } from './src/hooks/useFrostDates';
import { syncNudges } from './src/notifications';
import { syncGarden, unsyncGarden } from './src/api/gardenSync';
import { planNudges } from './src/engines/nudgeEngine';
import {
  fetchCurrentEntitlement,
  initPurchases,
  isConfigured as isPurchasesConfigured,
  onEntitlementChange,
} from './src/purchases';
import { TabKey } from './src/components/ui';

type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'triage'
  | 'garden'
  | 'editCrops'
  | 'editLocation'
  | 'plant'
  | 'settings'
  | 'deleteAccount'
  | 'log'
  | 'addHarvest'
  | 'calendar';

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function plantDetailProps(profile: GardenProfile, crop: CropKey) {
  const bucket = effectiveBucket(profile, crop);
  const notPlanted = bucket === 'w0';
  const guidance = notPlanted ? plantingGuidanceFor(crop, profile.frostDates) : null;
  const stage = notPlanted ? guidance!.headline : STAGE_HEADLINE[crop]?.[bucket] ?? '';
  // The precise elapsed time (see taskEngine.ts's plantedAgoLabel) when a
  // real planted date is tracked, same as My Garden — falls back to the
  // coarse bucket/backdate label otherwise, so this header doesn't show
  // "8+ WKS AGO" for a crop the rest of the app already knows was planted
  // years ago.
  const bucketLabel = (plantedAgoLabel(profile, crop) ?? BUCKET_LABEL[effectiveBackdate(profile, crop)]).toUpperCase();
  const units: UnitSystem = profile.units ?? 'imperial';

  const cropLbs = (profile.harvests ?? [])
    .filter((h) => h.crop === crop)
    .reduce((sum, h) => sum + h.weightLbs, 0);
  // A task's id is always scoped with the crop it's for (alert-<crop>-...,
  // succession-<crop>-..., feed-<crop>-..., plant-<crop>-...) — no CropKey
  // contains a hyphen, so this substring match can't cross-match another
  // crop sharing a name prefix.
  const cropTaskCount = Object.keys(profile.taskCompletions ?? {}).filter((id) =>
    id.includes(`-${crop}-`)
  ).length;

  const cropPhotos = (profile.photos ?? [])
    .filter((p) => p.crop === crop)
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
  // One tile per calendar day — a same-day retake replaces, it doesn't add
  // a second tile (day-since-first-photo would collide otherwise).
  const byDay = new Map<string, PlantPhoto>();
  for (const p of cropPhotos) byDay.set(p.dateISO.slice(0, 10), p);
  const dayPhotos = Array.from(byDay.values());

  const today = new Date();
  const todaysPhoto = dayPhotos.find((p) => sameDay(new Date(p.dateISO), today));
  const firstPhotoDate = dayPhotos[0] ? new Date(dayPhotos[0].dateISO) : null;

  const timeline = firstPhotoDate
    ? dayPhotos.slice(-5).map((p) => ({
        day: Math.round((new Date(p.dateISO).getTime() - firstPhotoDate.getTime()) / 86400000) + 1,
        uri: p.uri,
      }))
    : [];

  const photoCountLabel =
    dayPhotos.length > 0 && firstPhotoDate
      ? `${dayPhotos.length} photo${dayPhotos.length === 1 ? '' : 's'} since ${firstPhotoDate.toLocaleDateString(
          undefined,
          { month: 'short', day: 'numeric' }
        )}`
      : 'No photos yet';

  // Newest first — a note from last season is still worth seeing, but this
  // year's is what you're most likely looking for.
  const cropNotes = (profile.notes ?? [])
    .filter((n) => n.crop === crop)
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

  return {
    cropName: cropLabel(crop),
    cropIcon: getCropIcon(crop),
    metaLine: notPlanted ? stage.toUpperCase() : `${bucketLabel} · ${stage.toUpperCase()}`,
    instructionTitle: stage,
    instructionDetail: notPlanted ? guidance!.detail : NEXT_ACTION[crop]?.[bucket] ?? '',
    heroDateLabel: `TODAY · ${bucketLabel}`,
    heroPhotoUri: todaysPhoto?.uri,
    photoCountLabel,
    timeline,
    stats: [
      {
        value: cropLbs > 0 ? formatWeightLbs(cropLbs, units).split(' ')[0] : '0',
        label: units === 'metric' ? 'kg picked' : 'lbs picked',
      },
      { value: `${cropTaskCount}`, label: 'tasks done' },
      { value: `~${SEASON_SHAPE[crop]?.weeks ?? '–'}`, label: 'wk season' },
    ],
    notes: cropNotes.map((n) => ({ id: n.id, text: n.text, dateISO: n.dateISO })),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // The splash's own fade-in-and-hold timer, independent of profile/font
  // loading — see SplashScreen.tsx for why. The transition below waits on
  // both, so a slow load holds the brand screen a little longer instead of
  // cutting away mid-animation, and a fast load doesn't skip the beat.
  const [splashDone, setSplashDone] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<CropKey | null>(null);
  // Set when AddHarvestScreen is opened from a pick's "Edit" link on the
  // Log screen; null means it's logging a new pick.
  const [editingHarvestId, setEditingHarvestId] = useState<string | null>(null);
  // Which tab "+ Add a crop" was opened from, so EditCropsScreen shows the
  // right tab highlighted and `onBack` returns to the right place.
  const [editCropsFrom, setEditCropsFrom] = useState<TabKey>('garden');
  // Same idea for EditLocationScreen — Calendar's season-view lock can open
  // it directly now (see CalendarScreen's "no location set" card), and
  // `onBack` should return there instead of always landing on Settings.
  const [editLocationFrom, setEditLocationFrom] = useState<TabKey>('settings');
  // Which category tab EditCropsScreen should open on — set from My
  // Garden's own active category tab so "+ Add a crop" lands where the
  // user was already browsing, instead of always defaulting to Vegetables.
  const [editCropsInitialCategory, setEditCropsInitialCategory] = useState<CropCategory>('vegetable');
  // A boolean overlay rather than a routed screen: routing through `screen`
  // would unmount whatever's underneath (losing onboarding's in-progress
  // wizard state, mid-step) every time it opened.
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Set right after a purchase to show ProWelcomeScreen; isPreview mirrors
  // PaywallScreen's unconfigured-purchases fallback.
  const [proWelcome, setProWelcome] = useState<{ isPreview: boolean } | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);

  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    WorkSans_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    (async () => {
      const saved = await loadProfile();
      if (saved) setProfile(saved);
      setProfileLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (profileLoaded && fontsLoaded && splashDone && screen === 'splash') {
      setScreen(profile ? 'home' : 'onboarding');
    }
  }, [profileLoaded, fontsLoaded, splashDone, screen, profile]);

  const handleProfileChange = useCallback((p: GardenProfile) => setProfile(p), []);

  // Lives here (not inside HomeScreen) so the estimate arrives regardless of
  // which screen is showing — see useFrostDates.ts.
  useFrostDates(profile, handleProfileChange);

  // Purchases is initialized once, early, regardless of whether a profile
  // exists yet — see purchases.ts for why this is a safe no-op until a
  // real RevenueCat API key is in place there.
  useEffect(() => {
    initPurchases();
  }, []);

  // Once there's a real entitlement to check (profile loaded, Purchases
  // configured), sync profile.isPro to match it — a null result means
  // "not configured yet" or "the check failed," either of which should
  // leave the locally saved value alone rather than silently downgrading
  // someone. The change listener keeps this true going forward too: a
  // renewal, cancellation, or billing issue updates isPro even if it
  // happens while the Paywall isn't open.
  useEffect(() => {
    if (!profile || !isPurchasesConfigured()) return;
    let cancelled = false;
    fetchCurrentEntitlement().then((status) => {
      if (cancelled || status === null) return;
      setProfile((current) => {
        if (!current || (current.isPro === status.isPro && current.isLifetime === status.isLifetime)) return current;
        const updated = { ...current, isPro: status.isPro, isLifetime: status.isLifetime };
        saveProfile(updated).catch(() => {});
        return updated;
      });
    });
    const unsubscribe = onEntitlementChange((status) => {
      setProfile((current) => {
        if (!current || (current.isPro === status.isPro && current.isLifetime === status.isLifetime)) return current;
        const updated = { ...current, isPro: status.isPro, isLifetime: status.isLifetime };
        saveProfile(updated).catch(() => {});
        return updated;
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [profile !== null]);

  // Keeps scheduled notifications in sync with the toggle and with the
  // garden itself — a crop added, a task checked off early, a new planted
  // date — regardless of which screen changed it. Keyed on the plan's
  // content rather than the profile object, so unrelated saves (a photo, a
  // weather refresh that changes nothing) don't reschedule everything.
  const nudgePlan = useMemo(() => (profile ? planNudges(profile) : []), [profile]);
  const nudgeKey = profile
    ? `${profile.notificationsEnabled}|${nudgePlan.map((n) => `${n.id}:${n.title}:${n.body}`).join('|')}`
    : null;
  useEffect(() => {
    if (profile) syncNudges(profile.notificationsEnabled, nudgePlan);
  }, [nudgeKey]);

  // Keeps the Worker's copy of the garden (for the weekly email) current,
  // or deletes it once the email is turned off. Same content-keyed idea as
  // the nudges above — weather and savedAt are left out of the key since
  // the server fetches its own weather, so a refresh doesn't trigger an
  // upload. Debounced so a burst of edits is one request.
  const gardenSyncKey = profile
    ? profile.emailRemindersEnabled && profile.email
      ? JSON.stringify({ ...profile, weather: null, weatherFetchedAt: null, savedAt: null, photos: null, emailDigestActive: null })
      : 'off'
    : null;
  useEffect(() => {
    if (!profile || gardenSyncKey === null) return;
    const handle = setTimeout(async () => {
      const result = gardenSyncKey === 'off' ? (await unsyncGarden(), null) : await syncGarden(profile);
      // Mirrors whether the email is really arriving (see types.ts) — a
      // failed request (null while on) leaves the last known value alone.
      if (gardenSyncKey !== 'off' && !result) return;
      const active = !!result && result.confirmed && result.sending;
      setProfile((current) => {
        if (!current || !!current.emailDigestActive === active) return current;
        const updated: GardenProfile = { ...current, emailDigestActive: active };
        saveProfile(updated).catch(() => {});
        return updated;
      });
    }, 2000);
    return () => clearTimeout(handle);
  }, [gardenSyncKey]);

  async function handleAddPhoto(crop: CropKey) {
    const uri = await pickPlantPhoto();
    if (!uri) return;
    setProfile((current) => {
      if (!current) return current;
      const newPhoto: PlantPhoto = { id: `${Date.now()}`, crop, uri, dateISO: new Date().toISOString() };
      const updated: GardenProfile = { ...current, photos: [...(current.photos ?? []), newPhoto] };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  // Removes every photo logged for this crop today (there's usually just
  // one, but a same-day retake appends rather than overwrites, so a stray
  // earlier shot from today could otherwise survive on disk unseen).
  function handleDeletePhoto(crop: CropKey) {
    setProfile((current) => {
      if (!current) return current;
      const today = new Date();
      const keep: PlantPhoto[] = [];
      const removed: PlantPhoto[] = [];
      for (const p of current.photos ?? []) {
        if (p.crop === crop && sameDay(new Date(p.dateISO), today)) removed.push(p);
        else keep.push(p);
      }
      removed.forEach((p) => deletePhotoFile(p.uri));
      const updated: GardenProfile = { ...current, photos: keep };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  function handleAddNote(crop: CropKey, text: string) {
    setProfile((current) => {
      if (!current) return current;
      const newNote: CropNote = { id: `${Date.now()}`, crop, text, dateISO: new Date().toISOString() };
      const updated: GardenProfile = { ...current, notes: [...(current.notes ?? []), newNote] };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  function handleEditNote(id: string, text: string) {
    setProfile((current) => {
      if (!current) return current;
      const updated: GardenProfile = {
        ...current,
        notes: (current.notes ?? []).map((n) => (n.id === id ? { ...n, text } : n)),
      };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  function handleDeleteNote(id: string) {
    setProfile((current) => {
      if (!current) return current;
      const updated: GardenProfile = {
        ...current,
        notes: (current.notes ?? []).filter((n) => n.id !== id),
      };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  function openAddHarvest() {
    setEditingHarvestId(null);
    setScreen('addHarvest');
  }

  function handleDeleteHarvest(id: string) {
    setProfile((current) => {
      if (!current) return current;
      const updated: GardenProfile = {
        ...current,
        harvests: (current.harvests ?? []).filter((h) => h.id !== id),
      };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  function handleRemoveCrop(crop: CropKey) {
    setProfile((current) => {
      if (!current) return current;
      const { [crop]: _removed, ...remainingPlantedWeeks } = current.plantedWeeks;
      const updated: GardenProfile = {
        ...current,
        crops: current.crops.filter((c) => c !== crop),
        plantedWeeks: remainingPlantedWeeks,
      };
      saveProfile(updated).catch(() => {});
      return updated;
    });
  }

  const openPaywall = useCallback(() => setPaywallOpen(true), []);

  const handleTabPress = useCallback((tab: TabKey) => {
    if (tab === 'home') setScreen('home');
    else if (tab === 'garden') setScreen('garden');
    else if (tab === 'settings') setScreen('settings');
    else if (tab === 'log') setScreen('log');
    else if (tab === 'calendar') setScreen('calendar');
  }, []);

  // Rendered outside the SafeAreaView below (not just conditionally inside
  // it) so its background reaches every physical edge of the screen, status
  // bar and home indicator included — matching the native launch screen it
  // hands off from. Nesting it inside the safe-area-inset container instead
  // would leave the app's own paper-colored background showing through in
  // that inset strip, a seam that only shows up on the one screen where
  // it's most obvious.
  if (screen === 'splash') {
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <SplashScreen onFinish={() => setSplashDone(true)} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {screen === 'onboarding' && (
        <OnboardingScreen
          existing={profile}
          onDone={(p) => {
            setProfile(p);
            setScreen('home');
          }}
          // Only offer a way out if there's already a saved garden to go back to.
          onCancel={profile ? () => setScreen('home') : undefined}
          onOpenPaywall={openPaywall}
        />
      )}

      {screen === 'home' && profile && (
        <HomeScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onOpenTriage={() => setScreen('triage')}
          onOpenMyGarden={() => setScreen('garden')}
          onOpenLog={() => setScreen('log')}
          onOpenAddHarvest={openAddHarvest}
          onAddPhotoFor={(crop) => {
            setSelectedCrop(crop);
            setScreen('plant');
          }}
          activeTab="home"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'triage' && profile && (
        <TriageScreen profile={profile} onDone={() => setScreen('home')} />
      )}

      {screen === 'garden' && profile && (
        <MyGardenScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onOpenCrop={(crop) => {
            setSelectedCrop(crop);
            setScreen('plant');
          }}
          onAddCrop={(category) => {
            setEditCropsFrom('garden');
            setEditCropsInitialCategory(category);
            setScreen('editCrops');
          }}
          onOpenLog={() => setScreen('log')}
          onRemoveCrop={handleRemoveCrop}
          activeTab="garden"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'editCrops' && profile && (
        <EditCropsScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onBack={() => setScreen(editCropsFrom === 'settings' ? 'settings' : 'garden')}
          onOpenPaywall={openPaywall}
          activeTab={editCropsFrom}
          onTabPress={handleTabPress}
          initialCategory={editCropsInitialCategory}
        />
      )}

      {screen === 'editLocation' && profile && (
        <EditLocationScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onBack={() => setScreen(editLocationFrom)}
          activeTab={editLocationFrom}
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'plant' && profile && selectedCrop && (
        <PlantDetailScreen
          {...plantDetailProps(profile, selectedCrop)}
          onBack={() => setScreen('garden')}
          onAddPhoto={() => handleAddPhoto(selectedCrop)}
          onRetakePhoto={() => handleAddPhoto(selectedCrop)}
          onDeletePhoto={() => handleDeletePhoto(selectedCrop)}
          onAddNote={(text) => handleAddNote(selectedCrop, text)}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          activeTab="garden"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'settings' && profile && (
        <SettingsScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onEditGarden={() => {
            setEditLocationFrom('settings');
            setScreen('editLocation');
          }}
          onEditCrops={() => {
            setEditCropsFrom('settings');
            setEditCropsInitialCategory('vegetable');
            setScreen('editCrops');
          }}
          onDeleteAccount={() => setScreen('deleteAccount')}
          onOpenPaywall={openPaywall}
          activeTab="settings"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'deleteAccount' && profile && (
        <DeleteAccountScreen
          profile={profile}
          onBack={() => setScreen('settings')}
          onConfirmDelete={async () => {
            await unsyncGarden();
            await clearProfile();
            setProfile(null);
            setScreen('onboarding');
          }}
        />
      )}

      {screen === 'log' && profile && (
        <LogScreen
          profile={profile}
          onAddHarvest={openAddHarvest}
          onOpenPaywall={openPaywall}
          onOpenRecap={() => setRecapOpen(true)}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          onEditHarvest={(id) => {
            setEditingHarvestId(id);
            setScreen('addHarvest');
          }}
          onDeleteHarvest={handleDeleteHarvest}
          activeTab="log"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'addHarvest' && profile && (
        <AddHarvestScreen
          key={editingHarvestId ?? 'new'}
          profile={profile}
          existing={(profile.harvests ?? []).find((h) => h.id === editingHarvestId)}
          onCancel={() => setScreen('log')}
          onSave={(entry) => {
            const harvests = profile.harvests ?? [];
            const updated: GardenProfile = {
              ...profile,
              harvests: harvests.some((h) => h.id === entry.id)
                ? harvests.map((h) => (h.id === entry.id ? entry : h))
                : [...harvests, entry],
            };
            setProfile(updated);
            saveProfile(updated).catch(() => {});
            setScreen('log');
          }}
        />
      )}

      {screen === 'calendar' && profile && (
        <CalendarScreen
          profile={profile}
          onOpenPaywall={openPaywall}
          onOpenLocation={() => {
            setEditLocationFrom('calendar');
            setScreen('editLocation');
          }}
          activeTab="calendar"
          onTabPress={handleTabPress}
        />
      )}

      {paywallOpen && profile && (
        <SafeAreaView style={StyleSheet.absoluteFill}>
          <PaywallScreen
            profile={profile}
            onProfileChange={handleProfileChange}
            onClose={() => setPaywallOpen(false)}
            onPurchased={(isPreview) => {
              setPaywallOpen(false);
              // Nothing to ask someone who's already getting the weekly email.
              if (!(profile.email && profile.emailRemindersEnabled)) setProWelcome({ isPreview });
            }}
          />
        </SafeAreaView>
      )}

      {proWelcome && profile && (
        <SafeAreaView style={StyleSheet.absoluteFill}>
          <ProWelcomeScreen
            profile={profile}
            isPreview={proWelcome.isPreview}
            onProfileChange={handleProfileChange}
            onDone={() => setProWelcome(null)}
          />
        </SafeAreaView>
      )}

      {recapOpen && profile && (
        <SafeAreaView style={StyleSheet.absoluteFill}>
          <SeasonRecapScreen profile={profile} onClose={() => setRecapOpen(false)} />
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
});
