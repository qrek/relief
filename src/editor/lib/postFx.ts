import * as THREE from "three";

/** Full-frame sensor height in millimetres, so focal length reads like a real lens. */
export const SENSOR_HEIGHT = 24;

/**
 * How big a world unit is in millimetres. Scenes here are built at tabletop
 * scale, so one unit is treated as five centimetres: that is what makes a
 * realistic aperture produce a realistic amount of blur.
 */
export const WORLD_TO_MM = 50;

/**
 * Samples on the bokeh disc. They are spent at half resolution, where each one
 * covers four times the area it would at full size, which is what makes the
 * discs fill in instead of reading as a spray of dots.
 */
const TAPS = 96;

export function focalToFov(focal: number): number {
  return (2 * Math.atan(SENSOR_HEIGHT / (2 * Math.max(4, focal))) * 180) / Math.PI;
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
  float s = max(f + 0.001, uFocus * WORLD_MM);
  float d = max(f + 0.001, depth * WORLD_MM);
  float c = (f * f * (d - s)) / (max(0.05, uAperture) * d * (s - f));
  float px = c / SENSOR * uFullResolution.y;
  return clamp(px, -uMaxBlur, uMaxBlur);
}

/** Packs the signed radius into a colour channel: 0.5 is perfectly sharp. */
float packCoc(float coc) { return 0.5 + 0.5 * coc / max(1.0, uMaxBlur); }
float unpackCoc(float packed) { return (packed - 0.5) * 2.0 * max(1.0, uMaxBlur); }
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
 * The bokeh gather. Samples sit on a golden-angle disc so they spread evenly
 * with no rings, and each one only lands when its own circle is wide enough to
 * reach the pixel being shaded.
 */
const BOKEH = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
uniform vec2 uHalfResolution;
uniform float uBlades;
uniform float uBladeAngle;
varying vec2 vUv;
${LENS}

/** Pulls a point on the unit disc onto the polygon the iris blades would cut. */
vec2 irisShape(vec2 dir, float radius) {
  if (uBlades < 2.5) return dir * radius;
  float n = floor(uBlades);
  float angle = atan(dir.y, dir.x) + uBladeAngle;
  float segment = 6.2831853 / n;
  float edge = cos(segment * 0.5) / max(0.001, cos(mod(angle, segment) - segment * 0.5));
  return dir * radius * edge;
}

void main() {
  vec4 centre = texture2D(uSource, vUv);
  float centreCoc = unpackCoc(centre.a);
  // Radii are halved because the gather runs on the half-size buffer.
  float centreRadius = abs(centreCoc) * 0.5;

  // How far a foreground sitting around this pixel could spill onto it. Without
  // this, a sharp pixel would gather nothing and an out-of-focus foreground
  // would stop dead at its own silhouette.
  float nearReach = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) / 8.0 * 6.2831853;
    vec2 uv = clamp(vUv + vec2(cos(a), sin(a)) * uMaxBlur * 0.5 / uHalfResolution, 0.0, 1.0);
    float c = unpackCoc(texture2D(uSource, uv).a);
    if (c < 0.0) nearReach = max(nearReach, abs(c) * 0.5);
  }

  // Sampling the pixel's own circle rather than a fixed maximum is what keeps
  // the disc densely covered at every blur size, so no sample pattern shows.
  float gather = max(centreRadius, nearReach);
  if (gather < 0.5) {
    gl_FragColor = vec4(centre.rgb, 0.0);
    return;
  }

  // Turning the disc by a different angle on every pixel breaks the sample
  // pattern into fine grain instead of a visible moiré on specular detail.
  float dither = fract(52.9829189 * fract(dot(vUv * uHalfResolution, vec2(0.06711056, 0.00583715))));
  float baseAngle = dither * 6.2831853;

  vec3 sum = centre.rgb;
  float weight = 1.0;
  float nearCoverage = 0.0;

  for (int i = 0; i < ${TAPS}; i++) {
    float t = (float(i) + 0.5) / float(${TAPS});
    // The square root spreads samples evenly over the area rather than the radius.
    float r = sqrt(t) * gather;
    float angle = baseAngle + float(i) * 2.39996323;
    vec2 offset = irisShape(vec2(cos(angle), sin(angle)), r);
    float dist = length(offset);
    vec2 uv = clamp(vUv + offset / uHalfResolution, 0.0, 1.0);

    vec4 tap = texture2D(uSource, uv);
    float tapCoc = unpackCoc(tap.a);
    float tapRadius = abs(tapCoc) * 0.5;

    // Anything at or behind this pixel belongs inside its circle. Anything in
    // front only counts once its own circle is wide enough to reach across.
    float behind = step(centreCoc, tapCoc);
    float spill = smoothstep(dist + 0.5, dist - 0.5, tapRadius);
    float w = max(behind, spill);

    sum += tap.rgb * w;
    weight += w;

    // Remember how much of this pixel a foreground covers, so the composite
    // knows to hide the sharp image underneath it.
    if (tapCoc < 0.0) nearCoverage = max(nearCoverage, spill);
  }

  gl_FragColor = vec4(sum / weight, clamp(nearCoverage, 0.0, 1.0));
}
`;

/**
 * Puts the sharp frame and the blurred one back together. Everything up to here
 * has worked in linear light, so tone mapping and the colour transform happen
 * once, at the very end, exactly as they would on a direct render.
 */
const COMPOSITE = /* glsl */ `
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uBlur;
varying vec2 vUv;
${LENS}

void main() {
  vec4 sharp = texture2D(uColor, vUv);
  vec4 blurred = texture2D(uBlur, vUv);
  float coc = abs(signedCoc(linearDepth(vUv)));

  // Below about a pixel of blur there is nothing to gain from the soft copy.
  float mixAmount = smoothstep(0.75, 2.5, coc);
  // A foreground spilling over this pixel wins regardless of its own sharpness.
  mixAmount = clamp(max(mixAmount, blurred.a), 0.0, 1.0);

  gl_FragColor = vec4(mix(sharp.rgb, blurred.rgb, mixAmount), sharp.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
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
    uFullResolution: { value: new THREE.Vector2(1, 1) },
  };
}

const DEFINES = [
  `#define SENSOR ${SENSOR_HEIGHT.toFixed(1)}`,
  `#define WORLD_MM ${WORLD_TO_MM.toFixed(1)}`,
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
 * Depth of field in three passes: prefilter to half size, gather the bokeh
 * there, then composite back over the sharp frame. Splitting it this way is
 * what buys the sample density a clean lens blur needs.
 */
export class DepthOfFieldPass {
  /** 0 renders normally, 1 shows linear depth, 2 shows the blur radius. */
  static debug = 0;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly prefilter: THREE.ShaderMaterial;
  private readonly bokeh: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly debugMaterial: THREE.ShaderMaterial;

  private sceneTarget: THREE.WebGLRenderTarget | null = null;
  private halfA: THREE.WebGLRenderTarget | null = null;
  private halfB: THREE.WebGLRenderTarget | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.prefilter = makeMaterial(PREFILTER, { uColor: { value: null } });
    this.bokeh = makeMaterial(BOKEH, {
      uSource: { value: null },
      uHalfResolution: { value: new THREE.Vector2(1, 1) },
      uBlades: { value: 0 },
      uBladeAngle: { value: 0 },
    });
    this.composite = makeMaterial(COMPOSITE, { uColor: { value: null }, uBlur: { value: null } });
    this.debugMaterial = makeMaterial(DEBUG, { uMode: { value: 1 } });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private ensureTargets(width: number, height: number) {
    if (this.sceneTarget && this.width === width && this.height === height) return;
    this.sceneTarget?.dispose();
    this.halfA?.dispose();
    this.halfB?.dispose();
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
    const previousTarget = renderer.getRenderTarget();

    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    for (const material of [this.prefilter, this.bokeh, this.composite, this.debugMaterial]) {
      this.setLens(material, camera, settings);
    }

    if (DepthOfFieldPass.debug > 0) {
      this.debugMaterial.uniforms.uMode.value = DepthOfFieldPass.debug;
      this.draw(renderer, this.debugMaterial, previousTarget);
      return;
    }

    this.prefilter.uniforms.uColor.value = sceneTarget.texture;
    this.draw(renderer, this.prefilter, halfA);

    this.bokeh.uniforms.uSource.value = halfA.texture;
    (this.bokeh.uniforms.uHalfResolution.value as THREE.Vector2).set(halfA.width, halfA.height);
    this.bokeh.uniforms.uBlades.value = settings.blades;
    this.bokeh.uniforms.uBladeAngle.value = settings.bladeAngle;
    this.draw(renderer, this.bokeh, halfB);

    this.composite.uniforms.uColor.value = sceneTarget.texture;
    this.composite.uniforms.uBlur.value = halfB.texture;
    this.draw(renderer, this.composite, previousTarget);
  }

  dispose() {
    this.sceneTarget?.dispose();
    this.halfA?.dispose();
    this.halfB?.dispose();
    this.quad.geometry.dispose();
    this.prefilter.dispose();
    this.bokeh.dispose();
    this.composite.dispose();
    this.debugMaterial.dispose();
  }
}
