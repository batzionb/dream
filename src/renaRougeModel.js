import * as THREE from 'three';

/** Taller than the old 1.68 sprite billboard. */
export const RENA_MODEL_HEIGHT = 2.35;

/** Matches PLAYER_HALF.y — feet align with the physics collider. */
const FEET_ALIGN_Y = -0.8;

const COLORS = {
  orange: 0xf26a1c,
  orangeDark: 0xd45212,
  orangeSoft: 0xff8a48,
  white: 0xfafafa,
  black: 0x181818,
  hair: 0x9a3f2c,
  hairHi: 0xb8553c,
  skin: 0xf0c4a8,
  lip: 0xd87888,
  eyeWhite: 0xfff8f0,
  eyeAmber: 0xc88818,
  eyeLine: 0x2a1810,
  maskWhite: 0xf5f5f5,
};

function part(geo, color, opts = {}) {
  const {
    metalness = 0.06,
    roughness = 0.55,
    emissive = 0x000000,
    emissiveIntensity = 0,
  } = opts;
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive,
      emissiveIntensity,
    })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addCapsuleY(parent, color, x, y, z, radius, length, opts = {}) {
  const mesh = part(new THREE.CapsuleGeometry(radius, length, 8, 14), color, opts);
  mesh.position.set(x, y + radius + length / 2, z);
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, color, x, y, z, radius, scale = new THREE.Vector3(1, 1, 1), opts = {}) {
  const mesh = part(new THREE.SphereGeometry(radius, 14, 12), color, opts);
  mesh.position.set(x, y, z);
  mesh.scale.copy(scale);
  parent.add(mesh);
  return mesh;
}

/** Soft white hourglass panel on the chest. */
function addWhiteChestPanel(model, s) {
  const panel = new THREE.Group();
  panel.position.set(0, 1.02 * s, 0.095 * s);
  const mat = { roughness: 0.52, metalness: 0.02 };
  addSphere(panel, COLORS.white, 0, 0.17 * s, 0, 0.085 * s, new THREE.Vector3(1.05, 0.72, 0.32), mat);
  addSphere(panel, COLORS.white, 0, 0.1 * s, 0, 0.075 * s, new THREE.Vector3(1.0, 0.78, 0.32), mat);
  addSphere(panel, COLORS.white, 0, 0, 0, 0.06 * s, new THREE.Vector3(0.72, 1.05, 0.32), mat);
  addSphere(panel, COLORS.white, 0, -0.08 * s, 0, 0.052 * s, new THREE.Vector3(0.62, 0.82, 0.32), mat);
  model.add(panel);
}

/** Black cord around neck, two front strings, thin orange/white hook at the throat. */
function addFoxMiraculousNecklace(model, s) {
  const neckY = 1.235 * s;
  const frontZ = 0.11 * s;
  const neckHalfW = 0.048 * s;
  const cordMat = { roughness: 0.75, metalness: 0.02 };

  const necklace = new THREE.Group();
  necklace.name = 'FoxMiraculous';
  model.add(necklace);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-neckHalfW, neckY, frontZ),
    new THREE.Vector3(-neckHalfW * 0.75, neckY + 0.008 * s, frontZ - 0.03 * s),
    new THREE.Vector3(0, neckY + 0.01 * s, frontZ - 0.045 * s),
    new THREE.Vector3(neckHalfW * 0.75, neckY + 0.008 * s, frontZ - 0.03 * s),
    new THREE.Vector3(neckHalfW, neckY, frontZ),
  ]);
  necklace.add(part(new THREE.TubeGeometry(neckCurve, 20, 0.0048 * s, 6, false), COLORS.black, cordMat));

  const hookY = 1.21 * s;
  const hookZ = frontZ + 0.014 * s;
  const hookHalfW = 0.018 * s;

  for (const side of [-1, 1]) {
    const stringCurve = new THREE.LineCurve3(
      new THREE.Vector3(side * neckHalfW, neckY, frontZ),
      new THREE.Vector3(side * hookHalfW, hookY, hookZ)
    );
    necklace.add(part(new THREE.TubeGeometry(stringCurve, 6, 0.004 * s, 5, false), COLORS.black, cordMat));
  }

  const hookPath = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-hookHalfW, hookY, hookZ),
    new THREE.Vector3(0, hookY - 0.014 * s, hookZ + 0.001 * s),
    new THREE.Vector3(hookHalfW, hookY, hookZ)
  );
  necklace.add(
    part(new THREE.TubeGeometry(hookPath, 14, 0.002 * s, 5, false), COLORS.orange, { roughness: 0.44 })
  );

  const hookTip = part(new THREE.SphereGeometry(0.0045 * s, 6, 6), COLORS.white, { roughness: 0.4 });
  hookTip.scale.set(0.85, 0.55, 0.4);
  hookTip.position.set(0, hookY - 0.015 * s, hookZ + 0.001 * s);
  necklace.add(hookTip);
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} start
 */
export function createRenaRougeModel(scene, start) {
  const group = new THREE.Group();
  group.name = 'RenaRouge';
  group.position.copy(start);
  scene.add(group);

  const model = new THREE.Group();
  model.position.y = FEET_ALIGN_Y;
  group.add(model);

  const s = RENA_MODEL_HEIGHT / 1.68;
  const suit = { roughness: 0.48, metalness: 0.04 };

  // Legs & boots
  for (const side of [-1, 1]) {
    const lx = side * 0.074 * s;
    addCapsuleY(model, COLORS.black, lx, 0, 0.01 * s, 0.046 * s, 0.4 * s, { roughness: 0.42 });
    addCapsuleY(model, COLORS.orange, lx, 0.52 * s, 0, 0.048 * s, 0.14 * s, suit);
  }

  // Hips, waist, torso
  addSphere(model, COLORS.orange, 0, 0.74 * s, 0, 0.1 * s, new THREE.Vector3(1.12, 0.54, 0.8), suit);
  addCapsuleY(model, COLORS.orange, 0, 0.82 * s, 0, 0.064 * s, 0.1 * s, suit);
  addCapsuleY(model, COLORS.orange, 0, 0.96 * s, 0, 0.072 * s, 0.22 * s, suit);
  addWhiteChestPanel(model, s);

  // Tail behind the body
  const tail = new THREE.Group();
  tail.position.set(0, 0.8 * s, -0.12 * s);
  tail.rotation.x = 0.58;
  const tailSegs = [
    { r: 0.085, sy: 1.05, sz: 0.92, color: COLORS.orange },
    { r: 0.078, sy: 1.1, sz: 0.9, color: COLORS.orangeSoft },
    { r: 0.07, sy: 1.12, sz: 0.88, color: COLORS.orange },
    { r: 0.062, sy: 1.08, sz: 0.86, color: COLORS.orange },
    { r: 0.065, sy: 0.95, sz: 1.0, color: COLORS.white },
  ];
  let tailZ = 0;
  for (const seg of tailSegs) {
    const tuft = part(new THREE.SphereGeometry(seg.r * s, 10, 8), seg.color, { roughness: 0.52 });
    tuft.position.set(0, -0.01 * s, tailZ);
    tuft.scale.set(1.02, seg.sy, seg.sz);
    tail.add(tuft);
    tailZ -= seg.r * s * 1.4;
  }
  model.add(tail);

  // Shoulders & arms
  for (const side of [-1, 1]) {
    addSphere(model, COLORS.orange, side * 0.14 * s, 1.15 * s, 0, 0.052 * s, new THREE.Vector3(0.9, 0.78, 0.82), suit);
    const ax = side * 0.165 * s;
    addCapsuleY(model, COLORS.orange, ax, 0.98 * s, 0.01 * s, 0.034 * s, 0.13 * s, suit);
    addCapsuleY(model, COLORS.black, ax + side * 0.012 * s, 0.84 * s, 0.025 * s, 0.028 * s, 0.1 * s, {
      roughness: 0.4,
    });
    addSphere(model, COLORS.black, ax + side * 0.02 * s, 0.76 * s, 0.04 * s, 0.03 * s, new THREE.Vector3(0.78, 0.9, 0.72), {
      roughness: 0.4,
    });
  }

  // Head
  addCapsuleY(model, COLORS.skin, 0, 1.19 * s, 0.02 * s, 0.026 * s, 0.05 * s, { roughness: 0.68 });
  addSphere(model, COLORS.skin, 0, 1.3 * s, 0.03 * s, 0.088 * s, new THREE.Vector3(0.88, 1.02, 0.9), { roughness: 0.62 });
  addSphere(model, COLORS.orange, 0, 1.335 * s, 0.07 * s, 0.08 * s, new THREE.Vector3(1.04, 0.64, 0.4), suit);
  addSphere(model, COLORS.maskWhite, 0, 1.28 * s, 0.098 * s, 0.056 * s, new THREE.Vector3(1.08, 0.54, 0.32), { roughness: 0.5 });

  for (const side of [-1, 1]) {
    const ex = side * 0.036 * s;
    addSphere(model, COLORS.eyeWhite, ex, 1.318 * s, 0.098 * s, 0.022 * s, new THREE.Vector3(1.12, 0.85, 0.48), {
      roughness: 0.3,
    });
    addSphere(model, COLORS.eyeAmber, ex, 1.318 * s, 0.11 * s, 0.015 * s, new THREE.Vector3(1.08, 0.92, 0.42), {
      roughness: 0.25,
      emissive: 0x332200,
      emissiveIntensity: 0.1,
    });
  }

  addSphere(model, COLORS.lip, 0, 1.262 * s, 0.108 * s, 0.012 * s, new THREE.Vector3(1.5, 0.42, 0.48), {
    roughness: 0.45,
  });

  // Fox ears
  for (const side of [-1, 1]) {
    const earRoot = new THREE.Group();
    earRoot.position.set(side * 0.062 * s, 1.375 * s, -0.015 * s);
    earRoot.rotation.z = side * 0.26;
    earRoot.rotation.x = -0.1;

    const earOuter = part(new THREE.ConeGeometry(0.052 * s, 0.2 * s, 8), COLORS.orange, suit);
    earOuter.rotation.x = Math.PI;
    earOuter.position.y = 0.1 * s;
    earRoot.add(earOuter);

    const earInner = part(new THREE.ConeGeometry(0.03 * s, 0.13 * s, 8), COLORS.white, { roughness: 0.5 });
    earInner.rotation.x = Math.PI;
    earInner.position.set(0, 0.09 * s, 0.012 * s);
    earRoot.add(earInner);

    const earTip = part(new THREE.ConeGeometry(0.024 * s, 0.045 * s, 8), COLORS.black, { roughness: 0.45 });
    earTip.rotation.x = Math.PI;
    earTip.position.y = 0.19 * s;
    earRoot.add(earTip);

    model.add(earRoot);
  }

  // Hair
  addSphere(model, COLORS.hair, 0, 1.395 * s, -0.025 * s, 0.095 * s, new THREE.Vector3(1.04, 0.78, 1.02), {
    roughness: 0.78,
  });
  const pony = part(new THREE.CapsuleGeometry(0.038 * s, 0.3 * s, 8, 12), COLORS.hair, { roughness: 0.76 });
  pony.position.set(0.025 * s, 1.33 * s, -0.13 * s);
  pony.rotation.x = 1.0;
  model.add(pony);
  addSphere(model, COLORS.white, 0.05 * s, 1.08 * s, -0.32 * s, 0.045 * s, new THREE.Vector3(1.05, 0.85, 0.95), {
    roughness: 0.7,
  });

  addFoxMiraculousNecklace(model, s);

  // Flute on hip
  const flute = part(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.28 * s, 10), COLORS.orange, suit);
  flute.position.set(0.15 * s, 0.9 * s, 0.045 * s);
  flute.rotation.z = -0.5;
  flute.rotation.x = 0.14;
  model.add(flute);
  const fluteBand = part(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.03 * s, 10), COLORS.white, {
    roughness: 0.5,
  });
  fluteBand.position.set(0.13 * s, 0.97 * s, 0.06 * s);
  fluteBand.rotation.z = -0.5;
  fluteBand.rotation.x = 0.14;
  model.add(fluteBand);

  return group;
}
