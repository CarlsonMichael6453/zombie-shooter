import {
  Group, Mesh, SphereGeometry, MeshBasicMaterial, PointLight,
  SRGBColorSpace, DoubleSide, Color,
} from 'three';

export const GRAVEWING_SCALE = 13.2;

export function gravewingStandY(scale = GRAVEWING_SCALE) {
  return 0.23 * scale;
}

export async function loadGravewing({ quality = 'high', baseUrl = './' }) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const file = quality === 'high' && !coarse ? 'gravewing.glb' : 'gravewing_mobile.glb';
  try {
    return await fetchModel(new GLTFLoader(), `${baseUrl}assets/models/${file}`);
  } catch (err) {
    if (file !== 'gravewing_mobile.glb') {
      return await fetchModel(new GLTFLoader(), `${baseUrl}assets/models/gravewing_mobile.glb`);
    }
    throw err;
  }
}

function attachFlap(mat) {
  const uFlap = { value: 0 };
  mat.userData.uFlap = uFlap;
  const previous = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.uFlap = uFlap;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFlap;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float gwSide = sign(transformed.x);
        float gwW = smoothstep(0.10, 0.42, abs(transformed.x));
        float gwAng = uFlap * gwW;
        float gwC = cos(gwAng);
        float gwS = sin(gwAng) * gwSide;
        float gwX = transformed.x - gwSide * 0.10;
        float gwY = transformed.y;
        transformed.x = gwX * gwC - gwY * gwS + gwSide * 0.10;
        transformed.y = gwX * gwS + gwY * gwC;
      `);
  };
  const previousKey = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${previousKey?.() || ''}|gravewing-flap`;
}

async function fetchModel(loader, url) {
  const gltf = await loader.loadAsync(url);
  const face = gltf.scene;
  let bodyMat = null;
  face.traverse((o) => {
    if (!o.isMesh || !o.material || o.userData.ownerKind) return;
    const mat = o.material;
    if (mat.map) {
      mat.map.colorSpace = SRGBColorSpace;
      mat.map.needsUpdate = true;
    }
    if ('roughness' in mat) mat.roughness = 0.82;
    if ('metalness' in mat) mat.metalness = 0;
    mat.side = DoubleSide;
    mat.envMapIntensity = 0.2;
    if (mat.emissive) mat.emissive.set(0x000000);
    attachFlap(mat);
    bodyMat = mat;
    o.userData.ownerKind = 'boss';
    o.userData.zone = 'body';
    o.castShadow = false;
    o.receiveShadow = false;
  });

  const eyeMat = new MeshBasicMaterial({ color: 0x9446d4, fog: false, toneMapped: false });
  for (const x of [-0.028, 0.028]) {
    const eye = new Mesh(new SphereGeometry(0.02, 12, 8), eyeMat);
    eye.position.set(x, 0.141, 0.336);
    eye.userData.ownerKind = 'boss';
    eye.userData.zone = 'head';
    face.add(eye);
  }
  const lamp = new PointLight(0x7a3ec4, 0.35, 1.6, 2);
  lamp.position.set(0, 0.13, 0.32);
  face.add(lamp);

  const head = new Mesh(new SphereGeometry(0.13, 8, 6), new MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, color: 0x000000,
  }));
  head.position.set(0, 0.1, 0.28);
  head.userData.ownerKind = 'boss';
  head.userData.zone = 'head';
  face.add(head);

  face.scale.setScalar(GRAVEWING_SCALE);
  const root = new Group();
  root.add(face);
  root.userData.glb = true;
  root.userData.mats = bodyMat ? [bodyMat] : [];
  root.userData.standY = gravewingStandY();
  root.position.y = root.userData.standY;
  return root;
}

export function flashBossMat(mat) {
  if (!mat) return;
  if (mat.uniforms?.uFlash) {
    mat.uniforms.uFlash.value = 1;
    return;
  }
  if (mat.emissive) {
    mat.userData.flash = 1;
    if (!mat.userData.flashColor) mat.userData.flashColor = new Color(0xffd8d0);
    mat.emissive.copy(mat.userData.flashColor);
    mat.emissiveIntensity = 0.7;
  }
}

export function decayBossMat(mat, dt) {
  if (!mat) return;
  if (mat.uniforms?.uFlash) {
    mat.uniforms.uFlash.value = Math.max(0, mat.uniforms.uFlash.value - dt * 2.5);
    return;
  }
  if (mat.emissive && mat.userData.flash) {
    mat.userData.flash = Math.max(0, mat.userData.flash - dt * 2.5);
    mat.emissiveIntensity = mat.userData.flash * 0.7;
  }
}
