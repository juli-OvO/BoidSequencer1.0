// 🌈 Boid Orchestra v3 — Juli + GPT-5
// deltaTime physics + organic flocking + home zones + drift

let boids = [];
let particles = [];
let playing = false;
let step = 0;
let bpm = 120;
let beatLength;
let accum = 0;
let speedSlider;
let centerVec;

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
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.5 }
  }).connect(toneReverb);

  bassSynth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: "square" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    filterEnvelope: { attack: 0.30, decay: 0.2, sustain: 0.2, release: 0.6, baseFrequency: 100, octaves: 2 }
  }).connect(toneReverb);

  beatLength = 60000 / bpm;

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
// --- Adjust speed based on slider ---
let speedFactor = speedSlider ? parseFloat(speedSlider.value) : 1;
beatLength = 60000 / (bpm * speedFactor);

// scale boid motion
for (let b of boids) {
  b.maxSpeed = 1.5 * speedFactor;  // scales with tempo
}


  // update/draw boids
  for (let b of boids) {
    if (!toggles[b.type]) continue;
    b.flock(boids.filter(o => o.type === b.type));
    b.update();
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
  playInstrument("hihat", 8);
  playInstrument("piano", 7);
  playInstrument("kick", 8);
  if (step === 0) playBassChord();
  step = (step + 1) % 8;
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


// ---- CLASS: SoundBoid ----
class SoundBoid {
  constructor(x, y, type, col, baseColor, home) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.acc = createVector();
    this.type = type;
    this.col = col;
    this.size = 35;
    this.baseColor = baseColor;
    this.on = random() < 0.4;
    this.flash = false;

    // individual personality
    this.maxSpeed = random(0.9, 2.2);
    this.alignStrength = random(0.6, 1.0);
    this.cohesionStrength = random(0.3, 0.7);
    this.separationStrength = random(1.2, 1.8);
    this.disperseBias = random(0.015, 0.04);

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

  applyForce(f) { this.acc.add(f); }

  // === MOVEMENT FORCES ===
  // (look here if you want to tune movement behavior)
  flock(others) {
    let perception = 70;
    let total = 0;
    let align = createVector();
    let cohesion = createVector();
    let separation = createVector();

    for (let other of others) {
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      if (other != this && d < perception) {
        align.add(other.vel);
        cohesion.add(other.pos);
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.div(d * d);
        separation.add(diff);
        total++;
      }
    }

    if (total > 0) {
      align.div(total).setMag(this.maxSpeed);
      cohesion.div(total);
      cohesion.sub(this.pos).setMag(0.03);
      separation.div(total).setMag(0.7);
    }

    // -- Density attraction/repulsion --
    let density = total / 10.0;
    if (density < 0.3) {
      let toHome = p5.Vector.sub(this.home, this.pos).setMag(0.02);
      this.applyForce(toHome);
    } else if (density > 0.7) {
      this.applyForce(p5.Vector.random2D().mult(0.3));
    }

    // -- Noise drift (Perlin air currents) --
    let theta = noise(this.noiseSeed + millis() * 0.0003) * TWO_PI;
    let drift = p5.Vector.fromAngle(theta).mult(0.05);
    this.applyForce(drift);

    // -- Home attraction (looser)
    let homeForce = p5.Vector.sub(this.home, this.pos).setMag(0.05);
    this.applyForce(homeForce);

    // -- Dispersal push away from home center --
    let disperse = p5.Vector.sub(this.pos, this.home).setMag(this.disperseBias);
    this.applyForce(disperse);

    // -- Gentle push away from stage center to avoid crowding --
    let fromCenter = p5.Vector.sub(this.pos, centerVec).setMag(0.001);
    this.applyForce(fromCenter);

    // -- Apply main flock forces (smoothed) --
    let totalForce = p5.Vector.add(align.mult(this.alignStrength))
      .add(cohesion.mult(this.cohesionStrength))
      .add(separation.mult(this.separationStrength));
    this.acc.lerp(totalForce, 0.1);
  }

  display() {
    let c;
    if (!this.on) c = color(220);
    else if (this.flash) c = complementary(this.baseColor);
    else c = this.baseColor;

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
      let f = noteFreqs[this.col % 7] * map(speed, 0, 3, 0.9, 1.2);
      let dur = Math.max(beatSeconds * 0.5, 0.1);
      pianoSynth.triggerAttackRelease(f, dur, undefined, velocity);
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

// ---- HELPERS ----
function createInstrumentBoids(type, numCols, home) {
  for (let i = 0; i < numCols; i++) {
    boids.push(new SoundBoid(random(width), random(height), type, i, randomColor(), home));
  }
}

function randomColor() {
  return color(random(50, 255), random(50, 255), random(50, 255));
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
