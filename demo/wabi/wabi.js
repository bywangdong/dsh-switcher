import { phraseBreaks, sessionPresentation } from '../../src/plugin/core.js';
import { createFivebeatMotion } from '../../src/plugin/motion.js';
import { createStudioIconMotion } from './icon-motion.js';

const EDITIONS = [
  {
    id: 'kibutsu',
    code: '02 · 主推器物版',
    name: '器物 Kibutsu（136px 凝练横册）',
    summary: '去掉「最后一次输入」后顺势将卡高由 158px 收至 136px（外框 942×168），比例最精悍；顶栏状态先行（活跃卡右侧附 5px 同色微点），中部两行标题，底部统一中性轻胶囊落款。',
  },
  {
    id: 'sujian',
    code: '01 · 主推留白版',
    name: '素笺 Sujian（158px 原尺寸留白）',
    summary: '严格保留原 942×190 外框尺寸，把省去第 4 行释放的空间全部留白；14px/21px 行距，最从容。',
  },
  {
    id: 'jiechi',
    code: '03 · 极致减法',
    name: '界尺 Jiechi（无框竖线）',
    summary: '隐去未选中卡片的边框与底色，相邻列之间仅以一道 1px 灰色竖线分界；只有选中列浮现卡面，框线最少。',
  },
  {
    id: 'moyun',
    code: '04 · 状态底衬',
    name: '墨韵 Moyun（活跃状态淡底）',
    summary: '把「先看状态」推到极致：空闲时间退为淡灰，运行中 / 新结果 / 待确认在顶部加一层同色淡底；底部项目退为无框微标，不在一张卡上叠两个胶囊。',
  },
];

const FOLDER_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.75 4.1c0-.75.6-1.35 1.35-1.35h2.35c.38 0 .74.17.98.47l.64.78h3.83c.75 0 1.35.6 1.35 1.35v4.55c0 .75-.6 1.35-1.35 1.35H3.1c-.75 0-1.35-.6-1.35-1.35V4.1Z"/></svg>';

const now = Date.now();
const ago = minutes => new Date(now - minutes * 60000).toISOString();

function buildScene(scene) {
  if (scene === 'busy') {
    return [
      { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件可以清理掉', kind: 'running', draft: false, updatedAt: ago(1) },
      { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'approval', draft: false, updatedAt: ago(4) },
      { id: '3', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以收敛', kind: 'running', draft: false, updatedAt: ago(2) },
      { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？先核对具体型号', kind: 'question', draft: false, updatedAt: ago(9) },
      { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: true, updatedAt: ago(5 * 1440) },
    ];
  }
  if (scene === 'quiet') {
    return [
      { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件可以清理掉', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
      { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
      { id: '3', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以收敛', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
      { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
      { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
    ];
  }
  if (scene === 'stress') {
    return [
      { id: '1', workspaceName: 'dsh-switcher-experimental-navigation', title: '统一多个工作区的会话焦点与键盘导航体验并补充完整回归记录', text: '超长工作区与两行截断标题下，依然保留从容的纵向余白。', kind: 'approval', draft: true, updatedAt: ago(5) },
      { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'running', draft: false, updatedAt: ago(2) },
      { id: '3', workspaceName: '多工作区与长会话导航体验长期研究', title: 'Refine focus restoration across nested workspace boundaries and overlays', text: 'Mixed English & CJK wrapping check.', kind: 'unread', draft: false, updatedAt: ago(48) },
      { id: '4', workspaceName: '未分组', title: '极短标题气韵', text: '', kind: 'idle', draft: false, updatedAt: ago(2 * 1440) },
      { id: '5', workspaceName: 'dsh-shortcutter', title: '检查草稿与空闲时间并存时的克制表现', text: '草稿微记测试', kind: 'idle', draft: true, updatedAt: ago(6 * 1440) },
    ];
  }
  // Default `mixed`: Realistic daily mix showing WHY Status-First immediately distinguishes sessions!
  return [
    { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件和缓存可以优先清理掉', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
    { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'running', draft: false, updatedAt: ago(2) },
    { id: '3', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以一起收敛成一套默认方案', kind: 'approval', draft: false, updatedAt: ago(18) },
    { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？先核对一下具体接入型号', kind: 'unread', draft: false, updatedAt: ago(3 * 60) },
    { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: true, updatedAt: ago(5 * 1440) },
  ];
}

function makeFolderIcon() {
  const span = document.createElement('span');
  span.className = 'dsh-ws-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = FOLDER_SVG;
  return span;
}

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionOn = () => document.body.dataset.motion !== 'off' && !reducedMotion.matches;
const CARD = 182;

function createWabiRenderer(container, onSelect) {
  let motion = createStudioIconMotion('balanced');
  const overlay = document.createElement('div');
  overlay.className = 'dsh-switcher';
  overlay.dataset.revealed = 'true';
  overlay.dataset.pointer = 'mouse';
  overlay.setAttribute('role', 'region');

  const panel = document.createElement('div');
  panel.className = 'dsh-switcher-panel';
  panel.style.setProperty('--sw-width', `${5 * CARD + 32}px`);

  const list = document.createElement('div');
  list.className = 'dsh-switcher-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', '最近会话');

  panel.append(list);
  overlay.append(panel);
  container.replaceChildren(overlay);

  let key = '', nodes = [], lens = null, current = -1, scrollPos = 0;

  // One shared highlight glides between cards, so each Ctrl+Tab step reads as a
  // direction rather than a blink. Transitions retarget mid-flight on key repeat.
  function placeLens(index, animate) {
    if (!lens) return;
    const transform = `translateX(${index * CARD}px)`;
    if (animate && motionOn()) { lens.style.transform = transform; return; }
    lens.style.transition = 'none';
    lens.style.transform = transform;
    void lens.offsetWidth;
    lens.style.transition = '';
  }

  // Same arithmetic as the plugin (fixed 182px cards, no layout read per step).
  function scrollToIndex(index, animate) {
    const viewport = list.clientWidth;
    if (!viewport) return;
    const left = index * CARD, right = left + CARD;
    const next = left < scrollPos ? left : right > scrollPos + viewport ? right - viewport : scrollPos;
    if (next === scrollPos) return;
    scrollPos = next;
    list.scrollTo({ left: next, behavior: animate && motionOn() ? 'smooth' : 'auto' });
  }

  function select(index) {
    if (index === current || !nodes[index]) return;
    const prev = current, n = nodes.length;
    nodes[prev]?.card.setAttribute('aria-selected', 'false');
    nodes[index].card.setAttribute('aria-selected', 'true');
    current = index;
    // Wrapping from the last card to the first jumps: a 4-card sweep in 150ms only flickers.
    const wrap = prev >= 0 && n > 2 && Math.abs(index - prev) === n - 1;
    const animate = prev >= 0 && !wrap;
    placeLens(index, animate);
    scrollToIndex(index, animate);
  }

  function labelFor(row, here) {
    return `${row.presentation.label}，${row.title}，${row.workspaceName}${here ? '，当前会话' : ''}`;
  }

  function build(rowsData, showSavedB2, iconMotionMode) {
    motion.destroy();
    motion = showSavedB2 ? createFivebeatMotion() : createStudioIconMotion(iconMotionMode);
    nodes = [];
    current = -1;
    scrollPos = 0;
    list.replaceChildren();
    list.scrollLeft = 0;

    lens = null;
    if (!showSavedB2) {
      lens = document.createElement('div');
      lens.className = 'dsh-switcher-lens';
      lens.setAttribute('aria-hidden', 'true');
      list.append(lens);
    }

    rowsData.forEach((row, index) => {
      const here = index === 0;
      const card = document.createElement('div');
      card.className = 'dsh-switcher-card';
      card.dataset.current = String(here);
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', 'false');
      // Accessible label also follows the new cognitive order: Status -> Title -> Project
      card.setAttribute('aria-label', labelFor(row, here));
      card.addEventListener('click', () => onSelect(index));

      const status = document.createElement('div');
      status.className = 'dsh-switcher-status';
      status.dataset.status = row.presentation.kind;
      const icon = document.createElement('span');
      icon.className = 'dsh-switcher-icon';
      icon.dataset.status = row.presentation.kind;
      icon.setAttribute('aria-hidden', 'true');
      const statusLabel = document.createElement('span');
      statusLabel.className = 'dsh-switcher-status-label';
      statusLabel.textContent = row.presentation.shortLabel;
      const pulseDot = document.createElement('span');
      pulseDot.className = 'dsh-pulse-dot';
      pulseDot.setAttribute('aria-hidden', 'true');
      status.append(icon, statusLabel, pulseDot);

      const title = document.createElement('span');
      title.className = 'dsh-switcher-title';
      title.textContent = phraseBreaks(row.title);

      const project = document.createElement('span');
      project.className = 'dsh-switcher-project';
      const chip = document.createElement('span');
      chip.className = 'dsh-ws-chip';
      const chipText = document.createElement('span');
      chipText.className = 'dsh-ws-chip-text';
      chipText.textContent = row.workspaceName;
      chip.append(makeFolderIcon(), chipText);
      project.append(chip);

      const handle = motion.mount(icon, row.presentation.kind, row.draft);

      if (showSavedB2) {
        const excerpt = document.createElement('p');
        excerpt.className = 'dsh-switcher-excerpt';
        excerpt.textContent = row.text || '还没有输入';
        excerpt.dataset.empty = String(!row.text);
        card.append(project, title, status, excerpt);
      } else {
        // Strict DOM order matching visual & screen-reader priority: Status -> Title -> Project
        card.append(status, title, project);
      }

      list.append(card);
      nodes.push({ card, title, chip, chipText, status, icon, statusLabel, handle, row, here });
    });

    requestAnimationFrame(() => {
      for (const item of nodes) {
        const wsTruncated = item.chipText.scrollWidth > item.chipText.clientWidth + 1;
        item.chip.title = wsTruncated ? item.row.workspaceName : '';
        item.title.title = item.title.scrollHeight > item.title.clientHeight + 1 ? item.row.title : '';
        item.status.title = item.statusLabel.scrollWidth > item.statusLabel.clientWidth + 1 ? item.row.presentation.label : '';
      }
    });
  }

  // Live updates patch in place (as the plugin's refresh does), so a state change
  // while the switcher is open is visible as a change instead of a full redraw.
  function patch(rowsData) {
    rowsData.forEach((row, index) => {
      const node = nodes[index];
      if (!node) return;
      const old = node.row;
      const kind = row.presentation.kind;
      if (kind !== old.presentation.kind || row.draft !== old.draft) {
        node.status.dataset.status = kind;
        node.icon.dataset.status = kind;
        node.handle.update(kind, row.draft);
      }
      if (row.presentation.shortLabel !== old.presentation.shortLabel) {
        node.statusLabel.textContent = row.presentation.shortLabel;
        if (motionOn()) {
          node.statusLabel.animate(
            [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
            { duration: 220, easing: 'cubic-bezier(.2, .8, .2, 1)' }
          );
        }
      }
      node.card.setAttribute('aria-label', labelFor(row, node.here));
      node.row = row;
    });
  }

  function update({ rowsData, currentTheme, editionId, activeIndex, iconMotionMode = 'balanced', showSavedB2 = false }) {
    overlay.dataset.theme = currentTheme;
    const nextKey = [showSavedB2 ? 'b2' : editionId, ...rowsData.map(r => `${r.id}|${r.title}|${r.workspaceName}`)].join('\n');
    if (nextKey !== key) {
      key = nextKey;
      if (showSavedB2) {
        delete overlay.dataset.wabi;
        delete overlay.dataset.lens;
        overlay.dataset.b2 = 'true';
      } else {
        delete overlay.dataset.b2;
        overlay.dataset.wabi = editionId;
        overlay.dataset.lens = 'true';
      }
      build(rowsData, showSavedB2, iconMotionMode);
    } else {
      if (!showSavedB2 && typeof motion.setMode === 'function') motion.setMode(iconMotionMode);
      patch(rowsData);
    }
    select(activeIndex);
  }

  return { update, destroy: () => motion.destroy() };
}

const ICON_MOTION_MODES = ['balanced', 'running-only', 'orbital', 'off'];
const params = new URLSearchParams(location.search);
let theme = params.get('theme') === 'light' ? 'light' : 'dark';
let view = params.get('view') === 'single' ? 'single' : 'wall';
let activeEdition = EDITIONS.some(e => e.id === params.get('edition')) ? params.get('edition') : 'kibutsu';
let scene = ['mixed', 'busy', 'quiet', 'stress'].includes(params.get('scene')) ? params.get('scene') : 'mixed';
let selectedIndex = params.has('select') && Number.isInteger(Number(params.get('select'))) ? Math.max(0, Math.min(4, Number(params.get('select')))) : 1;
let iconMotion = ICON_MOTION_MODES.includes(params.get('iconMotion')) ? params.get('iconMotion') : (params.get('motion') === 'off' ? 'off' : 'balanced');
let holdingB2 = false;
let simulated = false;

const selectCard = index => {
  selectedIndex = (index + 5) % 5;
  renderAll();
};

const wallList = document.getElementById('wall-list');
const wallRenderers = new Map();

for (const edition of EDITIONS) {
  const block = document.createElement('article');
  block.className = 'edition-block';
  block.dataset.editionBlock = edition.id;

  const head = document.createElement('div');
  head.className = 'edition-head';
  const headMain = document.createElement('div');
  headMain.className = 'edition-head-main';

  const pill = document.createElement('span');
  pill.className = 'edition-pill';
  pill.textContent = edition.code;

  const h2 = document.createElement('h2');
  h2.className = 'edition-title';
  h2.textContent = edition.name;

  const summary = document.createElement('p');
  summary.className = 'edition-summary';
  summary.textContent = edition.summary;

  headMain.append(pill, h2, summary);

  const focusBtn = document.createElement('button');
  focusBtn.type = 'button';
  focusBtn.className = 'focus-btn';
  focusBtn.textContent = '实景沉浸细看 →';
  focusBtn.addEventListener('click', () => {
    activeEdition = edition.id;
    view = 'single';
    renderAll();
  });

  head.append(headMain, focusBtn);

  const stageBox = document.createElement('div');
  stageBox.className = 'stage-box';
  const stageBg = document.createElement('div');
  stageBg.className = 'stage-bg';
  stageBg.setAttribute('aria-hidden', 'true');
  const stageMount = document.createElement('div');
  stageMount.className = 'stage-mount';
  stageBox.append(stageBg, stageMount);

  block.append(head, stageBox);
  wallList.append(block);

  wallRenderers.set(edition.id, createWabiRenderer(stageMount, selectCard));
}

const singleRenderer = createWabiRenderer(document.getElementById('mount-single'), selectCard);

// "模拟状态变化": what happens while the switcher is open — 1 starts running,
// 2 finishes (新结果), 3 gets approved and resumes running.
const LIVE_SHIFT = { 0: 'running', 1: 'unread', 2: 'running' };

function prepareRows() {
  return buildScene(scene).map((row, index) => {
    const kind = simulated && LIVE_SHIFT[index] ? LIVE_SHIFT[index] : row.kind;
    return {
      ...row,
      kind,
      presentation: sessionPresentation(
        {
          running: kind === 'running',
          completionUnread: kind === 'unread',
          pendingInteraction: kind === 'approval'
            ? { kind: 'approval' }
            : kind === 'question'
              ? { kind: 'question' }
              : undefined,
        },
        { updatedAt: row.updatedAt },
        row.draft,
        now
      ),
    };
  });
}

function renderAll() {
  document.body.dataset.theme = theme;
  document.body.dataset.view = view;
  document.body.dataset.edition = activeEdition;
  document.body.dataset.iconMotion = iconMotion;
  document.body.dataset.motion = iconMotion === 'off' ? 'off' : 'on';

  document.getElementById('wall-stage').hidden = view !== 'wall';
  document.getElementById('single-stage').hidden = view !== 'single';
  document.getElementById('edition-picker').hidden = view !== 'single';

  for (const btn of document.querySelectorAll('button[data-view]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  }
  for (const btn of document.querySelectorAll('button[data-edition]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.edition === activeEdition));
  }
  for (const btn of document.querySelectorAll('button[data-theme]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme));
  }
  for (const btn of document.querySelectorAll('button[data-icon-motion]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.iconMotion === iconMotion));
  }
  document.getElementById('simulate').setAttribute('aria-pressed', String(simulated));
  document.getElementById('scene').value = scene;

  const rowsData = prepareRows();

  if (view === 'wall') {
    for (const edition of EDITIONS) {
      wallRenderers.get(edition.id).update({
        rowsData,
        currentTheme: theme,
        editionId: edition.id,
        activeIndex: selectedIndex,
        iconMotionMode: iconMotion,
        showSavedB2: false,
      });
    }
  } else {
    const info = EDITIONS.find(e => e.id === activeEdition) || EDITIONS[0];
    document.getElementById('single-badge').textContent = holdingB2
      ? '对比中：已保存 B2（项目在上 · 含最后一次输入）'
      : info.code;
    document.getElementById('single-desc').textContent = holdingB2
      ? '四行信息（项目胶囊 → 标题 → 状态 → 最后输入）'
      : `${info.name} — ${info.summary}`;
    document.getElementById('single-status').textContent = holdingB2
      ? '按住对比：已保存 B2 稿'
      : `当前预览：${info.name}`;
    document.getElementById('hold-b2').setAttribute('aria-pressed', String(holdingB2));

    singleRenderer.update({
      rowsData,
      currentTheme: theme,
      editionId: activeEdition,
      activeIndex: selectedIndex,
      iconMotionMode: iconMotion,
      showSavedB2: holdingB2,
    });
  }
}

for (const btn of document.querySelectorAll('button[data-view]')) {
  btn.addEventListener('click', () => { view = btn.dataset.view; renderAll(); });
}
for (const btn of document.querySelectorAll('button[data-edition]')) {
  btn.addEventListener('click', () => { activeEdition = btn.dataset.edition; renderAll(); });
}
for (const btn of document.querySelectorAll('button[data-theme]')) {
  btn.addEventListener('click', () => { theme = btn.dataset.theme; renderAll(); });
}
for (const btn of document.querySelectorAll('button[data-icon-motion]')) {
  btn.addEventListener('click', () => { iconMotion = btn.dataset.iconMotion; renderAll(); });
}
document.getElementById('simulate').addEventListener('click', () => { simulated = !simulated; renderAll(); });
document.getElementById('scene').addEventListener('change', event => {
  scene = event.target.value;
  renderAll();
});

const holdBtn = document.getElementById('hold-b2');
const setHold = value => {
  if (holdingB2 === value) return;
  holdingB2 = value;
  renderAll();
};
holdBtn.addEventListener('pointerdown', () => setHold(true));
window.addEventListener('pointerup', () => setHold(false));
window.addEventListener('pointercancel', () => setHold(false));

window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLSelectElement) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); selectCard(selectedIndex + 1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); selectCard(selectedIndex - 1); }
  else if (event.code === 'Space' && view === 'single') { event.preventDefault(); setHold(true); }
});
window.addEventListener('keyup', event => {
  if (event.code === 'Space') setHold(false);
});

renderAll();

if (params.get('selftest') === '1') import('./selftest.js').then(module => module.runSelftest());
