import * as THREE from 'three';

/** Wide Paris / Eiffel view (Unsplash, hotlink-friendly for demos). */
const PARIS_IMAGE =
  'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=2400&q=85';

/**
 * Replaces the solid sky with a photographic Paris backdrop.
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyParisBackground(scene, renderer) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

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
      console.warn('Could not load Paris background (network/CORS). Using default sky.');
    }
  );
}
