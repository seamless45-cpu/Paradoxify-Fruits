// ---------- Paradoxify Fruits: fruit & sword database ----------
// Damage convention: skills deal { flat, pct } where pct = fraction of target's MAX HP.
// This keeps every skill relevant at every wave while flat damage melts weak enemies.

export const FRUIT_KEYS = ['Z', 'X', 'C', 'V', 'B', 'F'];
export const SWORD_KEYS = ['1', '2', '3', '4', '5'];

export const FRUITS = {
  gravity: {
    id: 'gravity', name: 'Gravity Fruit', icon: '🟣', color: 0xa64dff, css: '#a64dff',
    desc: 'Purple cosmic force. Crushes arenas with asteroids, pressure and lightning.',
    skills: [
      { name: 'Asteroid', ico: '☄️', cd: 2, sub: 'giant slam • 25m • firepit',
        desc: 'Drop a giant asteroid on the cursor. Explodes in 25m, leaves a 10s firepit (3% tick).' },
      { name: 'Gravitational Pressure', ico: '🌀', cd: 4, sub: 'suck to middle • boom',
        desc: 'Suck all enemies to the arena middle, then detonate. +2% dmg & radius per unit (max 2000%).' },
      { name: 'Gravitational Lightning', ico: '🌩️', cd: 6.5, sub: 'pillar • 8 bursts • 17m',
        desc: 'Purple pillar with stacked rings rises, striking 8 overlapped bolt bursts (0.25s). 12% chance to rain 1-5 small meteors.' },
      { name: 'Pressure Dereliction', ico: '💥', cd: 7.5, sub: '3 blasts • follows foes',
        desc: 'Blast pressure zones that follow enemies and explode 3×, every 1s.' },
      { name: 'Asteroid Rain', ico: '🌠', cd: 10, sub: '8 asteroids • 0.3s apart',
        desc: '8 giant asteroids slam random spots (25m blasts, 10s firepits, 5% tick).' },
      { name: 'Gravitational Punch', ico: '👊', cd: 10, sub: 'pull • punch • 4×4 bolts',
        desc: 'Pull foes in, unleash a charged punch (10m knock), then 4 rows of 4 overlapped bolts where they land. Huge shake.' },
    ]
  },
  lightning: {
    id: 'lightning', name: 'Lightning Fruit', icon: '🔵', color: 0x33ccff, css: '#33ccff',
    desc: 'Neon-blue storm. Beasts, showers and thunder beyond thunder.',
    skills: [
      { name: 'Bestia Relámpago', ico: '🐺', cd: 5, sub: 'beast shot • 30m boom',
        desc: 'Fire an auto-aimed lightning beast (30 m/s) that explodes for 30m.' },
      { name: 'Tormenta', ico: '⛈️', cd: 8, sub: '17 bolts • 4.5m',
        desc: 'Shower 17 overlapped bolts over a random area (0.22s apart).' },
      { name: 'Juicio Celestial', ico: '⚖️', cd: 12, sub: 'focused • lift + 3s stun',
        desc: 'Numerous overlapping bolts hammer one spot (7m), lifting & stunning 3s.' },
      { name: 'Destrucción de Bola de Trueno', ico: '🌑', cd: 20, sub: 'HOLD to charge • expanding boom',
        desc: 'HOLD the key: clouds grow a black ball (+5%/0.05s, max 100%). Release: it crashes down (50 m/s) and expands (15 m/s) for 5s.' },
      { name: 'Destello Eléctrico', ico: '⚡', cd: 1, sub: 'dash • 3 charges',
        desc: 'Dash 10m at lightning speed, damaging foes passed. 3 charges, +1 per 3s.' },
      { name: 'Más Allá del Trueno', ico: '🌪️', cd: 30, sub: '120 clouds • 16m • stun',
        desc: '120 thunderclouds strike overlapped bolts everywhere (0.1s, 16m blasts, 3s stun).' },
    ]
  },
  quake: {
    id: 'quake', name: 'Quake Fruit', icon: '🌊', color: 0x44ddff, css: '#44ddff',
    desc: 'Neon-blue destruction. Cracks, shockwaves and tsunamis.',
    skills: [
      { name: 'Fatal Destruction', ico: '🔴', cd: 5, sub: 'grab • time stops • punch',
        desc: 'Grab a foe, freeze time as the world turns red, then a devastating quake punch with huge knockback.' },
      { name: 'Air Crusher', ico: '🫧', cd: 7, sub: 'quake orb • 2s stun',
        desc: 'Hurl a large quake orb forward (2s stun). Cracks burst from your hand.' },
      { name: 'Spatial Shockwave', ico: '💢', cd: 7, sub: 'ground slam • 5s stun',
        desc: 'Smash the ground: white expanding shockwave, floor cracks, debris, arm cracks. 5s stun + 10m knockback.' },
      { name: 'Seaquake', ico: '🌊', cd: 14.5, sub: '3 pulses • 12 tsunamis',
        desc: 'Triple ground pulse + 12 tsunamis from all sides (4 huge: 8× size, 3× dmg, 40% slower). Multi-hit.' },
      null, null,
    ]
  },
  alarm: {
    id: 'alarm', name: 'Alarm Fruit', icon: '🚨', color: 0xff2e4d, css: '#ff2e4d',
    desc: 'Red alert arsenal. Lasers, sirens and giant enforcers.',
    skills: [
      { name: 'Manual Alert', ico: '🔫', cd: 3, sub: 'lasers • imprison 6s • 40m',
        desc: 'Red laser beams imprison enemies 6s (40m detection).' },
      { name: 'Automatic Transmission Alarming', ico: '📡', cd: 5.5, sub: 'highest HP • 15s',
        desc: 'Giant red beam hits the highest-HP foe (imprison 15s) + red pillars on imprisoned nearby.' },
      { name: 'Siren Blaster', ico: '📢', cd: 8, sub: 'fear 100m • zaps 7s',
        desc: 'Blaring alarm: foes within 100m flee 7s, struck by red lightning beams every 1s.' },
      { name: 'Alarm Buffer', ico: '🛡️', cd: 15, sub: '+200% dmg/AoE • -25% CD',
        desc: '30s: +200% damage, +200% AoE, −25% cooldowns. Attackers eat reddish bolts (20% max HP).' },
      { name: 'Amber Alert', ico: '👹', cd: 30, sub: '5 giants • 15s • 80m',
        desc: 'Summon 5 giant attackers with alarm swords (80m range, separate targets) for 15s.' },
      null,
    ]
  },
  rimefracture: {
    id: 'rimefracture', name: 'Rimefracture Fruit', icon: '🧊', color: 0x9fe8ff, css: '#9fe8ff',
    desc: 'Glacial gunner. Manual ice rifle with devastating icicle procs.',
    gun: { name: 'Frost Rifle', color: 0x9fe8ff, fireCd: 0.2, proc: 0.45, procMult: 73.5, procRadius: 60, fragSpeed: 120, flat: 30 },
    skills: [
      { name: 'Icy Power', ico: '❄️', cd: 3.5, sub: '17 icicles • 45m',
        desc: '17 giant icicles crash a random 10m zone (0.13s apart, 45m blasts, fragments deal 50%).' },
      { name: 'Ice Bombard', ico: '🔷', cd: 30, sub: 'SUPERSTATE • freeze hits',
        desc: 'Superpower 15s: gun +725225% dmg, −75% fire CD. Skill hits freeze 3s.' },
      { name: 'Snowy Destruction', ico: '💠', cd: 8, sub: 'stomp • mass freeze 10s',
        desc: 'Supersonic stomp (0.5s warm-up, invincible): colossal blast, icy flash, debris, freeze 10s + DoT. Extreme shake.' },
      null, null, null,
    ]
  },
  wildfire: {
    id: 'wildfire', name: 'Wildfire Fruit', icon: '🔥', color: 0xff7a1a, css: '#ff7a1a',
    desc: 'Inferno gunner. Manual pyro rifle that executes the weak.',
    gun: { name: 'Pyro Rifle', color: 0xff7a1a, fireCd: 0.2, proc: 0.35, procMult: 151, procRadius: 65, fragSpeed: 150, flat: 34, executePct: 0.5, executeMult: 11, executeAoe: 4 },
    skills: [
      { name: 'Firestorm', ico: '🔥', cd: 5, sub: '150 fireballs • burn pits',
        desc: 'Spray 150 fireballs (30° cone, 0.035s, 30m blasts, 6s burn pits).' },
      { name: 'Hell Fury', ico: '😈', cd: 30, sub: 'SUPERSTATE • burn hits',
        desc: 'Superpower 15s: gun +1250000% dmg, −77% fire CD. Skill hits burn 3s.' },
      { name: 'Burning Lightning', ico: '🌋', cd: 5, sub: '40 lava rocks • pits',
        desc: 'Spray 40 giant lava rocks (60° cone, 0.1s, 50m blasts, 10s lava pits). Hits call orange lightning (burn 3s).' },
      null, null, null,
    ]
  },
};

export const SWORDS = {
  gravityBlade: {
    id: 'gravityBlade', name: 'Gravity Blade', icon: '⚔️', color: 0xa64dff, css: '#a64dff',
    desc: 'Cosmic edge. Every 4th M1 calls a storm; its superforce bolt can erase the unworthy.',
    m1: { name: 'Cosmic Slash', cd: 0.2, endlag: 0.4, flat: 55, desc: '0.2s swings. Every 4 slashes calls 6-24 bolts near the blade.' },
    skills: [
      { name: 'Superforce Lightning', ico: '🌌', cd: 3, sub: 'glow 1s • erase / blind',
        desc: 'Blade glows 1s, then a god-bolt: charge-based instant-kill vs normals (elites/bosses: 50% HP), blinds 10s. Kills/damage charge +10%, each strike uses 10%. Full charge: 33% for 20× dmg. Empty: weakest but 3× faster CD.' },
      { name: 'Rainy Meteors', ico: '☄️', cd: 5, sub: '80 meteors • 6m',
        desc: '80 small meteors (130 m/s, 0.06s apart, 6m blasts).' },
      { name: 'Rocks Extinction', ico: '🪨', cd: 7, sub: '26 boulders • 24m',
        desc: '26 rocks rise in a square (follows you) for 1.2s, then slam distinct foes one by one (0.15s, 24m blasts).' },
      { name: 'Death Slashes', ico: '🌀', cd: 3, sub: '23 slashes • always crit',
        desc: '23 curved auto-slashes (0.15s, 186 m/s, always crit): stun + lightning + 27% burn 10s. 22%: 930 m/s, 2500% dmg, 2500% bigger boom, +200% shake.' },
      { name: 'Super Slashes', ico: '🌪️', cd: 4, sub: 'storm 3s • 24m • bleed',
        desc: '3s storm of slashes (0.01s) in 24m around you (follows you). Each hit bleeds 1% for 5s (stacks, super-fast ticks).' },
    ]
  },
  pole: {
    id: 'pole', name: 'Pole', icon: '🗡️', color: 0x33ccff, css: '#33ccff',
    desc: 'Storm staff. Relentless combo slashes and endless judgment.',
    m1: { name: 'Pole Combo', cd: 0.1, endlag: 0, flat: 26, desc: '3-hit combo, no end-lag. 4th hit calls a small bolt.' },
    skills: [
      { name: 'Asalto Atronador', ico: '☁️', cd: 3, sub: 'cloud shot • pops 1s',
        desc: 'Shoot a cloud forward that detonates after 1s (2m blast).' },
      { name: 'Juicio Continuo', ico: '⛈️', cd: 10, sub: 'TOGGLE • blood magic',
        desc: 'TOGGLE: endless overlapping bolts at cursor (8m, +5%/s radius up to +50%), drags foes in (9m). Each strike costs 1% HP. Ends below 50% HP.' },
      null, null, null,
    ]
  },
  bisento: {
    id: 'bisento', name: 'Bisento', icon: '🔱', color: 0x44ddff, css: '#44ddff',
    desc: 'Quake halberd. Shockwaves, orbs and a sea at your command.',
    m1: { name: 'Bisento Swing', cd: 0.35, endlag: 0.2, flat: 70, desc: 'Heavy sweeping swings with small quake arcs.' },
    skills: [
      { name: 'Quake Slam', ico: '💥', cd: 2, sub: 'shockwave • 2.5s stun',
        desc: 'Slam: white expanding shockwave + floor cracks, 2.5s stun, big knockback.' },
      { name: 'Quake Ball', ico: '🔮', cd: 3, sub: '5 orbs • diagonal',
        desc: 'Fire 5 small diagonal quake orbs that burst on impact.' },
      { name: 'Mini Seaquake', ico: '🌊', cd: 5, sub: '23 mini tsunamis',
        desc: '23 small tsunamis converge from random directions, passing through you.' },
      null, null,
    ]
  },
  alarmSword: {
    id: 'alarmSword', name: 'Alarm Sword', icon: '🚨', color: 0xff2e4d, css: '#ff2e4d',
    desc: 'Enforcer blade. Triple taps call the red beams.',
    m1: { name: 'Alert Slash', cd: 0.2, endlag: 0.4, flat: 48, desc: '0.2s slashes. Every 3 hits: 6 red beams imprison 4 random foes 3s.' },
    skills: [
      { name: 'Red Stomp', ico: '🦶', cd: 5, sub: '40m • launch 50m • shake 13',
        desc: 'Stomp: 40m blast launches foes 50m skyward. Heavy shake.' },
      null, null, null, null,
    ]
  },
};

export const FRUIT_ORDER = ['gravity', 'lightning', 'quake', 'alarm', 'rimefracture', 'wildfire'];
export const SWORD_ORDER = ['gravityBlade', 'pole', 'bisento', 'alarmSword'];
