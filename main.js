/* OUDH & ROSE — Luxury Atelier Scroll & Audio Engine
   Canvas image-sequence scrubber with Lenis smooth momentum scrolling,
   procedural Web Audio atelier soundscape, and interactive chapter HUD. */

const canvas = document.getElementById("film");
const ctx = canvas.getContext("2d");
const track = document.getElementById("track");
const loader = document.getElementById("loader");
const loadbar = document.getElementById("loadbar");
const scrollCue = document.getElementById("scroll-cue");
const captions = [...document.querySelectorAll(".caption")];
const chapterDots = [...document.querySelectorAll(".hud-dot")];

const KEEP = 120;      // sliding decoded window
const AHEAD = 30;

const state = {
  blobs: [],
  bitmaps: new Map(),
  count: 0,
  pattern: "",
  current: -1,
  target: 0,
  smooth: 0,
  dir: 1,
  ready: false,
  decoding: new Set(),
  chapters: []
};

/* ── Web Audio Atelier Soundscape ──────────────────────── */

class AtelierAudio {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.masterGain = null;
    this.filter = null;
    this.drone1 = null;
    this.drone2 = null;
    this.noiseNode = null;
  }

  init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Warm Lowpass Filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.filter.connect(this.masterGain);

    // Warm Drone Oscillators (Assam wood / copper tone: C2 & G2)
    this.drone1 = this.ctx.createOscillator();
    this.drone1.type = "sine";
    this.drone1.frequency.setValueAtTime(65.41, this.ctx.currentTime); // C2

    this.drone2 = this.ctx.createOscillator();
    this.drone2.type = "triangle";
    this.drone2.frequency.setValueAtTime(98.00, this.ctx.currentTime); // G2

    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.45;
    this.drone1.connect(droneGain);
    this.drone2.connect(droneGain);
    droneGain.connect(this.filter);

    // Organic Fire / Air Crackle Buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.05;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.18;

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    this.drone1.start();
    this.drone2.start();
    this.noiseNode.start();
  }

  toggle() {
    if (!this.ctx) this.init();
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.playing = !this.playing;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    if (this.playing) {
      this.masterGain.gain.linearRampToValueAtTime(0.28, now + 1.2);
    } else {
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    }
    return this.playing;
  }

  modulateVelocity(velocity) {
    if (!this.playing || !this.filter || !this.ctx) return;
    const targetFreq = Math.min(320 + Math.abs(velocity) * 40, 850);
    this.filter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
  }
}

const soundscape = new AtelierAudio();

/* ── Frame Loader ──────────────────────────────────────── */

async function loadManifest() {
  const res = await fetch("frames/frames.json");
  if (!res.ok) throw new Error("no manifest");
  return res.json();
}

function frameURL(i) {
  return state.pattern.replace("%04d", String(i + 1).padStart(4, "0"));
}

async function fetchBlob(i) {
  if (state.blobs[i]) return state.blobs[i];
  const res = await fetch(frameURL(i));
  state.blobs[i] = await res.blob();
  return state.blobs[i];
}

async function decode(i) {
  if (state.bitmaps.has(i) || state.decoding.has(i) || !state.blobs[i]) return;
  state.decoding.add(i);
  try {
    const bmp = await createImageBitmap(state.blobs[i]);
    state.bitmaps.set(i, bmp);
  } catch { /* transient */ }
  state.decoding.delete(i);
}

function manageWindow(center) {
  for (let d = 0; d <= AHEAD; d++) {
    const fwd = center + d * state.dir;
    const back = center - Math.min(d, 8) * state.dir;
    if (fwd >= 0 && fwd < state.count) {
      if (state.blobs[fwd]) decode(fwd);
    }
    if (back >= 0 && back < state.count) {
      if (state.blobs[back]) decode(back);
    }
  }
  if (state.bitmaps.size > KEEP * 2) {
    for (const [idx, bmp] of state.bitmaps) {
      if (Math.abs(idx - center) > KEEP) {
        bmp.close();
        state.bitmaps.delete(idx);
      }
    }
  }
}

async function preload() {
  const { count } = state;
  const EAGER = Math.min(Math.ceil(count * 0.20), 80);

  let done = 0;
  await Promise.all(
    Array.from({ length: EAGER }, (_, i) =>
      fetchBlob(i).then(async () => {
        done++;
        if (loadbar) loadbar.style.width = `${(done / EAGER) * 100}%`;
        await decode(i);
      })
    )
  );
  await decode(0);
  state.ready = true;
  if (loader) loader.classList.add("done");
  drawFrame(0);

  let next = EAGER;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < count) {
        const i = next++;
        try { 
          await fetchBlob(i);
          if (i < 120) await decode(i);
        } catch { /* retry */ }
      }
    })
  );
}

/* ── Canvas Rendering ──────────────────────────────────── */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  state.current = -1;
  if (state.ready) {
    const idx = Math.max(0, Math.round(state.smooth));
    drawFrame(idx);
  }
}

function nearestDecoded(i) {
  if (state.bitmaps.has(i)) return i;
  for (let d = 1; d < state.count; d++) {
    if (state.bitmaps.has(i - d)) return i - d;
    if (state.bitmaps.has(i + d)) return i + d;
  }
  return -1;
}

function drawFrame(i) {
  const j = nearestDecoded(i);
  if (j < 0) return;
  const bmp = state.bitmaps.get(j);
  const cw = canvas.width, ch = canvas.height;
  
  const s = Math.max(cw / bmp.width, ch / bmp.height);
  const w = bmp.width * s, h = bmp.height * s;
  ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
  state.current = j;
}

/* ── Scroll & HUD Progress ─────────────────────────────── */

function progress() {
  const max = track.offsetHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function updateCaptionsAndHUD(p) {
  // Captions
  for (const el of captions) {
    const tIn = +el.dataset.in, tHold = +el.dataset.hold, tOut = +el.dataset.out;
    const rise = Math.max((tHold - tIn) * 0.45, 0.012);
    const fall = Math.max((tOut - tHold) * 0.55, 0.012);
    let o = 0;
    if (p >= tIn && p <= tOut) {
      o = Math.min((p - tIn) / rise, 1) * Math.min((tOut - p) / fall, 1);
      o = Math.min(Math.max(o, 0), 1);
    }
    el.style.opacity = o.toFixed(3);
    const drift = (p - tHold) * -32;
    el.style.transform = `${transformBase(el)} translateY(${drift.toFixed(1)}px)`;
    el.style.pointerEvents = o > 0.65 ? "auto" : "none";
  }

  // Scroll Cue
  if (scrollCue) {
    scrollCue.style.opacity = p < 0.025 ? "1" : "0";
  }

  // HUD Progress Bar
  const hudProgress = document.getElementById("hud-progress-bar");
  if (hudProgress) {
    hudProgress.style.height = `${Math.min(p * 100, 100)}%`;
  }

  // HUD Dots - Strict Single Active Dot Logic
  let activeFound = false;
  chapterDots.forEach((dot, idx) => {
    const targetFrac = +dot.dataset.target;
    const nextFrac = +dot.dataset.next || 1.0;
    const isLast = idx === chapterDots.length - 1;

    let isActive = false;
    if (isLast) {
      isActive = p >= targetFrac - 0.01;
    } else {
      isActive = p >= targetFrac - (idx === 0 ? 0.05 : 0.01) && p < nextFrac - 0.005;
    }

    if (isActive && !activeFound) {
      dot.classList.add("active");
      activeFound = true;
    } else {
      dot.classList.remove("active");
    }
  });

  const hud = document.getElementById("chapter-hud");
  if (hud) {
    const isFilm = window.scrollY < (track.offsetHeight - window.innerHeight * 0.5);
    hud.style.opacity = isFilm ? "1" : "0";
    hud.style.pointerEvents = isFilm ? "auto" : "none";
  }
}

function transformBase(el) {
  if (el.classList.contains("cap-center")) return "translate(-50%, -50%)";
  if (el.classList.contains("cap-top") || el.classList.contains("cap-bottom")) return "translateX(-50%)";
  return "translateY(-50%)";
}

/* ── Animation Tick ────────────────────────────────────── */

let lastT = performance.now();
let lastScrollY = window.scrollY;

function tick(now) {
  const dt = Math.min((now - lastT) / 1000, 0.5) || 0.016;
  lastT = now;

  const currentScrollY = window.scrollY;
  const velocity = (currentScrollY - lastScrollY) / dt;
  lastScrollY = currentScrollY;
  soundscape.modulateVelocity(velocity);

  if (state.ready) {
    const p = progress();
    const prevTarget = state.target;
    state.target = p * (state.count - 1);
    if (state.target !== prevTarget) state.dir = state.target >= prevTarget ? 1 : -1;
    
    // Inertial lerp convergence
    const k = 1 - Math.exp(-dt * 16);
    state.smooth += (state.target - state.smooth) * k;
    if (Math.abs(state.target - state.smooth) < 0.25) state.smooth = state.target;
    const i = Math.round(state.smooth);
    manageWindow(i);
    if (i !== state.current) drawFrame(i);
    updateCaptionsAndHUD(p);
  }
  requestAnimationFrame(tick);
}

/* ── Boot & Interactions ───────────────────────────────── */

window.addEventListener("resize", resize);
resize();

// Audio Toggle Button
const soundToggle = document.getElementById("audio-toggle");
if (soundToggle) {
  soundToggle.addEventListener("click", () => {
    const isPlaying = soundscape.toggle();
    soundToggle.classList.toggle("active", isPlaying);
    soundToggle.setAttribute("aria-pressed", isPlaying);
    const label = soundToggle.querySelector(".sound-label");
    if (label) label.textContent = isPlaying ? "Ambiance: ON" : "Ambiance: OFF";
  });
}

// Chapter HUD Clicks with Lenis smooth scroll
chapterDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const frac = +dot.dataset.target;
    const max = track.offsetHeight - window.innerHeight;
    const targetY = frac * max;
    if (window.lenis) {
      window.lenis.scrollTo(targetY, { duration: 1.2 });
    } else {
      window.scrollTo({ top: targetY, behavior: "smooth" });
    }
  });
});

loadManifest()
  .then((m) => {
    state.count = m.count;
    state.pattern = m.pattern;
    state.blobs = new Array(m.count).fill(null);
    state.chapters = m.chapters || [];
    requestAnimationFrame(tick);
    return preload();
  })
  .catch(() => {
    if (loader) loader.classList.add("done");
  });

