/**
 * DEVICE CAMERA — stream lifecycle, facing, torch/flash and permissions.
 * Permission denial is handled once and remembered; we never re-prompt in a loop.
 */

export type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface StreamHandle {
  stream: MediaStream;
  track: MediaStreamTrack;
  hasTorch: boolean;
}

const DENIED_KEY = "vc.cameraDenied";

export function wasDenied() {
  try {
    return window.localStorage.getItem(DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDenied(denied: boolean) {
  try {
    if (denied) window.localStorage.setItem(DENIED_KEY, "1");
    else window.localStorage.removeItem(DENIED_KEY);
  } catch {
    /* ignore */
  }
}

export async function openStream(facing: "environment" | "user"): Promise<StreamHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: facing === "user" ? "user" : { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1440 },
    },
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      rememberDenied(true);
      throw new Error("denied");
    }
    // fall back to any camera before giving up
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  rememberDenied(false);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("unsupported");
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
  return { stream, track, hasTorch: Boolean(caps.torch) };
}

export function closeStream(handle: StreamHandle | null) {
  handle?.stream.getTracks().forEach((t) => t.stop());
}

export async function setTorch(handle: StreamHandle | null, on: boolean): Promise<boolean> {
  if (!handle?.hasTorch) return false;
  try {
    await handle.track.applyConstraints({
      advanced: [{ torch: on } as unknown as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

/** Rough ambient-light read from a preview frame, used for AUTO flash. */
export function estimateBrightness(video: HTMLVideoElement): number {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 24;
  const ctx = c.getContext("2d");
  if (!ctx || !video.videoWidth) return 0.5;
  ctx.drawImage(video, 0, 0, 32, 24);
  const { data } = ctx.getImageData(0, 0, 32, 24);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += ((data[i] ?? 0) * 0.2126 + (data[i + 1] ?? 0) * 0.7152 + (data[i + 2] ?? 0) * 0.0722) / 255;
  }
  return sum / (data.length / 4);
}
