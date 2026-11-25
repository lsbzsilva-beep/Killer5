import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eraser,
  Hand,
  Maximize2,
  Pencil,
  Play,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CELL_SIZE,
  DEFAULT_LEVEL_CONFIG,
  LevelConfig,
  cloneLevelConfig,
  exportLevelAsMapDataTs,
  findNearestWalkableCell,
  inferDoorAxis,
  inferWallFacing,
  sanitizeLevelConfig,
} from '../game/mapData';

type ToolId =
  | 'wall'
  | 'floor'
  | 'erase'
  | 'door'
  | 'barricade'
  | 'locker'
  | 'lamp'
  | 'emergency'
  | 'glass'
  | 'bottle'
  | 'trap'
  | 'alarm'
  | 'battery'
  | 'medkit'
  | 'gurney'
  | 'chair'
  | 'cabinet'
  | 'iv'
  | 'window'
  | 'pipe'
  | 'waypoint'
  | 'player'
  | 'killer'
  | 'key'
  | 'breaker'
  | 'exit';

type ToolGroup = 'estrutura' | 'mecanicas' | 'cenário' | 'missao';

interface ToolDef {
  id: ToolId;
  label: string;
  group: ToolGroup;
  accent: string;
}

const TOOLS: ToolDef[] = [
  { id: 'wall', label: 'Parede', group: 'estrutura', accent: '#9ca3af' },
  { id: 'floor', label: 'Piso', group: 'estrutura', accent: '#e5e7eb' },
  { id: 'door', label: 'Porta', group: 'estrutura', accent: '#f3b644' },
  { id: 'barricade', label: 'Barricada', group: 'estrutura', accent: '#fb923c' },
  { id: 'erase', label: 'Apagar', group: 'estrutura', accent: '#f87171' },

  { id: 'locker', label: 'Armário', group: 'mecanicas', accent: '#60a5fa' },
  { id: 'glass', label: 'Cacos Vidro', group: 'mecanicas', accent: '#93c5fd' },
  { id: 'bottle', label: 'Frasco', group: 'mecanicas', accent: '#38bdf8' },
  { id: 'trap', label: 'Armadilha', group: 'mecanicas', accent: '#80ff72' },
  { id: 'alarm', label: 'Despertador', group: 'mecanicas', accent: '#fbbf24' },
  { id: 'battery', label: 'Bateria', group: 'mecanicas', accent: '#34d399' },
  { id: 'medkit', label: 'Kit Médico', group: 'mecanicas', accent: '#f87171' },

  { id: 'lamp', label: 'Lâmpada Teto', group: 'cenário', accent: '#fde68a' },
  { id: 'emergency', label: 'Luz Vermelha', group: 'cenário', accent: '#ff3b30' },
  { id: 'gurney', label: 'Maca', group: 'cenário', accent: '#a1a1aa' },
  { id: 'chair', label: 'Cadeira', group: 'cenário', accent: '#a1a1aa' },
  { id: 'cabinet', label: 'Armário Méd.', group: 'cenário', accent: '#cbd5e1' },
  { id: 'iv', label: 'Suporte Soro', group: 'cenário', accent: '#cbd5e1' },
  { id: 'window', label: 'Janela', group: 'cenário', accent: '#bae6fd' },
  { id: 'pipe', label: 'Cano Parede', group: 'cenário', accent: '#71717a' },

  { id: 'player', label: 'Jogador', group: 'missao', accent: '#ffffff' },
  { id: 'killer', label: 'Assassino', group: 'missao', accent: '#ff3b30' },
  { id: 'key', label: 'Chave', group: 'missao', accent: '#ffd166' },
  { id: 'breaker', label: 'Disjuntor', group: 'missao', accent: '#22d3ee' },
  { id: 'exit', label: 'Saída', group: 'missao', accent: '#80ff72' },
  { id: 'waypoint', label: 'Rota IA', group: 'missao', accent: '#c084fc' },
];

const GROUP_LABELS: Record<ToolGroup, string> = {
  estrutura: 'Estrutura',
  mecanicas: 'Sobrevivência & Armadilhas',
  cenário: 'Iluminação & Mobília',
  missao: 'Missão & IA',
};

const MOBILE_GROUP_LABELS: Record<ToolGroup, string> = {
  estrutura: 'Estrutura',
  mecanicas: 'Itens',
  cenário: 'Cenário',
  missao: 'Missão',
};

const DIR_ANGLES = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // S(+Z), W(-X), N(-Z), E(+X)
const DIR_SHORT = ['S', 'O', 'N', 'L'];

function nextRightAngle(rot: number): number {
  const step = Math.round(rot / (Math.PI / 2));
  const next = (step + 1) * (Math.PI / 2);
  let a = next;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

function makeUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function isItemInCell(cx: number, cz: number, gx: number, gz: number, rotY = 0): boolean {
  const rx = cx + Math.sin(rotY) * 0.08;
  const rz = cz + Math.cos(rotY) * 0.08;
  return Math.floor(rx) === gx && Math.floor(rz) === gz;
}

interface LevelEditorProps {
  initialConfig: LevelConfig;
  onSaveAndTest: (config: LevelConfig) => void;
  onSaveOnly: (config: LevelConfig) => void;
  onClose: () => void;
}

export function LevelEditor({
  initialConfig,
  onSaveAndTest,
  onSaveOnly,
  onClose,
}: LevelEditorProps) {
  const [config, setConfig] = useState<LevelConfig>(() => cloneLevelConfig(initialConfig));
  const [undoStack, setUndoStack] = useState<LevelConfig[]>([]);
  const [activeTool, setActiveTool] = useState<ToolId>('wall');
  const [mobileGroup, setMobileGroup] = useState<ToolGroup>('estrutura');
  const [panMode, setPanMode] = useState(false);
  const [manualRotIdx, setManualRotIdx] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<{ gx: number; gz: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ gx: number; gz: number } | null>(null);
  const [showMobileSheet, setShowMobileSheet] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [copiedMode, setCopiedMode] = useState<'json' | 'ts' | null>(null);

  // Viewport fit + pinch/pan zoom state
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: 640, h: 480 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const lastBrushRef = useRef<ToolId>('wall');
  const isPaintingRef = useRef<'wall' | 'floor' | 'erase' | null>(null);
  const lastPaintedCellRef = useRef<string | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const singlePanRef = useRef<{ pointerId: number; startX: number; startY: number; basePanX: number; basePanY: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ dist: number; midX: number; midY: number; baseZoom: number; basePanX: number; basePanY: number } | null>(null);

  const mapH = config.rows.length;
  const mapW = config.rows[0]?.length ?? 16;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ w: rect.width, h: rect.height });
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectBrush = useCallback((tool: ToolId) => {
    setActiveTool(tool);
    if (tool !== 'erase') {
      lastBrushRef.current = tool;
    }
    setPanMode(false);
  }, []);

  const pushUndo = useCallback((snapshot: LevelConfig) => {
    setUndoStack((prev) => [...prev.slice(-39), cloneLevelConfig(snapshot)]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setConfig(last);
      return prev.slice(0, -1);
    });
  }, []);

  const rotateTargetCellOrTool = useCallback(() => {
    const target = hoveredCell ?? selectedCell;
    if (!target) {
      setManualRotIdx((i) => (i + 1) % 4);
      return;
    }
    const { gx, gz } = target;

    setConfig((prev) => {
      const next = cloneLevelConfig(prev);
      let rotated = false;

      const door = next.doors.find((d) => d.gridX === gx && d.gridZ === gz);
      if (door) {
        door.axis = door.axis === 'ew' ? 'ns' : 'ew';
        rotated = true;
      }

      const bar = next.barricades.find((b) => b.gridX === gx && b.gridZ === gz);
      if (bar) {
        bar.axis = bar.axis === 'ns' ? 'ew' : 'ns';
        rotated = true;
      }

      const locker = next.lockers.find((l) => isItemInCell(l.x, l.z, gx, gz, l.rotY));
      if (locker) {
        locker.rotY = nextRightAngle(locker.rotY);
        const dirX = Math.sin(locker.rotY);
        const dirZ = Math.cos(locker.rotY);
        locker.x = gx + 0.5 - dirX * 0.34;
        locker.z = gz + 0.5 - dirZ * 0.34;
        rotated = true;
      }

      const em = next.emergencyLights.find((e) => isItemInCell(e.x, e.z, gx, gz, e.rotY));
      if (em) {
        em.rotY = nextRightAngle(em.rotY);
        const dirX = Math.sin(em.rotY);
        const dirZ = Math.cos(em.rotY);
        em.x = gx + 0.5 - dirX * 0.49;
        em.z = gz + 0.5 - dirZ * 0.49;
        rotated = true;
      }

      const prop = next.props.find((p) => isItemInCell(p.x, p.z, gx, gz, p.rotY ?? 0));
      if (prop) {
        prop.rotY = nextRightAngle(prop.rotY ?? 0);
        rotated = true;
      }

      const pGx = Math.floor(next.playerSpawn.x / CELL_SIZE);
      const pGz = Math.floor(next.playerSpawn.z / CELL_SIZE);
      if (pGx === gx && pGz === gz) {
        next.playerSpawn.yaw = nextRightAngle(next.playerSpawn.yaw);
        rotated = true;
      }

      const bGx = Math.floor(next.breakerPanelPos.x / CELL_SIZE);
      const bGz = Math.floor(next.breakerPanelPos.z / CELL_SIZE);
      if (bGx === gx && bGz === gz) {
        const nr = nextRightAngle(next.breakerPanelPos.rotY);
        const dx = Math.sin(nr);
        const dz = Math.cos(nr);
        next.breakerPanelPos.rotY = nr;
        next.breakerPanelPos.x = (gx + 0.5 - dx * 0.48) * CELL_SIZE;
        next.breakerPanelPos.z = (gz + 0.5 - dz * 0.48) * CELL_SIZE;
        next.breakerPanelPos.interactX = (gx + 0.5 + dx * 0.2) * CELL_SIZE;
        next.breakerPanelPos.interactZ = (gz + 0.5 + dz * 0.2) * CELL_SIZE;
        rotated = true;
      }

      const eGx = Math.floor(next.exitDoorCell.triggerX / CELL_SIZE);
      const eGz = Math.floor(next.exitDoorCell.triggerZ / CELL_SIZE);
      if (eGx === gx && eGz === gz) {
        const nr = nextRightAngle(next.exitDoorCell.rotY ?? 0);
        const dx = Math.sin(nr);
        const dz = Math.cos(nr);
        next.exitDoorCell.rotY = nr;
        next.exitDoorCell.x = gx + 0.5 - dx * 0.38;
        next.exitDoorCell.z = gz + 0.5 - dz * 0.38;
        next.exitDoorCell.triggerX = (gx + 0.5) * CELL_SIZE;
        next.exitDoorCell.triggerZ = (gz + 0.5) * CELL_SIZE;
        rotated = true;
      }

      if (!rotated) {
        setManualRotIdx((i) => (i + 1) % 4);
        return prev;
      }
      pushUndo(prev);
      return next;
    });
  }, [hoveredCell, pushUndo, selectedCell]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        rotateTargetCellOrTool();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
      } else if (e.code === 'Escape') {
        if (showExportModal) setShowExportModal(false);
        else if (showMobileSheet) setShowMobileSheet(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleUndo, rotateTargetCellOrTool, showExportModal, showMobileSheet]);

  const eraseCellItems = useCallback((draft: LevelConfig, gx: number, gz: number, alsoClearWall: boolean) => {
    draft.doors = draft.doors.filter((d) => !(d.gridX === gx && d.gridZ === gz));
    draft.barricades = draft.barricades.filter((b) => !(b.gridX === gx && b.gridZ === gz));
    draft.lockers = draft.lockers.filter((l) => !isItemInCell(l.x, l.z, gx, gz, l.rotY));
    draft.lamps = draft.lamps.filter((l) => !isItemInCell(l.x, l.z, gx, gz));
    draft.emergencyLights = draft.emergencyLights.filter((e) => !isItemInCell(e.x, e.z, gx, gz, e.rotY));
    draft.glassPatches = draft.glassPatches.filter((g) => !isItemInCell(g.x, g.z, gx, gz));
    draft.bottles = draft.bottles.filter((b) => !isItemInCell(b.x, b.z, gx, gz));
    draft.traps = draft.traps.filter((t) => !isItemInCell(t.x, t.z, gx, gz));
    draft.alarms = draft.alarms.filter((a) => !isItemInCell(a.x, a.z, gx, gz));
    draft.pickups = draft.pickups.filter((p) => !isItemInCell(p.x, p.z, gx, gz));
    draft.props = draft.props.filter((p) => !isItemInCell(p.x, p.z, gx, gz, p.rotY ?? 0));
    draft.searchWaypoints = draft.searchWaypoints.filter((w) => !(w.gx === gx && w.gz === gz));

    const h = draft.rows.length;
    const w = draft.rows[0].length;
    if (alsoClearWall && gx > 0 && gz > 0 && gx < w - 1 && gz < h - 1 && draft.rows[gz][gx] === '1') {
      const chars = draft.rows[gz].split('');
      chars[gx] = '0';
      draft.rows[gz] = chars.join('');
    }
  }, []);

  const applyToolAt = useCallback(
    (gx: number, gz: number, overrideTool?: ToolId, isDrag = false) => {
      const tool = overrideTool ?? activeTool;
      const isBorder = gx <= 0 || gz <= 0 || gx >= mapW - 1 || gz >= mapH - 1;

      setConfig((prev) => {
        const next = cloneLevelConfig(prev);
        const h = next.rows.length;
        const w = next.rows[0].length;
        if (gx < 0 || gz < 0 || gx >= w || gz >= h) return prev;

        const isWall = next.rows[gz][gx] === '1';

        if (tool === 'wall') {
          if (isBorder || isWall) return prev;
          if (!isDrag) pushUndo(prev);
          const chars = next.rows[gz].split('');
          chars[gx] = '1';
          next.rows[gz] = chars.join('');
          eraseCellItems(next, gx, gz, false);
          return next;
        }

        if (tool === 'floor') {
          if (isBorder || !isWall) return prev;
          if (!isDrag) pushUndo(prev);
          const chars = next.rows[gz].split('');
          chars[gx] = '0';
          next.rows[gz] = chars.join('');
          return next;
        }

        if (tool === 'erase') {
          if (isBorder) return prev;
          if (!isDrag) pushUndo(prev);
          eraseCellItems(next, gx, gz, true);
          return next;
        }

        if (isDrag) return prev;
        if (isBorder) return prev;

        pushUndo(prev);

        if (next.rows[gz][gx] === '1') {
          const chars = next.rows[gz].split('');
          chars[gx] = '0';
          next.rows[gz] = chars.join('');
        }

        const facing = inferWallFacing(next.rows, gx, gz);
        const rotY = facing.wallDir !== null ? facing.rotY : DIR_ANGLES[manualRotIdx];
        const dirX = Math.sin(rotY);
        const dirZ = Math.cos(rotY);

        switch (tool) {
          case 'door': {
            const existing = next.doors.find((d) => d.gridX === gx && d.gridZ === gz);
            if (existing) {
              existing.axis = existing.axis === 'ew' ? 'ns' : 'ew';
            } else {
              next.doors.push({
                id: makeUid('door'),
                gridX: gx,
                gridZ: gz,
                axis: inferDoorAxis(next.rows, gx, gz),
                label: 'Porta',
              });
            }
            break;
          }
          case 'barricade': {
            const existing = next.barricades.find((b) => b.gridX === gx && b.gridZ === gz);
            if (existing) {
              existing.axis = existing.axis === 'ns' ? 'ew' : 'ns';
            } else {
              next.barricades.push({
                id: makeUid('bar'),
                gridX: gx,
                gridZ: gz,
                axis: inferDoorAxis(next.rows, gx, gz) === 'ew' ? 'ew' : 'ns',
              });
            }
            break;
          }
          case 'locker': {
            const existing = next.lockers.find((l) => isItemInCell(l.x, l.z, gx, gz, l.rotY));
            if (existing) {
              existing.rotY = nextRightAngle(existing.rotY);
              const lx = Math.sin(existing.rotY);
              const lz = Math.cos(existing.rotY);
              existing.x = gx + 0.5 - lx * 0.34;
              existing.z = gz + 0.5 - lz * 0.34;
            } else {
              next.lockers.push({
                id: makeUid('locker'),
                x: gx + 0.5 - dirX * 0.34,
                z: gz + 0.5 - dirZ * 0.34,
                rotY,
              });
            }
            break;
          }
          case 'lamp': {
            next.lamps = next.lamps.filter((l) => !isItemInCell(l.x, l.z, gx, gz));
            next.lamps.push({ id: makeUid('lamp'), x: gx + 0.5, z: gz + 0.5, kind: 'lamp' });
            break;
          }
          case 'emergency': {
            next.emergencyLights = next.emergencyLights.filter(
              (e) => !isItemInCell(e.x, e.z, gx, gz, e.rotY),
            );
            next.emergencyLights.push({
              id: makeUid('em'),
              x: gx + 0.5 - dirX * 0.49,
              z: gz + 0.5 - dirZ * 0.49,
              rotY,
            });
            break;
          }
          case 'glass': {
            next.glassPatches = next.glassPatches.filter(
              (g) => !isItemInCell(g.x, g.z, gx, gz),
            );
            next.glassPatches.push({ id: makeUid('glass'), x: gx + 0.5, z: gz + 0.5 });
            break;
          }
          case 'bottle': {
            next.bottles = next.bottles.filter((b) => !isItemInCell(b.x, b.z, gx, gz));
            next.bottles.push({ id: makeUid('bottle'), x: gx + 0.5, z: gz + 0.5 });
            break;
          }
          case 'trap': {
            next.traps = next.traps.filter((t) => !isItemInCell(t.x, t.z, gx, gz));
            next.traps.push({ id: makeUid('trap'), x: gx + 0.5, z: gz + 0.5 });
            break;
          }
          case 'alarm': {
            next.alarms = next.alarms.filter((a) => !isItemInCell(a.x, a.z, gx, gz));
            next.alarms.push({ id: makeUid('alarm'), x: gx + 0.5, z: gz + 0.5 });
            break;
          }
          case 'battery':
          case 'medkit': {
            next.pickups = next.pickups.filter((p) => !isItemInCell(p.x, p.z, gx, gz));
            next.pickups.push({ id: makeUid(tool), x: gx + 0.5, z: gz + 0.5, kind: tool });
            break;
          }
          case 'gurney':
          case 'chair':
          case 'cabinet':
          case 'iv':
          case 'window':
          case 'pipe': {
            next.props = next.props.filter((p) => !isItemInCell(p.x, p.z, gx, gz, p.rotY ?? 0));
            const wallSnap = tool === 'window' || tool === 'pipe' || tool === 'cabinet';
            next.props.push({
              id: makeUid(tool),
              x: wallSnap ? gx + 0.5 - dirX * 0.42 : gx + 0.5,
              z: wallSnap ? gz + 0.5 - dirZ * 0.42 : gz + 0.5,
              rotY,
              kind: tool,
            });
            break;
          }
          case 'waypoint': {
            const exists = next.searchWaypoints.some((wp) => wp.gx === gx && wp.gz === gz);
            if (exists && next.searchWaypoints.length > 1) {
              next.searchWaypoints = next.searchWaypoints.filter((wp) => !(wp.gx === gx && wp.gz === gz));
            } else if (!exists) {
              next.searchWaypoints.push({ gx, gz });
            }
            break;
          }
          case 'player': {
            next.playerSpawn = {
              x: (gx + 0.5) * CELL_SIZE,
              z: (gz + 0.5) * CELL_SIZE,
              yaw: DIR_ANGLES[manualRotIdx],
            };
            break;
          }
          case 'killer': {
            next.creatureSpawn = {
              x: (gx + 0.5) * CELL_SIZE,
              z: (gz + 0.5) * CELL_SIZE,
            };
            break;
          }
          case 'key': {
            next.keySpawn = {
              x: (gx + 0.5) * CELL_SIZE,
              z: (gz + 0.5) * CELL_SIZE,
              y: 0.72,
            };
            break;
          }
          case 'breaker': {
            next.breakerPanelPos = {
              x: (gx + 0.5 - dirX * 0.48) * CELL_SIZE,
              z: (gz + 0.5 - dirZ * 0.48) * CELL_SIZE,
              rotY,
              interactX: (gx + 0.5 + dirX * 0.2) * CELL_SIZE,
              interactZ: (gz + 0.5 + dirZ * 0.2) * CELL_SIZE,
            };
            break;
          }
          case 'exit': {
            next.exitDoorCell = {
              x: gx + 0.5 - dirX * 0.38,
              z: gz + 0.5 - dirZ * 0.38,
              rotY,
              triggerX: (gx + 0.5) * CELL_SIZE,
              triggerZ: (gz + 0.5) * CELL_SIZE,
            };
            break;
          }
        }
        return next;
      });
    },
    [activeTool, eraseCellItems, manualRotIdx, mapH, mapW, pushUndo],
  );

  // Reachability validation (BFS from Player Spawn across walkable floor tiles)
  const validation = useMemo(() => {
    const startGx = Math.floor(config.playerSpawn.x / CELL_SIZE);
    const startGz = Math.floor(config.playerSpawn.z / CELL_SIZE);
    const visited = new Set<string>();
    const queue: [number, number][] = [];
    if (config.rows[startGz]?.[startGx] === '0') {
      visited.add(`${startGx},${startGz}`);
      queue.push([startGx, startGz]);
    }
    while (queue.length > 0) {
      const [cx, cz] = queue.shift()!;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const nz = cz + dz;
        const key = `${nx},${nz}`;
        if (!visited.has(key) && config.rows[nz]?.[nx] === '0') {
          visited.add(key);
          queue.push([nx, nz]);
        }
      }
    }

    const keyCell = `${Math.floor(config.keySpawn.x / CELL_SIZE)},${Math.floor(config.keySpawn.z / CELL_SIZE)}`;
    const breakerCell = `${Math.floor(config.breakerPanelPos.interactX / CELL_SIZE)},${Math.floor(
      config.breakerPanelPos.interactZ / CELL_SIZE,
    )}`;
    const exitCell = `${Math.floor(config.exitDoorCell.triggerX / CELL_SIZE)},${Math.floor(
      config.exitDoorCell.triggerZ / CELL_SIZE,
    )}`;
    const killerCell = `${Math.floor(config.creatureSpawn.x / CELL_SIZE)},${Math.floor(
      config.creatureSpawn.z / CELL_SIZE,
    )}`;

    const keyReachable = visited.has(keyCell);
    const breakerReachable = visited.has(breakerCell);
    const exitReachable = visited.has(exitCell);
    const killerReachable = visited.has(killerCell);

    return {
      keyReachable,
      breakerReachable,
      exitReachable,
      killerReachable,
      allOk: keyReachable && breakerReachable && exitReachable && killerReachable,
      floorCells: visited.size,
    };
  }, [config]);

  const handleResizeGrid = (newW: number, newH: number) => {
    const clampedW = Math.max(8, Math.min(26, newW));
    const clampedH = Math.max(8, Math.min(20, newH));
    pushUndo(config);

    const next = cloneLevelConfig(config);
    const newRows: string[] = [];
    for (let z = 0; z < clampedH; z++) {
      let row = '';
      for (let x = 0; x < clampedW; x++) {
        const border = z === 0 || z === clampedH - 1 || x === 0 || x === clampedW - 1;
        if (border) {
          row += '1';
        } else if (z < next.rows.length - 1 && x < next.rows[0].length - 1) {
          row += next.rows[z][x];
        } else {
          row += '0';
        }
      }
      newRows.push(row);
    }
    next.rows = newRows;
    setConfig(sanitizeLevelConfig(next));
  };

  const handleClearToEmptyRoom = () => {
    pushUndo(config);
    const rows: string[] = [];
    for (let z = 0; z < mapH; z++) {
      let row = '';
      for (let x = 0; x < mapW; x++) {
        row += z === 0 || z === mapH - 1 || x === 0 || x === mapW - 1 ? '1' : '0';
      }
      rows.push(row);
    }
    const pCell = findNearestWalkableCell(rows, 2, 2);
    const kCell = findNearestWalkableCell(rows, mapW - 3, mapH - 3);
    const keyCell = findNearestWalkableCell(rows, 2, mapH - 3);
    const bCell = findNearestWalkableCell(rows, mapW - 3, 1);
    const eCell = findNearestWalkableCell(rows, mapW - 2, mapH - 2);

    setConfig(
      sanitizeLevelConfig({
        version: 1,
        name: 'Mapa Personalizado',
        rows,
        doors: [],
        lamps: [{ id: 'lamp-1', x: Math.floor(mapW / 2) + 0.5, z: Math.floor(mapH / 2) + 0.5, kind: 'lamp' }],
        emergencyLights: [{ id: 'em-1', x: 1.0, z: 2.5, rotY: Math.PI / 2 }],
        props: [],
        wallArt: [],
        floorStains: [],
        pickups: [],
        bottles: [],
        alarms: [],
        glassPatches: [],
        barricades: [],
        traps: [],
        lockers: [{ id: 'locker-1', x: 2.5, z: 1.16, rotY: 0 }],
        searchWaypoints: [
          { gx: pCell.gx, gz: pCell.gz },
          { gx: kCell.gx, gz: kCell.gz },
          { gx: keyCell.gx, gz: keyCell.gz },
        ],
        playerSpawn: { x: (pCell.gx + 0.5) * CELL_SIZE, z: (pCell.gz + 0.5) * CELL_SIZE, yaw: -Math.PI / 2 },
        creatureSpawn: { x: (kCell.gx + 0.5) * CELL_SIZE, z: (kCell.gz + 0.5) * CELL_SIZE },
        keySpawn: { x: (keyCell.gx + 0.5) * CELL_SIZE, z: (keyCell.gz + 0.5) * CELL_SIZE, y: 0.72 },
        breakerPanelPos: {
          x: (bCell.gx + 0.5) * CELL_SIZE,
          z: (bCell.gz + 0.02) * CELL_SIZE,
          rotY: 0,
          interactX: (bCell.gx + 0.5) * CELL_SIZE,
          interactZ: (bCell.gz + 0.7) * CELL_SIZE,
        },
        exitDoorCell: {
          x: eCell.gx + 0.5,
          z: eCell.gz + 0.88,
          rotY: Math.PI,
          triggerX: (eCell.gx + 0.5) * CELL_SIZE,
          triggerZ: (eCell.gz + 0.45) * CELL_SIZE,
        },
      }),
    );
  };

  const handleResetDefault = () => {
    pushUndo(config);
    setConfig(cloneLevelConfig(DEFAULT_LEVEL_CONFIG));
  };

  const copyExport = async (mode: 'json' | 'ts') => {
    const clean = sanitizeLevelConfig(config);
    const text = mode === 'json' ? JSON.stringify(clean, null, 2) : exportLevelAsMapDataTs(clean);
    await navigator.clipboard.writeText(text);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  const downloadJson = () => {
    const clean = sanitizeLevelConfig(config);
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blackwood-level.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importText);
      const sanitized = sanitizeLevelConfig(parsed);
      pushUndo(config);
      setConfig(sanitized);
      setImportError('');
      setShowExportModal(false);
      setShowMobileSheet(false);
    } catch {
      setImportError('JSON inválido. Verifique a sintaxe e tente novamente.');
    }
  };

  const clampZoom = (z: number) => Math.max(0.7, Math.min(2.8, Number(z.toFixed(2))));

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getCellFromClientPoint = useCallback(
    (clientX: number, clientY: number): { gx: number; gz: number } | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        return null;
      }
      const gx = Math.floor(((clientX - rect.left) / rect.width) * mapW);
      const gz = Math.floor(((clientY - rect.top) / rect.height) * mapH);
      if (gx < 0 || gz < 0 || gx >= mapW || gz >= mapH) return null;
      return { gx, gz };
    },
    [mapH, mapW],
  );

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unsupported
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch-to-zoom & pan takes immediate priority
    if (activePointersRef.current.size === 2) {
      isPaintingRef.current = null;
      singlePanRef.current = null;
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      pinchRef.current = {
        dist: Math.max(12, Math.hypot(dx, dy)),
        midX: (pts[0].x + pts[1].x) * 0.5,
        midY: (pts[0].y + pts[1].y) * 0.5,
        baseZoom: zoom,
        basePanX: pan.x,
        basePanY: pan.y,
      };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    const cell = getCellFromClientPoint(e.clientX, e.clientY);

    // Middle mouse or Pan/Inspect mode
    if (e.button === 1 || (panMode && e.button !== 2)) {
      singlePanRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        basePanX: pan.x,
        basePanY: pan.y,
        moved: false,
      };
      if (cell) setSelectedCell(cell);
      return;
    }

    if (!cell) return;
    setSelectedCell(cell);

    if (e.button === 2) {
      isPaintingRef.current = 'erase';
      lastPaintedCellRef.current = `${cell.gx},${cell.gz}`;
      applyToolAt(cell.gx, cell.gz, 'erase', false);
      return;
    }

    if (activeTool === 'wall' || activeTool === 'floor' || activeTool === 'erase') {
      isPaintingRef.current = activeTool;
    }
    lastPaintedCellRef.current = `${cell.gx},${cell.gz}`;
    applyToolAt(cell.gx, cell.gz, activeTool, false);
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.max(12, Math.hypot(dx, dy));
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      const scaleRatio = dist / pinchRef.current.dist;
      setZoom(clampZoom(pinchRef.current.baseZoom * scaleRatio));
      setPan({
        x: pinchRef.current.basePanX + (midX - pinchRef.current.midX),
        y: pinchRef.current.basePanY + (midY - pinchRef.current.midY),
      });
      return;
    }

    if (singlePanRef.current && singlePanRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - singlePanRef.current.startX;
      const dy = e.clientY - singlePanRef.current.startY;
      if (Math.hypot(dx, dy) > 4) singlePanRef.current.moved = true;
      setPan({
        x: singlePanRef.current.basePanX + dx,
        y: singlePanRef.current.basePanY + dy,
      });
      return;
    }

    const cell = getCellFromClientPoint(e.clientX, e.clientY);
    if (e.pointerType === 'mouse') {
      setHoveredCell(cell);
    }

    if (isPaintingRef.current && cell) {
      const key = `${cell.gx},${cell.gz}`;
      if (lastPaintedCellRef.current !== key) {
        lastPaintedCellRef.current = key;
        setSelectedCell(cell);
        applyToolAt(cell.gx, cell.gz, isPaintingRef.current, true);
      }
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    if (singlePanRef.current?.pointerId === e.pointerId) {
      singlePanRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      isPaintingRef.current = null;
      lastPaintedCellRef.current = null;
    }
  };

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => clampZoom(z + delta));
  };

  const pGx = Math.floor(config.playerSpawn.x / CELL_SIZE);
  const pGz = Math.floor(config.playerSpawn.z / CELL_SIZE);
  const kGx = Math.floor(config.creatureSpawn.x / CELL_SIZE);
  const kGz = Math.floor(config.creatureSpawn.z / CELL_SIZE);
  const keyGx = Math.floor(config.keySpawn.x / CELL_SIZE);
  const keyGz = Math.floor(config.keySpawn.z / CELL_SIZE);
  const bGx = Math.floor(config.breakerPanelPos.interactX / CELL_SIZE);
  const bGz = Math.floor(config.breakerPanelPos.interactZ / CELL_SIZE);
  const eGx = Math.floor(config.exitDoorCell.triggerX / CELL_SIZE);
  const eGz = Math.floor(config.exitDoorCell.triggerZ / CELL_SIZE);

  // Auto-fit cell pixel size to current viewport so 100% zoom always fits comfortably
  const availW = Math.max(240, viewportSize.w - 28);
  const availH = Math.max(200, viewportSize.h - 42);
  const cellSizePx = Math.max(
    18,
    Math.min(44, Math.floor(Math.min(availW / mapW, availH / mapH))),
  );

  const activeToolDef = TOOLS.find((t) => t.id === activeTool) ?? TOOLS[0];
  const displayCell = hoveredCell ?? selectedCell;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#060608] text-[#f4f4f0]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Mobile Compact Single-Row Header (< lg) */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/20 bg-[#0a0b0e] px-2.5 py-1.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-display text-sm font-bold tracking-[0.14em] text-white whitespace-nowrap">
            EDITOR
          </span>
          <span className="text-[11px] text-white/55 tabular-nums whitespace-nowrap">
            {mapW}×{mapH}
          </span>
          <button
            type="button"
            onClick={() => setShowMobileSheet(true)}
            className={`min-h-[36px] px-2 text-[11px] font-bold whitespace-nowrap border ${
              validation.allOk
                ? 'border-[#80ff72]/50 bg-[#80ff72]/10 text-[#80ff72]'
                : 'border-[#ff3b30]/70 bg-[#ff3b30]/15 text-[#ff6b63]'
            }`}
            aria-label="Abrir validação e configurações da planta"
          >
            {validation.allOk ? '✓ OK' : '! Alerta'}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/25 bg-[#121318] text-white disabled:opacity-35"
            aria-label="Desfazer"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowMobileSheet(true)}
            className="flex min-h-[40px] items-center gap-1 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold text-white"
            aria-label="Opções do mapa"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="whitespace-nowrap">Planta</span>
          </button>

          <button
            type="button"
            onClick={() => onSaveAndTest(sanitizeLevelConfig(config))}
            className="flex min-h-[40px] items-center gap-1 bg-[#f4f4f0] px-3 text-xs font-bold tracking-wider text-[#050506]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="whitespace-nowrap">3D</span>
          </button>
        </div>
      </header>

      {/* Desktop Toolbar (lg+) */}
      <header className="hidden shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/20 bg-[#0a0b0e] px-4 py-2.5 lg:flex">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-display text-base font-bold tracking-[0.18em] text-white">
              EDITOR DE NÍVEIS · BLACKWOOD
            </h2>
            <p className="text-[11px] text-white/60 tabular-nums">
              Clique/arraste paredes · Botão direito apaga · [R] rotaciona · {mapW}×{mapH} células ({(mapW * CELL_SIZE).toFixed(0)}m × {(mapH * CELL_SIZE).toFixed(0)}m)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={rotateTargetCellOrTool}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold hover:bg-white hover:text-black"
            title="Rotacionar item selecionado ou ferramenta atual (R)"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Girar [R]</span>
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold hover:bg-white hover:text-black disabled:opacity-35"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Desfazer</span>
          </button>

          <button
            type="button"
            onClick={handleClearToEmptyRoom}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold hover:bg-white hover:text-black"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Sala Vazia</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefault}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold hover:bg-white hover:text-black"
          >
            <span className="whitespace-nowrap">Mapa Padrão</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportText('');
              setImportError('');
              setShowExportModal(true);
            }}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/25 bg-[#121318] px-2.5 text-xs font-semibold hover:bg-white hover:text-black"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Exportar / Importar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const clean = sanitizeLevelConfig(config);
              onSaveOnly(clean);
              onClose();
            }}
            className="flex min-h-[36px] items-center gap-1.5 border border-white/30 bg-[#121318] px-3 text-xs font-semibold hover:bg-white hover:text-black"
          >
            <X className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">Salvar e Sair</span>
          </button>

          <button
            type="button"
            onClick={() => onSaveAndTest(sanitizeLevelConfig(config))}
            className="flex min-h-[36px] items-center gap-1.5 bg-[#f4f4f0] px-3.5 text-xs font-bold tracking-wider text-[#050506] hover:bg-white"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="whitespace-nowrap">TESTAR EM 3D</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Desktop Left Brush & Grid Size Sidebar (lg+) */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-white/20 bg-[#090a0d] p-3 lg:block">
          {/* Grid Size Controls */}
          <div className="mb-3 border border-white/15 bg-[#0e1015] p-2.5">
            <div className="text-[11px] font-bold tracking-wider text-white/75 uppercase">
              Dimensões da Planta
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between gap-2 border border-white/15 bg-[#060608] px-2 py-1">
                <span className="text-white/65">Larg.</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleResizeGrid(mapW - 1, mapH)}
                    className="px-1.5 font-bold hover:text-white"
                  >
                    -
                  </button>
                  <span className="w-5 text-center font-bold tabular-nums">{mapW}</span>
                  <button
                    type="button"
                    onClick={() => handleResizeGrid(mapW + 1, mapH)}
                    className="px-1.5 font-bold hover:text-white"
                  >
                    +
                  </button>
                </div>
              </label>
              <label className="flex items-center justify-between gap-2 border border-white/15 bg-[#060608] px-2 py-1">
                <span className="text-white/65">Alt.</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleResizeGrid(mapW, mapH - 1)}
                    className="px-1.5 font-bold hover:text-white"
                  >
                    -
                  </button>
                  <span className="w-5 text-center font-bold tabular-nums">{mapH}</span>
                  <button
                    type="button"
                    onClick={() => handleResizeGrid(mapW, mapH + 1)}
                    className="px-1.5 font-bold hover:text-white"
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
          </div>

          {/* Brush Groups */}
          <div className="space-y-3">
            {(['estrutura', 'mecanicas', 'cenário', 'missao'] as const).map((group) => (
              <div key={group}>
                <div className="mb-1.5 text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
                  {GROUP_LABELS[group]}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TOOLS.filter((t) => t.group === group).map((tool) => {
                    const selected = !panMode && activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => selectBrush(tool.id)}
                        className={`flex min-h-[34px] items-center gap-2 border px-2 py-1 text-left text-[11px] font-semibold transition-colors ${
                          selected
                            ? 'border-white bg-[#f4f4f0] text-[#050506]'
                            : 'border-white/15 bg-[#0e1015] text-white/85 hover:border-white/45'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 border border-black/40"
                          style={{ backgroundColor: tool.accent }}
                        />
                        <span className="truncate">{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Live Validation Summary */}
          <div className="mt-4 border border-white/15 bg-[#0e1015] p-2.5 text-[11px]">
            <div className="font-bold tracking-wider text-white/80 uppercase">
              Validação da Fase
            </div>
            <div className="mt-1.5 space-y-1">
              <div className={validation.keyReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                {validation.keyReachable ? '✓ Chave acessível' : '✗ Chave bloqueada por paredes'}
              </div>
              <div className={validation.breakerReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                {validation.breakerReachable ? '✓ Disjuntor acessível' : '✗ Disjuntor bloqueado'}
              </div>
              <div className={validation.exitReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                {validation.exitReachable ? '✓ Saída acessível' : '✗ Saída bloqueada'}
              </div>
              <div className={validation.killerReachable ? 'text-[#80ff72]' : 'text-[#f3b644]'}>
                {validation.killerReachable ? '✓ Assassino conectado à rota' : '! Assassino isolado'}
              </div>
              <div className="pt-1 text-white/55 tabular-nums">
                Portas: {config.doors.length} · Armários: {config.lockers.length} · Rotas IA: {config.searchWaypoints.length}
              </div>
            </div>
          </div>
        </aside>

        {/* Interactive Blueprint Grid Viewport (Pinch-Zoom + Drag-Paint + Pan) */}
        <main className="relative flex min-h-0 flex-1 flex-col bg-[#060608]">
          {/* Desktop Info & Zoom Strip */}
          <div className="hidden shrink-0 items-center justify-between border-b border-white/10 bg-[#08090c] px-4 py-1.5 text-[11px] text-white/65 tabular-nums lg:flex">
            <div className="flex items-center gap-4">
              <span>
                Célula: {displayCell ? `(${displayCell.gx}, ${displayCell.gz})` : '—'}
              </span>
              <span>
                Rotação: {['Sul (0°)', 'Oeste (-90°)', 'Norte (180°)', 'Leste (+90°)'][manualRotIdx]}
              </span>
              <span>
                <Eraser className="mr-1 inline h-3 w-3" />
                Clique direito apaga · Roda do mouse dá zoom
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPanMode((v) => !v)}
                className={`flex min-h-[28px] items-center gap-1 border px-2 text-[11px] font-semibold ${
                  panMode
                    ? 'border-white bg-[#f4f4f0] text-[#050506]'
                    : 'border-white/20 bg-[#111319] text-white/80 hover:border-white/45'
                }`}
              >
                <Hand className="h-3 w-3" />
                <span>Mover</span>
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z - 0.2))}
                className="flex min-h-[28px] min-w-[28px] items-center justify-center border border-white/20 bg-[#111319] text-white/85 hover:border-white/45"
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                className="min-h-[28px] border border-white/20 bg-[#111319] px-2 text-[11px] font-semibold text-white/85 hover:border-white/45"
                title="Resetar enquadramento"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => clampZoom(z + 0.2))}
                className="flex min-h-[28px] min-w-[28px] items-center justify-center border border-white/20 bg-[#111319] text-white/85 hover:border-white/45"
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Pan/Zoom Touch Canvas Surface */}
          <div
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onWheel={handleViewportWheel}
            className="relative flex flex-1 items-center justify-center overflow-hidden touch-none select-none bg-[#060608]"
          >
            {/* Mobile Floating Status & Zoom Overlay */}
            <div className="pointer-events-none absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2 lg:hidden">
              <div className="border border-white/20 bg-[#08090c]/92 px-2 py-1 text-[10px] text-white/80 tabular-nums">
                {panMode ? 'Modo Mover · Arraste' : `Pincel: ${activeToolDef.label}`}
                {' · '}
                {displayCell ? `(${displayCell.gx},${displayCell.gz})` : 'Toque no grid'}
              </div>

              <div
                className="pointer-events-auto flex items-center gap-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z - 0.25))}
                  className="flex min-h-[38px] min-w-[38px] items-center justify-center border border-white/25 bg-[#0c0d12] text-white"
                  aria-label="Diminuir zoom"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  className="flex min-h-[38px] items-center gap-1 border border-white/25 bg-[#0c0d12] px-2 text-[10px] font-bold text-white tabular-nums"
                  aria-label="Centralizar mapa"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>{Math.round(zoom * 100)}%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clampZoom(z + 0.25))}
                  className="flex min-h-[38px] min-w-[38px] items-center justify-center border border-white/25 bg-[#0c0d12] text-white"
                  aria-label="Aumentar zoom"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Transformed Blueprint Grid Container */}
            <div
              className="border border-white/30 bg-[#0d0e13] p-1 shadow-2xl"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <div
                ref={gridRef}
                className="select-none"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${mapW}, ${cellSizePx}px)`,
                  gridTemplateRows: `repeat(${mapH}, ${cellSizePx}px)`,
                }}
              >
                {config.rows.map((row, gz) =>
                  row.split('').map((cell, gx) => {
                    const isWall = cell === '1';
                    const isBorder = gx === 0 || gz === 0 || gx === mapW - 1 || gz === mapH - 1;
                    const isSelected = selectedCell?.gx === gx && selectedCell?.gz === gz;

                    const door = config.doors.find((d) => d.gridX === gx && d.gridZ === gz);
                    const barricade = config.barricades.find((b) => b.gridX === gx && b.gridZ === gz);
                    const locker = config.lockers.find((l) => isItemInCell(l.x, l.z, gx, gz, l.rotY));
                    const lamp = config.lamps.find((l) => isItemInCell(l.x, l.z, gx, gz));
                    const emLight = config.emergencyLights.find((e) => isItemInCell(e.x, e.z, gx, gz, e.rotY));
                    const glass = config.glassPatches.find((g) => isItemInCell(g.x, g.z, gx, gz));
                    const bottle = config.bottles.find((b) => isItemInCell(b.x, b.z, gx, gz));
                    const trap = config.traps.find((t) => isItemInCell(t.x, t.z, gx, gz));
                    const alarm = config.alarms.find((a) => isItemInCell(a.x, a.z, gx, gz));
                    const pickup = config.pickups.find((p) => isItemInCell(p.x, p.z, gx, gz));
                    const prop = config.props.find((p) => isItemInCell(p.x, p.z, gx, gz, p.rotY ?? 0));
                    const isWp = config.searchWaypoints.some((w) => w.gx === gx && w.gz === gz);

                    const hasPlayer = pGx === gx && pGz === gz;
                    const hasKiller = kGx === gx && kGz === gz;
                    const hasKey = keyGx === gx && keyGz === gz;
                    const hasBreaker = bGx === gx && bGz === gz;
                    const hasExit = eGx === gx && eGz === gz;

                    return (
                      <div
                        key={`${gx}-${gz}`}
                        className={`relative border border-white/[0.06] ${
                          isWall
                            ? isBorder
                              ? 'bg-[#191b22]'
                              : 'bg-[#2a2e39]'
                            : 'bg-[#0b0c10]'
                        } ${isSelected ? 'ring-1 ring-inset ring-white/80' : ''}`}
                        style={{ width: cellSizePx, height: cellSizePx }}
                      >
                        {isWall && (
                          <div
                            className="pointer-events-none absolute inset-0 opacity-25"
                            style={{
                              backgroundImage:
                                'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.18) 4px, rgba(255,255,255,0.18) 5px)',
                            }}
                          />
                        )}

                        {lamp && (
                          <div className="pointer-events-none absolute inset-1.5 rounded-full border border-[#fde68a]/65 bg-[#fde68a]/10" />
                        )}

                        {emLight && (
                          <div
                            className="pointer-events-none absolute h-2 w-2 rounded-full bg-[#ff3b30]"
                            style={{
                              left: `${(emLight.x - gx) * 100}%`,
                              top: `${(emLight.z - gz) * 100}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        )}

                        {glass && (
                          <div className="pointer-events-none absolute inset-1 flex items-center justify-center text-[10px] font-bold text-[#93c5fd]">
                            ✦
                          </div>
                        )}

                        {door && (
                          <div
                            className="pointer-events-none absolute bg-[#f3b644]"
                            style={
                              door.axis === 'ew'
                                ? { left: '42%', top: 0, width: '16%', height: '100%' }
                                : { left: 0, top: '42%', width: '100%', height: '16%' }
                            }
                          />
                        )}

                        {barricade && (
                          <div
                            className="pointer-events-none absolute border border-[#fb923c] bg-[#fb923c]/35"
                            style={
                              barricade.axis === 'ns'
                                ? { left: '14%', top: '34%', width: '72%', height: '32%' }
                                : { left: '34%', top: '14%', width: '32%', height: '72%' }
                            }
                          />
                        )}

                        {locker && (
                          <div
                            className="pointer-events-none absolute flex items-center justify-center border border-[#60a5fa] bg-[#60a5fa]/35 text-[8px] font-bold text-white"
                            style={{
                              left: `${(locker.x - gx) * 100}%`,
                              top: `${(locker.z - gz) * 100}%`,
                              width: '38%',
                              height: '38%',
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            A
                          </div>
                        )}

                        {prop && (
                          <div className="pointer-events-none absolute bottom-0.5 right-0.5 bg-white/15 px-0.5 text-[8px] font-bold text-white/80">
                            {prop.kind === 'gurney'
                              ? 'M'
                              : prop.kind === 'chair'
                              ? 'C'
                              : prop.kind === 'window'
                              ? 'J'
                              : prop.kind === 'cabinet'
                              ? 'G'
                              : prop.kind === 'iv'
                              ? 'S'
                              : 'P'}
                          </div>
                        )}

                        {isWp && (
                          <div className="pointer-events-none absolute top-0.5 left-0.5 h-2 w-2 rotate-45 border border-[#c084fc] bg-[#c084fc]/35" />
                        )}

                        {bottle && (
                          <div className="pointer-events-none absolute top-0.5 right-0.5 text-[9px] font-bold text-[#38bdf8]">
                            F
                          </div>
                        )}
                        {trap && (
                          <div className="pointer-events-none absolute bottom-0.5 left-0.5 text-[9px] font-bold text-[#80ff72]">
                            X
                          </div>
                        )}
                        {alarm && (
                          <div className="pointer-events-none absolute top-1 left-1 text-[9px] font-bold text-[#fbbf24]">
                            ⏰
                          </div>
                        )}
                        {pickup && (
                          <div
                            className={`pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-bold ${
                              pickup.kind === 'medkit' ? 'text-[#f87171]' : 'text-[#34d399]'
                            }`}
                          >
                            {pickup.kind === 'medkit' ? '+' : '⚡'}
                          </div>
                        )}

                        {hasKey && (
                          <div className="pointer-events-none absolute inset-1 flex items-center justify-center border border-[#ffd166] bg-[#ffd166]/25 text-[10px] font-bold text-[#ffd166]">
                            🔑
                          </div>
                        )}
                        {hasBreaker && (
                          <div className="pointer-events-none absolute inset-1 flex items-center justify-center border border-[#22d3ee] bg-[#22d3ee]/25 text-[10px] font-bold text-[#22d3ee]">
                            ⚡
                          </div>
                        )}
                        {hasExit && (
                          <div className="pointer-events-none absolute inset-0.5 flex items-center justify-center border-2 border-[#80ff72] bg-[#80ff72]/20 text-[8px] font-bold text-[#80ff72]">
                            SAÍDA
                          </div>
                        )}
                        {hasKiller && (
                          <div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-full border-2 border-[#ff3b30] bg-[#ff3b30]/40 text-[10px] font-bold text-white">
                            K
                          </div>
                        )}
                        {hasPlayer && (
                          <div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-full border-2 border-white bg-white/30 text-[10px] font-bold text-white">
                            P
                          </div>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          {/* Desktop Compact Legend Footer */}
          <div className="hidden shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/10 bg-[#08090c] py-2 text-[10px] text-white/65 lg:flex">
            <span><b className="text-white">P</b> Jogador</span>
            <span><b className="text-[#ff3b30]">K</b> Assassino</span>
            <span><b className="text-[#ffd166]">🔑</b> Chave</span>
            <span><b className="text-[#22d3ee]">⚡</b> Disjuntor</span>
            <span><b className="text-[#80ff72]">SAÍDA</b> Porta Final</span>
            <span><b className="text-[#f3b644]">■</b> Porta</span>
            <span><b className="text-[#fb923c]">■</b> Barricada</span>
            <span><b className="text-[#60a5fa]">A</b> Armário</span>
            <span><b className="text-[#80ff72]">X</b> Armadilha</span>
            <span><b className="text-[#38bdf8]">F</b> Frasco</span>
            <span><b className="text-[#c084fc]">◆</b> Rota IA</span>
          </div>
        </main>

        {/* Mobile Thumb-Zone Bottom Dock (< lg) */}
        <footer className="flex shrink-0 flex-col border-t border-white/20 bg-[#090a0d] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {/* Row 1: Quick Mode & Precision Actions */}
          <div className="grid grid-cols-4 gap-1.5 border-b border-white/10 px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                if (activeTool === 'erase') {
                  selectBrush(lastBrushRef.current);
                } else {
                  setPanMode(false);
                }
              }}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 border text-xs font-semibold ${
                !panMode && activeTool !== 'erase'
                  ? 'border-white bg-[#f4f4f0] text-[#050506]'
                  : 'border-white/20 bg-[#12141a] text-white/85'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Pintar</span>
            </button>

            <button
              type="button"
              onClick={() => setPanMode((v) => !v)}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 border text-xs font-semibold ${
                panMode
                  ? 'border-white bg-[#f4f4f0] text-[#050506]'
                  : 'border-white/20 bg-[#12141a] text-white/85'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
              <span>Mover</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!panMode && activeTool === 'erase') {
                  selectBrush(lastBrushRef.current);
                } else {
                  selectBrush('erase');
                }
              }}
              className={`flex min-h-[42px] items-center justify-center gap-1.5 border text-xs font-semibold ${
                !panMode && activeTool === 'erase'
                  ? 'border-[#f87171] bg-[#f87171] text-[#050506]'
                  : 'border-white/20 bg-[#12141a] text-white/85'
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Apagar</span>
            </button>

            <button
              type="button"
              onClick={rotateTargetCellOrTool}
              className="flex min-h-[42px] items-center justify-center gap-1.5 border border-white/20 bg-[#12141a] text-xs font-semibold text-white active:bg-white active:text-black"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Girar ({DIR_SHORT[manualRotIdx]})</span>
            </button>
          </div>

          {/* Row 2: Category Tabs */}
          <div className="grid grid-cols-4 border-b border-white/10 bg-[#0c0e13]">
            {(['estrutura', 'mecanicas', 'cenário', 'missao'] as const).map((group) => {
              const active = mobileGroup === group;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setMobileGroup(group)}
                  className={`min-h-[38px] px-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-colors ${
                    active
                      ? 'border-b-2 border-white bg-[#151822] text-white'
                      : 'text-white/55'
                  }`}
                >
                  {MOBILE_GROUP_LABELS[group]}
                </button>
              );
            })}
          </div>

          {/* Row 3: Horizontal Thumb Brush Rail */}
          <div className="flex touch-pan-x items-center gap-1.5 overflow-x-auto px-2 py-2">
            {TOOLS.filter((t) => t.group === mobileGroup).map((tool) => {
              const selected = !panMode && activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectBrush(tool.id)}
                  className={`flex min-h-[44px] shrink-0 items-center gap-2 border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                    selected
                      ? 'border-white bg-[#f4f4f0] text-[#050506]'
                      : 'border-white/20 bg-[#12141a] text-white/90'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 border border-black/40"
                    style={{ backgroundColor: tool.accent }}
                  />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </footer>
      </div>

      {/* Mobile Options, Dimensions & Validation Drawer (< lg) */}
      {showMobileSheet && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 lg:hidden"
          onClick={() => setShowMobileSheet(false)}
        >
          <div
            className="max-h-[85dvh] touch-pan-y overflow-y-auto border-t border-white/35 bg-[#090a0d] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <h3 className="text-sm font-bold tracking-wider text-white uppercase">
                Planta & Opções
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileSheet(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/25 text-white"
                aria-label="Fechar opções"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Validation */}
            <div className="mt-3 border border-white/15 bg-[#0e1015] p-3 text-xs">
              <div className="font-bold tracking-wider text-white/80 uppercase">
                Validação da Fase
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className={validation.keyReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                  {validation.keyReachable ? '✓ Chave acessível' : '✗ Chave bloqueada'}
                </div>
                <div className={validation.breakerReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                  {validation.breakerReachable ? '✓ Disjuntor OK' : '✗ Disjuntor bloqueado'}
                </div>
                <div className={validation.exitReachable ? 'text-[#80ff72]' : 'text-[#ff3b30]'}>
                  {validation.exitReachable ? '✓ Saída acessível' : '✗ Saída bloqueada'}
                </div>
                <div className={validation.killerReachable ? 'text-[#80ff72]' : 'text-[#f3b644]'}>
                  {validation.killerReachable ? '✓ Assassino OK' : '! Assassino isolado'}
                </div>
              </div>
              <div className="mt-2 text-[11px] text-white/55 tabular-nums">
                Portas: {config.doors.length} · Armários: {config.lockers.length} · Rotas IA: {config.searchWaypoints.length}
              </div>
            </div>

            {/* Grid Dimensions */}
            <div className="mt-3 border border-white/15 bg-[#0e1015] p-3">
              <div className="text-xs font-bold tracking-wider text-white/80 uppercase">
                Dimensões ({(mapW * CELL_SIZE).toFixed(0)}m × {(mapH * CELL_SIZE).toFixed(0)}m)
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center justify-between border border-white/15 bg-[#060608] p-1.5">
                  <span className="pl-1 text-white/70">Larg.</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleResizeGrid(mapW - 1, mapH)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/20 bg-[#12141a] text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums">{mapW}</span>
                    <button
                      type="button"
                      onClick={() => handleResizeGrid(mapW + 1, mapH)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/20 bg-[#12141a] text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border border-white/15 bg-[#060608] p-1.5">
                  <span className="pl-1 text-white/70">Alt.</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleResizeGrid(mapW, mapH - 1)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/20 bg-[#12141a] text-sm font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums">{mapH}</span>
                    <button
                      type="button"
                      onClick={() => handleResizeGrid(mapW, mapH + 1)}
                      className="flex min-h-[40px] min-w-[40px] items-center justify-center border border-white/20 bg-[#12141a] text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleClearToEmptyRoom();
                  setShowMobileSheet(false);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/25 bg-[#12141a] px-3 text-xs font-semibold text-white"
              >
                <Trash2 className="h-4 w-4" />
                <span>Sala Vazia</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleResetDefault();
                  setShowMobileSheet(false);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/25 bg-[#12141a] px-3 text-xs font-semibold text-white"
              >
                <span>Mapa Padrão</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportText('');
                  setImportError('');
                  setShowMobileSheet(false);
                  setShowExportModal(true);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/25 bg-[#12141a] px-3 text-xs font-semibold text-white"
              >
                <Download className="h-4 w-4" />
                <span>Exportar / Importar</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const clean = sanitizeLevelConfig(config);
                  onSaveOnly(clean);
                  onClose();
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 border border-white/30 bg-[#12141a] px-3 text-xs font-semibold text-white"
              >
                <X className="h-4 w-4" />
                <span>Salvar e Sair</span>
              </button>
            </div>

            {/* Symbol Legend */}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/15 pt-2.5 text-[11px] text-white/70">
              <span><b className="text-white">P</b> Jogador</span>
              <span><b className="text-[#ff3b30]">K</b> Assassino</span>
              <span><b className="text-[#ffd166]">🔑</b> Chave</span>
              <span><b className="text-[#22d3ee]">⚡</b> Disjuntor</span>
              <span><b className="text-[#80ff72]">SAÍDA</b> Porta Final</span>
              <span><b className="text-[#f3b644]">■</b> Porta</span>
              <span><b className="text-[#fb923c]">■</b> Barricada</span>
              <span><b className="text-[#60a5fa]">A</b> Armário</span>
              <span><b className="text-[#80ff72]">X</b> Armadilha</span>
              <span><b className="text-[#38bdf8]">F</b> Frasco</span>
              <span><b className="text-[#c084fc]">◆</b> Rota IA</span>
            </div>
          </div>
        </div>
      )}

      {/* Export / Import Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="max-h-[90dvh] w-full max-w-xl touch-pan-y overflow-y-auto border border-white/60 bg-[#090a0d] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-white/15 pb-3">
              <h3 className="text-sm font-bold tracking-wider text-white uppercase">
                Exportar / Importar Planta
              </h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyExport('json')}
                className="flex min-h-[44px] items-center gap-1.5 border border-white/30 bg-[#12141a] px-3 text-xs font-semibold hover:bg-white hover:text-black"
              >
                {copiedMode === 'json' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedMode === 'json' ? 'JSON Copiado!' : 'Copiar JSON'}
              </button>

              <button
                type="button"
                onClick={() => copyExport('ts')}
                className="flex min-h-[44px] items-center gap-1.5 border border-white/30 bg-[#12141a] px-3 text-xs font-semibold hover:bg-white hover:text-black"
              >
                {copiedMode === 'ts' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedMode === 'ts' ? 'Código Copiado!' : 'Copiar mapData.ts'}
              </button>

              <button
                type="button"
                onClick={downloadJson}
                className="flex min-h-[44px] items-center gap-1.5 border border-white/30 bg-[#12141a] px-3 text-xs font-semibold hover:bg-white hover:text-black"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar .json
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-white/75">
                Importar JSON de um nível salvo anteriormente:
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Cole aqui o JSON exportado..."
                rows={5}
                className="mt-1.5 w-full select-text border border-white/25 bg-[#050506] p-2.5 font-mono text-[11px] text-white outline-none focus:border-white"
              />
              {importError && (
                <p className="mt-1 text-xs text-[#ff3b30]">{importError}</p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!importText.trim()}
                  className="flex min-h-[44px] items-center gap-1.5 bg-[#f4f4f0] px-4 text-xs font-bold text-[#050506] hover:bg-white disabled:opacity-40"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Carregar JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
