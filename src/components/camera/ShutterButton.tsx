import { useRef, useState } from "react";
import type { CameraId } from "@/lib/cameras/profiles";
import { cn } from "@/lib/utils";

interface Props {
  cameraId: CameraId;
  disabled?: boolean;
  busy?: boolean;
  onFire: () => void;
}

/**
 * A physical button: it depresses, it has a travel, and it releases before the
 * shutter fires — each camera's release is shaped differently.
 *
 * Press state lives in a ref as well as state: the button remounts when the
 * camera body changes, and a state-only latch would swallow the release.
 */
export function ShutterButton({ cameraId, disabled, busy, onFire }: Props) {
  const [down, setDown] = useState(false);
  const downRef = useRef(false);

  const setPressed = (v: boolean) => {
    downRef.current = v;
    setDown(v);
  };

  const press = () => {
    if (disabled || busy) return;
    setPressed(true);
  };
  const release = () => {
    const wasDown = downRef.current;
    setPressed(false);
    if (!wasDown || disabled || busy) return;
    onFire();
  };

  const shell: Record<CameraId, string> = {
    polaroid: "h-[78px] w-[78px] rounded-full bg-polaroid",
    film35: "h-[70px] w-[70px] rounded-full bg-chrome",
    disposable: "h-[66px] w-[92px] rounded-[10px] bg-disposable",
    ccd: "h-[62px] w-[62px] rounded-full bg-secondary-foreground",
  };

  return (
    <button
      type="button"
      aria-label="Shutter"
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className="relative grid place-items-center rounded-full p-[7px] disabled:opacity-40"
      style={{ touchAction: "manipulation" }}
    >
      {/* collar */}
      <span className="knob absolute inset-0 rounded-full bg-body" />
      <span
        className={cn(
          "press knob relative grid place-items-center",
          shell[cameraId],
          down && "press-active",
          busy && "opacity-70",
        )}
      >
        <span
          className={cn(
            "absolute inset-[6px] rounded-[inherit] bg-[radial-gradient(70%_60%_at_50%_22%,oklch(1_0_0/0.4),transparent_70%)]",
            down && "opacity-30",
          )}
        />
        {cameraId === "ccd" && (
          <span className="label-mono relative text-[9px] text-body-low">REC</span>
        )}
      </span>
    </button>
  );
}
