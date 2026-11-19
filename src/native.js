import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { KeepAwake } from '@capacitor-community/keep-awake';

export const native = Capacitor.isNativePlatform();

export async function prepareShell() {
  if (!native) return;
  try { await StatusBar.hide(); } catch { /* browser or already hidden */ }
  try { await ScreenOrientation.lock({ orientation: 'landscape' }); } catch { /* unsupported */ }
  try { await SplashScreen.hide(); } catch { /* already hidden */ }
}

export async function setAwake(on) {
  if (!native) return;
  try {
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  } catch { /* plugin missing on web */ }
}

export function watchAppState(game, audio) {
  if (!native) return;
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      audio.resume().catch(() => {});
      game.resumeFromBackground();
    } else {
      game.pauseForBackground();
      audio.suspend().catch(() => {});
    }
  });
}
