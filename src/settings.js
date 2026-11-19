const KEY = 'zs-settings';
const RATE_KEY = 'zs-rate-at';
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  look: 1,
  aim: 0.55,
  invertY: false,
  smooth: 0.12,
  quality: 'auto',
};

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next) {
  const data = { ...loadSettings(), ...next };
  localStorage.setItem(KEY, JSON.stringify(data));
  return data;
}

export function resolvedQuality(settings = loadSettings()) {
  if (settings.quality === 'low' || settings.quality === 'high') return settings.quality;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (mobile && (mem <= 4 || cores <= 4)) return 'low';
  return 'high';
}

export function shouldAskRating() {
  const last = Number(localStorage.getItem(RATE_KEY) || 0);
  return Date.now() - last > NINETY_DAYS;
}

export function markRatingAsked() {
  localStorage.setItem(RATE_KEY, String(Date.now()));
}
