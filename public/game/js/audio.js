// Lightweight WebAudio SFX + engine tone. Created only after user interaction.
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);

    // Engine: three detuned layers through a lowpass, only audible while the
    // driver is on the throttle or the brake (never a constant drone).
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 620;
    this.engineFilter.Q.value = 3.5;
    this.enginePeak = this.ctx.createBiquadFilter();
    this.enginePeak.type = "peaking";
    this.enginePeak.frequency.value = 1100;
    this.enginePeak.gain.value = 5;
    this.engineFilter.connect(this.enginePeak);
    this.enginePeak.connect(this.engineGain);
    this.engineGain.connect(this.sfxBus);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = "square";
    this.osc2.detune.value = -8;
    this.osc3 = this.ctx.createOscillator();
    this.osc3.type = "sawtooth";
    this.osc3.detune.value = 11;
    this.osc3Gain = this.ctx.createGain();
    this.osc3Gain.gain.value = 0.45;
    this.osc1.connect(this.engineFilter);
    this.osc2.connect(this.engineFilter);
    this.osc3.connect(this.osc3Gain);
    this.osc3Gain.connect(this.engineFilter);
    this.osc1.start();
    this.osc2.start();
    this.osc3.start();

    // Music: gentle pulsing pad.
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0;
    this.padGain.connect(this.musicBus);
    this.pad = this.ctx.createOscillator();
    this.pad.type = "triangle";
    this.pad.frequency.value = 82;
    this.pad.connect(this.padGain);
    this.pad.start();

    // Melody: soft pentatonic arpeggio bells over the pad.
    this.melodyGain = this.ctx.createGain();
    this.melodyGain.gain.value = 0;
    this.melodyDelay = this.ctx.createDelay(0.6);
    this.melodyDelay.delayTime.value = 0.28;
    this.melodyFb = this.ctx.createGain();
    this.melodyFb.gain.value = 0.26;
    this.melodyDelay.connect(this.melodyFb);
    this.melodyFb.connect(this.melodyDelay);
    this.melodyGain.connect(this.musicBus);
    this.melodyDelay.connect(this.melodyGain);
    this.melodyStep = 0;
    this.melodyTimer = null;

    this.noiseBuffer = this._makeNoise();

    // Air/tyre rush layer, used for braking and lift-off only.
    this.rushGain = this.ctx.createGain();
    this.rushGain.gain.value = 0;
    this.rushFilter = this.ctx.createBiquadFilter();
    this.rushFilter.type = "bandpass";
    this.rushFilter.frequency.value = 1200;
    this.rushFilter.Q.value = 0.8;
    this.rushFilter.connect(this.rushGain);
    this.rushGain.connect(this.sfxBus);
    this.rushSrc = this.ctx.createBufferSource();
    this.rushSrc.buffer = this.noiseBuffer;
    this.rushSrc.loop = true;
    this.rushSrc.connect(this.rushFilter);
    this.rushSrc.start();

    this.ready = true;
    this.applyVolumes();
  }

  // ---------------------------------------------------------------- melody
  _melodyNote(freq, dur, gain) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(freq * 2, t);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.melodyGain);
    g.connect(this.melodyDelay);
    o.start(t);
    o2.start(t);
    o.stop(t + dur);
    o2.stop(t + dur);
  }

  startMusic() {
    if (!this.ready || this.melodyTimer) return;
    // A minor pentatonic, gentle and non-intrusive.
    const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    const pattern = [0, 2, 4, 3, 5, 4, 2, 1, 0, 3, 5, 6, 4, 2, 3, 1];
    this.melodyGain.gain.setTargetAtTime(0.16, this.ctx.currentTime, 0.4);
    this.melodyStep = 0;
    this.melodyTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running") return;
      const i = this.melodyStep++;
      const n = pattern[i % pattern.length];
      const oct = i % 32 >= 16 ? 2 : 1;
      this._melodyNote(scale[n] * oct * 0.5, 0.55, 0.055);
      if (i % 4 === 0) this._melodyNote(scale[0] * 0.5, 0.7, 0.035);
    }, 300);
  }

  stopMusic() {
    if (this.melodyTimer) {
      clearInterval(this.melodyTimer);
      this.melodyTimer = null;
    }
    if (this.ready) this.melodyGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  // Immediately silences continuous layers (crash, pause, menu).
  silence() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.cancelScheduledValues(t);
    this.engineGain.gain.setTargetAtTime(0, t, 0.03);
    this.rushGain.gain.cancelScheduledValues(t);
    this.rushGain.gain.setTargetAtTime(0, t, 0.05);
    this.padGain.gain.setTargetAtTime(0, t, 0.1);
    this.stopMusic();
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  applyVolumes() {
    if (!this.ready) return;
    const s = this.settings.all();
    this.master.gain.value = s.master * 0.62; // headroom — keeps peaks comfortable
    this.sfxBus.gain.value = s.sfx;
    this.musicBus.gain.value = s.music;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  // mode: "accel" | "brake" | "coast" | "idle". Sound is produced only while
  // the player is accelerating, lifting off (decelerating) or braking.
  setEngine(active, speed = 0, mode = "idle") {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const spd = Math.max(0, Math.min(1, speed / 275));

    let engine = 0;
    let rush = 0;
    let brightness = 500 + spd * 900;
    if (active) {
      if (mode === "accel") {
        engine = 0.03 + spd * 0.026;
        brightness = 700 + spd * 1500;
      } else if (mode === "brake") {
        engine = 0.014 + spd * 0.01;
        rush = 0.014 + spd * 0.016;
        brightness = 420 + spd * 500;
      } else if (mode === "coast") {
        // engine braking: a short, quiet fade rather than a constant drone
        engine = 0.01 + spd * 0.01;
        rush = 0.006 + spd * 0.008;
      }
    }

    const ramp = mode === "accel" ? 0.1 : 0.22;
    this.engineGain.gain.setTargetAtTime(engine, t, ramp);
    this.rushGain.gain.setTargetAtTime(rush, t, 0.25);

    const f = 58 + speed * 0.62;
    this.osc1.frequency.setTargetAtTime(f, t, mode === "accel" ? 0.06 : 0.14);
    this.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.12);
    this.osc3.frequency.setTargetAtTime(f * 1.51, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(brightness, t, 0.14);
    this.enginePeak.frequency.setTargetAtTime(900 + spd * 1600, t, 0.2);
    this.rushFilter.frequency.setTargetAtTime(900 + spd * 1800, t, 0.2);
    this.padGain.gain.setTargetAtTime(active ? 0.028 : 0, t, 0.6);
  }

  _noise(duration, filterType, freq, gain, sweep) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + duration);
  }

  _tone(freq, duration, type = "sine", gain = 0.18, to) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + duration);
  }

  brake() {
    this._noise(0.38, "bandpass", 2200, 0.1, 700);
    this._tone(300, 0.22, "triangle", 0.05, 150);
  }
  nearMiss(combo = 1) {
    const base = 620 * Math.pow(1.09, Math.min(combo, 12));
    this._tone(base, 0.16, "triangle", 0.1, base * 1.6);
    this._noise(0.24, "highpass", 1500, 0.04);
  }
  crash() {
    this._noise(0.7, "lowpass", 1700, 0.3, 110);
    this._tone(120, 0.6, "sawtooth", 0.14, 40);
  }
  ui() {
    this._tone(520, 0.08, "square", 0.06, 700);
  }
  warn() {
    this._tone(880, 0.09, "square", 0.05, 660);
  }
  mirror() {
    this._tone(420, 0.35, "triangle", 0.09, 210);
  }
  start() {
    this._tone(330, 0.1, "square", 0.07, 660);
    this._tone(660, 0.16, "triangle", 0.05, 990);
  }
}
