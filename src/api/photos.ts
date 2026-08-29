// photos.ts
// expo-image-picker returns a URI into a temp/cache location that iOS can
// purge (especially for camera captures). Copy it into the document
// directory — same "survives a restart" guarantee the rest of the saved
// profile already has — before storing the URI anywhere persistent.

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

const PHOTOS_DIR = new Directory(Paths.document, 'plant-photos');

function ensureDir() {
  if (!PHOTOS_DIR.exists) PHOTOS_DIR.create({ intermediates: true });
}

function savePickedPhoto(sourceUri: string): string {
  ensureDir();
  const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  const source = new File(sourceUri);
  const dest = new File(PHOTOS_DIR, filename);
  source.copy(dest);
  return dest.uri;
}

async function captureFromCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera access needed', 'Turn on camera access for Sprout in Settings to take a photo.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  return savePickedPhoto(result.assets[0].uri);
}

async function captureFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photo access needed', 'Turn on photo library access for Sprout in Settings to add a photo.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  return savePickedPhoto(result.assets[0].uri);
}

/** Prompts camera vs library, handles permissions, and returns a persisted
 * local URI — or null if the user cancelled at any point. */
export function pickPlantPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => captureFromCamera().then(resolve) },
      { text: 'Choose from Library', onPress: () => captureFromLibrary().then(resolve) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}
