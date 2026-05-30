import * as THREE from 'three';

/** Local Paris / Eiffel backdrop (served from repo assets). */
const PARIS_IMAGE = new URL('../assets/paris.jpg', import.meta.url).href;

/**
 * Replaces the solid sky with a photographic Paris backdrop.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyParisBackground(scene, renderer) {
  const loader = new THREE.TextureLoader();

  loader.load(
    PARIS_IMAGE,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      scene.background = texture;
      scene.fog = new THREE.Fog(0xc8d4e0, 32, 98);
    },
    undefined,
    () => {
      console.warn('Could not load Paris background image. Using default sky.');
    }
  );
}
