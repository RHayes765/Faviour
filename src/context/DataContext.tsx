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
import type { FaviourRepository } from '../storage/repository';
import type { Item, NewItemInput, Profile } from '../types';
import { distinctValues } from '../utils/search';

interface DataContextValue {
  /** False until the initial load (and any pending migration) completes. */
  ready: boolean;
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
  addReasonTag: (tag: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<FaviourRepository>(new AsyncStorageRepository());
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reasonTags, setReasonTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
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
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addProfile = useCallback(async (name: string) => {
    const profile = await repoRef.current.createProfile({ name });
    setProfiles((prev) => [...prev, profile]);
    return profile;
  }, []);

  const removeProfile = useCallback(async (id: string) => {
    await repoRef.current.deleteProfile(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) => prev.filter((i) => i.profileId !== id));
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
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addReasonTag = useCallback(async (tag: string) => {
    const tags = await repoRef.current.addReasonTag(tag);
    setReasonTags(tags);
  }, []);

  const categories = useMemo(
    () => distinctValues(items.map((i) => i.category)),
    [items],
  );
  const brands = useMemo(() => distinctValues(items.map((i) => i.brand)), [items]);

  const value = useMemo(
    () => ({
      ready,
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
    }),
    [
      ready,
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
