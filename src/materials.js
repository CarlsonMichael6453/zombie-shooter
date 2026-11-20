import {
  ShaderMaterial, Color, Vector3, FrontSide, DoubleSide, BufferAttribute, Mesh,
  CanvasTexture, LinearFilter, RepeatWrapping, TextureLoader, SRGBColorSpace,
  LinearSRGBColorSpace,
} from 'three';

export const flash = {
  uCamPos: { value: new Vector3() },
  uCamDir: { value: new Vector3(0, 0, -1) },
  uAmbient: { value: new Color(0x142028) },
  uSky: { value: new Color(0x1c3442) },
  uGround: { value: new Color(0x0c1418) },
  uLight: { value: new Color(0xd7e6f4) },
  uFog: { value: new Color(0x10181e) },
  uRim: { value: new Color(0x7f9fb0) },
  uMoonDir: { value: new Vector3(-0.22, 0.86, -0.28).normalize() },
  uMoon: { value: new Color(0x9eb0c4) },
  uRange: { value: 26 },
  uInner: { value: Math.cos(0.5) },
  uOuter: { value: Math.cos(1.15) },
  uIntensity: { value: 2.85 },
  uFogDensity: { value: 0.03 },
  uMoonAmt: { value: 0.2 },
  uRimAmt: { value: 0.72 },
  uTime: { value: 0 },
};

const VERT = /* glsl */ `
attribute vec3 color;
attribute vec2 aUv;
uniform float uFlap;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
void main() {
  vec3 pos = position;
  vec3 nrm = normal;
  float side = sign(pos.x);
  float wgt = smoothstep(0.10, 0.42, abs(pos.x));
  float ang = uFlap * wgt;
  float cs = cos(ang);
  float sn = sin(ang) * side;
  float lx = pos.x - side * 0.10;
  float ly = pos.y;
  pos.x = lx * cs - ly * sn + side * 0.10;
  pos.y = lx * sn + ly * cs;
  float nx = nrm.x;
  float ny = nrm.y;
  nrm.x = nx * cs - ny * sn;
  nrm.y = nx * sn + ny * cs;
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
uniform vec3 uSky;
uniform vec3 uGround;
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
uniform float uTime;
uniform vec3 uColor;
uniform float uFlash;
uniform float uGloss;
uniform float uUvRepeat;
uniform float uNormalAmt;
uniform float uMapAmt;
uniform float uRoughBias;
uniform float uScroll;
uniform float uAlphaAmt;
uniform float uAlphaCut;
uniform float uFlap;
uniform float uFill;
uniform vec3 uSheen;
uniform sampler2D uMap;
uniform sampler2D uNormal;
uniform sampler2D uRough;
uniform sampler2D uAlpha;
varying vec3 vW;
varying vec3 vN;
varying vec3 vC;
varying vec2 vUv;
void main() {
  if (uAlphaAmt > 0.5) {
    float a = texture2D(uAlpha, vUv).a;
    if (a < uAlphaCut) discard;
  }
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec2 uv = vUv * uUvRepeat;
  uv += vec2(sin(uv.y * 14.0 + uTime * uScroll), cos(uv.x * 11.0 + uTime * uScroll * 0.7)) * uScroll * 0.04;
  vec3 tex = texture2D(uMap, uv).rgb;
  vec3 albedo = uColor * vC * mix(vec3(1.0), tex, uMapAmt);
  vec3 nTex = texture2D(uNormal, uv).xyz * 2.0 - 1.0;
  nTex.xy *= uNormalAmt;
  vec3 dp1 = dFdx(vW);
  vec3 dp2 = dFdy(vW);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 T = dp1 * duv2.y - dp2 * duv1.y;
  float tlen = length(T);
  if (tlen > 1e-5 && uNormalAmt > 0.001) {
    T /= tlen;
    vec3 B = normalize(cross(N, T));
    N = normalize(mat3(T, B, N) * normalize(nTex));
  }
  vec3 toCam = uCamPos - vW;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-3);
  float ndot = max(dot(N, V), 0.0);
  float coneDot = dot(normalize(vW - uCamPos), normalize(uCamDir));
  float cone = smoothstep(uOuter, uInner, coneDot);
  float atten = pow(clamp(1.0 - dist / uRange, 0.0, 1.0), 1.2);
  float beam = ndot * cone * atten * uIntensity;
  float hemi = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uGround, uSky, hemi);
  float moon = max(dot(N, normalize(uMoonDir)), 0.0) * uMoonAmt;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.4) * uRimAmt;
  float roughTex = texture2D(uRough, uv).r;
  float rough = mix(1.0 - uGloss, roughTex, uMapAmt);
  rough = clamp(rough + uRoughBias, 0.04, 1.0);
  vec3 H = normalize(V + V);
  float specPow = mix(96.0, 8.0, rough);
  float spec = pow(ndot, specPow) * (1.0 - rough);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0) * (1.0 - rough);
  vec3 col = albedo * (amb + uLight * beam + uMoon * moon);
  col += uRim * rim * (0.45 + moon);
  col += albedo * uFill;
  col += uSheen * pow(1.0 - max(dot(N, normalize(toCam)), 0.0), 1.6);
  col += uLight * (spec * 0.55 + fres * 0.85) * cone * atten;
  col += vec3(0.85) * uFlash;
  float wobble = 1.0 + 0.07 * sin(uTime * 0.37 + vW.x * 0.13 + vW.z * 0.09);
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist * wobble);
  fogF = clamp(fogF, 0.0, 1.0);
  col = mix(col, uFog, fogF);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const loader = new TextureLoader();
let pending = 0;
let readyResolve = () => {};
export const texturesReady = new Promise((resolve) => { readyResolve = resolve; });

function loadTex(url, colorSpace) {
  const tex = loader.load(url, () => {
    pending -= 1;
    if (pending <= 0) readyResolve();
  }, undefined, () => {
    pending -= 1;
    if (pending <= 0) readyResolve();
  });
  pending += 1;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = tex.minFilter = LinearFilter;
  tex.colorSpace = colorSpace;
  tex.userData.shared = true;
  return tex;
}

const base = `${import.meta.env.BASE_URL}assets/textures/`;
const blank = blankTex();
const flatNormal = normalTex();
export const maps = {
  rock: {
    map: loadTex(`${base}rock_color.jpg`, SRGBColorSpace),
    normal: loadTex(`${base}rock_normal.jpg`, LinearSRGBColorSpace),
    rough: loadTex(`${base}rock_rough.jpg`, LinearSRGBColorSpace),
  },
  bark: {
    map: loadTex(`${base}bark_color.jpg`, SRGBColorSpace),
    normal: loadTex(`${base}bark_normal.jpg`, LinearSRGBColorSpace),
    rough: loadTex(`${base}bark_rough.jpg`, LinearSRGBColorSpace),
  },
  ground: {
    map: loadTex(`${base}ground_color.jpg`, SRGBColorSpace),
    normal: loadTex(`${base}ground_normal.jpg`, LinearSRGBColorSpace),
    rough: loadTex(`${base}ground_rough.jpg`, LinearSRGBColorSpace),
  },
};
if (pending === 0) readyResolve();

let detail = 1;
export function setDetail(quality) {
  detail = quality === 'low' ? 0.4 : 1;
}

function bindShared(uniforms) {
  uniforms.uCamPos = flash.uCamPos;
  uniforms.uCamDir = flash.uCamDir;
  uniforms.uSky = flash.uSky;
  uniforms.uGround = flash.uGround;
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
  uniforms.uTime = flash.uTime;
}

export function litMat(color = 0xffffff, side = FrontSide, opts = {}) {
  const pack = opts.maps || null;
  const uniforms = {
    uColor: { value: new Color(color) },
    uFlash: { value: 0 },
    uGloss: { value: opts.gloss ?? 0.42 },
    uUvRepeat: { value: opts.uvRepeat ?? 2.4 },
    uNormalAmt: { value: (opts.normalAmt ?? (pack ? 1 : 0.35)) * detail },
    uMapAmt: { value: pack ? 1 : 0 },
    uRoughBias: { value: opts.roughBias ?? 0 },
    uScroll: { value: opts.scroll ?? 0 },
    uAlphaAmt: { value: opts.alpha ? 1 : 0 },
    uAlphaCut: { value: opts.alphaCut ?? 0.35 },
    uFlap: { value: 0 },
    uFill: { value: opts.fill ?? 0 },
    uSheen: { value: new Color(opts.sheen ?? 0x000000) },
    uMap: { value: pack?.map || blank },
    uNormal: { value: opts.normalMap || pack?.normal || flatNormal },
    uRough: { value: pack?.rough || blank },
    uAlpha: { value: opts.alpha || blank },
  };
  bindShared(uniforms);
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side,
    transparent: !!opts.transparent,
  });
  if (opts.alpha) mat.alphaTest = opts.alphaCut ?? 0.35;
  return mat;
}

export function pbrMat(preset, color, opts = {}) {
  return litMat(color, opts.side, { ...opts, maps: maps[preset] });
}

let waterMat;
export function puddleMat() {
  if (!waterMat) {
    waterMat = pbrMat('rock', 0x16303a, {
      side: DoubleSide,
      gloss: 0.96,
      uvRepeat: 1.6,
      normalAmt: 0.55,
      roughBias: -0.45,
      scroll: 1.4,
    });
    waterMat.userData.shared = true;
  }
  return waterMat;
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
  return new Mesh(geo, litMat(color, side, { normalAmt: 0.2 }));
}

export function setAtmosphere(level) {
  if (level === 'forest') {
    flash.uSky.value.set(0x161e28);
    flash.uGround.value.set(0x080a0e);
    flash.uAmbient.value.set(0x161e28);
    flash.uFog.value.set(0x1a242e);
    flash.uFogDensity.value = 0.034;
    flash.uMoonAmt.value = 0.16;
    flash.uRimAmt.value = 0.42;
    flash.uMoonDir.value.set(0.12, 0.86, 0.35).normalize();
    flash.uRange.value = 11;
    flash.uIntensity.value = 0.2;
    flash.uInner.value = Math.cos(0.42);
    flash.uOuter.value = Math.cos(0.95);
    flash.uLight.value.set(0xc4b39a);
    flash.uMoon.value.set(0x5c6a78);
    flash.uRim.value.set(0x7d6e90);
  } else {
    flash.uSky.value.set(0x1c3442);
    flash.uGround.value.set(0x0c1418);
    flash.uAmbient.value.set(0x1c3442);
    flash.uFog.value.set(0x10181e);
    flash.uFogDensity.value = 0.03;
    flash.uMoonAmt.value = 0.16;
    flash.uRimAmt.value = 0.78;
    flash.uRange.value = 30;
    flash.uIntensity.value = 3.05;
    flash.uInner.value = Math.cos(0.48);
    flash.uOuter.value = Math.cos(1.2);
    flash.uLight.value.set(0xd7e6f4);
    flash.uRim.value.set(0x7f9fb0);
  }
}

function blankTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 2, 2);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.userData.shared = true;
  return tex;
}

function normalTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const g = c.getContext('2d');
  g.fillStyle = '#8080ff';
  g.fillRect(0, 0, 2, 2);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = LinearSRGBColorSpace;
  tex.userData.shared = true;
  return tex;
}

export function shellNormal() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ridge = Math.sin(y * 0.55) * 0.65 + Math.sin(x * 0.22 + y * 0.15) * 0.25;
      const nx = Math.sin(x * 0.45) * 18;
      const ny = ridge * 42;
      const nz = 90;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = 128 + (nx / len) * 127;
      img.data[i + 1] = 128 + (ny / len) * 127;
      img.data[i + 2] = 128 + (nz / len) * 127;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = LinearSRGBColorSpace;
  tex.userData.shared = true;
  return tex;
}
