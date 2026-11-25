import React from 'react';
import { ChevronDown, ChevronUp, Volume2, VolumeX, Flashlight, Smartphone, X, Radar, Eye, Radio } from 'lucide-react';
import { ColorDepthMode, DitherMode, DitherPalette } from '../game/DitherPostProcess';
import { EngineSettings } from '../game/SanatoriumEngine';

interface ControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  settings: EngineSettings;
  onUpdateSettings: (partial: Partial<EngineSettings>) => void;
  flashlightOn: boolean;
  onToggleFlashlight: () => void;
  cameraOn: boolean;
  onToggleCamera: () => void;
  radioOn: boolean;
  onToggleRadio: () => void;
  showTouchOverride: boolean;
  onToggleTouchOverride: () => void;
  mobileLayout?: boolean;
}

export const ControlDock: React.FC<ControlDockProps> = React.memo(({
  collapsed,
  onToggleCollapse,
  settings,
  onUpdateSettings,
  flashlightOn,
  onToggleFlashlight,
  cameraOn,
  onToggleCamera,
  radioOn,
  onToggleRadio,
  showTouchOverride,
  onToggleTouchOverride,
  mobileLayout = false,
}) => {
  const ditherModes: { id: DitherMode; label: string }[] = [
    { id: 'contrast', label: 'Contraste' },
    { id: 'blue', label: 'Blue Noise' },
    { id: 'bayer8', label: 'Bayer 8×8' },
    { id: 'bayer4', label: 'Bayer 4×4' },
    { id: 'hatch', label: 'Hachura' },
    { id: 'halftone', label: 'Meio-Tom' },
  ];

  const colorDepths: { id: ColorDepthMode; label: string }[] = [
    { id: '1bit', label: '1-Bit' },
    { id: '3contrast', label: '3 Destaque' },
    { id: '5ramp', label: '5 Suave' },
    { id: '5contrast', label: '5 Contraste' },
    { id: '5mixed', label: '5 Mistas' },
  ];

  const palettes: { id: DitherPalette; label: string }[] = [
    { id: 'auto', label: 'Reativa' },
    { id: 'bone', label: 'Osso' },
    { id: 'night', label: 'Noturna' },
    { id: 'amber', label: 'Âmbar' },
    { id: 'crimson', label: 'Sangue' },
    { id: 'cobalt', label: 'Cobalto' },
    { id: 'gameboy', label: 'Fósforo' },
    { id: 'violet', label: 'Espectral' },
    { id: 'rust', label: 'Ferrugem' },
  ];

  const pixelScales = [1, 2, 3, 4];

  const controlsContent = (
    <div className="flex flex-col gap-2">
      {/* Row 1: Style & Pixel Scale */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/65 whitespace-nowrap">Estilo</span>
          <div className="flex flex-wrap border border-white/25 bg-black">
            {ditherModes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onUpdateSettings({ ditherMode: m.id })}
                className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  settings.ditherMode === m.id
                    ? 'bg-[#f4f4f0] text-[#050506]'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/65 whitespace-nowrap">Escala</span>
          <div className="flex border border-white/25 bg-black">
            {pixelScales.map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => onUpdateSettings({ pixelScale: scale })}
                className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  settings.pixelScale === scale
                    ? 'bg-[#f4f4f0] text-[#050506]'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {scale}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Color Depth & Palette */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/65 whitespace-nowrap">Cores</span>
          <div className="flex flex-wrap border border-white/25 bg-black">
            {colorDepths.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onUpdateSettings({ colorDepth: c.id })}
                className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  settings.colorDepth === c.id
                    ? 'bg-[#f4f4f0] text-[#050506]'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/65 whitespace-nowrap">Paleta</span>
          <div className="flex flex-wrap border border-white/25 bg-black">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUpdateSettings({ palette: p.id })}
                className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  settings.palette === p.id
                    ? 'bg-[#f4f4f0] text-[#050506]'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Gear Toggles, Light & Audio */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleCamera}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              cameraOn
                ? 'border-[#5ef2ff] bg-[#5ef2ff] text-[#041418]'
                : 'border-white/30 bg-black text-white/80'
            }`}
          >
            <Radar className="h-3.5 w-3.5" />
            <span>{cameraOn ? 'Lente Sonar On' : 'Lente Sonar Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleRadio}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              radioOn
                ? 'border-[#f3b644] bg-[#f3b644] text-[#050506]'
                : 'border-white/30 bg-black text-white/80'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>{radioOn ? 'Rádio AM On' : 'Rádio AM Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleFlashlight}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              flashlightOn
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-black text-white/80'
            }`}
          >
            <Flashlight className="h-3.5 w-3.5" />
            <span>{flashlightOn ? 'Lanterna On' : 'Lanterna Off'}</span>
          </button>

          <input
            type="range"
            min="0.6"
            max="1.6"
            step="0.1"
            value={settings.lightBoost}
            aria-label="Intensidade da iluminação"
            onChange={(e) => onUpdateSettings({ lightBoost: parseFloat(e.target.value) })}
            className="h-6 w-24 accent-[#f4f4f0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateSettings({ thirdPerson: !settings.thirdPerson })}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              settings.thirdPerson
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-black text-white/75'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{settings.thirdPerson ? '3ª Pessoa' : '1ª Pessoa'}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ spatialAudio: !settings.spatialAudio })}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              settings.spatialAudio
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-black text-white/75'
            }`}
          >
            {settings.spatialAudio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>Áudio 3D</span>
          </button>

          <button
            type="button"
            onClick={onToggleTouchOverride}
            className={`flex min-h-[32px] items-center gap-1.5 border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
              showTouchOverride
                ? 'border-white bg-[#f4f4f0] text-[#050506]'
                : 'border-white/30 bg-black text-white/75'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Touch</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (mobileLayout) {
    if (collapsed) return null;
    return (
      <div
        className="pointer-events-auto fixed top-16 left-1/2 z-30 max-h-[78vh] w-[min(450px,94vw)] -translate-x-1/2 overflow-y-auto border border-white/45 bg-[#070709]/95 p-3.5 text-xs text-white shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2.5 flex items-center justify-between border-b border-white/15 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-white">AJUSTES VISUAIS & EQUIPAMENTO</span>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex min-h-[32px] items-center gap-1 border border-white/30 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white hover:text-black"
            aria-label="Fechar ajustes"
          >
            <X className="h-3.5 w-3.5" />
            <span>Fechar</span>
          </button>
        </div>
        {controlsContent}
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-none fixed bottom-3 left-1/2 w-[min(920px,95vw)] -translate-x-1/2 transition-transform duration-200 ease-out ${
        collapsed ? 'z-30' : 'z-50'
      }`}
      style={{
        transform: collapsed ? 'translate(-50%, calc(100% - 34px))' : 'translate(-50%, 0)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="pointer-events-auto flex items-center gap-1.5 border border-b-0 border-white/35 bg-[#070709]/92 px-3.5 py-1.5 text-[11px] font-semibold tracking-wider text-white/90 hover:bg-white hover:text-black"
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="whitespace-nowrap">
            {collapsed ? 'Ajustes (H)' : 'Ocultar Ajustes (H)'}
          </span>
        </button>
      </div>

      <div className="pointer-events-auto border border-white/35 bg-[#070709]/92 px-3.5 py-2.5 text-xs text-white shadow-2xl">
        {controlsContent}
      </div>
    </div>
  );
});
