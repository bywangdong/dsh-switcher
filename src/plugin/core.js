export const HISTORY_KEY = 'dsh-switcher.mru.v1';
export const HISTORY_TIMES_KEY = 'dsh-switcher.mru-at.v1';
export const ACTIVITY_KEY = 'dsh-switcher.activity.v1';
export const READ_DWELL_MS = 4000;
export const MIN_CANDIDATES = 3;
export const MAX_CANDIDATES = 5;

export function normalizeLocale(value) {
  if (typeof value !== 'string' || !value.trim()) return 'zh';
  return /^zh\b/i.test(value.trim()) ? 'zh' : 'en';
}

export function detectEnvironmentLocale(doc = typeof document !== 'undefined' ? document : undefined) {
  const raw = doc?.documentElement?.lang || '';
  return raw ? normalizeLocale(raw) : 'zh';
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const UI_COPY = Object.freeze({
  zh: Object.freeze({
    newSession: '新会话',
    ungrouped: '未分组',
    sentAttachment: '已发送附件',
    inputError: '暂时无法读取最后输入',
    inputEmpty: '还没有输入',
    inputLoading: '正在读取最后输入…',
    hereBadge: '当前',
    hereSuffix: '，当前会话',
    listSep: '，',
    previewRegionAria: '切换器实时预览',
    dialogAria: '切换会话',
    listboxAria: '最近会话',
    configSummary: '候选会话范围、卡片版式与状态动效设置',
    cfgHeading: '会话范围、版式与动效',
    cfgSub: '切换立即生效并保存在当前设备；随时按 Ctrl+Tab 可在真实会话中检验手感。',
    cfgOpenOverlay: '唤起真实会话浮层',
    cfgOpenOverlayReadyTitle: '打开真实会话切换浮层预览当前配置',
    cfgOpenOverlayDisabledTitle: '当前窗口少于 2 个可用会话，先在下方样例直接体验',
    cfgReset: '恢复推荐默认',
    cfgPreviewHint: '实时样例预览 · 点击任意卡片体验选中滑框',
    cfgCycleState: '模拟状态流转',
    groupLabels: Object.freeze({
      scope: '候选会话范围',
      edition: '卡片版式与信息组织',
      project: '项目标签',
      signal: '状态配色',
      title: '标题层次',
      ink: '文字浓淡与字重',
      motion: '状态图标与切换动效',
    }),
  }),
  en: Object.freeze({
    newSession: 'New Session',
    ungrouped: 'Ungrouped',
    sentAttachment: 'Sent attachment',
    inputError: 'Unable to load last input',
    inputEmpty: 'No input yet',
    inputLoading: 'Loading last input…',
    hereBadge: 'Current',
    hereSuffix: ', current session',
    listSep: ', ',
    previewRegionAria: 'Switcher live preview',
    dialogAria: 'Switch session',
    listboxAria: 'Recent sessions',
    configSummary: 'Session scope, card layout, and status motion settings',
    cfgHeading: 'Session Scope, Layout & Motion',
    cfgSub: 'Changes apply immediately on this device. Press Ctrl+Tab anytime to test with real sessions.',
    cfgOpenOverlay: 'Open Live Switcher',
    cfgOpenOverlayReadyTitle: 'Open the live session switcher overlay with current settings',
    cfgOpenOverlayDisabledTitle: 'Fewer than 2 sessions available in this window; try the sample preview below',
    cfgReset: 'Reset to Defaults',
    cfgPreviewHint: 'Live sample preview · Click any card to test the selection lens',
    cfgCycleState: 'Cycle Status',
    groupLabels: Object.freeze({
      scope: 'Candidate Scope',
      edition: 'Card Edition & Layout',
      project: 'Project Label',
      signal: 'Status Color',
      title: 'Title Hierarchy',
      ink: 'Ink Contrast & Weight',
      motion: 'Status Icons & Motion',
    }),
  }),
});

export function uiCopy(locale) {
  return UI_COPY[normalizeLocale(locale)];
}

export function optionCopy(item, locale) {
  const en = normalizeLocale(locale) === 'en';
  return {
    label: (en && item.enLabel) || item.label,
    badge: item.badge ? ((en && item.enBadge) || (en ? 'Default' : item.badge)) : '',
    detail: (en && item.enDetail) || item.detail,
  };
}

export const SCOPE_RULES = Object.freeze({
  hot: { min: MIN_CANDIDATES, max: MAX_CANDIDATES, windowMs: 2 * 3600_000 },
  top3: { min: MIN_CANDIDATES, max: 3, windowMs: 2 * 3600_000 },
  day: { min: MIN_CANDIDATES, max: MAX_CANDIDATES, windowMs: 8 * 3600_000 },
  classic: { min: MIN_CANDIDATES, max: MAX_CANDIDATES, windowMs: Infinity },
});

export function readHistory(raw) {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string'))].slice(0, 100) : [];
  } catch { return []; }
}

export function remember(history, id) {
  return id ? [id, ...history.filter(other => other !== id)].slice(0, 100) : history;
}

export function readVisitTimes(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out = {};
    for (const [id, at] of Object.entries(value)) {
      if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
      const time = sessionTimestamp(at);
      if (typeof id === 'string' && id && time > 0) out[id] = time;
    }
    return out;
  } catch { return {}; }
}

export function rememberVisit(visitTimes, id, now = Date.now(), keepIds = null) {
  const time = sessionTimestamp(now);
  const allowed = keepIds ? new Set(keepIds) : null;
  const out = {};
  if (typeof id === 'string' && id && time > 0 && (!allowed || allowed.has(id))) out[id] = time;
  if (visitTimes && typeof visitTimes === 'object') {
    for (const [key, value] of Object.entries(visitTimes)) {
      if (key === id || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      if (allowed && !allowed.has(key)) continue;
      const existing = sessionTimestamp(value);
      if (existing > 0) out[key] = existing;
    }
  }
  return out;
}

export function readActivityState(raw) {
  const readIds = ids => Array.isArray(ids)
    ? [...new Set(ids.filter(id => typeof id === 'string' && id && id !== '__proto__' && id !== 'constructor' && id !== 'prototype'))].slice(0, 100)
    : [];
  try {
    const value = JSON.parse(raw);
    return { activity: readVisitTimes(JSON.stringify(value?.activity)), unread: readIds(value?.unread), childUnread: readIds(value?.childUnread) };
  } catch {
    return { activity: {}, unread: [], childUnread: [] };
  }
}

export function serializeActivityState(activityMap, unreadSet, keepIds = null, childUnread = []) {
  const allowed = keepIds ? new Set(keepIds) : null;
  const entries = [];
  const iter = activityMap instanceof Map ? activityMap.entries() : Object.entries(activityMap || {});
  for (const [id, raw] of iter) {
    if (typeof id !== 'string' || !id || id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    if (allowed && !allowed.has(id)) continue;
    const at = sessionTimestamp(raw);
    if (at > 0) entries.push([id, at]);
  }
  entries.sort((a, b) => b[1] - a[1]);
  const activity = Object.fromEntries(entries.slice(0, 100));
  const unread = [];
  if (unreadSet) {
    for (const id of unreadSet) {
      if (typeof id === 'string' && id && (!allowed || allowed.has(id))) unread.push(id);
      if (unread.length >= 100) break;
    }
  }
  return JSON.stringify({ activity, unread, childUnread: [...childUnread].slice(0, 100) });
}

const ACTIVITY_EVENT_TYPES = new Set([
  'turn/end', 'assistant/message', 'user/message', 'tool/result', 'turn/start', 'approval/asked', 'approval/decided',
]);

export function latestActivityTimestamp(entries) {
  if (!Array.isArray(entries) || !entries.length) return 0;
  let latest = 0;
  for (let index = entries.length - 1; index >= 0; index--) {
    const event = entries[index]?.event;
    if (!event || (event.type && !ACTIVITY_EVENT_TYPES.has(event.type))) continue;
    const at = sessionTimestamp(event.time);
    if (at > latest) {
      latest = at;
      break;
    }
  }
  return latest;
}

const SESSION_INDEX_CACHE = new WeakMap();
const EMPTY_SESSION_INDEX = Object.freeze({
  topSet: null,
  catalogParent: new Map(),
  subagents: new Set(),
  rootOf: new Map(),
  childrenByRoot: new Map(),
});

// Build a single-pass O(N) parent/child & subagent index once per immutable list snapshot.
export function getSessionIndex(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return EMPTY_SESSION_INDEX;
  const cached = SESSION_INDEX_CACHE.get(snapshot);
  if (cached) return cached;

  const byId = snapshot.byId && typeof snapshot.byId === 'object' ? snapshot.byId : null;
  const topSet = Array.isArray(snapshot.ids) ? new Set(snapshot.ids) : null;
  const catalogParent = new Map();
  const projections = snapshot.projectionsBySession;
  if (projections && typeof projections === 'object') {
    for (const parentId in projections) {
      if (!Object.prototype.hasOwnProperty.call(projections, parentId)) continue;
      const catalog = projections[parentId]?.values?.subagentCatalog;
      if (Array.isArray(catalog)) {
        for (let i = 0; i < catalog.length; i++) {
          const childId = catalog[i]?.id;
          if (childId) catalogParent.set(childId, parentId);
        }
      }
    }
  }

  const subagents = new Set();
  if (byId) {
    for (const id in byId) {
      if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
      const summary = byId[id];
      if (!summary) continue;
      if (
        summary.origin === 'subagent' ||
        (typeof summary.delegationDepth === 'number' && summary.delegationDepth > 0) ||
        (topSet !== null && !topSet.has(id)) ||
        catalogParent.has(id)
      ) {
        subagents.add(id);
      }
    }
  }

  const rootOf = new Map();
  const visiting = new Set();
  const resolveRoot = id => {
    if (!id) return undefined;
    if (rootOf.has(id)) return rootOf.get(id);
    if (visiting.has(id)) return undefined;
    const summary = byId ? byId[id] : undefined;
    if (!summary) {
      const parent = catalogParent.get(id);
      if (!parent) { rootOf.set(id, undefined); return undefined; }
      visiting.add(id);
      const root = resolveRoot(parent);
      visiting.delete(id);
      rootOf.set(id, root);
      return root;
    }
    if (!subagents.has(id)) {
      rootOf.set(id, id);
      return id;
    }
    const nextParent = summary.parentId || summary.parentSessionId || summary.parentSession || catalogParent.get(id);
    if (!nextParent) { rootOf.set(id, undefined); return undefined; }
    visiting.add(id);
    const root = resolveRoot(nextParent);
    visiting.delete(id);
    rootOf.set(id, root);
    return root;
  };

  const childrenByRoot = new Map();
  let childSeenByRoot = null;
  const linkChild = (root, childId) => {
    if (!root || root === childId) return;
    if (!childSeenByRoot) childSeenByRoot = new Map();
    let list = childrenByRoot.get(root);
    let seen = childSeenByRoot.get(root);
    if (!list) {
      list = [];
      seen = new Set();
      childrenByRoot.set(root, list);
      childSeenByRoot.set(root, seen);
    }
    if (!seen.has(childId)) {
      seen.add(childId);
      list.push(childId);
    }
  };

  for (const childId of subagents) linkChild(resolveRoot(childId), childId);
  for (const childId of catalogParent.keys()) linkChild(resolveRoot(childId), childId);

  const index = { topSet, catalogParent, subagents, rootOf, childrenByRoot };
  SESSION_INDEX_CACHE.set(snapshot, index);
  return index;
}

export function isSubagentSession(snapshot, id) {
  if (!id || !snapshot?.byId?.[id]) return false;
  return getSessionIndex(snapshot).subagents.has(id);
}

export function resolveSessionTarget(snapshot, id) {
  if (!id || !snapshot) return undefined;
  const index = getSessionIndex(snapshot);
  if (index.rootOf.has(id)) return index.rootOf.get(id);
  const summary = snapshot.byId?.[id];
  return (summary && !index.subagents.has(id)) ? id : undefined;
}

export function aggregateSessionStatus(snapshot, statuses, id, extra = {}) {
  const isMap = statuses instanceof Map;
  const own = isMap ? statuses.get(id) : statuses?.[id];
  const summary = snapshot?.byId?.[id];
  const children = getSessionIndex(snapshot).childrenByRoot.get(id);
  let pendingInteraction = own?.pendingInteraction;
  let childRunning = false;
  let childUnread = false;
  let failed = Boolean(own?.completionUnread && own.completionFailed);
  if (children) {
    const byId = snapshot?.byId;
    for (let i = 0; i < children.length; i++) {
      const childId = children[i];
      const childStatus = isMap ? statuses.get(childId) : statuses?.[childId];
      if (!pendingInteraction && childStatus?.pendingInteraction) pendingInteraction = childStatus.pendingInteraction;
      if ((childStatus?.running ?? byId?.[childId]?.running) === true) childRunning = true;
      if (extra.childUnreadIds ? extra.childUnreadIds.has(childId) : childStatus?.completionUnread) {
        childUnread = true;
        if (childStatus?.completionFailed) failed = true;
      }
    }
  }
  const running = Boolean((own?.running ?? summary?.running) || childRunning);
  const completionUnread = !running && Boolean(
    extra.unread !== undefined ? extra.unread : (own?.completionUnread || childUnread),
  );
  return { running, pendingInteraction, completionUnread, completionFailed: completionUnread && failed };
}

export function isSessionActive(status, summary, draft = false) {
  return Boolean(
    draft ||
    status?.pendingInteraction ||
    (status?.running ?? summary?.running) ||
    status?.completionUnread,
  );
}

export function candidates(snapshot, archived, history, current, draftIds = [], options = {}) {
  const index = getSessionIndex(snapshot);
  const byId = snapshot?.byId;
  const topIds = Array.isArray(snapshot?.ids) ? snapshot.ids : [];
  if (!byId || !topIds.length) return [];

  const excluded = archived?.length ? new Set(archived) : null;
  const drafts = new Set(draftIds);
  const activeCurrent = resolveSessionTarget(snapshot, current);
  const available = [];
  for (let i = 0; i < topIds.length; i++) {
    const id = topIds[i];
    const summary = byId[id];
    if (!summary || excluded?.has(id) || index.subagents.has(id)) continue;
    if (summary.retainedBy?.draft > 0) drafts.add(id);
    if (id === activeCurrent || summary.blank !== true || drafts.has(id)) available.push(id);
  }
  if (!available.length) return [];

  const allowed = new Set(available);
  const completedMap = options?.completedAt;
  const completedIsMap = completedMap instanceof Map;
  const updated = new Map();
  for (let i = 0; i < available.length; i++) {
    const id = available[i];
    const doneAt = completedMap ? sessionTimestamp(completedIsMap ? completedMap.get(id) : completedMap[id]) : 0;
    updated.set(id, Math.max(sessionTimestamp(byId[id].updatedAt), doneAt));
  }
  const recent = [...available].sort((a, b) => updated.get(b) - updated.get(a));
  const ordered = [];
  const seenOrder = new Set();
  const pushOrdered = id => {
    if (id && !seenOrder.has(id) && allowed.has(id)) {
      seenOrder.add(id);
      ordered.push(id);
    }
  };
  pushOrdered(activeCurrent);
  for (let i = 0; i < history.length; i++) pushOrdered(history[i]);
  for (let i = 0; i < recent.length; i++) pushOrdered(recent[i]);

  const rule = SCOPE_RULES[options?.scope] || SCOPE_RULES.hot;
  if (!Number.isFinite(rule.windowMs)) return ordered.slice(0, rule.max);

  const now = typeof options?.now === 'number' && Number.isFinite(options.now) ? options.now : Date.now();
  const visitMap = options?.visitedAt;
  const visitIsMap = visitMap instanceof Map;
  const statusMap = options?.statuses;
  const statusIsMap = statusMap instanceof Map;
  const unreadSet = options?.unreadIds instanceof Set ? options.unreadIds : (Array.isArray(options?.unreadIds) ? new Set(options.unreadIds) : null);

  const hot = [];
  for (let i = 0; i < ordered.length && hot.length < rule.max; i++) {
    const id = ordered[i];
    if (id === activeCurrent) { hot.push(id); continue; }
    const ownStatus = statusIsMap ? statusMap.get(id) : statusMap?.[id];
    const effective = aggregateSessionStatus(
      snapshot,
      statusMap,
      id,
      unreadSet ? { unread: unreadSet.has(id) || Boolean(ownStatus?.completionUnread) } : { childUnreadIds: options?.childUnreadIds },
    );
    if (isSessionActive(effective, byId[id], drafts.has(id))) { hot.push(id); continue; }
    const visited = visitMap ? sessionTimestamp(visitIsMap ? visitMap.get(id) : visitMap[id]) : 0;
    const touched = Math.max(updated.get(id) || 0, visited);
    if (touched > 0 && now - touched <= rule.windowMs) hot.push(id);
  }

  if (hot.length >= rule.min) return hot;
  const picked = new Set(hot);
  const result = [...hot];
  for (let i = 0; i < ordered.length && result.length < rule.min; i++) {
    const id = ordered[i];
    if (!picked.has(id)) { picked.add(id); result.push(id); }
  }
  return result.slice(0, rule.max);
}

// DSH persists ISO strings; a client snapshot may carry epoch numbers instead.
// Subtracting the strings is NaN, which would silently leave the list unsorted.
export function sessionTimestamp(value) {
  if (value instanceof Date) value = value.getTime();
  else if (typeof value === 'string') value = /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : Date.parse(value);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return value < 1e11 ? value * 1000 : value; // Epoch seconds.
}

function calendarDayDiff(time, now) {
  const then = new Date(time), today = new Date(now);
  const midnight = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return { then, today, days: Math.round((midnight(today) - midnight(then)) / 864e5) };
}

export function idleRecency(value, now = Date.now()) {
  const time = sessionTimestamp(value);
  if (!time) return 'today';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 60) return 'fresh';
  if (minutes < 180) return 'warm';
  const { days } = calendarDayDiff(time, now);
  if (days <= 0 || minutes < 360) return 'today';
  return 'cold';
}

// Idle is the usual state, so its row says when instead of repeating "ready".
export function relativeTime(value, now = Date.now(), locale = 'zh') {
  const time = sessionTimestamp(value);
  if (!time) return '';
  const en = normalizeLocale(locale) === 'en';
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return en ? 'Just now' : '刚刚'; // Also absorbs a clock that runs slightly ahead.
  if (minutes < 60) return en ? `${minutes}m ago` : `${minutes} 分钟前`;
  if (minutes < 360) {
    const hours = Math.floor(minutes / 60);
    return en ? `${hours}h ago` : `${hours} 小时前`;
  }
  const { then, today, days } = calendarDayDiff(time, now);
  if (days <= 0) {
    const hh = String(then.getHours()).padStart(2, '0');
    const mm = String(then.getMinutes()).padStart(2, '0');
    return en ? `Today ${hh}:${mm}` : `今天 ${hh}:${mm}`;
  }
  if (days === 1) return en ? 'Yesterday' : '昨天';
  if (!en && days === 2) return '前天';
  if (days < 7) return en ? `${days}d ago` : `${days} 天前`;
  if (en) {
    const md = `${EN_MONTHS[then.getMonth()]} ${then.getDate()}`;
    return then.getFullYear() === today.getFullYear() ? md : `${md}, ${then.getFullYear()}`;
  }
  const date = `${then.getMonth() + 1}月${then.getDate()}日`;
  return then.getFullYear() === today.getFullYear() ? date : `${then.getFullYear()}年${date}`;
}

export class SwitchCycle {
  constructor(ids, current, direction) {
    this.ids = [...ids];
    const start = this.ids.indexOf(current);
    if (start >= 0) {
      this.index = start;
      this.step(direction);
    } else {
      this.index = direction < 0 ? Math.max(0, this.ids.length - 1) : 0;
    }
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

export function latestUserInput(entries, locale = 'zh') {
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
    if (parts.length) return uiCopy(locale).sentAttachment;
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
export function sessionWorkspaceName(snapshot, id, summary, locale = 'zh') {
  const workspace = snapshot.items?.find(item => item.sessionIds.includes(id));
  const basename = path => typeof path === 'string' ? path.trim().split(/[\\/]+/).filter(Boolean).at(-1) || path.trim() : '';
  return workspace?.title?.trim() || basename(workspace?.path) || basename(summary?.cwd) || uiCopy(locale).ungrouped;
}

export function sessionPresentation(status, summary, draft = false, now = Date.now(), locale = 'zh') {
  const en = normalizeLocale(locale) === 'en';
  const when = relativeTime(summary?.updatedAt, now, locale);
  let kind = 'idle';
  let label = en
    ? (when ? `Ready, updated ${when}` : 'Session ready')
    : (when ? `会话已就绪，${when}更新` : '会话已就绪');
  let shortLabel = when || (en ? 'Ready' : '已就绪');
  if (status?.pendingInteraction) {
    kind = 'approval';
    const pendingKind = status.pendingInteraction.kind;
    if (pendingKind === 'approval') {
      label = en ? 'Waiting for approval' : '等待用户确认';
      shortLabel = en ? 'Approval' : '待确认';
    } else if (pendingKind === 'plan-review') {
      label = en ? 'Plan awaiting review' : '等待审阅计划';
      shortLabel = en ? 'Plan review' : '计划待审';
    } else {
      label = en ? 'Waiting for answer' : '等待用户回应';
      shortLabel = en ? 'Answer' : '待回应';
    }
  } else if (status?.running ?? summary?.running) {
    kind = 'running';
    label = shortLabel = en ? 'Running' : '运行中';
  } else if (status?.completionUnread && status.completionFailed) {
    kind = 'failed';
    label = shortLabel = en ? 'Last turn failed' : '上轮失败';
  } else if (status?.completionUnread) {
    kind = 'unread';
    label = en ? 'New result available' : '有新结果';
    shortLabel = en ? 'New result' : '新结果';
  } else if (draft) {
    kind = 'draft';
    label = en ? 'Unsent draft' : '有草稿';
    shortLabel = en ? 'Draft' : '有草稿';
  }
  if (draft && kind !== 'draft') {
    label += en ? ', with draft' : '，有草稿';
    shortLabel += en ? ' · Draft' : ' · 有草稿';
  }
  const out = { kind, label, shortLabel, draft };
  if (kind === 'idle') out.recency = idleRecency(summary?.updatedAt, now);
  return out;
}

export const PREFS_KEY = 'dsh-switcher.prefs.v1';

export const EDITION_OPTIONS = [
  { id: 'kibutsu', label: '02 器物', enLabel: '02 Kibutsu', badge: '默认', enBadge: 'Default', detail: '136px 凝练比例 · 状态 → 标题 → 项目行 · 待处理态右侧微点，省去最后输入', enDetail: '136px compact card · Status → Title → Project · Right-aligned attention dot, omits last input' },
  { id: 'sujian', label: '01 素笺', enLabel: '01 Sujian', detail: '158px 舒展留白 · 状态 → 标题 → 项目行 · 省去最后输入', enDetail: '158px airy spacing · Status → Title → Project · Omits last input' },
  { id: 'jiechi', label: '03 界尺', enLabel: '03 Jiechi', detail: '138px 无框竖线分界 · 唯选中列浮现底面 · 状态领读', enDetail: '138px borderless hairline columns · Surface appears only on selected card · Status-first' },
  { id: 'moyun', label: '04 墨韵', enLabel: '04 Moyun', detail: '138px 活跃状态淡底胶囊 · 底部无框项目微标，不同卡双胶囊', enDetail: '138px soft tinted status pill · Borderless bottom project label, never two pills at once' },
  { id: 'b2', label: 'B2 轻胶囊', enLabel: 'B2 Capsule', detail: '158px 统一中性项目标签 · 保留四行「项目 → 标题 → 状态 → 最后输入」', enDetail: '158px neutral project capsule · Classic 4-row Project → Title → Status → Last input' },
  { id: 'split', label: '01 分签', enLabel: '01 Split', detail: '158px 经典顶栏题签 · 含「当前」标记与最后输入', enDetail: '158px classic header strip · Includes “Current” marker and last input excerpt' },
];

export const MOTION_OPTIONS = [
  { id: 'balanced', label: '动静异律', enLabel: 'Balanced', badge: '默认', enBadge: 'Default', detail: '选中框 160ms 滑动 · 运行中五拍流光波 · 待确认静止括弧配 2.6s 慢呼吸光标', enDetail: '160ms sliding selection lens · Five-beat wave while running · Calm 2.6s breathing cursor while waiting' },
  { id: 'running-only', label: '仅运行动', enLabel: 'Running only', detail: '选中框滑动 · 仅「运行中」波动，待确认/待回应保持纯静态高对比', enDetail: 'Sliding lens · Animates only while running; pending states remain crisp and static' },
  { id: 'orbital', label: '转弧双动', enLabel: 'Orbital', detail: '选中框滑动 · 运行中旋转追尾圆弧 + 待确认 1.45s 括弧与微点脉冲', enDetail: 'Sliding lens · Rotating chase arc while running + 1.45s bracket and dot pulse while waiting' },
  { id: 'classic', label: '原版五拍', enLabel: 'Classic 5-beat', detail: '保留原版五拍波形与卡片淡入过渡，不启用滑动选中底框', enDetail: 'Original five-beat wave and card fade transition without the sliding selection lens' },
  { id: 'off', label: '全静', enLabel: 'Off', detail: '关闭所有状态图标循环与切换滑动过渡', enDetail: 'Disables all looping status icon animations and sliding transitions' },
];

export const INK_OPTIONS = [
  { id: 'crisp', label: '清晰实色', enLabel: 'Crisp solid', badge: '默认', enBadge: 'Default', detail: '对齐 DSH 原生主文字黑度与字干渲染，状态与胶囊提亮，未选中 400 · 选中 500', enDetail: 'Matches native DSH primary ink contrast and stem rendering; 400 idle · 500 selected' },
  { id: 'medium', label: '凝实中黑', enLabel: 'Medium 500', detail: '全部卡片标题均采用 500 中黑配高对比辅字，快速扫视最扎实省力', enDetail: '500 Medium titles across all cards with high-contrast secondary labels for effortless scanning' },
  { id: 'soft', label: '清隽细体', enLabel: 'Soft light', detail: '保留 0.1.11 清淡灰阶细体（未选中弱化），适合偏爱轻柔观感的屏幕', enDetail: 'Retains 0.1.11 softer greyscale hierarchy for displays where lighter contrast is preferred' },
];

// The three groups below are orthogonal to the edition. Each one quiets a focal point
// that competes with status and title; their defaults keep the 02 器物 baseline as is.
export const PROJECT_OPTIONS = [
  { id: 'plain', label: '纯文字', enLabel: 'Plain text', badge: '默认', enBadge: 'Default', detail: '去掉描边与底色，和状态行同一套写法、上下对齐；选中卡只升一级墨色', enDetail: 'Removes border and fill to match and align with the status row; steps up one ink shade when selected' },
  { id: 'chip', label: '轻胶囊', enLabel: 'Capsule', detail: '中性描边胶囊，选中卡反白提亮', enDetail: 'Subtle outlined capsule, highlighted on the selected card' },
];

export const SIGNAL_OPTIONS = [
  { id: 'attention', label: '分色辨态', enLabel: 'Distinct hues', badge: '默认', enBadge: 'Default', detail: '按关注度分色：待确认琥珀、新结果亮蓝（带右侧微点）；运行中用温润青绿区分于闲置时间，且不与新结果撞色', enDetail: 'Priority hues: amber for pending and blue for new results (with right dot); celadon jade for running so it stands out from idle without mimicking new results' },
  { id: 'classic', label: '运行同蓝', enLabel: 'Shared blue', detail: '运行中与新结果共用蓝色并显示右侧微点，待确认为琥珀色', enDetail: 'Both running and new results share blue with right dot; pending interactions use amber' },
];

export const TITLE_OPTIONS = [
  { id: 'lead', label: '首行为主', enLabel: 'Lead line', badge: '默认', enBadge: 'Default', detail: '未选中卡的标题第二行降为次级色，扫视时只读首行；选中卡两行实色', enDetail: 'Dims the second title line on unselected cards for quicker scanning; both lines solid when selected' },
  { id: 'even', label: '两行同色', enLabel: 'Equal lines', detail: '标题两行同一墨色', enDetail: 'Renders both title lines in the same ink color' },
];

export const SCOPE_OPTIONS = [
  { id: 'hot', label: '热工作集', enLabel: 'Working Set', badge: '默认', enBadge: 'Default', detail: '2 小时内更新或查看过的会话 + 运行/待处理/未读/草稿常驻；最少 3 张、最多 5 张，冷会话自动隐退', enDetail: 'Sessions updated or viewed within 2h + running, pending, unread, or draft stay pinned; 3–5 cards, cold history hides' },
  { id: 'top3', label: '精简三卡', enLabel: 'Compact 3', detail: '同为 2 小时热工作集优先，始终保持紧凑 3 张卡片，适合只在两三个会话间高频往返', enDetail: 'Prioritizes the 2h working set and caps at 3 compact cards for rapid 2–3 session cycling' },
  { id: 'day', label: '当日宽窗', enLabel: '8h Window', detail: '放宽至 8 小时内活跃会话 + 未完结状态常驻；最少 3 张、最多 5 张，跨上下午不掉队', enDetail: 'Keeps sessions active within 8h + unfinished states pinned; 3–5 cards across morning and afternoon' },
  { id: 'classic', label: '固定五卡', enLabel: 'Classic 5', detail: '保留原版策略，不按时间收起，始终用最近历史补齐最多 5 张卡片', enDetail: 'Original behavior: no time cutoff, always backfills up to 5 recent sessions' },
];

export const DEFAULT_PREFS = Object.freeze({ edition: 'kibutsu', motion: 'balanced', ink: 'crisp', project: 'plain', signal: 'attention', title: 'lead', scope: 'hot' });

const PREF_OPTIONS = { edition: EDITION_OPTIONS, motion: MOTION_OPTIONS, ink: INK_OPTIONS, project: PROJECT_OPTIONS, signal: SIGNAL_OPTIONS, title: TITLE_OPTIONS, scope: SCOPE_OPTIONS };
const PREF_IDS = Object.fromEntries(Object.entries(PREF_OPTIONS).map(([key, options]) => [key, new Set(options.map(option => option.id))]));
export const PREF_KEYS = Object.freeze(Object.keys(PREF_OPTIONS));

export function normalizePrefs(input) {
  const value = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(PREF_KEYS.map(key => [key, PREF_IDS[key].has(value[key]) ? value[key] : DEFAULT_PREFS[key]]));
}

export function samePrefs(a, b) {
  return PREF_KEYS.every(key => a[key] === b[key]);
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
      if (samePrefs(next, state)) return state;
      state = next;
      try { storage?.setItem(PREFS_KEY, JSON.stringify(state)); } catch { /* Memory fallback stays live. */ }
      notify();
      return state;
    },
    reset() { return this.update(DEFAULT_PREFS); },
    sync() {
      let next = state;
      try { next = readPrefs(storage?.getItem(PREFS_KEY)); } catch { return state; }
      if (samePrefs(next, state)) return state;
      state = next; notify();
      return state;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
