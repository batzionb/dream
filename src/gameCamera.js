import * as THREE from 'three';

/**
 * Third-person follow camera: orbits around a point above the player.
 * @param {number} width
 * @param {number} height
 * @param {object} [opts]
 */
export function createFollowCamera(width, height, opts = {}) {
  const {
    fov = 60,
    near = 0.1,
    far = 200,
    distance = 12,
    pitch = 0.35,
    yaw = 0,
    targetOffsetY = 0.9,
    minCamYFloor = 1.45,
  } = opts;

  const camera = new THREE.PerspectiveCamera(fov, width / height, near, far);
  camera.name = 'GameCamera';

  const state = {
    yaw,
    pitch,
    distance,
    targetOffsetY,
    minCamYFloor,
  };

  return {
    camera,
    state,
    setAspect(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    /**
     * @param {{ position: THREE.Vector3 }} player
     */
    update(player) {
      const target = player.position.clone().add(new THREE.Vector3(0, state.targetOffsetY, 0));
      const cosP = Math.cos(state.pitch);
      const offset = new THREE.Vector3(
        state.distance * Math.sin(state.yaw) * cosP,
        state.distance * Math.sin(state.pitch),
        state.distance * Math.cos(state.yaw) * cosP
      );
      camera.position.copy(target).add(offset);
      const minCamY = Math.max(state.minCamYFloor, target.y - 2);
      if (camera.position.y < minCamY) {
        camera.position.y = minCamY;
      }
      camera.lookAt(target);
    },
  };
}
