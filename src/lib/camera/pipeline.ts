/**
 * GPU IMAGE PIPELINE
 * -----------------------------------------------------------------------------
 * One WebGL program, driven entirely by a RenderProfile. Used for both the live
 * preview (low-res, every frame) and the final capture (full-res, single pass
 * with higher-quality settings). No per-camera shader forks — the look comes
 * from the profile data, which keeps the four cameras genuinely different
 * without duplicating code.
 */

import type { RenderProfile } from "../cameras/profiles";

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;

uniform sampler2D u_tex;
uniform vec2 u_texel;        // 1 / source-sample size
uniform vec2 u_uvScale;
uniform vec2 u_uvOffset;
uniform float u_mirror;

uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform vec3  u_lift;
uniform vec3  u_gain;
uniform float u_gamma;
uniform float u_rolloff;
uniform float u_crush;
uniform float u_fade;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_grainChroma;
uniform float u_vignette;
uniform float u_vigSoft;
uniform float u_ca;
uniform float u_soft;
uniform float u_sharpen;
uniform float u_bloom;
uniform float u_halation;
uniform float u_posterize;
uniform float u_seed;
uniform float u_quality;     // 0 preview .. 1 capture

vec2 srcUv(vec2 uv) {
  vec2 p = uv;
  p.x = mix(p.x, 1.0 - p.x, u_mirror);
  return p * u_uvScale + u_uvOffset;
}

vec3 tex(vec2 uv) {
  return texture2D(u_tex, clamp(srcUv(uv), vec2(0.0005), vec2(0.9995))).rgb;
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash(vec2 p) {
  p = fract(p * vec2(413.897, 653.453));
  p += dot(p, p + 47.32);
  return fract(p.x * p.y * 95.4307);
}

void main() {
  vec2 uv = v_uv;
  vec2 c = uv - 0.5;
  float r = length(c);

  // --- optics: radial chromatic aberration ------------------------------
  vec3 col;
  if (u_ca > 0.0001) {
    float k = u_ca * (0.35 + r * r * 2.2);
    col.r = tex(uv + c * k).r;
    col.g = tex(uv).g;
    col.b = tex(uv - c * k).b;
  } else {
    col = tex(uv);
  }

  // --- lens softness (edge-weighted, cheap ring blur) -------------------
  if (u_soft > 0.001) {
    float amt = u_soft * (0.35 + r * 1.5);
    vec2 t = u_texel * (1.4 + u_soft * 2.0);
    vec3 blur = tex(uv + vec2(t.x, 0.0)) + tex(uv - vec2(t.x, 0.0))
              + tex(uv + vec2(0.0, t.y)) + tex(uv - vec2(0.0, t.y))
              + tex(uv + t) + tex(uv - t)
              + tex(uv + vec2(t.x, -t.y)) + tex(uv + vec2(-t.x, t.y));
    col = mix(col, blur * 0.125, clamp(amt, 0.0, 0.85));
  }

  // --- unsharp mask (early-digital crispness) ---------------------------
  if (u_sharpen > 0.001) {
    vec2 t = u_texel * 1.15;
    vec3 soft = (tex(uv + vec2(t.x, 0.0)) + tex(uv - vec2(t.x, 0.0))
               + tex(uv + vec2(0.0, t.y)) + tex(uv - vec2(0.0, t.y))) * 0.25;
    col += (col - soft) * u_sharpen * 1.6;
  }

  // --- bloom + halation from a wide bright-pass ------------------------
  if (u_bloom > 0.001 || u_halation > 0.001) {
    vec2 t = u_texel * (7.0 + u_quality * 9.0);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853981;
      vec2 o = vec2(cos(a), sin(a)) * t;
      vec3 s = tex(uv + o);
      acc += max(s - 0.68, 0.0);
    }
    acc *= 0.125;
    col += acc * u_bloom * 2.1;
    col += vec3(acc.r * 1.0, acc.g * 0.32, acc.b * 0.14) * u_halation * 2.6;
  }

  // --- tone: exposure, film base, colour response ----------------------
  col *= exp2(u_exposure * 1.6);
  col = u_lift + col * (u_gain - u_lift);
  col = pow(max(col, 0.0), vec3(u_gamma));

  // white balance
  col.r *= 1.0 + u_temperature * 0.16 + u_tint * 0.05;
  col.g *= 1.0 - u_tint * 0.09;
  col.b *= 1.0 - u_temperature * 0.16 + u_tint * 0.04;

  // highlight roll-off: film shoulder vs. digital clip
  vec3 shoulder = col / (1.0 + max(col - 0.78, 0.0) * 1.9);
  col = mix(min(col, 1.0), shoulder, u_rolloff);

  // shadow behaviour
  col = mix(col, max(col - 0.035, 0.0) * 1.05, u_crush);

  // contrast around film pivot
  col = (col - 0.5) * u_contrast + 0.5;

  // saturation
  float l = luma(col);
  col = mix(vec3(l), col, u_saturation);

  // faded print / dye loss
  col = mix(col, mix(vec3(l), vec3(0.5, 0.49, 0.47), 0.4), u_fade * 0.35);

  if (u_posterize > 0.001) {
    float steps = mix(255.0, 46.0, u_posterize);
    col = floor(col * steps + 0.5) / steps;
  }

  // --- grain: luma-weighted, part mono / part chroma --------------------
  if (u_grain > 0.0005) {
    vec2 gp = floor(uv / (u_texel * u_grainSize * 1.6)) + u_seed;
    float n = hash(gp) - 0.5;
    float nr = hash(gp + 11.13) - 0.5;
    float nb = hash(gp + 27.71) - 0.5;
    float weight = u_grain * (0.55 + (1.0 - abs(luma(col) - 0.42) * 1.5) * 0.6);
    col += n * weight * (1.0 - u_grainChroma);
    col += vec3(nr, n, nb) * weight * u_grainChroma;
  }

  // --- vignette ---------------------------------------------------------
  float vig = smoothstep(0.85, mix(0.28, 0.05, u_vigSoft), r);
  col *= mix(1.0, vig, u_vignette);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

type Src = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | HTMLImageElement;

export interface RenderOptions {
  profile: RenderProfile;
  /** width / height of the output frame; source is centre-cropped to match. */
  aspectRatio: number;
  mirror?: boolean;
  seed?: number;
  /** 0 = live preview, 1 = final capture. */
  quality?: number;
  /** Extra exposure boost while the flash fires. */
  flashBoost?: number;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

export class CameraPipeline {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private u: Record<string, WebGLUniformLocation | null> = {};

  private L(name: string): WebGLUniformLocation | null {
    return this.u[name] ?? null;
  }
  private disposed = false;

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement("canvas");
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;

    this.program = gl.createProgram()!;
    gl.attachShader(this.program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(this.program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.program) ?? "link failed");
    }
    gl.useProgram(this.program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    for (const name of [
      "u_tex",
      "u_texel",
      "u_uvScale",
      "u_uvOffset",
      "u_mirror",
      "u_exposure",
      "u_contrast",
      "u_saturation",
      "u_temperature",
      "u_tint",
      "u_lift",
      "u_gain",
      "u_gamma",
      "u_rolloff",
      "u_crush",
      "u_fade",
      "u_grain",
      "u_grainSize",
      "u_grainChroma",
      "u_vignette",
      "u_vigSoft",
      "u_ca",
      "u_soft",
      "u_sharpen",
      "u_bloom",
      "u_halation",
      "u_posterize",
      "u_seed",
      "u_quality",
    ]) {
      this.u[name] = gl.getUniformLocation(this.program, name);
    }
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render(src: Src, opts: RenderOptions) {
    if (this.disposed) return;
    const gl = this.gl;
    const sw =
      (src as HTMLVideoElement).videoWidth ||
      (src as HTMLCanvasElement).width ||
      (src as ImageBitmap).width;
    const sh =
      (src as HTMLVideoElement).videoHeight ||
      (src as HTMLCanvasElement).height ||
      (src as ImageBitmap).height;
    if (!sw || !sh) return;

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as TexImageSource);
    } catch {
      return;
    }

    // centre-crop source to the camera's aspect ratio
    const srcAspect = sw / sh;
    const dstAspect = opts.aspectRatio;
    let scaleX = 1;
    let scaleY = 1;
    if (srcAspect > dstAspect) scaleX = dstAspect / srcAspect;
    else scaleY = srcAspect / dstAspect;

    const p = opts.profile;
    const q = opts.quality ?? 0;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.uniform1i(this.L("u_tex"), 0);
    gl.uniform2f(this.L("u_texel"), 1 / (sw * scaleX), 1 / (sh * scaleY));
    gl.uniform2f(this.L("u_uvScale"), scaleX, scaleY);
    gl.uniform2f(this.L("u_uvOffset"), (1 - scaleX) / 2, (1 - scaleY) / 2);
    gl.uniform1f(this.L("u_mirror"), opts.mirror ? 1 : 0);
    gl.uniform1f(this.L("u_exposure"), p.exposure + (opts.flashBoost ?? 0));
    gl.uniform1f(this.L("u_contrast"), p.contrast);
    gl.uniform1f(this.L("u_saturation"), p.saturation);
    gl.uniform1f(this.L("u_temperature"), p.temperature);
    gl.uniform1f(this.L("u_tint"), p.tint);
    gl.uniform3f(this.L("u_lift"), p.lift[0], p.lift[1], p.lift[2]);
    gl.uniform3f(this.L("u_gain"), p.gain[0], p.gain[1], p.gain[2]);
    gl.uniform1f(this.L("u_gamma"), p.gamma);
    gl.uniform1f(this.L("u_rolloff"), p.highlightRolloff);
    gl.uniform1f(this.L("u_crush"), p.shadowCrush);
    gl.uniform1f(this.L("u_fade"), p.fade);
    gl.uniform1f(this.L("u_grain"), p.grain * (q > 0.5 ? 1 : 0.8));
    gl.uniform1f(this.L("u_grainSize"), p.grainSize * (q > 0.5 ? 1 : 1.35));
    gl.uniform1f(this.L("u_grainChroma"), p.grainChroma);
    gl.uniform1f(this.L("u_vignette"), p.vignette);
    gl.uniform1f(this.L("u_vigSoft"), p.vignetteSoftness);
    gl.uniform1f(this.L("u_ca"), p.chromaticAberration);
    gl.uniform1f(this.L("u_soft"), p.softness);
    gl.uniform1f(this.L("u_sharpen"), p.sharpen);
    gl.uniform1f(this.L("u_bloom"), p.bloom);
    gl.uniform1f(this.L("u_halation"), p.halation);
    gl.uniform1f(this.L("u_posterize"), p.posterize);
    gl.uniform1f(this.L("u_seed"), opts.seed ?? Math.random() * 100);
    gl.uniform1f(this.L("u_quality"), q);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose() {
    this.disposed = true;
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
}

let sharedCapture: CameraPipeline | null = null;
/** Off-screen pipeline reused for full-resolution captures. */
export function getCapturePipeline(): CameraPipeline {
  if (!sharedCapture) sharedCapture = new CameraPipeline();
  return sharedCapture;
}
