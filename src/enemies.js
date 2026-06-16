import * as THREE from 'three';
import { PLAYER_HALF } from './player.js';

const SAPOTI_TEX_URL = new URL('../assets/sapoti.png', import.meta.url).href;

function textureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * Remove solid/white background connected to image edges (won't eat interior whites).
 * @param {HTMLImageElement | ImageBitmap} img
 * @param {number} [minChannel=236] treat as background if R,G,B are all above this
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

const SAPOTI_SPRITE_H = 0.78;

/**
 * @param {number} px
 * @param {number} pz
 * @param {THREE.Vector3} center
 * @param {{ x: number, z: number }} half
 * @param {number} [pad=0]
 */
function horizontalDistSq(px, pz, center, half, pad = 0) {
  const reach = PLAYER_HALF.x + half.x + pad;
  const dx = px - center.x;
  const dz = pz - center.z;
  return { distSq: dx * dx + dz * dz, reach };
}

/**
 * @param {import('./player.js').Player} player
 * @param {THREE.Vector3} center
 * @param {{ x: number, y: number, z: number }} half
 */
function isPlayerStompingSapoti(player, center, half) {
  const { distSq, reach } = horizontalDistSq(
    player.position.x,
    player.position.z,
    center,
    half,
    0.12
  );
  if (distSq > reach * reach) return false;

  const feetY = player.position.y - PLAYER_HALF.y;
  const enemyTop = center.y + half.y;
  return (
    player.velocity.y <= 0.35 &&
    feetY >= enemyTop - 0.2 &&
    feetY <= enemyTop + 0.42
  );
}

/**
 * @param {import('./player.js').Player} player
 * @param {THREE.Vector3} center
 * @param {{ x: number, y: number, z: number }} half
 */
function sapotiCanStealNecklace(player, center, half) {
  if (!player.hasNecklace) return false;

  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;

  // Tight core overlap — grazing edge contact does not count.
  const stealPlayerX = PLAYER_HALF.x * 0.42;
  const stealPlayerZ = PLAYER_HALF.z * 0.42;
  const stealSapotiX = half.x * 0.48;
  const stealSapotiZ = half.z * 0.48;

  const dx = Math.abs(px - center.x);
  const dz = Math.abs(pz - center.z);
  const overlapX = stealPlayerX + stealSapotiX - dx;
  const overlapZ = stealPlayerZ + stealSapotiZ - dz;
  if (overlapX <= 0 || overlapZ <= 0) return false;
  if (overlapX < 0.16 || overlapZ < 0.14) return false;

  const playerFeet = py - PLAYER_HALF.y;
  const sapotiFeet = center.y - half.y;
  if (Math.abs(sapotiFeet - playerFeet) > 0.28) return false;

  const sapotiMin = center.y - half.y;
  const sapotiTop = center.y + half.y;
  const grabMin = playerFeet + 0.58;
  const grabMax = playerFeet + 1.12;
  if (sapotiTop < grabMin) return false;
  if (sapotiMin > grabMax) return false;

  return true;
}

/**
 * Ground-level Sapotis under a rooftop (same xz as a box whose floor is above their feet)
 * cannot be stomped from the deck — keep spawns and patrol out of these pockets.
 * @param {number} x
 * @param {number} z
 * @param {number} feetY world Y of Sapoti feet (center.y - half.y)
 * @param {Array<{ min: { x: number, y: number, z: number }, max: { x: number, y: number, z: number } }>} colliders
 */
function sapotiFeetUnderLowOverhang(x, z, feetY, colliders) {
  for (const c of colliders) {
    if (x <= c.min.x || x >= c.max.x || z <= c.min.z || z >= c.max.z) continue;
    if (c.min.y > feetY + 0.02 && c.min.y > 0.08) return true;
  }
  return false;
}

/**
 * Nudge xz until feet are not under an inaccessible overhang (keeps y / patrol params).
 * @param {{ x: number, y: number, z: number, r: number, spd: number }} s
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }>} colliders
 */
function resolveSapotiSpot(s, colliders) {
  const feetY = s.feetY;
  if (!sapotiFeetUnderLowOverhang(s.x, s.z, feetY, colliders)) return s;

  const step = 0.45;
  const rings = 10;
  for (let ring = 1; ring <= rings; ring++) {
    for (let dz = -ring; dz <= ring; dz++) {
      for (const dx of [-ring, ring]) {
        const x = s.x + dx * step;
        const z = s.z + dz * step;
        if (!sapotiFeetUnderLowOverhang(x, z, feetY, colliders)) {
          return { ...s, x, z };
        }
      }
      for (let dx = -ring + 1; dx <= ring - 1; dx++) {
        for (const dz of [-ring, ring]) {
          const x = s.x + dx * step;
          const z = s.z + dz * step;
          if (!sapotiFeetUnderLowOverhang(x, z, feetY, colliders)) {
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
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }> | null} [colliders] level boxes; when set, homes are kept out from under roof overhangs at ground level.
 * @returns {Promise<Array<{ mesh: THREE.Group, alive: boolean, home: THREE.Vector3, patrolRadius: number, patrolSpeed: number, phase: number, center: THREE.Vector3, half: { x: number, y: number, z: number } }>>}
 */
export function spawnRobots(scene, colliders = null) {
  const spots = [
    { x: 3.0, feetY: 0, z: -2.1, r: 1.0, spd: 1.1 },
    { x: -2.8, feetY: 0, z: -1.2, r: 0.95, spd: 0.9 },
    { x: -3.5, feetY: 0, z: -2.4, r: 0.85, spd: 1.2 },
    { x: 1.2, feetY: 1.05, z: -6, r: 0.55, spd: 1.0 },
    { x: 4.2, feetY: 1.9, z: -11, r: 0.55, spd: 1.15 },
    { x: 0.2, feetY: 2.73, z: -16, r: 0.5, spd: 0.95 },
    { x: -3.8, feetY: 3.61, z: -20, r: 0.45, spd: 1.0 },
    { x: 11, feetY: 0, z: 1.5, r: 1.0, spd: 0.85 },
  ];

  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      SAPOTI_TEX_URL,
      (tex) => {
        const img = tex.image;
        tex.dispose();
        const canvas = canvasFromImageKeyWhiteFlood(img);
        const map = textureFromCanvas(canvas);

        const aspect = img.width / img.height;
        const height = SAPOTI_SPRITE_H;
        const width = height * aspect;
        const half = { x: width * 0.46, y: height * 0.5, z: 0.24 };
        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          alphaTest: 0.03,
          side: THREE.DoubleSide,
          depthWrite: true,
        });

        const robots = [];
        for (const s0 of spots) {
          const s = colliders ? resolveSapotiSpot(s0, colliders) : s0;
          const centerY = s.feetY + height / 2;
          const group = new THREE.Group();
          group.name = 'Sapoti';
          const plane = new THREE.Mesh(geo, mat);
          plane.position.y = height / 2;
          group.add(plane);
          group.position.set(s.x, s.feetY, s.z);
          scene.add(group);

          const home = new THREE.Vector3(s.x, centerY, s.z);
          robots.push({
            mesh: group,
            alive: true,
            home,
            patrolRadius: s.r,
            patrolSpeed: s.spd,
            phase: Math.random() * Math.PI * 2,
            center: home.clone(),
            half,
          });
        }
        resolve(robots);
      },
      undefined,
      (err) => {
        console.error('Failed to load Sapoti texture:', SAPOTI_TEX_URL, err);
        reject(err);
      }
    );
  });
}

/**
 * @param {number} dt
 * @param {Awaited<ReturnType<typeof spawnRobots>>} robots
 * @param {import('./player.js').Player} player
 * @param {THREE.Camera} camera
 * @param {Array<{ min: { x, y, z }, max: { x, y, z } }> | null} [colliders]
 * @returns {boolean} true if a Sapoti stole the player's necklace this frame
 */
export function tickRobots(dt, robots, player, camera, colliders = null) {
  let necklaceStolen = false;

  for (const r of robots) {
    if (!r.alive) continue;

    r.phase += dt * r.patrolSpeed;
    const ox = Math.sin(r.phase) * r.patrolRadius;
    const oz = Math.cos(r.phase * 0.73) * r.patrolRadius * 0.65;
    const sapotiFeetY = r.home.y - r.half.y;
    let nx = r.home.x + ox;
    let nz = r.home.z + oz;
    if (colliders && sapotiFeetUnderLowOverhang(nx, nz, sapotiFeetY, colliders)) {
      nx = r.home.x;
      nz = r.home.z;
    }
    r.mesh.position.set(nx, sapotiFeetY, nz);
    r.center.set(nx, r.home.y, nz);

    const dx = camera.position.x - r.center.x;
    const dz = camera.position.z - r.center.z;
    r.mesh.rotation.y = Math.atan2(dx, dz);

    if (isPlayerStompingSapoti(player, r.center, r.half)) {
      const enemyTop = r.center.y + r.half.y;
      r.alive = false;
      r.mesh.visible = false;
      player.velocity.y = 6.2;
      player.position.y = enemyTop + PLAYER_HALF.y + 0.03;
    } else if (sapotiCanStealNecklace(player, r.center, r.half)) {
      player.loseNecklace();
      necklaceStolen = true;
    }
  }

  return necklaceStolen;
}

export function resetRobots(robots) {
  for (const r of robots) {
    r.alive = true;
    r.mesh.visible = true;
    r.phase = Math.random() * Math.PI * 2;
    const feetY = r.home.y - r.half.y;
    r.mesh.position.set(r.home.x, feetY, r.home.z);
    r.center.copy(r.home);
  }
}

export function livingRobotCount(robots) {
  return robots.reduce((n, r) => n + (r.alive ? 1 : 0), 0);
}
