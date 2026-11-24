import React, { useRef, useState } from 'react';
import { Flashlight, RotateCw, Crosshair, Video, Hand } from 'lucide-react';

interface MobileControlsProps {
  flashlightOn: boolean;
  cameraOn: boolean;
  interactPrompt: string | null;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onShoot: () => void;
  onToggleFlashlight: () => void;
  onToggleCamera: () => void;
  onReload: () => void;
  onInteract: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = React.memo(({
  flashlightOn,
  cameraOn,
  interactPrompt,
  onMove,
  onShoot,
  onToggleFlashlight,
  onToggleCamera,
  onReload,
  onInteract,
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
    const ny = -dy / maxR; // screen up is forward (+y)
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
      {/* Left Virtual Analog Joystick */}
      <div className="pointer-events-auto absolute bottom-5 left-4 flex flex-col items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            const next = !sprintLock;
            setSprintLock(next);
            onMove(knob.x / 46, -knob.y / 46, next);
          }}
          className={`min-h-[36px] border px-3 py-1 text-xs font-semibold tracking-wider transition-colors ${
            sprintLock
              ? 'border-white bg-[#f4f4f0] text-[#050506]'
              : 'border-white/55 bg-[#060608]/85 text-white/90'
          }`}
        >
          {sprintLock ? 'CORRIDA: ON' : 'CORRER'}
        </button>

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

      {/* Right Thumb Combat & Light Cluster */}
      <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-end gap-2.5">
        {interactPrompt && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onInteract();
            }}
            aria-label={interactPrompt}
            className="flex min-h-[44px] items-center gap-2 border border-white bg-[#f4f4f0] px-3.5 py-2 text-xs font-bold tracking-wider text-[#050506] active:scale-95"
          >
            <Hand className="h-4 w-4" />
            <span>{interactPrompt}</span>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleCamera();
            }}
            aria-label="Alternar câmera noturna"
            className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 border transition-colors ${
              cameraOn
                ? 'border-[#80ff72] bg-[#80ff72] text-[#030e06]'
                : 'border-white/60 bg-[#060608]/85 text-white'
            }`}
          >
            <Video className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">IR</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFlashlight();
            }}
            aria-label="Alternar lanterna"
            className={`flex h-12 w-12 flex-col items-center justify-center gap-0.5 border transition-colors ${
              flashlightOn
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/60 bg-[#060608]/85 text-white'
            }`}
          >
            <Flashlight className="h-4 w-4" />
            <span className="text-[9px] font-bold leading-none">LUZ</span>
          </button>
        </div>

        <div className="flex items-end gap-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            aria-label="Recarregar arma"
            className="flex h-12 w-12 items-center justify-center border border-white/60 bg-[#060608]/85 text-white active:bg-white active:text-black"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onShoot();
            }}
            aria-label="Atirar"
            className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-white bg-[#f4f4f0] text-[#050506] active:scale-95"
          >
            <Crosshair className="h-7 w-7 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </div>
  );
});
