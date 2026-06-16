import * as THREE from 'three';

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

  ctx.strokeStyle = '#a89882';
  ctx.lineWidth = 2;
  for (let row = 1; row < rows; row++) {
    const y = margin + row * (winH + gapY) - gapY / 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
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
  if (!facadeTextureBase) {
    facadeTextureBase = createHaussmannFacadeTexture();
  }
  return facadeTextureBase;
}

function getCobbleBase() {
  if (!cobbleTextureBase) {
    cobbleTextureBase = createCobbleTexture();
  }
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

/**
 * Builds static platforms as Paris-style blocks and returns axis-aligned collider boxes (min/max).
 */
export function buildLevel(scene) {
  const colliders = [];
  const root = new THREE.Group();
  scene.add(root);

  function pushCollider(cx, cy, cz, w, h, d, meta = {}) {
    const hx = w / 2;
    const hy = h / 2;
    const hz = d / 2;
    colliders.push({
      min: { x: cx - hx, y: cy - hy, z: cz - hz },
      max: { x: cx + hx, y: cy + hy, z: cz + hz },
      ...meta,
    });
  }

  function addGround(cx, cy, cz, w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const cobble = getCobbleBase().clone();
    cobble.needsUpdate = true;
    cobble.repeat.set(w * 0.35, d * 0.35);
    const mat = new THREE.MeshStandardMaterial({
      map: cobble,
      color: 0xc4b8a8,
      roughness: 0.92,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    root.add(mesh);
    pushCollider(cx, cy, cz, w, h, d);
  }

  /**
   * Haussmann-style volume: stone façade + zinc roof slab (collider = full box).
   */
  function addParisBuilding(
    cx,
    cy,
    cz,
    w,
    h,
    d,
    tint = 0xffffff,
    emissive = 0x000000,
    emissiveIntensity = 0,
    meta = {}
  ) {
    const bottom = cy - h / 2;

    const roofH = h >= 0.32 ? Math.max(0.07, Math.min(h * 0.22, 0.45)) : 0;
    let corniceH =
      roofH > 0 ? Math.max(0.035, Math.min(h * 0.12, roofH * 0.55)) : 0;
    let bodyH = h - roofH - corniceH;

    if (bodyH < h * 0.38) {
      corniceH = 0;
      bodyH = h - roofH;
    }
    if (roofH <= 0) {
      corniceH = 0;
      bodyH = h;
    }

    const bodyCenterY = bottom + bodyH / 2;
    const corniceCenterY = bottom + bodyH + corniceH / 2;
    const roofCenterY = bottom + bodyH + corniceH + roofH / 2;

    const bodyGeo = new THREE.BoxGeometry(w, bodyH, d);
    const bodyMat = facadeMaterialFor(w, bodyH, tint, emissive, emissiveIntensity);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(cx, bodyCenterY, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    if (corniceH > 0.001 && roofH > 0) {
      const corniceGeo = new THREE.BoxGeometry(w * 1.08, corniceH, d * 1.08);
      const corniceMat = new THREE.MeshStandardMaterial({
        color: 0xd2c4b0,
        roughness: 0.75,
        metalness: 0,
      });
      const cornice = new THREE.Mesh(corniceGeo, corniceMat);
      cornice.position.set(cx, corniceCenterY, cz);
      cornice.castShadow = true;
      cornice.receiveShadow = true;
      root.add(cornice);
    }

    if (roofH > 0) {
      const roofMat = new THREE.MeshStandardMaterial({
        color: meta.isGoal ? 0x6a5a40 : 0x5a5862,
        roughness: 0.58,
        metalness: 0.22,
        emissive: meta.isGoal ? emissive : 0x000000,
        emissiveIntensity: meta.isGoal ? emissiveIntensity * 1.2 : 0,
      });
      const rw = w * 1.06;
      const rd = d * 1.06;
      const roofGeo = new THREE.BoxGeometry(rw, roofH, rd);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(cx, roofCenterY, cz);
      roof.castShadow = true;
      roof.receiveShadow = true;
      root.add(roof);
    }

    pushCollider(cx, cy, cz, w, h, d, meta);
  }

  // Ground — public square / paving
  addGround(0, -0.75, 0, 48, 1.5, 48);

  // Climb path — warm stone tints (Haussmann variations)
  addParisBuilding(0, 0.75, -6, 10, 0.6, 4, 0xf2ebe0);
  addParisBuilding(5, 1.6, -11, 3, 0.6, 3, 0xe8e0d4);
  addParisBuilding(1, 2.45, -16, 4, 0.6, 3, 0xede6dc);
  addParisBuilding(-4, 3.35, -20, 3.5, 0.6, 3.5, 0xe5dfd4);
  addParisBuilding(-8, 4.25, -14, 3, 0.6, 6, 0xeee8df);
  addParisBuilding(-2, 5.2, -8, 5, 0.6, 3, 0xe2dcd2);
  addParisBuilding(4, 6.15, -5, 3, 0.6, 4, 0xefeae2);

  // Stepping roof between penultimate platform and gold goal (splits long jump)
  addParisBuilding(8, 6.7, -3, 3, 0.6, 3, 0xe8e4dc);

  // Goal — lit zinc & gold (Hôtel particulier accent)
  addParisBuilding(12, 7.1, -2, 4, 0.6, 4, 0xffe8c4, 0xffb020, 0.38, { isGoal: true });

  return { colliders, root };
}
