import * as THREE from 'three';

interface SpatialLampNode {
  panner: PannerNode;
  gain: GainNode;
  osc: OscillatorNode;
  buzzGain: GainNode;
}

export class SpatialHorrorAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private unlocked = false;

  // Ambient & player reactive loops
  private droneGain: GainNode | null = null;
  private nextHeartbeatAt = 0;
  private nextCreakAt = 0;
  private nextPanicBreathAt = 0;

  // Spatialized flickering ceiling lamps
  private lampNodes: SpatialLampNode[] = [];

  // Spatialized distant pipe drips
  private dripPositions: THREE.Vector3[] = [];
  private nextDripAt = 0;

  // Spatialized exterior generator hum
  private genPos: THREE.Vector3 | null = null;
  private genGain: GainNode | null = null;

  private _forward = new THREE.Vector3();
  private _up = new THREE.Vector3();

  public setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(on ? 0.85 : 0.0, this.ctx.currentTime, 0.05);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public init(lampPositions: THREE.Vector3[], pipePositions: THREE.Vector3[]): void {
    if (this.unlocked) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    this.ctx = ctx;
    this.unlocked = true;

    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.85 : 0.0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Shared 2-second filtered noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.06 * white) / 1.06;
      data[i] = last * 2.4;
    }
    this.noiseBuffer = buf;

    // 1. Deep submerged hull pressure drone (36 Hz + 38.2 Hz slow beating resonance)
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 36;
    const droneOsc2 = ctx.createOscillator();
    droneOsc2.type = 'triangle';
    droneOsc2.frequency.value = 38.2;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 98;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.095;
    droneOsc.connect(droneFilter);
    droneOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    droneOsc.start();
    droneOsc2.start();
    this.droneGain = droneGain;

    // 2. Spatialized flickering ceiling lamps (equalpower avoids 10+ simultaneous HRTF FFT convolutions)
    this.lampNodes = lampPositions.map((pos) => {
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.1;
      panner.maxDistance = 10;
      panner.rolloffFactor = 1.9;
      panner.positionX.value = pos.x;
      panner.positionY.value = pos.y;
      panner.positionZ.value = pos.z;
      panner.connect(master);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 120;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 480;
      bp.Q.value = 2.0;
      const gain = ctx.createGain();
      gain.gain.value = 0.02;

      osc.connect(bp);
      bp.connect(gain);
      gain.connect(panner);
      osc.start();

      return { panner, gain, osc, buzzGain: gain };
    });

    this.dripPositions = pipePositions.map((p) => p.clone());
    this.nextDripAt = ctx.currentTime + 1.5;
    this.nextCreakAt = ctx.currentTime + 6.0;
    this.nextPanicBreathAt = ctx.currentTime + 2.0;

    if (this.genPos) {
      this.attachGeneratorHum(this.genPos);
    }
  }

  public attachGeneratorHum(pos: THREE.Vector3): void {
    this.genPos = pos.clone();
    if (!this.ctx || !this.masterGain || this.genGain) return;
    const panner = this.createSpatialPanner(pos, 24, 'equalpower');
    if (!panner) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 58;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    osc.connect(lp);
    lp.connect(g);
    g.connect(panner);
    osc.start();
    this.genGain = g;
  }

  public setGeneratorHum(on: boolean): void {
    if (!this.ctx || !this.genGain) return;
    this.genGain.gain.setTargetAtTime(on ? 0.24 : 0.0, this.ctx.currentTime, 0.2);
  }

  public updateListenerAndSpatial(
    camera: THREE.Camera,
    creaturePos: THREE.Vector3,
    creatureAlive: boolean,
    creatureAggro: boolean,
    creatureMoving: boolean,
    lampIntensities: number[],
    playerHp: number,
    timeSec: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.unlocked) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;

    // Sync AudioListener with camera world position and orientation
    const listener = ctx.listener;
    this._forward.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    this._up.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    if (listener.positionX) {
      listener.positionX.setValueAtTime(camera.position.x, now);
      listener.positionY.setValueAtTime(camera.position.y, now);
      listener.positionZ.setValueAtTime(camera.position.z, now);
      listener.forwardX.setValueAtTime(this._forward.x, now);
      listener.forwardY.setValueAtTime(this._forward.y, now);
      listener.forwardZ.setValueAtTime(this._forward.z, now);
      listener.upX.setValueAtTime(this._up.x, now);
      listener.upY.setValueAtTime(this._up.y, now);
      listener.upZ.setValueAtTime(this._up.z, now);
    }

    // Keep listener synced cleanly; enemy emits zero audio by user request
    void creatureAggro;
    void creatureMoving;
    void timeSec;

    // Sync flickering lamp electrical buzz (only when audible near indoors)
    const outdoors = camera.position.z < -2.0;
    for (let i = 0; i < this.lampNodes.length; i++) {
      const node = this.lampNodes[i];
      const lum = outdoors ? 0 : (lampIntensities[i] ?? 0);
      const targetBuzz = lum > 0.01 ? 0.008 + lum * 0.025 : 0.0;
      node.buzzGain.gain.setTargetAtTime(targetBuzz, now, 0.05);
      if (lum > 0.01) {
        node.osc.frequency.setTargetAtTime(112 + lum * 24, now, 0.06);
      }
    }

    // Distant spatialized pipe drips & unsettling metal settling groans
    if (this.dripPositions.length > 0 && now >= this.nextDripAt) {
      const p = this.dripPositions[Math.floor(Math.random() * this.dripPositions.length)];
      this.triggerPipeDrip(p);
      this.nextDripAt = now + 2.0 + Math.random() * 4.2;
    }
    if (this.dripPositions.length > 0 && now >= this.nextCreakAt) {
      const p = this.dripPositions[Math.floor(Math.random() * this.dripPositions.length)];
      this.triggerMetalCreak(p);
      this.nextCreakAt = now + 7.5 + Math.random() * 9.5;
    }

    // Player proximity / low-HP heartbeat & shaky terror breathing (player physiology only)
    const dist = camera.position.distanceTo(creaturePos);
    const stress = creatureAlive ? Math.max(0, 1 - dist / 9.5) : 0;
    const hpStress = Math.max(0, (65 - playerHp) / 65);
    const totalStress = Math.max(stress, hpStress);
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(0.085 + totalStress * 0.095, now, 0.15);
    }
    if (totalStress > 0.16 && now >= this.nextHeartbeatAt) {
      this.triggerHeartbeat(0.2 + totalStress * 0.45);
      const interval = THREE.MathUtils.lerp(1.05, 0.42, totalStress);
      this.nextHeartbeatAt = now + interval;
    }
    if (totalStress > 0.45 && now >= this.nextPanicBreathAt) {
      this.triggerPanicBreath(totalStress);
      this.nextPanicBreathAt = now + THREE.MathUtils.lerp(2.1, 1.05, totalStress);
    }
  }

  private createSpatialPanner(
    pos: THREE.Vector3,
    maxDistance = 18,
    model: PanningModelType = 'HRTF',
  ): PannerNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const panner = this.ctx.createPanner();
    panner.panningModel = model;
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.4;
    panner.maxDistance = maxDistance;
    panner.rolloffFactor = 1.4;
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;
    panner.connect(this.masterGain);
    return panner;
  }

  private triggerPipeDrip(pos: THREE.Vector3): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const panner = this.createSpatialPanner(pos, 16, 'equalpower');
    if (!panner) return;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 720 + Math.random() * 520;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.055);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 0.14);
    setTimeout(() => panner.disconnect(), 200);
  }

  private triggerMetalCreak(pos: THREE.Vector3): void {
    if (!this.ctx) return;
    const panner = this.createSpatialPanner(pos, 22, 'equalpower');
    if (!panner) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const f0 = 88 + Math.random() * 55;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.linearRampToValueAtTime(f0 * 0.72, now + 0.9);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 340;
    bp.Q.value = 6.0;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    osc.connect(bp);
    bp.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 1.1);
    setTimeout(() => panner.disconnect(), 1200);
  }

  private triggerPanicBreath(stress: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(520, now);
    bp.frequency.linearRampToValueAtTime(340, now + 0.36);
    bp.Q.value = 2.6;
    const g = this.ctx.createGain();
    const amp = 0.04 + stress * 0.06;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.45);
  }

  public playPowerBlackout(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.95);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.05);
  }

  private triggerHeartbeat(volume: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const pulse = (offset: number, amp: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, now + offset);
      osc.frequency.exponentialRampToValueAtTime(32, now + offset + 0.12);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(amp, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    };
    pulse(0, volume);
    pulse(0.16, volume * 0.65);
  }

  public playPlayerFootstep(sprinting: boolean, crouching = false, waterDepth = 0): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = crouching ? 310 : sprinting ? 620 : 460;
    filter.Q.value = 1.6;
    const g = this.ctx.createGain();
    const vol = crouching ? 0.038 : sprinting ? 0.19 : 0.11;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.8);
    src.stop(now + 0.12);

    // Wet water slosh layer when rig corridors are flooded
    if (waterDepth > 0.045) {
      const wetFactor = Math.min(1, waterDepth / 0.35);
      const splash = this.ctx.createBufferSource();
      splash.buffer = this.noiseBuffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(crouching ? 420 : sprinting ? 1050 : 760, now);
      lp.frequency.exponentialRampToValueAtTime(240, now + 0.19);
      lp.Q.value = 1.1;
      const sg = this.ctx.createGain();
      const sVol = (crouching ? 0.045 : sprinting ? 0.22 : 0.12) * wetFactor;
      sg.gain.setValueAtTime(0.001, now);
      sg.gain.linearRampToValueAtTime(sVol, now + 0.025);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      splash.connect(lp);
      lp.connect(sg);
      sg.connect(this.masterGain);
      splash.start(now, Math.random() * 0.7);
      splash.stop(now + 0.22);
    }
  }

  public playSonarPing(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1340, now);
    osc.frequency.exponentialRampToValueAtTime(1290, now + 0.65);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.8);

    // Distant watery echo repeat
    const echo = this.ctx.createOscillator();
    echo.type = 'sine';
    echo.frequency.setValueAtTime(1305, now + 0.28);
    const eg = this.ctx.createGain();
    eg.gain.setValueAtTime(0.001, now + 0.28);
    eg.gain.linearRampToValueAtTime(0.075, now + 0.3);
    eg.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
    echo.connect(eg);
    eg.connect(this.masterGain);
    echo.start(now + 0.28);
    echo.stop(now + 0.84);
  }

  public playStrobeFlash(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // High-voltage arc pop
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.45, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(hp);
    hp.connect(ng);
    ng.connect(this.masterGain);
    src.start(now, 0.1);
    src.stop(now + 0.16);

    // Capacitor discharge whine
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3400, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.36);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.18, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playRadioStaticBurst(signalStrength: number): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || signalStrength <= 0.02) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1550 + signalStrength * 1100;
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    const amp = 0.03 + signalStrength * 0.13;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.9);
    src.stop(now + 0.15);

    if (signalStrength > 0.45) {
      const tone = this.ctx.createOscillator();
      tone.type = 'sawtooth';
      tone.frequency.setValueAtTime(240 + signalStrength * 160, now);
      const tg = this.ctx.createGain();
      tg.gain.setValueAtTime(0.025 * signalStrength, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      tone.connect(tg);
      tg.connect(this.masterGain);
      tone.start(now);
      tone.stop(now + 0.12);
    }
  }

  public playGunshot(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    // Sharp transient crack + corridor tail
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.38);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.65, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.45);

    // Low-end punch
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.55, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playEmptyClick(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.03);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playReload(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clack = (delay: number, f1: number, f2: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f1, now + delay);
      osc.frequency.exponentialRampToValueAtTime(f2, now + delay + 0.04);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.16, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    };
    clack(0.04, 620, 320);
    clack(0.28, 980, 1450);
  }

  public playFlashlightClick(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.02);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playCameraToggle(on: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    // Mechanical IR-cut filter click + brief capacitor charge/discharge whine
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(on ? 950 : 2800, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 3800 : 520, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.26);
  }

  public playPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(780, now + 0.07);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playKeyPickup(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [1480, 1980, 2420].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.001, now + idx * 0.055);
      g.gain.linearRampToValueAtTime(0.16, now + idx * 0.055 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.18);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.2);
    });
  }

  public playGeneratorStart(pos: THREE.Vector3): void {
    if (!this.ctx || !this.masterGain) return;
    if (!this.genGain) this.attachGeneratorHum(pos);
    const now = this.ctx.currentTime;
    // Heavy starter crank + diesel engine catch
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(34, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.65);
    osc.frequency.linearRampToValueAtTime(58, now + 1.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.3);

    if (this.genGain) {
      this.genGain.gain.setTargetAtTime(0.24, now + 0.4, 0.35);
    }
  }

  public playDoorUnlock(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    // Heavy metallic bolt clunk
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.14);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.28, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(og);
    og.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);

    // Long heavy hinge creak
    const creak = this.ctx.createOscillator();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(145, now + 0.18);
    creak.frequency.linearRampToValueAtTime(192, now + 0.65);
    creak.frequency.linearRampToValueAtTime(128, now + 1.15);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 440;
    bp.Q.value = 4.2;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.001, now + 0.18);
    cg.gain.linearRampToValueAtTime(0.18, now + 0.32);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    creak.connect(bp);
    bp.connect(cg);
    cg.connect(this.masterGain);
    creak.start(now + 0.18);
    creak.stop(now + 1.25);
  }

  public playThunder(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, now);
    lp.frequency.exponentialRampToValueAtTime(75, now + 1.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.38, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 1.95);
  }

  public playLockerDoor(opening: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(opening ? 185 : 140, now);
    osc.frequency.linearRampToValueAtTime(opening ? 255 : 92, now + 0.18);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 3.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    // Metallic latch snap
    const snap = this.ctx.createOscillator();
    snap.type = 'square';
    snap.frequency.setValueAtTime(opening ? 920 : 640, now + (opening ? 0.01 : 0.16));
    snap.frequency.exponentialRampToValueAtTime(220, now + (opening ? 0.05 : 0.21));
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.16, now + (opening ? 0.01 : 0.16));
    sg.gain.exponentialRampToValueAtTime(0.001, now + (opening ? 0.07 : 0.23));
    snap.connect(sg);
    sg.connect(this.masterGain);
    snap.start(now + (opening ? 0.01 : 0.16));
    snap.stop(now + (opening ? 0.08 : 0.24));
  }

  public playLampBurst(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 18);
    if (!panner) return;
    const now = this.ctx.currentTime;

    // Electrical arc pop + glass shatter burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(hp);
    hp.connect(g);
    g.connect(panner);
    src.start(now);
    src.stop(now + 0.3);

    const zap = this.ctx.createOscillator();
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(980, now);
    zap.frequency.exponentialRampToValueAtTime(95, now + 0.14);
    const zg = this.ctx.createGain();
    zg.gain.setValueAtTime(0.28, now);
    zg.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    zap.connect(zg);
    zg.connect(panner);
    zap.start(now);
    zap.stop(now + 0.18);

    setTimeout(() => panner.disconnect(), 360);
  }

  public playDoorSlam(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 26);
    if (!panner) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(85, now + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    src.connect(lp);
    lp.connect(g);
    g.connect(panner);
    src.start(now);
    src.stop(now + 0.65);

    const thud = this.ctx.createOscillator();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(96, now);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.28);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.55, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    thud.connect(tg);
    tg.connect(panner);
    thud.start(now);
    thud.stop(now + 0.34);

    setTimeout(() => panner.disconnect(), 700);
  }

  public playWindowTap(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 18);
    if (!panner) return;
    const now = this.ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(840, now + offset);
      osc.frequency.exponentialRampToValueAtTime(260, now + offset + 0.05);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.24, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(g);
      g.connect(panner);
      osc.start(now + offset);
      osc.stop(now + offset + 0.07);
    });
    setTimeout(() => panner.disconnect(), 350);
  }

  public playDoorPeek(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.linearRampToValueAtTime(275, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playDoorLock(locked: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const clack = (offset: number, f1: number, f2: number) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f1, now + offset);
      osc.frequency.exponentialRampToValueAtTime(f2, now + offset + 0.045);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(0.18, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    };
    clack(0, locked ? 580 : 880, locked ? 920 : 480);
    clack(0.06, locked ? 1150 : 620, locked ? 420 : 280);
  }

  public playDoorPound(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 26);
    if (!panner) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.58, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(og);
    og.connect(panner);
    osc.start(now);
    osc.stop(now + 0.27);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.36, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(panner);
    src.start(now);
    src.stop(now + 0.26);

    setTimeout(() => panner.disconnect(), 360);
  }

  public playGlassShatter(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 26);
    if (!panner) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1850;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(hp);
    hp.connect(g);
    g.connect(panner);
    src.start(now);
    src.stop(now + 0.45);

    [2650, 3420, 4180, 2980].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.025);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.68, now + i * 0.025 + 0.11);
      const og = this.ctx!.createGain();
      og.gain.setValueAtTime(0.16, now + i * 0.025);
      og.gain.exponentialRampToValueAtTime(0.001, now + i * 0.025 + 0.13);
      osc.connect(og);
      og.connect(panner);
      osc.start(now + i * 0.025);
      osc.stop(now + i * 0.025 + 0.14);
    });

    setTimeout(() => panner.disconnect(), 520);
  }

  public playGlassCrunch(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2600;
    hp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.4);
    src.stop(now + 0.18);
  }

  public playAlarmTick(pos: THREE.Vector3): void {
    if (!this.ctx) return;
    const panner = this.createSpatialPanner(pos, 16, 'equalpower');
    if (!panner) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1620, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 0.04);
    setTimeout(() => panner.disconnect(), 100);
  }

  public playAlarmRing(pos: THREE.Vector3): void {
    if (!this.ctx) return;
    const panner = this.createSpatialPanner(pos, 28);
    if (!panner) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i % 2 === 0 ? 1960 : 2140, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
      osc.connect(g);
      g.connect(panner);
      osc.start(t);
      osc.stop(t + 0.07);
    }
    setTimeout(() => panner.disconnect(), 600);
  }

  public playObstacleTip(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 22);
    if (!panner) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 540;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now);
    src.stop(now + 0.44);

    const clank = this.ctx.createOscillator();
    clank.type = 'sawtooth';
    clank.frequency.setValueAtTime(240, now);
    clank.frequency.exponentialRampToValueAtTime(75, now + 0.25);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.26, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    clank.connect(cg);
    cg.connect(panner);
    clank.start(now);
    clank.stop(now + 0.28);

    setTimeout(() => panner.disconnect(), 520);
  }

  public playTrapSet(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playTrapSnap(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const panner = this.createSpatialPanner(pos, 26);
    if (!panner) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(940, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.52, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(panner);
    osc.start(now);
    osc.stop(now + 0.2);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1450;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.45, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(panner);
    src.start(now);
    src.stop(now + 0.25);

    setTimeout(() => panner.disconnect(), 360);
  }

  public playBreathGasp(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.frequency.linearRampToValueAtTime(1120, now + 0.16);
    bp.Q.value = 2.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.3);
  }

  public dispose(): void {
    for (const n of this.lampNodes) {
      try {
        n.osc.stop();
      } catch {
        // already stopped
      }
      n.panner.disconnect();
    }
    this.lampNodes = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.unlocked = false;
  }
}
