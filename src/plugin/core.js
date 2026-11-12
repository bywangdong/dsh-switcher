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
