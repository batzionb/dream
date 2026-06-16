import * as THREE from 'three';
import { createFollowCamera } from './gameCamera.js';
import { createInput } from './input.js';
import { buildLevel } from './level.js';
import { applyParisBackground } from './parisBackground.js';
import { livingRobotCount, resetRobots, spawnRobots, tickRobots } from './enemies.js';
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

applyParisBackground(scene, renderer);

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

const { colliders } = buildLevel(scene);
const robots = await spawnRobots(scene, colliders).catch((err) => {
  console.error('Failed to load Sapotis', err);
  return [];
});
const input = createInput();

const hud = document.getElementById('hud');
const mainMenu = document.getElementById('mainMenu');
const HUD_TEMPLATE = hud.innerHTML;

/** @type {Player | null} */
let player = null;
let clock = new THREE.Clock();
let won = false;
let lost = false;
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
  if (!el || !player) return;
  const left = livingRobotCount(robots);
  el.textContent = `Sapotis left: ${left}`;
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

let selectedCharacter = 'ladybug';

document.querySelectorAll('.char-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.char-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    const id = card.dataset.character;
    if (id === 'ladybug' || id === 'renarouge') {
      selectedCharacter = id;
    }
  });
});

document.getElementById('menuStart')?.addEventListener('click', () => {
  tryRemoveOldPlayer();
  resetRobots(robots);
  won = false;
  lost = false;
  clock = new THREE.Clock();
  player = new Player(scene, new THREE.Vector3(0, 0.8, 0), selectedCharacter, colliders);
  gameStarted = true;
  hud.innerHTML = HUD_TEMPLATE;
  hud.style.visibility = 'visible';
  mainMenu?.classList.add('main-menu--hidden');
  if (document.exitPointerLock) document.exitPointerLock();
});

function tick() {
  const dt = Math.min(clock.getDelta(), 0.083);

  if (!gameStarted) {
    applyMenuCamera();
  } else if (player && !won && !lost) {
    player.update(dt, input, colliders, camState.yaw, camera);
    const necklaceStolen = tickRobots(dt, robots, player, camera, colliders);
    updateCombatHud();

    if (necklaceStolen) {
      lost = true;
      hud.innerHTML =
        '<strong>A Sapoti stole the Miraculous!</strong><br />Sapotis win — refresh to play again.';
      if (document.exitPointerLock) document.exitPointerLock();
    } else if (player.isOnGoal(colliders)) {
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
