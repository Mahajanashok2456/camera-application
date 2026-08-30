import { useCallback, useEffect, useRef, useState } from "react";
import { CameraPipeline } from "@/lib/camera/pipeline";
import {
  closeStream,
  estimateBrightness,
  openStream,
  setTorch,
  wasDenied,
  type PermissionState,
  type StreamHandle,
} from "@/lib/camera/device";
import { captureFrame, type CaptureResult } from "@/lib/camera/capture";
import type { CameraProfile } from "@/lib/cameras/profiles";
import type { FlashMode, Quality } from "@/lib/store/settings";

interface Options {
  profile: CameraProfile;
  facing: "environment" | "user";
  flashMode: FlashMode;
  quality: Quality;
  dateStamp: boolean;
  saveOriginal: boolean;
  active: boolean;
}

/**
 * CAMERA ENGINE — owns the media stream, the live GPU preview loop and the
 * capture path. The UI never touches WebGL or MediaStream directly.
 */
export function useCameraEngine(opts: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<CameraPipeline | null>(null);
  const handleRef = useRef<StreamHandle | null>(null);
  const rafRef = useRef<number>(0);
  const seedRef = useRef(Math.random() * 100);
  const flashBoostRef = useRef(0);
  const profileRef = useRef(opts.profile);
  const mirrorRef = useRef(opts.facing === "user");
  const pausedRef = useRef(false);

  const [permission, setPermission] = useState<PermissionState>(
    typeof window !== "undefined" && wasDenied() ? "denied" : "idle",
  );
  const [ready, setReady] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  profileRef.current = opts.profile;
  mirrorRef.current = opts.facing === "user";

  /* ---- stream lifecycle ------------------------------------------------- */
  useEffect(() => {
    if (!opts.active) return;
    let cancelled = false;

    (async () => {
      setPermission((p) => (p === "granted" ? p : "requesting"));
      try {
        const handle = await openStream(opts.facing);
        if (cancelled) {
          closeStream(handle);
          return;
        }
        handleRef.current = handle;
        setHasTorch(handle.hasTorch);
        const video = videoRef.current;
        if (video) {
          video.srcObject = handle.stream;
          video.playsInline = true;
          video.muted = true;
          await video.play().catch(() => {});
        }
        setPermission("granted");
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const msg = (err as Error).message;
        setPermission(msg === "denied" ? "denied" : msg === "unsupported" ? "unsupported" : "denied");
      }
    })();

    return () => {
      cancelled = true;
      closeStream(handleRef.current);
      handleRef.current = null;
      setReady(false);
    };
  }, [opts.active, opts.facing]);

  /* ---- live preview loop -----------------------------------------------
   * Rebuilt whenever the camera changes: each camera body remounts its own
   * <canvas>, so the WebGL context must be re-bound to the live node. */
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // the <video> remounts with the camera body, so re-attach the live stream
    const stream = handleRef.current?.stream;
    if (stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      void video.play().catch(() => {});
    }

    let pipeline: CameraPipeline;
    try {
      pipeline = new CameraPipeline(canvas);
    } catch {
      return;
    }
    pipelineRef.current = pipeline;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (pausedRef.current || video.readyState < 2) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      // preview renders at a capped resolution so grain/bloom stay cheap
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.min(Math.round(rect.width * dpr), 1080);
      const targetH = Math.round(targetW / profileRef.current.aspectRatio);
      pipeline.resize(targetW, targetH);
      pipeline.render(video, {
        profile: profileRef.current.render,
        aspectRatio: profileRef.current.aspectRatio,
        mirror: mirrorRef.current,
        quality: 0,
        seed: (seedRef.current += 0.37),
        flashBoost: flashBoostRef.current,
      });
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [ready, opts.profile.id]);

  const pausePreview = useCallback((paused: boolean) => {
    pausedRef.current = paused;
  }, []);

  const setFlashBoost = useCallback((v: number) => {
    flashBoostRef.current = v;
  }, []);

  /** Decide whether the flash should fire for this frame. */
  const shouldFlash = useCallback((): boolean => {
    if (opts.flashMode === "off") return false;
    if (opts.flashMode === "on") return true;
    const video = videoRef.current;
    if (!video) return false;
    return estimateBrightness(video) < 0.34;
  }, [opts.flashMode]);

  const torch = useCallback(async (on: boolean) => setTorch(handleRef.current, on), []);

  const capture = useCallback(
    async (flashFired: boolean): Promise<CaptureResult | null> => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return null;
      return captureFrame({
        video,
        profile: profileRef.current,
        mirror: mirrorRef.current,
        dateStamp: opts.dateStamp,
        quality: opts.quality,
        flashFired,
        saveOriginal: opts.saveOriginal,
      });
    },
    [opts.dateStamp, opts.quality, opts.saveOriginal],
  );

  return {
    videoRef,
    canvasRef,
    permission,
    ready,
    hasTorch,
    capture,
    shouldFlash,
    torch,
    pausePreview,
    setFlashBoost,
  };
}
