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
  assert.equal(overlay.dataset.ink, 'crisp');
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

  // Switch live to Split + Classic + Medium ink: classic cap + `当前` badge, lens disabled.
  prefs.update({ edition: 'split', motion: 'classic', ink: 'medium' });
  env.flushFrames();
  assert.equal(overlay.dataset.edition, 'split');
  assert.equal(overlay.dataset.motion, 'classic');
  assert.equal(overlay.dataset.ink, 'medium');
  assert.equal(overlay.dataset.lens, undefined);
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-here').length, 3);

  // Refinements default to the baseline and apply live as overlay attributes.
  assert.equal(overlay.dataset.project, 'plain');
  assert.equal(overlay.dataset.signal, 'attention');
  assert.equal(overlay.dataset.title, 'lead');
  prefs.update({ edition: 'kibutsu', project: 'chip', signal: 'classic', title: 'even' });
  env.flushFrames();
  assert.equal(overlay.dataset.project, 'chip');
  assert.equal(overlay.dataset.signal, 'classic');
  assert.equal(overlay.dataset.title, 'even');
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-switcher-card').length, 3);
  assert.equal(env.findAll(overlay, n => n.className === 'dsh-ws-chip').length, 3);

  sw.destroy();
  assert.equal(container.children.length, 0);
});

test('mountSettingsPanel renders 6 editions, 3 ink modes, 5 motions, and isolated inline preview', t => {
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

  const scopeBtns = env.findAll(container, n => Boolean(n.dataset?.scopeOpt));
  const editionBtns = env.findAll(container, n => Boolean(n.dataset?.editionOpt));
  const inkBtns = env.findAll(container, n => Boolean(n.dataset?.inkOpt));
  const motionBtns = env.findAll(container, n => Boolean(n.dataset?.motionOpt));
  assert.equal(scopeBtns.length, 4);
  assert.equal(editionBtns.length, 6);
  assert.equal(inkBtns.length, 3);
  assert.equal(motionBtns.length, 5);

  const inlineOverlay = env.findAll(container, n => n.className === 'dsh-switcher')[0];
  const inlinePanel = env.findAll(inlineOverlay, n => n.className === 'dsh-switcher-panel')[0];
  assert.equal(inlineOverlay.dataset.inlinePreview, 'true');
  assert.equal(inlineOverlay.dataset.shortcutModal, undefined, 'inline preview must not block Ctrl+Tab');
  assert.equal(inlineOverlay.getAttribute('aria-modal'), null);
  assert.equal(inlineOverlay.dataset.scope, 'hot');
  assert.equal(env.findAll(inlineOverlay, n => n.className === 'dsh-switcher-card').length, 4);
  assert.equal(inlinePanel.style['--sw-width'], '760px');

  // Switching candidate scope resizes the inline preview dynamically (3 -> 5 -> 4 cards).
  scopeBtns.find(b => b.dataset.scopeOpt === 'top3').dispatchEvent(new Event('click'));
  assert.equal(prefs.getSnapshot().scope, 'top3');
  assert.equal(inlineOverlay.dataset.scope, 'top3');
  assert.equal(env.findAll(inlineOverlay, n => n.className === 'dsh-switcher-card').length, 3);
  assert.equal(inlinePanel.style['--sw-width'], '578px');

  scopeBtns.find(b => b.dataset.scopeOpt === 'day').dispatchEvent(new Event('click'));
  assert.equal(prefs.getSnapshot().scope, 'day');
  assert.equal(env.findAll(inlineOverlay, n => n.className === 'dsh-switcher-card').length, 5);
  assert.equal(inlinePanel.style['--sw-width'], '942px');

  // Clicking an edition or ink radio button updates prefs and the inline preview immediately.
  const jiechiBtn = editionBtns.find(b => b.dataset.editionOpt === 'jiechi');
  jiechiBtn.dispatchEvent(new Event('click'));
  assert.equal(prefs.getSnapshot().edition, 'jiechi');
  assert.equal(jiechiBtn.getAttribute('aria-checked'), 'true');
  assert.equal(inlineOverlay.dataset.edition, 'jiechi');

  const mediumBtn = inkBtns.find(b => b.dataset.inkOpt === 'medium');
  mediumBtn.dispatchEvent(new Event('click'));
  assert.equal(prefs.getSnapshot().ink, 'medium');
  assert.equal(mediumBtn.getAttribute('aria-checked'), 'true');
  assert.equal(inlineOverlay.dataset.ink, 'medium');

  // Each refinement is a two-way switch that also drives the inline preview.
  for (const [attr, key, id] of [['projectOpt', 'project', 'chip'], ['signalOpt', 'signal', 'classic'], ['titleOpt', 'title', 'even']]) {
    const btns = env.findAll(container, n => Boolean(n.dataset?.[attr]));
    assert.equal(btns.length, 2);
    const btn = btns.find(b => b.dataset[attr] === id);
    assert.equal(btn.getAttribute('aria-checked'), 'false');
    btn.dispatchEvent(new Event('click'));
    assert.equal(prefs.getSnapshot()[key], id);
    assert.equal(btn.getAttribute('aria-checked'), 'true');
    assert.equal(inlineOverlay.dataset[key], id);
  }

  const openBtn = env.findAll(container, n => n.dataset?.action === 'open-overlay')[0];
  openBtn.dispatchEvent(new Event('click'));
  assert.equal(previewCalls, 1);

  panel.destroy();
  assert.equal(container.children.length, 0);
});

test('mountSwitcher anchors on activeSession when viewing a subagent and lets Ctrl+Tab return to its parent', async t => {
  const env = domEnvironment(t);
  const prefs = createPrefsStore();
  const container = new env.Node();
  const opened = [];
  let mounted = 'sub-1', active = 's1';
  const ids = ['s1', 's2', 's3'];
  const host = {
    current: () => mounted,
    activeSession: () => active,
    candidates: () => ids,
    exists: id => ids.includes(id),
    theme: () => 'light',
    prefs: () => prefs.getSnapshot(),
    row: id => ({
      id,
      title: `会话-${id}`,
      workspaceName: 'Agent',
      text: '',
      placeholder: '还没有输入',
      ...sessionPresentation({}, { updatedAt: Date.now() - 60000 }, false),
    }),
    preview: () => () => {},
    subscribe: () => () => {},
    open: id => { opened.push(id); },
  };

  const sw = mountSwitcher(container, host);
  // Stepping forward from parent s1 lands on s2.
  sw.begin(1, true);
  await new Promise(r => setTimeout(r, 10));
  let cards = env.findAll(container, n => n.className === 'dsh-switcher-card');
  assert.equal(cards[1].getAttribute('aria-selected'), 'true');
  // Stepping back to parent s1 and committing exits sub-1 back to s1.
  sw.select('s1');
  sw.commit();
  assert.deepEqual(opened, ['s1']);

  // When viewing an orphan subagent (activeSession undefined), direction 1 selects first and -1 selects last.
  active = undefined;
  sw.begin(-1, true);
  sw.commit();
  sw.begin(1, true);
  sw.commit();
  assert.deepEqual(opened, ['s1', 's3', 's1']);

  sw.destroy();
});

test('mountSwitcher and mountSettingsPanel switch live between Chinese and English', async t => {
  const env = domEnvironment(t);
  const prefs = createPrefsStore({ getItem: () => null, setItem() {} });
  prefs.update({ edition: 'split' });
  let locale = 'zh';
  const hostListeners = new Set(), localeListeners = new Set();

  const overlayContainer = new env.Node();
  const ids = ['s1', 's2'];
  const host = {
    current: () => 's1',
    locale: () => locale,
    candidates: () => ids,
    exists: id => ids.includes(id),
    theme: () => 'dark',
    prefs: () => prefs.getSnapshot(),
    row: id => ({
      id,
      title: locale === 'en' ? `Session ${id}` : `会话 ${id}`,
      workspaceName: 'dsh-switcher',
      text: '',
      placeholder: locale === 'en' ? 'No input yet' : '还没有输入',
      ...sessionPresentation(id === 's2' ? { completionUnread: true } : {}, { updatedAt: Date.now() }, false, Date.now(), locale),
    }),
    preview: () => () => {},
    subscribe(fn) { hostListeners.add(fn); return () => hostListeners.delete(fn); },
    open() {},
  };

  const sw = mountSwitcher(overlayContainer, host);
  sw.begin(1, true);
  await new Promise(r => setTimeout(r, 10));

  const overlay = overlayContainer.children[0];
  const hereBadges = env.findAll(overlay, n => n.className === 'dsh-switcher-here');
  const cards = env.findAll(overlay, n => n.className === 'dsh-switcher-card');
  assert.equal(overlay.lang, 'zh-CN');
  assert.equal(overlay.getAttribute('aria-label'), '切换会话');
  assert.equal(hereBadges[0].textContent, '当前');
  assert.match(cards[0].getAttribute('aria-label'), /当前会话$/);

  const settingsContainer = new env.Node();
  const settings = mountSettingsPanel(settingsContainer, {
    prefs,
    getTheme: () => 'dark',
    getLocale: () => locale,
    subscribeLocale: fn => { localeListeners.add(fn); return () => localeListeners.delete(fn); },
    canPreview: () => true,
    onPreview() {},
  });

  const heading = env.findAll(settingsContainer, n => n.className === 'dsh-cfg-title')[0];
  const kibutsuBtn = env.findAll(settingsContainer, n => n.dataset?.editionOpt === 'kibutsu')[0];
  assert.equal(heading.textContent, '会话范围、版式与动效');
  assert.equal(kibutsuBtn.children[0].textContent, '02 器物');
  assert.equal(kibutsuBtn.children[1].textContent, '默认');

  // Switch live to English and verify both overlay and settings panel update immediately.
  locale = 'en';
  for (const fn of [...hostListeners]) fn();
  for (const fn of [...localeListeners]) fn();
  env.flushFrames();

  assert.equal(overlay.lang, 'en');
  assert.equal(overlay.getAttribute('aria-label'), 'Switch session');
  assert.equal(hereBadges[0].textContent, 'Current');
  assert.match(cards[0].getAttribute('aria-label'), /current session$/);
  assert.match(cards[1].getAttribute('aria-label'), /New result available/);

  assert.equal(heading.textContent, 'Session Scope, Layout & Motion');
  assert.equal(kibutsuBtn.children[0].textContent, '02 Kibutsu');
  assert.equal(kibutsuBtn.children[1].textContent, 'Default');
  const previewStatuses = env.findAll(settingsContainer, n => n.className === 'dsh-switcher-status-label').map(n => n.textContent);
  assert.ok(previewStatuses.includes('Running'));
  assert.ok(previewStatuses.includes('Approval'));
  assert.ok(previewStatuses.includes('New result'));

  settings.destroy();
  sw.destroy();
});

test('mountSwitcher renders distinct data-recency attributes and 5-bar SVG meter poses across fresh, warm, today, and cold idle cards', async t => {
  const env = domEnvironment(t);
  const prefs = createPrefsStore({ getItem: () => null, setItem() {} });
  const now = new Date(2026, 10, 16, 21, 0, 0).getTime();
  const ages = {
    sFresh: now - 21 * 60_000,
    sWarm: now - 95 * 60_000,
    sToday: new Date(2026, 10, 16, 10, 0, 0).getTime(),
    sCold: new Date(2026, 10, 8, 12, 0, 0).getTime(),
  };
  const ids = Object.keys(ages);
  const container = new env.Node();
  const host = {
    current: () => 'sFresh',
    locale: () => 'en',
    candidates: () => ids,
    exists: id => ids.includes(id),
    theme: () => 'dark',
    prefs: () => prefs.getSnapshot(),
    row: id => ({
      id,
      title: `Card ${id}`,
      workspaceName: 'Agent',
      text: '',
      placeholder: 'No input yet',
      ...sessionPresentation({}, { updatedAt: ages[id] }, false, now, 'en'),
    }),
    preview: () => () => {},
    subscribe: () => () => {},
    open() {},
  };

  const sw = mountSwitcher(container, host);
  sw.begin(1, true);
  await new Promise(r => setTimeout(r, 10));

  const statuses = env.findAll(container, n => n.className === 'dsh-switcher-status');
  assert.deepEqual(statuses.map(s => s.dataset.recency), ['fresh', 'warm', 'today', 'cold']);

  const labels = env.findAll(container, n => n.className === 'dsh-switcher-status-label').map(l => l.textContent);
  assert.deepEqual(labels, ['21m ago', '1h ago', 'Today 10:00', 'Nov 8']);

  // Verify the 5-slot SVG meter draws different numbers of upright vertical bars (`5 -> 3 -> 1 -> 0`).
  const icons = env.findAll(container, n => n.className === 'dsh-switcher-icon');
  const uprightBarsOf = iconNode => {
    const svg = iconNode.children[0];
    return svg.children.slice(0, 5).filter(p => {
      const d = p.getAttribute('d') || '';
      const [, y1, y2] = d.match(/M[\d.]+,([\d.]+) L[\d.]+,([\d.]+)/) || [];
      return y1 && y2 && Math.abs(Number(y2) - Number(y1)) > 2;
    }).length;
  };
  assert.deepEqual(icons.map(uprightBarsOf), [5, 3, 1, 0]);

  sw.destroy();
});
