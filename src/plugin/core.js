export const HISTORY_KEY = 'dsh-switcher.mru.v1';
export const MAX_CANDIDATES = 5;

export function readHistory(raw) {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string'))].slice(0, 100) : [];
  } catch { return []; }
}

export function remember(history, id) {
  return id ? [id, ...history.filter(other => other !== id)].slice(0, 100) : history;
}

export function candidates(snapshot, archived, history, current, draftIds = []) {
  const excluded = new Set(archived);
  const drafts = new Set(draftIds);
  // Opened subagents may live in byId without being part of the top-level ids catalog.
  const known = [...new Set([...snapshot.ids, current, ...history])];
  const available = known.filter(id => !excluded.has(id) && snapshot.byId[id] &&
    (id === current || drafts.has(id) || snapshot.byId[id].blank !== true));
  const allowed = new Set(available);
  const updated = new Map(available.map(id => [id, sessionTimestamp(snapshot.byId[id].updatedAt)]));
  const recent = available.filter(id => !snapshot.byId[id].parentId && snapshot.byId[id].origin !== 'subagent')
    .sort((a, b) => updated.get(b) - updated.get(a));
  return [...new Set([current, ...history, ...recent])].filter(id => allowed.has(id)).slice(0, MAX_CANDIDATES);
}

// DSH persists ISO strings; a client snapshot may carry epoch numbers instead.
// Subtracting the strings is NaN, which would silently leave the list unsorted.
export function sessionTimestamp(value) {
  if (value instanceof Date) value = value.getTime();
  else if (typeof value === 'string') value = /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : Date.parse(value);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return value < 1e11 ? value * 1000 : value; // Epoch seconds.
}

// Idle is the usual state, so its row says when instead of repeating "ready".
export function relativeTime(value, now = Date.now()) {
  const time = sessionTimestamp(value);
  if (!time) return '';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return '刚刚'; // Also absorbs a clock that runs slightly ahead.
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  const then = new Date(time), today = new Date(now);
  const midnight = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(then)) / 864e5);
  if (days <= 1) return '昨天';
  if (days === 2) return '前天';
  if (days < 7) return `${days} 天前`;
  const date = `${then.getMonth() + 1}月${then.getDate()}日`;
  return then.getFullYear() === today.getFullYear() ? date : `${then.getFullYear()}年${date}`;
}

export class SwitchCycle {
  constructor(ids, current, direction) {
    this.ids = [...ids];
    this.index = Math.max(0, this.ids.indexOf(current));
    this.step(direction);
  }
  get selected() { return this.ids[this.index]; }
  step(direction) {
    if (this.ids.length) this.index = (this.index + direction + this.ids.length) % this.ids.length;
  }
  select(id) {
    const index = this.ids.indexOf(id);
    if (index >= 0) this.index = index;
  }
}

export function latestUserInput(entries) {
  for (let index = entries.length - 1; index >= 0; index--) {
    const event = entries[index].event;
    if (event?.type !== 'user/message') continue;
    const message = event.data;
    if (message?.source?.kind && message.source.kind !== 'user') continue;
    if (message?.role && message.role !== 'user') continue;
    const parts = Array.isArray(message?.content) ? message.content : [];
    const text = typeof message?.content === 'string' ? message.content :
      parts.filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n');
    if (text.trim()) return text.replace(/\s+/g, ' ').trim().slice(0, 800);
    if (parts.length) return '已发送附件';
  }
  return '';
}

// Chinese has no spaces, so a wrapped title can split inside a word. Mark the word
// boundaries a dictionary finds with zero-width spaces; the title's `keep-all` then
// breaks only there. A lone character is mostly a suffix or particle (的、机、级),
// so it stays with the word before it.
let phraseSegmenter;
export function phraseBreaks(text) {
  if (phraseSegmenter === undefined) {
    try { phraseSegmenter = new Intl.Segmenter('zh', { granularity: 'word' }); } catch { phraseSegmenter = null; }
  }
  if (!phraseSegmenter || typeof text !== 'string') return text;
  const parts = [...phraseSegmenter.segment(text)];
  return parts.map((part, index) => {
    const next = parts[index + 1];
    return part.segment + (part.isWordLike && next?.isWordLike && [...next.segment].length > 1 ? '\u200b' : '');
  }).join('');
}

export function hasDraft(value) {
  const draft = typeof value === 'string' ? value : value?.text;
  return typeof draft === 'string' && draft.trim().length > 0;
}

// Match DSH's workspace membership first; cwd is only an ungrouped fallback.
export function sessionWorkspaceName(snapshot, id, summary) {
  const workspace = snapshot.items?.find(item => item.sessionIds.includes(id));
  const basename = path => typeof path === 'string' ? path.trim().split(/[\\/]+/).filter(Boolean).at(-1) || path.trim() : '';
  return workspace?.title?.trim() || basename(workspace?.path) || basename(summary?.cwd) || '未分组';
}

export function sessionPresentation(status, summary, draft = false, now = Date.now()) {
  const when = relativeTime(summary?.updatedAt, now);
  let kind = 'idle', label = when ? `会话已就绪，${when}更新` : '会话已就绪', shortLabel = when || '已就绪';
  if (status?.pendingInteraction) {
    kind = 'approval';
    label = status.pendingInteraction.kind === 'approval' ? '等待用户确认' : '等待用户回应';
    shortLabel = status.pendingInteraction.kind === 'approval' ? '待确认' : '待回应';
  } else if (status?.running ?? summary?.running) {
    kind = 'running'; label = shortLabel = '运行中';
  } else if (status?.completionUnread) {
    kind = 'unread'; label = '有新结果'; shortLabel = '新结果';
  } else if (draft) {
    kind = 'draft'; label = shortLabel = '有草稿';
  }
  if (draft && kind !== 'draft') { label += '，有草稿'; shortLabel += ' · 有草稿'; }
  return { kind, label, shortLabel, draft };
}

export const PREFS_KEY = 'dsh-switcher.prefs.v1';

export const EDITION_OPTIONS = [
  { id: 'kibutsu', label: '02 器物', badge: '默认', detail: '136px 凝练比例 · 状态 → 标题 → 项目胶囊 · 活跃态右侧微点，省去最后输入' },
  { id: 'sujian', label: '01 素笺', detail: '158px 舒展留白 · 状态 → 标题 → 项目胶囊 · 省去最后输入' },
  { id: 'jiechi', label: '03 界尺', detail: '138px 无框竖线分界 · 唯选中列浮现底面 · 状态领读' },
  { id: 'moyun', label: '04 墨韵', detail: '138px 活跃状态淡底胶囊 · 底部无框项目微标，不同卡双胶囊' },
  { id: 'b2', label: 'B2 轻胶囊', detail: '158px 统一中性项目胶囊 · 保留四行「项目 → 标题 → 状态 → 最后输入」' },
  { id: 'split', label: '01 分签', detail: '158px 经典顶栏题签 · 含「当前」标记与最后输入' },
];

export const MOTION_OPTIONS = [
  { id: 'balanced', label: '动静异律', badge: '默认', detail: '选中框 160ms 滑动 · 运行中五拍流光波 · 待确认静止括弧配 2.6s 慢呼吸光标' },
  { id: 'running-only', label: '仅运行动', detail: '选中框滑动 · 仅「运行中」波动，待确认/待回应保持纯静态高对比' },
  { id: 'orbital', label: '转弧双动', detail: '选中框滑动 · 运行中旋转追尾圆弧 + 待确认 1.45s 括弧与微点脉冲' },
  { id: 'classic', label: '原版五拍', detail: '保留原版五拍波形与卡片淡入过渡，不启用滑动选中底框' },
  { id: 'off', label: '全静', detail: '关闭所有状态图标循环与切换滑动过渡' },
];

export const DEFAULT_PREFS = Object.freeze({ edition: 'kibutsu', motion: 'balanced' });

const EDITION_IDS = new Set(EDITION_OPTIONS.map(option => option.id));
const MOTION_IDS = new Set(MOTION_OPTIONS.map(option => option.id));

export function normalizePrefs(input) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    edition: EDITION_IDS.has(value.edition) ? value.edition : DEFAULT_PREFS.edition,
    motion: MOTION_IDS.has(value.motion) ? value.motion : DEFAULT_PREFS.motion,
  };
}

export function readPrefs(raw) {
  if (typeof raw !== 'string' || !raw) return { ...DEFAULT_PREFS };
  try { return normalizePrefs(JSON.parse(raw)); } catch { return { ...DEFAULT_PREFS }; }
}

export function isStatusFirstEdition(edition) {
  return edition !== 'b2' && edition !== 'split';
}

export function usesLensMotion(edition, motion) {
  return Boolean(edition) && motion !== 'classic' && motion !== 'off';
}

export function createPrefsStore(storage) {
  let state = { ...DEFAULT_PREFS };
  try { state = readPrefs(storage?.getItem(PREFS_KEY)); } catch { /* Storage may be restricted. */ }
  const listeners = new Set();
  const notify = () => { for (const listener of [...listeners]) listener(state); };
  return {
    getSnapshot: () => state,
    update(patch) {
      const next = normalizePrefs({ ...state, ...patch });
      if (next.edition === state.edition && next.motion === state.motion) return state;
      state = next;
      try { storage?.setItem(PREFS_KEY, JSON.stringify(state)); } catch { /* Memory fallback stays live. */ }
      notify();
      return state;
    },
    reset() { return this.update(DEFAULT_PREFS); },
    sync() {
      let next = state;
      try { next = readPrefs(storage?.getItem(PREFS_KEY)); } catch { return state; }
      if (next.edition === state.edition && next.motion === state.motion) return state;
      state = next; notify();
      return state;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
