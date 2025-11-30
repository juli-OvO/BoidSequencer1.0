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
let linePosSlider, ratioSlider, waveSelect;
let logEntriesEl;
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
let freqRatio = 1.059463;
let lineWaveform = "sine";
let lineOscillators = [];
let segmentActive = [];
let segmentLog = [];

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
  ratioSlider = document.getElementById("ratio-slider");
  waveSelect = document.getElementById("wave-select");
  logEntriesEl = document.getElementById("log-entries");
  if (clusterToggle) {
    clusterToggle.checked = showClusterBoxes;
    clusterToggle.addEventListener("change", e => showClusterBoxes = e.target.checked);
  }
  if (linePosSlider) {
    linePosSlider.value = lineXRatio * 100;
    linePosSlider.addEventListener("input", e => lineXRatio = constrain(parseFloat(e.target.value) / 100, 0, 1));
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

  hihatSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.0001, release: 0.02 }
  }).connect(toneReverb);
  hihatSynth.volume.value = -12; 

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }
  }).connect(toneReverb);

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

  pianoSynth.chain(kalimbaFilter, kalimbaReverb, toneReverb);
  pianoSynth.volume.value = -12;

  bassSynth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: "square" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    filterEnvelope: { attack: 0.30, decay: 0.2, sustain: 0.2, release: 0.6, baseFrequency: 100, octaves: 2 }
  }).connect(toneReverb);

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
if (particles.length > 0) {
  let r = 0, g = 0, b = 0;
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
  background(0);
}

  updateAmplitudeHistory();
  drawAmplitudeWave();
// --- Adjust speed based on slider ---
let speedFactor = speedSlider ? parseFloat(speedSlider.value) : 1;
beatLength = 60000 / (bpm * speedFactor);
let lineX = width * lineXRatio;

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

  checkLineTriggers(activeBoids, lineX);

  if (showClusterBoxes) {
    const clusters = findMixedInstrumentClusters(activeBoids);
    drawClusterBoxes(clusters);
  }

  drawHarmonicLine(lineX);

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

function mousePressed() {
  startAudioIfNeeded();
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
    this.size = 50;
    this.baseColor = baseColor;
    this.on = random() < 0.4;
    this.flash = false;
    this.prevPos = this.pos.copy();

    // individual personality
    this.maxSpeed = random(0.9, 2.2);
    this.alignStrength = random(0.75, 1.1);
    this.cohesionStrength = random(0.5, 0.9);
    this.separationStrength = random(0.6, 1.1);
    this.disperseBias = random(0.004, 0.015);

    this.home = home.copy();
    this.noiseSeed = random(1000);
    this.angle = random(TWO_PI);
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
    const perception = 80;
    const neighbors = this.computeNeighborhood(others, perception);
    const envForce = this.environmentalForces(neighbors.count);

    let flockForce = createVector();
    if (neighbors.count > 0) {
      neighbors.align.div(neighbors.count).setMag(this.maxSpeed);
      neighbors.cohesion.div(neighbors.count).sub(this.pos).setMag(0.05);
      neighbors.separation.div(neighbors.count).setMag(0.35);

      flockForce = p5.Vector.add(neighbors.align.mult(this.alignStrength))
        .add(neighbors.cohesion.mult(this.cohesionStrength))
        .add(neighbors.separation.mult(this.separationStrength));
    }

    this.acc.lerp(flockForce.add(envForce), 0.12);
  }

  computeNeighborhood(others, perception) {
    let data = {
      count: 0,
      align: createVector(),
      cohesion: createVector(),
      separation: createVector()
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

    return force;
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

function updateAmplitudeHistory() {
  if (!masterMeter) return;
  let level = masterMeter.getValue();
  if (!isFinite(level)) level = -Infinity;
  let normalized = map(level, -60, 0, 0, 1);
  normalized = constrain(normalized, 0, 1);
  ampHistory.push(normalized);
  if (ampHistory.length > AMP_HISTORY_LEN) ampHistory.shift();
}

function drawAmplitudeWave() {
  if (ampHistory.length < 2) return;
  push();
  noFill();
  let centerY = height / 2;
  strokeWeight(2);

  stroke(255, 90);
  beginShape();
  for (let i = 0; i < ampHistory.length; i++) {
    let x = map(i, 0, ampHistory.length - 1, 0, width);
    let amp = ampHistory[i];
    let wobble = sin(frameCount * 0.015 + i * 0.12) * 8;
    let displacement = (amp - 0.2) * 140;
    vertex(x, centerY - displacement + wobble);
  }
  endShape();

  stroke(255, 60);
  beginShape();
  for (let i = 0; i < ampHistory.length; i++) {
    let x = map(i, 0, ampHistory.length - 1, 0, width);
    let amp = ampHistory[i];
    let wobble = sin(frameCount * 0.015 + i * 0.12 + PI) * 8;
    let displacement = (amp - 0.2) * 140;
    vertex(x, centerY + displacement - wobble);
  }
  endShape();
  pop();
}

function drawHarmonicLine(lineX) {
  const segH = height / LINE_SEGMENTS;
  push();
  stroke(255, 0, 0);
  strokeWeight(2);
  line(lineX, 0, lineX, height);
  strokeWeight(1);
  for (let i = 0; i <= LINE_SEGMENTS; i++) {
    const y = i * segH;
    line(lineX - 6, y, lineX + 6, y);
  }
  pop();
}

function initLineOscillators() {
  segmentActive = Array(LINE_SEGMENTS).fill(false);
  lineOscillators = Array.from({ length: LINE_SEGMENTS }, () => new Tone.Synth({
    oscillator: { type: lineWaveform },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.25 }
  }).connect(toneReverb));
}

function updateLineWaveforms() {
  for (let osc of lineOscillators) {
    if (osc) osc.oscillator.type = lineWaveform;
  }
}

function checkLineTriggers(activeBoids, lineX) {
  if (!toneStarted || !lineOscillators.length) return;
  const segH = height / LINE_SEGMENTS;
  const occupancy = Array(LINE_SEGMENTS).fill(0);

  for (let b of activeBoids) {
    if (!b.prevPos) continue;
    const prevX = b.prevPos.x;
    const currX = b.pos.x;
    const crossed = (prevX - lineX) * (currX - lineX) <= 0;
    const near = Math.abs(currX - lineX) <= b.size * 0.55;
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
    if (activeNow && !segmentActive[i]) {
      startSegmentSound(i);
      segmentActive[i] = true;
    } else if (!activeNow && segmentActive[i]) {
      stopSegmentSound(i);
      segmentActive[i] = false;
    }
  }
}

function startSegmentSound(idx) {
  const synth = lineOscillators[idx];
  if (!synth) return;
  const offset = idx - floor(LINE_SEGMENTS / 2);
  const freq = LINE_REF_FREQ * Math.pow(freqRatio, offset);
  synth.oscillator.type = lineWaveform;
  synth.triggerAttack(freq, undefined, 0.35);
  addSegmentLog(idx, freq);
}

function stopSegmentSound(idx) {
  const synth = lineOscillators[idx];
  if (!synth) return;
  synth.triggerRelease();
}

function addSegmentLog(idx, freq) {
  const entry = `Seg ${idx + 1} : ${freq.toFixed(1)} Hz`;
  segmentLog.unshift(entry);
  if (segmentLog.length > 12) segmentLog.pop();
  if (logEntriesEl) {
    logEntriesEl.innerHTML = segmentLog.map(t => `<div class="log-entry"><span>${t}</span></div>`).join("");
  }
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
    fill(255, 25);
    rect(x, y, w, h, 12);

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
