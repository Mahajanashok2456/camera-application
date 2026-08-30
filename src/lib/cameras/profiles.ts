/**
 * CAMERA PROFILES
 * -----------------------------------------------------------------------------
 * A camera is data, not code. Everything that makes a camera feel different —
 * optics, film response, grain, body UI, sound, haptics, capture choreography
 * and its limitations — is declared here. Adding a VHS / Super 8 / Instax
 * camera later means appending one object to CAMERA_PROFILES.
 */

export type CameraId = "polaroid" | "film35" | "disposable" | "ccd";

export type FlashBehavior = "prefer-off" | "prefer-auto" | "prefer-on";
export type CaptureAnimation = "eject-develop" | "film-advance" | "hard-flash" | "digital-write";
export type DateStampStyle = "none" | "orange-lcd" | "film-orange" | "slash";

/** Uniforms consumed by the shared GPU pipeline (see lib/camera/pipeline.ts). */
export interface RenderProfile {
  exposure: number;
  contrast: number;
  saturation: number;
  /** Kelvin-ish push. Negative = cooler, positive = warmer. */
  temperature: number;
  tint: number;
  /** Shadow toe colour cast (film base). */
  lift: [number, number, number];
  /** Highlight gain per channel (colour response). */
  gain: [number, number, number];
  gamma: number;
  /** Highlight compression, 0 = clip hard (digital), 1 = long roll-off (film). */
  highlightRolloff: number;
  shadowCrush: number;
  fade: number;
  grain: number;
  grainSize: number;
  /** Coloured (chroma) portion of the grain. */
  grainChroma: number;
  vignette: number;
  vignetteSoftness: number;
  chromaticAberration: number;
  softness: number;
  sharpen: number;
  bloom: number;
  halation: number;
  /** JPEG-ish edge sharpening artefacts / posterisation for early digital. */
  posterize: number;
}

export interface CameraProfile {
  id: CameraId;
  name: string;
  subtitle: string;
  filmType: string;
  /** Accent token name defined in styles.css. */
  accent: string;
  /** width / height of the captured frame. */
  aspectRatio: number;
  /** Long edge of the exported image in px. */
  captureLongEdge: number;
  render: RenderProfile;
  flashBehavior: FlashBehavior;
  captureAnimation: CaptureAnimation;
  dateStampStyle: DateStampStyle;
  /** null = unlimited frames. */
  frameLimit: number | null;
  /** Selectable roll sizes, if the camera has film. */
  rollOptions?: number[];
  /** ms between shutter press and the frame actually being grabbed. */
  shutterLag: number;
  /** Blackout duration of the live preview after capture. */
  blackout: number;
  sound: "polaroid" | "film35" | "disposable" | "ccd";
  /** Copy shown in the viewfinder chrome. */
  hints: string[];
}

export const CAMERA_PROFILES: Record<CameraId, CameraProfile> = {
  polaroid: {
    id: "polaroid",
    name: "Polaroid",
    subtitle: "Instant SX-70",
    filmType: "Integral instant film · ISO 160",
    accent: "polaroid",
    aspectRatio: 1,
    captureLongEdge: 1400,
    flashBehavior: "prefer-auto",
    captureAnimation: "eject-develop",
    dateStampStyle: "none",
    frameLimit: 8,
    shutterLag: 120,
    blackout: 260,
    sound: "polaroid",
    hints: ["8 exposures per pack", "Photo develops in 40s"],
    render: {
      exposure: 0.04,
      contrast: 0.86,
      saturation: 0.82,
      temperature: 0.16,
      tint: 0.05,
      lift: [0.062, 0.052, 0.042],
      gain: [1.03, 0.985, 0.94],
      gamma: 1.04,
      highlightRolloff: 0.95,
      shadowCrush: 0.1,
      fade: 0.18,
      grain: 0.05,
      grainSize: 1.7,
      grainChroma: 0.35,
      vignette: 0.3,
      vignetteSoftness: 0.75,
      chromaticAberration: 0.0014,
      softness: 0.42,
      sharpen: 0,
      bloom: 0.3,
      halation: 0.28,
      posterize: 0,
    },
  },

  film35: {
    id: "film35",
    name: "35mm",
    subtitle: "Rangefinder · Gold 200",
    filmType: "Colour negative · ISO 200",
    accent: "film35",
    aspectRatio: 3 / 2,
    captureLongEdge: 2200,
    flashBehavior: "prefer-off",
    captureAnimation: "film-advance",
    dateStampStyle: "film-orange",
    frameLimit: 36,
    rollOptions: [24, 36],
    shutterLag: 60,
    blackout: 140,
    sound: "film35",
    hints: ["Advance after every frame", "Halation on highlights"],
    render: {
      exposure: 0.02,
      contrast: 1.02,
      saturation: 1.04,
      temperature: 0.07,
      tint: -0.02,
      lift: [0.028, 0.03, 0.038],
      gain: [1.02, 1.0, 0.97],
      gamma: 0.98,
      highlightRolloff: 0.88,
      shadowCrush: 0.06,
      fade: 0.07,
      grain: 0.075,
      grainSize: 1.15,
      grainChroma: 0.28,
      vignette: 0.2,
      vignetteSoftness: 0.85,
      chromaticAberration: 0.0009,
      softness: 0.14,
      sharpen: 0.18,
      bloom: 0.18,
      halation: 0.34,
      posterize: 0,
    },
  },

  disposable: {
    id: "disposable",
    name: "Disposable",
    subtitle: "Single use · 27 exp",
    filmType: "Colour negative · ISO 400",
    accent: "disposable",
    aspectRatio: 4 / 3,
    captureLongEdge: 1600,
    flashBehavior: "prefer-on",
    captureAnimation: "hard-flash",
    dateStampStyle: "slash",
    frameLimit: 27,
    shutterLag: 90,
    blackout: 180,
    sound: "disposable",
    hints: ["Use the flash. Always.", "Plastic lens · 27 exposures"],
    render: {
      exposure: 0.1,
      contrast: 1.16,
      saturation: 1.12,
      temperature: -0.06,
      tint: 0.06,
      lift: [0.05, 0.046, 0.055],
      gain: [1.05, 0.99, 1.02],
      gamma: 0.94,
      highlightRolloff: 0.6,
      shadowCrush: 0.2,
      fade: 0.05,
      grain: 0.14,
      grainSize: 1.05,
      grainChroma: 0.5,
      vignette: 0.44,
      vignetteSoftness: 0.55,
      chromaticAberration: 0.0026,
      softness: 0.34,
      sharpen: 0,
      bloom: 0.14,
      halation: 0.2,
      posterize: 0,
    },
  },

  ccd: {
    id: "ccd",
    name: "CCD Digital",
    subtitle: "Compact · 3.2 MP",
    filmType: "CCD sensor · ISO 100",
    accent: "ccd",
    aspectRatio: 4 / 3,
    captureLongEdge: 2048,
    flashBehavior: "prefer-auto",
    captureAnimation: "digital-write",
    dateStampStyle: "orange-lcd",
    frameLimit: null,
    shutterLag: 320,
    blackout: 220,
    sound: "ccd",
    hints: ["Half-press focus beep", "Writing to card…"],
    render: {
      exposure: 0.0,
      contrast: 1.1,
      saturation: 1.14,
      temperature: -0.09,
      tint: -0.04,
      lift: [0.008, 0.012, 0.018],
      gain: [0.99, 1.01, 1.06],
      gamma: 1.0,
      highlightRolloff: 0.12,
      shadowCrush: 0.26,
      fade: 0.0,
      grain: 0.055,
      grainSize: 1.0,
      grainChroma: 0.72,
      vignette: 0.14,
      vignetteSoftness: 0.9,
      chromaticAberration: 0.0016,
      softness: 0,
      sharpen: 0.55,
      bloom: 0.1,
      halation: 0.06,
      posterize: 0.18,
    },
  },
};

export const CAMERA_ORDER: CameraId[] = ["polaroid", "film35", "disposable", "ccd"];

export const getProfile = (id: CameraId): CameraProfile =>
  CAMERA_PROFILES[id] ?? CAMERA_PROFILES.polaroid;

export function formatDateStamp(style: DateStampStyle, date = new Date()): string | null {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  switch (style) {
    case "orange-lcd":
      return `${mm} ${dd} ${yyyy}`;
    case "film-orange":
      return `${dd}.${mm}.${String(yyyy).slice(2)}`;
    case "slash":
      return `${mm}/${dd}/${String(yyyy).slice(2)}`;
    default:
      return null;
  }
}
