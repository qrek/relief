import type { EffectDef } from "./effects";
import type { ParamDef } from "./objects";

const n = (key: string, label: string, min: number, max: number, step: number, def: number): ParamDef => ({
  key,
  label,
  min,
  max,
  step,
  default: def,
});

const SPEED = n("speed", "Speed", 0, 4, 0.01, 0);

// ---------------------------------------------------------------------------
// Colour and print
// ---------------------------------------------------------------------------

export const extraColour: EffectDef[] = [
  {
    id: "gradient-map",
    name: "Gradient Map",
    category: "Colour",
    params: [n("mix", "Amount", 0, 1, 0.01, 1), n("pivot", "Midpoint", 0.1, 0.9, 0.01, 0.5)],
    colors: [
      { key: "low", label: "Shadows", default: "#241b6b" },
      { key: "mid", label: "Midtones", default: "#ff4d8d" },
      { key: "high", label: "Highlights", default: "#ffd76e" },
    ],
    glsl: /* glsl */ `
      float l = clamp(luma(col.rgb), 0.0, 1.0);
      vec3 ramp = l < p_pivot
        ? mix(c_low, c_mid, l / max(0.001, p_pivot))
        : mix(c_mid, c_high, (l - p_pivot) / max(0.001, 1.0 - p_pivot));
      col.rgb = mix(col.rgb, ramp, p_mix);
    `,
  },
  {
    id: "hue",
    name: "Hue Shift",
    category: "Colour",
    params: [n("shift", "Shift", 0, 1, 0.005, 0.15), n("range", "Only near", 0, 1, 0.01, 0), SPEED],
    colors: [],
    glsl: /* glsl */ `
      vec3 hsv = rgb2hsv(col.rgb);
      float weight = 1.0;
      if (p_range > 0.001) {
        float d = abs(fract(hsv.x - p_range + 0.5) - 0.5);
        weight = 1.0 - smoothstep(0.05, 0.25, d);
      }
      hsv.x = fract(hsv.x + (p_shift + uTime / 6.2831853) * weight);
      col.rgb = hsv2rgb(hsv);
    `,
  },
  {
    id: "solarize",
    name: "Solarize",
    category: "Colour",
    params: [n("threshold", "Threshold", 0, 1, 0.01, 0.5), n("amount", "Amount", 0, 1, 0.01, 1)],
    colors: [],
    glsl: /* glsl */ `
      vec3 flipped = abs(col.rgb - step(vec3(p_threshold), col.rgb));
      col.rgb = mix(col.rgb, flipped * 2.0, p_amount);
    `,
  },
  {
    id: "crosshatch",
    name: "Crosshatch",
    category: "Colour",
    params: [n("scale", "Spacing", 40, 500, 1, 180), n("weight", "Weight", 0.05, 0.6, 0.01, 0.22)],
    colors: [
      { key: "bg", label: "Paper", default: "#f6f2e8" },
      { key: "fg", label: "Ink", default: "#141414" },
    ],
    glsl: /* glsl */ `
      float l = luma(col.rgb);
      vec2 g = uv * p_scale * vec2(uAspect, 1.0);
      float ink = 0.0;
      if (l < 0.85) ink = max(ink, hatch(g, 0.7854, p_weight));
      if (l < 0.62) ink = max(ink, hatch(g, -0.7854, p_weight));
      if (l < 0.40) ink = max(ink, hatch(g, 0.0, p_weight));
      if (l < 0.20) ink = max(ink, hatch(g, 1.5708, p_weight));
      col.rgb = mix(c_bg, c_fg, ink);
    `,
  },
  {
    id: "scanlines",
    name: "Scanlines",
    category: "Colour",
    params: [
      n("count", "Lines", 40, 900, 1, 320),
      n("amount", "Depth", 0, 1, 0.01, 0.45),
      n("roll", "Roll", 0, 1, 0.01, 0),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      float line = sin((uv.y + uTime / 6.2831853 * p_roll) * p_count * 3.14159265);
      col.rgb *= 1.0 - p_amount * 0.5 * (1.0 - line * line);
    `,
  },
  {
    id: "crt",
    name: "CRT",
    category: "Colour",
    params: [
      n("curve", "Curve", 0, 0.6, 0.01, 0.16),
      n("mask", "Aperture", 0, 1, 0.01, 0.7),
      n("pitch", "Stripe width", 1, 16, 0.5, 4),
      n("scan", "Scanlines", 0, 1, 0.01, 0.6),
      n("bleed", "Bleed", 0, 1, 0.01, 0.4),
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      uv = 0.5 + c * (1.0 + p_curve * r2 * 1.6);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        col = vec4(0.0, 0.0, 0.0, col.a);
      } else {
        float sh = p_bleed * 0.004;
        col.r = texture2D(uMap, uv + vec2(sh, 0.0)).r;
        col.g = texture2D(uMap, uv).g;
        col.b = texture2D(uMap, uv - vec2(sh, 0.0)).b;
        // Triads a few screen pixels wide, otherwise the mask vanishes once scaled.
        float stripe = mod(floor(uv.x * uResolution.x / max(1.0, p_pitch)), 3.0);
        vec3 aperture = vec3(
          stripe < 0.5 ? 1.0 : 0.45,
          stripe >= 0.5 && stripe < 1.5 ? 1.0 : 0.45,
          stripe >= 1.5 ? 1.0 : 0.45);
        col.rgb *= mix(vec3(1.0), aperture, p_mask);
        float line = sin(uv.y * uResolution.y / max(1.0, p_pitch) * 3.14159265);
        col.rgb *= 1.0 - p_scan * 0.55 * (1.0 - line * line);
        col.rgb *= 1.0 + p_mask * 0.6;
        col.rgb *= 1.0 - smoothstep(0.25, 0.75, r2 * 1.4) * 0.6;
      }
    `,
  },
  {
    id: "newsprint",
    name: "Newsprint",
    category: "Colour",
    params: [n("scale", "Dot size", 20, 260, 1, 100), n("gain", "Contrast", 0.3, 2, 0.01, 1)],
    colors: [{ key: "bg", label: "Paper", default: "#fbf7ee" }],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      float gridN = max(8.0, p_scale);
      vec3 ink;
      ink.r = screenDot(uMap, uv, gridN, asp, 0.2618, 0.0, p_gain);
      ink.g = screenDot(uMap, uv, gridN, asp, 1.3090, 1.0, p_gain);
      ink.b = screenDot(uMap, uv, gridN, asp, 0.7854, 2.0, p_gain);
      col.rgb = c_bg * ink;
    `,
  },
  {
    id: "sharpen",
    name: "Sharpen",
    category: "Colour",
    params: [n("amount", "Amount", 0, 3, 0.01, 0.8), n("radius", "Radius", 0.5, 5, 0.1, 1)],
    colors: [],
    glsl: /* glsl */ `
      vec2 px = p_radius / uResolution;
      vec3 blur = (
        texture2D(uMap, uv + px * vec2(-1.0, 0.0)).rgb +
        texture2D(uMap, uv + px * vec2( 1.0, 0.0)).rgb +
        texture2D(uMap, uv + px * vec2( 0.0,-1.0)).rgb +
        texture2D(uMap, uv + px * vec2( 0.0, 1.0)).rgb) * 0.25;
      col.rgb += (col.rgb - blur) * p_amount * 2.0;
    `,
  },
  {
    id: "diffusion",
    name: "Diffusion",
    category: "Colour",
    params: [n("radius", "Radius", 1, 30, 0.5, 10), n("amount", "Amount", 0, 1, 0.01, 0.5)],
    colors: [],
    glsl: /* glsl */ `
      vec2 px = p_radius / uResolution;
      vec3 soft = vec3(0.0);
      float wsum = 0.0;
      for (int i = -3; i <= 3; i++) {
        for (int j = -3; j <= 3; j++) {
          float w = exp(-float(i * i + j * j) / 6.0);
          soft += texture2D(uMap, uv + px * vec2(float(i), float(j))).rgb * w;
          wsum += w;
        }
      }
      soft /= wsum;
      // Screen blend keeps highlights blooming instead of flattening the image.
      col.rgb = mix(col.rgb, 1.0 - (1.0 - col.rgb) * (1.0 - soft), p_amount);
    `,
  },
];

// ---------------------------------------------------------------------------
// Optical
// ---------------------------------------------------------------------------

export const extraOptical: EffectDef[] = [
  {
    id: "zoom-blur",
    name: "Zoom Blur",
    category: "Optical",
    params: [n("amount", "Amount", 0, 0.4, 0.005, 0.12), n("center", "Centre pull", 0, 1, 0.01, 0.4)],
    colors: [],
    glsl: /* glsl */ `
      vec2 dir = (uv - 0.5);
      vec4 acc = vec4(0.0);
      for (int i = 0; i < 12; i++) {
        float t = float(i) / 11.0;
        float k = 1.0 - t * p_amount;
        acc += texture2D(uMap, clamp(0.5 + dir * k, 0.0, 1.0));
      }
      vec4 blurred = acc / 12.0;
      float fade = mix(1.0, smoothstep(0.0, 0.5, length(dir)), p_center);
      col = mix(col, blurred, fade);
    `,
  },
  {
    id: "motion-blur",
    name: "Motion Blur",
    category: "Optical",
    params: [n("length", "Length", 0, 120, 1, 30), n("angle", "Angle", 0, 6.2832, 0.01, 0)],
    colors: [],
    glsl: /* glsl */ `
      vec2 step_v = vec2(cos(p_angle), sin(p_angle)) / uResolution * p_length / 12.0;
      vec4 acc = vec4(0.0);
      for (int i = -6; i <= 6; i++) {
        acc += texture2D(uMap, clamp(uv + step_v * float(i), 0.0, 1.0));
      }
      col = acc / 13.0;
    `,
  },
  {
    id: "tilt-shift",
    name: "Tilt Shift",
    category: "Optical",
    params: [
      n("focus", "Focus line", 0, 1, 0.01, 0.5),
      n("band", "Band", 0.02, 0.6, 0.01, 0.18),
      n("radius", "Blur", 1, 24, 0.5, 8),
    ],
    colors: [],
    glsl: /* glsl */ `
      float d = abs(uv.y - p_focus);
      float amount = smoothstep(p_band, p_band + 0.25, d);
      vec2 px = (p_radius * amount) / uResolution;
      vec4 acc = vec4(0.0);
      float wsum = 0.0;
      for (int i = -3; i <= 3; i++) {
        for (int j = -3; j <= 3; j++) {
          float w = exp(-float(i * i + j * j) / 6.0);
          acc += texture2D(uMap, uv + px * vec2(float(i), float(j))) * w;
          wsum += w;
        }
      }
      col = acc / wsum;
    `,
  },
  {
    id: "anamorphic",
    name: "Anamorphic",
    category: "Optical",
    params: [
      n("threshold", "Threshold", 0, 1, 0.01, 0.7),
      n("length", "Length", 0, 300, 1, 140),
      n("intensity", "Intensity", 0, 3, 0.01, 1),
    ],
    colors: [{ key: "tint", label: "Streak", default: "#7fb4ff" }],
    glsl: /* glsl */ `
      vec3 streak = vec3(0.0);
      float wsum = 0.0;
      for (int i = -12; i <= 12; i++) {
        float t = float(i) / 12.0;
        vec2 s = clamp(uv + vec2(t * p_length / uResolution.x, 0.0), 0.0, 1.0);
        vec3 c2 = texture2D(uMap, s).rgb;
        float m = smoothstep(p_threshold, 1.0, luma(c2));
        float w = 1.0 - abs(t);
        streak += c2 * m * w;
        wsum += w;
      }
      col.rgb += (streak / wsum) * c_tint * p_intensity;
    `,
  },
];

// ---------------------------------------------------------------------------
// Distortion and structure
// ---------------------------------------------------------------------------

export const extraDistort: EffectDef[] = [
  {
    id: "squeeze",
    name: "Squeeze",
    category: "Distort",
    params: [
      n("amount", "Amount", -0.8, 0.8, 0.01, 0.3),
      n("axis", "Axis", 0, 1, 1, 0),
      n("falloff", "Falloff", 0.05, 2, 0.01, 0.6),
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 c = uv - 0.5;
      float along = p_axis < 0.5 ? c.y : c.x;
      float k = 1.0 + p_amount * exp(-abs(along) / max(0.05, p_falloff));
      if (p_axis < 0.5) c.x /= k; else c.y /= k;
      uv = clamp(c + 0.5, 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "spiral",
    name: "Spiral",
    category: "Distort",
    params: [n("turns", "Turns", -6, 6, 0.01, 2), n("zoom", "Zoom", 0.3, 3, 0.01, 1), SPEED],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 c = (uv - 0.5) * asp;
      float r = length(c) / max(0.2, p_zoom);
      float a = atan(c.y, c.x) + r * p_turns * 6.2831853 + uTime;
      uv = clamp((vec2(cos(a), sin(a)) * r) / asp + 0.5, 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "slice",
    name: "Slice",
    category: "Distort",
    params: [
      n("count", "Slices", 2, 60, 1, 12),
      n("amount", "Offset", 0, 0.6, 0.005, 0.12),
      n("axis", "Axis", 0, 1, 1, 0),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      float along = p_axis < 0.5 ? uv.y : uv.x;
      float band = floor(along * max(2.0, p_count));
      float seed = hash21(vec2(band, floor(fract(uTime / 6.2831853) * 12.0)));
      float shift = (seed - 0.5) * 2.0 * p_amount;
      if (p_axis < 0.5) uv.x += shift; else uv.y += shift;
      col = texture2D(uMap, clamp(uv, 0.0, 1.0));
    `,
  },
  {
    id: "cells",
    name: "Cells",
    category: "Distort",
    params: [n("scale", "Cells", 3, 90, 1, 22), n("jitter", "Irregular", 0, 1, 0.01, 0.8), SPEED],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 g = uv * p_scale * asp;
      vec2 cell = voronoiCell(g, p_jitter, uTime);
      uv = clamp(cell / (p_scale * asp), 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "shatter",
    name: "Shatter",
    category: "Distort",
    params: [
      n("scale", "Shards", 3, 60, 1, 14),
      n("amount", "Spread", 0, 0.4, 0.005, 0.08),
      n("jitter", "Irregular", 0, 1, 0.01, 0.9),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 g = uv * p_scale * asp;
      vec2 cell = voronoiCell(g, p_jitter, 0.0);
      float seed = hash21(cell);
      float ang = seed * 6.2831853 + uTime;
      uv = clamp(uv + vec2(cos(ang), sin(ang)) * p_amount * (0.3 + seed * 0.7), 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
  {
    id: "drops",
    name: "Drops",
    category: "Distort",
    params: [
      n("scale", "Density", 3, 60, 1, 16),
      n("amount", "Refraction", 0, 0.3, 0.002, 0.06),
      n("size", "Size", 0.1, 0.9, 0.01, 0.45),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 asp = vec2(uAspect, 1.0);
      vec2 g = uv * p_scale * asp;
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      vec2 jitter = (vec2(hash21(id), hash21(id + 3.7)) - 0.5) * 0.6;
      vec2 d = f - jitter;
      float r = length(d);
      float lens = smoothstep(p_size, p_size * 0.4, r);
      // A wobble on the drop centres reads as water running down the surface.
      vec2 wobble = vec2(sin(uTime + id.x), cos(uTime + id.y)) * 0.05;
      uv = clamp(uv + (d + wobble) * lens * p_amount, 0.0, 1.0);
      col = texture2D(uMap, uv);
      col.rgb += lens * 0.06;
    `,
  },
  {
    id: "worms",
    name: "Worms",
    category: "Distort",
    params: [
      n("scale", "Flow scale", 0.5, 12, 0.1, 3),
      n("length", "Length", 0, 120, 1, 40),
      n("amount", "Strength", 0, 1, 0.01, 0.6),
      SPEED,
    ],
    colors: [],
    glsl: /* glsl */ `
      vec2 flow = vec2(cos(uTime), sin(uTime)) * 0.5;
      float a = fbm(uv * p_scale + flow) * 6.2831853 * 2.0;
      vec2 dir = vec2(cos(a), sin(a)) / uResolution * p_length;
      vec4 acc = vec4(0.0);
      for (int i = 0; i < 10; i++) {
        acc += texture2D(uMap, clamp(uv + dir * (float(i) / 9.0 - 0.5), 0.0, 1.0));
      }
      col = mix(col, acc / 10.0, p_amount);
    `,
  },
  {
    id: "self-displace",
    name: "Displace",
    category: "Distort",
    params: [
      n("amount", "Amount", -0.3, 0.3, 0.005, 0.08),
      n("blur", "Softness", 0.5, 12, 0.1, 4),
      n("angle", "Angle", 0, 6.2832, 0.01, 0),
    ],
    colors: [],
    glsl: /* glsl */ `
      // Drives the offset from the image's own brightness, so the picture warps itself.
      vec2 px = p_blur / uResolution;
      float l = 0.0;
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          l += luma(texture2D(uMap, uv + px * vec2(float(i), float(j))).rgb);
        }
      }
      l /= 9.0;
      vec2 dir = vec2(cos(p_angle), sin(p_angle));
      uv = clamp(uv + dir * (l - 0.5) * p_amount * 2.0, 0.0, 1.0);
      col = texture2D(uMap, uv);
    `,
  },
];

// ---------------------------------------------------------------------------
// Alpha: the sticker looks that only make sense on cut-out media
// ---------------------------------------------------------------------------

export const extraAlpha: EffectDef[] = [
  {
    id: "sticker",
    name: "Sticker",
    category: "Alpha",
    params: [n("width", "Border", 0, 40, 0.5, 12), n("threshold", "Cutout", 0.05, 0.95, 0.01, 0.5)],
    colors: [{ key: "border", label: "Border", default: "#ffffff" }],
    glsl: /* glsl */ `
      float inside = step(p_threshold, col.a);
      float near = alphaReach(uMap, uv, p_width / uResolution, p_threshold);
      float border = max(0.0, near - inside);
      col.rgb = mix(col.rgb, c_border, border);
      col.a = max(col.a, near);
    `,
  },
  {
    id: "shadow",
    name: "Drop Shadow",
    category: "Alpha",
    params: [
      n("distance", "Distance", 0, 80, 0.5, 18),
      n("angle", "Angle", 0, 6.2832, 0.01, 2.36),
      n("opacity", "Opacity", 0, 1, 0.01, 0.5),
      n("threshold", "Cutout", 0.05, 0.95, 0.01, 0.5),
    ],
    colors: [{ key: "shade", label: "Shadow", default: "#000000" }],
    glsl: /* glsl */ `
      vec2 offset = vec2(cos(p_angle), sin(p_angle)) * p_distance / uResolution;
      float behind = step(p_threshold, texture2D(uMap, clamp(uv - offset, 0.0, 1.0)).a) * p_opacity;
      float front = col.a;
      col.rgb = mix(c_shade, col.rgb, front);
      col.a = max(front, behind);
    `,
  },
  {
    id: "edge-glow",
    name: "Edge Glow",
    category: "Alpha",
    params: [
      n("width", "Spread", 1, 60, 0.5, 22),
      n("intensity", "Intensity", 0, 3, 0.01, 1.2),
      n("threshold", "Cutout", 0.05, 0.95, 0.01, 0.5),
    ],
    colors: [{ key: "glow", label: "Glow", default: "#39ff88" }],
    glsl: /* glsl */ `
      float reach = alphaReach(uMap, uv, p_width / uResolution, p_threshold);
      float halo = max(0.0, reach - step(p_threshold, col.a));
      col.rgb += c_glow * halo * p_intensity;
      col.a = max(col.a, halo * min(1.0, p_intensity));
    `,
  },
];
