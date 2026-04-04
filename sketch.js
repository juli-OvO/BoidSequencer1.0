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
let boidSegSoundBtn, lineSegSoundBtn;
let logEntriesEl;
let infoLineXEl, infoLineYEl, infoRatioEl, infoPlayingVEl, infoPlayingHEl;
let joinBtn;
let regroupBtn;
let orbCountSlider, orbSpeedSlider, addLineBtn, clearLinesBtn;
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
let combineMorphStart = null;
const COMBINE_MORPH_DURATION = 10000;
let boidBus, lineXBus, lineYBus;
let boidMeter, lineXMeter, lineYMeter;
let ampHistoryBoid = [];
let ampHistoryX = [];
let ampHistoryY = [];
let ampHistoryUnion = [];
let lastBgColor = { r: 0, g: 0, b: 0 };
let joinAllMode = false;
let linePaths = [];
let pendingLineStart = null;
let orbCount = 8;
let orbSpeed = 1;
let lineDrawMode = false;
let drawingPoints = [];
let drawingActive = false;
let sliderLabelMap = [];
let lineSoundBoidEnabled = true;
let lineSoundOrbEnabled = true;
let sequencerPulses = {};
let lastSequencerStep = 0;
const SEQUENCER_PULSE_MS = 320;
let sequencerLayout = null;
let sequencerPalette = {};
let sequencerFrameState = null;
let masterCompressor, masterLimiter;
let tutorialOverlayEl = null;
let tutorialOverlayBlocking = true;
let dismissTutorialOverlayHandler = null;

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
  boidSegSoundBtn = document.getElementById("boid-seg-sound-btn");
  lineSegSoundBtn = document.getElementById("line-seg-sound-btn");
  joinBtn = document.getElementById("join-btn");
  regroupBtn = document.getElementById("regroup-btn");
  orbCountSlider = document.getElementById("orb-count-slider");
  orbSpeedSlider = document.getElementById("orb-speed-slider");
  addLineBtn = document.getElementById("add-line-btn");
  clearLinesBtn = document.getElementById("clear-lines-btn");
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
  if (boidSegSoundBtn) {
    boidSegSoundBtn.addEventListener("click", () => {
      lineSoundBoidEnabled = !lineSoundBoidEnabled;
      boidSegSoundBtn.textContent = `Boid Segments: ${lineSoundBoidEnabled ? "ON" : "OFF"}`;
      boidSegSoundBtn.classList.toggle("off", !lineSoundBoidEnabled);
      if (!lineSoundBoidEnabled && !lineSoundOrbEnabled) stopAllSegments();
    });
  }
  if (lineSegSoundBtn) {
    lineSegSoundBtn.addEventListener("click", () => {
      lineSoundOrbEnabled = !lineSoundOrbEnabled;
      lineSegSoundBtn.textContent = `Line Segments: ${lineSoundOrbEnabled ? "ON" : "OFF"}`;
      lineSegSoundBtn.classList.toggle("off", !lineSoundOrbEnabled);
      if (!lineSoundBoidEnabled && !lineSoundOrbEnabled) stopAllSegments();
    });
  }
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      combineMorphStart = millis();
      joinAllMode = true;
    });
  }
  if (regroupBtn) {
    regroupBtn.addEventListener("click", () => {
      joinAllMode = false;
      combineMorphStart = null;
    });
  }
  if (orbCountSlider) {
    orbCountSlider.addEventListener("input", e => {
      orbCount = parseInt(e.target.value, 10) || 1;
      rebuildAllOrbs();
    });
  }
  if (orbSpeedSlider) {
    orbSpeedSlider.addEventListener("input", e => {
      orbSpeed = parseFloat(e.target.value) || 1;
    });
  }
  if (addLineBtn) {
    addLineBtn.addEventListener("click", () => {
      pendingLineStart = null;
      drawingPoints = [];
      drawingActive = false;
      lineDrawMode = true;
      addLineBtn.classList.add("active");
    });
  }
  if (clearLinesBtn) {
    clearLinesBtn.addEventListener("click", () => {
      linePaths = [];
      updateClearBtnState();
    });
  }
  updateClearBtnState();
  initSliderLabels();
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
  masterCompressor = new Tone.Compressor({
    threshold: -18,
    ratio: 3,
    attack: 0.02,
    release: 0.18
  });
  masterLimiter = new Tone.Limiter(-1).toDestination();
  toneReverb = new Tone.Reverb({ decay: 4, preDelay: 0.03, wet: 0.7 });
  toneReverb.connect(masterCompressor);
  masterCompressor.connect(masterLimiter);
  masterMeter = new Tone.Meter({ smoothing: 0.8 });
  masterLimiter.connect(masterMeter);

  boidBus = new Tone.Gain().connect(toneReverb);
  lineXBus = new Tone.Gain().connect(toneReverb);
  lineYBus = new Tone.Gain().connect(toneReverb);
  boidBus.gain.value = 0.9;
  lineXBus.gain.value = 0.5;
  lineYBus.gain.value = 0.5;

  boidMeter = new Tone.Meter({ smoothing: 0.8 });
  lineXMeter = new Tone.Meter({ smoothing: 0.8 });
  lineYMeter = new Tone.Meter({ smoothing: 0.8 });
  boidBus.connect(boidMeter);
  lineXBus.connect(lineXMeter);
  lineYBus.connect(lineYMeter);

  hihatSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.003, decay: 0.05, sustain: 0.0001, release: 0.03 }
  }).connect(boidBus);
  hihatSynth.volume.value = -12; 

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 5,
    envelope: { attack: 0.003, decay: 0.24, sustain: 0, release: 0.24 }
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
  bassSynth.volume.value = -4;

  beatLength = 60000 / bpm;
  initLineOscillators();
  initSequencerUI();
  resetSequencerPulses();
  initTutorialOverlay();
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

  updateOrbs();
  const orbActors = collectOrbActors();
  const movers = activeBoids.concat(orbActors);

  checkVerticalTriggers(movers, lineX);
  checkHorizontalTriggers(movers, lineY);

  if (showClusterBoxes) {
    const clusters = findMixedInstrumentClusters(activeBoids);
    drawClusterBoxes(clusters);
  }

  sequencerFrameState = buildSequencerFrameState();

  drawPathsAndOrbs();
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

  drawSequencerPanel();

  fill(255);
  textAlign(CENTER);
  const helpY = sequencerLayout ? max(28, sequencerLayout.outerY - 12) : height - 20;
  text("Click boids to toggle | SPACE to play/stop", width / 2, helpY);
}

function keyPressed() {
  if (tutorialOverlayBlocking) return false;
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

function mouseDragged() {
  if (lineDrawMode && drawingActive) {
    drawingPoints.push(createVector(mouseX, mouseY));
  }
}

// ---- USER LINES + ORBITERS ----
function addLinePathFromPoints(points) {
  if (!points || points.length < 2) return;
  const path = {
    points: points.map(p => p.copy()),
    lengths: [],
    totalLength: 0,
    orbs: []
  };
  updatePathMetrics(path);
  path.orbs = buildOrbsForPath(path);
  linePaths.push(path);
  updateClearBtnState();
}

function updatePathMetrics(path) {
  path.lengths = [0];
  let total = 0;
  for (let i = 1; i < path.points.length; i++) {
    total += p5.Vector.dist(path.points[i - 1], path.points[i]);
    path.lengths.push(total);
  }
  path.totalLength = total || 1;
}

function pointOnPath(path, distance) {
  if (path.points.length === 1) return path.points[0].copy();
  const d = ((distance % path.totalLength) + path.totalLength) % path.totalLength;
  let idx = 1;
  while (idx < path.lengths.length && path.lengths[idx] < d) idx++;
  const prevIdx = max(0, idx - 1);
  const segStart = path.points[prevIdx];
  const segEnd = path.points[idx] || segStart;
  const segLen = max(0.0001, path.lengths[idx] - path.lengths[prevIdx]);
  const t = (d - path.lengths[prevIdx]) / segLen;
  return p5.Vector.lerp(segStart, segEnd, t);
}

function buildOrbsForPath(path) {
  const arr = [];
  for (let i = 0; i < orbCount; i++) {
    const t = i / orbCount;
    const dist = path.totalLength * t;
    const pos = pointOnPath(path, dist);
    arr.push({ dist, size: 18, pos, prevPos: pos.copy() });
  }
  return arr;
}

function rebuildAllOrbs() {
  linePaths = linePaths.map(p => {
    updatePathMetrics(p);
    return { ...p, orbs: buildOrbsForPath(p) };
  });
}

function updateOrbs() {
  const inc = orbSpeed * deltaTime * 0.25;
  for (let path of linePaths) {
    for (let orb of path.orbs) {
      orb.prevPos = orb.pos.copy();
      orb.dist = (orb.dist + inc) % path.totalLength;
      orb.pos = pointOnPath(path, orb.dist);
    }
  }
}

function collectOrbActors() {
  const list = [];
  for (let path of linePaths) {
    for (let orb of path.orbs) {
      list.push({ pos: orb.pos, prevPos: orb.prevPos, size: orb.size, kind: "orb" });
    }
  }
  return list;
}

function drawPathPolyline(points) {
  if (!points || points.length < 2) return;
  beginShape();
  for (let p of points) vertex(p.x, p.y);
  endShape();
}

function drawPathsAndOrbs() {
  push();
  stroke(255, 230, 50, 140);
  strokeWeight(2);
  noFill();
  // existing paths
  for (let path of linePaths) {
    drawPathPolyline(path.points);
    for (let orb of path.orbs) {
      ellipse(orb.pos.x, orb.pos.y, orb.size);
    }
  }
  // preview
  if (lineDrawMode && drawingPoints.length > 1) {
    stroke(255, 230, 50, 200);
    drawPathPolyline(drawingPoints);
  }
  pop();
}

function updateClearBtnState() {
  if (!clearLinesBtn) return;
  clearLinesBtn.classList.toggle("off", linePaths.length === 0);
}

function initSliderLabels() {
  const sliders = [
    { el: speedSlider, format: v => v.toFixed(1) },
    { el: linePosSlider, format: v => Math.round(v) },
    { el: lineYSlider, format: v => Math.round(v) },
    { el: ratioSlider, format: v => Number(v).toFixed(1) },
    { el: orbCountSlider, format: v => parseInt(v, 10) },
    { el: orbSpeedSlider, format: v => Number(v).toFixed(1) }
  ];
  sliders.forEach(item => {
    if (!item.el) return;
    attachSliderLabel(item.el, item.format);
  });
}

function attachSliderLabel(input, formatter) {
  const parent = input.parentElement;
  if (!parent) return;
  parent.classList.add("slider-field");
  input.classList.add("with-label");
  const label = document.createElement("span");
  label.className = "slider-label";
  parent.appendChild(label);
  const update = () => positionSliderLabel(input, label, formatter);
  input.addEventListener("input", update);
  update();
  sliderLabelMap.push({ input, label, formatter });
}

function positionSliderLabel(input, label, formatter) {
  const min = parseFloat(input.min || "0");
  const max = parseFloat(input.max || "100");
  const val = parseFloat(input.value || "0");
  const pct = (val - min) / (max - min || 1);
  const thumb = 28; // match CSS thumb size
  const x = pct * Math.max(0, input.offsetWidth - thumb) + thumb / 2;
  label.style.left = `${x}px`;
  label.textContent = formatter(val);
}

function mousePressed() {
  if (tutorialOverlayBlocking) return false;
  startAudioIfNeeded();
  combineMorphStart = millis();
  const toggleHit = getSequencerToggleHit(mouseX, mouseY);
  if (toggleHit) {
    toggles[toggleHit] = !toggles[toggleHit];
    return;
  }
  if (lineDrawMode) {
    drawingPoints = [createVector(mouseX, mouseY)];
    drawingActive = true;
    return;
  }
  for (let b of boids) {
    if (!toggles[b.type]) continue;
    if (dist(mouseX, mouseY, b.pos.x, b.pos.y) < b.size / 2 + 5) {
      b.toggle();
      break;
    }
  }
}

function mouseReleased() {
  if (lineDrawMode && drawingActive && drawingPoints.length > 1) {
    drawingPoints.push(createVector(mouseX, mouseY));
    addLinePathFromPoints(drawingPoints);
  }
  drawingPoints = [];
  drawingActive = false;
  if (lineDrawMode && addLineBtn) addLineBtn.classList.remove("active");
  lineDrawMode = false;
}

function stepBeat() {
  for (let b of boids) b.flash = false;
  lastSequencerStep = step;
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
      recordSequencerPulse(type, b.col);
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
      recordSequencerPulse("bass", b.col);
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
      recordSequencerPulse("piano", entry.boid.col);
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
    const effectiveBlend = joinAllMode ? 1 : blend;
    const perception = lerp(80, 160, effectiveBlend);
    const neighbors = this.computeNeighborhood(others, perception);

    const envForce = this.environmentalForces(neighbors.count);
    if (joinAllMode) {
      envForce.add(p5.Vector.sub(centerVec, this.pos).setMag(0.18)); // gentle pull to center while keeping boid flow
    }

    const cohStrength = lerp(this.baseCohesionStrength, this.baseCohesionStrength * 1.8, effectiveBlend);
    const sepStrength = lerp(this.baseSeparationStrength, this.baseSeparationStrength * 0.25, effectiveBlend);
    const closePushStrength = lerp(0.6, 1.2, effectiveBlend); // keep some personal space when joining

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
    { label: "X Segments", hist: ampHistoryX, color: color(255, 230, 50) },
    { label: "Y Segments", hist: ampHistoryY, color: color(255, 230, 50) },
    { label: "Boids", hist: ampHistoryBoid, color: complementary(color(lastBgColor.r, lastBgColor.g, lastBgColor.b)) }
  ];
  const w = 240;
  const h = 110;
  const pad = 10;
  const spacing = 12;
  const startX = 404;
  const startY = 24;

  panels.forEach((panel, idx) => {
    if (panel.hist.length < 2) return;
    const x0 = startX + idx * (w + spacing);
    const y0 = startY;
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
      let displacement = (amp - 0.2) * (innerH * 0.6);
      vertex(x, centerY - displacement);
    }
    endShape();

    // faint union overlay
    if (ampHistoryUnion.length > 1) {
      stroke(255, 128);
      beginShape();
      for (let i = 0; i < ampHistoryUnion.length; i++) {
        let x = map(i, 0, ampHistoryUnion.length - 1, 0, innerW);
        let amp = ampHistoryUnion[i];
        let displacement = (amp - 0.2) * (innerH * 0.6);
        vertex(x, centerY + displacement);
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

function resetSequencerPulses() {
  sequencerPulses = {
    piano: Array(noteFreqs.length).fill(-Infinity),
    bass: Array(noteFreqs.length).fill(-Infinity),
    hihat: Array(SIGNATURE_STEPS).fill(-Infinity),
    kick: Array(SIGNATURE_STEPS).fill(-Infinity)
  };
}

function recordSequencerPulse(type, col) {
  if (!sequencerPulses[type]) return;
  sequencerPulses[type][col] = millis();
}

function initSequencerUI() {
  sequencerPalette = {
    piano: [255, 214, 92],
    bass: [105, 220, 255],
    hihat: [255, 86, 214],
    kick: [88, 228, 255]
  };
  updateSequencerLayout();
}

function updateSequencerLayout() {
  const sideSafe = min(324, width * 0.26);
  const availableW = max(420, width - sideSafe * 2);
  const outerW = min(max(width * 0.322, 350), availableW * 0.7);
  const outerH = min(max(height * 0.189, 168), 217);
  const outerX = (width - outerW) / 2;
  const outerY = height - outerH - 24;
  const pad = min(22, outerW * 0.03);
  const rowGap = min(12, outerH * 0.05);
  const labelW = min(max(112, outerW * 0.22), 150);
  const labelGap = min(22, outerW * 0.03);
  const innerH = outerH - pad * 2;
  const rowH = (innerH - rowGap * 3) / 4;
  const stepLeft = outerX + pad + labelW + labelGap;
  const stepRight = outerX + outerW - pad;
  const stepW = stepRight - stepLeft;
  const topY = outerY + pad;
  const labelH = rowH * 0.78;
  const rows = ["piano", "bass", "hihat", "kick"].map((type, idx) => {
    const rowY = topY + idx * (rowH + rowGap);
    const cellW = stepW / SIGNATURE_STEPS;
    return {
      type,
      labelX: outerX + pad,
      labelY: rowY + (rowH - labelH) / 2,
      labelW,
      labelH,
      stepLeft,
      stepRight,
      centerY: rowY + rowH / 2,
      cellW,
      size: min(rowH * 0.82, cellW * 0.68)
    };
  });

  sequencerLayout = {
    outerX, outerY, outerW, outerH,
    rows: rows.reduce((acc, row) => {
      acc[row.type] = row;
      return acc;
    }, {}),
    toggles: rows.map(row => ({
      type: row.type,
      x: row.labelX,
      y: row.labelY,
      w: row.labelW,
      h: row.labelH
    }))
  };
}

function getSequencerPulse(type, col, now) {
  if (!sequencerPulses[type]) return 0;
  const elapsed = now - (sequencerPulses[type][col] || -Infinity);
  return constrain(1 - elapsed / SEQUENCER_PULSE_MS, 0, 1);
}

function instrumentLabel(type) {
  if (type === "kick") return "DRUM";
  if (type === "hihat") return "HIHAT";
  return type.toUpperCase();
}

function initTutorialOverlay() {
  tutorialOverlayEl = document.getElementById("tutorial-overlay");
  if (!tutorialOverlayEl) {
    tutorialOverlayBlocking = false;
    return;
  }

  dismissTutorialOverlayHandler = () => dismissTutorialOverlay();
  tutorialOverlayEl.addEventListener("click", dismissTutorialOverlayHandler);
  document.addEventListener("keydown", dismissTutorialOverlayHandler);
  requestAnimationFrame(() => {
    if (tutorialOverlayEl) tutorialOverlayEl.classList.add("is-visible");
  });
}

function dismissTutorialOverlay() {
  if (!tutorialOverlayEl || tutorialOverlayEl.classList.contains("is-dismissing")) return;
  startAudioIfNeeded();
  tutorialOverlayEl.classList.remove("is-visible");
  tutorialOverlayEl.classList.add("is-dismissing");
  tutorialOverlayEl.setAttribute("aria-hidden", "true");

  if (dismissTutorialOverlayHandler) {
    tutorialOverlayEl.removeEventListener("click", dismissTutorialOverlayHandler);
    document.removeEventListener("keydown", dismissTutorialOverlayHandler);
    dismissTutorialOverlayHandler = null;
  }

  window.setTimeout(() => {
    if (!tutorialOverlayEl) return;
    tutorialOverlayEl.style.display = "none";
    tutorialOverlayEl.style.pointerEvents = "none";
    tutorialOverlayBlocking = false;
  }, 300);
}

function getSequencerToggleHit(mx, my) {
  if (!sequencerLayout) return null;
  for (let box of sequencerLayout.toggles) {
    if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
      return box.type;
    }
  }
  return null;
}

function buildSequencerFrameState() {
  const state = {
    now: millis(),
    columns: {
      piano: Array(SIGNATURE_STEPS).fill(false),
      bass: Array(SIGNATURE_STEPS).fill(false),
      hihat: Array(SIGNATURE_STEPS).fill(false),
      kick: Array(SIGNATURE_STEPS).fill(false)
    }
  };

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.on) continue;
    const cols = state.columns[boid.type];
    if (cols && boid.col < cols.length) cols[boid.col] = true;
  }

  return state;
}

function getSequencerScanProgress() {
  const stepDuration = max(beatLength / 2, 1);
  const progressWithinStep = playing ? constrain(accum / stepDuration, 0, 0.999) : 0;
  return (lastSequencerStep + progressWithinStep) / SIGNATURE_STEPS;
}

function drawSequencerPanel() {
  if (!sequencerLayout || !sequencerFrameState) return;
  const layout = sequencerLayout;

  push();
  strokeJoin(MITER);
  stroke(255, 245);
  strokeWeight(2);
  fill(0, 0, 0, 242);
  rect(layout.outerX, layout.outerY, layout.outerW, layout.outerH);

  drawSequencerNoteRow("piano", "square");
  drawSequencerNoteRow("bass", "semi");
  drawSequencerStepRow("hihat", "triangle");
  drawSequencerStepRow("kick", "circle");
  pop();
}

function drawSequencerToggleBox(box) {
  push();
  strokeWeight(2);
  stroke(255);
  fill(0, 0, 0, 255);
  rect(box.x, box.y, box.w, box.h);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(min(18, box.h * 0.4));
  text(instrumentLabel(box.type), box.x + box.w / 2, box.y + box.h / 2);
  pop();
}

function drawSequencerNoteRow(type, shape) {
  const row = sequencerLayout.rows[type];
  drawSequencerToggleBox({
    type,
    x: row.labelX,
    y: row.labelY,
    w: row.labelW,
    h: row.labelH
  });
  const activeCols = sequencerFrameState.columns[type];
  const accent = sequencerPalette[type];
  const count = activeCols.length;
  const now = sequencerFrameState.now;

  for (let i = 0; i < count; i++) {
    const x = row.stepLeft + row.cellW * (i + 0.5);
    const pulse = getSequencerPulse(type, i, now);
    const isOn = activeCols[i];

    push();
    translate(x, row.centerY);
    stroke(255);
    strokeWeight(2);
    if (isOn) {
      fill(255);
      if (shape === "square") rectMode(CENTER);
    } else {
      noFill();
      if (shape === "square") rectMode(CENTER);
    }

    if (shape === "square") {
      rect(0, 0, row.size, row.size);
    } else {
      arc(0, 0, row.size * 1.35, row.size * 1.35, -HALF_PI, HALF_PI, PIE);
    }

    if (pulse > 0) {
      noStroke();
      fill(accent[0], accent[1], accent[2], 160 * pulse);
      if (shape === "square") {
        const pulseSize = row.size + row.size * 0.28 * pulse;
        rect(0, 0, pulseSize, pulseSize);
      } else {
        const pulseSize = row.size * 1.35 + row.size * 0.32 * pulse;
        arc(0, 0, pulseSize, pulseSize, -HALF_PI, HALF_PI, PIE);
      }
      stroke(255);
      strokeWeight(2);
      noFill();
      if (shape === "square") rect(0, 0, row.size, row.size);
      else arc(0, 0, row.size * 1.35, row.size * 1.35, -HALF_PI, HALF_PI, PIE);
    }
    pop();
  }
}

function drawSequencerStepRow(type, shape) {
  const row = sequencerLayout.rows[type];
  drawSequencerToggleBox({
    type,
    x: row.labelX,
    y: row.labelY,
    w: row.labelW,
    h: row.labelH
  });
  const activeCols = sequencerFrameState.columns[type];
  const accent = sequencerPalette[type];
  const count = activeCols.length;
  const now = sequencerFrameState.now;

  for (let i = 0; i < count; i++) {
    const x = row.stepLeft + row.cellW * (i + 0.5);
    const pulse = getSequencerPulse(type, i, now);
    const isOn = activeCols[i];
    const fillAlpha = isOn ? 255 : 0;

    push();
    translate(x, row.centerY);
    stroke(255);
    strokeWeight(2);
    fill(255, fillAlpha);

    if (shape === "triangle") {
      triangle(-row.size * 0.65, row.size * 0.55, 0, -row.size * 0.65, row.size * 0.65, row.size * 0.55);
    } else {
      ellipse(0, 0, row.size * 1.2);
    }

    if (pulse > 0) {
      noStroke();
      fill(accent[0], accent[1], accent[2], 160 * pulse);
      if (shape === "triangle") {
        const s = row.size * (1.05 + 0.22 * pulse);
        triangle(-s * 0.65, s * 0.55, 0, -s * 0.65, s * 0.65, s * 0.55);
      } else {
        ellipse(0, 0, row.size * 1.2 * (1.05 + 0.22 * pulse));
      }
      stroke(255);
      strokeWeight(2);
      fill(255, fillAlpha);
      if (shape === "triangle") {
        triangle(-row.size * 0.65, row.size * 0.55, 0, -row.size * 0.65, row.size * 0.65, row.size * 0.55);
      } else {
        ellipse(0, 0, row.size * 1.2);
      }
    }
    pop();
  }
}

function drawHarmonicLines(lineX, lineY) {
  const segH = height / LINE_SEGMENTS;
  const segW = width / LINE_SEGMENTS;
  const lineColor = color(255, 230, 50);
  push();
  strokeWeight(2);

  // vertical line
  stroke(lineColor);
  line(lineX, 0, lineX, height);
  strokeWeight(1);
  for (let i = 0; i <= LINE_SEGMENTS; i++) {
    const y = i * segH;
    line(lineX - 6, y, lineX + 6, y);
  }

  // horizontal line
  stroke(lineColor);
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
    envelope: { attack: 0.02, decay: 0.06, sustain: 0.35, release: 0.12 }
  }).connect(lineYBus));
  lineOscillatorsH = Array.from({ length: LINE_SEGMENTS }, () => new Tone.Synth({
    oscillator: { type: lineWaveform },
    envelope: { attack: 0.02, decay: 0.06, sustain: 0.35, release: 0.12 }
  }).connect(lineXBus));
}

function updateLineWaveforms() {
  for (let osc of lineOscillatorsV) if (osc) osc.oscillator.type = lineWaveform;
  for (let osc of lineOscillatorsH) if (osc) osc.oscillator.type = lineWaveform;
}

function checkVerticalTriggers(actors, lineX) {
  if (!toneStarted || !lineOscillatorsH.length) return;
  const segH = height / LINE_SEGMENTS;
  const occupancyBoid = Array(LINE_SEGMENTS).fill(0);
  const occupancyOrb = Array(LINE_SEGMENTS).fill(0);

  for (let b of actors) {
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
    if (b.kind === "orb") occupancyOrb[idx] += 1;
    else occupancyBoid[idx] += 1;
  }

  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const activeNow = (lineSoundBoidEnabled && occupancyBoid[i] > 0) || (lineSoundOrbEnabled && occupancyOrb[i] > 0);
    if (activeNow && !segmentActiveH[i]) {
      startSegmentSound("H", i); // vertical crossing drives horizontal response
      segmentActiveH[i] = true;
    } else if (!activeNow && segmentActiveH[i]) {
      stopSegmentSound("H", i);
      segmentActiveH[i] = false;
    }
  }
}

function checkHorizontalTriggers(actors, lineY) {
  if (!toneStarted || !lineOscillatorsV.length) return;
  const segW = width / LINE_SEGMENTS;
  const occupancyBoid = Array(LINE_SEGMENTS).fill(0);
  const occupancyOrb = Array(LINE_SEGMENTS).fill(0);

  for (let b of actors) {
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
    if (b.kind === "orb") occupancyOrb[idx] += 1;
    else occupancyBoid[idx] += 1;
  }

  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const activeNow = (lineSoundBoidEnabled && occupancyBoid[i] > 0) || (lineSoundOrbEnabled && occupancyOrb[i] > 0);
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
  if (!synth) return;
  const offset = idx - floor(LINE_SEGMENTS / 2);
  const freq = LINE_REF_FREQ * Math.pow(freqRatio, offset);
  synth.oscillator.type = lineWaveform;
  synth.triggerAttack(freq, undefined, 0.16);
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
    const playing = (lineSoundBoidEnabled || lineSoundOrbEnabled) ? segmentActiveV
      .map((on, idx) => on ? idx + 1 : null)
      .filter(v => v !== null) : [];
    infoPlayingVEl.textContent = playing.length ? playing.join(", ") : "None";
  }
  if (infoPlayingHEl) {
    const playing = (lineSoundBoidEnabled || lineSoundOrbEnabled) ? segmentActiveH
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

    stroke(102, 205, 255, 100);
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
  if (tutorialOverlayBlocking) return false;
  startAudioIfNeeded();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  centerVec.set(windowWidth / 2, windowHeight / 2);
  updateSequencerLayout();
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
