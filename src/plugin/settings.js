import { EDITION_OPTIONS, MOTION_OPTIONS, INK_OPTIONS, PROJECT_OPTIONS, SIGNAL_OPTIONS, TITLE_OPTIONS, SCOPE_OPTIONS, DEFAULT_PREFS, samePrefs, candidates, sessionPresentation, normalizeLocale, detectEnvironmentLocale, uiCopy, optionCopy } from './core.js';
import { mountSwitcher } from './view.js';

export function mountSettingsPanel(container, options = {}) {
  const prefs = options.prefs;
  const getTheme = options.getTheme || (() => 'dark');
  const getLocale = options.getLocale || (() => detectEnvironmentLocale());
  const canPreview = options.canPreview || (() => false);
  const onPreview = options.onPreview || null;
  const stops = [];

  const root = document.createElement('div');
  root.className = 'dsh-switcher-settings';
  root.dataset.theme = getTheme();

  const head = document.createElement('div'); head.className = 'dsh-cfg-head';
  const headText = document.createElement('div'); headText.className = 'dsh-cfg-head-text';
  const heading = document.createElement('h4'); heading.className = 'dsh-cfg-title';
  const sub = document.createElement('p'); sub.className = 'dsh-cfg-sub';
  headText.append(heading, sub);

  const actions = document.createElement('div'); actions.className = 'dsh-cfg-actions';
  let openBtn = null;
  if (onPreview) {
    openBtn = document.createElement('button');
    openBtn.type = 'button'; openBtn.className = 'dsh-cfg-btn'; openBtn.dataset.action = 'open-overlay';
    openBtn.addEventListener('click', () => { if (canPreview()) onPreview(); });
    actions.append(openBtn);
  }
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button'; resetBtn.className = 'dsh-cfg-btn'; resetBtn.dataset.action = 'reset-prefs';
  resetBtn.addEventListener('click', () => prefs.reset());
  actions.append(resetBtn);
  head.append(headText, actions);

  function createOptionGroup(items, attrName, onSelect) {
    const group = document.createElement('div'); group.className = 'dsh-cfg-group';
    const label = document.createElement('div'); label.className = 'dsh-cfg-label';
    const row = document.createElement('div'); row.className = 'dsh-cfg-options';
    row.setAttribute('role', 'radiogroup');
    const buttons = new Map();
    const buttonParts = new Map();
    items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dsh-cfg-opt';
      btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', 'false');
      btn.dataset[attrName] = item.id;
      const text = document.createElement('span');
      btn.append(text);
      let badge = null;
      if (item.badge) {
        badge = document.createElement('span'); badge.className = 'dsh-cfg-badge';
        btn.append(badge);
      }
      btn.addEventListener('click', () => onSelect(item.id));
      btn.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const nextIdx = (idx + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
        const nextItem = items[nextIdx];
        onSelect(nextItem.id);
        buttons.get(nextItem.id)?.focus();
      });
      row.append(btn);
      buttons.set(item.id, btn);
      buttonParts.set(item.id, { item, text, badge });
    });
    const detail = document.createElement('p'); detail.className = 'dsh-cfg-detail';
    group.append(label, row, detail);
    return { group, label, row, buttons, buttonParts, detail };
  }

  const createPrefGroup = (key, items) => ({
    key, items, ...createOptionGroup(items, `${key}Opt`, id => prefs.update({ [key]: id })),
  });
  const scopeGroup = createPrefGroup('scope', SCOPE_OPTIONS);
  const editionGroup = createPrefGroup('edition', EDITION_OPTIONS);
  // Two-way refinements share one row, so the live preview stays close to its switches.
  const refineGroups = [
    createPrefGroup('project', PROJECT_OPTIONS),
    createPrefGroup('signal', SIGNAL_OPTIONS),
    createPrefGroup('title', TITLE_OPTIONS),
  ];
  const refineRow = document.createElement('div'); refineRow.className = 'dsh-cfg-row';
  refineRow.append(...refineGroups.map(item => item.group));
  const inkGroup = createPrefGroup('ink', INK_OPTIONS);
  const motionGroup = createPrefGroup('motion', MOTION_OPTIONS);
  const prefGroups = [scopeGroup, editionGroup, ...refineGroups, inkGroup, motionGroup];

  const previewWrap = document.createElement('div'); previewWrap.className = 'dsh-cfg-preview';
  const previewBar = document.createElement('div'); previewBar.className = 'dsh-cfg-preview-bar';
  const previewHint = document.createElement('span'); previewHint.className = 'dsh-cfg-preview-hint';
  const stateCycleBtn = document.createElement('button');
  stateCycleBtn.type = 'button'; stateCycleBtn.className = 'dsh-cfg-mini-btn'; stateCycleBtn.dataset.action = 'cycle-preview-state';
  previewBar.append(previewHint, stateCycleBtn);

  const stage = document.createElement('div'); stage.className = 'dsh-cfg-stage';
  previewWrap.append(previewBar, stage);

  root.append(head, scopeGroup.group, editionGroup.group, refineRow, inkGroup.group, motionGroup.group, previewWrap);
  container.append(root);

  const now = Date.now();
  const sampleRows = [
    {
      id: 'p1',
      title: '整理本周的发布检查清单', enTitle: 'Prepare weekly release checklist',
      workspaceName: 'Agent',
      text: '把需要灰度验证的边界列出来。', enText: 'List the edge cases that need canary verification.',
      kind: 'idle', draft: false, updatedAt: new Date(now - 12 * 60000).toISOString(),
    },
    {
      id: 'p2',
      title: '节点稳定性与切换策略', enTitle: 'Node stability and failover policy',
      workspaceName: 'proxyAutoSwitch',
      text: '延迟很低但只稳定一小会儿的节点先不切。', enText: 'Hold off switching to low-latency nodes until stability settles.',
      kind: 'running', draft: false, updatedAt: new Date(now - 2 * 60000).toISOString(),
    },
    {
      id: 'p3',
      title: 'DSH 插件配置槽位接入验证', enTitle: 'Verify DSH plugin config slot integration',
      workspaceName: 'dsh-switcher',
      text: '确认在插件详情页直接切换即可生效。', enText: 'Confirm live updates right inside the plugin details page.',
      kind: 'approval', draft: false, updatedAt: new Date(now - 28 * 60000).toISOString(),
    },
    {
      id: 'p4',
      title: '多工作区焦点与窄窗滚动回归', enTitle: 'Multi-workspace focus and narrow scroll check',
      workspaceName: 'Agent',
      text: '窄窗口下末张卡片也要完整滚入视口。', enText: 'Ensure the trailing card scrolls fully into view in narrow windows.',
      kind: 'unread', draft: false, updatedAt: new Date(now - 3 * 3600000).toISOString(),
    },
    {
      id: 'p5',
      title: '打磨键盘导航与草稿恢复体验', enTitle: 'Polish keyboard navigation and draft restore',
      workspaceName: 'dsh-shortcutter',
      text: '尽量让双手留在主键盘区。', enText: 'Keep hands comfortably on the home row.',
      kind: 'idle', draft: false, updatedAt: new Date(now - 5 * 3600000).toISOString(),
    },
  ];
  const sampleCycleStates = ['running', 'approval', 'unread'];
  let sampleStateIndex = 0;
  const previewListeners = new Set();
  const notifyPreview = () => { for (const fn of [...previewListeners]) fn(); };

  stateCycleBtn.addEventListener('click', () => {
    sampleStateIndex = (sampleStateIndex + 1) % sampleCycleStates.length;
    sampleRows[1].kind = sampleCycleStates[sampleStateIndex];
    notifyPreview();
  });

  const sampleStatusOf = item => ({
    running: item.kind === 'running',
    completionUnread: item.kind === 'unread',
    pendingInteraction: item.kind === 'approval' ? { kind: 'approval' } : undefined,
  });
  const sampleSnapshot = {
    ids: sampleRows.map(r => r.id),
    byId: Object.fromEntries(sampleRows.map(r => [r.id, { updatedAt: r.updatedAt }])),
  };

  const previewHost = {
    current: () => 'p1',
    locale: () => normalizeLocale(getLocale()),
    candidates: () => candidates(
      sampleSnapshot,
      [],
      [],
      'p1',
      sampleRows.filter(r => r.draft).map(r => r.id),
      {
        scope: prefs.getSnapshot().scope,
        statuses: Object.fromEntries(sampleRows.map(r => [r.id, sampleStatusOf(r)])),
        now,
      },
    ),
    exists: id => sampleRows.some(r => r.id === id),
    theme: getTheme,
    prefs: () => prefs.getSnapshot(),
    row(id) {
      const item = sampleRows.find(r => r.id === id);
      const loc = normalizeLocale(getLocale()), en = loc === 'en';
      return {
        ...item,
        title: en ? item.enTitle : item.title,
        text: en ? item.enText : item.text,
        placeholder: uiCopy(loc).inputEmpty,
        ...sessionPresentation(sampleStatusOf(item), { updatedAt: item.updatedAt }, item.draft, now, loc),
      };
    },
    preview: () => () => {},
    subscribe(fn) { previewListeners.add(fn); return () => previewListeners.delete(fn); },
    open() {},
  };

  const inlineSwitcher = mountSwitcher(stage, previewHost, { inline: true });

  function syncUI() {
    const snap = prefs.getSnapshot();
    const theme = getTheme();
    const loc = normalizeLocale(getLocale());
    const copy = uiCopy(loc);
    root.dataset.theme = theme;
    root.lang = loc === 'zh' ? 'zh-CN' : 'en';

    heading.textContent = copy.cfgHeading;
    sub.textContent = copy.cfgSub;
    if (openBtn) openBtn.textContent = copy.cfgOpenOverlay;
    resetBtn.textContent = copy.cfgReset;
    previewHint.textContent = copy.cfgPreviewHint;
    stateCycleBtn.textContent = copy.cfgCycleState;

    for (const { key, items, label, row, buttons, buttonParts, detail } of prefGroups) {
      const groupTitle = copy.groupLabels[key];
      label.textContent = groupTitle;
      row.setAttribute('aria-label', groupTitle);
      for (const [id, btn] of buttons) {
        const checked = id === snap[key];
        btn.setAttribute('aria-checked', String(checked));
        btn.tabIndex = checked ? 0 : -1;
        const parts = buttonParts.get(id);
        const localized = optionCopy(parts.item, loc);
        parts.text.textContent = localized.label;
        if (parts.badge) parts.badge.textContent = localized.badge;
      }
      const activeItem = items.find(item => item.id === snap[key]) || items[0];
      detail.textContent = optionCopy(activeItem, loc).detail;
    }

    resetBtn.disabled = samePrefs(snap, DEFAULT_PREFS);

    if (openBtn) {
      const available = Boolean(canPreview());
      openBtn.disabled = !available;
      openBtn.title = available ? copy.cfgOpenOverlayReadyTitle : copy.cfgOpenOverlayDisabledTitle;
    }

    inlineSwitcher.refresh();
  }

  // Sync labels once before mounting the inline preview so its initial render uses localized text.
  syncUI();
  inlineSwitcher.begin(1, true);
  inlineSwitcher.refresh();

  stops.push(prefs.subscribe(syncUI));
  if (options.subscribeTheme) stops.push(options.subscribeTheme(syncUI));
  if (options.subscribeLocale) stops.push(options.subscribeLocale(syncUI));

  return {
    sync: syncUI,
    destroy() {
      stops.forEach(stop => stop());
      inlineSwitcher.destroy();
      root.remove();
    },
  };
}
