import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrefsStore, sessionPresentation } from '../src/plugin/core.js';
import { mountSwitcher } from '../src/plugin/view.js';
import { mountSettingsPanel } from '../src/plugin/settings.js';

function domEnvironment(t) {
  class Node extends EventTarget {
    children = [];
    attributes = new Map();
    dataset = {};
    style = { setProperty(k, v) { this[k] = v; } };
    className = '';
    id = '';
    tabIndex = 0;
    _text = '';
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); if (v === '') this.children = []; }
    title = '';
    disabled = false;
    scrollLeft = 0;
    clientWidth = 900;
    scrollWidth = 100;
    clientHeight = 40;
    scrollHeight = 20;
    offsetWidth = 176;
    isConnected = true;
    parent = null;

    append(...nodes) {
      for (const child of nodes) {
        if (child && typeof child === 'object') {
          child.parent = this;
          this.children.push(child);
        }
      }
    }
    remove() {
      if (!this.parent) return;
      this.parent.children = this.parent.children.filter(c => c !== this);
      this.parent = null;
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    removeAttribute(k) { this.attributes.delete(k); }
    focus() {}
    contains() { return false; }
    querySelector() { return null; }
  }

  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    activeElement: null,
    createElement: () => new Node(),
    createElementNS: () => new Node(),
    querySelector: () => null,
  });
  const win = Object.assign(new EventTarget(), {
    getSelection: () => null,
  });
  const media = Object.assign(new EventTarget(), { matches: false });
  let frameId = 0;
  const frames = new Map();
  const globals = {
    window: win,
    document: doc,
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    matchMedia: () => media,
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const prev = new Map(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, v] of Object.entries(globals)) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v });
  t.after(() => {
    for (const [k, d] of prev) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  });

  function findAll(root, pred, out = []) {
    if (pred(root)) out.push(root);
    for (const c of root.children) findAll(c, pred, out);
    return out;
  }

  return { Node, findAll, flushFrames() { const fns = [...frames.values()]; frames.clear(); fns.forEach(fn => fn(performance.now())); } };
}

test('mountSwitcher switches cleanly across Status-First, B2, and Split editions and positions the lens', async t => {
  const env = domEnvironment(t);
  const prefs = createPrefsStore();
  const listeners = new Set();
  prefs.subscribe(() => { for (const fn of [...listeners]) fn(); });

  const container = new env.Node();
  const ids = ['s1', 's2', 's3'];
  const host = {
    current: () => 's1',
    candidates: () => ids,
    exists: id => ids.includes(id),
    theme: () => 'dark',
    prefs: () => prefs.getSnapshot(),
    row: id => ({
      id,
      title: `标题-${id}`,
      workspaceName: 'Agent',
      text: '用户输入原文',
      placeholder: '还没有输入',
      ...sessionPresentation(id === 's2' ? { running: true } : {}, { updatedAt: Date.now() - 60000 }, false),
    }),
    preview: () => () => {},
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    open() {},
  };

  const sw = mountSwitcher(container, host);
  sw.begin(1, true);
  await new Promise(r => setTimeout(r, 10));

  const overlay = container.children[0];
  assert.equal(overlay.dataset.edition, 'kibutsu');
  assert.equal(overlay.dataset.motion, 'balanced');
  assert.equal(overlay.dataset.lens, 'true');

  // Status-First (`kibutsu`) has no excerpt and no `当前` badge; status is the 1st child of each card.
  let cards = env.findAll(overlay, n => n.className === 'dsh-switcher-card');
  assert.equal(cards.length, 3);
  assert.equal(cards[0].children[0].className, 'dsh-switcher-status');
  assert.equal(cards[0].children[1].className, 'dsh-switcher-title');
  assert.equal(cards[0].children[2].className, 'dsh-switcher-project');
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-excerpt').length, 0);
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-here').length, 0);

  let lens = env.findAll(overlay, n => n.className === 'dsh-switcher-lens')[0];
  assert.equal(lens.style.transform, 'translate3d(182px, 0, 0)');

  // Step to s3 (adjacent glide) then wrap around to s1 (snap).
  sw.begin(1, true);
  assert.equal(lens.style.transform, 'translate3d(364px, 0, 0)');
  sw.begin(1, true);
  assert.equal(lens.style.transform, 'translate3d(0px, 0, 0)');

  // Switch live to B2: 4-row card with capsule + excerpt, still no `当前` badge.
  prefs.update({ edition: 'b2' });
  env.flushFrames();
  assert.equal(overlay.dataset.edition, 'b2');
  cards = env.findAll(overlay, n => n.className === 'dsh-switcher-card');
  assert.equal(cards[0].children[0].className, 'dsh-switcher-project');
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-excerpt').length, 3);
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-here').length, 0);

  // Switch live to Split + Classic: classic cap + `当前` badge, lens disabled.
  prefs.update({ edition: 'split', motion: 'classic' });
  env.flushFrames();
  assert.equal(overlay.dataset.edition, 'split');
  assert.equal(overlay.dataset.motion, 'classic');
  assert.equal(overlay.dataset.lens, undefined);
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-here').length, 3);

  sw.destroy();
  assert.equal(container.children.length, 0);
});

test('mountSettingsPanel renders 6 editions, 5 motions, and isolated inline preview', t => {
  const env = domEnvironment(t);
  const prefs = createPrefsStore();
  const container = new env.Node();
  let previewCalls = 0;

  const panel = mountSettingsPanel(container, {
    prefs,
    getTheme: () => 'dark',
    canPreview: () => true,
    onPreview: () => { previewCalls++; },
  });

  const editionBtns = env.findAll(container, n => Boolean(n.dataset?.editionOpt));
  const motionBtns = env.findAll(container, n => Boolean(n.dataset?.motionOpt));
  assert.equal(editionBtns.length, 6);
  assert.equal(motionBtns.length, 5);

  const inlineOverlay = env.findAll(container, n => n.className === 'dsh-switcher')[0];
  assert.equal(inlineOverlay.dataset.inlinePreview, 'true');
  assert.equal(inlineOverlay.dataset.shortcutModal, undefined, 'inline preview must not block Ctrl+Tab');
  assert.equal(inlineOverlay.getAttribute('aria-modal'), null);

  // Clicking an edition radio button updates prefs and the inline preview immediately.
  const jiechiBtn = editionBtns.find(b => b.dataset.editionOpt === 'jiechi');
  jiechiBtn.dispatchEvent(new Event('click'));
  assert.equal(prefs.getSnapshot().edition, 'jiechi');
  assert.equal(jiechiBtn.getAttribute('aria-checked'), 'true');
  assert.equal(inlineOverlay.dataset.edition, 'jiechi');

  const openBtn = env.findAll(container, n => n.dataset?.action === 'open-overlay')[0];
  openBtn.dispatchEvent(new Event('click'));
  assert.equal(previewCalls, 1);

  panel.destroy();
  assert.equal(container.children.length, 0);
});
