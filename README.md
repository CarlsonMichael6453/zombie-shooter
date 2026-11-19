# Zombie Shooter

A flashlight-lit 3D horror shooter for phone browsers and desktop. Mature 17+.

Play it at [https://carlsonmichael6453.github.io/zombie-shooter/](https://carlsonmichael6453.github.io/zombie-shooter/).

On an iPhone, open that link in Safari, tap Share, then **Add to Home Screen**. It launches fullscreen in landscape. If the phone is portrait, the game asks you to rotate it.

## Controls

**Phone (landscape)**

- Left side: virtual stick to move (deadzone, analog speed)
- Right side: drag to look. The whole right half tracks that finger
- On-screen buttons: fire, aim, reload, ability, weapon swap
- Settings (title screen and pause): look sensitivity, aim sensitivity, invert Y, look smoothing, graphics quality. Saved on the device
- Page scroll, pinch-zoom, and double-tap zoom are blocked

**Desktop**

- WASD to move
- Mouse look (click the view to lock the pointer)
- Click to fire, hold for automatic weapons
- Right mouse or V to aim down sights
- R reload, Q ability, 1–3 weapon slots
- Esc pauses. Settings are on the pause menu too

## Hunters

- **Bruce "Big Iron" Kendrick** — more health, slower, no heavy-weapon penalty. Ability: Big Iron Barrage. Favorites: Pump Shotgun, Assault Rifle, Hand Cannon. He is the only one with recorded voice lines.
- **Maya "Ghost" Reyes** — fast, harder headshots. Ability: Ghost Step.
- **Elliot "Sprocket" Finch** — less health, faster reloads, more ammo from pickups. Ability: Sentry Drop.

Weapon damage, magazines, and cooldowns are all in `src/config.js`. Feedback mail goes to `FEEDBACK_EMAIL` in that same file. Look sensitivity, aim sensitivity, invert Y, look smoothing, and graphics quality are stored in the browser under `zs-settings`.

The cave, creatures, forest, and guns are procedural meshes. Surface detail uses CC0 PBR maps from ambientCG, tinted toward the concept art: [Rock 020](https://ambientcg.com/view?id=Rock020), [Bark 012](https://ambientcg.com/view?id=Bark012), and [Ground 037](https://ambientcg.com/view?id=Ground037). Feather cards use a generated alpha texture. No third-party model pack is bundled.

## Levels

1. **The Cave** — a wet, winding tunnel. Wallskitters crawl the ceiling and drop in waves. Ammo, medkits, and weapon pickups are along the path. Walk out the far end.
2. **The Clearing** — moonlit trees. Gravewing is asleep. Get close and it wakes, spreads, and screeches. Kill it.

Death returns you to a game over screen with Retry or Character Select.

## Web

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/ . Asset URLs are relative, so the same build also loads under the GitHub Pages path `/zombie-shooter/`.

```bash
npm run build
npm run preview
```

GitHub Actions deploys `main` to GitHub Pages (`.github/workflows/pages.yml`). If the site is blank, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## Native app

One Capacitor project wraps that web build. App id `com.carlsonmichael.zombieshooter`, display name **Zombie Shooter**.

On device the app is landscape-only, fullscreen (status and navigation bars hidden), and the web view still uses the notch safe-area insets. The screen stays awake while a run is in progress. Leaving the app pauses the sim and suspends audio; coming back resumes both. The first tap (Enter the Dark, or any tap) creates the iOS audio context inside the gesture so sound can start. All art and audio are copied into the app, so a run does not need a network.

Regenerate the icon and splash (wallskitter on a dark field) with:

```bash
python3 scripts/make-brand.py
npx @capacitor/assets generate --iconBackgroundColor '#0c1018' --iconBackgroundColorDark '#0c1018' --splashBackgroundColor '#07090d' --splashBackgroundColorDark '#07090d' --assetPath assets
```

### Android

Needs JDK 17+ and Android SDK 36 (`ANDROID_HOME`). Then:

```bash
npm run android:debug
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Sideload it with:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or copy the APK onto the phone and open it. Allow installs from that source if Android asks.

`npx cap open android` opens the project in Android Studio.

### iPhone

iOS builds need a Mac with Xcode. This repo cannot produce an IPA here. The `ios/` project is already checked in and uses Swift Package Manager (no CocoaPods step).

1. On the Mac, clone the repo and run `npm install`.
2. `npm run ios:sync` (builds the web app and copies it into the Xcode project).
3. `npx cap open ios`.
4. In Xcode, select the **App** target → **Signing & Capabilities** → choose your Team (an Apple ID is enough for a personal device).
5. Plug in the iPhone, tap Trust on the phone, and select that iPhone as the run destination.
6. Press Run.
7. If the phone says the developer is untrusted: **Settings → General → VPN & Device Management** → trust the certificate, then open **Zombie Shooter**.

The app opens landscape and fullscreen. The first tap starts audio.

TestFlight, later:

1. In Xcode, set a unique version/build if needed, then **Product → Archive**.
2. **Distribute App → App Store Connect → Upload**.
3. In App Store Connect, attach that build to TestFlight and invite the phone.
4. Install Apple's TestFlight app and accept the build.
