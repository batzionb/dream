import * as THREE from 'three';

/** @typedef {'ladybug' | 'renarouge'} CharacterId */

/** @typedef {{ group: THREE.Group, billboard: THREE.Mesh | null, limbs: null }} CharacterModel */

const LADYBUG_TEX_URL = new URL('../assets/ladybug.png', import.meta.url).href;
const RENAROUGE_TEX_URL = new URL('../assets/renarouge.png', import.meta.url).href;

export const SPRITE_HEIGHT = 1.68;

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
  if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 160 && r < 250 && a > 128) return true;
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
 * @param {HTMLCanvasElement} canvas
 * @returns {HTMLCanvasElement}
 */
function cropCanvasToOpaque(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }

  if (x1 <= x0 || y1 <= y0) return canvas;

  const pad = 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')?.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return out;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {THREE.CanvasTexture}
 */
function textureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * @param {THREE.Group} group
 * @param {THREE.Texture} map
 * @param {number} aspect width / height
 * @param {number} [feetOffset] shift sprite down so feet align with collider bottom
 * @returns {THREE.Mesh}
 */
function addSpriteBillboard(group, map, aspect, feetOffset = 0) {
  const width = SPRITE_HEIGHT * aspect;
  const geo = new THREE.PlaneGeometry(width, SPRITE_HEIGHT);
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(geo, mat);
  plane.position.y = feetOffset;
  group.add(plane);
  return plane;
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} start
 * @param {string} url
 * @param {string} groupName
 * @param {number} [feetOffset]
 * @returns {CharacterModel}
 */
function createSpriteCharacter(scene, start, url, groupName, feetOffset = 0) {
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

      let canvas = canvasFromSpriteImage(img);
      canvas = cropCanvasToOpaque(canvas);
      const map = textureFromCanvas(canvas);
      const aspect = canvas.width / canvas.height;
      addSpriteBillboard(group, map, aspect, feetOffset);
    },
    undefined,
    (err) => console.error('Failed to load character sprite:', url, err)
  );

  return { group, billboard: null, limbs: null };
}

/** @returns {CharacterModel} */
export function createLadybugModel(scene, start) {
  return createSpriteCharacter(scene, start, LADYBUG_TEX_URL, 'Ladybug', 0);
}

/** @returns {CharacterModel} */
export function createRenaRougeModel(scene, start) {
  return createSpriteCharacter(scene, start, RENAROUGE_TEX_URL, 'RenaRouge', 0);
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} start
 * @param {CharacterId} id
 * @returns {CharacterModel}
 */
export function createCharacterModel(scene, start, id) {
  return id === 'renarouge'
    ? createRenaRougeModel(scene, start)
    : createLadybugModel(scene, start);
}

/** Billboard sprites — no skeletal limb animation. */
export function animateCharacterLimbs() {}

/**
 * Face the camera so the artwork reads like the reference render.
 * @param {THREE.Group} group
 * @param {THREE.Vector3} position
 * @param {THREE.Camera} camera
 */
export function faceCharacterToCamera(group, position, camera) {
  const dx = camera.position.x - position.x;
  const dz = camera.position.z - position.z;
  group.rotation.set(0, Math.atan2(dx, dz), 0);
}
