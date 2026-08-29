import { AsyncStorageRepository } from './asyncStorageRepository';
import type { FaviourRepository } from './repository';

// Single shared instance: DataContext (UI state) and the sync engine must
// operate on the same in-memory mirror, never two competing ones.
export const repository: FaviourRepository = new AsyncStorageRepository();
