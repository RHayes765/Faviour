import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsyncStorageRepository } from '../src/storage/asyncStorageRepository';
import {
  clearShared,
  EMPTY_SHARED,
  loadShared,
  saveShared,
  SHARED_STORE_KEY,
  type SharedState,
} from '../src/sync/sharedStore';

const state: SharedState = {
  profiles: [{ id: 'wp', name: 'Sarah', createdAt: '2026-01-01T00:00:00.000Z' }],
  items: [
    {
      id: 'wi',
      profileId: 'wp',
      name: 'Her sauce',
      category: 'Sauce',
      brand: 'X',
      preference: 'like',
      reasonTags: [],
      notes: '',
      barcode: null,
      photoFileName: null,
      rankInCategory: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  ownerByProfile: { wp: 'wife-uuid' },
  labelByOwner: { 'wife-uuid': 'sarah@example.com' },
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('sharedStore', () => {
  it('round-trips state', async () => {
    await saveShared(state);
    expect(await loadShared()).toEqual(state);
  });

  it('returns empty for missing or corrupt payloads', async () => {
    expect(await loadShared()).toEqual(EMPTY_SHARED);
    await AsyncStorage.setItem(SHARED_STORE_KEY, '{not json');
    expect(await loadShared()).toEqual(EMPTY_SHARED);
    await AsyncStorage.setItem(SHARED_STORE_KEY, JSON.stringify({ profiles: 'nope' }));
    expect((await loadShared()).profiles).toEqual([]);
  });

  it('clears', async () => {
    await saveShared(state);
    await clearShared();
    expect(await loadShared()).toEqual(EMPTY_SHARED);
  });

  it('regression: shared overlay never leaks into repository export', async () => {
    await saveShared(state);
    const repo = new AsyncStorageRepository();
    const own = await repo.createProfile({ name: 'Ryley' });
    const exported = await repo.exportSnapshot();
    expect(exported.profiles.map((p) => p.id)).toEqual([own.id]);
    expect(exported.items).toEqual([]);
  });
});
