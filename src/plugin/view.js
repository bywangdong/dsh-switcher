import { SwitchCycle, phraseBreaks, normalizePrefs, samePrefs, isStatusFirstEdition, usesLensMotion, normalizeLocale, uiCopy } from './core.js';
import { createFivebeatMotion } from './motion.js';
import { installSwitcherKeyboard } from './keyboard.js';

export function mountSwitcher(container, host, options = {}) {
  const inline = Boolean(options.inline);
  const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  let cycle, overlay, panel, list, lens, motion, timer, returnFocus, returnSelection, resize, selectedId, releasePreview = () => {};
  let prefs = normalizePrefs(host.prefs?.()), activeLocale = normalizeLocale(host.locale?.());
  let composing = false, alive = true, simulated = false, refreshFrame = 0, viewportWidth = 0, scrollPosition = 0, prevLensIndex = -1;
  const rows = new Map(), stops = [];

  function listen(target, name, listener, eventOptions) {
    target.addEventListener(name, listener, eventOptions);
    stops.push(() => target.removeEventListener(name, listener, eventOptions));
  }

  const motionKindOf = row => (row.kind === 'idle' && row.recency && prefs.motion !== 'classic')
    ? `idle-${row.recency}`
    : row.kind;

  function createFolderIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const wrap = document.createElement('span'); wrap.className = 'dsh-ws-icon'; wrap.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 16 16');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M2.2 4.6a1.4 1.4 0 0 1 1.4-1.4h2.5l1.35 1.45H12.4a1.4 1.4 0 0 1 1.4 1.4v5.3a1.4 1.4 0 0 1-1.4 1.4H3.6a1.4 1.4 0 0 1-1.4-1.4Z');
    svg.append(path); wrap.append(svg);
    return wrap;
  }

  function restoreFocus() {
    if (inline || !returnFocus?.isConnected) return;
    returnFocus.focus({ preventScroll: true });
    try {
      if (returnSelection?.range) {
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(returnSelection.range);
      } else if (returnSelection) returnFocus.setSelectionRange(returnSelection.start, returnSelection.end, returnSelection.direction);
    } catch { /* Host may have replaced the composer while we were open. */ }
  }

  function finish(commit, restore = true) {
    if (!cycle) return;
    const selected = cycle.selected, original = host.current();
    const release = releasePreview;
    cycle = undefined; clearTimeout(timer); cancelAnimationFrame(refreshFrame); refreshFrame = 0; releasePreview = () => {};
    resize?.disconnect(); resize = undefined; selectedId = undefined; prevLensIndex = -1;
    motion?.destroy(); motion = undefined; overlay?.remove(); overlay = undefined; panel = undefined; list = undefined; lens = undefined; rows.clear();
    try {
      if (!inline && commit && selected !== original && host.exists(selected)) {
        try { host.open(selected); } catch (error) { console.error('[DSH Switcher] Could not open session', error); if (restore) restoreFocus(); }
      } else if (!inline && restore) restoreFocus();
    } finally {
      // Hand off to the destination before dropping its preview reference.
      try { release(); } finally { returnFocus = undefined; returnSelection = undefined; }
    }
  }

  function applyPrefsAttributes() {
    if (!overlay) return;
    overlay.dataset.edition = prefs.edition;
    overlay.dataset.motion = prefs.motion;
    overlay.dataset.ink = prefs.ink;
    overlay.dataset.project = prefs.project;
    overlay.dataset.signal = prefs.signal;
    overlay.dataset.title = prefs.title;
    overlay.dataset.scope = prefs.scope;
    if (usesLensMotion(prefs.edition, prefs.motion)) overlay.dataset.lens = 'true';
    else delete overlay.dataset.lens;
  }

  function applyLocaleAttributes() {
    if (!overlay) return;
    const copy = uiCopy(activeLocale);
    overlay.lang = activeLocale === 'zh' ? 'zh-CN' : 'en';
    overlay.setAttribute('aria-label', inline ? copy.previewRegionAria : copy.dialogAria);
    list?.setAttribute('aria-label', copy.listboxAria);
    for (const node of rows.values()) {
      if (node.hereBadge) node.hereBadge.textContent = copy.hereBadge;
    }
  }

  function syncLens(immediate = false) {
    if (!cycle || !lens || !overlay) return;
    const nextIndex = cycle.index;
    const wrapped = cycle.ids.length > 2 && prevLensIndex >= 0 && Math.abs(nextIndex - prevLensIndex) === cycle.ids.length - 1;
    const snap = immediate || prevLensIndex < 0 || wrapped || !usesLensMotion(prefs.edition, prefs.motion) || reducedMotion.matches;
    const x = nextIndex * 182;
    if (snap) {
      lens.style.transition = 'none';
      lens.style.transform = `translate3d(${x}px, 0, 0)`;
      void lens.offsetWidth;
      lens.style.transition = '';
    } else {
      lens.style.transform = `translate3d(${x}px, 0, 0)`;
    }
    prevLensIndex = nextIndex;
  }

  function renderSelection(immediate = false) {
    if (!cycle || !list) return;
    if (cycle.selected !== selectedId) {
      rows.get(selectedId)?.card.setAttribute('aria-selected', 'false');
      selectedId = cycle.selected;
      const card = rows.get(selectedId)?.card;
      if (card) {
        card.setAttribute('aria-selected', 'true');
        list.setAttribute('aria-activedescendant', card.id);
      }
    }
    syncLens(immediate);
  }

  function buildCards() {
    if (!cycle || !list) return;
    list.textContent = ''; rows.clear(); selectedId = undefined; prevLensIndex = -1;
    lens = document.createElement('div'); lens.className = 'dsh-switcher-lens'; lens.setAttribute('aria-hidden', 'true');
    list.append(lens);
    const statusFirst = isStatusFirstEdition(prefs.edition);
    const idPrefix = inline ? 'dsh-switcher-preview-option' : 'dsh-switcher-option';

    cycle.ids.forEach((id, index) => {
      const card = document.createElement('div'); card.className = 'dsh-switcher-card';
      card.id = `${idPrefix}-${index}`; card.setAttribute('role', 'option'); card.setAttribute('aria-selected', 'false');

      const project = document.createElement('span'); project.className = 'dsh-switcher-project';
      let projectName, chip, hereBadge = null;
      if (prefs.edition === 'split') {
        projectName = document.createElement('span'); projectName.className = 'dsh-switcher-project-name';
        hereBadge = document.createElement('span'); hereBadge.className = 'dsh-switcher-here'; hereBadge.textContent = uiCopy(activeLocale).hereBadge;
        project.append(projectName, hereBadge);
      } else {
        chip = document.createElement('span'); chip.className = 'dsh-ws-chip';
        projectName = document.createElement('span'); projectName.className = 'dsh-ws-chip-text';
        chip.append(createFolderIcon(), projectName);
        project.append(chip);
      }

      const title = document.createElement('span'); title.className = 'dsh-switcher-title';
      const status = document.createElement('div'); status.className = 'dsh-switcher-status';
      const icon = document.createElement('span'); icon.className = 'dsh-switcher-icon'; icon.setAttribute('aria-hidden', 'true');
      const statusLabel = document.createElement('span'); statusLabel.className = 'dsh-switcher-status-label';
      status.append(icon, statusLabel);

      let excerpt = null;
      if (statusFirst) {
        const pulseDot = document.createElement('span'); pulseDot.className = 'dsh-pulse-dot'; pulseDot.setAttribute('aria-hidden', 'true');
        status.append(pulseDot);
        card.append(status, title, project);
      } else {
        excerpt = document.createElement('p'); excerpt.className = 'dsh-switcher-excerpt';
        card.append(project, title, status, excerpt);
      }

      list.append(card);
      rows.set(id, { card, project, chip, projectName, hereBadge, title, status, statusLabel, excerpt, icon, motion: { update() {} } });

      if (!inline) {
        // Pointer movement selects, without a stale hover overriding keyboard navigation.
        card.addEventListener('pointermove', event => {
          if (cycle && cycle.selected !== id && (event.movementX || event.movementY)) { cycle.select(id); renderSelection(); }
        });
      }
      const activate = event => {
        if (!cycle) return;
        event.preventDefault(); event.stopPropagation();
        cycle.select(id);
        if (inline) { renderSelection(); scrollSelected(); }
        else finish(true);
      };
      card.addEventListener('click', activate);
      // macOS turns Control+primary-click into contextmenu, without a click event.
      if (!inline) card.addEventListener('contextmenu', event => { if (event.ctrlKey) activate(event); });
    });

    if (motion) {
      motion.destroy();
      motion = createFivebeatMotion(prefs.motion);
      for (const id of cycle.ids) {
        const node = rows.get(id), row = host.row(id), mKind = motionKindOf(row);
        node.motion = motion.mount(node.icon, mKind, row.draft);
        node.motionKind = mKind;
      }
    }
  }

  function refresh() {
    cancelAnimationFrame(refreshFrame); refreshFrame = 0;
    if (!cycle || !overlay) return;
    // Deletion or archiving cancels the frozen selection instead of opening a stale target.
    if (!inline && cycle.ids.some(id => !host.exists(id))) { finish(false); return; }

    const nextPrefs = normalizePrefs(host.prefs?.());
    const nextIds = inline ? host.candidates() : cycle.ids;
    const idsChanged = inline && nextIds.length >= 2 && (nextIds.length !== cycle.ids.length || nextIds.some((id, idx) => id !== cycle.ids[idx]));
    let immediateSelection = false;
    if (idsChanged) {
      const keep = nextIds.includes(cycle.selected) ? cycle.selected : nextIds[Math.min(cycle.index, nextIds.length - 1)];
      cycle = new SwitchCycle(nextIds, host.current(), 1);
      cycle.select(keep);
      panel?.style.setProperty('--sw-width', `${nextIds.length * 182 + 32}px`);
    }
    // The project label changes its box, so its truncation tooltips are measured again.
    if (idsChanged || nextPrefs.edition !== prefs.edition || nextPrefs.project !== prefs.project) {
      prefs = nextPrefs; applyPrefsAttributes(); buildCards(); immediateSelection = true;
    } else if (!samePrefs(nextPrefs, prefs)) {
      const motionChanged = nextPrefs.motion !== prefs.motion;
      prefs = nextPrefs; applyPrefsAttributes();
      if (motionChanged) { motion?.setMode(prefs.motion); immediateSelection = true; }
    }

    const nextLocale = normalizeLocale(host.locale?.());
    if (nextLocale !== activeLocale) {
      activeLocale = nextLocale;
      applyLocaleAttributes();
    }

    const theme = host.theme(), current = host.current(), statusFirst = isStatusFirstEdition(prefs.edition);
    const copy = uiCopy(activeLocale), sep = copy.listSep;
    const retitled = [], truncChecks = [];
    if (overlay.dataset.theme !== theme) overlay.dataset.theme = theme;

    for (const id of cycle.ids) {
      const row = host.row(id), node = rows.get(id), old = node.value || {}, here = id === current;
      const label = statusFirst
        ? `${row.label}${sep}${row.title}${sep}${row.workspaceName}`
        : prefs.edition === 'b2'
          ? `${row.workspaceName}${sep}${row.title}${sep}${row.label}`
          : `${row.workspaceName}${sep}${row.title}${sep}${row.label}${here ? copy.hereSuffix : ''}`;
      const text = row.text || row.placeholder || '', shortLabel = row.shortLabel || row.label;

      if (node.label !== label) { node.card.setAttribute('aria-label', label); node.label = label; }
      if (node.here !== here) { node.card.dataset.current = String(here); node.here = here; }

      if (row.workspaceName !== old.workspaceName) {
        node.projectName.textContent = row.workspaceName;
        if (prefs.edition === 'split') node.project.title = row.workspaceName;
        else truncChecks.push({ measure: node.projectName, target: node.chip || node.project, text: row.workspaceName, multiline: false });
      }

      if (node.excerpt) {
        if (text !== (old.text || old.placeholder || '')) {
          node.excerpt.textContent = text;
          if (prefs.edition === 'split') node.excerpt.title = text;
          else truncChecks.push({ measure: node.excerpt, target: node.excerpt, text: row.text ? text : '', multiline: false });
        }
        if (!node.value || !!row.text !== !!old.text) node.excerpt.dataset.empty = String(!row.text);
      }

      if (row.title !== old.title) {
        node.title.textContent = phraseBreaks(row.title);
        if (prefs.edition === 'split') { node.title.title = row.title; retitled.push(node.title); }
        else truncChecks.push({ measure: node.title, target: node.title, text: row.title, multiline: true });
      }

      if (row.kind !== old.kind) { node.status.dataset.status = row.kind; node.icon.dataset.status = row.kind; }
      if (row.recency !== old.recency) {
        if (row.recency) {
          node.status.dataset.recency = row.recency;
          node.icon.dataset.recency = row.recency;
        } else {
          delete node.status.dataset.recency;
          delete node.icon.dataset.recency;
        }
      }
      if (row.label !== old.label) { node.status.title = row.label; node.icon.title = row.label; }
      if (shortLabel !== (old.shortLabel || old.label)) {
        node.statusLabel.textContent = shortLabel;
        if (node.value && row.kind !== old.kind && prefs.motion !== 'off' && !reducedMotion.matches && typeof node.statusLabel.animate === 'function') {
          node.statusLabel.animate(
            [{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)' },
          );
        }
      }
      const mKind = motionKindOf(row);
      if (mKind !== node.motionKind || row.draft !== old.draft) {
        node.motion.update(mKind, row.draft);
        node.motionKind = mKind;
      }
      node.value = row;
    }

    if (retitled.length) {
      const fits = retitled.map(title => title.scrollHeight <= title.clientHeight);
      retitled.forEach((title, index) => { title.dataset.balance = String(fits[index]); });
    }
    if (truncChecks.length) {
      const truncated = truncChecks.map(item => item.text && (item.multiline
        ? item.measure.scrollHeight > item.measure.clientHeight + 1
        : item.measure.scrollWidth > item.measure.clientWidth + 1));
      truncChecks.forEach((item, index) => {
        if (truncated[index]) item.target.title = item.text;
        else item.target.removeAttribute('title');
      });
    }

    renderSelection(immediateSelection);
    if (idsChanged && list) { viewportWidth = list.clientWidth; scrollPosition = list.scrollLeft; scrollSelected(true); }
  }

  function scheduleRefresh() {
    if (refreshFrame || !alive || !cycle) return;
    refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; if (alive) refresh(); });
  }

  function scrollSelected(immediate = false) {
    if (!cycle || !list || !viewportWidth) return;
    // Cards have a fixed 182px border box. Avoid a forced layout after each selection.
    const left = cycle.index * 182, right = left + 182;
    const next = left < scrollPosition ? left : right > scrollPosition + viewportWidth ? right - viewportWidth : scrollPosition;
    if (next !== scrollPosition) {
      scrollPosition = next;
      const smooth = !immediate && usesLensMotion(prefs.edition, prefs.motion) && !reducedMotion.matches && typeof list.scrollTo === 'function';
      if (smooth) list.scrollTo({ left: next, behavior: 'smooth' });
      else list.scrollLeft = next;
    }
  }

  function reveal() {
    if (!cycle || !overlay) return;
    overlay.dataset.revealed = 'true';
    motion = createFivebeatMotion(prefs.motion);
    for (const id of cycle.ids) {
      const node = rows.get(id), row = node.value || host.row(id), mKind = motionKindOf(row);
      node.motion = motion.mount(node.icon, mKind, row.draft);
      node.motionKind = mKind;
    }
    releasePreview = host.preview(cycle.ids);
    refresh(); scrollSelected(true);
    if (!inline) list?.focus({ preventScroll: true });
  }

  function begin(direction = 1, demo = false) {
    if (!alive || (!inline && composing)) return;
    if (cycle) { cycle.step(direction); renderSelection(); scrollSelected(); return; }
    const ids = host.candidates();
    if (ids.length < 2) return;
    prefs = normalizePrefs(host.prefs?.());
    activeLocale = normalizeLocale(host.locale?.());
    simulated = demo || inline;
    if (!inline) {
      returnFocus = document.activeElement;
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      if (returnFocus instanceof HTMLInputElement || returnFocus instanceof HTMLTextAreaElement) {
        returnSelection = { start: returnFocus.selectionStart, end: returnFocus.selectionEnd, direction: returnFocus.selectionDirection };
      } else if (selection?.rangeCount && returnFocus?.contains(selection.anchorNode)) {
        returnSelection = { range: selection.getRangeAt(0).cloneRange() };
      }
    }
    const anchor = typeof host.activeSession === 'function' ? host.activeSession() : host.current();
    cycle = new SwitchCycle(ids, anchor, direction);
    overlay = document.createElement('div'); overlay.className = 'dsh-switcher'; overlay.dataset.revealed = 'false';
    overlay.dataset.pointer = inline ? 'mouse' : 'keyboard';
    overlay.dataset.theme = host.theme();
    applyPrefsAttributes();
    if (inline) {
      overlay.dataset.inlinePreview = 'true';
      overlay.setAttribute('role', 'region');
    } else {
      overlay.dataset.shortcutModal = 'dsh-switcher'; overlay.tabIndex = -1;
      overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    }
    panel = document.createElement('div'); panel.className = 'dsh-switcher-panel'; panel.style.setProperty('--sw-width', `${ids.length * 182 + 32}px`);
    list = document.createElement('div'); list.className = 'dsh-switcher-list'; list.tabIndex = -1; list.style.outline = 'none';
    list.setAttribute('role', 'listbox');
    applyLocaleAttributes();

    buildCards();
    if (!inline) {
      // Start each presentation with a quiet pointer. Enter/over events caused by
      // revealing the panel must not reveal it or take over keyboard selection.
      overlay.addEventListener('pointermove', event => {
        if (overlay.dataset.pointer === 'keyboard' && (event.movementX || event.movementY)) overlay.dataset.pointer = 'mouse';
      }, { capture: true, passive: true });
      overlay.addEventListener('pointerdown', event => { if (event.target === overlay) { event.preventDefault(); finish(false); } });
    }
    panel.append(list); overlay.append(panel); container.append(overlay);
    const viewport = list;
    viewportWidth = viewport.clientWidth; scrollPosition = 0;
    viewport.addEventListener('scroll', () => { if (list === viewport) scrollPosition = viewport.scrollLeft; }, { passive: true });
    if (typeof ResizeObserver === 'function') {
      resize = new ResizeObserver(entries => {
        if (list !== viewport) return;
        viewportWidth = entries[0].contentRect.width; scrollSelected(true);
      });
      resize.observe(viewport);
    }
    refresh();
    if (inline) {
      reveal();
    } else {
      // Own the full keyboard gesture before the delayed visual reveal.
      overlay?.focus({ preventScroll: true });
      if (cycle) timer = setTimeout(reveal, demo ? 0 : 140);
    }
  }

  if (!inline) {
    listen(window, 'blur', () => finish(false, false));
    listen(document, 'visibilitychange', () => { if (document.hidden) finish(false, false); });
    listen(document, 'compositionstart', () => { composing = true; finish(false); }, true);
    listen(document, 'compositionend', () => { composing = false; }, true);
  }
  stops.push(host.subscribe(scheduleRefresh));
  const controller = {
    begin,
    refresh,
    select(id) { if (cycle) { cycle.select(id); renderSelection(); scrollSelected(); } },
    get active() { return !!cycle; },
    get composing() { return composing; },
    get simulated() { return simulated; },
    commit: () => finish(true),
    cancel: () => finish(false),
    destroy() { alive = false; finish(false); stops.forEach(stop => stop()); },
  };
  if (!inline) {
    stops.push(installSwitcherKeyboard(window, controller, () =>
      !!document.querySelector('[data-shortcut-modal], [aria-modal="true"]')));
  }
  return controller;
}
