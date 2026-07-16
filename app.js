/**
 * Fractal Lab — UI, view transform, and render loop.
 */
(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const paramsEl = document.getElementById("params");
  const pickerEl = document.getElementById("fractal-picker");
  const nameEl = document.getElementById("fractal-name");
  const blurbEl = document.getElementById("fractal-blurb");
  const statsEl = document.getElementById("stats");
  const hudEl = document.getElementById("hud");

  // —— App state ——
  const appearance = {
    bgColor: "#0b0f14",
    strokeColor: "#7dd3fc",
    fillColor: "#a78bfa",
    lineWidth: 1.5,
    gradient: true,
    filled: false,
  };

  let activeId = "sierpinski-triangle";
  let params = {};
  let view = { x: 0, y: 0, scale: 1 }; // pan/zoom for vector fractals
  let dragging = false;
  let lastPointer = null;
  let needsRedraw = true;
  let lastStats = { primitives: 0, ms: 0 };

  function activeFractal() {
    return Fractals.get(activeId);
  }

  function resetParams() {
    const f = activeFractal();
    params = { ...f.defaults };
    buildParamControls();
    if (f.viewMode === "vector") {
      view = { x: 0, y: 0, scale: 1 };
    }
    needsRedraw = true;
  }

  function resetView() {
    const f = activeFractal();
    if (f.viewMode === "complex") {
      params.zoom = f.defaults.zoom;
      params.panX = f.defaults.panX;
      params.panY = f.defaults.panY;
      buildParamControls();
    } else {
      view = { x: 0, y: 0, scale: 1 };
    }
    needsRedraw = true;
  }

  // —— Fractal picker ——
  function buildPicker() {
    pickerEl.innerHTML = "";
    for (const f of Fractals.catalog) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fractal-card" + (f.id === activeId ? " active" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", f.id === activeId ? "true" : "false");
      btn.innerHTML = `<span class="name">${f.name}</span><span class="kind">${f.kind}</span>`;
      btn.addEventListener("click", () => selectFractal(f.id));
      pickerEl.appendChild(btn);
    }
  }

  function selectFractal(id) {
    activeId = id;
    const f = activeFractal();
    nameEl.textContent = f.name;
    blurbEl.textContent = f.blurb;
    params = { ...f.defaults };
    view = { x: 0, y: 0, scale: 1 };
    buildPicker();
    buildParamControls();
    needsRedraw = true;
  }

  // —— Dynamic parameter controls ——
  function formatVal(_key, v) {
    if (typeof v === "boolean") return v ? "on" : "off";
    if (typeof v === "number") {
      if (Number.isInteger(v)) return String(v);
      const rounded = Math.round(v * 1000) / 1000;
      return String(rounded);
    }
    return String(v);
  }

  function buildParamControls() {
    const f = activeFractal();
    paramsEl.innerHTML = "";

    for (const p of f.params) {
      const wrap = document.createElement("div");
      wrap.className = "control";

      if (p.type === "range") {
        const label = document.createElement("label");
        label.htmlFor = `param-${p.key}`;
        label.innerHTML = `${p.label} <span class="val" id="param-${p.key}-val">${formatVal(p.key, params[p.key])}</span>`;
        const input = document.createElement("input");
        input.type = "range";
        input.id = `param-${p.key}`;
        input.min = p.min;
        input.max = p.max;
        input.step = p.step;
        input.value = params[p.key];
        input.addEventListener("input", () => {
          const n = parseFloat(input.value);
          params[p.key] = n;
          document.getElementById(`param-${p.key}-val`).textContent = formatVal(p.key, n);
          needsRedraw = true;
        });
        wrap.appendChild(label);
        wrap.appendChild(input);
      } else if (p.type === "checkbox") {
        const label = document.createElement("label");
        label.className = "checkbox";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = `param-${p.key}`;
        input.checked = !!params[p.key];
        input.addEventListener("change", () => {
          params[p.key] = input.checked;
          needsRedraw = true;
        });
        label.appendChild(input);
        label.appendChild(document.createTextNode(" " + p.label));
        wrap.appendChild(label);
      } else if (p.type === "select") {
        const label = document.createElement("label");
        label.htmlFor = `param-${p.key}`;
        label.textContent = p.label;
        const select = document.createElement("select");
        select.id = `param-${p.key}`;
        for (const opt of p.options) {
          const o = document.createElement("option");
          o.value = opt.value;
          o.textContent = opt.label;
          if (params[p.key] === opt.value) o.selected = true;
          select.appendChild(o);
        }
        select.addEventListener("change", () => {
          params[p.key] = select.value;
          needsRedraw = true;
        });
        wrap.appendChild(label);
        wrap.appendChild(select);
      }

      paramsEl.appendChild(wrap);
    }
  }

  // —— Appearance bindings ——
  function bindAppearance() {
    const map = [
      ["bg-color", "bgColor", "value"],
      ["stroke-color", "strokeColor", "value"],
      ["fill-color", "fillColor", "value"],
      ["line-width", "lineWidth", "valueAsNumber"],
      ["gradient", "gradient", "checked"],
      ["filled", "filled", "checked"],
    ];
    for (const [id, key, prop] of map) {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        appearance[key] = el[prop];
        if (key === "lineWidth") {
          document.getElementById("line-width-val").textContent = appearance.lineWidth;
        }
        needsRedraw = true;
      });
      // init DOM from state
      if (prop === "checked") el.checked = appearance[key];
      else if (prop === "valueAsNumber") el.value = appearance[key];
      else el.value = appearance[key];
    }
    document.getElementById("line-width-val").textContent = appearance.lineWidth;
  }

  // —— Canvas sizing ——
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      needsRedraw = true;
    }
  }

  // —— Render ——
  function render() {
    resize();
    if (!needsRedraw) return;
    needsRedraw = false;

    const f = activeFractal();
    const w = canvas.width;
    const h = canvas.height;
    const t0 = performance.now();

    // clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = appearance.bgColor;
    ctx.fillRect(0, 0, w, h);

    const state = {
      ...appearance,
      ...params,
      bgColor: appearance.bgColor,
    };

    let result = { primitives: 0 };

    if (f.viewMode === "complex") {
      // pixel fractals: no CSS-style view transform; pan/zoom are params
      result = f.draw(ctx, w, h, state) || result;
    } else {
      // vector: apply pan/zoom around canvas center
      ctx.save();
      ctx.translate(w / 2 + view.x * (window.devicePixelRatio || 1), h / 2 + view.y * (window.devicePixelRatio || 1));
      ctx.scale(view.scale, view.scale);
      ctx.translate(-w / 2, -h / 2);
      result = f.draw(ctx, w, h, state) || result;
      ctx.restore();
    }

    const ms = performance.now() - t0;
    lastStats = { primitives: result.primitives || 0, ms };

    const primLabel =
      f.id === "fern" || f.id === "mandelbrot"
        ? "samples"
        : "segments / cells";

    statsEl.innerHTML = `
      ${primLabel}: <strong style="color:var(--accent)">${lastStats.primitives.toLocaleString()}</strong><br/>
      render: <strong style="color:var(--accent)">${ms.toFixed(1)} ms</strong><br/>
      canvas: ${w}×${h}px
    `;

    if (f.viewMode === "complex") {
      hudEl.textContent = `zoom ${params.zoom.toFixed(1)}× · c≈ ${params.panX.toFixed(3)} + ${params.panY.toFixed(3)}i`;
    } else {
      hudEl.textContent = `view ×${view.scale.toFixed(2)} · pan ${Math.round(view.x)}, ${Math.round(view.y)}`;
    }
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  // —— Pointer: pan / zoom ——
  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    lastPointer = canvasPoint(e);
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || !lastPointer) return;
    const p = canvasPoint(e);
    const dx = p.x - lastPointer.x;
    const dy = p.y - lastPointer.y;
    lastPointer = p;

    const f = activeFractal();
    if (f.viewMode === "complex") {
      // pan in complex plane (inverse to zoom)
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const scale = 2.8 / params.zoom;
      params.panX -= (dx / canvas.clientWidth) * scale * aspect;
      params.panY -= (dy / canvas.clientHeight) * scale;
      // sync sliders if present
      const px = document.getElementById("param-panX");
      const py = document.getElementById("param-panY");
      if (px) {
        px.value = params.panX;
        const v = document.getElementById("param-panX-val");
        if (v) v.textContent = formatVal("panX", params.panX);
      }
      if (py) {
        py.value = params.panY;
        const v = document.getElementById("param-panY-val");
        if (v) v.textContent = formatVal("panY", params.panY);
      }
    } else {
      view.x += dx;
      view.y += dy;
    }
    needsRedraw = true;
  });

  function endDrag(e) {
    dragging = false;
    lastPointer = null;
    canvas.classList.remove("dragging");
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const f = activeFractal();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;

      if (f.viewMode === "complex") {
        // zoom toward pointer in complex plane
        const p = canvasPoint(e);
        const aspect = canvas.clientWidth / canvas.clientHeight;
        const scale = 2.8 / params.zoom;
        const mx = (p.x / canvas.clientWidth - 0.5) * scale * aspect + params.panX;
        const my = (p.y / canvas.clientHeight - 0.5) * scale + params.panY;
        params.zoom = Math.min(200, Math.max(0.3, params.zoom * factor));
        const scale2 = 2.8 / params.zoom;
        params.panX = mx - (p.x / canvas.clientWidth - 0.5) * scale2 * aspect;
        params.panY = my - (p.y / canvas.clientHeight - 0.5) * scale2;
        const z = document.getElementById("param-zoom");
        if (z) {
          z.value = Math.min(parseFloat(z.max), params.zoom);
          const v = document.getElementById("param-zoom-val");
          if (v) v.textContent = formatVal("zoom", params.zoom);
        }
        const px = document.getElementById("param-panX");
        const py = document.getElementById("param-panY");
        if (px) {
          px.value = params.panX;
          const v = document.getElementById("param-panX-val");
          if (v) v.textContent = formatVal("panX", params.panX);
        }
        if (py) {
          py.value = params.panY;
          const v = document.getElementById("param-panY-val");
          if (v) v.textContent = formatVal("panY", params.panY);
        }
      } else {
        view.scale = Math.min(8, Math.max(0.15, view.scale * factor));
      }
      needsRedraw = true;
    },
    { passive: false }
  );

  canvas.addEventListener("dblclick", () => {
    resetView();
  });

  // —— Buttons ——
  document.getElementById("btn-reset-view").addEventListener("click", resetView);
  document.getElementById("btn-reset-params").addEventListener("click", resetParams);
  document.getElementById("btn-export").addEventListener("click", () => {
    // ensure latest frame
    needsRedraw = true;
    render();
    const link = document.createElement("a");
    const f = activeFractal();
    link.download = `fractal-lab-${f.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  window.addEventListener("resize", () => {
    needsRedraw = true;
  });

  // —— Boot ——
  bindAppearance();
  selectFractal(activeId);
  requestAnimationFrame(loop);
})();
