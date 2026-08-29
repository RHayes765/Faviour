import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { newId } from '../storage/ids';

// The new expo-file-system API doesn't support web. The web build is only a
// dev surface, so there photos pass the picked URI straight through (they
// live for the session; real persistence is native-only).

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/** Resolves a stored photo file name to a renderable URI. */
export function photoUri(fileName: string | null): string | null {
  if (!fileName) {
    return null;
  }
  if (Platform.OS === 'web') {
    return fileName;
  }
  return new File(photosDir(), fileName).uri;
}

/**
 * Copies a picked image (cache URI, which the OS may purge) into the app's
 * document directory and returns the stored file name. Only the name is
 * persisted — absolute paths can change across app updates.
 */
export async function importPhoto(sourceUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const fileName = `${newId()}.jpg`;
  await new File(sourceUri).copy(new File(photosDir(), fileName));
  return fileName;
}

export function deletePhoto(fileName: string | null): void {
  if (!fileName || Platform.OS === 'web') {
    return;
  }
  try {
    const file = new File(photosDir(), fileName);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    console.warn('Failed to delete photo file', e);
  }
}
