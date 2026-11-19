const MOUSE = 0.00215;
const TOUCH = 0.0048;

export function createInput() {
  const keys = new Set();
  let enabled = false;
  let fire = false;
  let joyId = null;
  let lookId = null;
  let joyX = 0;
  let joyY = 0;
  const joyOrigin = { x: 0, y: 0 };
  const lookLast = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  const edges = { reload: false, ability: false, swap: false, slots: [], fireEdge: false };

  const moveZone = () => document.getElementById('move-zone');
  const lookZone = () => document.getElementById('look-zone');
  const joyEl = () => document.getElementById('joy');

  function setEnabled(v) {
    enabled = v;
    if (!v) {
      fire = false;
      joyX = 0;
      joyY = 0;
      joyId = null;
      lookId = null;
      keys.clear();
      hideJoy();
    }
  }

  function hideJoy() {
    const el = joyEl();
    if (el) el.classList.add('hidden');
  }

  function placeJoy(ox, oy, kx, ky) {
    const el = joyEl();
    if (!el) return;
    el.classList.remove('hidden');
    el.style.left = `${ox}px`;
    el.style.top = `${oy}px`;
    const knob = el.querySelector('i');
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  function onKeyDown(e) {
    if (!enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyR') edges.reload = true;
    if (e.code === 'KeyQ') edges.ability = true;
    if (e.code === 'Digit1') edges.slots.push(0);
    if (e.code === 'Digit2') edges.slots.push(1);
    if (e.code === 'Digit3') edges.slots.push(2);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseDown(e) {
    if (!enabled || e.button !== 0) return;
    if (e.target.closest('button, .screen, #buttons, #rotate')) return;
    const canvas = document.getElementById('view');
    if (e.target === canvas && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
    if (document.pointerLockElement || e.target === canvas) {
      fire = true;
      edges.fireEdge = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) fire = false;
  }

  function onMouseMove(e) {
    if (!enabled || !document.pointerLockElement) return;
    look.x += e.movementX * MOUSE;
    look.y += -e.movementY * MOUSE;
  }

  function onLockChange() {
    if (!document.pointerLockElement) fire = false;
  }

  function joyDown(e) {
    if (!enabled) return;
    e.preventDefault();
    joyId = e.pointerId;
    joyOrigin.x = e.clientX;
    joyOrigin.y = e.clientY;
    moveZone().setPointerCapture(e.pointerId);
    placeJoy(e.clientX, e.clientY, 0, 0);
  }

  function joyMove(e) {
    if (e.pointerId !== joyId) return;
    const dx = e.clientX - joyOrigin.x;
    const dy = e.clientY - joyOrigin.y;
    const max = 48;
    const mag = Math.hypot(dx, dy) || 1;
    const s = mag > max ? max / mag : 1;
    const cx = dx * s;
    const cy = dy * s;
    joyX = cx / max;
    joyY = -cy / max;
    placeJoy(joyOrigin.x, joyOrigin.y, cx, cy);
  }

  function joyUp(e) {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joyX = 0;
    joyY = 0;
    hideJoy();
  }

  function lookDown(e) {
    if (!enabled) return;
    if (e.target.closest('#buttons')) return;
    e.preventDefault();
    lookId = e.pointerId;
    lookLast.x = e.clientX;
    lookLast.y = e.clientY;
    lookZone().setPointerCapture(e.pointerId);
  }

  function lookMove(e) {
    if (e.pointerId !== lookId) return;
    const dx = e.clientX - lookLast.x;
    const dy = e.clientY - lookLast.y;
    lookLast.x = e.clientX;
    lookLast.y = e.clientY;
    look.x += dx * TOUCH;
    look.y += -dy * TOUCH;
  }

  function lookUp(e) {
    if (e.pointerId !== lookId) return;
    lookId = null;
  }

  function bindButton(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      fn(true);
    });
    const off = (e) => {
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      fn(false);
    };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
  }

  function mount() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    const mz = moveZone();
    const lz = lookZone();
    mz.addEventListener('pointerdown', joyDown);
    mz.addEventListener('pointermove', joyMove);
    mz.addEventListener('pointerup', joyUp);
    mz.addEventListener('pointercancel', joyUp);
    lz.addEventListener('pointerdown', lookDown);
    lz.addEventListener('pointermove', lookMove);
    lz.addEventListener('pointerup', lookUp);
    lz.addEventListener('pointercancel', lookUp);
    bindButton('btn-fire', (down) => {
      fire = down;
      if (down) edges.fireEdge = true;
    });
    bindButton('btn-reload', (down) => { if (down) edges.reload = true; });
    bindButton('btn-ability', (down) => { if (down) edges.ability = true; });
    bindButton('btn-swap', (down) => { if (down) edges.swap = true; });
    window.addEventListener('blur', () => { fire = false; keys.clear(); });
  }

  function move() {
    let x = joyX;
    let y = joyY;
    if (keys.has('KeyD')) x += 1;
    if (keys.has('KeyA')) x -= 1;
    if (keys.has('KeyW')) y += 1;
    if (keys.has('KeyS')) y -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  function consumeLook() {
    const d = { x: look.x, y: look.y };
    look.x = 0;
    look.y = 0;
    return d;
  }

  function consumeEdges() {
    const out = {
      reload: edges.reload,
      ability: edges.ability,
      swap: edges.swap,
      slots: edges.slots.slice(),
      fireEdge: edges.fireEdge,
    };
    edges.reload = false;
    edges.ability = false;
    edges.swap = false;
    edges.fireEdge = false;
    edges.slots.length = 0;
    return out;
  }

  return {
    mount,
    setEnabled,
    move,
    consumeLook,
    consumeEdges,
    fireHeld: () => fire,
  };
}
