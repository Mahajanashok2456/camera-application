import type { RefObject } from "react";
import type { CameraProfile } from "@/lib/cameras/profiles";
import { cn } from "@/lib/utils";

interface Props {
  profile: CameraProfile;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  blackout: boolean;
  flashing: boolean;
  shaking: boolean;
  ready: boolean;
  className?: string;
}

/**
 * The live preview. The <video> element is never shown — it only feeds the GPU
 * pipeline, so what the user frames is already the camera's rendering.
 */
export function Viewfinder({
  profile,
  videoRef,
  canvasRef,
  blackout,
  flashing,
  shaking,
  ready,
  className,
}: Props) {
  const isCcd = profile.id === "ccd";
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-body-low",
        isCcd ? "rounded-[2px]" : "rounded-[3px]",
        shaking && "animate-shake",
        className,
      )}
      style={{ aspectRatio: String(profile.aspectRatio) }}
    >
      <video ref={videoRef} className="pointer-events-none absolute h-px w-px opacity-0" />
      <canvas ref={canvasRef} className="h-full w-full object-cover" />

      {/* glass / screen character */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isCcd
            ? "bg-[linear-gradient(180deg,oklch(1_0_0/0.05),transparent_28%)]"
            : "bg-[radial-gradient(120%_90%_at_50%_0%,oklch(1_0_0/0.06),transparent_55%)]",
        )}
      />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-body-low">
          <span className="label-mono animate-blink text-muted-foreground">Opening lens…</span>
        </div>
      )}

      {blackout && <div className="absolute inset-0 bg-body-low" />}
      {flashing && (
        <div className="animate-flash pointer-events-none absolute inset-0 bg-paper mix-blend-screen" />
      )}
    </div>
  );
}
