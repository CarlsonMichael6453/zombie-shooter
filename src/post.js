import { Vector2, ShaderMaterial } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.26 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(l * 0.55, l * 0.68, l * 0.95), 0.18);
      col.b += 0.025 * (1.0 - col.b);
      col.r += 0.02 * smoothstep(0.45, 1.0, l);
      float n = fract(sin(dot(vUv + fract(uTime * 0.13), vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      float vig = smoothstep(0.95, 0.28, length(vUv - 0.5));
      col *= mix(1.0 - uVignette, 1.0, vig);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera, quality) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (quality === 'high') {
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.32, 0.45, 0.84);
    composer.addPass(bloom);
  }
  const grade = new ShaderPass(GradeShader);
  grade.material.toneMapped = false;
  composer.addPass(grade);
  return composer;
}

export function gradeTime(composer, time) {
  const pass = composer.passes[composer.passes.length - 1];
  if (pass?.uniforms?.uTime) pass.uniforms.uTime.value = time;
  else if (pass?.material?.uniforms?.uTime) pass.material.uniforms.uTime.value = time;
}

export { ShaderMaterial };
