import { ShaderMaterial, Color, Vector3, FrontSide, BufferAttribute, Mesh } from 'three';

// Shared flashlight / moon / fog uniforms. Every lit material points at these.
export const flash = {
  uCamPos: { value: new Vector3() },
  uCamDir: { value: new Vector3(0, 0, -1) },
  uAmbient: { value: new Color(0x121a28) },
  uLight: { value: new Color(0xfff1d6) },
  uFog: { value: new Color(0x070b10) },
  uMoonDir: { value: new Vector3(-0.32, 0.88, -0.3).normalize() },
  uMoon: { value: new Color(0xc5d4f2) },
  uRange: { value: 20 },
  uInner: { value: Math.cos(0.34) },
  uOuter: { value: Math.cos(0.82) },
  uIntensity: { value: 1.35 },
  uFogDensity: { value: 0.04 },
  uMoonAmt: { value: 0 },
};

const VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vW = world.xyz;
  vN = mat3(modelMatrix) * normal;
  vC = color;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uCamDir;
uniform vec3 uAmbient;
uniform vec3 uLight;
uniform vec3 uFog;
uniform vec3 uMoonDir;
uniform vec3 uMoon;
uniform float uRange;
uniform float uInner;
uniform float uOuter;
uniform float uIntensity;
uniform float uFogDensity;
uniform float uMoonAmt;
uniform vec3 uColor;
uniform float uFlash;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 toCam = uCamPos - vW;
  float dist = length(toCam);
  vec3 L = toCam / max(dist, 1e-3);
  float ndot = max(dot(N, L), 0.0);
  float coneDot = dot(normalize(vW - uCamPos), normalize(uCamDir));
  float cone = smoothstep(uOuter, uInner, coneDot);
  float atten = pow(clamp(1.0 - dist / uRange, 0.0, 1.0), 1.2);
  float beam = ndot * cone * atten * uIntensity;
  float moon = max(dot(N, normalize(uMoonDir)), 0.0) * uMoonAmt;
  vec3 albedo = uColor * vC;
  float spec = pow(ndot, 20.0) * cone * atten;
  vec3 col = albedo * (uAmbient + uLight * beam + uMoon * moon);
  col += uLight * spec * 0.18;
  col += vec3(0.55) * uFlash;
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFog, clamp(fogF, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function bindShared(uniforms) {
  uniforms.uCamPos = flash.uCamPos;
  uniforms.uCamDir = flash.uCamDir;
  uniforms.uAmbient = flash.uAmbient;
  uniforms.uLight = flash.uLight;
  uniforms.uFog = flash.uFog;
  uniforms.uMoonDir = flash.uMoonDir;
  uniforms.uMoon = flash.uMoon;
  uniforms.uRange = flash.uRange;
  uniforms.uInner = flash.uInner;
  uniforms.uOuter = flash.uOuter;
  uniforms.uIntensity = flash.uIntensity;
  uniforms.uFogDensity = flash.uFogDensity;
  uniforms.uMoonAmt = flash.uMoonAmt;
}

export function litMat(color = 0xffffff, side = FrontSide) {
  const uniforms = {
    uColor: { value: new Color(color) },
    uFlash: { value: 0 },
  };
  bindShared(uniforms);
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side,
  });
}

export function ensureColor(geo) {
  if (geo.getAttribute('color')) return geo;
  const n = geo.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  data.fill(1);
  geo.setAttribute('color', new BufferAttribute(data, 3));
  return geo;
}

export function paint(geo, fn) {
  const pos = geo.getAttribute('position');
  const data = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    fn(c, pos.getX(i), pos.getY(i), pos.getZ(i), i, pos.count);
    data[i * 3] = c.r;
    data[i * 3 + 1] = c.g;
    data[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(data, 3));
  return geo;
}

export function solid(geo, color, side) {
  ensureColor(geo);
  return new Mesh(geo, litMat(color, side));
}

export function setAtmosphere(level) {
  if (level === 'forest') {
    flash.uAmbient.value.set(0x1a2434);
    flash.uFog.value.set(0x0c1422);
    flash.uFogDensity.value = 0.026;
    flash.uMoonAmt.value = 0.72;
    flash.uRange.value = 16;
    flash.uIntensity.value = 1.7;
  } else {
    flash.uAmbient.value.set(0x101828);
    flash.uFog.value.set(0x070b10);
    flash.uFogDensity.value = 0.04;
    flash.uMoonAmt.value = 0;
    flash.uRange.value = 20;
    flash.uIntensity.value = 1.45;
  }
}
