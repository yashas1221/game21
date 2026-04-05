/* ═══════════════════════════════════════════════════════════
   KARATE FIGHTER — SCRIPT.JS
   Full 3D Fighting Game: Pavan Mangali vs Yashas
   Engine: Three.js r128
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── GLOBAL STATE ─────────────────────────────────────────
const G = {
  mode: '1p',        // '1p' | '2p'
  difficulty: 'medium',
  round: 1,
  maxRounds: 3,
  wins: [0, 0],
  timeLeft: 60,
  timerInterval: null,
  paused: false,
  gameRunning: false,
  isMobile: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent),
};

// ─── DIFFICULTY SETTINGS ──────────────────────────────────
const DIFF = {
  easy:   { reactionTime: 80,  attackChance: 0.2, blockChance: 0.15, moveSpeed: 0.03 },
  medium: { reactionTime: 40,  attackChance: 0.4, blockChance: 0.3,  moveSpeed: 0.05 },
  hard:   { reactionTime: 15,  attackChance: 0.65, blockChance: 0.5, moveSpeed: 0.07 },
};

// ─── THREE.JS CORE ────────────────────────────────────────
let renderer, scene, camera, clock;
let animFrameId;

// ─── FIGHTER DATA ─────────────────────────────────────────
const FIGHTER_DEFAULTS = {
  maxHP: 100,
  moveSpeed: 0.055,
  jumpForce: 0.18,
  gravity: 0.008,
  groundY: 0,
  punchRange: 1.2,
  kickRange: 1.4,
  specialRange: 1.8,
  punchDmg: [8, 14],
  kickDmg: [12, 20],
  specialDmg: [22, 32],
  blockReduction: 0.2,
  knockbackForce: 0.08,
};

// Fighter instances
let p1, p2;

// ─── INPUT STATE ─────────────────────────────────────────
const keys = {};
const p2keys = {};
const mobileInput = { dx: 0, punch: false, kick: false, block: false, special: false, jump: false };
let joystickActive = false;
let joystickOrigin = { x: 0, y: 0 };

// ─── PARTICLE SYSTEM ─────────────────────────────────────
let particleCanvas, particleCtx;
const particles = [];

// ─── AUDIO ───────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function ensureAudio() { if (!audioCtx) { try { audioCtx = new AudioCtx(); } catch(e){} } }

function playSound(type) {
  ensureAudio();
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    if (type === 'punch') {
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.1);
    } else if (type === 'kick') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.start(t); o.stop(t + 0.14);
    } else if (type === 'hit') {
      o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.06);
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.1);
    } else if (type === 'special') {
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.25);
      g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    } else if (type === 'block') {
      o.frequency.setValueAtTime(400, t);
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.start(t); o.stop(t + 0.06);
    }
  } catch(e) {}
}

// ─── UI HELPERS ───────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function showAnnouncer(text, duration = 1500, color = '#fff') {
  const a = el('announcer');
  a.textContent = text;
  a.style.color = color;
  a.classList.remove('hidden');
  clearTimeout(a._t);
  a._t = setTimeout(() => a.classList.add('hidden'), duration);
}

function updateHUD() {
  if (!p1 || !p2) return;
  const hp1Pct = Math.max(0, (p1.hp / FIGHTER_DEFAULTS.maxHP) * 100);
  const hp2Pct = Math.max(0, (p2.hp / FIGHTER_DEFAULTS.maxHP) * 100);
  el('p1HP').style.width = hp1Pct + '%';
  el('p2HP').style.width = hp2Pct + '%';
  el('p1HPNum').textContent = Math.ceil(p1.hp);
  el('p2HPNum').textContent = Math.ceil(p2.hp);

  // HP bar color
  const hpColor = (pct) => pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#ef4444';
  el('p1HP').style.background = `linear-gradient(90deg, ${hpColor(hp1Pct)}, ${hpColor(hp1Pct)}aa)`;
  el('p2HP').style.background = `linear-gradient(90deg, ${hpColor(hp2Pct)}aa, ${hpColor(hp2Pct)})`;

  // Combos
  el('p1Combo').textContent = p1.combo >= 2 ? `${p1.combo}x COMBO!` : '';
  el('p2Combo').textContent = p2.combo >= 2 ? `${p2.combo}x COMBO!` : '';

  el('roundLabel').textContent = `ROUND ${G.round}`;
  el('timerBox').textContent = G.timeLeft;
  el('timerBox').className = 'timer-box' + (G.timeLeft <= 10 ? ' urgent' : '');

  // Round dots
  updateRoundDots();
}

function updateRoundDots() {
  const dots = ['r1p1','r2p1','r1p2','r2p2'];
  dots.forEach(id => { const d = el(id); d.classList.remove('p1-win','p2-win'); });
  for (let i = 0; i < G.wins[0]; i++) { if (i===0) el('r1p1').classList.add('p1-win'); else el('r2p1').classList.add('p1-win'); }
  for (let i = 0; i < G.wins[1]; i++) { if (i===0) el('r1p2').classList.add('p2-win'); else el('r2p2').classList.add('p2-win'); }
}

// ─── MODE / DIFFICULTY SELECTION ─────────────────────────
function selectMode(mode) {
  G.mode = mode;
  el('btn1P').classList.toggle('active', mode === '1p');
  el('btn2P').classList.toggle('active', mode === '2p');
  el('diffRow').style.display = mode === '1p' ? 'flex' : 'none';
  const hint = el('p2hint');
  if (mode === '2p') {
    hint.innerHTML = '<b>P2 KEYS</b>Arrow keys Move | Num0 Jump<br>Num1 Punch | Num2 Kick<br>Num3 Special | Num4 Block';
  } else {
    hint.innerHTML = '<b>AI OPPONENT</b>Adaptive AI<br>3 Difficulty Levels';
  }
}

function selectDiff(diff, btn) {
  G.difficulty = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── THREE.JS SETUP ───────────────────────────────────────
function initThree() {
  const canvas = el('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 18, 45);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.5, 7);
  camera.lookAt(0, 1, 0);

  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ─── BUILD ARENA ──────────────────────────────────────────
function buildArena() {
  // Sky gradient via background color + fog
  renderer.setClearColor(0x87ceeb);

  // Ground (tiled)
  const groundGeo = new THREE.PlaneGeometry(24, 24);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xd4a96a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Ground grid lines (tile illusion)
  const gridHelper = new THREE.GridHelper(24, 24, 0xb8895a, 0xb8895a);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // Arena platform (raised)
  const platGeo = new THREE.BoxGeometry(14, 0.15, 8);
  const platMat = new THREE.MeshLambertMaterial({ color: 0xe8c890 });
  const platform = new THREE.Mesh(platGeo, platMat);
  platform.position.y = -0.07;
  platform.receiveShadow = true;
  scene.add(platform);

  // Platform edge border
  const borderMat = new THREE.MeshLambertMaterial({ color: 0xc8a060 });
  [-7, 7].forEach(x => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 8.2), borderMat);
    b.position.set(x, 0.05, 0); scene.add(b);
  });
  [-4, 4].forEach(z => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.3, 0.2), borderMat);
    b.position.set(0, 0.05, z); scene.add(b);
  });

  buildTajMahal();
  buildTrees();
  buildLighting();
}

function buildTajMahal() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xf5f0e8 });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xd4c8b0 });
  const domeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const group = new THREE.Group();
  group.position.set(0, 0, -14);

  // Main base
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 5), mat);
  base.position.y = 0.75; group.add(base);

  // Main dome body
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), mat);
  mainBody.position.y = 3; group.add(mainBody);

  // Onion dome (main)
  const domeGeo = new THREE.SphereGeometry(1.8, 8, 8);
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 5.5; dome.scale.y = 1.3; group.add(dome);

  // Dome spire
  const spireGeo = new THREE.ConeGeometry(0.1, 1, 6);
  const spire = new THREE.Mesh(spireGeo, accentMat);
  spire.position.y = 7.2; group.add(spire);

  // Four corner minarets
  [[-3.5,0,-1.5],[-3.5,0,1.5],[3.5,0,-1.5],[3.5,0,1.5]].forEach(([x,y,z]) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 5, 8), mat);
    tower.position.set(x, 2.5, z); group.add(tower);
    const tDome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), domeMat);
    tDome.position.set(x, 5.2, z); group.add(tDome);
    const tSpire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), accentMat);
    tSpire.position.set(x, 5.7, z); group.add(tSpire);
  });

  // Arched entrance (simple box)
  const archMat = new THREE.MeshLambertMaterial({ color: 0xc8b898 });
  const arch = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.4), archMat);
  arch.position.set(0, 2.25, 2.1); group.add(arch);

  // Wings
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 4), mat);
    wing.position.set(side * 5.5, 0.6, 0); group.add(wing);
    const wDome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), domeMat);
    wDome.position.set(side * 5.5, 1.9, 0); group.add(wDome);
  });

  // Reflecting pool
  const poolMat = new THREE.MeshLambertMaterial({ color: 0x6ea8d4, transparent: true, opacity: 0.6 });
  const pool = new THREE.Mesh(new THREE.BoxGeometry(3, 0.05, 6), poolMat);
  pool.position.set(0, 1.52, 5.5); group.add(pool);

  scene.add(group);
}

function buildTrees() {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x3a7d3a });

  const treePositions = [
    [-9,0,-3],[-9,0,0],[-9,0,3],
    [9,0,-3],[9,0,0],[9,0,3],
    [-6,0,-6],[-3,0,-7],[0,0,-7],[3,0,-7],[6,0,-6],
  ];

  treePositions.forEach(([x,y,z]) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const h = 1.5 + Math.random() * 1.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), trunkMat);
    trunk.position.y = h/2; g.add(trunk);
    // Cypress-style (multiple cones stacked)
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i*0.1, 1.2, 7), i%2===0?leafMat:palmMat);
      cone.position.y = h + i * 0.6; g.add(cone);
    }
    scene.add(g);
  });
}

function buildLighting() {
  const ambient = new THREE.AmbientLight(0xfff5e0, 0.7);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8d0, 1.2);
  sun.position.set(8, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 512;
  sun.shadow.mapSize.height = 512;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  scene.add(sun);

  // Fill light
  const fill = new THREE.DirectionalLight(0xb0d0ff, 0.4);
  fill.position.set(-6, 4, -4);
  scene.add(fill);
}

// ─── FIGHTER MODEL BUILDER ────────────────────────────────
function buildFighterMesh(color, accentColor) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xf5c8a0 });
  const pantMat = new THREE.MeshLambertMaterial({ color: 0xddeeff });
  const beltMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });

  const parts = {};

  // Torso
  parts.torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), mat);
  parts.torso.position.y = 1.05;
  parts.torso.castShadow = true;
  group.add(parts.torso);

  // Belt
  parts.belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.32), beltMat);
  parts.belt.position.y = 0.78;
  group.add(parts.belt);

  // Pelvis
  parts.pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.26), mat);
  parts.pelvis.position.y = 0.66;
  group.add(parts.pelvis);

  // Head
  parts.head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skinMat);
  parts.head.position.y = 1.56;
  parts.head.castShadow = true;
  group.add(parts.head);

  // Hair
  parts.hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.31), hairMat);
  parts.hair.position.y = 1.71;
  group.add(parts.hair);

  // Neck
  parts.neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 6), skinMat);
  parts.neck.position.y = 1.38;
  group.add(parts.neck);

  // Left upper arm
  parts.lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
  parts.lUpperArm.position.set(-0.38, 1.1, 0);
  group.add(parts.lUpperArm);

  // Left forearm
  parts.lForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.13), skinMat);
  parts.lForeArm.position.set(-0.38, 0.8, 0);
  group.add(parts.lForeArm);

  // Left fist
  parts.lFist = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), skinMat);
  parts.lFist.position.set(-0.38, 0.64, 0);
  group.add(parts.lFist);

  // Right upper arm
  parts.rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), mat);
  parts.rUpperArm.position.set(0.38, 1.1, 0);
  group.add(parts.rUpperArm);

  // Right forearm
  parts.rForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.13), skinMat);
  parts.rForeArm.position.set(0.38, 0.8, 0);
  group.add(parts.rForeArm);

  // Right fist
  parts.rFist = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), skinMat);
  parts.rFist.position.set(0.38, 0.64, 0);
  group.add(parts.rFist);

  // Left thigh
  parts.lThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), pantMat);
  parts.lThigh.position.set(-0.14, 0.4, 0);
  group.add(parts.lThigh);

  // Left shin
  parts.lShin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), pantMat);
  parts.lShin.position.set(-0.14, 0.06, 0);
  group.add(parts.lShin);

  // Left foot
  parts.lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.28), mat);
  parts.lFoot.position.set(-0.14, -0.1, 0.04);
  group.add(parts.lFoot);

  // Right thigh
  parts.rThigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), pantMat);
  parts.rThigh.position.set(0.14, 0.4, 0);
  group.add(parts.rThigh);

  // Right shin
  parts.rShin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), pantMat);
  parts.rShin.position.set(0.14, 0.06, 0);
  group.add(parts.rShin);

  // Right foot
  parts.rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.28), mat);
  parts.rFoot.position.set(0.14, -0.1, 0.04);
  group.add(parts.rFoot);

  return { group, parts };
}

// ─── FIGHTER CLASS ────────────────────────────────────────
class Fighter {
  constructor(name, color, accentColor, startX, facingSign) {
    this.name = name;
    this.hp = FIGHTER_DEFAULTS.maxHP;
    this.combo = 0;
    this.comboTimer = 0;

    // Position / physics
    this.x = startX;
    this.y = FIGHTER_DEFAULTS.groundY;
    this.vy = 0;
    this.onGround = true;
    this.facingSign = facingSign; // 1 = facing right, -1 = facing left

    // State machine
    this.state = 'idle'; // idle | walk | jump | punch | kick | special | block | hurt | dead
    this.stateTimer = 0;
    this.invincible = 0;
    this.knockback = 0;

    // Stamina (for special)
    this.stamina = 100;

    // AI stuff
    this.aiCooldown = 0;
    this.aiDecisionTimer = 0;

    // Animation
    this.animT = 0;
    this.shakeX = 0;

    // Build 3D mesh
    const { group, parts } = buildFighterMesh(color, accentColor);
    this.group = group;
    this.parts = parts;
    this.group.position.set(startX, 0, 0);
    scene.add(this.group);

    // Shadow for feet
    const shadowGeo = new THREE.CircleGeometry(0.3, 10);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    scene.add(this.shadow);
  }

  // ── Facing direction ──────────────────────
  faceOpponent(other) {
    this.facingSign = this.x < other.x ? 1 : -1;
    this.group.scale.x = this.facingSign;
  }

  // ── Take damage ───────────────────────────
  takeDamage(dmg, knockDir) {
    if (this.invincible > 0 || this.state === 'dead') return;
    if (this.state === 'block') { dmg *= FIGHTER_DEFAULTS.blockReduction; playSound('block'); }
    else { playSound('hit'); }

    this.hp = Math.max(0, this.hp - dmg);
    this.knockback = knockDir * FIGHTER_DEFAULTS.knockbackForce * (dmg / 10);
    if (this.state !== 'block') {
      this.setState('hurt', 18);
      this.invincible = 22;
      this.shakeX = 6;
      spawnHitParticles(this.group.position.x, this.y + 1, dmg);
    }
    if (this.hp <= 0) { this.hp = 0; this.setState('dead', 999); }
  }

  // ── State machine ─────────────────────────
  setState(state, duration) {
    this.state = state;
    this.stateTimer = duration;
  }

  // ── Actions ───────────────────────────────
  tryPunch(other) {
    if (['punch','kick','special','dead'].includes(this.state)) return false;
    this.setState('punch', 22);
    playSound('punch');
    const dist = Math.abs(this.x - other.x);
    if (dist < FIGHTER_DEFAULTS.punchRange) {
      const dmg = randInt(...FIGHTER_DEFAULTS.punchDmg);
      other.takeDamage(dmg, this.facingSign);
      this.addCombo();
      return true;
    }
    return false;
  }

  tryKick(other) {
    if (['punch','kick','special','dead'].includes(this.state)) return false;
    this.setState('kick', 28);
    playSound('kick');
    const dist = Math.abs(this.x - other.x);
    if (dist < FIGHTER_DEFAULTS.kickRange) {
      const dmg = randInt(...FIGHTER_DEFAULTS.kickDmg);
      other.takeDamage(dmg, this.facingSign);
      this.addCombo();
      return true;
    }
    return false;
  }

  trySpecial(other) {
    if (['punch','kick','special','dead'].includes(this.state)) return false;
    if (this.stamina < 35) return false;
    this.stamina -= 35;
    this.setState('special', 40);
    playSound('special');
    const dist = Math.abs(this.x - other.x);
    if (dist < FIGHTER_DEFAULTS.specialRange) {
      const dmg = randInt(...FIGHTER_DEFAULTS.specialDmg);
      other.takeDamage(dmg, this.facingSign);
      this.addCombo(3);
      cameraShake(0.3);
      return true;
    }
    return false;
  }

  tryBlock() {
    if (['punch','kick','special','dead'].includes(this.state)) return;
    this.setState('block', 6);
  }

  tryJump() {
    if (!this.onGround || ['punch','kick','special','hurt','dead'].includes(this.state)) return;
    this.vy = FIGHTER_DEFAULTS.jumpForce;
    this.onGround = false;
    this.setState('jump', 40);
  }

  addCombo(n = 1) {
    this.combo += n;
    this.comboTimer = 120;
    if (this.combo >= 3) showAnnouncer(this.name + ' COMBO!', 900, this.facingSign === 1 ? '#60a5fa' : '#fb923c');
    if (this.combo >= 5) showAnnouncer(this.name + '\nSUPER COMBO!', 1000, '#fbbf24');
  }

  // ── Update per frame ──────────────────────
  update(dt, other) {
    if (this.state === 'dead') { this.animateDead(dt); return; }

    // Knockback
    if (Math.abs(this.knockback) > 0.001) {
      this.x += this.knockback;
      this.knockback *= 0.82;
    }

    // Gravity / jump
    if (!this.onGround) {
      this.vy -= FIGHTER_DEFAULTS.gravity;
      this.y += this.vy;
      if (this.y <= FIGHTER_DEFAULTS.groundY) {
        this.y = FIGHTER_DEFAULTS.groundY;
        this.vy = 0;
        this.onGround = true;
        if (this.state === 'jump') this.setState('idle', 0);
      }
    }

    // Clamp to arena
    this.x = Math.max(-6.2, Math.min(6.2, this.x));

    // Timers
    if (this.stateTimer > 0) {
      this.stateTimer--;
      if (this.stateTimer === 0 && !['idle','walk','jump','dead'].includes(this.state)) {
        this.setState('idle', 0);
      }
    }
    if (this.invincible > 0) this.invincible--;
    if (this.comboTimer > 0) { this.comboTimer--; if (this.comboTimer === 0) this.combo = 0; }

    // Stamina regen
    this.stamina = Math.min(100, this.stamina + 0.15);

    // Shake effect
    if (this.shakeX > 0) this.shakeX--;

    // Animate
    this.animT += dt;
    this.faceOpponent(other);
    this.animateParts();

    // Apply position to group
    const sxOffset = this.shakeX > 0 ? (Math.random() - 0.5) * 0.08 * this.shakeX : 0;
    this.group.position.set(this.x + sxOffset, this.y, 0);
    this.shadow.position.set(this.x, 0.01, 0.05);
    this.shadow.scale.setScalar(1 - this.y * 0.5);
  }

  // ── Part animations ───────────────────────
  animateParts() {
    const p = this.parts;
    const t = this.animT;

    // Reset
    const resetPos = (part, x, y, z) => { part.position.set(x, y, z); };
    const resetRot = (part) => { part.rotation.set(0,0,0); };

    switch (this.state) {
      case 'idle': {
        const bob = Math.sin(t * 2.5) * 0.025;
        p.torso.position.y = 1.05 + bob;
        p.head.position.y = 1.56 + bob;
        p.hair.position.y = 1.71 + bob;
        p.neck.position.y = 1.38 + bob;
        p.lUpperArm.rotation.z = 0.1 + Math.sin(t * 2.5) * 0.06;
        p.rUpperArm.rotation.z = -0.1 - Math.sin(t * 2.5) * 0.06;
        p.lThigh.rotation.x = Math.sin(t * 2.5) * 0.04;
        p.rThigh.rotation.x = -Math.sin(t * 2.5) * 0.04;
        break;
      }
      case 'walk': {
        const sw = Math.sin(t * 10);
        p.lThigh.rotation.x = sw * 0.35;
        p.rThigh.rotation.x = -sw * 0.35;
        p.lShin.rotation.x = Math.max(0, -sw) * 0.4;
        p.rShin.rotation.x = Math.max(0, sw) * 0.4;
        p.lUpperArm.rotation.x = -sw * 0.3;
        p.rUpperArm.rotation.x = sw * 0.3;
        p.torso.rotation.y = sw * 0.06;
        break;
      }
      case 'jump': {
        p.lThigh.rotation.x = 0.5;
        p.rThigh.rotation.x = 0.5;
        p.lShin.rotation.x = -0.8;
        p.rShin.rotation.x = -0.8;
        p.lUpperArm.rotation.z = 0.6;
        p.rUpperArm.rotation.z = -0.6;
        break;
      }
      case 'punch': {
        const prog = 1 - this.stateTimer / 22;
        const ext = prog < 0.5 ? prog * 2 : (1 - prog) * 2;
        p.rUpperArm.rotation.x = -ext * 0.8;
        p.rForeArm.position.set(0.38 + ext * 0.3 * this.facingSign, 0.8, 0);
        p.rFist.position.set(0.38 + ext * 0.45 * this.facingSign, 0.64 + ext * 0.1, 0);
        p.torso.rotation.y = ext * 0.25 * this.facingSign;
        break;
      }
      case 'kick': {
        const prog = 1 - this.stateTimer / 28;
        const ext = prog < 0.5 ? prog * 2 : (1 - prog) * 2;
        p.rThigh.rotation.x = -ext * 1.0;
        p.rShin.rotation.x = ext * 0.6;
        p.rFoot.position.set(0.14 + ext * 0.2 * this.facingSign, -0.1 + ext * 0.3, 0.04);
        p.torso.rotation.z = -ext * 0.15;
        break;
      }
      case 'special': {
        const prog = 1 - this.stateTimer / 40;
        const spin = prog * Math.PI * 1.5;
        p.torso.rotation.y = spin;
        p.head.rotation.y = spin;
        p.lUpperArm.rotation.z = 1.2 + Math.sin(spin * 2) * 0.5;
        p.rUpperArm.rotation.z = -1.2 - Math.sin(spin * 2) * 0.5;
        p.rThigh.rotation.x = -Math.sin(spin) * 1.2;
        p.lThigh.rotation.x = Math.sin(spin) * 1.2;
        break;
      }
      case 'block': {
        p.lUpperArm.rotation.x = -1.0;
        p.rUpperArm.rotation.x = -1.0;
        p.lForeArm.rotation.x = 0.8;
        p.rForeArm.rotation.x = 0.8;
        p.lForeArm.position.set(-0.22, 1.1, 0.2);
        p.rForeArm.position.set(0.22, 1.1, 0.2);
        p.head.rotation.x = -0.2;
        break;
      }
      case 'hurt': {
        p.torso.rotation.z = -0.3 * this.facingSign;
        p.head.rotation.x = 0.2;
        p.lUpperArm.rotation.z = 0.6;
        p.rUpperArm.rotation.z = -0.6;
        break;
      }
      default: break;
    }
  }

  animateDead(dt) {
    // Fall over
    this.group.rotation.z = Math.min(Math.PI / 2, this.group.rotation.z + 0.04);
    this.group.position.y = Math.max(-0.3, this.group.position.y - 0.015);
  }
}

// ─── AI CONTROLLER ────────────────────────────────────────
function updateAI(dt) {
  if (G.mode === '2p') return;
  const ai = p2;
  const player = p1;
  if (ai.state === 'dead' || player.state === 'dead') return;

  const cfg = DIFF[G.difficulty];
  ai.aiDecisionTimer++;

  if (ai.aiDecisionTimer < cfg.reactionTime) return;
  ai.aiDecisionTimer = 0;

  const dist = Math.abs(ai.x - player.x);
  const roll = Math.random();

  // Move toward / away
  if (dist > 1.8) {
    ai.x += -cfg.moveSpeed * (ai.x > player.x ? 1 : -1) * 60 * dt;
    if (!['punch','kick','special','hurt','block'].includes(ai.state)) ai.setState('walk', 8);
  } else if (dist < 0.8) {
    // Too close, back off slightly
    ai.x += cfg.moveSpeed * 0.5 * (ai.x > player.x ? 1 : -1) * 60 * dt;
  }

  // Attack / block decisions
  if (dist < 1.6) {
    if (roll < cfg.blockChance && !['hurt','block'].includes(ai.state)) {
      ai.tryBlock();
    } else if (roll < cfg.blockChance + cfg.attackChance * 0.5) {
      ai.tryPunch(player);
    } else if (roll < cfg.blockChance + cfg.attackChance * 0.8) {
      ai.tryKick(player);
    } else if (roll < cfg.blockChance + cfg.attackChance && ai.stamina >= 35) {
      ai.trySpecial(player);
    }
  }

  // Occasional jump
  if (Math.random() < 0.005 && G.difficulty === 'hard') ai.tryJump();
}

// ─── PLAYER INPUT ─────────────────────────────────────────
function handleP1Input() {
  if (!p1 || p1.state === 'dead' || G.paused) return;

  const left = keys['a'] || keys['arrowleft'] || mobileInput.dx < -0.3;
  const right = keys['d'] || keys['arrowright'] || mobileInput.dx > 0.3;
  const doJump = keys[' '] || mobileInput.jump;
  const doPunch = keys['j'] || mobileInput.punch;
  const doKick = keys['k'] || mobileInput.kick;
  const doSpecial = keys['l'] || mobileInput.special;
  const doBlock = keys['i'] || mobileInput.block;

  if (doBlock) { p1.tryBlock(); }
  if (doPunch) { p1.tryPunch(p2); mobileInput.punch = false; }
  if (doKick) { p1.tryKick(p2); mobileInput.kick = false; }
  if (doSpecial) { p1.trySpecial(p2); mobileInput.special = false; }
  if (doJump) { p1.tryJump(); mobileInput.jump = false; }

  if ((left || right) && ['idle','walk'].includes(p1.state)) {
    const dir = left ? -1 : 1;
    p1.x += dir * FIGHTER_DEFAULTS.moveSpeed * 60 * (1 / 60);
    p1.setState('walk', 6);
  }
}

function handleP2Input() {
  if (G.mode !== '2p' || !p2 || p2.state === 'dead' || G.paused) return;

  const left = p2keys['arrowleft'];
  const right = p2keys['arrowright'];
  const doJump = p2keys['0'] || p2keys['numpad0'];
  const doPunch = p2keys['1'] || p2keys['numpad1'];
  const doKick = p2keys['2'] || p2keys['numpad2'];
  const doSpecial = p2keys['3'] || p2keys['numpad3'];
  const doBlock = p2keys['4'] || p2keys['numpad4'];

  if (doBlock) p2.tryBlock();
  if (doPunch) { p2.tryPunch(p1); }
  if (doKick) { p2.tryKick(p1); }
  if (doSpecial) { p2.trySpecial(p1); }
  if (doJump) p2.tryJump();

  if ((left || right) && ['idle','walk'].includes(p2.state)) {
    const dir = left ? -1 : 1;
    p2.x += dir * FIGHTER_DEFAULTS.moveSpeed * 60 * (1 / 60);
    p2.setState('walk', 6);
  }
}

// ─── CAMERA ───────────────────────────────────────────────
let camShakeAmt = 0;
let camShakeDecay = 0.85;

function cameraShake(amount) { camShakeAmt = Math.max(camShakeAmt, amount); }

function updateCamera() {
  if (!p1 || !p2) return;
  const midX = (p1.x + p2.x) / 2;
  const dist = Math.abs(p1.x - p2.x);
  const targetZ = Math.max(5.5, Math.min(10, 5 + dist * 0.55));
  const targetY = 2.2 + dist * 0.1;
  const targetX = midX * 0.5;

  camera.position.x += (targetX - camera.position.x) * 0.06;
  camera.position.z += (targetZ - camera.position.z) * 0.06;
  camera.position.y += (targetY - camera.position.y) * 0.06;

  // Shake
  if (camShakeAmt > 0.005) {
    camera.position.x += (Math.random() - 0.5) * camShakeAmt;
    camera.position.y += (Math.random() - 0.5) * camShakeAmt * 0.5;
    camShakeAmt *= camShakeDecay;
  }

  camera.lookAt(midX * 0.4, 1.0, 0);
}

// ─── PARTICLES ────────────────────────────────────────────
function initParticles() {
  particleCanvas = document.createElement('canvas');
  particleCanvas.id = 'particleCanvas';
  particleCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30;';
  document.body.appendChild(particleCanvas);
  particleCtx = particleCanvas.getContext('2d');
  particleCanvas.width = window.innerWidth;
  particleCanvas.height = window.innerHeight;
  window.addEventListener('resize', () => {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  });
}

function spawnHitParticles(worldX, worldY, dmg) {
  // Project 3D to 2D
  const vec = new THREE.Vector3(worldX, worldY, 0);
  vec.project(camera);
  const sx = (vec.x * 0.5 + 0.5) * particleCanvas.width;
  const sy = (-vec.y * 0.5 + 0.5) * particleCanvas.height;

  const count = dmg > 20 ? 16 : 8;
  const colors = dmg > 20 ? ['#fbbf24','#f97316','#ef4444','#fff'] : ['#ef4444','#fca5a5','#fff'];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    particles.push({
      x: sx, y: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1.0, decay: 0.03 + Math.random() * 0.04,
      r: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function updateParticles() {
  particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    particleCtx.globalAlpha = p.life;
    particleCtx.fillStyle = p.color;
    particleCtx.beginPath();
    particleCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    particleCtx.fill();
  }
  particleCtx.globalAlpha = 1;
}

// ─── ROUND & GAME FLOW ────────────────────────────────────
function startGame() {
  // Hide all screens
  el('startScreen').classList.add('hidden');
  el('gameOverScreen').classList.add('hidden');
  el('pauseScreen').classList.add('hidden');

  // Show HUD
  el('hud').classList.remove('hidden');
  el('announcer').classList.add('hidden');

  // Mobile controls
  if (G.isMobile) el('mobileControls').classList.remove('hidden');

  G.wins = [0, 0];
  G.round = 1;
  G.gameRunning = true;
  G.paused = false;

  initThreeIfNeeded();
  startRound();
  if (!animFrameId) gameLoop();
}

function startRound() {
  clearInterval(G.timerInterval);
  G.timeLeft = 60;

  // Remove old fighters
  if (p1) { scene.remove(p1.group); scene.remove(p1.shadow); }
  if (p2) { scene.remove(p2.group); scene.remove(p2.shadow); }

  p1 = new Fighter('PAVAN', 0x3b82f6, 0x1d4ed8, -2.2, 1);
  p2 = new Fighter('YASHAS', 0xf97316, 0xc2410c, 2.2, -1);

  showAnnouncer(`ROUND ${G.round}`, 1200, '#fbbf24');
  setTimeout(() => showAnnouncer('FIGHT!', 900, '#ef4444'), 1300);

  G.timerInterval = setInterval(() => {
    if (!G.gameRunning || G.paused) return;
    G.timeLeft--;
    if (G.timeLeft <= 0) { endRound(); }
  }, 1000);
}

function endRound() {
  clearInterval(G.timerInterval);
  G.gameRunning = false;

  let winner = -1;
  if (p1.hp > p2.hp) winner = 0;
  else if (p2.hp > p1.hp) winner = 1;

  if (p1.hp <= 0) winner = 1;
  if (p2.hp <= 0) winner = 0;

  const names = ['PAVAN MANGALI', 'YASHAS'];

  if (winner >= 0) {
    G.wins[winner]++;
    showAnnouncer(names[winner] + '\nWINS!', 2000, winner === 0 ? '#60a5fa' : '#fb923c');
  } else {
    showAnnouncer('DRAW!', 2000, '#fbbf24');
  }

  setTimeout(() => {
    if (G.wins[0] >= 2 || G.wins[1] >= 2) {
      showGameOver(G.wins[0] >= 2 ? 0 : 1);
    } else {
      G.round++;
      G.gameRunning = true;
      startRound();
    }
  }, 2500);
}

function showGameOver(winnerIdx) {
  const names = ['PAVAN MANGALI', 'YASHAS'];
  el('winnerLabel').textContent = 'WINNER';
  el('winnerName').textContent = names[winnerIdx];
  el('scoreDisplay').textContent = `${G.wins[0]} – ${G.wins[1]}`;
  el('hud').classList.add('hidden');
  el('mobileControls').classList.add('hidden');
  el('gameOverScreen').classList.remove('hidden');
}

function togglePause() {
  G.paused = !G.paused;
  if (G.paused) {
    el('pauseScreen').classList.remove('hidden');
  } else {
    el('pauseScreen').classList.add('hidden');
  }
}

function goHome() {
  clearInterval(G.timerInterval);
  G.gameRunning = false;
  G.paused = false;
  el('pauseScreen').classList.add('hidden');
  el('gameOverScreen').classList.add('hidden');
  el('hud').classList.add('hidden');
  el('mobileControls').classList.add('hidden');
  el('startScreen').classList.remove('hidden');
  el('announcer').classList.add('hidden');
}

// ─── MAIN GAME LOOP ───────────────────────────────────────
function gameLoop() {
  animFrameId = requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!G.paused && G.gameRunning && p1 && p2) {
    handleP1Input();
    handleP2Input();
    updateAI(dt);

    p1.update(dt, p2);
    p2.update(dt, p1);

    // Check KO during round
    if ((p1.hp <= 0 || p2.hp <= 0) && G.gameRunning) {
      G.gameRunning = false;
      clearInterval(G.timerInterval);
      setTimeout(endRound, 600);
    }

    updateHUD();
    updateCamera();
  } else if (G.paused || !G.gameRunning) {
    // Still update camera smoothly
    updateCamera();
  }

  updateParticles();
  renderer.render(scene, camera);
}

// ─── INIT ─────────────────────────────────────────────────
let threeInitialized = false;
function initThreeIfNeeded() {
  if (threeInitialized) return;
  threeInitialized = true;
  initThree();
  buildArena();
  initParticles();
}

// ─── KEYBOARD INPUT ───────────────────────────────────────
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  // P2 keys (2P mode)
  p2keys[k] = true;
  if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  p2keys[k] = false;
});

// ─── MOBILE JOYSTICK ─────────────────────────────────────
function setupMobileControls() {
  const base = el('joystickBase');
  const knob = el('joystickKnob');
  const maxR = 38;

  function handleJoyMove(cx, cy) {
    const rect = base.getBoundingClientRect();
    const bx = rect.left + rect.width / 2;
    const by = rect.top + rect.height / 2;
    let dx = cx - bx;
    let dy = cy - by;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxR) { dx = dx/dist*maxR; dy = dy/dist*maxR; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    mobileInput.dx = dx / maxR;
  }

  base.addEventListener('touchstart', e => {
    e.preventDefault(); joystickActive = true;
    handleJoyMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  base.addEventListener('touchmove', e => {
    e.preventDefault();
    handleJoyMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  base.addEventListener('touchend', e => {
    e.preventDefault(); joystickActive = false;
    knob.style.transform = 'translate(-50%, -50%)';
    mobileInput.dx = 0;
  }, { passive: false });

  function mobBtn(id, key) {
    const btn = el(id);
    if (!btn) return;
    btn.addEventListener('touchstart', e => { e.preventDefault(); mobileInput[key] = true; }, { passive: false });
    btn.addEventListener('touchend', e => { e.preventDefault(); mobileInput[key] = false; }, { passive: false });
    btn.addEventListener('mousedown', () => mobileInput[key] = true);
    btn.addEventListener('mouseup', () => mobileInput[key] = false);
  }

  mobBtn('mobPunch', 'punch');
  mobBtn('mobKick', 'kick');
  mobBtn('mobBlock', 'block');
  mobBtn('mobSpecial', 'special');

  const jumpBtn = el('jumpBtn');
  jumpBtn.addEventListener('touchstart', e => { e.preventDefault(); mobileInput.jump = true; setTimeout(()=>mobileInput.jump=false, 150); }, { passive: false });
  jumpBtn.addEventListener('click', () => { mobileInput.jump = true; setTimeout(()=>mobileInput.jump=false, 150); });
}

// ─── UTILS ────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── BOOT ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupMobileControls();
  // Pre-warm Three.js in background
  setTimeout(() => { initThreeIfNeeded(); renderer.render(scene, camera); }, 100);
});

// Expose globals for HTML onclick
window.startGame = startGame;
window.togglePause = togglePause;
window.goHome = goHome;
window.selectMode = selectMode;
window.selectDiff = selectDiff;
