/* Cube-grid → sand animation lifted verbatim from the standalone prototype;
 * only the canvas lookup and loop teardown are adapted for React. */
type Grain = { x: number; y: number; vx: number; vy: number; life: number; age: number; r: number; sandy: number };

export function startHeroAnimation(canvas: HTMLCanvasElement): () => void {
  let rafId = 0;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) return () => {};
  const ctx: CanvasRenderingContext2D = ctx2d;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const W = 640, H = 380;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.scale(DPR, DPR);

  const N = 5, ROWS = 4, BOX = 42, GAP = 16;
  const rowW = N * BOX + (N - 1) * GAP;
  const gridH = ROWS * BOX + (ROWS - 1) * GAP;
  const x0 = (W - rowW) / 2, y0 = 62;
  const gridBottom = y0 + gridH;

  /* staggering runs as a diagonal wave: wave index w = row + col (0..8) */
  const T = {
    appearWave: 130, appearDur: 420,
    preMorph: 450, morphDur: 650, morphWave: 70,
    spinHold: 1800,
    dissolveWave: 300, dissolveDur: 1400,
    logoDur: 3400,
    endPause: 900,
  };
  const MAXW = (N - 1) + (ROWS - 1);
  const allAppeared = MAXW * T.appearWave + T.appearDur;
  const mStart = (w: number) => allAppeared + T.preMorph + w * T.morphWave;
  const lastMorphEnd = mStart(MAXW) + T.morphDur;
  const dStart = (w: number) => lastMorphEnd + T.spinHold + w * T.dissolveWave;
  const logoStart = dStart(MAXW) + T.dissolveDur;
  const loopLen = logoStart + T.logoDur + T.endPause;
  const SPIN = 0.0016;            // rad / ms
  const TILT = -0.42;             // resting X tilt once cubed

  let particles: Grain[] = [];
  let lastT = 0, lastFrame = performance.now(), start = performance.now();
  const spawnAcc = new Array(N * ROWS).fill(0);

  function easeOut(p: number) { return 1 - Math.pow(1 - p, 3); }

  /* icons shown inside the squares (2D phases only).
     Brand paths from simple-icons (CC0), 24x24 viewBox. */
  const ICON_PATHS: Record<string, string> = {
    claude: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z",
    gemini: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
    yc: "M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z",
    opencode: "M22 24H2V0h20zM17 4.8H7v14.4h10z",
  };
  const ICON_P2D: Record<string, Path2D> = {};
  function iconFor(r: number, c: number) {
    if (r === 0) return ['claude', 'codex', 'opencode', 'gemini', 'vscode'][c];
    if (r === 1 && c === 2) return 'goose';
    if (r === 2 && c === 2) return 'pi';
    if (r === 3 && c === 3) return 'yc';
    return null;
  }
  const BRAND: Record<string, string> = { claude: '#D97757', yc: '#F0652F', vscode: '#007ACC' };
  function drawIcon(kind: string, cx: number, cy: number, s: number, onDark?: boolean) {
    ctx.save();
    const col = onDark ? '#d9d9d9' : (BRAND[kind] || '#161616');
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = Math.max(1.6, s * 0.085); ctx.lineCap = 'round';
    const r = s * 0.28;
    if (ICON_PATHS[kind]) {                      // real brand marks (simple-icons, CC0)
      if (!ICON_P2D[kind]) ICON_P2D[kind] = new Path2D(ICON_PATHS[kind]);
      const k = s * 0.55, sc = k / 24;
      ctx.translate(cx - k / 2, cy - k / 2);
      ctx.scale(sc, sc);
      if (kind === 'gemini' && !onDark) {        // Gemini's blue→purple→red gradient
        const g = ctx.createLinearGradient(0, 24, 24, 0);
        g.addColorStop(0, '#217BFE');
        g.addColorStop(0.5, '#9177C7');
        g.addColorStop(1, '#D3646F');
        ctx.fillStyle = g;
      }
      ctx.fill(ICON_P2D[kind]);
    } else if (kind === 'codex') {               // stylized: hexagon
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + k * Math.PI / 3;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    } else if (kind === 'hermes') {              // stylized: wing
      const ox = cx - r, oy = cy + r * 0.6;
      for (let i = 0; i < 3; i++) {
        const t = i / 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(
          cx - r * 0.15, cy - r * (1.15 - t * 0.6),
          cx + r * (1 - t * 0.3), cy - r * (0.6 - t * 0.65));
        ctx.stroke();
      }
    } else if (kind === 'goose') {               // stylized: goose silhouette
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.95, cy + r * 0.1);                                   // tail
      ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 0.95, cx - r * 0.3, cy + r * 0.9);   // belly
      ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.85, cx - r * 0.8, cy + r * 0.15); // chest
      ctx.quadraticCurveTo(cx - r * 0.75, cy - r * 0.35, cx - r * 0.55, cy - r * 0.6); // neck front
      ctx.lineTo(cx - r * 1.2, cy - r * 0.45);                                   // beak tip
      ctx.lineTo(cx - r * 0.45, cy - r * 0.95);                                  // head top
      ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.75, cx - r * 0.12, cy - r * 0.15); // neck back
      ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 0.4, cx + r * 0.95, cy + r * 0.1);   // back
      ctx.closePath(); ctx.fill();
    } else if (kind === 'openclaw') {            // stylized: claw slashes
      for (let i = -1; i <= 1; i++) {
        const d = i * r * 0.62;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.55 + d, cy - r * 0.9);
        ctx.quadraticCurveTo(cx + d, cy - r * 0.05, cx + d + r * 0.4, cy + r * 0.9);
        ctx.stroke();
      }
    } else {                                     // text glyphs
      const glyph = { pi: 'π', vscode: '{ }', terminal: '>_' }[kind];
      if (!glyph) { ctx.restore(); return; }
      ctx.font = `600 ${Math.round(s * 0.40)}px "SF Mono", "Menlo", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, cx, cy + s * 0.02);
    }
    ctx.restore();
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function frame(now: number) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    let t = (now - start) % loopLen;
    if (t < lastT) { particles = []; spawnAcc.fill(0); }   // new loop
    lastT = t;

    ctx.clearRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) for (let c = 0; c < N; c++) {
      const idx = r * N + c;
      const w = r + c;                             // diagonal wave index
      // white fill: top row, center column — except last row, where it's the 2nd box
      const isWhite = r === 0 || (r === ROWS - 1 ? c === 3 : c === 2);
      const bx = x0 + c * (BOX + GAP);
      const by = y0 + r * (BOX + GAP);
      const cx = bx + BOX / 2, cy = by + BOX / 2, s = BOX / 2;
      const aStart = w * T.appearWave;
      const ms = mStart(w);
      const ds = dStart(w);

      if (t < aStart) continue;

      if (t < aStart + T.appearDur) {
        // appearing (flat box)
        const p = easeOut((t - aStart) / T.appearDur);
        const sc = 0.6 + 0.4 * p;
        const sz = BOX * sc, off = (BOX - sz) / 2;
        ctx.globalAlpha = p;
        drawBox(bx + off, by + off, sz, sz, isWhite);
        { const ic = iconFor(r, c); if (ic) drawIcon(ic, cx, cy, sz, !isWhite); }
        ctx.globalAlpha = 1;
      } else if (t < ms) {
        // solid flat box, waiting to cube up
        drawBox(bx, by, BOX, BOX, isWhite);
        { const ic = iconFor(r, c); if (ic) drawIcon(ic, cx, cy, BOX, !isWhite); }
      } else {
        // ---- cube territory ----
        const md = Math.min(1, (t - ms) / T.morphDur);
        const depth = easeOut(md);                 // 0 flat -> 1 full cube
        const dir = (r + c) % 2 ? 1 : -1;          // checkerboard spin directions
        const spd = SPIN * (0.8 + ((r * 5 + c * 3) % 5) * 0.09);
        const ay = dir * spd * (t - ms);           // spin around Y
        const ax = TILT * depth;                   // tilt in as it extrudes

        if (t < ds) {
          // spinning cube (crossfade from rounded box in first 120ms)
          drawCube(cx, cy, s, depth, ay, ax, isWhite);
          const boxA = Math.max(0, 1 - (t - ms) / 120);
          if (boxA > 0) {
            ctx.globalAlpha = boxA;
            drawBox(bx, by, BOX, BOX, isWhite);
            { const ic = iconFor(r, c); if (ic) drawIcon(ic, cx, cy, BOX, !isWhite); }
            ctx.globalAlpha = 1;
          }
        } else if (t < ds + T.dissolveDur) {
          // dissolve the spinning cube from the bottom up
          const p = (t - ds) / T.dissolveDur;
          const Hh = s * 1.7;                      // bounding half-height while spinning
          const lineY = cy + Hh - easeOut(p) * 2 * Hh;
          const clipTop = cy - 2.2 * s;
          if (lineY > clipTop + 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx - 2.2 * s, clipTop, 4.4 * s, lineY - clipTop);
            ctx.clip();
            ctx.globalAlpha = 1 - p * 0.3;
            drawCube(cx, cy, s, depth, ay, ax, isWhite);
            ctx.globalAlpha = 1;
            ctx.restore();
          }
          // spawn sand at the erosion line
          spawnAcc[idx] += dt * 150;
          while (spawnAcc[idx] >= 1) {
            spawnAcc[idx] -= 1;
            particles.push({
              x: cx + (Math.random() - .5) * 2 * s * 1.35,
              y: lineY + (Math.random() - .5) * 3,
              vx: (Math.random() - .5) * 24,
              vy: 10 + Math.random() * 40,
              life: 0.8 + Math.random() * 1.0,
              age: 0,
              r: 0.7 + Math.random() * 1.3,
              sandy: Math.random(),
            });
          }
        }
      }
    }

    // pulsating logo: only the white-square pattern, after the dissolve
    if (t >= logoStart && t < logoStart + T.logoDur) {
      const tl = t - logoStart;
      const fade = Math.min(1, tl / 450) * Math.min(1, (T.logoDur - tl) / 550);
      const breath = 0.72 + 0.28 * Math.sin(2 * Math.PI * tl / 950 - Math.PI / 2);
      ctx.globalAlpha = fade * breath;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < N; c++) {
        const white = r === 0 || (r === ROWS - 1 ? c === 3 : c === 2);
        if (!white) continue;
        const lx = x0 + c * (BOX + GAP), ly = y0 + r * (BOX + GAP);
        drawBox(lx, ly, BOX, BOX, true);
        const ic = iconFor(r, c);
        if (ic) drawIcon(ic, lx + BOX / 2, ly + BOX / 2, BOX);
      }
      ctx.globalAlpha = 1;
    }

    // particles
    for (let k = particles.length - 1; k >= 0; k--) {
      const q = particles[k];
      q.age += dt;
      if (q.age > q.life) { particles.splice(k, 1); continue; }
      q.vy += 300 * dt;                         // gravity
      q.vx *= (1 - 0.6 * dt);
      q.x += q.vx * dt + Math.sin((q.age * 9) + q.r * 40) * 0.25;
      q.y += q.vy * dt;
      const a = 1 - (q.age / q.life);
      // white grains cool into sand
      const mix = Math.min(1, q.age * 1.6 * (0.5 + q.sandy));
      const r = Math.round(237 + (217 - 237) * mix);
      const g = Math.round(237 + (201 - 237) * mix);
      const b = Math.round(237 + (163 - 237) * mix);
      ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.9})`;
      ctx.fillRect(q.x, q.y, q.r, q.r);
    }

    // soft settled dune (radial, no hard edges)
    const duneA = Math.min(0.5, particles.length / 900);
    if (duneA > 0.02) {
      const cx = W / 2, cy = gridBottom + 58;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rowW * 0.6);
      grd.addColorStop(0, `rgba(217,201,163,${duneA * 0.22})`);
      grd.addColorStop(1, 'rgba(217,201,163,0)');
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(1, 0.16); ctx.translate(-cx, -cy);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, rowW * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    rafId = requestAnimationFrame(frame);
  }

  function drawBox(x: number, y: number, w: number, h: number, white: boolean) {
    h = h === undefined ? w : h;
    // glow
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = white ? '#ededed' : '#050505';
    roundRect(x, y, w, h, Math.min(8, h / 2));
    ctx.fill();
    ctx.restore();
    // face + edge
    ctx.fillStyle = white ? '#ededed' : '#0a0a0a';
    roundRect(x, y, w, h, Math.min(10, h / 2));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /* ---- 3D cube ---- */
  const CUBE_V = [
    [-1,-1,-1],[1,-1,-1],[-1,1,-1],[1,1,-1],
    [-1,-1, 1],[1,-1, 1],[-1,1, 1],[1,1, 1],
  ];
  const CUBE_F = [
    [0,1,3,2], [5,4,6,7],   // front, back
    [4,0,2,6], [1,5,7,3],   // left, right
    [4,5,1,0], [2,3,7,6],   // top, bottom
  ];
  const LIGHT = (() => {
    const v = [-0.35, -0.6, -0.72], l = Math.hypot(v[0], v[1], v[2]);
    return v.map((a: number) => a / l);
  })();

  function drawCube(cx: number, cy: number, s: number, depth: number, ay: number, ax: number, white: boolean) {
    const cosY = Math.cos(ay), sinY = Math.sin(ay);
    const cosX = Math.cos(ax), sinX = Math.sin(ax);
    const f = 330;
    const rot: number[][] = [], proj: number[][] = [];
    for (const [vx, vy, vz] of CUBE_V) {
      let x = vx * s, y = vy * s, z = vz * s * Math.max(depth, 0.001);
      // rotate Y
      let x1 = x * cosY + z * sinY;
      let z1 = -x * sinY + z * cosY;
      // rotate X
      let y1 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;
      rot.push([x1, y1, z2]);
      const k = f / (f + z2);
      proj.push([cx + x1 * k, cy + y1 * k]);
    }
    // soft halo (cheaper than per-face shadows at 25 cubes)
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 2.4);
    hg.addColorStop(0, 'rgba(255,255,255,0.10)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(cx - s * 2.4, cy - s * 2.4, s * 4.8, s * 4.8);

    // painter's sort: far faces first
    const order = CUBE_F.map((face, idx) => {
      const z = face.reduce((a, vi) => a + rot[vi][2], 0) / 4;
      return { face, z, idx };
    }).sort((a, b) => b.z - a.z);

    for (const { face } of order) {
      const [a, b, c] = [rot[face[0]], rot[face[1]], rot[face[2]]];
      // outward normal (flip toward face center if needed)
      let nx = (b[1]-a[1])*(c[2]-a[2]) - (b[2]-a[2])*(c[1]-a[1]);
      let ny = (b[2]-a[2])*(c[0]-a[0]) - (b[0]-a[0])*(c[2]-a[2]);
      let nz = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
      const mx = (a[0]+b[0]+c[0]) / 3, my = (a[1]+b[1]+c[1]) / 3, mz = (a[2]+b[2]+c[2]) / 3;
      if (nx*mx + ny*my + nz*mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      const br = Math.max(0, (nx*LIGHT[0] + ny*LIGHT[1] + nz*LIGHT[2]) / nl);
      const g = white ? Math.round(168 + 87 * br) : Math.round(8 + 26 * br);

      ctx.beginPath();
      ctx.moveTo(proj[face[0]][0], proj[face[0]][1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(proj[face[k]][0], proj[face[k]][1]);
      ctx.closePath();
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fill();

      ctx.strokeStyle = white ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(proj[face[0]][0], proj[face[0]][1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(proj[face[k]][0], proj[face[k]][1]);
      ctx.closePath();
      ctx.stroke();
    }
  }

    rafId = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(rafId);
}
