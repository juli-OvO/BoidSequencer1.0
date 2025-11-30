//boids + sequencer
//interactivity/audio-visual/generative music.   

let boids = [];
let particles = [];
let playing = false;
let step = 0;
let bpm = 120;
let beatLength;
let accum = 0;
let speedSlider;
let clusterToggle;
let linePosSlider, lineYSlider, ratioSlider, waveSelect;
let lineSoundBtn;
let logEntriesEl;
let infoLineXEl, infoLineYEl, infoRatioEl, infoPlayingVEl, infoPlayingHEl;
let joinBtn;
let centerVec;
let masterMeter;
let ampHistory = [];
const AMP_HISTORY_LEN = 240;
const SIGNATURE_STEPS = 8;
let pianoSchedule = [];
let showClusterBoxes = true;
const CLUSTER_RADIUS = 140;
const LINE_SEGMENTS = 64;
const LINE_REF_FREQ = 220;
let lineXRatio = 0.5;
let lineYRatio = 0.5;
let freqRatio = 1.059463;
let lineWaveform = "sine";
let lineOscillatorsV = [];
let lineOscillatorsH = [];
let segmentActiveV = [];
let segmentActiveH = [];
let segmentLog = [];
let lineSoundEnabled = true;
let combineMorphStart = null;
const COMBINE_MORPH_DURATION = 10000;
let boidBus, lineXBus, lineYBus;
let boidMeter, lineXMeter, lineYMeter;
let ampHistoryBoid = [];
let ampHistoryX = [];
let ampHistoryY = [];
let ampHistoryUnion = [];
let lastBgColor = { r: 0, g: 0, b: 0 };

let toneReverb;
let hihatSynth, kickSynth, pianoSynth, bassSynth;
let noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];

let toggles = { hihat: true, bass: true, piano: true, kick: true };
let toneStarted = false;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-wrapper");
  frameRate(30);
  noStroke();
  speedSlider = document.getElementById("speed-slider");
  clusterToggle = document.getElementById("cluster-toggle");
  linePosSlider = document.getElementById("line-pos-slider");
  lineYSlider = document.getElementById("line-y-slider");
  ratioSlider = document.getElementById("ratio-slider");
  waveSelect = document.getElementById("wave-select");
  lineSoundBtn = document.getElementById("line-sound-btn");
  joinBtn = document.getElementById("join-btn");
  logEntriesEl = document.getElementById("log-entries");
  infoLineXEl = document.getElementById("info-line-x");
  infoLineYEl = document.getElementById("info-line-y");
  infoRatioEl = document.getElementById("info-ratio");
  infoPlayingVEl = document.getElementById("info-playing-v");
  infoPlayingHEl = document.getElementById("info-playing-h");
  if (clusterToggle) {
    clusterToggle.checked = showClusterBoxes;
    clusterToggle.addEventListener("change", e => showClusterBoxes = e.target.checked);
  }
  if (linePosSlider) {
    linePosSlider.value = lineXRatio * 100;
    linePosSlider.addEventListener("input", e => lineXRatio = constrain(parseFloat(e.target.value) / 100, 0, 1));
  }
  if (lineYSlider) {
    lineYSlider.value = lineYRatio * 100;
    lineYSlider.addEventListener("input", e => lineYRatio = constrain(parseFloat(e.target.value) / 100, 0, 1));
  }
  if (ratioSlider) {
    ratioSlider.value = freqRatio;
    ratioSlider.addEventListener("input", e => freqRatio = constrain(parseFloat(e.target.value), 1.0, 1.5));
  }
  if (waveSelect) {
    waveSelect.value = lineWaveform;
    waveSelect.addEventListener("change", e => {
      lineWaveform = e.target.value;
      updateLineWaveforms();
    });
  }
  if (lineSoundBtn) {
    lineSoundBtn.addEventListener("click", () => {
      lineSoundEnabled = !lineSoundEnabled;
      lineSoundBtn.textContent = `Line Sound: ${lineSoundEnabled ? "ON" : "OFF"}`;
      lineSoundBtn.classList.toggle("off", !lineSoundEnabled);
      if (!lineSoundEnabled) stopAllSegments();
    });
  }
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      combineMorphStart = millis();
    });
  }
  centerVec = createVector(width / 2, height / 2);

  // instrument regions (home zones)
  let homes = {
    hihat: createVector(width * 0.75, height * 0.25),
    bass:  createVector(width * 0.25, height * 0.75),
    piano: createVector(width * 0.5,  height * 0.5),
    kick:  createVector(width * 0.75, height * 0.75)
  };

  createInstrumentBoids("hihat", 8, homes.hihat);
  createInstrumentBoids("bass", 7, homes.bass);
  createInstrumentBoids("piano", 7, homes.piano);
  createInstrumentBoids("kick", 8, homes.kick);

  // Tone.js instruments + FX
  toneReverb = new Tone.Reverb({ decay: 4, preDelay: 0.03, wet: 0.7 }).toDestination();
  masterMeter = new Tone.Meter({ smoothing: 0.8 });
  toneReverb.connect(masterMeter);

  boidBus = new Tone.Gain().connect(toneReverb);
  lineXBus = new Tone.Gain().connect(toneReverb);
  lineYBus = new Tone.Gain().connect(toneReverb);

  boidMeter = new Tone.Meter({ smoothing: 0.8 });
  lineXMeter = new Tone.Meter({ smoothing: 0.8 });
  lineYMeter = new Tone.Meter({ smoothing: 0.8 });
  boidBus.connect(boidMeter);
  lineXBus.connect(lineXMeter);
  lineYBus.connect(lineYMeter);

  hihatSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.0001, release: 0.02 }
  }).connect(boidBus);
  hihatSynth.volume.value = -12; 

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }
  }).connect(boidBus);

  pianoSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: "triangle"
    },
    envelope: {
      attack: 0.002,
      decay: 0.3,
      sustain: 0.1,
      release: 1.2
    },
    portamento: 0
  });

  const kalimbaFilter = new Tone.Filter({
    type: "lowpass",
    frequency: 1800,
    rolloff: -12,
    Q: 2
  });

  const kalimbaReverb = new Tone.Reverb({ decay: 6, wet: 0.5 });

  pianoSynth.chain(kalimbaFilter, kalimbaReverb, boidBus);
  pianoSynth.volume.value = -12;

  bassSynth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: "square" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    filterEnvelope: { attack: 0.30, decay: 0.2, sustain: 0.2, release: 0.6, baseFrequency: 100, octaves: 2 }
  }).connect(boidBus);

  beatLength = 60000 / bpm;
  initLineOscillators();

  initInstrumentButtons();
}

function initInstrumentButtons() {
  document.querySelectorAll(".instr-btn").forEach(btn => {
    const type = btn.dataset.type;
    btn.classList.toggle("off", !toggles[type]);
    btn.addEventListener("click", () => {
      toggles[type] = !toggles[type];
      btn.classList.toggle("off", !toggles[type]);
    });
  });
}

function draw() {
// --- Dynamic background based on particle colors ---
let r = 0, g = 0, b = 0;
if (particles.length > 0) {
  for (let p of particles) {
    r += red(p.col);
    g += green(p.col);
    b += blue(p.col);
  }
  r = constrain(r / particles.length, 0, 255);
  g = constrain(g / particles.length, 0, 255);
  b = constrain(b / particles.length, 0, 255);
  background(r, g, b, 50); // slight transparency for blending
} else {
  r = 0; g = 0; b = 0;
  background(0);
}
  lastBgColor = { r, g, b };

  updateAmplitudeHistories();
  drawAmplitudePanels();
// --- Adjust speed based on slider ---
let speedFactor = speedSlider ? parseFloat(speedSlider.value) : 1;
beatLength = 60000 / (bpm * speedFactor);
let lineX = width * lineXRatio;
let lineY = height * lineYRatio;

// scale boid motion
for (let b of boids) {
  b.maxSpeed = 1.5 * speedFactor;  // scales with tempo
}


  // update/draw boids
  const activeBoids = boids.filter(b => toggles[b.type]);
  const boidsByType = activeBoids.reduce((map, b) => {
    if (!map[b.type]) map[b.type] = [];
    map[b.type].push(b);
    return map;
  }, {});

  for (let b of activeBoids) {
    b.storePrev();
    b.flock(boidsByType[b.type]);
    b.update();
  }

  checkVerticalTriggers(activeBoids, lineX);
  checkHorizontalTriggers(activeBoids, lineY);

  if (showClusterBoxes) {
    const clusters = findMixedInstrumentClusters(activeBoids);
    drawClusterBoxes(clusters);
  }

  drawSegmentStrips();
  drawHarmonicLines(lineX, lineY);
  updateLineInfoPanel(lineX);

  for (let b of activeBoids) {
    b.display();
  }

  // update/draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].life <= 0) particles.splice(i, 1);
  }

  // deltaTime-based beat
  accum += deltaTime;
  if (playing && accum > beatLength / 2) {
    accum = 0;
    stepBeat();
  }

  fill(0);
  textAlign(CENTER);
  text("Click boids to toggle | SPACE to play/stop", width / 2, height - 20);
}

function keyPressed() {
  startAudioIfNeeded();
  if (key === ' ') {
    playing = !playing;
    accum = 0;
  }
}

function drawSegmentStrips() {
  // vertical stripes reacting to vertical line segments
  const stripW = width / LINE_SEGMENTS;
  push();
  noStroke();
  for (let i = 0; i < LINE_SEGMENTS; i++) {
    if (segmentActiveV[i]) {
      fill(255, 255, 255, 40);
      rect(i * stripW, 0, stripW, height);
    }
  }
  // horizontal stripes reacting to horizontal line segments
  const stripH = height / LINE_SEGMENTS;
  for (let i = 0; i < LINE_SEGMENTS; i++) {
    if (segmentActiveH[i]) {
      fill(255, 255, 255, 40);
      rect(0, i * stripH, width, stripH);
    }
  }
  pop();
}

function mousePressed() {
  startAudioIfNeeded();
  combineMorphStart = millis();
  for (let b of boids) {
    if (!toggles[b.type]) continue;
    if (dist(mouseX, mouseY, b.pos.x, b.pos.y) < b.size / 2 + 5) {
      b.toggle();
      break;
    }
  }
}

function stepBeat() {
  for (let b of boids) b.flash = false;
  if (step === 0) rebuildPianoSchedule();
  playInstrument("hihat", 8);
  playScheduledPiano(step);
  playInstrument("kick", 8);
  if (step === 0) playBassChord();
  step = (step + 1) % SIGNATURE_STEPS;
}

function playInstrument(type, numCols) {
  if (!toggles[type]) return;
  let index = step % numCols;
  let subset = boids.filter(b => b.type === type && b.col === index);
  for (let b of subset) {
    if (b.on) { // ✅ only active boids
      b.play();
      b.flash = true;
      for (let i = 0; i < 5; i++) particles.push(new Particle(b.pos.copy(), b.baseColor));
    }
  }
}

function playBassChord() {
  if (!toggles.bass) return;
  let subset = boids.filter(b => b.type === "bass");
  for (let b of subset) {
    if (b.on) { // ✅ only active boids
      b.play();
      for (let i = 0; i < 6; i++) particles.push(new Particle(b.pos.copy(), b.baseColor));
    }
  }
}

function rebuildPianoSchedule() {
  pianoSchedule = Array.from({ length: SIGNATURE_STEPS }, () => []);
  if (!toggles.piano) return;
  const active = boids.filter(b => b.type === "piano" && b.on);
  if (!active.length) return;

  for (let b of active) {
    const baseIndex = b.col % noteFreqs.length;
    const intervals = [0, 2, 4];
    for (let interval of intervals) {
      const idx = (baseIndex + interval) % noteFreqs.length;
      const freq = noteFreqs[idx] * 2;
      const slot = floor(random(SIGNATURE_STEPS));
      pianoSchedule[slot].push({ freq, boid: b });
    }
  }
}

function playScheduledPiano(stepIndex) {
  if (!toggles.piano || !pianoSchedule.length) return;
  const bucket = pianoSchedule[stepIndex] || [];
  if (!bucket.length) return;
  const dur = Math.max(beatLength / 1000 * 0.75, 0.18);

  bucket.forEach(entry => {
    pianoSynth.triggerAttackRelease(entry.freq, dur, undefined, 0.55);
    if (entry.boid) {
      entry.boid.flash = true;
      particles.push(new Particle(entry.boid.pos.copy(), entry.boid.baseColor));
    }
  });

  bucket.length = 0;
}


// ---- CLASS: SoundBoid ----
class SoundBoid {
  constructor(x, y, type, col, baseColor, home) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.acc = createVector();
    this.type = type;
    this.col = col;
    this.size = 30;
    this.baseColor = baseColor;
    this.on = random() < 0.4;
    this.flash = false;
    this.prevPos = this.pos.copy();

    // individual personality
    this.maxSpeed = random(0.9, 2.2);
    this.alignStrength = random(0.75, 1.1);
    this.cohesionStrength = random(0.5, 0.9);
    this.separationStrength = random(0.6, 1.1);
    this.baseCohesionStrength = this.cohesionStrength;
    this.baseSeparationStrength = this.separationStrength;
    this.disperseBias = random(0.004, 0.015);

    this.home = home.copy();
    this.noiseSeed = random(1000);
    this.angle = random(TWO_PI);
    this.flowSeed = random(1000);
    this.flowStrength = random(0.25, 0.55);
  }

  update() {
    // --- deltaTime normalization ---
    let dt = deltaTime / (1000 / 60);

    this.vel.add(p5.Vector.mult(this.acc, dt));
    this.vel.limit(this.maxSpeed);
    this.pos.add(p5.Vector.mult(this.vel, dt));
    this.acc.mult(0);

    if (this.vel.magSq() > 0.0001) {
      const targetAngle = this.vel.heading();
      this.angle = lerpAngle(this.angle, targetAngle, 0.2);
    }

    // wrap edges
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  storePrev() {
    this.prevPos = this.pos.copy();
  }

  // === MOVEMENT FORCES ===
  // keeps instruments clustered but fluid
  flock(others) {
    const blend = getCombineFactor();
    const perception = lerp(80, 140, blend);
    const neighbors = this.computeNeighborhood(others, perception);
    const envForce = this.environmentalForces(neighbors.count);
    const cohStrength = lerp(this.baseCohesionStrength, this.baseCohesionStrength * 1.8, blend);
    const sepStrength = lerp(this.baseSeparationStrength, this.baseSeparationStrength * 0.2, blend);
    const closePushStrength = lerp(0.6, 1.2, blend); // keep some personal space when joining

    let flockForce = createVector();
    if (neighbors.count > 0) {
      neighbors.align.div(neighbors.count).setMag(this.maxSpeed);
      neighbors.cohesion.div(neighbors.count).sub(this.pos).setMag(0.05 * cohStrength / this.baseCohesionStrength);
      neighbors.separation.div(neighbors.count).setMag(0.35 * sepStrength / this.baseSeparationStrength);

      flockForce = p5.Vector.add(neighbors.align.mult(this.alignStrength))
        .add(neighbors.cohesion.mult(cohStrength))
        .add(neighbors.separation.mult(sepStrength))
        .add(neighbors.closePush.mult(closePushStrength));
    }

    this.acc.lerp(flockForce.add(envForce), 0.12);
  }

  computeNeighborhood(others, perception) {
    let data = {
      count: 0,
      align: createVector(),
      cohesion: createVector(),
      separation: createVector(),
      closePush: createVector()
    };

    for (let other of others) {
      if (other === this) continue;
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (d < perception) {
        data.align.add(other.vel);
        data.cohesion.add(other.pos);
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.div(Math.max(d * d, 0.001));
        data.separation.add(diff);
        data.count++;

        const personal = this.size;
        if (d < personal && d > 0.001) {
          let push = p5.Vector.sub(this.pos, other.pos).normalize().mult((personal - d) / personal);
          data.closePush.add(push);
        }
      }
    }

    return data;
  }

  environmentalForces(neighborCount) {
    let force = createVector();
    let density = neighborCount / 8.0;

    let homeMag = density < 0.3 ? 0.055 : 0.04;
    force.add(p5.Vector.sub(this.home, this.pos).setMag(homeMag));

    if (density > 0.85) {
      force.add(p5.Vector.random2D().mult(0.12));
    }

    let theta = noise(this.noiseSeed + millis() * 0.00025) * TWO_PI;
    force.add(p5.Vector.fromAngle(theta).mult(0.025));

    force.add(p5.Vector.sub(this.pos, this.home).setMag(this.disperseBias));
    force.add(p5.Vector.sub(this.pos, centerVec).setMag(0.003));

    force.add(this.wavyFlow());

    return force;
  }

  wavyFlow() {
    const t = millis() * 0.001;
    const wave = sin(t * 0.8 + this.flowSeed * 10) * this.flowStrength;
    const heading = this.vel.magSq() > 0.0001 ? this.vel.heading() : this.angle;
    const sideForce = p5.Vector.fromAngle(heading + HALF_PI).setMag(wave * 0.05);
    const driftAngle = noise(this.flowSeed + t * 0.2) * TWO_PI;
    const driftForce = p5.Vector.fromAngle(driftAngle).mult(0.015 * this.flowStrength);
    return sideForce.add(driftForce);
  }

  display() {
    let c;
    if (this.type === "bass") {
      if (!this.on) c = color(255);
      else if (this.flash) c = complementary(this.baseColor);
      else c = color(0);
    } else {
      if (!this.on) c = color(220);
      else if (this.flash) c = complementary(this.baseColor);
      else c = this.baseColor;
    }

    fill(c);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle + HALF_PI);
    if (this.type === "piano") rectMode(CENTER), rect(0, 0, this.size, this.size);
    else if (this.type === "kick") ellipse(0, 0, this.size);
    else if (this.type === "bass") arc(0, 0, this.size * 1.3, this.size * 1.3, 0, PI, CHORD);
    else if (this.type === "hihat") triangle(-this.size / 2, this.size / 2, 0, -this.size / 2, this.size / 2, this.size / 2);
    pop();
  }

  toggle() { this.on = !this.on; }

  play() {
    if (!this.on || !toneStarted) return;
    let speed = this.vel.mag();
    let velocity = constrain(map(speed, 0, 3, 0.2, 0.9), 0.05, 1);
    let beatSeconds = beatLength / 1000;

    if (this.type === "hihat") {
      hihatSynth.triggerAttackRelease("16n", undefined, velocity);
    } else if (this.type === "kick") {
      let pitch = map(speed, 0, 3, 50, 80);
      let dur = Math.max(beatSeconds * 0.25, 0.05);
      kickSynth.triggerAttackRelease(pitch, dur, undefined, velocity);
    } else if (this.type === "piano") {
      return; // handled globally in playPianoChord
    } else if (this.type === "bass") {
      let f = (noteFreqs[this.col % 7] / 2) * map(speed, 0, 3, 0.9, 1.1);
      let dur = Math.max(beatSeconds * 2, 0.3);
      bassSynth.triggerAttackRelease(f, dur, undefined, velocity);
    }
  }
}

// ---- PARTICLES ----
class Particle {
  constructor(pos, c) {
    this.pos = pos.copy();
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.life = 255;
    this.col = c;
  }
  update() {
    this.pos.add(this.vel);
    this.vel.mult(0.95);
    this.life -= 10;
  }
  display() {
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), this.life);
    ellipse(this.pos.x, this.pos.y, 5);
  }
}

function updateAmplitudeHistories() {
  const readMeter = (m) => {
    if (!m) return 0;
    let level = m.getValue();
    if (!isFinite(level)) level = -Infinity;
    return constrain(map(level, -60, 0, 0, 1), 0, 1);
  };

  const pushHist = (hist, val) => {
    hist.push(val);
    if (hist.length > AMP_HISTORY_LEN) hist.shift();
  };

  pushHist(ampHistoryBoid, readMeter(boidMeter));
  pushHist(ampHistoryX, readMeter(lineXMeter));
  pushHist(ampHistoryY, readMeter(lineYMeter));
  pushHist(ampHistoryUnion, readMeter(masterMeter));
}

function drawAmplitudePanels() {
  const panels = [
    { label: "X Segments", hist: ampHistoryX, color: color(255, 0, 0) },
    { label: "Y Segments", hist: ampHistoryY, color: color(0, 180, 255) },
    { label: "Boids", hist: ampHistoryBoid, color: complementary(color(lastBgColor.r, lastBgColor.g, lastBgColor.b)) }
  ];
  const w = 240;
  const h = 110;
  const pad = 10;
  const spacing = 12;
  const startX = width - w - 24;
  const startY = 24;

  panels.forEach((panel, idx) => {
    if (panel.hist.length < 2) return;
    const x0 = startX;
    const y0 = startY + idx * (h + spacing);
    push();
    translate(x0, y0);

    noStroke();
    fill(0, 0, 0, 170);
    rect(0, 0, w, h);
    stroke(red(panel.color), green(panel.color), blue(panel.color), 160);
    noFill();
    rect(0, 0, w, h);

    translate(pad, pad);
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;
    let centerY = innerH / 2;
    strokeWeight(2);

    // main wave
    stroke(panel.color);
    beginShape();
    for (let i = 0; i < panel.hist.length; i++) {
      let x = map(i, 0, panel.hist.length - 1, 0, innerW);
      let amp = panel.hist[i];
      let wobble = sin(frameCount * 0.015 + i * 0.12) * 3;
      let displacement = (amp - 0.2) * (innerH * 0.6);
      vertex(x, centerY - displacement + wobble);
    }
    endShape();

    // faint union overlay
    if (ampHistoryUnion.length > 1) {
      stroke(255, 128);
      beginShape();
      for (let i = 0; i < ampHistoryUnion.length; i++) {
        let x = map(i, 0, ampHistoryUnion.length - 1, 0, innerW);
        let amp = ampHistoryUnion[i];
        let wobble = sin(frameCount * 0.015 + i * 0.12 + PI) * 2;
        let displacement = (amp - 0.2) * (innerH * 0.6);
        vertex(x, centerY + displacement - wobble);
      }
      endShape();
    }

    // label
    noStroke();
    fill(255);
    textSize(12);
    textAlign(LEFT, TOP);
    text(panel.label, 0, -pad + 2);
    pop();
  });
}

function drawHarmonicLines(lineX, lineY) {
  const segH = height / LINE_SEGMENTS;
  const segW = width / LINE_SEGMENTS;
  push();
  strokeWeight(2);

  // vertical line
  stroke(255, 0, 0);
  line(lineX, 0, lineX, height);
  strokeWeight(1);
  for (let i = 0; i <= LINE_SEGMENTS; i++) {
    const y = i * segH;
    line(lineX - 6, y, lineX + 6, y);
  }

  // horizontal line
  stroke(0, 180, 255);
  strokeWeight(2);
  line(0, lineY, width, lineY);
  strokeWeight(1);
  for (let i = 0; i <= LINE_SEGMENTS; i++) {
    const x = i * segW;
    line(x, lineY - 6, x, lineY + 6);
  }
  pop();
}

function initLineOscillators() {
  segmentActiveV = Array(LINE_SEGMENTS).fill(false);
  segmentActiveH = Array(LINE_SEGMENTS).fill(false);
  lineOscillatorsV = Array.from({ length: LINE_SEGMENTS }, () => new Tone.Synth({
    oscillator: { type: lineWaveform },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.25 }
  }).connect(lineYBus));
  lineOscillatorsH = Array.from({ length: LINE_SEGMENTS }, () => new Tone.Synth({
    oscillator: { type: lineWaveform },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.25 }
  }).connect(lineXBus));
}

function updateLineWaveforms() {
  for (let osc of lineOscillatorsV) if (osc) osc.oscillator.type = lineWaveform;
  for (let osc of lineOscillatorsH) if (osc) osc.oscillator.type = lineWaveform;
}

function checkVerticalTriggers(activeBoids, lineX) {
  if (!toneStarted || !lineOscillatorsH.length) return;
  const segH = height / LINE_SEGMENTS;
  const occupancy = Array(LINE_SEGMENTS).fill(0);

  for (let b of activeBoids) {
    if (!b.prevPos) continue;
    const prevX = b.prevPos.x;
    const currX = b.pos.x;
    if (Math.abs(currX - prevX) > width * 0.5) continue; // skip wrap teleports
    const crossed = (prevX - lineX) * (currX - lineX) <= 0;
    const nearBand = b.size * 0.4;
    const near = Math.abs(currX - lineX) <= nearBand && Math.abs(prevX - lineX) <= nearBand;
    if (!crossed && !near) continue;

    const denom = (currX - prevX);
    const t = denom === 0 ? 0.5 : constrain((lineX - prevX) / denom, 0, 1);
    const yCross = b.prevPos.y + t * (b.pos.y - b.prevPos.y);
    if (yCross < 0 || yCross > height) continue;
    const idx = constrain(floor(yCross / segH), 0, LINE_SEGMENTS - 1);
    occupancy[idx] += 1;
  }

  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const activeNow = occupancy[i] > 0;
    if (activeNow && !segmentActiveH[i]) {
      startSegmentSound("H", i); // vertical crossing drives horizontal response
      segmentActiveH[i] = true;
    } else if (!activeNow && segmentActiveH[i]) {
      stopSegmentSound("H", i);
      segmentActiveH[i] = false;
    }
  }
}

function checkHorizontalTriggers(activeBoids, lineY) {
  if (!toneStarted || !lineOscillatorsV.length) return;
  const segW = width / LINE_SEGMENTS;
  const occupancy = Array(LINE_SEGMENTS).fill(0);

  for (let b of activeBoids) {
    if (!b.prevPos) continue;
    const prevY = b.prevPos.y;
    const currY = b.pos.y;
    if (Math.abs(currY - prevY) > height * 0.5) continue; // skip wrap teleports
    const crossed = (prevY - lineY) * (currY - lineY) <= 0;
    const nearBand = b.size * 0.4;
    const near = Math.abs(currY - lineY) <= nearBand && Math.abs(prevY - lineY) <= nearBand;
    if (!crossed && !near) continue;

    const denom = (currY - prevY);
    const t = denom === 0 ? 0.5 : constrain((lineY - prevY) / denom, 0, 1);
    const xCross = b.prevPos.x + t * (b.pos.x - b.prevPos.x);
    if (xCross < 0 || xCross > width) continue;
    const idx = constrain(floor(xCross / segW), 0, LINE_SEGMENTS - 1);
    occupancy[idx] += 1;
  }

  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const activeNow = occupancy[i] > 0;
    if (activeNow && !segmentActiveV[i]) {
      startSegmentSound("V", i); // horizontal crossing drives vertical response
      segmentActiveV[i] = true;
    } else if (!activeNow && segmentActiveV[i]) {
      stopSegmentSound("V", i);
      segmentActiveV[i] = false;
    }
  }
}

function startSegmentSound(orientation, idx) {
  const synthArray = orientation === "V" ? lineOscillatorsV : lineOscillatorsH;
  const synth = synthArray[idx];
  if (!synth || !lineSoundEnabled) return;
  const offset = idx - floor(LINE_SEGMENTS / 2);
  const freq = LINE_REF_FREQ * Math.pow(freqRatio, offset);
  synth.oscillator.type = lineWaveform;
  synth.triggerAttack(freq, undefined, 0.35);
  addSegmentLog(orientation, idx, freq);
}

function stopSegmentSound(orientation, idx) {
  const synthArray = orientation === "V" ? lineOscillatorsV : lineOscillatorsH;
  const synth = synthArray[idx];
  if (!synth) return;
  synth.triggerRelease();
}

function stopAllSegments() {
  for (let i = 0; i < LINE_SEGMENTS; i++) {
    if (segmentActiveV[i]) stopSegmentSound("V", i);
    if (segmentActiveH[i]) stopSegmentSound("H", i);
    segmentActiveV[i] = false;
    segmentActiveH[i] = false;
  }
}

function addSegmentLog(orientation, idx, freq) {
  const entry = `${orientation} Seg ${idx + 1} : ${freq.toFixed(1)} Hz`;
  segmentLog.unshift(entry);
  if (segmentLog.length > 12) segmentLog.pop();
  if (logEntriesEl) {
    logEntriesEl.innerHTML = segmentLog.map(t => `<div class="log-entry"><span>${t}</span></div>`).join("");
  }
}

function updateLineInfoPanel(lineX) {
  if (infoLineXEl) infoLineXEl.textContent = `${Math.round(lineX)}`;
  if (infoLineYEl) infoLineYEl.textContent = `${Math.round(lineYRatio * height)}`;
  if (infoRatioEl) infoRatioEl.textContent = freqRatio.toFixed(6);
  if (infoPlayingVEl) {
    const playing = lineSoundEnabled ? segmentActiveV
      .map((on, idx) => on ? idx + 1 : null)
      .filter(v => v !== null) : [];
    infoPlayingVEl.textContent = playing.length ? playing.join(", ") : "None";
  }
  if (infoPlayingHEl) {
    const playing = lineSoundEnabled ? segmentActiveH
      .map((on, idx) => on ? idx + 1 : null)
      .filter(v => v !== null) : [];
    infoPlayingHEl.textContent = playing.length ? playing.join(", ") : "None";
  }
}

function getCombineFactor() {
  if (combineMorphStart === null) return 0;
  return constrain((millis() - combineMorphStart) / COMBINE_MORPH_DURATION, 0, 1);
}

function findMixedInstrumentClusters(activeBoids) {
  const clusters = [];
  const visited = new Set();

  for (let i = 0; i < activeBoids.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    const members = [];
    const types = new Set();

    while (queue.length) {
      const idx = queue.pop();
      if (visited.has(idx)) continue;
      visited.add(idx);

      const b = activeBoids[idx];
      members.push(b);
      types.add(b.type);

      for (let j = 0; j < activeBoids.length; j++) {
        if (visited.has(j)) continue;
        const other = activeBoids[j];
        if (dist(b.pos.x, b.pos.y, other.pos.x, other.pos.y) < CLUSTER_RADIUS) {
          queue.push(j);
        }
      }
    }

    if (types.size > 1 && members.length >= 3) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let m of members) {
        minX = Math.min(minX, m.pos.x - m.size * 0.6);
        minY = Math.min(minY, m.pos.y - m.size * 0.6);
        maxX = Math.max(maxX, m.pos.x + m.size * 0.6);
        maxY = Math.max(maxY, m.pos.y + m.size * 0.6);
      }
      clusters.push({ minX, minY, maxX, maxY, types });
    }
  }

  return clusters;
}

function drawClusterBoxes(clusters) {
  if (!clusters.length) return;
  push();
  strokeWeight(2);
  for (let box of clusters) {
    const pad = 14;
    let x = constrain(box.minX - pad, 0, width);
    let y = constrain(box.minY - pad, 0, height);
    let w = constrain(box.maxX - box.minX + pad * 2, 0, width - x);
    let h = constrain(box.maxY - box.minY + pad * 2, 0, height - y);

    stroke(255, 180);
    noFill();
    rect(x, y, w, h, 0);

    const label = Array.from(box.types).join(" + ");
    if (label) {
      noStroke();
      fill(255, 210);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      const ty = y - 6 < 12 ? y + h + 14 : y - 6;
      text(label, x + 10, ty);
    }
  }
  pop();
}

// ---- HELPERS ----
function createInstrumentBoids(type, numCols, home) {
  for (let i = 0; i < numCols; i++) {
    boids.push(new SoundBoid(random(width), random(height), type, i, randomInstrumentColor(type), home));
  }
}

function randomInstrumentColor(type) {
  colorMode(HSB, 360, 100, 100, 100);
  let hueCenter;
  let saturation = random(60, 80);
  let brightness = random(45, 60);

  if (type === "piano") hueCenter = 55;       // yellow
  else if (type === "kick") hueCenter = 185;  // cyan
  else if (type === "hihat") hueCenter = 305; // magenta
  else if (type === "bass") {
    let white = color(0, 0, 95);
    colorMode(RGB, 255);
    return white;
  } else hueCenter = random(0, 360);

  let hue = (hueCenter + random(-15, 15) + 360) % 360;
  let c = color(hue, saturation, brightness);
  colorMode(RGB, 255);
  return c;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function complementary(c) {
  return color(255 - red(c), 255 - green(c), 255 - blue(c));
}

function startAudioIfNeeded() {
  if (toneStarted) return;
  Tone.start()
    .then(() => {
      toneStarted = true;
    })
    .catch(err => console.error("Tone start failed", err));
}

function touchStarted() {
  startAudioIfNeeded();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  centerVec.set(windowWidth / 2, windowHeight / 2);
}

function lerpAngle(a, b, t) {
  const diff = atan2(sin(b - a), cos(b - a));
  return a + diff * t;
}

window.addEventListener("click", async () => {
  if (Tone.context.state !== "running") {
    await Tone.start();
    console.log("🔊 AudioContext started!");
  }
}, { once: true });
