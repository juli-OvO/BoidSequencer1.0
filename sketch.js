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
let centerVec;
let masterMeter;
let ampHistory = [];
let lastBgColor = { r: 0, g: 0, b: 0 };
let pitchEnergy = 0;
const AMP_HISTORY_LEN = 240;
const SIGNATURE_STEPS = 8;
let pianoSchedule = [];
let currentPianoPlaying = [];
let currentKickPlaying = [];
let currentHihatPlaying = [];
let currentBassPlaying = [];
let overlayEnabled = true;
let linkEnabled = true;
let trackingEnabled = true;
let glowEnabled = true;
const LED_PIXEL_SIZE = 6;
let ledBuffer;
let mainCanvas;
let threeRenderer, threeScene, threeCamera, threeRootGroup;
let raycaster, pointer;
let orbitControls;
let ringPreviewCanvas, ringPreviewCtx, hoverReadoutEl, selectedLabelEl;
let ringState = [];
let selectedRingId = "kick";
let ringMeshes = new Map();

const PIXEL_PATTERNS = {
  piano: [
    "00111100",
    "01111110",
    "11111111",
    "11100111",
    "11111111",
    "11111111",
    "01111110",
    "00111100"
  ],
  kick: [
    "00011000",
    "00111100",
    "01111110",
    "01111110",
    "01111110",
    "01111110",
    "00111100",
    "00011000"
  ],
  bass: [
    "00011000",
    "00111100",
    "01111110",
    "11111111",
    "01111110",
    "00111100",
    "00100100",
    "00100100"
  ],
  hihat: [
    "00001000",
    "00011100",
    "00111110",
    "01111111",
    "11111111",
    "00111110",
    "00111110",
    "00111110"
  ],
  default: [
    "001100",
    "011110",
    "111111",
    "111111",
    "011110",
    "001100"
  ]
};

const PIANO_NOTE_NAMES = ["C", "D", "E", "F", "G", "A", "B"];
const BASS_NOTE_NAMES = ["C2", "D2", "E2", "F2", "G2", "A2", "B2"];
const RING_LAYOUT = [
  { id: "kick", label: "Kick", sections: 8, radius: 62, thickness: 12, rotateSpeed: 0.008, color: "#ffd9b3", noteNames: Array.from({ length: 8 }, (_, i) => `Kick ${i + 1}`) },
  { id: "hihat", label: "Hi-hat", sections: 8, radius: 92, thickness: 12, rotateSpeed: -0.007, color: "#c7f6d6", noteNames: Array.from({ length: 8 }, (_, i) => `Hat ${i + 1}`) },
  { id: "piano", label: "Piano", sections: 7, radius: 126, thickness: 14, rotateSpeed: 0.006, color: "#c7e3ff", noteNames: PIANO_NOTE_NAMES },
  { id: "bass", label: "Bass", sections: 7, radius: 156, thickness: 16, rotateSpeed: -0.004, color: "#f4cef9", noteNames: BASS_NOTE_NAMES }
];

let toneReverb;
let hihatSynth, kickSynth, pianoSynth, bassSynth;
let noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];

let toggles = { hihat: true, bass: true, piano: true, kick: true };
let toneStarted = false;

function setup() {
  mainCanvas = createCanvas(200, 200);
  mainCanvas.parent("p5-stub");
  mainCanvas.hide();
  pixelDensity(1);
  noSmooth();
  frameRate(30);
  noStroke();
  textFont("Courier New");
  speedSlider = document.getElementById("speed-slider");
  centerVec = createVector(width / 2, height / 2);
  setupToggles();

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

  initInstrumentButtons();
  initUIRefs();
  buildRingState();
  initThreeScene();
  initRingPreview();
  updateHoverReadout();
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

function initUIRefs() {
  ringPreviewCanvas = document.getElementById("ring-preview");
  ringPreviewCtx = ringPreviewCanvas ? ringPreviewCanvas.getContext("2d") : null;
  hoverReadoutEl = document.getElementById("hover-readout");
  selectedLabelEl = document.getElementById("selected-label");
}

function setupToggles() {
  const overlayBtn = document.getElementById("overlay-toggle");
  const lineBtn = document.getElementById("line-toggle");
  const trackingBtn = document.getElementById("tracking-toggle");
  const glowBtn = document.getElementById("glow-toggle");
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      overlayEnabled = !overlayEnabled;
      overlayBtn.classList.toggle("off", !overlayEnabled);
    });
  }
  if (lineBtn) {
    lineBtn.addEventListener("click", () => {
      linkEnabled = !linkEnabled;
      lineBtn.classList.toggle("off", !linkEnabled);
    });
  }
  if (trackingBtn) {
    trackingBtn.addEventListener("click", () => {
      trackingEnabled = !trackingEnabled;
      trackingBtn.classList.toggle("off", !trackingEnabled);
    });
  }
  if (glowBtn) {
    glowBtn.addEventListener("click", () => {
      glowEnabled = !glowEnabled;
      glowBtn.classList.toggle("off", !glowEnabled);
    });
  }
}

function buildRingState() {
  ringState = RING_LAYOUT.map(cfg => {
    const sections = [];
    for (let i = 0; i < cfg.sections; i++) {
      const boid = boids.find(b => b.type === cfg.id && b.col === i);
      sections.push({
        index: i,
        on: boid ? boid.on : true,
        note: cfg.noteNames[i % cfg.noteNames.length],
        boid
      });
    }
    return { ...cfg, sections };
  });
  updateSelectedLabel();
}

function updateSelectedLabel() {
  const ring = ringState.find(r => r.id === selectedRingId);
  if (selectedLabelEl && ring) {
    selectedLabelEl.textContent = ring.label;
  }
}

function getRingById(id) {
  return ringState.find(r => r.id === id);
}

function initThreeScene() {
  const container = document.getElementById("three-container");
  if (!container) return;

  threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
  container.innerHTML = "";
  container.appendChild(threeRenderer.domElement);

  threeScene = new THREE.Scene();
  threeScene.fog = new THREE.FogExp2(0x0e1016, 0.0025);

  const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
  threeCamera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1000);
  threeCamera.position.set(0, 0, 320);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(1.6, 1.2, 2.2);

  threeScene.add(ambient);
  threeScene.add(dir);

  threeRootGroup = new THREE.Group();
  threeScene.add(threeRootGroup);

  orbitControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.rotateSpeed = 0.6;
  orbitControls.zoomSpeed = 0.8;
  orbitControls.panSpeed = 0.7;
  orbitControls.screenSpacePanning = true;
  orbitControls.minDistance = 180;
  orbitControls.maxDistance = 520;
  orbitControls.target.set(0, 0, 0);

  buildAllRingMeshes();
  resizeThree();

  container.addEventListener("pointermove", handleThreePointerMove);
  container.addEventListener("click", handleThreeClick);

  animateThree();
}

function buildAllRingMeshes() {
  if (!threeRootGroup) return;
  threeRootGroup.clear();
  ringMeshes.clear();
  ringState.forEach(ring => {
    const { group, sectionMeshes } = createRingGroup(ring);
    group.rotation.z = random(TWO_PI);
    threeRootGroup.add(group);
    ringMeshes.set(ring.id, { group, sectionMeshes, rotateSpeed: ring.rotateSpeed || 0.003 });
  });
}

function createRingGroup(ring) {
  const group = new THREE.Group();
  const sectionMeshes = [];
  const inner = ring.radius;
  const outer = ring.radius + ring.thickness;
  const baseColor = new THREE.Color(ring.color);
  const segmentAngle = (Math.PI * 2) / ring.sections.length;
  const gap = segmentAngle * 0.12;

  ring.sections.forEach((section, i) => {
    const start = i * segmentAngle + gap * 0.5;
    const geom = new THREE.RingGeometry(inner, outer, 72, 1, start, segmentAngle - gap);
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor.clone(),
      emissive: baseColor.clone().multiplyScalar(0.4),
      transparent: true,
      opacity: section.on ? 0.86 : 0.35,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = 0.46;
    mesh.rotation.y = 0.18;
    mesh.userData = { ringId: ring.id, index: i, sectionRef: section, flash: 0 };
    applySectionMaterial(mesh, ring, section);
    sectionMeshes.push(mesh);
    group.add(mesh);
  });

  return { group, sectionMeshes };
}

function applySectionMaterial(mesh, ring, section) {
  if (!mesh || !section || !ring) return;
  const base = new THREE.Color(ring.color);
  const selected = ring.id === selectedRingId;
  const activeScale = section.on ? (selected ? 1.22 : 1.05) : 0.42;
  mesh.material.color = base.clone().multiplyScalar(activeScale);
  mesh.material.emissive = base.clone().multiplyScalar(section.on ? 0.52 : 0.08);
  mesh.material.opacity = section.on ? 0.88 : 0.32;
}

function handleThreePointerMove(evt) {
  pickThreeSection(evt, (ringId, index) => updateHoverReadout(ringId, index));
}

function handleThreeClick(evt) {
  startAudioIfNeeded();
  pickThreeSection(evt, (ringId) => {
    selectedRingId = ringId;
    updateSelectedLabel();
    updateRingMeshesFromState(ringId);
    renderRingPreview();
    updateHoverReadout();
  });
}

function pickThreeSection(evt, onPick) {
  if (!threeRenderer || !raycaster || !threeCamera) return;
  const rect = threeRenderer.domElement.getBoundingClientRect();
  pointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, threeCamera);
  const allMeshes = [];
  ringMeshes.forEach(({ sectionMeshes }) => allMeshes.push(...sectionMeshes));
  const hits = raycaster.intersectObjects(allMeshes, false);
  if (hits.length && onPick) {
    const { ringId, index } = hits[0].object.userData;
    onPick(ringId, index);
  } else if (onPick) {
    onPick(selectedRingId, -1);
  }
}

function animateThree() {
  requestAnimationFrame(animateThree);
  ringMeshes.forEach(({ group, sectionMeshes, rotateSpeed }) => {
    group.rotation.z += rotateSpeed;
    sectionMeshes.forEach(mesh => {
      if (mesh.userData.flash > 0) {
        mesh.userData.flash *= 0.88;
        mesh.material.emissiveIntensity = 0.65 + mesh.userData.flash * 1.1;
      } else {
        mesh.material.emissiveIntensity = 0.6;
      }
    });
  });

  if (orbitControls) orbitControls.update();

  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }
}

function resizeThree() {
  const container = document.getElementById("three-container");
  if (!container || !threeRenderer || !threeCamera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  threeRenderer.setSize(w, h, false);
  threeCamera.aspect = w / Math.max(h, 1);
  threeCamera.updateProjectionMatrix();
  if (orbitControls) orbitControls.update();
}

function updateRingMeshesFromState(ringId) {
  const ring = getRingById(ringId);
  const meshBundle = ringMeshes.get(ringId);
  if (!ring || !meshBundle) return;
  meshBundle.sectionMeshes.forEach((mesh, idx) => {
    mesh.userData.sectionRef = ring.sections[idx];
    applySectionMaterial(mesh, ring, ring.sections[idx]);
  });
}

function pulseSection(ringId, index) {
  const meshBundle = ringMeshes.get(ringId);
  if (!meshBundle) return;
  const mesh = meshBundle.sectionMeshes[index];
  if (mesh) {
    mesh.userData.flash = 1;
  }
}

function initRingPreview() {
  if (!ringPreviewCanvas || !ringPreviewCtx) return;
  const legend = document.getElementById("mini-legend");
  if (legend) {
    legend.textContent = "Click a 3D ring to select it. Click slices in the 2D ring to toggle notes on/off.";
  }
  ringPreviewCanvas.addEventListener("mousemove", handlePreviewHover);
  ringPreviewCanvas.addEventListener("mouseleave", () => updateHoverReadout());
  ringPreviewCanvas.addEventListener("click", handlePreviewClick);
  resizeRingPreview();
}

function handlePreviewHover(evt) {
  const idx = previewIndexFromEvent(evt);
  updateHoverReadout(selectedRingId, idx);
}

function handlePreviewClick(evt) {
  startAudioIfNeeded();
  const idx = previewIndexFromEvent(evt);
  if (idx >= 0) {
    toggleSection(selectedRingId, idx);
  }
}

function previewIndexFromEvent(evt) {
  const ring = getRingById(selectedRingId);
  if (!ring || !ringPreviewCanvas) return -1;
  const rect = ringPreviewCanvas.getBoundingClientRect();
  const scaleX = ringPreviewCanvas.width / rect.width;
  const scaleY = ringPreviewCanvas.height / rect.height;
  const px = (evt.clientX - rect.left) * scaleX;
  const py = (evt.clientY - rect.top) * scaleY;
  const cx = ringPreviewCanvas.width / 2;
  const cy = ringPreviewCanvas.height / 2;
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const ringRadius = Math.min(cx, cy) * 0.62;
  const inner = ringRadius * 0.55;
  if (dist < inner || dist > ringRadius * 1.07) return -1;
  let ang = Math.atan2(dy, dx) + Math.PI / 2;
  if (ang < 0) ang += Math.PI * 2;
  const segment = (Math.PI * 2) / ring.sections.length;
  return floor(ang / segment);
}

function toggleSection(ringId, index) {
  const ring = getRingById(ringId);
  if (!ring) return;
  const section = ring.sections[index];
  section.on = !section.on;
  if (section.boid) section.boid.on = section.on;
  updateRingMeshesFromState(ringId);
  renderRingPreview();
  updateHoverReadout(ringId, index);
}

function syncRingSectionFromBoid(type, col, onState) {
  const ring = getRingById(type);
  if (!ring) return;
  const section = ring.sections.find(s => s.index === col);
  if (section) {
    section.on = onState;
    renderRingPreview();
    updateRingMeshesFromState(type);
  }
}

function updateHoverReadout(ringId = selectedRingId, index = -1) {
  if (!hoverReadoutEl) return;
  const ring = getRingById(ringId);
  if (!ring) {
    hoverReadoutEl.textContent = "";
    return;
  }
  if (index < 0) {
    const active = ring.sections.filter(s => s.on).length;
    hoverReadoutEl.textContent = `${ring.label}: ${active}/${ring.sections.length} on`;
    return;
  }
  const section = ring.sections[index];
  hoverReadoutEl.textContent = `${ring.label} – ${section.note} · ${section.on ? "ON" : "off"} (step ${index + 1})`;
}

function renderRingPreview() {
  if (!ringPreviewCanvas || !ringPreviewCtx) return;
  const ring = getRingById(selectedRingId);
  if (!ring) return;
  const ctx = ringPreviewCtx;
  const w = ringPreviewCanvas.width;
  const h = ringPreviewCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.33;
  const thickness = Math.min(w, h) * 0.11;
  const segment = (Math.PI * 2) / ring.sections.length;
  const gap = segment * 0.12;

  ctx.save();
  ctx.translate(cx, cy);

  ring.sections.forEach((section, i) => {
    const start = i * segment + gap * 0.5 - Math.PI / 2;
    const end = start + segment - gap;
    ctx.beginPath();
    ctx.strokeStyle = section.on ? ring.color : "rgba(255,255,255,0.2)";
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.arc(0, 0, radius, start, end, false);
    ctx.stroke();

    const isCurrent = step % ring.sections.length === i;
    if (isCurrent) {
      const markerR = radius + thickness * 0.35;
      ctx.fillStyle = section.on ? ring.color : "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.arc(Math.cos((start + end) / 2) * markerR, Math.sin((start + end) / 2) * markerR, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.restore();
}

function resizeRingPreview() {
  if (!ringPreviewCanvas) return;
  const bounds = ringPreviewCanvas.getBoundingClientRect();
  const base = Math.max(Math.min(bounds.width, bounds.height), bounds.width);
  const size = Math.floor(base * (window.devicePixelRatio || 1));
  if (size > 0) {
    ringPreviewCanvas.width = size;
    ringPreviewCanvas.height = size;
  }
  renderRingPreview();
}
function draw() {
  // maintain audio timing and tempo adjustments
  const speedFactor = speedSlider ? parseFloat(speedSlider.value) : 1;
  beatLength = 60000 / (bpm * speedFactor);
  for (let b of boids) {
    b.maxSpeed = 1.5 * speedFactor;
  }

  accum += deltaTime;
  if (playing && accum > beatLength / 2) {
    accum = 0;
    stepBeat();
    renderRingPreview();
  }
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
      syncRingSectionFromBoid(b.type, b.col, b.on);
      break;
    }
  }
}

function stepBeat() {
  for (let b of boids) b.flash = false;
  currentPianoPlaying = [];
  currentKickPlaying = [];
  currentHihatPlaying = [];
  currentBassPlaying = [];
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
      if (type === "kick") currentKickPlaying.push(b);
      if (type === "hihat") currentHihatPlaying.push(b);
      if (type === "bass") currentBassPlaying.push(b);
      pulseSection(type, b.col);
    }
  }
}

function playBassChord() {
  if (!toggles.bass) return;
  let subset = boids.filter(b => b.type === "bass");
  for (let b of subset) {
    if (b.on) { // ✅ only active boids
      b.play();
      pulseSection("bass", b.col);
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
    registerPitch(entry.freq);
    if (entry.boid) {
      currentPianoPlaying.push(entry.boid);
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
    const c = getBoidColor(this);
    fill(c);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle + HALF_PI);
    drawBoidShape(this.type, this.size);
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
      registerPitch(8000);
    } else if (this.type === "kick") {
      let pitch = map(speed, 0, 3, 50, 80);
      let dur = Math.max(beatSeconds * 0.25, 0.05);
      kickSynth.triggerAttackRelease(pitch, dur, undefined, velocity);
      registerPitch(pitch * 10);
    } else if (this.type === "piano") {
      return; // handled globally in playPianoChord
    } else if (this.type === "bass") {
      let f = (noteFreqs[this.col % 7] / 2) * map(speed, 0, 3, 0.9, 1.1);
      let dur = Math.max(beatSeconds * 2, 0.3);
      bassSynth.triggerAttackRelease(f, dur, undefined, velocity);
      registerPitch(f);
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
    const size = 6;
    rect(this.pos.x - size / 2, this.pos.y - size / 2, size, size);
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
  const rowCount = 4;
  const rowSpacing = height * 0.12;
  const startY = height / 2 - rowSpacing * (rowCount - 1) / 2;
  for (let r = 0; r < rowCount; r++) {
    const alpha = map(r, 0, rowCount - 1, 60, 120);
    drawWaveRow(startY + r * rowSpacing, color(255, alpha));
  }
  pop();
}

function drawWaveRow(centerY, strokeCol) {
  stroke(strokeCol);
  const len = ampHistory.length;
  for (let i = 0; i < len - 1; i++) {
    const x1 = map(i, 0, len - 1, 0, width);
    const x2 = map(i + 1, 0, len - 1, 0, width);
    const amp1 = ampHistory[i];
    const amp2 = ampHistory[i + 1];
    const wobble1 = sin(frameCount * 0.015 + i * 0.12) * 8;
    const wobble2 = sin(frameCount * 0.015 + (i + 1) * 0.12) * 8;
    const displacement1 = (amp1 - 0.2) * 140;
    const displacement2 = (amp2 - 0.2) * 140;
    const y1 = centerY + displacement1 + wobble1;
    const y2 = centerY + displacement2 + wobble2;
    const avgAmp = (amp1 + amp2) * 0.5;
    const thickness = map(avgAmp, 0, 1, 1, 10) * (1 + pitchEnergy * 2);
    strokeWeight(thickness);
    line(x1, y1, x2, y2);
  }
}

function registerPitch(freq) {
  if (!isFinite(freq)) return;
  const normalized = constrain(map(freq, 40, 4000, 0, 1), 0, 1);
  pitchEnergy = max(normalized, pitchEnergy);
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

function getBoidColor(b) {
  if (b.type === "bass") {
    if (!b.on) return color(255);
    if (b.flash) return complementary(b.baseColor);
    return color(0);
  }
  if (!b.on) return color(220);
  if (b.flash) return complementary(b.baseColor);
  return b.baseColor;
}

function drawBoidShape(type, size) {
  const pattern = PIXEL_PATTERNS[type] || PIXEL_PATTERNS.default;
  drawPixelPattern(pattern, size);
}

function drawPixelPattern(pattern, size) {
  if (!pattern || !pattern.length) return;
  rectMode(CORNER);
  const rows = pattern.length;
  const cols = pattern[0].length;
  const cell = size / Math.max(rows, cols);
  const totalW = cols * cell;
  const totalH = rows * cell;
  const offsetX = -totalW / 2;
  const offsetY = -totalH / 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (pattern[y][x] === "1") {
        rect(offsetX + x * cell, offsetY + y * cell, cell, cell);
      }
    }
  }
}

function getBoidsByType(type) {
  return boids.filter(b => b.type === type).sort((a, b) => a.col - b.col);
}

function drawInstrumentOverlay() {
  push();
  noStroke();

  const hihatList = getBoidsByType("hihat");
  const kickList = getBoidsByType("kick");
  const pianoList = getBoidsByType("piano");
  const bassList = getBoidsByType("bass");

  const rowAlpha = 50;

  const columnWidth = width * 0.12;
  const leftX = columnWidth / 2;
  const rightX = width - columnWidth / 2;
  drawVerticalStrip(pianoList, leftX, 0, height, rowAlpha, columnWidth);
  drawVerticalStrip(bassList, rightX, 0, height, rowAlpha, columnWidth);

  const horizontalStart = columnWidth;
  const horizontalWidth = width - columnWidth * 2;
  const topY = 80;
  const bottomY = height - 80;
  drawHorizontalStrip(hihatList, topY, horizontalWidth, horizontalStart, rowAlpha);
  drawHorizontalStrip(kickList, bottomY, horizontalWidth, horizontalStart, rowAlpha);

  pop();
}

function drawHorizontalStrip(list, centerY, totalWidth, startX, alpha) {
  const count = list.length;
  if (!count) return;
  const cellW = totalWidth / count;
  for (let i = 0; i < count; i++) {
    const b = list[i];
    if (!b) continue;
    const x = startX + i * cellW + cellW / 2;
    const size = cellW * 0.9;
    const c = getBoidColor(b);
    fill(red(c), green(c), blue(c), alpha);
    push();
    translate(x, centerY);
    drawBoidShape(b.type, size);
    pop();
  }
}

function drawVerticalStrip(list, centerX, topY, bottomY, alpha, maxWidth) {
  const count = list.length;
  if (!count) return;
  const totalHeight = bottomY - topY;
  if (totalHeight <= 0) return;
  const cellH = totalHeight / count;
  for (let i = 0; i < count; i++) {
    const b = list[i];
    if (!b) continue;
    const y = topY + i * cellH + cellH / 2;
    const size = Math.min(cellH, maxWidth) * 0.95;
    const c = getBoidColor(b);
    fill(red(c), green(c), blue(c), alpha);
    push();
    translate(centerX, y);
    drawBoidShape(b.type, size);
    pop();
  }
}

function drawVectorLinkOverlay() {
  const pairs = [];
  const activeBoids = new Set();
  const addPairs = (groupA, groupB, strokeCol) => {
    if (!groupA.length || !groupB.length) return;
    for (let a of groupA) {
      for (let b of groupB) {
        pairs.push({ a, b, strokeCol });
        activeBoids.add(a);
        activeBoids.add(b);
      }
    }
  };

  addPairs(currentPianoPlaying, currentKickPlaying, color(255, 220, 200, 200));
  addPairs(currentHihatPlaying, currentKickPlaying, color(255, 200, 200, 180));
  addPairs(currentPianoPlaying, currentBassPlaying, color(190, 240, 255, 190));

  if (!pairs.length && !activeBoids.size) return;

  push();
  drawingContext.save();
  drawingContext.imageSmoothingEnabled = true;
  strokeCap(ROUND);
  strokeJoin(ROUND);
  rectMode(CENTER);
  textFont("Courier New");
  textSize(12);

  // lines first, then boxes/labels on top
  if (linkEnabled) pairs.forEach(drawLinkWithDistance);
  activeBoids.forEach(b => drawTrackingBox(b));

  drawingContext.restore();
  pop();
}

function drawLinkWithDistance(pair) {
  const { a, b, strokeCol } = pair;
  if (!a || !b) return;
  const dir = p5.Vector.sub(b.pos, a.pos);
  const baseDist = dir.mag();
  if (baseDist < 1) return;
  dir.normalize();

  const start = p5.Vector.add(a.pos, p5.Vector.mult(dir, boidBoxSize(a) / 2));
  const end = p5.Vector.sub(b.pos, p5.Vector.mult(dir, boidBoxSize(b) / 2));

  stroke(strokeCol);
  strokeWeight(2.5);
  line(start.x, start.y, end.x, end.y);

  const mid = p5.Vector.add(start, p5.Vector.mult(p5.Vector.sub(end, start), 0.5));
  drawDistanceLabel(mid, `${floor(baseDist)}`, strokeCol);
}

function drawTrackingBox(boid) {
  const size = boidBoxSize(boid);
  const accent = complementary(boid.baseColor);
  const label = instrumentLabel(boid.type);

  push();
  rectMode(CENTER);
  noFill();
  stroke(red(accent), green(accent), blue(accent), 240);
  strokeWeight(2.5);
  rect(boid.pos.x, boid.pos.y, size, size, 6);

  const labelX = boid.pos.x + size / 2 + 12;
  const labelY = boid.pos.y - size / 2 - 6;
  const padding = 4;
  const textW = textWidth(label);

  noStroke();
  fill(0, 180);
  rectMode(CORNER);
  rect(labelX - padding, labelY - 10, textW + padding * 2, 18, 3);
  fill(red(accent), green(accent), blue(accent), 230);
  textAlign(LEFT, CENTER);
  text(label, labelX, labelY - 1);

  pop();
}

function drawDistanceLabel(pos, textStr, col) {
  push();
  textSize(11);
  textAlign(CENTER, CENTER);
  const padding = 5;
  const txtW = textWidth(textStr);

  noStroke();
  fill(0, 180);
  rectMode(CENTER);
  rect(pos.x, pos.y, txtW + padding * 2, 16, 3);

  fill(red(col), green(col), blue(col), 230);
  text(textStr, pos.x, pos.y + 1);
  pop();
}

function instrumentLabel(type) {
  if (type === "hihat") return "Hi-hat";
  if (type === "kick") return "Kick";
  if (type === "piano") return "Piano";
  if (type === "bass") return "Bass";
  return type || "";
}

function boidBoxSize(boid) {
  return (boid?.size || 50) * 1.15;
}

function detectMixedClusters() {
  const active = boids.filter(b => toggles[b.type]);
  const perceptionRadius = 160;
  const minBoids = 5;
  const minTypes = 3;
  let candidates = [];

  for (let base of active) {
    let group = [];
    let typeSet = new Set();
    for (let other of active) {
      const d = dist(base.pos.x, base.pos.y, other.pos.x, other.pos.y);
      if (d < perceptionRadius) {
        group.push(other);
        typeSet.add(other.type);
      }
    }

    if (group.length >= minBoids && typeSet.size >= minTypes) {
      let cx = 0, cy = 0;
      for (let g of group) {
        cx += g.pos.x;
        cy += g.pos.y;
      }
      cx /= group.length;
      cy /= group.length;

      let maxD = 0;
      for (let g of group) {
        const d = dist(cx, cy, g.pos.x, g.pos.y);
        maxD = Math.max(maxD, d);
      }

      candidates.push({ x: cx, y: cy, radius: Math.max(maxD + 60, perceptionRadius * 0.7) });
    }
  }

  // merge overlapping candidates to avoid duplicate halos
  let merged = [];
  for (let c of candidates) {
    let mergedInto = false;
    for (let m of merged) {
      const d = dist(c.x, c.y, m.x, m.y);
      if (d < (c.radius + m.radius) * 0.5) {
        m.x = (m.x + c.x) / 2;
        m.y = (m.y + c.y) / 2;
        m.radius = Math.max(m.radius, c.radius);
        mergedInto = true;
        break;
      }
    }
    if (!mergedInto) merged.push({ ...c });
  }

  return merged;
}

function drawClusterHalos(clusters) {
  if (!clusters.length) return;
  push();
  drawingContext.save();
  drawingContext.globalCompositeOperation = "lighter";

  clusters.forEach(cluster => {
    const bgColor = getCanvasColorAt(cluster.x, cluster.y);
    const opposite = complementary(bgColor);
    const innerR = cluster.radius * 0.45;
    const outerR = cluster.radius;

    const glow = drawingContext.createRadialGradient(
      cluster.x, cluster.y, innerR * 0.3,
      cluster.x, cluster.y, outerR
    );
    glow.addColorStop(0, colorToRgba(opposite, 0.55));
    glow.addColorStop(0.6, colorToRgba(opposite, 0.28));
    glow.addColorStop(1, colorToRgba(opposite, 0));
    drawingContext.fillStyle = glow;
    drawingContext.beginPath();
    drawingContext.arc(cluster.x, cluster.y, outerR, 0, Math.PI * 2);
    drawingContext.fill();
  });

  drawingContext.restore();
  pop();
}

function complementary(c) {
  return color(255 - red(c), 255 - green(c), 255 - blue(c));
}

function colorToRgba(col, alpha) {
  return `rgba(${red(col)}, ${green(col)}, ${blue(col)}, ${alpha})`;
}

function getCanvasColorAt(x, y) {
  const px = constrain(floor(x), 0, width - 1);
  const py = constrain(floor(y), 0, height - 1);
  const sample = get(px, py);
  if (Array.isArray(sample) && sample.length >= 3) {
    return color(sample[0], sample[1], sample[2]);
  }
  return color(0);
}

function ensureLedBuffer() {
  const targetW = Math.max(1, Math.floor(width / LED_PIXEL_SIZE));
  const targetH = Math.max(1, Math.floor(height / LED_PIXEL_SIZE));
  if (ledBuffer && ledBuffer.width === targetW && ledBuffer.height === targetH) return;
  ledBuffer = createGraphics(targetW, targetH);
  ledBuffer.pixelDensity(1);
  ledBuffer.noSmooth();
  ledBuffer.drawingContext.imageSmoothingEnabled = false;
}

function renderLedScreen() {
  ensureLedBuffer();
  if (!ledBuffer || !mainCanvas) return;
  ledBuffer.clear();
  ledBuffer.drawingContext.imageSmoothingEnabled = false;
  ledBuffer.drawingContext.drawImage(
    mainCanvas.elt,
    0, 0, width, height,
    0, 0, ledBuffer.width, ledBuffer.height
  );
  clear();
  drawingContext.imageSmoothingEnabled = false;
  image(ledBuffer, 0, 0, width, height);
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
  resizeCanvas(200, 200);
  centerVec.set(width / 2, height / 2);
  resizeThree();
  resizeRingPreview();
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
