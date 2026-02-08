import { initRenderer, renderFrame, hexToABGR, generateRevealMap, type RendererState, type InitOptions } from './renderer';
import { savePNG, recordWebM } from './export';
import { generateText, glitchText } from './gentext';

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
  const frameControlsEl = document.getElementById('frameControls')!;
  const frameBgInput = document.getElementById('frameBg') as HTMLInputElement;
  const frameBgLinkBtn = document.getElementById('frameBgLink')!;
  const frameRatioSelect = document.getElementById('frameRatio') as HTMLSelectElement;
  const frameShapeSelect = document.getElementById('frameShape') as HTMLSelectElement;
  const frameLayoutSelect = document.getElementById('frameLayout') as HTMLSelectElement;
  const textToggleBtn = document.getElementById('textToggle')!;
  const textControlsEl = document.getElementById('textControls')!;
  const genTextToggleBtn = document.getElementById('genTextToggle')!;
  const textColorInput = document.getElementById('textColor') as HTMLInputElement;
  const textSizeSlider = document.getElementById('textSize') as HTMLInputElement;
  const textSizeVal = document.getElementById('textSizeVal')!;
  const textPositionSelect = document.getElementById('textPosition') as HTMLSelectElement;
  const lensToggle = document.getElementById('lensToggle')!;
  const lensSizeSlider = document.getElementById('lensSize') as HTMLInputElement;
  const lensForceSlider = document.getElementById('lensForce') as HTMLInputElement;
  const lensSizeVal = document.getElementById('lensSizeVal')!;
  const lensForceVal = document.getElementById('lensForceVal')!;

  // Sliders
  const resSlider = document.getElementById('resolution') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  const subdivSlider = document.getElementById('subdivide') as HTMLInputElement;
  const densitySlider = document.getElementById('density') as HTMLInputElement;
  const noiseSlider = document.getElementById('noise') as HTMLInputElement;
  const warpSlider = document.getElementById('warp') as HTMLInputElement;
  const speedSlider = document.getElementById('speed') as HTMLInputElement;
  const periodSlider = document.getElementById('period') as HTMLInputElement;
  const bpmToggleBtn = document.getElementById('bpmToggle')!;
  const bpmControlsEl = document.getElementById('bpmControls')!;
  const tapTempoBtn = document.getElementById('tapTempo')!;
  const bpmValEl = document.getElementById('bpmVal')!;
  const bpmBarsSelect = document.getElementById('bpmBars') as HTMLSelectElement;

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

  const metaRingText = document.getElementById('meta-ring-text')!;
  const metaRingEl = document.getElementById('meta-ring')!;

  function updateMetaRing() {
    metaRingEl.style.setProperty('--meta-ring-color', textColorInput.value);
    const v = getSliderVals();
    let bpmStr = '---';
    try { if (bpmMode) bpmStr = String(Math.round(bpm)); } catch(_) {}
    metaRingText.textContent =
      `SEED ${String(seed).padStart(3, '0')} \u2022 ` +
      `RES ${v.res} \u2022 ` +
      `SCALE ${v.scale.toFixed(1)} \u2022 ` +
      `SUB ${v.subdiv} \u2022 ` +
      `BPM ${bpmStr} \u2022 ` +
      `SPEED ${v.speed.toFixed(1)} \u2022 `;
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
    updateMetaRing();
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
    resSlider.value = String(64 + Math.floor(r() * 24) * 8);       // 64–256 step 8
    scaleSlider.value = (0.1 + r() * 5.9).toFixed(1);              // 0.1–6
    subdivSlider.value = String(1 + Math.floor(r() * 8));           // 1–8
    densitySlider.value = (r()).toFixed(2);                         // 0–1
    noiseSlider.value = (r()).toFixed(2);                           // 0–1
    warpSlider.value = (r() < 0.5 ? 0 : r()).toFixed(2);           // bias towards 0
    speedSlider.value = (0.3 + r() * 2.0).toFixed(1);              // 0.3–2.3
    periodSlider.value = (3 + r() * 17).toFixed(1);                // 3–20
    seed = Math.floor(Math.random() * 256);
    regenerate();
    applyGenText();
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
    applyGenText();
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

  // === Auto-advance ===
  const autoBtn = document.getElementById('autoAdvance')!;
  const autoControlsEl = document.getElementById('autoControls')!;
  const autoIntervalSlider = document.getElementById('autoInterval') as HTMLInputElement;
  const autoVarianceSlider = document.getElementById('autoVariance') as HTMLInputElement;
  const autoIntervalVal = document.getElementById('autoIntervalVal')!;
  const autoVarianceVal = document.getElementById('autoVarianceVal')!;
  let autoMode = true;
  let autoTimer = 0;

  function scheduleAutoAdvance() {
    if (!autoMode) return;
    const base = parseFloat(autoIntervalSlider.value);
    const variance = parseFloat(autoVarianceSlider.value);
    // Random interval: base ± (base * variance)
    const jitter = base * variance * (Math.random() * 2 - 1);
    const delay = Math.max(2, base + jitter) * 1000;
    autoTimer = window.setTimeout(() => {
      // Randomly go forward or back
      setSeed(seed + (Math.random() < 0.8 ? 1 : -1));
      scheduleAutoAdvance();
    }, delay);
  }

  function toggleAuto() {
    autoMode = !autoMode;
    autoBtn.textContent = autoMode ? 'AUTO ●' : 'AUTO';
    autoBtn.classList.toggle('active', autoMode);
    autoControlsEl.style.display = autoMode ? '' : 'none';
    if (autoMode) {
      scheduleAutoAdvance();
    } else {
      clearTimeout(autoTimer);
    }
  }

  autoBtn.addEventListener('click', toggleAuto);
  autoIntervalSlider.addEventListener('input', () => {
    autoIntervalVal.textContent = autoIntervalSlider.value + 's';
    if (autoMode) { clearTimeout(autoTimer); scheduleAutoAdvance(); }
  });
  autoVarianceSlider.addEventListener('input', () => {
    autoVarianceVal.textContent = parseFloat(autoVarianceSlider.value).toFixed(2);
  });

  eventsToggle.addEventListener('click', () => {
    state.eventsEnabled = !state.eventsEnabled;
    eventsToggle.textContent = state.eventsEnabled ? 'ON' : 'OFF';
    eventsToggle.classList.toggle('active', state.eventsEnabled);
  });

  lensToggle.addEventListener('click', () => {
    state.mouseEnabled = !state.mouseEnabled;
    lensToggle.textContent = state.mouseEnabled ? 'ON' : 'OFF';
    lensToggle.classList.toggle('active', state.mouseEnabled);
  });

  function applyLensParams() {
    state.mouseRadius = parseFloat(lensSizeSlider.value);
    state.mouseStrength = parseFloat(lensForceSlider.value);
    lensSizeVal.textContent = lensSizeSlider.value;
    lensForceVal.textContent = lensForceSlider.value;
  }
  lensSizeSlider.addEventListener('input', applyLensParams);
  lensForceSlider.addEventListener('input', applyLensParams);

  function applyColors() {
    state.fgColor = hexToABGR(fgColorInput.value);
    state.bgColor = hexToABGR(bgColorInput.value);
    if (frameBgLinked && frameMode) {
      frameBgInput.value = bgColorInput.value;
      document.body.style.backgroundColor = frameBgInput.value;
    }
  }
  fgColorInput.addEventListener('input', applyColors);
  bgColorInput.addEventListener('input', applyColors);

  // === Text overlay (works in both fullscreen and frame mode) ===
  let textMode = true;
  let genTextMode = true;
  const frameTitleEl = document.getElementById('frame-title')!;

  function updateTextOverlay() {
    const textVisible = textMode;
    frameTextEl.style.display = textVisible ? 'flex' : 'none';
    textControlsEl.style.display = textVisible ? '' : 'none';


    // Reset positioning
    frameTextEl.style.left = '';
    frameTextEl.style.right = '';
    frameTextEl.style.top = '';
    frameTextEl.style.bottom = '';
    frameTextEl.style.width = '';
    frameTextEl.style.height = '';
    frameTextEl.style.maxWidth = '';
    frameTextEl.style.textAlign = '';
    frameTextEl.style.alignItems = '';
    frameTextEl.style.justifyContent = '';
    frameTextEl.style.paddingLeft = '';

    if (!textVisible) return;

    // Text color & size
    frameTextEl.style.color = textColorInput.value;
    const scale = parseFloat(textSizeSlider.value);
    frameTextEl.style.setProperty('--frame-title-size', (22 * scale) + 'px');

    const pos = textPositionSelect.value;
    const pad = 24;

    if (frameMode) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const canvasRect = canvas.getBoundingClientRect();
      const canvasLeft = canvasRect.left;
      const canvasRight = vw - canvasRect.right;
      const canvasTop = canvasRect.top;
      const canvasBottom = canvasRect.bottom;
      const centered = frameLayoutSelect.value === 'center';

      if (centered) {
        // Center layout: overlay text on top of the canvas
        frameTextEl.style.left = canvasLeft + 'px';
        frameTextEl.style.top = canvasTop + 'px';
        frameTextEl.style.width = canvasRect.width + 'px';
        frameTextEl.style.height = canvasRect.height + 'px';
        frameTextEl.style.textAlign = 'center';
        frameTextEl.style.alignItems = 'center';
        frameTextEl.style.justifyContent = 'center';
      } else {
        // Side layout: position text beside the canvas
        const sideW = Math.max(canvasLeft, canvasRight) - pad * 2;

        switch (pos) {
          case 'tl':
            frameTextEl.style.left = pad + 'px';
            frameTextEl.style.top = canvasTop + 'px';
            frameTextEl.style.width = sideW + 'px';
            break;
          case 'bl':
            frameTextEl.style.left = pad + 'px';
            frameTextEl.style.bottom = (vh - canvasBottom) + 'px';
            frameTextEl.style.width = sideW + 'px';
            break;
          case 'tr':
            frameTextEl.style.right = pad + 'px';
            frameTextEl.style.top = canvasTop + 'px';
            frameTextEl.style.width = sideW + 'px';
            canvas.style.right = '';
            canvas.style.left = (Math.min(vw, window.innerHeight) * 0.06) + 'px';
            break;
          case 'br':
            frameTextEl.style.right = pad + 'px';
            frameTextEl.style.bottom = (vh - canvasBottom) + 'px';
            frameTextEl.style.width = sideW + 'px';
            canvas.style.right = '';
            canvas.style.left = (Math.min(vw, window.innerHeight) * 0.06) + 'px';
            break;
          case 'cl':
            frameTextEl.style.left = canvasLeft + 'px';
            frameTextEl.style.top = canvasTop + 'px';
            frameTextEl.style.width = (canvasRect.width) + 'px';
            frameTextEl.style.height = (canvasRect.height) + 'px';
            frameTextEl.style.justifyContent = 'center';
            break;
          case 'cc':
            frameTextEl.style.left = canvasLeft + 'px';
            frameTextEl.style.top = canvasTop + 'px';
            frameTextEl.style.width = (canvasRect.width) + 'px';
            frameTextEl.style.height = (canvasRect.height) + 'px';
            frameTextEl.style.textAlign = 'center';
            frameTextEl.style.alignItems = 'center';
            frameTextEl.style.justifyContent = 'center';
            break;
        }
      }
    } else {
      // Fullscreen mode: overlay text on the canvas
      frameTextEl.style.width = 'auto';
      frameTextEl.style.maxWidth = '40vw';
      switch (pos) {
        case 'tl':
          frameTextEl.style.left = pad + 'px';
          frameTextEl.style.top = pad + 'px';
          break;
        case 'bl':
          frameTextEl.style.left = pad + 'px';
          frameTextEl.style.bottom = pad + 'px';
          break;
        case 'tr':
          frameTextEl.style.right = pad + 'px';
          frameTextEl.style.top = pad + 'px';
          break;
        case 'br':
          frameTextEl.style.right = pad + 'px';
          frameTextEl.style.bottom = pad + 'px';
          break;
        case 'cl':
          frameTextEl.style.left = '0';
          frameTextEl.style.top = '0';
          frameTextEl.style.width = '100vw';
          frameTextEl.style.height = '100vh';
          frameTextEl.style.maxWidth = '';
          frameTextEl.style.justifyContent = 'center';
          frameTextEl.style.paddingLeft = '24px';
          break;
        case 'cc':
          frameTextEl.style.left = '0';
          frameTextEl.style.top = '0';
          frameTextEl.style.width = '100vw';
          frameTextEl.style.height = '100vh';
          frameTextEl.style.maxWidth = '';
          frameTextEl.style.textAlign = 'center';
          frameTextEl.style.alignItems = 'center';
          frameTextEl.style.justifyContent = 'center';
          break;
      }
    }
  }

  // === Frame mode ===
  let frameMode = false;

  function updateFrameLayout() {
    if (!frameMode) {
      document.body.classList.remove('framed');
      document.body.style.backgroundColor = '';
      frameControlsEl.style.display = 'none';
      canvas.style.top = '0';
      canvas.style.right = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.borderRadius = '0';
      canvas.style.overflow = '';
      updateTextOverlay();
      return;
    }

    document.body.classList.add('framed');
    document.body.style.backgroundColor = frameBgInput.value;
    frameControlsEl.style.display = '';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = Math.min(vw, vh) * 0.06;
    const layout = frameLayoutSelect.value;
    const centered = layout === 'center';

    let availW: number, availH: number;
    if (centered) {
      availW = vw - pad * 2;
      availH = vh - pad * 2;
    } else {
      const textW = vw * 0.26;
      availW = vw - textW - pad * 2.5;
      availH = vh - pad * 2;
    }

    // Aspect ratio
    const ratioStr = frameRatioSelect.value;
    let aspect: number;
    if (ratioStr === 'free') {
      aspect = state.gridW / state.gridH;
    } else {
      const [rw, rh] = ratioStr.split(':').map(Number);
      aspect = rw / rh;
    }

    let w: number, h: number;
    if (availW / availH > aspect) {
      h = availH;
      w = h * aspect;
    } else {
      w = availW;
      h = w / aspect;
    }

    const top = (vh - h) / 2;
    let left: number;
    if (centered) {
      left = (vw - w) / 2;
    } else {
      const right = pad;
      left = vw - right - w;
    }

    canvas.style.left = left + 'px';
    canvas.style.right = 'auto';
    canvas.style.top = top + 'px';
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.overflow = 'hidden';

    // Shape
    const shape = frameShapeSelect.value;
    switch (shape) {
      case 'rect':
        canvas.style.borderRadius = '0';
        break;
      case 'rounded': {
        const r = Math.min(w, h) * 0.06;
        canvas.style.borderRadius = r + 'px';
        break;
      }
      case 'circle':
        canvas.style.borderRadius = '50%';
        break;
      case 'arch': {
        const ar = w * 0.5;
        canvas.style.borderRadius = `${ar}px ${ar}px 0 0`;
        break;
      }
    }

    updateTextOverlay();
    // Re-position text after canvas transition finishes
    setTimeout(() => updateTextOverlay(), 450);
  }

  // Frame presets: cycle through layout + ratio + shape combos with F key
  const framePresets: { layout: string; ratio: string; shape: string }[] = [];
  {
    const layouts = Array.from(frameLayoutSelect.options).map(o => o.value);
    const ratios = Array.from(frameRatioSelect.options).map(o => o.value);
    const shapes = Array.from(frameShapeSelect.options).map(o => o.value);
    for (const layout of layouts) {
      for (const ratio of ratios) {
        for (const shape of shapes) {
          framePresets.push({ layout, ratio, shape });
        }
      }
    }
  }
  let framePresetIdx = -1; // -1 = not in frame mode

  function toggleFrame() {
    frameMode = !frameMode;
    frameToggleBtn.textContent = frameMode ? 'ON' : 'OFF';
    frameToggleBtn.classList.toggle('active', frameMode);
    if (frameMode) {
      frameBgInput.value = bgColorInput.value;
      if (framePresetIdx < 0) framePresetIdx = 0;
    } else {
      framePresetIdx = -1;
    }
    updateFrameLayout();
  }

  function cycleFrame() {
    if (!frameMode) {
      frameMode = true;
      frameToggleBtn.textContent = 'ON';
      frameToggleBtn.classList.toggle('active', true);
      frameBgInput.value = bgColorInput.value;
      framePresetIdx = 0;
    } else {
      framePresetIdx = (framePresetIdx + 1) % framePresets.length;
    }
    const preset = framePresets[framePresetIdx];
    frameLayoutSelect.value = preset.layout;
    frameRatioSelect.value = preset.ratio;
    frameShapeSelect.value = preset.shape;
    updateFrameLayout();
  }

  function exitFrame() {
    if (!frameMode) return;
    frameMode = false;
    framePresetIdx = -1;
    frameToggleBtn.textContent = 'OFF';
    frameToggleBtn.classList.toggle('active', false);
    updateFrameLayout();
  }

  frameToggleBtn.addEventListener('click', toggleFrame);

  // Frame BG link toggle
  let frameBgLinked = true;
  frameBgLinkBtn.addEventListener('click', () => {
    frameBgLinked = !frameBgLinked;
    frameBgLinkBtn.classList.toggle('active', frameBgLinked);
    if (frameBgLinked && frameMode) {
      frameBgInput.value = bgColorInput.value;
      document.body.style.backgroundColor = frameBgInput.value;
    }
  });

  // Frame sub-controls update layout live
  frameBgInput.addEventListener('input', () => {
    if (frameMode) {
      document.body.style.backgroundColor = frameBgInput.value;
      // Manual edit breaks the link
      frameBgLinked = false;
      frameBgLinkBtn.classList.remove('active');
    }
  });
  frameRatioSelect.addEventListener('change', () => { if (frameMode) updateFrameLayout(); });
  frameShapeSelect.addEventListener('change', () => { if (frameMode) updateFrameLayout(); });
  frameLayoutSelect.addEventListener('change', () => { if (frameMode) updateFrameLayout(); });

  let genTextBase = '';
  let glitchInterval = 0;

  function startGlitchLoop() {
    stopGlitchLoop();
    glitchInterval = window.setInterval(() => {
      if (genTextMode && textMode) {
        frameTitleEl.textContent = glitchText(genTextBase, 0.12 + Math.random() * 0.1);
      }
    }, 120);
  }

  function stopGlitchLoop() {
    if (glitchInterval) { clearInterval(glitchInterval); glitchInterval = 0; }
  }

  function applyGenText() {
    if (genTextMode) {
      genTextBase = generateText(seed);
      frameTitleEl.textContent = genTextBase;
      frameTitleEl.contentEditable = 'false';
      if (textMode) startGlitchLoop();
    } else {
      stopGlitchLoop();
      frameTitleEl.contentEditable = 'true';
    }
  }

  textToggleBtn.addEventListener('click', () => {
    textMode = !textMode;
    textToggleBtn.textContent = textMode ? 'ON' : 'OFF';
    textToggleBtn.classList.toggle('active', textMode);
    if (!textMode) {
      stopGlitchLoop();
    } else if (genTextMode) {
      startGlitchLoop();
    }
    if (frameMode) updateFrameLayout(); else updateTextOverlay();
  });

  genTextToggleBtn.addEventListener('click', () => {
    genTextMode = !genTextMode;
    genTextToggleBtn.textContent = genTextMode ? 'ON' : 'OFF';
    genTextToggleBtn.classList.toggle('active', genTextMode);
    applyGenText();
    if (!genTextMode) stopGlitchLoop();
  });

  textColorInput.addEventListener('input', () => {
    if (frameMode) updateFrameLayout(); else updateTextOverlay();
  });
  textSizeSlider.addEventListener('input', () => {
    textSizeVal.textContent = parseFloat(textSizeSlider.value).toFixed(1);
    if (frameMode) updateFrameLayout(); else updateTextOverlay();
  });
  textPositionSelect.addEventListener('change', () => {
    if (frameMode) updateFrameLayout(); else updateTextOverlay();
  });

  // === BPM sync ===
  let bpmMode = false;
  let bpm = 120;
  const tapTimes: number[] = [];

  function bpmToPeriod(): number {
    const bars = parseInt(bpmBarsSelect.value, 10);
    // 4/4 time: period = (60/bpm) * 4 beats * bars
    return (60 / bpm) * 4 * bars;
  }

  function applyBpm() {
    const p = bpmToPeriod();
    periodSlider.value = Math.min(64, Math.max(1, p)).toFixed(1);
    // Also set speed so animation feels matched
    speedSlider.value = '1.0';
    bpmValEl.textContent = String(Math.round(bpm));
    updateValDisplays();
    debouncedRegen();
  }

  bpmToggleBtn.addEventListener('click', () => {
    bpmMode = !bpmMode;
    bpmToggleBtn.textContent = bpmMode ? 'ON' : 'OFF';
    bpmToggleBtn.classList.toggle('active', bpmMode);
    bpmControlsEl.style.display = bpmMode ? '' : 'none';
    if (bpmMode) applyBpm();
  });

  tapTempoBtn.addEventListener('click', () => {
    const now = performance.now();
    // Reset if last tap was >2s ago
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) {
      tapTimes.length = 0;
    }
    tapTimes.push(now);
    if (tapTimes.length > 8) tapTimes.shift(); // keep last 8 taps
    if (tapTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = Math.round(60000 / avg);
      bpm = Math.max(30, Math.min(300, bpm));
      applyBpm();
    }
  });

  bpmBarsSelect.addEventListener('change', () => {
    if (bpmMode) applyBpm();
  });

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
  const uiToggleBtn = document.getElementById('ui-toggle')!;
  const uiCloseBtn = document.getElementById('ui-close')!;

  function openUI() {
    uiEl.classList.add('open');
    document.body.classList.add('ui-open');
    uiToggleBtn.classList.add('hidden');
  }
  function closeUI() {
    uiEl.classList.remove('open');
    document.body.classList.remove('ui-open');
    uiToggleBtn.classList.remove('hidden');
  }

  uiToggleBtn.addEventListener('click', openUI);
  uiCloseBtn.addEventListener('click', closeUI);

  window.addEventListener('keydown', (e) => {
    // Cmd+. or Ctrl+. to toggle UI
    if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      uiEl.classList.contains('open') ? closeUI() : openUI();
      return;
    }
    const helpOverlay = document.getElementById('help-overlay')!;
    if (e.key === 'Escape') {
      helpOverlay.classList.remove('open');
      return;
    }
    if (e.key === '?') {
      helpOverlay.classList.toggle('open');
      return;
    }
    if (helpOverlay.classList.contains('open')) return;
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
      case 'ArrowUp': {
        const step = e.shiftKey ? 64 : 8;
        resSlider.value = String(Math.min(parseInt(resSlider.max), parseInt(resSlider.value) + step));
        updateValDisplays();
        debouncedRegen();
        break;
      }
      case 'ArrowDown': {
        const step = e.shiftKey ? 64 : 8;
        resSlider.value = String(Math.max(parseInt(resSlider.min), parseInt(resSlider.value) - step));
        updateValDisplays();
        debouncedRegen();
        break;
      }
      case '=':
      case '+':
        state.zoom = Math.min(8, state.zoom * 1.15);
        break;
      case '-':
      case '_':
        state.zoom = Math.max(0.25, state.zoom / 1.15);
        break;
      case '0':
        state.zoom = 1.0;
        break;
      case '[': {
        const step = e.shiftKey ? 3 : 1;
        subdivSlider.value = String(Math.max(parseInt(subdivSlider.min), parseInt(subdivSlider.value) - step));
        updateValDisplays();
        debouncedRegen();
        break;
      }
      case ']': {
        const step = e.shiftKey ? 3 : 1;
        subdivSlider.value = String(Math.min(parseInt(subdivSlider.max), parseInt(subdivSlider.value) + step));
        updateValDisplays();
        debouncedRegen();
        break;
      }
      case 's':
      case 'S':
        savePNG(canvas, seed);
        break;
      case 'c':
      case 'C': {
        const rh = () => '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
        fgColorInput.value = rh();
        bgColorInput.value = rh();
        applyColors();
        textColorInput.value = fgColorInput.value;
        if (frameMode) {
          if (!frameBgLinked) {
            frameBgInput.value = bgColorInput.value;
            document.body.style.backgroundColor = frameBgInput.value;
          }
          updateFrameLayout();
        } else {
          updateTextOverlay();
        }
        break;
      }
      case 'f':
      case 'F':
        cycleFrame();
        break;
      case 'g':
      case 'G':
        exitFrame();
        break;
      case 't':
      case 'T':
        textToggleBtn.click();
        break;
      case 'r':
      case 'R':
        randomizeParams();
        break;
      case 'a':
      case 'A':
        toggleAuto();
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
    state.mousePressed = false;
  });
  canvas.addEventListener('mousedown', () => { state.mousePressed = true; });
  window.addEventListener('mouseup', () => { state.mousePressed = false; });

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

  // Boot reveal: generate dissolve map once, trigger after text delay
  state!.revealMap = generateRevealMap(state!.gridW, state!.gridH);
  state!.revealStart = -1;

  // Boot: hide normal text, show big "bitfield" with glitch
  const bootTextEl = document.getElementById('boot-text')!;
  frameTextEl.style.display = 'none';
  if (autoMode) scheduleAutoAdvance();

  const bootGlitch = window.setInterval(() => {
    bootTextEl.textContent = glitchText('bitfield', 0.15 + Math.random() * 0.15);
  }, 100);

  // Intro sequence
  const introHint = document.getElementById('intro-hint')!;
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  introHint.textContent = isMobile ? 'tap + to open controls' : 'cmd + . to open controls';
  introHint.style.display = 'block';

  setTimeout(() => {
    clearInterval(bootGlitch);
    bootTextEl.classList.add('hidden');
    state.revealStart = performance.now();
    applyGenText();
    updateTextOverlay();
  }, 2000);
  setTimeout(() => {
    introHint.classList.add('show');
  }, 4500);
  setTimeout(() => {
    introHint.classList.remove('show');
  }, 8500);
  setTimeout(() => {
    introHint.style.display = 'none';
  }, 9500);
}
