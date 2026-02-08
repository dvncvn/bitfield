import { initRenderer, renderFrame, hexToABGR, type RendererState, type InitOptions } from './renderer';
import { savePNG, recordWebM } from './export';

export function setupUI(canvas: HTMLCanvasElement): void {
  const params = new URLSearchParams(window.location.search);
  let seed = parseInt(params.get('seed') ?? '0', 10) & 0xff;

  // DOM refs
  const prevBtn = document.getElementById('prevSeed')!;
  const nextBtn = document.getElementById('nextSeed')!;
  const playPauseBtn = document.getElementById('playPause')!;
  const regenBtn = document.getElementById('regenerate')!;
  const savePngBtn = document.getElementById('savePng')!;
  const recBtn = document.getElementById('recordWebm')!;
  const eventsToggle = document.getElementById('eventsToggle')!;
  const fgColorInput = document.getElementById('fgColor') as HTMLInputElement;
  const bgColorInput = document.getElementById('bgColor') as HTMLInputElement;
  const frameToggleBtn = document.getElementById('frameToggle')!;
  const frameTextEl = document.getElementById('frame-text')!;

  // Sliders
  const resSlider = document.getElementById('resolution') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  const subdivSlider = document.getElementById('subdivide') as HTMLInputElement;
  const densitySlider = document.getElementById('density') as HTMLInputElement;
  const noiseSlider = document.getElementById('noise') as HTMLInputElement;
  const warpSlider = document.getElementById('warp') as HTMLInputElement;
  const speedSlider = document.getElementById('speed') as HTMLInputElement;
  const periodSlider = document.getElementById('period') as HTMLInputElement;

  // Value displays
  const resVal = document.getElementById('resVal')!;
  const scaleVal = document.getElementById('scaleVal')!;
  const subdivVal = document.getElementById('subdivVal')!;
  const densityVal = document.getElementById('densityVal')!;
  const noiseVal = document.getElementById('noiseVal')!;
  const warpVal = document.getElementById('warpVal')!;
  const speedVal = document.getElementById('speedVal')!;
  const periodVal = document.getElementById('periodVal')!;

  // Apply URL params
  if (params.has('speed')) speedSlider.value = params.get('speed')!;
  if (params.has('grid')) resSlider.value = params.get('grid')!;
  if (params.has('scale')) scaleSlider.value = params.get('scale')!;
  if (params.has('subdiv')) subdivSlider.value = params.get('subdiv')!;
  if (params.has('density')) densitySlider.value = params.get('density')!;
  if (params.has('noise')) noiseSlider.value = params.get('noise')!;
  if (params.has('warp')) warpSlider.value = params.get('warp')!;
  if (params.has('period')) periodSlider.value = params.get('period')!;

  let state: RendererState;
  let recording = false;
  let rafId = 0;

  function getSliderVals() {
    return {
      res: parseInt(resSlider.value, 10),
      scale: parseFloat(scaleSlider.value),
      subdiv: parseInt(subdivSlider.value, 10),
      density: parseFloat(densitySlider.value),
      noise: parseFloat(noiseSlider.value),
      warp: parseFloat(warpSlider.value),
      speed: parseFloat(speedSlider.value),
      period: parseFloat(periodSlider.value),
    };
  }

  function updateValDisplays() {
    const v = getSliderVals();
    resVal.textContent = String(v.res);
    scaleVal.textContent = v.scale.toFixed(1);
    subdivVal.textContent = String(v.subdiv);
    densityVal.textContent = v.density.toFixed(2);
    noiseVal.textContent = v.noise.toFixed(2);
    warpVal.textContent = v.warp.toFixed(2);
    speedVal.textContent = v.speed.toFixed(1);
    periodVal.textContent = v.period.toFixed(1) + 's';
  }

  function updateURL() {
    const v = getSliderVals();
    const p = new URLSearchParams();
    p.set('seed', String(seed));
    p.set('speed', String(v.speed));
    p.set('grid', String(v.res));
    p.set('scale', String(v.scale));
    p.set('subdiv', String(v.subdiv));
    p.set('density', String(v.density));
    p.set('noise', String(v.noise));
    p.set('warp', String(v.warp));
    p.set('period', String(v.period));
    history.replaceState(null, '', '?' + p.toString());
  }

  function randomizeParams() {
    const r = () => Math.random();
    resSlider.value = String(32 + Math.floor(r() * 60) * 8);       // 32–512 step 8
    scaleSlider.value = (0.1 + r() * 5.9).toFixed(1);              // 0.1–6
    subdivSlider.value = String(1 + Math.floor(r() * 8));           // 1–8
    densitySlider.value = (r()).toFixed(2);                         // 0–1
    noiseSlider.value = (r()).toFixed(2);                           // 0–1
    warpSlider.value = (r() < 0.5 ? 0 : r()).toFixed(2);           // bias towards 0
    speedSlider.value = (0.3 + r() * 2.0).toFixed(1);              // 0.3–2.3
    periodSlider.value = (3 + r() * 17).toFixed(1);                // 3–20
    seed = Math.floor(Math.random() * 256);
    regenerate();
  }

  function applyLiveParams() {
    const v = getSliderVals();
    state.speed = v.speed;
    state.noiseAmount = v.noise;
    state.scale = v.scale;
    state.density = v.density;
    state.warp = v.warp;
    state.fgColor = hexToABGR(fgColorInput.value);
    state.bgColor = hexToABGR(bgColorInput.value);
  }

  function regenerate() {
    cancelAnimationFrame(rafId);
    const v = getSliderVals();
    const opts: InitOptions = {
      gridOverride: v.res,
      subdivOverride: v.subdiv,
      periodOverride: v.period * 1000,
    };
    state = initRenderer(canvas, seed, opts);
    applyLiveParams();
    if (frameMode) updateFrameLayout();
    updateValDisplays();
    updateURL();
    loop();
  }

  function loop() {
    renderFrame(state);
    rafId = requestAnimationFrame(loop);
  }

  function setSeed(s: number) {
    seed = ((s % 256) + 256) % 256;
    regenerate();
  }

  function togglePlay() {
    if (state.playing) {
      state.pauseOffset += (performance.now() - state.startTime) * state.speed;
      state.playing = false;
      playPauseBtn.textContent = '▶';
    } else {
      state.startTime = performance.now();
      state.playing = true;
      playPauseBtn.textContent = '❚❚';
    }
  }

  // === Button handlers ===
  prevBtn.addEventListener('click', () => setSeed(seed - 1));
  nextBtn.addEventListener('click', () => setSeed(seed + 1));
  playPauseBtn.addEventListener('click', togglePlay);
  regenBtn.addEventListener('click', regenerate);

  eventsToggle.addEventListener('click', () => {
    state.eventsEnabled = !state.eventsEnabled;
    eventsToggle.textContent = state.eventsEnabled ? 'ON' : 'OFF';
    eventsToggle.classList.toggle('active', state.eventsEnabled);
  });

  function applyColors() {
    state.fgColor = hexToABGR(fgColorInput.value);
    state.bgColor = hexToABGR(bgColorInput.value);
    if (frameMode) {
      document.body.style.backgroundColor = bgColorInput.value;
      // Set frame text to foreground color
      frameTextEl.style.color = fgColorInput.value;
    }
  }
  fgColorInput.addEventListener('input', applyColors);
  bgColorInput.addEventListener('input', applyColors);

  // === Frame mode ===
  let frameMode = false;

  function updateFrameLayout() {
    if (!frameMode) {
      document.body.classList.remove('framed');
      document.body.style.backgroundColor = '';
      frameTextEl.style.color = '';
      frameTextEl.style.display = '';  // back to CSS default (none)
      // Clear inline overrides — stylesheet rules take over
      canvas.style.top = '';
      canvas.style.right = '';
      canvas.style.left = '';
      canvas.style.width = '';
      canvas.style.height = '';
      return;
    }

    document.body.classList.add('framed');
    document.body.style.backgroundColor = bgColorInput.value;
    frameTextEl.style.color = fgColorInput.value;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = Math.min(vw, vh) * 0.06;
    const textW = vw * 0.26;
    const availW = vw - textW - pad * 2.5;
    const availH = vh - pad * 2;
    const aspect = state.gridW / state.gridH;

    let w: number, h: number;
    if (availW / availH > aspect) {
      h = availH;
      w = h * aspect;
    } else {
      w = availW;
      h = w / aspect;
    }

    const top = (vh - h) / 2;
    const right = pad;

    canvas.style.left = 'auto';
    canvas.style.right = right + 'px';
    canvas.style.top = top + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    // Position text in the left margin
    frameTextEl.style.left = pad + 'px';
    frameTextEl.style.top = top + 'px';
    frameTextEl.style.width = (textW - pad) + 'px';
  }

  function toggleFrame() {
    frameMode = !frameMode;
    frameToggleBtn.textContent = frameMode ? 'ON' : 'OFF';
    frameToggleBtn.classList.toggle('active', frameMode);
    updateFrameLayout();
  }
  frameToggleBtn.addEventListener('click', toggleFrame);

  // === Sliders that need full regeneration — debounced ===
  let regenTimer = 0;
  function debouncedRegen() {
    clearTimeout(regenTimer);
    regenTimer = window.setTimeout(regenerate, 150);
  }

  for (const slider of [resSlider, subdivSlider, periodSlider]) {
    slider.addEventListener('input', () => {
      updateValDisplays();
      debouncedRegen();
    });
  }

  // === Sliders that update live (no regen needed) ===
  for (const slider of [speedSlider, noiseSlider, scaleSlider, densitySlider, warpSlider]) {
    slider.addEventListener('input', () => {
      applyLiveParams();
      updateValDisplays();
    });
  }

  // === Export ===
  savePngBtn.addEventListener('click', () => savePNG(canvas, seed));

  recBtn.addEventListener('click', () => {
    if (recording) return;
    recording = true;
    recBtn.textContent = '⏹ REC…';
    recordWebM(canvas, state.config.periodMs, seed, undefined, () => {
      recording = false;
      recBtn.textContent = '⏺ REC';
    });
  });

  // === Keyboard shortcuts ===
  const uiEl = document.getElementById('ui')!;
  window.addEventListener('keydown', (e) => {
    // Cmd+. or Ctrl+. to toggle UI
    if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      uiEl.style.display = uiEl.style.display === 'none' ? '' : 'none';
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if ((e.target as HTMLElement).isContentEditable) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        setSeed(seed - 1);
        break;
      case 'ArrowRight':
        setSeed(seed + 1);
        break;
      case 's':
      case 'S':
        savePNG(canvas, seed);
        break;
      case 'f':
      case 'F':
        toggleFrame();
        break;
      case 'r':
      case 'R':
        randomizeParams();
        break;
    }
  });

  // === Mouse interaction ===
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseGX = ((e.clientX - r.left) / r.width) * state.gridW;
    state.mouseGY = ((e.clientY - r.top) / r.height) * state.gridH;
  });
  canvas.addEventListener('mouseleave', () => {
    state.mouseGX = -1;
    state.mouseGY = -1;
  });

  // === Resize ===
  window.addEventListener('resize', () => {
    const wasPlaying = state.playing;
    const offset = state.playing
      ? (performance.now() - state.startTime) * state.speed + state.pauseOffset
      : state.pauseOffset;
    cancelAnimationFrame(rafId);
    const v = getSliderVals();
    state = initRenderer(canvas, seed, {
      gridOverride: v.res,
      subdivOverride: v.subdiv,
      periodOverride: v.period * 1000,
    });
    applyLiveParams();
    state.pauseOffset = offset;
    state.playing = wasPlaying;
    if (!wasPlaying) playPauseBtn.textContent = '▶';
    if (frameMode) updateFrameLayout();
    loop();
  });

  // Boot
  regenerate();
}
