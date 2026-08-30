/**
 * CAPTURE — grabs a full-resolution frame, runs the high-quality GPU pass, then
 * composites the physical artefact for that camera (instant-film frame, date
 * stamp, print border) on a 2D canvas.
 */

import {
  formatDateStamp,
  type CameraProfile,
  type DateStampStyle,
} from "../cameras/profiles";
import { getCapturePipeline } from "./pipeline";

export interface CaptureRequest {
  video: HTMLVideoElement;
  profile: CameraProfile;
  mirror: boolean;
  dateStamp: boolean;
  quality: "standard" | "high";
  flashFired: boolean;
  saveOriginal: boolean;
}

export interface CaptureResult {
  blob: Blob;
  original?: Blob | undefined;
  width: number;
  height: number;
  /** Bare processed frame (no instant-film border) for gallery cropping. */
  frameUrl: string;
}

const POLAROID = {
  side: 0.077, // border as a fraction of print width
  top: 0.077,
  bottom: 0.215,
};

export async function captureFrame(req: CaptureRequest): Promise<CaptureResult> {
  const { video, profile } = req;
  const scale = req.quality === "high" ? 1 : 0.7;
  const longEdge = Math.round(profile.captureLongEdge * scale);
  const ar = profile.aspectRatio;
  const w = ar >= 1 ? longEdge : Math.round(longEdge * ar);
  const h = ar >= 1 ? Math.round(longEdge / ar) : longEdge;

  // 1. sensor frame at native resolution
  const raw = document.createElement("canvas");
  raw.width = video.videoWidth;
  raw.height = video.videoHeight;
  raw.getContext("2d")!.drawImage(video, 0, 0);

  // 2. high-quality GPU pass
  const pipe = getCapturePipeline();
  pipe.resize(w, h);
  pipe.render(raw, {
    profile: profile.render,
    aspectRatio: ar,
    mirror: req.mirror,
    quality: 1,
    seed: Math.random() * 100,
    flashBoost: req.flashFired ? 0.06 : 0,
  });

  const framed = document.createElement("canvas");
  const fctx = framed.getContext("2d")!;

  if (profile.id === "polaroid") {
    const printW = Math.round(w / (1 - POLAROID.side * 2));
    const bs = Math.round(printW * POLAROID.side);
    const bb = Math.round(printW * POLAROID.bottom);
    framed.width = printW;
    framed.height = h + bs + bb;
    paintInstantPaper(fctx, framed.width, framed.height);
    fctx.save();
    fctx.shadowColor = "rgba(0,0,0,0.35)";
    fctx.shadowBlur = printW * 0.012;
    fctx.shadowOffsetY = printW * 0.004;
    fctx.drawImage(pipe.canvas, bs, bs, w, h);
    fctx.restore();
    paintEmulsionEdge(fctx, bs, bs, w, h);
  } else {
    framed.width = w;
    framed.height = h;
    fctx.drawImage(pipe.canvas, 0, 0);
  }

  if (req.dateStamp && profile.dateStampStyle !== "none") {
    drawDateStamp(fctx, profile.dateStampStyle, framed.width, framed.height, profile.id === "polaroid");
  }

  const blob = await toBlob(framed, 0.94);
  const frameUrl = URL.createObjectURL(await toBlob(pipe.canvas, 0.92));
  const original = req.saveOriginal ? await toBlob(raw, 0.95) : undefined;

  return { blob, original, width: framed.width, height: framed.height, frameUrl };
}

/* ---------- instant-film artefacts --------------------------------------- */

function paintInstantPaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#fdfcf8");
  g.addColorStop(0.55, "#f7f5ee");
  g.addColorStop(1, "#efece2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // paper fibre / speckle
  const dots = Math.round((w * h) / 2600);
  for (let i = 0; i < dots; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * 0.045;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 1.4})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  // uneven ageing at the corners
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(120,104,74,0.1)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** Slight emulsion bleed where the image meets the border. */
function paintEmulsionEdge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const edge = ctx.createLinearGradient(x, y, x, y + h);
  edge.addColorStop(0, "rgba(190,180,160,0.35)");
  edge.addColorStop(0.045, "rgba(255,255,255,0)");
  edge.addColorStop(0.955, "rgba(255,255,255,0)");
  edge.addColorStop(1, "rgba(190,180,160,0.28)");
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.09)";
  ctx.lineWidth = Math.max(1, w * 0.0015);
  ctx.strokeRect(x, y, w, h);
}

function drawDateStamp(
  ctx: CanvasRenderingContext2D,
  style: DateStampStyle,
  w: number,
  h: number,
  inset: boolean,
) {
  const text = formatDateStamp(style);
  if (!text) return;
  const size = Math.round(w * (style === "orange-lcd" ? 0.045 : 0.04));
  const pad = Math.round(w * 0.045) + (inset ? Math.round(w * 0.04) : 0);
  ctx.save();
  ctx.font = `600 ${size}px "DM Mono", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(255,138,24,0.85)";
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = style === "slash" ? "rgba(255,168,60,0.86)" : "rgba(255,142,26,0.92)";
  ctx.fillText(text, w - pad, h - pad);
  ctx.restore();
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", quality);
  });
}
