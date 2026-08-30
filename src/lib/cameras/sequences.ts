/**
 * CAPTURE CHOREOGRAPHY
 * -----------------------------------------------------------------------------
 * Each camera's shutter is a timed sequence of visual, audio, haptic and
 * mechanical events. Timings are tuned per camera — nothing here is instant.
 */

import type { CaptureResult } from "../camera/capture";
import type { CameraProfile } from "./profiles";
import type { SoundVoice } from "../audio/soundEngine";

export interface SequenceHooks {
  sound: (voice: SoundVoice, delay?: number) => void;
  haptic: (pattern: "tap" | "press" | "capture" | "eject" | "switch" | "error") => void;
  flash: (on: boolean) => void;
  shake: () => void;
  blackout: (on: boolean) => void;
  status: (text: string | null) => void;
  torch: (on: boolean) => Promise<boolean>;
  grab: (flashFired: boolean) => Promise<CaptureResult | null>;
  present: (result: CaptureResult) => void;
  advanceFrame: () => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runCaptureSequence(
  profile: CameraProfile,
  flashFires: boolean,
  h: SequenceHooks,
): Promise<void> {
  switch (profile.captureAnimation) {
    /* ---- POLAROID: mirror slap, flash, motor, print ejection ------------ */
    case "eject-develop": {
      h.haptic("press");
      h.sound("polaroid-shutter");
      if (flashFires) {
        void h.torch(true);
        h.flash(true);
      }
      await wait(70);
      h.shake();
      h.haptic("capture");
      await wait(profile.shutterLag);
      const shot = await h.grab(flashFires);
      h.blackout(true);
      h.flash(false);
      if (flashFires) void h.torch(false);
      h.sound("polaroid-motor", 0.05);
      h.sound("polaroid-eject", 0.22);
      await wait(240);
      h.blackout(false);
      if (shot) {
        h.advanceFrame();
        h.present(shot);
        h.haptic("eject");
      }
      return;
    }

    /* ---- 35MM: crisp shutter, then the film winds on ------------------- */
    case "film-advance": {
      h.haptic("press");
      h.sound("film35-shutter");
      if (flashFires) {
        void h.torch(true);
        h.flash(true);
      }
      await wait(profile.shutterLag);
      const shot = await h.grab(flashFires);
      h.blackout(true);
      h.shake();
      h.flash(false);
      if (flashFires) void h.torch(false);
      await wait(120);
      h.blackout(false);
      h.sound("film35-advance");
      h.haptic("capture");
      if (shot) {
        h.advanceFrame();
        h.present(shot);
      }
      return;
    }

    /* ---- DISPOSABLE: harsh flash, plastic clack, capacitor whine ------- */
    case "hard-flash": {
      h.haptic("press");
      h.sound("disposable-shutter");
      if (flashFires) {
        void h.torch(true);
        h.flash(true);
      }
      await wait(profile.shutterLag);
      const shot = await h.grab(flashFires);
      h.blackout(true);
      h.shake();
      await wait(90);
      h.flash(false);
      if (flashFires) void h.torch(false);
      await wait(90);
      h.blackout(false);
      h.haptic("capture");
      if (flashFires) {
        h.status("FLASH CHARGING");
        h.sound("disposable-charge", 0.1);
        void wait(1700).then(() => h.status(null));
      }
      if (shot) {
        h.advanceFrame();
        h.present(shot);
      }
      return;
    }

    /* ---- CCD: focus beep, lag, electronic shutter, card write ---------- */
    case "digital-write": {
      h.haptic("tap");
      h.sound("ccd-focus");
      h.status("AF");
      await wait(260);
      h.status(null);
      h.sound("ccd-shutter");
      if (flashFires) {
        void h.torch(true);
        h.flash(true);
      }
      await wait(profile.shutterLag);
      const shot = await h.grab(flashFires);
      h.blackout(true);
      h.flash(false);
      if (flashFires) void h.torch(false);
      h.status("WRITING");
      h.haptic("capture");
      await wait(320);
      h.blackout(false);
      h.sound("ccd-confirm");
      if (flashFires) h.sound("ccd-recharge", 0.2);
      h.status(null);
      if (shot) {
        h.advanceFrame();
        h.present(shot);
      }
      return;
    }
  }
}
