import * as THREE from 'three';
import { SanatoriumTextures } from './textures';
import { applySoftwareBayerDither } from './DitherPostProcess';
import { WALL_HEIGHT } from './mapData';
import bodySpriteUrl from '../assets/images/ceiling_thing_body_v2_1795552263612.jpg';
import bodyBackSpriteUrl from '../assets/images/ceiling_thing_body_back_v2_1795552265230.jpg';
import headSpriteUrl from '../assets/images/ceiling_thing_head_v2_1795552265072.jpg';
import headBackSpriteUrl from '../assets/images/ceiling_thing_head_back_v2_1795552265860.jpg';
import armSpriteUrl from '../assets/images/ceiling_thing_arm_v2_1795552265462.jpg';
import legSpriteUrl from '../assets/images/ceiling_thing_leg_v2_1795552267003.jpg';

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
 * 3. Composite 8-part Iron Hospital Gurney (bottom-center pivot at y=0)
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
      color: 0x70757c,
      roughness: 0.45,
      metalness: 0.88,
    },
    isSoftwareGl,
  );
  const mattressMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0xc2beb4,
      roughness: 0.94,
      metalness: 0.0,
    },
    isSoftwareGl,
  );

  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.07, 1.88), steelMat);
  deck.position.y = 0.72;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 1.8), mattressMat);
  mattress.position.y = 0.82;
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  group.add(mattress);

  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.32), mattressMat);
  pillow.position.set(0.04, 0.92, -0.68);
  pillow.rotation.y = 0.18;
  group.add(pillow);

  const legGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.66, 8);
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
    new THREE.Vector3(-0.38, 1.18, -0.92),
    new THREE.Vector3(0.38, 1.18, -0.92),
    new THREE.Vector3(0.4, 0.74, -0.92),
  ]);
  const headRail = new THREE.Mesh(new THREE.TubeGeometry(headCurve, 16, 0.02, 8, false), steelMat);
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
 * 5. Composite 6-part Hospital IV Drip Stand (bottom-center pivot at y=0)
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
      color: 0xaab0b8,
      roughness: 0.25,
      metalness: 0.92,
    },
    isSoftwareGl,
  );
  const glassMat = makeStd(
    {
      color: 0xe6eae8,
      roughness: 0.14,
      metalness: 0.1,
    },
    isSoftwareGl,
  );
  const tubeMat = makeStd(
    {
      color: 0x26282a,
      roughness: 0.85,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  // Base hub + 4 radial legs
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.08, 10), chromeMat);
  hub.position.y = 0.08;
  group.add(hub);

  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.34), chromeMat);
    leg.position.set(Math.sin(a) * 0.15, 0.045, Math.cos(a) * 0.15);
    leg.rotation.y = a;
    leg.castShadow = true;
    group.add(leg);
  }

  // Tall telescopic vertical pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1.92, 10), chromeMat);
  pole.position.y = 1.0;
  pole.castShadow = true;
  group.add(pole);

  // Curved top hook arm
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.16, 1.88, 0),
    new THREE.Vector3(-0.12, 1.98, 0),
    new THREE.Vector3(0.12, 1.98, 0),
    new THREE.Vector3(0.16, 1.88, 0),
  ]);
  const hook = new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 14, 0.01, 6, false), chromeMat);
  group.add(hook);

  // Hanging glass IV bottle
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 12), glassMat);
  bottle.position.set(0.14, 1.72, 0);
  bottle.castShadow = true;
  group.add(bottle);

  // Dangling rubber drip tube
  const dripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, 1.63, 0),
    new THREE.Vector3(0.18, 1.25, 0.05),
    new THREE.Vector3(0.07, 0.85, -0.04),
    new THREE.Vector3(0.12, 0.52, 0.03),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(dripCurve, 16, 0.008, 5, false), tubeMat);
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
 * 7. Composite 5-part Barred Asylum Security Window (wall-mounted)
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
      color: 0x2c2e32,
      roughness: 0.62,
      metalness: 0.85,
    },
    isSoftwareGl,
  );
  const paneMat = makeStd(
    {
      map: textures.windowGlowMap,
      emissive: 0xdce4ee,
      emissiveMap: textures.windowGlowMap,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    },
    isSoftwareGl,
  );

  // Frosted moonlight glass pane
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.22), paneMat);
  pane.position.set(0, 1.82, 0.03);
  group.add(pane);

  // Heavy outer iron frame bars
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.14), ironMat);
  sill.position.set(0, 1.18, 0.05);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.14), ironMat);
  lintel.position.set(0, 2.45, 0.05);
  group.add(sill, lintel);

  for (const fx of [-0.47, 0.47]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.32, 0.12), ironMat);
    jamb.position.set(fx, 1.82, 0.05);
    group.add(jamb);
  }

  // 4 Vertical Prison Bars
  for (const bx of [-0.26, -0.085, 0.085, 0.26]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.24, 8), ironMat);
    bar.position.set(bx, 1.82, 0.065);
    bar.castShadow = true;
    group.add(bar);
  }

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
 * 11. Composite Pickup Box (Ammo or Medkit, bottom-center pivot at y=0)
 */
export function createPickupBox(
  kind: 'ammo' | 'medkit',
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const baseMat = makeStd(
    {
      map: kind === 'ammo' ? textures.metalMap : textures.fabricMap,
      color: kind === 'ammo' ? 0x9aa0a8 : 0xe4e4de,
      roughness: kind === 'ammo' ? 0.42 : 0.72,
      metalness: kind === 'ammo' ? 0.78 : 0.08,
    },
    isSoftwareGl,
  );
  const accentMat = makeStd(
    {
      color: kind === 'ammo' ? 0xffffff : 0x161616,
      emissive: kind === 'ammo' ? 0x555555 : 0x222222,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.4,
    },
    isSoftwareGl,
  );

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.26), baseMat);
  body.position.y = 0.11;
  body.castShadow = true;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.28), accentMat);
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
    for (const sx of [-0.07, 0.07]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.18), accentMat);
      strip.position.set(sx, 0.256, 0);
      group.add(strip);
    }
  }

  addContactShadow(group, textures, 0.34, 0.52);
  return group;
}

/**
 * 12. Composite 5-part Reinforced Asylum Exit Door
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
      color: 0x45484e,
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
  const beaconMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
      roughness: 0.2,
    },
    isSoftwareGl,
  );

  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.55, 0.12), doorMat);
  leaf.position.y = 1.275;
  leaf.receiveShadow = true;
  group.add(leaf);

  for (const fx of [-0.76, 0.76]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.68, 0.2), frameMat);
    post.position.set(fx, 1.34, 0);
    group.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.14, 0.22), frameMat);
  lintel.position.set(0, 2.65, 0);
  group.add(lintel);

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8), frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.08, 0.1);
  group.add(bar);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), beaconMat);
  beacon.position.set(0, 2.82, 0.12);
  group.add(beacon);

  return group;
}

/**
 * 13. Layered 2.5D Articulated Ceiling Horror ("A Coisa do Teto")
 * Uses chroma-keyed + despilled high-detail horror illustration cutouts with
 * generated normal maps and alpha-cutout depth shadows, rigged upside-down on ceiling planks.
 */
export interface CreatureRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  bodyFrontMesh: THREE.Mesh;
  bodyBackMesh: THREE.Mesh;
  head: THREE.Group;
  headFrontMesh: THREE.Mesh;
  headBackMesh: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

function loadChromaCutoutSprite(url: string): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const S = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = S;
  colorCanvas.height = S;
  const cCtx = colorCanvas.getContext('2d')!;
  cCtx.clearRect(0, 0, S, S);

  const normCanvas = document.createElement('canvas');
  normCanvas.width = S;
  normCanvas.height = S;
  const nCtx = normCanvas.getContext('2d')!;
  nCtx.fillStyle = 'rgb(128,128,255)';
  nCtx.fillRect(0, 0, S, S);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = THREE.ClampToEdgeWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    cCtx.drawImage(img, 0, 0, S, S);
    const imgData = cCtx.getImageData(0, 0, S, S);
    const d = imgData.data;
    const heights = new Float32Array(S * S);

    for (let i = 0; i < S * S; i++) {
      const idx = i * 4;
      let r = d[idx];
      let g = d[idx + 1];
      let b = d[idx + 2];
      const maxRB = Math.max(r, b);
      const greenness = g - maxRB;

      if (greenness > 20 && g > 58) {
        d[idx + 3] = 0;
        heights[i] = 0;
      } else {
        if (greenness > 3) {
          g = maxRB + 1;
          if (greenness > 11) {
            const fade = Math.max(0, 1 - (greenness - 11) / 11);
            r = Math.round(r * fade);
            g = Math.round(g * fade);
            b = Math.round(b * fade);
          }
        }
        // Subtle chiaroscuro contrast stretch so pale highlights and ink crosshatching read sharply in 1-bit
        r = Math.min(255, Math.max(0, Math.round((r - 14) * 1.1)));
        g = Math.min(255, Math.max(0, Math.round((g - 14) * 1.1)));
        b = Math.min(255, Math.max(0, Math.round((b - 14) * 1.1)));
        d[idx] = r;
        d[idx + 1] = g;
        d[idx + 2] = b;
        d[idx + 3] = 255;
        heights[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      }
    }
    cCtx.putImageData(imgData, 0, 0);
    map.needsUpdate = true;

    // Build tangent-space normal map from sprite shading for reactive flashlight relief
    const nImg = nCtx.createImageData(S, S);
    const nd = nImg.data;
    for (let y = 0; y < S; y++) {
      const ym = Math.max(0, y - 1);
      const yp = Math.min(S - 1, y + 1);
      for (let x = 0; x < S; x++) {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(S - 1, x + 1);
        const dx = (heights[y * S + xm] - heights[y * S + xp]) * 2.2;
        const dy = (heights[ym * S + x] - heights[yp * S + x]) * 2.2;
        const len = Math.hypot(dx, dy, 1);
        const idx = (y * S + x) * 4;
        nd[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
        nd[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
        nd[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
        nd[idx + 3] = 255;
      }
    }
    nCtx.putImageData(nImg, 0, 0);
    normalMap.needsUpdate = true;
  };
  img.src = url;

  return { map, normalMap };
}

function makeCurvedCutoutGeo(
  width: number,
  height: number,
  bowZ: number,
  flipU = false,
): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 6, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) / (width * 0.5));
    const ny = (pos.getY(i) / (height * 0.5));
    const arch = Math.max(0, 1 - nx * nx * 0.65) * Math.max(0.25, 1 - ny * ny * 0.35);
    pos.setZ(i, pos.getZ(i) + arch * bowZ);
    if (flipU) {
      uv.setX(i, 1 - uv.getX(i));
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function makeSpriteCutoutMaterial(
  sprite: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture },
  isSoftwareGl: boolean,
): { mat: THREE.MeshStandardMaterial; depthMat: THREE.MeshDepthMaterial } {
  const mat = makeStd(
    {
      map: sprite.map,
      normalMap: sprite.normalMap,
      normalScale: new THREE.Vector2(0.95, 0.95),
      color: 0xffffff,
      roughness: 0.84,
      metalness: 0.04,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    },
    isSoftwareGl,
  );
  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: sprite.map,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  return { mat, depthMat };
}

export function createCreature(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): CreatureRig {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, -0.02, 0);
  group.add(bodyPivot);

  // Subtle ceiling-contact anchor disc where hips & skirt press into wooden planks
  const anchorGeo = new THREE.PlaneGeometry(1.45, 1.55);
  anchorGeo.rotateX(Math.PI / 2);
  const anchorMat = new THREE.MeshBasicMaterial({
    map: textures.shadowDisc,
    color: 0x030304,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ceilingAnchor = new THREE.Mesh(anchorGeo, anchorMat);
  ceilingAnchor.position.set(0, 0.008, -0.14);
  ceilingAnchor.raycast = () => {};
  bodyPivot.add(ceilingAnchor);

  // 1. Front & Back Torso + Tattered Hospital Gown cutouts (deep 3D arch so torso reads volumetrically)
  const bodyGeo = makeCurvedCutoutGeo(1.06, 1.12, 0.13, false);
  const bodyFrontSprite = loadChromaCutoutSprite(bodySpriteUrl);
  const bodyFrontMats = makeSpriteCutoutMaterial(bodyFrontSprite, isSoftwareGl);
  const bodyFrontMesh = new THREE.Mesh(bodyGeo, bodyFrontMats.mat);
  bodyFrontMesh.customDepthMaterial = bodyFrontMats.depthMat;
  bodyFrontMesh.castShadow = true;
  bodyFrontMesh.rotation.x = -0.88;
  bodyFrontMesh.position.set(0, -0.34, -0.04);
  bodyPivot.add(bodyFrontMesh);

  const bodyBackSprite = loadChromaCutoutSprite(bodyBackSpriteUrl);
  const bodyBackMats = makeSpriteCutoutMaterial(bodyBackSprite, isSoftwareGl);
  const bodyBackMesh = new THREE.Mesh(bodyGeo, bodyBackMats.mat);
  bodyBackMesh.customDepthMaterial = bodyBackMats.depthMat;
  bodyBackMesh.castShadow = true;
  bodyBackMesh.rotation.x = -0.88;
  bodyBackMesh.position.set(0, -0.34, -0.04);
  bodyBackMesh.visible = false;
  bodyPivot.add(bodyBackMesh);

  // 2. Front & Back Upside-down Head cutouts pivoted smoothly inside torso neck collar
  const head = new THREE.Group();
  head.position.set(0, -0.56, 0.24);
  head.rotation.x = 0.22;
  const headGeo = makeCurvedCutoutGeo(0.68, 0.76, 0.085, false);
  headGeo.translate(0, -0.31, 0.01);

  const headFrontSprite = loadChromaCutoutSprite(headSpriteUrl);
  const headFrontMats = makeSpriteCutoutMaterial(headFrontSprite, isSoftwareGl);
  const headFrontMesh = new THREE.Mesh(headGeo, headFrontMats.mat);
  headFrontMesh.customDepthMaterial = headFrontMats.depthMat;
  headFrontMesh.castShadow = true;
  head.add(headFrontMesh);

  const headBackSprite = loadChromaCutoutSprite(headBackSpriteUrl);
  const headBackMats = makeSpriteCutoutMaterial(headBackSprite, isSoftwareGl);
  const headBackMesh = new THREE.Mesh(headGeo, headBackMats.mat);
  headBackMesh.customDepthMaterial = headBackMats.depthMat;
  headBackMesh.castShadow = true;
  headBackMesh.visible = false;
  head.add(headBackMesh);
  bodyPivot.add(head);

  // 3. Articulated Left & Right Bare Spider-Arms socketed cleanly into torn gown sleeves
  const armSprite = loadChromaCutoutSprite(armSpriteUrl);
  const armMats = makeSpriteCutoutMaterial(armSprite, isSoftwareGl);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.24, -0.49, 0.14);
  rightArm.rotation.set(-0.22, 0, 0.18);
  const rightArmGeo = makeCurvedCutoutGeo(0.92, 0.92, 0.055, false);
  rightArmGeo.translate(0.30, 0.24, -0.02);
  const rightArmMesh = new THREE.Mesh(rightArmGeo, armMats.mat);
  rightArmMesh.customDepthMaterial = armMats.depthMat;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);
  bodyPivot.add(rightArm);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.24, -0.49, 0.14);
  leftArm.rotation.set(-0.22, 0, -0.18);
  const leftArmGeo = makeCurvedCutoutGeo(0.92, 0.92, 0.055, true);
  leftArmGeo.translate(-0.30, 0.24, -0.02);
  const leftArmMesh = new THREE.Mesh(leftArmGeo, armMats.mat);
  leftArmMesh.customDepthMaterial = armMats.depthMat;
  leftArmMesh.castShadow = true;
  leftArm.add(leftArmMesh);
  bodyPivot.add(leftArm);

  // 4. Articulated Left & Right Bare Bent Spider-Legs socketed cleanly under tattered skirt hem
  const legSprite = loadChromaCutoutSprite(legSpriteUrl);
  const legMats = makeSpriteCutoutMaterial(legSprite, isSoftwareGl);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.18, -0.20, -0.24);
  rightLeg.rotation.set(0.18, -0.42, -0.82);
  const rightLegGeo = makeCurvedCutoutGeo(0.92, 0.92, 0.055, false);
  rightLegGeo.translate(0.23, 0.33, -0.02);
  const rightLegMesh = new THREE.Mesh(rightLegGeo, legMats.mat);
  rightLegMesh.customDepthMaterial = legMats.depthMat;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);
  bodyPivot.add(rightLeg);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.18, -0.20, -0.24);
  leftLeg.rotation.set(0.18, 0.42, 0.82);
  const leftLegGeo = makeCurvedCutoutGeo(0.92, 0.92, 0.055, true);
  leftLegGeo.translate(-0.23, 0.33, -0.02);
  const leftLegMesh = new THREE.Mesh(leftLegGeo, legMats.mat);
  leftLegMesh.customDepthMaterial = legMats.depthMat;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  bodyPivot.add(leftLeg);

  return {
    group,
    bodyPivot,
    bodyFrontMesh,
    bodyBackMesh,
    head,
    headFrontMesh,
    headBackMesh,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    materials: [
      bodyFrontMats.mat,
      bodyBackMats.mat,
      headFrontMats.mat,
      headBackMats.mat,
      armMats.mat,
      legMats.mat,
    ],
  };
}

/**
 * Projected distorted ceiling shadow mesh cast against corridor lamp lighting
 */
export function createCeilingShadowSilhouette(textures: SanatoriumTextures): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1.75, 2.25);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.shadowDisc,
    color: 0x020203,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;
  return mesh;
}

/**
 * 14. Composite 9-part First-Person Pistol + Supporting Sleeve/Hand & Flashlight
 */
export interface WeaponRig {
  group: THREE.Group;
  slide: THREE.Mesh;
  muzzleFlashMesh: THREE.Mesh;
  torchLensMat: THREE.MeshStandardMaterial;
}

export function createFirstPersonWeapon(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): WeaponRig {
  const group = new THREE.Group();

  const slideMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0xb6bac2,
      roughness: 0.28,
      metalness: 0.92,
    },
    isSoftwareGl,
  );
  const frameMat = makeStd(
    {
      color: 0x2c2e32,
      roughness: 0.78,
      metalness: 0.25,
    },
    isSoftwareGl,
  );
  const gripMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0x3b3d40,
      roughness: 0.92,
      metalness: 0.05,
    },
    isSoftwareGl,
  );
  const sleeveMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0x5c5e62,
      roughness: 0.92,
      metalness: 0.04,
    },
    isSoftwareGl,
  );
  const torchLensMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xfff5dc,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    },
    isSoftwareGl,
  );

  // Machined pistol slide
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.055, 0.28), slideMat);
  slide.position.set(0, 0.025, -0.02);
  group.add(slide);

  // Lower frame + grip
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.036, 0.26), frameMat);
  frame.position.set(0, -0.015, -0.01);
  group.add(frame);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.13, 0.068), gripMat);
  grip.position.set(0, -0.082, 0.072);
  grip.rotation.x = 0.24;
  group.add(grip);

  // Barrel & Iron sights
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.06, 10), slideMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.022, -0.17);
  group.add(barrel);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), slideMat);
  frontSight.position.set(0, 0.058, -0.145);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 0.012), slideMat);
  rearSight.position.set(0, 0.058, 0.105);
  group.add(frontSight, rearSight);

  // Under-barrel tactical flashlight housing + lens
  const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), frameMat);
  torchBody.rotation.x = Math.PI / 2;
  torchBody.position.set(0, -0.044, -0.085);
  group.add(torchBody);

  const torchLens = new THREE.Mesh(new THREE.CircleGeometry(0.016, 10), torchLensMat);
  torchLens.rotation.y = Math.PI;
  torchLens.position.set(0, -0.044, -0.141);
  group.add(torchLens);

  // Right forearm cuff silhouette holding pistol
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.34, 8), sleeveMat);
  arm.rotation.x = Math.PI / 2.3;
  arm.position.set(0.025, -0.16, 0.22);
  group.add(arm);

  // Muzzle flash cone
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const muzzleFlashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), flashMat);
  muzzleFlashMesh.rotation.x = -Math.PI / 2;
  muzzleFlashMesh.position.set(0, 0.025, -0.28);
  muzzleFlashMesh.visible = false;
  group.add(muzzleFlashMesh);

  return { group, slide, muzzleFlashMesh, torchLensMat };
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
