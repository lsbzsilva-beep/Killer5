import * as THREE from 'three';

const _scrapePos = new THREE.Vector3();

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

  // Spatialized creature audio
  private creaturePanner: PannerNode | null = null;
  private creatureBreathGain: GainNode | null = null;
  private creatureBreathFilter: BiquadFilterNode | null = null;
  private creatureOsc: OscillatorNode | null = null;
  private nextCreatureStepAt = 0;
  private nextCreatureGrowlAt = 0;

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

    // 1. Sub-bass sanatorium room drone
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 41;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 110;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.075;
    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    droneOsc.start();
    this.droneGain = droneGain;

    // 2. Spatialized Creature Panner (HRTF 3D binaural!)
    const cPanner = ctx.createPanner();
    cPanner.panningModel = 'HRTF';
    cPanner.distanceModel = 'inverse';
    cPanner.refDistance = 1.6;
    cPanner.maxDistance = 24;
    cPanner.rolloffFactor = 1.35;
    cPanner.connect(master);
    this.creaturePanner = cPanner;

    // Creature continuous raspy breath / guttural drone
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = buf;
    breathSrc.loop = true;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 340;
    breathFilter.Q.value = 3.2;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.0;
    breathSrc.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(cPanner);
    breathSrc.start();

    const cOsc = ctx.createOscillator();
    cOsc.type = 'sawtooth';
    cOsc.frequency.value = 62;
    const cOscGain = ctx.createGain();
    cOscGain.gain.value = 0.05;
    cOsc.connect(breathFilter);
    cOsc.start();

    this.creatureBreathFilter = breathFilter;
    this.creatureBreathGain = breathGain;
    this.creatureOsc = cOsc;

    // 3. Spatialized flickering lamp ballast buzzes (equalpower avoids 10+ simultaneous HRTF FFT convolutions)
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

    // Update creature spatial panner anchored HIGH on the ceiling
    if (this.creaturePanner && this.creatureBreathGain && this.creatureBreathFilter && this.creatureOsc) {
      this.creaturePanner.positionX.setValueAtTime(creaturePos.x, now);
      this.creaturePanner.positionY.setValueAtTime(Math.max(2.6, creaturePos.y - 0.15), now);
      this.creaturePanner.positionZ.setValueAtTime(creaturePos.z, now);

      if (creatureAlive) {
        const breathCycle = 0.5 + 0.5 * Math.sin(timeSec * (creatureAggro ? 5.2 : 2.3));
        const targetGain = (creatureAggro ? 0.28 : 0.14) * (0.35 + breathCycle * 0.65);
        this.creatureBreathGain.gain.setTargetAtTime(targetGain, now, 0.08);
        this.creatureBreathFilter.frequency.setTargetAtTime(
          (creatureAggro ? 920 : 540) + breathCycle * 360,
          now,
          0.08,
        );
        this.creatureOsc.frequency.setTargetAtTime(
          (creatureAggro ? 148 : 96) + Math.sin(timeSec * 9.0) * 14,
          now,
          0.08,
        );

        // Spatialized nails scraping & claw-tapping across wooden ceiling planks above
        if (creatureMoving && now >= this.nextCreatureStepAt) {
          this.triggerCeilingScrape(creaturePos, creatureAggro ? 0.42 : 0.24, creatureAggro);
          this.nextCreatureStepAt = now + (creatureAggro ? 0.24 : 0.55 + Math.random() * 0.25);
        }

        // Occasional wet raspy ceiling click/hiss
        if (creatureAggro && now >= this.nextCreatureGrowlAt) {
          this.triggerCreatureGrowl();
          this.nextCreatureGrowlAt = now + 2.0 + Math.random() * 2.2;
        }
      } else {
        this.creatureBreathGain.gain.setTargetAtTime(0.0, now, 0.12);
      }
    }

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

    // Distant spatialized pipe drips
    if (this.dripPositions.length > 0 && now >= this.nextDripAt) {
      const p = this.dripPositions[Math.floor(Math.random() * this.dripPositions.length)];
      this.triggerPipeDrip(p);
      this.nextDripAt = now + 2.0 + Math.random() * 4.2;
    }

    // Player proximity / low-HP heartbeat
    const dist = camera.position.distanceTo(creaturePos);
    const stress = creatureAlive ? Math.max(0, 1 - dist / 8.5) : 0;
    const hpStress = Math.max(0, (65 - playerHp) / 65);
    const totalStress = Math.max(stress, hpStress);
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(0.065 + totalStress * 0.08, now, 0.15);
    }
    if (totalStress > 0.2 && now >= this.nextHeartbeatAt) {
      this.triggerHeartbeat(0.18 + totalStress * 0.42);
      const interval = THREE.MathUtils.lerp(1.05, 0.44, totalStress);
      this.nextHeartbeatAt = now + interval;
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

  public triggerCeilingScrape(pos: THREE.Vector3, volume: number, intense = false): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const panner = this.createSpatialPanner(
      _scrapePos.set(pos.x, Math.max(2.6, pos.y - 0.1), pos.z),
      18,
    );
    if (!panner) return;

    // 1. Long ragged fingernail drag across wooden ceiling boards
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(intense ? 2600 : 1950, now);
    bp.frequency.linearRampToValueAtTime(intense ? 3400 : 2500, now + 0.14);
    bp.Q.value = 5.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now, Math.random() * 0.9);
    src.stop(now + 0.24);

    // 2. Crisp double claw-tap + hollow plank creak above head
    for (let k = 0; k < 2; k++) {
      const off = k * (0.045 + Math.random() * 0.035);
      const click = this.ctx.createOscillator();
      click.type = 'triangle';
      click.frequency.setValueAtTime(1400 + Math.random() * 900, now + off);
      click.frequency.exponentialRampToValueAtTime(320, now + off + 0.032);
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(volume * 0.55, now + off);
      cg.gain.exponentialRampToValueAtTime(0.001, now + off + 0.04);
      click.connect(cg);
      cg.connect(panner);
      click.start(now + off);
      click.stop(now + off + 0.045);
    }

    setTimeout(() => panner.disconnect(), 320);
  }

  public playCeilingVanish(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const panner = this.createSpatialPanner(
      _scrapePos.set(pos.x, Math.max(2.6, pos.y - 0.1), pos.z),
      20,
    );
    if (!panner) return;

    // Sudden frantic claw-scrabble & airy rush when darting away from flashlight
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3100, now);
    bp.frequency.exponentialRampToValueAtTime(680, now + 0.34);
    bp.Q.value = 3.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(bp);
    bp.connect(g);
    g.connect(panner);
    src.start(now, Math.random() * 0.6);
    src.stop(now + 0.38);

    const shriek = this.ctx.createOscillator();
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(760, now);
    shriek.frequency.exponentialRampToValueAtTime(240, now + 0.24);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.22, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    shriek.connect(sg);
    sg.connect(panner);
    shriek.start(now);
    shriek.stop(now + 0.28);

    setTimeout(() => panner.disconnect(), 440);
  }

  public playDustCrumble(pos: THREE.Vector3): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const panner = this.createSpatialPanner(pos, 14, 'equalpower');
    if (!panner) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(hp);
    hp.connect(g);
    g.connect(panner);
    src.start(now, Math.random() * 1.1);
    src.stop(now + 0.3);
    setTimeout(() => panner.disconnect(), 360);
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

  private triggerCreatureGrowl(): void {
    if (!this.ctx || !this.creaturePanner) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.38);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 3.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.creaturePanner);
    osc.start(now);
    osc.stop(now + 0.45);
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

  public playPlayerFootstep(sprinting: boolean): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = sprinting ? 620 : 460;
    filter.Q.value = 1.6;
    const g = this.ctx.createGain();
    const vol = sprinting ? 0.19 : 0.11;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.8);
    src.stop(now + 0.12);
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

  public playCreatureHit(killed: boolean): void {
    if (!this.ctx || !this.creaturePanner) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(killed ? 320 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(killed ? 42 : 120, now + (killed ? 0.75 : 0.25));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (killed ? 0.78 : 0.28));
    osc.connect(g);
    g.connect(this.creaturePanner);
    osc.start(now);
    osc.stop(now + 0.8);
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
