import { CHARACTERS, weaponName, APP_VERSION, FEEDBACK_EMAIL } from './config.js';
import { loadSettings, saveSettings, resolvedQuality, shouldAskRating, markRatingAsked } from './settings.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { Game } from './game.js';
import { prepareShell, setAwake, watchAppState } from './native.js';

const BASE = import.meta.env.BASE_URL;
const params = new URLSearchParams(location.search);
const forceTouch = params.get('touch') === '1';

const audio = createAudio();
const input = createInput();
let game;
let characterId = 'bruce';
let toastTimer = 0;
let subTimer = 0;

const $ = (id) => document.getElementById(id);

function show(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
  document.documentElement.classList.toggle('playing', !id);
}

function setTouchClass() {
  const touch = forceTouch || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.documentElement.classList.toggle('touch', touch);
  document.documentElement.classList.toggle('portrait', window.innerHeight > window.innerWidth + 20);
  $('title-controls').textContent = touch
    ? 'Left stick moves. Drag the right side to look. Fire, reload, ability, and swap sit under your thumb.'
    : 'WASD move · mouse look · click fire · R reload · Q ability · 1–3 weapons';
  $('hint').textContent = touch
    ? 'Left stick moves · drag the right side to look'
    : 'WASD · mouse · click · R · Q · 1 2 3';
}

const ui = {
  health(hp, max) {
    const pct = Math.max(0, Math.min(1, hp / max));
    $('hpfill').style.width = `${pct * 100}%`;
    $('hptxt').textContent = String(Math.max(0, Math.ceil(hp)));
    $('hpfill').style.background = pct < 0.3
      ? 'linear-gradient(90deg, #5a1018, #ff5a4a)'
      : 'linear-gradient(90deg, #6d1e24, #d45448)';
  },
  weapon(name, ammo, names, active) {
    $('wname').textContent = name;
    $('ammo').textContent = ammo;
    const pips = $('pips');
    pips.replaceChildren();
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('i');
      if (i === active) pip.className = 'on';
      if (!names[i]) pip.style.opacity = '0.25';
      pip.title = names[i] || '';
      pips.append(pip);
    }
  },
  ability(name, label, ready) {
    $('aname').textContent = name;
    $('acd').textContent = label;
    $('ability').classList.toggle('ready', ready);
    $('btn-ability')?.classList.toggle('ready', ready);
  },
  objective(text) { $('obj').textContent = text; },
  toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.textContent = ''; }, 2200);
  },
  subtitle(who, text, ms = 2000) {
    const el = $('sub');
    el.replaceChildren();
    const b = document.createElement('b');
    b.textContent = who;
    el.append(b, document.createTextNode(text));
    clearTimeout(subTimer);
    subTimer = setTimeout(() => { el.replaceChildren(); }, ms);
  },
  feed(text) {
    const el = $('feed');
    const row = document.createElement('div');
    row.textContent = text;
    el.prepend(row);
    while (el.children.length > 4) el.lastChild.remove();
    setTimeout(() => row.remove(), 3200);
  },
  boss(showBar, frac) {
    $('bossbar').classList.toggle('hidden', !showBar);
    $('bossfill').style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  },
  intro(showIntro, kicker) {
    $('bossintro').classList.toggle('hidden', !showIntro);
    if (kicker) $('boss-kicker').textContent = kicker;
  },
  hurt(v) { $('hurt').style.setProperty('--h', String(Math.max(0, Math.min(1, v)))); },
  hint(showHint) { $('hint').classList.toggle('hidden', !showHint); },
  buff(on) { $('hud').classList.toggle('buff', on); },
  fade(opacity) { $('fade').style.opacity = String(opacity); },
  ping() {
    $('cross').classList.add('hot');
    setTimeout(() => $('cross').classList.remove('hot'), 70);
  },
};

function boot(id) {
  characterId = id;
  show(null);
  $('hud').classList.remove('hidden');
  input.setEnabled(true);
  game.start(id);
  setAwake(true);
}

function backToSelect() {
  input.setEnabled(false);
  if (document.pointerLockElement) document.exitPointerLock();
  setAwake(false);
  game.stop();
  $('hud').classList.add('hidden');
  audio.playPlaylist('menu');
  show('select');
}

function buildCards() {
  const root = $('cards');
  for (const c of Object.values(CHARACTERS)) {
    const card = document.createElement('article');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = BASE + c.portrait;
    img.alt = c.name;
    const copy = document.createElement('div');
    copy.className = 'copy';
    const h3 = document.createElement('h3');
    h3.textContent = c.name;
    const role = document.createElement('p');
    role.className = 'role';
    role.textContent = c.role;
    const bio = document.createElement('p');
    bio.className = 'bio';
    bio.textContent = c.bio;
    const traits = document.createElement('ul');
    traits.className = 'traits';
    for (const t of c.traits) {
      const li = document.createElement('li');
      li.textContent = t;
      traits.append(li);
    }
    const ability = document.createElement('p');
    ability.className = 'ability-name';
    ability.textContent = c.ability.name;
    const flavor = document.createElement('p');
    flavor.className = 'flavor';
    flavor.textContent = c.ability.flavor;
    const favs = document.createElement('p');
    favs.className = 'favs';
    favs.textContent = `Favorites: ${c.favorites.map(weaponName).join(', ')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary';
    button.textContent = `Take ${c.short}`;
    button.addEventListener('click', () => boot(c.id));
    copy.append(h3, role, bio, traits, ability, flavor, favs);
    card.append(img, copy, button);
    root.append(card);
  }
}

function guardTouch() {
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.copy')) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });
  let last = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - last < 280) e.preventDefault();
    last = now;
  }, { passive: false });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function enter() {
  const button = $('enter');
  button.disabled = true;
  button.textContent = 'Loading';
  audio.ensure();
  try {
    await audio.resume();
    await audio.loadAll();
  } catch (err) {
    console.warn(err);
  }
  audio.playPlaylist('menu');
  show('select');
}

let feedbackStars = 0;
let settingsBack = 'title';

function paintStars(root, value, onPick) {
  root.replaceChildren();
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '★';
    if (i <= value) b.classList.add('on');
    b.addEventListener('click', () => onPick(i));
    root.append(b);
  }
}

function setFeedbackStars(n) {
  feedbackStars = n;
  paintStars($('stars'), n, setFeedbackStars);
}

function fillSettings() {
  const s = loadSettings();
  $('set-look').value = s.look;
  $('set-aim').value = s.aim;
  $('set-smooth').value = s.smooth;
  $('set-invert').checked = s.invertY;
  $('set-quality').value = s.quality;
  const q = resolvedQuality(s);
  $('set-readout').textContent = `Look ${Number(s.look).toFixed(2)}× · aim ${Number(s.aim).toFixed(2)}× · smoothing ${Math.round(s.smooth * 100)}% · graphics ${q}`;
}

function readSettings() {
  const next = saveSettings({
    look: Number($('set-look').value),
    aim: Number($('set-aim').value),
    smooth: Number($('set-smooth').value),
    invertY: $('set-invert').checked,
    quality: $('set-quality').value,
  });
  fillSettings();
  if (game && resolvedQuality(next) !== game.quality) {
    game.quality = resolvedQuality(next);
    const coarse = matchMedia('(pointer: coarse)').matches;
    const cap = game.quality === 'high' ? (coarse ? 1.75 : 2) : 1.5;
    game.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    game.resize();
    game.mountComposer();
  }
}

function openPanel(id, back) {
  settingsBack = back;
  if (id === 'settings') fillSettings();
  if (id === 'feedback') {
    setFeedbackStars(feedbackStars || 0);
    $('fb-meta').textContent = `v${APP_VERSION} · ${navigator.userAgent}`;
  }
  show(id);
}

function closePanel() {
  if (settingsBack === 'pause') show('pause');
  else if (settingsBack === 'title') show('title');
  else {
    show(null);
    $('hud').classList.remove('hidden');
  }
}

function sendFeedback(stars, text, email, bug) {
  const subject = bug ? 'Zombie Shooter bug' : 'Zombie Shooter feedback';
  const body = [
    `Rating: ${stars || 'none'}/5`,
    `Bug report: ${bug ? 'yes' : 'no'}`,
    '',
    text || '(no comment)',
    '',
    `Email: ${email || '(none)'}`,
    `Version: ${APP_VERSION}`,
    `User-Agent: ${navigator.userAgent}`,
  ].join('\n');
  const href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

function askRating(resumeAfter) {
  if (!shouldAskRating()) return;
  markRatingAsked();
  $('rating').dataset.resume = resumeAfter ? '1' : '0';
  const pickRate = (n) => {
    $('rating').dataset.stars = String(n);
    paintStars($('rate-stars'), n, pickRate);
  };
  paintStars($('rate-stars'), 0, pickRate);
  $('rating').classList.remove('hidden');
  if (resumeAfter && game?.running && !game.won && !game.dead) game.setUserPause(true);
}

function togglePause() {
  if (!game?.running || game.dead || game.won || game.transitioning) return;
  const on = !game.userPause;
  game.setUserPause(on);
  if (on) {
    $('hud').classList.add('hidden');
    show('pause');
  } else {
    show(null);
    $('hud').classList.remove('hidden');
  }
}

function wireMenus() {
  $('title-settings').addEventListener('click', () => openPanel('settings', 'title'));
  $('title-feedback').addEventListener('click', () => openPanel('feedback', 'title'));
  $('pause-settings').addEventListener('click', () => openPanel('settings', 'pause'));
  $('pause-feedback').addEventListener('click', () => openPanel('feedback', 'pause'));
  $('settings-close').addEventListener('click', () => { readSettings(); closePanel(); });
  for (const id of ['set-look', 'set-aim', 'set-smooth', 'set-invert', 'set-quality']) {
    $(id).addEventListener('input', readSettings);
  }
  $('feedback-close').addEventListener('click', closePanel);
  $('feedback-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendFeedback(feedbackStars, $('fb-text').value.trim(), $('fb-email').value.trim(), $('fb-bug').checked);
  });
  setFeedbackStars(0);
  $('resume').addEventListener('click', togglePause);
  $('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
  $('pause-title').addEventListener('click', () => {
    game.setUserPause(false);
    backToSelect();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') togglePause();
  });
  $('rating-dismiss').addEventListener('click', () => {
    $('rating').classList.add('hidden');
    if ($('rating').dataset.resume === '1') game.setUserPause(false);
  });
  $('rating-note').addEventListener('click', () => {
    const stars = Number($('rating').dataset.stars || 0);
    $('rating').classList.add('hidden');
    feedbackStars = stars;
    openPanel('feedback', game.won ? 'win' : 'hud');
    setFeedbackStars(stars);
  });
}

function playCutscene() {
  const root = $('cutscene');
  const video = $('cutscene-video');
  const skip = $('cutscene-skip');
  if (!root || !video) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    let screeched = false;
    let canSkip = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (!screeched) {
        screeched = true;
        audio.screech();
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
      root.classList.add('hidden');
      skip.classList.add('hidden');
      resolve();
    };
    root.classList.remove('hidden');
    skip.classList.add('hidden');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.src = `${BASE}assets/video/gravewing-intro.mp4`;
    const arm = setTimeout(() => {
      canSkip = true;
      skip.classList.remove('hidden');
    }, 1000);
    skip.onclick = (e) => {
      e.stopPropagation();
      if (canSkip) finish();
    };
    root.onpointerdown = () => {
      if (canSkip) finish();
    };
    video.ontimeupdate = () => {
      if (!screeched && video.currentTime >= 7.6) {
        screeched = true;
        audio.screech();
      }
    };
    video.onended = finish;
    video.onerror = finish;
    video.play().catch(() => {
      clearTimeout(arm);
      finish();
    });
  });
}

function main() {
  setTouchClass();
  window.addEventListener('resize', setTouchClass);
  window.addEventListener('orientationchange', setTouchClass);
  guardTouch();
  $('title').style.backgroundImage = `linear-gradient(180deg, rgba(5,7,10,0.15), rgba(5,7,10,0.88)), url(${BASE}assets/art/levels/cave.jpg)`;
  buildCards();
  input.mount();
  try {
    game = new Game({
      canvas: $('view'),
      audio,
      input,
      ui,
      hooks: {
        onDeath(msg) {
          input.setEnabled(false);
          if (document.pointerLockElement) document.exitPointerLock();
          $('over-msg').textContent = msg;
          $('hud').classList.add('hidden');
          show('over');
        },
        onVictory(msg) {
          input.setEnabled(false);
          if (document.pointerLockElement) document.exitPointerLock();
          $('win-msg').textContent = msg;
          $('hud').classList.add('hidden');
          show('win');
          askRating(false);
        },
        onCalm() { askRating(true); },
        onCutscene: playCutscene,
      },
    });
  } catch (err) {
    $('fatal').classList.remove('hidden');
    $('fatal').textContent = 'This browser could not start the shooter. WebGL is required.';
    console.error(err);
    return;
  }
  if (!game.renderer.getContext()) {
    $('fatal').classList.remove('hidden');
    $('fatal').textContent = 'WebGL is unavailable in this browser.';
  }
  const unlockAudio = () => {
    audio.ensure();
    audio.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', unlockAudio);
  $('enter').addEventListener('click', enter);
  $('retry').addEventListener('click', () => boot(characterId));
  $('again').addEventListener('click', () => boot(characterId));
  $('to-select').addEventListener('click', backToSelect);
  $('win-select').addEventListener('click', backToSelect);
  if (params.has('debug')) window.__ZS = game;
  wireMenus();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pauseForBackground();
      audio.suspend().catch(() => {});
    } else {
      audio.resume().catch(() => {});
      game.resumeFromBackground();
    }
  });
  watchAppState(game, audio);
  prepareShell();
}

main();
