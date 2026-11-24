import * as THREE from 'three';
import { SanatoriumTextures } from './textures';
import { applySoftwareBayerDither } from './DitherPostProcess';
import { CELL_SIZE, COURTYARD_BOUNDS, MAIN_DOOR_CELL, MAP_WIDTH, WALL_HEIGHT } from './mapData';

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
  opacity = 0.58,
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

export interface EntrancePorticoRig {
  group: THREE.Group;
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
  keyStatusMat: THREE.MeshStandardMaterial;
  powerStatusMat: THREE.MeshStandardMaterial;
}

/**
 * 1. Two-Story Blackwood Sanatorium Exterior Facade + Portico + Twin Hinged Main Doors
 */
export function createSanatoriumEntrancePortico(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): EntrancePorticoRig {
  const group = new THREE.Group();
  const totalW = MAP_WIDTH * CELL_SIZE;
  const doorCenterX = MAIN_DOOR_CELL.x;

  const stoneMat = makeStd(
    {
      map: textures.stoneBrickMap,
      normalMap: textures.stoneBrickNormal,
      roughness: 0.88,
      metalness: 0.06,
    },
    isSoftwareGl,
  );
  const trimMat = makeStd(
    {
      color: 0x3b3e44,
      roughness: 0.72,
      metalness: 0.25,
    },
    isSoftwareGl,
  );
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x45484e,
      roughness: 0.54,
      metalness: 0.86,
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
  const winMat = makeStd(
    {
      map: textures.windowGlowMap,
      emissive: 0xcfdbe8,
      emissiveMap: textures.windowGlowMap,
      emissiveIntensity: 0.72,
      roughness: 0.22,
    },
    isSoftwareGl,
  );

  // Upper 2nd-story facade masonry above indoor walls (y = WALL_HEIGHT .. 7.2)
  const upperWall = new THREE.Mesh(new THREE.BoxGeometry(totalW, 4.1, 1.2), stoneMat);
  upperWall.position.set(totalW / 2, WALL_HEIGHT + 2.05, 0.6);
  upperWall.castShadow = true;
  upperWall.receiveShadow = true;
  group.add(upperWall);

  // Rooftop cornice overhang & dark pitched parapet silhouette
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(totalW + 0.6, 0.32, 1.65), trimMat);
  cornice.position.set(totalW / 2, 7.26, 0.55);
  group.add(cornice);

  const gable = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 1.4), stoneMat);
  gable.position.set(doorCenterX, 8.05, 0.5);
  group.add(gable);

  // 2nd-story barred glowing windows across facade
  const winCols = [2.2, 4.6, 7.5, 10.4, 12.8, 14.5];
  for (const cx of winCols) {
    const wx = cx * CELL_SIZE;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.55), winMat);
    pane.position.set(wx, 5.15, -0.02);
    pane.rotation.y = Math.PI;
    group.add(pane);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 0.16), trimMat);
    frame.position.set(wx, 4.35, -0.04);
    const frameTop = frame.clone();
    frameTop.position.y = 5.95;
    group.add(frame, frameTop);

    for (const bx of [-0.3, 0, 0.3]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.55, 6), ironMat);
      bar.position.set(wx + bx, 5.15, -0.05);
      group.add(bar);
    }
  }

  // Portico Flanking Stone Columns + Stepped Concrete Threshold + Overhang Roof
  const stepSlab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 1.45), trimMat);
  stepSlab.position.set(doorCenterX, 0.03, -0.52);
  stepSlab.receiveShadow = true;
  group.add(stepSlab);

  for (const px of [doorCenterX - 1.8, doorCenterX + 1.8]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.35, 0.62), trimMat);
    base.position.set(px, 0.175, -0.7);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.75, 10), stoneMat);
    col.position.set(px, 1.72, -0.7);
    col.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.58), trimMat);
    cap.position.set(px, 3.1, -0.7);
    group.add(base, col, cap);
  }

  const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.34, 1.8), trimMat);
  porticoRoof.position.set(doorCenterX, 3.35, -0.65);
  porticoRoof.castShadow = true;
  group.add(porticoRoof);

  // "SANATÓRIO BLACKWOOD" weathered metal plaque above portico
  const signMat = makeStd(
    {
      map: textures.signageMap,
      roughness: 0.48,
      metalness: 0.3,
    },
    isSoftwareGl,
  );
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.78, 0.08), signMat);
  sign.position.set(doorCenterX, 3.92, -0.2);
  sign.rotation.y = Math.PI;
  group.add(sign);

  // Status Beacons (Key & Power lock indicators flanking doorway lintel)
  const keyStatusMat = makeStd(
    { color: 0x333333, emissive: 0xff463d, emissiveIntensity: 0.9, roughness: 0.3 },
    isSoftwareGl,
  );
  const powerStatusMat = makeStd(
    { color: 0x333333, emissive: 0xff463d, emissiveIntensity: 0.9, roughness: 0.3 },
    isSoftwareGl,
  );
  const keyLamp = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), keyStatusMat);
  keyLamp.position.set(doorCenterX - 0.55, 2.95, -0.08);
  const powerLamp = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), powerStatusMat);
  powerLamp.position.set(doorCenterX + 0.55, 2.95, -0.08);
  group.add(keyLamp, powerLamp);

  // Heavy Door Frame Jambs & Lintel inside grid opening (x = 7..8 * CELL_SIZE)
  for (const jx of [doorCenterX - 1.12, doorCenterX + 1.12]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.95, 0.35), ironMat);
    jamb.position.set(jx, 1.475, 0.08);
    group.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.28, 0.36), ironMat);
  lintel.position.set(doorCenterX, 2.96, 0.08);
  group.add(lintel);

  // Twin Hinged Doors (pivot at outer jamb edge so they swing inward cleanly)
  const leafW = 1.02;
  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(doorCenterX - 1.02, 0, 0.08);
  const leftLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, 2.8, 0.1), doorMat);
  leftLeaf.position.set(leafW / 2, 1.4, 0);
  leftLeaf.castShadow = true;
  leftLeaf.receiveShadow = true;
  leftDoorPivot.add(leftLeaf);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(doorCenterX + 1.02, 0, 0.08);
  const rightLeaf = new THREE.Mesh(new THREE.BoxGeometry(leafW, 2.8, 0.1), doorMat);
  rightLeaf.position.set(-leafW / 2, 1.4, 0);
  rightLeaf.castShadow = true;
  rightLeaf.receiveShadow = true;
  rightDoorPivot.add(rightLeaf);

  group.add(leftDoorPivot, rightDoorPivot);

  return { group, leftDoorPivot, rightDoorPivot, keyStatusMat, powerStatusMat };
}

/**
 * 2. West Security Booth ("Guarita") housing the Master Key & desk lamp
 */
export function createSecurityBooth(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): { group: THREE.Group; bulbMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  // Positioned centered around (3.2 * CELL_SIZE, -6.4 * CELL_SIZE)
  const cx = 3.2 * CELL_SIZE;
  const cz = -6.4 * CELL_SIZE;
  group.position.set(cx, 0, cz);

  const masonryMat = makeStd(
    {
      map: textures.stoneBrickMap,
      normalMap: textures.stoneBrickNormal,
      roughness: 0.88,
      metalness: 0.05,
    },
    isSoftwareGl,
  );
  const roofMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x45484e,
      roughness: 0.65,
      metalness: 0.78,
    },
    isSoftwareGl,
  );
  const woodMat = makeStd(
    {
      map: textures.fabricMap,
      color: 0x4e4840,
      roughness: 0.88,
      metalness: 0.05,
    },
    isSoftwareGl,
  );
  const bulbMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xfff0cc,
      emissiveIntensity: 2.0,
      roughness: 0.15,
    },
    isSoftwareGl,
  );

  // Raised concrete curb floor
  const slab = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.06, 4.1), masonryMat);
  slab.position.set(0, 0.03, 0);
  slab.receiveShadow = true;
  group.add(slab);

  // West back wall, North wall, South wall (East side open doorway!)
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.75, 4.0), masonryMat);
  westWall.position.set(-1.82, 1.375, 0);
  westWall.castShadow = true;
  westWall.receiveShadow = true;

  const northWall = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.75, 0.32), masonryMat);
  northWall.position.set(0, 1.375, -1.82);
  northWall.castShadow = true;
  northWall.receiveShadow = true;

  const southWall = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.75, 0.32), masonryMat);
  southWall.position.set(0, 1.375, 1.82);
  southWall.castShadow = true;
  southWall.receiveShadow = true;
  group.add(westWall, northWall, southWall);

  // Sloped corrugated roof with overhang
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.18, 4.6), roofMat);
  roof.position.set(0.1, 2.84, 0);
  roof.rotation.z = -0.06;
  roof.castShadow = true;
  group.add(roof);

  // Interior guard desk holding the Master Key (aligns with KEY_SPAWN at 2.9*C, -6.55*C -> local (-0.3*C, -0.15*C))
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 1.45), woodMat);
  deskTop.position.set(-0.72, 0.82, -0.35);
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  group.add(deskTop);

  for (const [lx, lz] of [
    [-1.2, -0.95],
    [-0.25, -0.95],
    [-1.2, 0.25],
    [-0.25, 0.25],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), roofMat);
    leg.position.set(lx, 0.4, lz);
    group.add(leg);
  }

  // Porch & Interior Lantern
  const porchCage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.14, 8), roofMat);
  porchCage.position.set(2.15, 2.52, 0);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), bulbMat);
  bulb.position.set(2.15, 2.42, 0);
  group.add(porchCage, bulb);

  return { group, bulbMat };
}

/**
 * 3. Composite 8-part Auxiliary Diesel Generator Unit (East Courtyard)
 */
export function createGeneratorUnit(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): { group: THREE.Group; leverPivot: THREE.Group; beaconMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const concreteMat = makeStd(
    {
      map: textures.stoneBrickMap,
      roughness: 0.92,
      metalness: 0.04,
    },
    isSoftwareGl,
  );
  const chassisMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x5c6268,
      roughness: 0.56,
      metalness: 0.82,
    },
    isSoftwareGl,
  );
  const darkIronMat = makeStd(
    {
      color: 0x202226,
      roughness: 0.72,
      metalness: 0.75,
    },
    isSoftwareGl,
  );
  const leverMat = makeStd(
    {
      color: 0xf4f4ee,
      emissive: 0x444444,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.4,
    },
    isSoftwareGl,
  );
  const beaconMat = makeStd(
    {
      color: 0x2a2a2a,
      emissive: 0x80ff72,
      emissiveIntensity: 0.0,
      roughness: 0.2,
    },
    isSoftwareGl,
  );

  // Concrete pad
  const pad = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.2), concreteMat);
  pad.position.y = 0.07;
  pad.receiveShadow = true;
  group.add(pad);

  // Main diesel generator housing
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 1.2), chassisMat);
  body.position.set(0.1, 0.715, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Louvered radiator grille facing west
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.88), darkIronMat);
  grille.position.set(-0.77, 0.76, 0);
  group.add(grille);

  // Vertical exhaust stack pipe + flared cap
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.35, 10), darkIronMat);
  exhaust.position.set(0.55, 1.85, -0.32);
  exhaust.castShadow = true;
  group.add(exhaust);

  // Cylindrical fuel tank drum
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12), chassisMat);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0.15, 1.44, 0.22);
  tank.castShadow = true;
  group.add(tank);

  // Control Box + Interactive Breaker Lever on West face (toward player)
  const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.44), darkIronMat);
  ctrlBox.position.set(-0.82, 1.12, 0.35);
  group.add(ctrlBox);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(-0.92, 1.15, 0.35);
  leverPivot.rotation.z = 0.65; // Pulled down/off initially
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), leverMat);
  arm.position.y = 0.17;
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), leverMat);
  grip.position.y = 0.34;
  leverPivot.add(arm, grip);
  group.add(leverPivot);

  // Beacon indicator bulb on top
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), beaconMat);
  beacon.position.set(-0.72, 1.65, 0.35);
  group.add(beacon);

  addContactShadow(group, textures, 1.5, 0.62);
  return { group, leverPivot, beaconMat };
}

/**
 * 4. Composite 4-part Master Key Pickup
 */
export function createMasterKeyItem(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const metalMat = makeStd(
    {
      map: textures.metalMap,
      color: 0xf4f4ec,
      emissive: 0x666658,
      emissiveIntensity: 0.65,
      roughness: 0.24,
      metalness: 0.92,
    },
    isSoftwareGl,
  );
  const tagMat = makeStd(
    {
      color: 0xd92828,
      emissive: 0x6b1010,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    },
    isSoftwareGl,
  );

  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 8, 16), metalMat);
  bow.rotation.x = Math.PI / 2;
  bow.position.z = -0.1;

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), metalMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.05;

  const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.016, 0.025), metalMat);
  tooth1.position.set(0.028, 0, 0.14);
  const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.016, 0.02), metalMat);
  tooth2.position.set(0.02, 0, 0.095);

  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.06), tagMat);
  tag.position.set(-0.08, 0, -0.14);
  tag.rotation.y = 0.4;

  group.add(bow, shaft, tooth1, tooth2, tag);
  return group;
}

/**
 * 5. Composite 5-part Cast-Iron Courtyard Lamppost
 */
export function createCourtyardLampPost(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): { group: THREE.Group; bulbMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x2c2f34,
      roughness: 0.62,
      metalness: 0.84,
    },
    isSoftwareGl,
  );
  const bulbMat = makeStd(
    {
      color: 0xffffff,
      emissive: 0xfff2d8,
      emissiveIntensity: 1.8,
      roughness: 0.15,
    },
    isSoftwareGl,
  );

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.45, 8), ironMat);
  plinth.position.y = 0.225;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 3.6, 8), ironMat);
  pole.position.y = 2.25;
  pole.castShadow = true;

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.06), ironMat);
  arm.position.set(0.24, 4.0, 0);

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 8), ironMat);
  hood.position.set(0.46, 3.92, 0);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), bulbMat);
  bulb.position.set(0.46, 3.78, 0);

  group.add(plinth, pole, arm, hood, bulb);
  addContactShadow(group, textures, 0.42, 0.55);
  return { group, bulbMat };
}

/**
 * 6. Composite 5-part Weathered Stone Courtyard Fountain
 */
export function createCourtyardFountain(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = makeStd(
    {
      map: textures.stoneBrickMap,
      normalMap: textures.stoneBrickNormal,
      roughness: 0.9,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.48, 0.55, 10), stoneMat);
  outerRim.position.y = 0.275;
  outerRim.castShadow = true;
  outerRim.receiveShadow = true;

  const basinDark = new THREE.Mesh(
    new THREE.CylinderGeometry(1.16, 1.16, 0.57, 10),
    makeStd({ color: 0x16181c, roughness: 0.35, metalness: 0.2 }, isSoftwareGl),
  );
  basinDark.position.y = 0.28;

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 1.35, 8), stoneMat);
  pillar.position.y = 0.95;
  pillar.castShadow = true;

  const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.28, 0.28, 10), stoneMat);
  upperBowl.position.y = 1.68;
  upperBowl.castShadow = true;

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.68, 6), stoneMat);
  spire.position.y = 2.15;
  spire.rotation.z = 0.12; // Slightly weathered / cracked tilt

  group.add(outerRim, basinDark, pillar, upperBowl, spire);
  addContactShadow(group, textures, 1.7, 0.65);
  return group;
}

/**
 * 7. Composite 10-part Abandoned Asylum Ambulance / Transport Van
 */
export function createAbandonedAmbulance(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0xbfc2ba,
      roughness: 0.62,
      metalness: 0.45,
    },
    isSoftwareGl,
  );
  const darkMat = makeStd(
    {
      color: 0x1b1d20,
      roughness: 0.85,
      metalness: 0.25,
    },
    isSoftwareGl,
  );
  const glassMat = makeStd(
    {
      color: 0x121518,
      roughness: 0.18,
      metalness: 0.7,
    },
    isSoftwareGl,
  );

  // Rear ambulance medical box
  const rearBox = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.65, 2.05), bodyMat);
  rearBox.position.set(0.42, 1.18, 0);
  rearBox.castShadow = true;
  rearBox.receiveShadow = true;
  group.add(rearBox);

  // Front cab & sloped hood facing West (-X)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 1.92), bodyMat);
  cab.position.set(-1.18, 1.02, 0);
  cab.castShadow = true;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.78, 1.88), bodyMat);
  hood.position.set(-1.95, 0.72, 0);
  hood.castShadow = true;
  group.add(cab, hood);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 1.72), glassMat);
  windshield.position.set(-1.68, 1.32, 0);
  windshield.rotation.z = 0.28;
  group.add(windshield);

  // Weathered crimson cross emblem on flank
  const crossMat = makeStd(
    {
      color: 0xa8201e,
      emissive: 0x260404,
      emissiveIntensity: 0.35,
      roughness: 0.65,
    },
    isSoftwareGl,
  );
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.04), crossMat);
  crossH.position.set(0.42, 1.32, 1.03);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.04), crossMat);
  crossV.position.set(0.42, 1.32, 1.03);
  group.add(crossH, crossV);

  // Ajar rear door on left side
  const rearDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.95), bodyMat);
  rearDoor.position.set(1.85, 1.12, 0.65);
  rearDoor.rotation.y = 0.65;
  rearDoor.castShadow = true;
  group.add(rearDoor);

  // 4 Heavy Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [wx, wz] of [
    [-1.45, -0.96],
    [-1.45, 0.96],
    [0.95, -0.96],
    [0.95, 0.96],
  ]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    group.add(w);
  }

  // Roof siren lightbar with crimson emergency dome
  const siren = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 1.1), darkMat);
  siren.position.set(-1.05, 1.78, 0);
  group.add(siren);
  const sirenDome = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.34), crossMat);
  sirenDome.position.set(-1.05, 1.79, 0.34);
  group.add(sirenDome);

  addContactShadow(group, textures, 2.35, 0.72);
  return group;
}

/**
 * 8. Composite 6-part Gnarled Leafless Horror Tree
 */
export function createDeadTree(
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): THREE.Group {
  const group = new THREE.Group();
  const barkMat = makeStd(
    {
      map: textures.barkMap,
      roughness: 0.94,
      metalness: 0.02,
    },
    isSoftwareGl,
  );

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.36, 3.8, 7), barkMat);
  trunk.position.y = 1.9;
  trunk.rotation.z = 0.06;
  trunk.castShadow = true;
  group.add(trunk);

  const limbs: [number, number, number, number, number, number][] = [
    [-0.12, 3.2, 0.05, 0.62, 0.4, 2.2],
    [0.14, 3.5, -0.08, -0.55, -0.35, 2.0],
    [0.0, 2.7, 0.15, 0.35, 0.75, 1.7],
    [-0.08, 2.5, -0.15, -0.4, -0.7, 1.6],
  ];
  for (const [x, y, z, rz, rx, len] of limbs) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, len, 6), barkMat);
    branch.position.set(x, y + len * 0.35, z);
    branch.rotation.set(rx, 0, rz);
    branch.castShadow = true;
    group.add(branch);
  }

  addContactShadow(group, textures, 0.9, 0.6);
  return group;
}

/**
 * 9. Wrought-Iron Perimeter Fence & Locked Arrival Gate
 */
export function buildCourtyardPerimeterFence(
  scene: THREE.Scene,
  textures: SanatoriumTextures,
  isSoftwareGl: boolean,
): void {
  const ironMat = makeStd(
    {
      map: textures.metalMap,
      roughnessMap: textures.metalRoughness,
      color: 0x26282c,
      roughness: 0.65,
      metalness: 0.85,
    },
    isSoftwareGl,
  );
  const stoneMat = makeStd(
    {
      map: textures.stoneBrickMap,
      normalMap: textures.stoneBrickNormal,
      roughness: 0.9,
      metalness: 0.05,
    },
    isSoftwareGl,
  );

  const minX = COURTYARD_BOUNDS.minX - 0.15;
  const maxX = COURTYARD_BOUNDS.maxX + 0.15;
  const minZ = COURTYARD_BOUNDS.minZ - 0.15;
  const maxZ = 0.0;

  // Low perimeter stone curb
  const westCurb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, maxZ - minZ), stoneMat);
  westCurb.position.set(minX, 0.21, (minZ + maxZ) / 2);
  const eastCurb = westCurb.clone();
  eastCurb.position.x = maxX;
  const northCurb = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.42, 0.32), stoneMat);
  northCurb.position.set((minX + maxX) / 2, 0.21, minZ);
  scene.add(westCurb, eastCurb, northCurb);

  // Instanced stone piers & wrought-iron pickets around all 3 outer sides
  const picketPositions: { x: number; z: number }[] = [];
  const pierPositions: { x: number; z: number }[] = [];

  for (let z = minZ; z <= maxZ; z += 0.42) {
    picketPositions.push({ x: minX, z }, { x: maxX, z });
  }
  for (let x = minX; x <= maxX; x += 0.42) {
    picketPositions.push({ x, z: minZ });
  }
  for (let z = minZ; z <= maxZ; z += CELL_SIZE * 2) {
    pierPositions.push({ x: minX, z }, { x: maxX, z });
  }
  for (let x = minX; x <= maxX; x += CELL_SIZE * 2) {
    pierPositions.push({ x, z: minZ });
  }

  const picketGeo = new THREE.CylinderGeometry(0.022, 0.026, 2.35, 5);
  const picketInst = new THREE.InstancedMesh(picketGeo, ironMat, picketPositions.length);
  const dummy = new THREE.Object3D();
  picketPositions.forEach((p, i) => {
    dummy.position.set(p.x, 1.38, p.z);
    dummy.updateMatrix();
    picketInst.setMatrixAt(i, dummy.matrix);
  });
  picketInst.instanceMatrix.needsUpdate = true;
  picketInst.computeBoundingSphere();
  scene.add(picketInst);

  const pierGeo = new THREE.BoxGeometry(0.48, 2.75, 0.48);
  const pierInst = new THREE.InstancedMesh(pierGeo, stoneMat, pierPositions.length);
  pierPositions.forEach((p, i) => {
    dummy.position.set(p.x, 1.375, p.z);
    dummy.updateMatrix();
    pierInst.setMatrixAt(i, dummy.matrix);
  });
  pierInst.instanceMatrix.needsUpdate = true;
  pierInst.computeBoundingSphere();
  scene.add(pierInst);

  // Horizontal fence top/mid rails
  const railW = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, maxZ - minZ), ironMat);
  railW.position.set(minX, 2.25, (minZ + maxZ) / 2);
  const railE = railW.clone();
  railE.position.x = maxX;
  const railN = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.06, 0.08), ironMat);
  railN.position.set((minX + maxX) / 2, 2.25, minZ);
  scene.add(railW, railE, railN);

  // Chained Arrival Gate Pier Arch behind Player Spawn (z = minZ, x = 7.5*CELL_SIZE)
  const gateArch = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.35, 0.46), stoneMat);
  gateArch.position.set(MAIN_DOOR_CELL.x, 2.9, minZ);
  scene.add(gateArch);
}
