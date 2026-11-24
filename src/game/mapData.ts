export const MAP_ROWS = [
  '1111111011111111',
  '1000000000000001',
  '1011100111011101',
  '1000100000010001',
  '1100101110010011',
  '1000001000000001',
  '1011001001110101',
  '1000000000000001',
  '1110111011101101',
  '1000000000000001',
  '1011101110111001',
  '1000000000000001',
  '1111111111111111',
] as const;

export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 13;
export const CELL_SIZE = 2.4;
export const WALL_HEIGHT = 3.1;

export const COURTYARD_BOUNDS = {
  minX: 1.4 * CELL_SIZE, // 3.36m
  maxX: 14.6 * CELL_SIZE, // 35.04m
  minZ: -11.0 * CELL_SIZE, // -26.4m
  maxZ: 0.0,
};

export interface OutdoorCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Solid AABBs in the exterior courtyard (Security Booth walls with East doorway, Generator shed, Ambulance, Fountain)
export const OUTDOOR_COLLIDERS: OutdoorCollider[] = [
  // West Security Booth ("Guarita") centered around x=3.2*C (7.68), z=-6.4*C (-15.36), doorway open on +X (east)
  { minX: 2.35 * CELL_SIZE, maxX: 2.62 * CELL_SIZE, minZ: -7.25 * CELL_SIZE, maxZ: -5.55 * CELL_SIZE }, // West wall
  { minX: 2.35 * CELL_SIZE, maxX: 4.05 * CELL_SIZE, minZ: -7.25 * CELL_SIZE, maxZ: -6.98 * CELL_SIZE }, // North wall
  { minX: 2.35 * CELL_SIZE, maxX: 4.05 * CELL_SIZE, minZ: -5.82 * CELL_SIZE, maxZ: -5.55 * CELL_SIZE }, // South wall
  { minX: 2.65 * CELL_SIZE, maxX: 3.15 * CELL_SIZE, minZ: -6.85 * CELL_SIZE, maxZ: -6.25 * CELL_SIZE }, // Interior desk

  // East Generator Concrete Pad & Engine Housing around x=12.2*C (29.28), z=-4.8*C (-11.52)
  { minX: 11.75 * CELL_SIZE, maxX: 12.85 * CELL_SIZE, minZ: -5.35 * CELL_SIZE, maxZ: -4.25 * CELL_SIZE },

  // Central Courtyard Stone Fountain Plaza around x=7.5*C (18.0), z=-5.5*C (-13.2)
  { minX: 6.95 * CELL_SIZE, maxX: 8.05 * CELL_SIZE, minZ: -6.05 * CELL_SIZE, maxZ: -4.95 * CELL_SIZE },

  // Abandoned Asylum Ambulance parked in North-East courtyard around x=11.8*C, z=-8.6*C
  { minX: 10.95 * CELL_SIZE, maxX: 12.65 * CELL_SIZE, minZ: -9.15 * CELL_SIZE, maxZ: -8.05 * CELL_SIZE },

  // Portico Stone Columns flanking the main entrance at x=7.5*C, z=-0.6*C
  { minX: 6.55 * CELL_SIZE, maxX: 6.95 * CELL_SIZE, minZ: -0.95 * CELL_SIZE, maxZ: -0.45 * CELL_SIZE },
  { minX: 8.05 * CELL_SIZE, maxX: 8.45 * CELL_SIZE, minZ: -0.95 * CELL_SIZE, maxZ: -0.45 * CELL_SIZE },
];

export interface PropPlacement {
  x: number;
  z: number;
  rotY?: number;
  kind: 'lamp' | 'chair' | 'gurney' | 'pipe' | 'ammo' | 'medkit' | 'iv' | 'cabinet' | 'window' | 'breaker';
  id: string;
}

export interface WallArtPlacement {
  x: number;
  z: number;
  rotY: number;
  kind: 'notice' | 'anatomy' | 'graffiti';
}

export interface FloorStainPlacement {
  x: number;
  z: number;
  rotY: number;
  scale: number;
}

export const LAMP_PLACEMENTS: PropPlacement[] = [
  { id: 'lamp-1', x: 4.5, z: 1.5, kind: 'lamp' },
  { id: 'lamp-2', x: 8.5, z: 1.5, kind: 'lamp' },
  { id: 'lamp-3', x: 12.5, z: 1.5, kind: 'lamp' },
  { id: 'lamp-4', x: 5.5, z: 7.5, kind: 'lamp' },
  { id: 'lamp-5', x: 10.5, z: 9.5, kind: 'lamp' },
  { id: 'lamp-6', x: 14.2, z: 11.5, kind: 'lamp' },
];

export const PROP_PLACEMENTS: PropPlacement[] = [
  { id: 'chair-1', x: 4.5, z: 5.5, rotY: 0.6, kind: 'chair' },
  { id: 'chair-2', x: 2.3, z: 9.5, rotY: -0.9, kind: 'chair' },
  { id: 'chair-3', x: 11.4, z: 11.3, rotY: 2.3, kind: 'chair' },
  { id: 'gurney-1', x: 13.6, z: 3.5, rotY: Math.PI / 2, kind: 'gurney' },
  { id: 'gurney-2', x: 8.4, z: 5.5, rotY: 0.25, kind: 'gurney' },
  { id: 'iv-1', x: 12.8, z: 3.3, rotY: 0.4, kind: 'iv' },
  { id: 'iv-2', x: 7.7, z: 5.2, rotY: -0.5, kind: 'iv' },
  { id: 'iv-3', x: 5.1, z: 7.1, rotY: 1.1, kind: 'iv' },
  { id: 'cabinet-1', x: 2.5, z: 2.22, rotY: 0, kind: 'cabinet' },
  { id: 'cabinet-2', x: 7.5, z: 5.22, rotY: 0, kind: 'cabinet' },
  { id: 'cabinet-3', x: 6.5, z: 9.78, rotY: Math.PI, kind: 'cabinet' },
  { id: 'pipe-1', x: 1.0, z: 3.4, rotY: Math.PI / 2, kind: 'pipe' },
  { id: 'pipe-2', x: 5.0, z: 3.5, rotY: Math.PI / 2, kind: 'pipe' },
  { id: 'pipe-3', x: 10.5, z: 7.0, rotY: 0, kind: 'pipe' },
  { id: 'pipe-4', x: 15.0, z: 7.5, rotY: -Math.PI / 2, kind: 'pipe' },
  { id: 'window-1', x: 3.5, z: 1.0, rotY: 0, kind: 'window' },
  { id: 'window-2', x: 10.5, z: 1.0, rotY: 0, kind: 'window' },
  { id: 'window-3', x: 1.0, z: 7.5, rotY: Math.PI / 2, kind: 'window' },
  { id: 'window-4', x: 15.0, z: 5.5, rotY: -Math.PI / 2, kind: 'window' },
  { id: 'breaker-1', x: 1.0, z: 1.5, rotY: Math.PI / 2, kind: 'breaker' },
  { id: 'breaker-2', x: 10.5, z: 10.0, rotY: Math.PI, kind: 'breaker' },
];

export const WALL_ART_PLACEMENTS: WallArtPlacement[] = [
  { x: 2.5, z: 1.0, rotY: 0, kind: 'notice' },
  { x: 6.5, z: 1.0, rotY: 0, kind: 'graffiti' },
  { x: 9.5, z: 2.0, rotY: Math.PI, kind: 'anatomy' },
  { x: 15.0, z: 1.5, rotY: -Math.PI / 2, kind: 'graffiti' },
  { x: 6.5, z: 7.0, rotY: 0, kind: 'graffiti' },
  { x: 8.5, z: 8.0, rotY: Math.PI, kind: 'notice' },
  { x: 12.5, z: 11.0, rotY: 0, kind: 'anatomy' },
];

export const FLOOR_STAIN_PLACEMENTS: FloorStainPlacement[] = [
  { x: 3.4, z: 1.5, rotY: 0.4, scale: 1.35 },
  { x: 8.4, z: 5.8, rotY: -0.6, scale: 1.75 },
  { x: 10.5, z: 7.4, rotY: 1.1, scale: 2.1 },
  { x: 13.6, z: 3.9, rotY: 0.2, scale: 1.5 },
  { x: 5.5, z: 9.5, rotY: 2.0, scale: 1.6 },
  { x: 13.8, z: 11.4, rotY: -0.4, scale: 1.45 },
];

export const PICKUP_PLACEMENTS: PropPlacement[] = [
  // Exterior Courtyard supplies (behind ambulance & near fountain bench)
  { id: 'ext-ammo-1', x: 10.4, z: -8.6, kind: 'ammo' },
  { id: 'ext-medkit-1', x: 3.4, z: -6.0, kind: 'medkit' },
  // Interior Sanatorium supplies
  { id: 'ammo-1', x: 1.6, z: 5.5, kind: 'ammo' },
  { id: 'ammo-2', x: 13.8, z: 5.5, kind: 'ammo' },
  { id: 'medkit-1', x: 2.2, z: 11.4, kind: 'medkit' },
];

export interface LockerPlacement {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

export const LOCKER_PLACEMENTS: LockerPlacement[] = [
  { id: 'locker-1', x: 4.5, z: 1.16, rotY: 0 },
  { id: 'locker-2', x: 13.5, z: 3.16, rotY: 0 },
  { id: 'locker-3', x: 2.5, z: 5.84, rotY: Math.PI },
  { id: 'locker-4', x: 8.5, z: 7.16, rotY: 0 },
  { id: 'locker-5', x: 11.5, z: 9.16, rotY: 0 },
];

export const KEY_SPAWN = {
  x: 2.9 * CELL_SIZE,
  z: -6.55 * CELL_SIZE,
  y: 0.86, // Resting atop the Security Booth desk
};

export const GENERATOR_POS = {
  x: 12.3 * CELL_SIZE,
  z: -4.8 * CELL_SIZE,
  interactX: 11.35 * CELL_SIZE,
  interactZ: -4.8 * CELL_SIZE,
};

export const MAIN_DOOR_CELL = {
  gridX: 7,
  gridZ: 0,
  x: 7.5 * CELL_SIZE,
  z: 0.1 * CELL_SIZE,
  interactX: 7.5 * CELL_SIZE,
  interactZ: -0.75 * CELL_SIZE,
};

export const OUTDOOR_LAMPS: { x: number; z: number; requiresPower: boolean }[] = [
  { x: 6.2 * CELL_SIZE, z: -9.0 * CELL_SIZE, requiresPower: false }, // Outer arrival gate flickering lamp
  { x: 4.35 * CELL_SIZE, z: -6.4 * CELL_SIZE, requiresPower: false }, // Security booth porch light
  { x: 10.9 * CELL_SIZE, z: -4.8 * CELL_SIZE, requiresPower: true }, // East generator spotlight
  { x: 8.8 * CELL_SIZE, z: -2.0 * CELL_SIZE, requiresPower: true }, // Sanatorium front plaza floodlight
];

export const PLAYER_SPAWN = {
  x: 7.5 * CELL_SIZE,
  z: -9.8 * CELL_SIZE,
  yaw: Math.PI, // Facing +Z (South toward the Sanatorium facade)
};

export const CREATURE_SPAWN = {
  x: 10.5 * CELL_SIZE,
  z: 7.5 * CELL_SIZE,
};

export const EXIT_DOOR_CELL = {
  x: 14.5,
  z: 11.88,
  triggerX: 14.2 * CELL_SIZE,
  triggerZ: 11.3 * CELL_SIZE,
};

export function isWallAtGrid(gx: number, gz: number): boolean {
  if (gx < 0 || gz < 0 || gx >= MAP_WIDTH || gz >= MAP_HEIGHT) return true;
  return MAP_ROWS[gz][gx] === '1';
}

export function isWallAtWorld(
  wx: number,
  wz: number,
  radius = 0.42,
  mainDoorOpen = true,
): boolean {
  const checks = [
    [wx - radius, wz - radius],
    [wx + radius, wz - radius],
    [wx - radius, wz + radius],
    [wx + radius, wz + radius],
  ];
  for (let i = 0; i < checks.length; i++) {
    const cx = checks[i][0];
    const cz = checks[i][1];

    if (cz >= 0) {
      const gx = Math.floor(cx / CELL_SIZE);
      const gz = Math.floor(cz / CELL_SIZE);
      if (isWallAtGrid(gx, gz)) return true;
      if (!mainDoorOpen && gx === MAIN_DOOR_CELL.gridX && gz === MAIN_DOOR_CELL.gridZ) {
        return true;
      }
    } else {
      // Outdoor Courtyard Perimeter Fence
      if (
        cx < COURTYARD_BOUNDS.minX ||
        cx > COURTYARD_BOUNDS.maxX ||
        cz < COURTYARD_BOUNDS.minZ
      ) {
        return true;
      }
      // Solid Courtyard Structures
      for (let c = 0; c < OUTDOOR_COLLIDERS.length; c++) {
        const box = OUTDOOR_COLLIDERS[c];
        if (cx >= box.minX && cx <= box.maxX && cz >= box.minZ && cz <= box.maxZ) {
          return true;
        }
      }
    }
  }
  return false;
}

export function hasLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  mainDoorOpen = true,
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  const steps = Math.ceil(dist / 0.2);
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 1; i < steps; i++) {
    const px = x1 + sx * i;
    const pz = z1 + sz * i;
    if (isWallAtWorld(px, pz, 0.05, mainDoorOpen)) return false;
  }
  return true;
}
