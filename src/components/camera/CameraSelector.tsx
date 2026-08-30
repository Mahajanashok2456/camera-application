import { CAMERA_ORDER, CAMERA_PROFILES, type CameraId } from "@/lib/cameras/profiles";
import { cn } from "@/lib/utils";

interface Props {
  active: CameraId;
  onSelect: (id: CameraId) => void;
}

/** Body-badge strip: the camera you're holding, plus the ones in the bag. */
export function CameraSelector({ active, onSelect }: Props) {
  return (
    <div className="flex items-center justify-center gap-1">
      {CAMERA_ORDER.map((id) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "press label-display relative rounded-[3px] px-3 py-2 text-[11px] transition-colors active:press-active",
              isActive ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {CAMERA_PROFILES[id].name}
            <span
              className={cn(
                "absolute inset-x-2 -bottom-0.5 h-[2px] rounded-full transition-all",
                isActive ? "opacity-100" : "opacity-0",
              )}
              style={{ backgroundColor: `var(--color-${CAMERA_PROFILES[id].accent})` }}
            />
          </button>
        );
      })}
    </div>
  );
}
