import { mountSwitcher } from '../src/plugin/view.js';
import { mountSettingsPanel } from '../src/plugin/settings.js';
import { remember, sessionPresentation, createPrefsStore } from '../src/plugin/core.js';

const params = new URLSearchParams(location.search);
const data = [
  { id: 'a', title: '打磨键盘导航体验', text: '想把高频操作连起来，尽量让双手留在键盘上。', kind: 'draft', label: '有草稿', draft: true },
  { id: 'b', title: '节点稳定性与切换策略', text: '延迟很低但只稳定一小会儿的节点，不要急着切过去。', kind: 'running', label: '运行中' },
  { id: 'c', title: '左侧栏的焦点与候选状态', text: '上下移动的时候，先不要直接切换会话。', kind: 'idle', label: '会话已就绪' },
  { id: 'd', title: 'DSH 插件接入方案', text: '把插件的接入边界梳理一下。', kind: 'approval', label: '等待用户确认' },
  { id: 'e', title: '一念 · 快速记录交互', text: '打开就能写，历史记录也要容易找到。', kind: 'unread', label: '有新结果' },
];
const projects = ['dsh-shortcutter', 'proxyAutoSwitch', 'dsh-shortcutter', 'dsh-switcher', 'Trice'];
// Minutes since each sample was last updated; idle cards show this instead of a constant label.
const ages = [0, 12, 185, 26 * 60, 9 * 24 * 60];
data.forEach((row, i) => { row.workspaceName = projects[i]; row.placeholder = '还没有输入'; row.updatedAt = new Date(Date.now() - ages[i] * 60000).toISOString(); });

if (params.get('scene') === 'quiet') {
  const titles = ['整理本周的发布检查清单', '键盘导航态的按键选择', '梳理安装与回退流程里的备份点', '在窄窗口里验证 Scroll 行为',
    '统一多个工作区的会话焦点与键盘导航体验并补充回归验证记录'];
  data.forEach((row, i) => Object.assign(row, { kind: 'idle', label: '会话已就绪', draft: false, title: titles[i],
    workspaceName: i === 2 ? 'dsh-shortcutter' : 'Agent' }));
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
if (params.has('edition') || params.has('motion')) {
  prefsStore.update({
    ...(params.has('edition') ? { edition: params.get('edition') } : {}),
    ...(params.has('motion') ? { motion: params.get('motion') } : {}),
  });
}

let current = 'a', history = data.map(row => row.id), theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const listeners = new Set(), themeListeners = new Set();
const publish = () => {
  document.body.dataset.theme = theme;
  for (const fn of [...listeners]) fn();
  for (const fn of [...themeListeners]) fn();
};
prefsStore.subscribe(() => { for (const fn of [...listeners]) fn(); });

const host = {
  current: () => current,
  candidates: () => history,
  theme: () => theme,
  prefs: () => prefsStore.getSnapshot(),
  exists: id => data.some(row => row.id === id),
  row(id) {
    const row = data.find(row => row.id === id);
    return { ...row, ...sessionPresentation({ running: row.kind === 'running', completionUnread: row.kind === 'unread',
      pendingInteraction: row.kind === 'approval' ? { kind: 'approval' } : undefined }, { updatedAt: row.updatedAt }, row.draft) };
  },
  preview: () => () => {},
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  open(id) { current = id; history = remember(history, id); document.getElementById('current').textContent = `当前：${host.row(id).title}`; publish(); },
};

const controller = mountSwitcher(document.getElementById('mount'), host);
const settings = mountSettingsPanel(document.getElementById('settings-mount'), {
  prefs: prefsStore,
  getTheme: () => theme,
  subscribeTheme: fn => { themeListeners.add(fn); return () => themeListeners.delete(fn); },
  canPreview: () => host.candidates().length >= 2,
  onPreview: () => controller.begin(1, true),
});

document.getElementById('show').onclick = () => controller.begin(1, true);
document.getElementById('close-overlay').onclick = () => controller.cancel();
for (const value of ['light', 'dark']) document.getElementById(value).onclick = () => { theme = value; publish(); };
document.getElementById('state').onclick = () => { data[1].kind = data[1].kind === 'running' ? 'approval' : 'running'; data[1].label = data[1].kind === 'running' ? '运行中' : '等待用户确认'; publish(); };
document.getElementById('project').onclick = () => { data[1].workspaceName = data[1].workspaceName === '新工作区名称' ? projects[1] : '新工作区名称'; publish(); };
document.getElementById('dispose').onclick = () => { controller.destroy(); settings.destroy(); };

// Native-key semantics can be exercised through an alternate test chord in the browser.
window.addEventListener('keydown', event => {
  if (event.ctrlKey && event.code === 'KeyK' && !controller.active) { event.preventDefault(); controller.begin(event.shiftKey ? -1 : 1); }
});

document.body.dataset.backdrop = params.get('backdrop') === 'reference' ? 'reference' : 'fixture';
document.body.dataset.clean = String(params.get('clean') === '1');
publish();
if (params.get('view') !== 'settings') controller.begin(params.get('first') === '1' ? 0 : 1, true);

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
    out.settingsMotions = document.querySelectorAll('#settings-mount [data-motion-opt]').length;
    out.inlinePreviewCards = document.querySelectorAll('#settings-mount .dsh-switcher-card').length;
    if (params.get('view') === 'settings') controller.cancel();

    const pre = document.createElement('pre');
    pre.id = 'plugin-selftest';
    pre.style.cssText = 'position:fixed;top:8px;right:8px;z-index:20000;margin:0;padding:10px 12px;border-radius:10px;background:rgb(18 19 22/.92);color:#d7f5e1;font:11px/1.45 ui-monospace,monospace;max-width:440px;white-space:pre-wrap;border:1px solid rgb(255 255 255/.14);';
    pre.textContent = JSON.stringify(out, null, 2);
    document.body.append(pre);
  })();
}
