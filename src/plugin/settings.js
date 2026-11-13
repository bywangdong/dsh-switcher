import { EDITION_OPTIONS, MOTION_OPTIONS, INK_OPTIONS, DEFAULT_PREFS, sessionPresentation } from './core.js';
import { mountSwitcher } from './view.js';

export function mountSettingsPanel(container, options = {}) {
  const prefs = options.prefs;
  const getTheme = options.getTheme || (() => 'dark');
  const canPreview = options.canPreview || (() => false);
  const onPreview = options.onPreview || null;
  const stops = [];

  const root = document.createElement('div');
  root.className = 'dsh-switcher-settings';
  root.dataset.theme = getTheme();

  const head = document.createElement('div'); head.className = 'dsh-cfg-head';
  const headText = document.createElement('div'); headText.className = 'dsh-cfg-head-text';
  const heading = document.createElement('h4'); heading.className = 'dsh-cfg-title'; heading.textContent = '界面版式与动效';
  const sub = document.createElement('p'); sub.className = 'dsh-cfg-sub';
  sub.textContent = '切换立即生效并保存在当前设备；随时按 Ctrl+Tab 可在真实会话中检验手感。';
  headText.append(heading, sub);

  const actions = document.createElement('div'); actions.className = 'dsh-cfg-actions';
  let openBtn = null;
  if (onPreview) {
    openBtn = document.createElement('button');
    openBtn.type = 'button'; openBtn.className = 'dsh-cfg-btn'; openBtn.dataset.action = 'open-overlay';
    openBtn.textContent = '唤起真实会话浮层';
    openBtn.addEventListener('click', () => { if (canPreview()) onPreview(); });
    actions.append(openBtn);
  }
  const resetBtn = document.createElement('button');
  resetBtn.type = 'button'; resetBtn.className = 'dsh-cfg-btn'; resetBtn.dataset.action = 'reset-prefs';
  resetBtn.textContent = '恢复推荐默认';
  resetBtn.addEventListener('click', () => prefs.reset());
  actions.append(resetBtn);
  head.append(headText, actions);

  function createOptionGroup(labelText, items, attrName, onSelect) {
    const group = document.createElement('div'); group.className = 'dsh-cfg-group';
    const label = document.createElement('div'); label.className = 'dsh-cfg-label'; label.textContent = labelText;
    const row = document.createElement('div'); row.className = 'dsh-cfg-options';
    row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', labelText);
    const buttons = new Map();
    items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dsh-cfg-opt';
      btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', 'false');
      btn.dataset[attrName] = item.id;
      const text = document.createElement('span'); text.textContent = item.label;
      btn.append(text);
      if (item.badge) {
        const badge = document.createElement('span'); badge.className = 'dsh-cfg-badge'; badge.textContent = item.badge;
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
    });
    const detail = document.createElement('p'); detail.className = 'dsh-cfg-detail';
    group.append(label, row, detail);
    return { group, buttons, detail };
  }

  const editionGroup = createOptionGroup('卡片版式与信息组织', EDITION_OPTIONS, 'editionOpt', id => prefs.update({ edition: id }));
  const inkGroup = createOptionGroup('文字浓淡与字重', INK_OPTIONS, 'inkOpt', id => prefs.update({ ink: id }));
  const motionGroup = createOptionGroup('状态图标与切换动效', MOTION_OPTIONS, 'motionOpt', id => prefs.update({ motion: id }));

  const previewWrap = document.createElement('div'); previewWrap.className = 'dsh-cfg-preview';
  const previewBar = document.createElement('div'); previewBar.className = 'dsh-cfg-preview-bar';
  const previewHint = document.createElement('span'); previewHint.className = 'dsh-cfg-preview-hint';
  previewHint.textContent = '实时样例预览 · 点击任意卡片体验选中滑框';
  const stateCycleBtn = document.createElement('button');
  stateCycleBtn.type = 'button'; stateCycleBtn.className = 'dsh-cfg-mini-btn'; stateCycleBtn.dataset.action = 'cycle-preview-state';
  stateCycleBtn.textContent = '模拟状态流转';
  previewBar.append(previewHint, stateCycleBtn);

  const stage = document.createElement('div'); stage.className = 'dsh-cfg-stage';
  previewWrap.append(previewBar, stage);

  root.append(head, editionGroup.group, inkGroup.group, motionGroup.group, previewWrap);
  container.append(root);

  const now = Date.now();
  const sampleRows = [
    { id: 'p1', title: '整理本周的发布检查清单', workspaceName: 'Agent', text: '把需要灰度验证的边界列出来。', kind: 'idle', draft: false, updatedAt: new Date(now - 12 * 60000).toISOString() },
    { id: 'p2', title: '节点稳定性与切换策略', workspaceName: 'proxyAutoSwitch', text: '延迟很低但只稳定一小会儿的节点先不切。', kind: 'running', draft: false, updatedAt: new Date(now - 2 * 60000).toISOString() },
    { id: 'p3', title: 'DSH 插件配置槽位接入验证', workspaceName: 'dsh-switcher', text: '确认在插件详情页直接切换即可生效。', kind: 'approval', draft: false, updatedAt: new Date(now - 28 * 60000).toISOString() },
    { id: 'p4', title: '打磨键盘导航与草稿恢复体验', workspaceName: 'dsh-shortcutter', text: '尽量让双手留在主键盘区。', kind: 'draft', draft: true, updatedAt: new Date(now - 95 * 60000).toISOString() },
    { id: 'p5', title: '多工作区焦点与窄窗滚动回归', workspaceName: 'Agent', text: '窄窗口下末张卡片也要完整滚入视口。', kind: 'unread', draft: false, updatedAt: new Date(now - 5 * 3600000).toISOString() },
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

  const previewHost = {
    current: () => 'p1',
    candidates: () => sampleRows.map(r => r.id),
    exists: id => sampleRows.some(r => r.id === id),
    theme: getTheme,
    prefs: () => prefs.getSnapshot(),
    row(id) {
      const item = sampleRows.find(r => r.id === id);
      const statusObj = {
        running: item.kind === 'running',
        completionUnread: item.kind === 'unread',
        pendingInteraction: item.kind === 'approval' ? { kind: 'approval' } : undefined,
      };
      return {
        ...item,
        placeholder: '还没有输入',
        ...sessionPresentation(statusObj, { updatedAt: item.updatedAt }, item.draft, now),
      };
    },
    preview: () => () => {},
    subscribe(fn) { previewListeners.add(fn); return () => previewListeners.delete(fn); },
    open() {},
  };

  const inlineSwitcher = mountSwitcher(stage, previewHost, { inline: true });
  inlineSwitcher.begin(1, true);

  function syncUI() {
    const snap = prefs.getSnapshot();
    const theme = getTheme();
    root.dataset.theme = theme;

    for (const [id, btn] of editionGroup.buttons) {
      const checked = id === snap.edition;
      btn.setAttribute('aria-checked', String(checked));
      btn.tabIndex = checked ? 0 : -1;
    }
    for (const [id, btn] of inkGroup.buttons) {
      const checked = id === snap.ink;
      btn.setAttribute('aria-checked', String(checked));
      btn.tabIndex = checked ? 0 : -1;
    }
    for (const [id, btn] of motionGroup.buttons) {
      const checked = id === snap.motion;
      btn.setAttribute('aria-checked', String(checked));
      btn.tabIndex = checked ? 0 : -1;
    }

    const edMeta = EDITION_OPTIONS.find(o => o.id === snap.edition) || EDITION_OPTIONS[0];
    const inkMeta = INK_OPTIONS.find(o => o.id === snap.ink) || INK_OPTIONS[0];
    const moMeta = MOTION_OPTIONS.find(o => o.id === snap.motion) || MOTION_OPTIONS[0];
    editionGroup.detail.textContent = edMeta.detail;
    inkGroup.detail.textContent = inkMeta.detail;
    motionGroup.detail.textContent = moMeta.detail;

    const isDefault = snap.edition === DEFAULT_PREFS.edition && snap.motion === DEFAULT_PREFS.motion && snap.ink === DEFAULT_PREFS.ink;
    resetBtn.disabled = isDefault;

    if (openBtn) {
      const available = Boolean(canPreview());
      openBtn.disabled = !available;
      openBtn.title = available ? '打开真实会话切换浮层预览当前配置' : '当前窗口少于 2 个可用会话，先在下方样例直接体验';
    }

    inlineSwitcher.refresh();
  }

  stops.push(prefs.subscribe(syncUI));
  if (options.subscribeTheme) stops.push(options.subscribeTheme(syncUI));
  syncUI();

  return {
    sync: syncUI,
    destroy() {
      stops.forEach(stop => stop());
      inlineSwitcher.destroy();
      root.remove();
    },
  };
}
