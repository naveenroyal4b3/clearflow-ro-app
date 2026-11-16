import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { t } from './i18n';
import { productImageUrls } from './shared';
import { supabase } from './supabase';

// Signed photo links by storage path, kept for the app's lifetime (they last a day) so lists don't
// fetch them again. Paths are unique per upload, so a replaced photo never reuses a stale link.
const urlCache = new Map<string, string>();
const longestSide = 1000;
const maxBytes = 1024 * 1024;

/** Photo links for the given products; products whose link can't be fetched (offline) show the icon. */
export function useProductImageUrls(products: { image?: string }[]) {
  const key = [...new Set(products.map(item => item.image || '').filter(Boolean))].sort().join('|');
  // Bumped when new links arrive so the screen redraws with them.
  const [, setLoaded] = useState(0);

  useEffect(() => {
    const missing = (key ? key.split('|') : []).filter(path => !urlCache.has(path));
    if (!missing.length) return;
    let active = true;
    productImageUrls(supabase, missing)
      .then(found => {
        Object.entries(found).forEach(([path, url]) => urlCache.set(path, url));
        if (active) setLoaded(count => count + 1);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [key]);

  return cachedUrls(key);
}

function cachedUrls(key: string) {
  const urls: Record<string, string> = {};
  for (const path of key ? key.split('|') : []) {
    const url = urlCache.get(path);
    if (url) urls[path] = url;
  }
  return urls;
}

export type PickedPhoto = { uri: string; width: number; height: number };

/**
 * Takes a photo with the camera or chooses one (Android's system photo picker, no storage
 * permission), then shrinks it for upload. Returns null when cancelled; throws a readable error.
 */
export async function pickProductPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error(t('Allow camera access in your phone settings to take a photo.'));
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return shrinkPhoto(asset);
}

async function shrinkPhoto(asset: { uri: string; width: number; height: number }): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > longestSide) {
    context.resize(asset.width >= asset.height ? { width: longestSide } : { height: longestSide });
  }
  const image = await context.renderAsync();
  for (const compress of [0.7, 0.5, 0.3]) {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress });
    if (new File(saved.uri).size < maxBytes) return { uri: saved.uri, width: saved.width, height: saved.height };
  }
  throw new Error(t('This photo is too large. Choose a smaller one.'));
}

/** The photo's bytes for upload. */
export function photoBytes(uri: string) {
  return new File(uri).arrayBuffer();
}
