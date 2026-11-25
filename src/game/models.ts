import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { SanatoriumTextures } from './textures';
import { applySoftwareBayerDither } from './DitherPostProcess';
import { CELL_SIZE, WALL_HEIGHT } from './mapData';

function makeStd(
  params: THREE.MeshStandardMaterialParameters,
  isSoftwareGl: boolean,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(params);
  if (isSoftwareGl) applySoftwareBayerDither(mat);
  return mat;
}

function addContactShadow(
  group: THREE.Group,
  textures: SanatoriumTextures,
  radius: number,
  opacity = 0.55,
): void {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.shadowDisc,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.position.y = 0.015;
  group.add(shadow);
}

/**
 * 1. Composite 6-part Ceiling Sanatorium Lamp
 */
export function createCeilingLamp(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): { group: THREE.Group; bulbMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x55585e,
      roughness: 0.72,
      metalness: 0.85,
    },
    isSoftwareGl,
  );
  const enamelMat = makeStd(
    {
      color: 0xbec2c8,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    },
    isSoftwareGl,
  );
  const bulbMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xfff2d6,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.0,
    },
    isSoftwareGl,
  );

  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.05, 12), ironMat);
  canopy.position.y = WALL_HEIGHT - 0.025;
  group.add(canopy);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8), ironMat);
  rod.position.y = WALL_HEIGHT - 0.24;
  group.add(rod);

  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10), ironMat);
  socket.position.y = WALL_HEIGHT - 0.47;
  group.add(socket);

  const shadePts = [
    new THREE.Vector2(0.045, 0.14),
    new THREE.Vector2(0.08, 0.11),
    new THREE.Vector2(0.22, 0.03),
    new THREE.Vector2(0.25, 0.0),
  ];
  const shade = new THREE.Mesh(new THREE.LatheGeometry(shadePts, 16), enamelMat);
  shade.position.y = WALL_HEIGHT - 0.62;
  shade.castShadow = true;
  group.add(shade);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), bulbMat);
  bulb.position.y = WALL_HEIGHT - 0.59;
  group.add(bulb);

  const cageRing = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.01, 6, 18), ironMat);
  cageRing.rotation.x = Math.PI / 2;
  cageRing.position.y = WALL_HEIGHT - 0.63;
  group.add(cageRing);

  return { group, bulbMat };
}

/**
 * 2. Composite 8-part Asylum Wheelchair / Chair (bottom-center pivot at y=0)
 */
export function createAsylumChair(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const frameMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x62656a,
      roughness: 0.65,
      metalness: 0.8,
    },
    isSoftwareGl,
  );
  const cushionMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0xb0aca2,
      roughness: 0.92,
      metalness: 0.02,
    },
    isSoftwareGl,
  );

  const seatShape = new THREE.Shape();
  seatShape.moveTo(-0.24, -0.22);
  seatShape.lineTo(0.24, -0.22);
  seatShape.lineTo(0.24, 0.22);
  seatShape.lineTo(-0.24, 0.22);
  seatShape.closePath();
  const seatGeo = new THREE.ExtrudeGeometry(seatShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  seatGeo.rotateX(Math.PI / 2);
  const seat = new THREE.Mesh(seatGeo, cushionMat);
  seat.position.y = 0.48;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  const legGeo = new THREE.CylinderGeometry(0.018, 0.014, 0.46, 8);
  for (const [lx, lz] of [
    [-0.21, -0.19],
    [0.21, -0.19],
    [-0.21, 0.19],
    [0.21, 0.19],
  ]) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(lx, 0.23, lz);
    leg.castShadow = true;
    group.add(leg);
  }

  for (const bx of [-0.21, 0.21]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8), frameMat);
    post.position.set(bx, 0.72, -0.21);
    post.rotation.x = -0.08;
    post.castShadow = true;
    group.add(post);
  }
  const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.05), cushionMat);
  backPad.position.set(0, 0.85, -0.23);
  backPad.rotation.x = -0.08;
  backPad.castShadow = true;
  group.add(backPad);

  for (const wx of [-0.28, 0.28]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.016, 8, 20), frameMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(wx, 0.29, -0.04);
    wheel.castShadow = true;
    group.add(wheel);
  }

  addContactShadow(group, textures, 0.52, 0.58);
  return group;
}

/**
 * 3. Composite Industrial Steel Dive / Ballast Table (bottom-center pivot at y=0)
 */
export function createGurney(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const steelMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x68727c,
      roughness: 0.45,
      metalness: 0.88,
    },
    isSoftwareGl,
  );
  const tankMat = makeStd(
    {
      map: textures.metalMap,
      color: 0xd4a438,
      roughness: 0.48,
      metalness: 0.65,
    },
    isSoftwareGl,
  );
  const tarpMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0x3b4852,
      roughness: 0.9,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 1.86), steelMat);
  deck.position.y = 0.72;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const tarp = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 1.65), tarpMat);
  tarp.position.y = 0.785;
  tarp.castShadow = true;
  group.add(tarp);

  // Strapped compressed-air dive cylinder resting on deck
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.78, 12), tankMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(-0.12, 0.91, -0.32);
  tank.castShadow = true;
  group.add(tank);

  const legGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.66, 8);
  const wheelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [lx, lz] of [
    [-0.38, -0.86],
    [0.38, -0.86],
    [-0.38, 0.86],
    [0.38, 0.86],
  ]) {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(lx, 0.39, lz);
    leg.castShadow = true;
    group.add(leg);

    const wheel = new THREE.Mesh(wheelGeo, steelMat);
    wheel.position.set(lx, 0.055, lz);
    group.add(wheel);
  }

  const headCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.4, 0.74, -0.92),
    new THREE.Vector3(-0.38, 1.16, -0.92),
    new THREE.Vector3(0.38, 1.16, -0.92),
    new THREE.Vector3(0.4, 0.74, -0.92),
  ]);
  const headRail = new THREE.Mesh(new THREE.TubeGeometry(headCurve, 16, 0.022, 8, false), steelMat);
  headRail.castShadow = true;
  group.add(headRail);

  addContactShadow(group, textures, 1.15, 0.6);
  return group;
}

/**
 * 4. Composite 6-part Wall Pipe & Pressure Valve Cluster
 */
export function createWallPipeCluster(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const pipeMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x5c5e62,
      roughness: 0.55,
      metalness: 0.86,
    },
    isSoftwareGl,
  );
  const wheelMat = makeStd(
    {
      color: 0xc2c2bc,
      roughness: 0.42,
      metalness: 0.5,
    },
    isSoftwareGl,
  );
  const dialMat = makeStd(
    {
      map: textures.gaugeMap,
      roughness: 0.3,
      metalness: 0.1,
    },
    isSoftwareGl,
  );

  for (const px of [-0.14, 0.14]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, WALL_HEIGHT, 10), pipeMat);
    pipe.position.set(px, WALL_HEIGHT / 2, 0.06);
    pipe.castShadow = true;
    group.add(pipe);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.07, 10), pipeMat);
    collar.position.set(px, 1.35, 0.06);
    group.add(collar);
  }

  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.36, 8), pipeMat);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 1.48, 0.08);
  group.add(bridge);

  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 16), wheelMat);
  wheel.position.set(0, 1.48, 0.14);
  group.add(wheel);

  const gaugeCase = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 16), pipeMat);
  gaugeCase.rotation.x = Math.PI / 2;
  gaugeCase.position.set(0.14, 1.72, 0.12);
  group.add(gaugeCase);

  const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.072, 16), dialMat);
  gaugeFace.position.set(0.14, 1.72, 0.144);
  group.add(gaugeFace);

  return group;
}

/**
 * 5. Composite Submerged O2 Cylinder & Pressure Manifold Stand (bottom-center pivot at y=0)
 */
export function createIVStand(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const chromeMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x7e8892,
      roughness: 0.42,
      metalness: 0.88,
    },
    isSoftwareGl,
  );
  const tankMat = makeStd(
    {
      map: textures.metalMap,
      color: 0xc29338,
      roughness: 0.45,
      metalness: 0.55,
    },
    isSoftwareGl,
  );
  const tubeMat = makeStd(
    {
      color: 0x1a1d20,
      roughness: 0.85,
      metalness: 0.08,
    },
    isSoftwareGl,
  );

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.07, 12), chromeMat);
  hub.position.y = 0.035;
  group.add(hub);

  // Oxygen tank cylinder + valve dome
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.92, 12), tankMat);
  tank.position.y = 0.52;
  tank.castShadow = true;
  group.add(tank);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.56, 8), chromeMat);
  pole.position.set(0.12, 0.8, 0);
  pole.castShadow = true;
  group.add(pole);

  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12), chromeMat);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.12, 1.52, 0.03);
  group.add(gauge);

  const dripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.0, 0),
    new THREE.Vector3(0.16, 1.12, 0.08),
    new THREE.Vector3(0.08, 0.72, -0.06),
    new THREE.Vector3(0.15, 0.35, 0.04),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(dripCurve, 14, 0.011, 6, false), tubeMat);
  group.add(tube);

  addContactShadow(group, textures, 0.36, 0.5);
  return group;
}

/**
 * 6. Composite 8-part Broken Medical Supply Cabinet (bottom-center pivot at y=0)
 */
export function createMedicalCabinet(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const steelMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x82868c,
      roughness: 0.58,
      metalness: 0.78,
    },
    isSoftwareGl,
  );
  const innerMat = makeStd(
    {
      color: 0x26282a,
      roughness: 0.9,
      metalness: 0.1,
    },
    isSoftwareGl,
  );
  const bottleMat = makeStd(
    {
      color: 0xe6e6e0,
      roughness: 0.2,
      metalness: 0.1,
    },
    isSoftwareGl,
  );

  // Back + Side walls (hollow front)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.78, 0.05), steelMat);
  back.position.set(0, 0.92, -0.19);
  back.castShadow = true;
  back.receiveShadow = true;
  group.add(back);

  for (const sx of [-0.435, 0.435]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.78, 0.42), steelMat);
    side.position.set(sx, 0.92, 0);
    side.castShadow = true;
    group.add(side);
  }

  // Top & Bottom + 2 Interior Shelves (one tilted!)
  for (const [sy, tilt] of [
    [0.06, 0],
    [0.62, 0.06],
    [1.18, -0.09],
    [1.8, 0],
  ]) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.4), sy === 1.8 ? steelMat : innerMat);
    shelf.position.set(0, sy, 0);
    shelf.rotation.z = tilt;
    shelf.castShadow = true;
    group.add(shelf);
  }

  // Two Ajar Cabinet Doors
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.41, 1.66, 0.03), steelMat);
  leftDoor.position.set(-0.44, 0.92, 0.24);
  leftDoor.rotation.y = -0.85;
  leftDoor.castShadow = true;
  group.add(leftDoor);

  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.41, 1.66, 0.03), steelMat);
  rightDoor.position.set(0.43, 0.92, 0.22);
  rightDoor.rotation.y = 0.35;
  rightDoor.castShadow = true;
  group.add(rightDoor);

  // Medicine vials on shelves
  for (const [bx, by, bz] of [
    [-0.18, 0.69, 0.04],
    [-0.08, 0.69, -0.04],
    [0.2, 1.24, 0.02],
  ]) {
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 8), bottleMat);
    vial.position.set(bx, by, bz);
    group.add(vial);
  }

  addContactShadow(group, textures, 0.72, 0.62);
  return group;
}

/**
 * 7. Composite Reinforced Submarine Porthole Window (wall-mounted)
 */
export function createBarredWindow(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x3b4248,
      roughness: 0.56,
      metalness: 0.86,
    },
    isSoftwareGl,
  );
  const paneMat = makeStd(
    {
      map: textures.windowGlowMap,
      emissive: 0x76b8c4,
      emissiveMap: textures.windowGlowMap,
      emissiveIntensity: 0.9,
      roughness: 0.18,
    },
    isSoftwareGl,
  );

  // Circular abyssal ocean view glass pane
  const pane = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), paneMat);
  pane.position.set(0, 1.78, 0.035);
  group.add(pane);

  // Bolted submarine brass/steel porthole collar ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.065, 10, 24), ironMat);
  ring.position.set(0, 1.78, 0.055);
  ring.castShadow = true;
  group.add(ring);

  // Crossed pressure protection bars
  const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), ironMat);
  hBar.rotation.z = Math.PI / 2;
  hBar.position.set(0, 1.78, 0.07);
  const vBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), ironMat);
  vBar.position.set(0, 1.78, 0.07);
  group.add(hBar, vBar);

  return group;
}

/**
 * 8. Composite 5-part Wall Electrical Breaker Box & Severed Cables
 */
export function createBreakerBox(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const boxMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x6c7076,
      roughness: 0.55,
      metalness: 0.82,
    },
    isSoftwareGl,
  );
  const cableMat = makeStd(
    {
      color: 0x16171a,
      roughness: 0.88,
      metalness: 0.1,
    },
    isSoftwareGl,
  );

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.14), boxMat);
  housing.position.set(0, 1.48, 0.07);
  housing.castShadow = true;
  group.add(housing);

  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.06), boxMat);
  lever.position.set(0.25, 1.54, 0.09);
  lever.rotation.x = 0.5;
  group.add(lever);

  // Two dangling severed conduit cables
  const c1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.1, 1.18, 0.08),
    new THREE.Vector3(-0.14, 0.9, 0.14),
    new THREE.Vector3(-0.08, 0.62, 0.08),
  ]);
  const c2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 1.18, 0.08),
    new THREE.Vector3(0.16, 0.95, 0.18),
    new THREE.Vector3(0.22, 0.72, 0.11),
  ]);
  group.add(
    new THREE.Mesh(new THREE.TubeGeometry(c1, 12, 0.014, 6, false), cableMat),
    new THREE.Mesh(new THREE.TubeGeometry(c2, 12, 0.012, 6, false), cableMat),
  );

  return group;
}

/**
 * 9. Wall-mounted Posters & Charcoal Graffiti Decals
 */
export function createWallArt(
  kind: 'notice' | 'anatomy' | 'graffiti',
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Mesh {
  const map =
    kind === 'notice'
      ? textures.posterNoticeMap
      : kind === 'anatomy'
      ? textures.posterAnatomyMap
      : textures.graffitiMap;

  const isDecal = kind === 'graffiti';
  const mat = makeStd(
    {
      map,
      transparent: isDecal,
      alphaTest: isDecal ? 0.15 : 0,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    },
    isSoftwareGl,
  );
  const w = isDecal ? 1.1 : 0.56;
  const h = isDecal ? 1.1 : 0.72;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(0, isDecal ? 1.52 : 1.65, 0.018);
  return mesh;
}

/**
 * 10. Floor Slick Stain / Oil Drag Decal
 */
export function createFloorStain(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
  scale = 1.2,
): THREE.Mesh {
  const mat = makeStd(
    {
      map: textures.stainDecalMap,
      color: 0x851212,
      emissive: 0x1a0202,
      emissiveIntensity: 0.25,
      transparent: true,
      roughness: 0.08,
      metalness: 0.15,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    },
    isSoftwareGl,
  );
  const geo = new THREE.PlaneGeometry(scale, scale);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.012;
  return mesh;
}

/**
 * 11. Composite Pickup Box (Battery or Medkit, bottom-center pivot at y=0)
 */
export function createPickupBox(
  kind: 'battery' | 'medkit',
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const baseMat = makeStd(
    {
      map: kind === 'battery' ? textures.metalMap : textures.fabricMap,
      color: kind === 'battery' ? 0x2c323a : 0xe4e4de,
      roughness: kind === 'battery' ? 0.38 : 0.72,
      metalness: kind === 'battery' ? 0.82 : 0.08,
    },
    isSoftwareGl,
  );
  const accentMat = makeStd(
    {
      color: kind === 'battery' ? 0xf3b644 : 0x161616,
      emissive: kind === 'battery' ? 0xd98a16 : 0x222222,
      emissiveIntensity: kind === 'battery' ? 0.85 : 0.4,
      roughness: 0.25,
      metalness: 0.45,
    },
    isSoftwareGl,
  );

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(kind === 'battery' ? 0.28 : 0.36, 0.22, kind === 'battery' ? 0.2 : 0.26),
    baseMat,
  );
  body.position.y = 0.11;
  body.castShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(kind === 'battery' ? 0.3 : 0.38, 0.04, kind === 'battery' ? 0.22 : 0.28),
    accentMat,
  );
  lid.position.y = 0.23;
  group.add(lid);

  if (kind === 'medkit') {
    const crossMat = makeStd(
      {
        color: 0xd92626,
        emissive: 0x6b0f0f,
        emissiveIntensity: 0.48,
        roughness: 0.35,
      },
      isSoftwareGl,
    );
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.045), crossMat);
    bar1.position.y = 0.256;
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.015, 0.16), crossMat);
    bar2.position.y = 0.256;
    group.add(bar1, bar2);
  } else {
    // Dual brass/glow battery terminals
    for (const sx of [-0.065, 0.065]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.045, 10), accentMat);
      cap.position.set(sx, 0.27, 0);
      group.add(cap);
    }
  }

  addContactShadow(group, textures, 0.34, 0.52);
  return group;
}

/**
 * 12. Composite Watertight Submarine Exit Hatch with Pressure Wheel
 */
export function createExitDoor(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const frameMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x454e56,
      roughness: 0.55,
      metalness: 0.85,
    },
    isSoftwareGl,
  );
  const doorMat = makeStd(
    {
      map: textures.doorMap,
      normalMap: textures.doorNormal,
      roughness: 0.62,
      metalness: 0.55,
    },
    isSoftwareGl,
  );
  const wheelMat = makeStd(
    {
      color: 0xd94238,
      roughness: 0.4,
      metalness: 0.6,
    },
    isSoftwareGl,
  );
  const beaconMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    },
    isSoftwareGl,
  );

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.55, 0.14), doorMat);
  leaf.position.y = 1.275;
  leaf.receiveShadow = true;
  group.add(leaf);

  for (const fx of [-0.76, 0.76]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.68, 0.24), frameMat);
    post.position.set(fx, 1.34, 0);
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.16, 0.26), frameMat);
  lintel.position.set(0, 2.65, 0);
  group.add(lintel);

  // Submarine watertight locking wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.026, 8, 18), wheelMat);
  wheel.position.set(0, 1.15, 0.12);
  group.add(wheel);

  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), wheelMat);
    spoke.rotation.z = (i * Math.PI) / 3;
    spoke.position.set(0, 1.15, 0.12);
    group.add(spoke);
  }

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), beaconMat);
  beacon.position.set(0, 2.82, 0.14);
  group.add(beacon);

  return group;
}

/**
 * 13. Grounded 3D Killer Enemy ("Character_Killer_05" FBX + UAL2/UAL1 Retargeted Clips)
 */
export type KillerAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'attackAlt'
  | 'hit'
  | 'death';

export interface CreatureRig {
  group: THREE.Group;
  modelPivot: THREE.Group;
  hitboxMesh: THREE.Mesh;
  loaded: boolean;
  materials: THREE.MeshStandardMaterial[];
  mixer?: THREE.AnimationMixer;
  actions?: Record<KillerAnimState, THREE.AnimationAction>;
  activeOneShot: 'attack' | 'attackAlt' | 'hit' | 'death' | null;
  deathPlayed: boolean;
}

export function resetKillerAnimation(rig: CreatureRig): void {
  rig.activeOneShot = null;
  rig.deathPlayed = false;
  if (!rig.mixer || !rig.actions) return;

  rig.actions.attack.stop();
  rig.actions.attackAlt.stop();
  rig.actions.hit.stop();
  rig.actions.death.stop();

  rig.actions.idle.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  rig.actions.walk.reset().setEffectiveWeight(0).setEffectiveTimeScale(1).play();
  rig.actions.run.reset().setEffectiveWeight(0).setEffectiveTimeScale(1).play();
  rig.mixer.update(0);
}

export function createCreature(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
  onLoaded?: () => void,
): CreatureRig {
  const group = new THREE.Group();
  const modelPivot = new THREE.Group();
  group.add(modelPivot);

  // Grounded contact shadow disc beneath the killer's boots
  addContactShadow(group, textures, 0.68, 0.7);

  // Invisible proxy box sized to towering Character_Killer_05 (~2.26m tall standing figure)
  const hitboxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 2.24, 0.5),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitboxMesh.position.set(0, 1.12, 0);
  group.add(hitboxMesh);

  // Load Character_Killer_05.png explicitly in sRGB color space for 1-bit contrast fidelity
  const texLoader = new THREE.TextureLoader();
  const killerMap = texLoader.load('/assets/killer/Character_Killer_05.png');
  killerMap.colorSpace = THREE.SRGBColorSpace;
  killerMap.anisotropy = 4;

  const killerMat = makeStd(
    {
      map: killerMap,
      color: 0xe6e2da,
      roughness: 0.72,
      metalness: 0.06,
      side: THREE.DoubleSide,
    },
    isSoftwareGl,
  );

  const rig: CreatureRig = {
    group,
    modelPivot,
    hitboxMesh,
    loaded: false,
    materials: [killerMat],
    activeOneShot: null,
    deathPlayed: false,
  };

  // Redirect embedded FBX texture references to our local public PNG to avoid 404s
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) =>
    url.toLowerCase().includes('character_killer_05.png')
      ? '/assets/killer/Character_Killer_05.png'
      : url,
  );

  const fbxLoader = new FBXLoader(manager);

  Promise.all([
    new Promise<THREE.Group>((resolve, reject) =>
      fbxLoader.load('/assets/killer/Character_Killer_05.fbx', resolve, undefined, reject),
    ),
    fetch('/assets/killer/killer_animations.json').then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Partial<Record<KillerAnimState, THREE.AnimationClipJSON>>>;
    }),
  ])
    .then(([fbx, clipsJson]) => {
      let fbxSkinned: THREE.SkinnedMesh | undefined;

      fbx.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(() => killerMat)
            : killerMat;
          mesh.castShadow = !isSoftwareGl;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
        }
        if ((child as THREE.SkinnedMesh).isSkinnedMesh && !fbxSkinned) {
          fbxSkinned = child as THREE.SkinnedMesh;
        }
      });

      if (fbxSkinned) {
        const mixer = new THREE.AnimationMixer(fbxSkinned);
        const actions = {} as Record<KillerAnimState, THREE.AnimationAction>;
        const states: KillerAnimState[] = [
          'idle',
          'walk',
          'run',
          'attack',
          'attackAlt',
          'hit',
          'death',
        ];

        for (const state of states) {
          const raw = clipsJson[state];
          const clip = raw
            ? THREE.AnimationClip.parse(raw)
            : new THREE.AnimationClip(state, 0.5, []);
          const action = mixer.clipAction(clip);

          if (state === 'idle' || state === 'walk' || state === 'run') {
            action.loop = THREE.LoopRepeat;
            action.setEffectiveWeight(state === 'idle' ? 1 : 0);
            action.play();
          } else {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = state === 'death';
            if (state === 'attackAlt') action.timeScale = 1.45;
          }

          actions[state] = action;
        }

        mixer.addEventListener('finished', (ev) => {
          if (
            ev.action === actions.attack ||
            ev.action === actions.attackAlt ||
            ev.action === actions.hit
          ) {
            ev.action.fadeOut(0.14);
            if (rig.activeOneShot !== 'death') {
              rig.activeOneShot = null;
            }
          }
        });

        rig.mixer = mixer;
        rig.actions = actions;
      }

      // Scale up (~2.26m towering stature) & center boots horizontally over (0, 0) flush on floor y = 0
      fbx.scale.setScalar(1.22);
      fbx.position.set(0.078, 0.005, -0.024);
      modelPivot.add(fbx);
      rig.loaded = true;
      onLoaded?.();
    })
    .catch((err) => {
      console.error('Failed to load Character_Killer_05 or killer_animations.json:', err);
    });

  return rig;
}

/**
 * 14. Composite Hinged Sanatorium Room Door (fills full 2.4m x 3.1m cell doorway with frame + transom)
 */
export interface InteriorDoorRig {
  group: THREE.Group;
  doorPivot: THREE.Group;
  boltMesh: THREE.Mesh;
}

export function createInteriorDoor(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): InteriorDoorRig {
  const group = new THREE.Group();

  const wallFillMat = makeStd(
    {
      map: textures.wallMap,
      normalMap: textures.wallNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: textures.wallRoughness,
      roughness: 0.92,
      metalness: 0.05,
    },
    isSoftwareGl,
  );
  const frameMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x3b3e45,
      roughness: 0.56,
      metalness: 0.78,
    },
    isSoftwareGl,
  );
  const leafMat = makeStd(
    {
      map: textures.doorMap,
      normalMap: textures.doorNormal,
      color: 0xbcb6aa,
      roughness: 0.68,
      metalness: 0.25,
    },
    isSoftwareGl,
  );
  const glassMat = makeStd(
    {
      map: textures.windowGlowMap,
      color: 0x9aa4b0,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      metalness: 0.1,
    },
    isSoftwareGl,
  );

  // Opening width = 1.28m, opening height = 2.50m (killer is 2.26m -> clears cleanly!)
  const openW = 1.28;
  const openH = 2.50;
  const sideW = (CELL_SIZE - openW) / 2; // 0.56m wall fill per side
  const wallThick = 0.28;

  // Left & Right masonry wall fills connecting seamlessly to adjoining cell blocks
  for (const sx of [-openW / 2 - sideW / 2, openW / 2 + sideW / 2]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, WALL_HEIGHT, wallThick), wallFillMat);
    sideWall.position.set(sx, WALL_HEIGHT / 2, 0);
    sideWall.castShadow = !isSoftwareGl;
    sideWall.receiveShadow = true;
    group.add(sideWall);
  }

  // Upper transom wall above door lintel
  const transomH = WALL_HEIGHT - openH;
  const transom = new THREE.Mesh(new THREE.BoxGeometry(openW, transomH, wallThick), wallFillMat);
  transom.position.set(0, openH + transomH / 2, 0);
  transom.castShadow = !isSoftwareGl;
  transom.receiveShadow = true;
  group.add(transom);

  // Heavy steel jambs & lintel
  for (const jx of [-openW / 2 + 0.03, openW / 2 - 0.03]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.07, openH, wallThick + 0.06), frameMat);
    jamb.position.set(jx, openH / 2, 0);
    group.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(openW + 0.08, 0.08, wallThick + 0.06), frameMat);
  lintel.position.set(0, openH - 0.04, 0);
  group.add(lintel);

  // Hinged Door Leaf pivoted at left jamb (-openW / 2 + 0.06)
  const leafW = openW - 0.12;
  const leafH = openH - 0.08;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-leafW / 2, 0, 0);

  // Lower & upper solid door sections leaving an eye-level barred vision window
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(leafW, 1.48, 0.07), leafMat);
  lowerBody.position.set(leafW / 2, 0.74, 0);
  lowerBody.castShadow = !isSoftwareGl;
  lowerBody.receiveShadow = true;

  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.42, 0.07), leafMat);
  upperBody.position.set(leafW / 2, leafH - 0.21, 0);
  upperBody.castShadow = !isSoftwareGl;

  // Side stiles flanking vision window (y = 1.48 .. 2.00)
  for (const stX of [0.16, leafW - 0.16]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.52, 0.07), leafMat);
    stile.position.set(stX, 1.74, 0);
    doorPivot.add(stile);
  }

  // Frosted peep pane + 2 security bars
  const pane = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.64, 0.5, 0.02), glassMat);
  pane.position.set(leafW / 2, 1.74, 0);
  doorPivot.add(pane);

  for (const bx of [leafW / 2 - 0.12, leafW / 2 + 0.12]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), frameMat);
    bar.position.set(bx, 1.74, 0);
    doorPivot.add(bar);
  }

  // Door handle latches (front & back)
  for (const hz of [-0.055, 0.055]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), frameMat);
    handle.position.set(leafW - 0.16, 1.04, hz);
    doorPivot.add(handle);
  }

  // Sliding steel deadbolt lock indicator (shifts outward into jamb when locked)
  const boltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.095), frameMat);
  boltMesh.position.set(leafW - 0.14, 1.24, 0);
  doorPivot.add(boltMesh);

  doorPivot.add(lowerBody, upperBody);
  group.add(doorPivot);

  return { group, doorPivot, boltMesh };
}

/**
 * 15. Collectible Brass Exit Master Key + Wooden Pedestal Desk
 */
export function createMasterKeyItem(
  _textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const brassMat = makeStd(
    {
      color: 0xf4d27a,
      emissive: 0x7a5b14,
      emissiveIntensity: 0.72,
      roughness: 0.25,
      metalness: 0.92,
    },
    isSoftwareGl,
  );
  const tagMat = makeStd(
    {
      color: 0xd92626,
      emissive: 0x5c0c0c,
      emissiveIntensity: 0.5,
      roughness: 0.6,
    },
    isSoftwareGl,
  );

  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 8, 16), brassMat);
  bow.position.y = 0.08;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 8), brassMat);
  shaft.position.set(0, -0.04, 0);
  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.016, 0.016), brassMat);
  tooth1.position.set(0.025, -0.09, 0);
  const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.016), brassMat);
  tooth2.position.set(0.02, -0.115, 0);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.01), tagMat);
  tag.position.set(-0.07, 0.06, 0);
  tag.rotation.z = 0.25;

  group.add(bow, shaft, tooth1, tooth2, tag);
  return group;
}

/**
 * 16. Interactive Wall Power Breaker Panel (with animated lever & status beacon)
 */
export interface PowerBreakerRig {
  group: THREE.Group;
  leverPivot: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
}

export function createPowerBreakerPanel(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): PowerBreakerRig {
  const group = new THREE.Group();
  const steelMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x5a6068,
      roughness: 0.48,
      metalness: 0.85,
    },
    isSoftwareGl,
  );
  const darkMat = makeStd(
    {
      color: 0x16181c,
      roughness: 0.8,
      metalness: 0.2,
    },
    isSoftwareGl,
  );
  const beaconMat = makeStd(
    {
      color: 0xff463d,
      emissive: 0xff463d,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    },
    isSoftwareGl,
  );

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.82, 0.22), steelMat);
  box.position.set(0, 1.48, 0.11);
  box.castShadow = !isSoftwareGl;
  group.add(box);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.04), darkMat);
  face.position.set(0, 1.48, 0.22);
  group.add(face);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), beaconMat);
  beacon.position.set(0, 1.74, 0.25);
  group.add(beacon);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.32, 1.48, 0.14);
  leverPivot.rotation.x = 0.65;

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8), steelMat);
  arm.position.y = 0.14;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), beaconMat);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0.04, 0.26, 0);
  leverPivot.add(arm, grip);
  group.add(leverPivot);

  return { group, leverPivot, beaconMat };
}

export interface LockerRig {
  group: THREE.Group;
  doorPivot: THREE.Group;
}

/**
 * 15. Composite Hideable Asylum Steel Locker with eye-level viewing slats
 */
export function createHidingLocker(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): LockerRig {
  const group = new THREE.Group();
  const steelMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x5c626a,
      roughness: 0.52,
      metalness: 0.72,
    },
    isSoftwareGl,
  );
  const darkInnerMat = makeStd(
    {
      color: 0x16181c,
      roughness: 0.9,
      metalness: 0.15,
    },
    isSoftwareGl,
  );

  // Back, left/right walls, roof & floor (0.82m wide x 2.08m tall x 0.68m deep)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.08, 0.04), steelMat);
  back.position.set(0, 1.04, -0.32);
  back.receiveShadow = true;

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.08, 0.68), steelMat);
  leftWall.position.set(-0.39, 1.04, 0);
  leftWall.castShadow = true;

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.08, 0.68), steelMat);
  rightWall.position.set(0.39, 1.04, 0);
  rightWall.castShadow = true;

  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.7), steelMat);
  topPlate.position.set(0, 2.06, 0);

  const floorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.66), darkInnerMat);
  floorPlate.position.set(0, 0.02, 0);

  group.add(back, leftWall, rightWall, topPlate, floorPlate);

  // Hinged Front Door pivoted on left edge (x=-0.38, z=+0.33)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.38, 0, 0.33);

  // Lower solid door panel (y=0.05..1.43)
  const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.38, 0.03), steelMat);
  lowerPanel.position.set(0.38, 0.74, 0);
  lowerPanel.castShadow = true;
  doorPivot.add(lowerPanel);

  // Upper solid header panel (y=1.74..2.02)
  const upperPanel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.28, 0.03), steelMat);
  upperPanel.position.set(0.38, 1.88, 0);
  doorPivot.add(upperPanel);

  // Side vertical stiles framing the eye-level peep slats (y=1.43..1.74)
  for (const sx of [0.05, 0.71]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.31, 0.03), steelMat);
    stile.position.set(sx, 1.585, 0);
    doorPivot.add(stile);
  }

  // Horizontal louvered slats at eye height (1.46..1.71) leaving open viewing gaps
  for (const sy of [1.47, 1.54, 1.61, 1.68]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.026, 0.025), steelMat);
    slat.position.set(0.38, sy, 0);
    doorPivot.add(slat);
  }

  // Door handle latch
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.045), darkInnerMat);
  latch.position.set(0.68, 1.05, 0.025);
  doorPivot.add(latch);

  group.add(doorPivot);
  addContactShadow(group, textures, 0.75, 0.58);
  return { group, doorPivot };
}

/**
 * 16. Gaunt Shadow Silhouette for Horror Window Events
 */
export function createWindowSilhouette(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x040406 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.88, 0.24), mat);
  torso.position.y = 0.44;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
  head.scale.set(0.85, 1.15, 0.9);
  head.position.y = 1.06;
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.22), mat);
  shoulder.position.y = 0.78;
  g.add(torso, head, shoulder);
  g.visible = false;
  return g;
}

/**
 * 17. Composite 4-part Collectible Glass Apothecary Bottle (bottom-center pivot at y=0)
 */
export function createGlassBottleItem(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const glassMat = makeStd(
    {
      color: 0xdce8e2,
      emissive: 0x354842,
      emissiveIntensity: 0.45,
      roughness: 0.14,
      metalness: 0.12,
    },
    isSoftwareGl,
  );
  const labelMat = makeStd(
    {
      map: textures.paperMap,
      color: 0xe6e0d0,
      roughness: 0.88,
      metalness: 0.02,
    },
    isSoftwareGl,
  );
  const corkMat = makeStd(
    {
      color: 0x6e4e32,
      roughness: 0.92,
      metalness: 0.0,
    },
    isSoftwareGl,
  );

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.19, 12), glassMat);
  body.position.y = 0.095;
  body.castShadow = !isSoftwareGl;

  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.055, 0.055, 12), glassMat);
  shoulder.position.y = 0.215;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.055, 10), glassMat);
  neck.position.y = 0.268;

  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.03, 8), corkMat);
  cork.position.y = 0.305;

  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.09, 12, 1, true, -0.9, 1.8), labelMat);
  label.position.y = 0.1;

  group.add(body, shoulder, neck, cork, label);
  addContactShadow(group, textures, 0.2, 0.48);
  return group;
}

/**
 * 18. Thrown Bottle Projectile Mesh (centered pivot for mid-air spin)
 */
export function createThrownBottleMesh(isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();
  const glassMat = makeStd(
    {
      color: 0xe4ece8,
      emissive: 0x455850,
      emissiveIntensity: 0.5,
      roughness: 0.15,
      metalness: 0.15,
    },
    isSoftwareGl,
  );
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.16, 10), glassMat);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.042, 0.08, 8), glassMat);
  neck.position.y = 0.12;
  group.add(body, neck);
  return group;
}

/**
 * 19. Composite 6-part Mechanical Nurse-Call Alarm / Wind-Up Decoy Stand
 */
export interface AlarmDecoyRig {
  group: THREE.Group;
  hammerPivot: THREE.Group;
  beaconMat: THREE.MeshStandardMaterial;
}

export function createAlarmDecoy(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): AlarmDecoyRig {
  const group = new THREE.Group();
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x3b3e44,
      roughness: 0.56,
      metalness: 0.84,
    },
    isSoftwareGl,
  );
  const brassMat = makeStd(
    {
      color: 0xd4b66a,
      roughness: 0.28,
      metalness: 0.9,
    },
    isSoftwareGl,
  );
  const beaconMat = makeStd(
    {
      color: 0x808080,
      emissive: 0x222222,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    },
    isSoftwareGl,
  );

  // Stand column + base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 12), ironMat);
  base.position.y = 0.03;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 1.04, 10), ironMat);
  post.position.y = 0.55;
  post.castShadow = !isSoftwareGl;

  // Timer casing box
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.16), ironMat);
  housing.position.set(0, 1.16, 0);
  housing.castShadow = !isSoftwareGl;

  // Twin brass alarm bells on top
  for (const bx of [-0.08, 0.08]) {
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
      brassMat,
    );
    bell.position.set(bx, 1.32, 0);
    group.add(bell);
  }

  // Oscillating striker hammer
  const hammerPivot = new THREE.Group();
  hammerPivot.position.set(0, 1.3, 0);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), ironMat);
  stem.position.y = 0.04;
  const striker = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), brassMat);
  striker.position.y = 0.08;
  hammerPivot.add(stem, striker);

  // Status indicator jewel
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), beaconMat);
  beacon.position.set(0, 1.18, 0.09);

  group.add(base, post, housing, hammerPivot, beacon);
  addContactShadow(group, textures, 0.34, 0.55);
  return { group, hammerPivot, beaconMat };
}

/**
 * 20. Floor Broken Glass Hazard Patch (14 jagged reflective shards flush on y=0.008)
 */
export function createBrokenGlassPatch(
  _textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const shardMat = makeStd(
    {
      color: 0xeef6f8,
      emissive: 0x303c42,
      emissiveIntensity: 0.38,
      roughness: 0.08,
      metalness: 0.72,
    },
    isSoftwareGl,
  );

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.35;
    const r = 0.08 + ((i * 37) % 10) * 0.055;
    const sx = 0.06 + ((i * 19) % 7) * 0.018;
    const sz = 0.035 + ((i * 23) % 5) * 0.012;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(sx, sz * 2.2, 3), shardMat);
    shard.rotation.x = Math.PI / 2;
    shard.rotation.z = a * 1.7;
    shard.scale.set(1.0, 1.0, 0.14);
    shard.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    group.add(shard);
  }
  return group;
}

/**
 * 21. Composite Tippable Heavy Utility Cart / Barricade Obstacle
 */
export interface BarricadeObstacleRig {
  group: THREE.Group;
  tiltPivot: THREE.Group;
}

export function createBarricadeObstacle(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): BarricadeObstacleRig {
  const group = new THREE.Group();
  const steelMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x767c84,
      roughness: 0.45,
      metalness: 0.84,
    },
    isSoftwareGl,
  );
  const padMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0x9c968c,
      roughness: 0.9,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  // Pivot sits at bottom edge so tipping rotates smoothly onto floor without clipping
  const tiltPivot = new THREE.Group();
  tiltPivot.position.set(0, 0.02, -0.34);

  const deckTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.68), steelMat);
  deckTop.position.set(0, 0.96, 0.34);
  deckTop.castShadow = !isSoftwareGl;

  const deckMid = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 0.62), padMat);
  deckMid.position.set(0, 0.46, 0.34);

  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.64), steelMat);
  railLeft.position.set(-0.66, 1.14, 0.34);
  const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.64), steelMat);
  railRight.position.set(0.66, 1.14, 0.34);

  const legGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.94, 8);
  for (const [lx, lz] of [
    [-0.62, 0.06],
    [0.62, 0.06],
    [-0.62, 0.62],
    [0.62, 0.62],
  ]) {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(lx, 0.48, lz);
    leg.castShadow = !isSoftwareGl;
    tiltPivot.add(leg);
  }

  tiltPivot.add(deckTop, deckMid, railLeft, railRight);
  group.add(tiltPivot);
  addContactShadow(group, textures, 1.0, 0.56);
  return { group, tiltPivot };
}

/**
 * 22. Composite 6-part Improvised Steel Snare / Clamp Trap (bottom-center pivot at y=0)
 */
export interface FloorTrapRig {
  group: THREE.Group;
  leftJaw: THREE.Group;
  rightJaw: THREE.Group;
  plate: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
}

export function createFloorTrap(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): FloorTrapRig {
  const group = new THREE.Group();
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x42464c,
      roughness: 0.52,
      metalness: 0.88,
    },
    isSoftwareGl,
  );
  const ringMat = makeStd(
    {
      color: 0xd94238,
      emissive: 0x6b1812,
      emissiveIntensity: 0.65,
      roughness: 0.32,
      metalness: 0.4,
    },
    isSoftwareGl,
  );

  // Base crossbar & coiled spring cylinder
  const baseBar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.03, 0.14), ironMat);
  baseBar.position.y = 0.015;
  const springCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 10), ironMat);
  springCoil.rotation.z = Math.PI / 2;
  springCoil.position.set(0.24, 0.045, 0);

  // Center pressure trigger plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.032, 12), ringMat);
  plate.position.y = 0.035;

  // Dual hinged toothed jaws (open flat on ground when armed, snap upright when sprung)
  const makeJaw = (sign: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.04, sign * 0.06);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.018, 6, 14, Math.PI),
      ironMat,
    );
    arc.rotation.x = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    pivot.add(arc);
    for (let t = -2; t <= 2; t++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 4), ironMat);
      tooth.position.set(t * 0.07, 0.022, sign * 0.18);
      pivot.add(tooth);
    }
    return pivot;
  };

  const leftJaw = makeJaw(-1);
  const rightJaw = makeJaw(1);

  group.add(baseBar, springCoil, plate, leftJaw, rightJaw);
  addContactShadow(group, textures, 0.36, 0.5);
  return { group, leftJaw, rightJaw, plate, ringMat };
}

/**
 * 23. Composite 4-part Caged Crimson Emergency Wall Bulkhead Light
 */
export interface EmergencySconceRig {
  group: THREE.Group;
  lensMat: THREE.MeshStandardMaterial;
}

export function createEmergencySconce(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): EmergencySconceRig {
  const group = new THREE.Group();
  const castMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x2d3036,
      roughness: 0.6,
      metalness: 0.86,
    },
    isSoftwareGl,
  );
  const lensMat = makeStd(
    {
      color: 0xff281c,
      emissive: 0xff1e14,
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  // Wall flange backplate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.04), castMat);
  plate.position.set(0, 2.38, 0.02);

  // Hood shroud
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.08, 12), castMat);
  hood.rotation.x = Math.PI / 2;
  hood.position.set(0, 2.38, 0.06);

  // Crimson glass dome
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), lensMat);
  lens.scale.set(1, 1.25, 0.72);
  lens.position.set(0, 2.38, 0.08);

  // Steel protective cage ribs
  for (const angle of [-0.55, 0, 0.55]) {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.008, 6, 12, Math.PI), castMat);
    bar.rotation.y = angle;
    bar.position.set(0, 2.38, 0.08);
    group.add(bar);
  }

  group.add(plate, hood, lens);
  return { group, lensMat };
}

/**
 * 24. Volumetric Dust Beam Cone attached in front of handheld flashlight
 */
export function createFlashlightBeamCone(): THREE.Mesh {
  const height = 8.5;
  const geo = new THREE.CylinderGeometry(0.07, 2.35, height, 20, 1, true);
  // Orient apex at origin extending along -Z
  geo.translate(0, -height * 0.5, 0);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(-z / height, 0, 1);
    const fade = Math.pow(1 - t, 1.9) * THREE.MathUtils.smoothstep(t, 0.02, 0.18);
    colors[i * 3] = 0.92 * fade;
    colors[i * 3 + 1] = 0.88 * fade;
    colors[i * 3 + 2] = 0.76 * fade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.09,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * 25. Resident-Evil Style 3rd-Person Playable Survivor ("Character_27_HM" FBX + Retargeted Mixamo Clips)
 */
export type PlayerAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'crouchWalk'
  | 'pistolWalk'
  | 'pistolWalkBack'
  | 'hit'
  | 'death';

export interface PlayerRig {
  group: THREE.Group;
  modelPivot: THREE.Group;
  loaded: boolean;
  materials: THREE.MeshStandardMaterial[];
  flashlightLensMat: THREE.MeshStandardMaterial;
  mixer?: THREE.AnimationMixer;
  actions?: Record<PlayerAnimState, THREE.AnimationAction>;
  activeOneShot: 'hit' | 'death' | null;
  deathPlayed: boolean;
}

export function resetPlayerAnimation(rig: PlayerRig): void {
  rig.activeOneShot = null;
  rig.deathPlayed = false;
  if (!rig.mixer || !rig.actions) return;

  rig.actions.hit.stop();
  rig.actions.death.stop();

  const loops: PlayerAnimState[] = [
    'idle',
    'walk',
    'run',
    'crouchWalk',
    'pistolWalk',
    'pistolWalkBack',
  ];
  for (const state of loops) {
    rig.actions[state]
      .reset()
      .setEffectiveWeight(state === 'idle' ? 1 : 0)
      .setEffectiveTimeScale(1)
      .play();
  }
  rig.mixer.update(0);
}

export function createPlayerCharacter(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
  onLoaded?: () => void,
): PlayerRig {
  const group = new THREE.Group();
  const modelPivot = new THREE.Group();
  // Character_27_HM faces +Z natively; rotate PI so local -Z aligns with player camera forward
  modelPivot.rotation.y = Math.PI;
  group.add(modelPivot);

  addContactShadow(group, textures, 0.52, 0.62);

  const texLoader = new THREE.TextureLoader();
  const playerMap = texLoader.load('/assets/player/Character_27_HM.png');
  playerMap.colorSpace = THREE.SRGBColorSpace;
  playerMap.anisotropy = 4;

  const playerMat = makeStd(
    {
      map: playerMap,
      color: 0xf0ede6,
      roughness: 0.74,
      metalness: 0.06,
      side: THREE.DoubleSide,
    },
    isSoftwareGl,
  );

  const flashlightBodyMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x26292e,
      roughness: 0.4,
      metalness: 0.88,
    },
    isSoftwareGl,
  );

  const flashlightLensMat = makeStd(
    {
      color: 0xfff6e0,
      emissive: 0xffe8b8,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  const rig: PlayerRig = {
    group,
    modelPivot,
    loaded: false,
    materials: [playerMat, flashlightBodyMat, flashlightLensMat],
    flashlightLensMat,
    activeOneShot: null,
    deathPlayed: false,
  };

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) =>
    url.toLowerCase().includes('character_27_hm.png')
      ? '/assets/player/Character_27_HM.png'
      : url,
  );

  const fbxLoader = new FBXLoader(manager);

  Promise.all([
    new Promise<THREE.Group>((resolve, reject) =>
      fbxLoader.load('/assets/player/Character_27_HM.fbx', resolve, undefined, reject),
    ),
    fetch('/assets/player/player_animations.json').then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Partial<Record<PlayerAnimState, THREE.AnimationClipJSON>>>;
    }),
  ])
    .then(([fbx, clipsJson]) => {
      let fbxSkinned: THREE.SkinnedMesh | undefined;
      let rightHandBone: THREE.Bone | undefined;

      fbx.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(() => playerMat)
            : playerMat;
          mesh.castShadow = !isSoftwareGl;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
        }
        if ((child as THREE.SkinnedMesh).isSkinnedMesh && !fbxSkinned) {
          fbxSkinned = child as THREE.SkinnedMesh;
        }
        if ((child as THREE.Bone).isBone && child.name === 'mixamorigRightHand') {
          rightHandBone = child as THREE.Bone;
        }
      });

      // Attach compact handheld tactical flashlight into right hand (+Y aims forward in pistolWalk)
      if (rightHandBone) {
        const torchGroup = new THREE.Group();
        torchGroup.position.set(0.012, 0.085, 0.014);

        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.02, 0.16, 10),
          flashlightBodyMat,
        );
        const bezel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.02, 0.045, 10),
          flashlightBodyMat,
        );
        bezel.position.y = 0.095;
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 10), flashlightLensMat);
        lens.rotation.x = -Math.PI / 2;
        lens.position.y = 0.119;

        torchGroup.add(handle, bezel, lens);
        rightHandBone.add(torchGroup);
      }

      if (fbxSkinned) {
        const mixer = new THREE.AnimationMixer(fbxSkinned);
        const actions = {} as Record<PlayerAnimState, THREE.AnimationAction>;
        const states: PlayerAnimState[] = [
          'idle',
          'walk',
          'run',
          'crouchWalk',
          'pistolWalk',
          'pistolWalkBack',
          'hit',
          'death',
        ];

        for (const state of states) {
          const raw = clipsJson[state];
          const clip = raw
            ? THREE.AnimationClip.parse(raw)
            : new THREE.AnimationClip(state, 0.5, []);
          const action = mixer.clipAction(clip);

          if (state === 'hit' || state === 'death') {
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = state === 'death';
          } else {
            action.loop = THREE.LoopRepeat;
            action.setEffectiveWeight(state === 'idle' ? 1 : 0);
            action.play();
          }

          actions[state] = action;
        }

        mixer.addEventListener('finished', (ev) => {
          if (ev.action === actions.hit) {
            ev.action.fadeOut(0.14);
            if (rig.activeOneShot !== 'death') {
              rig.activeOneShot = null;
            }
          }
        });

        rig.mixer = mixer;
        rig.actions = actions;
      }

      fbx.position.set(0.02, 0.005, 0);
      modelPivot.add(fbx);
      rig.loaded = true;
      onLoaded?.();
    })
    .catch((err) => {
      console.error('Failed to load Character_27_HM or player_animations.json:', err);
    });

  return rig;
}


