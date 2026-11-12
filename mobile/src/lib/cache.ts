import type { Organization, Profile, WorkspaceData } from './types';

// The last workspace loaded on this device, so it can still be read without signal. One entry
// only: it is replaced on every load and removed on sign-out.
const cacheKey = 'clearflow-workspace';

export type CachedWorkspace = { userId: string; savedAt: string; profile: Profile; organization: Organization; data: WorkspaceData };

export function cacheWorkspace(entry: Omit<CachedWorkspace, 'savedAt'>) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ ...entry, savedAt: new Date().toISOString() }));
  } catch {
    // Storage unavailable: offline viewing just won't be available.
  }
}

export function cachedWorkspace(userId: string): CachedWorkspace | null {
  try {
    const entry = JSON.parse(localStorage.getItem(cacheKey) || 'null') as CachedWorkspace | null;
    return entry?.userId === userId ? entry : null;
  } catch {
    return null;
  }
}

export function clearCachedWorkspace() {
  try {
    localStorage.removeItem(cacheKey);
  } catch {
    // Nothing cached.
  }
}
