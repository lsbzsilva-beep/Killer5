import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  CELL_SIZE,
  COURTYARD_BOUNDS,
  CREATURE_SPAWN,
  EXIT_DOOR_CELL,
  FLOOR_STAIN_PLACEMENTS,
  GENERATOR_POS,
  KEY_SPAWN,
  LAMP_PLACEMENTS,
  LOCKER_PLACEMENTS,
  MAIN_DOOR_CELL,
  MAP_HEIGHT,
  MAP_WIDTH,
  OUTDOOR_LAMPS,
  PICKUP_PLACEMENTS,
  PLAYER_SPAWN,
  PROP_PLACEMENTS,
  WALL_ART_PLACEMENTS,
  WALL_HEIGHT,
  hasLineOfSight,
  isWallAtGrid,
  isWallAtWorld,
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
  CreatureRig,
  LockerRig,
  WeaponRig,
  createAsylumChair,
  createBarredWindow,
  createBreakerBox,
  createCeilingLamp,
  createCeilingShadowSilhouette,
  createCreature,
  createExitDoor,
  createFirstPersonWeapon,
  createFloorStain,
  createGurney,
  createHidingLocker,
  createIVStand,
  createMedicalCabinet,
  createPickupBox,
  createWallArt,
  createWallPipeCluster,
  createWindowSilhouette,
} from './models';
import {
  EntrancePorticoRig,
  buildCourtyardPerimeterFence,
  createAbandonedAmbulance,
  createCourtyardFountain,
  createCourtyardLampPost,
  createDeadTree,
  createGeneratorUnit,
  createMasterKeyItem,
  createSanatoriumEntrancePortico,
  createSecurityBooth,
} from './exteriorModels';
import { SpatialHorrorAudio } from './SpatialAudio';

export type GamePhase = 'title' | 'playing' | 'dead' | 'escaped';

export interface HudSnapshot {
  hp: number;
  ammo: number;
  reserve: number;
  flashlightOn: boolean;
  cameraOn: boolean;
  battery: number;
  phase: GamePhase;
  objective: string;
  creatureAlive: boolean;
  creatureHp: number;
  elapsedSec: number;
  shotsFired: number;
  hitsLanded: number;
  hint: string;
  hasKey: boolean;
  generatorOn: boolean;
  doorUnlocked: boolean;
  inCourtyard: boolean;
  isHiding: boolean;
  interactPrompt: string | null;
}

export interface EngineSettings {
  ditherMode: DitherMode;
  palette: DitherPalette;
  colorDepth: ColorDepthMode;
  pixelScale: number;
  lightBoost: number;
  spatialAudio: boolean;
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
  currentIntensity: number;
  bursted: boolean;
  burstTimer: number;
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
  kind: 'ammo' | 'medkit';
  group: THREE.Group;
  pos: THREE.Vector3;
  collected: boolean;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

// Pre-allocated scratch math helpers (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _toCreature = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _shadowDir = new THREE.Vector3();

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

  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private clockElapsed = 0;

  // Player state
  private playerPos = new THREE.Vector3(PLAYER_SPAWN.x, 1.62, PLAYER_SPAWN.z);
  private yaw = PLAYER_SPAWN.yaw;
  private pitch = 0;
  private targetYaw = PLAYER_SPAWN.yaw;
  private targetPitch = 0;
  private hp = 100;
  private ammo = 12;
  private reserve = 48;
  private flashlightOn = true;
  private cameraOn = false;
  private battery = 100;
  private phase: GamePhase = 'title';
  private velX = 0;
  private velZ = 0;
  private walkPhase = 0;
  private stepDistAccum = 0;
  private weaponSwayX = 0;
  private weaponSwayY = 0;
  private weaponLookVelX = 0;
  private weaponLookVelY = 0;
  private shotCooldown = 0;
  private reloadTimer = 0;
  private muzzleTimer = 0;
  private damagePulse = 0;
  private elapsedSec = 0;
  private shotsFired = 0;
  private hitsLanded = 0;
  private hintText = '';
  private hintTimer = 0;

  // Exterior courtyard puzzle state
  private hasKey = false;
  private generatorOn = false;
  private doorUnlocked = false;
  private doorOpenProgress = 0;
  private leverProgress = 0;
  private lightningFlash = 0;
  private nextThunderIn = 15;
  private interactPrompt: string | null = null;

  // Input state
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0, sprint: false };
  private desktopSprint = false;

  // Dynamic lights (fixed GPU pool prevents Three.js shader recompiles during gameplay)
  private static readonly POINT_LIGHT_POOL_SIZE = 6;
  private pointLightPool: THREE.PointLight[] = [];
  private virtualLights: VirtualLight[] = [];
  private _topScores = new Float64Array(6);
  private _topLights: (VirtualLight | null)[] = [null, null, null, null, null, null];
  private hemiLight!: THREE.HemisphereLight;
  private dirKeyLight!: THREE.DirectionalLight;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private flashlightBounce!: THREE.PointLight;
  private irFloodLight!: THREE.SpotLight;
  private muzzleLight!: THREE.PointLight;
  private exitVLight!: VirtualLight;
  private mainDoorVLight!: VirtualLight;
  private lightningLight!: THREE.DirectionalLight;
  private keyVLight!: VirtualLight;
  private lamps: LampEntry[] = [];
  private lampIntensities: number[] = [];
  private moonSpills: VirtualLight[] = [];
  private outdoorLamps: {
    vLight: VirtualLight;
    bulbMat: THREE.MeshStandardMaterial;
    pos: THREE.Vector3;
    requiresPower: boolean;
    seed: number;
  }[] = [];

  // Dynamic entities & stealth lockers
  private weaponRig!: WeaponRig;
  private entranceRig!: EntrancePorticoRig;
  private generatorRig!: {
    group: THREE.Group;
    leverPivot: THREE.Group;
    beaconMat: THREE.MeshStandardMaterial;
  };
  private keyMesh!: THREE.Group;
  private lockers: LockerEntry[] = [];
  private activeLocker: LockerEntry | null = null;
  private creatureRig!: CreatureRig;
  private creatureShadowMesh!: THREE.Mesh;
  private creaturePos = new THREE.Vector3(CREATURE_SPAWN.x, WALL_HEIGHT, CREATURE_SPAWN.z);
  private creatureAlive = true;
  private creatureHp = 3;
  private creatureAggro = false;
  private creatureLostSightSec = 0;
  private creatureStagger = 0;
  private creatureAttackCooldown = 0;
  private creatureWalkCycle = 0;
  private creaturePatrolAngle = 0;
  private creatureHeading = 0;
  private creatureHeadYaw = 0;
  private creatureBodyBack = false;
  private creaturePatrolBurstTimer = 2.0;
  private creaturePatrolPauseTimer = 0;
  private creatureVisible = true;
  private creatureVanishTimer = 0;
  private creatureFlashFreeze = 0;
  private creatureLungeTimer = 0;
  private creatureVanishCount = 0;
  private lookUpVanishCooldown = 0;
  private lookUpHintShown = false;
  private enteredSanatorium = false;
  private creatureHitMeshes: THREE.Object3D[] = [];

  // Horror events state
  private courtyardSilhouette!: THREE.Group;
  private corridorSilhouette!: THREE.Group;
  private courtyardSilhouetteTimer = 0;
  private corridorSilhouetteTimer = 0;
  private courtyardShadowTriggered = false;
  private corridorShadowTriggered = false;
  private lampBurstTriggered = [false, false];
  private doorSlamTriggered = [false, false];

  private pickups: PickupEntry[] = [];
  private sparks: SparkParticle[] = [];
  private ceilingDustPool: SparkParticle[] = [];
  private ceilingDustEmitTimer = 0;
  private hauntedDustTimer = 0;
  private dustPoints: THREE.Points | null = null;
  private rainPoints: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private exitWorldPos = new THREE.Vector3(
    EXIT_DOOR_CELL.triggerX,
    1.5,
    EXIT_DOOR_CELL.triggerZ,
  );

  // Settings & callback (locked to 1-bit Contraste 1x)
  private settings: EngineSettings = {
    ditherMode: 'contrast',
    palette: 'auto',
    colorDepth: '1bit',
    pixelScale: 1,
    lightBoost: 1.0,
    spatialAudio: true,
  };
  private activePaletteKey: Exclude<DitherPalette, 'auto'> | null = null;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private lastHudPush = 0;

  // Track disposables
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(container: HTMLElement, onHudUpdate: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    // Pixel ratio 1 prevents 4x-9x over-rendering on Retina/mobile since DitherShader renders on an integer pixel grid
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050607);
    this.scene.fog = new THREE.FogExp2(0x050607, 0.056);

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 58);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // Mandatory studio environment map via RoomEnvironment
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environmentIntensity = 0.05;
    roomEnv.dispose();
    pmrem.dispose();

    this.textures = createSanatoriumTextures(this.renderer);

    this.buildLighting();
    this.buildSanatoriumGeometry();
    this.buildCourtyardEnvironment();
    this.buildPropsAndActors();
    this.buildPostProcessing();

    if (!this.isSoftwareGl) {
      // Pre-compile all hidden meshes & post-processing shaders upfront so nothing hitches mid-walk/interaction
      this.creatureRig.bodyBackMesh.visible = true;
      this.creatureRig.headBackMesh.visible = true;
      this.creatureShadowMesh.visible = true;
      this.courtyardSilhouette.visible = true;
      this.corridorSilhouette.visible = true;
      this.weaponRig.muzzleFlashMesh.visible = true;
      if (this.sparks[0]) this.sparks[0].mesh.visible = true;
      if (this.ceilingDustPool[0]) this.ceilingDustPool[0].mesh.visible = true;

      this.renderer.compile(this.scene, this.camera);
      this.composer?.render();

      this.creatureRig.bodyBackMesh.visible = false;
      this.creatureRig.headBackMesh.visible = false;
      this.creatureShadowMesh.visible = false;
      this.courtyardSilhouette.visible = false;
      this.corridorSilhouette.visible = false;
      this.weaponRig.muzzleFlashMesh.visible = false;
      if (this.sparks[0]) this.sparks[0].mesh.visible = false;
      if (this.ceilingDustPool[0]) this.ceilingDustPool[0].mesh.visible = false;
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
    // Nocturnal hemisphere ambient fill calibrated for Contraste 1x (darkness outside light pools)
    this.hemiLight = new THREE.HemisphereLight(0x4a5b70, 0x16181c, 0.17);
    this.scene.add(this.hemiLight);

    // Subtle moonlight directional key fill (fades near zero indoors)
    this.dirKeyLight = new THREE.DirectionalLight(0xeef2f8, 0.115);
    this.dirKeyLight.position.set(12, 16, 10);
    this.scene.add(this.dirKeyLight);

    // Player-reactive tactical flashlight calibrated for Contraste 1x (rich wood/brick texture without blowing white)
    this.flashlight = new THREE.SpotLight(0xfff5e0, 19.5, 26, Math.PI / 4.5, 0.58, 1.32);
    this.flashlight.castShadow = !this.isSoftwareGl;
    this.flashlight.shadow.mapSize.set(512, 512);
    this.flashlight.shadow.camera.near = 0.25;
    this.flashlight.shadow.camera.far = 26;
    this.flashlight.shadow.bias = -0.0007;
    this.flashlight.shadow.normalBias = 0.025;

    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    // Close-range bounce light around player only active when flashlight or IR camera is switched on
    this.flashlightBounce = new THREE.PointLight(0xffe9c8, 1.25, 4.6, 1.75);
    this.scene.add(this.flashlightBounce);

    // Outlast-inspired wide-angle infrared camcorder illuminator
    this.irFloodLight = new THREE.SpotLight(0xd8ffe0, 0.0, 20, Math.PI / 2.2, 0.85, 1.1);
    this.irFloodLight.castShadow = false;
    this.scene.add(this.irFloodLight);
    this.irFloodLight.target = this.flashlightTarget;

    // Fixed pool of 6 physical PointLights (always visible=true -> ZERO WebGL shader recompiles!)
    for (let i = 0; i < SanatoriumEngine.POINT_LIGHT_POOL_SIZE; i++) {
      const pLight = new THREE.PointLight(0xffffff, 0, 10, 1.65);
      this.scene.add(pLight);
      this.pointLightPool.push(pLight);
    }

    // Instantaneous gunfire muzzle burst light (always visible, intensity=0 when idle)
    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 14, 1.5);
    this.scene.add(this.muzzleLight);

    // Emergency beacon at Exit Door (virtual light allocated to nearest pool slot)
    this.exitVLight = {
      pos: new THREE.Vector3(EXIT_DOOR_CELL.x * CELL_SIZE, 2.7, (EXIT_DOOR_CELL.z - 0.35) * CELL_SIZE),
      color: 0xffffff,
      distance: 7.6,
      decay: 1.7,
      intensity: 2.1,
    };
    this.virtualLights.push(this.exitVLight);

    // Exterior Entrance Portico Lamp (virtual light)
    this.mainDoorVLight = {
      pos: new THREE.Vector3(MAIN_DOOR_CELL.x, 3.0, -1.05),
      color: 0xffe8cc,
      distance: 8.5,
      decay: 1.58,
      intensity: 1.45,
    };
    this.virtualLights.push(this.mainDoorVLight);

    // Storm Lightning Flash Light (always visible, intensity=0 when calm)
    this.lightningLight = new THREE.DirectionalLight(0xeef5ff, 0);
    this.lightningLight.position.set(-14, 24, -18);
    this.scene.add(this.lightningLight);
  }

  private buildCourtyardEnvironment(): void {
    // Continuous expansive wet stone/gravel courtyard terrain extending beyond perimeter fences into fog
    const terrainGeo = this.trackGeo(new THREE.PlaneGeometry(92, 86));
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = this.makeStdMat({
      map: this.textures.courtyardGroundMap,
      normalMap: this.textures.courtyardGroundNormal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: this.textures.courtyardGroundRoughness,
      roughness: 0.92,
      metalness: 0.06,
    });
    const ground = new THREE.Mesh(terrainGeo, terrainMat);
    ground.position.set((MAP_WIDTH * CELL_SIZE) / 2, -0.006, -24);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Perimeter wrought-iron fence & chained arrival gate
    buildCourtyardPerimeterFence(this.scene, this.textures, this.isSoftwareGl);

    // Two-story Sanatorium facade, portico, signage & twin hinged doors
    this.entranceRig = createSanatoriumEntrancePortico(this.textures, this.isSoftwareGl);
    this.scene.add(this.entranceRig.group);

    // West Security Booth ("Guarita") & Master Key on desk
    const booth = createSecurityBooth(this.textures, this.isSoftwareGl);
    this.scene.add(booth.group);
    const boothPos = new THREE.Vector3(3.2 * CELL_SIZE + 1.1, 2.35, -6.4 * CELL_SIZE);
    const boothVLight: VirtualLight = {
      pos: boothPos,
      color: 0xffeed4,
      distance: 7.0,
      decay: 1.65,
      intensity: 2.3,
    };
    this.virtualLights.push(boothVLight);
    this.outdoorLamps.push({
      vLight: boothVLight,
      bulbMat: booth.bulbMat,
      pos: boothPos,
      requiresPower: false,
      seed: 4.7,
    });

    this.keyMesh = createMasterKeyItem(this.textures, this.isSoftwareGl);
    this.keyMesh.position.set(KEY_SPAWN.x, KEY_SPAWN.y, KEY_SPAWN.z);
    this.scene.add(this.keyMesh);
    this.keyVLight = {
      pos: new THREE.Vector3(KEY_SPAWN.x, KEY_SPAWN.y + 0.35, KEY_SPAWN.z),
      color: 0xffffff,
      distance: 2.8,
      decay: 1.8,
      intensity: 1.6,
    };
    this.virtualLights.push(this.keyVLight);

    // East Auxiliary Generator Unit
    this.generatorRig = createGeneratorUnit(this.textures, this.isSoftwareGl);
    this.generatorRig.group.position.set(GENERATOR_POS.x, 0, GENERATOR_POS.z);
    this.scene.add(this.generatorRig.group);

    // Central Courtyard Weathered Stone Fountain
    const fountain = createCourtyardFountain(this.textures, this.isSoftwareGl);
    fountain.position.set(7.5 * CELL_SIZE, 0, -5.5 * CELL_SIZE);
    this.scene.add(fountain);

    // Abandoned Asylum Transport Ambulance
    const ambulance = createAbandonedAmbulance(this.textures, this.isSoftwareGl);
    ambulance.position.set(11.8 * CELL_SIZE, 0, -8.6 * CELL_SIZE);
    ambulance.rotation.y = 0.16;
    this.scene.add(ambulance);

    // Courtyard Lampposts (some dead until Generator starts!)
    OUTDOOR_LAMPS.forEach((ol, i) => {
      const post = createCourtyardLampPost(this.textures, this.isSoftwareGl);
      post.group.position.set(ol.x, 0, ol.z);
      post.group.rotation.y = ol.x < 7.5 * CELL_SIZE ? 0 : Math.PI;
      this.scene.add(post.group);

      const olPos = new THREE.Vector3(ol.x + (ol.x < 7.5 * CELL_SIZE ? 0.45 : -0.45), 3.7, ol.z);
      const olVLight: VirtualLight = {
        pos: olPos,
        color: 0xeef4ff,
        distance: 10.2,
        decay: 1.6,
        intensity: ol.requiresPower ? 0 : 2.6,
      };
      this.virtualLights.push(olVLight);
      this.outdoorLamps.push({
        vLight: olVLight,
        bulbMat: post.bulbMat,
        pos: olPos,
        requiresPower: ol.requiresPower,
        seed: i * 13.7 + 1.9,
      });
    });

    // Surrounding Dead Forest Silhouette outside the Perimeter Fence
    const treePositions: [number, number, number][] = [
      [COURTYARD_BOUNDS.minX - 2.6, -4, 0.9],
      [COURTYARD_BOUNDS.minX - 4.2, -10, 1.15],
      [COURTYARD_BOUNDS.minX - 2.4, -17, 0.95],
      [COURTYARD_BOUNDS.minX - 3.8, -23, 1.1],
      [COURTYARD_BOUNDS.maxX + 2.5, -5, 1.05],
      [COURTYARD_BOUNDS.maxX + 4.1, -12, 0.92],
      [COURTYARD_BOUNDS.maxX + 2.8, -19, 1.18],
      [COURTYARD_BOUNDS.maxX + 3.6, -25, 1.0],
      [7.0, COURTYARD_BOUNDS.minZ - 3.2, 1.05],
      [13.5, COURTYARD_BOUNDS.minZ - 4.0, 0.9],
      [23.0, COURTYARD_BOUNDS.minZ - 3.6, 1.12],
      [30.5, COURTYARD_BOUNDS.minZ - 3.1, 0.98],
    ];
    treePositions.forEach(([tx, tz, sc], idx) => {
      const tree = createDeadTree(this.textures, this.isSoftwareGl);
      tree.position.set(tx, 0, tz);
      tree.scale.setScalar(sc);
      tree.rotation.y = idx * 1.15;
      this.scene.add(tree);
    });

    // Outdoor Atmospheric Cold Rain Drizzle (160 motes for crisp performance)
    const rainCount = 160;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = 2 + Math.random() * 34;
      rainPos[i * 3 + 1] = Math.random() * 8.5;
      rainPos[i * 3 + 2] = -27 + Math.random() * 27;
    }
    this.rainPositions = rainPos;
    const rainGeo = this.trackGeo(new THREE.BufferGeometry());
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = this.trackMat(
      new THREE.PointsMaterial({
        map: this.textures.dustMoteMap,
        color: 0xdbe6f2,
        size: 0.085,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainPoints);

    // 2nd-story window silhouette for courtyard lightning horror event
    this.courtyardSilhouette = createWindowSilhouette();
    this.courtyardSilhouette.position.set(7.5 * CELL_SIZE, 3.65, -0.32);
    this.scene.add(this.courtyardSilhouette);
  }

  private buildSanatoriumGeometry(): void {
    const worldW = MAP_WIDTH * CELL_SIZE;
    const worldD = MAP_HEIGHT * CELL_SIZE;

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

    // Instanced Wall Blocks + Architectural Baseboards (> 20 instances -> InstancedMesh!)
    let wallCount = 0;
    for (let z = 0; z < MAP_HEIGHT; z++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (isWallAtGrid(x, z)) wallCount++;
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
    for (let z = 0; z < MAP_HEIGHT; z++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isWallAtGrid(x, z)) continue;
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

    for (let z = 1; z < MAP_HEIGHT - 1; z++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (isWallAtGrid(x, z)) continue;
        // Ceiling structural beams every 2 cells in corridors
        if ((x + z) % 2 === 0) {
          const wallN = isWallAtGrid(x, z - 1);
          const wallS = isWallAtGrid(x, z + 1);
          const wallW = isWallAtGrid(x - 1, z);
          const wallE = isWallAtGrid(x + 1, z);
          if (wallN && wallS) {
            beamCoords.push({ x, z, alongX: false });
          } else if (wallW && wallE) {
            beamCoords.push({ x, z, alongX: true });
          }
        }
        // Overhead steam pipe runs hugging north or west corridor walls
        if (isWallAtGrid(x, z - 1)) {
          pipeCoords.push({ x, z, alongX: true });
        } else if (isWallAtGrid(x - 1, z)) {
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
    // Ceiling Lamps + Virtual Flickering PointLights
    const lampWorldPositions: THREE.Vector3[] = [];
    LAMP_PLACEMENTS.forEach((lp, i) => {
      const { group, bulbMat } = createCeilingLamp(this.textures, this.isSoftwareGl);
      const wx = lp.x * CELL_SIZE;
      const wz = lp.z * CELL_SIZE;
      group.position.set(wx, 0, wz);
      this.scene.add(group);

      const pos = new THREE.Vector3(wx, WALL_HEIGHT - 0.65, wz);
      const vLight: VirtualLight = {
        pos,
        color: 0xffeed6,
        distance: 8.2,
        decay: 1.65,
        intensity: 3.1,
      };
      this.virtualLights.push(vLight);
      lampWorldPositions.push(pos);
      this.lamps.push({
        vLight,
        bulbMat,
        pos,
        seed: i * 19.37 + 3.1,
        currentIntensity: 3.1,
        bursted: false,
        burstTimer: 0,
      });
      this.lampIntensities.push(1.0);
    });

    // Corridor furniture, medical props, barred windows & wall pipes
    const pipeWorldPositions: THREE.Vector3[] = [];
    for (const prop of PROP_PLACEMENTS) {
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

    // Hideable Steel Lockers along Sanatorium Corridors
    for (const lp of LOCKER_PLACEMENTS) {
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
        faceYaw: lp.rotY + Math.PI,
        doorKick: 0,
      });
    }

    // Silhouette behind barred corridor window-2 for horror scare event
    this.corridorSilhouette = createWindowSilhouette();
    this.corridorSilhouette.position.set(10.5 * CELL_SIZE, 0.85, 0.65);
    this.scene.add(this.corridorSilhouette);

    // Wall Posters & Charcoal Madness Graffiti
    for (const art of WALL_ART_PLACEMENTS) {
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
    for (const st of FLOOR_STAIN_PLACEMENTS) {
      const stain = createFloorStain(this.textures, this.isSoftwareGl, st.scale);
      stain.position.set(st.x * CELL_SIZE, 0.012, st.z * CELL_SIZE);
      stain.rotation.y = st.rotY;
      this.scene.add(stain);
    }

    // Instanced Scattered Clinical Papers on Corridor Floors (> 20 instances -> InstancedMesh)
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
    for (let z = 1; z < MAP_HEIGHT - 1; z++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (isWallAtGrid(x, z)) continue;
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

    // Atmospheric Drifting Dust Motes across corridors
    const dustCount = 260;
    const dustPos = new Float32Array(dustCount * 3);
    let dIdx = 0;
    let tries = 0;
    while (dIdx < dustCount && tries < 2000) {
      tries++;
      const gx = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
      const gz = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));
      if (isWallAtGrid(gx, gz)) continue;
      dustPos[dIdx * 3] = (gx + Math.random()) * CELL_SIZE;
      dustPos[dIdx * 3 + 1] = 0.25 + Math.random() * (WALL_HEIGHT - 0.5);
      dustPos[dIdx * 3 + 2] = (gz + Math.random()) * CELL_SIZE;
      dIdx++;
    }
    const dustGeo = this.trackGeo(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos.subarray(0, dIdx * 3), 3));
    const dustMat = this.trackMat(
      new THREE.PointsMaterial({
        map: this.textures.dustMoteMap,
        color: 0xe6e6dc,
        size: 0.055,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    );
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);

    // Pickups (Ammo + Medkit)
    for (const pk of PICKUP_PLACEMENTS) {
      const kind = pk.kind === 'medkit' ? 'medkit' : 'ammo';
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

    // Reinforced Exit Door
    const exitDoor = createExitDoor(this.textures, this.isSoftwareGl);
    exitDoor.position.set(EXIT_DOOR_CELL.x * CELL_SIZE, 0, EXIT_DOOR_CELL.z * CELL_SIZE);
    this.scene.add(exitDoor);

    // The Ceiling Creature ("A Coisa do Teto" — always upside-down on the ceiling, never on floor)
    this.creatureRig = createCreature(this.textures, this.isSoftwareGl);
    this.creaturePos.set(CREATURE_SPAWN.x, WALL_HEIGHT, CREATURE_SPAWN.z);
    this.creatureRig.group.position.copy(this.creaturePos);
    this.scene.add(this.creatureRig.group);
    this.creatureRig.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        this.creatureHitMeshes.push(obj);
      }
    });

    // Distorted shadow silhouette cast onto ceiling planks against corridor lamps
    this.creatureShadowMesh = createCeilingShadowSilhouette(this.textures);
    this.scene.add(this.creatureShadowMesh);

    // First-person pistol attached to camera
    this.weaponRig = createFirstPersonWeapon(this.textures, this.isSoftwareGl);
    this.weaponRig.group.position.set(0.24, -0.22, -0.36);
    this.camera.add(this.weaponRig.group);

    // Pre-allocated spark particle pool for shots & lamp bursts
    const sparkGeo = this.trackGeo(new THREE.BoxGeometry(0.035, 0.035, 0.035));
    const sparkMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }

    // Pre-allocated falling ceiling plaster/dust particle pool (zero GC in loop)
    const cDustGeo = this.trackGeo(new THREE.BoxGeometry(0.026, 0.018, 0.026));
    const cDustMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xc9c6bc }));
    for (let i = 0; i < 64; i++) {
      const mesh = new THREE.Mesh(cDustGeo, cDustMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.ceilingDustPool.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }

    // Store spatial audio anchor positions for later init on user click
    this.pendingLampPositions = lampWorldPositions;
    this.pendingPipePositions = pipeWorldPositions;
  }

  private pendingLampPositions: THREE.Vector3[] = [];
  private pendingPipePositions: THREE.Vector3[] = [];

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

      const mixSet = key === 'night' ? MIXED_5_COLORS.night : MIXED_5_COLORS.normal;
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
    this.audio.attachGeneratorHum(new THREE.Vector3(GENERATOR_POS.x, 0.8, GENERATOR_POS.z));
    this.audio.setEnabled(this.settings.spatialAudio);
    if (this.phase === 'dead' || this.phase === 'escaped') {
      this.resetRun();
    }
    this.phase = 'playing';
    this.setHint('Pátio: pegue a Chave na Guarita (Oeste) e ligue o Gerador (Leste).', 5.0);
    this.pushHud(true);
  }

  public resetRun(): void {
    this.playerPos.set(PLAYER_SPAWN.x, 1.62, PLAYER_SPAWN.z);
    this.yaw = PLAYER_SPAWN.yaw;
    this.targetYaw = PLAYER_SPAWN.yaw;
    this.pitch = 0;
    this.targetPitch = 0;
    this.hp = 100;
    this.ammo = 12;
    this.reserve = 48;
    this.flashlightOn = true;
    this.cameraOn = false;
    this.battery = 100;
    this.elapsedSec = 0;
    this.shotsFired = 0;
    this.hitsLanded = 0;
    this.damagePulse = 0;
    this.muzzleTimer = 0;
    this.shotCooldown = 0;
    this.reloadTimer = 0;

    this.hasKey = false;
    this.generatorOn = false;
    this.doorUnlocked = false;
    this.doorOpenProgress = 0;
    this.leverProgress = 0;
    this.interactPrompt = null;
    this.activeLocker = null;
    this.weaponRig.group.visible = true;
    for (const lk of this.lockers) {
      lk.doorKick = 0;
      lk.rig.doorPivot.rotation.y = 0;
    }
    this.courtyardShadowTriggered = false;
    this.corridorShadowTriggered = false;
    this.courtyardSilhouetteTimer = 0;
    this.corridorSilhouetteTimer = 0;
    this.courtyardSilhouette.visible = false;
    this.corridorSilhouette.visible = false;
    this.lampBurstTriggered = [false, false];
    this.doorSlamTriggered = [false, false];
    for (const lamp of this.lamps) {
      lamp.bursted = false;
      lamp.burstTimer = 0;
    }

    this.keyMesh.visible = true;
    this.keyVLight.intensity = 1.6;
    this.entranceRig.leftDoorPivot.rotation.y = 0;
    this.entranceRig.rightDoorPivot.rotation.y = 0;
    this.entranceRig.keyStatusMat.emissive.setHex(0xff463d);
    this.entranceRig.powerStatusMat.emissive.setHex(0xff463d);
    this.generatorRig.leverPivot.rotation.z = 0.65;
    this.generatorRig.beaconMat.emissiveIntensity = 0.0;
    this.audio.setGeneratorHum(false);

    this.creaturePos.set(CREATURE_SPAWN.x, WALL_HEIGHT, CREATURE_SPAWN.z);
    this.creatureAlive = true;
    this.creatureHp = 3;
    this.creatureAggro = false;
    this.creatureLostSightSec = 0;
    this.creatureStagger = 0;
    this.creatureVisible = true;
    this.creatureVanishTimer = 0;
    this.creatureFlashFreeze = 0;
    this.creatureLungeTimer = 0;
    this.creatureVanishCount = 0;
    this.lookUpVanishCooldown = 0;
    this.lookUpHintShown = false;
    this.enteredSanatorium = false;
    this.creatureRig.group.visible = true;
    this.creatureRig.group.rotation.set(0, 0, 0);
    this.creatureRig.group.position.copy(this.creaturePos);
    this.creatureHeading = 0;
    this.creatureHeadYaw = 0;
    this.creatureBodyBack = false;
    this.creaturePatrolBurstTimer = 2.0;
    this.creaturePatrolPauseTimer = 0;
    this.creatureRig.bodyPivot.position.set(0, -0.02, 0);
    this.creatureRig.bodyPivot.rotation.set(0, 0, 0);
    this.creatureRig.bodyFrontMesh.visible = true;
    this.creatureRig.bodyBackMesh.visible = false;
    this.velX = 0;
    this.velZ = 0;
    this.walkPhase = 0;
    this.weaponSwayX = 0;
    this.weaponSwayY = 0;
    this.weaponLookVelX = 0;
    this.weaponLookVelY = 0;
    this.creatureRig.head.rotation.set(0.22, 0, 0);
    this.creatureRig.headFrontMesh.visible = true;
    this.creatureRig.headBackMesh.visible = false;
    this.creatureRig.leftArm.rotation.set(-0.22, 0, -0.18);
    this.creatureRig.rightArm.rotation.set(-0.22, 0, 0.18);
    this.creatureRig.leftLeg.rotation.set(0.18, 0.42, 0.82);
    this.creatureRig.rightLeg.rotation.set(0.18, -0.42, -0.82);
    for (const mat of this.creatureRig.materials) {
      mat.color.setHex(0xffffff);
    }
    this.creatureShadowMesh.visible = false;
    for (const d of this.ceilingDustPool) {
      d.life = 0;
      d.mesh.visible = false;
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
      ditherMode: 'contrast',
      colorDepth: '1bit',
      pixelScale: 1,
    };
    this.audio.setEnabled(this.settings.spatialAudio);
    if (this.ditherPass) {
      this.ditherPass.uniforms.uPixelScale.value = 1;
      this.ditherPass.uniforms.uMode.value = this.getDitherModeIndex('contrast');
      this.ditherPass.uniforms.uColorMode.value = this.getColorModeIndex('1bit');
      this.syncPaletteUniforms();
    }
  }

  public setKey(code: string, down: boolean): void {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.desktopSprint = down;
    }
  }

  public clearKeys(): void {
    this.keys.clear();
    this.desktopSprint = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchMove.sprint = false;
  }

  public setTouchMove(x: number, y: number, sprint: boolean): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.touchMove.sprint = sprint;
  }

  public addLookDelta(dx: number, dy: number): void {
    if (this.phase !== 'playing') return;
    this.targetYaw -= dx;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch - dy, -0.85, 1.28);
    this.weaponLookVelX = THREE.MathUtils.clamp(this.weaponLookVelX + dx * 2.4, -0.05, 0.05);
    this.weaponLookVelY = THREE.MathUtils.clamp(this.weaponLookVelY + dy * 2.2, -0.04, 0.04);
  }

  public toggleFlashlight(): void {
    if (this.phase !== 'playing') return;
    this.flashlightOn = !this.flashlightOn;
    this.audio.playFlashlightClick();
    this.pushHud(true);
  }

  public toggleCamera(): void {
    if (this.phase !== 'playing') return;
    this.cameraOn = !this.cameraOn;
    this.audio.playCameraToggle(this.cameraOn);
    this.syncPaletteUniforms();
    this.pushHud(true);
  }

  public interact(): void {
    if (this.phase !== 'playing') return;

    // 0. Exit current hiding locker
    if (this.activeLocker) {
      this.activeLocker.doorKick = 1.0;
      this.playerPos.copy(this.activeLocker.exitPos);
      this.activeLocker = null;
      this.weaponRig.group.visible = true;
      this.audio.playLockerDoor(true);
      this.pushHud(true);
      return;
    }

    // 0b. Enter nearby hiding locker indoors
    let bestLocker: LockerEntry | null = null;
    let bestDist = 1.95;
    for (const lk of this.lockers) {
      const d = Math.hypot(this.playerPos.x - lk.pos.x, this.playerPos.z - lk.pos.z);
      if (d < bestDist) {
        bestDist = d;
        bestLocker = lk;
      }
    }
    if (bestLocker) {
      this.activeLocker = bestLocker;
      bestLocker.doorKick = 1.0;
      this.weaponRig.group.visible = false;
      this.targetYaw = bestLocker.faceYaw;
      this.targetPitch = 0;
      this.audio.playLockerDoor(false);
      this.setHint(
        this.flashlightOn
          ? 'Escondido! Desligue a lanterna (F) para não chamar atenção.'
          : 'Escondido no armário. Espie pelas frestas — [E] para sair.',
        3.5,
      );
      this.pushHud(true);
      return;
    }

    // 1. Activate East Auxiliary Generator
    const distGen = Math.hypot(
      this.playerPos.x - GENERATOR_POS.interactX,
      this.playerPos.z - GENERATOR_POS.interactZ,
    );
    if (distGen < 2.6 && !this.generatorOn) {
      this.generatorOn = true;
      _v1.set(GENERATOR_POS.x, 0.8, GENERATOR_POS.z);
      this.audio.playGeneratorStart(_v1);
      this.entranceRig.powerStatusMat.emissive.setHex(0x80ff72);
      this.generatorRig.beaconMat.emissiveIntensity = 2.6;
      this.lightningFlash = 0.75;
      this.setHint(
        this.hasKey
          ? 'Gerador ligado! Vá até a Porta Principal para entrar no Sanatório.'
          : 'Gerador ligado! Agora pegue a Chave na Guarita (Oeste).',
        4.2,
      );
      this.pushHud(true);
      return;
    }

    // 2. Unlock Main Sanatorium Entrance Door
    const distDoor = Math.hypot(
      this.playerPos.x - MAIN_DOOR_CELL.interactX,
      this.playerPos.z - MAIN_DOOR_CELL.interactZ,
    );
    if (distDoor < 2.8 && !this.doorUnlocked) {
      if (this.hasKey && this.generatorOn) {
        this.unlockMainDoor();
      } else if (!this.hasKey && !this.generatorOn) {
        this.audio.playEmptyClick();
        this.setHint('Trancada! Pegue a Chave na Guarita (Oeste) e ligue o Gerador (Leste).', 3.5);
      } else if (!this.hasKey) {
        this.audio.playEmptyClick();
        this.setHint('Falta a Chave Mestre na Guarita (Oeste)!', 3.0);
      } else {
        this.audio.playEmptyClick();
        this.setHint('Sem energia! Ligue o Gerador Auxiliar no lado Leste.', 3.0);
      }
      this.pushHud(true);
    }
  }

  private unlockMainDoor(): void {
    if (this.doorUnlocked) return;
    this.doorUnlocked = true;
    this.interactPrompt = null;
    this.audio.playDoorUnlock();
    this.audio.playThunder();
    this.lightningFlash = 1.1;
    this.setHint('Porta Principal destrancada! Entre no Sanatório Blackwood.', 4.5);
    this.pushHud(true);
  }

  public reload(): void {
    if (this.phase !== 'playing' || this.activeLocker) return;
    if (this.reloadTimer > 0 || this.ammo >= 12 || this.reserve <= 0) return;
    this.reloadTimer = 0.65;
    this.audio.playReload();
    this.setHint('Recarregando...', 0.9);
  }

  public shoot(): void {
    if (this.phase !== 'playing' || this.activeLocker || this.shotCooldown > 0 || this.reloadTimer > 0) return;
    if (this.ammo <= 0) {
      this.audio.playEmptyClick();
      this.shotCooldown = 0.22;
      if (this.reserve > 0) this.reload();
      else this.setHint('Sem munição! Procure caixas pelos corredores.', 2.0);
      return;
    }

    this.ammo--;
    this.shotsFired++;
    this.shotCooldown = 0.28;
    this.muzzleTimer = 0.09;
    this.audio.playGunshot();

    // Subtle upward recoil kick
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + 0.045, -0.85, 1.28);

    // Raycast from camera center
    _rayDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    _raycaster.set(this.camera.position, _rayDir);
    _raycaster.far = 22;

    if (this.creatureAlive && this.creatureVisible) {
      const hits = _raycaster.intersectObjects(this.creatureHitMeshes, false);
      if (
        hits.length > 0 &&
        hasLineOfSight(this.playerPos.x, this.playerPos.z, this.creaturePos.x, this.creaturePos.z, this.doorUnlocked)
      ) {
        this.hitsLanded++;
        this.creatureHp--;
        this.creatureStagger = 0.45;
        this.creatureFlashFreeze = 0;
        this.creatureAggro = true;
        this.spawnSparks(hits[0].point, 10);
        this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 14, 0.55);

        if (this.creatureHp <= 0) {
          this.creatureAlive = false;
          this.audio.playCreatureHit(true);
          this.setHint('A Coisa do Teto tombou nas vigas! Encontre a porta de SAÍDA.', 4.5);
        } else {
          this.audio.playCreatureHit(false);
          this.setHint('Acerto no teto! Ela sibilou e avançou pelas tábuas.', 2.0);
        }
        this.pushHud(true);
        return;
      }
    }

    // Impact sparks on wall/ceiling if nearby
    _v1.copy(this.camera.position).addScaledVector(_rayDir, 3.2);
    this.spawnSparks(_v1, 5);
    this.pushHud(true);
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

  private spawnCeilingDust(wx: number, wz: number, count: number, spread = 0.42): void {
    let spawned = 0;
    for (const d of this.ceilingDustPool) {
      if (d.life <= 0 && spawned < count) {
        d.mesh.position.set(
          wx + (Math.random() - 0.5) * spread * 2,
          WALL_HEIGHT - 0.06,
          wz + (Math.random() - 0.5) * spread * 2,
        );
        d.vel.set(
          (Math.random() - 0.5) * 0.28,
          -(1.15 + Math.random() * 1.45),
          (Math.random() - 0.5) * 0.28,
        );
        d.life = 1.1 + Math.random() * 0.85;
        d.mesh.visible = true;
        spawned++;
      }
    }
  }

  private setHint(text: string, duration: number): void {
    this.hintText = text;
    this.hintTimer = duration;
  }

  private requestPointerLock(): void {
    this.renderer.domElement.requestPointerLock?.();
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
    // Smooth camera look damping (works even on title screen for gentle breathing)
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 24, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 24, dt);

    let moveSpeed = 0;
    let isSprinting = false;

    if (this.phase === 'playing') {
      this.elapsedSec += dt;

      if (this.activeLocker) {
        this.velX = 0;
        this.velZ = 0;
        // Tuck player cleanly inside the locker looking through horizontal slats
        this.playerPos.lerp(this.activeLocker.insidePos, 1 - Math.exp(-14 * dt));
        // Clamp peek yaw within +-0.48 rad around locker face direction
        let yawDiff = this.targetYaw - this.activeLocker.faceYaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        yawDiff = THREE.MathUtils.clamp(yawDiff, -0.48, 0.48);
        this.targetYaw = this.activeLocker.faceYaw + yawDiff;
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, -0.35, 0.35);
      } else {
        // Combine keyboard + mobile virtual joystick
        const kbForward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
          (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
        const kbStrafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
        const kbTurn = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
        if (kbTurn !== 0) {
          this.targetYaw += kbTurn * 2.2 * dt;
        }

        const f = THREE.MathUtils.clamp(kbForward + this.touchMove.y, -1, 1);
        const s = THREE.MathUtils.clamp(kbStrafe + this.touchMove.x, -1, 1);
        const mag = Math.hypot(f, s);

        let targetVx = 0;
        let targetVz = 0;
        if (mag > 0.05) {
          isSprinting = (this.desktopSprint || this.touchMove.sprint) && mag > 0.45;
          const speed = isSprinting ? 3.75 : 2.05;
          const desiredSpeed = speed * Math.min(1, mag);

          const nf = f / mag;
          const ns = s / mag;
          const sinY = Math.sin(this.yaw);
          const cosY = Math.cos(this.yaw);
          // Forward in Three.js camera facing -Z at yaw=0 is (-sin(yaw), -cos(yaw))
          targetVx = (-sinY * nf + cosY * ns) * desiredSpeed;
          targetVz = (-cosY * nf - sinY * ns) * desiredSpeed;
        }

        this.velX = THREE.MathUtils.damp(this.velX, targetVx, 18, dt);
        this.velZ = THREE.MathUtils.damp(this.velZ, targetVz, 18, dt);
        moveSpeed = Math.hypot(this.velX, this.velZ);

        if (moveSpeed > 0.04) {
          const dx = this.velX * dt;
          const dz = this.velZ * dt;

          if (!isWallAtWorld(this.playerPos.x + dx, this.playerPos.z, 0.4, this.doorUnlocked)) {
            this.playerPos.x += dx;
          } else {
            this.velX = 0;
          }
          if (!isWallAtWorld(this.playerPos.x, this.playerPos.z + dz, 0.4, this.doorUnlocked)) {
            this.playerPos.z += dz;
          } else {
            this.velZ = 0;
          }

          const bobFreq = isSprinting ? 10.2 : 6.4;
          this.walkPhase += dt * bobFreq;
          this.stepDistAccum += moveSpeed * dt;
          const stepStride = isSprinting ? 1.45 : 1.15;
          if (this.stepDistAccum >= stepStride) {
            this.stepDistAccum = 0;
            this.audio.playPlayerFootstep(isSprinting);
          }
        }
      }

      // Animate locker doors when entering/exiting
      for (const lk of this.lockers) {
        if (lk.doorKick > 0) {
          lk.doorKick = Math.max(0, lk.doorKick - dt * 2.8);
          lk.rig.doorPivot.rotation.y = -Math.sin(lk.doorKick * Math.PI) * 1.15;
        } else {
          lk.rig.doorPivot.rotation.y = 0;
        }
      }

      // Reload completion
      if (this.reloadTimer > 0) {
        this.reloadTimer = Math.max(0, this.reloadTimer - dt);
        if (this.reloadTimer === 0) {
          const needed = 12 - this.ammo;
          const load = Math.min(needed, this.reserve);
          this.ammo += load;
          this.reserve -= load;
          this.pushHud(true);
        }
      }

      this.shotCooldown = Math.max(0, this.shotCooldown - dt);
      this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
      this.damagePulse = Math.max(0, this.damagePulse - dt * 1.6);
      if (this.hintTimer > 0) {
        this.hintTimer = Math.max(0, this.hintTimer - dt);
        if (this.hintTimer === 0) this.hintText = '';
      }

      // Master Key automatic pickup in Security Booth
      if (!this.hasKey) {
        this.keyMesh.rotation.y += dt * 1.8;
        const distKey = Math.hypot(this.playerPos.x - KEY_SPAWN.x, this.playerPos.z - KEY_SPAWN.z);
        if (distKey < 1.55) {
          this.hasKey = true;
          this.keyMesh.visible = false;
          this.keyVLight.intensity = 0;
          this.audio.playKeyPickup();
          this.entranceRig.keyStatusMat.emissive.setHex(0x80ff72);
          this.setHint(
            this.generatorOn
              ? 'Chave Mestre coletada! Destranque a Porta Principal ao sul.'
              : 'Chave Mestre coletada! Agora ligue o Gerador no lado Leste.',
            4.2,
          );
          this.pushHud(true);
        }
      }

      // Contextual interaction prompts (Locker, Generator, Main Entrance)
      let nextPrompt: string | null = null;
      if (this.activeLocker) {
        nextPrompt = 'Sair do Armário';
      } else {
        for (const lk of this.lockers) {
          const d = Math.hypot(this.playerPos.x - lk.pos.x, this.playerPos.z - lk.pos.z);
          if (d < 1.95) {
            nextPrompt = 'Esconder no Armário';
            break;
          }
        }
      }

      if (!nextPrompt) {
        const distGen = Math.hypot(
          this.playerPos.x - GENERATOR_POS.interactX,
          this.playerPos.z - GENERATOR_POS.interactZ,
        );
        const distDoor = Math.hypot(
          this.playerPos.x - MAIN_DOOR_CELL.interactX,
          this.playerPos.z - MAIN_DOOR_CELL.interactZ,
        );

        if (distGen < 2.6 && !this.generatorOn) {
          nextPrompt = 'Ligar Gerador Auxiliar';
        } else if (distDoor < 2.8 && !this.doorUnlocked) {
          if (this.hasKey && this.generatorOn) {
            nextPrompt = 'Destrancar Porta Principal';
            if (distDoor < 1.25) {
              this.unlockMainDoor();
            }
          } else {
            nextPrompt = !this.hasKey && !this.generatorOn
              ? 'Trancada (Chave + Gerador)'
              : !this.hasKey
              ? 'Trancada (Falta Chave)'
              : 'Sem Energia (Falta Gerador)';
          }
        }
      }
      if (nextPrompt !== this.interactPrompt) {
        this.interactPrompt = nextPrompt;
        this.pushHud(true);
      }

      // Dynamic Scripted Horror Events (exploding lamps, silhouettes, distant door slams)
      this.updateHorrorEvents(dt);

      // Pickups check
      for (const pk of this.pickups) {
        if (pk.collected) continue;
        pk.group.rotation.y += dt * 1.4;
        const d = Math.hypot(this.playerPos.x - pk.pos.x, this.playerPos.z - pk.pos.z);
        if (d < 1.15) {
          pk.collected = true;
          pk.group.visible = false;
          this.audio.playPickup();
          if (pk.kind === 'ammo') {
            this.reserve += 12;
            this.setHint('+12 Munição coletada', 2.2);
          } else {
            this.hp = Math.min(100, this.hp + 40);
            this.setHint('+40 Saúde restaurada', 2.2);
          }
          this.pushHud(true);
        }
      }

      // Update Creature AI
      this.updateCreature(dt);

      // Exit check
      const distExit = Math.hypot(
        this.playerPos.x - this.exitWorldPos.x,
        this.playerPos.z - this.exitWorldPos.z,
      );
      if (distExit < 1.45) {
        this.phase = 'escaped';
        document.exitPointerLock?.();
        this.pushHud(true);
      }
    }

    // Smooth Main Entrance Door & Generator Lever animations
    const targetDoor = this.doorUnlocked ? 1 : 0;
    if (Math.abs(this.doorOpenProgress - targetDoor) > 0.002) {
      this.doorOpenProgress = THREE.MathUtils.damp(this.doorOpenProgress, targetDoor, 5.5, dt);
      this.entranceRig.leftDoorPivot.rotation.y = -this.doorOpenProgress * 1.55;
      this.entranceRig.rightDoorPivot.rotation.y = this.doorOpenProgress * 1.55;
    }
    const targetLever = this.generatorOn ? 1 : 0;
    if (Math.abs(this.leverProgress - targetLever) > 0.002) {
      this.leverProgress = THREE.MathUtils.damp(this.leverProgress, targetLever, 12, dt);
      this.generatorRig.leverPivot.rotation.z = THREE.MathUtils.lerp(0.65, -0.65, this.leverProgress);
    }

    // Smooth Fog adaptation between Open Courtyard (0.056) and Corridors (0.095)
    if (this.scene.fog instanceof THREE.FogExp2) {
      const targetFog = this.playerPos.z < 0 ? 0.056 : 0.095;
      this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, targetFog, 4.5, dt);
    }

    // Camera position + subtle dynamic head-bobbing + FOV sprint kick
    const bobY = moveSpeed > 0.1 ? Math.sin(this.walkPhase) * (isSprinting ? 0.055 : 0.032) : Math.sin(this.clockElapsed * 1.6) * 0.008;
    const bobX = moveSpeed > 0.1 ? Math.cos(this.walkPhase * 0.5) * 0.024 : 0;
    this.camera.position.set(this.playerPos.x + bobX, 1.62 + bobY, this.playerPos.z);
    this.camera.rotation.set(this.pitch, this.yaw, moveSpeed > 0.1 ? Math.cos(this.walkPhase * 0.5) * 0.012 : 0);

    const targetFov = isSprinting ? 74 : this.cameraOn ? 72 : 68;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    // Weapon viewmodel sway (balanço da arma: mouse lag, figure-8 walk pendulum, breathing, sprint cant, recoil, reload)
    this.weaponLookVelX = THREE.MathUtils.damp(this.weaponLookVelX, 0, 12, dt);
    this.weaponLookVelY = THREE.MathUtils.damp(this.weaponLookVelY, 0, 12, dt);
    const moveFactor = THREE.MathUtils.clamp(moveSpeed / 2.2, 0, 1.35);
    const walkSwingX = moveSpeed > 0.08
      ? Math.cos(this.walkPhase * 0.5) * (isSprinting ? 0.022 : 0.014) * Math.min(1, moveFactor)
      : 0;
    const walkSwingY = moveSpeed > 0.08
      ? -Math.abs(Math.sin(this.walkPhase * 0.5)) * (isSprinting ? 0.024 : 0.014) * Math.min(1, moveFactor)
      : 0;
    const breathX = Math.cos(this.clockElapsed * 1.1) * 0.0028;
    const breathY = Math.sin(this.clockElapsed * 1.9) * 0.0042;
    const sprintCant = isSprinting && moveSpeed > 0.5 ? 1.0 : 0.0;

    const targetSwayX = this.weaponLookVelX + walkSwingX + breathX - sprintCant * 0.032;
    const targetSwayY = this.weaponLookVelY + walkSwingY + breathY - sprintCant * 0.022;
    this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, targetSwayX, 11, dt);
    this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, targetSwayY, 11, dt);

    const recoilOffset = this.shotCooldown > 0 ? Math.sin((this.shotCooldown / 0.28) * Math.PI) * 0.06 : 0;
    const reloadTilt = this.reloadTimer > 0 ? Math.sin((this.reloadTimer / 0.65) * Math.PI) * 0.45 : 0;
    this.weaponRig.group.position.set(
      0.23 + this.weaponSwayX,
      -0.21 + this.weaponSwayY - reloadTilt * 0.08,
      -0.36 + recoilOffset + sprintCant * 0.025,
    );
    this.weaponRig.group.rotation.set(
      recoilOffset * 2.2 - reloadTilt + this.weaponSwayY * 2.0 - sprintCant * 0.14,
      -this.weaponSwayX * 2.4 + sprintCant * 0.24,
      reloadTilt * 0.5 - this.weaponSwayX * 2.6 - walkSwingX * 3.5 + sprintCant * 0.18,
    );
    this.weaponRig.slide.position.z = -0.02 + recoilOffset * 0.65;
    this.weaponRig.muzzleFlashMesh.visible = this.muzzleTimer > 0;
    if (this.muzzleTimer > 0) {
      this.weaponRig.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
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

    // Update falling ceiling plaster/dust motes
    for (const d of this.ceilingDustPool) {
      if (d.life > 0) {
        d.life -= dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.position.x += Math.sin(this.clockElapsed * 6 + d.life * 9) * 0.14 * dt;
        if (d.life <= 0 || d.mesh.position.y <= 0.02) {
          d.life = 0;
          d.mesh.visible = false;
        }
      }
    }

    // Subtle organic drift on corridor dust motes
    if (this.dustPoints) {
      this.dustPoints.position.y = Math.sin(this.clockElapsed * 0.55) * 0.08;
      this.dustPoints.position.x = Math.cos(this.clockElapsed * 0.35) * 0.05;
    }

    // Cold Courtyard Rain Particles (updated when outdoors)
    if (this.rainPoints && this.rainPositions) {
      const showRain = this.playerPos.z < 2.2;
      this.rainPoints.visible = showRain;
      if (showRain) {
        const posAttr = this.rainPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < this.rainPositions.length; i += 3) {
          this.rainPositions[i + 1] -= 9.5 * dt;
          if (this.rainPositions[i + 1] < 0) {
            this.rainPositions[i + 1] = 8.5;
          }
        }
        posAttr.needsUpdate = true;
      }
    }

    // Update 1-bit dithering shader uniforms & reactive palette
    if (this.ditherPass) {
      this.ditherPass.uniforms.uDamagePulse.value = this.damagePulse;
      this.ditherPass.uniforms.uMuzzleBoost.value = this.muzzleTimer > 0 ? this.muzzleTimer / 0.09 : 0;
      this.ditherPass.uniforms.uTime.value = this.clockElapsed;
      this.syncPaletteUniforms();
    }

    // Sync 3D Spatial Audio Listener & Sources
    this.audio.updateListenerAndSpatial(
      this.camera,
      this.creaturePos,
      this.creatureAlive && this.creatureVisible,
      this.creatureAggro,
      this.creatureAlive &&
        this.creatureVisible &&
        this.creatureStagger <= 0 &&
        this.creatureFlashFreeze <= 0 &&
        this.phase === 'playing' &&
        this.playerPos.z > 0.2,
      this.lampIntensities,
      this.hp,
      this.clockElapsed,
    );

    // Throttle React HUD updates (~10Hz) so React never touches WebGL frame cadence
    if (this.clockElapsed - this.lastHudPush > 0.1) {
      this.pushHud(false);
    }
  }

  private updateDynamicLighting(dt: number, moveSpeed: number, isSprinting: boolean): void {
    // Flashlight & IR emitter follow camera gaze with physical lag + movement sway
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    _targetPos.copy(this.camera.position).addScaledVector(_v1, 6.0);
    _targetPos.y += Math.sin(this.walkPhase) * (moveSpeed > 0.1 ? 0.16 : 0.02);
    _targetPos.x += Math.cos(this.walkPhase * 0.5) * (moveSpeed > 0.1 ? 0.14 : 0.01);

    this.flashlight.position.copy(this.camera.position).addScaledVector(_v1, 0.25);
    this.flashlight.position.y -= 0.12;
    this.irFloodLight.position.copy(this.camera.position).addScaledVector(_v1, 0.15);
    this.flashlightTarget.position.lerp(_targetPos, 1 - Math.exp(-16 * dt));

    // Horror proximity & sprint voltage flicker on player's flashlight / IR camera
    const creatureDist = this.creatureAlive
      ? this.playerPos.distanceTo(this.creaturePos)
      : 99;
    let flicker = 1.0;
    const anyGearActive = this.flashlightOn || this.cameraOn;
    if (anyGearActive) {
      if (creatureDist < 6.0) {
        const threat = 1 - creatureDist / 6.0;
        const pulse = Math.sin(this.clockElapsed * 29.0) * Math.sin(this.clockElapsed * 47.0);
        if (pulse > 0.55 - threat * 0.35) {
          flicker = 0.2 + Math.random() * 0.45;
        }
      } else if (isSprinting) {
        flicker = 0.88 + Math.sin(this.walkPhase * 2.0) * 0.12;
      } else if (this.battery <= 25) {
        const lowPulse = Math.sin(this.clockElapsed * 19.0) * Math.sin(this.clockElapsed * 31.0);
        if (lowPulse > 0.65) flicker = 0.45 + Math.random() * 0.35;
      }
      const drainRate = (this.flashlightOn ? 0.42 : 0) + (this.cameraOn ? 0.28 : 0);
      this.battery = Math.max(12, this.battery - dt * drainRate);
    } else {
      this.battery = Math.min(100, this.battery + dt * 1.6);
    }

    const boost = this.settings.lightBoost;
    const isInside = this.playerPos.z >= 0.2;
    this.hemiLight.intensity = THREE.MathUtils.damp(
      this.hemiLight.intensity,
      (isInside ? 0.02 : 0.17) * boost,
      4.5,
      dt,
    );
    this.dirKeyLight.intensity = THREE.MathUtils.damp(
      this.dirKeyLight.intensity,
      (isInside ? 0.006 : 0.115) * boost,
      4.5,
      dt,
    );
    this.scene.environmentIntensity = THREE.MathUtils.damp(
      this.scene.environmentIntensity,
      isInside ? 0.015 : 0.055,
      4.5,
      dt,
    );

    const flashTarget = this.flashlightOn ? 19.5 * flicker * boost : 0.0;
    this.flashlight.intensity = THREE.MathUtils.damp(this.flashlight.intensity, flashTarget, 22, dt);

    const irTarget = this.cameraOn ? 13.5 * flicker * boost : 0.0;
    this.irFloodLight.intensity = THREE.MathUtils.damp(this.irFloodLight.intensity, irTarget, 22, dt);

    this.flashlightBounce.position.copy(this.camera.position);
    this.flashlightBounce.intensity = this.flashlightOn
      ? 1.25 * flicker * boost
      : this.cameraOn
      ? 1.15 * flicker * boost
      : 0.01 * boost;
    this.weaponRig.torchLensMat.emissiveIntensity = this.flashlightOn ? 2.6 * flicker : 0.0;

    // Muzzle flash burst (always visible=true, intensity=0 when idle -> zero shader recompile)
    this.muzzleLight.position.copy(this.camera.position).addScaledVector(_v1, 0.65);
    this.muzzleLight.intensity = this.muzzleTimer > 0 ? 22.0 * (this.muzzleTimer / 0.09) : 0;

    const indoorsZone = this.playerPos.z > 2.2;
    const outdoorsZone = this.playerPos.z < -2.2;

    // Broken-ballast flickering corridor ceiling lamps (calibrated for Contraste 1x etching)
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      if (lamp.bursted && lamp.burstTimer > 0) {
        lamp.burstTimer = Math.max(0, lamp.burstTimer - dt);
        lamp.currentIntensity = 0.03;
        lamp.vLight.intensity = 0;
        lamp.bulbMat.emissiveIntensity = 0.04;
        this.lampIntensities[i] = 0;
        continue;
      }

      const dSq = this.playerPos.distanceToSquared(lamp.pos);
      if (outdoorsZone || dSq > 324) {
        lamp.vLight.intensity = 0;
        this.lampIntensities[i] = 0;
        continue;
      }

      const t = this.clockElapsed + lamp.seed;
      const wave = Math.sin(t * 2.3) * Math.sin(t * 7.7) * Math.sin(t * 17.3);
      const buzzDrop = wave > 0.52 ? 0.14 : 0.85 + Math.sin(t * 3.1) * 0.15;
      const mobProx = this.creatureAlive ? Math.max(0, 1 - lamp.pos.distanceTo(this.creaturePos) / 5.5) : 0;
      const postBurstCap = lamp.bursted ? 0.35 : 1.0;
      const finalRatio = THREE.MathUtils.clamp(buzzDrop * (1 - mobProx * 0.45) * postBurstCap, 0.06, 1.1);
      lamp.currentIntensity = 3.1 * finalRatio * boost;
      lamp.vLight.intensity = lamp.currentIntensity;
      lamp.bulbMat.emissiveIntensity = 2.1 * finalRatio;
      this.lampIntensities[i] = finalRatio;
    }

    // Distance/zone cull indoor window moonlight spills
    for (let i = 0; i < this.moonSpills.length; i++) {
      const ms = this.moonSpills[i];
      ms.intensity = !outdoorsZone && this.playerPos.distanceToSquared(ms.pos) < 324 ? 0.95 * boost : 0;
    }

    // Pulsing Exit Door emergency beacon
    this.exitVLight.intensity =
      !outdoorsZone && this.playerPos.distanceToSquared(this.exitVLight.pos) < 324
        ? (2.1 + Math.sin(this.clockElapsed * 3.2) * 0.9) * boost
        : 0;

    // Exterior Courtyard Lampposts, Master Key glint & Main Entrance Portico Light
    this.mainDoorVLight.intensity = !indoorsZone ? (this.generatorOn ? 3.5 : 1.45) * boost : 0;
    this.keyVLight.intensity = !this.hasKey && !indoorsZone ? 1.35 : 0;

    for (const ol of this.outdoorLamps) {
      if (indoorsZone || this.playerPos.distanceToSquared(ol.pos) > 400) {
        ol.vLight.intensity = 0;
        continue;
      }
      if (ol.requiresPower && !this.generatorOn) {
        ol.vLight.intensity = 0;
        ol.bulbMat.emissiveIntensity = 0.05;
      } else {
        const t = this.clockElapsed + ol.seed;
        const flickerRatio = ol.requiresPower
          ? 0.94 + Math.sin(t * 9.0) * 0.06
          : Math.sin(t * 2.1) * Math.sin(t * 11.4) > 0.68
          ? 0.25
          : 0.92;
        ol.vLight.intensity = 3.0 * flickerRatio * boost;
        ol.bulbMat.emissiveIntensity = 1.9 * flickerRatio;
      }
    }

    // Allocate the 6 highest-contribution virtual lights to the fixed PointLight pool (zero allocations)
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

      // Insert into sorted descending top-6 slots
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

    // Storm Lightning & Distant Thunder outdoors (always visible=true, intensity=0 indoors/calm)
    if (this.phase === 'playing' && this.playerPos.z < 0) {
      this.nextThunderIn -= dt;
      if (this.nextThunderIn <= 0) {
        this.nextThunderIn = 14 + Math.random() * 14;
        this.lightningFlash = 0.85;
        this.audio.playThunder();
      }
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);
    this.lightningLight.intensity =
      this.playerPos.z < 4.5 && this.lightningFlash > 0.1
        ? (this.lightningFlash > 0.45 ? 3.5 : 1.4) * Math.sin(this.lightningFlash * 28) ** 2
        : 0;
  }

  private updateHorrorEvents(dt: number): void {
    // 1. Courtyard 2nd-story window silhouette during lightning
    if (
      !this.courtyardShadowTriggered &&
      this.playerPos.z < -1.0 &&
      this.elapsedSec > 5 &&
      this.lightningFlash > 0.42
    ) {
      this.courtyardShadowTriggered = true;
      this.courtyardSilhouette.visible = true;
      this.courtyardSilhouetteTimer = 1.25;
    }
    if (this.courtyardSilhouetteTimer > 0) {
      this.courtyardSilhouetteTimer = Math.max(0, this.courtyardSilhouetteTimer - dt);
      if (this.courtyardSilhouetteTimer === 0) {
        this.courtyardSilhouette.visible = false;
      }
    }

    // 2. Exploding corridor lamps when player approaches them
    const burstTargets = [0, 3];
    for (let idx = 0; idx < burstTargets.length; idx++) {
      if (this.lampBurstTriggered[idx]) continue;
      const lamp = this.lamps[burstTargets[idx]];
      if (!lamp) continue;
      const d = Math.hypot(this.playerPos.x - lamp.pos.x, this.playerPos.z - lamp.pos.z);
      if (d < 4.4) {
        this.lampBurstTriggered[idx] = true;
        lamp.bursted = true;
        lamp.burstTimer = 7.0;
        this.spawnSparks(lamp.pos, 14);
        this.audio.playLampBurst(lamp.pos);
        this.setHint('Uma lâmpada estourou no corredor!', 2.4);
      }
    }

    // 3. Distant heavy steel door slams echoing through corridors
    if (!this.doorSlamTriggered[0] && this.playerPos.z > 4.0) {
      this.doorSlamTriggered[0] = true;
      _v1.set(12 * CELL_SIZE, 1.5, 5.5 * CELL_SIZE);
      this.audio.playDoorSlam(_v1);
      this.setHint('Uma porta pesada bateu na ala leste...', 2.8);
    }
    if (!this.doorSlamTriggered[1] && this.playerPos.z > 17.5) {
      this.doorSlamTriggered[1] = true;
      _v1.set(8.5 * CELL_SIZE, 1.5, 11.5 * CELL_SIZE);
      this.audio.playDoorSlam(_v1);
    }

    // 4. Shadow darting past barred corridor window-2
    if (
      !this.corridorShadowTriggered &&
      this.playerPos.z > 2.0 &&
      Math.hypot(this.playerPos.x - 10.5 * CELL_SIZE, this.playerPos.z - 1.5 * CELL_SIZE) < 4.5
    ) {
      this.corridorShadowTriggered = true;
      this.corridorSilhouette.visible = true;
      this.corridorSilhouetteTimer = 0.85;
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

  private relocateCreatureOnCeiling(): void {
    // Pick an interior corridor ceiling spot 6.5..14m away from the player
    for (let attempt = 0; attempt < 28; attempt++) {
      const gx = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
      const gz = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));
      if (isWallAtGrid(gx, gz)) continue;
      const wx = (gx + 0.5) * CELL_SIZE;
      const wz = (gz + 0.5) * CELL_SIZE;
      const dist = Math.hypot(wx - this.playerPos.x, wz - this.playerPos.z);
      if (dist >= 6.5 && dist <= 14.5) {
        this.creaturePos.set(wx, WALL_HEIGHT, wz);
        this.creatureRig.group.position.copy(this.creaturePos);
        return;
      }
    }
    this.creaturePos.set(CREATURE_SPAWN.x, WALL_HEIGHT, CREATURE_SPAWN.z);
    this.creatureRig.group.position.copy(this.creaturePos);
  }

  private updateCeilingShadow(): void {
    if (!this.creatureAlive || !this.creatureVisible || this.playerPos.z < 0.2) {
      this.creatureShadowMesh.visible = false;
      return;
    }

    // Find nearest lit indoor ceiling lamp to project a moving silhouette shadow against the light
    let nearestLamp: LampEntry | null = null;
    let bestDistSq = 49; // 7m radius
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i];
      if (lamp.currentIntensity < 0.25 || lamp.vLight.intensity < 0.25) continue;
      const dSq =
        (this.creaturePos.x - lamp.pos.x) ** 2 + (this.creaturePos.z - lamp.pos.z) ** 2;
      if (dSq < bestDistSq && dSq > 0.08) {
        bestDistSq = dSq;
        nearestLamp = lamp;
      }
    }

    if (!nearestLamp) {
      this.creatureShadowMesh.visible = false;
      return;
    }

    const distH = Math.sqrt(bestDistSq);
    _shadowDir.set(
      this.creaturePos.x - nearestLamp.pos.x,
      0,
      this.creaturePos.z - nearestLamp.pos.z,
    );
    _shadowDir.normalize();

    const offset = 0.65 + distH * 0.22;
    this.creatureShadowMesh.visible = true;
    this.creatureShadowMesh.position.set(
      this.creaturePos.x + _shadowDir.x * offset,
      WALL_HEIGHT - 0.015,
      this.creaturePos.z + _shadowDir.z * offset,
    );
    this.creatureShadowMesh.rotation.y = Math.atan2(_shadowDir.x, _shadowDir.z);
    this.creatureShadowMesh.scale.set(
      0.85 + Math.sin(this.creatureWalkCycle) * 0.12,
      1,
      1.1 + distH * 0.24,
    );
  }

  private updateCreature(dt: number): void {
    // Always keep A Coisa do Teto clinging to the ceiling — NEVER on the floor
    this.creaturePos.y = WALL_HEIGHT;

    if (!this.creatureAlive) {
      // Hangs limp high against the ceiling beams, swaying subtly (never drops to floor)
      this.creatureShadowMesh.visible = false;
      this.creatureRig.group.position.set(this.creaturePos.x, WALL_HEIGHT, this.creaturePos.z);
      this.creatureRig.bodyPivot.position.y = THREE.MathUtils.damp(
        this.creatureRig.bodyPivot.position.y,
        -0.24,
        6,
        dt,
      );
      this.creatureRig.bodyPivot.rotation.z = THREE.MathUtils.damp(
        this.creatureRig.bodyPivot.rotation.z,
        0.34,
        6,
        dt,
      );
      this.creatureRig.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.creatureRig.bodyPivot.rotation.x,
        0.22,
        6,
        dt,
      );
      this.creatureRig.head.rotation.z = Math.sin(this.clockElapsed * 1.4) * 0.08;
      for (const mat of this.creatureRig.materials) {
        mat.color.setHex(0x454548);
      }
      return;
    }

    // Haunted corridor ceiling dust crumble even when she is lurking elsewhere indoors
    if (this.playerPos.z > 0.5) {
      this.hauntedDustTimer -= dt;
      if (this.hauntedDustTimer <= 0) {
        this.hauntedDustTimer = 1.6 + Math.random() * 2.2;
        const aheadX = this.playerPos.x + (Math.random() - 0.5) * 4.2;
        const aheadZ = this.playerPos.z + (Math.random() - 0.5) * 4.2;
        if (!isWallAtWorld(aheadX, aheadZ, 0.2, this.doorUnlocked)) {
          this.spawnCeilingDust(aheadX, aheadZ, 5, 0.32);
          if (Math.random() < 0.55) {
            _v1.set(aheadX, WALL_HEIGHT - 0.1, aheadZ);
            this.audio.playDustCrumble(_v1);
          }
        }
      }
    }

    // Wait outdoors while player is still in courtyard
    if (this.playerPos.z < 0.2) {
      this.creatureRig.group.visible = true;
      this.creatureShadowMesh.visible = false;
      this.creatureRig.group.position.copy(this.creaturePos);
      return;
    }

    // First time entering the main wing: place her overhead near corridor lamp-2 crawling along the hallway
    if (!this.enteredSanatorium && this.playerPos.z > 2.2) {
      this.enteredSanatorium = true;
      this.creaturePos.set(9.2 * CELL_SIZE, WALL_HEIGHT, 1.5 * CELL_SIZE);
      this.creatureHeading = Math.atan2(
        this.playerPos.x - this.creaturePos.x,
        this.playerPos.z - this.creaturePos.z,
      ) + 0.65;
      this.creatureRig.group.position.copy(this.creaturePos);
      this.creatureRig.group.rotation.y = this.creatureHeading;
      this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 10, 0.45);
      this.audio.triggerCeilingScrape(this.creaturePos, 0.34, false);
    }

    this.lookUpVanishCooldown = Math.max(0, this.lookUpVanishCooldown - dt);
    this.creatureAttackCooldown = Math.max(0, this.creatureAttackCooldown - dt);

    // Vanished state between ceiling relocations
    if (!this.creatureVisible) {
      this.creatureShadowMesh.visible = false;
      this.creatureRig.group.visible = false;
      this.creatureVanishTimer -= dt;
      if (this.creatureVanishTimer <= 0) {
        this.relocateCreatureOnCeiling();
        this.creatureVisible = true;
        this.creatureRig.group.visible = true;
        if (this.creatureVanishCount >= 3) {
          this.creatureAggro = true;
          this.creatureVanishCount = 0;
        }
        this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 10, 0.48);
        this.audio.triggerCeilingScrape(this.creaturePos, 0.28, true);
      }
      return;
    }

    this.creatureRig.group.visible = true;

    if (this.creatureStagger > 0) {
      this.creatureStagger = Math.max(0, this.creatureStagger - dt);
      this.creatureRig.bodyPivot.position.y = -0.02 - Math.sin(this.creatureStagger * 24) * 0.07;
      return;
    }

    const dx = this.playerPos.x - this.creaturePos.x;
    const dz = this.playerPos.z - this.creaturePos.z;
    const dist = Math.hypot(dx, dz);

    // 3D gaze & flashlight exposure checks toward the ceiling creature
    _toCreature.set(
      this.creaturePos.x - this.camera.position.x,
      WALL_HEIGHT - 0.35 - this.camera.position.y,
      this.creaturePos.z - this.camera.position.z,
    );
    const dist3D = Math.max(0.01, _toCreature.length());
    _toCreature.divideScalar(dist3D);
    _camFwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const aimDot = _camFwd.dot(_toCreature);

    const hasLos =
      dist < 16.0 &&
      hasLineOfSight(this.creaturePos.x, this.creaturePos.z, this.playerPos.x, this.playerPos.z, this.doorUnlocked);
    const playerLookingAtHer = !this.activeLocker && dist < 13.5 && aimDot > 0.87 && hasLos;

    // 1. Flashlight recoil & vanish ("Um vulto que desaparece quando a lanterna aponta para ele")
    if (this.creatureFlashFreeze > 0) {
      this.creatureFlashFreeze -= dt;
      // Violent twitch in the beam right before darting into ceiling darkness
      this.creatureRig.head.rotation.z = (Math.random() - 0.5) * 0.45;
      this.creatureRig.bodyPivot.position.x = (Math.random() - 0.5) * 0.08;
      if (this.creatureFlashFreeze <= 0) {
        this.creatureRig.bodyPivot.position.x = 0;
        this.creatureVisible = false;
        this.creatureRig.group.visible = false;
        this.creatureShadowMesh.visible = false;
        this.creatureVanishTimer = 2.0 + Math.random() * 1.5;
        this.creatureVanishCount++;
        this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 16, 0.55);
        this.audio.playCeilingVanish(this.creaturePos);
        if (!this.lookUpHintShown) {
          this.lookUpHintShown = true;
          this.setHint('Ela sumiu da luz da lanterna pelas tábuas do teto!', 2.8);
        }
      }
      return;
    }

    if (!this.creatureAggro && this.flashlightOn && playerLookingAtHer) {
      this.creatureFlashFreeze = 0.34;
      this.audio.triggerCeilingScrape(this.creaturePos, 0.42, true);
      this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 8, 0.4);
      return;
    }

    // 2. "Algumas vezes, ao olhar para cima, ele não estará mais lá"
    if (
      !this.creatureAggro &&
      !this.activeLocker &&
      this.lookUpVanishCooldown <= 0 &&
      dist < 7.5 &&
      this.pitch > 0.3 &&
      aimDot < 0.82
    ) {
      this.lookUpVanishCooldown = 6.0;
      if (Math.random() < 0.55) {
        this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, 12, 0.48);
        this.audio.playCeilingVanish(this.creaturePos);
        this.creatureVisible = false;
        this.creatureRig.group.visible = false;
        this.creatureShadowMesh.visible = false;
        this.creatureVanishTimer = 1.6 + Math.random() * 1.4;
        if (!this.lookUpHintShown) {
          this.lookUpHintShown = true;
          this.setHint('Poeira caindo... mas não há nada quando você olha para cima.', 2.6);
        }
        return;
      }
    }

    // Aggro & stealth detection (IR Camera does not scare her off, letting you observe her!)
    const sightRange = this.flashlightOn ? 11.0 : this.cameraOn ? 6.5 : 5.2;
    const seesPlayer = this.activeLocker
      ? this.flashlightOn && dist < 5.2 && hasLos
      : hasLos && dist < sightRange;

    if (seesPlayer && (this.cameraOn || dist < 4.4 || this.creatureVanishCount >= 2)) {
      this.creatureAggro = true;
      this.creatureLostSightSec = 0;
    } else if (!this.activeLocker && dist < 4.0 && hasLos) {
      this.creatureAggro = true;
      this.creatureLostSightSec = 0;
    } else if (this.creatureAggro) {
      this.creatureLostSightSec += dt * (this.activeLocker && !this.flashlightOn ? 2.2 : 1.0);
      if (this.creatureLostSightSec > 4.5) {
        this.creatureAggro = false;
        this.creatureLostSightSec = 0;
      }
    }

    let speed = 0;
    let moveAngle = 0;

    if (this.creatureAggro) {
      moveAngle = Math.atan2(dx, dz);
      speed = dist < 4.5 ? 2.15 : 1.45;
      if (dist > 0.95) {
        const vx = Math.sin(moveAngle) * speed * dt;
        const vz = Math.cos(moveAngle) * speed * dt;
        if (
          this.creaturePos.z >= 0.8 * CELL_SIZE &&
          !isWallAtWorld(this.creaturePos.x + vx, this.creaturePos.z, 0.36, false)
        ) {
          this.creaturePos.x += vx;
        }
        if (
          this.creaturePos.z + vz >= 0.8 * CELL_SIZE &&
          !isWallAtWorld(this.creaturePos.x, this.creaturePos.z + vz, 0.36, false)
        ) {
          this.creaturePos.z += vz;
        }
      }

      // Ceiling downward claw lunge (arms/torso reach down from ceiling without touching floor!)
      const strikeReach = this.activeLocker ? (seesPlayer ? 1.6 : 0) : 1.38;
      if (dist < strikeReach && this.creatureAttackCooldown <= 0) {
        if (this.activeLocker) {
          this.activeLocker.doorKick = 1.0;
          this.playerPos.copy(this.activeLocker.exitPos);
          this.activeLocker = null;
          this.weaponRig.group.visible = true;
          this.audio.playLockerDoor(true);
          this.setHint('A Coisa do Teto arrancou você do armário!', 2.6);
        }
        this.creatureLungeTimer = 0.42;
        this.hp = Math.max(0, this.hp - 22);
        this.damagePulse = 1.0;
        this.creatureAttackCooldown = 1.2;
        this.audio.playPlayerHurt();
        this.audio.triggerCeilingScrape(this.creaturePos, 0.48, true);
        if (this.hp <= 0) {
          this.phase = 'dead';
          document.exitPointerLock?.();
        }
        this.pushHud(true);
      }
    } else {
      // Stalking upside-down along corridor ceilings with organic crawl-and-listen bursts
      this.creaturePatrolAngle += dt * 0.36;
      const toPlayerAngle = Math.atan2(dx, dz);
      moveAngle = dist > 9.5 ? toPlayerAngle : toPlayerAngle + Math.sin(this.creaturePatrolAngle) * 1.15;

      if (this.creaturePatrolPauseTimer > 0) {
        this.creaturePatrolPauseTimer -= dt;
        speed = 0;
        if (this.creaturePatrolPauseTimer <= 0) {
          this.creaturePatrolBurstTimer = 1.6 + Math.random() * 1.6;
        }
      } else {
        this.creaturePatrolBurstTimer -= dt;
        speed = 0.86;
        const vx = Math.sin(moveAngle) * speed * dt;
        const vz = Math.cos(moveAngle) * speed * dt;
        if (
          this.creaturePos.z + vz >= 1.2 * CELL_SIZE &&
          !isWallAtWorld(this.creaturePos.x + vx, this.creaturePos.z + vz, 0.38, false)
        ) {
          this.creaturePos.x += vx;
          this.creaturePos.z += vz;
        } else {
          this.creaturePatrolAngle += 1.75;
        }
        if (this.creaturePatrolBurstTimer <= 0) {
          this.creaturePatrolPauseTimer = 0.4 + Math.random() * 0.55;
        }
      }
    }

    // Continuous falling ceiling plaster dust trail beneath her crawl path
    this.ceilingDustEmitTimer -= dt;
    if (this.ceilingDustEmitTimer <= 0 && speed > 0.2) {
      this.ceilingDustEmitTimer = this.creatureAggro ? 0.14 : 0.28;
      this.spawnCeilingDust(this.creaturePos.x, this.creaturePos.z, this.creatureAggro ? 3 : 2, 0.35);
    }

    // Turn body smoothly along travel heading while keeping a 3/4 silhouette out of edge-on profile
    this.creatureRig.group.position.copy(this.creaturePos);
    const toCamAngle = Math.atan2(
      this.camera.position.x - this.creaturePos.x,
      this.camera.position.z - this.creaturePos.z,
    );
    const desiredHeading = this.creatureAggro || this.creatureFlashFreeze > 0 ? toCamAngle : moveAngle;
    let headDiff = desiredHeading - this.creatureHeading;
    while (headDiff > Math.PI) headDiff -= Math.PI * 2;
    while (headDiff < -Math.PI) headDiff += Math.PI * 2;
    const turnRate = this.creatureAggro ? 7.2 : 2.8;
    this.creatureHeading += headDiff * (1 - Math.exp(-turnRate * dt));

    let relToCam = toCamAngle - this.creatureHeading;
    while (relToCam > Math.PI) relToCam -= Math.PI * 2;
    while (relToCam < -Math.PI) relToCam += Math.PI * 2;
    const absRel = Math.abs(relToCam);
    const sideProximity = 0.44 - Math.abs(absRel - Math.PI * 0.5);
    let visualYaw = this.creatureHeading;
    if (sideProximity > 0) {
      const sideSign = relToCam >= 0 ? 1 : -1;
      const towardFrontOrBack = absRel < Math.PI * 0.5 ? sideSign : -sideSign;
      visualYaw += towardFrontOrBack * sideProximity;
    }

    let yawDiff = visualYaw - this.creatureRig.group.rotation.y;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    this.creatureRig.group.rotation.y += yawDiff * (1 - Math.exp(-7.5 * dt));

    // Front vs Back torso selection with +-0.16 rad hysteresis to prevent strafe flicker
    let viewAngle = toCamAngle - this.creatureRig.group.rotation.y;
    while (viewAngle > Math.PI) viewAngle -= Math.PI * 2;
    while (viewAngle < -Math.PI) viewAngle += Math.PI * 2;
    const absView = Math.abs(viewAngle);
    if (!this.creatureBodyBack && absView > Math.PI * 0.5 + 0.16) {
      this.creatureBodyBack = true;
    } else if (this.creatureBodyBack && absView < Math.PI * 0.5 - 0.16) {
      this.creatureBodyBack = false;
    }

    this.creatureRig.bodyFrontMesh.visible = !this.creatureBodyBack;
    this.creatureRig.bodyBackMesh.visible = this.creatureBodyBack;

    // Smoothly wrench head around over spine when spotted from behind before swapping hair -> face
    const neckAlert =
      this.creatureBodyBack &&
      (this.creatureAggro ||
        this.creatureFlashFreeze > 0 ||
        (hasLos && dist < 8.5 && (this.flashlightOn || this.cameraOn)));
    const targetHeadYaw = neckAlert ? (viewAngle >= 0 ? 2.65 : -2.65) : 0;
    this.creatureHeadYaw = THREE.MathUtils.damp(
      this.creatureHeadYaw,
      targetHeadYaw,
      neckAlert ? 11.0 : 5.5,
      dt,
    );
    const headRotatedAround = Math.abs(this.creatureHeadYaw) > Math.PI * 0.5;
    const showFrontHead = !this.creatureBodyBack || headRotatedAround;
    this.creatureRig.headFrontMesh.visible = showFrontHead;
    this.creatureRig.headBackMesh.visible = !showFrontHead;
    // Mirror head Y rotation back into front-facing range once flipped so mesh never shows inverted side
    this.creatureRig.head.rotation.y =
      this.creatureBodyBack && headRotatedAround
        ? this.creatureHeadYaw - Math.sign(this.creatureHeadYaw) * Math.PI
        : this.creatureHeadYaw;

    // Asymmetric 4-limb spider-crawl stride (quick forward reach, steady gripping pull on ceiling planks)
    const strideAdvance =
      speed > 0.05 ? dt * (this.creatureAggro ? 8.8 : 4.2) : dt * 0.55;
    this.creatureWalkCycle += strideAdvance;

    const evalSpiderLimb = (phase: number, out: { s: number; l: number }) => {
      const norm = (((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      if (norm < 0.36) {
        const u = norm / 0.36;
        const sm = u * u * (3 - 2 * u);
        out.s = -1 + 2 * sm;
        out.l = Math.sin(u * Math.PI);
      } else {
        const u = (norm - 0.36) / 0.64;
        const sm = u * u * (3 - 2 * u);
        out.s = 1 - 2 * sm;
        out.l = 0;
      }
    };

    const mGain = speed > 0.05 ? 1.0 : 0.14;
    const armL = { s: 0, l: 0 };
    const armR = { s: 0, l: 0 };
    const legL = { s: 0, l: 0 };
    const legR = { s: 0, l: 0 };
    evalSpiderLimb(this.creatureWalkCycle, armL);
    evalSpiderLimb(this.creatureWalkCycle + Math.PI + 0.28, armR);
    evalSpiderLimb(this.creatureWalkCycle + Math.PI + 0.18, legL);
    evalSpiderLimb(this.creatureWalkCycle + 0.22, legR);

    // Downward ceiling lunge drop + subtle organic crawl weight shift & breathing
    this.creatureLungeTimer = Math.max(0, this.creatureLungeTimer - dt);
    const lungeDrop = this.creatureLungeTimer > 0 ? Math.sin((this.creatureLungeTimer / 0.42) * Math.PI) * 0.62 : 0;
    const breath = Math.sin(this.clockElapsed * 2.2) * 0.016;
    const bodyPullSurge = (armL.s + armR.s) * 0.028 * mGain;

    this.creatureRig.bodyPivot.position.y = THREE.MathUtils.damp(
      this.creatureRig.bodyPivot.position.y,
      -0.02 - lungeDrop + breath - Math.abs(armL.s - armR.s) * 0.022 * mGain,
      14,
      dt,
    );
    this.creatureRig.bodyPivot.position.z = THREE.MathUtils.damp(
      this.creatureRig.bodyPivot.position.z,
      bodyPullSurge,
      12,
      dt,
    );
    this.creatureRig.bodyPivot.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.bodyPivot.rotation.z,
      (armL.s - armR.s) * 0.065 * mGain,
      12,
      dt,
    );
    this.creatureRig.bodyPivot.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.bodyPivot.rotation.x,
      lungeDrop * 0.35 + Math.sin(this.clockElapsed * 1.9) * 0.025,
      12,
      dt,
    );

    // Smoothly damped arm & leg articulation anchored cleanly to sleeves and hips
    const dRate = 15;
    this.creatureRig.leftArm.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.leftArm.rotation.z,
      -0.18 - armL.s * 0.18 * mGain + armL.l * 0.14 * mGain,
      dRate,
      dt,
    );
    this.creatureRig.leftArm.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.leftArm.rotation.x,
      -0.22 + armL.s * 0.26 * mGain - lungeDrop * 0.45,
      dRate,
      dt,
    );
    this.creatureRig.leftArm.rotation.y = THREE.MathUtils.damp(
      this.creatureRig.leftArm.rotation.y,
      armL.s * 0.22 * mGain,
      dRate,
      dt,
    );

    this.creatureRig.rightArm.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.rightArm.rotation.z,
      0.18 + armR.s * 0.18 * mGain - armR.l * 0.14 * mGain,
      dRate,
      dt,
    );
    this.creatureRig.rightArm.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.rightArm.rotation.x,
      -0.22 + armR.s * 0.26 * mGain - lungeDrop * 0.45,
      dRate,
      dt,
    );
    this.creatureRig.rightArm.rotation.y = THREE.MathUtils.damp(
      this.creatureRig.rightArm.rotation.y,
      -armR.s * 0.22 * mGain,
      dRate,
      dt,
    );

    this.creatureRig.leftLeg.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.leftLeg.rotation.z,
      0.82 - legL.s * 0.14 * mGain - legL.l * 0.11 * mGain,
      dRate,
      dt,
    );
    this.creatureRig.leftLeg.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.leftLeg.rotation.x,
      0.18 + legL.s * 0.2 * mGain + lungeDrop * 0.22,
      dRate,
      dt,
    );
    this.creatureRig.leftLeg.rotation.y = THREE.MathUtils.damp(
      this.creatureRig.leftLeg.rotation.y,
      0.42 - legL.s * 0.2 * mGain,
      dRate,
      dt,
    );

    this.creatureRig.rightLeg.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.rightLeg.rotation.z,
      -0.82 + legR.s * 0.14 * mGain + legR.l * 0.11 * mGain,
      dRate,
      dt,
    );
    this.creatureRig.rightLeg.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.rightLeg.rotation.x,
      0.18 + legR.s * 0.2 * mGain + lungeDrop * 0.22,
      dRate,
      dt,
    );
    this.creatureRig.rightLeg.rotation.y = THREE.MathUtils.damp(
      this.creatureRig.rightLeg.rotation.y,
      -0.42 + legR.s * 0.2 * mGain,
      dRate,
      dt,
    );

    // Organic curious head tilt, subtle breathing sway & eerie twitch when locked on player
    const twitch =
      this.creatureAggro || (this.creatureBodyBack && headRotatedAround)
        ? Math.sin(this.clockElapsed * 17.5) * 0.055
        : 0;
    const idleTilt = speed < 0.05 ? Math.sin(this.clockElapsed * 1.4) * 0.22 : Math.sin(this.clockElapsed * 2.4) * 0.12;
    this.creatureRig.head.rotation.z = THREE.MathUtils.damp(
      this.creatureRig.head.rotation.z,
      idleTilt + twitch,
      10,
      dt,
    );
    this.creatureRig.head.rotation.x = THREE.MathUtils.damp(
      this.creatureRig.head.rotation.x,
      0.22 + Math.sin(this.clockElapsed * 3.1) * 0.06 - (this.creatureBodyBack && headRotatedAround ? 0.16 : 0),
      10,
      dt,
    );

    // Update distorted shadow projected across ceiling planks against corridor lamps
    this.updateCeilingShadow();
  }

  private pushHud(force: boolean): void {
    if (!force && this.clockElapsed - this.lastHudPush < 0.09) return;
    this.lastHudPush = this.clockElapsed;

    const inCourtyard = this.playerPos.z < 0.2;
    const objective =
      this.phase === 'escaped'
        ? 'Você escapou do Sanatório Blackwood.'
        : this.phase === 'dead'
        ? 'Você não sobreviveu ao sanatório.'
        : this.activeLocker
        ? 'Escondido no armário — desligue a lanterna (F) se ouvir raspados no teto.'
        : inCourtyard && !this.doorUnlocked
        ? !this.hasKey && !this.generatorOn
          ? 'Pátio: Pegue a Chave na Guarita (Oeste) e ligue o Gerador (Leste).'
          : !this.hasKey
          ? 'Pátio: Pegue a Chave Mestre na Guarita (Oeste).'
          : !this.generatorOn
          ? 'Pátio: Ligue o Gerador Auxiliar (Leste).'
          : 'Pátio: Destranque a Porta Principal ao sul para entrar.'
        : !this.creatureAlive
        ? 'Criatura abatida — encontre a porta de SAÍDA ao sul.'
        : 'Ala Interna: Encontre a saída ao sul (e sobreviva).';

    this.onHudUpdate({
      hp: Math.ceil(this.hp),
      ammo: this.ammo,
      reserve: this.reserve,
      flashlightOn: this.flashlightOn,
      cameraOn: this.cameraOn,
      battery: Math.round(this.battery),
      phase: this.phase,
      objective,
      creatureAlive: this.creatureAlive,
      creatureHp: this.creatureHp,
      elapsedSec: Math.floor(this.elapsedSec),
      shotsFired: this.shotsFired,
      hitsLanded: this.hitsLanded,
      hint: this.hintText,
      hasKey: this.hasKey,
      generatorOn: this.generatorOn,
      doorUnlocked: this.doorUnlocked,
      inCourtyard,
      isHiding: Boolean(this.activeLocker),
      interactPrompt: this.interactPrompt,
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
    if (this.blueNoiseTex) this.blueNoiseTex.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
