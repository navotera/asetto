import { useSyncExternalStore } from 'react';

export type ColorMode = 'light' | 'dark';
const STORAGE_KEY = 'asetto:color-mode';

let current: ColorMode = 'light';
const listeners = new Set<() => void>();

function apply(mode: ColorMode) {
  document.documentElement.setAttribute('data-color-mode', mode);
}

/** Called once from main.tsx before React mounts to avoid a flash of the wrong theme. */
export function restoreColorMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
    current = stored === 'dark' ? 'dark' : 'light';
  } catch {
    current = 'light';
  }
  apply(current);
}

export function setColorMode(mode: ColorMode) {
  current = mode;
  apply(mode);
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode — ignore */
  }
  listeners.forEach((l) => l());
}

export function toggleColorMode() {
  setColorMode(current === 'dark' ? 'light' : 'dark');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
