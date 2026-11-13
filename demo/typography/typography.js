import { phraseBreaks, sessionPresentation } from '../../src/plugin/core.js';
import { createFivebeatMotion } from '../../src/plugin/motion.js';

const VARIANTS = {
  crisp: {
    name: 'A · 清朗 400→500（推荐）',
    desc: '标题 14px/20px · 未选中 400 Regular → 选中 500 Medium · 零负字距 · 取消 balance 强拆短句 · 题签降重退后 · 仅在真正截断时挂 title',
  },
  medium: {
    name: 'B · 凝练 500 恒重',
    desc: '标题恒定 14px/500 Medium（中英文切换零字宽抖动）· 靠明度对比区分焦点 · 取消题签硬分割线，纯靠极淡底色分区',
  },
  airy: {
    name: 'C · 精密 13.5px + 清透亮选',
    desc: '标题收敛至 13.5px 贴近 DSH 原生字阶 · 卡片留白更足 · 亮色选中卡改为清透微抬升白底（对照解决亮色水泥灰蒙感）',
  },
};

const now = Date.now();
const ago = minutes => new Date(now - minutes * 60000).toISOString();

function buildScene(scene) {
  if (scene === 'states') {
    return [
      { id: '1', workspaceName: 'dsh-shortcutter', title: '打磨键盘导航与焦点恢复体验', text: '想把高频操作连起来，尽量让双手留在键盘上。', kind: 'draft', draft: true, updatedAt: ago(3) },
      { id: '2', workspaceName: 'proxyAutoSwitch', title: '节点稳定性检测与自动切换策略', text: '延迟很低但只稳定一小会儿的节点，不要急着切过去。', kind: 'running', draft: false, updatedAt: ago(12) },
      { id: '3', workspaceName: 'Agent', title: '外币兑日元实时汇率换算', text: '400USD 折合多少日元？按今天中间价算。', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
      { id: '4', workspaceName: 'dsh-switcher', title: 'DSH 宿主插件边界与热加载验证', text: '把插件的公共服务接入边界再核对一遍。', kind: 'approval', draft: false, updatedAt: ago(28 * 60) },
      { id: '5', workspaceName: 'Trice', title: '在远程云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装配置', kind: 'unread', draft: false, updatedAt: ago(5 * 1440) },
    ];
  }
  if (scene === 'stress') {
    return [
      { id: '1', workspaceName: 'dsh-switcher-experimental-navigation', title: '统一多个工作区的会话焦点与键盘导航体验并补充完整回归记录', text: '当窗口变窄或者项目名很长时，当前标记和省略号需要稳定共存，悬停才提示完整文案。', kind: 'idle', draft: false, updatedAt: ago(18) },
      { id: '2', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '这一张标题刚好 11 个字，在 14px 下无需换行也无需弹提示框。', kind: 'idle', draft: true, updatedAt: ago(2 * 60) },
      { id: '3', workspaceName: '多工作区与长会话导航体验设计研究', title: 'Refine focus restoration across nested workspace boundaries and modals', text: 'English mixed title wrapping and truncation behavior under fixed 182px card geometry.', kind: 'running', draft: false, updatedAt: ago(45) },
      { id: '4', workspaceName: '未分组', title: '短标题留白对齐', text: '', placeholder: '还没有输入', kind: 'idle', draft: false, updatedAt: ago(3 * 1440) },
      { id: '5', workspaceName: 'Agent', title: '检查 <script> 原文转义与符号混排', text: '100% 原始输入：<div class="test">400RMB ≈ 2,996 TRY</div>', kind: 'unread', draft: false, updatedAt: ago(6 * 1440) },
    ];
  }
  // Default `everyday`: mirrors the exact structure of the user's live screenshots
  // (4x "Agent" + 1x "dsh-shortcutter", all idle with timestamps, 10-char & 11-char CJK + mixed Omarchy).
  return [
    { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件和缓存可以优先清理掉', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
    { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
    { id: '3', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以一起收敛成一套默认方案', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
    { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？先核对一下具体接入型号', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
    { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
  ];
}

const params = new URLSearchParams(location.search);
let theme = params.get('theme') === 'light' ? 'light' : 'dark';
let variant = VARIANTS[params.get('variant')] ? params.get('variant') : 'crisp';
let view = params.get('view') === 'immersive' ? 'immersive' : 'split';
let scene = ['everyday', 'states', 'stress'].includes(params.get('scene')) ? params.get('scene') : 'everyday';
let selectedIndex = Number.isInteger(Number(params.get('select'))) ? Math.max(0, Math.min(4, Number(params.get('select')))) : 1;
let holdingBaseline = false;

function createSwitcherInstance(container, typoMode, onSelect) {
  const motion = createFivebeatMotion();
  const overlay = document.createElement('div');
  overlay.className = 'dsh-switcher';
  overlay.dataset.revealed = 'true';
  overlay.dataset.pointer = 'mouse';
  overlay.dataset.theme = theme;
  overlay.dataset.typo = typoMode;
  overlay.setAttribute('role', 'region');

  const panel = document.createElement('div');
  panel.className = 'dsh-switcher-panel';
  panel.style.setProperty('--sw-width', `${5 * 182 + 32}px`);

  const list = document.createElement('div');
  list.className = 'dsh-switcher-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', typoMode === 'baseline' ? '原版候选会话' : '精修版候选会话');

  const cards = [];
  for (let index = 0; index < 5; index++) {
    const card = document.createElement('div');
    card.className = 'dsh-switcher-card';
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', 'false');

    const project = document.createElement('span');
    project.className = 'dsh-switcher-project';
    const projectName = document.createElement('span');
    projectName.className = 'dsh-switcher-project-name';
    const here = document.createElement('span');
    here.className = 'dsh-switcher-here';
    here.textContent = '当前';
    project.append(projectName, here);

    const title = document.createElement('span');
    title.className = 'dsh-switcher-title';

    const status = document.createElement('div');
    status.className = 'dsh-switcher-status';
    const icon = document.createElement('span');
    icon.className = 'dsh-switcher-icon';
    icon.setAttribute('aria-hidden', 'true');
    const statusLabel = document.createElement('span');
    statusLabel.className = 'dsh-switcher-status-label';
    status.append(icon, statusLabel);

    const excerpt = document.createElement('p');
    excerpt.className = 'dsh-switcher-excerpt';

    card.append(project, title, status, excerpt);
    list.append(card);

    const iconMotion = motion.mount(icon, 'idle', false);
    card.addEventListener('click', () => onSelect(index));
    cards.push({ card, project, projectName, title, status, statusLabel, excerpt, icon, iconMotion });
  }

  panel.append(list);
  overlay.append(panel);
  container.replaceChildren(overlay);

  function syncTooltipsAndBalance(rowsData, currentTypo) {
    const isBaseline = currentTypo === 'baseline';
    cards.forEach((node, index) => {
      const row = rowsData[index];
      const text = row.text || row.placeholder || '';
      if (isBaseline) {
        node.project.title = row.workspaceName;
        node.title.title = row.title;
        node.status.title = row.presentation.label;
        node.icon.title = row.presentation.label;
        node.excerpt.title = text;
        node.title.dataset.balance = String(node.title.scrollHeight <= node.title.clientHeight);
      } else {
        node.title.dataset.balance = 'false';
        node.project.title = node.projectName.scrollWidth > node.projectName.clientWidth + 1 ? row.workspaceName : '';
        node.title.title = node.title.scrollHeight > node.title.clientHeight + 1 ? row.title : '';
        node.excerpt.title = row.text && node.excerpt.scrollWidth > node.excerpt.clientWidth + 1 ? row.text : '';
        node.status.title = '';
        node.icon.title = '';
      }
    });
  }

  function update({ rowsData, currentTheme, currentTypo, activeIndex }) {
    overlay.dataset.theme = currentTheme;
    overlay.dataset.typo = currentTypo;
    cards.forEach((node, index) => {
      const row = rowsData[index];
      const here = index === 0;
      const text = row.text || row.placeholder || '';
      node.card.dataset.current = String(here);
      node.card.setAttribute('aria-selected', String(index === activeIndex));
      node.card.setAttribute('aria-label', `${row.workspaceName}，${row.title}，${row.presentation.label}${here ? '，当前会话' : ''}`);
      node.projectName.textContent = row.workspaceName;
      node.title.textContent = phraseBreaks(row.title);
      node.status.dataset.status = row.presentation.kind;
      node.icon.dataset.status = row.presentation.kind;
      node.statusLabel.textContent = row.presentation.shortLabel;
      node.excerpt.textContent = text;
      node.excerpt.dataset.empty = String(!row.text);
      node.iconMotion.update(row.presentation.kind, row.draft);
    });
    requestAnimationFrame(() => {
      syncTooltipsAndBalance(rowsData, currentTypo);
      const viewportWidth = list.clientWidth;
      if (viewportWidth > 0) {
        const left = activeIndex * 182, right = left + 182;
        if (left < list.scrollLeft) list.scrollLeft = left;
        else if (right > list.scrollLeft + viewportWidth) list.scrollLeft = right - viewportWidth;
      }
    });
  }

  return { update, destroy: () => motion.destroy() };
}

const selectCard = index => {
  selectedIndex = (index + 5) % 5;
  renderAll();
};

const baselineView = createSwitcherInstance(document.getElementById('mount-baseline'), 'baseline', selectCard);
const refinedView = createSwitcherInstance(document.getElementById('mount-refined'), variant, selectCard);
const immersiveView = createSwitcherInstance(document.getElementById('mount-immersive'), variant, selectCard);

function prepareRows() {
  return buildScene(scene).map(row => ({
    ...row,
    presentation: sessionPresentation(
      {
        running: row.kind === 'running',
        completionUnread: row.kind === 'unread',
        pendingInteraction: row.kind === 'approval' ? { kind: 'approval' } : undefined,
      },
      { updatedAt: row.updatedAt },
      row.draft,
      now
    ),
  }));
}

function renderAll() {
  document.body.dataset.theme = theme;
  document.body.dataset.view = view;
  document.body.dataset.variant = variant;

  document.getElementById('split-stage').hidden = view !== 'split';
  document.getElementById('immersive-stage').hidden = view !== 'immersive';

  for (const btn of document.querySelectorAll('[data-variant]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.variant === variant));
  }
  for (const btn of document.querySelectorAll('[data-view]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  }
  for (const btn of document.querySelectorAll('[data-theme]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme));
  }
  document.getElementById('scene').value = scene;

  const info = VARIANTS[variant];
  document.getElementById('refined-badge').textContent = info.name;
  document.getElementById('refined-desc').textContent = info.desc;

  const effectiveImmersiveTypo = holdingBaseline ? 'baseline' : variant;
  document.getElementById('immersive-status').textContent = holdingBaseline
    ? '当前按住对比：0.1.10 原版'
    : `当前预览：${info.name}`;
  document.getElementById('hold-baseline').setAttribute('aria-pressed', String(holdingBaseline));

  const rowsData = prepareRows();
  baselineView.update({ rowsData, currentTheme: theme, currentTypo: 'baseline', activeIndex: selectedIndex });
  refinedView.update({ rowsData, currentTheme: theme, currentTypo: variant, activeIndex: selectedIndex });
  immersiveView.update({ rowsData, currentTheme: theme, currentTypo: effectiveImmersiveTypo, activeIndex: selectedIndex });
}

for (const btn of document.querySelectorAll('[data-variant]')) {
  btn.addEventListener('click', () => { variant = btn.dataset.variant; renderAll(); });
}
for (const btn of document.querySelectorAll('[data-view]')) {
  btn.addEventListener('click', () => { view = btn.dataset.view; renderAll(); });
}
for (const btn of document.querySelectorAll('[data-theme]')) {
  btn.addEventListener('click', () => { theme = btn.dataset.theme; renderAll(); });
}
document.getElementById('scene').addEventListener('change', event => {
  scene = event.target.value;
  renderAll();
});

const holdBtn = document.getElementById('hold-baseline');
const setHold = value => {
  if (holdingBaseline === value) return;
  holdingBaseline = value;
  renderAll();
};
holdBtn.addEventListener('pointerdown', () => setHold(true));
window.addEventListener('pointerup', () => setHold(false));
window.addEventListener('pointercancel', () => setHold(false));

window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLSelectElement) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); selectCard(selectedIndex + 1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); selectCard(selectedIndex - 1); }
  else if (event.code === 'Space' && view === 'immersive') { event.preventDefault(); setHold(true); }
});
window.addEventListener('keyup', event => {
  if (event.code === 'Space') setHold(false);
});

renderAll();
