import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteShot,
  exportShot,
  listShots,
  shareShot,
  shotFilename,
  type Shot,
} from "@/lib/store/gallery";
import { CAMERA_PROFILES } from "@/lib/cameras/profiles";
import { haptics } from "@/lib/haptics";
import { soundEngine } from "@/lib/audio/soundEngine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Your Shots — Vintage Camera Gallery" },
      {
        name: "description",
        content:
          "Every frame you shot, kept on your device: instant prints, 35mm negatives, disposable snaps and CCD stills.",
      },
      { property: "og:title", content: "Your Shots — Vintage Camera Gallery" },
      {
        property: "og:description",
        content: "Browse, save and share the photographs your virtual cameras produced.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Gallery,
});

function Gallery() {
  const navigate = useNavigate();
  const [shots, setShots] = useState<Shot[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listShots()
      .then(setShots)
      .finally(() => setLoading(false));
  }, []);

  const urls = useMemo(() => {
    const map = new Map<string, string>();
    shots.forEach((s) => map.set(s.id, URL.createObjectURL(s.blob)));
    return map;
  }, [shots]);

  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const open = shots.find((s) => s.id === openId) ?? null;

  const remove = async (shot: Shot) => {
    haptics.fire("tap");
    await deleteShot(shot.id);
    setShots((prev) => prev.filter((s) => s.id !== shot.id));
    setOpenId(null);
    toast("Photo deleted");
  };

  return (
    <main className="min-h-[100dvh] bg-background pb-[max(24px,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-4">
        <button
          type="button"
          aria-label="Back to camera"
          onClick={() => {
            soundEngine.play("click");
            void navigate({ to: "/" });
          }}
          className="press knob grid h-9 w-9 place-items-center rounded-full bg-secondary active:press-active"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="label-display text-[15px]">Shots</h1>
        <span className="label-mono ml-auto text-[10px] text-muted-foreground">
          {shots.length} frame{shots.length === 1 ? "" : "s"}
        </span>
      </header>

      {loading ? (
        <p className="label-mono px-5 text-[10px] text-muted-foreground">Loading…</p>
      ) : shots.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <p className="label-display text-[14px] text-muted-foreground">Nothing developed yet</p>
          <p className="mx-auto mt-2 max-w-[24em] text-sm text-muted-foreground/80">
            Head back to the camera and press the shutter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3 px-4">
          {shots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => {
                haptics.fire("tap");
                setOpenId(shot.id);
              }}
              className={cn(
                "press overflow-hidden rounded-[3px] bg-card shadow-[var(--shadow-print)] active:press-active",
              )}
            >
              <img
                src={urls.get(shot.id)}
                alt={`${CAMERA_PROFILES[shot.cameraId].name} photograph`}
                className="block w-full"
                loading="lazy"
              />
              <span className="label-mono flex items-center justify-between px-2 py-1.5 text-[8px] text-muted-foreground">
                {CAMERA_PROFILES[shot.cameraId].name}
                <span>{new Date(shot.createdAt).toLocaleDateString()}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-body-low/95 px-5 backdrop-blur-md">
          <img
            src={urls.get(open.id)}
            alt={`${CAMERA_PROFILES[open.cameraId].name} photograph, full size`}
            className="animate-rise max-h-[62vh] w-auto max-w-full rounded-[3px] shadow-[var(--shadow-print)]"
          />
          <div className="label-mono text-[10px] text-muted-foreground">
            {CAMERA_PROFILES[open.cameraId].name} · {open.width}×{open.height}
          </div>
          <div className="flex items-center gap-3">
            <Action
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete"
              onClick={() => void remove(open)}
            />
            <Action
              primary
              icon={<Download className="h-4 w-4" />}
              label="Save"
              onClick={async () => {
                haptics.fire("press");
                const how = await exportShot(open.blob, shotFilename(open));
                toast(how === "saved" ? "Saved to your photos" : "Saved to your device");
              }}
            />
            <Action
              icon={<Share2 className="h-4 w-4" />}
              label="Share"
              onClick={async () => {
                haptics.fire("press");
                const ok = await shareShot(open.blob, shotFilename(open));
                if (!ok) toast("Sharing isn't available here", { description: "Save it instead." });
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="label-mono text-[10px] text-muted-foreground"
          >
            Close
          </button>
        </div>
      )}
    </main>
  );
}

function Action({
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
