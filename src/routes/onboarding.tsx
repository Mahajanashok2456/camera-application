import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CAMERA_ORDER, CAMERA_PROFILES, type CameraId } from "@/lib/cameras/profiles";
import { useSettings } from "@/lib/store/settings";
import { soundEngine } from "@/lib/audio/soundEngine";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Pick Your First Camera — Vintage Camera" },
      {
        name: "description",
        content:
          "Turn your phone into a camera from another era. Choose instant film, 35mm, disposable or early digital and start shooting.",
      },
      { property: "og:title", content: "Pick Your First Camera — Vintage Camera" },
      {
        property: "og:description",
        content: "Two taps to start shooting on instant film, 35mm, disposable or CCD digital.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<CameraId>("polaroid");

  const enter = () => {
    soundEngine.unlock();
    soundEngine.play("switch");
    haptics.fire("switch");
    update({ onboarded: true, defaultCamera: picked });
    void navigate({ to: "/" });
  };

  return (
    <main className="flex min-h-[100dvh] flex-col justify-between px-7 py-[max(28px,env(safe-area-inset-top))]">
      {step === 0 ? (
        <>
          <div className="flex flex-1 flex-col justify-center">
            <p className="label-mono text-[10px] text-primary">Vintage Camera</p>
            <h1 className="animate-rise mt-5 max-w-[9em] font-display text-[42px] leading-[0.95] uppercase tracking-[0.04em]">
              Turn your phone into a camera from another era.
            </h1>
            <p className="mt-5 max-w-[26em] text-sm text-muted-foreground">
              Real shutters, real film response, real limitations. Photographs stay on your device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.unlock();
              haptics.fire("tap");
              soundEngine.play("click");
              setStep(1);
            }}
            className="press knob label-display w-full rounded-[4px] bg-primary py-4 text-[14px] text-primary-foreground active:press-active"
          >
            Begin
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col justify-center">
            <p className="label-mono text-[10px] text-primary">Step 2 of 2</p>
            <h1 className="mt-4 font-display text-[34px] uppercase tracking-[0.06em]">
              Select your first camera
            </h1>
            <div className="mt-7 space-y-2.5">
              {CAMERA_ORDER.map((id) => {
                const p = CAMERA_PROFILES[id];
                const active = picked === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      haptics.fire("tap");
                      soundEngine.play("click");
                      setPicked(id);
                    }}
                    className={cn(
                      "press flex w-full items-center justify-between rounded-[4px] border px-4 py-3.5 text-left active:press-active",
                      active ? "border-primary bg-secondary" : "border-border bg-card",
                    )}
                  >
                    <span>
                      <span className="label-display block text-[15px]">{p.name}</span>
                      <span className="label-mono mt-1 block text-[9px] text-muted-foreground">
                        {p.filmType}
                      </span>
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: active ? `var(--color-${p.accent})` : "var(--color-border)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={enter}
            className="press knob label-display mt-6 w-full rounded-[4px] bg-primary py-4 text-[14px] text-primary-foreground active:press-active"
          >
            Start shooting
          </button>
        </>
      )}
    </main>
  );
}
