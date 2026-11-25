import * as THREE from 'three';

export type DitherMode = 'blue' | 'bayer8' | 'bayer4' | 'hatch' | 'halftone' | 'contrast';
export type DitherPalette =
  | 'auto'
  | 'bone'
  | 'night'
  | 'amber'
  | 'crimson'
  | 'cobalt'
  | 'gameboy'
  | 'violet'
  | 'rust';
export type ColorDepthMode = '1bit' | '3contrast' | '5ramp' | '5contrast' | '5mixed';

export interface PaletteStops {
  dark: number;
  midDark: number;
  mid: number;
  midLight: number;
  light: number;
  accent: number;
  accentOnHotLum?: boolean;
}

export function setColorSrgbHex(target: THREE.Color, hex: number): THREE.Color {
  return target.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

export const PALETTE_COLORS: Record<Exclude<DitherPalette, 'auto'>, PaletteStops> = {
  bone: {
    dark: 0x050506,
    midDark: 0x2d333d,
    mid: 0x68727f,
    midLight: 0xb8bec6,
    light: 0xf5f5ef,
    accent: 0xe62929,
  },
  night: {
    dark: 0x030e06,
    midDark: 0x0f3a1b,
    mid: 0x277c3b,
    midLight: 0x58d162,
    light: 0xa6ff96,
    accent: 0xf2ffde,
    accentOnHotLum: true,
  },
  amber: {
    dark: 0x0e0802,
    midDark: 0x452208,
    mid: 0x8f4b10,
    midLight: 0xd68c2e,
    light: 0xffce6e,
    accent: 0xff3e24,
  },
  crimson: {
    dark: 0x0d0202,
    midDark: 0x42090a,
    mid: 0x881616,
    midLight: 0xd4312b,
    light: 0xff7a72,
    accent: 0xf5efe6,
    accentOnHotLum: true,
  },
  cobalt: {
    dark: 0x040812,
    midDark: 0x132b4d,
    mid: 0x2f5d8f,
    midLight: 0x73a8d4,
    light: 0xd8eeff,
    accent: 0xff3d4a,
  },
  gameboy: {
    dark: 0x0f1f0e,
    midDark: 0x234721,
    mid: 0x457536,
    midLight: 0x7ca651,
    light: 0xc2d987,
    accent: 0xf2f7b5,
    accentOnHotLum: true,
  },
  violet: {
    dark: 0x0b0514,
    midDark: 0x2e1747,
    mid: 0x633687,
    midLight: 0xa477c7,
    light: 0xeadcf8,
    accent: 0xff4081,
  },
  rust: {
    dark: 0x120906,
    midDark: 0x422116,
    mid: 0x7d452c,
    midLight: 0xb8764b,
    light: 0xe6bf98,
    accent: 0xff451f,
  },
};

export const MIXED_5_COLORS = {
  normal: [
    setColorSrgbHex(new THREE.Color(), 0x050608), // Preto Abissal
    setColorSrgbHex(new THREE.Color(), 0x2b4d70), // Azul Tempestade
    setColorSrgbHex(new THREE.Color(), 0xc42926), // Carmesim
    setColorSrgbHex(new THREE.Color(), 0xe0943d), // Âmbar Lanterna
    setColorSrgbHex(new THREE.Color(), 0xf4f2e8), // Branco Osso
  ],
  night: [
    setColorSrgbHex(new THREE.Color(), 0x030e06),
    setColorSrgbHex(new THREE.Color(), 0x11451e),
    setColorSrgbHex(new THREE.Color(), 0x32b84e),
    setColorSrgbHex(new THREE.Color(), 0x8cff75),
    setColorSrgbHex(new THREE.Color(), 0xf2ffde),
  ],
  cobalt: [
    setColorSrgbHex(new THREE.Color(), 0x040812),
    setColorSrgbHex(new THREE.Color(), 0x1c3d6e),
    setColorSrgbHex(new THREE.Color(), 0x5c3c82),
    setColorSrgbHex(new THREE.Color(), 0x57a6c4),
    setColorSrgbHex(new THREE.Color(), 0xe8f6ff),
  ],
  gameboy: [
    setColorSrgbHex(new THREE.Color(), 0x0f1f0e),
    setColorSrgbHex(new THREE.Color(), 0x285225),
    setColorSrgbHex(new THREE.Color(), 0x53823d),
    setColorSrgbHex(new THREE.Color(), 0x8cb356),
    setColorSrgbHex(new THREE.Color(), 0xd4e899),
  ],
  violet: [
    setColorSrgbHex(new THREE.Color(), 0x0b0514),
    setColorSrgbHex(new THREE.Color(), 0x381c59),
    setColorSrgbHex(new THREE.Color(), 0x992e64),
    setColorSrgbHex(new THREE.Color(), 0xb875cf),
    setColorSrgbHex(new THREE.Color(), 0xf2e8fc),
  ],
  rust: [
    setColorSrgbHex(new THREE.Color(), 0x120906),
    setColorSrgbHex(new THREE.Color(), 0x4f2316),
    setColorSrgbHex(new THREE.Color(), 0x9c331c),
    setColorSrgbHex(new THREE.Color(), 0xc47e45),
    setColorSrgbHex(new THREE.Color(), 0xf0d2ae),
  ],
};

/**
 * Generates a tileable 64x64 Void-and-Cluster Blue Noise DataTexture
 * with uniform spatial distribution and zero grid artifacts.
 */
export function createBlueNoiseTexture(): THREE.DataTexture {
  const S = 64;
  const N = S * S;
  const K = 5;
  const KW = K * 2 + 1;
  const sigma = 1.5;

  const kernel = new Float32Array(KW * KW);
  for (let dy = -K; dy <= K; dy++) {
    for (let dx = -K; dx <= K; dx++) {
      kernel[(dy + K) * KW + (dx + K)] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }

  const addEnergy = (energy: Float32Array, idx: number, sign: number) => {
    const px = idx & 63;
    const py = idx >> 6;
    for (let dy = -K; dy <= K; dy++) {
      const ny = (py + dy + S) & 63;
      const rowOff = ny * S;
      const kRow = (dy + K) * KW;
      for (let dx = -K; dx <= K; dx++) {
        const nx = (px + dx + S) & 63;
        energy[rowOff + nx] += sign * kernel[kRow + (dx + K)];
      }
    }
  };

  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const pattern = new Uint8Array(N);
  const energy = new Float32Array(N);
  const M = 400;

  let placed = 0;
  while (placed < M) {
    const idx = Math.floor(rand() * N);
    if (pattern[idx] === 0) {
      pattern[idx] = 1;
      addEnergy(energy, idx, 1);
      placed++;
    }
  }

  for (let iter = 0; iter < 250; iter++) {
    let maxIdx = -1;
    let maxE = -Infinity;
    for (let i = 0; i < N; i++) {
      if (pattern[i] === 1 && energy[i] > maxE) {
        maxE = energy[i];
        maxIdx = i;
      }
    }
    if (maxIdx < 0) break;
    pattern[maxIdx] = 0;
    addEnergy(energy, maxIdx, -1);

    let minIdx = -1;
    let minE = Infinity;
    for (let i = 0; i < N; i++) {
      if (pattern[i] === 0 && energy[i] < minE) {
        minE = energy[i];
        minIdx = i;
      }
    }
    if (minIdx === maxIdx || minIdx < 0) {
      pattern[maxIdx] = 1;
      addEnergy(energy, maxIdx, 1);
      break;
    }
    pattern[minIdx] = 1;
    addEnergy(energy, minIdx, 1);
  }

  const ranks = new Int32Array(N);
  const pWork = pattern.slice();
  const eWork = energy.slice();
  for (let r = M - 1; r >= 0; r--) {
    let maxIdx = -1;
    let maxE = -Infinity;
    for (let i = 0; i < N; i++) {
      if (pWork[i] === 1 && eWork[i] > maxE) {
        maxE = eWork[i];
        maxIdx = i;
      }
    }
    pWork[maxIdx] = 0;
    addEnergy(eWork, maxIdx, -1);
    ranks[maxIdx] = r;
  }

  pWork.set(pattern);
  eWork.set(energy);
  const halfN = N >> 1;
  for (let r = M; r < halfN; r++) {
    let minIdx = -1;
    let minE = Infinity;
    for (let i = 0; i < N; i++) {
      if (pWork[i] === 0 && eWork[i] < minE) {
        minE = eWork[i];
        minIdx = i;
      }
    }
    pWork[minIdx] = 1;
    addEnergy(eWork, minIdx, 1);
    ranks[minIdx] = r;
  }

  const qWork = new Uint8Array(N);
  const eZero = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (pWork[i] === 0) {
      qWork[i] = 1;
      addEnergy(eZero, i, 1);
    }
  }
  for (let r = halfN; r < N; r++) {
    let maxIdx = -1;
    let maxE = -Infinity;
    for (let i = 0; i < N; i++) {
      if (qWork[i] === 1 && eZero[i] > maxE) {
        maxE = eZero[i];
        maxIdx = i;
      }
    }
    qWork[maxIdx] = 0;
    addEnergy(eZero, maxIdx, -1);
    ranks[maxIdx] = r;
  }

  const rgba = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const v = Math.max(0, Math.min(255, Math.round(((ranks[i] + 0.5) / N) * 255)));
    rgba[i * 4] = v;
    rgba[i * 4 + 1] = v;
    rgba[i * 4 + 2] = v;
    rgba[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(rgba, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const DitherShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uBlueNoise: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(640, 360) },
    uPixelScale: { value: 1.0 },
    uMode: { value: 3 }, // 0=Bayer4, 1=Bayer8, 2=Contrast, 3=BlueNoise, 4=Crosshatch, 5=Halftone
    uColorMode: { value: 2 }, // 0=1bit, 1=5ramp, 2=5contrast, 3=5mixed, 4=3contrast
    uDarkColor: { value: setColorSrgbHex(new THREE.Color(), 0x050506) },
    uMidDarkColor: { value: setColorSrgbHex(new THREE.Color(), 0x2d333d) },
    uMidColor: { value: setColorSrgbHex(new THREE.Color(), 0x68727f) },
    uMidLightColor: { value: setColorSrgbHex(new THREE.Color(), 0xb8bec6) },
    uLightColor: { value: setColorSrgbHex(new THREE.Color(), 0xf5f5ef) },
    uAccentColor: { value: setColorSrgbHex(new THREE.Color(), 0xe62929) },
    uMixed0: { value: MIXED_5_COLORS.normal[0].clone() },
    uMixed1: { value: MIXED_5_COLORS.normal[1].clone() },
    uMixed2: { value: MIXED_5_COLORS.normal[2].clone() },
    uMixed3: { value: MIXED_5_COLORS.normal[3].clone() },
    uMixed4: { value: MIXED_5_COLORS.normal[4].clone() },
    uAccentMode: { value: 0.0 },
    uCamcorder: { value: 0.0 },
    uDamagePulse: { value: 0.0 },
    uMuzzleBoost: { value: 0.0 },
    uSonarWave: { value: 0.0 },
    uSonarPulse: { value: 0.0 },
    uSonarProximity: { value: 0.0 },
    uFlashInvert: { value: 0.0 },
    uThreat: { value: 0.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D uBlueNoise;
    uniform vec2 uResolution;
    uniform float uPixelScale;
    uniform int uMode;
    uniform int uColorMode;
    uniform vec3 uDarkColor;
    uniform vec3 uMidDarkColor;
    uniform vec3 uMidColor;
    uniform vec3 uMidLightColor;
    uniform vec3 uLightColor;
    uniform vec3 uAccentColor;
    uniform vec3 uMixed0;
    uniform vec3 uMixed1;
    uniform vec3 uMixed2;
    uniform vec3 uMixed3;
    uniform vec3 uMixed4;
    uniform float uAccentMode;
    uniform float uCamcorder;
    uniform float uDamagePulse;
    uniform float uMuzzleBoost;
    uniform float uSonarWave;
    uniform float uSonarPulse;
    uniform float uSonarProximity;
    uniform float uFlashInvert;
    uniform float uThreat;
    uniform float uTime;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float bayer4x4(vec2 p) {
      int x = int(mod(p.x, 4.0));
      int y = int(mod(p.y, 4.0));
      int idx = y * 4 + x;
      if (idx == 0)  return 0.0 / 16.0;
      if (idx == 1)  return 8.0 / 16.0;
      if (idx == 2)  return 2.0 / 16.0;
      if (idx == 3)  return 10.0 / 16.0;
      if (idx == 4)  return 12.0 / 16.0;
      if (idx == 5)  return 4.0 / 16.0;
      if (idx == 6)  return 14.0 / 16.0;
      if (idx == 7)  return 6.0 / 16.0;
      if (idx == 8)  return 3.0 / 16.0;
      if (idx == 9)  return 11.0 / 16.0;
      if (idx == 10) return 1.0 / 16.0;
      if (idx == 11) return 9.0 / 16.0;
      if (idx == 12) return 15.0 / 16.0;
      if (idx == 13) return 7.0 / 16.0;
      if (idx == 14) return 13.0 / 16.0;
      return 5.0 / 16.0;
    }

    float bayer2x2(vec2 p) {
      int x = int(mod(p.x, 2.0));
      int y = int(mod(p.y, 2.0));
      int idx = y * 2 + x;
      if (idx == 0) return 0.0;
      if (idx == 1) return 2.0;
      if (idx == 2) return 3.0;
      return 1.0;
    }

    float bayer8x8(vec2 p) {
      vec2 q = floor(mod(p, 8.0) * 0.25);
      return bayer4x4(p) + bayer2x2(q) / 64.0;
    }

    // Woodcut / horror manga multi-tier crosshatching pattern with strong ink outlines
    float crosshatchBit(vec2 cell, float lum, float edge) {
      if (edge > 0.14 && lum > 0.05) return 1.0;

      float h1 = step(0.48, fract((cell.x + cell.y) * 0.24));
      float h2 = step(0.48, fract((cell.x - cell.y) * 0.24));
      float h3 = step(0.44, fract((cell.x + cell.y * 0.35) * 0.32));
      float h4 = step(0.54, fract(cell.y * 0.28));

      if (lum > 0.84) return 1.0;
      if (lum > 0.58) return h1;
      if (lum > 0.36) return min(h1, h2);
      if (lum > 0.18) return min(min(h1, h2), h3);
      if (lum > 0.045) return min(min(h1, h2), min(h3, h4));
      return 0.0;
    }

    // 45-degree rotated newsprint / dossier halftone dot screen
    float halftoneBit(vec2 cell, float lum) {
      float s = 0.70710678;
      vec2 rot = vec2(cell.x * s - cell.y * s, cell.x * s + cell.y * s);
      float period = 4.5;
      vec2 local = fract(rot / period) - 0.5;
      float d = length(local) * 1.414;
      float radius = sqrt(clamp(lum * 1.05, 0.0, 1.0));
      return step(d, radius);
    }

    // Evaluates any of the 6 dither styles for a normalized interval value in [0..1]
    float ditherPatternBit(vec2 cell, float value, float edgeMag, bool crispContrast) {
      if (uMode == 4) {
        return crosshatchBit(cell, value, edgeMag);
      }
      if (uMode == 5) {
        return halftoneBit(cell, value);
      }
      float thr = 0.5;
      if (uMode == 0) {
        thr = bayer4x4(cell) * 0.92 + 0.04;
      } else if (uMode == 1) {
        thr = bayer8x8(cell) * 0.92 + 0.04;
      } else if (uMode == 2) {
        thr = 0.36 + (bayer4x4(cell) - 0.5) * 0.34;
      } else {
        float bn = texture2D(uBlueNoise, (cell + 0.5) / 64.0).r;
        thr = bn * 0.92 + 0.04;
      }
      return step(thr, value);
    }

    vec3 getMixedPaletteColor(int idx) {
      if (idx == 0) return uMixed0;
      if (idx == 1) return uMixed1;
      if (idx == 2) return uMixed2;
      if (idx == 3) return uMixed3;
      return uMixed4;
    }

    vec3 sampleSrgb(vec2 uv) {
      vec3 lin = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
      return pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));
    }

      vec3 getRampStop(int idx) {
        if (idx == 0) return uDarkColor;
        if (idx == 1) return uMidDarkColor;
        if (idx == 2) return uMidColor;
        if (idx == 3) return uMidLightColor;
        return uLightColor;
      }

      void main() {
        vec2 gridRes = max(vec2(64.0), floor(uResolution / max(1.0, uPixelScale)));
        vec2 cell = floor(vUv * gridRes);
        vec2 snappedUv = (cell + 0.5) / gridRes;
        vec2 texel = 1.0 / gridRes;

        vec2 centered = vUv - 0.5;
        float radial = length(centered);
        if (uDamagePulse > 0.01) {
          float jitter = sin(snappedUv.y * 90.0 + uTime * 35.0) * 0.014 * uDamagePulse * radial;
          snappedUv.x += jitter;
        }
        if (uThreat > 0.35) {
          float panicGlitch = step(0.986 - (uThreat - 0.35) * 0.025, fract(sin(floor(uTime * 18.0) * 43.17 + snappedUv.y * 23.0) * 19453.2));
          snappedUv.x += panicGlitch * 0.005 * uThreat * sin(uTime * 55.0);
        }

        if (uCamcorder > 0.5) {
          float scanBand = step(0.993, fract(sin(floor(uTime * 12.0) * 78.233 + snappedUv.y * 19.0) * 43758.5));
          snappedUv.x += scanBand * 0.008 * sin(uTime * 60.0);
        }

        // Sonar Lens + Radio/Sensor threat distortion (intensifies with killer proximity & pulse beats)
        float sonarDistort = uCamcorder * clamp(uSonarProximity * 0.72 + uSonarPulse * (0.42 + uSonarProximity * 0.78), 0.0, 1.5);
        float sonarTear = 0.0;
        if (uCamcorder > 0.5 && sonarDistort > 0.01) {
          float bandFreq = 26.0 + uSonarProximity * 34.0;
          float bandTime = floor(uTime * (14.0 + uSonarProximity * 22.0));
          float rowHash = fract(sin(floor(snappedUv.y * bandFreq) * 91.7 + bandTime * 17.3) * 43758.5);
          sonarTear = step(0.93 - sonarDistort * 0.24, rowHash);
          snappedUv.x += sonarTear * sin(uTime * 68.0 + snappedUv.y * 110.0) * (0.008 + sonarDistort * 0.036);
          if (uSonarPulse > 0.02) {
            vec2 radialDir = radial > 0.0001 ? centered / radial : vec2(0.0);
            snappedUv += radialDir * sin(radial * 40.0 - uTime * 24.0) * 0.0065 * uSonarPulse * (0.3 + uSonarProximity);
          }
        }

        vec3 col = sampleSrgb(snappedUv);
        float rawLum = dot(col, vec3(0.299, 0.587, 0.114));
        float lum = rawLum;

        // Crisp chiaroscuro & graphic-novel ink edge detection
        float lumN = dot(sampleSrgb(snappedUv + vec2(0.0, texel.y)), vec3(0.299, 0.587, 0.114));
        float lumS = dot(sampleSrgb(snappedUv - vec2(0.0, texel.y)), vec3(0.299, 0.587, 0.114));
        float lumE = dot(sampleSrgb(snappedUv + vec2(texel.x, 0.0)), vec3(0.299, 0.587, 0.114));
        float lumW = dot(sampleSrgb(snappedUv - vec2(texel.x, 0.0)), vec3(0.299, 0.587, 0.114));
        float laplacian = lum * 4.0 - (lumN + lumS + lumE + lumW);
        float edgeMag = abs(laplacian);
        lum = clamp(lum + laplacian * 0.68, 0.0, 1.0);

        // Soft highlight roll-off preserves plate/metal/skin etching near the flashlight beam
        lum = lum / (0.85 + lum * 0.50);

        // Oppressive abyssal darkness curve: unlit hallways collapse into true black
        float darkFloor = 0.068 - uCamcorder * 0.036;
        float lit = max(0.0, lum - darkFloor) * (1.32 + uCamcorder * 0.28) + uMuzzleBoost * 0.34;
        lum = pow(clamp(lit, 0.0, 1.0), 0.96);

        // Sonar pulse expanding ripple highlights silhouettes & walls as it sweeps outward
        float sonarRing = 0.0;
        if (uSonarWave > 0.01) {
          float waveR = (1.0 - uSonarWave) * 0.88;
          sonarRing = smoothstep(0.07, 0.0, abs(radial - waveR)) * uSonarWave;
          lum = clamp(lum + sonarRing * (0.28 + edgeMag * 2.2), 0.0, 1.0);
        }

        // Threat pulse wave triggered whenever Radio or Sonar Sensor detects killer nearby
        float threatRing = 0.0;
        if (uCamcorder > 0.5 && uSonarPulse > 0.01) {
          float pulseR = (1.0 - uSonarPulse) * 0.92;
          threatRing = smoothstep(0.09, 0.0, abs(radial - pulseR)) * uSonarPulse * (0.42 + uSonarProximity * 0.58);
          lum = clamp(lum + threatRing * (0.36 + edgeMag * 2.0), 0.0, 1.0);
        }

        // Subtle 16mm horror grain + sonar interference noise
        float filmGrain = (hash12(cell + floor(uTime * 16.0)) - 0.5) * (0.02 + uThreat * 0.042);
        lum = clamp(lum + filmGrain, 0.0, 1.0);

        if (uCamcorder > 0.5) {
          float scan = mod(cell.y, 2.0) > 0.5 ? -0.048 : 0.032;
          float irNoise = (hash12(cell + floor(uTime * 24.0)) - 0.5) * (0.055 + sonarDistort * 0.14);
          lum = clamp(lum + scan + irNoise, 0.0, 1.0);
        }

        // Claustrophobic tunnel-vision vignette that tightens further under threat
        float vigOuter = 0.88 - uCamcorder * 0.06 - uThreat * 0.16;
        float vigInner = 0.20 - uThreat * 0.06;
        float vig = smoothstep(vigOuter, vigInner, radial);
        lum *= mix(0.20 - uThreat * 0.12, 1.0, vig);

        if (uDamagePulse > 0.01) {
          float edgeMask = smoothstep(0.22, 0.68, radial);
          lum -= edgeMask * uDamagePulse * 0.55;
        }
        lum = clamp(lum, 0.0, 1.0);

        // Strobe Flash blinding peak -> photographic negative burn
        if (uFlashInvert > 0.01) {
          float inv = 1.0 - lum;
          lum = mix(lum, inv, clamp(uFlashInvert * 1.15, 0.0, 1.0));
          if (uFlashInvert > 0.72) {
            lum = clamp(lum + (uFlashInvert - 0.72) * 3.2, 0.0, 1.0);
          }
        }

        // Detect warm crimson/signal surfaces (blood stains, medkit cross, red switches/LEDs)
        float warmSignal = step(0.08, col.r - max(col.g, col.b) * 1.18) * step(0.05, lum);
        float hotSignal = uAccentMode * smoothstep(0.76, 0.95, lum);

        vec3 outCol;
        if (uColorMode == 0) {
          // 1-Bit (2 colors)
          float bit = ditherPatternBit(cell, lum, edgeMag, false);
          outCol = mix(uDarkColor, uLightColor, bit);
        } else if (uColorMode == 4) {
          // 3 Cores c/ Destaque
          float bit = ditherPatternBit(cell, lum, edgeMag, true);
          vec3 baseCol = mix(uDarkColor, uLightColor, bit);
          float accentBit = ditherPatternBit(cell, clamp(max(warmSignal * 0.95, hotSignal), 0.0, 1.0), edgeMag * 0.3, false);
          outCol = mix(baseCol, uAccentColor, accentBit * max(warmSignal, hotSignal));
        } else if (uColorMode == 3) {
          // 5 Cores Mistas
          float scaled = lum * 4.0;
          int idx = int(clamp(floor(scaled), 0.0, 3.0));
          float frac = lum >= 1.0 ? 1.0 : fract(scaled);
          float bit = ditherPatternBit(cell, frac, edgeMag * 0.55, false);
          vec3 cA = getMixedPaletteColor(idx);
          vec3 cB = getMixedPaletteColor(idx + 1);
          outCol = mix(cA, cB, bit);
          // Bold horror-manga ink contour on sharp silhouette transitions
          if (uMode == 4 && edgeMag > 0.22 && rawLum > 0.08) {
            outCol = mix(outCol, uMixed0, 0.72);
          }
        } else if (uColorMode == 2) {
          // 5 Cores Contraste (+ destaque de acento)
          float contrastLum = clamp((lum - 0.5) * 1.24 + 0.5, 0.0, 1.0);
          float scaled = contrastLum * 4.0;
          int idx = int(clamp(floor(scaled), 0.0, 3.0));
          float frac = contrastLum >= 1.0 ? 1.0 : fract(scaled);
          float bit = ditherPatternBit(cell, frac, edgeMag * 0.5, true);
          outCol = mix(getRampStop(idx), getRampStop(idx + 1), bit);
          float accentStrength = max(warmSignal * 0.85, hotSignal * 0.75);
          outCol = mix(outCol, uAccentColor, step(0.5, accentStrength));
        } else {
          // uColorMode == 1: 5 Cores Suaves (5-stop dithered ramp)
          float scaled = lum * 4.0;
          int idx = int(clamp(floor(scaled), 0.0, 3.0));
          float frac = lum >= 1.0 ? 1.0 : fract(scaled);
          float bit = ditherPatternBit(cell, frac, edgeMag * 0.4, false);
          outCol = mix(getRampStop(idx), getRampStop(idx + 1), bit);
        }

        if (sonarRing > 0.15) {
          outCol = mix(outCol, uLightColor, sonarRing * 0.45);
        }

        // Escalating 1-Bit Sonar & Radio Threat Pulse Distortion
        if (uCamcorder > 0.5 && (uSonarProximity > 0.01 || uSonarPulse > 0.01)) {
          float crushScale = 1.0 + floor(sonarDistort * 2.4);
          vec2 coarseCell = floor(cell / crushScale);
          float pulseFlicker = (hash12(coarseCell + floor(uTime * 32.0)) - 0.5) * (0.14 + uSonarProximity * 0.28);
          float crushedLum = clamp((lum - 0.46) * (1.18 + sonarDistort * 0.45) + 0.5 + pulseFlicker, 0.0, 1.0);
          float bit1 = step(bayer4x4(coarseCell) * 0.92 + 0.04, crushedLum);
          vec3 dither1BitCol = mix(uDarkColor, uLightColor, bit1);

          float edgeZone = smoothstep(0.22 - uSonarProximity * 0.14, 0.72, radial);
          float pulseBurst = uSonarPulse * (0.38 + uSonarProximity * 0.62);
          float bitMix = clamp(
            uSonarProximity * 0.65 * edgeZone +
            pulseBurst * 0.68 +
            sonarTear * (0.55 + uSonarProximity * 0.45) +
            threatRing * 0.85,
            0.0,
            1.0
          );
          outCol = mix(outCol, dither1BitCol, bitMix);

          if (threatRing > 0.12) {
            float ringBit = step(bayer4x4(cell), clamp(threatRing * 1.15, 0.0, 1.0));
            outCol = mix(outCol, uAccentColor, ringBit * 0.72);
          }
          if (sonarTear > 0.5 && uSonarPulse > 0.25) {
            outCol = mix(outCol, uAccentColor, 0.35 * uSonarPulse);
          }
        }

        if (uDamagePulse > 0.28 && radial > 0.44) {
          float dmgZone = smoothstep(0.44, 0.78, radial) * (uDamagePulse - 0.28) * 1.35;
          float pulseMask = step(0.5, fract(cell.y * 0.5)) * step(0.4, dmgZone);
          outCol = mix(outCol, mix(uLightColor, uDarkColor, step(0.5, dot(outCol, vec3(0.333)))), pulseMask);
        }

        gl_FragColor = vec4(outCol, 1.0);
      }
  `,
};

export function applySoftwareBayerDither(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      /* glsl */ `
      #include <dithering_fragment>
      {
        float swLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        swLum = pow(clamp(max(0.0, swLum - 0.04) * 1.42, 0.0, 1.0), 0.94);
        vec2 sc = floor(gl_FragCoord.xy * 0.5);
        int bx = int(mod(sc.x, 4.0));
        int by = int(mod(sc.y, 4.0));
        int bIdx = by * 4 + bx;
        float bThr = 0.5;
        if (bIdx == 0)  bThr = 0.0625;
        else if (bIdx == 1)  bThr = 0.5625;
        else if (bIdx == 2)  bThr = 0.1875;
        else if (bIdx == 3)  bThr = 0.6875;
        else if (bIdx == 4)  bThr = 0.8125;
        else if (bIdx == 5)  bThr = 0.3125;
        else if (bIdx == 6)  bThr = 0.9375;
        else if (bIdx == 7)  bThr = 0.4375;
        else if (bIdx == 8)  bThr = 0.2500;
        else if (bIdx == 9)  bThr = 0.7500;
        else if (bIdx == 10) bThr = 0.1250;
        else if (bIdx == 11) bThr = 0.6250;
        else if (bIdx == 12) bThr = 0.9688;
        else if (bIdx == 13) bThr = 0.4688;
        else if (bIdx == 14) bThr = 0.8750;
        else bThr = 0.3750;
        float swBit = step(bThr, swLum);
        gl_FragColor.rgb = mix(vec3(0.02, 0.022, 0.024), vec3(0.955, 0.955, 0.935), swBit);
      }
      `,
    );
  };
  material.customProgramCacheKey = () => 'sw-bayer-1bit';
}
