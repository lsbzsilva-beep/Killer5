import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Flashlight, SlidersHorizontal, Video, KeyRound, Zap } from 'lucide-react';
import { EngineSettings, HudSnapshot, SanatoriumEngine } from './game/SanatoriumEngine';
import { MobileControls } from './components/MobileControls';
import { ControlDock } from './components/ControlDock';

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  ammo: 12,
  reserve: 48,
  flashlightOn: true,
  cameraOn: false,
  battery: 100,
  phase: 'title',
  objective: 'Pátio: Pegue a Chave na Guarita (Oeste) e ligue o Gerador (Leste).',
  creatureAlive: true,
  creatureHp: 3,
  elapsedSec: 0,
  shotsFired: 0,
  hitsLanded: 0,
  hint: '',
  hasKey: false,
  generatorOn: false,
  doorUnlocked: false,
  inCourtyard: true,
  isHiding: false,
  interactPrompt: null,
};

const INITIAL_SETTINGS: EngineSettings = {
  ditherMode: 'contrast',
  palette: 'auto',
  colorDepth: '1bit',
  pixelScale: 1,
  lightBoost: 1.0,
  spatialAudio: true,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SanatoriumEngine | null>(null);
  const lookPointerRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [settings, setSettings] = useState<EngineSettings>(INITIAL_SETTINGS);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [showTouchOverride, setShowTouchOverride] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

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
    const engine = new SanatoriumEngine(el, setHud);
    engineRef.current = engine;

    const onKeyDown = (e: KeyboardEvent) => {
      engine.setKey(e.code, true);
      if (e.code === 'Space') engine.shoot();
      if (e.code === 'KeyE') engine.interact();
      if (e.code === 'KeyF') engine.toggleFlashlight();
      if (e.code === 'KeyC') engine.toggleCamera();
      if (e.code === 'KeyR') engine.reload();
      if (e.code === 'KeyH') setDockCollapsed((c) => !c);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engine.setKey(e.code, false);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === engine.getDomElement()) {
        engine.addLookDelta(e.movementX * 0.0024, e.movementY * 0.002);
      }
    };

    const onBlur = () => {
      engine.clearKeys();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<EngineSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback(() => setDockCollapsed((c) => !c), []);
  const handleToggleFlashlight = useCallback(() => engineRef.current?.toggleFlashlight(), []);
  const handleToggleCamera = useCallback(() => engineRef.current?.toggleCamera(), []);
  const handleToggleTouchOverride = useCallback(() => setShowTouchOverride((v) => !v), []);
  const handleTouchMove = useCallback((x: number, y: number, sprint: boolean) => {
    engineRef.current?.setTouchMove(x, y, sprint);
  }, []);
  const handleShoot = useCallback(() => engineRef.current?.shoot(), []);
  const handleReload = useCallback(() => engineRef.current?.reload(), []);
  const handleInteract = useCallback(() => engineRef.current?.interact(), []);

  const handleStartOrRetry = () => {
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
      onPointerDown={(e) => {
        if (hud.phase !== 'playing') return;
        if (e.pointerType === 'touch') {
          if (e.clientX > window.innerWidth * 0.28) {
            lookPointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          }
        } else if (e.pointerType === 'mouse' && e.button === 0) {
          const target = e.target as HTMLElement;
          if (target.closest('button, input')) return;
          if (document.pointerLockElement !== engineRef.current?.getDomElement() && !touchActive) {
            engineRef.current?.lockPointer();
          } else {
            engineRef.current?.shoot();
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
      }}
      onPointerCancel={(e) => {
        if (lookPointerRef.current?.id === e.pointerId) {
          lookPointerRef.current = null;
        }
      }}
    >
      {/* Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Minimal Top HUD */}
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-start justify-between gap-4 p-3.5 sm:p-5">
        <div className="bg-[#050506]/82 border border-white/25 px-3.5 py-2.5">
          <div className="flex items-center gap-3 text-sm font-bold tabular-nums sm:text-base">
            <span className={hud.hp <= 30 ? 'text-red-400' : 'text-white'}>
              ♥ {hud.hp}
            </span>
            <span className="text-white/35">/</span>
            <span>
              ▣ {hud.ammo} · {hud.reserve}
            </span>
            <span className="text-white/35">/</span>
            <span className="flex items-center gap-1 text-xs text-white/85">
              <Flashlight className="h-3.5 w-3.5" />
              {hud.flashlightOn || hud.cameraOn ? `${hud.battery}%` : 'OFF'}
            </span>
            {hud.cameraOn && (
              <>
                <span className="text-white/35">/</span>
                <span className="flex items-center gap-1 text-xs font-bold text-[#80ff72]">
                  <Video className="h-3.5 w-3.5" />
                  IR
                </span>
              </>
            )}
            {hud.isHiding && (
              <>
                <span className="text-white/35">/</span>
                <span className="text-xs font-bold tracking-wider text-[#f3b644]">
                  ESCONDIDO
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-white/80">
            {hud.objective}
          </p>
          {hud.inCourtyard && !hud.doorUnlocked && (
            <div className="mt-1.5 flex items-center gap-3 border-t border-white/15 pt-1.5 text-[11px] font-semibold">
              <span className={`flex items-center gap-1 ${hud.hasKey ? 'text-[#80ff72]' : 'text-white/50'}`}>
                <KeyRound className="h-3 w-3" />
                {hud.hasKey ? 'Chave: OK' : 'Chave: —'}
              </span>
              <span className="text-white/25">|</span>
              <span className={`flex items-center gap-1 ${hud.generatorOn ? 'text-[#80ff72]' : 'text-white/50'}`}>
                <Zap className="h-3 w-3" />
                {hud.generatorOn ? 'Energia: ON' : 'Energia: OFF'}
              </span>
            </div>
          )}
        </div>

        {/* Quick Top-Right Audio & Settings Toggles */}
        <div className="pointer-events-auto flex items-center gap-2">
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

      {/* Center Crosshair & Transient Hint */}
      {hud.phase === 'playing' && (
        <>
          {!hud.isHiding && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
              <div className="relative h-5 w-5">
                <span className="absolute left-1/2 top-0 h-1.5 w-[2px] -translate-x-1/2 bg-white mix-blend-difference" />
                <span className="absolute bottom-0 left-1/2 h-1.5 w-[2px] -translate-x-1/2 bg-white mix-blend-difference" />
                <span className="absolute left-0 top-1/2 h-[2px] w-1.5 -translate-y-1/2 bg-white mix-blend-difference" />
                <span className="absolute right-0 top-1/2 h-[2px] w-1.5 -translate-y-1/2 bg-white mix-blend-difference" />
              </div>
            </div>
          )}

          {hud.cameraOn && (
            <div className="pointer-events-none absolute inset-3 z-10 sm:inset-5">
              <span className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-[#80ff72]/75" />
              <span className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-[#80ff72]/75" />
              <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-[#80ff72]/75" />
              <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-[#80ff72]/75" />
              <div className="absolute top-20 left-1 text-[10px] font-bold tracking-[0.2em] text-[#80ff72]/90 tabular-nums sm:top-24">
                REC · IR · {formatTime(hud.elapsedSec)}
              </div>
            </div>
          )}

          {hud.hint && (
            <div className="pointer-events-none absolute top-24 left-1/2 z-10 -translate-x-1/2 border border-white/30 bg-[#050506]/88 px-3.5 py-1.5 text-center text-xs text-white">
              {hud.hint}
            </div>
          )}

          {hud.interactPrompt && !touchActive && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => engineRef.current?.interact()}
              className="pointer-events-auto absolute bottom-20 left-1/2 z-10 -translate-x-1/2 border border-white/80 bg-[#050506]/90 px-4 py-2 text-xs font-bold tracking-wider text-white hover:bg-white hover:text-black"
            >
              [E] {hud.interactPrompt}
            </button>
          )}
        </>
      )}

      {/* Mobile Touch Controls */}
      {hud.phase === 'playing' && touchActive && (
        <MobileControls
          flashlightOn={hud.flashlightOn}
          cameraOn={hud.cameraOn}
          interactPrompt={hud.interactPrompt}
          onMove={handleTouchMove}
          onShoot={handleShoot}
          onToggleFlashlight={handleToggleFlashlight}
          onToggleCamera={handleToggleCamera}
          onReload={handleReload}
          onInteract={handleInteract}
        />
      )}

      {/* Collapsible Settings Panel (Top drawer during mobile play, bottom dock otherwise) */}
      <ControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={handleToggleCollapse}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        flashlightOn={hud.flashlightOn}
        onToggleFlashlight={handleToggleFlashlight}
        cameraOn={hud.cameraOn}
        onToggleCamera={handleToggleCamera}
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
          <div className="w-full max-w-[440px] border border-white/80 bg-[#060608] p-6 text-center shadow-[0_0_0_6px_#121215]">
            <h1 className="font-display text-4xl font-bold tracking-[0.22em] text-white sm:text-5xl">
              {hud.phase === 'dead'
                ? 'VOCÊ CAIU'
                : hud.phase === 'escaped'
                ? 'ESCAPOU'
                : 'BLACKWOOD'}
            </h1>
            <p className="mt-1.5 text-xs tracking-[0.2em] text-white/65">
              SANATÓRIO · 1-BIT HORROR FPS
            </p>

            {hud.phase === 'title' ? (
              <div className="mt-5 space-y-2.5 text-xs leading-relaxed text-white/85">
                <p>
                  Você chega ao pátio externo sob tempestade. Encontre a chave mestra na guarita e religue o gerador auxiliar para destrancar o Sanatório Blackwood.
                </p>
                <div className="border-t border-white/15 pt-2.5 text-[11px] text-white/70">
                  <p>PC: WASD mover · Shift correr · Mouse olhar · E interagir · Clique atirar · F lanterna · C câmera IR · R recarregar</p>
                  <p className="mt-1">Mobile: Analógico esquerdo · Arraste para olhar · Botões à direita</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/20 py-3 text-xs tabular-nums">
                <div>
                  <div className="text-[11px] text-white/55">Tempo</div>
                  <div className="mt-0.5 font-bold">{formatTime(hud.elapsedSec)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/55">Disparos</div>
                  <div className="mt-0.5 font-bold">{hud.shotsFired}</div>
                </div>
                <div>
                  <div className="text-[11px] text-white/55">Acertos</div>
                  <div className="mt-0.5 font-bold">{hud.hitsLanded}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartOrRetry}
              className="mt-6 min-h-[46px] w-full bg-[#f4f4f0] px-6 py-3 text-xs font-bold tracking-[0.16em] text-[#050506] transition-colors hover:bg-white active:scale-[0.99]"
            >
              {hud.phase === 'title' ? 'ENTRAR NO SANATÓRIO' : 'JOGAR NOVAMENTE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
