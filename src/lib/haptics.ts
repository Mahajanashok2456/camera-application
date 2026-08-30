/**
 * HAPTICS — subtle, native where available (Capacitor Haptics on device,
 * Vibration API on the web). Every important interaction gets a physical
 * confirmation, but nothing here buzzes for longer than it must.
 */

type Pattern = "tap" | "press" | "capture" | "eject" | "switch" | "error";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  press: 14,
  capture: [22, 40, 12],
  eject: [10, 60, 8, 50, 16],
  switch: [6, 30, 6],
  error: [18, 60, 18],
};

let enabled = true;

interface CapacitorHaptics {
  impact(opts: { style: string }): Promise<void>;
  vibrate(opts: { duration: number }): Promise<void>;
}

function native(): CapacitorHaptics | null {
  const w = window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } };
  return w.Capacitor?.Plugins?.Haptics ?? null;
}

export const haptics = {
  configure(on: boolean) {
    enabled = on;
  },
  fire(pattern: Pattern) {
    if (!enabled || typeof window === "undefined") return;
    const plugin = native();
    if (plugin) {
      const style = pattern === "tap" ? "Light" : pattern === "capture" ? "Heavy" : "Medium";
      void plugin.impact({ style }).catch(() => {});
      return;
    }
    try {
      navigator.vibrate?.(PATTERNS[pattern]);
    } catch {
      /* unsupported */
    }
  },
};
