import * as THREE from 'three';
import { PLAYER_HALF } from './player.js';

/** @typedef {'ladybug' | 'renarouge'} CharacterId */

const SAPOTI_TEX_URL = new URL('../assets/sapoti.png', import.meta.url).href;
const LADYWIFI_TEX_URL = new URL('../assets/ladywifi.png', import.meta.url).href;

/** @typedef {{ mesh: THREE.Group, alive: boolean, home: THREE.Vector3, patrolRadius: number, patrolSpeed: number, phase: number, center: THREE.Vector3, half: { x: number, y: number, z: number } }} Enemy */

/** @typedef {{ enemies: Enemy[], hudLabel: string, stompHint: string }} EnemyWave */

const PATROL_SPOTS = [
  { x: 3.0, y: 0.32, z: -2.1, r: 1.0, spd: 1.1 },
  { x: -2.8, y: 0.32, z: -1.2, r: 0.95, spd: 0.9 },
  { x: -3.5, y: 0.32, z: -2.4, r: 0.85, spd: 1.2 },
  { x: 1.2, y: 1.37, z: -6, r: 0.55, spd: 1.0 },
  { x: 4.2, y: 2.22, z: -11, r: 0.55, spd: 1.15 },
  { x: 0.2, y: 3.05, z: -16, r: 0.5, spd: 0.95 },
  { x: -3.8, y: 3.93, z: -20, r: 0.45, spd: 1.0 },
  { x: 11, y: 0.32, z: 1.5, r: 1.0, spd: 0.85 },
];

const LADYWIFI_SPOTS = [{ x: 0, y: 1.03, z: -2, r: 0.5, spd: 1.05 }];

/** @type {Record<CharacterId, { texUrl: string, meshName: string, spriteHeight: number, half: { x: number, y: number, z: number }, hudLabel: string, stompHint: string, spots: typeof PATROL_SPOTS, keyWhite: boolean }>} */
const ENEMY_TYPES = {
  ladybug: {
    texUrl: LADYWIFI_TEX_URL,
    meshName: 'LadyWifi',
    spriteHeight: 1.36,
    half: { x: 0.28, y: 0.68, z: 0.22 },
    hudLabel: 'Lady Wifi left',
    stompHint: 'Stomp Lady Wifi from above',
    spots: LADYWIFI_SPOTS,
    keyWhite: false,
  },
  renarouge: {
    texUrl: SAPOTI_TEX_URL,
    meshName: 'Sapoti',
    spriteHeight: 0.78,
    half: { x: 0.22, y: 0.32, z: 0.18 },
    hudLabel: 'Sapotis left',
    stompHint: 'Stomp Sapotis from above',
    spots: PATROL_SPOTS,
    keyWhite: true,
  },
};

function textureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * @param {number} i4
 * @param {Uint8ClampedArray} p
 */
function isBackgroundPixel(i4, p) {
  const r = p[i4];
  const g = p[i4 + 1];
  const b = p[i4 + 2];
  const a = p[i4 + 3];
  if (a < 8) return true;
  if (r < 40 && g < 40 && b < 40) return true;
  if (a < 64 && r < 48 && g < 48 && b < 48) return true;
  if (r > 236 && g > 236 && b > 236) return true;
  return false;
}

/**
 * @param {HTMLImageElement | ImageBitmap} img
 * @returns {HTMLCanvasElement}
 */
function canvasFromSpriteImage(img) {
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  const n = w * h;
  const transparent = new Uint8Array(n);
  const visited = new Uint8Array(n);
  /** @type {number[]} */
  const q = [];

  function idxAt(x, y) {
    return y * w + x;
  }

  function enqueue(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const id = idxAt(x, y);
    if (visited[id]) return;
    const i4 = id * 4;
    if (!isBackgroundPixel(i4, p)) return;
    visited[id] = 1;
    transparent[id] = 1;
    q.push(x, y);
  }

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  while (q.length) {
    const y = q.pop();
    const x = q.pop();
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let id = 0; id < n; id++) {
    const i4 = id * 4;
    if (transparent[id] || isBackgroundPixel(i4, p)) {
      p[i4] = 0;
      p[i4 + 1] = 0;
      p[i4 + 2] = 0;
      p[i4 + 3] = 0;
    } else if (p[i4 + 3] < 8) {
      p[i4] = 0;
      p[i4 + 1] = 0;
      p[i4 + 2] = 0;
      p[i4 + 3] = 0;
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * @param {HTMLImageElement | ImageBitmap} img
 * @param {number} [minChannel=236]
 */
function canvasFromImageKeyWhiteFlood(img, minChannel = 236) {
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  const n = w * h;
  const transparent = new Uint8Array(n);
  const visited = new Uint8Array(n);
  /** @type {number[]} */
  const q = [];

  function idxAt(x, y) {
    return y * w + x;
  }

  function isBgLike(i4) {
    const r = p[i4];
    const g = p[i4 + 1];
    const b = p[i4 + 2];
    return r >= minChannel && g >= minChannel && b >= minChannel;
  }

  function enqueue(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const id = idxAt(x, y);
    if (visited[id]) return;
    const i4 = id * 4;
    if (!isBgLike(i4)) return;
    visited[id] = 1;
    transparent[id] = 1;
    q.push(x, y);
  }

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  while (q.length) {
    const y = q.pop();
    const x = q.pop();
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  for (let id = 0; id < n; id++) {
    if (transparent[id]) {
      p[id * 4 + 3] = 0;
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

function aabbOverlapPlayer(center, half, px, py, pz) {
  const pMin = { x: px - PLAYER_HALF.x, y: py - PLAYER_HALF.y, z: pz - PLAYER_HALF.z };
  const pMax = { x: px + PLAYER_HALF.x, y: py + PLAYER_HALF.y, z: pz + PLAYER_HALF.z };
  const rMin = { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z };
  const rMax = { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z };
  return (
    pMin.x < rMax.x &&
    pMax.x > rMin.x &&
    pMin.y < rMax.y &&
    pMax.y > rMin.y &&
    pMin.z < rMax.z &&
    pMax.z > rMin.z
  );
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} feetY
 * @param {{ x: number, y: number, z: number }} half
 * @param {Array<{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }>} colliders
 */
function feetUnderLowOverhang(x, z, feetY, half, colliders) {
  for (const c of colliders) {
    if (x <= c.min.x || x >= c.max.x || z <= c.min.z || z >= c.max.z) continue;
    if (c.min.y > feetY + 0.02 && c.min.y > 0.08) return true;
  }
  return false;
}

/**
 * @param {{ x: number, y: number, z: number, r: number, spd: number }} s
 * @param {{ x: number, y: number, z: number }} half
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }>} colliders
 */
function resolveEnemySpot(s, half, colliders) {
  const feetY = s.y - half.y;
  if (!feetUnderLowOverhang(s.x, s.z, feetY, half, colliders)) return s;

  const step = 0.45;
  const rings = 10;
  for (let ring = 1; ring <= rings; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (const dx of [-ring, ring]) {
        const x = s.x + dx * step;
        const z = s.z + dz * step;
        if (!feetUnderLowOverhang(x, z, feetY, half, colliders)) {
          return { ...s, x, z };
        }
      }
      for (let dx = -ring + 1; dx <= ring - 1; dx++) {
        for (const dz of [-ring, ring]) {
          const x = s.x + dx * step;
          const z = s.z + dz * step;
          if (!feetUnderLowOverhang(x, z, feetY, half, colliders)) {
            return { ...s, x, z };
          }
        }
      }
    }
  }
  return { ...s, x: s.x, z: -1.8 };
}

/**
 * @param {THREE.Scene} scene
 * @param {Enemy[]} enemies
 */
export function removeEnemies(scene, enemies) {
  for (const r of enemies) {
    scene.remove(r.mesh);
    r.mesh.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
  }
}

/**
 * @param {THREE.Scene} scene
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }> | null} [colliders]
 * @param {CharacterId} [characterId='renarouge']
 * @returns {Promise<EnemyWave>}
 */
export function spawnEnemies(scene, colliders = null, characterId = 'renarouge') {
  const id = characterId === 'ladybug' ? 'ladybug' : 'renarouge';
  const cfg = ENEMY_TYPES[id];

  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      cfg.texUrl,
      (tex) => {
        const img = tex.image;
        tex.dispose();

        const canvas = cfg.keyWhite
          ? canvasFromImageKeyWhiteFlood(img)
          : canvasFromSpriteImage(img);
        const map = textureFromCanvas(canvas);

        const aspect = img.width / img.height;
        const width = cfg.spriteHeight * aspect;
        const geo = new THREE.PlaneGeometry(width, cfg.spriteHeight);
        const mat = new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          alphaTest: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        /** @type {Enemy[]} */
        const enemies = [];
        for (const s0 of cfg.spots) {
          const s = colliders ? resolveEnemySpot(s0, cfg.half, colliders) : s0;
          const group = new THREE.Group();
          group.name = cfg.meshName;
          const plane = new THREE.Mesh(geo, mat);
          group.add(plane);
          group.position.set(s.x, s.y, s.z);
          scene.add(group);

          enemies.push({
            mesh: group,
            alive: true,
            home: new THREE.Vector3(s.x, s.y, s.z),
            patrolRadius: s.r,
            patrolSpeed: s.spd,
            phase: Math.random() * Math.PI * 2,
            center: new THREE.Vector3(s.x, s.y, s.z),
            half: cfg.half,
          });
        }

        resolve({
          enemies,
          hudLabel: cfg.hudLabel,
          stompHint: cfg.stompHint,
        });
      },
      undefined,
      (err) => {
        console.error(`Failed to load ${cfg.meshName} texture:`, cfg.texUrl, err);
        reject(err);
      }
    );
  });
}

/** @deprecated use spawnEnemies */
export function spawnRobots(scene, colliders = null) {
  return spawnEnemies(scene, colliders, 'renarouge').then((w) => w.enemies);
}

/**
 * @param {number} dt
 * @param {Enemy[]} enemies
 * @param {import('./player.js').Player} player
 * @param {THREE.Camera} camera
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }> | null} [colliders]
 */
export function tickEnemies(dt, enemies, player, camera, colliders = null) {
  for (const r of enemies) {
    if (!r.alive) continue;

    r.phase += dt * r.patrolSpeed;
    const ox = Math.sin(r.phase) * r.patrolRadius;
    const oz = Math.cos(r.phase * 0.73) * r.patrolRadius * 0.65;
    const feetY = r.home.y - r.half.y;
    let nx = r.home.x + ox;
    let nz = r.home.z + oz;
    if (colliders && feetUnderLowOverhang(nx, nz, feetY, r.half, colliders)) {
      nx = r.home.x;
      nz = r.home.z;
    }
    r.mesh.position.set(nx, r.home.y, nz);
    r.center.copy(r.mesh.position);

    const dx = camera.position.x - r.center.x;
    const dz = camera.position.z - r.center.z;
    r.mesh.rotation.y = Math.atan2(dx, dz);

    const px = player.position.x;
    const py = player.position.y;
    const pz = player.position.z;

    if (!aabbOverlapPlayer(r.center, r.half, px, py, pz)) continue;

    const playerFeetY = py - PLAYER_HALF.y;
    const enemyTop = r.center.y + r.half.y;
    const stomp =
      player.velocity.y <= 0.35 &&
      playerFeetY >= enemyTop - 0.2 &&
      playerFeetY <= enemyTop + 0.42;

    if (stomp) {
      r.alive = false;
      r.mesh.visible = false;
      player.velocity.y = 6.2;
      player.position.y = enemyTop + PLAYER_HALF.y + 0.03;
    }
  }
}

/** @deprecated use tickEnemies */
export function tickRobots(dt, robots, player, camera, colliders = null) {
  tickEnemies(dt, robots, player, camera, colliders);
}

export function resetEnemies(enemies) {
  for (const r of enemies) {
    r.alive = true;
    r.mesh.visible = true;
    r.phase = Math.random() * Math.PI * 2;
    r.mesh.position.copy(r.home);
    r.center.copy(r.home);
  }
}

/** @deprecated use resetEnemies */
export function resetRobots(robots) {
  resetEnemies(robots);
}

export function livingEnemyCount(enemies) {
  return enemies.reduce((n, r) => n + (r.alive ? 1 : 0), 0);
}

/** @deprecated use livingEnemyCount */
export function livingRobotCount(robots) {
  return livingEnemyCount(robots);
}
