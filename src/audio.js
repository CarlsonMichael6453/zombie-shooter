import { VOICE, MUSIC, SFX } from './config.js';

const BASE = import.meta.env.BASE_URL;

export function createAudio() {
  let ctx = null;
  let musicGain = null;
  let sfxGain = null;
  let voiceGain = null;
  let noise = null;
  let timer = null;
  let nodes = [];
  let nextTime = 0;
  let playlist = [];
  let index = 0;
  let playlistId = '';
  let voiceNode = null;
  const buffers = new Map();

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.42;
    sfxGain.connect(master);
    voiceGain = ctx.createGain();
    voiceGain.gain.value = 1;
    voiceGain.connect(master);
    const len = Math.floor(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  async function resume() {
    ensure();
    if (ctx.state !== 'running') await ctx.resume();
  }

  async function loadAll() {
    ensure();
    const jobs = [];
    const add = (id, path) => jobs.push(load(id, path));
    MUSIC.menu.forEach((p, i) => add(`menu${i}`, p));
    MUSIC.cave.forEach((p, i) => add(`cave${i}`, p));
    MUSIC.forest.forEach((p, i) => add(`forest${i}`, p));
    add('screech', SFX.screech);
    for (const [id, v] of Object.entries(VOICE)) add(id, v.file);
    await Promise.all(jobs);
  }

  async function load(id, path) {
    try {
      const res = await fetch(BASE + path);
      if (!res.ok) return;
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw.slice(0));
      buffers.set(id, buf);
    } catch (err) {
      console.warn('audio', id, err);
    }
  }

  function playBuffer(id, { volume = 1, dest, rate = 1 } = {}) {
    if (!ctx || !buffers.has(id)) return 0;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffers.get(id);
    src.playbackRate.value = rate;
    g.gain.value = volume;
    src.connect(g);
    g.connect(dest || sfxGain);
    src.start();
    return { src, duration: src.buffer.duration };
  }

  function stopVoice() {
    if (!voiceNode) return;
    try { voiceNode.stop(); } catch { /* already stopped */ }
    voiceNode = null;
  }

  function playVoice(id) {
    if (!buffers.has(id)) return 0;
    stopVoice();
    const played = playBuffer(id, { volume: 1, dest: voiceGain });
    if (!played) return 0;
    voiceNode = played.src;
    return played.duration;
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const n of nodes) {
      try { n.stop(); } catch { /* ended */ }
    }
    nodes = [];
    playlist = [];
    playlistId = '';
  }

  function playPlaylist(name) {
    ensure();
    if (playlistId === name) return;
    stopMusic();
    playlistId = name;
    const count = (MUSIC[name] || []).length;
    playlist = [];
    for (let i = 0; i < count; i++) playlist.push(`${name}${i}`);
    if (!playlist.length || !ctx) return;
    const fade = 1.25;
    index = 0;
    nextTime = ctx.currentTime + 0.06;
    const schedule = () => {
      const id = playlist[index % playlist.length];
      const buf = buffers.get(id);
      if (!buf) {
        index += 1;
        nextTime += 2;
        return;
      }
      const when = Math.max(nextTime, ctx.currentTime);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf;
      src.connect(g);
      g.connect(musicGain);
      const dur = buf.duration;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(1, when + Math.min(fade, dur * 0.25));
      g.gain.setValueAtTime(1, Math.max(when + 0.05, when + dur - fade));
      g.gain.linearRampToValueAtTime(0, when + dur);
      src.start(when);
      src.stop(when + dur + 0.05);
      nodes.push(src);
      src.onended = () => {
        nodes = nodes.filter((n) => n !== src);
      };
      nextTime = when + Math.max(0.5, dur - fade);
      index += 1;
    };
    const pump = () => {
      let guard = 0;
      while (nextTime < ctx.currentTime + 5 && guard < 8) {
        schedule();
        guard += 1;
      }
    };
    pump();
    timer = setInterval(pump, 500);
  }

  function duck(to = 0.08, hold = 12, back = 0.32) {
    if (!musicGain || !ctx) return;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(to, t + 0.35);
    musicGain.gain.setValueAtTime(to, t + hold);
    musicGain.gain.linearRampToValueAtTime(back, t + hold + 1.2);
  }

  function burst(dur, vol, freq, type = 'lowpass') {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, vol, kind = 'sine', slide) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = kind;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function gun(kind, view) {
    if (kind === 'melee') {
      burst(0.12, 0.25, 900, 'bandpass');
      tone(220, 0.08, 0.08, 'sawtooth', 80);
      return;
    }
    if (view === 'shotgun') {
      burst(0.22, 0.55, 1400);
      tone(90, 0.18, 0.2, 'sine', 40);
      return;
    }
    if (view === 'sniper' || view === 'cannon') {
      burst(0.14, 0.4, 2200);
      tone(140, 0.16, 0.16, 'triangle', 50);
      return;
    }
    if (view === 'arc') {
      tone(640, 0.07, 0.12, 'sawtooth', 180);
      burst(0.05, 0.15, 3000, 'highpass');
      return;
    }
    if (view === 'flame') {
      burst(0.09, 0.12, 700);
      return;
    }
    if (view === 'hive' || view === 'flare') {
      burst(0.1, 0.28, 500);
      tone(180, 0.12, 0.1, 'square', 70);
      return;
    }
    burst(0.06, view === 'rifle' || view === 'nail' ? 0.16 : 0.28, 1800);
    tone(160, 0.05, 0.05, 'square');
  }

  function drip() {
    tone(1200 + Math.random() * 400, 0.14, 0.07, 'sine', 180);
  }

  function hurt() {
    burst(0.18, 0.35, 400);
    tone(110, 0.2, 0.18, 'sine', 50);
  }

  function pickup() {
    tone(520, 0.07, 0.1, 'square');
    tone(780, 0.1, 0.08, 'square');
  }

  function click() {
    burst(0.03, 0.2, 2000, 'highpass');
  }

  function whoosh() {
    burst(0.18, 0.22, 1200, 'bandpass');
  }

  function beep() {
    tone(880, 0.06, 0.08, 'square');
  }

  function screech() {
    const played = playBuffer('screech', { volume: 0.85, dest: sfxGain });
    duck(0.07, played ? Math.min(14, played.duration) : 10, 0.3);
  }

  return {
    ensure,
    resume,
    loadAll,
    playPlaylist,
    stopMusic,
    playVoice,
    stopVoice,
    gun,
    drip,
    hurt,
    pickup,
    click,
    whoosh,
    beep,
    screech,
  };
}
