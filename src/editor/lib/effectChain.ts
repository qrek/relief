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
