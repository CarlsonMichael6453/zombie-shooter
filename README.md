# Zombie Shooter

A flashlight-lit 3D horror shooter for phone browsers and desktop. Mature 17+.

Play it at [https://carlsonmichael6453.github.io/zombie-shooter/](https://carlsonmichael6453.github.io/zombie-shooter/).

On an iPhone, open that link in Safari, tap Share, then **Add to Home Screen**. It launches fullscreen in landscape. If the phone is portrait, the game asks you to rotate it.

## Controls

**Phone (landscape)**

- Left side: virtual stick to move
- Right side: drag to look
- On-screen buttons: fire, reload, ability, weapon swap
- Page scroll, pinch-zoom, and double-tap zoom are blocked

**Desktop**

- WASD to move
- Mouse look (click the view to lock the pointer)
- Click to fire, hold for automatic weapons
- R reload, Q ability, 1–3 weapon slots

## Hunters

- **Bruce "Big Iron" Kendrick** — more health, slower, no heavy-weapon penalty. Ability: Big Iron Barrage. Favorites: Pump Shotgun, Assault Rifle, Hand Cannon. He is the only one with recorded voice lines.
- **Maya "Ghost" Reyes** — fast, harder headshots. Ability: Ghost Step.
- **Elliot "Sprocket" Finch** — less health, faster reloads, more ammo from pickups. Ability: Sentry Drop.

Weapon damage, magazines, and cooldowns are all in `src/config.js`.

## Levels

1. **The Cave** — a wet, winding tunnel. Wallskitters crawl the ceiling and drop in waves. Ammo, medkits, and weapon pickups are along the path. Walk out the far end.
2. **The Clearing** — moonlit trees. Gravewing is asleep. Get close and it wakes, spreads, and screeches. Kill it.

Death returns you to a game over screen with Retry or Character Select.

## Local

```bash
npm install
npm run dev
```

The dev server uses the same `/zombie-shooter/` base path as GitHub Pages.

```bash
npm run build
npm run preview
```

## Pages

GitHub Actions deploys `main` to GitHub Pages. The workflow is `.github/workflows/pages.yml`.

If the site is blank, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
