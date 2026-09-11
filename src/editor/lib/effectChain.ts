import * as THREE from "three";
import { GLSL_PREAMBLE, effectById, type EffectDef } from "../presets/effects";
import { TAU } from "./clock";
import type { EffectInstance } from "../types";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function fragmentFor(def: EffectDef): string {
  const params = def.params.map((p) => `uniform float p_${p.key};`).join("\n");
  const colors = def.colors.map((c) => `uniform vec3 c_${c.key};`).join("\n");
  return /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;
${params}
${colors}
varying vec2 vUv;
${GLSL_PREAMBLE}
void main() {
  vec2 uv = vUv;
  vec4 col = texture2D(uMap, uv);
${def.glsl}
  gl_FragColor = col;
}
`;
}

const materials = new Map<string, THREE.ShaderMaterial>();

function materialFor(def: EffectDef): THREE.ShaderMaterial {
  let mat = materials.get(def.id);
  if (mat) return mat;
  const uniforms: Record<string, THREE.IUniform> = {
    uMap: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAspect: { value: 1 },
  };
  for (const p of def.params) uniforms[`p_${p.key}`] = { value: p.default };
  for (const c of def.colors) uniforms[`c_${c.key}`] = { value: new THREE.Color(c.default) };
  mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: fragmentFor(def),
    depthTest: false,
    depthWrite: false,
  });
  materials.set(def.id, mat);
  return mat;
}

export const MAX_CHAIN_SIZE = 2048;

/** Keeps what is brighter than the threshold, with a soft knee so nothing pops. */
const BLOOM_PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  // A small box here, so single bright pixels do not flicker between cells.
  vec3 c = texture2D(uMap, vUv).rgb * 0.5
    + texture2D(uMap, vUv + uTexel * vec2(1.0, 1.0)).rgb * 0.125
    + texture2D(uMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 0.125
    + texture2D(uMap, vUv + uTexel * vec2(1.0, -1.0)).rgb * 0.125
    + texture2D(uMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 0.125;
  float br = max(max(c.r, c.g), c.b);
  float knee = uThreshold * uKnee;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float keep = max(soft, br - uThreshold) / max(br, 0.0001);
  gl_FragColor = vec4(c * keep, 1.0);
}
`;

/** One step down the pyramid: a cross of four half-texel taps around the centre. */
const BLOOM_DOWN = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb * 4.0
    + texture2D(uMap, vUv + uTexel).rgb
    + texture2D(uMap, vUv - uTexel).rgb
    + texture2D(uMap, vUv + vec2(uTexel.x, -uTexel.y)).rgb
    + texture2D(uMap, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`;

/** One step back up: a tent over the level below, added to this level. */
const BLOOM_UP = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform sampler2D uAdd;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(uMap, vUv + vec2(-uTexel.x * 2.0, 0.0)).rgb
    + texture2D(uMap, vUv + vec2(-uTexel.x, uTexel.y)).rgb * 2.0
    + texture2D(uMap, vUv + vec2(0.0, uTexel.y * 2.0)).rgb
    + texture2D(uMap, vUv + vec2(uTexel.x, uTexel.y)).rgb * 2.0
    + texture2D(uMap, vUv + vec2(uTexel.x * 2.0, 0.0)).rgb
    + texture2D(uMap, vUv + vec2(uTexel.x, -uTexel.y)).rgb * 2.0
    + texture2D(uMap, vUv + vec2(0.0, -uTexel.y * 2.0)).rgb
    + texture2D(uMap, vUv + vec2(-uTexel.x, -uTexel.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 + texture2D(uAdd, vUv).rgb, 1.0);
}
`;

/** Lays the gathered glow over the picture. */
const BLOOM_COMPOSITE = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform sampler2D uGlow;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(uMap, vUv);
  gl_FragColor = vec4(base.rgb + texture2D(uGlow, vUv).rgb * uIntensity, base.a);
}
`;

const BLOOM_MAX_LEVELS = 7;

function quadMaterial(fragment: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: fragment,
    depthTest: false,
    depthWrite: false,
  });
}

/**
 * Bloom as a pyramid rather than a single blur. What is brighter than the
 * threshold is taken down through halving levels and brought back up with a
 * tent at each step, so the glow spreads as far as the spread asks without
 * ever showing a kernel. This is the only way a glow reads as light rather
 * than as a smudge, and it costs a handful of small passes.
 */
class BloomStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly prefilter: THREE.ShaderMaterial;
  private readonly down: THREE.ShaderMaterial;
  private readonly up: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private downs: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private width = 0;
  private height = 0;

  constructor() {
    this.prefilter = quadMaterial(BLOOM_PREFILTER, {
      uMap: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0.6 },
      uKnee: { value: 0.5 },
    });
    this.down = quadMaterial(BLOOM_DOWN, { uMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = quadMaterial(BLOOM_UP, {
      uMap: { value: null },
      uAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
    });
    this.composite = quadMaterial(BLOOM_COMPOSITE, {
      uMap: { value: null },
      uGlow: { value: null },
      uIntensity: { value: 0.8 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private ensure(width: number, height: number) {
    if (this.downs.length && this.width === width && this.height === height) return;
    this.disposeTargets();
    this.width = width;
    this.height = height;
    let w = width;
    let h = height;
    for (let i = 0; i < BLOOM_MAX_LEVELS; i++) {
      w = Math.max(2, Math.floor(w / 2));
      h = Math.max(2, Math.floor(h / 2));
      const make = () =>
        new THREE.WebGLRenderTarget(w, h, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          type: THREE.HalfFloatType,
          depthBuffer: false,
          stencilBuffer: false,
        });
      this.downs.push(make());
      this.ups.push(make());
      if (w <= 4 || h <= 4) break;
    }
  }

  private disposeTargets() {
    for (const rt of this.downs) rt.dispose();
    for (const rt of this.ups) rt.dispose();
    this.downs = [];
    this.ups = [];
  }

  private draw(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  render(
    renderer: THREE.WebGLRenderer,
    source: THREE.Texture,
    params: Record<string, number>,
    width: number,
    height: number,
    out: THREE.WebGLRenderTarget,
  ) {
    this.ensure(width, height);
    // Spread runs 1 to 30; each level doubles the reach, so the count follows its log.
    const spread = params.radius ?? 12;
    const levels = Math.max(2, Math.min(this.downs.length, Math.round(1.5 + Math.log2(Math.max(1, spread)))));

    const pre = this.prefilter.uniforms;
    pre.uMap.value = source;
    (pre.uTexel.value as THREE.Vector2).set(1 / width, 1 / height);
    pre.uThreshold.value = params.threshold ?? 0.6;
    pre.uKnee.value = Math.max(0.01, params.knee ?? 0.5);
    this.draw(renderer, this.prefilter, this.downs[0]);

    for (let i = 1; i < levels; i++) {
      const from = this.downs[i - 1];
      this.down.uniforms.uMap.value = from.texture;
      (this.down.uniforms.uTexel.value as THREE.Vector2).set(1 / from.width, 1 / from.height);
      this.draw(renderer, this.down, this.downs[i]);
    }

    // Back up: each level takes the tent of the one below and adds its own.
    let below = this.downs[levels - 1];
    for (let i = levels - 2; i >= 0; i--) {
      this.up.uniforms.uMap.value = below.texture;
      this.up.uniforms.uAdd.value = this.downs[i].texture;
      (this.up.uniforms.uTexel.value as THREE.Vector2).set(1 / below.width, 1 / below.height);
      this.draw(renderer, this.up, this.ups[i]);
      below = this.ups[i];
    }

    this.composite.uniforms.uMap.value = source;
    this.composite.uniforms.uGlow.value = below.texture;
    this.composite.uniforms.uIntensity.value = params.intensity ?? 0.8;
    this.draw(renderer, this.composite, out);
  }

  dispose() {
    this.disposeTargets();
    this.quad.geometry.dispose();
    this.prefilter.dispose();
    this.down.dispose();
    this.up.dispose();
    this.composite.dispose();
  }
}

/**
 * Runs a stack of effects as successive full-screen passes over two ping-pong
 * targets and hands back the texture holding the result.
 *
 * Writes to a render target are colour-space neutral in three, so the whole
 * chain works on the media's own sRGB values and the final texture is tagged
 * sRGB for display.
 */
export class EffectChain {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private targets: THREE.WebGLRenderTarget[] = [];
  private bloom: BloomStage | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private ensureTargets(width: number, height: number) {
    if (this.targets.length === 2 && this.width === width && this.height === height) return;
    this.disposeTargets();
    this.width = width;
    this.height = height;
    this.targets = [0, 1].map(() => {
      const rt = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false,
        stencilBuffer: false,
      });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      rt.texture.generateMipmaps = false;
      return rt;
    });
  }

  private disposeTargets() {
    for (const rt of this.targets) rt.dispose();
    this.targets = [];
  }

  render(
    renderer: THREE.WebGLRenderer,
    source: THREE.Texture,
    effects: EffectInstance[],
    time: number,
    width: number,
    height: number,
  ): THREE.Texture {
    const active = effects.filter((e) => e.enabled && effectById(e.effectId));
    if (active.length === 0) return source;

    const w = Math.max(64, Math.round(width));
    const h = Math.max(64, Math.round(height));
    this.ensureTargets(w, h);

    const previousTarget = renderer.getRenderTarget();
    let input = source;
    let slot = 0;

    for (const instance of active) {
      const def = effectById(instance.effectId)!;

      // Bloom is not one pass but a pyramid, so it takes the slot itself.
      if (def.id === "bloom") {
        this.bloom ??= new BloomStage();
        const target = this.targets[slot];
        this.bloom.render(renderer, input, instance.params, w, h, target);
        input = target.texture;
        slot = 1 - slot;
        continue;
      }

      const mat = materialFor(def);
      mat.uniforms.uMap.value = input;
      mat.uniforms.uResolution.value.set(w, h);
      mat.uniforms.uAspect.value = w / h;
      // Time reaches the shaders as an angle in radians, one full turn per cycle.
      // Every animated effect is written to be periodic in it, so a clip lasting
      // 1/speed seconds loops without a seam.
      const speed = instance.params.speed ?? 1;
      mat.uniforms.uTime.value = TAU * speed * time;
      for (const p of def.params) {
        mat.uniforms[`p_${p.key}`].value = instance.params[p.key] ?? p.default;
      }
      for (const c of def.colors) {
        (mat.uniforms[`c_${c.key}`].value as THREE.Color).set(instance.colors[c.key] ?? c.default);
      }

      const target = this.targets[slot];
      this.quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(this.scene, this.camera);
      input = target.texture;
      slot = 1 - slot;
    }

    renderer.setRenderTarget(previousTarget);
    return input;
  }

  dispose() {
    this.disposeTargets();
    this.bloom?.dispose();
    this.quad.geometry.dispose();
  }
}

/** Media resolution clamped to something a three-pass chain can chew through. */
export function chainSize(naturalWidth: number, naturalHeight: number) {
  const longest = Math.max(naturalWidth, naturalHeight, 1);
  const scale = Math.min(1, MAX_CHAIN_SIZE / longest);
  return {
    width: Math.max(64, Math.round(naturalWidth * scale)),
    height: Math.max(64, Math.round(naturalHeight * scale)),
  };
}
