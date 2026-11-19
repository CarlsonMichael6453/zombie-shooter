// All tunable numbers live here. Change balance without hunting through the sim.

export const APP_VERSION = '1.2.0';
export const FEEDBACK_EMAIL = 'bykeh1sy@mail.grokbot.com';

export const BASE_HP = 100;
export const EYE = 1.62;

export const CAVE = {
  length: 150,
  waves: [
    { at: 0.2, count: 3 },
    { at: 0.42, count: 4 },
    { at: 0.64, count: 4 },
    { at: 0.84, count: 5 },
  ],
  maxAlive: 5,
  pickups: [
    { t: 0.1, kind: 'health' },
    { t: 0.15, kind: 'ammo' },
    { t: 0.22, kind: 'weapon', id: 'pump_shotgun' },
    { t: 0.3, kind: 'weapon', id: 'machete' },
    { t: 0.36, kind: 'ammo' },
    { t: 0.44, kind: 'weapon', id: 'assault_rifle' },
    { t: 0.52, kind: 'health' },
    { t: 0.58, kind: 'weapon', id: 'bone_cleaver' },
    { t: 0.64, kind: 'weapon', id: 'hunting_sniper' },
    { t: 0.7, kind: 'ammo' },
    { t: 0.76, kind: 'weapon', id: 'arc_thrower' },
    { t: 0.82, kind: 'weapon', id: 'nail_storm' },
    { t: 0.88, kind: 'health' },
    { t: 0.92, kind: 'weapon', id: 'flame_sprayer' },
    { t: 0.955, kind: 'weapon', id: 'hive_launcher' },
  ],
};

export const BOSS = {
  name: 'GRAVEWING',
  hp: 640,
  wakeRange: 14,
  attacks: ['swoop', 'gust', 'hop'],
  attackGap: 2.5,
  swoopDamage: 22,
  gustDamage: 14,
  hopDamage: 18,
  touchDamage: 10,
};

export const BUG = {
  hp: 42,
  speed: 3.35,
  crawl: 0.028,
  damage: 12,
  attackRange: 1.4,
  attackCooldown: 1.05,
  dropRange: 6.4,
};

export const VOICE = {
  big_iron: { file: 'assets/audio/voice/bruce/bruce_big_iron.mp3', text: 'Big iron.' },
  make_a_dent: { file: 'assets/audio/voice/bruce/bruce_make_a_dent.mp3', text: "This'll make a dent." },
  get_stuffed: { file: 'assets/audio/voice/bruce/bruce_get_stuffed.mp3', text: 'Get stuffed!' },
  eat_lead: { file: 'assets/audio/voice/bruce/bruce_eat_lead.mp3', text: 'Eat lead!' },
  ten_legs: { file: 'assets/audio/voice/bruce/bruce_ten_legs.mp3', text: 'Ten legs!' },
  reloading: { file: 'assets/audio/voice/bruce/bruce_reloading.mp3', text: 'Reloading.' },
  shes_thirsty: { file: 'assets/audio/voice/bruce/bruce_shes_thirsty.mp3', text: "She's thirsty." },
  strewth_bit: { file: 'assets/audio/voice/bruce/bruce_strewth_bit.mp3', text: 'Strewth, that bit!' },
  not_today: { file: 'assets/audio/voice/bruce/bruce_not_today.mp3', text: 'Not today!' },
  no_kookaburra: { file: 'assets/audio/voice/bruce/bruce_no_kookaburra.mp3', text: "That's no kookaburra." },
  beautiful_beast: { file: 'assets/audio/voice/bruce/bruce_beautiful_beast.mp3', text: 'Beautiful beast.' },
  heavier_better: { file: 'assets/audio/voice/bruce/bruce_heavier_better.mp3', text: 'Heavier is better.' },
};

export const MUSIC = {
  menu: ['assets/audio/music/theme1_violin_dubstep.mp3', 'assets/audio/music/theme2_guitar_techno.mp3'],
  cave: [
    'assets/audio/music/theme3_eerie_build.mp3',
    'assets/audio/music/theme4_eerie_violin_6-8.mp3',
    'assets/audio/music/theme5_eerie_guitar_6-8.mp3',
  ],
  forest: [
    'assets/audio/music/theme5_eerie_guitar_6-8.mp3',
    'assets/audio/music/theme4_eerie_violin_6-8.mp3',
    'assets/audio/music/theme3_eerie_build.mp3',
  ],
};

export const SFX = {
  screech: 'assets/audio/sfx/giant_bird_screech.mp3',
};

export const WEAPONS = {
  combat_knife: {
    id: 'combat_knife', name: 'Combat Knife', category: 'melee', view: 'knife', kind: 'melee',
    damage: 34, fireRate: 1.75, range: 2.35, auto: false, heavy: false, recoil: 0.01,
  },
  machete: {
    id: 'machete', name: 'Machete', category: 'melee', view: 'machete', kind: 'melee',
    damage: 48, fireRate: 1.35, range: 2.7, auto: false, heavy: false, recoil: 0.014,
  },
  bone_cleaver: {
    id: 'bone_cleaver', name: 'Bone Cleaver', category: 'melee', view: 'cleaver', kind: 'melee',
    damage: 76, fireRate: 0.82, range: 2.5, auto: false, heavy: true, recoil: 0.02,
  },
  sidearm_9: {
    id: 'sidearm_9', name: 'Sidearm 9', category: 'pistol', view: 'pistol', kind: 'hitscan',
    damage: 17, fireRate: 4.6, mag: 15, reserve: 60, reload: 1.25, spread: 0.012, range: 48,
    auto: false, heavy: false, recoil: 0.018, headMult: 1.8,
  },
  hand_cannon: {
    id: 'hand_cannon', name: 'Hand Cannon', category: 'pistol', view: 'cannon', kind: 'hitscan',
    damage: 48, fireRate: 1.65, mag: 6, reserve: 30, reload: 1.75, spread: 0.016, range: 52,
    auto: false, heavy: true, recoil: 0.045, headMult: 1.7,
  },
  flare_pistol: {
    id: 'flare_pistol', name: 'Flare Pistol', category: 'pistol', view: 'flare', kind: 'projectile',
    damage: 28, fireRate: 1.25, mag: 4, reserve: 12, reload: 1.55, spread: 0.01, range: 40,
    auto: false, heavy: false, recoil: 0.03, speed: 32, splash: 2.3, gravity: 4, light: 4.5, color: 0xff6a2a,
  },
  assault_rifle: {
    id: 'assault_rifle', name: 'Assault Rifle', category: 'rifle', view: 'rifle', kind: 'hitscan',
    damage: 13, fireRate: 9, mag: 30, reserve: 90, reload: 1.85, spread: 0.02, range: 58,
    auto: true, heavy: false, recoil: 0.012, headMult: 1.75,
  },
  pump_shotgun: {
    id: 'pump_shotgun', name: 'Pump Shotgun', category: 'rifle', view: 'shotgun', kind: 'hitscan',
    damage: 9, fireRate: 1.05, mag: 6, reserve: 24, reload: 2.15, spread: 0.09, range: 16, pellets: 8,
    auto: false, heavy: true, recoil: 0.05, headMult: 1.35,
  },
  hunting_sniper: {
    id: 'hunting_sniper', name: 'Hunting Sniper', category: 'rifle', view: 'sniper', kind: 'hitscan',
    damage: 74, fireRate: 0.72, mag: 5, reserve: 15, reload: 2.35, spread: 0.0015, range: 90,
    auto: false, heavy: true, recoil: 0.055, headMult: 1.95,
  },
  arc_thrower: {
    id: 'arc_thrower', name: 'Arc Thrower', category: 'special', view: 'arc', kind: 'hitscan',
    damage: 11, fireRate: 8, mag: 40, reserve: 80, reload: 1.9, spread: 0.02, range: 12,
    auto: true, heavy: true, recoil: 0.008, chain: 2, chainRange: 4.5, color: 0x79d6ff,
  },
  nail_storm: {
    id: 'nail_storm', name: 'Nail Storm', category: 'special', view: 'nail', kind: 'hitscan',
    damage: 6, fireRate: 7.5, mag: 36, reserve: 72, reload: 2.05, spread: 0.085, range: 20, pellets: 5,
    auto: true, heavy: false, recoil: 0.01,
  },
  flame_sprayer: {
    id: 'flame_sprayer', name: 'Flame Sprayer', category: 'special', view: 'flame', kind: 'cone',
    damage: 6, fireRate: 12, mag: 50, reserve: 50, reload: 2.4, range: 8.2, cone: 0.84,
    auto: true, heavy: true, recoil: 0.004, color: 0xff6a1a,
  },
  hive_launcher: {
    id: 'hive_launcher', name: 'Hive Launcher', category: 'special', view: 'hive', kind: 'projectile',
    damage: 42, fireRate: 0.8, mag: 3, reserve: 9, reload: 2.55, spread: 0.02, range: 36,
    auto: false, heavy: true, recoil: 0.04, speed: 18, splash: 3.5, gravity: 7, color: 0xc6e86a,
  },
};

export const CHARACTERS = {
  bruce: {
    id: 'bruce',
    name: 'Bruce "Big Iron" Kendrick',
    short: 'Bruce',
    role: 'Australian contractor',
    portrait: 'assets/art/characters/bruce.jpg',
    bio: 'Big, loud, and too bloody proud to die in a hole. He hauls guns that could drop a ute and swears like the cave owes him money. Ten-legged shits do not get to be the thing that folds Bruce Kendrick.',
    traits: ['+40% health', 'A bit slower', 'Heavy guns don\'t slow him', 'Bonus damage with favorites'],
    hpMult: 1.4,
    speed: 4.15,
    heavyPenalty: false,
    reloadMult: 1,
    ammoMult: 1,
    favDamage: 1.28,
    glove: 0x6a5340,
    favorites: ['pump_shotgun', 'assault_rifle', 'hand_cannon'],
    start: ['combat_knife', 'hand_cannon'],
    ability: {
      id: 'barrage',
      name: 'Big Iron Barrage',
      short: 'BARRAGE',
      flavor: 'Six seconds of faster fire and nastier hits. Everything downrange can get fucked.',
      duration: 6,
      cooldown: 18,
    },
    barks: {
      kill: [
        'Get stuffed, you bastard.',
        'Eat shit and stay down.',
        'That\'s for the bloody legs.',
        'Fuck off back to the wall.',
      ],
      hurt: ['Strewth, that bit!', 'You little shit!'],
      low: ['Not today. Not in this fuckin\' hole.'],
      reload: ['Reloadin\'. She\'s thirsty.', 'Hold on, I\'m reloadin\', ya bastards.'],
      pickup: ['Heavier is better. Always.', 'Beautiful beast. Come here.'],
      fav: ['Big iron. About fuckin\' time.', 'This\'ll make a dent, you bastards.'],
      see: ['Ten fuckin\' legs. Unreal.'],
      boss: ['That is no bloody kookaburra!'],
      enterCave: 'Smells like wet shit and trouble.',
      enterForest: 'If that\'s a kookaburra I\'ll eat my boots.',
      win: 'Big dead bird. About fuckin\' time.',
      deathCave: 'The cave folded him. He\'d hate that.',
      deathBoss: 'Gravewing had the last fuckin\' word.',
    },
  },
  maya: {
    id: 'maya',
    name: 'Maya "Ghost" Reyes',
    short: 'Maya',
    role: 'Cave search and rescue',
    portrait: 'assets/art/characters/maya.jpg',
    bio: 'She used to drag lost cavers back to daylight. She\'s faster now, and a hell of a lot less patient. Maya aims for the head. The dark already took enough people on her watch.',
    traits: ['Fast', 'Headshots hit much harder', 'Starts with knife and Sidearm 9'],
    hpMult: 1,
    speed: 5.35,
    heavyPenalty: true,
    reloadMult: 1,
    ammoMult: 1,
    favDamage: 1,
    headBonus: 0.85,
    glove: 0x2a3038,
    favorites: ['hunting_sniper', 'machete', 'sidearm_9'],
    start: ['combat_knife', 'sidearm_9'],
    ability: {
      id: 'ghost',
      name: 'Ghost Step',
      short: 'GHOST',
      flavor: 'A hard dash. For a moment, every asshole in the dark loses her.',
      cooldown: 8,
      dashTime: 0.18,
      dashSpeed: 38,
      hidden: 2.4,
    },
    barks: {
      kill: ['Down.', 'Stay dead, damn you.', 'Too slow.', 'Headshot. You\'re welcome.'],
      hurt: ['Shit!', 'Okay. That one hurt.'],
      low: ['I am not dying in a damn hole.'],
      reload: ['Reloading. Cover me or don\'t.'],
      pickup: ['This\'ll do.', 'Better. I\'ll take it.'],
      fav: ['Yeah. This one.', 'Now we\'re talking.'],
      see: ['They\'re on the walls.'],
      boss: ['That thing is way too big. Hell.'],
      enterCave: 'Lights on. Don\'t wander off.',
      enterForest: 'A clearing. I don\'t like how quiet it is.',
      win: 'It\'s down. Let\'s not do that again.',
      deathCave: 'The dark took her after all.',
      deathBoss: 'The bird finished it.',
    },
  },
  elliot: {
    id: 'elliot',
    name: 'Elliot "Sprocket" Finch',
    short: 'Elliot',
    role: 'Field engineer',
    portrait: 'assets/art/characters/elliot.jpg',
    bio: 'A scrawny engineer who looked at a monster cave and said a turret should help. He reloads like a metronome, hoards every round, and named the sentry before he introduced himself.',
    traits: ['−25% health', 'Much faster reloads', '+50% ammo from pickups'],
    hpMult: 0.75,
    speed: 4.7,
    heavyPenalty: true,
    reloadMult: 0.62,
    ammoMult: 1.5,
    favDamage: 1,
    glove: 0x4d453c,
    favorites: ['arc_thrower', 'nail_storm', 'flare_pistol'],
    start: ['combat_knife', 'flare_pistol'],
    ability: {
      id: 'sentry',
      name: 'Sentry Drop',
      short: 'SENTRY',
      flavor: 'Drops a scrap auto-turret for fifteen seconds. It beeps. He finds that encouraging.',
      cooldown: 22,
      duration: 15,
      damage: 9,
      range: 18,
      interval: 0.32,
    },
    barks: {
      kill: ['Target neutralized!', 'One less variable.', 'Logged. Gross, but logged.', 'Ha! The math worked.'],
      hurt: ['Ow! Rude!', 'That was not in the model!'],
      low: ['Health is critically suboptimal!'],
      reload: ['Reloading. Please hold.', 'Fresh magazine. Lovely.'],
      pickup: ['Ooh. I can work with this.', 'New hardware! Don\'t touch the wiring.'],
      fav: ['Oh, this is the good one.', 'Power budget: acceptable!'],
      see: ['Multiple contacts. Ceiling. Oh dear.'],
      boss: ['That wingspan violates several safety guidelines.'],
      enterCave: 'Humidity is awful for the circuits. Noted.',
      enterForest: 'Open canopy. Something large has been nesting.',
      win: 'Hypothesis confirmed. I would like to leave now.',
      deathCave: 'Hypothesis: this cave is hostile. Confirmed.',
      deathBoss: 'The trial ended early.',
    },
  },
};

export function weaponName(id) {
  return WEAPONS[id]?.name || id;
}
