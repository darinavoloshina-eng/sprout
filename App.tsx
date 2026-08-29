import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useFonts, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
  WorkSans_700Bold,
} from '@expo-google-fonts/work-sans';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import TriageScreen from './src/screens/TriageScreen';
import MyGardenScreen from './src/screens/MyGardenScreen';
import EditCropsScreen from './src/screens/EditCropsScreen';
import PlantDetailScreen from './src/screens/PlantDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import LogScreen from './src/screens/LogScreen';
import AddHarvestScreen from './src/screens/AddHarvestScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import SeasonRecapScreen from './src/screens/SeasonRecapScreen';
import { clearProfile, loadProfile, saveProfile } from './src/api/storage';
import { pickPlantPhoto } from './src/api/photos';
import { GardenProfile, PlantPhoto } from './src/types';
import { CropKey } from './src/engines/scheduleEngine';
import { PlantedBucket } from './src/engines/alertsEngine';
import { colors } from './src/theme';
import { cropLabel, cropIcon as getCropIcon } from './src/cropMeta';
import { BUCKET_LABEL, NEXT_ACTION, SEASON_SHAPE, STAGE_HEADLINE } from './src/plantStageContent';
import { plantingGuidanceFor } from './src/engines/plantingGuide';
import { TabKey } from './src/components/ui';

type Screen =
  | 'loading'
  | 'onboarding'
  | 'home'
  | 'triage'
  | 'garden'
  | 'editCrops'
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
  const bucket = (profile.plantedWeeks[crop] ?? 'w2') as PlantedBucket;
  const notPlanted = bucket === 'w0';
  const guidance = notPlanted ? plantingGuidanceFor(crop, profile.frostDates) : null;
  const stage = notPlanted ? guidance!.headline : STAGE_HEADLINE[crop]?.[bucket] ?? '';
  const bucketLabel = BUCKET_LABEL[bucket].toUpperCase();

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
      { value: '–', label: profile.units === 'metric' ? 'kg picked' : 'lbs picked' },
      { value: '–', label: 'tasks done' },
      { value: `~${SEASON_SHAPE[crop]?.weeks ?? '–'}`, label: 'wk season' },
    ],
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<GardenProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<CropKey | null>(null);
  // Which tab "+ Add a crop" was opened from, so EditCropsScreen shows the
  // right tab highlighted and `onBack` returns to the right place.
  const [editCropsFrom, setEditCropsFrom] = useState<TabKey>('garden');
  // A boolean overlay rather than a routed screen: routing through `screen`
  // would unmount whatever's underneath (losing onboarding's in-progress
  // wizard state, mid-step) every time it opened.
  const [paywallOpen, setPaywallOpen] = useState(false);
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
    if (profileLoaded && fontsLoaded && screen === 'loading') {
      setScreen(profile ? 'home' : 'onboarding');
    }
  }, [profileLoaded, fontsLoaded, screen, profile]);

  const handleProfileChange = useCallback((p: GardenProfile) => setProfile(p), []);

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {screen === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.mossGreen} />
        </View>
      )}

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
          onOpenAddHarvest={() => setScreen('addHarvest')}
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
          onOpenCrop={(crop) => {
            setSelectedCrop(crop);
            setScreen('plant');
          }}
          onAddCrop={() => {
            setEditCropsFrom('garden');
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
        />
      )}

      {screen === 'plant' && profile && selectedCrop && (
        <PlantDetailScreen
          {...plantDetailProps(profile, selectedCrop)}
          onBack={() => setScreen('garden')}
          onAddPhoto={() => handleAddPhoto(selectedCrop)}
          activeTab="garden"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'settings' && profile && (
        <SettingsScreen
          profile={profile}
          onProfileChange={handleProfileChange}
          onEditGarden={() => setScreen('onboarding')}
          onEditCrops={() => {
            setEditCropsFrom('settings');
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
            await clearProfile();
            setProfile(null);
            setScreen('onboarding');
          }}
        />
      )}

      {screen === 'log' && profile && (
        <LogScreen
          profile={profile}
          onAddHarvest={() => setScreen('addHarvest')}
          onOpenPaywall={openPaywall}
          onOpenRecap={() => setRecapOpen(true)}
          activeTab="log"
          onTabPress={handleTabPress}
        />
      )}

      {screen === 'addHarvest' && profile && (
        <AddHarvestScreen
          profile={profile}
          onCancel={() => setScreen('log')}
          onSave={(entry) => {
            const updated: GardenProfile = {
              ...profile,
              harvests: [...(profile.harvests ?? []), entry],
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
