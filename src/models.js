import {
  Group, Mesh, InstancedMesh, Object3D, BoxGeometry, SphereGeometry, CylinderGeometry, ConeGeometry,
  TorusGeometry, BufferGeometry, BufferAttribute, Float32BufferAttribute,
  MeshBasicMaterial, CanvasTexture, SRGBColorSpace, DoubleSide, Points, PointsMaterial,
  Shape, ExtrudeGeometry, CircleGeometry, RingGeometry, IcosahedronGeometry,
  BackSide, AdditiveBlending, PlaneGeometry, LatheGeometry, Vector2,
} from 'three';
import { solid, litMat, ensureColor, paint, pbrMat, shellNormal } from './materials.js';

const SHELL = shellNormal();

let featherTex;
function featherMap() {
  if (featherTex) return featherTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 320;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 320);
  g.beginPath();
  g.moveTo(64, 8);
  g.bezierCurveTo(120, 48, 118, 190, 64, 308);
  g.bezierCurveTo(10, 190, 8, 48, 64, 8);
  g.fillStyle = '#b7c3d0';
  g.fill();
  g.strokeStyle = 'rgba(48, 42, 72, 0.95)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const y = 28 + i * 16;
    g.beginPath();
    g.moveTo(64, y);
    g.lineTo(18, y + 22);
    g.moveTo(64, y);
    g.lineTo(110, y + 22);
    g.stroke();
  }
  g.fillStyle = 'rgba(64, 55, 109, 0.55)';
  g.fillRect(54, 36, 20, 210);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.userData.shared = true;
  featherTex = tex;
  return tex;
}
const GEO = {};
function geo(name, build) {
  if (!GEO[name]) {
    GEO[name] = build();
    GEO[name].userData.shared = true;
    ensureColor(GEO[name]);
  }
  return GEO[name];
}

const MAT = {};
function basic(name, color, extra = {}) {
  if (!MAT[name]) {
    MAT[name] = new MeshBasicMaterial({ color, ...extra });
    MAT[name].userData.shared = true;
  }
  return MAT[name];
}

export function createWallskitter() {
  const root = new Group();
  const mat = litMat(0x24365c, undefined, {
    gloss: 0.9, uvRepeat: 3.4, normalAmt: 0.42, normalMap: SHELL,
  });
  const dark = litMat(0x182848, undefined, {
    gloss: 0.86, uvRepeat: 3, normalAmt: 0.3, normalMap: SHELL,
  });
  root.userData.mat = mat;
  const legs = [];

  const body = new Mesh(geo('bugLathe', () => {
    const pts = [
      [0.02, 0],
      [0.08, 0.07],
      [0.18, 0.18],
      [0.32, 0.36],
      [0.46, 0.55],
      [0.52, 0.72],
      [0.44, 0.86],
      [0.26, 0.98],
      [0.1, 1.06],
      [0.015, 1.1],
    ].map(([x, y]) => new Vector2(x, y));
    const g = new LatheGeometry(pts, 24);
    g.rotateX(-Math.PI / 2);
    g.scale(1.2, 0.4, 1.08);
    return g;
  }), mat);
  root.add(body);

  const ridge = new Mesh(geo('bugRidgeLathe', () => {
    const pts = [
      [0.02, 0.12],
      [0.07, 0.28],
      [0.11, 0.52],
      [0.12, 0.74],
      [0.05, 0.92],
      [0.01, 1.0],
    ].map(([x, y]) => new Vector2(x, y));
    const g = new LatheGeometry(pts, 12);
    g.rotateX(-Math.PI / 2);
    g.scale(0.62, 0.85, 0.96);
    return g;
  }), dark);
  ridge.position.y = 0.1;
  root.add(ridge);

  const face = new Mesh(geo('bugFace', () => {
    const g = new SphereGeometry(0.2, 14, 12);
    g.scale(1.25, 0.72, 0.7);
    return g;
  }), mat);
  face.position.set(0, -0.02, -0.98);
  face.userData.zone = 'head';
  root.add(face);

  const eyeGeo = geo('bugEye', () => new SphereGeometry(0.15, 16, 14));
  const eyeMat = basic('eye', 0xf7f8ff);
  for (const side of [-1, 1]) {
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.16, 0.04, -1.12);
    eye.scale.set(0.9, 1.65, 0.55);
    eye.rotation.z = side * -0.42;
    eye.userData.zone = 'head';
    root.add(eye);
    const glow = new Mesh(
      geo('bugGlow', () => new SphereGeometry(0.18, 10, 8)),
      basic('eyeGlow', 0xf4fbff, { transparent: true, opacity: 0.5, depthWrite: false, blending: AdditiveBlending }),
    );
    glow.position.copy(eye.position);
    glow.scale.set(1.15, 1.7, 0.75);
    root.add(glow);
  }

  const coxaG = geo('bugCoxa', () => new CylinderGeometry(0.038, 0.028, 0.34, 7));
  const femG = geo('bugFem', () => new CylinderGeometry(0.026, 0.016, 0.72, 7));
  const tibG = geo('bugTib', () => new CylinderGeometry(0.014, 0.005, 0.78, 6));
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      const hip = new Group();
      hip.position.set(side * 0.36, -0.02, 0.18 - i * 0.26);
      hip.rotation.y = (i - 2) * 0.42;
      const upper = new Mesh(coxaG, dark);
      upper.position.set(side * 0.16, 0.0, 0);
      upper.rotation.z = side * -1.5;
      const knee = new Group();
      knee.position.set(side * 0.32, -0.02, 0);
      const fem = new Mesh(femG, mat);
      fem.position.set(side * 0.28, -0.04, 0.02);
      fem.rotation.z = side * -0.35;
      fem.rotation.x = 0.2;
      const ankle = new Group();
      ankle.position.set(side * 0.52, -0.08, 0.04);
      const tib = new Mesh(tibG, mat);
      tib.position.set(side * 0.22, -0.1, 0.08);
      tib.rotation.z = side * 0.15;
      tib.rotation.x = 0.35;
      ankle.add(tib);
      knee.add(fem);
      knee.add(ankle);
      hip.add(upper);
      hip.add(knee);
      root.add(hip);
      legs.push({ hip, knee, side, i });
    }
  }

  const ant = geo('bugAnt', () => new CylinderGeometry(0.01, 0.004, 0.85, 5));
  for (const side of [-1, 1]) {
    const mesh = new Mesh(ant, dark);
    mesh.position.set(side * 0.07, -0.08, -1.22);
    mesh.rotation.x = 1.45;
    mesh.rotation.z = side * 0.18;
    root.add(mesh);
  }

  root.userData.legs = legs;
  root.userData.body = body;
  root.scale.setScalar(1.35);
  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.ownerKind = 'bug';
      if (!o.userData.zone) o.userData.zone = 'body';
    }
  });
  return root;
}

export function stepBug(root, time, moving) {
  const legs = root.userData.legs;
  if (!legs) return;
  const rate = moving ? 10 : 1.6;
  for (const leg of legs) {
    const phase = time * rate + leg.i * 1.2 + (leg.side < 0 ? Math.PI : 0);
    const amp = moving ? 0.62 : 0.08;
    leg.hip.rotation.x = Math.sin(phase) * amp;
    leg.knee.rotation.x = 0.15 + Math.max(0, Math.cos(phase)) * (moving ? 0.7 : 0.1);
  }
  if (root.userData.body) {
    root.userData.body.position.y = 0.06 + Math.sin(time * rate * 2) * (moving ? 0.02 : 0.004);
  }
}

export function createBird() {
  const root = new Group();
  const mat = litMat(0x1c1a24);
  const wingMat = litMat(0x2c3344, DoubleSide, { gloss: 0.35, normalAmt: 0.15 });
  root.userData.mats = [mat, wingMat];

  const torso = new Group();
  torso.position.y = 2.55;
  root.add(torso);

  const body = new Mesh(geo('birdBody', () => {
    const g = new SphereGeometry(0.95, 12, 10);
    g.scale(0.85, 0.78, 1.35);
    return g;
  }), mat);
  body.userData.zone = 'body';
  torso.add(body);

  const neck = new Mesh(geo('birdNeck', () => new CylinderGeometry(0.22, 0.34, 0.7, 7)), mat);
  neck.position.set(0, 0.55, -0.7);
  neck.rotation.x = 0.5;
  neck.userData.zone = 'body';
  torso.add(neck);

  const head = new Group();
  head.position.set(0, 1.35, -1.35);
  torso.add(head);
  const skull = new Mesh(geo('birdHead', () => new SphereGeometry(0.48, 10, 8)), mat);
  skull.scale.set(0.85, 0.9, 1.15);
  skull.userData.zone = 'head';
  head.add(skull);

  const beak = new Mesh(geo('birdBeak', () => new ConeGeometry(0.2, 0.92, 7)), mat);
  beak.position.set(0, 0.05, -0.7);
  beak.rotation.x = -1.85;
  beak.userData.zone = 'head';
  head.add(beak);
  const hook = new Mesh(geo('birdHook', () => new ConeGeometry(0.09, 0.32, 6)), mat);
  hook.position.set(0, -0.28, -1.02);
  hook.rotation.x = -2.55;
  head.add(hook);
  const beakLow = new Mesh(geo('birdBeakLow', () => new ConeGeometry(0.12, 0.48, 6)), mat);
  beakLow.position.set(0, -0.28, -0.48);
  beakLow.rotation.x = -2.35;
  head.add(beakLow);

  const eye = new Mesh(geo('birdEye', () => new SphereGeometry(0.1, 8, 6)), basic('birdEye', 0xf7fbff));
  eye.position.set(0.2, 0.1, -0.34);
  eye.scale.set(0.85, 1.15, 0.6);
  head.add(eye);
  const eyeGlow = new Mesh(
    geo('birdEyeGlow', () => new SphereGeometry(0.16, 8, 6)),
    basic('birdEyeGlow', 0xddeeff, { transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }),
  );
  eyeGlow.position.copy(eye.position);
  head.add(eyeGlow);
  const eye2 = new Mesh(geo('birdEye', () => new SphereGeometry(0.1, 8, 6)), basic('birdEyeDim', 0x6e7c88));
  eye2.position.set(-0.2, 0.06, -0.28);
  eye2.scale.setScalar(0.65);
  head.add(eye2);

  const wingShape = new Shape();
  wingShape.moveTo(0, -0.15);
  wingShape.lineTo(1.4, 0.55);
  wingShape.lineTo(3.4, 1.35);
  wingShape.lineTo(5.5, 1.55);
  wingShape.lineTo(6.3, 0.35);
  wingShape.lineTo(5.1, -0.35);
  wingShape.lineTo(3.0, -0.55);
  wingShape.lineTo(1.1, -0.35);
  wingShape.closePath();
  const wingGeo = geo('wing', () => {
    const g = new ExtrudeGeometry(wingShape, { depth: 0.28, bevelEnabled: false, steps: 1 });
    g.rotateY(0.45);
    return g;
  });
  const wingLGeo = geo('wingL', () => {
    const g = wingGeo.clone();
    g.scale(-1, 1, 1);
    g.computeVertexNormals();
    ensureColor(g);
    return g;
  });
  const wingR = new Group();
  const wingL = new Group();
  wingR.position.set(0.35, 0.25, -0.05);
  wingL.position.set(-0.35, 0.25, -0.05);
  wingR.add(new Mesh(wingGeo, wingMat));
  wingL.add(new Mesh(wingLGeo, wingMat));
  const featherMat = new MeshBasicMaterial({
    map: featherMap(), color: 0xd7e0ea, transparent: true, alphaTest: 0.2, side: DoubleSide,
  });
  featherMat.userData.shared = true;
  const sheenMat = featherMat.clone();
  sheenMat.color.set(0x6d5a96);
  sheenMat.userData.shared = true;
  const cardGeo = geo('featherCard', () => new PlaneGeometry(1.25, 0.34));
  function layFeathers(wing, sign) {
    const rows = [
      { y: 0.72, z: 0.08, reach: 4.6, count: 7, mat: featherMat, droop: 0.18 },
      { y: 0.28, z: 0.0, reach: 6.2, count: 8, mat: sheenMat, droop: 0.28 },
      { y: -0.18, z: -0.06, reach: 5.4, count: 8, mat: featherMat, droop: 0.42 },
    ];
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const along = i / (row.count - 1);
        const card = new Mesh(cardGeo, row.mat);
        card.position.set(sign * (0.7 + along * row.reach), row.y - along * row.droop, row.z + (i % 2) * 0.02);
        card.scale.set(0.75 + along * 0.55, 0.7 + (i % 3) * 0.15, 1);
        card.rotation.z = sign * (-0.04 - along * 0.22);
        card.rotation.y = Math.PI;
        wing.add(card);
      }
    }
  }
  layFeathers(wingR, 1);
  layFeathers(wingL, -1);
  torso.add(wingR);
  torso.add(wingL);

  const tail = new Mesh(geo('tail', () => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(0.7, 0.15);
    s.lineTo(1.5, -0.2);
    s.lineTo(0.2, -0.45);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
    return g;
  }), wingMat);
  tail.position.set(0, -0.1, 1.05);
  tail.rotation.y = Math.PI;
  torso.add(tail);

  function leg(side) {
    const g = new Group();
    const thigh = new Mesh(geo('thigh', () => new CylinderGeometry(0.12, 0.16, 1.15, 5)), mat);
    thigh.position.y = -0.7;
    g.add(thigh);
    const shin = new Mesh(geo('shin', () => new CylinderGeometry(0.08, 0.11, 1.15, 5)), mat);
    shin.position.y = -1.7;
    g.add(shin);
    for (let i = -1; i <= 1; i++) {
      const talon = new Mesh(geo('talon', () => new ConeGeometry(0.05, 0.38, 4)), mat);
      talon.position.set(i * 0.12, -2.35, 0.12);
      talon.rotation.x = -Math.PI / 2 + i * 0.15;
      g.add(talon);
    }
    g.position.set(side * 0.38, 0.15, 0.1);
    return g;
  }
  const legL = leg(-1);
  const legR = leg(1);
  torso.add(legL);
  torso.add(legR);

  root.traverse((o) => {
    if (o.isMesh) {
      o.userData.ownerKind = 'boss';
      if (!o.userData.zone) o.userData.zone = 'body';
    }
  });

  root.userData.parts = { torso, head, wingL, wingR, legL, legR, eye };
  root.scale.setScalar(2.35);
  return root;
}

export function poseBird(root, stand, spread, flap) {
  const p = root.userData.parts;
  p.torso.position.y = 1.15 + stand * 1.2;
  p.torso.rotation.x = (1 - stand) * 0.65;
  p.head.rotation.x = (1 - stand) * 0.7 - stand * 0.15 + Math.sin(flap * 0.5) * 0.04;
  const fold = 1.2 * (1 - spread);
  const flapZ = Math.sin(flap) * 0.5 * spread;
  const flapX = Math.cos(flap) * 0.22 * spread;
  p.wingR.rotation.z = fold * 0.15 + (1 - spread) * 1.05 + flapZ;
  p.wingL.rotation.z = -fold * 0.15 - (1 - spread) * 1.05 - flapZ;
  p.wingR.rotation.x = flapX;
  p.wingL.rotation.x = flapX;
  p.wingR.rotation.y = 0.15 + spread * 0.15;
  p.wingL.rotation.y = -0.15 - spread * 0.15;
  p.legL.rotation.x = (1 - stand) * 1.1;
  p.legR.rotation.x = (1 - stand) * 1.1;
  const glow = 0.25 + stand * 0.75;
  p.eye.material.color.setRGB(glow, glow, glow);
}

export function createWeaponModel(view, glove = 0x5a4638) {
  const g = new Group();
  const metal = new MeshBasicMaterial({ color: 0xb7bdc6 });
  const dark = new MeshBasicMaterial({ color: 0x1c2026 });
  const wood = new MeshBasicMaterial({ color: 0x6b4a32 });
  const gloveMat = new MeshBasicMaterial({ color: glove });
  const accent = new MeshBasicMaterial({ color: 0xc4553a });
  const add = (mesh, x, y, z, rx = null, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    if (rx !== null) mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  const box = (w, h, d, mat) => new Mesh(new BoxGeometry(w, h, d), mat);
  const cyl = (r, len, mat, seg = 8) => new Mesh(new CylinderGeometry(r, r, len, seg), mat);

  if (view === 'knife') {
    add(box(0.035, 0.012, 0.42, metal), 0, 0.02, -0.16);
    add(box(0.05, 0.03, 0.12, dark), 0, 0, 0.12);
    add(box(0.07, 0.05, 0.08, gloveMat), 0, -0.02, 0.16);
  } else if (view === 'machete') {
    add(box(0.07, 0.012, 0.62, metal), 0, 0.03, -0.2);
    add(box(0.045, 0.04, 0.14, wood), 0, 0, 0.18);
    add(box(0.08, 0.05, 0.08, gloveMat), 0, -0.03, 0.2);
  } else if (view === 'cleaver') {
    add(box(0.16, 0.02, 0.28, metal), 0, 0.04, -0.12);
    add(box(0.04, 0.04, 0.16, wood), 0, 0, 0.14);
    add(box(0.08, 0.06, 0.08, gloveMat), 0, -0.02, 0.16);
  } else if (view === 'pistol') {
    add(box(0.05, 0.07, 0.22, dark), 0, 0.04, -0.08);
    add(cyl(0.018, 0.16, metal).rotateX(-Math.PI / 2), 0, 0.07, -0.24);
    add(box(0.045, 0.12, 0.06, dark), 0, -0.04, 0.02);
    add(box(0.07, 0.06, 0.08, gloveMat), 0.01, -0.05, 0.04);
  } else if (view === 'cannon') {
    add(cyl(0.022, 0.42, dark).rotateX(-Math.PI / 2), 0, 0.09, -0.28);
    add(cyl(0.034, 0.08, metal).rotateX(-Math.PI / 2), 0, 0.09, -0.46);
    add(cyl(0.055, 0.14, metal).rotateX(-Math.PI / 2), 0, 0.055, -0.02);
    add(box(0.012, 0.05, 0.016, metal), 0, 0.12, -0.46);
    add(box(0.018, 0.07, 0.02, dark), 0, 0.1, 0.08);
    add(box(0.05, 0.18, 0.055, wood), 0, -0.07, 0.06);
    add(new Mesh(new TorusGeometry(0.045, 0.008, 6, 10), dark), 0, -0.02, 0.02);
    add(box(0.09, 0.07, 0.1, gloveMat), 0.02, -0.06, 0.07);
  } else if (view === 'flare') {
    add(box(0.07, 0.08, 0.16, new MeshBasicMaterial({ color: 0x9a3a22 })), 0, 0.04, -0.06);
    add(cyl(0.03, 0.12, accent).rotateX(-Math.PI / 2), 0, 0.05, -0.18);
    add(box(0.05, 0.1, 0.05, dark), 0, -0.03, 0.02);
    add(box(0.08, 0.06, 0.08, gloveMat), 0, -0.04, 0.04);
  } else if (view === 'rifle') {
    add(box(0.055, 0.07, 0.46, dark), 0, 0.045, -0.08);
    add(box(0.06, 0.045, 0.28, dark), 0, 0.03, -0.28);
    add(cyl(0.012, 0.34, metal).rotateX(-Math.PI / 2), 0, 0.075, -0.52);
    add(cyl(0.02, 0.06, dark).rotateX(-Math.PI / 2), 0, 0.075, -0.7);
    add(box(0.05, 0.16, 0.045, dark), 0, -0.02, -0.02);
    add(box(0.04, 0.14, 0.05, dark), 0, -0.06, 0.02);
    add(box(0.07, 0.05, 0.16, dark), 0.04, 0.08, -0.16);
    add(box(0.045, 0.035, 0.07, metal), 0, 0.1, -0.02);
    add(box(0.05, 0.055, 0.22, dark), 0, 0.02, 0.28);
    add(box(0.04, 0.04, 0.08, metal), 0.045, 0.02, 0.22);
    add(box(0.08, 0.055, 0.1, gloveMat), 0.02, -0.02, 0.06);
  } else if (view === 'shotgun') {
    add(box(0.055, 0.07, 0.42, wood), 0, 0.03, -0.02);
    add(cyl(0.018, 0.62, dark).rotateX(-Math.PI / 2), 0, 0.075, -0.32);
    add(cyl(0.028, 0.16, dark).rotateX(-Math.PI / 2), 0, 0.045, -0.12);
    add(box(0.05, 0.09, 0.2, wood), 0, -0.01, 0.22);
    add(box(0.02, 0.035, 0.02, metal), 0, 0.1, -0.6);
    for (let i = 0; i < 4; i++) {
      add(cyl(0.012, 0.045, accent), 0.045, 0.02, 0.12 + i * 0.035);
    }
    add(box(0.09, 0.06, 0.1, gloveMat), 0.02, -0.02, 0.08);
  } else if (view === 'sniper') {
    add(box(0.042, 0.05, 0.7, wood), 0, 0.03, -0.08);
    add(cyl(0.01, 0.55, metal).rotateX(-Math.PI / 2), 0, 0.065, -0.62);
    add(cyl(0.028, 0.16, dark).rotateX(-Math.PI / 2), 0, 0.13, -0.08);
    add(cyl(0.02, 0.04, metal).rotateX(-Math.PI / 2), 0, 0.13, -0.16);
    add(cyl(0.02, 0.04, metal).rotateX(-Math.PI / 2), 0, 0.13, 0.0);
    add(box(0.012, 0.22, 0.012, dark), -0.04, -0.02, -0.35);
    add(box(0.012, 0.22, 0.012, dark), 0.04, -0.02, -0.35);
    add(box(0.04, 0.08, 0.22, wood), 0, -0.01, 0.28);
    add(box(0.08, 0.05, 0.1, gloveMat), 0.02, -0.01, 0.1);
  } else if (view === 'arc') {
    const coilMat = new MeshBasicMaterial({ color: 0x67d4ff });
    add(box(0.08, 0.09, 0.4, dark), 0, 0.03, -0.1);
    add(new Mesh(new TorusGeometry(0.06, 0.012, 6, 10), coilMat), 0, 0.03, -0.22);
    add(new Mesh(new TorusGeometry(0.06, 0.012, 6, 10), coilMat), 0, 0.03, -0.1);
    add(cyl(0.02, 0.2, metal).rotateX(-Math.PI / 2), 0, 0.03, -0.36);
    add(box(0.09, 0.07, 0.1, gloveMat), 0.02, -0.02, 0.12);
  } else if (view === 'nail') {
    add(box(0.1, 0.1, 0.28, dark), 0, 0.02, -0.06);
    add(box(0.12, 0.16, 0.08, metal), 0, -0.02, 0.02);
    add(cyl(0.03, 0.2, dark).rotateX(-Math.PI / 2), 0, 0.04, -0.24);
    add(box(0.08, 0.06, 0.09, gloveMat), 0.02, -0.04, 0.08);
  } else if (view === 'flame') {
    add(cyl(0.07, 0.22, new MeshBasicMaterial({ color: 0x8a2e16 })).rotateX(-Math.PI / 2), 0, -0.02, 0.02);
    add(cyl(0.025, 0.28, dark).rotateX(-Math.PI / 2), 0, 0.04, -0.22);
    add(box(0.04, 0.08, 0.08, accent), 0.08, 0.02, 0);
    add(box(0.08, 0.06, 0.09, gloveMat), 0, -0.02, 0.12);
  } else if (view === 'hive') {
    add(cyl(0.07, 0.32, new MeshBasicMaterial({ color: 0x5c6b32 })).rotateX(-Math.PI / 2), 0, 0.03, -0.12);
    add(new Mesh(new SphereGeometry(0.09, 8, 6), new MeshBasicMaterial({ color: 0xc6e86a })), 0, 0.03, -0.28);
    add(box(0.06, 0.1, 0.08, dark), 0, -0.04, 0.06);
    add(box(0.09, 0.06, 0.09, gloveMat), 0.02, -0.03, 0.08);
  } else {
    add(box(0.05, 0.06, 0.4, dark), 0, 0.03, -0.1);
    add(box(0.08, 0.06, 0.08, gloveMat), 0, -0.02, 0.12);
  }

  const muzzle = new Group();
  const tip = view === 'sniper' ? -0.92 : view === 'rifle' ? -0.74 : view === 'shotgun' ? -0.66 : view === 'knife' || view === 'machete' ? -0.38 : view === 'cannon' ? -0.5 : -0.32;
  muzzle.position.set(0, 0.05, tip);
  g.add(muzzle);
  const flashMat = new MeshBasicMaterial({
    color: 0xfff1c2, transparent: true, opacity: 0.95, depthTest: false, blending: AdditiveBlending,
  });
  const flash = new Mesh(new PlaneGeometry(0.22, 0.22), flashMat);
  flash.visible = false;
  flash.renderOrder = 10;
  const halo = new Mesh(new PlaneGeometry(0.46, 0.46), flashMat.clone());
  halo.material.opacity = 0.4;
  halo.material.color.set(0xffb060);
  flash.add(halo);
  muzzle.add(flash);
  g.userData.muzzle = muzzle;
  g.userData.flash = flash;
  return g;
}

export function createMedkit() {
  const g = new Group();
  const tex = medkitTexture();
  const box = new Mesh(new BoxGeometry(0.28, 0.18, 0.2), new MeshBasicMaterial({ map: tex }));
  box.position.y = 0.2;
  g.add(box);
  return g;
}

export function createAmmoCrate() {
  const g = new Group();
  const box = new Mesh(new BoxGeometry(0.32, 0.2, 0.24), new MeshBasicMaterial({ color: 0x6a5a32 }));
  box.position.y = 0.18;
  const stripe = new Mesh(new BoxGeometry(0.34, 0.05, 0.26), new MeshBasicMaterial({ color: 0xd2b15a }));
  stripe.position.y = 0.22;
  g.add(box);
  g.add(stripe);
  return g;
}

export function createGrove(spots) {
  const trunkGeo = geo('groveTrunk', () => new CylinderGeometry(0.18, 0.38, 4.6, 6));
  const leafA = geo('groveLeafA', () => new ConeGeometry(1.7, 3.1, 7));
  const leafB = geo('groveLeafB', () => new ConeGeometry(1.25, 2.3, 6));
  const trunks = new InstancedMesh(trunkGeo, pbrMat('bark', 0x3a2c22, { gloss: 0.18, uvRepeat: 1.4, normalAmt: 0.85 }), spots.length);
  const top = new InstancedMesh(leafA, litMat(0x243428, undefined, { gloss: 0.08, normalAmt: 0.15 }), spots.length);
  const mid = new InstancedMesh(leafB, litMat(0x2c4030, undefined, { gloss: 0.08, normalAmt: 0.1 }), spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, 2.3 * s.s, s.z);
    dummy.scale.set(s.s, s.s * (0.85 + (i % 3) * 0.12), s.s);
    dummy.rotation.y = s.rot;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 4.4 * s.s;
    dummy.updateMatrix();
    top.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 5.5 * s.s;
    dummy.scale.setScalar(s.s * 0.85);
    dummy.updateMatrix();
    mid.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  top.instanceMatrix.needsUpdate = true;
  mid.instanceMatrix.needsUpdate = true;
  trunks.computeBoundingSphere();
  top.computeBoundingSphere();
  mid.computeBoundingSphere();
  return [trunks, top, mid];
}

export function createTree() {
  const g = new Group();
  const trunk = solid(geo('trunk', () => new CylinderGeometry(0.18, 0.32, 3.2, 6)), 0x6a4a32);
  trunk.position.y = 1.6;
  const leaf = solid(geo('leaf', () => new ConeGeometry(1.55, 2.8, 7)), 0x3d6244);
  leaf.position.y = 3.6;
  const leaf2 = solid(geo('leaf2', () => new ConeGeometry(1.15, 2.1, 6)), 0x4e7354);
  leaf2.position.y = 4.7;
  g.add(trunk, leaf, leaf2);
  return g;
}

export function createRock() {
  const mesh = solid(geo('rock', () => new IcosahedronGeometry(0.55, 0)), 0x3a4654);
  mesh.scale.set(1.2, 0.7, 1);
  return mesh;
}

export function createSentry() {
  const g = new Group();
  const base = solid(new CylinderGeometry(0.22, 0.28, 0.18, 6), 0x3a414c);
  base.position.y = 0.1;
  const stand = solid(new CylinderGeometry(0.06, 0.06, 0.55, 5), 0x2c323a);
  stand.position.y = 0.42;
  const gun = solid(new BoxGeometry(0.12, 0.12, 0.42), 0x22262c);
  gun.position.set(0, 0.72, -0.08);
  const lens = new Mesh(new SphereGeometry(0.06, 8, 6), basic('lens', 0x67d4ff));
  lens.position.set(0, 0.72, -0.28);
  g.add(base, stand, gun, lens);
  g.userData.barrel = gun;
  return g;
}

export function createDrips(count, frames) {
  const positions = new Float32Array(count * 3);
  const drops = [];
  for (let i = 0; i < count; i++) {
    const f = frames[(i * 7) % frames.length];
    const x = f.p.x + (Math.random() - 0.5) * f.radius;
    const z = f.p.z + (Math.random() - 0.5) * f.radius;
    const y = f.floorY + 1.5 + Math.random() * (f.ceilY - f.floorY - 1.2);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    drops.push({
      x, y, z,
      speed: 2.2 + Math.random() * 2.4,
      frame: f,
    });
  }
  const geoD = new BufferGeometry();
  geoD.setAttribute('position', new BufferAttribute(positions, 3));
  const mat = new PointsMaterial({
    color: 0xd5e6f4,
    size: 2.2,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const points = new Points(geoD, mat);
  points.frustumCulled = false;
  return { points, drops, positions };
}

export function createBeam() {
  const cone = new Mesh(
    new ConeGeometry(1.35, 10, 14, 1, true),
    new MeshBasicMaterial({
      color: 0xc9d7ea,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );
  cone.geometry.translate(0, -5, 0);
  cone.rotation.x = Math.PI / 2;
  cone.frustumCulled = false;
  return cone;
}

export function createDust(count = 36) {
  const n = count;
  const positions = new Float32Array(n * 3);
  const spec = [];
  for (let i = 0; i < n; i++) {
    const z = -2.2 - Math.random() * 6.5;
    const spread = 0.15 + Math.random() * 0.55;
    const x = (Math.random() - 0.5) * spread;
    const y = (Math.random() - 0.5) * spread;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    spec.push({ x, y, z });
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const mat = new PointsMaterial({
    color: 0xe7eef8,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;
  return { points, spec, positions };
}

export function createRing(color) {
  const mesh = new Mesh(
    new RingGeometry(0.38, 0.52, 18),
    basic(`ring${color.toString(16)}`, color, { transparent: true, opacity: 0.9, side: DoubleSide }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.06;
  return mesh;
}

function medkitTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d9d3c8';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#9d2a2a';
  g.fillRect(26, 8, 12, 48);
  g.fillRect(8, 26, 48, 12);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

let stalMat;
export function stalactite() {
  if (!stalMat) {
    stalMat = pbrMat('rock', 0x8ea4b0, { gloss: 0.62, uvRepeat: 1.2, normalAmt: 0.7, roughBias: -0.15 });
    stalMat.userData.shared = true;
  }
  return new Mesh(geo('stal', () => new ConeGeometry(0.12, 1.5, 6)), stalMat);
}

export { BackSide };
