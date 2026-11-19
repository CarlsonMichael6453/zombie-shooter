import {
  WebGLRenderer, PerspectiveCamera, Scene, Color, FogExp2, Group, Vector2, Vector3,
  Raycaster, BufferGeometry, BufferAttribute, Float32BufferAttribute, Line, LineBasicMaterial,
  Mesh, SphereGeometry, MeshBasicMaterial, ConeGeometry, AdditiveBlending, DoubleSide,
  SRGBColorSpace, ACESFilmicToneMapping, CircleGeometry, BackSide, CatmullRomCurve3,
} from 'three';
import { CHARACTERS, WEAPONS, CAVE, BOSS, BUG, VOICE, EYE, BASE_HP } from './config.js';
import { flash, litMat, paint, setAtmosphere } from './materials.js';
import {
  createWallskitter, createBird, poseBird, createWeaponModel, createMedkit, createAmmoCrate,
  createTree, createRock, createSentry, createDrips, createDust, createRing, stalactite,
} from './models.js';

const UP = new Vector3(0, 1, 0);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function disposeTree(obj) {
  const seen = new Set();
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (!m || m.userData.shared || seen.has(m)) continue;
      seen.add(m);
      m.dispose();
    }
  });
}

export class Game {
  constructor({ canvas, audio, input, ui, hooks }) {
    this.canvas = canvas;
    this.audio = audio;
    this.input = input;
    this.ui = ui;
    this.hooks = hooks;
    this.running = false;
    this.token = 0;
    this.time = 0;
    this.feet = new Vector3();
    this.knock = new Vector3();
    this.forward = new Vector3();
    this.flat = new Vector3();
    this.right = new Vector3();
    this.ndc = new Vector2();
    this.raycaster = new Raycaster();
    this.tmp = new Vector3();
    this.tmp2 = new Vector3();
    this.muzzlePos = new Vector3();
    this.lastSeen = new Vector3();
    this.dashDir = new Vector3();
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.hitMeshes = [];
    this.solidMeshes = [];
    this.colliders = [];
    this.queue = [];
    this.lineCd = {};
    this.slots = [];
    this.slotIndex = 0;

    const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
    this.renderer.setClearColor(0x070b10, 1);

    this.scene = new Scene();
    this.scene.background = new Color(0x070b10);
    this.scene.fog = new FogExp2(0x070b10, 0.042);
    this.camera = new PerspectiveCamera(72, 1, 0.08, 180);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.view = new Group();
    this.view.position.set(0.36, -0.3, -0.72);
    this.camera.add(this.view);
    const dust = createDust();
    this.dust = dust;
    this.camera.add(dust.points);

    this.flame = new Mesh(
      new ConeGeometry(0.55, 2.8, 8, 1, true),
      new MeshBasicMaterial({
        color: 0xff6a1a,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );
    this.flame.geometry.translate(0, -1.4, 0);
    this.flame.rotation.x = Math.PI / 2;
    this.flame.position.set(0.05, -0.08, -0.35);
    this.flame.visible = false;
    this.flame.frustumCulled = false;
    this.camera.add(this.flame);

    this.tracers = [];
    const tracerMat = new LineBasicMaterial({ color: 0xffe6c4, transparent: true, opacity: 0.85 });
    tracerMat.userData.shared = true;
    for (let i = 0; i < 20; i++) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
      const line = new Line(geometry, tracerMat);
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.frame = 0;
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      if (this.running) {
        this.update(dt);
        this.renderer.render(this.scene, this.camera);
        this.frame += 1;
      }
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  current() {
    return this.slots[this.slotIndex];
  }

  start(id) {
    this.token += 1;
    this.clearWorld();
    this.running = true;
    this.dead = false;
    this.won = false;
    this.inputLock = false;
    this.transitioning = false;
    this.char = CHARACTERS[id];
    this.characterId = id;
    this.maxHp = Math.round(BASE_HP * this.char.hpMult);
    this.hp = this.maxHp;
    this.time = 0;
    this.abilityCd = 0;
    this.buffT = 0;
    this.hiddenT = 0;
    this.dashT = 0;
    this.iframe = 0;
    this.shake = 0;
    this.hurtV = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.nextShot = 0;
    this.seenBug = false;
    this.lowSaid = false;
    this.voiceUntil = 0;
    this.lineCd = {};
    this.waveIndex = 0;
    this.queue = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.hitMeshes = [];
    this.kick = 0;
    this.bob = 0;
    this.sway = 0;
    this.flameT = 0;
    this.dripT = 1;
    this.hintT = 8;
    this.playerT = 0;
    this.favFlip = false;
    this.pickFlip = false;
    this.slots = this.char.start.map((wid) => {
      const def = WEAPONS[wid];
      return {
        def,
        mag: def.mag || 0,
        reserve: Math.ceil((def.reserve || 0) * this.char.ammoMult),
      };
    });
    this.slotIndex = Math.min(1, this.slots.length - 1);
    this.setView(this.current().def.view);
    this.level = 'cave';
    this.applyAtmosphere('cave');
    this.buildCave();
    this.buildForest();
    this.scene.add(this.caveRoot);
    this.solidMeshes = this.caveSolids;
    this.colliders = this.caveColliders;
    this.placePlayerAtCaveStart();
    this.audio.playPlaylist('cave');
    this.ui.objective('The Cave — find the way out');
    this.ui.subtitle(this.char.short, this.char.barks.enterCave, 2800);
    this.ui.intro(false);
    this.ui.boss(false, 1);
    this.ui.fade(0);
    this.ui.hint(true);
    const abilityBtn = document.getElementById('btn-ability');
    if (abilityBtn) abilityBtn.textContent = this.char.ability.short;
    this.last = performance.now();
    this.refreshHud();
  }

  stop() {
    this.token += 1;
    this.running = false;
    this.clearWorld();
    this.ui.boss(false, 0);
    this.ui.intro(false);
    this.ui.fade(0);
  }

  clearWorld() {
    for (const root of [this.caveRoot, this.forestRoot]) {
      if (!root) continue;
      this.scene.remove(root);
      disposeTree(root);
    }
    this.caveRoot = null;
    this.forestRoot = null;
    for (const p of this.projectiles || []) {
      this.scene.remove(p.mesh);
      disposeTree(p.mesh);
    }
    this.projectiles = [];
    if (this.sentry) {
      this.scene.remove(this.sentry.mesh);
      disposeTree(this.sentry.mesh);
      this.sentry = null;
    }
    this.enemies = [];
    this.pickups = [];
    this.hitMeshes = [];
    this.drips = null;
  }

  applyAtmosphere(level) {
    setAtmosphere(level);
    this.scene.fog.color.copy(flash.uFog.value);
    this.scene.fog.density = flash.uFogDensity.value;
    this.scene.background.copy(flash.uFog.value);
    this.renderer.setClearColor(flash.uFog.value, 1);
  }

  buildCave() {
    const pts = [];
    const knots = 22;
    for (let i = 0; i <= knots; i++) {
      const t = i / knots;
      const x = Math.sin(t * Math.PI * 1.55) * 11 + Math.sin(t * Math.PI * 3.7) * 3.2;
      const z = t * CAVE.length;
      const y = 3.5 + Math.sin(t * Math.PI * 2.1) * 0.9;
      pts.push(new Vector3(x, y, z));
    }
    const curve = new CatmullRomCurve3(pts);
    const rings = 140;
    const segs = 14;
    const positions = [];
    const frames = [];
    let up = new Vector3(0, 1, 0);
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      up = up.clone().addScaledVector(tan, -up.dot(tan));
      if (up.lengthSq() < 1e-6) up = new Vector3(0, 1, 0);
      up.normalize();
      const bin = new Vector3().crossVectors(tan, up).normalize();
      let radius = 3.2 + Math.sin(i * 0.41) * 0.38 + Math.sin(i * 0.17) * 0.22;
      if (t < 0.04) radius += 1.35;
      if (t > 0.93) radius += 1.8;
      let floorY = Infinity;
      let ceilY = -Infinity;
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        let cx = Math.cos(a);
        let cy = Math.sin(a);
        if (cy < 0) cy *= 0.42;
        const yScale = 0.78;
        const x = p.x + bin.x * cx * radius + up.x * cy * radius * yScale;
        const y = p.y + bin.y * cx * radius + up.y * cy * radius * yScale;
        const z = p.z + bin.z * cx * radius + up.z * cy * radius * yScale;
        positions.push(x, y, z);
        if (y < floorY) floorY = y;
        if (y > ceilY) ceilY = y;
      }
      frames.push({
        t,
        p,
        tan: tan.clone(),
        up: up.clone(),
        bin: bin.clone(),
        radius,
        floorY,
        ceilY,
      });
      if (i < rings) {
        const tan2 = curve.getTangentAt((i + 1) / rings).normalize();
        const axis = new Vector3().crossVectors(tan, tan2);
        const s = axis.length();
        if (s > 1e-5) up.applyAxisAngle(axis.multiplyScalar(1 / s), Math.asin(Math.min(1, s)));
      }
    }
    const indices = [];
    for (let i = 0; i < rings; i++) {
      for (let k = 0; k < segs; k++) {
        const a = i * segs + k;
        const b = i * segs + ((k + 1) % segs);
        const c = (i + 1) * segs + k;
        const d = (i + 1) * segs + ((k + 1) % segs);
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    paint(geometry, (c, x, y, z, i) => {
      const ring = Math.floor(i / segs);
      const f = frames[Math.min(frames.length - 1, ring)];
      const h = (y - f.floorY) / Math.max(0.5, f.ceilY - f.floorY);
      const n = hash(i * 1.3);
      let r = 0.18 + n * 0.07;
      let gch = 0.2 + n * 0.06;
      let b = 0.26 + n * 0.08;
      if (h < 0.22) {
        r += 0.03;
        gch += 0.04;
        b += 0.08;
      }
      if (n > 0.94) gch += 0.04;
      if (f.t > 0.9) {
        b += 0.06;
        gch += 0.03;
      }
      c.setRGB(r, gch, b);
    });
    const caveMat = litMat(0xffffff, DoubleSide);
    const caveMesh = new Mesh(geometry, caveMat);
    const root = new Group();
    root.add(caveMesh);
    this.frames = frames;
    this.caveSolids = [caveMesh];
    this.caveColliders = [];

    for (let i = 4; i < frames.length; i += 6) {
      const f = frames[i];
      const hang = stalactite();
      const len = 0.7 + hash(i) * 1.3;
      hang.scale.set(0.8 + hash(i + 2), len, 0.8 + hash(i + 3));
      hang.position.set(
        f.p.x + f.up.x * (f.ceilY - f.p.y) * 0.92,
        f.ceilY - 0.15,
        f.p.z + f.up.z * 0.2,
      );
      hang.rotation.x = Math.PI;
      root.add(hang);
      if (i % 12 === 0) {
        const rock = createRock();
        const side = i % 24 === 0 ? 1 : -1;
        rock.position.set(
          f.p.x + f.bin.x * side * f.radius * 0.48,
          f.floorY + 0.15,
          f.p.z + f.bin.z * side * f.radius * 0.48,
        );
        rock.rotation.y = hash(i) * 6;
        rock.scale.setScalar(0.55 + hash(i + 5) * 0.7);
        root.add(rock);
        this.caveColliders.push({ x: rock.position.x, z: rock.position.z, r: 0.45 * rock.scale.x });
        this.caveSolids.push(rock);
      }
    }

    const drips = createDrips(70, frames);
    root.add(drips.points);
    this.drips = drips;

    for (let i = 0; i < CAVE.pickups.length; i++) {
      const spec = CAVE.pickups[i];
      const f = frames[Math.round(spec.t * (frames.length - 1))];
      const side = i % 2 === 0 ? 1 : -1;
      const mesh = this.makePickup(spec);
      mesh.position.set(
        f.p.x + f.bin.x * side * 0.85,
        f.floorY,
        f.p.z + f.bin.z * side * 0.85,
      );
      root.add(mesh);
      this.pickups.push({ ...spec, mesh, taken: false, baseY: f.floorY, level: 'cave' });
    }

    this.caveRoot = root;
  }

  buildForest() {
    const root = new Group();
    const groundGeo = new CircleGeometry(62, 28);
    paint(groundGeo, (c, x, y, z, i) => {
      const n = hash(i + x * 2.2 + y * 1.7);
      c.setRGB(0.08 + n * 0.04, 0.1 + n * 0.045, 0.07 + n * 0.025);
    });
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new Mesh(groundGeo, litMat(0xffffff));
    root.add(ground);
    this.forestSolids = [ground];
    this.forestColliders = [];

    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * Math.PI * 2 + hash(i) * 0.4;
      const rad = 14 + hash(i + 3) * 22;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      if (Math.abs(x) < 5.5 && z > 14) continue;
      const tree = createTree();
      const s = 0.85 + hash(i + 8) * 0.7;
      tree.scale.setScalar(s);
      tree.position.set(x, 0, z);
      tree.rotation.y = hash(i + 4) * 6;
      root.add(tree);
      this.forestColliders.push({ x, z, r: 0.55 * s });
      tree.traverse((o) => {
        if (o.isMesh) this.forestSolids.push(o);
      });
    }
    for (let i = 0; i < 10; i++) {
      const rock = createRock();
      const ang = hash(i + 20) * Math.PI * 2;
      const rad = 8 + hash(i + 21) * 16;
      rock.position.set(Math.cos(ang) * rad, 0.1, Math.sin(ang) * rad);
      if (rock.position.z > 16 && Math.abs(rock.position.x) < 4) rock.position.z = -6;
      rock.scale.setScalar(0.6 + hash(i) * 0.8);
      root.add(rock);
    }

    const moonMat = new MeshBasicMaterial({ color: 0xd7e4ff, fog: false });
    moonMat.userData.shared = true;
    const moon = new Mesh(new SphereGeometry(3.2, 12, 10), moonMat);
    moon.position.set(-26, 32, -18);
    root.add(moon);

    const bird = createBird();
    bird.position.set(0, 0, 0);
    poseBird(bird, 0.05, 0, 0);
    root.add(bird);
    const shadow = new Mesh(
      new CircleGeometry(2.4, 16),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);

    const boss = {
      kind: 'boss',
      mesh: bird,
      shadow,
      mats: bird.userData.mats,
      hp: BOSS.hp,
      maxHp: BOSS.hp,
      alive: true,
      phase: 'sleep',
      timer: 0,
      screeched: false,
      attack: null,
      attackT: 0,
      nextAttack: 0,
      hover: 0,
      patternI: 0,
      hitDone: false,
      aimX: 0,
      aimZ: 0,
      aim: new Vector3(),
      pos: bird.position,
    };
    const bossHits = [];
    bird.traverse((o) => {
      if (o.isMesh && o.userData.ownerKind === 'boss') {
        o.userData.owner = boss;
        bossHits.push(o);
      }
    });
    this.boss = boss;
    this.bossHits = bossHits;

    const loot = [
      { kind: 'health', x: -2.2, z: 18 },
      { kind: 'ammo', x: 2.2, z: 17 },
      { kind: 'health', x: 0.4, z: 14.5 },
    ];
    for (const spec of loot) {
      const mesh = this.makePickup(spec);
      mesh.position.set(spec.x, 0, spec.z);
      root.add(mesh);
      this.pickups.push({ ...spec, mesh, taken: false, baseY: 0, level: 'forest' });
    }

    this.forestRoot = root;
  }

  makePickup(spec) {
    const g = new Group();
    let color = 0x8fb4d8;
    if (spec.kind === 'health') color = 0xd25a5a;
    else if (spec.kind === 'ammo') color = 0xd2b15a;
    else if (spec.id && WEAPONS[spec.id]) {
      const cat = WEAPONS[spec.id].category;
      color = cat === 'melee' ? 0xc0c6ce : cat === 'special' ? 0x67d4ff : 0x9eb6d6;
      const model = createWeaponModel(WEAPONS[spec.id].view, 0x666666);
      model.scale.setScalar(0.5);
      model.position.y = 0.55;
      g.add(model);
      g.userData.spin = model;
    }
    if (spec.kind === 'health') {
      const kit = createMedkit();
      g.add(kit);
    } else if (spec.kind === 'ammo') {
      g.add(createAmmoCrate());
    }
    g.add(createRing(color));
    return g;
  }

  placePlayerAtCaveStart() {
    const f = this.frames[3];
    const ahead = this.frames[10].p;
    this.feet.set(f.p.x, f.floorY, f.p.z);
    this.constrainCave(this.feet);
    this.aimAt(ahead.x, this.feet.y + EYE, ahead.z);
    this.lastSeen.copy(this.feet);
  }

  frameAt(t) {
    const i = clamp(Math.round(t * (this.frames.length - 1)), 0, this.frames.length - 1);
    return this.frames[i];
  }

  nearestFrame(x, z) {
    let best = 0;
    let bestD = Infinity;
    const frames = this.frames;
    for (let i = 0; i < frames.length; i += 2) {
      const dx = frames[i].p.x - x;
      const dz = frames[i].p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    for (let i = Math.max(0, best - 3); i <= Math.min(frames.length - 1, best + 3); i++) {
      const dx = frames[i].p.x - x;
      const dz = frames[i].p.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return frames[best];
  }

  constrainCave(pos) {
    const f = this.nearestFrame(pos.x, pos.z);
    const dx = pos.x - f.p.x;
    const dz = pos.z - f.p.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    const maxR = Math.max(0.6, f.radius * 0.62);
    if (dist > maxR) {
      pos.x = f.p.x + (dx / dist) * maxR;
      pos.z = f.p.z + (dz / dist) * maxR;
    }
    pos.y = f.floorY;
    this.playerT = f.t;
    return f;
  }

  constrainForest(pos) {
    const d = Math.hypot(pos.x, pos.z);
    const max = 33;
    if (d > max) {
      pos.x = (pos.x / d) * max;
      pos.z = (pos.z / d) * max;
    }
    pos.y = 0;
  }

  pushColliders(pos) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const dist = Math.hypot(dx, dz);
      const min = c.r + 0.35;
      if (dist < min && dist > 0.0001) {
        pos.x = c.x + (dx / dist) * min;
        pos.z = c.z + (dz / dist) * min;
      }
    }
  }

  aimAt(x, y, z) {
    this.camera.position.set(this.feet.x, this.feet.y + EYE, this.feet.z);
    const dx = x - this.camera.position.x;
    const dy = y - this.camera.position.y;
    const dz = z - this.camera.position.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.pitch = clamp(this.pitch, -1.15, 1.15);
    this.applyView();
  }

  applyView() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.position.set(this.feet.x, this.feet.y + EYE + Math.sin(this.bob) * 0.02, this.feet.z);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.07;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.05;
    }
    this.camera.updateMatrixWorld(true);
  }

  update(dt) {
    this.time += dt;
    if (!this.inputLock && !this.dead && !this.won) this.simulate(dt);
    this.decayJuice(dt);
    this.applyView();
    this.updateUniforms();
    this.updateViewmodel(dt);
    this.refreshHud();
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) this.ui.hint(false);
    }
  }

  decayJuice(dt) {
    this.hurtV = Math.max(0, this.hurtV - dt * 0.7);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.kick = Math.max(0, this.kick - dt * 0.35);
    for (const tr of this.tracers) {
      if (tr.life > 0) {
        tr.life -= dt;
        if (tr.life <= 0) tr.line.visible = false;
      }
    }
  }

  simulate(dt) {
    const edges = this.input.consumeEdges();
    const look = this.input.consumeLook();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -1.15, 1.15);
    this.sway += (clamp(-look.x * 0.8, -0.08, 0.08) - this.sway) * Math.min(1, dt * 8);

    this.applyView();
    this.camera.getWorldDirection(this.forward);
    this.flat.copy(this.forward);
    this.flat.y = 0;
    if (this.flat.lengthSq() < 1e-6) this.flat.set(0, 0, -1);
    else this.flat.normalize();
    this.right.crossVectors(this.flat, UP).normalize();

    const wish = this.input.move();
    const weapon = this.current().def;
    let speed = this.char.speed;
    if (weapon.heavy && this.char.heavyPenalty) speed *= 0.82;
    if (this.dashT > 0) {
      this.feet.addScaledVector(this.dashDir, dt);
      this.dashT -= dt;
    } else {
      this.feet.addScaledVector(this.flat, wish.y * speed * dt);
      this.feet.addScaledVector(this.right, wish.x * speed * dt);
    }
    this.feet.addScaledVector(this.knock, dt);
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 3.5));
    if (wish.x || wish.y) this.bob += dt * 10;

    if (this.level === 'cave') {
      this.constrainCave(this.feet);
      this.pushColliders(this.feet);
      this.constrainCave(this.feet);
    } else {
      this.constrainForest(this.feet);
      this.pushColliders(this.feet);
      this.constrainForest(this.feet);
    }

    if (this.hiddenT > 0) this.hiddenT -= dt;
    else this.lastSeen.copy(this.feet);
    if (this.buffT > 0) this.buffT -= dt;
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.iframe > 0) this.iframe -= dt;

    if (edges.slots.length) this.selectSlot(edges.slots[edges.slots.length - 1]);
    if (edges.swap) this.selectSlot((this.slotIndex + 1) % this.slots.length);
    if (edges.reload) this.startReload();
    if (edges.ability) this.useAbility();
    if (this.reloading) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }
    const firing = this.current().def;
    const held = this.input.fireHeld();
    if (edges.fireEdge && !firing.auto) this.tryFire();
    if (held && firing.auto) this.tryFire();

    this.updateWaves(dt);
    this.updateBugs(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updateSentry(dt);
    this.updatePickups(dt);
    this.updateDrips(dt);
    this.updateDust(dt);

    if (this.level === 'cave' && this.playerT > 0.975) this.goForest();
    if (this.hp <= 0 && !this.dead) this.die();
  }

  updateUniforms() {
    flash.uCamPos.value.copy(this.camera.position);
    this.camera.getWorldDirection(flash.uCamDir.value);
  }

  updateViewmodel(dt) {
    const reloadDip = this.reloading ? 0.07 : 0;
    this.view.position.set(0.36 + this.sway, -0.3 + Math.sin(this.bob) * 0.012 - reloadDip, -0.72 - this.kick);
    this.view.rotation.z = -this.sway * 0.4;
    this.view.rotation.x = this.kick * 0.8;
    if (this.viewModel?.userData.flash) {
      this.viewModel.userData.flash.visible = this.muzzleT > 0;
    }
    if (this.muzzleT > 0) this.muzzleT -= dt;
    this.flame.visible = this.flameT > 0;
    if (this.flameT > 0) this.flameT -= dt;
  }

  selectSlot(index) {
    if (!this.slots[index] || index === this.slotIndex) return;
    this.slotIndex = index;
    this.reloading = false;
    this.setView(this.current().def.view);
    this.audio.click();
  }

  setView(view) {
    if (this.viewModel) {
      this.view.remove(this.viewModel);
      disposeTree(this.viewModel);
    }
    this.viewModel = createWeaponModel(view, this.char.glove);
    this.viewModel.scale.setScalar(0.78);
    this.view.add(this.viewModel);
    this.muzzleT = 0;
  }

  startReload() {
    const w = this.current();
    if (!w || this.reloading || w.def.kind === 'melee') return;
    if (!w.def.mag) return;
    if (w.mag >= w.def.mag) return;
    if (w.reserve <= 0) {
      this.ui.toast(this.char.id === 'bruce' ? 'Dry as a dead dingo.' : 'Empty');
      this.audio.click();
      return;
    }
    this.reloading = true;
    this.reloadT = w.def.reload * this.char.reloadMult;
    this.audio.click();
    if (this.char.id === 'bruce') this.say(Math.random() < 0.5 ? 'reloading' : 'shes_thirsty');
    else this.ui.subtitle(this.char.short, pick(this.char.barks.reload), 1500);
  }

  finishReload() {
    const w = this.current();
    this.reloading = false;
    if (!w?.def.mag) return;
    const need = w.def.mag - w.mag;
    const take = Math.min(need, w.reserve);
    w.mag += take;
    w.reserve -= take;
    this.audio.click();
  }

  useAbility() {
    if (this.abilityCd > 0) return;
    const a = this.char.ability;
    this.abilityCd = a.cooldown;
    if (a.id === 'barrage') {
      this.buffT = a.duration;
      this.ui.toast("BIG IRON. Give 'em hell.");
      this.audio.whoosh();
    } else if (a.id === 'ghost') {
      this.dashT = a.dashTime;
      this.hiddenT = a.hidden;
      this.dashDir.copy(this.flat).multiplyScalar(a.dashSpeed);
      this.ui.toast('Gone.');
      this.audio.whoosh();
    } else if (a.id === 'sentry') {
      this.dropSentry(a);
      this.ui.toast('Sentry down. Be good.');
    }
  }

  dropSentry(ability) {
    if (this.sentry) {
      this.scene.remove(this.sentry.mesh);
      disposeTree(this.sentry.mesh);
    }
    const mesh = createSentry();
    mesh.position.copy(this.feet).addScaledVector(this.flat, 1.5);
    if (this.level === 'cave') this.constrainCave(mesh.position);
    else this.constrainForest(mesh.position);
    this.scene.add(mesh);
    this.sentry = { mesh, life: ability.duration, cd: 0.15, ability };
    this.audio.beep();
  }

  tryFire() {
    if (this.inputLock || this.dead || this.won || this.reloading) return;
    const w = this.current();
    if (!w) return;
    const def = w.def;
    const rate = def.fireRate * (this.buffT > 0 ? 1.5 : 1);
    if (this.time < this.nextShot) return;
    if (def.kind !== 'melee') {
      if (w.mag <= 0) {
        this.startReload();
        return;
      }
      w.mag -= 1;
    }
    this.nextShot = this.time + 1 / rate;
    this.kick = Math.max(this.kick, def.recoil || 0.02);
    this.muzzleT = 0.045;
    this.audio.gun(def.kind, def.view);
    if (def.kind === 'melee') this.melee(def);
    else if (def.kind === 'cone') this.cone(def);
    else if (def.kind === 'projectile') this.launch(def);
    else this.hitscan(def);
  }

  damageMul(def, head) {
    let mult = 1;
    if (head) mult *= (def.headMult || 1.75) + (this.char.headBonus || 0);
    if (this.char.favDamage && this.char.favorites.includes(def.id)) mult *= this.char.favDamage;
    if (this.buffT > 0) mult *= 1.5;
    return mult;
  }

  muzzleWorld() {
    const m = this.viewModel?.userData.muzzle;
    if (m) return m.getWorldPosition(this.muzzlePos);
    return this.muzzlePos.copy(this.camera.position);
  }

  tracer(from, to, color = 0xffe6c4) {
    const slot = this.tracers.find((tr) => tr.life <= 0);
    if (!slot) return;
    const arr = slot.line.geometry.attributes.position.array;
    arr[0] = from.x;
    arr[1] = from.y;
    arr[2] = from.z;
    arr[3] = to.x;
    arr[4] = to.y;
    arr[5] = to.z;
    slot.line.geometry.attributes.position.needsUpdate = true;
    slot.line.material.color.setHex(color);
    slot.line.visible = true;
    slot.life = 0.045;
  }

  hitscan(def) {
    const pellets = def.pellets || 1;
    const origin = this.muzzleWorld().clone();
    let any = false;
    const hitSet = new Set();
    for (let i = 0; i < pellets; i++) {
      this.ndc.set((Math.random() - 0.5) * (def.spread || 0), (Math.random() - 0.5) * (def.spread || 0));
      this.raycaster.setFromCamera(this.ndc, this.camera);
      this.raycaster.far = def.range || 60;
      const hits = this.raycaster.intersectObjects(this.hitMeshes.concat(this.solidMeshes), false);
      const hit = hits.find((h) => h.distance > 0.2) || null;
      if (!hit) {
        this.tmp.copy(this.camera.position).addScaledVector(this.forward, def.range || 30);
        this.tracer(origin, this.tmp, def.color || 0xffe6c4);
        continue;
      }
      this.tracer(origin, hit.point, def.color || 0xffe6c4);
      const owner = hit.object.userData.owner;
      if (!owner || hitSet.has(owner)) continue;
      hitSet.add(owner);
      const head = hit.object.userData.zone === 'head';
      const dmg = def.damage * this.damageMul(def, head);
      this.damageOwner(owner, dmg);
      any = true;
      if (def.chain) this.chainFrom(owner, def, dmg);
    }
    if (any) this.ui.ping();
  }

  chainFrom(owner, def, dmg) {
    let current = owner;
    for (let n = 0; n < def.chain; n++) {
      let best = null;
      let bestD = def.chainRange;
      for (const e of this.liveTargets()) {
        if (e === current || !e.alive) continue;
        const d = e.aim.distanceTo(current.aim);
        if (d < bestD) {
          best = e;
          bestD = d;
        }
      }
      if (!best) break;
      this.tracer(current.aim, best.aim, 0x79d6ff);
      this.damageOwner(best, dmg * 0.7);
      current = best;
    }
  }

  cone(def) {
    this.flameT = 0.07;
    const mul = this.damageMul(def, false);
    for (const e of this.liveTargets()) {
      this.tmp.copy(e.aim).sub(this.camera.position);
      const dist = this.tmp.length();
      if (dist > def.range || dist < 0.001) continue;
      this.tmp.multiplyScalar(1 / dist);
      if (this.tmp.dot(this.forward) < (def.cone ?? 0.86)) continue;
      this.damageOwner(e, def.damage * mul);
    }
    this.ui.ping();
  }

  launch(def) {
    const mul = this.damageMul(def, false);
    const pos = this.muzzleWorld().clone();
    const dir = this.forward.clone();
    dir.x += (Math.random() - 0.5) * (def.spread || 0);
    dir.y += (Math.random() - 0.5) * (def.spread || 0);
    dir.normalize();
    const vel = dir.multiplyScalar(def.speed || 20);
    const mesh = new Mesh(
      new SphereGeometry(def.splash > 3 ? 0.16 : 0.1, 8, 6),
      new MeshBasicMaterial({
        color: def.color || 0xff8844,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.projectiles.push({
      pos,
      vel,
      life: 2.4,
      damage: def.damage * mul,
      splash: def.splash || 0,
      gravity: def.gravity || 0,
      mesh,
      color: def.color || 0xff8844,
      linger: def.light || 0,
    });
  }

  melee(def) {
    const mul = this.damageMul(def, false);
    let any = false;
    for (const e of this.liveTargets()) {
      this.tmp.copy(e.aim).sub(this.camera.position);
      const dist = this.tmp.length();
      if (dist > def.range || dist < 0.001) continue;
      if (this.tmp.dot(this.forward) < 0.35 * dist) continue;
      this.damageOwner(e, def.damage * mul);
      any = true;
    }
    if (any) this.ui.ping();
  }

  liveTargets() {
    const list = this.enemies.filter((e) => e.alive);
    if (this.boss && this.boss.alive && this.level === 'forest') list.push(this.boss);
    return list;
  }

  damageOwner(owner, amount) {
    if (!owner || !owner.alive || amount <= 0) return;
    if (owner.kind === 'boss') {
      if (owner.phase !== 'fight') return;
      owner.hp -= amount;
      for (const m of owner.mats) {
        if (m.uniforms?.uFlash) m.uniforms.uFlash.value = 1;
      }
      this.ui.boss(true, Math.max(0, owner.hp / owner.maxHp));
      this.shake = Math.min(0.6, this.shake + 0.08);
      if (owner.hp <= 0) this.win();
      return;
    }
    owner.hp -= amount;
    if (owner.mat?.uniforms?.uFlash) owner.mat.uniforms.uFlash.value = 1;
    if (owner.hp <= 0) this.killBug(owner);
  }

  killBug(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deadT = 1.15;
    this.removeHits(e.mesh);
    this.ui.feed('Wallskitter down');
    const line = pick(this.char.barks.kill);
    if (this.char.id === 'bruce') {
      if (!this.say(Math.random() < 0.5 ? 'get_stuffed' : 'eat_lead')) this.ui.subtitle('Bruce', line, 1600);
    } else {
      this.ui.subtitle(this.char.short, line, 1600);
    }
  }

  removeHits(mesh) {
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      const i = this.hitMeshes.indexOf(o);
      if (i >= 0) this.hitMeshes.splice(i, 1);
    });
  }

  say(id, priority = false) {
    if (this.char.id !== 'bruce') return false;
    if (!priority && this.time < this.voiceUntil) return false;
    if (this.time < (this.lineCd[id] || 0)) return false;
    if (priority) this.audio.stopVoice();
    const dur = this.audio.playVoice(id);
    if (!dur) return false;
    this.voiceUntil = this.time + dur;
    this.lineCd[id] = this.time + 10;
    this.ui.subtitle('Bruce', VOICE[id].text, dur * 1000 + 350);
    return true;
  }

  damagePlayer(amount) {
    if (this.iframe > 0 || this.dead || this.won || this.hiddenT > 0 || this.inputLock) return;
    this.hp = Math.max(0, this.hp - amount);
    this.iframe = 0.62;
    this.hurtV = 1;
    this.shake = Math.min(1, this.shake + 0.45);
    this.audio.hurt();
    if (this.hp > 0 && this.hp / this.maxHp < 0.3 && !this.lowSaid) {
      this.lowSaid = true;
      if (this.char.id === 'bruce') this.say('not_today', true);
      else this.ui.subtitle(this.char.short, this.char.barks.low[0], 2000);
    } else if (this.hp > 0) {
      if (this.char.id === 'bruce') {
        if (!this.say(Math.random() < 0.5 ? 'strewth_bit' : 'not_today')) {
          this.ui.subtitle('Bruce', pick(this.char.barks.hurt), 1400);
        }
      } else {
        this.ui.subtitle(this.char.short, pick(this.char.barks.hurt), 1200);
      }
    }
    if (this.hp <= 0) this.die();
  }

  die() {
    if (this.dead || this.won) return;
    this.dead = true;
    this.inputLock = true;
    const token = this.token;
    const msg = this.level === 'forest' ? this.char.barks.deathBoss : this.char.barks.deathCave;
    setTimeout(() => {
      if (token !== this.token) return;
      this.hooks.onDeath(msg);
    }, 650);
  }

  win() {
    if (this.won || this.dead) return;
    this.won = true;
    this.boss.phase = 'dead';
    this.boss.alive = false;
    this.inputLock = true;
    this.ui.boss(false, 0);
    this.ui.subtitle(this.char.short, this.char.barks.win, 3200);
    const token = this.token;
    setTimeout(() => {
      if (token !== this.token) return;
      this.hooks.onVictory(this.char.barks.win);
    }, 1300);
  }

  giveWeapon(id) {
    const def = WEAPONS[id];
    if (!def) return;
    const existing = this.slots.find((s) => s.def.id === id);
    if (existing) {
      if (def.mag) existing.reserve += Math.ceil(def.mag * 2 * this.char.ammoMult);
      this.ui.toast(`${def.name} — more ammo`);
      this.audio.pickup();
      return;
    }
    const state = {
      def,
      mag: def.mag || 0,
      reserve: Math.ceil((def.reserve || 0) * this.char.ammoMult),
    };
    if (def.kind === 'melee') {
      this.slots[0] = state;
      this.slotIndex = 0;
    } else if (this.slots.length < 3) {
      this.slots.push(state);
      this.slotIndex = this.slots.length - 1;
    } else {
      const idx = this.slotIndex === 0 ? 1 : this.slotIndex;
      this.slots[idx] = state;
      this.slotIndex = idx;
    }
    this.reloading = false;
    this.setView(def.view);
    this.ui.toast(def.name);
    const fav = this.char.favorites.includes(id);
    if (this.char.id === 'bruce') {
      if (fav) {
        this.favFlip = !this.favFlip;
        this.say(this.favFlip ? 'big_iron' : 'make_a_dent');
      } else {
        this.pickFlip = !this.pickFlip;
        this.say(this.pickFlip ? 'beautiful_beast' : 'heavier_better');
      }
    } else {
      this.ui.subtitle(this.char.short, pick(fav ? this.char.barks.fav : this.char.barks.pickup), 1800);
    }
    this.audio.pickup();
  }

  updateWaves(dt) {
    if (this.level !== 'cave') return;
    if (this.waveIndex < CAVE.waves.length && this.playerT >= CAVE.waves[this.waveIndex].at) {
      const wave = CAVE.waves[this.waveIndex];
      this.waveIndex += 1;
      for (let i = 0; i < wave.count; i++) {
        this.queue.push({
          delay: 0.25 + i * 0.42,
          t: clamp(this.playerT + 0.028 + i * 0.008, 0.05, 0.94),
        });
      }
      const line = this.char.id === 'bruce'
        ? 'I hear the bastards.'
        : this.char.id === 'maya'
          ? 'They\'re moving.'
          : 'Multiple contacts. Ceiling.';
      this.ui.toast(line);
    }
    const alive = this.enemies.filter((e) => e.alive).length;
    this.queue = this.queue.filter((q) => {
      q.delay -= dt;
      if (q.delay > 0) return true;
      if (alive + this.spawnedThisTick >= CAVE.maxAlive) return true;
      this.spawnBug(q.t);
      this.spawnedThisTick = (this.spawnedThisTick || 0) + 1;
      return false;
    });
    this.spawnedThisTick = 0;
  }

  spawnBug(t) {
    const mesh = createWallskitter();
    const e = {
      kind: 'bug',
      mesh,
      mat: mesh.userData.mat,
      hp: BUG.hp,
      alive: true,
      state: 'cling',
      t,
      ang: Math.PI / 2 + (Math.random() - 0.5) * 1.1,
      pos: new Vector3(),
      aim: new Vector3(),
      vy: 0,
      attackCd: 0.4,
      deadT: 0,
    };
    mesh.traverse((o) => {
      if (o.isMesh) {
        o.userData.owner = e;
        this.hitMeshes.push(o);
      }
    });
    this.caveRoot.add(mesh);
    this.enemies.push(e);
    this.placeClinger(e);
  }

  placeClinger(e) {
    const f = this.frameAt(e.t);
    const radial = f.radius * 0.48;
    e.pos.copy(f.p)
      .addScaledVector(f.bin, Math.cos(e.ang) * radial)
      .addScaledVector(f.up, Math.abs(Math.sin(e.ang)) * radial * 0.72);
    e.mesh.position.copy(e.pos);
  }

  updateBugs(dt) {
    if (!this.seenBug) {
      const near = this.enemies.some((e) => e.alive && e.pos.distanceTo(this.feet) < 11);
      if (near) {
        this.seenBug = true;
        if (this.char.id === 'bruce') this.say('ten_legs');
        else this.ui.subtitle(this.char.short, this.char.barks.see[0], 2000);
      }
    }
    for (const e of this.enemies) {
      if (!e.alive) {
        e.deadT -= dt;
        e.mesh.rotation.z += dt * 2;
        e.mesh.position.y -= dt * 0.35;
        if (e.deadT <= 0) {
          e.mesh.parent?.remove(e.mesh);
          disposeTree(e.mesh);
          e.removed = true;
        }
        continue;
      }
      if (e.mat?.uniforms?.uFlash) {
        e.mat.uniforms.uFlash.value = Math.max(0, e.mat.uniforms.uFlash.value - dt * 3);
      }
      const target = this.hiddenT > 0 ? this.lastSeen : this.feet;
      if (e.state === 'cling') {
        const dir = Math.sign(this.playerT - e.t);
        e.t = clamp(e.t + dir * BUG.crawl * dt, 0.02, 0.96);
        e.ang += dt * 0.55;
        this.placeClinger(e);
        const ahead = this.frameAt(clamp(e.t + dir * 0.02, 0.02, 0.98));
        const inward = this.frameAt(e.t).p.clone().sub(e.pos).normalize();
        e.mesh.up.copy(inward);
        e.mesh.lookAt(ahead.p);
        const flat = Math.hypot(this.feet.x - e.pos.x, this.feet.z - e.pos.z);
        if (flat < BUG.dropRange) {
          e.state = 'drop';
          e.vy = -0.5;
          e.mesh.up.copy(UP);
        }
      } else if (e.state === 'drop') {
        e.vy -= 16 * dt;
        e.pos.y += e.vy * dt;
        const f = this.nearestFrame(e.pos.x, e.pos.z);
        if (e.pos.y <= f.floorY + 0.32) {
          e.pos.y = f.floorY + 0.32;
          e.state = 'ground';
        }
        e.mesh.position.copy(e.pos);
        e.mesh.lookAt(target.x, e.pos.y, target.z);
      } else {
        const dx = target.x - e.pos.x;
        const dz = target.z - e.pos.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        if (dist > 0.75) {
          e.pos.x += (dx / dist) * BUG.speed * dt;
          e.pos.z += (dz / dist) * BUG.speed * dt;
        }
        if (this.level === 'cave') {
          const f = this.nearestFrame(e.pos.x, e.pos.z);
          const ox = e.pos.x - f.p.x;
          const oz = e.pos.z - f.p.z;
          const od = Math.hypot(ox, oz) || 0.0001;
          const maxR = f.radius * 0.7;
          if (od > maxR) {
            e.pos.x = f.p.x + (ox / od) * maxR;
            e.pos.z = f.p.z + (oz / od) * maxR;
          }
          e.pos.y = f.floorY + 0.32;
        }
        e.mesh.position.copy(e.pos);
        e.mesh.up.copy(UP);
        e.mesh.lookAt(target.x, e.pos.y, target.z);
        e.attackCd -= dt;
        const pd = Math.hypot(this.feet.x - e.pos.x, this.feet.z - e.pos.z);
        if (pd < BUG.attackRange && e.attackCd <= 0 && this.hiddenT <= 0) {
          e.attackCd = BUG.attackCooldown;
          this.damagePlayer(BUG.damage);
        }
      }
      e.aim.copy(e.pos);
      e.aim.y += 0.28;
    }
    this.enemies = this.enemies.filter((e) => !e.removed);
    this.separateBugs(dt);
  }

  separateBugs() {
    const ground = this.enemies.filter((e) => e.alive && e.state === 'ground');
    for (let i = 0; i < ground.length; i++) {
      for (let j = i + 1; j < ground.length; j++) {
        const a = ground[i];
        const b = ground[j];
        const dx = a.pos.x - b.pos.x;
        const dz = a.pos.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 0.85) {
          const push = (0.85 - d) * 0.5;
          a.pos.x += (dx / d) * push;
          a.pos.z += (dz / d) * push;
          b.pos.x -= (dx / d) * push;
          b.pos.z -= (dz / d) * push;
        }
      }
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b || this.level !== 'forest' || !b.alive && b.phase === 'dead') {
      if (b?.phase === 'dead') {
        b.mesh.rotation.z = Math.min(1.2, b.mesh.rotation.z + dt);
        b.mesh.position.y = Math.max(-0.4, b.mesh.position.y - dt * 0.4);
      }
      return;
    }
    for (const m of b.mats) {
      if (m.uniforms?.uFlash) m.uniforms.uFlash.value = Math.max(0, m.uniforms.uFlash.value - dt * 2.5);
    }
    b.aim.copy(b.mesh.position);
    b.aim.y += 2.3;
    const dx = this.feet.x - b.mesh.position.x;
    const dz = this.feet.z - b.mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (b.phase === 'sleep') {
      poseBird(b.mesh, 0.22 + Math.sin(this.time * 1.3) * 0.02, 0.18, this.time);
      if (dist < BOSS.wakeRange) this.wakeBoss();
      return;
    }
    if (b.phase === 'wake') {
      b.timer += dt;
      const stand = smooth(b.timer / 1.5);
      const spread = smooth((b.timer - 1.05) / 1.5);
      poseBird(b.mesh, stand, Math.max(0, spread), this.time * 3);
      b.mesh.lookAt(this.feet.x, b.mesh.position.y, this.feet.z);
      if (b.timer > 1.25 && !b.screeched) {
        b.screeched = true;
        this.audio.screech();
        const kicker = this.char.id === 'bruce' ? "THAT'S NO BLOODY KOOKABURRA" : this.char.barks.boss;
        this.ui.intro(true, kicker);
        if (this.char.id === 'bruce') this.say('no_kookaburra', true);
        else this.ui.subtitle(this.char.short, this.char.barks.boss, 2600);
      }
      if (b.timer > 4.4) {
        b.phase = 'fight';
        this.ui.intro(false);
        this.ui.boss(true, b.hp / b.maxHp);
        this.ui.objective('Kill Gravewing');
        b.nextAttack = this.time + 1.1;
      }
      return;
    }
    if (b.phase !== 'fight') return;
    if (b.hp <= 0) {
      this.win();
      return;
    }
    if (b.attack) this.runBossAttack(b, dt);
    else {
      b.hover += dt * 0.5;
      const tx = Math.cos(b.hover) * 11;
      const tz = Math.sin(b.hover) * 11;
      b.mesh.position.x += (tx - b.mesh.position.x) * Math.min(1, dt * 1.3);
      b.mesh.position.z += (tz - b.mesh.position.z) * Math.min(1, dt * 1.3);
      b.mesh.position.y += (3.2 - b.mesh.position.y) * Math.min(1, dt * 1.6);
      b.mesh.lookAt(this.feet.x, b.mesh.position.y, this.feet.z);
      poseBird(b.mesh, 1, 1, this.time * 5.5);
      if (this.time >= b.nextAttack) this.startBossAttack(b);
      if (dist < 2.5 && b.mesh.position.y < 1.4) this.damagePlayer(BOSS.touchDamage);
    }
    b.shadow.position.x = b.mesh.position.x;
    b.shadow.position.z = b.mesh.position.z;
    b.shadow.scale.setScalar(1.6 + b.mesh.position.y * 0.18);
    b.aim.copy(b.mesh.position);
    b.aim.y += 2.3;
  }

  wakeBoss() {
    const b = this.boss;
    if (b.phase !== 'sleep') return;
    b.phase = 'wake';
    b.timer = 0;
  }

  startBossAttack(b) {
    const name = BOSS.attacks[b.patternI % BOSS.attacks.length];
    b.patternI += 1;
    b.attack = name;
    b.attackT = 0;
    b.hitDone = false;
    b.aimX = this.feet.x;
    b.aimZ = this.feet.z;
  }

  runBossAttack(b, dt) {
    b.attackT += dt;
    const t = b.attackT;
    if (b.attack === 'swoop') {
      if (t < 0.5) b.mesh.position.y += (6.2 - b.mesh.position.y) * Math.min(1, dt * 4);
      else if (t < 1.15) {
        b.mesh.position.x += (b.aimX - b.mesh.position.x) * Math.min(1, dt * 7);
        b.mesh.position.z += (b.aimZ - b.mesh.position.z) * Math.min(1, dt * 7);
        b.mesh.position.y += (0.35 - b.mesh.position.y) * Math.min(1, dt * 8);
        const d = Math.hypot(this.feet.x - b.mesh.position.x, this.feet.z - b.mesh.position.z);
        if (!b.hitDone && d < 2.7 && b.mesh.position.y < 2.4) {
          b.hitDone = true;
          this.damagePlayer(BOSS.swoopDamage);
        }
      } else {
        b.mesh.position.y += (3.2 - b.mesh.position.y) * Math.min(1, dt * 2);
      }
      b.mesh.lookAt(this.feet.x, Math.min(this.feet.y + 1.2, b.mesh.position.y), this.feet.z);
      poseBird(b.mesh, 1, 1, this.time * 10);
      if (t > 1.85) this.endBossAttack(b);
    } else if (b.attack === 'gust') {
      b.mesh.lookAt(this.feet.x, b.mesh.position.y, this.feet.z);
      poseBird(b.mesh, 1, 1, this.time * 14);
      if (t > 0.42 && !b.hitDone) {
        b.hitDone = true;
        this.camera.getWorldDirection(this.tmp);
        b.mesh.getWorldDirection(this.tmp2);
        const toX = this.feet.x - b.mesh.position.x;
        const toZ = this.feet.z - b.mesh.position.z;
        const d = Math.hypot(toX, toZ) || 1;
        const dot = (toX * this.tmp2.x + toZ * this.tmp2.z) / d;
        if (d < 9.5 && dot > 0.35) {
          this.damagePlayer(BOSS.gustDamage);
          this.knock.x += (toX / d) * 11;
          this.knock.z += (toZ / d) * 11;
        }
      }
      if (t > 1.25) this.endBossAttack(b);
    } else {
      const destX = b.mesh.position.x + (b.aimX - b.mesh.position.x) * 0.65;
      const destZ = b.mesh.position.z + (b.aimZ - b.mesh.position.z) * 0.65;
      if (t < 0.7) {
        b.mesh.position.x += (destX - b.mesh.position.x) * Math.min(1, dt * 4);
        b.mesh.position.z += (destZ - b.mesh.position.z) * Math.min(1, dt * 4);
        b.mesh.position.y += ((t < 0.3 ? 1.6 : 0.2) - b.mesh.position.y) * Math.min(1, dt * 6);
        const d = Math.hypot(this.feet.x - b.mesh.position.x, this.feet.z - b.mesh.position.z);
        if (!b.hitDone && d < 2.3) {
          b.hitDone = true;
          this.damagePlayer(BOSS.hopDamage);
        }
      }
      b.mesh.lookAt(this.feet.x, b.mesh.position.y, this.feet.z);
      poseBird(b.mesh, 1, 0.85, this.time * 6);
      if (t > 1.15) this.endBossAttack(b);
    }
  }

  endBossAttack(b) {
    b.attack = null;
    b.nextAttack = this.time + BOSS.attackGap;
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      let boom = p.life <= 0;
      if (!boom && this.level === 'forest' && p.pos.y <= 0.15) boom = true;
      if (!boom && this.level === 'cave') {
        const f = this.nearestFrame(p.pos.x, p.pos.z);
        const radial = Math.hypot(p.pos.x - f.p.x, p.pos.z - f.p.z);
        if (p.pos.y < f.floorY + 0.15 || radial > f.radius * 0.9) boom = true;
      }
      if (!boom) {
        for (const e of this.liveTargets()) {
          if (p.pos.distanceTo(e.aim) < 0.7) {
            boom = true;
            break;
          }
        }
      }
      if (boom) this.explode(p);
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  explode(p) {
    if (p.dead) return;
    p.dead = true;
    for (const e of this.liveTargets()) {
      const d = p.pos.distanceTo(e.aim);
      const radius = Math.max(0.8, p.splash);
      if (d <= radius) this.damageOwner(e, p.damage * (1 - d / (radius + 0.001)));
    }
    this.scene.remove(p.mesh);
    disposeTree(p.mesh);
    if (p.linger > 0 || p.splash > 0) {
      const orb = new Mesh(
        new SphereGeometry(Math.max(0.4, p.splash * 0.45), 8, 6),
        new MeshBasicMaterial({
          color: p.color,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      );
      orb.position.copy(p.pos);
      this.scene.add(orb);
      const born = this.time;
      const life = p.linger || 0.35;
      const tick = () => {
        const u = (this.time - born) / life;
        if (u >= 1 || !this.running) {
          this.scene.remove(orb);
          disposeTree(orb);
          return;
        }
        orb.material.opacity = 0.45 * (1 - u);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    this.audio.click();
  }

  updateSentry(dt) {
    if (!this.sentry) return;
    const s = this.sentry;
    s.life -= dt;
    s.cd -= dt;
    if (s.life <= 0) {
      this.scene.remove(s.mesh);
      disposeTree(s.mesh);
      this.sentry = null;
      return;
    }
    let best = null;
    let bestD = s.ability.range;
    for (const e of this.liveTargets()) {
      const d = e.aim.distanceTo(s.mesh.position);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return;
    s.mesh.lookAt(best.aim.x, best.aim.y, best.aim.z);
    if (s.cd <= 0) {
      s.cd = s.ability.interval;
      this.damageOwner(best, s.ability.damage);
      this.tmp.set(s.mesh.position.x, s.mesh.position.y + 0.7, s.mesh.position.z);
      this.tracer(this.tmp, best.aim, 0x9ad7ff);
      this.audio.gun('hitscan', 'pistol');
    }
  }

  updatePickups(dt) {
    for (const p of this.pickups) {
      if (p.taken || p.level !== this.level) continue;
      p.mesh.position.y = p.baseY + Math.sin(this.time * 2.4 + p.mesh.position.x) * 0.06;
      if (p.mesh.userData.spin) p.mesh.userData.spin.rotation.y += dt * 1.4;
      const d = Math.hypot(this.feet.x - p.mesh.position.x, this.feet.z - p.mesh.position.z);
      if (d > 1.3) continue;
      p.taken = true;
      p.mesh.parent?.remove(p.mesh);
      disposeTree(p.mesh);
      if (p.kind === 'weapon') this.giveWeapon(p.id);
      else if (p.kind === 'health') {
        this.hp = Math.min(this.maxHp, this.hp + 40);
        this.ui.toast(this.char.id === 'elliot' ? 'Medkit. Statistically welcome.' : 'Medkit');
        this.audio.pickup();
        if (this.hp / this.maxHp > 0.3) this.lowSaid = false;
      } else {
        for (const s of this.slots) {
          if (!s.def.mag) continue;
          s.reserve += Math.ceil(s.def.mag * this.char.ammoMult);
        }
        this.ui.toast(this.char.id === 'bruce' ? 'Ammo. About bloody time.' : 'Ammo');
        this.audio.pickup();
      }
    }
  }

  updateDrips(dt) {
    if (!this.drips || this.level !== 'cave') return;
    const { drops, positions } = this.drips;
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      drop.y -= drop.speed * dt;
      if (drop.y < drop.frame.floorY + 0.05) {
        const f = this.frames[(Math.floor(hash(this.time * 10 + i) * this.frames.length) + i * 3) % this.frames.length];
        drop.frame = f;
        drop.x = f.p.x + (hash(i + this.frame) - 0.5) * f.radius * 0.7;
        drop.z = f.p.z + (hash(i * 2 + 4) - 0.5) * f.radius * 0.7;
        drop.y = f.ceilY - 0.2;
        drop.speed = 2.2 + hash(i + 9) * 2.2;
      }
      positions[i * 3] = drop.x;
      positions[i * 3 + 1] = drop.y;
      positions[i * 3 + 2] = drop.z;
    }
    this.drips.points.geometry.attributes.position.needsUpdate = true;
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 0.75 + Math.random() * 1.4;
      this.audio.drip();
    }
  }

  updateDust(dt) {
    const { spec, positions, points } = this.dust;
    for (let i = 0; i < spec.length; i++) {
      spec[i].z -= dt * 0.8;
      if (spec[i].z < -9) spec[i].z = -2.2;
      positions[i * 3] = spec[i].x;
      positions[i * 3 + 1] = spec[i].y;
      positions[i * 3 + 2] = spec[i].z;
    }
    points.geometry.attributes.position.needsUpdate = true;
  }

  async goForest() {
    if (this.transitioning || this.level !== 'cave') return;
    this.transitioning = true;
    this.inputLock = true;
    const token = this.token;
    this.ui.fade(1);
    await wait(450);
    if (token !== this.token) return;
    this.scene.remove(this.caveRoot);
    for (const e of this.enemies) {
      e.mesh.parent?.remove(e.mesh);
      disposeTree(e.mesh);
    }
    this.enemies = [];
    this.hitMeshes = this.bossHits.slice();
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      disposeTree(p.mesh);
    }
    this.projectiles = [];
    if (this.sentry) {
      this.scene.remove(this.sentry.mesh);
      disposeTree(this.sentry.mesh);
      this.sentry = null;
    }
    this.level = 'forest';
    this.applyAtmosphere('forest');
    this.scene.add(this.forestRoot);
    this.solidMeshes = this.forestSolids;
    this.colliders = this.forestColliders;
    this.feet.set(0, 0, 25);
    this.aimAt(0, 2.2, 0);
    this.audio.playPlaylist('forest');
    this.ui.objective('Something is sleeping in the clearing');
    this.ui.subtitle(this.char.short, this.char.barks.enterForest, 2600);
    this.ui.fade(0);
    await wait(460);
    if (token !== this.token) return;
    this.inputLock = false;
    this.transitioning = false;
  }

  refreshHud() {
    if (!this.char) return;
    this.ui.health(this.hp, this.maxHp);
    const w = this.current();
    if (!w) return;
    const ammo = w.def.kind === 'melee' ? '—' : `${w.mag}  /  ${w.reserve}`;
    this.ui.weapon(w.def.name, ammo, this.slots.map((s) => s.def.name), this.slotIndex);
    let label = 'READY';
    let ready = this.abilityCd <= 0;
    if (this.buffT > 0) {
      label = this.buffT.toFixed(1);
      ready = true;
    } else if (this.abilityCd > 0) label = this.abilityCd.toFixed(1);
    this.ui.ability(this.char.ability.short, label, ready);
    this.ui.buff(this.buffT > 0);
    const low = this.hp / this.maxHp < 0.3 ? 0.32 : 0;
    this.ui.hurt(Math.max(this.hurtV * 0.85, low));
  }
}
