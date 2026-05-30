import * as THREE from 'three';

export const PLAYER_HALF = { x: 0.4, y: 0.8, z: 0.4 };

/** @typedef {'ladybug' | 'renarouge'} CharacterId */

/** Resolved at runtime so the texture loads from the same origin as this module. */
const LADYBUG_TEX_URL = new URL('../assets/ladybug.png', import.meta.url).href;
const RENAROUGE_TEX_URL = new URL('../assets/renarouge.png', import.meta.url).href;

function playerAabb(center) {
  return {
    min: {
      x: center.x - PLAYER_HALF.x,
      y: center.y - PLAYER_HALF.y,
      z: center.z - PLAYER_HALF.z,
    },
    max: {
      x: center.x + PLAYER_HALF.x,
      y: center.y + PLAYER_HALF.y,
      z: center.z + PLAYER_HALF.z,
    },
  };
}

function aabbOverlap(a, b) {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

/**
 * Replace near-black pixels with transparency so a solid black backdrop works as a cutout.
 * @param {HTMLImageElement | ImageBitmap} img
 * @returns {HTMLCanvasElement}
 */
function canvasFromImageKeyBlack(img) {
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
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    if (r < 32 && g < 32 && b < 32) {
      p[i + 3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Key out background using colors sampled from the image edge (checkerboard, gray studio, etc.).
 * @param {HTMLImageElement | ImageBitmap} img
 * @param {number} [tolerance=52] RGB distance 0–441
 * @returns {HTMLCanvasElement}
 */
function canvasFromImageKeyBorderBackground(img, tolerance = 52) {
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

  const step = Math.max(1, Math.min(6, Math.floor(Math.max(w, h) / 120)));
  /** @type {number[][]} */
  const palette = [];

  function pushPalette(r, g, b) {
    for (let j = 0; j < palette.length; j++) {
      const c = palette[j];
      if (Math.hypot(r - c[0], g - c[1], b - c[2]) < 26) return;
    }
    if (palette.length < 150) {
      palette.push([r, g, b]);
    }
  }

  function sampleEdge(x, y) {
    const xi = Math.min(w - 1, Math.max(0, x));
    const yi = Math.min(h - 1, Math.max(0, y));
    const idx = (yi * w + xi) * 4;
    pushPalette(p[idx], p[idx + 1], p[idx + 2]);
  }

  for (let x = 0; x < w; x += step) {
    sampleEdge(x, 0);
    sampleEdge(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    sampleEdge(0, y);
    sampleEdge(w - 1, y);
  }

  if (palette.length === 0) {
    return canvas;
  }

  for (let i = 0; i < p.length; i += 4) {
    const r = p[i];
    const g = p[i + 1];
    const b = p[i + 2];
    if (p[i + 3] < 8) continue;

    let minD = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const c = palette[k];
      const d = Math.hypot(r - c[0], g - c[1], b - c[2]);
      if (d < minD) minD = d;
    }
    if (minD < tolerance) {
      p[i + 3] = 0;
    } else if (r < 22 && g < 22 && b < 22) {
      p[i + 3] = 0;
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

function canvasFromImage(img, keyMode) {
  if (keyMode === 'black') return canvasFromImageKeyBlack(img);
  if (keyMode === 'border') return canvasFromImageKeyBorderBackground(img);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  return canvas;
}

function textureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * @param {'black' | 'border' | 'none'} keyMode — how to remove / use background
 */
function createBillboardFromImage(scene, start, url, groupName, keyMode) {
  const group = new THREE.Group();
  group.name = groupName;
  group.position.copy(start);
  scene.add(group);

  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (tex) => {
      const img = tex.image;
      tex.dispose();

      const canvas = canvasFromImage(img, keyMode);
      const map = textureFromCanvas(canvas);
      const aspect = img.width / img.height;
      const height = 1.68;
      const width = height * aspect;
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
      const plane = new THREE.Mesh(geo, mat);
      group.add(plane);
    },
    undefined,
    (err) => console.error('Failed to load texture:', url, err)
  );

  return group;
}

function createLadybugBillboard(scene, start) {
  return createBillboardFromImage(scene, start, LADYBUG_TEX_URL, 'Ladybug', 'black');
}

function createRenaRougeBillboard(scene, start) {
  return createBillboardFromImage(scene, start, RENAROUGE_TEX_URL, 'RenaRouge', 'border');
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} start
 * @param {CharacterId} id
 */
export function createPlayerVisual(scene, start, id) {
  switch (id) {
    case 'renarouge':
      return createRenaRougeBillboard(scene, start);
    case 'ladybug':
    default:
      return createLadybugBillboard(scene, start);
  }
}

export class Player {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Vector3} start
   * @param {CharacterId} [characterId='ladybug']
   */
  constructor(scene, start, characterId = 'ladybug') {
    this.position = new THREE.Vector3(start.x, start.y, start.z);
    this.velocity = new THREE.Vector3();
    this.grounded = false;
    this._camForward = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._moveXZ = new THREE.Vector3();
    this._walkPhase = 0;
    this._walkBlend = 0;

    /** @type {CharacterId} */
    this.characterId = characterId === 'renarouge' ? 'renarouge' : 'ladybug';

    this.mesh = createPlayerVisual(scene, this.position, this.characterId);
  }

  /**
   * @param {number} dt
   * @param {{ isDown: (c: string) => boolean }} input
   * @param {Array<{min: {x,y,z}, max: {x,y,z}}>} colliders
   * @param {number} cameraYaw
   * @param {THREE.Camera} camera — billboard Y-rotation faces this camera.
   */
  update(dt, input, colliders, cameraYaw, camera) {
    const moveSpeed = 9;
    const jumpVel = 11;
    const gravity = -32;

    let wishForward = 0;
    let wishStrafe = 0;
    if (input.isDown('ArrowUp')) wishForward += 1;
    if (input.isDown('ArrowDown')) wishForward -= 1;
    if (input.isDown('ArrowRight')) wishStrafe += 1;
    if (input.isDown('ArrowLeft')) wishStrafe -= 1;

    const sy = Math.sin(cameraYaw);
    const cy = Math.cos(cameraYaw);
    this._camForward.set(-sy, 0, -cy);
    this._camRight.set(cy, 0, -sy);

    this._moveXZ
      .set(0, 0, 0)
      .addScaledVector(this._camForward, wishForward)
      .addScaledVector(this._camRight, wishStrafe);
    if (this._moveXZ.lengthSq() > 1e-6) {
      this._moveXZ.normalize();
    }

    this.velocity.x = this._moveXZ.x * moveSpeed;
    this.velocity.z = this._moveXZ.z * moveSpeed;
    this.velocity.y += gravity * dt;

    if (this.grounded && input.isDown('Space')) {
      this.velocity.y = jumpVel;
      this.grounded = false;
    }

    this.grounded = false;

    this.position.x += this.velocity.x * dt;
    this.resolveAxis('x', colliders);

    this.position.z += this.velocity.z * dt;
    this.resolveAxis('z', colliders);

    this.position.y += this.velocity.y * dt;
    this.resolveAxisY(colliders);

    const spdXZ = Math.hypot(this.velocity.x, this.velocity.z);
    const wannaWalk = this.grounded && spdXZ > 0.45;
    const walkTarget = wannaWalk ? 1 : 0;
    this._walkBlend = THREE.MathUtils.lerp(this._walkBlend, walkTarget, 1 - Math.exp(-dt * 9));

    if (this._walkBlend > 0.01) {
      this._walkPhase += dt * spdXZ * 2.8 + dt * (wannaWalk ? 2.4 : 0);
    }

    const w = this._walkBlend;
    const t = this._walkPhase * 2;
    const bob = Math.sin(t) * 0.058 * w;
    const swayZ = Math.sin(t + 0.6) * 0.072 * w;
    const nodX = Math.cos(t) * 0.05 * w;

    this.mesh.position.set(this.position.x, this.position.y + bob, this.position.z);

    const dx = camera.position.x - this.position.x;
    const dz = camera.position.z - this.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.mesh.rotation.x = nodX;
    this.mesh.rotation.z = swayZ;
  }

  resolveAxis(axis, colliders) {
    const p = playerAabb(this.position);
    for (const c of colliders) {
      if (!aabbOverlap(p, c)) continue;

      if (axis === 'x') {
        if (this.velocity.x >= 0) {
          this.position.x = c.min.x - PLAYER_HALF.x - 1e-4;
        } else {
          this.position.x = c.max.x + PLAYER_HALF.x + 1e-4;
        }
        this.velocity.x = 0;
      } else if (axis === 'z') {
        if (this.velocity.z >= 0) {
          this.position.z = c.min.z - PLAYER_HALF.z - 1e-4;
        } else {
          this.position.z = c.max.z + PLAYER_HALF.z + 1e-4;
        }
        this.velocity.z = 0;
      }
      Object.assign(p, playerAabb(this.position));
    }
  }

  resolveAxisY(colliders) {
    const p = playerAabb(this.position);
    for (const c of colliders) {
      if (!aabbOverlap(p, c)) continue;

      if (this.velocity.y >= 0) {
        this.position.y = c.min.y - PLAYER_HALF.y - 1e-4;
        this.velocity.y = 0;
      } else {
        this.position.y = c.max.y + PLAYER_HALF.y + 1e-4;
        this.velocity.y = 0;
        this.grounded = true;
      }
      Object.assign(p, playerAabb(this.position));
    }
  }

  /** True when grounded on the marked goal platform. */
  isOnGoal(colliders) {
    const goal = colliders.find((c) => c.isGoal);
    if (!goal || !this.grounded) return false;
    const feetY = this.position.y - PLAYER_HALF.y;
    if (feetY < goal.max.y - 0.08 || feetY > goal.max.y + 0.25) return false;
    const { x: cx, z: cz } = this.position;
    const pad = 0.2;
    return (
      cx >= goal.min.x + pad &&
      cx <= goal.max.x - pad &&
      cz >= goal.min.z + pad &&
      cz <= goal.max.z - pad
    );
  }
}
