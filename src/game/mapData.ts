export const MAP_ROWS = [
  '1111111111111111',
  '1000100000100001',
  '1000001110001101',
  '1000100000100001',
  '1101110110111011',
  '1000000010000001',
  '1011101011101101',
  '1000100000001001',
  '1000001110111001',
  '1000100000000001',
  '1101110110110111',
  '1000000010000001',
  '1111111111111111',
] as const;

export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 13;
export const CELL_SIZE = 2.4;
export const WALL_HEIGHT = 3.1;

export const LEVEL_STORAGE_KEY = 'blackwood_custom_level_v1';

export interface DoorPlacement {
  id: string;
  gridX: number;
  gridZ: number;
  /** 'ew' = hallway runs East-West (jambs North/South); 'ns' = hallway runs North-South (jambs West/East) */
  axis: 'ew' | 'ns';
  label: string;
}

export const DOOR_PLACEMENTS: DoorPlacement[] = [
  { id: 'door-start-e', gridX: 4, gridZ: 2, axis: 'ew', label: 'Comporta (Cabine 01)' },
  { id: 'door-start-s', gridX: 2, gridZ: 4, axis: 'ns', label: 'Comporta (Cabine 01)' },
  { id: 'door-ward-w', gridX: 10, gridZ: 2, axis: 'ew', label: 'Comporta (Casa de Bombas)' },
  { id: 'door-ward-s', gridX: 13, gridZ: 4, axis: 'ns', label: 'Comporta (Casa de Bombas)' },
  { id: 'door-arch-e', gridX: 4, gridZ: 8, axis: 'ew', label: 'Comporta (Sala do Sonar)' },
  { id: 'door-arch-s', gridX: 2, gridZ: 10, axis: 'ns', label: 'Comporta (Sala do Sonar)' },
  { id: 'door-south-w', gridX: 9, gridZ: 10, axis: 'ns', label: 'Comporta (Ala Sul)' },
  { id: 'door-south-e', gridX: 12, gridZ: 10, axis: 'ns', label: 'Comporta (Escotilha)' },
];

export interface PropPlacement {
  x: number;
  z: number;
  rotY?: number;
  kind: 'lamp' | 'chair' | 'gurney' | 'pipe' | 'battery' | 'medkit' | 'iv' | 'cabinet' | 'window' | 'breaker';
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
  { id: 'lamp-1', x: 2.5, z: 2.5, kind: 'lamp' },   // Quarto 01 (Sala Inicial)
  { id: 'lamp-2', x: 7.5, z: 1.5, kind: 'lamp' },   // Corredor Norte
  { id: 'lamp-3', x: 12.5, z: 1.5, kind: 'lamp' },  // Enfermaria Nordeste
  { id: 'lamp-4', x: 5.5, z: 5.5, kind: 'lamp' },   // Corredor Central
  { id: 'lamp-5', x: 2.5, z: 8.5, kind: 'lamp' },   // Sala de Arquivos
  { id: 'lamp-6', x: 10.5, z: 9.5, kind: 'lamp' },  // Corredor Sul
  { id: 'lamp-7', x: 13.5, z: 11.5, kind: 'lamp' }, // Corredor da Saída
];

export const PROP_PLACEMENTS: PropPlacement[] = [
  // Quarto 01 (Sala Inicial)
  { id: 'gurney-start', x: 1.65, z: 1.9, rotY: 0, kind: 'gurney' },
  { id: 'chair-start', x: 3.3, z: 3.3, rotY: -2.4, kind: 'chair' },
  // Corredores e Alas
  { id: 'chair-1', x: 5.4, z: 5.2, rotY: 0.6, kind: 'chair' },
  { id: 'chair-2', x: 3.3, z: 9.4, rotY: -0.9, kind: 'chair' },
  { id: 'chair-3', x: 11.4, z: 11.3, rotY: 2.3, kind: 'chair' },
  { id: 'gurney-1', x: 13.7, z: 3.4, rotY: Math.PI / 2, kind: 'gurney' },
  { id: 'gurney-2', x: 8.4, z: 7.5, rotY: 0.25, kind: 'gurney' },
  { id: 'iv-1', x: 12.7, z: 3.3, rotY: 0.4, kind: 'iv' },
  { id: 'iv-2', x: 7.7, z: 7.2, rotY: -0.5, kind: 'iv' },
  { id: 'iv-3', x: 2.2, z: 1.6, rotY: 1.1, kind: 'iv' },
  { id: 'cabinet-1', x: 1.5, z: 3.78, rotY: Math.PI, kind: 'cabinet' },
  { id: 'cabinet-2', x: 7.5, z: 5.22, rotY: 0, kind: 'cabinet' },
  { id: 'cabinet-3', x: 6.5, z: 9.78, rotY: Math.PI, kind: 'cabinet' },
  { id: 'cabinet-key', x: 1.55, z: 8.5, rotY: Math.PI / 2, kind: 'cabinet' },
  { id: 'pipe-1', x: 1.0, z: 3.4, rotY: Math.PI / 2, kind: 'pipe' },
  { id: 'pipe-2', x: 5.0, z: 3.5, rotY: Math.PI / 2, kind: 'pipe' },
  { id: 'pipe-3', x: 10.5, z: 7.0, rotY: 0, kind: 'pipe' },
  { id: 'pipe-4', x: 15.0, z: 7.5, rotY: -Math.PI / 2, kind: 'pipe' },
  { id: 'window-1', x: 6.5, z: 1.0, rotY: 0, kind: 'window' },
  { id: 'window-2', x: 14.0, z: 1.0, rotY: 0, kind: 'window' },
  { id: 'window-3', x: 1.0, z: 7.5, rotY: Math.PI / 2, kind: 'window' },
  { id: 'window-4', x: 15.0, z: 5.5, rotY: -Math.PI / 2, kind: 'window' },
  { id: 'breaker-deco', x: 1.0, z: 5.5, rotY: Math.PI / 2, kind: 'breaker' },
];

export interface EmergencyLightPlacement {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

export const EMERGENCY_LIGHT_PLACEMENTS: EmergencyLightPlacement[] = [
  { id: 'em-start', x: 1.0, z: 2.5, rotY: Math.PI / 2 },    // Quarto 01 (luz vermelha na parede oeste)
  { id: 'em-north', x: 7.5, z: 2.0, rotY: Math.PI },        // Corredor Norte
  { id: 'em-center', x: 8.0, z: 5.5, rotY: -Math.PI / 2 },  // Corredor Central
  { id: 'em-arch', x: 4.0, z: 9.5, rotY: -Math.PI / 2 },    // Sala de Arquivos
  { id: 'em-exit', x: 15.0, z: 11.5, rotY: -Math.PI / 2 },  // Saída Sudeste
];

export const WALL_ART_PLACEMENTS: WallArtPlacement[] = [
  { x: 2.5, z: 1.0, rotY: 0, kind: 'notice' },
  { x: 7.5, z: 1.0, rotY: 0, kind: 'graffiti' },
  { x: 9.5, z: 2.0, rotY: Math.PI, kind: 'anatomy' },
  { x: 15.0, z: 1.5, rotY: -Math.PI / 2, kind: 'graffiti' },
  { x: 6.5, z: 7.0, rotY: 0, kind: 'graffiti' },
  { x: 8.5, z: 8.0, rotY: Math.PI, kind: 'notice' },
  { x: 12.5, z: 11.0, rotY: 0, kind: 'anatomy' },
  { x: 11.5, z: 10.0, rotY: Math.PI, kind: 'graffiti' },
  { x: 3.5, z: 7.0, rotY: 0, kind: 'graffiti' },
];

export const FLOOR_STAIN_PLACEMENTS: FloorStainPlacement[] = [
  { x: 3.2, z: 2.2, rotY: 0.4, scale: 1.2 },
  { x: 6.3, z: 1.6, rotY: -0.2, scale: 1.5 },
  { x: 8.4, z: 5.8, rotY: -0.6, scale: 1.75 },
  { x: 10.5, z: 7.4, rotY: 1.1, scale: 2.1 },
  { x: 13.6, z: 3.9, rotY: 0.2, scale: 1.5 },
  { x: 5.5, z: 9.5, rotY: 2.0, scale: 1.6 },
  { x: 2.4, z: 8.7, rotY: 0.9, scale: 1.85 },
  { x: 13.8, z: 11.4, rotY: -0.4, scale: 1.45 },
];

export const PICKUP_PLACEMENTS: PropPlacement[] = [
  { id: 'bat-1', x: 3.4, z: 1.5, kind: 'battery' },   // Bateria no Quarto Inicial
  { id: 'bat-2', x: 11.5, z: 3.5, kind: 'battery' },  // Enfermaria NE
  { id: 'bat-3', x: 6.2, z: 11.5, kind: 'battery' },  // Ala Sudoeste
  { id: 'medkit-1', x: 14.3, z: 1.6, kind: 'medkit' },
  { id: 'medkit-2', x: 2.2, z: 11.4, kind: 'medkit' },
];

export interface LockerPlacement {
  id: string;
  x: number;
  z: number;
  rotY: number;
}

export const LOCKER_PLACEMENTS: LockerPlacement[] = [
  { id: 'locker-1', x: 3.5, z: 1.16, rotY: 0 },        // Quarto 01
  { id: 'locker-2', x: 11.5, z: 1.16, rotY: 0 },       // Enfermaria NE
  { id: 'locker-3', x: 2.5, z: 5.84, rotY: Math.PI },  // Corredor Oeste
  { id: 'locker-4', x: 8.5, z: 7.16, rotY: 0 },        // Ala Central
  { id: 'locker-5', x: 1.16, z: 9.2, rotY: Math.PI / 2 }, // Sala de Arquivos
  { id: 'locker-6', x: 11.5, z: 9.16, rotY: 0 },       // Corredor Sul
];

// Chave da Saída dentro da Sala de Arquivos (Sudoeste)
export const KEY_SPAWN = {
  x: 2.0 * CELL_SIZE,
  z: 8.3 * CELL_SIZE,
  y: 0.72,
};

// Disjuntor Principal dentro da Enfermaria (Nordeste)
export const BREAKER_PANEL_POS = {
  x: 12.5 * CELL_SIZE,
  z: 1.02 * CELL_SIZE,
  rotY: 0,
  interactX: 12.5 * CELL_SIZE,
  interactZ: 1.7 * CELL_SIZE,
};

// Jogador inicia dentro do Quarto 01 (Noroeste)
export const PLAYER_SPAWN = {
  x: 2.6 * CELL_SIZE,
  z: 2.4 * CELL_SIZE,
  yaw: -Math.PI / 2, // Olhando para Leste em direção à porta do quarto
};

// Assassino inicia longe, no corredor Sul-Central, patrulhando à procura do jogador
export const CREATURE_SPAWN = {
  x: 10.5 * CELL_SIZE,
  z: 9.5 * CELL_SIZE,
};

export const EXIT_DOOR_CELL = {
  x: 14.5,
  z: 11.88,
  rotY: Math.PI,
  triggerX: 14.35 * CELL_SIZE,
  triggerZ: 11.45 * CELL_SIZE,
};

export interface PickupItemPlacement {
  id: string;
  x: number;
  z: number;
}

export const BOTTLE_PLACEMENTS: PickupItemPlacement[] = [
  { id: 'bottle-1', x: 2.25, z: 3.35 },  // Quarto 01 (Sala Inicial)
  { id: 'bottle-2', x: 6.5, z: 1.45 },   // Corredor Norte
  { id: 'bottle-3', x: 13.5, z: 1.55 },  // Enfermaria NE
  { id: 'bottle-4', x: 5.5, z: 5.5 },    // Corredor Central
  { id: 'bottle-5', x: 3.4, z: 7.5 },    // Sala de Arquivos
  { id: 'bottle-6', x: 10.5, z: 11.4 },  // Corredor Sul
];

export const ALARM_PLACEMENTS: PickupItemPlacement[] = [
  { id: 'alarm-1', x: 5.5, z: 3.5 },   // Fora do Quarto 01
  { id: 'alarm-2', x: 11.5, z: 5.5 },  // Corredor Leste
  { id: 'alarm-3', x: 7.5, z: 7.5 },   // Ala Central
  { id: 'alarm-4', x: 5.5, z: 11.5 },  // Corredor Sudoeste
];

export const GLASS_PATCH_PLACEMENTS: PickupItemPlacement[] = [
  { id: 'glass-1', x: 5.5, z: 2.5 },   // Corredor fora do Quarto 01
  { id: 'glass-2', x: 8.5, z: 3.5 },   // Corredor Norte-Leste
  { id: 'glass-3', x: 13.5, z: 5.5 },  // Passagem Enfermaria-Leste
  { id: 'glass-4', x: 5.5, z: 7.5 },   // Cruzamento Central
  { id: 'glass-5', x: 11.5, z: 7.5 },  // Corredor Central-Leste
  { id: 'glass-6', x: 6.5, z: 9.5 },   // Corredor Sul-Central
  { id: 'glass-7', x: 12.5, z: 11.5 }, // Rumo à Saída
];

export interface BarricadePlacement {
  id: string;
  gridX: number;
  gridZ: number;
  axis: 'ns' | 'ew';
}

export const BARRICADE_PLACEMENTS: BarricadePlacement[] = [
  { id: 'bar-1', gridX: 6, gridZ: 4, axis: 'ns' },
  { id: 'bar-2', gridX: 9, gridZ: 4, axis: 'ns' },
  { id: 'bar-3', gridX: 5, gridZ: 6, axis: 'ns' },
  { id: 'bar-4', gridX: 11, gridZ: 6, axis: 'ns' },
];

export const TRAP_PLACEMENTS: PickupItemPlacement[] = [
  { id: 'trap-1', x: 1.6, z: 3.4 },  // Quarto 01 (perto do início)
  { id: 'trap-2', x: 9.5, z: 1.5 },  // Corredor Norte
  { id: 'trap-3', x: 3.4, z: 5.5 },  // Corredor Oeste
  { id: 'trap-4', x: 9.5, z: 9.5 },  // Corredor Sul
];

// Waypoints de patrulha e busca espalhados por todas as alas e salas
export const SEARCH_WAYPOINTS: { gx: number; gz: number }[] = [
  { gx: 2, gz: 2 },   // Quarto 01
  { gx: 7, gz: 1 },   // Corredor Norte
  { gx: 12, gz: 3 },  // Enfermaria NE
  { gx: 3, gz: 5 },   // Corredor Oeste
  { gx: 7, gz: 5 },   // Corredor Central
  { gx: 12, gz: 5 },  // Corredor Leste
  { gx: 2, gz: 8 },   // Sala de Arquivos
  { gx: 8, gz: 7 },   // Ala Central
  { gx: 10, gz: 9 },  // Corredor Sul
  { gx: 5, gz: 11 },  // Ala Sudoeste
  { gx: 13, gz: 11 }, // Corredor da Saída
];

export interface LevelConfig {
  version: number;
  name: string;
  rows: string[];
  doors: DoorPlacement[];
  lamps: PropPlacement[];
  emergencyLights: EmergencyLightPlacement[];
  props: PropPlacement[];
  wallArt: WallArtPlacement[];
  floorStains: FloorStainPlacement[];
  pickups: PropPlacement[];
  bottles: PickupItemPlacement[];
  alarms: PickupItemPlacement[];
  glassPatches: PickupItemPlacement[];
  barricades: BarricadePlacement[];
  traps: PickupItemPlacement[];
  lockers: LockerPlacement[];
  searchWaypoints: { gx: number; gz: number }[];
  keySpawn: { x: number; z: number; y: number };
  breakerPanelPos: { x: number; z: number; rotY: number; interactX: number; interactZ: number };
  playerSpawn: { x: number; z: number; yaw: number };
  creatureSpawn: { x: number; z: number };
  exitDoorCell: { x: number; z: number; rotY?: number; triggerX: number; triggerZ: number };
}

export const DEFAULT_LEVEL_CONFIG: LevelConfig = {
  version: 1,
  name: 'Plataforma Submersa Blackwood (Padrão)',
  rows: [...MAP_ROWS],
  doors: DOOR_PLACEMENTS.map((d) => ({ ...d })),
  lamps: LAMP_PLACEMENTS.map((l) => ({ ...l })),
  emergencyLights: EMERGENCY_LIGHT_PLACEMENTS.map((e) => ({ ...e })),
  props: PROP_PLACEMENTS.map((p) => ({ ...p })),
  wallArt: WALL_ART_PLACEMENTS.map((w) => ({ ...w })),
  floorStains: FLOOR_STAIN_PLACEMENTS.map((s) => ({ ...s })),
  pickups: PICKUP_PLACEMENTS.map((p) => ({ ...p })),
  bottles: BOTTLE_PLACEMENTS.map((b) => ({ ...b })),
  alarms: ALARM_PLACEMENTS.map((a) => ({ ...a })),
  glassPatches: GLASS_PATCH_PLACEMENTS.map((g) => ({ ...g })),
  barricades: BARRICADE_PLACEMENTS.map((b) => ({ ...b })),
  traps: TRAP_PLACEMENTS.map((t) => ({ ...t })),
  lockers: LOCKER_PLACEMENTS.map((l) => ({ ...l })),
  searchWaypoints: SEARCH_WAYPOINTS.map((w) => ({ ...w })),
  keySpawn: { ...KEY_SPAWN },
  breakerPanelPos: { ...BREAKER_PANEL_POS },
  playerSpawn: { ...PLAYER_SPAWN },
  creatureSpawn: { ...CREATURE_SPAWN },
  exitDoorCell: { ...EXIT_DOOR_CELL },
};

export function cloneLevelConfig(cfg: LevelConfig): LevelConfig {
  return {
    version: cfg.version,
    name: cfg.name,
    rows: [...cfg.rows],
    doors: cfg.doors.map((d) => ({ ...d })),
    lamps: cfg.lamps.map((l) => ({ ...l })),
    emergencyLights: cfg.emergencyLights.map((e) => ({ ...e })),
    props: cfg.props.map((p) => ({ ...p })),
    wallArt: cfg.wallArt.map((w) => ({ ...w })),
    floorStains: cfg.floorStains.map((s) => ({ ...s })),
    pickups: cfg.pickups.map((p) => ({ ...p })),
    bottles: cfg.bottles.map((b) => ({ ...b })),
    alarms: cfg.alarms.map((a) => ({ ...a })),
    glassPatches: cfg.glassPatches.map((g) => ({ ...g })),
    barricades: cfg.barricades.map((b) => ({ ...b })),
    traps: cfg.traps.map((t) => ({ ...t })),
    lockers: cfg.lockers.map((l) => ({ ...l })),
    searchWaypoints: cfg.searchWaypoints.map((w) => ({ ...w })),
    keySpawn: { ...cfg.keySpawn },
    breakerPanelPos: { ...cfg.breakerPanelPos },
    playerSpawn: { ...cfg.playerSpawn },
    creatureSpawn: { ...cfg.creatureSpawn },
    exitDoorCell: { ...cfg.exitDoorCell },
  };
}

export function inferDoorAxis(rows: readonly string[], gx: number, gz: number): 'ew' | 'ns' {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const wallAt = (x: number, z: number) =>
    x < 0 || z < 0 || x >= w || z >= h || rows[z][x] === '1';
  const nWall = wallAt(gx, gz - 1);
  const sWall = wallAt(gx, gz + 1);
  const wWall = wallAt(gx - 1, gz);
  const eWall = wallAt(gx + 1, gz);
  if ((nWall || sWall) && !wWall && !eWall) return 'ew';
  if ((wWall || eWall) && !nWall && !sWall) return 'ns';
  return 'ew';
}

export function inferWallFacing(
  rows: readonly string[],
  gx: number,
  gz: number,
): { rotY: number; wallDir: 'n' | 's' | 'w' | 'e' | null } {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const wallAt = (x: number, z: number) =>
    x < 0 || z < 0 || x >= w || z >= h || rows[z][x] === '1';
  if (wallAt(gx, gz - 1)) return { rotY: 0, wallDir: 'n' };
  if (wallAt(gx, gz + 1)) return { rotY: Math.PI, wallDir: 's' };
  if (wallAt(gx - 1, gz)) return { rotY: Math.PI / 2, wallDir: 'w' };
  if (wallAt(gx + 1, gz)) return { rotY: -Math.PI / 2, wallDir: 'e' };
  return { rotY: 0, wallDir: null };
}

export function findNearestWalkableCell(
  rows: readonly string[],
  targetGx: number,
  targetGz: number,
): { gx: number; gz: number } {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  let bestGx = Math.max(1, Math.min(w - 2, Math.round(targetGx)));
  let bestGz = Math.max(1, Math.min(h - 2, Math.round(targetGz)));
  if (rows[bestGz]?.[bestGx] === '0') return { gx: bestGx, gz: bestGz };

  let bestDist = Infinity;
  for (let z = 1; z < h - 1; z++) {
    for (let x = 1; x < w - 1; x++) {
      if (rows[z]?.[x] === '0') {
        const d = Math.hypot(x - targetGx, z - targetGz);
        if (d < bestDist) {
          bestDist = d;
          bestGx = x;
          bestGz = z;
        }
      }
    }
  }
  return { gx: bestGx, gz: bestGz };
}

export function sanitizeLevelConfig(raw: unknown): LevelConfig {
  if (!raw || typeof raw !== 'object') {
    return cloneLevelConfig(DEFAULT_LEVEL_CONFIG);
  }
  const obj = raw as Partial<LevelConfig>;
  const rawRows = Array.isArray(obj.rows) && obj.rows.length >= 6 ? obj.rows : [...MAP_ROWS];
  const height = Math.max(6, Math.min(28, rawRows.length));
  const width = Math.max(6, Math.min(32, typeof rawRows[0] === 'string' ? rawRows[0].length : MAP_WIDTH));

  const rows: string[] = [];
  for (let z = 0; z < height; z++) {
    const src = typeof rawRows[z] === 'string' ? rawRows[z] : '';
    let rowStr = '';
    for (let x = 0; x < width; x++) {
      const isBorder = z === 0 || z === height - 1 || x === 0 || x === width - 1;
      if (isBorder) {
        rowStr += '1';
      } else {
        rowStr += src[x] === '1' ? '1' : '0';
      }
    }
    rows.push(rowStr);
  }

  // Ensure at least two walkable interior cells exist
  let walkableCount = 0;
  for (let z = 1; z < height - 1; z++) {
    for (let x = 1; x < width - 1; x++) {
      if (rows[z][x] === '0') walkableCount++;
    }
  }
  if (walkableCount === 0) {
    const chars = rows[1].split('');
    chars[1] = '0';
    chars[Math.min(width - 2, 2)] = '0';
    rows[1] = chars.join('');
  }

  const inGrid = (gx: number, gz: number) => gx >= 1 && gz >= 1 && gx < width - 1 && gz < height - 1;
  const inCellCoord = (x: number, z: number) => x >= 0.8 && z >= 0.8 && x <= width - 0.8 && z <= height - 0.8;

  const base = cloneLevelConfig(DEFAULT_LEVEL_CONFIG);
  const clampPoint = (pt: { x: number; z: number } | undefined, fallback: { x: number; z: number }) => {
    const x = typeof pt?.x === 'number' && Number.isFinite(pt.x) ? pt.x : fallback.x;
    const z = typeof pt?.z === 'number' && Number.isFinite(pt.z) ? pt.z : fallback.z;
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    if (rows[gz]?.[gx] === '0') {
      return { x, z };
    }
    const cell = findNearestWalkableCell(rows, gx, gz);
    return { x: (cell.gx + 0.5) * CELL_SIZE, z: (cell.gz + 0.5) * CELL_SIZE };
  };

  const pSpawnClamped = clampPoint(obj.playerSpawn, base.playerSpawn);
  const cSpawnClamped = clampPoint(obj.creatureSpawn, base.creatureSpawn);
  const kSpawnClamped = clampPoint(obj.keySpawn, base.keySpawn);

  const waypoints = Array.isArray(obj.searchWaypoints)
    ? obj.searchWaypoints.filter((w) => inGrid(w.gx, w.gz) && rows[w.gz][w.gx] === '0')
    : base.searchWaypoints.filter((w) => inGrid(w.gx, w.gz) && rows[w.gz][w.gx] === '0');

  if (waypoints.length === 0) {
    for (let z = 1; z < height - 1; z += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        if (rows[z][x] === '0') waypoints.push({ gx: x, gz: z });
      }
    }
    if (waypoints.length === 0) {
      waypoints.push(findNearestWalkableCell(rows, Math.floor(width / 2), Math.floor(height / 2)));
    }
  }

  const breaker = obj.breakerPanelPos ?? base.breakerPanelPos;
  const exit = obj.exitDoorCell ?? base.exitDoorCell;

  return {
    version: 1,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : base.name,
    rows,
    doors: (Array.isArray(obj.doors) ? obj.doors : base.doors).filter(
      (d) => inGrid(d.gridX, d.gridZ) && rows[d.gridZ][d.gridX] === '0',
    ),
    lamps: (Array.isArray(obj.lamps) ? obj.lamps : base.lamps).filter((l) => inCellCoord(l.x, l.z)),
    emergencyLights: (Array.isArray(obj.emergencyLights) ? obj.emergencyLights : base.emergencyLights).filter((e) =>
      inCellCoord(e.x, e.z),
    ),
    props: (Array.isArray(obj.props) ? obj.props : base.props).filter((p) => inCellCoord(p.x, p.z)),
    wallArt: (Array.isArray(obj.wallArt) ? obj.wallArt : base.wallArt).filter((w) => inCellCoord(w.x, w.z)),
    floorStains: (Array.isArray(obj.floorStains) ? obj.floorStains : base.floorStains).filter((s) =>
      inCellCoord(s.x, s.z),
    ),
    pickups: (Array.isArray(obj.pickups) ? obj.pickups : base.pickups).filter((p) => inCellCoord(p.x, p.z)),
    bottles: (Array.isArray(obj.bottles) ? obj.bottles : base.bottles).filter((b) => inCellCoord(b.x, b.z)),
    alarms: (Array.isArray(obj.alarms) ? obj.alarms : base.alarms).filter((a) => inCellCoord(a.x, a.z)),
    glassPatches: (Array.isArray(obj.glassPatches) ? obj.glassPatches : base.glassPatches).filter((g) =>
      inCellCoord(g.x, g.z),
    ),
    barricades: (Array.isArray(obj.barricades) ? obj.barricades : base.barricades).filter(
      (b) => inGrid(b.gridX, b.gridZ) && rows[b.gridZ][b.gridX] === '0',
    ),
    traps: (Array.isArray(obj.traps) ? obj.traps : base.traps).filter((t) => inCellCoord(t.x, t.z)),
    lockers: (Array.isArray(obj.lockers) ? obj.lockers : base.lockers).filter((l) => inCellCoord(l.x, l.z)),
    searchWaypoints: waypoints,
    keySpawn: {
      x: kSpawnClamped.x,
      z: kSpawnClamped.z,
      y: typeof obj.keySpawn?.y === 'number' ? obj.keySpawn.y : 0.72,
    },
    breakerPanelPos: {
      x: Math.max(CELL_SIZE, Math.min((width - 1) * CELL_SIZE, breaker.x)),
      z: Math.max(CELL_SIZE, Math.min((height - 1) * CELL_SIZE, breaker.z)),
      rotY: typeof breaker.rotY === 'number' ? breaker.rotY : 0,
      interactX: Math.max(CELL_SIZE, Math.min((width - 1) * CELL_SIZE, breaker.interactX)),
      interactZ: Math.max(CELL_SIZE, Math.min((height - 1) * CELL_SIZE, breaker.interactZ)),
    },
    playerSpawn: {
      x: pSpawnClamped.x,
      z: pSpawnClamped.z,
      yaw: typeof obj.playerSpawn?.yaw === 'number' ? obj.playerSpawn.yaw : -Math.PI / 2,
    },
    creatureSpawn: cSpawnClamped,
    exitDoorCell: {
      x: Math.max(1, Math.min(width - 1, exit.x)),
      z: Math.max(1, Math.min(height - 1, exit.z)),
      rotY: typeof exit.rotY === 'number' ? exit.rotY : 0,
      triggerX: Math.max(CELL_SIZE, Math.min((width - 1) * CELL_SIZE, exit.triggerX)),
      triggerZ: Math.max(CELL_SIZE, Math.min((height - 1) * CELL_SIZE, exit.triggerZ)),
    },
  };
}

export function loadSavedLevelConfig(): LevelConfig {
  try {
    const raw = window.localStorage.getItem(LEVEL_STORAGE_KEY);
    if (!raw) return cloneLevelConfig(DEFAULT_LEVEL_CONFIG);
    return sanitizeLevelConfig(JSON.parse(raw));
  } catch {
    return cloneLevelConfig(DEFAULT_LEVEL_CONFIG);
  }
}

export function exportLevelAsMapDataTs(cfg: LevelConfig): string {
  const w = cfg.rows[0]?.length ?? MAP_WIDTH;
  const h = cfg.rows.length;
  return [
    `export const MAP_ROWS = ${JSON.stringify(cfg.rows, null, 2)} as const;`,
    `export const MAP_WIDTH = ${w};`,
    `export const MAP_HEIGHT = ${h};`,
    `export const DOOR_PLACEMENTS = ${JSON.stringify(cfg.doors, null, 2)};`,
    `export const LAMP_PLACEMENTS = ${JSON.stringify(cfg.lamps, null, 2)};`,
    `export const EMERGENCY_LIGHT_PLACEMENTS = ${JSON.stringify(cfg.emergencyLights, null, 2)};`,
    `export const PROP_PLACEMENTS = ${JSON.stringify(cfg.props, null, 2)};`,
    `export const PICKUP_PLACEMENTS = ${JSON.stringify(cfg.pickups, null, 2)};`,
    `export const LOCKER_PLACEMENTS = ${JSON.stringify(cfg.lockers, null, 2)};`,
    `export const BOTTLE_PLACEMENTS = ${JSON.stringify(cfg.bottles, null, 2)};`,
    `export const ALARM_PLACEMENTS = ${JSON.stringify(cfg.alarms, null, 2)};`,
    `export const GLASS_PATCH_PLACEMENTS = ${JSON.stringify(cfg.glassPatches, null, 2)};`,
    `export const BARRICADE_PLACEMENTS = ${JSON.stringify(cfg.barricades, null, 2)};`,
    `export const TRAP_PLACEMENTS = ${JSON.stringify(cfg.traps, null, 2)};`,
    `export const SEARCH_WAYPOINTS = ${JSON.stringify(cfg.searchWaypoints, null, 2)};`,
    `export const KEY_SPAWN = ${JSON.stringify(cfg.keySpawn, null, 2)};`,
    `export const BREAKER_PANEL_POS = ${JSON.stringify(cfg.breakerPanelPos, null, 2)};`,
    `export const PLAYER_SPAWN = ${JSON.stringify(cfg.playerSpawn, null, 2)};`,
    `export const CREATURE_SPAWN = ${JSON.stringify(cfg.creatureSpawn, null, 2)};`,
    `export const EXIT_DOOR_CELL = ${JSON.stringify(cfg.exitDoorCell, null, 2)};`,
  ].join('\n\n');
}

export interface ClosedDoorBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function isWallAtGrid(gx: number, gz: number, rows: readonly string[] = MAP_ROWS): boolean {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (gx < 0 || gz < 0 || gx >= w || gz >= h) return true;
  return rows[gz][gx] === '1';
}

export function isWallAtWorld(
  wx: number,
  wz: number,
  radius = 0.38,
  closedDoorBoxes?: ClosedDoorBox[],
  rows: readonly string[] = MAP_ROWS,
): boolean {
  const minGx = Math.floor((wx - radius) / CELL_SIZE);
  const maxGx = Math.floor((wx + radius) / CELL_SIZE);
  const minGz = Math.floor((wz - radius) / CELL_SIZE);
  const maxGz = Math.floor((wz + radius) / CELL_SIZE);

  for (let gz = minGz; gz <= maxGz; gz++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      if (isWallAtGrid(gx, gz, rows)) return true;
    }
  }

  if (closedDoorBoxes && closedDoorBoxes.length > 0) {
    for (let i = 0; i < closedDoorBoxes.length; i++) {
      const box = closedDoorBoxes[i];
      if (
        wx + radius > box.minX &&
        wx - radius < box.maxX &&
        wz + radius > box.minZ &&
        wz - radius < box.maxZ
      ) {
        return true;
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
  closedDoorBoxes?: ClosedDoorBox[],
  rows: readonly string[] = MAP_ROWS,
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  const steps = Math.ceil(dist / 0.18);
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 1; i < steps; i++) {
    const px = x1 + sx * i;
    const pz = z1 + sz * i;
    if (isWallAtWorld(px, pz, 0.04, closedDoorBoxes, rows)) return false;
  }
  return true;
}
