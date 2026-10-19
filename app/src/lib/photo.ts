import { photoItemsToDrafts, type CoachModelId, type DraftItem } from '@ff/engines';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { callFunction } from './backend';

export type PhotoResult =
  | { kind: 'drafts'; drafts: DraftItem[] }
  | { kind: 'not_food' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/**
 * Photo logging: the photo goes to our server, the AI names foods and amounts, and the engine
 * turns those into drafts the user checks. The photo is not kept anywhere by the app.
 */
/** Removes the picker's and the resizer's copies from the app cache, so no photo stays behind. */
function discard(uris: (string | undefined)[]) {
  if (Platform.OS === 'web') return;
  for (const uri of uris) {
    if (!uri || !uri.startsWith('file:')) continue;
    try {
      new File(uri).delete();
    } catch {
      // Already gone; the cache is cleared by the system anyway.
    }
  }
}

export async function photoToDrafts(source: 'camera' | 'library', model: CoachModelId): Promise<PhotoResult> {
  const temp: (string | undefined)[] = [];
  try {
    return await read(source, model, temp);
  } catch {
    return { kind: 'error', message: 'Could not use the camera or that photo. Try again, or type the meal.' };
  } finally {
    discard(temp);
  }
}

async function read(source: 'camera' | 'library', model: CoachModelId, temp: (string | undefined)[]): Promise<PhotoResult> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { kind: 'error', message: 'Camera access is off for this app. Allow it in your phone settings, or choose a photo instead.' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.[0]) return { kind: 'cancelled' };
  const asset = picked.assets[0];
  temp.push(asset.uri);

  // About 1,000 pixels is plenty to name foods, and keeps the upload around 150 KB.
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1024) ctx.resize({ width: 1024 });
  const small = await (await ctx.renderAsync()).saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  temp.push(small.uri);
  if (!small.base64) return { kind: 'error', message: 'Could not read that photo. Try another, or type the meal.' };

  const { data, error } = await callFunction<{ output: { not_food?: boolean; items?: unknown } }>('meal-photo', { image: small.base64, media_type: 'image/jpeg', model });
  if (error || !data) {
    const message =
      error?.code === 'RATE_LIMITED'
        ? 'Photo logging has reached its limit for now. Type the meal instead.'
        : error?.code === 'FORBIDDEN'
          ? 'AI processing is off. Turn it on in Settings to use photos.'
          : 'Could not read the photo right now. Type the meal instead.';
    return { kind: 'error', message };
  }
  if (data.output?.not_food) return { kind: 'not_food' };
  const drafts = photoItemsToDrafts(data.output?.items);
  return drafts.length ? { kind: 'drafts', drafts } : { kind: 'not_food' };
}
