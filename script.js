/* ═══════════════════════════════════════════════════════════════
   KNOCKOUT — BOXING GAME ENGINE
   Three.js 3D + Full Game Mechanics
   Players: Pavan Mangali vs Yashas
═══════════════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════
const CONFIG = {
  RING_SIZE: 14,
  PLAYER_SPEED: 0.08,
  PUNCH_JAB_DAMAGE: 8,
  PUNCH_CROSS_DAMAGE: 18,
  PUNCH_JAB_STAMINA: 6,
  PUNCH_CROSS_STAMINA: 14,
  BLOCK_REDUCTION: 0.25,
  STAMINA_REGEN: 0.18,
  STAMINA_MIN_PUNCH: 10,
  JAB_COOLDOWN: 400,
  CROSS_COOLDOWN: 700,
  DODGE_COOLDOWN: 800,
  DODGE_DURATION: 300,
  COMBO_WINDOW: 600,
  HIT_RANGE: 2.8,
  ROUND_TIME: 180,
  ROUNDS: 3,
};

const DIFFICULTY = {
  easy:   { attackFreq: 0.004, blockChance: 0.25, dodgeChance: 0.15, reactionTime: 900, aggression: 0.4 },
  medium: { attackFreq: 0.009, blockChance: 0.45, dodgeChance: 0.30, reactionTime: 550, aggression: 0.65 },
  hard:   { attackFreq: 0.016, blockChance: 0.65, dodgeChance: 0.50, reactionTime: 250, aggression: 0.9  },
};

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
let scene, camera, renderer, clock;
let player, aiBoxer;
let gameState = 'menu'; // menu | playing | paused | gameover
let selectedDifficulty = 'easy';
let round = 1, roundTime = CONFIG.ROUND_TIME;
let animFrameId = null;
let slowMotion = false;
let slowMotionTimer = 0;
let roundScores = { player: 0, ai: 0 };

// Input state
const keys = {};
const touch = { joyActive: false, joyX: 0, joyY: 0, joyStartX: 0, joyStartY: 0 };

// Audio context
let audioCtx = null;

// ══════════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════════
const $ = id => document.getElementById(id);
const dom = {
  startScreen:    $('startScreen'),
  gameContainer:  $('gameContainer'),
  hud:            $('hud'),
  mobileControls: $('mobileControls'),
  pauseScreen:    $('pauseScreen'),
  gameOverScreen: $('gameOverScreen'),
  playerHP:       $('playerHP'),
  playerHPVal:    $('playerHPVal'),
  playerST:       $('playerST'),
  playerSTVal:    $('playerSTVal'),
  aiHP:           $('aiHP'),
  aiHPVal:        $('aiHPVal'),
  aiST:           $('aiST'),
  aiSTVal:        $('aiSTVal'),
  playerCombo:    $('playerCombo'),
  aiCombo:        $('aiCombo'),
  roundNum:       $('roundNum'),
  roundTimer:     $('roundTimer'),
  diffBadge:      $('diffBadge'),
  hitFlash:       $('hitFlash'),
  announcement:   $('announcement'),
  koText:         $('koText'),
  winnerText:     $('winnerText'),
  resultStats:    $('resultStats'),
  canvas:         $('gameCanvas'),
};

// ══════════════════════════════════════════
//  AUDIO ENGINE
// ══════════════════════════════════════════
function initAudio() {
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}

function playSound(type) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  const t = audioCtx.currentTime;

  if (type === 'jab') {
    o.type = 'square';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.start(t); o.stop(t + 0.1);
  } else if (type === 'cross') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t); o.stop(t + 0.18);
  } else if (type === 'block') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.06);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.start(t); o.stop(t + 0.08);
  } else if (type === 'ko') {
    // KO deep thud
    o.type = 'sine';
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.start(t); o.stop(t + 0.6);
  } else if (type === 'crowd') {
    // Simple crowd noise using filtered noise
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
    const gn = audioCtx.createGain();
    gn.gain.setValueAtTime(0.05, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    source.connect(filter); filter.connect(gn); gn.connect(audioCtx.destination);
    source.start(t); source.stop(t + 0.5);
  }
}

// ══════════════════════════════════════════
//  FIGHTER CLASS
// ══════════════════════════════════════════
class Boxer {
  constructor(isPlayer, color, position) {
    this.isPlayer = isPlayer;
    this.hp = 100;
    this.stamina = 100;
    this.isBlocking = false;
    this.isDodging = false;
    this.dodgeDir = 0;
    this.dodgeCooldown = 0;
    this.jabCooldown = 0;
    this.crossCooldown = 0;
    this.comboCount = 0;
    this.lastPunchTime = 0;
    this.comboTimer = 0;
    this.punchAnim = 0; // 0=idle, >0=punching
    this.punchType = 0; // 1=jab,2=cross
    this.velocity = { x: 0, z: 0 };
    this.facingAngle = isPlayer ? 0 : Math.PI;
    this.hurtTimer = 0;
    this.totalDamageDealt = 0;
    this.totalPunches = 0;

    // Build mesh group
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this._buildMesh(color);
    scene.add(this.group);

    // AI state
    if (!isPlayer) {
      this.aiState = 'approach';
      this.aiTimer = 0;
      this.aiBlockTimer = 0;
    }
  }

  _buildMesh(color) {
    const mat = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w,h,d,c) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(c));
    const cyl = (rt,rb,h,s,c) => new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s), mat(c));

    const skinColor = color;
    const shortsColor = this.isPlayer ? 0x1a4fad : 0xad1a1a;
    const gloveColor  = this.isPlayer ? 0x30aa30 : 0xaa3030;

    // Body
    this.body = box(0.9, 1.1, 0.55, skinColor);
    this.body.position.y = 1.4;
    this.body.castShadow = true;
    this.group.add(this.body);

    // Shorts
    const shorts = box(0.92, 0.5, 0.57, shortsColor);
    shorts.position.y = 0.85;
    this.group.add(shorts);

    // Head
    this.head = box(0.7, 0.7, 0.62, skinColor);
    this.head.position.y = 2.25;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Eyes (simple)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.08, 0.05);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 2.28, 0.32);
    this.group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 2.28, 0.32);
    this.group.add(eyeR);

    // Legs
    this.legL = cyl(0.18, 0.15, 0.85, 8, skinColor);
    this.legL.position.set(-0.22, 0.42, 0);
    this.group.add(this.legL);
    this.legR = cyl(0.18, 0.15, 0.85, 8, skinColor);
    this.legR.position.set(0.22, 0.42, 0);
    this.group.add(this.legR);

    // Arms
    this.armL = new THREE.Group();
    const upperArmL = cyl(0.14, 0.12, 0.6, 8, skinColor);
    upperArmL.position.y = -0.3;
    this.armL.add(upperArmL);
    const gloveL = box(0.3, 0.28, 0.3, gloveColor);
    gloveL.position.y = -0.68;
    this.armL.add(gloveL);
    this.armL.position.set(-0.62, 1.75, 0);
    this.armL.rotation.z = 0.2;
    this.group.add(this.armL);

    this.armR = new THREE.Group();
    const upperArmR = cyl(0.14, 0.12, 0.6, 8, skinColor);
    upperArmR.position.y = -0.3;
    this.armR.add(upperArmR);
    const gloveR = box(0.3, 0.28, 0.3, gloveColor);
    gloveR.position.y = -0.68;
    this.armR.add(gloveR);
    this.armR.position.set(0.62, 1.75, 0);
    this.armR.rotation.z = -0.2;
    this.group.add(this.armR);

    // Store rest rotations
    this._armLRestZ = 0.2;
    this._armRRestZ = -0.2;
    this._armLRestX = 0;
    this._armRRestX = 0;
  }

  get position() { return this.group.position; }

  distanceTo(other) {
    return this.group.position.distanceTo(other.group.position);
  }

  faceTarget(target) {
    const dx = target.position.x - this.position.x;
    const dz = target.position.z - this.position.z;
    this.facingAngle = Math.atan2(dx, dz);
    this.group.rotation.y = this.facingAngle;
  }

  move(dx, dz) {
    const halfRing = CONFIG.RING_SIZE / 2 - 0.6;
    this.position.x = Math.max(-halfRing, Math.min(halfRing, this.position.x + dx));
    this.position.z = Math.max(-halfRing, Math.min(halfRing, this.position.z + dz));
  }

  jab(target) {
    if (this.jabCooldown > 0 || this.stamina < CONFIG.STAMINA_MIN_PUNCH) return false;
    const staminaMult = Math.max(0.4, this.stamina / 100);
    this.jabCooldown = CONFIG.JAB_COOLDOWN * (slowMotion ? 3 : 1);
    this.stamina = Math.max(0, this.stamina - CONFIG.PUNCH_JAB_STAMINA);
    this.punchAnim = 1; this.punchType = 1;
    this.totalPunches++;

    if (this.distanceTo(target) < CONFIG.HIT_RANGE) {
      const dmg = CONFIG.PUNCH_JAB_DAMAGE * staminaMult * (target.isBlocking ? CONFIG.BLOCK_REDUCTION : 1) * (target.isDodging ? 0.1 : 1);
      target.receiveDamage(dmg);
      this.totalDamageDealt += dmg;
      checkCombo(this, 'jab');
      playSound(target.isBlocking ? 'block' : 'jab');
      return true;
    }
    playSound('jab');
    return false;
  }

  cross(target) {
    if (this.crossCooldown > 0 || this.stamina < CONFIG.STAMINA_MIN_PUNCH) return false;
    const staminaMult = Math.max(0.4, this.stamina / 100);
    this.crossCooldown = CONFIG.CROSS_COOLDOWN * (slowMotion ? 3 : 1);
    this.stamina = Math.max(0, this.stamina - CONFIG.PUNCH_CROSS_STAMINA);
    this.punchAnim = 1; this.punchType = 2;
    this.totalPunches++;

    if (this.distanceTo(target) < CONFIG.HIT_RANGE) {
      const dmg = CONFIG.PUNCH_CROSS_DAMAGE * staminaMult * (target.isBlocking ? CONFIG.BLOCK_REDUCTION : 1) * (target.isDodging ? 0.1 : 1);
      target.receiveDamage(dmg);
      this.totalDamageDealt += dmg;
      checkCombo(this, 'cross');
      playSound(target.isBlocking ? 'block' : 'cross');
      return true;
    }
    playSound('cross');
    return false;
  }

  receiveDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurtTimer = 200;
    if (this.isPlayer) {
      showHitFlash();
      shakeCamera(amount > 10 ? 'heavy' : 'light');
    } else {
      shakeCamera('light');
    }
  }

  block(active) {
    this.isBlocking = active;
    if (active) {
      // Raise arms into guard
      this.armL.rotation.x = -0.8;
      this.armR.rotation.x = -0.8;
    }
  }

  dodge(dir) {
    if (this.dodgeCooldown > 0) return;
    this.isDodging = true;
    this.dodgeDir = dir;
    this.dodgeCooldown = CONFIG.DODGE_COOLDOWN;
    setTimeout(() => { this.isDodging = false; }, CONFIG.DODGE_DURATION);
  }

  update(dt, opponent) {
    const dtMs = dt * 1000;

    // Cooldowns
    if (this.jabCooldown > 0) this.jabCooldown -= dtMs;
    if (this.crossCooldown > 0) this.crossCooldown -= dtMs;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dtMs;
    if (this.hurtTimer > 0) this.hurtTimer -= dtMs;
    if (this.comboTimer > 0) this.comboTimer -= dtMs;
    else if (this.comboCount > 0) { this.comboCount = 0; updateComboUI(this); }

    // Stamina regen
    if (!this.isBlocking) {
      this.stamina = Math.min(100, this.stamina + CONFIG.STAMINA_REGEN * (slowMotion ? 0.3 : 1));
    }

    // Dodge movement
    if (this.isDodging) {
      const side = this.dodgeDir;
      this.move(Math.cos(this.facingAngle) * side * 0.18, -Math.sin(this.facingAngle) * side * 0.18);
    }

    // Body sway animation (idle bounce)
    const t = performance.now() * 0.003;
    this.group.position.y = Math.sin(t * (this.isPlayer ? 1 : 1.2)) * 0.04;
    this.body.rotation.z = Math.sin(t * 0.7) * 0.03;

    // Leg bob
    this.legL.rotation.x = Math.sin(t * 1.2) * 0.2;
    this.legR.rotation.x = -Math.sin(t * 1.2) * 0.2;

    // Arm animation
    if (this.punchAnim > 0) {
      this.punchAnim -= dt * 6;
      const p = Math.max(0, this.punchAnim);
      if (this.punchType === 1) { // jab — left arm
        this.armL.rotation.x = -p * 1.2;
        this.armR.rotation.x = this.isBlocking ? -0.8 : 0;
      } else { // cross — right arm
        this.armR.rotation.x = -p * 1.2;
        this.armL.rotation.x = this.isBlocking ? -0.8 : 0;
      }
    } else if (!this.isBlocking) {
      this.armL.rotation.x += (-this._armLRestX - this.armL.rotation.x) * 0.15;
      this.armR.rotation.x += (-this._armRRestX - this.armR.rotation.x) * 0.15;
      this.armL.rotation.z = this._armLRestZ + Math.sin(t * 0.8) * 0.04;
      this.armR.rotation.z = this._armRRestZ - Math.sin(t * 0.8) * 0.04;
    }

    // Head bob
    this.head.rotation.y = Math.sin(t * 0.5) * 0.05;

    // Hurt flash
    if (this.hurtTimer > 0) {
      const flash = Math.sin(this.hurtTimer * 0.05) > 0;
      this.body.material.emissive = flash ? new THREE.Color(0.3, 0, 0) : new THREE.Color(0,0,0);
      this.head.material.emissive = flash ? new THREE.Color(0.3, 0, 0) : new THREE.Color(0,0,0);
    } else {
      this.body.material.emissive.set(0,0,0);
      this.head.material.emissive.set(0,0,0);
    }
  }
}

// ══════════════════════════════════════════
//  COMBO SYSTEM
// ══════════════════════════════════════════
const comboSequences = [];
function checkCombo(boxer, punchType) {
  const now = performance.now();
  if (now - boxer.lastPunchTime < CONFIG.COMBO_WINDOW) {
    boxer.comboCount++;
    boxer.comboTimer = CONFIG.COMBO_WINDOW;
  } else {
    boxer.comboCount = 1;
  }
  boxer.lastPunchTime = now;
  updateComboUI(boxer);
  if (boxer.comboCount >= 3) {
    showAnnouncement(boxer.isPlayer ? 'COMBO!' : 'YASHAS COMBO!', '#f0c040');
    playSound('crowd');
  }
}

function updateComboUI(boxer) {
  const el = boxer.isPlayer ? dom.playerCombo : dom.aiCombo;
  if (boxer.comboCount >= 2) {
    el.textContent = `${boxer.comboCount}x COMBO`;
  } else {
    el.textContent = '';
  }
}

// ══════════════════════════════════════════
//  THREE.JS SCENE SETUP
// ══════════════════════════════════════════
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);
  scene.fog = new THREE.Fog(0x080810, 20, 45);

  // Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4.5, 12);
  camera.lookAt(0, 1.5, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: window.devicePixelRatio < 2 });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  clock = new THREE.Clock();

  buildRing();
  buildLights();

  window.addEventListener('resize', onResize);
}

function buildLights() {
  // Ambient
  const amb = new THREE.AmbientLight(0x334466, 0.6);
  scene.add(amb);

  // Main ring lights — four spotlights from corners
  const spotPositions = [
    [-6, 10, -6], [6, 10, -6], [-6, 10, 6], [6, 10, 6]
  ];
  const spotColors = [0xfff0d0, 0xffd0b0, 0xd0e8ff, 0xfff0d0];
  spotPositions.forEach((pos, i) => {
    const spot = new THREE.SpotLight(spotColors[i], 1.8, 35, Math.PI / 5, 0.4, 1);
    spot.position.set(...pos);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 30;
    scene.add(spot);
    scene.add(spot.target);
  });

  // Rim light
  const rim = new THREE.DirectionalLight(0x4060ff, 0.5);
  rim.position.set(0, 8, -10);
  scene.add(rim);
}

function buildRing() {
  const halfR = CONFIG.RING_SIZE / 2;

  // Canvas floor — ring mat
  const canvasFloorTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, 0, 512, 512);
    // Corner circles
    const cornerPositions = [[80,80],[432,80],[80,432],[432,432]];
    cornerPositions.forEach(([x,y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,80,0.4)';
      ctx.lineWidth = 4;
      ctx.stroke();
    });
    // Center circle
    ctx.beginPath();
    ctx.arc(256, 256, 80, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,80,0.25)';
    ctx.lineWidth = 6;
    ctx.stroke();
    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath(); ctx.moveTo(i*32, 0); ctx.lineTo(i*32, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i*32); ctx.lineTo(512, i*32); ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
  })();

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.RING_SIZE, CONFIG.RING_SIZE),
    new THREE.MeshLambertMaterial({ map: canvasFloorTex })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ropes
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const ropeHeights = [1.2, 1.8, 2.4];
  ropeHeights.forEach(h => {
    const sides = [
      { pos: [0, h, -halfR], rot: [0,0,0], len: CONFIG.RING_SIZE },
      { pos: [0, h,  halfR], rot: [0,0,0], len: CONFIG.RING_SIZE },
      { pos: [-halfR, h, 0], rot: [0, Math.PI/2, 0], len: CONFIG.RING_SIZE },
      { pos: [ halfR, h, 0], rot: [0, Math.PI/2, 0], len: CONFIG.RING_SIZE },
    ];
    sides.forEach(({ pos, rot, len }) => {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 6), ropeMat);
      rope.rotation.set(...rot);
      rope.rotation.z += Math.PI / 2;
      rope.position.set(...pos);
      scene.add(rope);
    });
  });

  // Corner posts
  const postMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const postColors = [0xff3030, 0x3030ff, 0x3030ff, 0xff3030];
  const corners = [[-halfR,-halfR],[halfR,-halfR],[-halfR,halfR],[halfR,halfR]];
  corners.forEach(([x,z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), new THREE.MeshLambertMaterial({ color: postColors[i] }));
    post.position.set(x, 1.6, z);
    post.castShadow = true;
    scene.add(post);
    // Post pad
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.8, 8), new THREE.MeshLambertMaterial({ color: postColors[i] }));
    pad.position.set(x, 1.8, z);
    scene.add(pad);
  });

  // Apron (area outside ring)
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: 0x080810 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.01;
  apron.receiveShadow = true;
  scene.add(apron);

  // Crowd backdrop (simple cylinders in distance)
  buildCrowd();
}

function buildCrowd() {
  const crowdMat = new THREE.MeshLambertMaterial({ color: 0x1a1a28, side: THREE.FrontSide });
  for (let i = 0; i < 80; i++) {
    const angle = (i / 80) * Math.PI * 2;
    const r = 12 + Math.random() * 4;
    const h = 1.2 + Math.random() * 1.5;
    const crowd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h, 6), crowdMat);
    crowd.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
    scene.add(crowd);
  }
  // Stadium light rigs (cylinders on top)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rig = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rig.position.set(Math.cos(angle) * 14, 4, Math.sin(angle) * 14);
    scene.add(rig);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ══════════════════════════════════════════
//  CAMERA SHAKE
// ══════════════════════════════════════════
let cameraShake = { x: 0, y: 0, duration: 0, intensity: 0 };

function shakeCamera(type) {
  cameraShake.intensity = type === 'heavy' ? 0.25 : 0.1;
  cameraShake.duration = type === 'heavy' ? 0.4 : 0.2;
}

function updateCamera(dt) {
  // Follow midpoint between fighters
  const midX = (player.position.x + aiBoxer.position.x) * 0.5;
  const midZ = (player.position.z + aiBoxer.position.z) * 0.5;
  const dist = player.distanceTo(aiBoxer);
  const targetZ = Math.max(8, Math.min(16, dist * 1.5 + 5));
  const targetY = Math.max(3.5, Math.min(6, dist * 0.4 + 3));

  camera.position.x += (midX - camera.position.x) * 0.06;
  camera.position.z += (midZ + targetZ - camera.position.z) * 0.06;
  camera.position.y += (targetY - camera.position.y) * 0.06;

  // Shake
  if (cameraShake.duration > 0) {
    cameraShake.duration -= dt;
    const s = cameraShake.intensity * (cameraShake.duration / 0.4);
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }

  camera.lookAt(midX, 1.5, midZ);
}

// ══════════════════════════════════════════
//  AI SYSTEM
// ══════════════════════════════════════════
function updateAI(dt) {
  if (!aiBoxer || !player) return;
  const diff = DIFFICULTY[selectedDifficulty];
  const aiPos = aiBoxer.position;
  const pPos  = player.position;
  const dist  = aiBoxer.distanceTo(player);

  aiBoxer.aiTimer -= dt * 1000;

  // Face player
  aiBoxer.faceTarget(player);

  // Decide state
  if (aiBoxer.aiTimer <= 0) {
    const roll = Math.random();

    if (player.hp < 30 && dist < CONFIG.HIT_RANGE) {
      // Go aggressive when player is low
      aiBoxer.aiState = 'combo';
    } else if (dist > CONFIG.HIT_RANGE + 0.5) {
      aiBoxer.aiState = roll < diff.aggression ? 'approach' : 'strafe';
    } else {
      if (roll < 0.1) aiBoxer.aiState = 'retreat';
      else if (roll < 0.1 + diff.dodgeChance * 0.3) aiBoxer.aiState = 'dodge';
      else aiBoxer.aiState = 'attack';
    }

    aiBoxer.aiTimer = diff.reactionTime * (0.7 + Math.random() * 0.6);
  }

  // Execute state
  const spd = CONFIG.PLAYER_SPEED * 0.75 * (slowMotion ? 0.3 : 1);
  const dx = pPos.x - aiPos.x;
  const dz = pPos.z - aiPos.z;
  const len = Math.sqrt(dx*dx + dz*dz) || 1;

  switch (aiBoxer.aiState) {
    case 'approach':
      if (dist > CONFIG.HIT_RANGE - 0.3) {
        aiBoxer.move(dx/len * spd, dz/len * spd);
      }
      // Opportunistic attack
      if (dist < CONFIG.HIT_RANGE && Math.random() < diff.attackFreq * 3) {
        aiBoxer.jab(player);
      }
      break;

    case 'strafe':
      // Strafe sideways
      aiBoxer.move(-dz/len * spd * 0.6, dx/len * spd * 0.6);
      if (dist > CONFIG.HIT_RANGE + 1) aiBoxer.move(dx/len * spd * 0.4, dz/len * spd * 0.4);
      break;

    case 'attack':
      if (dist < CONFIG.HIT_RANGE) {
        const r = Math.random();
        if (r < diff.attackFreq * 12) {
          if (Math.random() < 0.55) aiBoxer.jab(player);
          else aiBoxer.cross(player);
        }
      } else {
        aiBoxer.move(dx/len * spd, dz/len * spd);
      }
      break;

    case 'combo':
      if (dist < CONFIG.HIT_RANGE) {
        if (Math.random() < diff.attackFreq * 15) aiBoxer.jab(player);
        if (Math.random() < diff.attackFreq * 8)  aiBoxer.cross(player);
      }
      break;

    case 'retreat':
      aiBoxer.move(-dx/len * spd * 0.8, -dz/len * spd * 0.8);
      break;

    case 'dodge':
      if (!aiBoxer.isDodging) aiBoxer.dodge(Math.random() < 0.5 ? 1 : -1);
      break;
  }

  // Blocking logic — react to player punching
  if (player.punchAnim > 0.5 && dist < CONFIG.HIT_RANGE + 0.5) {
    aiBoxer.block(Math.random() < diff.blockChance);
    aiBoxer.aiBlockTimer = 400;
  }
  if (aiBoxer.aiBlockTimer > 0) {
    aiBoxer.aiBlockTimer -= dt * 1000;
    if (aiBoxer.aiBlockTimer <= 0) aiBoxer.block(false);
  }
}

// ══════════════════════════════════════════
//  PLAYER INPUT
// ══════════════════════════════════════════
function handlePlayerInput(dt) {
  if (!player || gameState !== 'playing') return;

  const spd = CONFIG.PLAYER_SPEED * (player.stamina < 20 ? 0.5 : 1) * (slowMotion ? 0.3 : 1);
  let mx = 0, mz = 0;

  // Movement
  if (keys['a'] || keys['ArrowLeft'])  mx -= spd;
  if (keys['d'] || keys['ArrowRight']) mx += spd;
  if (keys['w'] || keys['ArrowUp'])    mz -= spd;
  if (keys['s'] || keys['ArrowDown'])  mz += spd;

  // Mobile joystick
  if (touch.joyActive) {
    mx += touch.joyX * spd * 1.4;
    mz += touch.joyY * spd * 1.4;
  }

  if (mx !== 0 || mz !== 0) {
    player.move(mx, mz);
    player.facingAngle = Math.atan2(mx, -mz);
    player.group.rotation.y = player.facingAngle;
  }

  player.faceTarget(aiBoxer);
  player.block(keys['l'] || keys['L'] || keys['F']);
}

// ══════════════════════════════════════════
//  HUD UPDATE
// ══════════════════════════════════════════
function updateHUD() {
  if (!player || !aiBoxer) return;

  const pHP = Math.max(0, player.hp);
  const aHP = Math.max(0, aiBoxer.hp);
  const pST = Math.max(0, player.stamina);
  const aST = Math.max(0, aiBoxer.stamina);

  dom.playerHP.style.width = pHP + '%';
  dom.aiHP.style.width = aHP + '%';
  dom.playerST.style.width = pST + '%';
  dom.aiST.style.width = aST + '%';

  dom.playerHPVal.textContent = Math.round(pHP);
  dom.aiHPVal.textContent = Math.round(aHP);
  dom.playerSTVal.textContent = Math.round(pST);
  dom.aiSTVal.textContent = Math.round(aST);

  // Color shifts
  const hpColor = h => h > 50 ? 'linear-gradient(90deg, #30e060, #80ff80)' :
                        h > 25 ? 'linear-gradient(90deg, #e0a030, #ffd060)' :
                                  'linear-gradient(90deg, #e03030, #ff6060)';
  dom.playerHP.style.background = hpColor(pHP);
  dom.playerHP.classList.toggle('hp-low', pHP < 25);

  // Round timer
  const mins = Math.floor(roundTime / 60);
  const secs = Math.floor(roundTime % 60);
  dom.roundTimer.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
  dom.roundNum.textContent = round;
}

// ══════════════════════════════════════════
//  ROUND TIMER
// ══════════════════════════════════════════
let roundTimerInterval = null;

function startRoundTimer() {
  clearInterval(roundTimerInterval);
  roundTimerInterval = setInterval(() => {
    if (gameState !== 'playing') return;
    roundTime -= 1;
    if (roundTime <= 0) endRound('time');
  }, 1000);
}

function endRound(reason) {
  clearInterval(roundTimerInterval);
  if (reason === 'time') {
    // Judge by HP
    if (player.hp > aiBoxer.hp) { roundScores.player++; showAnnouncement('ROUND TO PAVAN!'); }
    else if (aiBoxer.hp > player.hp) { roundScores.ai++; showAnnouncement('ROUND TO YASHAS!'); }
    else showAnnouncement("DRAW!");

    if (round < CONFIG.ROUNDS) {
      round++;
      setTimeout(startNewRound, 2000);
    } else {
      setTimeout(endGame, 1500);
    }
  }
}

function startNewRound() {
  roundTime = CONFIG.ROUND_TIME;
  player.hp = 100; aiBoxer.hp = 100;
  player.stamina = 100; aiBoxer.stamina = 100;
  player.group.position.set(-3, 0, 0);
  aiBoxer.group.position.set(3, 0, 0);
  startRoundTimer();
  showAnnouncement(`ROUND ${round}`, '#f0c040');
}

// ══════════════════════════════════════════
//  GAME LOOP
// ══════════════════════════════════════════
function gameLoop() {
  animFrameId = requestAnimationFrame(gameLoop);
  if (gameState !== 'playing') { renderer.render(scene, camera); return; }

  let dt = clock.getDelta();
  if (slowMotion) dt *= 0.25;
  dt = Math.min(dt, 0.05); // cap dt

  handlePlayerInput(dt);
  player.update(dt, aiBoxer);
  aiBoxer.update(dt, player);
  updateAI(dt);
  updateCamera(dt);
  updateHUD();
  checkKO();

  // Slow motion countdown
  if (slowMotion) {
    slowMotionTimer -= dt * 1000;
    if (slowMotionTimer <= 0) { slowMotion = false; }
  }

  renderer.render(scene, camera);
}

function checkKO() {
  if (player.hp <= 0) {
    triggerKO(false);
  } else if (aiBoxer.hp <= 0) {
    triggerKO(true);
  }
}

function triggerKO(playerWon) {
  if (gameState === 'gameover') return;
  gameState = 'gameover';
  clearInterval(roundTimerInterval);

  // Slow motion effect
  slowMotion = true;
  slowMotionTimer = 2000;

  // Add slowmo overlay
  const overlay = document.createElement('div');
  overlay.className = 'slowmo-overlay';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 1000);

  playSound('ko');
  playSound('crowd');

  setTimeout(() => {
    endGame(playerWon);
  }, 1800);
}

function endGame(playerWon) {
  gameState = 'gameover';
  clearInterval(roundTimerInterval);

  const winner = typeof playerWon === 'boolean'
    ? playerWon
    : (roundScores.player > roundScores.ai ? true : false);

  dom.koText.textContent = typeof playerWon === 'boolean' ? 'K.O.!' : 'FINAL DECISION';
  dom.winnerText.textContent = winner ? 'PAVAN WINS!' : 'YASHAS WINS!';
  dom.resultStats.innerHTML = `
    Pavan dealt: <strong>${Math.round(player.totalDamageDealt)} dmg</strong> | Punches: <strong>${player.totalPunches}</strong><br>
    Yashas dealt: <strong>${Math.round(aiBoxer.totalDamageDealt)} dmg</strong> | Punches: <strong>${aiBoxer.totalPunches}</strong><br>
    Round Scores: Pavan ${roundScores.player} — ${roundScores.ai} Yashas
  `;

  showScreen('gameOverScreen');
}

// ══════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════
function showScreen(id) {
  ['startScreen','pauseScreen','gameOverScreen'].forEach(s => {
    const el = $(s);
    el.classList.remove('active','visible');
    el.classList.add('hidden');
  });
  if (id) {
    const el = $(id);
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('active'));
  }
}

function showHitFlash() {
  dom.hitFlash.className = 'hit-flash player-hit flash';
  clearTimeout(dom.hitFlash._t);
  dom.hitFlash._t = setTimeout(() => { dom.hitFlash.className = 'hit-flash'; }, 120);
}

let announcementTimer = null;
function showAnnouncement(text, color = '#f0c040') {
  dom.announcement.textContent = text;
  dom.announcement.style.color = color;
  dom.announcement.classList.add('show');
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => dom.announcement.classList.remove('show'), 1200);
}

// ══════════════════════════════════════════
//  GAME START / RESET
// ══════════════════════════════════════════
function startGame() {
  if (!audioCtx) initAudio();

  // Reset state
  round = 1;
  roundTime = CONFIG.ROUND_TIME;
  roundScores = { player: 0, ai: 0 };
  slowMotion = false;

  showScreen(null);
  dom.gameContainer.classList.remove('hidden');
  dom.hud.classList.remove('hidden');
  dom.diffBadge.textContent = selectedDifficulty.toUpperCase();

  // Init Three.js if not done
  if (!renderer) initThree();

  // Remove old fighters
  if (player)   { scene.remove(player.group); }
  if (aiBoxer)  { scene.remove(aiBoxer.group); }

  // Create fighters
  player  = new Boxer(true,  0xd4956a, new THREE.Vector3(-3, 0, 0));
  aiBoxer = new Boxer(false, 0xc07855, new THREE.Vector3( 3, 0, 0));

  // Mobile controls
  const isMobile = ('ontouchstart' in window) || window.innerWidth < 768;
  if (isMobile) dom.mobileControls.classList.remove('hidden');
  else          dom.mobileControls.classList.add('hidden');

  gameState = 'playing';
  clock.start();
  if (!animFrameId) gameLoop();

  startRoundTimer();
  showAnnouncement('ROUND 1', '#f0c040');
}

// ══════════════════════════════════════════
//  KEYBOARD INPUT
// ══════════════════════════════════════════
document.addEventListener('keydown', e => {
  keys[e.key] = true;

  if (gameState !== 'playing') return;
  if (!player || !aiBoxer) return;

  switch(e.key.toLowerCase()) {
    case 'j': player.jab(aiBoxer); break;
    case 'k': player.cross(aiBoxer); break;
    case 'shift': player.dodge(1); break;
  }
  if (e.key === 'Escape' || e.key === 'p') togglePause();
});

document.addEventListener('keyup', e => {
  keys[e.key] = false;
  if (e.key === 'l' || e.key === 'L' || e.key === 'F') {
    if (player) player.block(false);
  }
});

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    dom.pauseScreen.classList.remove('hidden');
    requestAnimationFrame(() => dom.pauseScreen.classList.add('active'));
  } else if (gameState === 'paused') {
    gameState = 'playing';
    dom.pauseScreen.classList.remove('active');
    setTimeout(() => dom.pauseScreen.classList.add('hidden'), 300);
  }
}

// ══════════════════════════════════════════
//  MOBILE JOYSTICK
// ══════════════════════════════════════════
function initJoystick() {
  const zone = $('joystickZone');
  const knob = $('joystickKnob');
  const base = $('joystickBase');
  const baseR = 55; // radius

  function getPos(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    const p = getPos(e);
    touch.joyStartX = p.x; touch.joyStartY = p.y;
    touch.joyActive = true;
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!touch.joyActive) return;
    const p = getPos(e);
    let dx = p.x - touch.joyStartX;
    let dy = p.y - touch.joyStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > baseR) { dx = dx/dist * baseR; dy = dy/dist * baseR; }
    touch.joyX = dx / baseR;
    touch.joyY = dy / baseR;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }, { passive: false });

  const endJoy = () => {
    touch.joyActive = false; touch.joyX = 0; touch.joyY = 0;
    knob.style.transform = 'translate(0,0)';
  };
  zone.addEventListener('touchend', endJoy);
  zone.addEventListener('touchcancel', endJoy);
}

function initMobileButtons() {
  const btn = (id, fn) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
  };

  btn('mJab',   () => { if (player && aiBoxer) player.jab(aiBoxer); });
  btn('mCross', () => { if (player && aiBoxer) player.cross(aiBoxer); });
  btn('mBlock', () => { if (player) player.block(true); });
  btn('mDodge', () => { if (player) player.dodge(1); });

  $('mBlock').addEventListener('touchend', () => { if (player) player.block(false); });
}

// ══════════════════════════════════════════
//  UI EVENT LISTENERS
// ══════════════════════════════════════════
$('startBtn').addEventListener('click', startGame);

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.diff;
  });
});

$('pauseBtn').addEventListener('click', togglePause);
$('resumeBtn').addEventListener('click', togglePause);

$('quitBtn').addEventListener('click', () => {
  gameState = 'menu';
  clearInterval(roundTimerInterval);
  dom.pauseScreen.classList.remove('active');
  setTimeout(() => dom.pauseScreen.classList.add('hidden'), 300);
  dom.hud.classList.add('hidden');
  dom.mobileControls.classList.add('hidden');
  showScreen('startScreen');
});

$('replayBtn').addEventListener('click', () => {
  dom.gameOverScreen.classList.remove('active');
  setTimeout(() => { dom.gameOverScreen.classList.add('hidden'); startGame(); }, 300);
});

$('menuBtn').addEventListener('click', () => {
  gameState = 'menu';
  clearInterval(roundTimerInterval);
  dom.gameOverScreen.classList.remove('active');
  setTimeout(() => dom.gameOverScreen.classList.add('hidden'), 300);
  dom.hud.classList.add('hidden');
  dom.mobileControls.classList.add('hidden');
  showScreen('startScreen');
});

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
(function init() {
  // Show start screen
  showScreen('startScreen');

  // Pre-init Three.js in background for faster start
  setTimeout(() => {
    if (!renderer) initThree();
    // Start render loop early for background ring preview
    function previewLoop() {
      if (gameState !== 'menu') return;
      requestAnimationFrame(previewLoop);
      // Slowly rotate camera for preview
      const t = performance.now() * 0.0004;
      camera.position.x = Math.sin(t) * 14;
      camera.position.z = Math.cos(t) * 14;
      camera.position.y = 5;
      camera.lookAt(0, 1.5, 0);
      renderer.render(scene, camera);
    }
    dom.gameContainer.classList.remove('hidden');
    dom.gameContainer.style.opacity = '0.4';
    previewLoop();
  }, 200);

  initJoystick();
  initMobileButtons();
})();
