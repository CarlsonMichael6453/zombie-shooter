import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.ZS_URL || 'http://127.0.0.1:4173/zombie-shooter/?debug=1';
const out = process.env.ZS_OUT || '/tmp/zs-smoke';
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1280,720',
  ],
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await page.evaluateOnNewDocument(() => localStorage.setItem('zs-rate-at', String(Date.now())));
await page.setViewport({ width: 1280, height: 720 });

function fail(msg) {
  console.error('FAIL', msg);
  console.error(errors.join('\n'));
  process.exitCode = 1;
}

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.screenshot({ path: `${out}/01-title.png` });
const title = await page.$eval('h1', (el) => el.textContent);
if (!title.includes('Zombie Shooter')) fail('missing title');

await page.click('#enter');
await page.waitForSelector('#select:not(.hidden) .card', { timeout: 15000 });
await page.screenshot({ path: `${out}/02-select.png` });
const bios = await page.$$eval('.bio', (nodes) => nodes.map((n) => n.textContent));
if (bios.length !== 3) fail('expected 3 hunters');
if (!/fuck|shit|bloody/i.test(bios[0])) fail('bruce bio is not foul');
if (!/hell|damn/i.test(bios[1])) fail('maya bio tone');
if (/fuck|shit/i.test(bios[2])) fail('elliot should stay clean');

await page.click('.card button.primary');
await page.waitForFunction(() => window.__ZS && window.__ZS.running && window.__ZS.frame > 2, { timeout: 10000 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${out}/03-cave.png` });

const cave = await page.evaluate(() => {
  const g = window.__ZS;
  const f = new g.camera.constructor.__proto__ ? null : null;
  const dir = { x: 0, y: 0, z: 0 };
  g.camera.getWorldDirection(g.forward);
  return {
    level: g.level,
    hp: g.hp,
    weapon: g.current().def.name,
    frame: g.frame,
    feet: { x: g.feet.x, y: g.feet.y, z: g.feet.z },
    forward: { x: g.forward.x, y: g.forward.y, z: g.forward.z },
    playerT: g.playerT,
    gl: !!g.renderer.getContext(),
  };
});
console.log('cave', cave);
if (cave.level !== 'cave') fail('not in cave');
if (cave.hp !== 140) fail('bruce hp');
if (cave.weapon !== 'Hand Cannon') fail('start weapon ' + cave.weapon);

const moved = await page.evaluate(() => {
  const g = window.__ZS;
  const z0 = g.feet.z;
  const frames = 40;
  return new Promise((resolve) => {
    let n = 0;
    const step = () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }));
      n += 1;
      if (n < frames) requestAnimationFrame(step);
      else {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }));
        resolve({ z0, z1: g.feet.z, t: g.playerT });
      }
    };
    step();
  });
});
console.log('moved', moved);
if (moved.z1 <= moved.z0 + 0.2) fail('player did not move forward');

const combat = await page.evaluate(async () => {
  const g = window.__ZS;
  g.spawnBug(Math.min(0.9, g.playerT + 0.02));
  await new Promise((r) => setTimeout(r, 200));
  const e = g.enemies.find((en) => en.alive);
  if (!e) return { error: 'no enemy' };
  const before = e.hp;
  for (let i = 0; i < 12; i++) {
    g.aimAt(e.aim.x, e.aim.y, e.aim.z);
    g.nextShot = 0;
    g.tryFire();
    await new Promise((r) => setTimeout(r, 30));
  }
  return { before, after: e.hp, alive: e.alive, mag: g.current().mag };
});
console.log('combat', combat);
if (combat.error) fail(combat.error);
if (!(combat.after < combat.before)) fail('shots did not damage the wallskitter');

await page.screenshot({ path: `${out}/04-combat.png` });

const forest = await page.evaluate(async () => {
  const g = window.__ZS;
  g.playerT = 0.99;
  g.goForest();
  const start = performance.now();
  while (g.level !== 'forest' && performance.now() - start < 3000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, 600));
  return { level: g.level, z: g.feet.z, boss: g.boss.phase, hp: g.boss.hp };
});
console.log('forest', forest);
if (forest.level !== 'forest') fail('did not reach forest');
await page.screenshot({ path: `${out}/05-forest.png` });

const boss = await page.evaluate(async () => {
  const g = window.__ZS;
  g.feet.set(0, 0, 8);
  await new Promise((r) => setTimeout(r, 300));
  const start = performance.now();
  while (g.boss.phase === 'sleep' && performance.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, 500));
  const phase = g.boss.phase;
  g.boss.phase = 'fight';
  g.boss.hp = 0;
  await new Promise((r) => setTimeout(r, 1600));
  return {
    phase,
    won: g.won,
    winHidden: document.getElementById('win').classList.contains('hidden'),
  };
});
console.log('boss', boss);
await page.screenshot({ path: `${out}/06-victory.png` });
if (!boss.won) fail('boss kill did not win');
if (boss.winHidden) fail('victory screen hidden');

await page.click('#again');
await page.waitForFunction(() => window.__ZS.level === 'cave' && window.__ZS.hp > 0 && !window.__ZS.won, { timeout: 4000 });
const retry = await page.evaluate(() => ({ level: window.__ZS.level, hp: window.__ZS.hp, dead: window.__ZS.dead }));
console.log('retry', retry);

await page.evaluate(() => { window.__ZS.hp = 0; });
await page.waitForSelector('#over:not(.hidden)', { timeout: 4000 });
await page.screenshot({ path: `${out}/07-gameover.png` });
const over = await page.$eval('#over-msg', (el) => el.textContent);
console.log('over', over);
if (!over) fail('empty death message');

await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(url + '&touch=1', { waitUntil: 'networkidle0' });
const portrait = await page.$eval('#rotate', (el) => getComputedStyle(el).display);
console.log('portrait rotate display', portrait);
await page.screenshot({ path: `${out}/08-portrait.png` });
if (portrait === 'none') fail('portrait hint hidden');

await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
await page.goto(url + '&touch=1', { waitUntil: 'networkidle0' });
await page.click('#enter');
await page.waitForSelector('#select:not(.hidden)');
await page.screenshot({ path: `${out}/09-select-phone.png` });
await page.click('.card button.primary');
await page.waitForFunction(() => window.__ZS && window.__ZS.running);
await new Promise((r) => setTimeout(r, 300));
const touchUi = await page.evaluate(() => {
  const layer = document.getElementById('touch-layer');
  const fire = document.getElementById('btn-fire');
  return {
    layer: getComputedStyle(layer).display,
    fire: fire.textContent,
    rotate: getComputedStyle(document.getElementById('rotate')).display,
  };
});
console.log('touch', touchUi);
await page.screenshot({ path: `${out}/10-phone-cave.png` });
if (touchUi.layer === 'none') fail('touch controls hidden in landscape');
if (touchUi.rotate !== 'none') fail('rotate hint showing in landscape');

if (errors.length) {
  console.log('console errors', errors);
  fail('page errors');
} else {
  console.log('SMOKE OK');
}

await browser.close();
