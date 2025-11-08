// 🌈 Boid Orchestra v3 — Juli + GPT-5
// deltaTime physics + organic flocking + home zones + drift

let boids = [];
let particles = [];
let playing = false;
let step = 0;
let bpm = 120;
let beatLength;
let accum = 0;

let hihatNoise, kickOsc;
let pianoOscs = [];
let bassOscs = [];
let noteFreqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];

let toggles = { hihat: true, bass: true, piano: true, kick: true };
let audioStarted = false;

function setup() {
  createCanvas(800, 600);
  frameRate(30);
  noStroke();
createP("Tempo & Motion Speed");
speedSlider = createSlider(0.5, 2.0, 1.0, 0.01);
speedSlider.position(600, height + 20);
// --- Global Reverb ---
reverb = new p5.Reverb();
reverb.set(3, 2); // (reverbTime, decayRate) → try (2–5, 1–3)

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

  // sounds
  hihatNoise = new p5.Noise('white');
  hihatNoise.amp(0);
  
  hihatNoise.start();

  kickOsc = new p5.Oscillator('sine');
  kickOsc.amp(0);
  kickOsc.start();

  for (let i = 0; i < 7; i++) {
    pianoOscs[i] = new p5.Oscillator('triangle');
    pianoOscs[i].amp(0);
    
    pianoOscs[i].start();
    bassOscs[i] = new p5.Oscillator('pulse');
    bassOscs[i].amp(0);
    bassOscs[i].start();
  }

  beatLength = 60000 / bpm;
hihatNoise.disconnect();
kickOsc.disconnect();
for (let i = 0; i < 7; i++) {
  pianoOscs[i].disconnect();
  bassOscs[i].disconnect();
  
}
hihatNoise.connect(reverb);
kickOsc.connect(reverb);
for (let i = 0; i < 7; i++) {
  pianoOscs[i].connect(reverb);
  bassOscs[i].connect(reverb);
}

  // instrument switches
  createToggleButton("Hi-hat", "hihat", 100);
  createToggleButton("Bass", "bass", 220);
  createToggleButton("Piano", "piano", 340);
  createToggleButton("Kick", "kick", 460);
}

function createToggleButton(label, type, x) {
  let btn = createButton(label);
  btn.position(x, height + 20);
  btn.mousePressed(() => toggles[type] = !toggles[type]);
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
let speedFactor = speedSlider.value();
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
    this.maxSpeed = random(0.8, 2);
    this.alignStrength = random(0.8, 1.2);
    this.cohesionStrength = random(0.5, 1.0);
    this.separationStrength = random(0.8, 1.5);

    this.home = home.copy();
    this.noiseSeed = random(1000);
  }

  update() {
    // --- deltaTime normalization ---
    let dt = deltaTime / (1000 / 60);

    this.vel.add(p5.Vector.mult(this.acc, dt));
    this.vel.limit(this.maxSpeed);
    this.pos.add(p5.Vector.mult(this.vel, dt));
    this.acc.mult(0);

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
    let perception = 60;
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
      cohesion.sub(this.pos).setMag(0.05);
      separation.div(total).setMag(0.5);
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

    // -- Home attraction --
    let homeForce = p5.Vector.sub(this.home, this.pos).setMag(0.08);
    this.applyForce(homeForce);

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
    if (this.type === "piano") rectMode(CENTER), rect(0, 0, this.size, this.size);
    else if (this.type === "kick") ellipse(0, 0, this.size);
    else if (this.type === "bass") arc(0, 0, this.size * 1.3, this.size * 1.3, 0, PI, CHORD);
    else if (this.type === "hihat") triangle(-this.size / 2, this.size / 2, 0, -this.size / 2, this.size / 2, this.size / 2);
    pop();
  }

  toggle() { this.on = !this.on; }

  play() {
    if (!this.on) return;
    let speed = this.vel.mag();

    if (this.type === "hihat") {
      hihatNoise.amp(map(speed, 0, 3, 0.05, 0.25), 0.01);
      setTimeout(() => hihatNoise.amp(0, 0.05), 30);
    } else if (this.type === "kick") {
      let pitch = map(speed, 0, 3, 50, 80);
      kickOsc.freq(pitch);
      kickOsc.amp(0.5, 0.01);
      setTimeout(() => {
        kickOsc.freq(30, 0.2);
        kickOsc.amp(0, 0.3);
      }, 10);
    } else if (this.type === "piano") {
      let f = noteFreqs[this.col % 7] * map(speed, 0, 3, 0.9, 1.2);
      let osc = pianoOscs[this.col % 7];
      osc.freq(f);
      osc.amp(map(speed, 0, 3, 0.2, 0.4), 0.02);
      setTimeout(() => osc.amp(0, 0.2), beatLength * 0.5);
    } else if (this.type === "bass") {
      let f = (noteFreqs[this.col % 7] / 2) * map(speed, 0, 3, 0.9, 1.1);
      let osc = bassOscs[this.col % 7];
      osc.freq(f);
      osc.amp(map(speed, 0, 3, 0.2, 0.4), 0.05);
      setTimeout(() => osc.amp(0, 0.4), beatLength * 2);
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
  if (audioStarted) return;
  const audioContext = getAudioContext();
  if (audioContext.state !== "running") {
    userStartAudio();
  }
  audioStarted = audioContext.state === "running";
}

function touchStarted() {
  startAudioIfNeeded();
}
