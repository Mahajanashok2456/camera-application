import type { ReactNode } from "react";
import type { CameraId, CameraProfile } from "@/lib/cameras/profiles";
import { cn } from "@/lib/utils";

export interface ChromeState {
  profile: CameraProfile;
  framesLeft: number | null;
  rollSize: number | null;
  flashLabel: string;
  status: string | null;
  battery: number;
}

/** Small mechanical counter with a rolling tick animation. */
function Counter({ value, tone = "lcd" }: { value: string; tone?: "lcd" | "dial" }) {
  return (
    <span
      key={value}
      className={cn(
        "animate-tick inline-block font-mono tabular-nums",
        tone === "lcd" ? "text-primary" : "text-foreground",
      )}
    >
      {value}
    </span>
  );
}

function StatusDot({ label, on }: { label: string; on?: boolean }) {
  return (
    <span className="label-mono flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          on ? "animate-blink bg-primary shadow-[var(--shadow-glow)]" : "bg-border",
        )}
      />
      {label}
    </span>
  );
}

/* ---------- per-camera body identity ------------------------------------- */

interface Chrome {
  /** Classes for the camera body panel. */
  bodyClass: string;
  /** Chrome above the viewfinder. */
  top: (s: ChromeState) => ReactNode;
  /** Chrome below the viewfinder, above the controls. */
  bottom: (s: ChromeState) => ReactNode;
}

export const CAMERA_CHROME: Record<CameraId, Chrome> = {
  polaroid: {
    bodyClass: "surface-body border-t border-body-high/60",
    top: (s) => (
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="label-display text-[15px] text-polaroid">Polaroid</div>
          <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">{s.profile.filmType}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot label={s.flashLabel} on={s.flashLabel !== "OFF"} />
          <div className="text-right">
            <div className="label-mono text-[9px] text-muted-foreground">PACK</div>
            <div className="text-[19px] leading-none">
              <Counter value={String(s.framesLeft ?? 0).padStart(2, "0")} tone="dial" />
              <span className="ml-0.5 font-mono text-[11px] text-muted-foreground">/08</span>
            </div>
          </div>
        </div>
      </div>
    ),
    bottom: () => (
      <div className="surface-leather mt-3 h-4 rounded-[2px] border border-body-low/70 shadow-[0_1px_0_0_oklch(1_0_0/0.05)_inset]" />
    ),
  },

  film35: {
    bodyClass: "surface-leather border-t border-body-high/40",
    top: (s) => (
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="label-display text-[15px] text-film35">35mm</div>
          <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">{s.profile.filmType}</div>
        </div>
        <div className="flex items-end gap-3">
          <StatusDot label={s.flashLabel} on={s.flashLabel !== "OFF"} />
          <div className="knob rounded-[3px] bg-body-low px-2 py-1 text-right">
            <div className="text-[20px] leading-none">
              <Counter value={String(s.framesLeft ?? 0)} tone="dial" />
              <span className="font-mono text-[11px] text-muted-foreground">
                /{s.rollSize ?? 36}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    bottom: () => (
      <div className="mt-3 flex items-center gap-1.5 px-1">
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} className="h-2 w-2 rounded-[1px] bg-body-low/90 shadow-[0_1px_0_0_oklch(1_0_0/0.06)]" />
        ))}
      </div>
    ),
  },

  disposable: {
    bodyClass:
      "border-t border-body-high/30 bg-[linear-gradient(175deg,var(--color-body-high),var(--color-body)_30%,var(--color-body-low))]",
    top: (s) => (
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="label-display text-[15px] text-disposable">Disposable</div>
          <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">SINGLE USE · ISO 400</div>
        </div>
        <div className="flex items-end gap-3">
          <StatusDot label={s.flashLabel} on={s.flashLabel !== "OFF"} />
          <div className="grid h-9 w-9 place-items-center rounded-full border border-body-high/60 bg-body-low">
            <span className="text-[17px] leading-none">
              <Counter value={String(s.framesLeft ?? 0)} tone="dial" />
            </span>
          </div>
        </div>
      </div>
    ),
    bottom: (s) => (
      <div className="label-mono mt-3 flex items-center justify-between px-1 text-[9px] text-muted-foreground">
        <span>{s.status ?? "PRESS FIRMLY · USE FLASH"}</span>
        <span>27 EXP</span>
      </div>
    ),
  },

  ccd: {
    bodyClass: "surface-body border-t border-body-high/60",
    top: (s) => (
      <div className="flex items-center justify-between rounded-[3px] border border-body-high/40 bg-body-low px-2.5 py-1.5">
        <div className="flex items-center gap-3">
          <span className="label-mono text-[10px] text-ccd">CCD 3.2M</span>
          <span className="label-mono text-[10px] text-muted-foreground">FINE</span>
          <span className="label-mono text-[10px] text-primary">{s.flashLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="label-mono text-[10px] text-muted-foreground">
            <Counter value={s.status ?? "READY"} />
          </span>
          <span className="flex h-3 w-6 items-center rounded-[1px] border border-muted-foreground/70 p-[1.5px]">
            <span
              className="h-full rounded-[1px] bg-primary"
              style={{ width: `${Math.round(s.battery * 100)}%` }}
            />
          </span>
        </div>
      </div>
    ),
    bottom: () => (
      <div className="mt-3 flex items-center justify-between px-1">
        <span className="label-mono text-[9px] text-muted-foreground">SD 128MB</span>
        <span className="label-mono text-[9px] text-muted-foreground">AUTO · F2.8 1/60</span>
      </div>
    ),
  },
};
