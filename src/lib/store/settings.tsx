import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CAMERA_ORDER, type CameraId } from "../cameras/profiles";
import { soundEngine } from "../audio/soundEngine";
import { haptics } from "../haptics";

export type FlashMode = "off" | "auto" | "on";
export type Facing = "environment" | "user";
export type Quality = "standard" | "high";

export interface Settings {
  onboarded: boolean;
  defaultCamera: CameraId;
  flashMode: FlashMode;
  facing: Facing;
  quality: Quality;
  saveOriginal: boolean;
  dateStamp: boolean;
  sound: boolean;
  shutterSound: boolean;
  haptics: boolean;
  uiBrightness: number;
  rollSize: number;
}

const DEFAULTS: Settings = {
  onboarded: false,
  defaultCamera: "polaroid",
  flashMode: "auto",
  facing: "environment",
  quality: "high",
  saveOriginal: false,
  dateStamp: true,
  sound: true,
  shutterSound: true,
  haptics: true,
  uiBrightness: 1,
  rollSize: 36,
};

const KEY = "vc.settings.v1";

function read(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULTS, ...parsed };
    if (!CAMERA_ORDER.includes(merged.defaultCamera)) merged.defaultCamera = "polaroid";
    return merged;
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  hydrated: boolean;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = read();
    setSettings(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage full / private mode */
    }
    soundEngine.configure({ sound: settings.sound, shutter: settings.shutterSound });
    haptics.configure(settings.haptics);
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ settings, update, hydrated }), [settings, update, hydrated]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
