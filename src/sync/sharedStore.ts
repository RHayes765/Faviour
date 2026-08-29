import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Item, Profile } from '../types';

export const SHARED_STORE_KEY = '@faviour:shared';

export interface SharedState {
  profiles: Profile[];
  items: Item[];
  /** Owning account's user id per shared profile id. */
  ownerByProfile: Record<string, string>;
  /** Friendly label per owner user id (defaults to their email at claim time). */
  labelByOwner: Record<string, string>;
}

export const EMPTY_SHARED: SharedState = {
  profiles: [],
  items: [],
  ownerByProfile: {},
  labelByOwner: {},
};

export async function loadShared(): Promise<SharedState> {
  try {
    const raw = await AsyncStorage.getItem(SHARED_STORE_KEY);
    if (!raw) {
      return EMPTY_SHARED;
    }
    const parsed = JSON.parse(raw) as Partial<SharedState>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      ownerByProfile:
        parsed.ownerByProfile && typeof parsed.ownerByProfile === 'object'
          ? parsed.ownerByProfile
          : {},
      labelByOwner:
        parsed.labelByOwner && typeof parsed.labelByOwner === 'object'
          ? parsed.labelByOwner
          : {},
    };
  } catch (e) {
    console.warn('Failed to load shared overlay', e);
    return EMPTY_SHARED;
  }
}

export async function saveShared(state: SharedState): Promise<void> {
  await AsyncStorage.setItem(SHARED_STORE_KEY, JSON.stringify(state));
}

export async function clearShared(): Promise<void> {
  await AsyncStorage.removeItem(SHARED_STORE_KEY);
}
