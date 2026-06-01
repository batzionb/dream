import * as THREE from 'three';

/** @typedef {'ladybug' | 'renarouge'} CharacterId */

const PARIS_IMAGE = new URL('../assets/paris.jpg', import.meta.url).href;
const TRAIN_STATION_IMAGE = new URL('../assets/train-station.jpg', import.meta.url).href;

/** @type {THREE.Texture | null} */
let activeTexture = null;

const BACKGROUNDS = {
  ladybug: {
    url: TRAIN_STATION_IMAGE,
    fogColor: 0xb8bcc4,
    fogNear: 30,
    fogFar: 95,
    fallback: 0x9aa3ad,
  },
  renarouge: {
    url: PARIS_IMAGE,
    fogColor: 0xc8d4e0,
    fogNear: 32,
    fogFar: 98,
    fallback: 0x87ceeb,
  },
};

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {string} url
 * @returns {Promise<THREE.Texture>}
 */
function loadBackgroundTexture(renderer, url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        resolve(texture);
      },
      undefined,
      reject
    );
  });
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {CharacterId} characterId
 */
export async function applySceneBackground(scene, renderer, characterId) {
  const id = characterId === 'renarouge' ? 'renarouge' : 'ladybug';
  const cfg = BACKGROUNDS[id];

  try {
    const texture = await loadBackgroundTexture(renderer, cfg.url);
    if (activeTexture && activeTexture !== texture) {
      activeTexture.dispose();
    }
    activeTexture = texture;
    scene.background = texture;
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);
  } catch (err) {
    console.warn(`Could not load ${id} background. Using fallback sky.`, err);
    scene.background = new THREE.Color(cfg.fallback);
    scene.fog = new THREE.Fog(cfg.fallback, cfg.fogNear, cfg.fogFar);
  }
}
