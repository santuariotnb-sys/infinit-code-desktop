import { useState, useCallback } from 'react';

export interface Settings {
  autoSave: boolean;
  wordWrap: boolean;
  minimap: boolean;
  claudeAutoStart: boolean;
  voicePtBr: boolean;
  autoSkills: boolean;
  previewAutoReload: boolean;
  defaultPort: number;
}

const DEFAULT: Settings = {
  autoSave: true,
  wordWrap: false,
  minimap: true,
  claudeAutoStart: true,
  voicePtBr: true,
  autoSkills: true,
  previewAutoReload: true,
  defaultPort: 3000,
};

const STORAGE_KEY = 'infinit-settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        console.error('[useSettings] falha ao salvar settings');
      }
      return next;
    });
  }, []);

  return { settings, updateSetting };
}
