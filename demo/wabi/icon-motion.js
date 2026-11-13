// Studio icon-motion engine for demo/wabi/ (keeps src/plugin/motion.js untouched).
// Compares three attention-budget strategies at 20x20 (viewBox 0 0 32 32):
// - 'balanced' (recommended): 5-beat travelling wave on `running` (de-synced across cards)
//   + stationary bracketed slow cursor breath (2.6s) on `approval`; all other states 0 Hz.
// - 'running-only': only `running` moves; `approval` stays 100% static high-contrast amber.
// - 'orbital': classic rotating chasing arcs on `running` + expanding bracket pulse on `approval`.
// - 'off': all icons 0 Hz static.

const NS = 'http://www.w3.org/2000/svg';
const POINTS = 12;
const SLOTS = 8;
const TAU = Math.PI * 2;

const lerp = (a, b, u) => a + (b - a) * u;

function sample(fn, alpha = 1, width = 1.9) {
  return {
    points: Array.from({ length: POINTS }, (_, i) => fn(i / (POINTS - 1))),
    alpha,
    width,
  };
}

const line = (x1, y1, x2, y2, alpha = 1, width = 1.9) =>
  sample(u => [lerp(x1, x2, u), lerp(y1, y2, u)], alpha, width);

const dot = (x, y, alpha = 1, width = 3) => line(x, y, x + 0.001, y, alpha, width);

const arc = (a1, a2, r, alpha = 1, width = 2.1, cx = 16, cy = 16) =>
  sample(u => {
    const a = lerp(a1, a2, u);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }, alpha, width);

function poly(vertices, alpha = 1, width = 1.8) {
  const segs = vertices.slice(1).map((v, i) => Math.hypot(v[0] - vertices[i][0], v[1] - vertices[i][1]));
  const total = segs.reduce((a, b) => a + b, 0) || 1;
  return sample(u => {
    let rem = u * total, idx = 0;
    while (idx < segs.length - 1 && rem > segs[idx]) rem -= segs[idx++];
    const k = segs[idx] ? rem / segs[idx] : 0;
    return [lerp(vertices[idx][0], vertices[idx + 1][0], k), lerp(vertices[idx][1], vertices[idx + 1][1], k)];
  }, alpha, width);
}

const padSlots = shapes => Array.from({ length: SLOTS }, (_, i) => shapes[i] || dot(16, 16, 0, 2));

export function createStudioIconMotion(initialMode = 'balanced') {
  const items = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let mode = initialMode;
  let frame = 0;
  let previous = 0;
  let alive = true;
  let seq = 0;

  const isOff = () => mode === 'off' || reduced.matches;

  function isAnimatedKind(kind) {
    if (isOff()) return false;
    if (kind === 'running') return true;
    if (kind === 'approval') return mode === 'balanced' || mode === 'orbital';
    return false;
  }

  function pose(kind, seconds, phaseOffset) {
    const still = isOff();
    const t = still ? 0.65 : seconds;

    if (kind === 'running') {
      if (mode === 'orbital') {
        const base = still ? -0.7 : t * 3.8 + phaseOffset;
        const sweep = still ? 2.05 : 1.75 + 0.55 * Math.sin(t * 2.2 + phaseOffset);
        return padSlots([
          arc(0, TAU, 8.8, 0.16, 1.7),
          arc(base, base + sweep, 8.8, 0.98, 2.35),
          arc(base + Math.PI, base + Math.PI + 1.05, 8.8, 0.42, 1.95),
        ]);
      }
      // Family-11 fivebeat travelling wave (both height & luminance glide across 5 bars).
      return padSlots([0, 1, 2, 3, 4].map(i => {
        const w = still ? [0.22, 0.58, 0.96, 0.62, 0.28][i] : 0.5 + 0.5 * Math.sin(t * 3.1 - i * 0.82 + phaseOffset);
        const eased = still ? w : Math.pow(w, 1.35);
        const h = 2.6 + 9.4 * eased;
        const alpha = still ? 0.45 + i * 0.12 : 0.28 + 0.72 * eased;
        const width = 2.0 + 0.45 * eased;
        return line(7 + i * 4.5, 16 - h / 2, 7 + i * 4.5, 16 + h / 2, alpha, width);
      }));
    }

    if (kind === 'approval') {
      if (mode === 'orbital' && !still) {
        // Expressive contrast mode: both outer brackets & inner bars pulse faster (1.45s).
        const p = 0.5 - 0.5 * Math.cos((t * TAU) / 1.45 + phaseOffset * 0.5);
        const dx = 1.45 * p;
        const half = 2.8 + 1.8 * p;
        return padSlots([
          poly([[9.4 - dx, 10.4], [6.5 - dx, 10.4], [6.5 - dx, 21.6], [9.4 - dx, 21.6]], 0.42 + 0.4 * p, 1.8),
          poly([[22.6 + dx, 10.4], [25.5 + dx, 10.4], [25.5 + dx, 21.6], [22.6 + dx, 21.6]], 0.42 + 0.4 * p, 1.8),
          line(13.8, 16 - half, 13.8, 16 + half, 0.35 + 0.65 * p, 2.25),
          line(18.2, 16 - half, 18.2, 16 + half, 0.35 + 0.65 * p, 2.25),
        ]);
      }
      // Static outer `[  ]` brackets signify "paused / bounded".
      // In `balanced`, inner prompt breathes slowly (2.6s) like a terminal cursor waiting on user input.
      // In `running-only` (or `off`), inner prompt stays 100% static at crisp contrast.
      const animatePrompt = mode === 'balanced' && !still;
      const raw = animatePrompt ? 0.5 - 0.5 * Math.cos((t * TAU) / 2.6 + phaseOffset * 0.25) : 1;
      const breath = animatePrompt ? Math.pow(raw, 0.85) : 1;
      const half = animatePrompt ? 3.1 + 1.15 * breath : 3.9;
      const alpha = animatePrompt ? 0.20 + 0.80 * breath : 0.95;
      const width = animatePrompt ? 2.1 + 0.25 * breath : 2.25;
      return padSlots([
        poly([[9.2, 10.6], [6.5, 10.6], [6.5, 21.4], [9.2, 21.4]], 0.48, 1.75),
        poly([[22.8, 10.6], [25.5, 10.6], [25.5, 21.4], [22.8, 21.4]], 0.48, 1.75),
        line(13.8, 16 - half, 13.8, 16 + half, alpha, width),
        line(18.2, 16 - half, 18.2, 16 + half, alpha, width),
      ]);
    }

    if (kind === 'unread') {
      return padSlots([
        dot(7, 16, 0.28, 2.3),
        line(12, 16, 19, 16, 0.48, 1.75),
        dot(25, 16, 1, 3.8),
      ]);
    }

    if (kind === 'draft') {
      return padSlots([
        line(6, 12, 21, 12, 0.55, 1.6),
        line(6, 18, 15, 18, 0.55, 1.6),
        line(20, 23, 26, 17, 0.95, 2.1),
      ]);
    }

    // `idle`: 5 quiet equal bars, 0 Hz.
    return padSlots([0, 1, 2, 3, 4].map(i => line(7 + i * 4.5, 13.2, 7 + i * 4.5, 18.8, 0.56, 1.8)));
  }

  function draw(item, index) {
    const shape = item.current[index];
    const path = item.paths[index];
    const old = item.rendered[index];
    const d = shape.points.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`).join(' ');
    const alpha = shape.alpha.toFixed(3);
    const width = shape.width.toFixed(2);
    if (old.d !== d) { path.setAttribute('d', d); old.d = d; }
    if (old.alpha !== alpha) { path.setAttribute('opacity', alpha); old.alpha = alpha; }
    if (old.width !== width) { path.setAttribute('stroke-width', width); old.width = width; }
  }

  function clonePose(shapes) {
    return shapes.map(s => ({ points: s.points.map(([x, y]) => [x, y]), alpha: s.alpha, width: s.width }));
  }

  function tick(now) {
    frame = 0;
    if (!alive || document.hidden) return;
    const dt = Math.min(48, previous ? now - previous : 16);
    previous = now;
    const seconds = (now - start) / 1000;
    let keepLooping = false;

    for (const item of items) {
      const anim = isAnimatedKind(item.kind);
      if (!item.morphing && !anim) continue;

      const target = pose(item.kind, seconds, item.phaseOffset);
      // Only damp during state/mode morphs; steady-state waves render crisp unattenuated peaks.
      const blend = !item.morphing || isOff() ? 1 : 1 - Math.exp(-dt / 62);
      let unsettled = false;

      for (let i = 0; i < SLOTS; i++) {
        const cur = item.current[i];
        const tgt = target[i];
        for (let j = 0; j < POINTS; j++) {
          for (let k = 0; k < 2; k++) {
            const delta = tgt.points[j][k] - cur.points[j][k];
            if (Math.abs(delta) > 0.02) unsettled = true;
            cur.points[j][k] = blend === 1 ? tgt.points[j][k] : cur.points[j][k] + delta * blend;
          }
        }
        if (Math.abs(tgt.alpha - cur.alpha) > 0.012 || Math.abs(tgt.width - cur.width) > 0.012) unsettled = true;
        cur.alpha = blend === 1 ? tgt.alpha : cur.alpha + (tgt.alpha - cur.alpha) * blend;
        cur.width = blend === 1 ? tgt.width : cur.width + (tgt.width - cur.width) * blend;
        draw(item, i);
      }

      if (item.morphing) {
        item.morphElapsed += dt;
        if (!unsettled || item.morphElapsed > 320 || isOff()) item.morphing = false;
      }
      if (item.morphing || anim) keepLooping = true;
    }

    if (keepLooping) frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (alive && !frame && !document.hidden) {
      previous = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  const onVisibility = () => { cancelAnimationFrame(frame); frame = 0; wake(); };
  const onReduced = () => {
    for (const item of items) { item.morphing = true; item.morphElapsed = 0; }
    wake();
  };
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onReduced);

  return {
    mount(host, kind, draft) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 32 32');
      svg.setAttribute('aria-hidden', 'true');
      svg.dataset.iconFamily = '11';
      svg.dataset.state = kind;

      const paths = Array.from({ length: SLOTS }, () => {
        const p = document.createElementNS(NS, 'path');
        svg.append(p);
        return p;
      });
      const badge = document.createElementNS(NS, 'path');
      badge.setAttribute('d', 'M24.1 26.4 L27.4 23.1');
      badge.setAttribute('stroke-width', '1.8');
      svg.append(badge);
      host.append(svg);

      const phaseOffset = (seq++ % 5) * 1.15;
      const initial = clonePose(pose(kind, (performance.now() - start) / 1000, phaseOffset));
      const item = {
        paths,
        svg,
        kind,
        phaseOffset,
        current: initial,
        rendered: Array.from({ length: SLOTS }, () => ({})),
        morphing: false,
        morphElapsed: 0,
        draft: undefined,
      };
      items.add(item);
      for (let i = 0; i < SLOTS; i++) draw(item, i);

      const update = (nextKind, hasDraft) => {
        if (item.kind !== nextKind) {
          item.kind = nextKind;
          item.morphing = !isOff();
          item.morphElapsed = 0;
          svg.dataset.state = nextKind;
          if (isOff()) {
            item.current = clonePose(pose(nextKind, 0.65, item.phaseOffset));
            for (let i = 0; i < SLOTS; i++) draw(item, i);
          } else {
            wake();
          }
        }
        const showBadge = !!hasDraft && !['idle', 'draft'].includes(nextKind);
        if (item.draft !== showBadge) {
          item.draft = showBadge;
          badge.setAttribute('opacity', showBadge ? '.85' : '0');
        }
      };

      update(kind, draft);
      if (isAnimatedKind(kind)) wake();
      return { update };
    },

    setMode(nextMode) {
      if (mode === nextMode) return;
      mode = nextMode;
      for (const item of items) {
        if (isOff()) {
          item.morphing = false;
          item.current = clonePose(pose(item.kind, 0.65, item.phaseOffset));
          for (let i = 0; i < SLOTS; i++) draw(item, i);
        } else {
          item.morphing = true;
          item.morphElapsed = 0;
        }
      }
      if (!isOff()) wake();
      else { cancelAnimationFrame(frame); frame = 0; }
    },

    destroy() {
      alive = false;
      cancelAnimationFrame(frame);
      items.clear();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReduced);
    },
  };
}
