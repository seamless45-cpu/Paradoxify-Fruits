# Paradoxify Fruits — 3D Arena

A 3D arena battler in the browser (Three.js, no build step). Wield **separate Fruit + Sword loadouts**,
survive endless enemy waves, and bend gravity, lightning, quakes, alarms, ice and fire to your will.

![Paradoxify Fruits](1789648036939.jpg)

## ▶️ Run it

No build needed — just serve the folder statically (ES modules require `http://`, not `file://`):

```bash
cd Paradoxify-Fruits
python3 -m http.server 8080
# then open http://localhost:8080
```

Internet is needed once for the Three.js CDN + fonts.

## 🎮 Controls

### PC
| Input | Action |
|---|---|
| `WASD` / arrows | Move (Shift = sprint) |
| Mouse | Aim (ground target ring) |
| `LMB` | M1 — sword slash / manual gun / punch |
| `Z X C V B F` | Fruit skills 1–6 (`V` on Lightning #4 = **hold** to charge, release to fire) |
| `1–5` | Sword skills (press Pole #2 again to stop channeling) |
| `Q` / `E` or Right-drag | Rotate camera, wheel = zoom |
| `M` `H` | Mute • Help |
| `P` / `Esc` | Pause • Close panels |

### Mobile / tablet
Left stick to move (auto-aim), ⚔️ button for M1 (hold to repeat), **USE** buttons on the skill bar to cast.

## ✨ Feature checklist (from the design spec)

- **Advanced graphics settings** — quality presets (Low→Ultra), resolution scale, MSAA, pixel-ratio
  cap, shadows + shadow-map size, fog, particle density, debris limit, lightning detail, glow sprites,
  enemy cap, damage numbers, screen flash, FPS counter. Persisted to `localStorage`.
- **Explosion effects** — flash, shockwave shell, expanding ring, GPU particles, instanced debris
  chunks with bounce physics, pooled dynamic lights, procedural sound.
- **Lightning effects** — tall vertical jagged bolts (merged-cylinder geometry, pre-built variants),
  overlapped multi-bolts, color variants (purple gravity / neon-blue storm / orange lava / red alarm).
- **Gravity fruit is purple** 🟣.
- **Camera shake is POSITION-ONLY** — high-frequency random X/Y/Z offsets, zero rotational shake
  (rotation is computed pre-shake and never touched). Closer explosions displace more, farther ones less.
- **Compact skill bar, middle-right, closable** — cooldown sweeps the whole bar 100→0 with the real
  seconds remaining; `USE` buttons on touch, `Z X C V B F` badges on PC.
- **Fruit and sword are SEPARATED** — two square horizontal inventory slots at the bottom with an
  equip/unequip picker; either slot can be empty.
- **Menu, pause, boss bar & auto-resolution** — animated main menu with best-run records, pause
  menu (`P`/`Esc`) with restart, live boss HP bar, optional auto-resolution holding ~55 FPS.
- **All 6 fruits & 4 swords** — Gravity, Lightning, Quake, Alarm, Rimefracture (ice gun),
  Wildfire (fire gun); Gravity Blade, Pole, Bisento, Alarm Sword — every skill implemented
  (asteroids + firepits, pressure detonations, pillars with stacked rings, hold-to-charge thunder ball,
  dash charges, 120-cloud ult, hitstop red-shift punch, tsunamis, imprisoning lasers, giant allies,
  gun procs, superstates, freeze/stun/burn/bleed/fear/blind/lift/suck statuses…).

## 🗂️ Code map

```
index.html          shell: HUD, skill bar, inventory, modals, touch controls
css/style.css       neon-cosmic theme
js/main.js          bootstrap + loading screen
js/game.js          renderer, camera + position-only shake, input, waves, main loop
js/config.js        fruit/sword database (names, icons, cooldowns, descriptions)
js/graphics.js      advanced settings store + presets
js/audio.js         procedural WebAudio SFX (no assets)
js/effects.js       pooled particles, debris, bolts, explosions, projectiles, pits, tsunamis…
js/world.js         arena, sky, lights, crystals
js/enemies.js       enemy AI + statuses, elites, bosses, Amber-Alert giants
js/player.js        avatar, movement, HP/buffs, M1 (sword / manual gun / punch)
js/skills.js        every fruit + sword skill implementation
js/ui.js            skill bar, picker, settings panel, damage numbers, touch sticks
```

## 🧪 Headless test

`utils`/`config`/`graphics` are dependency-free; the whole game (minus WebGL) can run in Node with
DOM stubs — every skill, M1 kind, death/respawn, settings sweep and a 60 s combat soak run with
zero exceptions.
