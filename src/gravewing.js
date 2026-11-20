import {
  Group, Mesh, SphereGeometry, MeshBasicMaterial, PointLight, AdditiveBlending, DoubleSide,
} from 'three';
import { litMat, ensureColor } from './materials.js';

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

async function fetchModel(loader, url) {
  const gltf = await loader.loadAsync(url);
  const face = gltf.scene;
  const bodyMat = litMat(0xffffff, DoubleSide, {
    maps: null,
    gloss: 0.2,
    uvRepeat: 1,
    normalAmt: 0,
    roughBias: -0.2,
    sheen: 0x4a2878,
    fill: 0.75,
  });
  face.traverse((o) => {
    if (!o.isMesh) return;
    const map = o.material?.map || null;
    if (map) {
      bodyMat.uniforms.uMap.value = map;
      bodyMat.uniforms.uMapAmt.value = 1;
    }
    ensureColor(o.geometry);
    o.material = bodyMat;
    o.userData.ownerKind = 'boss';
    o.userData.zone = 'body';
    o.castShadow = false;
    o.receiveShadow = false;
  });

  const eyeMat = new MeshBasicMaterial({ color: 0xc9b0ff, fog: false });
  const glowMat = new MeshBasicMaterial({
    color: 0x7a4dff, transparent: true, opacity: 0.45, depthWrite: false,
    blending: AdditiveBlending, fog: false,
  });
  for (const x of [-0.042, 0.042]) {
    const eye = new Mesh(new SphereGeometry(0.008, 10, 8), eyeMat);
    eye.position.set(x, 0.125, 0.27);
    eye.userData.ownerKind = 'boss';
    eye.userData.zone = 'head';
    face.add(eye);
    const glow = new Mesh(new SphereGeometry(0.016, 8, 6), glowMat);
    glow.position.copy(eye.position);
    glow.userData.ownerKind = 'boss';
    glow.userData.zone = 'head';
    face.add(glow);
  }
  const lamp = new PointLight(0x7c4dff, 2.2, 2.4, 2);
  lamp.position.set(0, 0.13, 0.3);
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
  root.userData.mats = [bodyMat];
  root.userData.standY = gravewingStandY();
  root.position.y = root.userData.standY;
  return root;
}
