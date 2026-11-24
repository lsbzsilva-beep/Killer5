import * as THREE from 'three';

export interface SanatoriumTextures {
  wallMap: THREE.CanvasTexture;
  wallNormal: THREE.CanvasTexture;
  wallRoughness: THREE.CanvasTexture;
  floorMap: THREE.CanvasTexture;
  floorNormal: THREE.CanvasTexture;
  floorRoughness: THREE.CanvasTexture;
  ceilingMap: THREE.CanvasTexture;
  ceilingNormal: THREE.CanvasTexture;
  doorMap: THREE.CanvasTexture;
  doorNormal: THREE.CanvasTexture;
  metalMap: THREE.CanvasTexture;
  metalRoughness: THREE.CanvasTexture;
  fabricMap: THREE.CanvasTexture;
  fleshMap: THREE.CanvasTexture;
  fleshNormal: THREE.CanvasTexture;
  gaugeMap: THREE.CanvasTexture;
  shadowDisc: THREE.CanvasTexture;
  posterNoticeMap: THREE.CanvasTexture;
  posterAnatomyMap: THREE.CanvasTexture;
  graffitiMap: THREE.CanvasTexture;
  stainDecalMap: THREE.CanvasTexture;
  paperMap: THREE.CanvasTexture;
  windowGlowMap: THREE.CanvasTexture;
  dustMoteMap: THREE.CanvasTexture;
  courtyardGroundMap: THREE.CanvasTexture;
  courtyardGroundNormal: THREE.CanvasTexture;
  courtyardGroundRoughness: THREE.CanvasTexture;
  stoneBrickMap: THREE.CanvasTexture;
  stoneBrickNormal: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  signageMap: THREE.CanvasTexture;
  dispose: () => void;
}

function seededNoise(x: number, y: number, seed = 1337): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x: number, y: number, seed = 17): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    const ix = Math.floor(x * freq);
    const iy = Math.floor(y * freq);
    const fx = x * freq - ix;
    const fy = y * freq - iy;
    const u = fx * fx * (3 - 2 * fx);
    const w = fy * fy * (3 - 2 * fy);
    const a = seededNoise(ix, iy, seed + i);
    const b = seededNoise(ix + 1, iy, seed + i);
    const c = seededNoise(ix, iy + 1, seed + i);
    const d = seededNoise(ix + 1, iy + 1, seed + i);
    v += amp * ((a * (1 - u) + b * u) * (1 - w) + (c * (1 - u) + d * u) * w);
    amp *= 0.5;
    freq *= 2.02;
  }
  return v;
}

function heightToNormalCanvas(heightData: Float32Array, size: number, strength = 2.8): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return heightData[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);
      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);
      const idx = (y * size + x) * 4;
      d[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSanatoriumTextures(renderer: THREE.WebGLRenderer): SanatoriumTextures {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const created: THREE.Texture[] = [];
  const reg = <T extends THREE.Texture>(t: T): T => {
    created.push(t);
    return t;
  };

  // 1. WALL TEXTURE SET (512x512): Exposed brick patches + peeling plaster + carved dado + crazed tiles
  const W = 512;
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = W;
  wallCanvas.height = W;
  const wCtx = wallCanvas.getContext('2d')!;
  const wImg = wCtx.createImageData(W, W);
  const wRoughCanvas = document.createElement('canvas');
  wRoughCanvas.width = W;
  wRoughCanvas.height = W;
  const wrCtx = wRoughCanvas.getContext('2d')!;
  const wrImg = wrCtx.createImageData(W, W);
  const wallHeight = new Float32Array(W * W);

  const dadoY = Math.floor(W * 0.56);
  const tileCols = 8;
  const tileRows = 6;
  const lowerH = W - dadoY;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const n1 = fbm(x * 0.028, y * 0.028, 11);
      const n2 = fbm(x * 0.14, y * 0.14, 29);
      const streak = fbm(x * 0.08, y * 0.01, 41);

      let lum = 182;
      let h = 0.56;
      let rough = 210;

      if (y < dadoY - 12) {
        // Upper plaster with moisture leaks, mold blooms, and exposed underlying brick
        lum = 162 + (n1 - 0.5) * 84 + (n2 - 0.5) * 40;
        h = 0.58 + (n1 - 0.5) * 0.24 + (n2 - 0.5) * 0.14;

        // Top crown shadow & water seepage
        if (y < 46) {
          const topFrac = 1 - y / 46;
          lum -= topFrac * 82;
          rough -= topFrac * 45;
        }
        if (streak > 0.61) {
          const damp = Math.min(1, (streak - 0.61) * 2.8);
          lum -= damp * 92;
          rough -= damp * 78;
        }

        // Exposed rough brickwork where plaster has fallen away
        if (n1 < 0.26) {
          const brickRow = Math.floor(y / 18);
          const brickOff = (brickRow % 2) * 20;
          const bx = ((x + brickOff) % 40) / 40;
          const by = (y % 18) / 18;
          const mortar = bx < 0.1 || bx > 0.9 || by < 0.15 || by > 0.85;
          lum = mortar ? 44 : 84 + (n2 - 0.5) * 34;
          h = mortar ? 0.14 : 0.34 + (n2 - 0.5) * 0.1;
          rough = 248;
        } else if (n1 < 0.3) {
          // Raised curled plaster rim around exposed brick
          lum += 26;
          h += 0.18;
        }
      } else if (y <= dadoY + 14) {
        // Carved double-bevel wooden/stone dado rail
        const dy = (y - (dadoY - 12)) / 26;
        const profile = Math.sin(dy * Math.PI);
        lum = 128 + profile * 95 + (n2 - 0.5) * 22;
        h = 0.55 + profile * 0.4;
        rough = 145;
      } else {
        // Lower glazed ceramic hospital tiles with chipped corners and grime
        const ty = (y - dadoY - 14) / (lowerH - 14);
        const tx = x / W;
        const uTile = (tx * tileCols) % 1;
        const vTile = (ty * tileRows) % 1;
        const cellX = Math.floor(tx * tileCols);
        const cellY = Math.floor(ty * tileRows);
        const cellId = cellX * 19 + cellY * 31;
        const tileTint = (seededNoise(cellId, 5, 77) - 0.5) * 30;
        const missingTile = seededNoise(cellId, 11, 99) > 0.94;
        const seam = uTile < 0.055 || uTile > 0.945 || vTile < 0.07 || vTile > 0.93;

        if (seam || missingTile) {
          lum = missingTile ? 52 + (n2 - 0.5) * 25 : 36 + (n2 - 0.5) * 16;
          h = missingTile ? 0.16 : 0.1;
          rough = 245;
        } else {
          const bevel = Math.min(uTile, 1 - uTile, vTile, 1 - vTile);
          const bevelBoost = bevel < 0.15 ? (bevel / 0.15) * 28 : 28;
          lum = 160 + tileTint + bevelBoost + (n2 - 0.5) * 24;
          h = 0.68 + (bevel < 0.15 ? bevel * 0.65 : 0.12);
          rough = 78 + (n1 - 0.5) * 48; // porcelain catches dynamic flashlight glint
          if (y > W - 54) {
            const g = (y - (W - 54)) / 54;
            lum -= g * 92;
            rough += g * 100;
          }
        }
      }

      // Deep plaster hairline fractures
      const crack = Math.abs(fbm(x * 0.048, y * 0.048, 93) - 0.5);
      if (crack < 0.014) {
        lum -= 85;
        h -= 0.34;
        rough = 244;
      }

      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      const rVal = Math.max(18, Math.min(255, Math.round(rough)));
      wImg.data[idx] = wImg.data[idx + 1] = wImg.data[idx + 2] = cVal;
      wImg.data[idx + 3] = 255;
      wrImg.data[idx] = wrImg.data[idx + 1] = wrImg.data[idx + 2] = rVal;
      wrImg.data[idx + 3] = 255;
      wallHeight[y * W + x] = h;
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  wrCtx.putImageData(wrImg, 0, 0);
  const wallNormalCanvas = heightToNormalCanvas(wallHeight, W, 3.2);

  // 2. FLOOR TEXTURE SET (512x512): Checkered worn linoleum, cracked tiles, wet puddles
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = W;
  floorCanvas.height = W;
  const fCtx = floorCanvas.getContext('2d')!;
  const fImg = fCtx.createImageData(W, W);
  const fRoughCanvas = document.createElement('canvas');
  fRoughCanvas.width = W;
  fRoughCanvas.height = W;
  const frCtx = fRoughCanvas.getContext('2d')!;
  const frImg = frCtx.createImageData(W, W);
  const floorHeight = new Float32Array(W * W);

  const fGrid = 4;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const gx = (x / W) * fGrid;
      const gy = (y / W) * fGrid;
      const cx = Math.floor(gx);
      const cy = Math.floor(gy);
      const ux = gx - cx;
      const uy = gy - cy;
      const checker = (cx + cy) % 2 === 0;
      const n1 = fbm(x * 0.025, y * 0.025, 203);
      const n2 = fbm(x * 0.13, y * 0.13, 211);
      const puddle = fbm(x * 0.017, y * 0.017, 307);

      const seam = ux < 0.042 || ux > 0.958 || uy < 0.042 || uy > 0.958;
      let lum = checker ? 138 : 74;
      let h = 0.65;
      let rough = checker ? 170 : 190;

      if (seam) {
        lum = 24;
        h = 0.12;
        rough = 248;
      } else {
        lum += (n1 - 0.5) * 62 + (n2 - 0.5) * 30;
        h += (n2 - 0.5) * 0.16;
        if (n2 > 0.72) lum -= 28;
        const crack = Math.abs(fbm(x * 0.055, y * 0.055, 251) - 0.5);
        if (crack < 0.011) {
          lum -= 52;
          h -= 0.25;
        }
        if (puddle > 0.57) {
          const wet = Math.min(1, (puddle - 0.57) * 3.9);
          rough = Math.round(rough * (1 - wet * 0.86));
          lum -= wet * 24;
          h = h * (1 - wet * 0.5) + 0.68 * (wet * 0.5);
        }
      }

      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      const rVal = Math.max(16, Math.min(255, Math.round(rough)));
      fImg.data[idx] = fImg.data[idx + 1] = fImg.data[idx + 2] = cVal;
      fImg.data[idx + 3] = 255;
      frImg.data[idx] = frImg.data[idx + 1] = frImg.data[idx + 2] = rVal;
      frImg.data[idx + 3] = 255;
      floorHeight[y * W + x] = h;
    }
  }
  fCtx.putImageData(fImg, 0, 0);
  frCtx.putImageData(frImg, 0, 0);
  const floorNormalCanvas = heightToNormalCanvas(floorHeight, W, 2.6);

  // 3. CEILING TEXTURE SET (256x256): Weathered wooden ceiling planks with cracks & damp mold stains
  const C = 256;
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = C;
  ceilCanvas.height = C;
  const cCtx = ceilCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(C, C);
  const ceilHeight = new Float32Array(C * C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const idx = (y * C + x) * 4;
      const plankIdx = Math.floor((y / C) * 6);
      const py = ((y / C) * 6) % 1;
      const plankSeam = py < 0.065 || py > 0.935;
      const jointOffset = ((plankIdx % 2) * 0.5 + 0.15) * C;
      const crossSeam = Math.abs(((x + jointOffset) % C) - C * 0.5) < 2.2;
      const grain = fbm(x * 0.035, y * 0.34 + plankIdx * 7.3, 409);
      const damp = fbm(x * 0.022, y * 0.022, 433);
      let lum = 88 + (grain - 0.5) * 52 + ((plankIdx % 3) - 1) * 8;
      if (damp < 0.38) lum -= 26;
      let h = 0.62 + (grain - 0.5) * 0.24;
      if (plankSeam || crossSeam) {
        lum = 18;
        h = 0.08;
      }
      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      cImg.data[idx] = cImg.data[idx + 1] = cImg.data[idx + 2] = cVal;
      cImg.data[idx + 3] = 255;
      ceilHeight[y * C + x] = h;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  const ceilNormalCanvas = heightToNormalCanvas(ceilHeight, C, 2.8);

  // 4. EXIT DOOR TEXTURE (256x512)
  const DW = 256;
  const DH = 512;
  const doorCanvas = document.createElement('canvas');
  doorCanvas.width = DW;
  doorCanvas.height = DH;
  const dCtx = doorCanvas.getContext('2d')!;
  dCtx.fillStyle = '#555';
  dCtx.fillRect(0, 0, DW, DH);
  dCtx.strokeStyle = '#1b1b1b';
  dCtx.lineWidth = 8;
  dCtx.strokeRect(10, 10, DW - 20, DH - 20);
  for (let px = 36; px < DW - 20; px += 38) {
    dCtx.strokeStyle = '#262626';
    dCtx.lineWidth = 2;
    dCtx.beginPath();
    dCtx.moveTo(px, 16);
    dCtx.lineTo(px, DH - 16);
    dCtx.stroke();
  }
  dCtx.fillStyle = '#202020';
  dCtx.fillRect(16, 220, DW - 32, 34);
  dCtx.fillStyle = '#090909';
  dCtx.fillRect(68, 92, DW - 136, 72);
  dCtx.strokeStyle = '#aaa';
  dCtx.lineWidth = 5;
  dCtx.strokeRect(68, 92, DW - 136, 72);
  for (let bx = 92; bx < DW - 80; bx += 22) {
    dCtx.beginPath();
    dCtx.moveTo(bx, 92);
    dCtx.lineTo(bx, 164);
    dCtx.stroke();
  }
  dCtx.fillStyle = '#e5e5df';
  dCtx.fillRect(54, 286, DW - 108, 44);
  dCtx.fillStyle = '#080808';
  dCtx.font = 'bold 28px monospace';
  dCtx.textAlign = 'center';
  dCtx.fillText('SAÍDA', DW / 2, 318);
  dCtx.fillStyle = '#d0d0d0';
  for (let ry = 28; ry < DH - 24; ry += 48) {
    dCtx.beginPath();
    dCtx.arc(24, ry, 4, 0, Math.PI * 2);
    dCtx.arc(DW - 24, ry, 4, 0, Math.PI * 2);
    dCtx.fill();
  }

  const doorHeight = new Float32Array(DW * DH);
  const dPixels = dCtx.getImageData(0, 0, DW, DH).data;
  for (let i = 0; i < DW * DH; i++) doorHeight[i] = dPixels[i * 4] / 255;
  const doorNormalCanvas = document.createElement('canvas');
  doorNormalCanvas.width = DW;
  doorNormalCanvas.height = DH;
  const dnCtx = doorNormalCanvas.getContext('2d')!;
  const dnImg = dnCtx.createImageData(DW, DH);
  for (let y = 0; y < DH; y++) {
    for (let x = 0; x < DW; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(DW - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(DH - 1, y + 1);
      const dx = (doorHeight[y * DW + x0] - doorHeight[y * DW + x1]) * 2.5;
      const dy = (doorHeight[y0 * DW + x] - doorHeight[y1 * DW + x]) * 2.5;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * DW + x) * 4;
      dnImg.data[i] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      dnImg.data[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      dnImg.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      dnImg.data[i + 3] = 255;
    }
  }
  dnCtx.putImageData(dnImg, 0, 0);

  // 5. BRUSHED / RUSTED METAL
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = C;
  metalCanvas.height = C;
  const mCtx = metalCanvas.getContext('2d')!;
  const mImg = mCtx.createImageData(C, C);
  const mRoughCanvas = document.createElement('canvas');
  mRoughCanvas.width = C;
  mRoughCanvas.height = C;
  const mrCtx = mRoughCanvas.getContext('2d')!;
  const mrImg = mrCtx.createImageData(C, C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const idx = (y * C + x) * 4;
      const streak = fbm(x * 0.28, y * 0.03, 501);
      const rust = fbm(x * 0.045, y * 0.045, 523);
      const lum = Math.max(0, Math.min(255, Math.round(138 + (streak - 0.5) * 74 - (rust > 0.6 ? 58 : 0))));
      const rgh = Math.max(25, Math.min(255, Math.round(78 + (rust > 0.6 ? 132 : 20) + (streak - 0.5) * 45)));
      mImg.data[idx] = mImg.data[idx + 1] = mImg.data[idx + 2] = lum;
      mImg.data[idx + 3] = 255;
      mrImg.data[idx] = mrImg.data[idx + 1] = mrImg.data[idx + 2] = rgh;
      mrImg.data[idx + 3] = 255;
    }
  }
  mCtx.putImageData(mImg, 0, 0);
  mrCtx.putImageData(mrImg, 0, 0);

  // 6. WORN FABRIC / MATTRESS
  const fabricCanvas = document.createElement('canvas');
  fabricCanvas.width = C;
  fabricCanvas.height = C;
  const fbCtx = fabricCanvas.getContext('2d')!;
  const fbImg = fbCtx.createImageData(C, C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const idx = (y * C + x) * 4;
      const weave = ((x % 4 < 2 ? 1 : -1) + (y % 4 < 2 ? 1 : -1)) * 10;
      const stain = fbm(x * 0.03, y * 0.03, 619);
      const lum = Math.max(0, Math.min(255, Math.round(154 + weave - (stain > 0.55 ? (stain - 0.55) * 145 : 0))));
      fbImg.data[idx] = fbImg.data[idx + 1] = fbImg.data[idx + 2] = lum;
      fbImg.data[idx + 3] = 255;
    }
  }
  fbCtx.putImageData(fbImg, 0, 0);

  // 7. CREATURE GAUNT FLESH
  const fleshCanvas = document.createElement('canvas');
  fleshCanvas.width = C;
  fleshCanvas.height = C;
  const flCtx = fleshCanvas.getContext('2d')!;
  const flImg = flCtx.createImageData(C, C);
  const fleshHeight = new Float32Array(C * C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const idx = (y * C + x) * 4;
      const vein = Math.abs(fbm(x * 0.06, y * 0.06, 701) - 0.5);
      const sinew = fbm(x * 0.14, y * 0.035, 733);
      let lum = 142 + (sinew - 0.5) * 88;
      let h = 0.5 + (sinew - 0.5) * 0.36;
      if (vein < 0.03) {
        lum -= 68;
        h += 0.24;
      }
      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      flImg.data[idx] = flImg.data[idx + 1] = flImg.data[idx + 2] = cVal;
      flImg.data[idx + 3] = 255;
      fleshHeight[y * C + x] = h;
    }
  }
  flCtx.putImageData(flImg, 0, 0);
  const fleshNormalCanvas = heightToNormalCanvas(fleshHeight, C, 2.8);

  // 8. PRESSURE GAUGE DIAL
  const G = 128;
  const gaugeCanvas = document.createElement('canvas');
  gaugeCanvas.width = G;
  gaugeCanvas.height = G;
  const gCtx = gaugeCanvas.getContext('2d')!;
  gCtx.fillStyle = '#eaeae4';
  gCtx.fillRect(0, 0, G, G);
  gCtx.strokeStyle = '#111';
  gCtx.lineWidth = 4;
  gCtx.beginPath();
  gCtx.arc(G / 2, G / 2, 54, 0, Math.PI * 2);
  gCtx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5 - Math.PI / 2;
    gCtx.beginPath();
    gCtx.moveTo(G / 2 + Math.cos(a) * 38, G / 2 + Math.sin(a) * 38);
    gCtx.lineTo(G / 2 + Math.cos(a) * 48, G / 2 + Math.sin(a) * 48);
    gCtx.stroke();
  }
  gCtx.strokeStyle = '#000';
  gCtx.lineWidth = 3;
  gCtx.beginPath();
  gCtx.moveTo(G / 2, G / 2);
  gCtx.lineTo(G / 2 + 28, G / 2 - 22);
  gCtx.stroke();

  // 9. SOFT RADIAL CONTACT SHADOW DISC
  const shCanvas = document.createElement('canvas');
  shCanvas.width = G;
  shCanvas.height = G;
  const shCtx = shCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(G / 2, G / 2, 4, G / 2, G / 2, G / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, G, G);
  const shadowDisc = reg(new THREE.CanvasTexture(shCanvas));
  shadowDisc.colorSpace = THREE.SRGBColorSpace;
  shadowDisc.needsUpdate = true;

  // 10. ASYLUM WARD NOTICE POSTER (256x320)
  const p1Canvas = document.createElement('canvas');
  p1Canvas.width = 256;
  p1Canvas.height = 320;
  const p1 = p1Canvas.getContext('2d')!;
  p1.fillStyle = '#d8d6cc';
  p1.fillRect(0, 0, 256, 320);
  p1.strokeStyle = '#181818';
  p1.lineWidth = 6;
  p1.strokeRect(12, 12, 232, 296);
  p1.fillStyle = '#151515';
  p1.fillRect(24, 24, 208, 42);
  p1.fillStyle = '#e8e8e0';
  p1.font = 'bold 22px monospace';
  p1.textAlign = 'center';
  p1.fillText('ALA B · ISOLAMENTO', 128, 52);
  p1.fillStyle = '#151515';
  p1.font = 'bold 15px monospace';
  p1.fillText('PROTOCOLO NOTURNO', 128, 92);
  p1.fillRect(36, 102, 184, 3);
  p1.font = '13px monospace';
  p1.textAlign = 'left';
  const lines = [
    '1. APAGUE AS LUZES',
    '2. NÃO ABRA CELAS',
    '3. IGNORE OS PASSOS',
    '4. SAÍDA AO SUL ->',
  ];
  lines.forEach((ln, i) => p1.fillText(ln, 28, 136 + i * 28));
  // Torn corner & grime stain
  p1.fillStyle = 'rgba(20,20,20,0.28)';
  p1.beginPath();
  p1.arc(195, 250, 48, 0, Math.PI * 2);
  p1.fill();
  p1.fillStyle = '#121212';
  p1.beginPath();
  p1.moveTo(212, 320);
  p1.lineTo(256, 268);
  p1.lineTo(256, 320);
  p1.fill();

  // 11. PSYCHIATRIC ANATOMY / EYE DIAGRAM POSTER (256x320)
  const p2Canvas = document.createElement('canvas');
  p2Canvas.width = 256;
  p2Canvas.height = 320;
  const p2 = p2Canvas.getContext('2d')!;
  p2.fillStyle = '#ceccc2';
  p2.fillRect(0, 0, 256, 320);
  p2.strokeStyle = '#141414';
  p2.lineWidth = 4;
  p2.strokeRect(14, 14, 228, 292);
  // Cranial schematic & eye diagram
  p2.beginPath();
  p2.arc(128, 132, 64, 0, Math.PI * 2);
  p2.stroke();
  p2.beginPath();
  p2.moveTo(64, 132);
  p2.lineTo(192, 132);
  p2.moveTo(128, 68);
  p2.lineTo(128, 225);
  p2.stroke();
  p2.fillStyle = '#141414';
  p2.beginPath();
  p2.ellipse(128, 132, 34, 18, 0, 0, Math.PI * 2);
  p2.stroke();
  p2.beginPath();
  p2.arc(128, 132, 10, 0, Math.PI * 2);
  p2.fill();
  p2.font = 'bold 14px monospace';
  p2.textAlign = 'center';
  p2.fillText('BLACKWOOD · FIG. IV', 128, 268);
  p2.fillText('OBSERVAÇÃO CLÍNICA', 128, 288);

  // 12. CHARCOAL MADNESS GRAFFITI DECAL (transparent PNG-style alpha CanvasTexture)
  const grCanvas = document.createElement('canvas');
  grCanvas.width = 256;
  grCanvas.height = 256;
  const gr = grCanvas.getContext('2d')!;
  gr.clearRect(0, 0, 256, 256);
  gr.strokeStyle = 'rgba(12,12,12,0.92)';
  gr.fillStyle = 'rgba(12,12,12,0.92)';
  gr.lineWidth = 4;
  // Tally marks + frantic scratches + warning
  for (let i = 0; i < 5; i++) {
    gr.beginPath();
    gr.moveTo(36 + i * 11, 56);
    gr.lineTo(32 + i * 11, 102);
    gr.stroke();
  }
  gr.beginPath();
  gr.moveTo(26, 90);
  gr.lineTo(94, 62);
  gr.stroke();
  // Spiral eye
  gr.beginPath();
  for (let a = 0; a < 22; a += 0.25) {
    const r = a * 1.4;
    const x = 178 + Math.cos(a) * r;
    const y = 84 + Math.sin(a) * r;
    if (a === 0) gr.moveTo(x, y);
    else gr.lineTo(x, y);
  }
  gr.stroke();
  gr.font = 'bold 20px monospace';
  gr.fillText('ELE OUVE', 34, 168);
  gr.font = 'bold 16px monospace';
  gr.fillText('APAGUE A LUZ', 44, 198);

  // 13. FLOOR SPLATTER / OIL DRAG DECAL (alpha)
  const stCanvas = document.createElement('canvas');
  stCanvas.width = 256;
  stCanvas.height = 256;
  const st = stCanvas.getContext('2d')!;
  st.clearRect(0, 0, 256, 256);
  const stGrad = st.createRadialGradient(128, 128, 12, 128, 128, 112);
  stGrad.addColorStop(0, 'rgba(8,8,8,0.94)');
  stGrad.addColorStop(0.55, 'rgba(14,14,14,0.72)');
  stGrad.addColorStop(1, 'rgba(14,14,14,0)');
  st.fillStyle = stGrad;
  st.beginPath();
  st.ellipse(128, 128, 104, 66, 0.35, 0, Math.PI * 2);
  st.fill();
  for (let i = 0; i < 14; i++) {
    const sx = 35 + seededNoise(i, 3, 81) * 185;
    const sy = 55 + seededNoise(i, 7, 81) * 145;
    const sr = 4 + seededNoise(i, 9, 81) * 16;
    st.fillStyle = 'rgba(10,10,10,0.85)';
    st.beginPath();
    st.arc(sx, sy, sr, 0, Math.PI * 2);
    st.fill();
  }

  // 14. SCATTERED MEDICAL RECORD PAPER TEXTURE (128x160)
  const ppCanvas = document.createElement('canvas');
  ppCanvas.width = 128;
  ppCanvas.height = 160;
  const pp = ppCanvas.getContext('2d')!;
  pp.fillStyle = '#e5e3da';
  pp.fillRect(0, 0, 128, 160);
  pp.strokeStyle = '#333';
  pp.lineWidth = 2;
  pp.strokeRect(8, 8, 112, 144);
  pp.fillStyle = '#222';
  for (let y = 26; y < 138; y += 14) {
    const w = 48 + seededNoise(y, 2, 45) * 44;
    pp.fillRect(16, y, w, 4);
  }

  // 15. FROSTED BARRED WINDOW MOONLIGHT BACKING (128x192)
  const wnCanvas = document.createElement('canvas');
  wnCanvas.width = 128;
  wnCanvas.height = 192;
  const wn = wnCanvas.getContext('2d')!;
  const wg = wn.createLinearGradient(0, 0, 0, 192);
  wg.addColorStop(0, '#eef2f6');
  wg.addColorStop(0.6, '#929ca8');
  wg.addColorStop(1, '#34383e');
  wn.fillStyle = wg;
  wn.fillRect(0, 0, 128, 192);
  // Subtle dead tree branches silhouette outside
  wn.strokeStyle = 'rgba(12,14,16,0.7)';
  wn.lineWidth = 4;
  wn.beginPath();
  wn.moveTo(16, 192);
  wn.lineTo(54, 108);
  wn.lineTo(36, 48);
  wn.moveTo(54, 108);
  wn.lineTo(96, 62);
  wn.stroke();

  // 16. SOFT DUST MOTE SPRITE (32x32)
  const dmCanvas = document.createElement('canvas');
  dmCanvas.width = 32;
  dmCanvas.height = 32;
  const dm = dmCanvas.getContext('2d')!;
  const dmg = dm.createRadialGradient(16, 16, 1, 16, 16, 15);
  dmg.addColorStop(0, 'rgba(255,255,255,1)');
  dmg.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  dmg.addColorStop(1, 'rgba(255,255,255,0)');
  dm.fillStyle = dmg;
  dm.fillRect(0, 0, 32, 32);

  // 17. COURTYARD WET COBBLESTONE & GRAVEL GROUND (512x512)
  const gCanvas = document.createElement('canvas');
  gCanvas.width = W;
  gCanvas.height = W;
  const gCtx2 = gCanvas.getContext('2d')!;
  const gImg = gCtx2.createImageData(W, W);
  const gRoughCanvas = document.createElement('canvas');
  gRoughCanvas.width = W;
  gRoughCanvas.height = W;
  const grRoughCtx = gRoughCanvas.getContext('2d')!;
  const grRoughImg = grRoughCtx.createImageData(W, W);
  const gHeight = new Float32Array(W * W);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const n1 = fbm(x * 0.032, y * 0.032, 811);
      const n2 = fbm(x * 0.16, y * 0.16, 823);
      const puddle = fbm(x * 0.014, y * 0.014, 839);

      // Irregular weathered stone pavers
      const row = Math.floor(y / 32);
      const col = Math.floor((x + (row % 2) * 24) / 48);
      const ux = ((x + (row % 2) * 24) % 48) / 48;
      const uy = (y % 32) / 32;
      const seam = ux < 0.08 || ux > 0.92 || uy < 0.1 || uy > 0.9;
      const stoneTint = (seededNoise(col, row, 853) - 0.5) * 40;

      let lum = seam ? 26 : 92 + stoneTint + (n1 - 0.5) * 46 + (n2 - 0.5) * 28;
      let h = seam ? 0.14 : 0.6 + (n2 - 0.5) * 0.22;
      let rough = seam ? 245 : 198;

      if (puddle > 0.55) {
        const wet = Math.min(1, (puddle - 0.55) * 4.2);
        rough = Math.round(rough * (1 - wet * 0.88));
        lum -= wet * 20;
        h = h * (1 - wet * 0.65) + 0.66 * (wet * 0.65);
      }

      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      const rVal = Math.max(14, Math.min(255, Math.round(rough)));
      gImg.data[idx] = gImg.data[idx + 1] = gImg.data[idx + 2] = cVal;
      gImg.data[idx + 3] = 255;
      grRoughImg.data[idx] = grRoughImg.data[idx + 1] = grRoughImg.data[idx + 2] = rVal;
      grRoughImg.data[idx + 3] = 255;
      gHeight[y * W + x] = h;
    }
  }
  gCtx2.putImageData(gImg, 0, 0);
  grRoughCtx.putImageData(grRoughImg, 0, 0);
  const gNormalCanvas = heightToNormalCanvas(gHeight, W, 3.0);

  // 18. EXTERIOR ASYLUM STONE MASONRY (256x256)
  const sbCanvas = document.createElement('canvas');
  sbCanvas.width = C;
  sbCanvas.height = C;
  const sbCtx = sbCanvas.getContext('2d')!;
  const sbImg = sbCtx.createImageData(C, C);
  const sbHeight = new Float32Array(C * C);
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const idx = (y * C + x) * 4;
      const row = Math.floor(y / 24);
      const off = (row % 2) * 26;
      const ux = ((x + off) % 52) / 52;
      const uy = (y % 24) / 24;
      const mortar = ux < 0.07 || ux > 0.93 || uy < 0.12 || uy > 0.88;
      const n1 = fbm(x * 0.05, y * 0.05, 907);
      const moss = fbm(x * 0.02, y * 0.02, 919);
      let lum = mortar ? 34 : 118 + (n1 - 0.5) * 62;
      if (moss > 0.62) lum -= (moss - 0.62) * 140;
      const cVal = Math.max(0, Math.min(255, Math.round(lum)));
      sbImg.data[idx] = sbImg.data[idx + 1] = sbImg.data[idx + 2] = cVal;
      sbImg.data[idx + 3] = 255;
      sbHeight[y * C + x] = mortar ? 0.15 : 0.62 + (n1 - 0.5) * 0.25;
    }
  }
  sbCtx.putImageData(sbImg, 0, 0);
  const sbNormalCanvas = heightToNormalCanvas(sbHeight, C, 3.0);

  // 19. DEAD TREE BARK TEXTURE (128x128)
  const bkCanvas = document.createElement('canvas');
  bkCanvas.width = G;
  bkCanvas.height = G;
  const bkCtx = bkCanvas.getContext('2d')!;
  const bkImg = bkCtx.createImageData(G, G);
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      const idx = (y * G + x) * 4;
      const furrow = fbm(x * 0.24, y * 0.035, 967);
      const cVal = Math.max(0, Math.min(255, Math.round(48 + furrow * 92)));
      bkImg.data[idx] = bkImg.data[idx + 1] = bkImg.data[idx + 2] = cVal;
      bkImg.data[idx + 3] = 255;
    }
  }
  bkCtx.putImageData(bkImg, 0, 0);

  // 20. SANATORIUM PORTICO SIGNAGE (512x128)
  const sgCanvas = document.createElement('canvas');
  sgCanvas.width = 512;
  sgCanvas.height = 128;
  const sg = sgCanvas.getContext('2d')!;
  sg.fillStyle = '#18191c';
  sg.fillRect(0, 0, 512, 128);
  sg.strokeStyle = '#d4d4cc';
  sg.lineWidth = 6;
  sg.strokeRect(8, 8, 496, 112);
  sg.fillStyle = '#ecece4';
  sg.font = 'bold 34px monospace';
  sg.textAlign = 'center';
  sg.fillText('SANATÓRIO BLACKWOOD', 256, 62);
  sg.font = 'bold 17px monospace';
  sg.fillStyle = '#b4b4ac';
  sg.fillText('ALA PSIQUIÁTRICA · FUND. 1924', 256, 98);

  return {
    wallMap: reg(finalizeTexture(wallCanvas, aniso, true, 1, 1)),
    wallNormal: reg(finalizeTexture(wallNormalCanvas, aniso, false, 1, 1)),
    wallRoughness: reg(finalizeTexture(wRoughCanvas, aniso, false, 1, 1)),
    floorMap: reg(finalizeTexture(floorCanvas, aniso, true, 16, 13)),
    floorNormal: reg(finalizeTexture(floorNormalCanvas, aniso, false, 16, 13)),
    floorRoughness: reg(finalizeTexture(fRoughCanvas, aniso, false, 16, 13)),
    ceilingMap: reg(finalizeTexture(ceilCanvas, aniso, true, 16, 13)),
    ceilingNormal: reg(finalizeTexture(ceilNormalCanvas, aniso, false, 16, 13)),
    doorMap: reg(finalizeTexture(doorCanvas, aniso, true, 1, 1)),
    doorNormal: reg(finalizeTexture(doorNormalCanvas, aniso, false, 1, 1)),
    metalMap: reg(finalizeTexture(metalCanvas, aniso, true, 1, 1)),
    metalRoughness: reg(finalizeTexture(mRoughCanvas, aniso, false, 1, 1)),
    fabricMap: reg(finalizeTexture(fabricCanvas, aniso, true, 1, 1)),
    fleshMap: reg(finalizeTexture(fleshCanvas, aniso, true, 1, 1)),
    fleshNormal: reg(finalizeTexture(fleshNormalCanvas, aniso, false, 1, 1)),
    gaugeMap: reg(finalizeTexture(gaugeCanvas, aniso, true, 1, 1)),
    shadowDisc,
    posterNoticeMap: reg(finalizeTexture(p1Canvas, aniso, true, 1, 1)),
    posterAnatomyMap: reg(finalizeTexture(p2Canvas, aniso, true, 1, 1)),
    graffitiMap: reg(finalizeTexture(grCanvas, aniso, true, 1, 1)),
    stainDecalMap: reg(finalizeTexture(stCanvas, aniso, true, 1, 1)),
    paperMap: reg(finalizeTexture(ppCanvas, aniso, true, 1, 1)),
    windowGlowMap: reg(finalizeTexture(wnCanvas, aniso, true, 1, 1)),
    dustMoteMap: reg(finalizeTexture(dmCanvas, aniso, true, 1, 1)),
    courtyardGroundMap: reg(finalizeTexture(gCanvas, aniso, true, 14, 14)),
    courtyardGroundNormal: reg(finalizeTexture(gNormalCanvas, aniso, false, 14, 14)),
    courtyardGroundRoughness: reg(finalizeTexture(gRoughCanvas, aniso, false, 14, 14)),
    stoneBrickMap: reg(finalizeTexture(sbCanvas, aniso, true, 4, 2)),
    stoneBrickNormal: reg(finalizeTexture(sbNormalCanvas, aniso, false, 4, 2)),
    barkMap: reg(finalizeTexture(bkCanvas, aniso, true, 1, 2)),
    signageMap: reg(finalizeTexture(sgCanvas, aniso, true, 1, 1)),
    dispose: () => {
      for (const t of created) t.dispose();
    },
  };
}
