import * as THREE from "three";
import type { EffectInstance } from "../types";
import { effectById } from "../presets/effects";
import { EffectChain } from "./effectChain";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Turns the linear, unbounded frame into what would have reached the screen:
 * tone mapping, then the display transfer. Both are ordinarily applied by three
 * only when drawing straight to the canvas, so a pass that lands in a render
 * target has to do them by hand, with three's own functions, so the result is
 * pixel for pixel what the screen would have shown.
 */
const DEVELOP = /* glsl */ `
precision highp float;
// three only injects the tone mapping functions into a program that draws to
// the canvas. This one always draws into a target, so it brings them itself.
#include <tonemapping_pars_fragment>
uniform sampler2D uSource;
uniform int uToneMode;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(uSource, vUv);
  vec3 rgb = c.rgb;
  if (uToneMode == 1) rgb = LinearToneMapping(rgb);
  else if (uToneMode == 2) rgb = ReinhardToneMapping(rgb);
  else if (uToneMode == 3) rgb = CineonToneMapping(rgb);
  else if (uToneMode == 4) rgb = ACESFilmicToneMapping(rgb);
  else if (uToneMode == 6) rgb = AgXToneMapping(rgb);
  else if (uToneMode == 7) rgb = NeutralToneMapping(rgb);
  gl_FragColor = sRGBTransferOETF(vec4(rgb, c.a));
}
`;

/** Puts finished pixels on the canvas exactly as they are. */
const COPY = /* glsl */ `
precision highp float;
uniform sampler2D uSource;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uSource, vUv);
}
`;

const TONE_MODE: Partial<Record<THREE.ToneMapping, number>> = {
  [THREE.NoToneMapping]: 0,
  [THREE.LinearToneMapping]: 1,
  [THREE.ReinhardToneMapping]: 2,
  [THREE.CineonToneMapping]: 3,
  [THREE.ACESFilmicToneMapping]: 4,
  [THREE.AgXToneMapping]: 6,
  [THREE.NeutralToneMapping]: 7,
};

/** True when at least one effect in the stack would actually run. */
export function lookIsActive(look: EffectInstance[] | undefined): boolean {
  return !!look && look.some((e) => e.enabled && effectById(e.effectId));
}

/**
 * The look: a stack of effects over the whole finished frame. The scene, with
 * or without depth of field, is drawn into a target; that target is developed
 * to display values; the stack runs over it; and the result is copied to the
 * canvas. The stack sees exactly what a viewer would have seen, which is what
 * lets a print effect treat type and objects as one picture.
 */
export class LookPass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: THREE.Mesh;
  private readonly develop: THREE.ShaderMaterial;
  private readonly copy: THREE.ShaderMaterial;
  private readonly chain = new EffectChain();

  private sceneTarget: THREE.WebGLRenderTarget | null = null;
  private developed: THREE.WebGLRenderTarget | null = null;
  private width = 0;
  private height = 0;

  constructor() {
    this.develop = new THREE.ShaderMaterial({
      uniforms: {
        uSource: { value: null },
        uToneMode: { value: 4 },
        // Declared by the chunk three injects; provided here so it is uploaded.
        toneMappingExposure: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: DEVELOP,
      depthTest: false,
      depthWrite: false,
    });
    this.copy = new THREE.ShaderMaterial({
      uniforms: { uSource: { value: null } },
      vertexShader: VERTEX,
      fragmentShader: COPY,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  private ensureTargets(width: number, height: number) {
    if (this.sceneTarget && this.width === width && this.height === height) return;
    this.sceneTarget?.dispose();
    this.developed?.dispose();
    this.width = width;
    this.height = height;

    // Half float keeps highlights above white alive until tone mapping, so a
    // bloom in the stack still has something to bloom.
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.sceneTarget.depthTexture = new THREE.DepthTexture(width, height);
    this.sceneTarget.depthTexture.type = THREE.UnsignedIntType;

    this.developed = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }

  private draw(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }

  /**
   * Runs `drawScene` with the frame target bound, then finishes the frame onto
   * the canvas. `drawScene` may be a plain render or the depth of field pass;
   * either lands in the bound target because both draw to whatever is current.
   */
  render(renderer: THREE.WebGLRenderer, drawScene: () => void, look: EffectInstance[], time: number) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.ensureTargets(Math.max(2, size.x), Math.max(2, size.y));
    const sceneTarget = this.sceneTarget!;
    const developed = this.developed!;

    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    drawScene();

    this.develop.uniforms.uSource.value = sceneTarget.texture;
    this.develop.uniforms.uToneMode.value = TONE_MODE[renderer.toneMapping] ?? 0;
    this.develop.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
    this.draw(renderer, this.develop, developed);

    const result = this.chain.render(renderer, developed.texture, look, time, this.width, this.height);

    this.copy.uniforms.uSource.value = result;
    this.draw(renderer, this.copy, null);
  }

  dispose() {
    this.sceneTarget?.dispose();
    this.developed?.dispose();
    this.chain.dispose();
    this.quad.geometry.dispose();
    this.develop.dispose();
    this.copy.dispose();
  }
}
