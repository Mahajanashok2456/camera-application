import { useEffect, useRef, useState } from "react";
import { Download, Share2, Trash2 } from "lucide-react";
import type { CameraProfile } from "@/lib/cameras/profiles";
import { cn } from "@/lib/utils";

interface Props {
  profile: CameraProfile;
  imageUrl: string;
  onSave: () => void;
  onShare: () => void;
  onDiscard: () => void;
  onDone: () => void;
}

/** 40 real seconds, compressed to something usable but never snappy. */
const DEVELOP_MS = 7600;

/**
 * The physical artefact each camera produces.
 * Polaroid: a print rolls out of the camera and develops in your hand.
 * 35mm / Disposable: a lab print lands on the table.
 * CCD: an LCD review screen.
 */
export function DevelopingPrint({ profile, imageUrl, onSave, onShare, onDiscard, onDone }: Props) {
  const [t, setT] = useState(profile.id === "polaroid" ? 0 : 1);
  const raf = useRef(0);

  useEffect(() => {
    if (profile.id !== "polaroid") return;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / DEVELOP_MS);
      // ease so the image emerges slowly, then resolves
      setT(p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [profile.id]);

  const developing = t < 0.999;
  const isPolaroid = profile.id === "polaroid";
  const isCcd = profile.id === "ccd";

  // emulsion coming up: dye density, contrast and sharpness all arrive late
  const imgStyle = isPolaroid
    ? {
        opacity: Math.pow(t, 1.35),
        filter: `saturate(${(0.1 + t * 0.95).toFixed(3)}) contrast(${(0.55 + t * 0.5).toFixed(
          3,
        )}) brightness(${(1.28 - t * 0.28).toFixed(3)}) blur(${((1 - t) * 5).toFixed(2)}px)`,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-body-low/94 px-6 backdrop-blur-md">
      <div
        className={cn(
          "relative w-full max-w-[330px]",
          isPolaroid ? "animate-eject" : "animate-rise",
        )}
        style={{ animationDuration: isPolaroid ? "1500ms" : undefined }}
      >
        <div
          className={cn(
            "relative overflow-hidden",
            isCcd
              ? "rounded-[4px] border-[10px] border-body bg-body-low shadow-[var(--shadow-print)]"
              : isPolaroid
                ? "rounded-[3px] shadow-[var(--shadow-print)]"
                : "grain-paper rounded-[2px] bg-paper p-2.5 shadow-[var(--shadow-print)]",
          )}
        >
          <img
            src={imageUrl}
            alt={`Photo taken with the ${profile.name} camera`}
            className="block w-full"
            style={imgStyle}
          />
          {isPolaroid && developing && (
            <>
              {/* undeveloped emulsion */}
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,oklch(0.86_0.02_120),oklch(0.72_0.03_150))]"
                style={{ opacity: Math.max(0, 1 - t * 1.18) }}
              />
              {/* chemical sweep */}
              <div
                className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                style={{
                  opacity: Math.max(0, 0.55 - t * 0.55),
                  backgroundImage:
                    "linear-gradient(200deg, oklch(0.9 0.06 95) 0%, transparent 45%, oklch(0.5 0.05 250) 100%)",
                }}
              />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PrintAction icon={<Trash2 className="h-4 w-4" />} label="Discard" onClick={onDiscard} />
        <PrintAction
          icon={<Download className="h-4 w-4" />}
          label="Save"
          primary
          onClick={onSave}
        />
        <PrintAction icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} />
      </div>

      <button type="button" onClick={onDone} className="label-mono text-[10px] text-muted-foreground">
        {developing && isPolaroid ? "Developing…" : "Back to camera"}
      </button>
    </div>
  );
}

function PrintAction({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press knob label-mono flex items-center gap-2 rounded-[3px] px-4 py-2.5 text-[10px] active:press-active",
        primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
