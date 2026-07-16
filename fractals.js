/**
 * Fractal Lab — pure Canvas 2D rendering engines.
 *
 * Each fractal exposes:
 *   id, name, kind, blurb, defaults, params[], draw(ctx, w, h, state)
 *
 * `state` always includes shared appearance fields plus fractal-specific params.
 */

const Fractals = (() => {
  // —— Color helpers ——
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lerpColor(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const r = Math.round(A.r + (B.r - A.r) * t);
    const g = Math.round(A.g + (B.g - A.g) * t);
    const bl = Math.round(A.b + (B.b - A.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  function depthColor(state, depth, maxDepth) {
    if (!state.gradient || maxDepth <= 0) return state.strokeColor;
    return lerpColor(state.strokeColor, state.fillColor, depth / maxDepth);
  }

  function setupStroke(ctx, state) {
    ctx.lineWidth = state.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = state.strokeColor;
    ctx.fillStyle = state.fillColor;
  }

  // —— Geometry helpers ——
  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function rotateAround(p, origin, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    return {
      x: origin.x + dx * c - dy * s,
      y: origin.y + dx * s + dy * c,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Sierpiński Triangle (recursive midpoints)
  // ═══════════════════════════════════════════════════════════
  function drawSierpinskiTriangle(ctx, w, h, state) {
    setupStroke(ctx, state);
    const size = Math.min(w, h) * 0.42 * state.scale;
    const cx = w / 2;
    const cy = h / 2 + size * 0.12;
    const rot = (state.rotation * Math.PI) / 180;

    let A = { x: cx, y: cy - size };
    let B = { x: cx - size * Math.cos(Math.PI / 6), y: cy + size * 0.5 };
    let C = { x: cx + size * Math.cos(Math.PI / 6), y: cy + size * 0.5 };
    A = rotateAround(A, { x: cx, y: cy }, rot);
    B = rotateAround(B, { x: cx, y: cy }, rot);
    C = rotateAround(C, { x: cx, y: cy }, rot);

    let triangles = 0;

    function tri(p1, p2, p3, depth) {
      triangles++;
      if (depth === 0) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        const col = depthColor(state, state.depth - depth, state.depth);
        if (state.filled) {
          ctx.fillStyle = col;
          ctx.fill();
        }
        ctx.strokeStyle = col;
        ctx.stroke();
        return;
      }
      const m12 = midpoint(p1, p2);
      const m23 = midpoint(p2, p3);
      const m31 = midpoint(p3, p1);
      tri(p1, m12, m31, depth - 1);
      tri(m12, p2, m23, depth - 1);
      tri(m31, m23, p3, depth - 1);
    }

    // Optional outer outline at depth 0 style
    if (state.showOutline) {
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.strokeStyle = state.strokeColor;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    tri(A, B, C, state.depth);
    return { primitives: triangles };
  }

  // ═══════════════════════════════════════════════════════════
  // Sierpiński Carpet
  // ═══════════════════════════════════════════════════════════
  function drawSierpinskiCarpet(ctx, w, h, state) {
    setupStroke(ctx, state);
    const size = Math.min(w, h) * 0.72 * state.scale;
    const x0 = (w - size) / 2;
    const y0 = (h - size) / 2;
    let squares = 0;

    function carpet(x, y, s, depth) {
      if (depth === 0) {
        squares++;
        const col = depthColor(state, state.depth, state.depth);
        if (state.filled) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, s, s);
        } else {
          ctx.strokeStyle = col;
          ctx.strokeRect(x, y, s, s);
        }
        return;
      }
      const ns = s / 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (i === 1 && j === 1) {
            // hollow center — optionally draw a faint hole
            if (state.showHoles) {
              ctx.fillStyle = state.bgColor;
              // parent already blank; skip
            }
            continue;
          }
          carpet(x + i * ns, y + j * ns, ns, depth - 1);
        }
      }
    }

    // base plate for visual contrast when filled
    if (state.filled) {
      ctx.fillStyle = lerpColor(state.strokeColor, state.fillColor, 0.15);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(x0, y0, size, size);
      ctx.globalAlpha = 1;
    }

    carpet(x0, y0, size, state.depth);
    return { primitives: squares };
  }

  // ═══════════════════════════════════════════════════════════
  // Koch Snowflake / Curve
  // ═══════════════════════════════════════════════════════════
  function kochSegment(p1, p2, depth) {
    if (depth === 0) return [p1, p2];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const a = { x: p1.x + dx / 3, y: p1.y + dy / 3 };
    const b = { x: p1.x + (2 * dx) / 3, y: p1.y + (2 * dy) / 3 };
    // peak: rotate (b-a) by 60°
    const px = b.x - a.x;
    const py = b.y - a.y;
    const peak = {
      x: a.x + px * 0.5 - py * (Math.sqrt(3) / 2),
      y: a.y + py * 0.5 + px * (Math.sqrt(3) / 2),
    };
    const left = kochSegment(p1, a, depth - 1);
    const mid1 = kochSegment(a, peak, depth - 1);
    const mid2 = kochSegment(peak, b, depth - 1);
    const right = kochSegment(b, p2, depth - 1);
    // stitch without duplicating joints
    return [
      ...left.slice(0, -1),
      ...mid1.slice(0, -1),
      ...mid2.slice(0, -1),
      ...right,
    ];
  }

  function drawKoch(ctx, w, h, state) {
    setupStroke(ctx, state);
    const size = Math.min(w, h) * 0.38 * state.scale;
    const cx = w / 2;
    const cy = h / 2 + size * 0.08;
    const rot = (state.rotation * Math.PI) / 180;

    let A = { x: cx, y: cy - size };
    let B = { x: cx - size * Math.cos(Math.PI / 6), y: cy + size * 0.5 };
    let C = { x: cx + size * Math.cos(Math.PI / 6), y: cy + size * 0.5 };
    const o = { x: cx, y: cy };
    A = rotateAround(A, o, rot);
    B = rotateAround(B, o, rot);
    C = rotateAround(C, o, rot);

    let points;
    if (state.mode === "curve") {
      // single base edge (bottom)
      points = kochSegment(B, C, state.depth);
    } else {
      const e1 = kochSegment(A, B, state.depth);
      const e2 = kochSegment(B, C, state.depth);
      const e3 = kochSegment(C, A, state.depth);
      points = [...e1.slice(0, -1), ...e2.slice(0, -1), ...e3];
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (state.mode !== "curve") ctx.closePath();

    if (state.filled && state.mode !== "curve") {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, state.strokeColor);
      grad.addColorStop(1, state.fillColor);
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (state.gradient && points.length > 2) {
      // stroke in segments with color ramp
      for (let i = 0; i < points.length - 1; i++) {
        const t = i / (points.length - 1);
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[i + 1].x, points[i + 1].y);
        ctx.strokeStyle = lerpColor(state.strokeColor, state.fillColor, t);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = state.strokeColor;
      ctx.stroke();
    }

    return { primitives: points.length - 1 };
  }

  // ═══════════════════════════════════════════════════════════
  // Vicsek Fractal (cross-shaped self-similar)
  // ═══════════════════════════════════════════════════════════
  function drawVicsek(ctx, w, h, state) {
    setupStroke(ctx, state);
    const size = Math.min(w, h) * 0.7 * state.scale;
    const x0 = (w - size) / 2;
    const y0 = (h - size) / 2;
    let cells = 0;

    // diagonal mode: center + 4 corners; cross mode: center + 4 mid-edges
    function cell(x, y, s, depth) {
      if (depth === 0) {
        cells++;
        const col = depthColor(state, state.depth, state.depth);
        if (state.filled) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, s, s);
        } else {
          ctx.strokeStyle = col;
          ctx.strokeRect(x, y, s, s);
        }
        return;
      }
      const ns = s / 3;
      const positions =
        state.variant === "diagonal"
          ? [
              [0, 0],
              [2, 0],
              [1, 1],
              [0, 2],
              [2, 2],
            ]
          : [
              [1, 0],
              [0, 1],
              [1, 1],
              [2, 1],
              [1, 2],
            ];
      for (const [i, j] of positions) {
        cell(x + i * ns, y + j * ns, ns, depth - 1);
      }
    }

    cell(x0, y0, size, state.depth);
    return { primitives: cells };
  }

  // ═══════════════════════════════════════════════════════════
  // Fractal Tree (binary recursive branches)
  // ═══════════════════════════════════════════════════════════
  function drawTree(ctx, w, h, state) {
    setupStroke(ctx, state);
    let branches = 0;
    const startX = w / 2;
    const startY = h * 0.88;
    const trunk = Math.min(w, h) * 0.22 * state.scale;
    const baseAngle = -Math.PI / 2 + (state.lean * Math.PI) / 180;

    function branch(x, y, len, angle, depth) {
      if (depth < 0 || len < 0.5) return;
      branches++;
      const x2 = x + Math.cos(angle) * len;
      const y2 = y + Math.sin(angle) * len;

      const t = 1 - depth / state.depth;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = Math.max(0.4, state.lineWidth * (depth + 1) * 0.45);
      ctx.strokeStyle = depthColor(state, depth, state.depth);
      if (state.gradient) {
        ctx.strokeStyle = lerpColor(state.strokeColor, state.fillColor, t);
      }
      ctx.stroke();

      const left = angle - (state.angle * Math.PI) / 180;
      const right = angle + (state.angle * Math.PI) / 180;
      const next = len * state.ratio;
      branch(x2, y2, next, left, depth - 1);
      branch(x2, y2, next, right, depth - 1);
      if (state.ternary) {
        branch(x2, y2, next * 0.9, angle, depth - 1);
      }
    }

    branch(startX, startY, trunk, baseAngle, state.depth);
    ctx.lineWidth = state.lineWidth;
    return { primitives: branches };
  }

  // ═══════════════════════════════════════════════════════════
  // Pythagoras Tree
  // ═══════════════════════════════════════════════════════════
  function drawPythagorasTree(ctx, w, h, state) {
    setupStroke(ctx, state);
    let squares = 0;
    const size = Math.min(w, h) * 0.16 * state.scale;
    const baseLeft = { x: w / 2 - size / 2, y: h * 0.85 };
    const baseRight = { x: w / 2 + size / 2, y: h * 0.85 };

    function drawSquare(p1, p2, depth) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      // outward perpendicular (CCW)
      const p3 = { x: p2.x - dy, y: p2.y + dx };
      const p4 = { x: p1.x - dy, y: p1.y + dx };

      squares++;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();

      const t = depth / Math.max(1, state.depth);
      const col = state.gradient
        ? lerpColor(state.strokeColor, state.fillColor, 1 - t)
        : state.strokeColor;

      if (state.filled) {
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.5 + 0.5 * t;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = col;
      ctx.stroke();

      if (depth <= 0) return;

      const angle = (state.angle * Math.PI) / 180;
      // Top edge p4 → p3
      const tdx = p3.x - p4.x;
      const tdy = p3.y - p4.y;
      // Apex of right triangle with left angle = `angle`
      // apex = p4 + rot(angle) applied to top, scaled by cos(angle)
      // Using: length of left side = |top| * cos(angle)
      // direction of left side from p4: rotate top vector by +angle (toward outward)
      // rot_ccw(θ): (x cos - y sin, x sin + y cos) — but outward from top is rotate top by +90 from inward...
      // For growth "up", from top edge going further out: rotate (tdx,tdy) by +angle (CCW) gives left roof edge direction when angle measured from top.
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Classic formula (Wikipedia-style):
      // left child base: p4 → apex, right: apex → p3
      // apex = p4 + (tdx * cos - tdy * sin) * cos  ... 
      const apex = {
        x: p4.x + cos * (tdx * cos - tdy * sin),
        y: p4.y + cos * (tdx * sin + tdy * cos),
      };

      drawSquare(p4, apex, depth - 1);
      drawSquare(apex, p3, depth - 1);
    }

    drawSquare(baseLeft, baseRight, state.depth);
    return { primitives: squares };
  }

  // ═══════════════════════════════════════════════════════════
  // Dragon Curve (L-system / fold)
  // ═══════════════════════════════════════════════════════════
  function dragonTurns(order) {
    // sequence of turns: 1 = right, -1 = left
    const turns = [];
    for (let i = 0; i < order; i++) {
      const next = turns.slice().reverse().map((t) => -t);
      turns.push(1);
      turns.push(...next);
    }
    return turns;
  }

  function drawDragon(ctx, w, h, state) {
    setupStroke(ctx, state);
    const turns = dragonTurns(state.depth);
    const step = Math.min(w, h) * 0.45 * state.scale / Math.pow(Math.SQRT2, state.depth);

    // walk path
    let x = 0;
    let y = 0;
    let dir = 0; // 0=E,1=N,2=W,3=S
    const pts = [{ x, y }];
    const dirs = [
      [1, 0],
      [0, -1],
      [-1, 0],
      [0, 1],
    ];

    for (const t of turns) {
      dir = (dir + t + 4) % 4;
      x += dirs[dir][0] * step;
      y += dirs[dir][1] * step;
      pts.push({ x, y });
    }
    // one more step? dragon of order n has 2^n segments
    // after turns we need initial step too
    // Actually: start with one segment, then apply turns between segments
    // Rebuild properly:
    const pts2 = [];
    x = 0;
    y = 0;
    dir = 0;
    pts2.push({ x, y });
    x += step;
    y += 0;
    pts2.push({ x, y });
    for (const t of turns) {
      dir = (dir + (t === 1 ? 1 : -1) + 4) % 4;
      x += dirs[dir][0] * step;
      y += dirs[dir][1] * step;
      pts2.push({ x, y });
    }

    // center path
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts2) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const ox = w / 2 - cx;
    const oy = h / 2 - cy;

    for (let i = 0; i < pts2.length - 1; i++) {
      const t = i / (pts2.length - 1);
      ctx.beginPath();
      ctx.moveTo(pts2[i].x + ox, pts2[i].y + oy);
      ctx.lineTo(pts2[i + 1].x + ox, pts2[i + 1].y + oy);
      ctx.strokeStyle = state.gradient
        ? lerpColor(state.strokeColor, state.fillColor, t)
        : state.strokeColor;
      ctx.stroke();
    }

    return { primitives: pts2.length - 1 };
  }

  // ═══════════════════════════════════════════════════════════
  // Hilbert Curve
  // ═══════════════════════════════════════════════════════════
  function hilbert(order, x0, y0, xi, xj, yi, yj, points) {
    if (order <= 0) {
      points.push({
        x: x0 + (xi + yi) / 2,
        y: y0 + (xj + yj) / 2,
      });
      return;
    }
    hilbert(order - 1, x0, y0, yi / 2, yj / 2, xi / 2, xj / 2, points);
    hilbert(order - 1, x0 + xi / 2, y0 + xj / 2, xi / 2, xj / 2, yi / 2, yj / 2, points);
    hilbert(order - 1, x0 + xi / 2 + yi / 2, y0 + xj / 2 + yj / 2, xi / 2, xj / 2, yi / 2, yj / 2, points);
    hilbert(order - 1, x0 + xi / 2 + yi, y0 + xj / 2 + yj, -yi / 2, -yj / 2, -xi / 2, -xj / 2, points);
  }

  function drawHilbert(ctx, w, h, state) {
    setupStroke(ctx, state);
    const size = Math.min(w, h) * 0.8 * state.scale;
    const x0 = (w - size) / 2;
    const y0 = (h - size) / 2;
    const points = [];
    hilbert(state.depth, x0, y0, size, 0, 0, size, points);

    for (let i = 0; i < points.length - 1; i++) {
      const t = i / (points.length - 1);
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(points[i + 1].x, points[i + 1].y);
      ctx.strokeStyle = state.gradient
        ? lerpColor(state.strokeColor, state.fillColor, t)
        : state.strokeColor;
      ctx.stroke();
    }
    return { primitives: Math.max(0, points.length - 1) };
  }

  // ═══════════════════════════════════════════════════════════
  // Barnsley Fern (IFS attractor)
  // ═══════════════════════════════════════════════════════════
  function drawFern(ctx, w, h, state) {
    const n = state.points;
    let x = 0;
    let y = 0;

    // affine IFS with user-tunable stem / stretch / curl
    const f1 = { a: 0, b: 0, c: 0, d: 0.16 * state.stem, e: 0, f: 0, p: 0.01 };
    const f2 = {
      a: 0.85 * state.stretch,
      b: 0.04 * state.curl,
      c: -0.04 * state.curl,
      d: 0.85 * state.stretch,
      e: 0,
      f: 1.6,
      p: 0.85,
    };
    const f3 = { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6, p: 0.07 };
    const f4 = { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44, p: 0.07 };

    // map fern coords → canvas (respects pan/zoom transform from app.js)
    const scale = Math.min(w, h) * 0.09 * state.scale;
    const ox = w / 2;
    const oy = h * 0.92;
    const pointSize = Math.max(0.6, state.lineWidth * 0.55);

    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let nx, ny;
      if (r < f1.p) {
        nx = f1.a * x + f1.b * y + f1.e;
        ny = f1.c * x + f1.d * y + f1.f;
      } else if (r < f1.p + f2.p) {
        nx = f2.a * x + f2.b * y + f2.e;
        ny = f2.c * x + f2.d * y + f2.f;
      } else if (r < f1.p + f2.p + f3.p) {
        nx = f3.a * x + f3.b * y + f3.e;
        ny = f3.c * x + f3.d * y + f3.f;
      } else {
        nx = f4.a * x + f4.b * y + f4.e;
        ny = f4.c * x + f4.d * y + f4.f;
      }
      x = nx;
      y = ny;

      // skip burn-in
      if (i < 20) continue;

      const t = Math.min(1, Math.max(0, y / 10));
      ctx.fillStyle = state.gradient
        ? lerpColor(state.strokeColor, state.fillColor, t)
        : state.strokeColor;
      const px = ox + x * scale;
      const py = oy - y * scale;
      ctx.fillRect(px, py, pointSize, pointSize);
    }
    return { primitives: n };
  }

  // ═══════════════════════════════════════════════════════════
  // Mandelbrot / Julia
  // ═══════════════════════════════════════════════════════════
  function drawMandelbrotFamily(ctx, w, h, state) {
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const maxIter = state.iterations;
    const zoom = state.zoom;
    const panX = state.panX;
    const panY = state.panY;
    const isJulia = state.fractalMode === "julia";
    const cRe = state.cReal;
    const cIm = state.cImag;
    const c1 = hexToRgb(state.strokeColor);
    const c2 = hexToRgb(state.fillColor);
    const bg = hexToRgb(state.bgColor);

    // view: center + scale
    const aspect = w / h;
    const scale = 2.8 / zoom;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const x0 = ((px / w - 0.5) * scale * aspect) + panX;
        const y0 = ((py / h - 0.5) * scale) + panY;

        let zx, zy, cx, cy;
        if (isJulia) {
          zx = x0;
          zy = y0;
          cx = cRe;
          cy = cIm;
        } else {
          zx = 0;
          zy = 0;
          cx = x0;
          cy = y0;
        }

        let iter = 0;
        let x2 = 0;
        let y2 = 0;
        while (x2 + y2 <= 4 && iter < maxIter) {
          zy = 2 * zx * zy + cy;
          zx = x2 - y2 + cx;
          x2 = zx * zx;
          y2 = zy * zy;
          iter++;
        }

        const idx = (py * w + px) * 4;
        if (iter === maxIter) {
          data[idx] = bg.r * 0.3;
          data[idx + 1] = bg.g * 0.3;
          data[idx + 2] = bg.b * 0.3;
          data[idx + 3] = 255;
        } else {
          // smooth-ish coloring
          const logzn = Math.log(x2 + y2) / 2;
          const nu = Math.log(logzn / Math.log(2)) / Math.log(2);
          const t = (iter + 1 - nu) / maxIter;
          const tt = Math.max(0, Math.min(1, t));
          const wave = state.colorCycles
            ? 0.5 + 0.5 * Math.sin(tt * Math.PI * 2 * state.colorCycles)
            : tt;
          data[idx] = Math.round(c1.r + (c2.r - c1.r) * wave);
          data[idx + 1] = Math.round(c1.g + (c2.g - c1.g) * wave);
          data[idx + 2] = Math.round(c1.b + (c2.b - c1.b) * wave);
          data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return { primitives: w * h };
  }

  // ═══════════════════════════════════════════════════════════
  // Registry
  // ═══════════════════════════════════════════════════════════
  const catalog = [
    {
      id: "sierpinski-triangle",
      name: "Sierpiński Triangle",
      kind: "IFS / recursive",
      blurb:
        "Remove the middle quarter of a triangle, forever. Hausdorff dimension log(3)/log(2) ≈ 1.585. Built by connecting midpoints recursively.",
      defaults: {
        depth: 5,
        scale: 1,
        rotation: 0,
        showOutline: true,
      },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 0, max: 9, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.3, max: 2, step: 0.05 },
        { key: "rotation", label: "Rotation °", type: "range", min: -180, max: 180, step: 1 },
        { key: "showOutline", label: "Show outer outline", type: "checkbox" },
      ],
      draw: drawSierpinskiTriangle,
      // uses vector view transform
      viewMode: "vector",
    },
    {
      id: "sierpinski-carpet",
      name: "Sierpiński Carpet",
      kind: "recursive",
      blurb:
        "A square punched with a 3×3 grid hole, repeated in each remaining cell. Area → 0, dimension log(8)/log(3) ≈ 1.893.",
      defaults: { depth: 4, scale: 1, showHoles: true },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 0, max: 6, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.3, max: 1.5, step: 0.05 },
      ],
      draw: drawSierpinskiCarpet,
      viewMode: "vector",
    },
    {
      id: "koch",
      name: "Koch Snowflake",
      kind: "L-system / recursive",
      blurb:
        "Replace the middle third of every edge with two sides of an equilateral triangle. Infinite perimeter, finite area. Dimension log(4)/log(3) ≈ 1.262.",
      defaults: { depth: 4, scale: 1, rotation: 0, mode: "snowflake" },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 0, max: 7, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.3, max: 2, step: 0.05 },
        { key: "rotation", label: "Rotation °", type: "range", min: -180, max: 180, step: 1 },
        {
          key: "mode",
          label: "Mode",
          type: "select",
          options: [
            { value: "snowflake", label: "Snowflake (closed)" },
            { value: "curve", label: "Koch curve (one side)" },
          ],
        },
      ],
      draw: drawKoch,
      viewMode: "vector",
    },
    {
      id: "vicsek",
      name: "Vicsek Fractal",
      kind: "recursive",
      blurb:
        "Cross-shaped self-similarity: keep center + four arms (or diagonals), recurse. Used as a model for percolation and antenna design.",
      defaults: { depth: 4, scale: 1, variant: "cross" },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 0, max: 6, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.3, max: 1.5, step: 0.05 },
        {
          key: "variant",
          label: "Variant",
          type: "select",
          options: [
            { value: "cross", label: "Cross (+)" },
            { value: "diagonal", label: "Diagonal (×)" },
          ],
        },
      ],
      draw: drawVicsek,
      viewMode: "vector",
    },
    {
      id: "tree",
      name: "Fractal Tree",
      kind: "recursive",
      blurb:
        "A binary (or ternary) branching process. Angle, length ratio, and depth control whether it looks botanical, geometric, or chaotic.",
      defaults: {
        depth: 10,
        scale: 1,
        angle: 25,
        ratio: 0.72,
        lean: 0,
        ternary: false,
      },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 1, max: 14, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.4, max: 2, step: 0.05 },
        { key: "angle", label: "Branch angle °", type: "range", min: 5, max: 90, step: 1 },
        { key: "ratio", label: "Length ratio", type: "range", min: 0.45, max: 0.85, step: 0.01 },
        { key: "lean", label: "Lean °", type: "range", min: -45, max: 45, step: 1 },
        { key: "ternary", label: "Ternary (3-way) branch", type: "checkbox" },
      ],
      draw: drawTree,
      viewMode: "vector",
    },
    {
      id: "pythagoras",
      name: "Pythagoras Tree",
      kind: "recursive",
      blurb:
        "Squares on the sides of a right triangle, repeated. At 45° it is symmetric; other angles produce wind-swept canopies. Named for the geometric theorem.",
      defaults: { depth: 9, scale: 1, angle: 45 },
      params: [
        { key: "depth", label: "Depth", type: "range", min: 0, max: 12, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.4, max: 2, step: 0.05 },
        { key: "angle", label: "Split angle °", type: "range", min: 15, max: 75, step: 1 },
      ],
      draw: drawPythagorasTree,
      viewMode: "vector",
    },
    {
      id: "dragon",
      name: "Dragon Curve",
      kind: "L-system / fold",
      blurb:
        "The Heighway dragon: fold a strip of paper in half repeatedly, then unfold at 90°. Fills a 2D region without self-crossing (except at endpoints).",
      defaults: { depth: 12, scale: 1 },
      params: [
        { key: "depth", label: "Order", type: "range", min: 0, max: 16, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.3, max: 3, step: 0.05 },
      ],
      draw: drawDragon,
      viewMode: "vector",
    },
    {
      id: "hilbert",
      name: "Hilbert Curve",
      kind: "space-filling",
      blurb:
        "A continuous curve that passes through every point of the unit square in the limit. Order-n visits 4ⁿ cells. Used in image indexing and cache-friendly memory layouts.",
      defaults: { depth: 5, scale: 1 },
      params: [
        { key: "depth", label: "Order", type: "range", min: 1, max: 8, step: 1 },
        { key: "scale", label: "Scale", type: "range", min: 0.4, max: 1.4, step: 0.05 },
      ],
      draw: drawHilbert,
      viewMode: "vector",
    },
    {
      id: "fern",
      name: "Barnsley Fern",
      kind: "IFS chaos game",
      blurb:
        "Four affine transforms chosen at random produce a fern. Classic demo that complex natural form can emerge from simple probabilistic rules.",
      defaults: {
        points: 80000,
        scale: 1,
        stem: 1,
        stretch: 1,
        curl: 1,
      },
      params: [
        { key: "points", label: "Points", type: "range", min: 5000, max: 200000, step: 5000 },
        { key: "scale", label: "Scale", type: "range", min: 0.4, max: 2, step: 0.05 },
        { key: "stem", label: "Stem stretch", type: "range", min: 0.5, max: 1.5, step: 0.05 },
        { key: "stretch", label: "Leaflet stretch", type: "range", min: 0.7, max: 1.1, step: 0.01 },
        { key: "curl", label: "Curl", type: "range", min: 0, max: 2.5, step: 0.05 },
      ],
      draw: drawFern,
      // fern paints full buffer; vector pan/zoom still wraps
      viewMode: "vector",
    },
    {
      id: "mandelbrot",
      name: "Mandelbrot Set",
      kind: "complex dynamics",
      blurb:
        "The set of c ∈ ℂ where zₙ₊₁ = zₙ² + c stays bounded (z₀ = 0). Boundary is infinitely complex. Drag to pan, scroll to zoom into the filaments.",
      defaults: {
        iterations: 120,
        zoom: 1,
        panX: -0.5,
        panY: 0,
        fractalMode: "mandelbrot",
        cReal: -0.8,
        cImag: 0.156,
        colorCycles: 3,
      },
      params: [
        { key: "iterations", label: "Max iterations", type: "range", min: 20, max: 500, step: 10 },
        { key: "zoom", label: "Zoom", type: "range", min: 0.5, max: 80, step: 0.5 },
        { key: "panX", label: "Center Re", type: "range", min: -2, max: 1, step: 0.01 },
        { key: "panY", label: "Center Im", type: "range", min: -1.5, max: 1.5, step: 0.01 },
        { key: "colorCycles", label: "Color cycles", type: "range", min: 1, max: 12, step: 1 },
        {
          key: "fractalMode",
          label: "Family",
          type: "select",
          options: [
            { value: "mandelbrot", label: "Mandelbrot" },
            { value: "julia", label: "Julia set" },
          ],
        },
        { key: "cReal", label: "Julia c (real)", type: "range", min: -1.5, max: 1.5, step: 0.01 },
        { key: "cImag", label: "Julia c (imag)", type: "range", min: -1.5, max: 1.5, step: 0.01 },
      ],
      draw: drawMandelbrotFamily,
      viewMode: "complex", // pan/zoom mapped to params
    },
  ];

  function get(id) {
    return catalog.find((f) => f.id === id) || catalog[0];
  }

  return { catalog, get, lerpColor, hexToRgb };
})();
