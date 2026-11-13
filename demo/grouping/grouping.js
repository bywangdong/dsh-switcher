import { phraseBreaks, sessionPresentation } from '../../src/plugin/core.js';
import { createFivebeatMotion } from '../../src/plugin/motion.js';

const PRIMARY_SCHEMES = [
  {
    id: 'plain',
    code: 'B1',
    name: '全员「无框微标」',
    badge: '统一无框',
    summary: '五张卡统一使用 12px 文件夹小图标 + 工作区名，无顶栏底色、无胶囊框、无「当前」标签——最安静克制，重心完全留给会话标题。',
  },
  {
    id: 'pill',
    code: 'B2',
    name: '全员「中性轻胶囊」',
    badge: '统一胶囊',
    summary: '五张卡统一佩戴同款极淡中性圆角胶囊（去掉异组蓝灰特权与「当前」标签），选中卡片时胶囊随卡面自然提亮，标签边界清晰精致。',
  },
];

const ARCHIVE_SCHEMES = [
  {
    id: 'tray',
    code: '备选 1',
    name: '同组连托',
    badge: '空间聚合',
    summary: '相邻同工作区卡片收进同一个内凹托盘，左上角只写一次工作区名。',
  },
  {
    id: 'dot',
    code: '备选 2',
    name: '彩点眉标',
    badge: '极简流',
    summary: '无框卡片 + 按工作区稳定映射的低饱和语义圆点。',
  },
  {
    id: 'footer',
    code: '备选 3',
    name: '标题置顶',
    badge: '内容优先',
    summary: '标题与原话置顶，五拍状态与所属工作区并排沉入底部细线栏。',
  },
  {
    id: 'split',
    code: '基准',
    name: '轻分签（原满宽顶栏结构 + 精修字体）',
    badge: '原结构对照',
    summary: '保留每张卡独立满宽顶栏，仅去掉「当前」并应用 14px / 400→500 字体精修。',
  },
];

const ALL_SCHEMES = [...PRIMARY_SCHEMES, ...ARCHIVE_SCHEMES];

const DOT_PALETTE = {
  light: ['#5274a3', '#3d8275', '#a67438', '#7b639e', '#9c5b6b', '#5e7f48'],
  dark: ['#82a8de', '#6ab8a8', '#d6a463', '#ad94d4', '#d48a9c', '#8eb574'],
};

const FOLDER_SVG = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.75 4.1c0-.75.6-1.35 1.35-1.35h2.35c.38 0 .74.17.98.47l.64.78h3.83c.75 0 1.35.6 1.35 1.35v4.55c0 .75-.6 1.35-1.35 1.35H3.1c-.75 0-1.35-.6-1.35-1.35V4.1Z"/></svg>';

function workspaceDotColor(name, currentTheme) {
  const palette = DOT_PALETTE[currentTheme] || DOT_PALETTE.dark;
  if (name === 'Agent') return palette[0];
  if (name === 'dsh-shortcutter') return palette[1];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[(hash % (palette.length - 1)) + 1];
}

const now = Date.now();
const ago = minutes => new Date(now - minutes * 60000).toISOString();

function buildScene(scene) {
  if (scene === 'same') {
    return [
      { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件和缓存可以优先清理掉', kind: 'idle', draft: false, updatedAt: ago(8) },
      { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
      { id: '3', workspaceName: 'Agent', title: '家庭网络与 NAS 备份方案梳理', text: '照片库和时间机器备份想分开两个存储池', kind: 'idle', draft: false, updatedAt: ago(2 * 1440) },
      { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？先核对一下具体接入型号', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
      { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: false, updatedAt: ago(6 * 1440) },
    ];
  }
  if (scene === 'diverse') {
    return [
      { id: '1', workspaceName: 'dsh-switcher', title: '工作区分组视觉语言探索', text: '分组的表现形式还有没有更好的空间？来几版方案看看', kind: 'draft', draft: true, updatedAt: ago(2) },
      { id: '2', workspaceName: 'proxyAutoSwitch', title: '节点稳定性检测与切换策略', text: '延迟很低但只稳定一小会儿的节点，不要急着切过去。', kind: 'running', draft: false, updatedAt: ago(15) },
      { id: '3', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
      { id: '4', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以一起收敛成一套默认方案', kind: 'approval', draft: false, updatedAt: ago(2 * 1440) },
      { id: '5', workspaceName: 'Trice', title: '一念 · 快速记录与归档检索', text: '打开就能写，历史记录也要容易按时间线找到。', kind: 'unread', draft: false, updatedAt: ago(5 * 1440) },
    ];
  }
  if (scene === 'stress') {
    return [
      { id: '1', workspaceName: 'dsh-switcher-experimental-navigation', title: '统一多个工作区的会话焦点与键盘导航体验并补充完整回归记录', text: '去掉当前标签后，超长项目名在胶囊和无框微标里都能获得完整的整行可用宽度。', kind: 'running', draft: true, updatedAt: ago(4) },
      { id: '2', workspaceName: 'dsh-switcher-experimental-navigation', title: '验证长工作区名称在选中态与未选中态下的省略号表现', text: '悬停在发生省略的胶囊上才会显示完整工作区名称。', kind: 'approval', draft: false, updatedAt: ago(40) },
      { id: '3', workspaceName: '多工作区与长会话导航体验长期研究', title: 'Refine focus restoration across nested workspace boundaries', text: 'Unified neutral capsule truncation check under 182px width.', kind: 'unread', draft: false, updatedAt: ago(3 * 60) },
      { id: '4', workspaceName: '未分组', title: '短标题留白对齐', text: '', placeholder: '还没有输入', kind: 'idle', draft: false, updatedAt: ago(3 * 1440) },
      { id: '5', workspaceName: 'Agent', title: '检查五种状态语义色与中性胶囊互不抢色', text: '400RMB ≈ 2,996 TRY · 只有底部运行/待确认带语义色。', kind: 'idle', draft: true, updatedAt: ago(6 * 1440) },
    ];
  }
  // Default `everyday`: 4x Agent + 1x dsh-shortcutter
  return [
    { id: '1', workspaceName: 'Agent', title: '开发环境清理优先级评估', text: '评估一下本机哪些开发软件和缓存可以优先清理掉', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
    { id: '2', workspaceName: 'Agent', title: '外币兑里拉实时汇率查询', text: '400RMB 是多少里拉？', kind: 'idle', draft: false, updatedAt: ago(22 * 60) },
    { id: '3', workspaceName: 'dsh-shortcutter', title: '讨论导航态快捷键选择', text: '1. DSH 的快捷键我们也可以一起收敛成一套默认方案', kind: 'idle', draft: false, updatedAt: ago(4 * 1440) },
    { id: '4', workspaceName: 'Agent', title: '扫地机器人支持米家接入', text: '固件确定支持吗？先核对一下具体接入型号', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
    { id: '5', workspaceName: 'Agent', title: '在无影云桌面上安装 Omarchy', text: 'omarchy 云桌面环境 怎么安装', kind: 'idle', draft: false, updatedAt: ago(5 * 1440) },
  ];
}

function groupConsecutiveRuns(rows) {
  const runs = [];
  rows.forEach((row, index) => {
    const prev = runs.at(-1);
    if (prev && prev.workspaceName === row.workspaceName) {
      prev.items.push({ row, index });
    } else {
      runs.push({ workspaceName: row.workspaceName, items: [{ row, index }] });
    }
  });
  return runs;
}

function makeFolderIcon() {
  const span = document.createElement('span');
  span.className = 'dsh-ws-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = FOLDER_SVG;
  return span;
}

function createGroupingRenderer(container, onSelect) {
  let motion = createFivebeatMotion();
  const overlay = document.createElement('div');
  overlay.className = 'dsh-switcher';
  overlay.dataset.revealed = 'true';
  overlay.dataset.pointer = 'mouse';
  overlay.setAttribute('role', 'region');

  const panel = document.createElement('div');
  panel.className = 'dsh-switcher-panel';
  panel.style.setProperty('--sw-width', `${5 * 182 + 32}px`);

  const list = document.createElement('div');
  list.className = 'dsh-switcher-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', '最近会话');

  panel.append(list);
  overlay.append(panel);
  container.replaceChildren(overlay);

  function buildCardCore(row, index, schemeId, currentTheme, activeIndex, isOriginalBaseline) {
    const here = index === 0;
    const selected = index === activeIndex;
    const text = row.text || row.placeholder || '';

    const card = document.createElement('div');
    card.className = 'dsh-switcher-card';
    card.dataset.current = String(here);
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', String(selected));
    card.setAttribute('aria-label', `${row.workspaceName}，${row.title}，${row.presentation.label}${here ? '，当前会话' : ''}`);
    card.addEventListener('click', () => onSelect(index));

    const title = document.createElement('span');
    title.className = 'dsh-switcher-title';
    title.textContent = phraseBreaks(row.title);

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
    status.append(icon, statusLabel);

    const excerpt = document.createElement('p');
    excerpt.className = 'dsh-switcher-excerpt';
    excerpt.textContent = text;
    excerpt.dataset.empty = String(!row.text);

    motion.mount(icon, row.presentation.kind, row.draft);

    let wsLabelEl = null;

    if (schemeId === 'plain' || schemeId === 'pill') {
      const project = document.createElement('span');
      project.className = 'dsh-switcher-project';
      const chip = document.createElement('span');
      chip.className = 'dsh-ws-chip';
      const chipText = document.createElement('span');
      chipText.className = 'dsh-ws-chip-text';
      chipText.textContent = row.workspaceName;
      chip.append(makeFolderIcon(), chipText);
      project.append(chip);
      card.append(project, title, status, excerpt);
      wsLabelEl = chipText;
    } else if (schemeId === 'tray') {
      card.append(title, status, excerpt);
    } else if (schemeId === 'dot') {
      const project = document.createElement('span');
      project.className = 'dsh-switcher-project';
      const dot = document.createElement('span');
      dot.className = 'dsh-ws-dot';
      dot.style.setProperty('--ws-dot', workspaceDotColor(row.workspaceName, currentTheme));
      const projectName = document.createElement('span');
      projectName.className = 'dsh-switcher-project-name';
      projectName.textContent = row.workspaceName;
      project.append(dot, projectName);
      card.append(project, title, status, excerpt);
      wsLabelEl = projectName;
    } else if (schemeId === 'footer') {
      const foot = document.createElement('div');
      foot.className = 'dsh-card-foot';
      const wsWrap = document.createElement('span');
      wsWrap.className = 'dsh-footer-ws';
      const wsName = document.createElement('span');
      wsName.className = 'dsh-footer-ws-name';
      wsName.textContent = row.workspaceName;
      wsWrap.append(wsName);
      foot.append(status, wsWrap);
      card.append(title, excerpt, foot);
      wsLabelEl = wsName;
    } else {
      // `split` or `baseline`
      const project = document.createElement('span');
      project.className = 'dsh-switcher-project';
      const projectName = document.createElement('span');
      projectName.className = 'dsh-switcher-project-name';
      projectName.textContent = row.workspaceName;
      project.append(projectName);
      if (isOriginalBaseline) {
        const hereBadge = document.createElement('span');
        hereBadge.className = 'dsh-switcher-here';
        hereBadge.textContent = '当前';
        project.append(hereBadge);
      }
      card.append(project, title, status, excerpt);
      wsLabelEl = projectName;
    }

    return { card, title, excerpt, status, icon, wsLabelEl, row };
  }

  function update({ rowsData, currentTheme, schemeId, activeIndex, isOriginalBaseline = false }) {
    motion.destroy();
    motion = createFivebeatMotion();

    overlay.dataset.theme = currentTheme;
    overlay.dataset.typo = isOriginalBaseline ? 'baseline' : 'crisp';
    overlay.dataset.group = isOriginalBaseline ? 'baseline' : schemeId;

    const renderedCards = [];
    const trayHeaders = [];
    list.replaceChildren();

    if (!isOriginalBaseline && schemeId === 'tray') {
      const runs = groupConsecutiveRuns(rowsData);
      for (const run of runs) {
        const span = run.items.length;
        const slot = document.createElement('div');
        slot.className = 'dsh-group-slot';
        slot.style.flex = `0 0 ${span * 182}px`;
        slot.style.width = `${span * 182}px`;

        const tray = document.createElement('div');
        tray.className = 'dsh-group-tray';
        tray.dataset.hasSelected = String(run.items.some(item => item.index === activeIndex));

        const head = document.createElement('div');
        head.className = 'dsh-group-head';
        const nameEl = document.createElement('span');
        nameEl.className = 'dsh-group-name';
        nameEl.textContent = run.workspaceName;
        head.append(makeFolderIcon(), nameEl);
        trayHeaders.push({ el: nameEl, text: run.workspaceName });

        const cardsGrid = document.createElement('div');
        cardsGrid.className = 'dsh-group-cards';
        cardsGrid.style.setProperty('--span', String(span));

        for (const { row, index } of run.items) {
          const built = buildCardCore(row, index, 'tray', currentTheme, activeIndex, false);
          cardsGrid.append(built.card);
          renderedCards[index] = built;
        }

        tray.append(head, cardsGrid);
        slot.append(tray);
        list.append(slot);
      }
    } else {
      const effectiveScheme = isOriginalBaseline ? 'split' : schemeId;
      rowsData.forEach((row, index) => {
        const built = buildCardCore(row, index, effectiveScheme, currentTheme, activeIndex, isOriginalBaseline);
        list.append(built.card);
        renderedCards[index] = built;
      });
    }

    requestAnimationFrame(() => {
      for (const header of trayHeaders) {
        header.el.title = header.el.scrollWidth > header.el.clientWidth + 1 ? header.text : '';
      }
      for (const item of renderedCards) {
        if (!item) continue;
        const text = item.row.text || item.row.placeholder || '';
        if (isOriginalBaseline) {
          if (item.wsLabelEl) item.wsLabelEl.parentElement.title = item.row.workspaceName;
          item.title.title = item.row.title;
          item.status.title = item.row.presentation.label;
          item.icon.title = item.row.presentation.label;
          item.excerpt.title = text;
          item.title.dataset.balance = String(item.title.scrollHeight <= item.title.clientHeight);
        } else {
          item.title.dataset.balance = 'false';
          if (item.wsLabelEl) {
            const truncated = item.wsLabelEl.scrollWidth > item.wsLabelEl.clientWidth + 1;
            item.wsLabelEl.title = truncated ? item.row.workspaceName : '';
            if (item.wsLabelEl.parentElement) item.wsLabelEl.parentElement.title = truncated ? item.row.workspaceName : '';
          }
          item.title.title = item.title.scrollHeight > item.title.clientHeight + 1 ? item.row.title : '';
          item.excerpt.title = item.row.text && item.excerpt.scrollWidth > item.excerpt.clientWidth + 1 ? item.row.text : '';
        }
      }
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

const params = new URLSearchParams(location.search);
let theme = params.get('theme') === 'light' ? 'light' : 'dark';
let view = params.get('view') === 'single' ? 'single' : 'wall';
let activeScheme = ALL_SCHEMES.some(s => s.id === params.get('scheme')) ? params.get('scheme') : 'pill';
let scene = ['everyday', 'same', 'diverse', 'stress'].includes(params.get('scene')) ? params.get('scene') : 'everyday';
let selectedIndex = Number.isInteger(Number(params.get('select'))) ? Math.max(0, Math.min(4, Number(params.get('select')))) : 1;
let holdingOriginal = false;

const selectCard = index => {
  selectedIndex = (index + 5) % 5;
  renderAll();
};

const wallRenderers = new Map();

function mountSchemeSection(listEl, schemes) {
  for (const scheme of schemes) {
    const block = document.createElement('article');
    block.className = 'scheme-block';
    block.dataset.schemeBlock = scheme.id;

    const head = document.createElement('div');
    head.className = 'scheme-head';
    const headMain = document.createElement('div');
    headMain.className = 'scheme-head-main';

    const badge = document.createElement('span');
    badge.className = `lane-tag ${scheme.id === 'split' ? 'is-baseline' : 'is-refined'}`;
    badge.textContent = `${scheme.code} · ${scheme.badge}`;

    const h2 = document.createElement('h2');
    h2.className = 'scheme-title';
    h2.textContent = scheme.name;

    const summary = document.createElement('p');
    summary.className = 'scheme-summary';
    summary.textContent = scheme.summary;

    headMain.append(badge, h2, summary);

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    focusBtn.className = 'focus-btn';
    focusBtn.textContent = '单版实景细看 →';
    focusBtn.addEventListener('click', () => {
      activeScheme = scheme.id;
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
    listEl.append(block);

    wallRenderers.set(scheme.id, createGroupingRenderer(stageMount, selectCard));
  }
}

mountSchemeSection(document.getElementById('primary-list'), PRIMARY_SCHEMES);
mountSchemeSection(document.getElementById('archive-list'), ARCHIVE_SCHEMES);

const singleRenderer = createGroupingRenderer(document.getElementById('mount-single'), selectCard);
const moreDetails = document.getElementById('more-schemes');

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
  document.body.dataset.scheme = activeScheme;

  document.getElementById('wall-stage').hidden = view !== 'wall';
  document.getElementById('single-stage').hidden = view !== 'single';
  document.getElementById('scheme-picker').hidden = view !== 'single';

  for (const btn of document.querySelectorAll('[data-view]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
  }
  for (const btn of document.querySelectorAll('[data-scheme]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.scheme === activeScheme));
  }
  for (const btn of document.querySelectorAll('[data-theme]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme));
  }
  document.getElementById('scene').value = scene;

  const rowsData = prepareRows();

  if (view === 'wall') {
    for (const scheme of PRIMARY_SCHEMES) {
      wallRenderers.get(scheme.id).update({
        rowsData,
        currentTheme: theme,
        schemeId: scheme.id,
        activeIndex: selectedIndex,
        isOriginalBaseline: false,
      });
    }
    if (moreDetails.open) {
      for (const scheme of ARCHIVE_SCHEMES) {
        wallRenderers.get(scheme.id).update({
          rowsData,
          currentTheme: theme,
          schemeId: scheme.id,
          activeIndex: selectedIndex,
          isOriginalBaseline: false,
        });
      }
    }
  } else {
    const info = ALL_SCHEMES.find(s => s.id === activeScheme) || PRIMARY_SCHEMES[0];
    document.getElementById('single-badge').textContent = holdingOriginal
      ? '当前按住对比：0.1.10 原版'
      : `${info.code} · ${info.name}`;
    document.getElementById('single-desc').textContent = holdingOriginal
      ? '标题 15px/550（中文吸附 600 Semibold）· 独立满宽题签 + 右侧「当前」'
      : info.summary;
    document.getElementById('single-status').textContent = holdingOriginal
      ? '对比中：0.1.10 原版'
      : `当前方案：${info.code} ${info.name}`;
    document.getElementById('hold-original').setAttribute('aria-pressed', String(holdingOriginal));

    singleRenderer.update({
      rowsData,
      currentTheme: theme,
      schemeId: activeScheme,
      activeIndex: selectedIndex,
      isOriginalBaseline: holdingOriginal,
    });
  }
}

moreDetails.addEventListener('toggle', () => { if (moreDetails.open) renderAll(); });

for (const btn of document.querySelectorAll('[data-view]')) {
  btn.addEventListener('click', () => { view = btn.dataset.view; renderAll(); });
}
for (const btn of document.querySelectorAll('[data-scheme]')) {
  btn.addEventListener('click', () => { activeScheme = btn.dataset.scheme; renderAll(); });
}
for (const btn of document.querySelectorAll('[data-theme]')) {
  btn.addEventListener('click', () => { theme = btn.dataset.theme; renderAll(); });
}
document.getElementById('scene').addEventListener('change', event => {
  scene = event.target.value;
  renderAll();
});

const holdBtn = document.getElementById('hold-original');
const setHold = value => {
  if (holdingOriginal === value) return;
  holdingOriginal = value;
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
