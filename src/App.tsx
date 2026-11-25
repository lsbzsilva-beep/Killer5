import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Flashlight, SlidersHorizontal, Radar, KeyRound, Zap, Map, Eye, Radio, Waves } from 'lucide-react';
import { EngineSettings, HudSnapshot, SanatoriumEngine } from './game/SanatoriumEngine';
import { LEVEL_STORAGE_KEY, LevelConfig, loadSavedLevelConfig } from './game/mapData';
import { MobileControls } from './components/MobileControls';
import { ControlDock } from './components/ControlDock';
import { LevelEditor } from './components/LevelEditor';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  flashlightOn: true,
  cameraOn: false,
  battery: 100,
  phase: 'title',
  objective: 'Plataforma submersa: pegue a Chave e ligue o Disjuntor para abrir a Escotilha.',
  elapsedSec: 0,
  hint: '',
  hasKey: false,
  powerOn: false,
  isHiding: false,
  crouching: false,
  bottles: 0,
  maxBottles: 3,
  traps: 0,
  maxTraps: 2,
  lockerPanic: 0,
  breathStamina: 100,
  holdingBreath: false,
  canPeekDoor: false,
  canLockDoor: false,
  doorLocked: false,
  peekingDoor: false,
  interactPrompt: null,
  thirdPerson: true,
  waterLevelCm: 2,
  flashCharges: 2,
  maxFlashCharges: 3,
  flashCooldownFrac: 0,
  radioOn: true,
  radioSignal: 0,
  sonarPulse: 0,
  sonarProximity: 0,
  sfxPopups: [],
};

const INITIAL_SETTINGS: EngineSettings = {
  ditherMode: 'hatch',
  palette: 'auto',
  colorDepth: '5mixed',
  pixelScale: 1,
  lightBoost: 1.05,
  spatialAudio: true,
  thirdPerson: true,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SanatoriumEngine | null>(null);
  const lookPointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const rightPeekActiveRef = useRef(false);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<EngineSettings>(INITIAL_SETTINGS);
  const settingsRef = useRef<EngineSettings>(INITIAL_SETTINGS);
  const [levelConfig, setLevelConfig] = useState<LevelConfig>(() => loadSavedLevelConfig());
  const [levelRevision, setLevelRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorOpenRef = useRef(false);
  const autoStartRef = useRef(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [showTouchOverride, setShowTouchOverride] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  useEffect(() => {
    editorOpenRef.current = editorOpen;
    if (editorOpen) {
      if (document.pointerLockElement) document.exitPointerLock();
      engineRef.current?.clearKeys();
    }
  }, [editorOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const syncCoarse = () => {
      setIsCoarsePointer(mq.matches);
      if (mq.matches) setDockCollapsed(true);
    };
    syncCoarse();
    mq.addEventListener?.('change', syncCoarse);
    return () => mq.removeEventListener?.('change', syncCoarse);
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const engine = new SanatoriumEngine(el, setHud, levelConfig);
    engine.updateSettings(settingsRef.current);
    engineRef.current = engine;

    if (autoStartRef.current) {
      autoStartRef.current = false;
      engine.startGame();
      if (!window.matchMedia('(pointer: coarse)').matches) {
        engine.lockPointer();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (editorOpenRef.current) return;
      if (e.code === 'Space') e.preventDefault();
      engine.setKey(e.code, true);
      if (e.repeat) return;
      if (e.code === 'KeyE') engine.interact();
      if (e.code === 'KeyQ') engine.toggleCrouch();
      if (e.code === 'KeyT') engine.toggleDoorLock();
      if (e.code === 'KeyG') engine.throwBottle();
      if (e.code === 'KeyX') engine.placeTrap();
      if (e.code === 'KeyF') engine.toggleFlashlight();
      if (e.code === 'KeyC') engine.toggleCamera();
      if (e.code === 'KeyB') engine.triggerStrobeFlash();
      if (e.code === 'KeyN') engine.toggleRadio();
      if (e.code === 'KeyV') handleUpdateSettings({ thirdPerson: !settingsRef.current.thirdPerson });
      if (e.code === 'KeyH') setDockCollapsed((c) => !c);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (editorOpenRef.current) return;
      engine.setKey(e.code, false);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (editorOpenRef.current) return;
      if (document.pointerLockElement === engine.getDomElement()) {
        engine.addLookDelta(e.movementX * 0.0024, e.movementY * 0.002);
      }
    };

    const onBlur = () => {
      rightPeekActiveRef.current = false;
      engine.setPeeking(false);
      engine.clearKeys();
    };

    const onPointerLockChange = () => {
      if (document.pointerLockElement !== engine.getDomElement()) {
        rightPeekActiveRef.current = false;
        engine.setPeeking(false);
        engine.clearKeys();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      engine.dispose();
      engineRef.current = null;
    };
    // Rebuild 3D engine only when levelRevision changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelRevision]);

  const handleUpdateSettings = useCallback((partial: Partial<EngineSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      settingsRef.current = next;
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const persistLevel = useCallback((cfg: LevelConfig, testNow: boolean) => {
    try {
      window.localStorage.setItem(LEVEL_STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore quota errors
    }
    autoStartRef.current = testNow;
    setLevelConfig(cfg);
    setLevelRevision((v) => v + 1);
    setEditorOpen(false);
  }, []);

  const handleToggleCollapse = useCallback(() => setDockCollapsed((c) => !c), []);
  const handleToggleFlashlight = useCallback(() => engineRef.current?.toggleFlashlight(), []);
  const handleToggleCamera = useCallback(() => engineRef.current?.toggleCamera(), []);
  const handleToggleCrouch = useCallback(() => engineRef.current?.toggleCrouch(), []);
  const handleTriggerFlash = useCallback(() => engineRef.current?.triggerStrobeFlash(), []);
  const handleToggleRadio = useCallback(() => engineRef.current?.toggleRadio(), []);
  const handleToggleTouchOverride = useCallback(() => setShowTouchOverride((v) => !v), []);
  const handleTouchMove = useCallback((x: number, y: number, sprint: boolean) => {
    engineRef.current?.setTouchMove(x, y, sprint);
  }, []);
  const handleInteract = useCallback(() => engineRef.current?.interact(), []);
  const handlePeekChange = useCallback((active: boolean) => engineRef.current?.setPeeking(active), []);
  const handleLockDoor = useCallback(() => engineRef.current?.toggleDoorLock(), []);
  const handleThrowBottle = useCallback(() => engineRef.current?.throwBottle(), []);
  const handlePlaceTrap = useCallback(() => engineRef.current?.placeTrap(), []);
  const handleHoldBreathChange = useCallback((active: boolean) => engineRef.current?.setHoldingBreath(active), []);

  const handleStartOrRetry = () => {
    rightPeekActiveRef.current = false;
    lookPointerRef.current = null;
    engineRef.current?.startGame();
    if (!isCoarsePointer && !showTouchOverride) {
      engineRef.current?.lockPointer();
    }
  };

  const touchActive = isCoarsePointer || showTouchOverride;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#050506]"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (hud.phase !== 'playing' || editorOpen) return;
        if (e.pointerType === 'touch') {
          if (e.clientX > window.innerWidth * 0.28) {
            lookPointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          }
        } else if (e.pointerType === 'mouse') {
          const target = e.target as HTMLElement;
          if (target.closest('button, input')) return;
          if (e.button === 0) {
            if (document.pointerLockElement !== engineRef.current?.getDomElement() && !touchActive) {
              engineRef.current?.lockPointer();
            }
          } else if (e.button === 2) {
            if (engineRef.current?.isNearClosedDoor()) {
              rightPeekActiveRef.current = true;
              engineRef.current.setPeeking(true);
            } else {
              engineRef.current?.throwBottle();
            }
          }
        }
      }}
      onPointerMove={(e) => {
        if (
          hud.phase === 'playing' &&
          e.pointerType === 'touch' &&
          lookPointerRef.current &&
          lookPointerRef.current.id === e.pointerId
        ) {
          const dx = e.clientX - lookPointerRef.current.x;
          const dy = e.clientY - lookPointerRef.current.y;
          lookPointerRef.current.x = e.clientX;
          lookPointerRef.current.y = e.clientY;
          engineRef.current?.addLookDelta(dx * 0.0065, dy * 0.005);
        }
      }}
      onPointerUp={(e) => {
        if (lookPointerRef.current?.id === e.pointerId) {
          lookPointerRef.current = null;
        }
        if (e.button === 2 && rightPeekActiveRef.current) {
          rightPeekActiveRef.current = false;
          engineRef.current?.setPeeking(false);
        }
      }}
      onPointerCancel={(e) => {
        if (lookPointerRef.current?.id === e.pointerId) {
          lookPointerRef.current = null;
        }
        if (rightPeekActiveRef.current) {
          rightPeekActiveRef.current = false;
          engineRef.current?.setPeeking(false);
        }
      }}
    >
      {/* Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Manga Graphic-Novel 3D->2D Onomatopoeia Callouts */}
      {hud.phase === 'playing' && hud.sfxPopups.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {hud.sfxPopups.map((popup) => (
            <div
              key={popup.id}
              style={{
                left: `${popup.screenX}%`,
                top: `${popup.screenY}%`,
                opacity: popup.opacity,
                transform: `translate(-50%, -50%) rotate(${popup.tiltDeg}deg)`,
              }}
              className={`font-display absolute border-2 px-2.5 py-0.5 text-lg font-bold tracking-[0.14em] shadow-[4px_4px_0_#000] sm:text-2xl ${
                popup.accent
                  ? 'border-[#050506] bg-[#ffe066] text-[#050506]'
                  : 'border-white bg-[#050506] text-white'
              }`}
            >
              {popup.text}
            </div>
          ))}
        </div>
      )}

      {/* Minimal Top HUD */}
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-start justify-between gap-4 p-3.5 sm:p-5">
        <div className="bg-[#050506]/88 border border-white/25 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold tabular-nums sm:text-base">
            <span className={hud.hp <= 30 ? 'text-red-400' : 'text-white'}>
              ♥ {hud.hp}
            </span>
            <span className="text-white/30">/</span>
            <span className="flex items-center gap-1 text-xs text-white/85">
              <Flashlight className="h-3.5 w-3.5" />
              {hud.flashlightOn || hud.cameraOn ? `${hud.battery}%` : 'OFF'}
            </span>
            <span className="text-white/30">/</span>
            <span className={`flex items-center gap-1 text-xs ${hud.waterLevelCm >= 18 ? 'text-[#5ef2ff]' : 'text-white/75'}`}>
              <Waves className="h-3.5 w-3.5" />
              {hud.waterLevelCm}cm
            </span>
            {hud.cameraOn && (
              <>
                <span className="text-white/30">/</span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#5ef2ff]">
                  <Radar className="h-3.5 w-3.5" />
                  SONAR
                </span>
              </>
            )}
            {hud.crouching && (
              <>
                <span className="text-white/30">/</span>
                <span className="text-xs font-bold tracking-wider text-[#f3b644]">
                  AGACHADO
                </span>
              </>
            )}
            {hud.isHiding && (
              <>
                <span className="text-white/30">/</span>
                <span className="text-xs font-bold tracking-wider text-[#f3b644]">
                  ESCONDIDO
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-white/80">
            {hud.objective}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-white/15 pt-1.5 text-[11px] font-semibold tabular-nums">
            <span className={`flex items-center gap-1 ${hud.hasKey ? 'text-[#80ff72]' : 'text-white/50'}`}>
              <KeyRound className="h-3 w-3" />
              {hud.hasKey ? 'Chave: OK' : 'Chave: —'}
            </span>
            <span className="text-white/25">|</span>
            <span className={`flex items-center gap-1 ${hud.powerOn ? 'text-[#80ff72]' : 'text-white/50'}`}>
              <Zap className="h-3 w-3" />
              {hud.powerOn ? 'Disjuntor: ON' : 'Disjuntor: OFF'}
            </span>
            <span className="text-white/25">|</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleTriggerFlash}
              className={`pointer-events-auto flex items-center gap-1 ${
                hud.flashCharges > 0 && hud.flashCooldownFrac <= 0
                  ? 'text-[#ffe066] hover:underline'
                  : 'text-white/45'
              }`}
              title="Disparar Flash Estroboscópico [B]"
            >
              <Zap className="h-3 w-3" />
              Flash: {hud.flashCharges}/{hud.maxFlashCharges} [B]
            </button>
            <span className="text-white/25">|</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleToggleRadio}
              className={`pointer-events-auto flex items-center gap-1 ${
                hud.radioOn
                  ? hud.radioSignal > 40
                    ? 'text-red-400 hover:underline'
                    : 'text-[#f3b644] hover:underline'
                  : 'text-white/45 hover:underline'
              }`}
              title="Alternar Rádio AM Tático [N]"
            >
              <Radio className="h-3 w-3" />
              Rádio: {hud.radioOn ? `${hud.radioSignal}%` : 'OFF'} [N]
            </button>
            <span className="text-white/25">|</span>
            <span className={hud.bottles > 0 ? 'text-white/90' : 'text-white/45'}>
              Frascos: {hud.bottles}/{hud.maxBottles}
            </span>
            <span className="text-white/25">|</span>
            <span className={hud.traps > 0 ? 'text-[#80ff72]' : 'text-white/45'}>
              Armadilhas: {hud.traps}/{hud.maxTraps}
            </span>
          </div>
        </div>

        {/* Quick Top-Right Camera View, Audio & Settings Toggles */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleUpdateSettings({ thirdPerson: !settings.thirdPerson })}
            className={`flex min-h-[40px] items-center gap-1.5 border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              settings.thirdPerson
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-[#050506]/85 text-white hover:bg-white hover:text-black'
            }`}
            aria-label="Alternar câmera 1ª e 3ª pessoa"
          >
            <Eye className="h-4 w-4" />
            <span className="whitespace-nowrap">
              {settings.thirdPerson ? '3ª P.' : '1ª P.'}
            </span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleUpdateSettings({ spatialAudio: !settings.spatialAudio })}
            className="flex min-h-[40px] items-center gap-2 border border-white/30 bg-[#050506]/85 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black"
            aria-label="Alternar áudio espacial"
          >
            {settings.spatialAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden sm:inline whitespace-nowrap">
              {settings.spatialAudio ? 'Áudio 3D' : 'Mudo'}
            </span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setEditorOpen(true)}
            className="flex min-h-[40px] items-center gap-1.5 border border-white/30 bg-[#050506]/85 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white hover:text-black"
            aria-label="Abrir editor de níveis"
          >
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline whitespace-nowrap">Editor</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setDockCollapsed((c) => !c)}
            className={`flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${
              !dockCollapsed
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-[#050506]/85 text-white hover:bg-white hover:text-black'
            }`}
            aria-label="Abrir ajustes"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="whitespace-nowrap">Ajustes</span>
          </button>
        </div>
      </header>

      {/* Center Focus Dot, Locker Breath/Panic Bar & Contextual Prompts */}
      {hud.phase === 'playing' && (
        <>
          {!hud.isHiding && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="h-1.5 w-1.5 rounded-full bg-white/85 mix-blend-difference" />
            </div>
          )}

          {hud.cameraOn && (
            <div className="pointer-events-none absolute inset-3 z-10 sm:inset-5">
              <div
                className="pointer-events-none absolute inset-0 border-2 transition-colors"
                style={{
                  borderColor:
                    hud.sonarPulse > 0.08 || hud.sonarProximity > 0.35
                      ? `rgba(255, 74, 64, ${0.22 + hud.sonarPulse * 0.65})`
                      : 'rgba(94, 242, 255, 0.18)',
                  boxShadow:
                    hud.sonarPulse > 0.08
                      ? `inset 0 0 ${Math.round(18 + hud.sonarPulse * 48)}px rgba(255, 74, 64, ${0.18 + hud.sonarPulse * 0.38})`
                      : 'none',
                }}
              />
              <span
                className={`absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 ${
                  hud.sonarPulse > 0.15 || hud.sonarProximity > 0.45 ? 'border-[#ff4a40]' : 'border-[#5ef2ff]/80'
                }`}
              />
              <span
                className={`absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 ${
                  hud.sonarPulse > 0.15 || hud.sonarProximity > 0.45 ? 'border-[#ff4a40]' : 'border-[#5ef2ff]/80'
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 ${
                  hud.sonarPulse > 0.15 || hud.sonarProximity > 0.45 ? 'border-[#ff4a40]' : 'border-[#5ef2ff]/80'
                }`}
              />
              <span
                className={`absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 ${
                  hud.sonarPulse > 0.15 || hud.sonarProximity > 0.45 ? 'border-[#ff4a40]' : 'border-[#5ef2ff]/80'
                }`}
              />
              <div className="absolute top-32 left-1 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-[0.2em] tabular-nums sm:top-36">
                <span className={hud.sonarPulse > 0.15 ? 'text-[#ff4a40]' : 'text-[#5ef2ff]/95'}>
                  SONAR ABISSAL · -420M · {formatTime(hud.elapsedSec)}
                </span>
                {hud.sonarProximity > 0.04 && (
                  <span className="border border-[#ff4a40]/80 bg-[#050506]/90 px-1.5 py-0.5 text-[9px] text-[#ff6b60]">
                    {hud.sonarProximity > 0.6
                      ? `CONTATO CRÍTICO ${Math.round(hud.sonarProximity * 100)}%`
                      : `ECO DETECTADO ${Math.round(hud.sonarProximity * 100)}%`}
                  </span>
                )}
              </div>
            </div>
          )}

          {hud.hint && (
            <div className="pointer-events-none absolute top-36 left-1/2 z-10 -translate-x-1/2 border border-white/30 bg-[#050506]/90 px-3.5 py-1.5 text-center text-xs text-white">
              {hud.hint}
            </div>
          )}

          {hud.isHiding && (
            <div className="pointer-events-none absolute bottom-28 left-1/2 z-10 w-[min(300px,84vw)] -translate-x-1/2 border border-white/35 bg-[#050506]/90 px-3.5 py-2.5 text-xs">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className={hud.lockerPanic > 65 ? 'text-red-400' : 'text-white/85'}>
                  Pânico: {hud.lockerPanic}%
                </span>
                <span className={hud.holdingBreath ? 'text-[#80ff72]' : 'text-white/75'}>
                  Fôlego: {hud.breathStamina}%
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div className="h-1.5 bg-white/15">
                  <div
                    className={`h-full transition-all ${hud.lockerPanic > 65 ? 'bg-red-500' : 'bg-[#f3b644]'}`}
                    style={{ width: `${hud.lockerPanic}%` }}
                  />
                </div>
                <div className="h-1.5 bg-white/15">
                  <div
                    className="h-full bg-[#80ff72] transition-all"
                    style={{ width: `${hud.breathStamina}%` }}
                  />
                </div>
              </div>
              {!touchActive && (
                <div className="mt-1.5 text-center text-[10px] text-white/70">
                  {hud.holdingBreath
                    ? 'Prendendo a respiração...'
                    : 'Segure [ESPAÇO] para prender a respiração'}
                </div>
              )}
            </div>
          )}

          {hud.interactPrompt && !touchActive && (
            <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => engineRef.current?.interact()}
                className="pointer-events-auto border border-white/80 bg-[#050506]/90 px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-white hover:text-black"
              >
                [E] {hud.interactPrompt}
              </button>
              {hud.canLockDoor && (
                <div className="border border-white/25 bg-[#050506]/88 px-3 py-1 text-[11px] font-semibold text-white/85">
                  [R / Botão Dir.] {hud.peekingDoor ? 'Espiando...' : 'Espiar'} · [T] {hud.doorLocked ? 'Destrancar' : 'Trancar'}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Mobile Touch Controls */}
      {hud.phase === 'playing' && touchActive && (
        <MobileControls
          flashlightOn={hud.flashlightOn}
          cameraOn={hud.cameraOn}
          crouching={hud.crouching}
          isHiding={hud.isHiding}
          holdingBreath={hud.holdingBreath}
          bottles={hud.bottles}
          traps={hud.traps}
          flashCharges={hud.flashCharges}
          maxFlashCharges={hud.maxFlashCharges}
          flashCooldownFrac={hud.flashCooldownFrac}
          radioOn={hud.radioOn}
          radioSignal={hud.radioSignal}
          canPeekDoor={hud.canPeekDoor}
          canLockDoor={hud.canLockDoor}
          doorLocked={hud.doorLocked}
          interactPrompt={hud.interactPrompt}
          onMove={handleTouchMove}
          onToggleFlashlight={handleToggleFlashlight}
          onToggleCamera={handleToggleCamera}
          onToggleCrouch={handleToggleCrouch}
          onTriggerFlash={handleTriggerFlash}
          onToggleRadio={handleToggleRadio}
          onInteract={handleInteract}
          onPeekChange={handlePeekChange}
          onLockDoor={handleLockDoor}
          onThrowBottle={handleThrowBottle}
          onPlaceTrap={handlePlaceTrap}
          onHoldBreathChange={handleHoldBreathChange}
        />
      )}

      {/* Collapsible Settings Panel */}
      <ControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={handleToggleCollapse}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        flashlightOn={hud.flashlightOn}
        onToggleFlashlight={handleToggleFlashlight}
        cameraOn={hud.cameraOn}
        onToggleCamera={handleToggleCamera}
        radioOn={hud.radioOn}
        onToggleRadio={handleToggleRadio}
        showTouchOverride={showTouchOverride}
        onToggleTouchOverride={handleToggleTouchOverride}
        mobileLayout={touchActive && hud.phase === 'playing'}
      />

      {/* Title / Death / Escape Overlay */}
      {hud.phase !== 'playing' && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/82 p-5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-[480px] border border-white/80 bg-[#060608] p-6 text-center shadow-[0_0_0_6px_#121215]">
            <h1 className="font-display text-4xl font-bold tracking-[0.22em] text-white sm:text-5xl">
              {hud.phase === 'dead'
                ? 'VOCÊ CAIU'
                : hud.phase === 'escaped'
                ? 'ESCAPOU'
                : 'BLACKWOOD'}
            </h1>
            <p className="mt-1.5 text-xs tracking-[0.2em] text-[#5ef2ff]/80">
              PLATAFORMA SUBMERSA -420M · TERROR ABISSAL
            </p>

            {hud.phase === 'title' ? (
              <div className="mt-5 space-y-2.5 text-xs leading-relaxed text-white/85">
                <p>
                  A água sobe pelos corredores da Plataforma Abissal Blackwood. Use a Lente Sonar para rastrear pegadas e objetivos, cegue a criatura com o Flash Estroboscópico e silencie o Rádio AM quando ela estiver próxima.
                </p>
                <div className="border-t border-white/15 pt-2.5 text-[11px] leading-relaxed text-white/75">
                  <p>WASD mover · Shift correr · Q agachar (silencia passos na água e estilhaços)</p>
                  <p>E interagir (comporta, armário, despertador, obstáculo) · T trancar · R / Dir. espiar</p>
                  <p>C Lente Sonar · B Flash Estroboscópico · N Rádio AM · F Lanterna · G Frasco · X Armadilha · V 1ª/3ª P.</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/20 py-3 text-xs tabular-nums">
                <div>
                  <div className="text-[11px] text-white/55">Tempo</div>
                  <div className="mt-0.5 font-bold">{formatTime(hud.elapsedSec)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/55">Chave</div>
                  <div className="mt-0.5 font-bold">{hud.hasKey ? 'OK' : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/55">Disjuntor</div>
                  <div className="mt-0.5 font-bold">{hud.powerOn ? 'ON' : 'OFF'}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartOrRetry}
              className="mt-6 min-h-[46px] w-full bg-[#f4f4f0] px-6 py-3 text-xs font-bold tracking-[0.16em] text-[#050506] transition-colors hover:bg-white active:scale-[0.99]"
            >
              {hud.phase === 'title' ? 'EMERGIR NA CABINE 01' : 'TENTAR NOVAMENTE'}
            </button>

            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-2 border border-white/30 bg-[#101116] px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/90 transition-colors hover:border-white hover:bg-white hover:text-black"
            >
              <Map className="h-4 w-4" />
              <span>EDITOR DE NÍVEIS (PLANTA 2D)</span>
            </button>
          </div>
        </div>
      )}

      {/* Temporary 2D Level Editor (modular & removable once map is finalized) */}
      {editorOpen && (
        <LevelEditor
          initialConfig={levelConfig}
          onSaveAndTest={(cfg) => persistLevel(cfg, true)}
          onSaveOnly={(cfg) => persistLevel(cfg, false)}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
