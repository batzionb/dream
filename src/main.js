import * as THREE from 'three';
import { createFollowCamera } from './gameCamera.js';
import { createInput } from './input.js';
import { buildLevel, disposeLevel } from './level.js';
import { applySceneBackground } from './sceneBackground.js';
import {
  livingEnemyCount,
  removeEnemies,
  resetEnemies,
  spawnEnemies,
  tickEnemies,
} from './enemies.js';
import { Player } from './player.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 28, 90);

const followCam = createFollowCamera(window.innerWidth, window.innerHeight);
const { camera } = followCam;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

applySceneBackground(scene, renderer, 'ladybug');

const hemi = new THREE.HemisphereLight(0xb1e1ff, 0x3d2f1f, 0.55);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xcad8e8, 0.32);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(18, 32, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

/** @type {Array<{ min: { x, y, z }, max: { x, y, z }, isGoal?: boolean }>} */
let colliders = [];
/** @type {THREE.Group | null} */
let levelRoot = null;

async function loadLevelForCharacter(characterId) {
  if (levelRoot) {
    disposeLevel(levelRoot);
    levelRoot = null;
  }
  const level = buildLevel(scene, characterId);
  levelRoot = level.root;
  colliders = level.colliders;
  await loadEnemiesForCharacter(characterId);
}

const input = createInput();

const hud = document.getElementById('hud');
const mainMenu = document.getElementById('mainMenu');
const HUD_TEMPLATE = hud.innerHTML;

/** @type {Player | null} */
let player = null;
/** @type {import('./enemies.js').EnemyWave['enemies']} */
let enemies = [];
let enemyHudLabel = 'Lady Wifi left';
let enemyStompHint = 'Stomp Lady Wifi from above';
let clock = new THREE.Clock();
let won = false;
let gameStarted = false;

hud.style.visibility = 'hidden';

const camState = followCam.state;

const canvas = renderer.domElement;
canvas.addEventListener('click', () => {
  if (!gameStarted) return;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('mousemove', (e) => {
  if (!gameStarted || document.pointerLockElement !== canvas) return;
  camState.yaw -= e.movementX * 0.0022;
  camState.pitch = THREE.MathUtils.clamp(
    camState.pitch - e.movementY * 0.0022,
    0.12,
    1.35
  );
});

function resize() {
  followCam.setAspect(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

function applyMenuCamera() {
  camera.position.set(24, 16, 26);
  camera.lookAt(1, 4.5, -9);
}

function updateCombatHud() {
  const el = document.getElementById('combatHud');
  if (!el) return;
  const left = livingEnemyCount(enemies);
  el.textContent = `${enemyHudLabel}: ${left}`;
}

function updateStompHint() {
  const strong = hud.querySelector('strong');
  if (strong) strong.textContent = enemyStompHint;
}

function tryRemoveOldPlayer() {
  if (!player) return;
  scene.remove(player.mesh);
  player.mesh.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
  player = null;
}

async function loadEnemiesForCharacter(characterId) {
  removeEnemies(scene, enemies);
  try {
    const wave = await spawnEnemies(scene, colliders, characterId);
    enemies = wave.enemies;
    enemyHudLabel = wave.hudLabel;
    enemyStompHint = wave.stompHint;
  } catch (err) {
    console.error('Failed to spawn enemies:', err);
    enemies = [];
  }
  updateCombatHud();
  updateStompHint();
}

let selectedCharacter = 'ladybug';

document.querySelectorAll('.char-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.char-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    const id = card.dataset.character;
    if (id === 'ladybug' || id === 'renarouge') {
      selectedCharacter = id;
      applySceneBackground(scene, renderer, id);
      if (!gameStarted) {
        void loadLevelForCharacter(id);
      }
    }
  });
});

document.getElementById('menuStart')?.addEventListener('click', async () => {
  tryRemoveOldPlayer();
  await loadLevelForCharacter(selectedCharacter);
  resetEnemies(enemies);
  won = false;
  clock = new THREE.Clock();
  player = new Player(scene, new THREE.Vector3(0, 0.8, 0), selectedCharacter);
  applySceneBackground(scene, renderer, selectedCharacter);
  gameStarted = true;
  hud.innerHTML = HUD_TEMPLATE;
  hud.style.visibility = 'visible';
  updateStompHint();
  updateCombatHud();
  mainMenu?.classList.add('main-menu--hidden');
  if (document.exitPointerLock) document.exitPointerLock();
});

await loadLevelForCharacter('ladybug');

function tick() {
  const dt = Math.min(clock.getDelta(), 0.083);

  if (!gameStarted) {
    applyMenuCamera();
  } else if (player && !won) {
    player.update(dt, input, colliders, camState.yaw, camera);
    tickEnemies(dt, enemies, player, camera, colliders);
    updateCombatHud();

    if (player.isOnGoal(colliders)) {
      won = true;
      hud.innerHTML =
        '<strong>You reached the goal!</strong><br />Refresh the page to play again.';
      if (document.exitPointerLock) document.exitPointerLock();
    }
    followCam.update(player);
  } else if (player) {
    followCam.update(player);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
