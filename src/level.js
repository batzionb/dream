import * as THREE from 'three';

/** @typedef {'ladybug' | 'renarouge'} CharacterId */

/** @type {THREE.CanvasTexture | null} */
let facadeTextureBase = null;
/** @type {THREE.CanvasTexture | null} */
let cobbleTextureBase = null;

function createHaussmannFacadeTexture() {
  const W = 160;
  const H = 240;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e4d8c6';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(200, 188, 170, 0.25)';
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  const winW = 22;
  const winH = 32;
  const gapX = 14;
  const gapY = 16;
  const margin = 12;
  const rows = Math.floor((H - margin * 2) / (winH + gapY));
  const cols = Math.max(2, Math.floor((W - margin * 2) / (winW + gapX)));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = margin + col * (winW + gapX);
      const y = margin + row * (winH + gapY);
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = '#1e2433';
      ctx.fillRect(x + 3, y + 4, winW - 6, winH - 10);
      ctx.strokeStyle = '#b5a892';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 0.5, y - 0.5, winW + 1, winH + 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCobbleTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bfae9e';
  ctx.fillRect(0, 0, S, S);
  const cell = 28;
  for (let gy = 0; gy < S; gy += cell) {
    for (let gx = 0; gx < S; gx += cell) {
      const shift = ((gy / cell) % 2) * (cell / 3);
      const v = 68 + Math.random() * 14;
      ctx.fillStyle = `hsl(35, 10%, ${v}%)`;
      ctx.fillRect(gx + shift + 1, gy + 1, cell - 3, cell - 3);
      ctx.strokeStyle = '#8f8275';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + shift + 0.5, gy + 0.5, cell - 2, cell - 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function getFacadeBase() {
  if (!facadeTextureBase) facadeTextureBase = createHaussmannFacadeTexture();
  return facadeTextureBase;
}

function getCobbleBase() {
  if (!cobbleTextureBase) cobbleTextureBase = createCobbleTexture();
  return cobbleTextureBase;
}

function facadeMaterialFor(w, bodyH, tint = 0xffffff, emissive = 0x000000, emissiveIntensity = 0) {
  const map = getFacadeBase().clone();
  map.needsUpdate = true;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(Math.max(1, w * 0.55), Math.max(1, bodyH * 0.9));
  return new THREE.MeshStandardMaterial({
    map,
    color: tint,
    roughness: 0.86,
    metalness: 0.06,
    emissive,
    emissiveIntensity,
  });
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.12,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

function addMesh(parent, geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * @param {THREE.Group} root
 * @param {number} x
 * @param {number} z0
 * @param {number} z1
 */
function addTrackSegment(root, x, z0, z1) {
  const zMin = Math.min(z0, z1);
  const zMax = Math.max(z0, z1);
  const len = zMax - zMin + 4;
  const cz = (zMin + zMax) / 2;

  addMesh(
    root,
    new THREE.BoxGeometry(len, 0.12, 4.2),
    mat(0x3a3a3a, { roughness: 0.95 }),
    x,
    -0.62,
    cz
  );

  const railMat = mat(0x888888, { roughness: 0.35, metalness: 0.75 });
  for (const dx of [-0.85, 0.85]) {
    addMesh(root, new THREE.BoxGeometry(len, 0.07, 0.1), railMat, x + dx, -0.52, cz);
  }

  const sleeperMat = mat(0x4a3728, { roughness: 0.9 });
  for (let z = zMin - 1; z <= zMax + 1; z += 0.55) {
    addMesh(root, new THREE.BoxGeometry(0.35, 0.08, 2.4), sleeperMat, x, -0.56, z);
  }
}

/**
 * @param {THREE.Group} car
 * @param {number} z
 * @param {number} bodyBottomY
 */
function addBogie(car, z, bodyBottomY) {
  const bogie = new THREE.Group();
  bogie.position.set(0, bodyBottomY - 0.08, z);
  car.add(bogie);

  addMesh(
    bogie,
    new THREE.BoxGeometry(2.6, 0.18, 1.4),
    mat(0x222222, { roughness: 0.7, metalness: 0.4 }),
    0,
    -0.05,
    0
  );

  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14);
  const wheelMat = mat(0x1a1a1a, { roughness: 0.6, metalness: 0.35 });
  for (const [wx, wz] of [
    [-0.9, -0.45],
    [0.9, -0.45],
    [-0.9, 0.45],
    [0.9, 0.45],
  ]) {
    const wheel = addMesh(bogie, wheelGeo, wheelMat, wx, -0.18, wz);
    wheel.rotation.z = Math.PI / 2;
  }
}

/**
 * @param {THREE.Group} root
 * @param {number} cx
 * @param {number} cy
 * @param {number} cz
 * @param {number} lengthZ
 * @param {number} widthX
 * @param {number} deckH
 * @param {{ locomotive?: boolean, goal?: boolean, emissive?: number, emissiveIntensity?: number }} [opts]
 */
function buildTrainCarVisual(root, cx, cy, cz, lengthZ, widthX, deckH, opts = {}) {
  const car = new THREE.Group();
  car.position.set(cx, cy, cz);
  root.add(car);

  const bodyH = 1.05;
  const bodyBottom = -deckH / 2 - bodyH + 0.05;
  const sideMat = mat(opts.locomotive ? 0x1e4a8a : 0x2563b8, { roughness: 0.42, metalness: 0.28 });
  const stripeMat = mat(0xf8f8f8, { roughness: 0.5 });
  const roofMat = mat(opts.goal ? 0xffc840 : 0xb8bcc4, {
    roughness: 0.38,
    metalness: 0.45,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.goal ? (opts.emissiveIntensity ?? 0) * 1.2 : 0,
  });
  const windowMat = mat(0x87ceeb, {
    roughness: 0.15,
    metalness: 0.5,
    emissive: 0x224466,
    emissiveIntensity: 0.2,
  });
  const deckMat = mat(0x505860, { roughness: 0.75, metalness: 0.2 });

  addMesh(car, new THREE.BoxGeometry(widthX, deckH, lengthZ), deckMat, 0, 0, 0);

  addMesh(car, new THREE.BoxGeometry(widthX * 0.96, bodyH, lengthZ * 0.94), sideMat, 0, bodyBottom + bodyH / 2, 0);

  addMesh(
    car,
    new THREE.BoxGeometry(widthX * 0.98, bodyH * 0.11, lengthZ * 0.95),
    stripeMat,
    0,
    bodyBottom + bodyH * 0.72,
    0
  );

  addMesh(
    car,
    new THREE.BoxGeometry(widthX * 0.92, 0.22, lengthZ * 0.9),
    roofMat,
    0,
    bodyBottom + bodyH + 0.1,
    0
  );

  const winW = 0.55;
  const winH = 0.42;
  const winCount = Math.max(2, Math.floor(lengthZ / 1.35));
  for (let i = 0; i < winCount; i++) {
    const wz = -lengthZ / 2 + 0.7 + i * (lengthZ / winCount);
    for (const side of [-1, 1]) {
      addMesh(
        car,
        new THREE.BoxGeometry(0.06, winH, winW),
        windowMat,
        side * (widthX / 2 + 0.025),
        bodyBottom + bodyH * 0.55,
        wz
      );
    }
  }

  addBogie(car, -lengthZ * 0.28, bodyBottom);
  addBogie(car, lengthZ * 0.28, bodyBottom);

  if (opts.locomotive) {
    const nose = addMesh(
      car,
      new THREE.BoxGeometry(widthX * 0.85, bodyH * 0.85, 1.6),
      mat(0x1e4a8a, { roughness: 0.4, metalness: 0.3 }),
      0,
      bodyBottom + bodyH * 0.45,
      lengthZ / 2 + 0.65
    );
    nose.rotation.x = -0.12;
    addMesh(
      car,
      new THREE.BoxGeometry(widthX * 0.5, 0.35, 0.25),
      mat(0xffffcc, { emissive: 0xffffaa, emissiveIntensity: 0.8 }),
      0,
      bodyBottom + bodyH * 0.35,
      lengthZ / 2 + 1.45
    );
  }

  if (!opts.locomotive) {
    addMesh(
      car,
      new THREE.BoxGeometry(0.25, 0.35, widthX * 0.5),
      mat(0x333333, { metalness: 0.6 }),
      0,
      bodyBottom + bodyH * 0.35,
      -lengthZ / 2 - 0.35
    );
  }

  return car;
}

/**
 * @param {THREE.Group} root
 * @param {Array<{ min: { x, y, z }, max: { x, y, z }, isGoal?: boolean }>} colliders
 */
function buildTrainLevel(root, colliders) {
  function pushCollider(cx, cy, cz, w, h, d, meta = {}) {
    colliders.push({
      min: { x: cx - w / 2, y: cy - h / 2, z: cz - d / 2 },
      max: { x: cx + w / 2, y: cy + h / 2, z: cz + d / 2 },
      ...meta,
    });
  }

  function addCar(cx, cy, cz, lengthZ, widthX, deckH, opts = {}) {
    buildTrainCarVisual(root, cx, cy, cz, lengthZ, widthX, deckH, opts);
    pushCollider(cx, cy, cz, widthX, deckH, lengthZ, opts.goal ? { isGoal: true } : {});
  }

  /** Blue boarding step in front of the locomotive — top flush with train deck. */
  function addBoardingStep(cx, deckTopY, frontZ, widthX, depth, deckH) {
    const stepCy = deckTopY - deckH / 2;
    const stepMat = mat(0x2563b8, { roughness: 0.42, metalness: 0.28 });
    addMesh(root, new THREE.BoxGeometry(widthX, deckH, depth), stepMat, cx, stepCy, frontZ);
    pushCollider(cx, stepCy, frontZ, widthX, deckH, depth);
  }

  pushCollider(0, -0.75, 0, 48, 1.5, 48);
  addMesh(
    root,
    new THREE.BoxGeometry(48, 1.5, 48),
    mat(0x2a2a2a, { roughness: 0.95 }),
    0,
    -0.75,
    0
  );

  addMesh(
    root,
    new THREE.BoxGeometry(14, 0.35, 52),
    mat(0x9aa0a8, { roughness: 0.88 }),
    -6,
    -0.55,
    -8
  );
  addMesh(
    root,
    new THREE.BoxGeometry(14, 0.08, 0.5),
    mat(0xf0c020),
    -6,
    -0.34,
    -8
  );

  const trackX = 0;
  const deckH = 0.6;
  const deckTopY = 0.35;
  const groundY = deckTopY - deckH / 2;

  addTrackSegment(root, trackX, 8, -42);

  /** @type {Array<{ lengthZ: number, widthX: number, opts?: { locomotive?: boolean, goal?: boolean, emissive?: number, emissiveIntensity?: number } }>} */
  const trainCars = [
    { lengthZ: 9, widthX: 3.4, opts: { locomotive: true } },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 5.5, widthX: 3.2 },
    { lengthZ: 6, widthX: 3.4, opts: { goal: true, emissive: 0xffb020, emissiveIntensity: 0.38 } },
  ];

  let frontZ = 4;
  const locoFrontZ = frontZ;
  for (const car of trainCars) {
    const cz = frontZ - car.lengthZ / 2;
    addCar(trackX, groundY, cz, car.lengthZ, car.widthX, deckH, car.opts ?? {});
    frontZ -= car.lengthZ;
  }

  addBoardingStep(trackX, deckTopY, locoFrontZ + 1.0, 3.2, 1.6, deckH);
}

/**
 * @param {THREE.Group} root
 * @param {Array<{ min: { x, y, z }, max: { x, y, z }, isGoal?: boolean }>} colliders
 */
function buildParisLevel(root, colliders) {
  function pushCollider(cx, cy, cz, w, h, d, meta = {}) {
    colliders.push({
      min: { x: cx - w / 2, y: cy - h / 2, z: cz - d / 2 },
      max: { x: cx + w / 2, y: cy + h / 2, z: cz + d / 2 },
      ...meta,
    });
  }

  function addGround(cx, cy, cz, w, h, d) {
    const cobble = getCobbleBase().clone();
    cobble.needsUpdate = true;
    cobble.repeat.set(w * 0.35, d * 0.35);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        map: cobble,
        color: 0xc4b8a8,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    mesh.position.set(cx, cy, cz);
    mesh.receiveShadow = true;
    root.add(mesh);
    pushCollider(cx, cy, cz, w, h, d);
  }

  function addParisBuilding(cx, cy, cz, w, h, d, tint = 0xffffff, emissive = 0x000000, emissiveIntensity = 0, meta = {}) {
    const bottom = cy - h / 2;
    const roofH = h >= 0.32 ? Math.max(0.07, Math.min(h * 0.22, 0.45)) : 0;
    let corniceH = roofH > 0 ? Math.max(0.035, Math.min(h * 0.12, roofH * 0.55)) : 0;
    let bodyH = h - roofH - corniceH;
    if (bodyH < h * 0.38) {
      corniceH = 0;
      bodyH = h - roofH;
    }
    if (roofH <= 0) {
      corniceH = 0;
      bodyH = h;
    }

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, bodyH, d),
      facadeMaterialFor(w, bodyH, tint, emissive, emissiveIntensity)
    );
    body.position.set(cx, bottom + bodyH / 2, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    if (corniceH > 0.001 && roofH > 0) {
      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.08, corniceH, d * 1.08),
        mat(0xd2c4b0, { roughness: 0.75, metalness: 0 })
      );
      cornice.position.set(cx, bottom + bodyH + corniceH / 2, cz);
      cornice.castShadow = true;
      root.add(cornice);
    }

    if (roofH > 0) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 1.06, roofH, d * 1.06),
        mat(meta.isGoal ? 0x6a5a40 : 0x5a5862, {
          roughness: 0.58,
          metalness: 0.22,
          emissive: meta.isGoal ? emissive : 0x000000,
          emissiveIntensity: meta.isGoal ? emissiveIntensity * 1.2 : 0,
        })
      );
      roof.position.set(cx, bottom + bodyH + corniceH + roofH / 2, cz);
      roof.castShadow = true;
      root.add(roof);
    }

    pushCollider(cx, cy, cz, w, h, d, meta);
  }

  addGround(0, -0.75, 0, 48, 1.5, 48);
  addParisBuilding(0, 0.75, -6, 10, 0.6, 4, 0xf2ebe0);
  addParisBuilding(5, 1.6, -11, 3, 0.6, 3, 0xe8e0d4);
  addParisBuilding(1, 2.45, -16, 4, 0.6, 3, 0xede6dc);
  addParisBuilding(-4, 3.35, -20, 3.5, 0.6, 3.5, 0xe5dfd4);
  addParisBuilding(-8, 4.25, -14, 3, 0.6, 6, 0xeee8df);
  addParisBuilding(-2, 5.2, -8, 5, 0.6, 3, 0xe2dcd2);
  addParisBuilding(4, 6.15, -5, 3, 0.6, 4, 0xefeae2);
  addParisBuilding(8, 6.7, -3, 3, 0.6, 3, 0xe8e4dc);
  addParisBuilding(12, 7.1, -2, 4, 0.6, 4, 0xffe8c4, 0xffb020, 0.38, { isGoal: true });
  addParisBuilding(-14, 4, 6, 2, 0.4, 2, 0xe8e2d8);
  addParisBuilding(8, 3.2, 8, 2.5, 0.4, 2.5, 0xdfd8cc);
}

/**
 * @param {THREE.Scene} scene
 * @param {CharacterId} [characterId='renarouge']
 */
export function buildLevel(scene, characterId = 'renarouge') {
  const colliders = [];
  const root = new THREE.Group();
  root.name = characterId === 'ladybug' ? 'TrainLevel' : 'ParisLevel';
  scene.add(root);

  if (characterId === 'ladybug') {
    buildTrainLevel(root, colliders);
  } else {
    buildParisLevel(root, colliders);
  }

  return { colliders, root };
}

/**
 * @param {THREE.Object3D} root
 */
export function disposeLevel(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
  root.parent?.remove(root);
}
