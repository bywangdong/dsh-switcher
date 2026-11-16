import { mountSwitcher } from '../src/plugin/view.js';
import { mountSettingsPanel } from '../src/plugin/settings.js';
import { remember, rememberVisit, candidates, sessionPresentation, createPrefsStore, PREF_KEYS, normalizeLocale, uiCopy } from '../src/plugin/core.js';

const params = new URLSearchParams(location.search);
let locale = params.has('lang') ? normalizeLocale(params.get('lang')) : 'zh';
document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';

const data = [
  { id: 'a', title: '打磨键盘导航体验', enTitle: 'Polish keyboard navigation', text: '想把高频操作连起来，尽量让双手留在键盘上。', enText: 'Connect frequent actions and keep hands on the keyboard.', kind: 'draft', label: '有草稿', draft: true },
  { id: 'b', title: '节点稳定性与切换策略', enTitle: 'Node stability and failover policy', text: '延迟很低但只稳定一小会儿的节点，不要急着切过去。', enText: 'Avoid switching to low-latency nodes before stability settles.', kind: 'running', label: '运行中' },
  { id: 'c', title: '左侧栏的焦点与候选状态', enTitle: 'Sidebar focus and candidate highlight', text: '上下移动的时候，先不要直接切换会话。', enText: 'Preview candidates when moving up and down before committing.', kind: 'idle', label: '会话已就绪' },
  { id: 'd', title: 'DSH 插件接入方案', enTitle: 'DSH plugin integration plan', text: '把插件的接入边界梳理一下。', enText: 'Clarify the host service boundaries for the plugin.', kind: 'approval', label: '等待用户确认' },
  { id: 'e', title: '一念 · 快速记录交互', enTitle: 'Trice · Quick capture flow', text: '打开就能写，历史记录也要容易找到。', enText: 'Ready to type on open with fast access to recent notes.', kind: 'unread', label: '有新结果' },
];
const projects = ['dsh-shortcutter', 'proxyAutoSwitch', 'dsh-shortcutter', 'dsh-switcher', 'Trice'];
// Minutes since each sample was last updated; idle cards show this instead of a constant label.
const ages = [0, 12, 185, 26 * 60, 9 * 24 * 60];
data.forEach((row, i) => { row.workspaceName = projects[i]; row.placeholder = '还没有输入'; row.updatedAt = new Date(Date.now() - ages[i] * 60000).toISOString(); });

if (params.get('scene') === 'quiet') {
  const titles = ['整理本周的发布检查清单', '键盘导航态的按键选择', '梳理安装与回退流程里的备份点', '在窄窗口里验证 Scroll 行为',
    '统一多个工作区的会话焦点与键盘导航体验并补充回归验证记录'];
  const enTitles = ['Prepare weekly release checklist', 'Keybinding choices for navigation mode', 'Audit backup points in install & rollback', 'Verify horizontal scroll in narrow windows',
    'Unify multi-workspace focus and keyboard navigation regression suite'];
  const quietAges = [4, 48, 390, 26 * 60, 9 * 24 * 60];
  data.forEach((row, i) => Object.assign(row, {
    kind: 'idle', label: '会话已就绪', draft: false, title: titles[i], enTitle: enTitles[i],
    workspaceName: i === 2 ? 'dsh-shortcutter' : 'Agent',
    updatedAt: new Date(Date.now() - quietAges[i] * 60000).toISOString(),
  }));
}
if (params.get('scene') === 'screenshot') {
  const shot = [
    { title: '人民币兑里拉汇率查询', workspaceName: 'Agent', days: 2 },
    { title: '讨论导航态快捷键选择', workspaceName: 'dsh-shortcutter', days: 5 },
    { title: '电脑软件删除优先级评估', workspaceName: 'Agent', days: 5 },
    { title: '石头扫地机支持米家接入', workspaceName: 'Agent', days: 6 },
    { title: '在无影云电脑上安装 Omarchy', workspaceName: 'Agent', days: 6 },
  ];
  data.forEach((row, i) => Object.assign(row, {
    kind: 'idle', label: '会话已就绪', draft: false,
    title: shot[i].title, workspaceName: shot[i].workspaceName,
    updatedAt: new Date(Date.now() - shot[i].days * 24 * 3600000).toISOString(),
  }));
}
if (params.get('scene') === 'mixed' || params.get('compare') === 'focus') {
  // The settings preview's rows: every status once, with one- and two-line titles.
  const mixed = [
    ['整理本周的发布检查清单', 'Agent', 'idle', 12],
    ['节点稳定性与切换策略', 'proxyAutoSwitch', 'running', 2],
    ['DSH 插件配置槽位接入验证', 'dsh-switcher', 'approval', 28],
    ['打磨键盘导航与草稿恢复体验', 'dsh-shortcutter', 'draft', 95],
    ['多工作区焦点与窄窗滚动回归', 'Agent', 'unread', 300],
  ];
  data.forEach((row, i) => {
    const [title, workspaceName, kind, minutes] = mixed[i];
    Object.assign(row, { title, workspaceName, kind, draft: kind === 'draft', updatedAt: new Date(Date.now() - minutes * 60000).toISOString() });
  });
}
if (params.get('scene') === 'real') {
  try {
    const response = await fetch('./design-lab/private/codex-conversations.json', { cache: 'no-store' });
    if (response.ok) {
      const { rows } = await response.json();
      if (Array.isArray(rows) && rows.length === data.length && rows.every(row => typeof row.title === 'string' && typeof row.text === 'string')) {
        rows.forEach((row, i) => Object.assign(data[i], { title: row.title, text: row.text, workspaceName: row.workspaceName || '未分组' }));
      }
    }
  } catch { /* Real content is an optional local-only QA fixture. */ }
}
if (params.get('scene') === 'stress') {
  data[0].workspaceName = 'dsh-switcher-experimental-navigation';
  data[0].title = '统一多个工作区的会话焦点与键盘导航体验';
  data[1].workspaceName = '多工作区与会话导航体验长期设计研究';
  data[1].title = 'Refine focus restoration across workspace boundaries';
  data[1].draft = true;
  data[2].workspaceName = '未分组'; data[2].text = '';
  data[3].text = '<script>alert("只是原文")</script>'; data[3].draft = true;
}

const prefsStore = createPrefsStore(typeof localStorage !== 'undefined' ? localStorage : undefined);
const prefOverrides = Object.fromEntries(PREF_KEYS.filter(key => params.has(key)).map(key => [key, params.get(key)]));
if (Object.keys(prefOverrides).length) prefsStore.update(prefOverrides);

let current = 'a', history = data.map(row => row.id), visitTimes = { a: Date.now() }, theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const listeners = new Set(), themeListeners = new Set(), localeListeners = new Set();

const statusOfRow = row => ({
  running: row.kind === 'running',
  completionUnread: row.kind === 'unread',
  pendingInteraction: row.kind === 'approval' ? { kind: 'approval' } : undefined,
});
const candidatesFor = scope => candidates(
  { ids: data.map(row => row.id), byId: Object.fromEntries(data.map(row => [row.id, { updatedAt: row.updatedAt }])) },
  [],
  history,
  current,
  data.filter(row => row.draft).map(row => row.id),
  {
    scope,
    visitedAt: visitTimes,
    statuses: Object.fromEntries(data.map(row => [row.id, statusOfRow(row)])),
  },
);

const host = {
  current: () => current,
  locale: () => locale,
  candidates: () => candidatesFor(prefsStore.getSnapshot().scope),
  theme: () => theme,
  prefs: () => prefsStore.getSnapshot(),
  exists: id => data.some(row => row.id === id),
  row(id) {
    const row = data.find(row => row.id === id);
    const en = locale === 'en';
    const ws = row.workspaceName === '未分组' ? uiCopy(locale).ungrouped : row.workspaceName;
    return {
      ...row,
      title: (en && row.enTitle) ? row.enTitle : row.title,
      text: (en && row.enText !== undefined && row.text) ? row.enText : row.text,
      workspaceName: ws,
      placeholder: uiCopy(locale).inputEmpty,
      ...sessionPresentation(statusOfRow(row), { updatedAt: row.updatedAt }, row.draft, Date.now(), locale),
    };
  },
  preview: () => () => {},
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  open(id) {
    const at = Date.now();
    visitTimes = rememberVisit(rememberVisit(visitTimes, current, at), id, at);
    current = id; history = remember(history, id);
    publish();
  },
};

function syncDemoChrome() {
  const en = locale === 'en';
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  document.title = en ? 'DSH Switcher · Plugin UI & Config Preview' : 'DSH Switcher · 插件界面与配置验证';
  const titleEl = document.getElementById('demo-title');
  const descEl = document.getElementById('demo-desc');
  const currentEl = document.getElementById('current');
  const draftEl = document.getElementById('demo-draft');
  if (titleEl) titleEl.textContent = en ? 'dsh-switcher · Plugin Settings Preview' : 'dsh-switcher · 插件详情页配置预览';
  if (descEl) {
    descEl.innerHTML = en
      ? 'Mounts production <code>src/plugin/settings.js</code> and <code>src/plugin/view.js</code> directly with fixture data.'
      : '以下直接挂载正式 <code>src/plugin/settings.js</code> 与 <code>src/plugin/view.js</code>，数据为验证样例。';
  }
  if (currentEl) currentEl.textContent = `${en ? 'Current: ' : '当前：'}${host.row(current).title}`;
  if (draftEl) {
    draftEl.setAttribute('aria-label', en ? 'Test draft' : '测试草稿');
    draftEl.placeholder = en ? 'Type a draft, then test Esc cancel and focus restoration' : '可输入草稿，再测试 Esc 取消与焦点恢复';
  }
  const navLabels = en
    ? { show: 'Open Overlay', 'close-overlay': 'Hide Overlay', lang: '中文', light: 'Light', dark: 'Dark', state: 'Toggle Status', project: 'Rename Project', dispose: 'Dispose UI' }
    : { show: '体验浮层', 'close-overlay': '收起浮层看配置', lang: 'English', light: '亮色', dark: '暗色', state: '改变运行状态', project: '重命名项目', dispose: '卸载界面' };
  for (const [id, text] of Object.entries(navLabels)) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = text;
  }
}

const publish = () => {
  document.body.dataset.theme = theme;
  syncDemoChrome();
  for (const fn of [...listeners]) fn();
  for (const fn of [...themeListeners]) fn();
  for (const fn of [...localeListeners]) fn();
};
prefsStore.subscribe(() => { for (const fn of [...listeners]) fn(); });

const controller = mountSwitcher(document.getElementById('mount'), host);
const settings = mountSettingsPanel(document.getElementById('settings-mount'), {
  prefs: prefsStore,
  getTheme: () => theme,
  subscribeTheme: fn => { themeListeners.add(fn); return () => themeListeners.delete(fn); },
  getLocale: () => locale,
  subscribeLocale: fn => { localeListeners.add(fn); return () => localeListeners.delete(fn); },
  canPreview: () => host.candidates().length >= 2,
  onPreview: () => controller.begin(1, true),
});

document.getElementById('show').onclick = () => controller.begin(1, true);
document.getElementById('close-overlay').onclick = () => controller.cancel();
document.getElementById('lang').onclick = () => { locale = locale === 'zh' ? 'en' : 'zh'; publish(); };
for (const value of ['light', 'dark']) document.getElementById(value).onclick = () => { theme = value; publish(); };
document.getElementById('state').onclick = () => { data[1].kind = data[1].kind === 'running' ? 'approval' : 'running'; publish(); };
document.getElementById('project').onclick = () => {
  const renamed = locale === 'en' ? 'renamed-workspace' : '新工作区名称';
  data[1].workspaceName = (data[1].workspaceName === '新工作区名称' || data[1].workspaceName === 'renamed-workspace') ? projects[1] : renamed;
  publish();
};
document.getElementById('dispose').onclick = () => { controller.destroy(); settings.destroy(); };

// Native-key semantics can be exercised through an alternate test chord in the browser.
window.addEventListener('keydown', event => {
  if (event.ctrlKey && event.code === 'KeyK' && !controller.active) { event.preventDefault(); controller.begin(event.shiftKey ? -1 : 1); }
});

document.body.dataset.backdrop = params.get('backdrop') === 'reference' ? 'reference' : 'fixture';
document.body.dataset.clean = String(params.get('clean') === '1');
publish();

// Labelled rows of the same sessions, one per preference override, with nothing to choose.
const comparisons = {
  ink: [
    ['0.1.11 原版 · 清隽细体 (soft)', { ink: 'soft' }],
    ['0.1.12 候选 A · 清晰实色 (crisp：未选中 400 · 选中 500)', { ink: 'crisp' }],
    ['0.1.12 候选 B · 凝实中黑 (medium：全卡 500 中黑)', { ink: 'medium' }],
  ],
  focus: [
    ['旧默认 · 项目轻胶囊 / 运行中与新结果同蓝 / 标题两行同色', { project: 'chip', signal: 'classic', title: 'even' }],
    ['现默认（推荐）· 项目纯文字 / 只标待处理 / 标题首行为主', { project: 'plain', signal: 'attention', title: 'lead' }],
  ],
  scope: [
    ['固定五卡 (classic) · 始终拿旧历史凑满 5 张', { scope: 'classic' }],
    ['当日宽窗 (day) · 8 小时内活跃 + 未完结状态常驻（3～5 张）', { scope: 'day' }],
    ['热工作集 (hot，默认) · 2 小时内活跃 + 未完结状态常驻（3～5 张弹性）', { scope: 'hot' }],
    ['精简三卡 (top3) · 热工作集优先，始终最多 3 张', { scope: 'top3' }],
  ],
};
const comparison = comparisons[params.get('compare')];
if (comparison) {
  controller.cancel();
  const stack = document.createElement('div');
  stack.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;';
  for (const [tag, override] of comparison) {
    const rowWrap = document.createElement('div');
    rowWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:4px;';
    const badge = document.createElement('div');
    badge.style.cssText = 'padding:2px 8px;border-radius:6px;font:500 11px/16px -apple-system,"PingFang SC",sans-serif;background:rgb(15 17 21/.72);color:#f9fafb;backdrop-filter:blur(8px);';
    badge.textContent = tag;
    const slot = document.createElement('div');
    rowWrap.append(badge, slot);
    stack.append(rowWrap);
    const mergedPrefs = () => ({ ...prefsStore.getSnapshot(), edition: params.get('edition') || 'kibutsu', ...override });
    const subHost = {
      ...host,
      candidates: () => candidatesFor(mergedPrefs().scope),
      prefs: mergedPrefs,
    };
    const sub = mountSwitcher(slot, subHost, { inline: true });
    sub.begin(1, true);
  }
  document.body.append(stack);
} else if (params.get('view') !== 'settings') {
  controller.begin(params.get('first') === '1' ? 0 : 1, true);
}

if (params.get('selftest') === '1') {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  (async () => {
    await sleep(60);
    const out = { heights: {}, settingsButtons: {} };
    if (!controller.active) controller.begin(1, true);
    await sleep(40);
    for (const ed of ['kibutsu', 'sujian', 'jiechi', 'moyun', 'b2', 'split']) {
      prefsStore.update({ edition: ed, motion: 'balanced' });
      await new Promise(r => requestAnimationFrame(r));
      const card = document.querySelector('#mount .dsh-switcher-card');
      const overlay = document.querySelector('#mount .dsh-switcher');
      out.heights[ed] = {
        h: Math.round(card.getBoundingClientRect().height),
        w: Math.round(card.getBoundingClientRect().width),
        excerpt: Boolean(card.querySelector('.dsh-switcher-excerpt')),
        here: Boolean(card.querySelector('.dsh-switcher-here')),
        lens: overlay.dataset.lens === 'true',
      };
    }
    prefsStore.reset();
    await new Promise(r => requestAnimationFrame(r));
    const overlayPanel = document.querySelector('#mount .dsh-switcher-panel');
    const lens = document.querySelector('#mount .dsh-switcher-lens');
    out.panelWidth = Math.round(overlayPanel.getBoundingClientRect().width);
    out.lensTransform = lens?.style.transform || '';
    out.settingsEditions = document.querySelectorAll('#settings-mount [data-edition-opt]').length;
    out.settingsInks = document.querySelectorAll('#settings-mount [data-ink-opt]').length;
    out.settingsMotions = document.querySelectorAll('#settings-mount [data-motion-opt]').length;
    out.settingsRefinements = document.querySelectorAll('#settings-mount :is([data-project-opt], [data-signal-opt], [data-title-opt])').length;
    out.inlinePreviewCards = document.querySelectorAll('#settings-mount .dsh-switcher-card').length;
    if (params.get('view') === 'settings') controller.cancel();

    const pre = document.createElement('pre');
    pre.id = 'plugin-selftest';
    pre.style.cssText = 'position:fixed;top:8px;right:8px;z-index:20000;margin:0;padding:10px 12px;border-radius:10px;background:rgb(18 19 22/.92);color:#d7f5e1;font:11px/1.45 ui-monospace,monospace;max-width:440px;white-space:pre-wrap;border:1px solid rgb(255 255 255/.14);';
    pre.textContent = JSON.stringify(out, null, 2);
    document.body.append(pre);
  })();
}
