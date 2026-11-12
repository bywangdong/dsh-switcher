import { createRecognitionPanel } from '../../src/study/recognition-view.js';
import { getRecognitionLayout } from '../../src/study/recognition-layouts.js';
import { fixtureRows } from '../../src/study/content.js';
import { createFivebeatMotion } from '../../src/plugin/motion.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const variants = {
  corner: { name: '右下角', description: '推荐 · 标题留出完整宽度' },
  inline: { name: '标题前', description: '状态与标题一起进入视线' },
  original: { name: '当前版', description: '保留图标与状态文字，作为对照' },
};
const state = {
  placement: Object.hasOwn(variants, params.get('placement')) ? params.get('placement') : 'corner',
  theme: params.get('theme') === 'light' ? 'light' : 'dark',
  scene: params.get('scene') === 'long' ? 'long' : 'daily',
  compare: params.get('compare') === '1', still: false, selected: 1,
};
let panels = [], legendMotion, noticeTimer;
const node = (tag, name, text) => {
  const el = document.createElement(tag); el.className = name;
  if (text !== undefined) el.textContent = text;
  return el;
};

function announce(title) {
  clearTimeout(noticeTimer); $('notice').textContent = `演示打开「${title}」`; $('notice').dataset.visible = 'true';
  noticeTimer = setTimeout(() => { $('notice').dataset.visible = 'false'; }, 1800);
}

function renderLegend() {
  legendMotion?.destroy(); legendMotion = undefined; $('legend').replaceChildren();
  if (!document.querySelector('.key').open) return;
  legendMotion = createFivebeatMotion();
  const meanings = [
    ['running', '正在处理', '五条短线起伏'], ['approval', '等待你回应', '中间双线，缓慢呼吸'],
    ['unread', '有新结果', '末端实心点，静止'], ['idle', '静置', '等高短线，静止'],
    ['draft', '有草稿', '短文本与笔划，可与其他状态并存'],
  ];
  for (const [kind, label, description] of meanings) {
    const entry = node('div', 'legend-entry'), icon = node('span', 'dsh-switcher-icon legend-icon');
    icon.dataset.status = kind; icon.setAttribute('aria-hidden', 'true');
    const copy = node('span', '', label); copy.append(node('small', '', description));
    entry.append(icon, copy); $('legend').append(entry); legendMotion.mount(icon, kind, kind === 'draft');
  }
  if (state.still) requestAnimationFrame(() => legendMotion?.destroy());
}

function render() {
  panels.forEach(panel => panel.destroy()); panels = []; $('previews').replaceChildren();
  document.body.dataset.theme = state.theme;
  document.querySelectorAll('button[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === state.theme)));
  document.querySelectorAll('button[data-placement]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.placement === state.placement)));
  $('compare').setAttribute('aria-pressed', String(state.compare)); $('scene').value = state.scene;
  const placements = state.compare ? ['original', 'corner', 'inline'] : [state.placement];
  for (const placement of placements) {
    const section = node('section', 'signal-example');
    const heading = node('div', 'variant-heading'), title = node('div', '');
    title.append(node('h2', '', variants[placement].name), node('span', 'verdict', variants[placement].description)); heading.append(title);
    const stage = node('div', 'stage'), background = node('div', 'stage-backdrop'), mount = node('div', 'stage-mount');
    background.setAttribute('aria-hidden', 'true');
    const panel = createRecognitionPanel({ rows: fixtureRows(state.scene), layout: getRecognitionLayout('tab'),
      theme: state.theme, material: 'baseline', selected: state.selected, motion: !state.still,
      onSelect(index) {
        if (index === state.selected) return;
        state.selected = index;
        panels.forEach(peer => { if (peer.selected !== index) peer.select(index, true); });
      },
      onCommit: row => announce(row.title),
    });
    Object.assign(panel.element.dataset, { tab: 'soft', signalPlacement: placement });
    panel.element.querySelector('[role=listbox]').setAttribute('aria-label', `${variants[placement].name} 最近会话`);
    panels.push(panel); mount.append(panel.element); stage.append(background, mount);
    section.append(heading, stage); $('previews').append(section);
    panel.select(state.selected, true);
  }
  renderLegend();
  const url = new URL(location.href);
  for (const key of ['placement', 'theme', 'scene']) url.searchParams.set(key, state[key]);
  if (state.compare) url.searchParams.set('compare', '1'); else url.searchParams.delete('compare');
  history.replaceState(null, '', url);
}

document.querySelectorAll('button[data-placement]').forEach(button => button.addEventListener('click', () => {
  state.placement = button.dataset.placement; state.compare = false; render();
}));
document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.theme; render(); }));
$('compare').addEventListener('click', () => { state.compare = !state.compare; render(); });
$('scene').addEventListener('change', event => { state.scene = event.target.value; render(); });
$('still').addEventListener('change', event => { state.still = event.target.checked; render(); });
document.querySelector('.key').addEventListener('toggle', renderLegend);
window.addEventListener('pagehide', () => { panels.forEach(panel => panel.destroy()); legendMotion?.destroy(); clearTimeout(noticeTimer); });
render();
