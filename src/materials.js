import {
  ShaderMaterial, Color, Vector3, FrontSide, DoubleSide, BufferAttribute, Mesh,
  CanvasTexture, LinearFilter, RepeatWrapping,
} from 'three';

export const flash = {
  uCamPos: { value: new Vector3() },
  uCamDir: { value: new Vector3(0, 0, -1) },
  uAmbient: { value: new Color(0x1a2c44) },
  uLight: { value: new Color(0xffe2b0) },
  uFog: { value: new Color(0x071018) },
  uRim: { value: new Color(0x6d93c4) },
  uMoonDir: { value: new Vector3(-0.25, 0.9, -0.2).normalize() },
  uMoon: { value: new Color(0xb7c8ea) },
  uRange: { value: 22 },
  uInner: { value: Math.cos(0.42) },
  uOuter: { value: Math.cos(0.95) },
  uIntensity: { value: 2.05 },
  uFogDensity: { value: 0.045 },
  uMoonAmt: { value: 0.15 },
  uRimAmt: { value: 0.55 },
  uBump: { value: null },
};

const bump = makeWetBump();
flash.uBump.value = bump;

const VERT = /* glsl */ `
attribute vec3 color;
attribute vec2 aUv;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
void main() {
  vec3 pos = position;
  vec3 nrm = normal;
  #ifdef USE_INSTANCING
    pos = (instanceMatrix * vec4(position, 1.0)).xyz;
    nrm = mat3(instanceMatrix) * normal;
  #endif
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vW = world.xyz;
  vN = mat3(modelMatrix) * nrm;
  vC = color;
  vUv = aUv;
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
uniform vec3 uRim;
uniform vec3 uMoonDir;
uniform vec3 uMoon;
uniform float uRange;
uniform float uInner;
uniform float uOuter;
uniform float uIntensity;
uniform float uFogDensity;
uniform float uMoonAmt;
uniform float uRimAmt;
uniform vec3 uColor;
uniform float uFlash;
uniform float uGloss;
uniform float uUvRepeat;
uniform float uBumpAmt;
uniform sampler2D uBump;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec2 uv = vUv * uUvRepeat;
  float h = texture2D(uBump, uv).r;
  float hx = texture2D(uBump, uv + vec2(0.008, 0.0)).r;
  float hy = texture2D(uBump, uv + vec2(0.0, 0.008)).r;
  N = normalize(N + vec3(h - hx, hy - h, 0.0) * uBumpAmt);
  vec3 toCam = uCamPos - vW;
  float dist = length(toCam);
  vec3 L = toCam / max(dist, 1e-3);
  float ndot = max(dot(N, L), 0.0);
  float coneDot = dot(normalize(vW - uCamPos), normalize(uCamDir));
  float cone = smoothstep(uOuter, uInner, coneDot);
  float atten = pow(clamp(1.0 - dist / uRange, 0.0, 1.0), 1.15);
  float beam = ndot * cone * atten * uIntensity;
  float moon = max(dot(N, normalize(uMoonDir)), 0.0) * uMoonAmt;
  float rim = pow(1.0 - max(dot(N, normalize(toCam)), 0.0), 2.2) * uRimAmt;
  vec3 albedo = uColor * vC;
  albedo *= mix(0.82, 1.08, h);
  vec3 H = normalize(L + normalize(toCam));
  float specPow = mix(10.0, 72.0, uGloss);
  float spec = pow(max(dot(N, H), 0.0), specPow) * cone * atten * (0.15 + uGloss);
  vec3 col = albedo * (uAmbient + uLight * beam + uMoon * moon);
  col += uRim * rim * (0.35 + moon);
  col += uLight * spec * 0.85;
  col += vec3(0.7) * uFlash;
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  fogF = clamp(fogF + dist * 0.004, 0.0, 1.0);
  col = mix(col, uFog, fogF);
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
  uniforms.uRim = flash.uRim;
  uniforms.uMoonDir = flash.uMoonDir;
  uniforms.uMoon = flash.uMoon;
  uniforms.uRange = flash.uRange;
  uniforms.uInner = flash.uInner;
  uniforms.uOuter = flash.uOuter;
  uniforms.uIntensity = flash.uIntensity;
  uniforms.uFogDensity = flash.uFogDensity;
  uniforms.uMoonAmt = flash.uMoonAmt;
  uniforms.uRimAmt = flash.uRimAmt;
  uniforms.uBump = flash.uBump;
}

export function litMat(color = 0xffffff, side = FrontSide, opts = {}) {
  const uniforms = {
    uColor: { value: new Color(color) },
    uFlash: { value: 0 },
    uGloss: { value: opts.gloss ?? 0.42 },
    uUvRepeat: { value: opts.uvRepeat ?? 2.4 },
    uBumpAmt: { value: opts.bump ?? 1.1 },
  };
  bindShared(uniforms);
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side,
  });
}

export function puddleMat() {
  const uniforms = {
    uColor: { value: new Color(0x0c1828) },
    uFlash: { value: 0 },
    uGloss: { value: 0.95 },
    uUvRepeat: { value: 1.2 },
    uBumpAmt: { value: 0.35 },
    uTime: { value: 0 },
  };
  bindShared(uniforms);
  const frag = FRAG.replace(
    'float h = texture2D(uBump, uv).r;',
    'uv += vec2(sin(uv.y * 18.0 + uTime * 1.6), cos(uv.x * 14.0 + uTime)) * 0.03;\n  float h = texture2D(uBump, uv).r;',
  ).replace('uniform float uBumpAmt;', 'uniform float uBumpAmt;\nuniform float uTime;');
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: frag,
    side: DoubleSide,
    transparent: true,
    opacity: 1,
  });
}

export function ensureColor(geo) {
  if (!geo.getAttribute('color')) {
    const n = geo.getAttribute('position').count;
    const data = new Float32Array(n * 3);
    data.fill(1);
    geo.setAttribute('color', new BufferAttribute(data, 3));
  }
  if (!geo.getAttribute('aUv')) {
    if (geo.getAttribute('uv')) geo.setAttribute('aUv', geo.getAttribute('uv'));
    else {
      const n = geo.getAttribute('position').count;
      const uv = new Float32Array(n * 2);
      const pos = geo.getAttribute('position');
      for (let i = 0; i < n; i++) {
        uv[i * 2] = pos.getX(i) * 0.35;
        uv[i * 2 + 1] = pos.getZ(i) * 0.35 + pos.getY(i) * 0.2;
      }
      geo.setAttribute('aUv', new BufferAttribute(uv, 2));
    }
  }
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
    flash.uAmbient.value.set(0x243044);
    flash.uFog.value.set(0x0a121c);
    flash.uFogDensity.value = 0.014;
    flash.uMoonAmt.value = 1.45;
    flash.uRimAmt.value = 0.7;
    flash.uRange.value = 18;
    flash.uIntensity.value = 1.85;
    flash.uInner.value = Math.cos(0.5);
    flash.uOuter.value = Math.cos(1.05);
    flash.uLight.value.set(0xffe6c4);
  } else {
    flash.uAmbient.value.set(0x2a4560);
    flash.uFog.value.set(0x0c1824);
    flash.uFogDensity.value = 0.026;
    flash.uMoonAmt.value = 0.22;
    flash.uRimAmt.value = 0.85;
    flash.uRange.value = 28;
    flash.uIntensity.value = 2.7;
    flash.uInner.value = Math.cos(0.55);
    flash.uOuter.value = Math.cos(1.15);
    flash.uLight.value.set(0xffd7a2);
  }
}

function makeWetBump() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = Math.sin(x * 0.37) * Math.cos(y * 0.29)
        + Math.sin(x * 0.11 + y * 0.17) * 0.6
        + Math.sin(x * 0.9 - y * 1.1) * 0.25;
      const v = Math.floor(128 + n * 70);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.userData.shared = true;
  return tex;
}
