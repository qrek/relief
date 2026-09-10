import type { ParamDef } from "./objects";
import { extraAlpha, extraColour, extraDistort, extraOptical } from "./effects.extra";

export type ColorDef = { key: string; label: string; default: string };

export type EffectDef = {
  id: string;
  name: string;
  category: string;
  params: ParamDef[];
  colors: ColorDef[];
  /**
   * Fragment body. It receives `uv` (mutable), `col` (mutable, pre-sampled),
   * `uTime`, `uResolution`, `uAspect` and the source sampler `uMap`.
   * Numeric params arrive as `p_<key>`, colours as `c_<key>`.
   */
  glsl: string;
};

const n = (key: string, label: string, min: number, max: number, step: number, def: number): ParamDef => ({
  key,
  label,
  min,
  max,
  step,
  default: def,
});

/** Every effect that animates exposes the same speed knob; zero freezes it. */
const SPEED = n("speed", "Speed", 0, 4, 0.01, 0);

/** Shared helpers compiled into every pass. */
export const GLSL_PREAMBLE = /* glsl */ `
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

mat2 rot2(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float pickChannel(vec3 c, float which) {
  return which < 0.5 ? c.r : (which < 1.5 ? c.g : c.b);
}

/** One set of parallel ink lines, 1 on the stroke and 0 on the paper. */
float hatch(vec2 g, float angle, float weight) {
  vec2 r = rot2(angle) * g;
  float f = abs(fract(r.y) - 0.5) * 2.0;
  return 1.0 - smoothstep(weight, weight + 0.14, f);
}

/** Transmittance of one rotated halftone screen: 1 is bare paper, 0 is full ink. */
float screenDot(sampler2D tex, vec2 uv, float gridN, vec2 asp, float angle, float channel, float gain) {
  mat2 R = rot2(angle);
  mat2 Ri = rot2(-angle);
  vec2 g = R * (uv - 0.5) * gridN * asp;
  vec2 cell = floor(g) + 0.5;
  vec2 su = (Ri * cell) / (gridN * asp) + 0.5;
  vec3 s = texture2D(tex, clamp(su, 0.0, 1.0)).rgb;
  float v = clamp(pickChannel(s, channel) * gain, 0.0, 1.0);
  float radius = (1.0 - v) * 0.72;
  float d = length(g - cell);
  float ink = 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);
  return 1.0 - ink;
}

/** Position of the nearest cell centre, in the same grid space as the input. */
vec2 voronoiCell(vec2 g, float jitter, float time) {
  vec2 id = floor(g);
  vec2 best = id + 0.5;
  float bestD = 1.0e9;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 nid = id + vec2(float(x), float(y));
      vec2 o = vec2(hash21(nid), hash21(nid + 7.3));
      o = 0.5 + (o - 0.5) * jitter;
      vec2 drift = vec2(cos(time + o.x * 6.2831853), sin(time + o.y * 6.2831853)) * 0.14 * jitter;
      vec2 p = nid + o + drift;
      float d = distance(g, p);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

/** 1 when opaque pixels sit within radius of this one: the basis of outlines. */
float alphaReach(sampler2D tex, vec2 uv, vec2 radius, float threshold) {
  float m = step(threshold, texture2D(tex, uv).a);
  for (int i = 0; i < 16; i++) {
    float a = float(i) / 16.0 * 6.2831853;
    vec2 dir = vec2(cos(a), sin(a));
    for (int k = 1; k <= 3; k++) {
      vec2 s = clamp(uv + dir * radius * (float(k) / 3.0), 0.0, 1.0);
      m = max(m, step(threshold, texture2D(tex, s).a));
    }
  }
  return m;
}

/** Ordered 4x4 Bayer threshold in [0,1). */
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  float b = 5.0;
  if (i < 0.5) b = 0.0;
  else if (i < 1.5) b = 8.0;
  else if (i < 2.5) b = 2.0;
  else if (i < 3.5) b = 10.0;
  else if (i < 4.5) b = 12.0;
  else if (i < 5.5) b = 4.0;
  else if (i < 6.5) b = 14.0;
  else if (i < 7.5) b = 6.0;
  else if (i < 8.5) b = 3.0;
  else if (i < 9.5) b = 11.0;
  else if (i < 10.5) b = 1.0;
  else if (i < 11.5) b = 9.0;
  else if (i < 12.5) b = 15.0;
  else if (i < 13.5) b = 7.0;
  else if (i < 14.5) b = 13.0;
  return (b + 0.5) / 16.0;
}
`;

// ---------------------------------------------------------------------------
// Colour and grade
// ---------------------------------------------------------------------------

const colour: EffectDef[] = [
  {
    id: "grade",
    name: "Grade",
    category: "Colour",
    params: [
      n("brightness", "Brightness", -0.5, 0.5, 0.01, 0),
      n("contrast", "Contrast", 0, 3, 0.01, 1),
      n("saturation", "Saturation", 0, 3, 0.01, 1),
      n("tint", "Tint", 0, 1, 0.01, 0),
    ],
    colors: [{ key: "tint", label: "Tint colour", default: "#ff7a59" }],
    glsl: /* glsl */ `
      col.rgb = (col.rgb - 0.5) * p_contrast + 0.5 + p_brightness;
      float l = luma(col.rgb);
      col.rgb = mix(vec3(l), col.rgb, p_saturation);
      col.rgb = mix(col.rgb, col.rgb * c_tint * 2.0, p_tint);
    `,
  },
  {
    id: "duotone",
    name: "Duotone",
    category: "Colour",
    params: [n("mix", "Amount", 0, 1, 0.01, 1), n("gamma", "Gamma", 0.2, 3, 0.01, 1)],
    colors: [
      { key: "dark", label: "Shadows", default: "#1b1b3a" },
      { key: "light", label: "Highlights", default: "#ffd166" },
    ],
    glsl: /* glsl */ `
      float l = pow(clamp(luma(col.rgb), 0.0, 1.0), p_gamma);
      col.rgb = mix(col.rgb, mix(c_dark, c_light, l), p_mix);
    `,
  },
  {
    id: "threshold",
    name: "Threshold",
    category: "Colour",
    params: [n("level", "Level", 0, 1, 0.01, 0.5), n("soft", "Softness", 0, 0.4, 0.005, 0.02)],
    colors: [
      { key: "dark", label: "Dark", default: "#000000" },
      { key: "light", label: "Light", default: "#ffffff" },
    ],
    glsl: /* glsl */ `
      float l = luma(col.rgb);
      float m = smoothstep(p_level - p_soft - 0.001, p_level + p_soft + 0.001, l);
      col.rgb = mix(c_dark, c_light, m);
    `,
  },
  {
    id: "posterize",
    name: "Posterize",
    category: "Colour",
    params: [n("levels", "Levels", 2, 16, 1, 4)],
    colors: [],
    glsl: /* glsl */ `
      float lv = max(2.0, floor(p_levels));
      col.rgb = floor(col.rgb * lv + 0.5) / lv;
    `,
  },
  {
    id: "halftone",
    name: "Halftone",
    category: "Colour",
    params: [
      n("scale", "Dot size", 8, 220, 1, 70),
      n("angle", "Angle", 0, 1.5708, 0.01, 0.4),
      n("gain", "Contrast", 0.2, 2, 0.01, 1),
    ],
    colors: [
      { key: "bg", label: "Paper", default: "#ffffff" },
      { key: "fg", label: "Ink", default: "#111111" },
    ],
    glsl: /* glsl */ `
      float gridN = max(4.0, p_scale);
      vec2 asp = vec2(uAspect, 1.0);
      mat2 R = rot2(p_angle);
      mat2 Ri = rot2(-p_angle);
      vec2 g = R * (uv - 0.5) * gridN * asp;
      vec2 cell = floor(g) + 0.5;
      vec2 su = (Ri * cell) / (gridN * asp) + 0.5;
      float l = clamp(luma(texture2D(uMap, clamp(su, 0.0, 1.0)).rgb) * p_gain, 0.0, 1.0);
      float radius = (1.0 - l) * 0.72;
      float d = length(g - cell);
      float m = 1.0 - smoothstep(radius - 0.06, radius + 0.06, d);
      col.rgb = mix(c_bg, c_fg, m);
    `,
  },
  {
    id: "dither",
    name: "Dither",
    category: "Colour",
    params: [n("scale", "Grid", 40, 600, 1, 220), n("bias", "Bias", -0.3, 0.3, 0.01, 0)],
    colors: [
      { key: "bg", label: "Paper", default: "#0d0d12" },
      { key: "fg", label: "Ink", default: "#e8e8f0" },
    ],
    glsl: /* glsl */ `
      vec2 g = uv * p_scale * vec2(uAspect, 1.0);
      float t = bayer4(g);
      float l = clamp(luma(col.rgb) + p_bias, 0.0, 1.0);
      float m = step(t, l);
      col.rgb = mix(c_bg, c_fg, m);
    `,
  },
  {
    id: "riso",
    name: "Risograph",
    category: "Colour",
    params: [
      n("levels", "Levels", 2, 8, 1, 3),
      n("grain", "Grain", 0, 0.6, 0.01, 0.2),
      n("offset", "Misprint", 0, 0.02, 0.0005, 0.004),
    ],
    colors: [
      { key: "dark", label: "Ink", default: "#ff4f6d" },
      { key: "light", label: "Paper", default: "#f4efe4" },
    ],
    glsl: /* glsl */ `
      float l = luma(texture2D(uMap, uv + vec2(p_offset, -p_offset)).rgb);
      float g = (vnoise(uv * uResolution.y * 0.7) - 0.5) * p_grain;
      float lv = max(2.0, floor(p_levels));
      float q = floor(clamp(l + g, 0.0, 1.0) * lv + 0.5) / lv;
      col.rgb = mix(c_dark, c_light, q);
    `,
  },
  {
    id: "grain",
    name: "Grain",
    category: "Colour",
    params: [n("amount", "Amount", 0, 0.6, 0.005, 0.12), n("size", "Size", 0.3, 4, 0.05, 1), SPEED],
    colors: [],
    glsl: /* glsl */ `
      // 24 discrete states per cycle keeps the grain periodic, so a loop has no jump.
      float frame = floor(fract(uTime / 6.2831853) * 24.0);
      float g = hash21(floor(uv * uResolution / max(0.3, p_size)) + frame) - 0.5;
      col.rgb += g * p_amount;
    `,
  },
  {
    id: "sobel",
    name: "Edges",
    category: "Colour",
    params: [n("width", "Width", 0.5, 6, 0.1, 1.4), n("gain", "Gain", 0.2, 8, 0.05, 2.5)],
    colors: [
      { key: "bg", label: "Background", default: "#000000" },
      { key: "edge", label: "Edge", default: "#ffffff" },
    ],
    glsl: /* glsl */ `
      vec2 px = p_width / uResolution;
      float tl = luma(texture2D(uMap, uv + px * vec2(-1.0,  1.0)).rgb);
      float tm = luma(texture2D(uMap, uv + px * vec2( 0.0,  1.0)).rgb);
      float tr = luma(texture2D(uMap, uv + px * vec2( 1.0,  1.0)).rgb);
      float ml = luma(texture2D(uMap, uv + px * vec2(-1.0,  0.0)).rgb);
      float mr = luma(texture2D(uMap, uv + px * vec2( 1.0,  0.0)).rgb);
      float bl = luma(texture2D(uMap, uv + px * vec2(-1.0, -1.0)).rgb);
      float bm = luma(texture2D(uMap, uv + px * vec2( 0.0, -1.0)).rgb);
      float br = luma(texture2D(uMap, uv + px * vec2( 1.0, -1.0)).rgb);
      float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
      float gy = tl + 2.0 * tm + tr - bl - 2.0 * bm - br;
      float e = clamp(length(vec2(gx, gy)) * p_gain, 0.0, 1.0);
      col.rgb = mix(c_bg, c_edge, e);
    `,
  },
  {
    id: "vignette",
    name: "Vignette",
    category: "Colour",
    params: [
      n("amount", "Amount", 0, 1, 0.01, 0.6),
      n("start", "Start", 0, 1, 0.01, 0.35),
      n("end", "End", 0.1, 1.4, 0.01, 0.85),
    ],
    colors: [],
    glsl: /* glsl */ `
      float d = length((uv - 0.5) * vec2(uAspect, 1.0)) * 1.6;
      col.rgb *= 1.0 - smoothstep(p_start, p_end, d) * p_amount;
    `,
  },
];

// ---------------------------------------------------------------------------
// Optical
// ---------------------------------------------------------------------------

const optical: EffectDef[] = [
  {
    id: "blur",
    name: "Blur",
    category: "Optical",
    params: [n("radius", "Radius", 0, 24, 0.1, 4)],
    colors: [],
    glsl: /* glsl */ `
      vec2 px = p_radius / uResolution;
      vec4 sum = vec4(0.0);
      float wsum = 0.0;
      for (int i = -4; i <= 4; i++) {
        for (int j = -4; j <= 4; j++) {
          float w = exp(-float(i * i + j * j) / 8.0);
          sum += texture2D(uMap, uv + px * vec2(float(i), float(j))) * w;
          wsum += w;
        }
      }
      col = sum / wsum;
    `,
  },
  {
    id: "bloom",
    name: "Bloom",
    category: "Optical",
    params: [
      n("threshold", "Threshold", 0, 1, 0.01, 0.6),
      n("radius", "Radius", 1, 30, 0.1, 8),
      n("intensity", "Intensity", 0, 3, 0.01, 0.8),
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 px = p_radius / uResolution;
      vec3 sum = vec3(0.0);
      float wsum = 0.0;
      for (int i = -4; i <= 4; i++) {
        for (int j = -4; j <= 4; j++) {
          vec3 s = texture2D(uMap, uv + px * vec2(float(i), float(j))).rgb;
          float m = smoothstep(p_threshold, 1.0, luma(s));
          float w = exp(-float(i * i + j * j) / 8.0);
          sum += s * m * w;
          wsum += w;
        }
      }
      col.rgb += (sum / wsum) * p_intensity;
    `,
  },
  {
    id: "aberration",
    name: "Aberration",
    category: "Optical",
    params: [n("amount", "Amount", 0, 3, 0.01, 0.6), n("radial", "Radial", 0, 1, 0.01, 1)],
    colors: [],
    glsl: /* glsl */ `
      vec2 dir = mix(vec2(1.0, 0.0), normalize((uv - 0.5) + 1e-6), p_radial);
      vec2 d = dir * p_amount * 0.01 * mix(1.0, length(uv - 0.5) * 2.0, p_radial);
      col.r = texture2D(uMap, uv + d).r;
      col.b = texture2D(uMap, uv - d).b;
    `,
  },
  {
    id: "lens",
    name: "Lens",
    category: "Optical",
    params: [n("amount", "Distortion", -1.2, 1.2, 0.01, 0.35), n("zoom", "Zoom", 0.5, 1.6, 0.01, 1)],
    colors: [],
    glsl: /* glsl */ `
      vec2 c = (uv - 0.5) / max(0.1, p_zoom);
      float r2 = dot(c, c);
      uv = clamp(0.5 + c * (1.0 + p_amount * r2), 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
];

// ---------------------------------------------------------------------------
// Distortion and structure
// ---------------------------------------------------------------------------

const distort: EffectDef[] = [
  {
    id: "pixelate",
    name: "Pixelate",
    category: "Distort",
    params: [n("size", "Blocks", 4, 400, 1, 70)],
    colors: [],
    glsl: /* glsl */ `
      vec2 gridN = vec2(max(2.0, p_size)) * vec2(uAspect, 1.0);
      uv = (floor(uv * gridN) + 0.5) / gridN;
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "mosaic",
    name: "Mosaic",
    category: "Distort",
    params: [n("size", "Cells", 4, 200, 1, 40), n("offset", "Row offset", 0, 1, 0.01, 0.5)],
    colors: [],
    glsl: /* glsl */ `
      vec2 gridN = vec2(max(3.0, p_size)) * vec2(uAspect, 1.0);
      vec2 g = uv * gridN;
      float row = floor(g.y);
      float shift = mod(row, 2.0) * p_offset;
      g.x += shift;
      vec2 cell = floor(g) + 0.5;
      cell.x -= shift;
      uv = cell / gridN;
      col = texture2D(uMap, clamp(uv, 0.0, 1.0));
    `,
  },
  {
    id: "wave",
    name: "Wave",
    category: "Distort",
    params: [
      n("freq", "Frequency", 1, 60, 0.5, 12),
      n("amp", "Amplitude", 0, 1, 0.005, 0.2),
      n("cross", "Cross", 0, 1, 0.01, 0.3),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      uv.x += sin(uv.y * p_freq + uTime) * p_amp * 0.06;
      uv.y += cos(uv.x * p_freq * 0.8 + uTime) * p_amp * 0.06 * p_cross;
      col = texture2D(uMap, clamp(uv, 0.0, 1.0));
    `,
  },
  {
    id: "ripple",
    name: "Ripple",
    category: "Distort",
    params: [
      n("freq", "Frequency", 2, 90, 0.5, 28),
      n("amp", "Amplitude", 0, 1, 0.005, 0.18),
      n("falloff", "Falloff", 0, 3, 0.01, 0.8),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
      float d = length(c);
      float fade = exp(-d * p_falloff * 2.0);
      uv += normalize(c + 1e-6) * sin(d * p_freq - uTime) * p_amp * 0.05 * fade;
      col = texture2D(uMap, clamp(uv, 0.0, 1.0));
    `,
  },
  {
    id: "twist",
    name: "Twist",
    category: "Distort",
    params: [
      n("amount", "Amount", -6, 6, 0.01, 2),
      n("radius", "Radius", 0.05, 1.4, 0.01, 0.6),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 c = (uv - 0.5) * asp;
      float d = length(c);
      float a = (p_amount + uTime) * smoothstep(p_radius, 0.0, d);
      uv = (rot2(a) * c) / asp + 0.5;
      col = texture2D(uMap, clamp(uv, 0.0, 1.0));
    `,
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    category: "Distort",
    params: [
      n("sides", "Segments", 2, 24, 1, 6),
      n("rotate", "Rotate", 0, 6.2832, 0.01, 0),
      n("zoom", "Zoom", 0.2, 3, 0.01, 1),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 c = (uv - 0.5) * asp;
      float r = length(c) / max(0.2, p_zoom);
      float a = atan(c.y, c.x) + p_rotate + uTime;
      float seg = 6.2831853 / max(2.0, floor(p_sides));
      a = abs(mod(a, seg) - seg * 0.5);
      uv = clamp((vec2(cos(a), sin(a)) * r) / asp + 0.5, 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "mirror",
    name: "Mirror",
    category: "Distort",
    params: [n("axis", "Axis", 0, 2, 1, 0), n("flip", "Keep far half", 0, 1, 1, 0)],
    colors: [],
    glsl: /* glsl */ `
      // Folding onto one half: 0.5 - |uv - 0.5| keeps the near half, + keeps the far half.
      if (p_axis < 0.5 || p_axis > 1.5) {
        uv.x = p_flip > 0.5 ? 0.5 + abs(uv.x - 0.5) : 0.5 - abs(uv.x - 0.5);
      }
      if (p_axis > 0.5) {
        uv.y = p_flip > 0.5 ? 0.5 + abs(uv.y - 0.5) : 0.5 - abs(uv.y - 0.5);
      }
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "tile",
    name: "Tile",
    category: "Distort",
    params: [
      n("x", "Columns", 1, 12, 1, 2),
      n("y", "Rows", 1, 12, 1, 2),
      n("bounce", "Mirror tiles", 0, 1, 1, 1),
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 reps = vec2(max(1.0, floor(p_x)), max(1.0, floor(p_y)));
      vec2 g = uv * reps;
      vec2 f = fract(g);
      if (p_bounce > 0.5) {
        vec2 even = mod(floor(g), 2.0);
        f = mix(f, 1.0 - f, even);
      }
      uv = f;
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "liquify",
    name: "Liquify",
    category: "Distort",
    params: [
      n("amount", "Amount", 0, 1, 0.005, 0.25),
      n("scale", "Scale", 0.5, 12, 0.1, 3),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      // Walking the noise around a circle makes the distortion return to its
      // starting state after one cycle, so the loop closes.
      vec2 q = uv * p_scale;
      vec2 flow = vec2(cos(uTime), sin(uTime)) * 0.7;
      vec2 d = vec2(fbm(q + flow), fbm(q + 5.2 - flow)) - 0.5;
      uv = clamp(uv + d * p_amount * 0.3, 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "glitch",
    name: "Glitch",
    category: "Distort",
    params: [
      n("amount", "Amount", 0, 1, 0.01, 0.4),
      n("bands", "Bands", 4, 120, 1, 28),
      n("shift", "RGB shift", 0, 1, 0.01, 0.4),
      n("speed", "Speed", 0, 4, 0.01, 1),
    ],
    colors: [],
    glsl: /* glsl */ `
      // Sixteen discrete states per cycle, so the glitch pattern repeats exactly.
      float step_t = floor(fract(uTime / 6.2831853) * 16.0);
      float band = floor(uv.y * max(4.0, p_bands));
      float r = hash21(vec2(band, step_t));
      float on = step(1.0 - p_amount, r);
      float jitter = (hash21(vec2(band, step_t + 7.0)) - 0.5) * on * 0.2;
      vec2 juv = clamp(uv + vec2(jitter, 0.0), 0.0, 1.0);
      col = texture2D(uMap, juv);
      float sh = on * p_shift * 0.02;
      col.r = texture2D(uMap, clamp(juv + vec2(sh, 0.0), 0.0, 1.0)).r;
      col.b = texture2D(uMap, clamp(juv - vec2(sh, 0.0), 0.0, 1.0)).b;
    `,
  },
  {
    id: "streak",
    name: "Streak",
    category: "Distort",
    params: [
      n("length", "Length", 0, 300, 1, 140),
      n("angle", "Angle", 0, 6.2832, 0.01, 1.5708),
      n("threshold", "Threshold", 0, 1, 0.01, 0.3),
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 dir = vec2(cos(p_angle), sin(p_angle)) / uResolution * p_length;
      vec4 acc = col;
      float w = 1.0;
      for (int i = 1; i <= 16; i++) {
        vec2 s = clamp(uv - dir * (float(i) / 16.0), 0.0, 1.0);
        vec4 c2 = texture2D(uMap, s);
        float m = step(p_threshold, luma(c2.rgb));
        acc += c2 * m;
        w += m;
      }
      col = acc / w;
    `,
  },
];

export const EFFECTS: EffectDef[] = [
  ...colour,
  ...extraColour,
  ...optical,
  ...extraOptical,
  ...distort,
  ...extraDistort,
  ...extraAlpha,
];

export const EFFECT_CATEGORIES = Array.from(new Set(EFFECTS.map((e) => e.category)));

export const MAX_EFFECTS = 3;

export function effectById(id: string): EffectDef | undefined {
  return EFFECTS.find((e) => e.id === id);
}

export function defaultEffectParams(def: EffectDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}

export function defaultEffectColors(def: EffectDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of def.colors) out[c.key] = c.default;
  return out;
}

/** True when the effect's current settings make it move over time. */
export function isAnimated(def: EffectDef, params: Record<string, number>): boolean {
  const speed = params.speed ?? def.params.find((p) => p.key === "speed")?.default ?? 0;
  return def.params.some((p) => p.key === "speed") && speed > 0.001;
}
