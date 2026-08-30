import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Images, RefreshCcw, Settings2, Zap, ZapOff, CircleDot } from "lucide-react";
import { toast } from "sonner";

import { Viewfinder } from "@/components/camera/Viewfinder";
import { ShutterButton } from "@/components/camera/ShutterButton";
import { CameraSelector } from "@/components/camera/CameraSelector";
import { DevelopingPrint } from "@/components/camera/DevelopingPrint";
import { CAMERA_CHROME } from "@/components/camera/chrome";
import { useCameraEngine } from "@/hooks/useCameraEngine";
import { runCaptureSequence } from "@/lib/cameras/sequences";
import { CAMERA_ORDER, getProfile, type CameraId } from "@/lib/cameras/profiles";
import { soundEngine } from "@/lib/audio/soundEngine";
import { haptics } from "@/lib/haptics";
import { useSettings, type FlashMode } from "@/lib/store/settings";
import { exportShot, saveShot, shareShot, shotFilename } from "@/lib/store/gallery";
import type { CaptureResult } from "@/lib/camera/capture";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vintage Camera — Shoot Instant Film, 35mm, Disposable & CCD" },
      {
        name: "description",
        content:
          "Four virtual vintage cameras with real optics, film grain, shutter sounds and instant-film development. Point, press, and watch the print appear.",
      },
      { property: "og:title", content: "Vintage Camera — Instant Film, 35mm, Disposable, CCD" },
      {
        property: "og:description",
        content:
          "Operate a real vintage camera on your phone: mechanical shutters, film counters, hard flash and prints that develop in your hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CameraScreen,
});

const FLASH_CYCLE: FlashMode[] = ["off", "auto", "on"];

function CameraScreen() {
  const navigate = useNavigate();
  const { settings, update, hydrated } = useSettings();
  const [cameraId, setCameraId] = useState<CameraId>(settings.defaultCamera);
  const [frames, setFrames] = useState<Record<CameraId, number>>({
    polaroid: 8,
    film35: settings.rollSize,
    disposable: 27,
    ccd: 0,
  });
  const [busy, setBusy] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<"left" | "right" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const profile = getProfile(cameraId);
  const chrome = CAMERA_CHROME[cameraId];

  useEffect(() => {
    if (hydrated && !settings.onboarded) void navigate({ to: "/onboarding" });
  }, [hydrated, settings.onboarded, navigate]);

  useEffect(() => {
    if (hydrated) setCameraId(settings.defaultCamera);
  }, [hydrated, settings.defaultCamera]);

  useEffect(() => {
    setFrames((f) => ({ ...f, film35: settings.rollSize }));
  }, [settings.rollSize]);

  const engine = useCameraEngine({
    profile,
    facing: settings.facing,
    flashMode: settings.flashMode,
    quality: settings.quality,
    dateStamp: settings.dateStamp,
    saveOriginal: settings.saveOriginal,
    active: hydrated && settings.onboarded,
  });

  const framesLeft = profile.frameLimit === null ? null : frames[cameraId];
  const outOfFilm = framesLeft !== null && framesLeft <= 0;

  const selectCamera = useCallback(
    (id: CameraId, dir: "left" | "right" | null = null) => {
      if (id === cameraId) return;
      soundEngine.unlock();
      soundEngine.play("switch");
      haptics.fire("switch");
      setSwitching(dir);
      setCameraId(id);
      window.setTimeout(() => setSwitching(null), 320);
    },
    [cameraId],
  );

  const step = useCallback(
    (delta: number) => {
      const i = CAMERA_ORDER.indexOf(cameraId);
      const next = CAMERA_ORDER[(i + delta + CAMERA_ORDER.length) % CAMERA_ORDER.length];
      if (next) selectCamera(next, delta > 0 ? "left" : "right");
    },
    [cameraId, selectCamera],
  );

  const fire = useCallback(async () => {
    if (busy || !engine.ready) return;
    soundEngine.unlock();
    if (outOfFilm) {
      haptics.fire("error");
      soundEngine.play("click");
      toast(profile.id === "film35" ? "Roll finished — reload film" : "No exposures left", {
        description: "Reload from the counter below.",
      });
      return;
    }
    setBusy(true);
    const flashFires = engine.shouldFlash();

    try {
      await runCaptureSequence(profile, flashFires, {
        sound: (v, d) => soundEngine.play(v, d),
        haptic: (p) => haptics.fire(p),
        flash: (on) => {
          setFlashing(on);
          engine.setFlashBoost(on ? 0.42 : 0);
        },
        shake: () => {
          setShaking(true);
          window.setTimeout(() => setShaking(false), 440);
        },
        blackout: (on) => {
          setBlackout(on);
          engine.pausePreview(on);
        },
        status: setStatus,
        torch: engine.torch,
          grab: engine.capture,
        advanceFrame: () =>
          setFrames((f) =>
            profile.frameLimit === null
              ? f
              : { ...f, [cameraId]: Math.max(0, (f[cameraId] ?? 0) - 1) },
          ),
        present: (shot) => {
          const id = crypto.randomUUID();
          setResult(shot);
          setResultId(id);
          void saveShot({
            id,
            cameraId,
            createdAt: Date.now(),
            blob: shot.blob,
            ...(shot.original ? { original: shot.original } : {}),
            width: shot.width,
            height: shot.height,
          });
        },
      });
    } catch (err) {
      console.error("capture failed", err);
      toast("Capture failed", { description: "Try again in a moment." });
      setBlackout(false);
      setFlashing(false);
      setStatus(null);
      engine.setFlashBoost(0);
      engine.pausePreview(false);
    }
    setBusy(false);
  }, [busy, cameraId, engine, outOfFilm, profile]);

  const resultUrl = useMemo(() => (result ? URL.createObjectURL(result.blob) : null), [result]);
  useEffect(
    () => () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    },
    [resultUrl],
  );

  const closeResult = () => {
    setResult(null);
    setResultId(null);
  };

  const flashLabel = settings.flashMode.toUpperCase();

  return (
    <main
      className="flex min-h-[100dvh] flex-col bg-background"
      style={{ filter: `brightness(${settings.uiBrightness})` }}
    >
      {/* top rail */}
      <header className="flex items-center justify-between px-5 pt-[max(14px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => {
            haptics.fire("tap");
            soundEngine.play("click");
            const next = FLASH_CYCLE[(FLASH_CYCLE.indexOf(settings.flashMode) + 1) % 3] ?? "auto";
            update({ flashMode: next });
          }}
          className="press label-mono flex items-center gap-2 rounded-[3px] bg-secondary px-3 py-2 text-[10px] active:press-active"
        >
          {settings.flashMode === "off" ? (
            <ZapOff className="h-3.5 w-3.5" />
          ) : (
            <Zap className={cn("h-3.5 w-3.5", settings.flashMode === "on" && "text-primary")} />
          )}
          {flashLabel}
        </button>

        <span className="label-mono text-[10px] text-muted-foreground">
          {status ?? profile.hints[0]}
        </span>

        <div className="flex items-center gap-1.5">
          <IconButton label="Gallery" onClick={() => navigate({ to: "/gallery" })}>
            <Images className="h-4 w-4" />
          </IconButton>
          <IconButton label="Settings" onClick={() => navigate({ to: "/settings" })}>
            <Settings2 className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {/* the camera itself */}
      <section
        className="flex flex-1 flex-col justify-center px-4"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || busy) return;
          const end = e.changedTouches[0];
          if (!end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1);
        }}
      >
        <div
          key={cameraId}
          className={cn(
            "mx-auto w-full max-w-[440px] overflow-hidden rounded-[14px] p-3.5 transition-transform",
            chrome.bodyClass,
            switching === "left" && "animate-rise",
            switching === "right" && "animate-rise",
          )}
        >
          {chrome.top({
            profile,
            framesLeft,
            rollSize: settings.rollSize,
            flashLabel,
            status,
            battery: 0.72,
          })}

          <div className="mt-3">
            <Viewfinder
              profile={profile}
              videoRef={engine.videoRef}
              canvasRef={engine.canvasRef}
              blackout={blackout}
              flashing={flashing}
              shaking={shaking}
              ready={engine.ready}
            />
          </div>

          {chrome.bottom({
            profile,
            framesLeft,
            rollSize: settings.rollSize,
            flashLabel,
            status,
            battery: 0.72,
          })}

          {/* control deck */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex justify-start">
              <IconButton
                label="Flip camera"
                onClick={() => {
                  haptics.fire("tap");
                  soundEngine.play("click");
                  update({ facing: settings.facing === "user" ? "environment" : "user" });
                }}
              >
                <RefreshCcw className="h-4 w-4" />
              </IconButton>
            </div>

            <ShutterButton
              cameraId={cameraId}
              busy={busy}
              disabled={!engine.ready}
              onFire={() => void fire()}
            />

            <div className="flex justify-end">
              {outOfFilm ? (
                <button
                  type="button"
                  onClick={() => {
                    haptics.fire("switch");
                    soundEngine.play(profile.id === "film35" ? "film35-advance" : "switch");
                    setFrames((f) => ({
                      ...f,
                      [cameraId]:
                        profile.id === "film35" ? settings.rollSize : (profile.frameLimit ?? 0),
                    }));
                    toast("Fresh film loaded");
                  }}
                  className="press label-mono rounded-[3px] bg-primary px-3 py-2 text-[10px] text-primary-foreground active:press-active"
                >
                  Reload
                </button>
              ) : (
                <IconButton label="Recent" onClick={() => navigate({ to: "/gallery" })}>
                  <CircleDot className="h-4 w-4" />
                </IconButton>
              )}
            </div>
          </div>
        </div>

        <p className="label-mono mt-4 text-center text-[9px] text-muted-foreground/70">
          Swipe to change camera · {profile.subtitle}
        </p>
      </section>

      <footer className="px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        <CameraSelector active={cameraId} onSelect={(id) => selectCamera(id)} />
      </footer>

      {engine.permission === "denied" && <PermissionNotice />}

      {result && resultUrl && (
        <DevelopingPrint
          profile={profile}
          imageUrl={resultUrl}
          onDone={closeResult}
          onDiscard={() => {
            haptics.fire("tap");
            if (resultId) void import("@/lib/store/gallery").then((m) => m.deleteShot(resultId));
            closeResult();
          }}
          onSave={async () => {
            haptics.fire("press");
            const how = await exportShot(
              result.blob,
              shotFilename({ cameraId, createdAt: Date.now() }),
            );
            toast(how === "saved" ? "Saved to your photos" : "Saved to your device", {
              description: "It's in your shots too.",
            });
            // the print is put away once it's kept — back to shooting
            closeResult();
          }}
          onShare={async () => {
            haptics.fire("press");
            const ok = await shareShot(
              result.blob,
              shotFilename({ cameraId, createdAt: Date.now() }),
            );
            if (!ok) toast("Sharing isn't available here", { description: "Save it instead." });
          }}
        />
      )}
    </main>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="press knob grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground active:press-active"
    >
      {children}
    </button>
  );
}

function PermissionNotice() {
  return (
    <div className="fixed inset-x-0 bottom-24 mx-auto max-w-[380px] rounded-[4px] border border-border bg-card px-4 py-3">
      <p className="label-mono text-[10px] text-primary">Camera blocked</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Allow camera access in your browser or system settings, then reopen this screen.
      </p>
    </div>
  );
}
