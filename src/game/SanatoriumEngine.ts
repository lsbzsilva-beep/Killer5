import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  CELL_SIZE,
  ClosedDoorBox,
  DEFAULT_LEVEL_CONFIG,
  LevelConfig,
  WALL_HEIGHT,
  hasLineOfSight,
  isWallAtGrid,
  isWallAtWorld,
  sanitizeLevelConfig,
} from './mapData';
import { SanatoriumTextures, createSanatoriumTextures } from './textures';
import {
  ColorDepthMode,
  DitherMode,
  DitherPalette,
  DitherShader,
  MIXED_5_COLORS,
  PALETTE_COLORS,
  applySoftwareBayerDither,
  createBlueNoiseTexture,
  setColorSrgbHex,
} from './DitherPostProcess';
import {
  AlarmDecoyRig,
  BarricadeObstacleRig,
  CreatureRig,
  EmergencySconceRig,
  FloorTrapRig,
  InteriorDoorRig,
  LockerRig,
  PlayerRig,
  PowerBreakerRig,
  createAlarmDecoy,
  createAsylumChair,
  createBarredWindow,
  createBarricadeObstacle,
  createBreakerBox,
  createBrokenGlassPatch,
  createCeilingLamp,
  createCreature,
  createEmergencySconce,
  createExitDoor,
  createFlashlightBeamCone,
  createFloorStain,
  createFloorTrap,
  createGlassBottleItem,
  createGurney,
  createHidingLocker,
  createIVStand,
  createInteriorDoor,
  createMasterKeyItem,
  createMedicalCabinet,
  createPickupBox,
  createPlayerCharacter,
  createPowerBreakerPanel,
  createThrownBottleMesh,
  createWallArt,
  createWallPipeCluster,
  createWindowSilhouette,
  resetKillerAnimation,
  resetPlayerAnimation,
} from './models';
import { SpatialHorrorAudio } from './SpatialAudio';

export type GamePhase = 'title' | 'playing' | 'dead' | 'escaped';
type KillerBrainState = 'search' | 'investigate' | 'chase';

export interface SfxPopupSnapshot {
  id: number;
  text: string;
  screenX: number;
  screenY: number;
  opacity: number;
  accent: boolean;
  tiltDeg: number;
}

export interface HudSnapshot {
  hp: number;
  flashlightOn: boolean;
  cameraOn: boolean;
  battery: number;
  phase: GamePhase;
  objective: string;
  elapsedSec: number;
  hint: string;
  hasKey: boolean;
  powerOn: boolean;
  isHiding: boolean;
  crouching: boolean;
  bottles: number;
  maxBottles: number;
  traps: number;
  maxTraps: number;
  lockerPanic: number;
  breathStamina: number;
  holdingBreath: boolean;
  canPeekDoor: boolean;
  canLockDoor: boolean;
  doorLocked: boolean;
  peekingDoor: boolean;
  interactPrompt: string | null;
  thirdPerson: boolean;
  waterLevelCm: number;
  flashCharges: number;
  maxFlashCharges: number;
  flashCooldownFrac: number;
  radioOn: boolean;
  radioSignal: number;
  sonarPulse: number;
  sonarProximity: number;
  sfxPopups: SfxPopupSnapshot[];
}

export interface EngineSettings {
  ditherMode: DitherMode;
  palette: DitherPalette;
  colorDepth: ColorDepthMode;
  pixelScale: number;
  lightBoost: number;
  spatialAudio: boolean;
  thirdPerson: boolean;
}

interface VirtualLight {
  pos: THREE.Vector3;
  color: number;
  distance: number;
  decay: number;
  intensity: number;
}

interface LampEntry {
  vLight: VirtualLight;
  bulbMat: THREE.MeshStandardMaterial;
  pos: THREE.Vector3;
  seed: number;
  baseIntensity: number;
  baseColor: number;
  currentIntensity: number;
  bursted: boolean;
  burstTimer: number;
}

interface EmergencyLightEntry {
  rig: EmergencySconceRig;
  vLight: VirtualLight;
  phase: number;
}

interface DoorEntry {
  id: string;
  gridX: number;
  gridZ: number;
  axis: 'ew' | 'ns';
  label: string;
  pos: THREE.Vector3;
  rig: InteriorDoorRig;
  open: boolean;
  locked: boolean;
  lockProgress: number;
  openProgress: number;
  poundFlash: number;
  closedBox: ClosedDoorBox;
}

interface LockerEntry {
  id: string;
  rig: LockerRig;
  pos: THREE.Vector3;
  insidePos: THREE.Vector3;
  exitPos: THREE.Vector3;
  faceYaw: number;
  doorKick: number;
}

interface PickupEntry {
  id: string;
  kind: 'battery' | 'medkit' | 'bottle' | 'trap';
  group: THREE.Group;
  pos: THREE.Vector3;
  collected: boolean;
}

interface ThrownBottleEntry {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
}

interface AlarmEntry {
  id: string;
  rig: AlarmDecoyRig;
  pos: THREE.Vector3;
  state: 'idle' | 'countdown' | 'ringing' | 'cooldown';
  timer: number;
  pulseAccum: number;
}

interface GlassPatchEntry {
  pos: THREE.Vector3;
  cooldown: number;
}

interface BarricadeEntry {
  id: string;
  gridX: number;
  gridZ: number;
  axis: 'ns' | 'ew';
  baseX: number;
  baseZ: number;
  pos: THREE.Vector3;
  rig: BarricadeObstacleRig;
  state: 'upright' | 'tipped' | 'cleared';
  tiltProgress: number;
  clearOffset: number;
  box: ClosedDoorBox;
  uprightBox: ClosedDoorBox;
}

interface ArmedTrapEntry {
  rig: FloorTrapRig;
  pos: THREE.Vector3;
  active: boolean;
  sprung: boolean;
  snapProgress: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

interface FootprintEntry {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  life: number;
}

interface SpectralBeaconEntry {
  mesh: THREE.Mesh;
  kind: 'key' | 'breaker' | 'exit';
  baseY: number;
}

interface SfxPopupEntry {
  id: number;
  text: string;
  worldPos: THREE.Vector3;
  life: number;
  maxLife: number;
  accent: boolean;
  tiltDeg: number;
}

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export class SanatoriumEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private ditherPass: ShaderPass | null = null;
  private isSoftwareGl: boolean;
  private textures: SanatoriumTextures;
  private blueNoiseTex: THREE.DataTexture | null = null;
  private audio = new SpatialHorrorAudio();

  private level: LevelConfig;
  private mapW: number;
  private mapH: number;
  private mapCells: number;

  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private clockElapsed = 0;

  // Player state (grounded indoor survival horror, unarmed)
  private playerPos = new THREE.Vector3();
  private eyeHeight = 1.62;
  private yaw = 0;
  private pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;
  private hp = 100;
  private flashlightOn = true;
  private cameraOn = false;
  private battery = 100;
  private phase: GamePhase = 'title';
  private velX = 0;
  private velZ = 0;
  private walkPhase = 0;
  private stepDistAccum = 0;
  private damagePulse = 0;
  private elapsedSec = 0;
  private hintText = '';
  private hintTimer = 0;

  // Stealth, door peeking/locking, distractions & improvised traps
  private crouching = false;
  private peekingInput = false;
  private peekingDoor: DoorEntry | null = null;
  private nearestClosedDoor: DoorEntry | null = null;
  private holdingBreathInput = false;
  private holdingBreath = false;
  private lockerPanic = 0;
  private breathStamina = 100;
  private bottles = 0;
  private static readonly MAX_BOTTLES = 3;
  private traps = 0;
  private static readonly MAX_TRAPS = 2;

  // Indoor escape objectives & interactive doors
  private hasKey = false;
  private powerOn = false;
  private leverProgress = 0;
  private interactPrompt: string | null = null;
  private doors: DoorEntry[] = [];
  private closedDoorBoxes: ClosedDoorBox[] = [];
  private doorGridLookup = new Map<number, DoorEntry>();

  // Distractions, floor hazards, barricades & traps
  private thrownBottlePool: ThrownBottleEntry[] = [];
  private alarms: AlarmEntry[] = [];
  private glassPatches: GlassPatchEntry[] = [];
  private barricades: BarricadeEntry[] = [];
  private barricadeGridLookup = new Map<number, BarricadeEntry>();
  private uprightBarricadeBoxes: ClosedDoorBox[] = [];
  private tippedBarricadeBoxes: ClosedDoorBox[] = [];
  private armedTrapPool: ArmedTrapEntry[] = [];

  // Input state
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0, sprint: false };
  private desktopSprint = false;

  // Dynamic lights (fixed GPU pool prevents Three.js shader recompiles during gameplay)
  private static readonly POINT_LIGHT_POOL_SIZE = 8;
  private pointLightPool: THREE.PointLight[] = [];
  private virtualLights: VirtualLight[] = [];
  private _topScores = new Float64Array(8);
  private _topLights: (VirtualLight | null)[] = [null, null, null, null, null, null, null, null];
  private hemiLight!: THREE.HemisphereLight;
  private dirKeyLight!: THREE.DirectionalLight;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private flashlightBeamCone!: THREE.Mesh;
  private flashlightBounce!: THREE.PointLight;
  private irFloodLight!: THREE.SpotLight;
  private fogExp!: THREE.FogExp2;
  private exitVLight!: VirtualLight;
  private keyVLight!: VirtualLight;
  private breakerVLight!: VirtualLight;
  private lamps: LampEntry[] = [];
  private lampIntensities: number[] = [];
  private emergencyLights: EmergencyLightEntry[] = [];
  private moonSpills: VirtualLight[] = [];

  // Dynamic entities & stealth lockers
  private breakerRig!: PowerBreakerRig;
  private keyMesh!: THREE.Group;
  private lockers: LockerEntry[] = [];
  private activeLocker: LockerEntry | null = null;
  private sawPlayerHide = false;
  private huntedLocker: LockerEntry | null = null;

  // Playable 3rd-person survivor rig ("Character_27_HM" — Resident Evil over-the-shoulder)
  private playerRig!: PlayerRig;
  private playerBodyYaw = 0;
  private playerWeightIdle = 1;
  private playerWeightWalk = 0;
  private playerWeightRun = 0;
  private playerWeightCrouch = 0;
  private playerWeightPistol = 0;
  private playerWeightPistolBack = 0;
  private playerLocoScale = 1;
  private camDistSmooth = 1.48;
  private camRightSmooth = 0.36;

  // Killer AI ("Character_Killer_05" — tall upright stalker actively searching & hunting)
  private creatureRig!: CreatureRig;
  private creaturePos = new THREE.Vector3();
  private creatureBrain: KillerBrainState = 'search';
  private creatureLostSightSec = 0;
  private creatureAttackCooldown = 0;
  private creatureHeading = 0;
  private creatureSpeed = 0;
  private killerWeightIdle = 1;
  private killerWeightWalk = 0;
  private killerWeightRun = 0;
  private killerLocoScale = 1;
  private killerTargetPos = new THREE.Vector3();
  private killerPauseTimer = 0.6;
  private killerInspectTimer = 0;
  private killerDoorBashTimer = 0;
  private killerNextPoundAt = 0;
  private killerDoorTarget: DoorEntry | null = null;
  private killerBarricadeTimer = 0;
  private killerBarricadeTarget: BarricadeEntry | null = null;
  private killerStunTimer = 0;
  private killerRepathTimer = 0;
  private killerStuckTimer = 0;
  private killerLastPos = new THREE.Vector3();
  private waypointVisitedAt: Float64Array;
  private currentWaypointIdx = 0;

  // Pre-allocated A* scratch buffers (zero GC)
  private _astarG: Float32Array;
  private _astarF: Float32Array;
  private _astarParent: Int16Array;
  private _astarState: Uint8Array; // 0=unvisited, 1=open, 2=closed
  private _astarOpen: Int16Array;
  private _pathCells: Int16Array;
  private _pathLen = 0;
  private _pathCursor = 0;

  // Horror events & terror atmosphere state
  private corridorSilhouette!: THREE.Group;
  private corridorSilhouetteBasePos = new THREE.Vector3(6.5 * CELL_SIZE, 0.85, 0.65);
  private corridorSilhouetteTimer = 0;
  private corridorShadowTriggered = false;
  private lampBurstTriggered = [false, false];
  private doorSlamTriggered = [false, false];
  private blackoutTriggered = false;
  private blackoutTimer = 0;
  private threatLevel = 0;

  private pickups: PickupEntry[] = [];
  private sparks: SparkParticle[] = [];
  private dustPoints: THREE.Points | null = null;
  private mistPoints: THREE.Points | null = null;
  private exitWorldPos = new THREE.Vector3();

  // Pillar 1: Rising abyssal floodwater
  private waterMesh: THREE.Mesh | null = null;
  private waterLevel = 0.02;
  private waterHintShown = false;

  // Pillar 2: Sonar Lens waves, spectral objective beacons & creature footprints
  private sonarWave = 0;
  private sonarPingTimer = 0;
  private sonarThreatPulse = 0;
  private sonarSensorTimer = 0;
  private sonarProximity = 0;
  private footprintPool: FootprintEntry[] = [];
  private footprintPoolCursor = 0;
  private creatureFootstepAccum = 0;
  private footprintLeftSide = true;
  private spectralBeacons: SpectralBeaconEntry[] = [];

  // Pillar 3: Strobe Flash capacitor & AM Static Radio
  private static readonly MAX_FLASH_CHARGES = 3;
  private flashCharges = 2;
  private flashCooldown = 0;
  private flashInvert = 0;
  private flashBurstVLight!: VirtualLight;
  private radioOn = true;
  private radioSignal = 0;
  private radioBurstTimer = 0;
  private radioBetrayCooldown = 0;

  // Pillar 5: 3D->2D Manga Onomatopoeia popups
  private sfxPopupPool: SfxPopupEntry[] = [];
  private nextSfxPopupId = 1;

  // Settings & callback
  private settings: EngineSettings = {
    ditherMode: 'hatch',
    palette: 'auto',
    colorDepth: '5mixed',
    pixelScale: 1,
    lightBoost: 1.05,
    spatialAudio: true,
    thirdPerson: true,
  };
  private activePaletteKey: Exclude<DitherPalette, 'auto'> | null = null;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private lastHudPush = 0;

  // Track disposables
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    levelConfig: LevelConfig = DEFAULT_LEVEL_CONFIG,
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.level = sanitizeLevelConfig(levelConfig);
    this.mapW = this.level.rows[0].length;
    this.mapH = this.level.rows.length;
    this.mapCells = this.mapW * this.mapH;

    this.waypointVisitedAt = new Float64Array(this.level.searchWaypoints.length);
    this._astarG = new Float32Array(this.mapCells);
    this._astarF = new Float32Array(this.mapCells);
    this._astarParent = new Int16Array(this.mapCells);
    this._astarState = new Uint8Array(this.mapCells);
    this._astarOpen = new Int16Array(this.mapCells);
    this._pathCells = new Int16Array(this.mapCells);

    this.playerPos.set(this.level.playerSpawn.x, 1.62, this.level.playerSpawn.z);
    this.yaw = this.level.playerSpawn.yaw;
    this.targetYaw = this.level.playerSpawn.yaw;
    this.playerBodyYaw = this.level.playerSpawn.yaw;
    this.creaturePos.set(this.level.creatureSpawn.x, 0, this.level.creatureSpawn.z);
    this.killerTargetPos.copy(this.creaturePos);
    this.killerLastPos.copy(this.creaturePos);
    this.exitWorldPos.set(
      this.level.exitDoorCell.triggerX,
      1.5,
      this.level.exitDoorCell.triggerZ,
    );

    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020203);
    this.fogExp = new THREE.FogExp2(0x020203, 0.145);
    this.scene.fog = this.fogExp;

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 48);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Mandatory studio environment map via RoomEnvironment (kept very faint for deep shadows)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environmentIntensity = 0.014;
    roomEnv.dispose();
    pmrem.dispose();

    this.textures = createSanatoriumTextures(this.renderer);
    this.textures.floorMap.repeat.set(this.mapW, this.mapH);
    this.textures.floorNormal.repeat.set(this.mapW, this.mapH);
    this.textures.floorRoughness.repeat.set(this.mapW, this.mapH);
    this.textures.ceilingMap.repeat.set(this.mapW, this.mapH);
    this.textures.ceilingNormal.repeat.set(this.mapW, this.mapH);

    this.buildLighting();
    this.buildSanatoriumGeometry();
    this.buildPropsAndActors();
    this.buildPostProcessing();

    if (!this.isSoftwareGl) {
      this.corridorSilhouette.visible = true;
      if (this.sparks[0]) this.sparks[0].mesh.visible = true;

      this.renderer.compile(this.scene, this.camera);
      this.composer?.render();

      this.corridorSilhouette.visible = false;
      if (this.sparks[0]) this.sparks[0].mesh.visible = false;
    }

    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);

    this.pushHud(true);
    this.lastTime = performance.now();
    this.tick();
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private makeStdMat(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial(params);
    if (this.isSoftwareGl) applySoftwareBayerDither(mat);
    return this.trackMat(mat);
  }

  private buildLighting(): void {
    // Near-abyssal indoor ambient fill so corridors collapse into pitch dark outside light cones
    this.hemiLight = new THREE.HemisphereLight(0x283446, 0x08090c, 0.014);
    this.scene.add(this.hemiLight);

    this.dirKeyLight = new THREE.DirectionalLight(0xc2d0e6, 0.004);
    this.dirKeyLight.position.set(12, 16, 10);
    this.scene.add(this.dirKeyLight);

    // Focused tactical horror flashlight with crisp 1024 soft shadows + volumetric dust cone
    this.flashlight = new THREE.SpotLight(0xfff0d4, 22.0, 21, Math.PI / 5.2, 0.45, 1.45);
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.16;
    this.flashlight.shadow.camera.far = 21;
    this.flashlight.shadow.bias = -0.0004;
    this.flashlight.shadow.normalBias = 0.018;
    this.flashlight.shadow.radius = 2.5;

    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    this.flashlightBeamCone = createFlashlightBeamCone();
    this.trackGeo(this.flashlightBeamCone.geometry);
    this.trackMat(this.flashlightBeamCone.material as THREE.Material);
    this.scene.add(this.flashlightBeamCone);

    // Tight minimal spill right beside the player so peripheral threats remain hidden
    this.flashlightBounce = new THREE.PointLight(0xffdfb8, 0.48, 3.2, 1.9);
    this.scene.add(this.flashlightBounce);

    // Wide-angle infrared camcorder illuminator
    this.irFloodLight = new THREE.SpotLight(0xd4ffdc, 0.0, 18.5, Math.PI / 2.3, 0.8, 1.25);
    this.irFloodLight.castShadow = false;
    this.scene.add(this.irFloodLight);
    this.irFloodLight.target = this.flashlightTarget;

    // Fixed pool of 8 physical PointLights (always visible=true -> ZERO WebGL shader recompiles)
    for (let i = 0; i < SanatoriumEngine.POINT_LIGHT_POOL_SIZE; i++) {
      const pLight = new THREE.PointLight(0xffffff, 0, 10, 1.75);
      this.scene.add(pLight);
      this.pointLightPool.push(pLight);
    }

    // Emergency beacon at Exit Door
    const exitRotY = this.level.exitDoorCell.rotY ?? Math.PI;
    this.exitVLight = {
      pos: new THREE.Vector3(
        this.level.exitDoorCell.x * CELL_SIZE + Math.sin(exitRotY) * 0.65,
        2.7,
        this.level.exitDoorCell.z * CELL_SIZE + Math.cos(exitRotY) * 0.65,
      ),
      color: 0xff4238,
      distance: 7.4,
      decay: 1.75,
      intensity: 1.85,
    };
    this.virtualLights.push(this.exitVLight);

    // Faint eerie glint over the Exit Key in Archive Room
    this.keyVLight = {
      pos: new THREE.Vector3(this.level.keySpawn.x, this.level.keySpawn.y + 0.38, this.level.keySpawn.z),
      color: 0xffe4ad,
      distance: 3.1,
      decay: 1.8,
      intensity: 1.15,
    };
    this.virtualLights.push(this.keyVLight);

    // Breaker panel status light
    const bRot = this.level.breakerPanelPos.rotY;
    this.breakerVLight = {
      pos: new THREE.Vector3(
        this.level.breakerPanelPos.x + Math.sin(bRot) * 0.45,
        1.78,
        this.level.breakerPanelPos.z + Math.cos(bRot) * 0.45,
      ),
      color: 0xff3b30,
      distance: 4.2,
      decay: 1.8,
      intensity: 1.25,
    };
    this.virtualLights.push(this.breakerVLight);

    // High-voltage Strobe Flash burst virtual light (zero WebGL recompile)
    this.flashBurstVLight = {
      pos: new THREE.Vector3(),
      color: 0xeaf8ff,
      distance: 15.0,
      decay: 1.35,
      intensity: 0,
    };
    this.virtualLights.push(this.flashBurstVLight);
  }

  private buildSanatoriumGeometry(): void {
    const worldW = this.mapW * CELL_SIZE;
    const worldD = this.mapH * CELL_SIZE;

    // Floor
    const floorGeo = this.trackGeo(new THREE.PlaneGeometry(worldW, worldD));
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = this.makeStdMat({
      map: this.textures.floorMap,
      normalMap: this.textures.floorNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: this.textures.floorRoughness,
      roughness: 0.95,
      metalness: 0.08,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(worldW / 2, 0, worldD / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Pillar 1: Rising abyssal brine floodwater plane across deck corridors
    const waterGeo = this.trackGeo(new THREE.PlaneGeometry(worldW, worldD));
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = this.makeStdMat({
      color: 0x0d2b38,
      roughness: 0.09,
      metalness: 0.44,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(worldW / 2, this.waterLevel, worldD / 2);
    this.waterMesh.receiveShadow = true;
    this.waterMesh.renderOrder = 2;
    this.scene.add(this.waterMesh);

    // Ceiling
    const ceilGeo = this.trackGeo(new THREE.PlaneGeometry(worldW, worldD));
    ceilGeo.rotateX(Math.PI / 2);
    const ceilMat = this.makeStdMat({
      map: this.textures.ceilingMap,
      normalMap: this.textures.ceilingNormal,
      roughness: 0.9,
      metalness: 0.05,
    });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.position.set(worldW / 2, WALL_HEIGHT, worldD / 2);
    ceiling.receiveShadow = true;
    this.scene.add(ceiling);

    // Instanced Wall Blocks + Architectural Baseboards
    let wallCount = 0;
    for (let z = 0; z < this.mapH; z++) {
      for (let x = 0; x < this.mapW; x++) {
        if (isWallAtGrid(x, z, this.level.rows)) wallCount++;
      }
    }

    const wallGeo = this.trackGeo(new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE));
    const wallMat = this.makeStdMat({
      map: this.textures.wallMap,
      normalMap: this.textures.wallNormal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: this.textures.wallRoughness,
      roughness: 0.92,
      metalness: 0.05,
    });
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
    wallInst.castShadow = !this.isSoftwareGl;
    wallInst.receiveShadow = true;

    const plinthGeo = this.trackGeo(new THREE.BoxGeometry(CELL_SIZE + 0.06, 0.16, CELL_SIZE + 0.06));
    const plinthMat = this.makeStdMat({
      color: 0x26282c,
      roughness: 0.85,
      metalness: 0.18,
    });
    const plinthInst = new THREE.InstancedMesh(plinthGeo, plinthMat, wallCount);
    plinthInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let z = 0; z < this.mapH; z++) {
      for (let x = 0; x < this.mapW; x++) {
        if (!isWallAtGrid(x, z, this.level.rows)) continue;
        const wx = (x + 0.5) * CELL_SIZE;
        const wz = (z + 0.5) * CELL_SIZE;
        dummy.position.set(wx, WALL_HEIGHT / 2, wz);
        dummy.updateMatrix();
        wallInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(wx, 0.08, wz);
        dummy.updateMatrix();
        plinthInst.setMatrixAt(idx, dummy.matrix);
        idx++;
      }
    }
    wallInst.instanceMatrix.needsUpdate = true;
    plinthInst.instanceMatrix.needsUpdate = true;
    wallInst.computeBoundingSphere();
    plinthInst.computeBoundingSphere();
    this.scene.add(wallInst, plinthInst);

    // Architectural Ceiling Crossbeams & Overhead Steam Pipes along open corridors
    const beamCoords: { x: number; z: number; alongX: boolean }[] = [];
    const pipeCoords: { x: number; z: number; alongX: boolean }[] = [];

    for (let z = 1; z < this.mapH - 1; z++) {
      for (let x = 1; x < this.mapW - 1; x++) {
        if (isWallAtGrid(x, z, this.level.rows)) continue;
        if ((x + z) % 2 === 0) {
          const wallN = isWallAtGrid(x, z - 1, this.level.rows);
          const wallS = isWallAtGrid(x, z + 1, this.level.rows);
          const wallW = isWallAtGrid(x - 1, z, this.level.rows);
          const wallE = isWallAtGrid(x + 1, z, this.level.rows);
          if (wallN && wallS) {
            beamCoords.push({ x, z, alongX: false });
          } else if (wallW && wallE) {
            beamCoords.push({ x, z, alongX: true });
          }
        }
        if (isWallAtGrid(x, z - 1, this.level.rows)) {
          pipeCoords.push({ x, z, alongX: true });
        } else if (isWallAtGrid(x - 1, z, this.level.rows)) {
          pipeCoords.push({ x, z, alongX: false });
        }
      }
    }

    if (beamCoords.length > 0) {
      const beamGeo = this.trackGeo(new THREE.BoxGeometry(CELL_SIZE, 0.24, 0.28));
      const beamMat = this.makeStdMat({
        color: 0x35383e,
        roughness: 0.84,
        metalness: 0.14,
      });
      const beamInst = new THREE.InstancedMesh(beamGeo, beamMat, beamCoords.length);
      beamInst.receiveShadow = true;
      beamCoords.forEach((b, i) => {
        dummy.position.set((b.x + 0.5) * CELL_SIZE, WALL_HEIGHT - 0.12, (b.z + 0.5) * CELL_SIZE);
        dummy.rotation.set(0, b.alongX ? 0 : Math.PI / 2, 0);
        dummy.updateMatrix();
        beamInst.setMatrixAt(i, dummy.matrix);
      });
      beamInst.instanceMatrix.needsUpdate = true;
      beamInst.computeBoundingSphere();
      this.scene.add(beamInst);
    }

    if (pipeCoords.length > 0) {
      const pipeGeo = this.trackGeo(new THREE.CylinderGeometry(0.045, 0.045, CELL_SIZE, 8));
      pipeGeo.rotateZ(Math.PI / 2);
      const pipeMat = this.makeStdMat({
        map: this.textures.metalMap,
        roughnessMap: this.textures.metalRoughness,
        color: 0x6a6e76,
        roughness: 0.48,
        metalness: 0.88,
      });
      const pipeInst = new THREE.InstancedMesh(pipeGeo, pipeMat, pipeCoords.length);
      pipeCoords.forEach((p, i) => {
        if (p.alongX) {
          dummy.position.set((p.x + 0.5) * CELL_SIZE, WALL_HEIGHT - 0.28, p.z * CELL_SIZE + 0.12);
          dummy.rotation.set(0, 0, 0);
        } else {
          dummy.position.set(p.x * CELL_SIZE + 0.12, WALL_HEIGHT - 0.28, (p.z + 0.5) * CELL_SIZE);
          dummy.rotation.set(0, Math.PI / 2, 0);
        }
        dummy.updateMatrix();
        pipeInst.setMatrixAt(i, dummy.matrix);
      });
      pipeInst.instanceMatrix.needsUpdate = true;
      pipeInst.computeBoundingSphere();
      this.scene.add(pipeInst);
    }
    dummy.rotation.set(0, 0, 0);
  }

  private buildPropsAndActors(): void {
    // Hinged Framed Room Doors ("salas com portas")
    for (const dp of this.level.doors) {
      const rig = createInteriorDoor(this.textures, this.isSoftwareGl);
      const cx = (dp.gridX + 0.5) * CELL_SIZE;
      const cz = (dp.gridZ + 0.5) * CELL_SIZE;
      rig.group.position.set(cx, 0, cz);
      rig.group.rotation.y = dp.axis === 'ew' ? Math.PI / 2 : 0;
      this.scene.add(rig.group);

      const halfThick = 0.22;
      const halfSpan = CELL_SIZE * 0.5;
      const closedBox: ClosedDoorBox =
        dp.axis === 'ew'
          ? { minX: cx - halfThick, maxX: cx + halfThick, minZ: cz - halfSpan, maxZ: cz + halfSpan }
          : { minX: cx - halfSpan, maxX: cx + halfSpan, minZ: cz - halfThick, maxZ: cz + halfThick };

      const entry: DoorEntry = {
        id: dp.id,
        gridX: dp.gridX,
        gridZ: dp.gridZ,
        axis: dp.axis,
        label: dp.label,
        pos: new THREE.Vector3(cx, 0, cz),
        rig,
        open: false,
        locked: false,
        lockProgress: 0,
        openProgress: 0,
        poundFlash: 0,
        closedBox,
      };
      this.doors.push(entry);
      this.doorGridLookup.set(dp.gridZ * this.mapW + dp.gridX, entry);
    }
    this.syncClosedDoorBoxes();

    // Wind-up Mechanical Alarm Decoys
    for (const ap of this.level.alarms) {
      const rig = createAlarmDecoy(this.textures, this.isSoftwareGl);
      const wx = ap.x * CELL_SIZE;
      const wz = ap.z * CELL_SIZE;
      rig.group.position.set(wx, 0, wz);
      this.scene.add(rig.group);
      this.alarms.push({
        id: ap.id,
        rig,
        pos: new THREE.Vector3(wx, 1.18, wz),
        state: 'idle',
        timer: 0,
        pulseAccum: 0,
      });
    }

    // Broken Glass Floor Hazard Patches
    for (const gp of this.level.glassPatches) {
      const patchGroup = createBrokenGlassPatch(this.textures, this.isSoftwareGl);
      const wx = gp.x * CELL_SIZE;
      const wz = gp.z * CELL_SIZE;
      patchGroup.position.set(wx, 0, wz);
      this.scene.add(patchGroup);
      this.glassPatches.push({
        pos: new THREE.Vector3(wx, 0, wz),
        cooldown: 0,
      });
    }

    // Tippable Barricade Carts / Obstacles along 1-cell chokepoints
    for (const bp of this.level.barricades) {
      const rig = createBarricadeObstacle(this.textures, this.isSoftwareGl);
      const cx = (bp.gridX + 0.5) * CELL_SIZE;
      const cz = (bp.gridZ + 0.5) * CELL_SIZE;
      const baseX = bp.axis === 'ns' ? cx - 0.48 : cx - 0.58;
      const baseZ = bp.axis === 'ns' ? cz - 0.58 : cz - 0.48;
      rig.group.position.set(baseX, 0, baseZ);
      if (bp.axis === 'ew') rig.group.rotation.y = Math.PI / 2;
      this.scene.add(rig.group);

      const halfSpan = 0.7;
      const halfThick = 0.42;
      const box: ClosedDoorBox =
        bp.axis === 'ns'
          ? { minX: cx - halfSpan, maxX: cx + halfSpan, minZ: cz - halfThick, maxZ: cz + halfThick }
          : { minX: cx - halfThick, maxX: cx + halfThick, minZ: cz - halfSpan, maxZ: cz + halfSpan };
      const uprightBox: ClosedDoorBox =
        bp.axis === 'ns'
          ? { minX: cx - 1.18, maxX: cx + 0.16, minZ: cz - 0.92, maxZ: cz - 0.22 }
          : { minX: cx - 0.92, maxX: cx - 0.22, minZ: cz - 1.18, maxZ: cz + 0.16 };

      const barEntry: BarricadeEntry = {
        id: bp.id,
        gridX: bp.gridX,
        gridZ: bp.gridZ,
        axis: bp.axis,
        baseX,
        baseZ,
        pos: new THREE.Vector3(cx, 0, cz),
        rig,
        state: 'upright',
        tiltProgress: 0,
        clearOffset: 0,
        box,
        uprightBox,
      };
      this.barricades.push(barEntry);
      this.barricadeGridLookup.set(bp.gridZ * this.mapW + bp.gridX, barEntry);
    }
    this.syncTippedBarricades();

    // Pre-allocated pool of Thrown Bottle Projectiles (zero GC)
    for (let i = 0; i < 4; i++) {
      const mesh = createThrownBottleMesh(this.isSoftwareGl);
      mesh.visible = false;
      this.scene.add(mesh);
      this.thrownBottlePool.push({
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        active: false,
      });
    }

    // Pre-allocated pool of Armed Floor Traps (max 4 active)
    for (let i = 0; i < 4; i++) {
      const rig = createFloorTrap(this.textures, this.isSoftwareGl);
      rig.group.visible = false;
      this.scene.add(rig.group);
      this.armedTrapPool.push({
        rig,
        pos: new THREE.Vector3(),
        active: false,
        sprung: false,
        snapProgress: 0,
      });
    }

    // Ceiling Lamps + Virtual Flickering PointLights (contrast cold clinical vs dying amber)
    const lampWorldPositions: THREE.Vector3[] = [];
    this.level.lamps.forEach((lp, i) => {
      const { group, bulbMat } = createCeilingLamp(this.textures, this.isSoftwareGl);
      const wx = lp.x * CELL_SIZE;
      const wz = lp.z * CELL_SIZE;
      group.position.set(wx, 0, wz);
      this.scene.add(group);

      const isColdTube = i % 2 === 1;
      const baseColor = isColdTube ? 0xc2daf2 : 0xffcb94;
      const baseIntensity = isColdTube ? 1.55 : 1.35;
      bulbMat.emissive.setHex(baseColor);

      const pos = new THREE.Vector3(wx, WALL_HEIGHT - 0.65, wz);
      const vLight: VirtualLight = {
        pos,
        color: baseColor,
        distance: 7.0,
        decay: 1.85,
        intensity: baseIntensity,
      };
      this.virtualLights.push(vLight);
      lampWorldPositions.push(pos);
      this.lamps.push({
        vLight,
        bulbMat,
        pos,
        seed: i * 19.37 + 3.1,
        baseIntensity,
        baseColor,
        currentIntensity: baseIntensity,
        bursted: false,
        burstTimer: 0,
      });
      this.lampIntensities.push(1.0);
    });

    // Crimson Emergency Wall Bulkhead Sconces along critical corridors
    this.level.emergencyLights.forEach((ep, i) => {
      const rig = createEmergencySconce(this.textures, this.isSoftwareGl);
      const wx = ep.x * CELL_SIZE;
      const wz = ep.z * CELL_SIZE;
      rig.group.position.set(wx, 0, wz);
      rig.group.rotation.y = ep.rotY;
      this.scene.add(rig.group);

      const lightPos = new THREE.Vector3(
        wx + Math.sin(ep.rotY) * 0.36,
        2.36,
        wz + Math.cos(ep.rotY) * 0.36,
      );
      const vLight: VirtualLight = {
        pos: lightPos,
        color: 0xff281c,
        distance: 5.8,
        decay: 1.75,
        intensity: 1.15,
      };
      this.virtualLights.push(vLight);
      this.emergencyLights.push({
        rig,
        vLight,
        phase: i * 1.47,
      });
    });

    // Corridor furniture, medical props, barred windows & wall pipes
    const pipeWorldPositions: THREE.Vector3[] = [];
    for (const prop of this.level.props) {
      const wx = prop.x * CELL_SIZE;
      const wz = prop.z * CELL_SIZE;
      let group: THREE.Group;
      if (prop.kind === 'chair') {
        group = createAsylumChair(this.textures, this.isSoftwareGl);
      } else if (prop.kind === 'gurney') {
        group = createGurney(this.textures, this.isSoftwareGl);
      } else if (prop.kind === 'iv') {
        group = createIVStand(this.textures, this.isSoftwareGl);
      } else if (prop.kind === 'cabinet') {
        group = createMedicalCabinet(this.textures, this.isSoftwareGl);
      } else if (prop.kind === 'window') {
        group = createBarredWindow(this.textures, this.isSoftwareGl);
        const rot = prop.rotY ?? 0;
        const msLight: VirtualLight = {
          pos: new THREE.Vector3(wx + Math.sin(rot) * 0.55, 1.75, wz + Math.cos(rot) * 0.55),
          color: 0xdce6f5,
          distance: 5.0,
          decay: 1.8,
          intensity: 0.95,
        };
        this.virtualLights.push(msLight);
        this.moonSpills.push(msLight);
      } else if (prop.kind === 'breaker') {
        group = createBreakerBox(this.textures, this.isSoftwareGl);
      } else {
        group = createWallPipeCluster(this.textures, this.isSoftwareGl);
        pipeWorldPositions.push(new THREE.Vector3(wx, 1.4, wz));
      }
      group.position.set(wx, 0, wz);
      if (prop.rotY) group.rotation.y = prop.rotY;
      this.scene.add(group);
    }

    // Master Key Pedestal / Desk & Key in Archive Room
    const pedestal = this.trackGeo(new THREE.BoxGeometry(0.68, 0.56, 0.52));
    const pedMat = this.makeStdMat({ color: 0x3b352e, roughness: 0.88, metalness: 0.08 });
    const pedMesh = new THREE.Mesh(pedestal, pedMat);
    pedMesh.position.set(this.level.keySpawn.x, 0.28, this.level.keySpawn.z);
    pedMesh.castShadow = !this.isSoftwareGl;
    pedMesh.receiveShadow = true;
    this.scene.add(pedMesh);

    this.keyMesh = createMasterKeyItem(this.textures, this.isSoftwareGl);
    this.keyMesh.position.set(this.level.keySpawn.x, this.level.keySpawn.y, this.level.keySpawn.z);
    this.scene.add(this.keyMesh);

    // Interactive Main Power Breaker Panel
    this.breakerRig = createPowerBreakerPanel(this.textures, this.isSoftwareGl);
    this.breakerRig.group.position.set(this.level.breakerPanelPos.x, 0, this.level.breakerPanelPos.z);
    this.breakerRig.group.rotation.y = this.level.breakerPanelPos.rotY;
    this.scene.add(this.breakerRig.group);

    // Hideable Steel Lockers along Rooms & Corridors
    for (const lp of this.level.lockers) {
      const rig = createHidingLocker(this.textures, this.isSoftwareGl);
      const wx = lp.x * CELL_SIZE;
      const wz = lp.z * CELL_SIZE;
      rig.group.position.set(wx, 0, wz);
      rig.group.rotation.y = lp.rotY;
      this.scene.add(rig.group);

      const fwdX = Math.sin(lp.rotY);
      const fwdZ = Math.cos(lp.rotY);
      this.lockers.push({
        id: lp.id,
        rig,
        pos: new THREE.Vector3(wx, 0, wz),
        insidePos: new THREE.Vector3(wx + fwdX * 0.04, 1.62, wz + fwdZ * 0.04),
        exitPos: new THREE.Vector3(wx + fwdX * 0.94, 1.62, wz + fwdZ * 0.94),
        faceYaw: lp.rotY,
        doorKick: 0,
      });
    }

    // Silhouette behind barred window for horror scare event
    this.corridorSilhouette = createWindowSilhouette();
    const firstWin = this.level.props.find((p) => p.kind === 'window');
    if (firstWin) {
      const wRot = firstWin.rotY ?? 0;
      this.corridorSilhouetteBasePos.set(
        firstWin.x * CELL_SIZE - Math.sin(wRot) * 0.35,
        0.85,
        firstWin.z * CELL_SIZE - Math.cos(wRot) * 0.35,
      );
    } else {
      this.corridorSilhouetteBasePos.set(6.5 * CELL_SIZE, 0.85, 0.65);
    }
    this.corridorSilhouette.position.copy(this.corridorSilhouetteBasePos);
    this.corridorSilhouette.visible = false;
    this.scene.add(this.corridorSilhouette);

    // Wall Posters & Charcoal Madness Graffiti
    for (const art of this.level.wallArt) {
      const mesh = createWallArt(art.kind, this.textures, this.isSoftwareGl);
      const wx = art.x * CELL_SIZE;
      const wz = art.z * CELL_SIZE;
      mesh.position.set(
        wx + Math.sin(art.rotY) * 0.02,
        mesh.position.y,
        wz + Math.cos(art.rotY) * 0.02,
      );
      mesh.rotation.y = art.rotY;
      this.scene.add(mesh);
    }

    // Wet Viscous Floor Stains / Drag Trails
    for (const st of this.level.floorStains) {
      const stain = createFloorStain(this.textures, this.isSoftwareGl, st.scale);
      stain.position.set(st.x * CELL_SIZE, 0.012, st.z * CELL_SIZE);
      stain.rotation.y = st.rotY;
      this.scene.add(stain);
    }

    // Instanced Scattered Clinical Papers on Corridor Floors
    const paperGeo = this.trackGeo(new THREE.PlaneGeometry(0.24, 0.31));
    paperGeo.rotateX(-Math.PI / 2);
    const paperMat = this.makeStdMat({
      map: this.textures.paperMap,
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const paperSpots: { x: number; z: number; rot: number; sc: number }[] = [];
    for (let z = 1; z < this.mapH - 1; z++) {
      for (let x = 1; x < this.mapW - 1; x++) {
        if (isWallAtGrid(x, z, this.level.rows)) continue;
        const hash = Math.abs(Math.sin(x * 17.3 + z * 43.7) * 43758.5) % 1;
        if (hash > 0.45) {
          const ox = ((Math.sin(x * 9.1 + z * 3.3) * 0.5 + 0.5) * 0.6 + 0.2) * CELL_SIZE;
          const oz = ((Math.cos(x * 5.7 + z * 11.9) * 0.5 + 0.5) * 0.6 + 0.2) * CELL_SIZE;
          paperSpots.push({
            x: x * CELL_SIZE + ox,
            z: z * CELL_SIZE + oz,
            rot: hash * Math.PI * 2,
            sc: 0.8 + hash * 0.45,
          });
        }
      }
    }
    if (paperSpots.length > 0) {
      const paperInst = new THREE.InstancedMesh(paperGeo, paperMat, paperSpots.length);
      const pDummy = new THREE.Object3D();
      paperSpots.forEach((ps, i) => {
        pDummy.position.set(ps.x, 0.014, ps.z);
        pDummy.rotation.set(0, ps.rot, 0);
        pDummy.scale.set(ps.sc, 1, ps.sc);
        pDummy.updateMatrix();
        paperInst.setMatrixAt(i, pDummy.matrix);
      });
      paperInst.instanceMatrix.needsUpdate = true;
      paperInst.computeBoundingSphere();
      this.scene.add(paperInst);
    }

    // Atmospheric Drifting Dust Motes & Low-Lying Floor Cold Mist across corridors
    const dustCount = 340;
    const dustPos = new Float32Array(dustCount * 3);
    let dIdx = 0;
    let tries = 0;
    while (dIdx < dustCount && tries < 2400) {
      tries++;
      const gx = 1 + Math.floor(Math.random() * (this.mapW - 2));
      const gz = 1 + Math.floor(Math.random() * (this.mapH - 2));
      if (isWallAtGrid(gx, gz, this.level.rows)) continue;
      dustPos[dIdx * 3] = (gx + Math.random()) * CELL_SIZE;
      dustPos[dIdx * 3 + 1] = 0.2 + Math.random() * (WALL_HEIGHT - 0.45);
      dustPos[dIdx * 3 + 2] = (gz + Math.random()) * CELL_SIZE;
      dIdx++;
    }
    const dustGeo = this.trackGeo(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos.subarray(0, dIdx * 3), 3));
    const dustMat = this.trackMat(
      new THREE.PointsMaterial({
        map: this.textures.dustMoteMap,
        color: 0xe6e6dc,
        size: 0.062,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    const mistCount = 150;
    const mistPos = new Float32Array(mistCount * 3);
    let mIdx = 0;
    let mTries = 0;
    while (mIdx < mistCount && mTries < 1600) {
      mTries++;
      const gx = 1 + Math.floor(Math.random() * (this.mapW - 2));
      const gz = 1 + Math.floor(Math.random() * (this.mapH - 2));
      if (isWallAtGrid(gx, gz, this.level.rows)) continue;
      mistPos[mIdx * 3] = (gx + 0.15 + Math.random() * 0.7) * CELL_SIZE;
      mistPos[mIdx * 3 + 1] = 0.14 + Math.random() * 0.34;
      mistPos[mIdx * 3 + 2] = (gz + 0.15 + Math.random() * 0.7) * CELL_SIZE;
      mIdx++;
    }
    const mistGeo = this.trackGeo(new THREE.BufferGeometry());
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos.subarray(0, mIdx * 3), 3));
    const mistMat = this.trackMat(
      new THREE.PointsMaterial({
        map: this.textures.mistWispMap,
        color: 0x9aa8b8,
        size: 1.35,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    this.mistPoints = new THREE.Points(mistGeo, mistMat);
    this.scene.add(this.mistPoints);

    // Pickups (Battery + Medkit + Collectible Glass Bottles + Improvised Floor Traps)
    for (const pk of this.level.pickups) {
      const kind = pk.kind === 'medkit' ? 'medkit' : 'battery';
      const group = createPickupBox(kind, this.textures, this.isSoftwareGl);
      const wx = pk.x * CELL_SIZE;
      const wz = pk.z * CELL_SIZE;
      group.position.set(wx, 0, wz);
      this.scene.add(group);
      this.pickups.push({
        id: pk.id,
        kind,
        group,
        pos: new THREE.Vector3(wx, 0, wz),
        collected: false,
      });
    }

    for (const bt of this.level.bottles) {
      const group = createGlassBottleItem(this.textures, this.isSoftwareGl);
      const wx = bt.x * CELL_SIZE;
      const wz = bt.z * CELL_SIZE;
      group.position.set(wx, 0, wz);
      this.scene.add(group);
      this.pickups.push({
        id: bt.id,
        kind: 'bottle',
        group,
        pos: new THREE.Vector3(wx, 0, wz),
        collected: false,
      });
    }

    for (const tr of this.level.traps) {
      const trapRig = createFloorTrap(this.textures, this.isSoftwareGl);
      const wx = tr.x * CELL_SIZE;
      const wz = tr.z * CELL_SIZE;
      trapRig.group.position.set(wx, 0, wz);
      trapRig.ringMat.color.setHex(0x80ff72);
      trapRig.ringMat.emissive.setHex(0x285a20);
      this.scene.add(trapRig.group);
      this.pickups.push({
        id: tr.id,
        kind: 'trap',
        group: trapRig.group,
        pos: new THREE.Vector3(wx, 0, wz),
        collected: false,
      });
    }

    // Reinforced Exit Door
    const exitDoor = createExitDoor(this.textures, this.isSoftwareGl);
    exitDoor.position.set(this.level.exitDoorCell.x * CELL_SIZE, 0, this.level.exitDoorCell.z * CELL_SIZE);
    if (this.level.exitDoorCell.rotY) exitDoor.rotation.y = this.level.exitDoorCell.rotY;
    this.scene.add(exitDoor);

    // Playable 3rd-Person Survivor ("Character_27_HM")
    this.playerRig = createPlayerCharacter(this.textures, this.isSoftwareGl, () => {
      if (!this.isSoftwareGl && !this.disposed) {
        this.renderer.compile(this.scene, this.camera);
      }
    });
    this.playerRig.group.position.set(this.playerPos.x, 0, this.playerPos.z);
    this.playerRig.group.rotation.y = this.playerBodyYaw;
    this.playerRig.group.visible = this.settings.thirdPerson;
    this.scene.add(this.playerRig.group);

    // Towering Grounded 3D Killer Enemy ("Character_Killer_05" — upright normal walk, ~2.26m tall)
    this.creatureRig = createCreature(this.textures, this.isSoftwareGl, () => {
      if (!this.isSoftwareGl && !this.disposed) {
        this.renderer.compile(this.scene, this.camera);
      }
    });
    this.creaturePos.set(this.level.creatureSpawn.x, 0, this.level.creatureSpawn.z);
    this.creatureRig.group.position.copy(this.creaturePos);
    this.scene.add(this.creatureRig.group);

    // Pre-allocated spark particle pool for lamp bursts, breaker arcs & glass shatter
    const sparkGeo = this.trackGeo(new THREE.BoxGeometry(0.035, 0.035, 0.035));
    const sparkMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }

    // Pillar 2: Sonar-only invisible creature footprint trail pool (18 decals)
    const fpGeo = this.trackGeo(new THREE.PlaneGeometry(0.24, 0.42));
    fpGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 18; i++) {
      const mat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x56f5ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(fpGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.footprintPool.push({ mesh, mat, pos: new THREE.Vector3(), life: 0 });
    }

    // Pillar 2: Sonar-only spectral objective markers (Key, Breaker, Exit Hatch)
    const beaconGeo = this.trackGeo(new THREE.OctahedronGeometry(0.16, 0));
    const beaconDefs: { kind: SpectralBeaconEntry['kind']; x: number; y: number; z: number; color: number }[] = [
      { kind: 'key', x: this.level.keySpawn.x, y: 1.55, z: this.level.keySpawn.z, color: 0xffe066 },
      { kind: 'breaker', x: this.level.breakerPanelPos.interactX, y: 2.05, z: this.level.breakerPanelPos.interactZ, color: 0xff6259 },
      { kind: 'exit', x: this.exitWorldPos.x, y: 2.25, z: this.exitWorldPos.z, color: 0x62f5ff },
    ];
    for (const bd of beaconDefs) {
      const bMat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: bd.color,
          transparent: true,
          opacity: 0.9,
          wireframe: true,
        }),
      );
      const mesh = new THREE.Mesh(beaconGeo, bMat);
      mesh.position.set(bd.x, bd.y, bd.z);
      mesh.visible = false;
      this.scene.add(mesh);
      this.spectralBeacons.push({ mesh, kind: bd.kind, baseY: bd.y });
    }

    // Pillar 5: Pre-allocated Manga SFX Popup Pool
    for (let i = 0; i < 10; i++) {
      this.sfxPopupPool.push({
        id: 0,
        text: '',
        worldPos: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        accent: false,
        tiltDeg: 0,
      });
    }

    this.pendingLampPositions = lampWorldPositions;
    this.pendingPipePositions = pipeWorldPositions;
  }

  private pendingLampPositions: THREE.Vector3[] = [];
  private pendingPipePositions: THREE.Vector3[] = [];

  private syncClosedDoorBoxes(): void {
    this.closedDoorBoxes.length = 0;
    for (let i = 0; i < this.doors.length; i++) {
      if (!this.doors[i].open) {
        this.closedDoorBoxes.push(this.doors[i].closedBox);
      }
    }
  }

  private syncTippedBarricades(): void {
    this.uprightBarricadeBoxes.length = 0;
    this.tippedBarricadeBoxes.length = 0;
    for (let i = 0; i < this.barricades.length; i++) {
      if (this.barricades[i].state === 'upright') {
        this.uprightBarricadeBoxes.push(this.barricades[i].uprightBox);
      } else if (this.barricades[i].state === 'tipped') {
        this.tippedBarricadeBoxes.push(this.barricades[i].box);
      }
    }
  }

  private hitsUprightBarricade(wx: number, wz: number, radius: number): boolean {
    for (let i = 0; i < this.uprightBarricadeBoxes.length; i++) {
      const box = this.uprightBarricadeBoxes[i];
      if (
        wx + radius > box.minX &&
        wx - radius < box.maxX &&
        wz + radius > box.minZ &&
        wz - radius < box.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private hitsTippedBarricade(wx: number, wz: number, radius: number): boolean {
    for (let i = 0; i < this.tippedBarricadeBoxes.length; i++) {
      const box = this.tippedBarricadeBoxes[i];
      if (
        wx + radius > box.minX &&
        wx - radius < box.maxX &&
        wz + radius > box.minZ &&
        wz - radius < box.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private buildPostProcessing(): void {
    if (this.isSoftwareGl) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(renderPass);

    const blueNoiseTex = createBlueNoiseTexture();
    this.blueNoiseTex = blueNoiseTex;

    const ditherPass = new ShaderPass(DitherShader);
    ditherPass.uniforms.uBlueNoise.value = blueNoiseTex;
    ditherPass.uniforms.uResolution.value.set(w, h);
    ditherPass.uniforms.uPixelScale.value = this.settings.pixelScale;
    ditherPass.uniforms.uMode.value = this.getDitherModeIndex(this.settings.ditherMode);
    ditherPass.uniforms.uColorMode.value = this.getColorModeIndex(this.settings.colorDepth);
    composer.addPass(ditherPass);

    this.composer = composer;
    this.ditherPass = ditherPass;
    this.syncPaletteUniforms();
  }

  private getColorModeIndex(depth: ColorDepthMode): number {
    const map: Record<ColorDepthMode, number> = {
      '1bit': 0,
      '5ramp': 1,
      '5contrast': 2,
      '5mixed': 3,
      '3contrast': 4,
    };
    return map[depth];
  }

  private getDitherModeIndex(mode: DitherMode): number {
    const modeMap: Record<DitherMode, number> = {
      bayer4: 0,
      bayer8: 1,
      contrast: 2,
      blue: 3,
      hatch: 4,
      halftone: 5,
    };
    return modeMap[mode];
  }

  private resolveActivePalette(): Exclude<DitherPalette, 'auto'> {
    if (this.settings.palette !== 'auto') {
      return this.settings.palette;
    }
    if (this.hp <= 30 || this.damagePulse > 0.22) {
      return 'crimson';
    }
    if (this.cameraOn) {
      return 'night';
    }
    if (this.battery <= 25 && (this.flashlightOn || this.cameraOn)) {
      return 'amber';
    }
    return 'bone';
  }

  private syncPaletteUniforms(): void {
    if (!this.ditherPass) return;
    const key = this.resolveActivePalette();
    if (key !== this.activePaletteKey) {
      this.activePaletteKey = key;
      const colors = PALETTE_COLORS[key];
      setColorSrgbHex(this.ditherPass.uniforms.uDarkColor.value, colors.dark);
      setColorSrgbHex(this.ditherPass.uniforms.uMidDarkColor.value, colors.midDark);
      setColorSrgbHex(this.ditherPass.uniforms.uMidColor.value, colors.mid);
      setColorSrgbHex(this.ditherPass.uniforms.uMidLightColor.value, colors.midLight);
      setColorSrgbHex(this.ditherPass.uniforms.uLightColor.value, colors.light);
      setColorSrgbHex(this.ditherPass.uniforms.uAccentColor.value, colors.accent);
      this.ditherPass.uniforms.uAccentMode.value = colors.accentOnHotLum ? 1.0 : 0.0;

      const mixSet =
        key === 'night'
          ? MIXED_5_COLORS.night
          : key === 'cobalt'
          ? MIXED_5_COLORS.cobalt
          : key === 'gameboy'
          ? MIXED_5_COLORS.gameboy
          : key === 'violet'
          ? MIXED_5_COLORS.violet
          : key === 'rust'
          ? MIXED_5_COLORS.rust
          : MIXED_5_COLORS.normal;
      this.ditherPass.uniforms.uMixed0.value.copy(mixSet[0]);
      this.ditherPass.uniforms.uMixed1.value.copy(mixSet[1]);
      this.ditherPass.uniforms.uMixed2.value.copy(mixSet[2]);
      this.ditherPass.uniforms.uMixed3.value.copy(mixSet[3]);
      this.ditherPass.uniforms.uMixed4.value.copy(mixSet[4]);
    }
    this.ditherPass.uniforms.uColorMode.value = this.getColorModeIndex(this.settings.colorDepth);
    this.ditherPass.uniforms.uCamcorder.value = this.cameraOn ? 1.0 : 0.0;
  }

  public startGame(): void {
    this.audio.init(this.pendingLampPositions, this.pendingPipePositions);
    this.audio.setEnabled(this.settings.spatialAudio);
    if (this.phase === 'dead' || this.phase === 'escaped') {
      this.resetRun();
    }
    this.phase = 'playing';
    this.setHint('Setor Submerso: [C] Sonar · [B] Flash · [N] Rádio · [Q] Agachar na água.', 6.0);
    this.pushHud(true);
  }

  public resetRun(): void {
    this.playerPos.set(this.level.playerSpawn.x, 1.62, this.level.playerSpawn.z);
    this.eyeHeight = 1.62;
    this.yaw = this.level.playerSpawn.yaw;
    this.targetYaw = this.level.playerSpawn.yaw;
    this.playerBodyYaw = this.level.playerSpawn.yaw;
    this.pitch = 0;
    this.targetPitch = 0;
    this.velX = 0;
    this.velZ = 0;
    this.walkPhase = 0;
    this.stepDistAccum = 0;
    this.camDistSmooth = 1.48;
    this.camRightSmooth = 0.36;
    this.playerWeightIdle = 1;
    this.playerWeightWalk = 0;
    this.playerWeightRun = 0;
    this.playerWeightCrouch = 0;
    this.playerWeightPistol = 0;
    this.playerWeightPistolBack = 0;
    this.playerLocoScale = 1;
    this.playerRig.group.position.set(this.playerPos.x, 0, this.playerPos.z);
    this.playerRig.group.rotation.y = this.playerBodyYaw;
    resetPlayerAnimation(this.playerRig);
    this.hp = 100;
    this.flashlightOn = true;
    this.cameraOn = false;
    this.battery = 100;
    this.elapsedSec = 0;
    this.damagePulse = 0;
    this.threatLevel = 0;
    if (this.fogExp) this.fogExp.density = 0.145;

    this.crouching = false;
    this.peekingInput = false;
    this.peekingDoor = null;
    this.nearestClosedDoor = null;
    this.holdingBreathInput = false;
    this.holdingBreath = false;
    this.lockerPanic = 0;
    this.breathStamina = 100;
    this.bottles = 0;
    this.traps = 0;

    this.hasKey = false;
    this.powerOn = false;
    this.leverProgress = 0;
    this.interactPrompt = null;
    this.activeLocker = null;
    this.sawPlayerHide = false;
    this.huntedLocker = null;

    for (const d of this.doors) {
      d.open = false;
      d.locked = false;
      d.lockProgress = 0;
      d.openProgress = 0;
      d.poundFlash = 0;
      d.rig.doorPivot.rotation.y = 0;
      d.rig.boltMesh.position.x = 1.02;
    }
    this.syncClosedDoorBoxes();

    for (const al of this.alarms) {
      al.state = 'idle';
      al.timer = 0;
      al.pulseAccum = 0;
      al.rig.hammerPivot.rotation.z = 0;
      al.rig.beaconMat.color.setHex(0x808080);
      al.rig.beaconMat.emissive.setHex(0x222222);
    }
    for (const gp of this.glassPatches) {
      gp.cooldown = 0;
    }
    for (const bar of this.barricades) {
      bar.state = 'upright';
      bar.tiltProgress = 0;
      bar.clearOffset = 0;
      bar.rig.group.position.set(bar.baseX, 0, bar.baseZ);
      bar.rig.tiltPivot.rotation.x = 0;
      bar.rig.tiltPivot.position.z = -0.34;
    }
    this.syncTippedBarricades();

    for (const tb of this.thrownBottlePool) {
      tb.active = false;
      tb.mesh.visible = false;
    }
    for (const tr of this.armedTrapPool) {
      tr.active = false;
      tr.sprung = false;
      tr.snapProgress = 0;
      tr.rig.group.visible = false;
      tr.rig.leftJaw.rotation.x = 0;
      tr.rig.rightJaw.rotation.x = 0;
    }

    for (const lk of this.lockers) {
      lk.doorKick = 0;
      lk.rig.doorPivot.rotation.y = 0;
    }

    this.corridorShadowTriggered = false;
    this.corridorSilhouetteTimer = 0;
    this.corridorSilhouette.position.copy(this.corridorSilhouetteBasePos);
    this.corridorSilhouette.visible = false;
    this.lampBurstTriggered = [false, false];
    this.doorSlamTriggered = [false, false];
    this.blackoutTriggered = false;
    this.blackoutTimer = 0;
    this.threatLevel = 0;
    for (const lamp of this.lamps) {
      lamp.bursted = false;
      lamp.burstTimer = 0;
    }

    this.keyMesh.visible = true;
    this.keyVLight.intensity = 1.5;
    this.breakerRig.leverPivot.rotation.x = 0.65;
    this.breakerRig.beaconMat.color.setHex(0xff463d);
    this.breakerRig.beaconMat.emissive.setHex(0xff463d);
    this.breakerVLight.color = 0xff5a4f;

    this.creaturePos.set(this.level.creatureSpawn.x, 0, this.level.creatureSpawn.z);
    this.creatureBrain = 'search';
    this.creatureLostSightSec = 0;
    this.creatureAttackCooldown = 0;
    this.creatureSpeed = 0;
    this.creatureHeading = Math.PI;
    this.killerPauseTimer = 0.4;
    this.killerInspectTimer = 0;
    this.killerDoorBashTimer = 0;
    this.killerNextPoundAt = 0;
    this.killerDoorTarget = null;
    this.killerBarricadeTimer = 0;
    this.killerBarricadeTarget = null;
    this.killerStunTimer = 0;
    this.killerRepathTimer = 0;
    this.killerStuckTimer = 0;
    this.killerLastPos.copy(this.creaturePos);
    this._pathLen = 0;
    this._pathCursor = 0;
    this.waypointVisitedAt.fill(0);
    const initialWpIdx = Math.min(6, Math.max(0, this.level.searchWaypoints.length - 1));
    this.currentWaypointIdx = initialWpIdx;
    const initWp = this.level.searchWaypoints[initialWpIdx];
    if (initWp) {
      this.killerTargetPos.set(
        (initWp.gx + 0.5) * CELL_SIZE,
        0,
        (initWp.gz + 0.5) * CELL_SIZE,
      );
    } else {
      this.killerTargetPos.copy(this.creaturePos);
    }
    this.killerWeightIdle = 1;
    this.killerWeightWalk = 0;
    this.killerWeightRun = 0;
    this.killerLocoScale = 1;
    this.creatureRig.group.visible = true;
    this.creatureRig.group.position.copy(this.creaturePos);
    resetKillerAnimation(this.creatureRig);

    // Reset submerged floodwater, sonar decals, strobe capacitor, radio & SFX popups
    this.waterLevel = 0.02;
    this.waterHintShown = false;
    if (this.waterMesh) this.waterMesh.position.y = this.waterLevel;
    this.sonarWave = 0;
    this.sonarPingTimer = 0;
    this.sonarThreatPulse = 0;
    this.sonarSensorTimer = 0;
    this.sonarProximity = 0;
    this.creatureFootstepAccum = 0;
    this.footprintLeftSide = true;
    for (const fp of this.footprintPool) {
      fp.life = 0;
      fp.mesh.visible = false;
    }
    for (const sb of this.spectralBeacons) {
      sb.mesh.visible = false;
    }
    this.flashCharges = 2;
    this.flashCooldown = 0;
    this.flashInvert = 0;
    this.flashBurstVLight.intensity = 0;
    this.radioOn = true;
    this.radioSignal = 0;
    this.radioBurstTimer = 0;
    this.radioBetrayCooldown = 0;
    for (const sp of this.sfxPopupPool) {
      sp.life = 0;
    }

    for (const pk of this.pickups) {
      pk.collected = false;
      pk.group.visible = true;
    }
    this.phase = 'playing';
    this.pushHud(true);
  }

  public updateSettings(partial: Partial<EngineSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.audio.setEnabled(this.settings.spatialAudio);
    if (this.ditherPass) {
      this.ditherPass.uniforms.uPixelScale.value = this.settings.pixelScale;
      this.ditherPass.uniforms.uMode.value = this.getDitherModeIndex(this.settings.ditherMode);
      this.ditherPass.uniforms.uColorMode.value = this.getColorModeIndex(this.settings.colorDepth);
      this.syncPaletteUniforms();
    }
  }

  public setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.desktopSprint = down;
    }
    if (code === 'KeyR') {
      this.setPeeking(down);
    }
    if (code === 'Space') {
      this.setHoldingBreath(down);
    }
  }

  public clearKeys(): void {
    this.keys.clear();
    this.desktopSprint = false;
    this.peekingInput = false;
    this.holdingBreathInput = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchMove.sprint = false;
  }

  public setTouchMove(x: number, y: number, sprint: boolean): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.touchMove.sprint = sprint;
  }

  public toggleCrouch(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    this.crouching = !this.crouching;
    this.pushHud(true);
  }

  public setPeeking(active: boolean): void {
    if (this.phase !== 'playing' || this.activeLocker) {
      this.peekingInput = false;
      return;
    }
    if (active && !this.peekingInput && this.nearestClosedDoor) {
      this.audio.playDoorPeek();
    }
    this.peekingInput = active;
  }

  public isNearClosedDoor(): boolean {
    return !this.activeLocker && Boolean(this.nearestClosedDoor);
  }

  public setHoldingBreath(active: boolean): void {
    this.holdingBreathInput = active;
  }

  public toggleDoorLock(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    let bestDoor: DoorEntry | null = null;
    let bestDist = 2.25;
    for (const d of this.doors) {
      const dist = Math.hypot(this.playerPos.x - d.pos.x, this.playerPos.z - d.pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        bestDoor = d;
      }
    }
    if (!bestDoor) {
      this.setHint('Aproxime-se de uma porta para trancar ou destrancar.', 1.8);
      return;
    }
    if (bestDoor.open) {
      this.setHint('Feche a porta antes de passar a tranca.', 1.8);
      return;
    }
    bestDoor.locked = !bestDoor.locked;
    this.audio.playDoorLock(bestDoor.locked);
    this.setHint(
      bestDoor.locked
        ? 'Porta trancada! O assassino terá que forçar a fechadura.'
        : 'Porta destrancada.',
      2.4,
    );
    this.pushHud(true);
  }

  public throwBottle(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    if (this.bottles <= 0) {
      this.setHint('Sem frascos! Procure garrafas de vidro pelas salas.', 2.0);
      return;
    }
    let slot: ThrownBottleEntry | null = null;
    for (const tb of this.thrownBottlePool) {
      if (!tb.active) {
        slot = tb;
        break;
      }
    }
    if (!slot) return;

    this.bottles--;
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    if (this.isThirdPersonViewActive()) {
      slot.pos.set(this.playerPos.x, this.crouching ? 0.96 : 1.42, this.playerPos.z).addScaledVector(_v1, 0.55);
    } else {
      slot.pos.copy(this.camera.position).addScaledVector(_v1, 0.45);
    }
    slot.vel.copy(_v1).multiplyScalar(11.2);
    slot.vel.y += 2.6;
    slot.mesh.position.copy(slot.pos);
    slot.mesh.visible = true;
    slot.active = true;
    this.audio.playDoorPeek();
    this.pushHud(true);
  }

  public placeTrap(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    if (this.traps <= 0) {
      this.setHint('Sem armadilhas no inventário! Colete armadilhas pelo sanatório.', 2.2);
      return;
    }
    let slot: ArmedTrapEntry | null = null;
    for (const tr of this.armedTrapPool) {
      if (!tr.active) {
        slot = tr;
        break;
      }
    }
    if (!slot) {
      this.setHint('Limite de armadilhas ativas atingido.', 2.0);
      return;
    }

    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    const tx = this.playerPos.x + fwdX * 0.85;
    const tz = this.playerPos.z + fwdZ * 0.85;

    if (isWallAtWorld(tx, tz, 0.34, this.closedDoorBoxes, this.level.rows)) {
      this.setHint('Sem espaço aqui! Afaste-se da parede ou porta para armar a armadilha.', 2.0);
      return;
    }

    this.traps--;
    slot.active = true;
    slot.sprung = false;
    slot.snapProgress = 0;
    slot.pos.set(tx, 0, tz);
    slot.rig.group.position.copy(slot.pos);
    slot.rig.group.rotation.y = this.yaw;
    slot.rig.leftJaw.rotation.x = 0;
    slot.rig.rightJaw.rotation.x = 0;
    slot.rig.ringMat.color.setHex(0xd94238);
    slot.rig.ringMat.emissive.setHex(0x6b1812);
    slot.rig.group.visible = true;
    this.audio.playTrapSet();
    this.setHint('Armadilha armada! Atraia o assassino para passar sobre ela.', 2.8);
    this.pushHud(true);
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    this.targetYaw -= dx;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy, -1.25, 1.25);
  }

  public toggleFlashlight(): void {
    this.flashlightOn = !this.flashlightOn;
    if (this.phase === 'playing') {
      this.audio.playFlashlightClick();
    }
    this.pushHud(true);
  }

  public toggleCamera(): void {
    this.cameraOn = !this.cameraOn;
    if (this.phase === 'playing') {
      this.audio.playCameraToggle(this.cameraOn);
      if (this.cameraOn) {
        this.sonarPingTimer = 3.6;
        this.triggerSonarPing();
      }
    }
    this.syncPaletteUniforms();
    this.pushHud(true);
  }

  public triggerSonarPing(): void {
    if (this.phase !== 'playing') return;
    this.sonarWave = 1.0;
    this.audio.playSonarPing();
    this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 16.5, 2.8);

    const killerDist = Math.hypot(
      this.creaturePos.x - this.playerPos.x,
      this.creaturePos.z - this.playerPos.z,
    );
    if (killerDist < 22.0) {
      this.sonarThreatPulse = 1.0;
      _v1.set(this.creaturePos.x, 1.65, this.creaturePos.z);
      this.spawnSfxPopup('PING!', _v1, 1.35, true);
    }
  }

  public triggerStrobeFlash(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    if (this.flashCooldown > 0) return;
    if (this.flashCharges <= 0) {
      this.audio.playEmptyClick();
      this.setHint('Sem cargas no Flash! Colete baterias para recarregar.', 2.2);
      return;
    }

    this.flashCharges--;
    this.flashCooldown = 2.2;
    this.flashInvert = 1.0;
    this.flashBurstVLight.pos.set(this.playerPos.x, this.crouching ? 1.15 : 1.58, this.playerPos.z);
    this.flashBurstVLight.intensity = 28.0;
    this.audio.playStrobeFlash();

    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    _v1.set(this.playerPos.x + fwdX * 1.6, this.crouching ? 1.15 : 1.55, this.playerPos.z + fwdZ * 1.6);
    this.spawnSfxPopup('FLASH!', _v1, 1.0, true);

    const dx = this.creaturePos.x - this.playerPos.x;
    const dz = this.creaturePos.z - this.playerPos.z;
    const dist = Math.hypot(dx, dz);
    const hasLos =
      dist < 10.5 &&
      hasLineOfSight(
        this.playerPos.x,
        this.playerPos.z,
        this.creaturePos.x,
        this.creaturePos.z,
        this.closedDoorBoxes,
        this.level.rows,
      );
    const facingDot = dist > 0.1 ? (dx * fwdX + dz * fwdZ) / dist : 1;

    if (hasLos && facingDot > 0.1) {
      this.killerStunTimer = 3.5;
      this.killerDoorTarget = null;
      this.killerBarricadeTarget = null;
      this.triggerKillerHitAnim();
      _v1.set(this.creaturePos.x, 1.9, this.creaturePos.z);
      this.spawnSfxPopup('ZAP!', _v1, 1.15, true);
      this.setHint('Flash estroboscópico! A criatura foi cegada por 3,5 segundos!', 3.2);
    } else {
      this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 18.0, 3.0);
    }
    this.pushHud(true);
  }

  public toggleRadio(): void {
    this.radioOn = !this.radioOn;
    if (this.phase === 'playing') {
      this.audio.playFlashlightClick();
      this.setHint(
        this.radioOn
          ? 'Rádio AM ligado — detecta proximidade da criatura, mas emite chiado perto dela.'
          : 'Rádio AM silenciado — modo furtivo sem sinal de alerta.',
        2.6,
      );
    }
    this.pushHud(true);
  }

  private spawnSfxPopup(text: string, worldPos: THREE.Vector3, duration = 1.1, accent = false): void {
    let chosen = this.sfxPopupPool[0];
    for (let i = 0; i < this.sfxPopupPool.length; i++) {
      if (this.sfxPopupPool[i].life <= 0) {
        chosen = this.sfxPopupPool[i];
        break;
      }
      if (this.sfxPopupPool[i].life < chosen.life) {
        chosen = this.sfxPopupPool[i];
      }
    }
    if (!chosen) return;
    chosen.id = this.nextSfxPopupId++;
    chosen.text = text;
    chosen.worldPos.copy(worldPos);
    chosen.worldPos.y += 0.25;
    chosen.life = duration;
    chosen.maxLife = duration;
    chosen.accent = accent;
    chosen.tiltDeg = (Math.random() - 0.5) * 18;
  }

  private lureKillerToNoise(wx: number, wz: number, radius: number, inspectSec = 3.0): void {
    const dist = Math.hypot(wx - this.creaturePos.x, wz - this.creaturePos.z);
    if (dist > radius) return;
    if (this.creatureBrain === 'chase') {
      const seesNow =
        !this.activeLocker &&
        hasLineOfSight(
          this.creaturePos.x,
          this.creaturePos.z,
          this.playerPos.x,
          this.playerPos.z,
          this.closedDoorBoxes,
          this.level.rows,
        ) &&
        this.creaturePos.distanceTo(this.playerPos) < 9.5;
      if (seesNow) return;
    }
    this.creatureBrain = 'investigate';
    this.killerTargetPos.set(wx, 0, wz);
    this.killerInspectTimer = inspectSec;
    this.killerPauseTimer = 0;
    this.killerRepathTimer = 0;
  }

  public interact(): void {
    if (this.phase !== 'playing') return;

    // 0. Exit current hiding locker
    if (this.activeLocker) {
      this.activeLocker.doorKick = 1.0;
      this.playerPos.copy(this.activeLocker.exitPos);
      this.activeLocker = null;
      this.camDistSmooth = 0.32;
      this.sawPlayerHide = false;
      this.huntedLocker = null;
      this.holdingBreath = false;
      this.lockerPanic = 0;
      this.audio.playLockerDoor(true);
      this.pushHud(true);
      return;
    }

    // 1. Breaker Panel
    const distBreaker = Math.hypot(
      this.playerPos.x - this.level.breakerPanelPos.interactX,
      this.playerPos.z - this.level.breakerPanelPos.interactZ,
    );
    if (distBreaker < 2.2 && !this.powerOn) {
      this.powerOn = true;
      this.blackoutTimer = 0;
      _v1.set(this.level.breakerPanelPos.x, 1.5, this.level.breakerPanelPos.z);
      this.spawnSparks(_v1, 12);
      this.spawnSfxPopup('ZAP!', _v1, 1.15, true);
      this.audio.playDoorUnlock();
      this.breakerRig.beaconMat.color.setHex(0x80ff72);
      this.breakerRig.beaconMat.emissive.setHex(0x80ff72);
      this.breakerVLight.color = 0x80ff72;
      this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 22, 3.2);
      this.setHint(
        this.hasKey
          ? 'Disjuntor religado! Vá para a Escotilha de Saída na ala Sudeste.'
          : 'Disjuntor religado! Agora busque a Chave na Sala de Arquivos (Sudoeste).',
        4.2,
      );
      this.pushHud(true);
      return;
    }

    // 2. Wind-up Alarm Decoy
    let bestAlarm: AlarmEntry | null = null;
    let bestAlarmDist = 2.0;
    for (const al of this.alarms) {
      if (al.state !== 'idle') continue;
      const dist = Math.hypot(this.playerPos.x - al.pos.x, this.playerPos.z - al.pos.z);
      if (dist < bestAlarmDist) {
        bestAlarmDist = dist;
        bestAlarm = al;
      }
    }
    if (bestAlarm) {
      bestAlarm.state = 'countdown';
      bestAlarm.timer = 4.5;
      bestAlarm.pulseAccum = 0;
      bestAlarm.rig.beaconMat.color.setHex(0xf3b644);
      bestAlarm.rig.beaconMat.emissive.setHex(0xd98a16);
      this.audio.playAlarmTick(bestAlarm.pos);
      this.setHint('Despertador armado! Afaste-se — tocará em 4,5 segundos.', 3.0);
      this.pushHud(true);
      return;
    }

    // 3. Tippable Barricade Cart / Obstacle
    let bestBar: BarricadeEntry | null = null;
    let bestBarDist = 2.15;
    for (const bar of this.barricades) {
      if (bar.state !== 'upright') continue;
      const dist = Math.hypot(this.playerPos.x - bar.pos.x, this.playerPos.z - bar.pos.z);
      if (dist < bestBarDist) {
        bestBarDist = dist;
        bestBar = bar;
      }
    }

    // 4. Nearest Door & Nearest Locker
    let bestDoor: DoorEntry | null = null;
    let bestDoorDist = 2.25;
    for (const d of this.doors) {
      const dist = Math.hypot(this.playerPos.x - d.pos.x, this.playerPos.z - d.pos.z);
      if (dist < bestDoorDist) {
        bestDoorDist = dist;
        bestDoor = d;
      }
    }

    let bestLocker: LockerEntry | null = null;
    let bestLockerDist = 1.95;
    for (const lk of this.lockers) {
      const d = Math.hypot(this.playerPos.x - lk.pos.x, this.playerPos.z - lk.pos.z);
      if (d < bestLockerDist) {
        bestLockerDist = d;
        bestLocker = lk;
      }
    }

    if (bestBar && (!bestDoor || bestBarDist < bestDoorDist) && (!bestLocker || bestBarDist < bestLockerDist)) {
      const killerOnBar = Math.hypot(this.creaturePos.x - bestBar.pos.x, this.creaturePos.z - bestBar.pos.z) < 0.85;
      if (killerOnBar) {
        this.setHint('O assassino já está sobre o obstáculo!', 1.5);
        return;
      }
      bestBar.state = 'tipped';
      this.syncTippedBarricades();
      this.audio.playObstacleTip(bestBar.pos);
      this.lureKillerToNoise(bestBar.pos.x, bestBar.pos.z, 13.5, 2.5);
      this.setHint('Obstáculo derrubado! Agache [Q] para passar por baixo.', 2.8);
      this.pushHud(true);
      return;
    }

    // Toggle nearest door
    if (bestDoor && (!bestLocker || bestDoorDist <= bestLockerDist)) {
      if (bestDoor.open) {
        const playerInDoor = Math.hypot(this.playerPos.x - bestDoor.pos.x, this.playerPos.z - bestDoor.pos.z) < 0.62;
        const killerInDoor = Math.hypot(this.creaturePos.x - bestDoor.pos.x, this.creaturePos.z - bestDoor.pos.z) < 0.72;
        if (playerInDoor || killerInDoor) {
          this.setHint('Afaste-se do batente para fechar a porta.', 1.6);
          return;
        }
      }
      if (bestDoor.locked) {
        bestDoor.locked = false;
        this.audio.playDoorLock(false);
      }
      bestDoor.open = !bestDoor.open;
      this.peekingDoor = null;
      this.syncClosedDoorBoxes();
      this.audio.playLockerDoor(bestDoor.open);
      const alertDist = this.crouching ? 3.2 : 11.5;
      this.lureKillerToNoise(bestDoor.pos.x, bestDoor.pos.z, alertDist, 2.4);
      this.pushHud(true);
      return;
    }

    if (bestLocker) {
      const killerSawMe =
        hasLineOfSight(
          this.creaturePos.x,
          this.creaturePos.z,
          this.playerPos.x,
          this.playerPos.z,
          this.closedDoorBoxes,
          this.level.rows,
        ) && this.creaturePos.distanceTo(this.playerPos) < 12.5;

      this.activeLocker = bestLocker;
      this.crouching = false;
      this.peekingInput = false;
      this.peekingDoor = null;
      this.lockerPanic = 0;
      this.sawPlayerHide = killerSawMe;
      this.huntedLocker = killerSawMe ? bestLocker : null;
      bestLocker.doorKick = 1.0;
      this.targetYaw = bestLocker.faceYaw;
      this.targetPitch = 0;
      this.audio.playLockerDoor(false);
      this.setHint(
        this.flashlightOn
          ? 'Escondido! Apague a lanterna (F) e segure [ESPAÇO] para prender o ar perto dele.'
          : 'Escondido! Segure [ESPAÇO] se ele se aproximar para não ofegar.',
        3.8,
      );
      this.pushHud(true);
      return;
    }

    // 5. Exit Door check when missing key or power
    const distExit = Math.hypot(
      this.playerPos.x - this.exitWorldPos.x,
      this.playerPos.z - this.exitWorldPos.z,
    );
    if (distExit < 2.4 && (!this.hasKey || !this.powerOn)) {
      this.audio.playEmptyClick();
      if (!this.hasKey && !this.powerOn) {
        this.setHint('Saída trancada e sem energia! Pegue a Chave e ligue o Disjuntor.', 3.2);
      } else if (!this.hasKey) {
        this.setHint('Falta a Chave da Saída (Sala de Arquivos, Sudoeste)!', 3.0);
      } else {
        this.setHint('Saída sem energia! Ligue o Disjuntor na Enfermaria (Nordeste).', 3.0);
      }
    }
  }

  private spawnSparks(origin: THREE.Vector3, count: number): void {
    let spawned = 0;
    for (const s of this.sparks) {
      if (s.life <= 0 && spawned < count) {
        s.mesh.position.copy(origin);
        s.vel.set(
          (Math.random() - 0.5) * 3.8,
          Math.random() * 2.4 + 0.4,
          (Math.random() - 0.5) * 3.8,
        );
        s.life = 0.28 + Math.random() * 0.2;
        s.mesh.visible = true;
        spawned++;
      }
    }
  }

  private setHint(text: string, duration: number): void {
    this.hintText = text;
    this.hintTimer = duration;
  }

  private requestPointerLock(): void {
    try {
      const maybePromise = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore pointer lock rejection when document is unfocused or user cancelled
    }
  }

  public lockPointer(): void {
    if (this.phase === 'playing') {
      this.requestPointerLock();
    }
  }

  public getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);
    if (this.ditherPass) this.ditherPass.uniforms.uResolution.value.set(w, h);
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const maxDt = this.isSoftwareGl ? 0.085 : 0.05;
    const dt = Math.min(maxDt, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.clockElapsed += dt;

    this.update(dt);

    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private update(dt: number): void {
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 24, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 24, dt);

    let moveSpeed = 0;
    let isSprinting = false;

    if (this.phase === 'playing') {
      this.elapsedSec += dt;

      if (this.activeLocker) {
        this.velX = 0;
        this.velZ = 0;
        this.playerPos.lerp(this.activeLocker.insidePos, 1 - Math.exp(-14 * dt));
        let yawDiff = this.targetYaw - this.activeLocker.faceYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        yawDiff = THREE.MathUtils.clamp(yawDiff, -0.48, 0.48);
        this.targetYaw = this.activeLocker.faceYaw + yawDiff;
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, -0.35, 0.35);

        // Locker panic & breath holding when killer is lurking nearby
        const killerDist = this.playerPos.distanceTo(this.creaturePos);
        if (killerDist < 9.5) {
          this.holdingBreath = this.holdingBreathInput && this.breathStamina > 2;
          if (this.holdingBreath) {
            this.breathStamina = Math.max(0, this.breathStamina - 18.5 * dt);
            this.lockerPanic = Math.max(0, this.lockerPanic - 22 * dt);
          } else {
            this.breathStamina = Math.min(100, this.breathStamina + 20 * dt);
            const threatRate = (1 - killerDist / 9.5) * 36;
            this.lockerPanic = Math.min(100, this.lockerPanic + threatRate * dt);
            if (this.lockerPanic >= 96 && killerDist < 8.5) {
              this.audio.playBreathGasp();
              this.lockerPanic = 52;
              this.sawPlayerHide = true;
              this.huntedLocker = this.activeLocker;
              this.lureKillerToNoise(this.activeLocker.pos.x, this.activeLocker.pos.z, 12, 3.0);
              this.setHint('Você ofegou alto! O assassino ouviu você no armário!', 2.8);
              this.pushHud(true);
            }
          }
        } else {
          this.holdingBreath = false;
          this.breathStamina = Math.min(100, this.breathStamina + 28 * dt);
          this.lockerPanic = Math.max(0, this.lockerPanic - 28 * dt);
        }
      } else {
        this.holdingBreath = false;
        this.lockerPanic = 0;
        this.breathStamina = Math.min(100, this.breathStamina + 30 * dt);

        const kbForward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
        const kbStrafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
        const kbTurn = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
        if (kbTurn !== 0) {
          this.targetYaw += kbTurn * 2.1 * dt;
        }

        const f = THREE.MathUtils.clamp(kbForward + this.touchMove.y, -1, 1);
        const s = THREE.MathUtils.clamp(kbStrafe + this.touchMove.x, -1, 1);
        const mag = Math.hypot(f, s);

        let targetVx = 0;
        let targetVz = 0;
        if (mag > 0.05) {
          isSprinting = !this.crouching && (this.desktopSprint || this.touchMove.sprint) && mag > 0.45;
          // Crouch = 0.95 m/s stealth | Walk = 1.52 m/s | Sprint = 2.65 m/s
          const speed = this.crouching ? 0.95 : isSprinting ? 2.65 : 1.52;
          const desiredSpeed = speed * Math.min(1, mag);

          const nf = f / mag;
          const ns = s / mag;
          const sinY = Math.sin(this.yaw);
          const cosY = Math.cos(this.yaw);
          targetVx = (-sinY * nf + cosY * ns) * desiredSpeed;
          targetVz = (-cosY * nf - sinY * ns) * desiredSpeed;
        }

        this.velX = THREE.MathUtils.damp(this.velX, targetVx, 16, dt);
        this.velZ = THREE.MathUtils.damp(this.velZ, targetVz, 16, dt);
        moveSpeed = Math.hypot(this.velX, this.velZ);

        if (moveSpeed > 0.04) {
          const dx = this.velX * dt;
          const dz = this.velZ * dt;

          const blockedX =
            isWallAtWorld(this.playerPos.x + dx, this.playerPos.z, 0.38, this.closedDoorBoxes, this.level.rows) ||
            this.hitsUprightBarricade(this.playerPos.x + dx, this.playerPos.z, 0.38) ||
            (!this.crouching && this.hitsTippedBarricade(this.playerPos.x + dx, this.playerPos.z, 0.38));
          if (!blockedX) {
            this.playerPos.x += dx;
          } else {
            this.velX = 0;
          }

          const blockedZ =
            isWallAtWorld(this.playerPos.x, this.playerPos.z + dz, 0.38, this.closedDoorBoxes, this.level.rows) ||
            this.hitsUprightBarricade(this.playerPos.x, this.playerPos.z + dz, 0.38) ||
            (!this.crouching && this.hitsTippedBarricade(this.playerPos.x, this.playerPos.z + dz, 0.38));
          if (!blockedZ) {
            this.playerPos.z += dz;
          } else {
            this.velZ = 0;
          }

          const bobFreq = this.crouching ? 3.8 : isSprinting ? 8.8 : 5.6;
          this.walkPhase += dt * bobFreq;
          this.stepDistAccum += moveSpeed * dt;
          const stepStride = this.crouching ? 0.85 : isSprinting ? 1.35 : 1.05;
          if (this.stepDistAccum >= stepStride) {
            this.stepDistAccum = 0;
            this.audio.playPlayerFootstep(isSprinting, this.crouching, this.waterLevel);
            if (isSprinting) {
              const splashRadius = this.waterLevel > 0.06 ? 13.5 : 8.5;
              this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, splashRadius, 2.5);
              if (this.waterLevel > 0.06 && Math.random() < 0.45) {
                _v1.set(this.playerPos.x, this.waterLevel + 0.25, this.playerPos.z);
                this.spawnSfxPopup('SPLASH!', _v1, 0.85, false);
              }
            } else if (this.waterLevel > 0.06 && !this.crouching) {
              this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 6.5, 2.0);
              if (!this.waterHintShown) {
                this.waterHintShown = true;
                this.setHint('Água no convés! Caminhar em pé faz barulho — agache [Q] para silenciar.', 3.4);
              }
            }
          }
        }

        // Broken glass floor patches (walking upright crunches loudly; crouching is silent!)
        for (const gp of this.glassPatches) {
          if (gp.cooldown > 0) gp.cooldown = Math.max(0, gp.cooldown - dt);
          if (!this.crouching && moveSpeed > 0.28 && gp.cooldown === 0) {
            const dGlass = Math.hypot(this.playerPos.x - gp.pos.x, this.playerPos.z - gp.pos.z);
            if (dGlass < 0.88) {
              gp.cooldown = 0.9;
              this.audio.playGlassCrunch();
              _v1.set(gp.pos.x, 0.4, gp.pos.z);
              this.spawnSfxPopup('CRACK!', _v1, 0.95, false);
              this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 15.5, 3.0);
              this.setHint('Estilhaços no convés! Agache [Q] para atravessar sem fazer barulho.', 2.6);
            }
          }
        }
      }

      // Pillar 1: Rising abyssal floodwater across corridors
      this.waterLevel = Math.min(0.36, 0.02 + this.elapsedSec * 0.0024);
      if (this.waterMesh) {
        this.waterMesh.position.y = this.waterLevel + Math.sin(this.clockElapsed * 1.9) * 0.004;
      }

      // Pillar 2: Sonar pulse & spectral visibility
      if (this.sonarWave > 0) {
        this.sonarWave = Math.max(0, this.sonarWave - dt * 1.15);
      }
      if (this.cameraOn) {
        this.sonarPingTimer -= dt;
        if (this.sonarPingTimer <= 0) {
          this.sonarPingTimer = 3.6;
          this.triggerSonarPing();
        }
      }
      for (let i = 0; i < this.footprintPool.length; i++) {
        const fp = this.footprintPool[i];
        if (fp.life > 0) {
          fp.life = Math.max(0, fp.life - dt);
          fp.mesh.visible = this.cameraOn && fp.life > 0;
          fp.mesh.position.y = this.waterLevel + 0.015;
          fp.mat.opacity = Math.min(0.75, fp.life / 8.0);
        } else {
          fp.mesh.visible = false;
        }
      }
      for (let i = 0; i < this.spectralBeacons.length; i++) {
        const sb = this.spectralBeacons[i];
        const shouldShow =
          this.cameraOn &&
          ((sb.kind === 'key' && !this.hasKey) ||
            (sb.kind === 'breaker' && !this.powerOn) ||
            sb.kind === 'exit');
        sb.mesh.visible = shouldShow;
        if (shouldShow) {
          sb.mesh.rotation.y += dt * 1.8;
          sb.mesh.position.y = sb.baseY + Math.sin(this.clockElapsed * 2.6 + i) * 0.1;
        }
      }

      // Pillar 3: Strobe Flash cooldown/decay & AM Static Radio signal
      if (this.flashCooldown > 0) {
        this.flashCooldown = Math.max(0, this.flashCooldown - dt);
      }
      if (this.flashInvert > 0) {
        this.flashInvert = Math.max(0, this.flashInvert - dt * 3.4);
      }
      if (this.flashBurstVLight.intensity > 0.05) {
        this.flashBurstVLight.intensity = THREE.MathUtils.damp(this.flashBurstVLight.intensity, 0, 14, dt);
      } else {
        this.flashBurstVLight.intensity = 0;
      }

      const radioKillerDist = this.playerPos.distanceTo(this.creaturePos);
      this.sonarProximity = THREE.MathUtils.clamp(1 - radioKillerDist / 17.0, 0, 1);
      this.radioSignal =
        radioKillerDist < 17 ? Math.round(this.sonarProximity * 100) : 0;

      if (this.sonarThreatPulse > 0) {
        const decaySpeed = 2.1 + this.sonarProximity * 1.4;
        this.sonarThreatPulse = Math.max(0, this.sonarThreatPulse - dt * decaySpeed);
      }

      // Trigger visual sonar pulse whenever the proximity sensor detects the killer while Sonar Lens is active
      if (this.cameraOn && this.sonarProximity > 0.04) {
        this.sonarSensorTimer -= dt;
        if (this.sonarSensorTimer <= 0) {
          this.sonarSensorTimer = Math.max(0.28, 1.42 - this.sonarProximity * 1.14);
          this.sonarThreatPulse = 1.0;
          this.sonarWave = Math.max(this.sonarWave, 0.55 + this.sonarProximity * 0.45);
        }
      } else {
        this.sonarSensorTimer = 0.12;
      }

      // Trigger visual sonar pulse & 1-bit distortion whenever the AM Radio emits a detection burst
      if (this.radioOn && this.radioSignal > 5) {
        this.radioBurstTimer -= dt;
        if (this.radioBurstTimer <= 0) {
          const strength = this.radioSignal / 100;
          this.radioBurstTimer = Math.max(0.26, 1.25 - strength * 0.95);
          this.audio.playRadioStaticBurst(strength);
          if (this.cameraOn) {
            this.sonarThreatPulse = 1.0;
            this.sonarWave = Math.max(this.sonarWave, 0.45 + strength * 0.45);
          }
        }
        if (radioKillerDist < 7.2) {
          this.radioBetrayCooldown -= dt;
          if (this.radioBetrayCooldown <= 0) {
            this.radioBetrayCooldown = 1.8;
            this.lureKillerToNoise(this.playerPos.x, this.playerPos.z, 9.5, 2.5);
            if (this.activeLocker) {
              this.sawPlayerHide = true;
              this.huntedLocker = this.activeLocker;
            }
            this.setHint('Estática alta do rádio está revelando você! [N] para desligar.', 2.4);
          }
        }
      } else {
        this.radioBurstTimer = 0.15;
      }

      // Track nearest closed door for peeking & locking
      this.nearestClosedDoor = null;
      if (!this.activeLocker) {
        let bestClosedDist = 2.25;
        for (const d of this.doors) {
          if (d.open) continue;
          const dist = Math.hypot(this.playerPos.x - d.pos.x, this.playerPos.z - d.pos.z);
          if (dist < bestClosedDist) {
            bestClosedDist = dist;
            this.nearestClosedDoor = d;
          }
        }
      }
      this.peekingDoor = this.peekingInput && this.nearestClosedDoor ? this.nearestClosedDoor : null;

      // Animate hinged room doors, deadbolts & killer pound shake
      for (const d of this.doors) {
        const isBeingPeeked = this.peekingDoor === d;
        const targetOpen = d.open ? 1 : isBeingPeeked ? 0.25 : 0;
        if (Math.abs(d.openProgress - targetOpen) > 0.002 || d.poundFlash > 0) {
          d.openProgress = THREE.MathUtils.damp(d.openProgress, targetOpen, isBeingPeeked ? 12 : 8.5, dt);
          d.poundFlash = Math.max(0, d.poundFlash - dt * 5.0);
          const shake = d.poundFlash > 0 ? Math.sin(d.poundFlash * Math.PI * 3) * 0.055 : 0;
          d.rig.doorPivot.rotation.y = -d.openProgress * 1.48 + shake;
        }
        const targetLock = d.locked ? 1 : 0;
        if (Math.abs(d.lockProgress - targetLock) > 0.002) {
          d.lockProgress = THREE.MathUtils.damp(d.lockProgress, targetLock, 18, dt);
          d.rig.boltMesh.position.x = 1.02 + d.lockProgress * 0.11;
        }
      }

      // Animate tippable barricade carts cleanly on both axes ('ns' and 'ew')
      for (const bar of this.barricades) {
        const targetTilt = bar.state === 'upright' ? 0 : 1;
        if (Math.abs(bar.tiltProgress - targetTilt) > 0.002) {
          bar.tiltProgress = THREE.MathUtils.damp(bar.tiltProgress, targetTilt, 10, dt);
          bar.rig.tiltPivot.rotation.x = bar.tiltProgress * 1.42;
        }
        const targetClear = bar.state === 'cleared' ? 1 : 0;
        if (Math.abs(bar.clearOffset - targetClear) > 0.002) {
          bar.clearOffset = THREE.MathUtils.damp(bar.clearOffset, targetClear, 8, dt);
          bar.rig.tiltPivot.position.z = -0.34 - bar.clearOffset * 0.9;
        }
        if (bar.axis === 'ns') {
          bar.rig.group.position.x = THREE.MathUtils.lerp(bar.baseX, bar.pos.x, bar.tiltProgress);
          bar.rig.group.position.z = THREE.MathUtils.lerp(bar.baseZ, bar.pos.z - 0.22, bar.tiltProgress);
        } else {
          bar.rig.group.position.x = THREE.MathUtils.lerp(bar.baseX, bar.pos.x - 0.22, bar.tiltProgress);
          bar.rig.group.position.z = THREE.MathUtils.lerp(bar.baseZ, bar.pos.z, bar.tiltProgress);
        }
      }

      // Update thrown glass bottles (gravity + wall/door bounce + shatter distraction)
      for (const tb of this.thrownBottlePool) {
        if (!tb.active) continue;
        tb.vel.y -= 15.5 * dt;
        const nx = tb.pos.x + tb.vel.x * dt;
        const ny = tb.pos.y + tb.vel.y * dt;
        const nz = tb.pos.z + tb.vel.z * dt;

        if (isWallAtWorld(nx, tb.pos.z, 0.09, this.closedDoorBoxes, this.level.rows)) {
          tb.vel.x *= -0.4;
        } else {
          tb.pos.x = nx;
        }
        if (isWallAtWorld(tb.pos.x, nz, 0.09, this.closedDoorBoxes, this.level.rows)) {
          tb.vel.z *= -0.4;
        } else {
          tb.pos.z = nz;
        }
        tb.pos.y = ny;
        tb.mesh.position.copy(tb.pos);
        tb.mesh.rotation.x += dt * 11;
        tb.mesh.rotation.z += dt * 7;

        if (tb.pos.y <= 0.07) {
          tb.pos.y = 0.07;
          tb.active = false;
          tb.mesh.visible = false;
          this.spawnSparks(tb.pos, 10);
          this.spawnSfxPopup('CRASH!', tb.pos, 1.15, true);
          this.audio.playGlassShatter(tb.pos);
          this.lureKillerToNoise(tb.pos.x, tb.pos.z, 21.0, 4.2);
          this.setHint('Frasco estilhaçado! O som atraiu a atenção do assassino.', 2.6);
        }
      }

      // Update wind-up alarm decoys
      for (const al of this.alarms) {
        if (al.state === 'countdown') {
          al.timer -= dt;
          al.pulseAccum += dt;
          if (al.pulseAccum >= 0.55) {
            al.pulseAccum = 0;
            this.audio.playAlarmTick(al.pos);
          }
          if (al.timer <= 0) {
            al.state = 'ringing';
            al.timer = 5.0;
            al.pulseAccum = 0.6;
            al.rig.beaconMat.color.setHex(0xff3b30);
            al.rig.beaconMat.emissive.setHex(0xff3b30);
          }
        } else if (al.state === 'ringing') {
          al.timer -= dt;
          al.pulseAccum += dt;
          al.rig.hammerPivot.rotation.z = Math.sin(this.clockElapsed * 48) * 0.45;
          if (al.pulseAccum >= 0.6) {
            al.pulseAccum = 0;
            this.audio.playAlarmRing(al.pos);
            this.spawnSfxPopup('RING!', al.pos, 0.85, false);
            this.lureKillerToNoise(al.pos.x, al.pos.z, 24.0, 4.5);
          }
          if (al.timer <= 0) {
            al.state = 'cooldown';
            al.timer = 16.0;
            al.rig.hammerPivot.rotation.z = 0;
            al.rig.beaconMat.color.setHex(0x4a4a4a);
            al.rig.beaconMat.emissive.setHex(0x111111);
          }
        } else if (al.state === 'cooldown') {
          al.timer -= dt;
          if (al.timer <= 0) {
            al.state = 'idle';
            al.rig.beaconMat.color.setHex(0x808080);
            al.rig.beaconMat.emissive.setHex(0x222222);
          }
        }
      }

      // Animate & trigger armed floor traps
      for (const tr of this.armedTrapPool) {
        if (!tr.active) continue;
        if (tr.sprung) {
          tr.snapProgress = Math.min(1, tr.snapProgress + dt * 16);
          tr.rig.leftJaw.rotation.x = tr.snapProgress * 1.18;
          tr.rig.rightJaw.rotation.x = -tr.snapProgress * 1.18;
          continue;
        }
        const dKiller = Math.hypot(this.creaturePos.x - tr.pos.x, this.creaturePos.z - tr.pos.z);
        if (dKiller < 0.85 && this.killerStunTimer <= 0) {
          tr.sprung = true;
          tr.rig.ringMat.color.setHex(0x555555);
          tr.rig.ringMat.emissive.setHex(0x000000);
          this.killerStunTimer = 3.8;
          this.killerDoorTarget = null;
          this.killerBarricadeTarget = null;
          this.triggerKillerHitAnim();
          this.spawnSparks(tr.pos, 14);
          this.spawnSfxPopup('SNAP!', tr.pos, 1.3, true);
          this.audio.playTrapSnap(tr.pos);
          this.setHint('Armadilha disparada! O assassino ficou preso por alguns segundos!', 3.2);
          this.pushHud(true);
        }
      }

      // Animate hiding locker doors
      for (const lk of this.lockers) {
        if (lk.doorKick > 0) {
          lk.doorKick = Math.max(0, lk.doorKick - dt * 2.8);
          lk.rig.doorPivot.rotation.y = -Math.sin(lk.doorKick * Math.PI) * 1.15;
        } else {
          lk.rig.doorPivot.rotation.y = 0;
        }
      }

      this.damagePulse = Math.max(0, this.damagePulse - dt * 1.6);
      if (this.hintTimer > 0) {
        this.hintTimer = Math.max(0, this.hintTimer - dt);
        if (this.hintTimer === 0) this.hintText = '';
      }

      // Exit Key automatic pickup
      if (!this.hasKey) {
        this.keyMesh.rotation.y += dt * 1.8;
        const distKey = Math.hypot(this.playerPos.x - this.level.keySpawn.x, this.playerPos.z - this.level.keySpawn.z);
        if (distKey < 1.55) {
          this.hasKey = true;
          this.keyMesh.visible = false;
          this.keyVLight.intensity = 0;
          this.audio.playKeyPickup();
          if (!this.blackoutTriggered) {
            this.blackoutTriggered = true;
            this.blackoutTimer = 11.5;
            this.audio.playPowerBlackout();
            this.setHint('A energia caiu! Sobreviva à escuridão e religue o Disjuntor.', 4.6);
          } else {
            this.setHint(
              this.powerOn
                ? 'Chave da Saída coletada! Corra para a Porta de Saída.'
                : 'Chave da Saída coletada! Falta religar o Disjuntor.',
              4.2,
            );
          }
          this.pushHud(true);
        }
      }

      // Contextual interaction prompts
      let nextPrompt: string | null = null;
      if (this.activeLocker) {
        nextPrompt = 'Sair do Armário';
      } else {
        const distBreaker = Math.hypot(
          this.playerPos.x - this.level.breakerPanelPos.interactX,
          this.playerPos.z - this.level.breakerPanelPos.interactZ,
        );
        if (distBreaker < 2.2 && !this.powerOn) {
          nextPrompt = 'Religar Disjuntor';
        }

        if (!nextPrompt) {
          for (const al of this.alarms) {
            if (al.state === 'idle' && Math.hypot(this.playerPos.x - al.pos.x, this.playerPos.z - al.pos.z) < 2.0) {
              nextPrompt = 'Armar Despertador';
              break;
            }
          }
        }

        if (!nextPrompt) {
          let bestBar: BarricadeEntry | null = null;
          let bestBarDist = 2.15;
          for (const bar of this.barricades) {
            if (bar.state !== 'upright') continue;
            const dist = Math.hypot(this.playerPos.x - bar.pos.x, this.playerPos.z - bar.pos.z);
            if (dist < bestBarDist) {
              bestBarDist = dist;
              bestBar = bar;
            }
          }

          let bestDoor: DoorEntry | null = null;
          let bestDoorDist = 2.25;
          for (const d of this.doors) {
            const dist = Math.hypot(this.playerPos.x - d.pos.x, this.playerPos.z - d.pos.z);
            if (dist < bestDoorDist) {
              bestDoorDist = dist;
              bestDoor = d;
            }
          }

          let bestLocker: LockerEntry | null = null;
          let bestLockerDist = 1.95;
          for (const lk of this.lockers) {
            const d = Math.hypot(this.playerPos.x - lk.pos.x, this.playerPos.z - lk.pos.z);
            if (d < bestLockerDist) {
              bestLockerDist = d;
              bestLocker = lk;
            }
          }

          if (bestBar && (!bestDoor || bestBarDist < bestDoorDist) && (!bestLocker || bestBarDist < bestLockerDist)) {
            nextPrompt = 'Derrubar Obstáculo';
          } else if (bestDoor && (!bestLocker || bestDoorDist <= bestLockerDist)) {
            nextPrompt = bestDoor.locked
              ? `Destrancar e Abrir ${bestDoor.label}`
              : `${bestDoor.open ? 'Fechar' : 'Abrir'} ${bestDoor.label}`;
          } else if (bestLocker) {
            nextPrompt = 'Esconder no Armário';
          }
        }

        if (!nextPrompt) {
          const distExit = Math.hypot(
            this.playerPos.x - this.exitWorldPos.x,
            this.playerPos.z - this.exitWorldPos.z,
          );
          if (distExit < 2.3 && (!this.hasKey || !this.powerOn)) {
            nextPrompt = !this.hasKey && !this.powerOn
              ? 'Trancada (Chave + Disjuntor)'
              : !this.hasKey
              ? 'Trancada (Falta Chave)'
              : 'Sem Energia (Falta Disjuntor)';
          }
        }
      }

      if (nextPrompt !== this.interactPrompt) {
        this.interactPrompt = nextPrompt;
        this.pushHud(true);
      }

      // Dynamic Scripted Horror Events
      this.updateHorrorEvents(dt);

      // Pickups check (Battery + Medkit + Glass Bottles + Floor Traps)
      for (const pk of this.pickups) {
        if (pk.collected) continue;
        pk.group.rotation.y += dt * 1.4;
        const d = Math.hypot(this.playerPos.x - pk.pos.x, this.playerPos.z - pk.pos.z);
        if (d < 1.15) {
          if (pk.kind === 'bottle' && this.bottles >= SanatoriumEngine.MAX_BOTTLES) continue;
          if (pk.kind === 'trap' && this.traps >= SanatoriumEngine.MAX_TRAPS) continue;

          pk.collected = true;
          pk.group.visible = false;
          this.audio.playPickup();
          if (pk.kind === 'battery') {
            this.battery = Math.min(100, this.battery + 45);
            this.flashCharges = Math.min(SanatoriumEngine.MAX_FLASH_CHARGES, this.flashCharges + 1);
            this.setHint('+45% Bateria e +1 carga de Flash Estroboscópico!', 2.5);
          } else if (pk.kind === 'medkit') {
            this.hp = Math.min(100, this.hp + 40);
            this.setHint('+40 Saúde restaurada', 2.2);
          } else if (pk.kind === 'bottle') {
            this.bottles++;
            this.setHint('Frasco de vidro coletado — [G] ou Botão Dir. para arremessar.', 2.8);
          } else {
            this.traps++;
            this.setHint('Armadilha coletada — [X] para armar no chão.', 2.8);
          }
          this.pushHud(true);
        }
      }

      // Update Intelligent Killer AI
      this.updateCreature(dt);

      // Escape check (requires Key + Power)
      if (this.hasKey && this.powerOn) {
        const distExit = Math.hypot(
          this.playerPos.x - this.exitWorldPos.x,
          this.playerPos.z - this.exitWorldPos.z,
        );
        if (distExit < 1.55) {
          this.phase = 'escaped';
          this.interactPrompt = null;
          this.clearKeys();
          document.exitPointerLock?.();
          this.pushHud(true);
        }
      }
    } else if (this.phase === 'dead' || this.phase === 'escaped') {
      // Keep killer & survivor post-strike animations settling smoothly instead of freezing
      this.updateKillerAnimation(dt, 0);
      this.updatePlayerAnimation(dt, 0, false);
    }

    // Smooth Breaker Lever animation
    const targetLever = this.powerOn ? 1 : 0;
    if (Math.abs(this.leverProgress - targetLever) > 0.002) {
      this.leverProgress = THREE.MathUtils.damp(this.leverProgress, targetLever, 12, dt);
      this.breakerRig.leverPivot.rotation.x = THREE.MathUtils.lerp(0.65, -0.65, this.leverProgress);
    }

    // Smooth Eye/Shoulder Height + Door Peek lean
    const thirdPersonActive = this.isThirdPersonViewActive();
    const targetEye = this.crouching && !this.activeLocker ? (thirdPersonActive ? 1.02 : 1.04) : (thirdPersonActive ? 1.46 : 1.62);
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 12, dt);
    const peekLean = this.peekingDoor ? 0.14 : 0;

    // Update playable 3rd-person survivor position, over-the-shoulder orientation & animations
    this.playerRig.group.visible = thirdPersonActive;
    if (thirdPersonActive) {
      let desiredBodyYaw = this.yaw;
      if (isSprinting && moveSpeed > 0.55) {
        desiredBodyYaw = Math.atan2(-this.velX, -this.velZ);
      }
      let yawDelta = desiredBodyYaw - this.playerBodyYaw;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      this.playerBodyYaw += yawDelta * (1 - Math.exp(-(isSprinting ? 11 : 15) * dt));

      this.playerRig.group.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.playerRig.group.rotation.y = this.playerBodyYaw;
      this.playerRig.flashlightLensMat.emissiveIntensity = this.flashlightOn ? 2.2 : 0.04;
      if (this.phase === 'playing' || this.phase === 'title') {
        this.updatePlayerAnimation(dt, moveSpeed, isSprinting);
      }
    }

    // Camera position: Resident Evil over-the-shoulder 3rd person OR 1st person
    const bobScale = this.crouching ? 0.45 : 1.0;
    const bobY = moveSpeed > 0.1 ? Math.sin(this.walkPhase) * (isSprinting ? 0.048 : 0.028 * bobScale) : Math.sin(this.clockElapsed * 1.5) * 0.008;
    const bobX = moveSpeed > 0.1 ? Math.cos(this.walkPhase * 0.5) * 0.02 * bobScale : 0;
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    if (thirdPersonActive) {
      // Camera right vector = (cosY, 0, -sinY); back vector along pitch = (sinY*cosP, -sinP, cosY*cosP)
      const cosP = Math.cos(this.pitch);
      const sinP = Math.sin(this.pitch);
      const rightX = cosY;
      const rightZ = -sinY;
      const backX = sinY * cosP;
      const backY = -sinP;
      const backZ = cosY * cosP;

      const isPortrait = this.camera.aspect < 0.85;
      const targetRightOffset = isPortrait ? 0.2 : 0.36;

      // Clamp right-shoulder offset safely against adjacent walls & closed doors
      let safeRight = targetRightOffset;
      for (let rStep = targetRightOffset; rStep >= 0.04; rStep -= 0.08) {
        if (!isWallAtWorld(this.playerPos.x + rightX * rStep, this.playerPos.z + rightZ * rStep, 0.2, this.closedDoorBoxes, this.level.rows)) {
          safeRight = rStep;
          break;
        }
        safeRight = 0;
      }
      this.camRightSmooth = THREE.MathUtils.damp(this.camRightSmooth, safeRight, 18, dt);

      const pivotX = this.playerPos.x + rightX * this.camRightSmooth + bobX * 0.4;
      const pivotY = this.eyeHeight + bobY * 0.5;
      const pivotZ = this.playerPos.z + rightZ * this.camRightSmooth;

      const portraitExtraDist = isPortrait ? 0.42 : 0;
      const desiredDist = (this.phase === 'dead'
        ? 1.95
        : this.crouching
        ? 1.24
        : isSprinting
        ? 1.66
        : (this.flashlightOn || this.cameraOn)
        ? 1.32
        : 1.48) + portraitExtraDist;

      // Ray-march 14 steps from shoulder pivot to desired camera pos to prevent wall/ceiling clipping
      let maxClearDist = desiredDist;
      const samples = 14;
      for (let i = 1; i <= samples; i++) {
        const d = (i / samples) * desiredDist;
        const cx = pivotX + backX * d;
        const cy = pivotY + backY * d;
        const cz = pivotZ + backZ * d;
        if (
          cy < 0.28 ||
          cy > WALL_HEIGHT - 0.2 ||
          isWallAtWorld(cx, cz, 0.22, this.closedDoorBoxes, this.level.rows)
        ) {
          maxClearDist = Math.max(0.22, ((i - 1) / samples) * desiredDist - 0.08);
          break;
        }
      }

      const distDamp = maxClearDist < this.camDistSmooth ? 28 : 9;
      this.camDistSmooth = THREE.MathUtils.damp(this.camDistSmooth, maxClearDist, distDamp, dt);

      const dutchTilt =
        Math.sin(this.clockElapsed * 1.35) * 0.032 * this.threatLevel +
        (this.activeLocker ? (this.lockerPanic / 100) * 0.045 : 0);

      this.camera.position.set(
        pivotX + backX * this.camDistSmooth,
        THREE.MathUtils.clamp(pivotY + backY * this.camDistSmooth, 0.28, WALL_HEIGHT - 0.18),
        pivotZ + backZ * this.camDistSmooth,
      );
      this.camera.rotation.set(
        this.pitch,
        this.yaw,
        (moveSpeed > 0.1 ? Math.cos(this.walkPhase * 0.5) * 0.005 : 0) + dutchTilt,
      );
    } else {
      const dutchTilt =
        Math.sin(this.clockElapsed * 1.35) * 0.032 * this.threatLevel +
        (this.activeLocker ? (this.lockerPanic / 100) * 0.045 : 0);

      this.camera.position.set(
        this.playerPos.x + bobX - sinY * peekLean,
        this.eyeHeight + bobY,
        this.playerPos.z - cosY * peekLean,
      );
      this.camera.rotation.set(
        this.pitch,
        this.yaw,
        (moveSpeed > 0.1 ? Math.cos(this.walkPhase * 0.5) * 0.01 : 0) + dutchTilt,
      );
    }

    const portraitFovBoost = this.camera.aspect < 0.85 ? 8 : 0;
    const targetFov = thirdPersonActive
      ? (isSprinting ? 65 : this.cameraOn ? 63 : 60) + portraitFovBoost
      : (isSprinting ? 72 : this.peekingDoor ? 60 : this.cameraOn ? 71 : 68);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    // Dynamic Player-Reactive Flashlight & Environmental Lighting
    this.updateDynamicLighting(dt, moveSpeed, isSprinting);

    // Update spark particles
    for (const s of this.sparks) {
      if (s.life > 0) {
        s.life -= dt;
        s.vel.y -= 9.2 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    // Decay active Manga SFX Popups
    let hasActivePopups = false;
    for (let i = 0; i < this.sfxPopupPool.length; i++) {
      const sp = this.sfxPopupPool[i];
      if (sp.life > 0) {
        sp.life = Math.max(0, sp.life - dt);
        sp.worldPos.y += dt * 0.35;
        if (sp.life > 0) hasActivePopups = true;
      }
    }

    // Subtle organic drift on corridor dust motes & low-lying creeping floor mist
    if (this.dustPoints) {
      this.dustPoints.position.y = Math.sin(this.clockElapsed * 0.55) * 0.08;
      this.dustPoints.position.x = Math.cos(this.clockElapsed * 0.35) * 0.05;
    }
    if (this.mistPoints) {
      this.mistPoints.position.x = Math.sin(this.clockElapsed * 0.22) * 0.35;
      this.mistPoints.position.z = Math.cos(this.clockElapsed * 0.18) * 0.35;
      this.mistPoints.position.y = Math.sin(this.clockElapsed * 0.48) * 0.04;
    }

    // Update dither shader uniforms & reactive palette
    if (this.ditherPass) {
      this.ditherPass.uniforms.uDamagePulse.value = this.damagePulse;
      this.ditherPass.uniforms.uMuzzleBoost.value = this.flashInvert * 0.85;
      this.ditherPass.uniforms.uSonarWave.value = this.sonarWave;
      this.ditherPass.uniforms.uSonarPulse.value = this.sonarThreatPulse;
      this.ditherPass.uniforms.uSonarProximity.value = this.cameraOn ? this.sonarProximity : 0;
      this.ditherPass.uniforms.uFlashInvert.value = this.flashInvert;
      this.ditherPass.uniforms.uThreat.value = this.threatLevel;
      this.ditherPass.uniforms.uTime.value = this.clockElapsed;
      this.syncPaletteUniforms();
    }

    // Sync 3D Spatial Audio Listener & Sources
    this.audio.updateListenerAndSpatial(
      this.camera,
      this.creaturePos,
      true,
      this.creatureBrain === 'chase',
      this.creatureSpeed > 0.15 && this.phase === 'playing',
      this.lampIntensities,
      this.hp,
      this.clockElapsed,
    );

    const hudInterval = hasActivePopups || (this.cameraOn && this.sonarThreatPulse > 0.02) ? 0.055 : 0.1;
    if (this.clockElapsed - this.lastHudPush > hudInterval) {
      this.camera.updateMatrixWorld();
      this.pushHud(false);
    }
  }

  private updateDynamicLighting(dt: number, moveSpeed: number, isSprinting: boolean): void {
    const creatureDist = this.playerPos.distanceTo(this.creaturePos);
    const proxThreat = THREE.MathUtils.clamp(1 - creatureDist / 10.5, 0, 1);
    const chaseThreat = this.creatureBrain === 'chase' ? 0.42 : 0;
    const panicThreat = this.activeLocker ? (this.lockerPanic / 100) * 0.5 : 0;
    const blackoutThreat = this.blackoutTimer > 0 ? 0.28 : 0;
    const targetThreat = THREE.MathUtils.clamp(
      Math.max(proxThreat, chaseThreat + proxThreat * 0.45, panicThreat, blackoutThreat),
      0,
      1,
    );
    this.threatLevel = THREE.MathUtils.damp(this.threatLevel, targetThreat, 5.5, dt);

    if (this.blackoutTimer > 0) {
      this.blackoutTimer = Math.max(0, this.blackoutTimer - dt);
    }

    // Dynamic suffocating fog density (thickens during blackouts & when hunted)
    if (this.fogExp) {
      const targetFog = 0.145 + this.threatLevel * 0.04 + (this.blackoutTimer > 0 ? 0.035 : 0) - (this.cameraOn ? 0.025 : 0);
      this.fogExp.density = THREE.MathUtils.damp(this.fogExp.density, targetFog, 4.0, dt);
    }

    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    _targetPos.copy(this.camera.position).addScaledVector(_v1, 12.0);
    const tremor = this.threatLevel > 0.3 ? (this.threatLevel - 0.3) * 0.09 : 0;
    _targetPos.y +=
      Math.sin(this.walkPhase) * (moveSpeed > 0.1 ? 0.14 : 0.02) +
      Math.sin(this.clockElapsed * 23.0) * tremor;
    _targetPos.x +=
      Math.cos(this.walkPhase * 0.5) * (moveSpeed > 0.1 ? 0.12 : 0.01) +
      Math.cos(this.clockElapsed * 19.0) * tremor;

    if (this.isThirdPersonViewActive()) {
      const sinB = Math.sin(this.yaw);
      const cosB = Math.cos(this.yaw);
      this.flashlight.position.set(
        this.playerPos.x - sinB * 0.44 + cosB * 0.14,
        this.crouching ? 0.88 : 1.38,
        this.playerPos.z - cosB * 0.44 - sinB * 0.14,
      );
      this.irFloodLight.position.set(
        this.playerPos.x - sinB * 0.35,
        this.crouching ? 0.96 : 1.48,
        this.playerPos.z - cosB * 0.35,
      );
    } else {
      this.flashlight.position.copy(this.camera.position).addScaledVector(_v1, 0.25);
      this.flashlight.position.y -= 0.12;
      this.irFloodLight.position.copy(this.camera.position).addScaledVector(_v1, 0.15);
    }
    this.flashlightTarget.position.lerp(_targetPos, 1 - Math.exp(-16 * dt));

    // Align subtle volumetric flashlight beam cone with actual spotlight target
    this.flashlightBeamCone.visible = this.flashlightOn && !this.activeLocker;
    if (this.flashlightBeamCone.visible) {
      this.flashlightBeamCone.position.copy(this.flashlight.position);
      this.flashlightBeamCone.lookAt(this.flashlightTarget.position);
      // lookAt orients +Z toward target; cone geometry extends along -Z so flip Y by PI
      this.flashlightBeamCone.rotateY(Math.PI);
    }

    // Visual proximity interference when killer is near (replaces audio cue!)
    let flicker = 1.0;
    const anyGearActive = this.flashlightOn || this.cameraOn;
    if (anyGearActive) {
      if (creatureDist < 7.5) {
        const threat = 1 - creatureDist / 7.5;
        const pulse = Math.sin(this.clockElapsed * 29.0) * Math.sin(this.clockElapsed * 47.0);
        if (pulse > 0.5 - threat * 0.42) {
          flicker = 0.16 + Math.random() * 0.44;
        }
      } else if (isSprinting) {
        flicker = 0.88 + Math.sin(this.walkPhase * 2.0) * 0.12;
      } else if (this.battery <= 25) {
        const lowPulse = Math.sin(this.clockElapsed * 19.0) * Math.sin(this.clockElapsed * 31.0);
        if (lowPulse > 0.62) flicker = 0.35 + Math.random() * 0.38;
      }
      const drainRate = (this.flashlightOn ? 0.45 : 0) + (this.cameraOn ? 0.3 : 0);
      this.battery = Math.max(8, this.battery - dt * drainRate);
    } else {
      this.battery = Math.min(100, this.battery + dt * 1.4);
    }

    if (this.flashlightBeamCone.visible) {
      const coneMat = this.flashlightBeamCone.material as THREE.MeshBasicMaterial;
      coneMat.opacity = 0.085 * flicker * Math.min(1.3, this.settings.lightBoost);
    }

    const boost = this.settings.lightBoost;
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, 0.014 * boost, 4.5, dt);
    this.dirKeyLight.intensity = THREE.MathUtils.damp(this.dirKeyLight.intensity, 0.004 * boost, 4.5, dt);
    this.scene.environmentIntensity = THREE.MathUtils.damp(this.scene.environmentIntensity, 0.014, 4.5, dt);

    const flashTarget = this.flashlightOn ? 22.0 * flicker * boost : 0.0;
    this.flashlight.intensity = THREE.MathUtils.damp(this.flashlight.intensity, flashTarget, 22, dt);

    const irTarget = this.cameraOn ? 14.2 * flicker * boost : 0.0;
    this.irFloodLight.intensity = THREE.MathUtils.damp(this.irFloodLight.intensity, irTarget, 22, dt);

    if (this.isThirdPersonViewActive()) {
      // Place subtle bounce/rim light slightly behind & beside the survivor so their silhouette and jacket stay legible
      const sinB = Math.sin(this.yaw);
      const cosB = Math.cos(this.yaw);
      this.flashlightBounce.position.set(
        this.playerPos.x + sinB * 0.52 + cosB * 0.18,
        this.crouching ? 1.15 : 1.62,
        this.playerPos.z + cosB * 0.52 - sinB * 0.18,
      );
      this.flashlightBounce.intensity = this.flashlightOn
        ? 1.15 * flicker * boost
        : this.cameraOn
        ? 1.3 * flicker * boost
        : 0.36 * boost;
    } else {
      this.flashlightBounce.position.copy(this.camera.position);
      this.flashlightBounce.intensity = this.flashlightOn
        ? 0.48 * flicker * boost
        : this.cameraOn
        ? 0.72 * flicker * boost
        : 0.04 * boost;
    }

    // Broken-ballast flickering corridor ceiling lamps (dramatic chiaroscuro & killer/blackout dropouts)
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      if (this.blackoutTimer > 0) {
        lamp.currentIntensity = 0;
        lamp.vLight.intensity = 0;
        lamp.bulbMat.emissiveIntensity = 0.02;
        this.lampIntensities[i] = 0;
        continue;
      }
      if (lamp.bursted && lamp.burstTimer > 0) {
        lamp.burstTimer = Math.max(0, lamp.burstTimer - dt);
        lamp.currentIntensity = 0.02;
        lamp.vLight.intensity = 0;
        lamp.bulbMat.emissiveIntensity = 0.03;
        this.lampIntensities[i] = 0;
        continue;
      }

      const dSq = this.playerPos.distanceToSquared(lamp.pos);
      if (dSq > 324) {
        lamp.vLight.intensity = 0;
        this.lampIntensities[i] = 0;
        continue;
      }

      const t = this.clockElapsed + lamp.seed;
      const wave = Math.sin(t * 2.3) * Math.sin(t * 7.7) * Math.sin(t * 17.3);
      const deepDrop = Math.sin(t * 0.61) * Math.sin(t * 1.93) > 0.78;
      const buzzDrop = deepDrop ? 0.03 : wave > 0.46 ? 0.12 : 0.76 + Math.sin(t * 3.1) * 0.22;
      const mobProx = Math.max(0, 1 - lamp.pos.distanceTo(this.creaturePos) / 8.5);
      const killerStrobe = mobProx > 0.25 && Math.sin(t * 34.0) > 0.2 ? 0.08 : 1.0;
      const postBurstCap = lamp.bursted ? 0.28 : 1.0;
      const finalRatio = THREE.MathUtils.clamp(
        buzzDrop * (1 - mobProx * 0.7) * killerStrobe * postBurstCap,
        0.02,
        1.05,
      );
      lamp.currentIntensity = lamp.baseIntensity * finalRatio * boost;
      lamp.vLight.intensity = lamp.currentIntensity;
      lamp.bulbMat.emissiveIntensity = 1.85 * finalRatio;
      this.lampIntensities[i] = finalRatio;
    }

    // Crimson Emergency Wall Sconces pulse slowly (and surge brighter during power blackout!)
    for (let i = 0; i < this.emergencyLights.length; i++) {
      const em = this.emergencyLights[i];
      const dSq = this.playerPos.distanceToSquared(em.vLight.pos);
      if (dSq > 324) {
        em.vLight.intensity = 0;
        continue;
      }
      const pulse = 0.62 + 0.38 * Math.sin(this.clockElapsed * 2.4 + em.phase);
      const blackoutBoost = this.blackoutTimer > 0 ? 1.45 : 1.0;
      em.vLight.intensity = 1.15 * pulse * blackoutBoost * boost;
      em.rig.lensMat.emissiveIntensity = 1.65 * pulse * blackoutBoost;
    }

    for (let i = 0; i < this.moonSpills.length; i++) {
      const ms = this.moonSpills[i];
      ms.intensity = this.playerPos.distanceToSquared(ms.pos) < 324 ? 0.65 * boost : 0;
    }

    this.exitVLight.color = this.hasKey && this.powerOn ? 0x6bff8b : 0xff3b30;
    this.exitVLight.intensity =
      this.playerPos.distanceToSquared(this.exitVLight.pos) < 324
        ? (this.hasKey && this.powerOn ? 2.6 : 1.3 + Math.sin(this.clockElapsed * 3.4) * 0.55) * boost
        : 0;
    this.keyVLight.intensity = !this.hasKey ? 1.15 * boost : 0;
    this.breakerVLight.color = this.powerOn ? 0x5eff82 : 0xff3b30;
    this.breakerVLight.intensity = (this.powerOn ? 1.55 : 1.0 + Math.sin(this.clockElapsed * 4.2) * 0.4) * boost;

    // Allocate the 8 highest-contribution virtual lights to fixed PointLight pool (zero allocations)
    for (let s = 0; s < SanatoriumEngine.POINT_LIGHT_POOL_SIZE; s++) {
      this._topScores[s] = 0;
      this._topLights[s] = null;
    }
    for (let i = 0; i < this.virtualLights.length; i++) {
      const vl = this.virtualLights[i];
      if (vl.intensity <= 0.02) continue;
      const dSq = this.playerPos.distanceToSquared(vl.pos);
      const maxR = vl.distance + 8.0;
      if (dSq > maxR * maxR) continue;
      const score = vl.intensity / (1 + dSq * 0.18);
      if (score <= this._topScores[SanatoriumEngine.POINT_LIGHT_POOL_SIZE - 1]) continue;

      let posIdx = SanatoriumEngine.POINT_LIGHT_POOL_SIZE - 1;
      while (posIdx > 0 && score > this._topScores[posIdx - 1]) {
        this._topScores[posIdx] = this._topScores[posIdx - 1];
        this._topLights[posIdx] = this._topLights[posIdx - 1];
        posIdx--;
      }
      this._topScores[posIdx] = score;
      this._topLights[posIdx] = vl;
    }
    for (let s = 0; s < SanatoriumEngine.POINT_LIGHT_POOL_SIZE; s++) {
      const phys = this.pointLightPool[s];
      const vl = this._topLights[s];
      if (vl) {
        phys.position.copy(vl.pos);
        phys.color.setHex(vl.color);
        phys.distance = vl.distance;
        phys.decay = vl.decay;
        phys.intensity = vl.intensity;
      } else {
        phys.intensity = 0;
      }
    }
  }

  private updateHorrorEvents(dt: number): void {
    const burstTargets = [1, 3];
    for (let idx = 0; idx < burstTargets.length; idx++) {
      if (this.lampBurstTriggered[idx]) continue;
      const lamp = this.lamps[burstTargets[idx]];
      if (!lamp) continue;
      const d = Math.hypot(this.playerPos.x - lamp.pos.x, this.playerPos.z - lamp.pos.z);
      if (d < 4.2) {
        this.lampBurstTriggered[idx] = true;
        lamp.bursted = true;
        lamp.burstTimer = 6.5;
        this.spawnSparks(lamp.pos, 14);
        this.spawnSfxPopup('ZAP!', lamp.pos, 1.0, true);
        this.audio.playLampBurst(lamp.pos);
      }
    }

    if (!this.doorSlamTriggered[0] && this.playerPos.x > 5.0 * CELL_SIZE) {
      this.doorSlamTriggered[0] = true;
      _v1.set(12 * CELL_SIZE, 1.5, 5.5 * CELL_SIZE);
      this.audio.playDoorSlam(_v1);
      this.spawnSfxPopup('BOOM!', _v1, 1.15, true);
    }
    if (!this.doorSlamTriggered[1] && this.playerPos.z > 9.0 * CELL_SIZE) {
      this.doorSlamTriggered[1] = true;
      _v1.set(8.5 * CELL_SIZE, 1.5, 11.5 * CELL_SIZE);
      this.audio.playDoorSlam(_v1);
      this.spawnSfxPopup('BOOM!', _v1, 1.15, true);
    }

    if (
      !this.corridorShadowTriggered &&
      Math.hypot(
        this.playerPos.x - this.corridorSilhouetteBasePos.x,
        this.playerPos.z - this.corridorSilhouetteBasePos.z,
      ) < 4.8
    ) {
      this.corridorShadowTriggered = true;
      this.corridorSilhouette.visible = true;
      this.corridorSilhouetteTimer = 0.9;
      this.audio.playWindowTap(this.corridorSilhouette.position);
    }
    if (this.corridorSilhouetteTimer > 0) {
      this.corridorSilhouetteTimer = Math.max(0, this.corridorSilhouetteTimer - dt);
      this.corridorSilhouette.position.x += dt * 1.45;
      if (this.corridorSilhouetteTimer === 0) {
        this.corridorSilhouette.visible = false;
      }
    }
  }

  private triggerKillerAttackAnim(): void {
    const actions = this.creatureRig.actions;
    if (!this.creatureRig.loaded || !actions) return;
    const action = actions.attack;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.08);
    action.play();
    this.creatureRig.activeOneShot = 'attack';
  }

  private triggerKillerHitAnim(): void {
    const actions = this.creatureRig.actions;
    if (!this.creatureRig.loaded || !actions) return;
    const action = actions.hit;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.06);
    action.play();
    this.creatureRig.activeOneShot = 'hit';
  }

  private updateKillerAnimation(dt: number, speed: number): void {
    const { mixer, actions, loaded } = this.creatureRig;
    if (!loaded || !mixer || !actions) return;

    let targetIdle = 0;
    let targetWalk = 0;
    let targetRun = 0;

    if (speed <= 0.1) {
      targetIdle = 1;
    } else if (speed < 1.75) {
      const t = (speed - 0.1) / (1.75 - 0.1);
      targetIdle = 1 - t;
      targetWalk = t;
    } else {
      const t = Math.min(1, (speed - 1.75) / 0.65);
      targetWalk = 1 - t;
      targetRun = t;
    }

    const dampFactor = 10;
    this.killerWeightIdle = THREE.MathUtils.damp(this.killerWeightIdle, targetIdle, dampFactor, dt);
    this.killerWeightWalk = THREE.MathUtils.damp(this.killerWeightWalk, targetWalk, dampFactor, dt);
    this.killerWeightRun = THREE.MathUtils.damp(this.killerWeightRun, targetRun, dampFactor, dt);

    this.killerLocoScale = THREE.MathUtils.damp(
      this.killerLocoScale,
      this.creatureRig.activeOneShot ? 0.15 : 1.0,
      14,
      dt,
    );
    actions.idle.setEffectiveWeight(this.killerWeightIdle * this.killerLocoScale);
    actions.walk.setEffectiveWeight(this.killerWeightWalk * this.killerLocoScale);
    actions.run.setEffectiveWeight(this.killerWeightRun * this.killerLocoScale);

    actions.walk.setEffectiveTimeScale(Math.max(0.85, speed / 1.18));
    actions.run.setEffectiveTimeScale(Math.max(0.85, speed / 2.32));

    mixer.update(dt);
  }

  private isThirdPersonViewActive(): boolean {
    return this.settings.thirdPerson && !this.activeLocker && !this.peekingDoor;
  }

  private triggerPlayerHitAnim(): void {
    const actions = this.playerRig.actions;
    if (!this.playerRig.loaded || !actions || this.playerRig.deathPlayed) return;
    const action = actions.hit;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.06);
    action.play();
    this.playerRig.activeOneShot = 'hit';
  }

  private triggerPlayerDeathAnim(): void {
    const actions = this.playerRig.actions;
    if (!this.playerRig.loaded || !actions || this.playerRig.deathPlayed) return;
    this.playerRig.deathPlayed = true;
    this.playerRig.activeOneShot = 'death';
    actions.hit.stop();
    const action = actions.death;
    action.reset();
    action.setEffectiveWeight(1);
    action.fadeIn(0.1);
    action.play();
  }

  private updatePlayerAnimation(dt: number, speed: number, isSprinting: boolean): void {
    const { mixer, actions, loaded } = this.playerRig;
    if (!loaded || !mixer || !actions) return;

    let targetIdle = 0;
    let targetWalk = 0;
    let targetRun = 0;
    let targetCrouch = 0;
    let targetPistol = 0;
    let targetPistolBack = 0;

    let crouchScale = 1.0;
    let pistolScale = 1.0;
    let pistolBackScale = 1.0;
    let walkScale = 1.0;
    let runScale = 1.0;

    if (this.crouching) {
      targetCrouch = 1;
      crouchScale = speed > 0.12 ? Math.max(0.95, speed / 0.75) : 0.12;
    } else if (isSprinting && speed > 1.72) {
      targetRun = 1;
      runScale = Math.max(0.9, speed / 2.45);
    } else if (speed > 0.08) {
      const fwdX = -Math.sin(this.yaw);
      const fwdZ = -Math.cos(this.yaw);
      const fwdDot = (this.velX * fwdX + this.velZ * fwdZ) / speed;
      if (fwdDot < -0.22) {
        targetPistolBack = 1;
        pistolBackScale = Math.max(0.85, speed / 1.35);
      } else if (this.flashlightOn || this.cameraOn || Math.abs(fwdDot) < 0.88) {
        targetPistol = 1;
        pistolScale = Math.max(0.85, speed / 1.4);
      } else {
        targetWalk = 1;
        walkScale = Math.max(0.85, speed / 1.4);
      }
    } else {
      targetIdle = 1;
    }

    const dampFactor = 11;
    this.playerWeightIdle = THREE.MathUtils.damp(this.playerWeightIdle, targetIdle, dampFactor, dt);
    this.playerWeightWalk = THREE.MathUtils.damp(this.playerWeightWalk, targetWalk, dampFactor, dt);
    this.playerWeightRun = THREE.MathUtils.damp(this.playerWeightRun, targetRun, dampFactor, dt);
    this.playerWeightCrouch = THREE.MathUtils.damp(this.playerWeightCrouch, targetCrouch, dampFactor, dt);
    this.playerWeightPistol = THREE.MathUtils.damp(this.playerWeightPistol, targetPistol, dampFactor, dt);
    this.playerWeightPistolBack = THREE.MathUtils.damp(this.playerWeightPistolBack, targetPistolBack, dampFactor, dt);

    const oneShotSuppress = this.playerRig.activeOneShot === 'death' ? 0 : this.playerRig.activeOneShot ? 0.2 : 1.0;
    this.playerLocoScale = THREE.MathUtils.damp(this.playerLocoScale, oneShotSuppress, 14, dt);

    actions.idle.setEffectiveWeight(this.playerWeightIdle * this.playerLocoScale);
    actions.walk.setEffectiveWeight(this.playerWeightWalk * this.playerLocoScale);
    actions.run.setEffectiveWeight(this.playerWeightRun * this.playerLocoScale);
    actions.crouchWalk.setEffectiveWeight(this.playerWeightCrouch * this.playerLocoScale);
    actions.pistolWalk.setEffectiveWeight(this.playerWeightPistol * this.playerLocoScale);
    actions.pistolWalkBack.setEffectiveWeight(this.playerWeightPistolBack * this.playerLocoScale);

    actions.walk.setEffectiveTimeScale(walkScale);
    actions.run.setEffectiveTimeScale(runScale);
    actions.crouchWalk.setEffectiveTimeScale(crouchScale);
    actions.pistolWalk.setEffectiveTimeScale(pistolScale);
    actions.pistolWalkBack.setEffectiveTimeScale(pistolBackScale);

    mixer.update(dt);
  }

  // Zero-GC A* grid pathfinding across the Sanatorium grid
  private computeGridPath(startGx: number, startGz: number, goalGx: number, goalGz: number): boolean {
    if (isWallAtGrid(goalGx, goalGz, this.level.rows) || isWallAtGrid(startGx, startGz, this.level.rows)) {
      this._pathLen = 0;
      return false;
    }
    const startIdx = startGz * this.mapW + startGx;
    const goalIdx = goalGz * this.mapW + goalGx;
    if (startIdx === goalIdx) {
      this._pathCells[0] = goalIdx;
      this._pathLen = 1;
      this._pathCursor = 0;
      return true;
    }

    this._astarState.fill(0);
    this._astarG.fill(1e6);
    this._astarF.fill(1e6);
    this._astarParent.fill(-1);

    let openCount = 0;
    this._astarG[startIdx] = 0;
    this._astarF[startIdx] = Math.abs(goalGx - startGx) + Math.abs(goalGz - startGz);
    this._astarState[startIdx] = 1;
    this._astarOpen[openCount++] = startIdx;

    let found = false;
    while (openCount > 0) {
      let bestSlot = 0;
      let bestF = this._astarF[this._astarOpen[0]];
      for (let i = 1; i < openCount; i++) {
        const f = this._astarF[this._astarOpen[i]];
        if (f < bestF) {
          bestF = f;
          bestSlot = i;
        }
      }

      const curr = this._astarOpen[bestSlot];
      this._astarOpen[bestSlot] = this._astarOpen[--openCount];
      this._astarState[curr] = 2;

      if (curr === goalIdx) {
        found = true;
        break;
      }

      const cx = curr % this.mapW;
      const cz = (curr / this.mapW) | 0;

      for (let dir = 0; dir < 4; dir++) {
        const nx = dir === 0 ? cx + 1 : dir === 1 ? cx - 1 : cx;
        const nz = dir === 2 ? cz + 1 : dir === 3 ? cz - 1 : cz;
        if (isWallAtGrid(nx, nz, this.level.rows)) continue;
        const nIdx = nz * this.mapW + nx;
        if (this._astarState[nIdx] === 2) continue;

        const doorAtCell = this.doorGridLookup.get(nIdx);
        const barAtCell = this.barricadeGridLookup.get(nIdx);
        let stepCost = 1.0;
        if (doorAtCell && !doorAtCell.open) {
          stepCost += doorAtCell.locked ? 7.5 : 2.2;
        }
        if (barAtCell && barAtCell.state === 'tipped') {
          stepCost += 6.5;
        }
        const gScore = this._astarG[curr] + stepCost;

        if (gScore < this._astarG[nIdx]) {
          this._astarParent[nIdx] = curr;
          this._astarG[nIdx] = gScore;
          this._astarF[nIdx] = gScore + Math.abs(goalGx - nx) + Math.abs(goalGz - nz);
          if (this._astarState[nIdx] !== 1) {
            this._astarState[nIdx] = 1;
            this._astarOpen[openCount++] = nIdx;
          }
        }
      }
    }

    if (!found) {
      this._pathLen = 0;
      return false;
    }

    let count = 0;
    let trace = goalIdx;
    while (trace !== -1 && count < this.mapCells) {
      this._pathCells[count++] = trace;
      if (trace === startIdx) break;
      trace = this._astarParent[trace];
    }
    for (let i = 0; i < count >> 1; i++) {
      const tmp = this._pathCells[i];
      this._pathCells[i] = this._pathCells[count - 1 - i];
      this._pathCells[count - 1 - i] = tmp;
    }
    this._pathLen = count;
    this._pathCursor = count > 1 ? 1 : 0;
    return true;
  }

  private pickNextSearchWaypoint(): void {
    const waypoints = this.level.searchWaypoints;
    if (waypoints.length === 0) return;
    const pGx = Math.floor(this.playerPos.x / CELL_SIZE);
    const pGz = Math.floor(this.playerPos.z / CELL_SIZE);
    let bestIdx = 0;
    let bestScore = -1e9;

    for (let i = 0; i < waypoints.length; i++) {
      if (waypoints.length > 1 && i === this.currentWaypointIdx) continue;
      const wp = waypoints[i];
      const stale = this.clockElapsed - (this.waypointVisitedAt[i] ?? 0);
      const distFromPlayer = Math.hypot(wp.gx - pGx, wp.gz - pGz);
      const proximityBias = Math.max(0, 14 - distFromPlayer) * 1.65;
      const score = stale * 1.4 + proximityBias + Math.random() * 6.0;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    this.currentWaypointIdx = bestIdx;
    const chosen = waypoints[bestIdx];
    this.killerTargetPos.set((chosen.gx + 0.5) * CELL_SIZE, 0, (chosen.gz + 0.5) * CELL_SIZE);
    this.killerRepathTimer = 0;
  }

  private updateCreature(dt: number): void {
    this.creaturePos.y = 0;
    this.creatureAttackCooldown = Math.max(0, this.creatureAttackCooldown - dt);

    const dx = this.playerPos.x - this.creaturePos.x;
    const dz = this.playerPos.z - this.creaturePos.z;
    const dist = Math.hypot(dx, dz);

    const hasLos =
      dist < 15.0 &&
      hasLineOfSight(
        this.creaturePos.x,
        this.creaturePos.z,
        this.playerPos.x,
        this.playerPos.z,
        this.closedDoorBoxes,
        this.level.rows,
      );

    let inVisionCone = dist < (this.crouching ? 1.8 : 3.0);
    if (dist > 0.1) {
      const dirToPlayerX = dx / dist;
      const dirToPlayerZ = dz / dist;
      const facingX = Math.sin(this.creatureHeading);
      const facingZ = Math.cos(this.creatureHeading);
      const dot = dirToPlayerX * facingX + dirToPlayerZ * facingZ;
      if (dot > (this.flashlightOn ? -0.15 : 0.18)) {
        inVisionCone = true;
      }
    }

    let sightRange = this.flashlightOn ? 12.5 : this.cameraOn ? 8.2 : 6.0;
    if (this.crouching && !this.activeLocker) {
      sightRange *= this.flashlightOn ? 0.82 : 0.62;
    }

    const seesPlayer = this.activeLocker
      ? (this.sawPlayerHide || (this.flashlightOn && dist < 5.5 && hasLos))
      : hasLos && dist < sightRange && inVisionCone;

    if (seesPlayer && this.killerStunTimer <= 0) {
      this.creatureBrain = 'chase';
      this.creatureLostSightSec = 0;
      this.killerInspectTimer = 0;
      this.killerTargetPos.copy(this.playerPos);
      if (this.activeLocker) {
        this.huntedLocker = this.activeLocker;
      }
    } else if (this.creatureBrain === 'chase') {
      this.creatureLostSightSec += dt * (this.activeLocker && !this.flashlightOn ? 2.2 : 1.0);
      if (this.creatureLostSightSec > 2.0) {
        this.creatureBrain = 'investigate';
        this.killerInspectTimer = 2.8;
        this.creatureLostSightSec = 0;
      }
    }

    let speed = 0;
    let moveAngle = this.creatureHeading;

    if (this.killerStunTimer > 0) {
      // Trapped in improvised snare trap!
      this.killerStunTimer = Math.max(0, this.killerStunTimer - dt);
      speed = 0;
    } else if (this.killerDoorTarget && !this.killerDoorTarget.open) {
      this.killerDoorBashTimer -= dt;
      moveAngle = Math.atan2(
        this.killerDoorTarget.pos.x - this.creaturePos.x,
        this.killerDoorTarget.pos.z - this.creaturePos.z,
      );
      if (this.killerDoorTarget.locked && this.killerDoorBashTimer <= this.killerNextPoundAt && this.killerDoorBashTimer > 0.15) {
        this.killerNextPoundAt -= 1.05;
        this.killerDoorTarget.poundFlash = 1.0;
        this.triggerKillerAttackAnim();
        this.audio.playDoorPound(this.killerDoorTarget.pos);
        _v1.copy(this.killerDoorTarget.pos).setY(1.65);
        this.spawnSfxPopup('THUD!', _v1, 0.9, false);
      }
      if (this.killerDoorBashTimer <= 0) {
        this.triggerKillerAttackAnim();
        this.killerDoorTarget.locked = false;
        this.killerDoorTarget.open = true;
        this.syncClosedDoorBoxes();
        this.audio.playDoorSlam(this.killerDoorTarget.pos);
        _v1.copy(this.killerDoorTarget.pos).setY(1.65);
        this.spawnSfxPopup('BOOM!', _v1, 1.15, true);
        this.killerDoorTarget = null;
      }
    } else if (this.killerBarricadeTarget && this.killerBarricadeTarget.state === 'tipped') {
      this.killerBarricadeTimer -= dt;
      moveAngle = Math.atan2(
        this.killerBarricadeTarget.pos.x - this.creaturePos.x,
        this.killerBarricadeTarget.pos.z - this.creaturePos.z,
      );
      if (this.killerBarricadeTimer <= 0) {
        this.triggerKillerAttackAnim();
        this.killerBarricadeTarget.state = 'cleared';
        this.syncTippedBarricades();
        this.audio.playObstacleTip(this.killerBarricadeTarget.pos);
        this.killerBarricadeTarget = null;
      }
    } else if (this.killerPauseTimer > 0) {
      this.killerPauseTimer -= dt;
      moveAngle = this.creatureHeading + Math.sin(this.clockElapsed * 2.1) * 0.45 * dt * 4.0;
    } else {
      this.killerDoorTarget = null;
      this.killerBarricadeTarget = null;

      this.killerRepathTimer -= dt;
      const curGx = THREE.MathUtils.clamp(Math.floor(this.creaturePos.x / CELL_SIZE), 1, this.mapW - 2);
      const curGz = THREE.MathUtils.clamp(Math.floor(this.creaturePos.z / CELL_SIZE), 1, this.mapH - 2);
      const goalGx = THREE.MathUtils.clamp(Math.floor(this.killerTargetPos.x / CELL_SIZE), 1, this.mapW - 2);
      const goalGz = THREE.MathUtils.clamp(Math.floor(this.killerTargetPos.z / CELL_SIZE), 1, this.mapH - 2);

      if (this.killerRepathTimer <= 0 || this._pathCursor >= this._pathLen) {
        this.computeGridPath(curGx, curGz, goalGx, goalGz);
        this.killerRepathTimer = this.creatureBrain === 'chase' ? 0.35 : 0.9;
      }

      const distGoal = Math.hypot(
        this.killerTargetPos.x - this.creaturePos.x,
        this.killerTargetPos.z - this.creaturePos.z,
      );

      if (this.creatureBrain === 'search' && distGoal < 0.85) {
        this.waypointVisitedAt[this.currentWaypointIdx] = this.clockElapsed;
        this.killerPauseTimer = 0.65 + Math.random() * 0.75;
        this.pickNextSearchWaypoint();
      } else if (this.creatureBrain === 'investigate' && distGoal < 0.9) {
        if (this.killerInspectTimer > 0) {
          this.killerInspectTimer -= dt;
          moveAngle = this.creatureHeading + Math.sin(this.clockElapsed * 2.6) * 0.04;
        } else {
          this.creatureBrain = 'search';
          this.pickNextSearchWaypoint();
        }
      } else {
        let steerX = this.killerTargetPos.x;
        let steerZ = this.killerTargetPos.z;

        if (this.creatureBrain === 'chase' && hasLos && dist < 5.5 && !this.hitsTippedBarricade(this.creaturePos.x, this.creaturePos.z, 0.9)) {
          steerX = this.playerPos.x;
          steerZ = this.playerPos.z;
        } else if (this._pathCursor < this._pathLen) {
          const cellIdx = this._pathCells[this._pathCursor];
          const gx = cellIdx % this.mapW;
          const gz = (cellIdx / this.mapW) | 0;
          steerX = (gx + 0.5) * CELL_SIZE;
          steerZ = (gz + 0.5) * CELL_SIZE;

          // Thread the open 0.98m lane beside upright barricade carts so the killer never snags
          const uprightBar = this.barricadeGridLookup.get(cellIdx);
          if (uprightBar && uprightBar.state === 'upright') {
            if (uprightBar.axis === 'ns') steerX += 0.62;
            else steerZ += 0.62;
          }

          if (Math.hypot(steerX - this.creaturePos.x, steerZ - this.creaturePos.z) < 0.52) {
            this._pathCursor++;
          }
        }

        // Check for closed/locked room doors OR tipped barricade carts on next A* cell
        if (this._pathCursor < this._pathLen) {
          const nextCell = this._pathCells[this._pathCursor];
          const door = this.doorGridLookup.get(nextCell);
          if (door && !door.open && Math.hypot(door.pos.x - this.creaturePos.x, door.pos.z - this.creaturePos.z) < 1.35) {
            this.killerDoorTarget = door;
            if (door.locked) {
              this.killerDoorBashTimer = 3.6;
              this.killerNextPoundAt = 2.95;
            } else {
              this.killerDoorBashTimer = this.creatureBrain === 'chase' ? 0.85 : 0.55;
            }
            speed = 0;
          } else {
            const bar = this.barricadeGridLookup.get(nextCell);
            if (bar && bar.state === 'tipped' && Math.hypot(bar.pos.x - this.creaturePos.x, bar.pos.z - this.creaturePos.z) < 1.45) {
              this.killerBarricadeTarget = bar;
              this.killerBarricadeTimer = 3.2;
              this.triggerKillerAttackAnim();
              this.audio.playDoorPound(bar.pos);
              speed = 0;
            }
          }
        }

        if (!this.killerDoorTarget && !this.killerBarricadeTarget) {
          const sdx = steerX - this.creaturePos.x;
          const sdz = steerZ - this.creaturePos.z;
          const sDist = Math.hypot(sdx, sdz);
          if (sDist > 0.05) {
            moveAngle = Math.atan2(sdx, sdz);
            speed =
              this.creatureBrain === 'chase'
                ? 2.32
                : this.creatureBrain === 'investigate'
                ? 1.58
                : 1.18;

            const shouldStopForAttack =
              this.creatureBrain === 'chase' && dist < 1.05 && (!this.activeLocker || this.huntedLocker === this.activeLocker);

            if (!shouldStopForAttack) {
              const vx = Math.sin(moveAngle) * speed * dt;
              const vz = Math.cos(moveAngle) * speed * dt;
              const blockedX =
                isWallAtWorld(this.creaturePos.x + vx, this.creaturePos.z, 0.36, this.closedDoorBoxes, this.level.rows) ||
                this.hitsUprightBarricade(this.creaturePos.x + vx, this.creaturePos.z, 0.36) ||
                this.hitsTippedBarricade(this.creaturePos.x + vx, this.creaturePos.z, 0.36);
              if (!blockedX) {
                this.creaturePos.x += vx;
              }
              const blockedZ =
                isWallAtWorld(this.creaturePos.x, this.creaturePos.z + vz, 0.36, this.closedDoorBoxes, this.level.rows) ||
                this.hitsUprightBarricade(this.creaturePos.x, this.creaturePos.z + vz, 0.36) ||
                this.hitsTippedBarricade(this.creaturePos.x, this.creaturePos.z + vz, 0.36);
              if (!blockedZ) {
                this.creaturePos.z += vz;
              }

              // Direct chase fallback: engage closed doors or tipped barricades blocking the path
              if ((blockedX || blockedZ) && !this.killerDoorTarget && !this.killerBarricadeTarget) {
                for (const d of this.doors) {
                  if (d.open) continue;
                  if (Math.hypot(d.pos.x - this.creaturePos.x, d.pos.z - this.creaturePos.z) < 1.35) {
                    this.killerDoorTarget = d;
                    if (d.locked) {
                      this.killerDoorBashTimer = 3.6;
                      this.killerNextPoundAt = 2.95;
                    } else {
                      this.killerDoorBashTimer = this.creatureBrain === 'chase' ? 0.85 : 0.55;
                    }
                    speed = 0;
                    break;
                  }
                }
              }

              if (
                !this.killerDoorTarget &&
                this.hitsTippedBarricade(this.creaturePos.x + vx, this.creaturePos.z + vz, 0.42)
              ) {
                for (const bar of this.barricades) {
                  if (bar.state !== 'tipped') continue;
                  if (Math.hypot(bar.pos.x - this.creaturePos.x, bar.pos.z - this.creaturePos.z) < 1.65) {
                    this.killerBarricadeTarget = bar;
                    this.killerBarricadeTimer = 3.2;
                    this.triggerKillerAttackAnim();
                    this.audio.playDoorPound(bar.pos);
                    speed = 0;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      // Close-range melee strike
      if (this.creatureBrain === 'chase') {
        const canHitHiding = this.activeLocker && (this.huntedLocker === this.activeLocker || (this.flashlightOn && hasLos));
        const strikeReach = this.activeLocker ? (canHitHiding ? 1.65 : 0) : 1.42;
        if (dist < strikeReach && hasLos && this.creatureAttackCooldown <= 0) {
          if (this.activeLocker) {
            this.activeLocker.doorKick = 1.0;
            this.playerPos.copy(this.activeLocker.exitPos);
            this.activeLocker = null;
            this.sawPlayerHide = false;
            this.huntedLocker = null;
            this.holdingBreath = false;
            this.lockerPanic = 0;
            this.audio.playLockerDoor(true);
            this.setHint('O Assassino encontrou você no armário!', 2.6);
          }
          this.triggerKillerAttackAnim();
          this.hp = Math.max(0, this.hp - 30);
          this.damagePulse = 1.0;
          this.creatureAttackCooldown = 1.25;
          this.audio.playPlayerHurt();
          if (this.hp <= 0) {
            this.phase = 'dead';
            this.interactPrompt = null;
            this.clearKeys();
            this.triggerPlayerDeathAnim();
            document.exitPointerLock?.();
          } else {
            this.triggerPlayerHitAnim();
          }
          this.pushHud(true);
        }
      }
    }

    if (speed > 0.2) {
      if (this.creaturePos.distanceTo(this.killerLastPos) < 0.04 * dt * 10) {
        this.killerStuckTimer += dt;
        if (this.killerStuckTimer > 1.1) {
          this.killerStuckTimer = 0;
          this._pathLen = 0;
          if (this.creatureBrain !== 'chase') {
            this.pickNextSearchWaypoint();
          }
        }
      } else {
        this.killerStuckTimer = 0;
      }
    }
    this.killerLastPos.copy(this.creaturePos);

    this.creatureSpeed = speed;
    this.creatureRig.group.position.copy(this.creaturePos);

    // Pillar 2: Deposit glowing Sonar-only creature footprints along its path
    if (speed > 0.25 && this.footprintPool.length > 0) {
      this.creatureFootstepAccum += speed * dt;
      if (this.creatureFootstepAccum >= 0.85) {
        this.creatureFootstepAccum = 0;
        const fp = this.footprintPool[this.footprintPoolCursor];
        this.footprintPoolCursor = (this.footprintPoolCursor + 1) % this.footprintPool.length;
        const sideSign = this.footprintLeftSide ? 1 : -1;
        this.footprintLeftSide = !this.footprintLeftSide;
        const sideX = Math.cos(this.creatureHeading) * 0.16 * sideSign;
        const sideZ = -Math.sin(this.creatureHeading) * 0.16 * sideSign;
        fp.pos.set(this.creaturePos.x + sideX, this.waterLevel + 0.015, this.creaturePos.z + sideZ);
        fp.mesh.position.copy(fp.pos);
        fp.mesh.rotation.y = this.creatureHeading;
        fp.life = 24.0;
        fp.mesh.visible = this.cameraOn;
      }
    }

    const toPlayerAngle = Math.atan2(
      this.playerPos.x - this.creaturePos.x,
      this.playerPos.z - this.creaturePos.z,
    );
    const desiredHeading = this.creatureBrain === 'chase' && hasLos && this.killerStunTimer <= 0 ? toPlayerAngle : moveAngle;
    let headDiff = desiredHeading - this.creatureHeading;
    while (headDiff > Math.PI) headDiff -= Math.PI * 2;
    while (headDiff < -Math.PI) headDiff += Math.PI * 2;
    const turnRate = this.creatureBrain === 'chase' ? 8.5 : 4.2;
    this.creatureHeading += headDiff * (1 - Math.exp(-turnRate * dt));
    this.creatureRig.group.rotation.y = this.creatureHeading;

    this.updateKillerAnimation(dt, speed);
  }

  private pushHud(force: boolean): void {
    const hasActivePopups = this.sfxPopupPool.some((p) => p.life > 0);
    const minDelta = hasActivePopups ? 0.055 : 0.09;
    if (!force && this.clockElapsed - this.lastHudPush < minDelta) return;
    this.lastHudPush = this.clockElapsed;

    const sfxPopups: SfxPopupSnapshot[] = [];
    for (let i = 0; i < this.sfxPopupPool.length; i++) {
      const sp = this.sfxPopupPool[i];
      if (sp.life <= 0) continue;
      _projVec.copy(sp.worldPos).project(this.camera);
      if (_projVec.z >= 1 || _projVec.z < -1) continue;
      const sx = (_projVec.x * 0.5 + 0.5) * 100;
      const sy = (-_projVec.y * 0.5 + 0.5) * 100;
      if (sx < 6 || sx > 94 || sy < 8 || sy > 90) continue;
      sfxPopups.push({
        id: sp.id,
        text: sp.text,
        screenX: sx,
        screenY: sy,
        opacity: Math.min(1, sp.life / Math.min(0.35, sp.maxLife)),
        accent: sp.accent,
        tiltDeg: sp.tiltDeg,
      });
    }

    const objective =
      this.phase === 'escaped'
        ? 'Você escapou da Plataforma Submersa Blackwood.'
        : this.phase === 'dead'
        ? 'Você foi engolido pelo Setor Abissal.'
        : this.activeLocker
        ? 'Escondido no armário — segure [Espaço] se o pânico subir.'
        : !this.hasKey && !this.powerOn
        ? 'Plataforma submersa: pegue a Chave e ligue o Disjuntor para abrir a Escotilha.'
        : !this.hasKey
        ? 'Falta pegar a Chave da Escotilha de Saída.'
        : !this.powerOn
        ? 'Falta religar o Disjuntor Principal.'
        : 'Chave e Energia OK — corra até a Escotilha de Saída!';

    this.onHudUpdate({
      hp: Math.ceil(this.hp),
      flashlightOn: this.flashlightOn,
      cameraOn: this.cameraOn,
      battery: Math.round(this.battery),
      phase: this.phase,
      objective,
      elapsedSec: Math.floor(this.elapsedSec),
      hint: this.hintText,
      hasKey: this.hasKey,
      powerOn: this.powerOn,
      isHiding: Boolean(this.activeLocker),
      crouching: this.crouching,
      bottles: this.bottles,
      maxBottles: SanatoriumEngine.MAX_BOTTLES,
      traps: this.traps,
      maxTraps: SanatoriumEngine.MAX_TRAPS,
      lockerPanic: Math.round(this.lockerPanic),
      breathStamina: Math.round(this.breathStamina),
      holdingBreath: this.holdingBreath,
      canPeekDoor: Boolean(this.nearestClosedDoor) && !this.activeLocker,
      canLockDoor: Boolean(this.nearestClosedDoor) && !this.activeLocker,
      doorLocked: Boolean(this.nearestClosedDoor?.locked),
      peekingDoor: Boolean(this.peekingDoor),
      interactPrompt: this.interactPrompt,
      thirdPerson: this.settings.thirdPerson,
      waterLevelCm: Math.round(this.waterLevel * 100),
      flashCharges: this.flashCharges,
      maxFlashCharges: SanatoriumEngine.MAX_FLASH_CHARGES,
      flashCooldownFrac: Math.min(1, this.flashCooldown / 2.2),
      radioOn: this.radioOn,
      radioSignal: this.radioSignal,
      sonarPulse: this.sonarThreatPulse,
      sonarProximity: this.cameraOn ? this.sonarProximity : 0,
      sfxPopups,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);

    this.audio.dispose();
    this.textures.dispose();
    this.blueNoiseTex?.dispose();
    this.composer?.dispose();

    this.playerRig?.mixer?.stopAllAction();
    this.creatureRig?.mixer?.stopAllAction();
    if (this.playerRig) {
      for (const m of this.playerRig.materials) m.dispose();
    }
    if (this.creatureRig) {
      for (const m of this.creatureRig.materials) m.dispose();
    }

    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
