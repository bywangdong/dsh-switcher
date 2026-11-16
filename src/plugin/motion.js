// Family-11 status motion engine with configurable attention-budget modes:
// - 'balanced' (default in preferences): de-synced 5-beat wave on `running` + stationary
//   outer `[  ]` brackets with a slow 2.6s cursor breath on `approval`; all others 0 Hz.
// - 'running-only': only `running` moves; `approval` stays 100% static high-contrast.
// - 'orbital': rotating chasing arcs on `running` + 1.45s bracket pulse on `approval`.
// - 'classic': original family-11 geometry, timing and damped morphs.
// - 'off': static poses across all states, zero RAF frames.
export function createFivebeatMotion(initialMode = 'classic') {
  const ns = 'http://www.w3.org/2000/svg';
  const pointsCount = 12, slotsCount = 8, tau = Math.PI * 2;
  const items = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const start = performance.now();
  let mode = initialMode, frame = 0, previous = 0, alive = true, seq = 0;

  const lerp = (a, b, u) => a + (b - a) * u;
  const sample = (fn, alpha = 1, width = 1.9, curved = false) => ({
    points: Array.from({ length: pointsCount }, (_, i) => fn(i / (pointsCount - 1))),
    alpha, width, curved,
  });
  const line = (x1, y1, x2, y2, alpha = 1, width = 1.9) =>
    sample(u => [lerp(x1, x2, u), lerp(y1, y2, u)], alpha, width, false);
  const dot = (x, y, alpha = 1, width = 3) => line(x, y, x + .001, y, alpha, width);
  const arc = (a1, a2, r, alpha = 1, width = 2.1, cx = 16, cy = 16) =>
    sample(u => {
      const a = lerp(a1, a2, u);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }, alpha, width, true);
  function poly(vertices, alpha = 1, width = 1.8) {
    const segs = vertices.slice(1).map((v, i) => Math.hypot(v[0] - vertices[i][0], v[1] - vertices[i][1]));
    const total = segs.reduce((a, b) => a + b, 0) || 1;
    return sample(u => {
      let rem = u * total, idx = 0;
      while (idx < segs.length - 1 && rem > segs[idx]) rem -= segs[idx++];
      const k = segs[idx] ? rem / segs[idx] : 0;
      return [lerp(vertices[idx][0], vertices[idx + 1][0], k), lerp(vertices[idx][1], vertices[idx + 1][1], k)];
    }, alpha, width, true);
  }
  const padSlots = shapes => Array.from({ length: slotsCount }, (_, i) => shapes[i] || dot(16, 16, 0, 3));
  const clonePose = shapes => shapes.map(s => ({ points: s.points.map(([x, y]) => [x, y]), alpha: s.alpha, width: s.width, curved: s.curved }));
  const isOff = () => mode === 'off' || reduced.matches;

  function animated(kind) {
    if (isOff()) return false;
    if (kind === 'running') return true;
    if (kind === 'approval') return mode === 'balanced' || mode === 'orbital' || mode === 'classic';
    return false;
  }

  function pose(kind, seconds, phaseOffset = 0) {
    const still = isOff();
    const t = still ? .65 : seconds;

    if (mode === 'classic') {
      const breath = still ? .5 : (1 - Math.cos(t * tau / 3.4)) * .5;
      if (kind === 'running') return padSlots([0, 1, 2, 3, 4].map(i => {
        const h = 2 + 8 * Math.pow(.5 + .5 * Math.sin(t * 2.4 - i * .9), 1.7);
        return line(7 + i * 4.5, 16 - h / 2, 7 + i * 4.5, 16 + h / 2, .45 + i * .12, 2.4);
      }));
      if (kind === 'approval') {
        const half = 2.7 + .55 * breath;
        return padSlots([line(6, 14, 6, 18, .45, 1.8), line(26, 14, 26, 18, .45, 1.8),
          line(13.7, 16 - half, 13.7, 16 + half, .88 + .12 * breath, 2.2),
          line(18.3, 16 - half, 18.3, 16 + half, .88 + .12 * breath, 2.2)]);
      }
      if (kind === 'unread') return padSlots([dot(7, 16, .25, 2.3), line(12, 16, 19, 16, .45, 1.7), dot(25, 16, 1, 3.7)]);
      if (kind === 'draft') return padSlots([line(6, 12, 21, 12, .55, 1.6), line(6, 18, 15, 18, .55, 1.6), line(20, 23, 26, 17, .95, 2.1)]);
      return padSlots([0, 1, 2, 3, 4].map(i => line(7 + i * 4.5, 13, 7 + i * 4.5, 19, .6, 1.8)));
    }

    if (kind === 'running') {
      if (mode === 'orbital') {
        const base = still ? -.7 : t * 3.8 + phaseOffset;
        const sweep = still ? 2.05 : 1.75 + .55 * Math.sin(t * 2.2 + phaseOffset);
        return padSlots([
          arc(0, tau, 8.8, .16, 1.7),
          arc(base, base + sweep, 8.8, .98, 2.35),
          arc(base + Math.PI, base + Math.PI + 1.05, 8.8, .42, 1.95),
        ]);
      }
      return padSlots([0, 1, 2, 3, 4].map(i => {
        const w = still ? [.22, .58, .96, .62, .28][i] : .5 + .5 * Math.sin(t * 3.1 - i * .82 + phaseOffset);
        const eased = still ? w : Math.pow(w, 1.35);
        const h = 2.6 + 9.4 * eased;
        const alpha = still ? .45 + i * .12 : .28 + .72 * eased;
        const width = 2.0 + .45 * eased;
        return line(7 + i * 4.5, 16 - h / 2, 7 + i * 4.5, 16 + h / 2, alpha, width);
      }));
    }

    if (kind === 'approval') {
      if (mode === 'orbital' && !still) {
        const p = .5 - .5 * Math.cos((t * tau) / 1.45 + phaseOffset * .5);
        const dx = 1.45 * p, half = 2.8 + 1.8 * p;
        return padSlots([
          poly([[9.4 - dx, 10.4], [6.5 - dx, 10.4], [6.5 - dx, 21.6], [9.4 - dx, 21.6]], .42 + .4 * p, 1.8),
          poly([[22.6 + dx, 10.4], [25.5 + dx, 10.4], [25.5 + dx, 21.6], [22.6 + dx, 21.6]], .42 + .4 * p, 1.8),
          line(13.8, 16 - half, 13.8, 16 + half, .35 + .65 * p, 2.25),
          line(18.2, 16 - half, 18.2, 16 + half, .35 + .65 * p, 2.25),
        ]);
      }
      const animatePrompt = mode === 'balanced' && !still;
      const raw = animatePrompt ? .5 - .5 * Math.cos((t * tau) / 2.6 + phaseOffset * .25) : 1;
      const breath = animatePrompt ? Math.pow(raw, .85) : 1;
      const half = animatePrompt ? 3.1 + 1.15 * breath : 3.9;
      const alpha = animatePrompt ? .20 + .80 * breath : .95;
      const width = animatePrompt ? 2.1 + .25 * breath : 2.25;
      return padSlots([
        poly([[9.2, 10.6], [6.5, 10.6], [6.5, 21.4], [9.2, 21.4]], .48, 1.75),
        poly([[22.8, 10.6], [25.5, 10.6], [25.5, 21.4], [22.8, 21.4]], .48, 1.75),
        line(13.8, 16 - half, 13.8, 16 + half, alpha, width),
        line(18.2, 16 - half, 18.2, 16 + half, alpha, width),
      ]);
    }

    if (kind === 'unread') return padSlots([dot(7, 16, .34, 2.35), line(12, 16, 19, 16, .56, 1.8), dot(25, 16, 1, 3.8)]);
    if (kind === 'draft') return padSlots([line(6, 12, 21, 12, .64, 1.65), line(6, 18, 15, 18, .64, 1.65), line(20, 23, 26, 17, .98, 2.1)]);
    if (kind === 'idle-fresh') {
      return padSlots([0, 1, 2, 3, 4].map(i => line(7 + i * 4.5, 11.8, 7 + i * 4.5, 20.2, .96, 2.05)));
    }
    if (kind === 'idle-warm') {
      return padSlots([0, 1, 2, 3, 4].map(i => i < 3
        ? line(7 + i * 4.5, 12.5, 7 + i * 4.5, 19.5, .9, 1.95)
        : dot(7 + i * 4.5, 16, .42, 2.25)));
    }
    if (kind === 'idle-today') {
      return padSlots([0, 1, 2, 3, 4].map(i => i < 1
        ? line(7 + i * 4.5, 13, 7 + i * 4.5, 19, .82, 1.9)
        : dot(7 + i * 4.5, 16, .38, 2.2)));
    }
    if (kind === 'idle-cold') {
      return padSlots([0, 1, 2, 3, 4].map(i => dot(7 + i * 4.5, 16, .58, 2.35)));
    }
    return padSlots([0, 1, 2, 3, 4].map(i => line(7 + i * 4.5, 13, 7 + i * 4.5, 19, .74, 1.85)));
  }

  function draw(item, index) {
    const shape = item.current[index], path = item.paths[index], old = item.rendered[index];
    const pts = shape.curved ? shape.points : [shape.points[0], shape.points[pointsCount - 1]];
    const d = pts.map((point, i) => `${i ? 'L' : 'M'}${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(' ');
    const alpha = shape.alpha.toFixed(3), width = shape.width.toFixed(2);
    if (old.d !== d) { path.setAttribute('d', d); old.d = d; }
    if (old.alpha !== alpha) { path.setAttribute('opacity', alpha); old.alpha = alpha; }
    if (old.width !== width) { path.setAttribute('stroke-width', width); old.width = width; }
  }

  function tick(now) {
    frame = 0;
    if (!alive || document.hidden) return;
    const dt = Math.min(48, previous ? now - previous : 32);
    previous = now;
    const seconds = (now - start) / 1000;
    let moving = false;

    for (const item of items) {
      const anim = animated(item.kind);
      if (!item.morphing && !anim) continue;
      const target = pose(item.kind, seconds, item.phaseOffset);
      const blend = isOff() ? 1 : (mode === 'classic' ? 1 - Math.exp(-dt / 68) : (!item.morphing ? 1 : 1 - Math.exp(-dt / 62)));
      let unsettled = false;

      for (let i = 0; i < slotsCount; i++) {
        const cur = item.current[i], tgt = target[i];
        let slotUnsettled = false;
        for (let j = 0; j < pointsCount; j++) {
          for (let k = 0; k < 2; k++) {
            const delta = tgt.points[j][k] - cur.points[j][k];
            if (Math.abs(delta) > .018) slotUnsettled = unsettled = true;
            cur.points[j][k] = blend === 1 ? tgt.points[j][k] : cur.points[j][k] + delta * blend;
          }
        }
        if (Math.abs(tgt.alpha - cur.alpha) > .01 || Math.abs(tgt.width - cur.width) > .01) unsettled = true;
        cur.alpha = blend === 1 ? tgt.alpha : cur.alpha + (tgt.alpha - cur.alpha) * blend;
        cur.width = blend === 1 ? tgt.width : cur.width + (tgt.width - cur.width) * blend;
        cur.curved = tgt.curved || (cur.curved && slotUnsettled && blend < 1);
        draw(item, i);
      }

      if (item.morphing) {
        item.morphElapsed += dt;
        if (!unsettled || (mode !== 'classic' && item.morphElapsed > 320) || isOff()) item.morphing = false;
      }
      moving ||= item.morphing || anim;
    }

    if (moving) frame = requestAnimationFrame(tick);
  }

  function wake() { if (alive && !frame && !document.hidden) { previous = 0; frame = requestAnimationFrame(tick); } }
  const visibility = () => { cancelAnimationFrame(frame); frame = 0; wake(); };
  const preference = () => {
    for (const item of items) { item.morphing = true; item.morphElapsed = 0; }
    wake();
  };
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', preference);

  return {
    get mode() { return mode; },
    mount(host, kind, draft) {
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true'); svg.dataset.iconFamily = '11';
      const paths = Array.from({ length: slotsCount }, () => { const p = document.createElementNS(ns, 'path'); svg.append(p); return p; });
      const badge = document.createElementNS(ns, 'path');
      badge.setAttribute('d', 'M24.1 26.4 L27.4 23.1'); badge.setAttribute('stroke-width', '1.8'); svg.append(badge); host.append(svg);
      const phaseOffset = (seq++ % 5) * 1.15;
      const initialTime = mode === 'classic' || isOff() ? .65 : (performance.now() - start) / 1000;
      const item = {
        paths, svg, kind, phaseOffset,
        current: clonePose(pose(kind, initialTime, phaseOffset)),
        rendered: Array.from({ length: slotsCount }, () => ({})),
        morphing: false, morphElapsed: 0, draft: undefined,
      };
      items.add(item);
      paths.forEach((_, index) => draw(item, index));
      const update = (next, hasDraft) => {
        if (item.kind !== next) {
          item.kind = next; svg.dataset.state = next;
          if (isOff()) {
            item.morphing = false;
            item.current = clonePose(pose(next, .65, item.phaseOffset));
            paths.forEach((_, index) => draw(item, index));
          } else {
            item.morphing = true; item.morphElapsed = 0; wake();
          }
        }
        const showBadge = !!hasDraft && !String(next).startsWith('idle') && next !== 'draft';
        if (item.draft !== showBadge) { item.draft = showBadge; badge.setAttribute('opacity', showBadge ? '.85' : '0'); }
      };
      svg.dataset.state = kind;
      update(kind, draft);
      if (animated(kind)) wake();
      return { update };
    },
    setMode(nextMode) {
      if (mode === nextMode) return;
      mode = nextMode;
      for (const item of items) {
        if (isOff()) {
          item.morphing = false;
          item.current = clonePose(pose(item.kind, .65, item.phaseOffset));
          item.paths.forEach((_, index) => draw(item, index));
        } else {
          item.morphing = true; item.morphElapsed = 0;
        }
      }
      if (!isOff()) wake();
      else { cancelAnimationFrame(frame); frame = 0; }
    },
    destroy() {
      alive = false; cancelAnimationFrame(frame); items.clear();
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', preference);
    },
  };
}
