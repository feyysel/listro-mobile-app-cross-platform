export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'listro-theme';

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

export function themeIsDark(preference: ThemePreference): boolean {
  if (preference === 'dark') return true;
  if (preference === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemePreference(preference: ThemePreference): boolean {
  const dark = themeIsDark(preference);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, preference);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
  return dark;
}

export function toggleTheme(): boolean {
  const next: ThemePreference = themeIsDark(readThemePreference()) ? 'light' : 'dark';
  return applyThemePreference(next);
}
