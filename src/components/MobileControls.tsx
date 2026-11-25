import React, { useRef, useState } from 'react';
import { Flashlight, Radar, Hand, Eye, Lock, Unlock, Wind, Zap, Radio } from 'lucide-react';

interface MobileControlsProps {
  flashlightOn: boolean;
  cameraOn: boolean;
  crouching: boolean;
  isHiding: boolean;
  holdingBreath: boolean;
  bottles: number;
  traps: number;
  flashCharges: number;
  maxFlashCharges: number;
  flashCooldownFrac: number;
  radioOn: boolean;
  radioSignal: number;
  canPeekDoor: boolean;
  canLockDoor: boolean;
  doorLocked: boolean;
  interactPrompt: string | null;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onToggleFlashlight: () => void;
  onToggleCamera: () => void;
  onToggleCrouch: () => void;
  onTriggerFlash: () => void;
  onToggleRadio: () => void;
  onInteract: () => void;
  onPeekChange: (active: boolean) => void;
  onLockDoor: () => void;
  onThrowBottle: () => void;
  onPlaceTrap: () => void;
  onHoldBreathChange: (active: boolean) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = React.memo(({
  flashlightOn,
  cameraOn,
  crouching,
  isHiding,
  holdingBreath,
  bottles,
  traps,
  flashCharges,
  flashCooldownFrac,
  radioOn,
  radioSignal,
  canPeekDoor,
  canLockDoor,
  doorLocked,
  interactPrompt,
  onMove,
  onToggleFlashlight,
  onToggleCamera,
  onToggleCrouch,
  onTriggerFlash,
  onToggleRadio,
  onInteract,
  onPeekChange,
  onLockDoor,
  onThrowBottle,
  onPlaceTrap,
  onHoldBreathChange,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintLock, setSprintLock] = useState(false);

  const updateStick = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnob({ x: dx, y: dy });
    const nx = dx / maxR;
    const ny = -dy / maxR;
    const autoSprint = sprintLock || dist / maxR > 0.85;
    onMove(nx, ny, autoSprint);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0, sprintLock);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Left Virtual Analog Joystick + Sprint/Crouch Toggles */}
      <div className="pointer-events-auto absolute bottom-5 left-4 flex flex-col items-start gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !sprintLock;
              setSprintLock(next);
              onMove(knob.x / 46, -knob.y / 46, next);
            }}
            className={`min-h-[36px] border px-2.5 py-1 text-[11px] font-semibold tracking-wider transition-colors ${
              sprintLock
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/55 bg-[#060608]/85 text-white/90'
            }`}
          >
            {sprintLock ? 'CORRIDA: ON' : 'CORRER'}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleCrouch();
            }}
            className={`min-h-[36px] border px-2.5 py-1 text-[11px] font-semibold tracking-wider transition-colors ${
              crouching
                ? 'border-[#f3b644] bg-[#f3b644] text-[#050506]'
                : 'border-white/55 bg-[#060608]/85 text-white/90'
            }`}
          >
            {crouching ? 'AGACHADO' : 'AGACHAR'}
          </button>
        </div>

        <div
          ref={padRef}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            activePointerId.current = e.pointerId;
            updateStick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activePointerId.current === e.pointerId) {
              updateStick(e.clientX, e.clientY);
            }
          }}
          onPointerUp={(e) => {
            if (activePointerId.current === e.pointerId) {
              resetStick();
            }
          }}
          onPointerCancel={resetStick}
          className="relative flex h-[124px] w-[124px] touch-none items-center justify-center rounded-full border border-white/60 bg-[#060608]/80"
          aria-label="Controle analógico de movimento"
        >
          <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-white/25" />
          <div
            style={{
              transform: `translate(${knob.x}px, ${knob.y}px)`,
            }}
            className="pointer-events-none h-11 w-11 rounded-full border border-white bg-[#f4f4f0]/90"
          />
        </div>
      </div>

      {/* Right Thumb Gear, Stealth & Interaction Cluster */}
      <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-end gap-2">
        {isHiding && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onHoldBreathChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onHoldBreathChange(false);
            }}
            onPointerCancel={() => onHoldBreathChange(false)}
            className={`flex min-h-[44px] items-center gap-2 border px-3.5 py-2 text-xs font-bold tracking-wider transition-colors ${
              holdingBreath
                ? 'border-[#80ff72] bg-[#80ff72] text-[#050506]'
                : 'border-white/75 bg-[#060608]/90 text-white'
            }`}
          >
            <Wind className="h-4 w-4" />
            <span>SEGURE: PRENDER AR</span>
          </button>
        )}

        {!isHiding && (canPeekDoor || canLockDoor) && (
          <div className="flex items-center gap-2">
            {canPeekDoor && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onPeekChange(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onPeekChange(false);
                }}
                onPointerCancel={() => onPeekChange(false)}
                className="flex min-h-[40px] items-center gap-1.5 border border-white/70 bg-[#060608]/90 px-3 py-1.5 text-[11px] font-bold text-white active:bg-white active:text-black"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>ESPIAR</span>
              </button>
            )}
            {canLockDoor && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onLockDoor();
                }}
                className={`flex min-h-[40px] items-center gap-1.5 border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  doorLocked
                    ? 'border-[#f3b644] bg-[#f3b644] text-[#050506]'
                    : 'border-white/70 bg-[#060608]/90 text-white'
                }`}
              >
                {doorLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                <span>{doorLocked ? 'DESTRANCAR' : 'TRANCAR'}</span>
              </button>
            )}
          </div>
        )}

        {interactPrompt && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onInteract();
            }}
            aria-label={interactPrompt}
            className="flex min-h-[44px] items-center gap-2 border-2 border-white bg-[#f4f4f0] px-4 py-2 text-xs font-bold tracking-wider text-[#050506] active:scale-95"
          >
            <Hand className="h-4 w-4" />
            <span>{interactPrompt}</span>
          </button>
        )}

        {!isHiding && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onThrowBottle();
              }}
              className={`min-h-[38px] border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                bottles > 0
                  ? 'border-white/70 bg-[#060608]/90 text-white active:bg-white active:text-black'
                  : 'border-white/25 bg-[#060608]/60 text-white/40'
              }`}
            >
              FRASCO ({bottles})
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onPlaceTrap();
              }}
              className={`min-h-[38px] border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                traps > 0
                  ? 'border-white/70 bg-[#060608]/90 text-white active:bg-white active:text-black'
                  : 'border-white/25 bg-[#060608]/60 text-white/40'
              }`}
            >
              ARMADILHA ({traps})
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleRadio();
            }}
            aria-label="Alternar rádio tático"
            className={`flex h-13 w-13 flex-col items-center justify-center gap-0.5 border transition-colors ${
              radioOn
                ? radioSignal > 40
                  ? 'border-[#ff4a40] bg-[#ff4a40]/90 text-white'
                  : 'border-[#f3b644] bg-[#f3b644] text-[#050506]'
                : 'border-white/50 bg-[#060608]/85 text-white/60'
            }`}
          >
            <Radio className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">
              {radioOn ? `${radioSignal}%` : 'MUDO'}
            </span>
          </button>

          {!isHiding && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTriggerFlash();
              }}
              aria-label="Disparar flash estroboscópico"
              className={`flex h-13 w-13 flex-col items-center justify-center gap-0.5 border transition-colors ${
                flashCharges > 0 && flashCooldownFrac <= 0
                  ? 'border-[#ffe066] bg-[#ffe066] text-[#050506] active:scale-95'
                  : 'border-white/30 bg-[#060608]/75 text-white/40'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="text-[9px] font-bold leading-none">
                {flashCooldownFrac > 0 ? '...' : `FLASH ${flashCharges}`}
              </span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleCamera();
            }}
            aria-label="Alternar lente sonar"
            className={`flex h-13 w-13 flex-col items-center justify-center gap-0.5 border transition-colors ${
              cameraOn
                ? 'border-[#5ef2ff] bg-[#5ef2ff] text-[#031317]'
                : 'border-white/60 bg-[#060608]/85 text-white'
            }`}
          >
            <Radar className="h-5 w-5" />
            <span className="text-[9px] font-bold leading-none">SONAR</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFlashlight();
            }}
            aria-label="Alternar lanterna"
            className={`flex h-13 w-13 flex-col items-center justify-center gap-0.5 border transition-colors ${
              flashlightOn
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/60 bg-[#060608]/85 text-white'
            }`}
          >
            <Flashlight className="h-5 w-5" />
            <span className="text-[9px] font-bold leading-none">LUZ</span>
          </button>
        </div>
      </div>
    </div>
  );
});
