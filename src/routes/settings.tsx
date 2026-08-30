import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { CAMERA_ORDER, CAMERA_PROFILES } from "@/lib/cameras/profiles";
import { useSettings } from "@/lib/store/settings";
import { soundEngine } from "@/lib/audio/soundEngine";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Vintage Camera" },
      {
        name: "description",
        content:
          "Choose your default camera, flash behaviour, image quality, date stamp, shutter sounds and haptics.",
      },
      { property: "og:title", content: "Settings — Vintage Camera" },
      {
        property: "og:description",
        content: "Tune the cameras: flash, quality, date stamp, sound effects and haptics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();

  const tap = () => {
    haptics.fire("tap");
    soundEngine.play("click");
  };

  return (
    <main className="min-h-[100dvh] bg-background pb-[max(28px,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-4">
        <button
          type="button"
          aria-label="Back to camera"
          onClick={() => {
            tap();
            void navigate({ to: "/" });
          }}
          className="press knob grid h-9 w-9 place-items-center rounded-full bg-secondary active:press-active"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="label-display text-[15px]">Settings</h1>
      </header>

      <div className="space-y-7 px-5">
        <Section title="Camera">
          <Segmented
            label="Default camera"
            value={settings.defaultCamera}
            options={CAMERA_ORDER.map((id) => ({ value: id, label: CAMERA_PROFILES[id].name }))}
            onChange={(v) => {
              tap();
              update({ defaultCamera: v });
            }}
          />
          <Segmented
            label="Flash behaviour"
            value={settings.flashMode}
            options={[
              { value: "off", label: "Off" },
              { value: "auto", label: "Auto" },
              { value: "on", label: "On" },
            ]}
            onChange={(v) => {
              tap();
              update({ flashMode: v });
            }}
          />
          <Segmented
            label="Lens"
            value={settings.facing}
            options={[
              { value: "environment", label: "Rear" },
              { value: "user", label: "Front" },
            ]}
            onChange={(v) => {
              tap();
              update({ facing: v });
            }}
          />
          <Segmented
            label="35mm roll"
            value={String(settings.rollSize)}
            options={[
              { value: "24", label: "24 exp" },
              { value: "36", label: "36 exp" },
            ]}
            onChange={(v) => {
              tap();
              update({ rollSize: Number(v) });
            }}
          />
        </Section>

        <Section title="Photo">
          <Segmented
            label="Image quality"
            value={settings.quality}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high", label: "High" },
            ]}
            onChange={(v) => {
              tap();
              update({ quality: v });
            }}
          />
          <Toggle
            label="Save original"
            hint="Keep the unprocessed sensor frame alongside the photograph"
            value={settings.saveOriginal}
            onChange={(v) => {
              tap();
              update({ saveOriginal: v });
            }}
          />
          <Toggle
            label="Date stamp"
            hint="35mm, disposable and CCD only"
            value={settings.dateStamp}
            onChange={(v) => {
              tap();
              update({ dateStamp: v });
            }}
          />
        </Section>

        <Section title="Sound">
          <Toggle
            label="Sound effects"
            value={settings.sound}
            onChange={(v) => {
              haptics.fire("tap");
              update({ sound: v });
            }}
          />
          <Toggle
            label="Shutter sounds"
            value={settings.shutterSound}
            onChange={(v) => {
              tap();
              update({ shutterSound: v });
            }}
          />
        </Section>

        <Section title="Haptics">
          <Toggle
            label="Haptic feedback"
            value={settings.haptics}
            onChange={(v) => {
              haptics.configure(v);
              haptics.fire("tap");
              update({ haptics: v });
            }}
          />
        </Section>

        <Section title="Appearance">
          <div className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">UI brightness</span>
              <span className="label-mono text-[10px] text-muted-foreground">
                {Math.round(settings.uiBrightness * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1}
              step={0.05}
              value={settings.uiBrightness}
              onChange={(e) => update({ uiBrightness: Number(e.target.value) })}
              className="mt-3 w-full accent-[var(--color-primary)]"
            />
          </div>
        </Section>

        <Section title="About">
          <Row label="Version" value="1.0.0" />
          <Row label="Privacy" value="Photos never leave your device" />
          <Row label="Terms" value="Personal use" />
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="label-mono text-[10px] text-primary">{title}</h2>
      <div className="mt-2 divide-y divide-border rounded-[4px] border border-border bg-card px-4">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <span className="label-mono text-[10px] text-muted-foreground">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          value ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "knob absolute top-[3px] h-[18px] w-[18px] rounded-full bg-chrome transition-transform",
            value ? "translate-x-[26px]" : "translate-x-[3px]",
          )}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <span className="block text-sm">{label}</span>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "press label-mono shrink-0 rounded-[3px] px-3 py-2 text-[10px] active:press-active",
              o.value === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
