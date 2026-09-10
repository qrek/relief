import * as THREE from "three";

/** Full-frame sensor height in millimetres, so focal length reads like a real lens. */
export const SENSOR_HEIGHT = 24;

/**
 * How big a world unit is in millimetres by default. Scenes here are built at
 * tabletop scale, so one unit is treated as five centimetres: that is what
 * makes a realistic aperture produce a realistic amount of blur. Shrinking it
 * is what puts the lens into macro, where a subject a few centimetres across is
 * photographed from a few centimetres away and the field turns paper thin.
 */
export const WORLD_TO_MM = 50;

/**
 * Samples on the bokeh disc. They are spent at half resolution, where each one
 * covers four times the area it would at full size, which is what makes the
 * discs fill in instead of reading as a spray of dots.
 */
const TAPS = 96;

/**
 * Samples for the short gather that runs at full resolution. It only ever has
 * to cover a few pixels, so it needs far fewer of them.
 */
const FINE_TAPS = 40;

/** Samples for the separate gather that collects a foreground's spill. */
const NEAR_TAPS = 40;

/** Steps to each side in one direction of the near-field dilation. */
const DILATE_STEPS = 16;

/**
 * Where the full-resolution gather hands over to the half-size one, in pixels.
 * Everything below this never touches the smaller buffer, which is what keeps
 * a barely-defocused edge from arriving already softened by the upsample.
 */
const FINE_MAX = 7;

export function focalToFov(focal: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT / (2 * Math.max(4, focal))) * 180) / Math.PI;
}

/**
 * Where the field of acceptable focus starts and ends, in world units, and how
 * large the subject lands on the sensor. This is the same optics the shader
 * uses, so the numbers the panel prints match the pixels it produces.
 */
export function focusField(settings: {
  focus: number;
  aperture: number;
  focalLength: number;
  worldMm: number;
}): { near: number; far: number; magnification: number; hyperfocal: number } {
  const f = settings.focalLength;
  const n = Math.max(0.05, settings.aperture);
  // A full-frame circle of confusion, the usual standard for "sharp enough".
  const c = 0.029;
  const s = Math.max(f + 0.001, settings.focus * settings.worldMm);

  const hyperfocal = (f * f) / (n * c) + f;
  const near = (s * (hyperfocal - f)) / (hyperfocal + s - 2 * f);
  const rawFar = (s * (hyperfocal - f)) / (hyperfocal - s);
  const far = s >= hyperfocal || rawFar < 0 ? Infinity : rawFar;

  return {
    near: near / settings.worldMm,
    far: far / settings.worldMm,
    magnification: f / Math.max(0.001, s - f),
    hyperfocal: hyperfocal / settings.worldMm,
  };
}

export function fovToFocal(fov: number): number {
  return SENSOR_HEIGHT / (2 * Math.tan((fov * Math.PI) / 360));
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Lens maths and the signed circle of confusion, shared by every pass. */
const LENS = /* glsl */ `
uniform sampler2D uDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uFocal;
uniform float uMaxBlur;
uniform float uHighlight;
uniform float uWorldMm;
uniform vec2 uFullResolution;

float linearDepth(vec2 uv) {
  float d = texture2D(uDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

/**
 * Blur radius in full-resolution pixels, signed: negative in front of the focus
 * plane, positive behind it. The sign is what lets the gather tell a foreground
 * that may spill forwards from a background that may not.
 */
float signedCoc(float depth) {
  float f = uFocal;
  float s = max(f + 0.001, uFocus * uWorldMm);
  float d = max(f + 0.001, depth * uWorldMm);
  float c = (f * f * (d - s)) / (max(0.05, uAperture) * d * (s - f));
  float px = c / SENSOR * uFullResolution.y;
  return clamp(px, -uMaxBlur, uMaxBlur);
}

/** Packs the signed radius into a colour channel: 0.5 is perfectly sharp. */
float packCoc(float coc) { return 0.5 + 0.5 * coc / max(1.0, uMaxBlur); }
float unpackCoc(float packed) { return (packed - 0.5) * 2.0 * max(1.0, uMaxBlur); }

/**
 * How much a sample counts for in the gather. A real lens spreads a highlight
 * evenly over the whole disc, so a bright sample has to outweigh its dim
 * neighbours or the disc averages away into a grey smear instead of reading as
 * a ball of light. Nothing below white is touched.
 */
/**
 * A rotation for this pixel's sample disc. It has to be free of any repeating
 * structure: an ordered pattern turns the gather's variance into a visible
 * lattice, where plain noise leaves grain that the tent filter can average out.
 */
float discRotation(vec2 pixel) {
  vec3 p = fract(vec3(pixel.xyx) * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z) * 6.2831853;
}

float highlightWeight(vec3 c) {
  float l = max(max(c.r, c.g), c.b);
  return 1.0 + uHighlight * smoothstep(0.9, 2.4, l) * 6.0;
}
`;

/** Pulls a point on the unit disc onto the polygon the iris blades would cut. */
const IRIS = /* glsl */ `
uniform float uBlades;
uniform float uBladeAngle;

vec2 irisShape(vec2 dir, float radius) {
  if (uBlades < 2.5) return dir * radius;
  float n = floor(uBlades);
  float angle = atan(dir.y, dir.x) + uBladeAngle;
  float segment = 6.2831853 / n;
  float edge = cos(segment * 0.5) / max(0.001, cos(mod(angle, segment) - segment * 0.5));
  return dir * radius * edge;
}
`;

/**
 * Half-resolution prefilter. Averages colour and keeps the strongest circle of
 * confusion of the four source pixels, so a thin foreground edge is not lost
 * before it has had the chance to spread.
 */
const PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D uColor;
varying vec2 vUv;
${LENS}

void main() {
  vec2 texel = 1.0 / uFullResolution;
  vec3 colour = vec3(0.0);
  float strongest = 0.0;

  for (int y = 0; y < 2; y++) {
    for (int x = 0; x < 2; x++) {
      vec2 uv = vUv + (vec2(float(x), float(y)) - 0.25) * texel;
      colour += texture2D(uColor, uv).rgb;
      float coc = signedCoc(linearDepth(uv));
      if (abs(coc) > abs(strongest)) strongest = coc;
    }
  }

  gl_FragColor = vec4(colour * 0.25, packCoc(strongest));
}
`;

/**
 * How far a foreground can spill, dilated over the frame in two directions.
 * Probing a ring of fixed directions around each pixel instead, which is the
 * obvious shortcut, makes the reach flick on and off as the ring crosses a
 * silhouette, and that prints a row of scallops along every foreground edge.
 * A pass like this samples the same offsets at every pixel, so it cannot.
 */
const DILATE = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uHalfResolution;
uniform vec2 uDirection;
uniform float uSourceIsReach;
varying vec2 vUv;
${LENS}

void main() {
  float limit = max(1.0, uMaxBlur * 0.5);
  float stepPx = max(1.0, limit / float(${DILATE_STEPS}));
  float reach = 0.0;

  for (int i = -${DILATE_STEPS}; i <= ${DILATE_STEPS}; i++) {
    vec2 uv = clamp(vUv + uDirection * (float(i) * stepPx) / uHalfResolution, 0.0, 1.0);
    float a = texture2D(uSource, uv).a;
    // Radii are halved because everything here runs on the half-size buffer.
    reach = max(reach, uSourceIsReach > 0.5 ? a : max(0.0, -unpackCoc(a)) * 0.5);
  }

  gl_FragColor = vec4(0.0, 0.0, 0.0, reach);
}
`;

/**
 * The bokeh gather. Samples sit on a golden-angle disc so they spread evenly
 * with no rings, and each one only lands when its own circle is wide enough to
 * reach the pixel being shaded.
 */
const BOKEH = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uReach;
uniform vec2 uHalfResolution;
varying vec2 vUv;
${LENS}
${IRIS}

void main() {
  vec4 centre = texture2D(uSource, vUv);
  float centreCoc = unpackCoc(centre.a);
  // Radii are halved because the gather runs on the half-size buffer.
  float centreRadius = abs(centreCoc) * 0.5;

  // How far a foreground sitting around this pixel could spill onto it.
  float nearReach = texture2D(uReach, vUv).a;

  // Turning the disc by a different angle on every pixel breaks the sample
  // pattern into fine grain instead of a visible moire on specular detail.
  float baseAngle = discRotation(vUv * uHalfResolution);

  // --- What this pixel sees through its own circle.
  vec3 sum = centre.rgb;
  float weight = 1.0;

  if (centreRadius >= 0.5) {
    // Samples sit roughly this far apart on the disc. Deciding whether a tap
    // reaches the pixel any more sharply than that turns the rim of a bokeh
    // into a chewed edge, because which taps land is dithered per pixel.
    float soft = clamp(centreRadius * 0.14, 0.7, 3.0);
    float centreWeight = highlightWeight(centre.rgb);
    sum = centre.rgb * centreWeight;
    weight = centreWeight;

    for (int i = 0; i < ${TAPS}; i++) {
      float t = (float(i) + 0.5) / float(${TAPS});
      // The square root spreads samples over the area, not over the radius.
      float r = sqrt(t) * centreRadius;
      float angle = baseAngle + float(i) * 2.39996323;
      vec2 offset = irisShape(vec2(cos(angle), sin(angle)), r);
      float dist = length(offset);
      vec2 uv = clamp(vUv + offset / uHalfResolution, 0.0, 1.0);

      vec4 tap = texture2D(uSource, uv);
      float tapCoc = unpackCoc(tap.a);
      float tapRadius = abs(tapCoc) * 0.5;

      // Anything at or behind this pixel belongs inside its circle. Anything
      // in front only counts once its own circle reaches across.
      float behind = smoothstep(centreCoc - soft, centreCoc + soft, tapCoc);
      float spill = smoothstep(dist + soft, dist - soft, tapRadius);
      float w = max(behind, spill) * highlightWeight(tap.rgb);

      sum += tap.rgb * w;
      weight += w;
    }
  }

  vec3 own = sum / weight;

  // --- What a foreground in front of this pixel spills onto it. It has to be
  // gathered over its own, wider circle and kept apart from the pass above:
  // pooling the two lets the background, which fills most of the disc, outvote
  // the foreground, and a silhouette that should melt stays cut out instead.
  vec3 nearSum = vec3(0.0);
  float nearWeight = 0.0;
  float coverSum = 0.0;

  if (nearReach >= 0.5) {
    float nearSoft = clamp(nearReach * 0.14, 0.7, 3.0);

    for (int i = 0; i < ${NEAR_TAPS}; i++) {
      float t = (float(i) + 0.5) / float(${NEAR_TAPS});
      float r = sqrt(t) * nearReach;
      // Offset from the other disc's angles so the two do not sample in step.
      float angle = baseAngle + 1.0 + float(i) * 2.39996323;
      vec2 offset = irisShape(vec2(cos(angle), sin(angle)), r);
      float dist = length(offset);
      vec2 uv = clamp(vUv + offset / uHalfResolution, 0.0, 1.0);

      vec4 tap = texture2D(uSource, uv);
      float tapCoc = unpackCoc(tap.a);
      float reach = smoothstep(dist + nearSoft, dist - nearSoft, abs(tapCoc) * 0.5);
      float w = reach * step(tapCoc, -0.001);

      nearSum += tap.rgb * w;
      nearWeight += w;
      // A mean over every tap is smooth where a maximum over dithered taps
      // would be a coin toss, and a coin toss prints as stipple.
      coverSum += w;
    }
  }

  float coverage = clamp(coverSum / float(${NEAR_TAPS}) * 1.3, 0.0, 1.0);
  vec3 near = nearSum / max(0.0001, nearWeight);

  gl_FragColor = vec4(mix(own, near, coverage), coverage);
}
`;

/**
 * A three by three tent over the gathered bokeh. However many samples the
 * gather spends, a wide disc is still covered sparsely enough that the spiral
 * they sit on shows as a faint weave. Averaging each half-size pixel with its
 * neighbours erases that at a fraction of the cost of the samples it would
 * otherwise take, and a disc tens of pixels across barely notices.
 */
const POSTBLUR = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uCoc;
uniform vec2 uHalfResolution;
varying vec2 vUv;
${LENS}

void main() {
  // A wide disc is sampled thinly, so it needs the most smoothing; a narrow one
  // would only lose its shape to it. Reading the radius here lets the filter
  // take exactly as much as each part of the frame can afford.
  float radius = abs(unpackCoc(texture2D(uCoc, vUv).a)) * 0.5;
  float spread = clamp(radius * 0.18, 1.0, 4.0);

  vec2 texel = spread / uHalfResolution;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      float w = (x == 0 ? 2.0 : 1.0) * (y == 0 ? 2.0 : 1.0);
      sum += texture2D(uSource, vUv + vec2(float(x), float(y)) * texel) * w;
      total += w;
    }
  }
  gl_FragColor = sum / total;
}
`;

/**
 * Puts the frame back together in three tiers. In focus, the original pixels
 * are used untouched. Just off focus, a short gather runs here at full
 * resolution. Only past that does the half-size bokeh take over, so nothing
 * crisp is ever built from an enlarged buffer. Everything to this point has
 * worked in linear light, so tone mapping and the colour transform happen once,
 * at the very end, exactly as they would on a direct render.
 */
const COMPOSITE = /* glsl */ `
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uBlur;
varying vec2 vUv;
${LENS}
${IRIS}

/**
 * The short gather, at full resolution. Its radius is capped, so it stays dense
 * enough to look like optics rather than a sample pattern, and it is the only
 * thing that ever renders the first few pixels of defocus.
 */
vec3 fineGather(float centreCoc) {
  vec3 centre = texture2D(uColor, vUv).rgb;

  // A foreground spilling onto this pixel is the wide pass's business, and the
  // composite blends its answer in by coverage. All this tier owes is the first
  // few pixels of the pixel's own defocus.
  float gather = min(FINE_MAX, abs(centreCoc));
  if (gather < 0.5) return centre;

  float baseAngle = discRotation(vUv * uFullResolution);

  float centreWeight = highlightWeight(centre);
  vec3 sum = centre * centreWeight;
  float weight = centreWeight;
  float soft = clamp(gather * 0.25, 0.6, 2.0);

  for (int i = 0; i < ${FINE_TAPS}; i++) {
    float t = (float(i) + 0.5) / float(${FINE_TAPS});
    float r = sqrt(t) * gather;
    float angle = baseAngle + float(i) * 2.39996323;
    vec2 offset = irisShape(vec2(cos(angle), sin(angle)), r);
    float dist = length(offset);
    vec2 uv = clamp(vUv + offset / uFullResolution, 0.0, 1.0);

    vec3 tap = texture2D(uColor, uv).rgb;
    float tapCoc = signedCoc(linearDepth(uv));
    float behind = smoothstep(centreCoc - soft, centreCoc + soft, tapCoc);
    float spill = smoothstep(dist + soft, dist - soft, abs(tapCoc));
    float w = max(behind, spill) * highlightWeight(tap);
    sum += tap * w;
    weight += w;
  }

  return sum / weight;
}

void main() {
  vec4 sharp = texture2D(uColor, vUv);
  float coc = signedCoc(linearDepth(vUv));
  float radius = abs(coc);
  float wideNear = texture2D(uBlur, vUv).a;

  // Past this point the wide blur is the whole answer and the two finer tiers
  // would only cost time.
  float wideMix = clamp(max(smoothstep(FINE_MAX * 0.7, FINE_MAX * 1.6, radius), wideNear), 0.0, 1.0);

  vec3 result;
  if (wideMix > 0.995) {
    result = texture2D(uBlur, vUv).rgb;
  } else if (radius > 0.4 || wideNear > 0.002) {
    // How far the fine tier has taken over is read from this pixel's own circle
    // and nothing else. Deriving it from dithered samples instead, as the near
    // mask below is, would print the sample pattern along every silhouette.
    vec3 fine = fineGather(coc);
    result = mix(sharp.rgb, fine, smoothstep(0.4, 1.6, radius));
    if (wideMix > 0.002) {
      result = mix(result, texture2D(uBlur, vUv).rgb, wideMix);
    }
  } else {
    result = sharp.rgb;
  }

  gl_FragColor = vec4(result, sharp.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Shows one of the intermediate buffers on screen, for diagnosing a pass. */
const INSPECT = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform float uAlphaOnly;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(uSource, vUv);
  gl_FragColor = vec4(uAlphaOnly > 0.5 ? vec3(c.a) : c.rgb, 1.0);
}
`;

const DEBUG = /* glsl */ `
precision highp float;
uniform float uMode;
varying vec2 vUv;
${LENS}
void main() {
  float depth = linearDepth(vUv);
  float v = uMode < 1.5 ? depth / uFar : abs(signedCoc(depth)) / max(1.0, uMaxBlur);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`;

export type DepthOfFieldSettings = {
  focus: number;
  aperture: number;
  focalLength: number;
  maxBlur: number;
  blades: number;
  bladeAngle: number;
  /** How strongly highlights gather into bokeh discs. */
  highlight: number;
  /** Millimetres one world unit stands for; smaller means a macro lens. */
  worldMm: number;
};

type Uniforms = Record<string, THREE.IUniform>;

function lensUniforms(): Uniforms {
  return {
    uDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 200 },
    uFocus: { value: 8 },
    uAperture: { value: 2.8 },
    uFocal: { value: 50 },
    uMaxBlur: { value: 24 },
    uHighlight: { value: 1 },
    uWorldMm: { value: WORLD_TO_MM },
    uFullResolution: { value: new THREE.Vector2(1, 1) },
  };
}

const DEFINES = [
  `#define SENSOR ${SENSOR_HEIGHT.toFixed(1)}`,
  `#define FINE_MAX ${FINE_MAX.toFixed(1)}`,
].join("\n");

function makeMaterial(fragment: string, extra: Uniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...lensUniforms(), ...extra },
    vertexShader: VERTEX,
    fragmentShader: `${DEFINES}\n${fragment}`,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Depth of field at half size: prefilter, dilate how far the foreground
 * reaches, gather the wide bokeh, tent-filter it, then composite, which does
 * its own short gather at full resolution before falling back on the half-size
 * one. Splitting it this way buys the wide blur its sample density without
 * softening what is in focus.
 */
export class DepthOfFieldPass {
  /**
   * 0 renders normally. 1 shows linear depth, 2 the blur radius, 3 the gathered
   * bokeh before the tent filter, 4 after it, and 5 the near-field mask.
   */
  static debug = 0;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly prefilter: THREE.ShaderMaterial;
  private readonly dilate: THREE.ShaderMaterial;
  private readonly bokeh: THREE.ShaderMaterial;
  private readonly postblur: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly debugMaterial: THREE.ShaderMaterial;
  private readonly inspect: THREE.ShaderMaterial;

  private sceneTarget: THREE.WebGLRenderTarget | null = null;
  private halfA: THREE.WebGLRenderTarget | null = null;
  private halfB: THREE.WebGLRenderTarget | null = null;
  private halfC: THREE.WebGLRenderTarget | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.prefilter = makeMaterial(PREFILTER, { uColor: { value: null } });
    this.dilate = makeMaterial(DILATE, {
      uSource: { value: null },
      uHalfResolution: { value: new THREE.Vector2(1, 1) },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uSourceIsReach: { value: 0 },
    });
    this.bokeh = makeMaterial(BOKEH, {
      uSource: { value: null },
      uReach: { value: null },
      uHalfResolution: { value: new THREE.Vector2(1, 1) },
      uBlades: { value: 0 },
      uBladeAngle: { value: 0 },
    });
    this.postblur = makeMaterial(POSTBLUR, {
      uSource: { value: null },
      uCoc: { value: null },
      uHalfResolution: { value: new THREE.Vector2(1, 1) },
    });
    this.composite = makeMaterial(COMPOSITE, {
      uColor: { value: null },
      uBlur: { value: null },
      uBlades: { value: 0 },
      uBladeAngle: { value: 0 },
    });
    this.debugMaterial = makeMaterial(DEBUG, { uMode: { value: 1 } });
    this.inspect = makeMaterial(INSPECT, { uSource: { value: null }, uAlphaOnly: { value: 0 } });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private ensureTargets(width: number, height: number) {
    if (this.sceneTarget && this.width === width && this.height === height) return;
    this.sceneTarget?.dispose();
    this.halfA?.dispose();
    this.halfB?.dispose();
    this.halfC?.dispose();
    this.width = width;
    this.height = height;

    // Half float keeps highlights above white alive through the blur, which is
    // what turns a bright spot into a bokeh ball once tone mapping runs.
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
    } as const;

    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, { ...options, depthBuffer: true });
    this.sceneTarget.depthTexture = new THREE.DepthTexture(width, height);
    this.sceneTarget.depthTexture.type = THREE.UnsignedIntType;

    const halfWidth = Math.max(2, Math.floor(width / 2));
    const halfHeight = Math.max(2, Math.floor(height / 2));
    this.halfA = new THREE.WebGLRenderTarget(halfWidth, halfHeight, { ...options, depthBuffer: false });
    this.halfB = new THREE.WebGLRenderTarget(halfWidth, halfHeight, { ...options, depthBuffer: false });
    this.halfC = new THREE.WebGLRenderTarget(halfWidth, halfHeight, { ...options, depthBuffer: false });
  }

  private setLens(material: THREE.ShaderMaterial, camera: THREE.PerspectiveCamera, settings: DepthOfFieldSettings) {
    const u = material.uniforms;
    u.uDepth.value = this.sceneTarget!.depthTexture;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = settings.focus;
    u.uAperture.value = settings.aperture;
    u.uFocal.value = settings.focalLength;
    u.uMaxBlur.value = Math.max(1, settings.maxBlur);
    u.uHighlight.value = Math.max(0, settings.highlight);
    u.uWorldMm.value = Math.max(0.1, settings.worldMm);
    (u.uFullResolution.value as THREE.Vector2).set(this.width, this.height);
  }

  private draw(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    settings: DepthOfFieldSettings,
  ) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.ensureTargets(Math.max(2, size.x), Math.max(2, size.y));
    const sceneTarget = this.sceneTarget!;
    const halfA = this.halfA!;
    const halfB = this.halfB!;
    const halfC = this.halfC!;
    const previousTarget = renderer.getRenderTarget();

    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    for (const material of [this.prefilter, this.dilate, this.bokeh, this.postblur, this.composite, this.debugMaterial]) {
      this.setLens(material, camera, settings);
    }

    if (DepthOfFieldPass.debug > 0 && DepthOfFieldPass.debug < 3) {
      this.debugMaterial.uniforms.uMode.value = DepthOfFieldPass.debug;
      this.draw(renderer, this.debugMaterial, previousTarget);
      return;
    }

    this.prefilter.uniforms.uColor.value = sceneTarget.texture;
    this.draw(renderer, this.prefilter, halfA);

    // Dilate the foreground's reach across the frame, one direction at a time.
    const dilateResolution = this.dilate.uniforms.uHalfResolution.value as THREE.Vector2;
    dilateResolution.set(halfA.width, halfA.height);
    const direction = this.dilate.uniforms.uDirection.value as THREE.Vector2;

    this.dilate.uniforms.uSource.value = halfA.texture;
    this.dilate.uniforms.uSourceIsReach.value = 0;
    direction.set(1, 0);
    this.draw(renderer, this.dilate, halfB);

    this.dilate.uniforms.uSource.value = halfB.texture;
    this.dilate.uniforms.uSourceIsReach.value = 1;
    direction.set(0, 1);
    this.draw(renderer, this.dilate, halfC);

    this.bokeh.uniforms.uSource.value = halfA.texture;
    this.bokeh.uniforms.uReach.value = halfC.texture;
    (this.bokeh.uniforms.uHalfResolution.value as THREE.Vector2).set(halfA.width, halfA.height);
    this.bokeh.uniforms.uBlades.value = settings.blades;
    this.bokeh.uniforms.uBladeAngle.value = settings.bladeAngle;
    this.draw(renderer, this.bokeh, halfB);

    this.postblur.uniforms.uSource.value = halfB.texture;
    this.postblur.uniforms.uCoc.value = halfA.texture;
    (this.postblur.uniforms.uHalfResolution.value as THREE.Vector2).set(halfB.width, halfB.height);
    this.draw(renderer, this.postblur, halfC);

    const inspecting = DepthOfFieldPass.debug;
    if (inspecting >= 3) {
      this.inspect.uniforms.uSource.value = inspecting === 3 ? halfB.texture : halfC.texture;
      this.inspect.uniforms.uAlphaOnly.value = inspecting === 5 ? 1 : 0;
      this.draw(renderer, this.inspect, previousTarget);
      return;
    }

    this.composite.uniforms.uColor.value = sceneTarget.texture;
    this.composite.uniforms.uBlur.value = halfC.texture;
    this.composite.uniforms.uBlades.value = settings.blades;
    this.composite.uniforms.uBladeAngle.value = settings.bladeAngle;
    this.draw(renderer, this.composite, previousTarget);
  }

  dispose() {
    this.sceneTarget?.dispose();
    this.halfA?.dispose();
    this.halfB?.dispose();
    this.halfC?.dispose();
    this.quad.geometry.dispose();
    this.prefilter.dispose();
    this.dilate.dispose();
    this.bokeh.dispose();
    this.postblur.dispose();
    this.composite.dispose();
    this.debugMaterial.dispose();
    this.inspect.dispose();
  }
}
