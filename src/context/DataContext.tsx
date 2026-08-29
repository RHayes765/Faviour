import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AsyncStorageRepository } from '../storage/asyncStorageRepository';
import type { FaviourRepository, ImportMode } from '../storage/repository';
import type { DbSnapshot, Item, NewItemInput, Profile } from '../types';
import { deletePhoto } from '../utils/photos';
import { distinctValues } from '../utils/search';

interface DataContextValue {
  /** False until the initial load (and any pending migration) completes. */
  ready: boolean;
  /** True when the initial load failed — the UI must not present an empty
   * library over intact stored data. */
  loadFailed: boolean;
  retryLoad: () => void;
  profiles: Profile[];
  items: Item[];
  reasonTags: string[];
  /** Derived from items — always current, never stale. */
  categories: string[];
  brands: string[];
  addProfile: (name: string) => Promise<Profile>;
  removeProfile: (id: string) => Promise<void>;
  addItem: (input: NewItemInput) => Promise<Item>;
  updateItem: (id: string, patch: Partial<NewItemInput>) => Promise<Item>;
  removeItem: (id: string) => Promise<void>;
  /** Persists a tag and returns the canonical (deduped) tag list. */
  addReasonTag: (tag: string) => Promise<string[]>;
  exportData: () => Promise<DbSnapshot>;
  importData: (incoming: DbSnapshot, mode: ImportMode) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<FaviourRepository>(new AsyncStorageRepository());
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reasonTags, setReasonTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    repoRef.current
      .load()
      .then((db) => {
        if (cancelled) {
          return;
        }
        setProfiles(db.profiles);
        setItems(db.items);
        setReasonTags(db.reasonTags);
        setReady(true);
      })
      .catch((e) => {
        console.error('Failed to load data', e);
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const retryLoad = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const addProfile = useCallback(async (name: string) => {
    const profile = await repoRef.current.createProfile({ name });
    setProfiles((prev) => [...prev, profile]);
    return profile;
  }, []);

  const removeProfile = useCallback(async (id: string) => {
    await repoRef.current.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => {
      for (const item of prev) {
        if (item.profileId === id) {
          deletePhoto(item.photoFileName);
        }
      }
      return prev.filter((i) => i.profileId !== id);
    });
  }, []);

  const addItem = useCallback(async (input: NewItemInput) => {
    const item = await repoRef.current.createItem(input);
    setItems((prev) => [...prev, item]);
    return item;
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<NewItemInput>) => {
    const updated = await repoRef.current.updateItem(id, patch);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    await repoRef.current.deleteItem(id);
    setItems((prev) => {
      const removed = prev.find((i) => i.id === id);
      if (removed) {
        deletePhoto(removed.photoFileName);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const addReasonTag = useCallback(async (tag: string) => {
    const tags = await repoRef.current.addReasonTag(tag);
    setReasonTags(tags);
    return tags;
  }, []);

  const exportData = useCallback(async () => repoRef.current.exportSnapshot(), []);

  const importData = useCallback(async (incoming: DbSnapshot, mode: ImportMode) => {
    const db = await repoRef.current.importSnapshot(incoming, mode);
    setProfiles(db.profiles);
    setItems(db.items);
    setReasonTags(db.reasonTags);
  }, []);

  const categories = useMemo(
    () => distinctValues(items.map((i) => i.category)),
    [items],
  );
  const brands = useMemo(() => distinctValues(items.map((i) => i.brand)), [items]);

  const value = useMemo(
    () => ({
      ready,
      loadFailed,
      retryLoad,
      profiles,
      items,
      reasonTags,
      categories,
      brands,
      addProfile,
      removeProfile,
      addItem,
      updateItem,
      removeItem,
      addReasonTag,
      exportData,
      importData,
    }),
    [
      ready,
      loadFailed,
      retryLoad,
      profiles,
      items,
      reasonTags,
      categories,
      brands,
      addProfile,
      removeProfile,
      addItem,
      updateItem,
      removeItem,
      addReasonTag,
      exportData,
      importData,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) {
    throw new Error('useData must be used inside DataProvider');
  }
  return value;
}
