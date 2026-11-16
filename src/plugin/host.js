import { HISTORY_KEY, HISTORY_TIMES_KEY, ACTIVITY_KEY, READ_DWELL_MS, DEFAULT_PREFS, UI_COPY, normalizeLocale, detectEnvironmentLocale, uiCopy, readHistory, remember, readVisitTimes, rememberVisit, readActivityState, serializeActivityState, latestActivityTimestamp, isSubagentSession, resolveSessionTarget, aggregateSessionStatus, candidates, sessionTimestamp, latestUserInput, hasDraft, sessionPresentation, sessionWorkspaceName } from './core.js';

// Adapter for the public client services shipped in DSH 0.2.1+ / 0.2.2+.
export function createHostAdapter(ctx, options = {}) {
  const getPrefs = options.getPrefs || (() => DEFAULT_PREFS);
  const clock = options.now || (() => Date.now());
  const readDwellMs = typeof options.readDwellMs === 'number' && options.readDwellMs >= 0 ? options.readDwellMs : READ_DWELL_MS;
  const activityStorage = options.activityStorage !== undefined
    ? options.activityStorage
    : (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  const localeService = typeof ctx.get === 'function' ? ctx.get('locale') : ctx.locale;
  const resolveLocale = options.getLocale || (() => {
    const active = localeService?.getSnapshot?.()?.active;
    return active ? normalizeLocale(active) : detectEnvironmentLocale();
  });

  let history = [], visitTimes = {}, disposed = false, observedId, recordedId, observedBinding, stopCurrent = () => {};
  let dwellId, dwellTimer;
  const listeners = new Set(), cache = new Map(), previewOwners = new Set();
  const wasRunning = new Map(), rawRunning = new Map(), completedAt = new Map();
  const localUnread = new Set(), seenHostUnread = new Set(), knownIds = new Set();
  let baselineSeeded = false;

  try {
    history = readHistory(sessionStorage.getItem(HISTORY_KEY));
    visitTimes = readVisitTimes(sessionStorage.getItem(HISTORY_TIMES_KEY));
  } catch { /* Memory-only history remains usable. */ }
  try {
    const saved = readActivityState(activityStorage?.getItem(ACTIVITY_KEY));
    for (const [id, at] of Object.entries(saved.activity)) completedAt.set(id, at);
    for (const id of saved.unread) localUnread.add(id);
  } catch { /* Memory-only activity state remains usable. */ }

  const persistActivity = (keepIds = null) => {
    try { activityStorage?.setItem(ACTIVITY_KEY, serializeActivityState(completedAt, localUnread, keepIds)); } catch { /* Ignore quota/access errors. */ }
  };

  const current = () => ctx.sidebarRight.mounted.getSnapshot();
  const isSubagent = (snapshot, id) => isSubagentSession(snapshot, id) ||
    Boolean(id && typeof ctx.sessions.subagentAddress === 'function' && ctx.sessions.subagentAddress(id));
  const activeSession = () => {
    const snapshot = ctx.sessions.list.getSnapshot(), id = current();
    return isSubagent(snapshot, id) ? resolveSessionTarget(snapshot, id) : id;
  };
  const isForegroundWindow = () => {
    if (typeof document === 'undefined') return true;
    if (document.hidden) return false;
    if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
    if (typeof document.querySelector === 'function' && document.querySelector('[aria-modal="true"], dialog[open]')) return false;
    return true;
  };
  const foregroundViewedId = (snapshot, rawMounted) => (
    rawMounted && !isSubagent(snapshot, rawMounted) && snapshot?.byId?.[rawMounted] && isForegroundWindow()
      ? rawMounted
      : undefined
  );
  const clearDwell = () => {
    if (dwellTimer !== undefined) { clearTimeout(dwellTimer); dwellTimer = undefined; }
    dwellId = undefined;
  };
  const publish = () => { if (!disposed) for (const listener of listeners) listener(); };
  const markReadNow = id => {
    if (dwellId === id) clearDwell();
    if (!localUnread.delete(id)) return false;
    persistActivity();
    return true;
  };
  const syncReadDwell = fgId => {
    if (!fgId || !localUnread.has(fgId)) {
      clearDwell();
      return false;
    }
    if (readDwellMs <= 0) return markReadNow(fgId);
    if (dwellId === fgId && dwellTimer !== undefined) return false;
    clearDwell();
    dwellId = fgId;
    dwellTimer = setTimeout(() => {
      dwellTimer = undefined;
      const target = dwellId;
      dwellId = undefined;
      if (disposed || !target) return;
      const snap = ctx.sessions.list.getSnapshot();
      if (foregroundViewedId(snap, current()) === target && markReadNow(target)) publish();
    }, readDwellMs);
    return false;
  };

  function syncCompletionState(snapshot, statusMap, rawMounted, at) {
    // Only a non-subagent session actively visible in a focused, uncovered window counts as being read.
    // Completions while on Tasks/Plugins/Settings, covered by a modal, or with DSH in the background stay unread,
    // and opening an unread session requires `readDwellMs` before `New result` clears.
    const viewedTopId = foregroundViewedId(snapshot, rawMounted);
    let dirty = false;

    if (statusMap instanceof Map) {
      for (const [rawId, st] of statusMap.entries()) {
        const resolved = isSubagent(snapshot, rawId) ? resolveSessionTarget(snapshot, rawId) : rawId;
        const targetId = resolved || (!isSubagent(snapshot, rawId) ? rawId : undefined);
        if (st?.completionUnread) {
          if (!seenHostUnread.has(rawId)) {
            seenHostUnread.add(rawId);
            if (targetId && targetId !== viewedTopId) {
              if (!localUnread.has(targetId)) { localUnread.add(targetId); dirty = true; }
              if (baselineSeeded) { completedAt.set(targetId, at); dirty = true; }
            }
          }
        } else {
          seenHostUnread.delete(rawId);
        }
        if (typeof st?.running === 'boolean') {
          const prevRaw = rawRunning.get(rawId);
          rawRunning.set(rawId, st.running);
          if (st.running) {
            if (targetId && !isSubagent(snapshot, rawId) && localUnread.delete(targetId)) dirty = true;
          } else if (prevRaw === true && targetId && targetId !== viewedTopId && !snapshot?.byId?.[targetId]) {
            localUnread.add(targetId);
            completedAt.set(targetId, at);
            dirty = true;
          }
        }
      }
    }

    const topIds = Array.isArray(snapshot?.ids) ? snapshot.ids : [];
    const listReady = snapshot?.phase ? snapshot.phase === 'ready' : topIds.length > 0;
    for (const id of topIds) {
      const summary = snapshot?.byId?.[id];
      if (!summary || isSubagent(snapshot, id)) continue;
      const runningNow = aggregateSessionStatus(snapshot, statusMap, id).running;
      const prevTop = wasRunning.get(id);
      wasRunning.set(id, runningNow);
      const summaryTime = sessionTimestamp(summary.updatedAt);
      const freshArrival = !summaryTime || (at - summaryTime <= 5 * 60_000);
      if (runningNow) {
        if (localUnread.delete(id)) dirty = true;
      } else if (prevTop === true || (prevTop === undefined && rawRunning.get(id) === false && !knownIds.has(id) && baselineSeeded && !summary.blank)) {
        completedAt.set(id, at);
        if (id !== viewedTopId) localUnread.add(id);
        dirty = true;
      } else if (baselineSeeded && !knownIds.has(id) && !summary.blank && id !== viewedTopId && freshArrival) {
        completedAt.set(id, at);
        localUnread.add(id);
        dirty = true;
      }
      if (listReady) knownIds.add(id);
    }
    if (listReady) {
      baselineSeeded = true;
      const present = new Set(Object.keys(snapshot?.byId || {}));
      for (const id of [...knownIds]) {
        if (!present.has(id)) {
          knownIds.delete(id);
          if (localUnread.delete(id)) dirty = true;
          if (completedAt.delete(id)) dirty = true;
          wasRunning.delete(id);
          rawRunning.delete(id);
          seenHostUnread.delete(id);
        }
      }
    }
    syncReadDwell(viewedTopId);
    if (dirty) persistActivity();
  }

  function watch(binding) {
    const id = binding.sessionId, session = binding.session;
    const prevCached = cache.get(id);
    let input, eventWindow, windowHasInput = false;
    let text = prevCached?.text || '', attachmentOnly = Boolean(prevCached?.attachmentOnly);
    try { input = ctx.conversation.input.for(binding.ctx).state; } catch { /* Some sources have no composer. */ }
    const extractInput = entries => {
      const zhText = latestUserInput(entries, 'zh');
      if (!zhText) return null;
      const isAttachment = zhText === UI_COPY.zh.sentAttachment && latestUserInput(entries, 'en') === UI_COPY.en.sentAttachment;
      return { text: isAttachment ? '' : zhText, attachmentOnly: isAttachment };
    };
    const refresh = () => {
      if (disposed) return;
      const snapshot = session.getSnapshot();
      const previous = cache.get(id);
      let activityPublished = false;
      const nextWindow = session.eventSource.getSnapshot();
      if (nextWindow !== eventWindow) {
        // DSH exposes contiguous event-window changes. Streaming assistant chunks
        // must not materialize and scan the complete history for an unchanged user line.
        const contiguous = eventWindow && Number.isInteger(nextWindow.revision) && nextWindow.revision === eventWindow.revision + 1;
        const change = contiguous ? nextWindow.change : undefined;
        let found = null, latestAt = 0, settled = false;
        if (change?.kind === 'append' && Array.isArray(change.entries)) {
          found = extractInput(change.entries);
          latestAt = latestActivityTimestamp(change.entries);
          if (found && id === foregroundViewedId(ctx.sessions.list.getSnapshot(), current())) markReadNow(id);
        } else if (change?.kind === 'prepend' && Array.isArray(change.entries)) {
          // A cached fallback can predate this window's actual latest user input.
          if (!windowHasInput) found = extractInput(change.entries);
        } else if (change?.kind === 'settle-assistant') {
          latestAt = change.entry ? latestActivityTimestamp([change.entry]) : 0;
          settled = true;
        } else {
          const windowEntries = nextWindow.entries;
          found = extractInput(windowEntries); windowHasInput = Boolean(found);
          latestAt = latestActivityTimestamp(windowEntries);
          settled = true;
        }
        if (found) { text = found.text; attachmentOnly = found.attachmentOnly; windowHasInput = true; }
        const prevRecorded = Math.max(
          completedAt.get(id) || 0,
          sessionTimestamp(ctx.sessions.list.getSnapshot()?.byId?.[id]?.updatedAt),
        );
        if (latestAt > (completedAt.get(id) || 0)) {
          completedAt.set(id, latestAt);
          if (settled || latestAt - prevRecorded >= 30_000) {
            persistActivity();
            activityPublished = latestAt > prevRecorded;
          }
        }
        eventWindow = nextWindow;
      }
      const draftState = input?.getSnapshot();
      const draftNow = hasDraft(draftState?.draft) || !!draftState?.attachmentIds?.length;
      if (previous && !previous.draft && draftNow && id === foregroundViewedId(ctx.sessions.list.getSnapshot(), current())) {
        if (markReadNow(id)) activityPublished = true;
      }
      const next = {
        text,
        attachmentOnly,
        ready: snapshot.openState === 'open',
        error: snapshot.openState === 'error',
        draft: draftNow,
      };
      if (
        !activityPublished &&
        previous &&
        next.text === previous.text &&
        next.attachmentOnly === previous.attachmentOnly &&
        next.ready === previous.ready &&
        next.error === previous.error &&
        next.draft === previous.draft
      ) return;
      cache.set(id, next);
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      publish();
    };
    const stops = [session.eventSource.subscribe(refresh), session.subscribe(refresh)];
    if (input) stops.push(input.subscribe(refresh));
    refresh();
    return () => { for (const stop of stops) stop(); };
  }

  function reconcile() {
    if (disposed) return;
    const snapshot = ctx.sessions.list.getSnapshot(), id = current(), at = clock();
    syncCompletionState(snapshot, ctx.uiSession.sessionStatus.getSnapshot(), id, at);

    const cleaned = history.filter(item => !isSubagent(snapshot, item));
    let historyChanged = cleaned.length !== history.length;
    let timesChanged = false;
    if (historyChanged) {
      history = cleaned;
      visitTimes = rememberVisit(visitTimes, '', at, history);
      timesChanged = true;
    }
    const targetId = isSubagent(snapshot, id)
      ? resolveSessionTarget(snapshot, id)
      : (snapshot?.byId?.[id] ? id : undefined);
    if (targetId && targetId !== recordedId) {
      const previousId = recordedId;
      recordedId = targetId;
      history = remember(history, targetId);
      if (previousId && previousId !== targetId && history.includes(previousId)) {
        visitTimes = rememberVisit(visitTimes, previousId, at, history);
      }
      visitTimes = rememberVisit(visitTimes, targetId, at, history);
      historyChanged = true;
      timesChanged = true;
    }
    if (historyChanged) {
      try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* Storage may be unavailable. */ }
    }
    if (timesChanged) {
      try { sessionStorage.setItem(HISTORY_TIMES_KEY, JSON.stringify(visitTimes)); } catch { /* Storage may be unavailable. */ }
    }
    observedId = id;
    let binding;
    try { binding = id && !isSubagent(snapshot, id) ? ctx.sessions.binding(id) : undefined; } catch { /* Mount is still resolving. */ }
    if (binding !== observedBinding) {
      stopCurrent(); observedBinding = binding;
      stopCurrent = binding ? watch(binding) : () => {};
    }
    publish();
  }

  function onStatusChange() {
    if (disposed) return;
    syncCompletionState(ctx.sessions.list.getSnapshot(), ctx.uiSession.sessionStatus.getSnapshot(), current(), clock());
    publish();
  }

  function onForegroundChange() {
    if (disposed) return;
    if (syncReadDwell(foregroundViewedId(ctx.sessions.list.getSnapshot(), current()))) publish();
  }

  const stops = [
    ctx.sessions.list.subscribe(reconcile),
    ctx.sidebarRight.mounted.subscribe(reconcile),
    ctx.uiSession.sessionStatus.subscribe(onStatusChange),
    ctx.workspaces.list.subscribe(publish),
    ctx.on('theme/change', publish),
  ];
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('focus', onForegroundChange);
    window.addEventListener('blur', onForegroundChange);
    stops.push(() => {
      window.removeEventListener('focus', onForegroundChange);
      window.removeEventListener('blur', onForegroundChange);
    });
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', onForegroundChange);
    stops.push(() => document.removeEventListener('visibilitychange', onForegroundChange));
  }
  if (typeof localeService?.subscribe === 'function') stops.push(localeService.subscribe(publish));
  if (typeof ctx.on === 'function') stops.push(ctx.on('locale/change', publish));
  reconcile();

  return {
    current,
    activeSession,
    locale: resolveLocale,
    candidates: () => candidates(
      ctx.sessions.list.getSnapshot(),
      ctx.workspaces.list.getSnapshot().archivedSessionIds || [],
      history,
      activeSession(),
      [...cache].filter(([, row]) => row.draft).map(([id]) => id),
      {
        scope: getPrefs()?.scope,
        visitedAt: visitTimes,
        statuses: ctx.uiSession.sessionStatus.getSnapshot(),
        unreadIds: localUnread,
        completedAt,
        now: clock(),
      },
    ),
    exists: id => {
      const snapshot = ctx.sessions.list.getSnapshot();
      return Boolean(snapshot?.byId?.[id]) && !isSubagent(snapshot, id) && !(ctx.workspaces.list.getSnapshot().archivedSessionIds || []).includes(id);
    },
    theme: () => ctx.theme.getTheme().active.colorScheme === 'dark' ? 'dark' : 'light',
    row(id) {
      const snapshot = ctx.sessions.list.getSnapshot();
      const statusMap = ctx.uiSession.sessionStatus.getSnapshot();
      const summary = snapshot.byId[id], data = cache.get(id), nowAt = clock();
      const locale = resolveLocale(), copy = uiCopy(locale);
      const rawMounted = current();
      const fgId = foregroundViewedId(snapshot, rawMounted);
      const ownUnread = Boolean(statusMap.get(id)?.completionUnread);
      const effectiveStatus = aggregateSessionStatus(snapshot, statusMap, id, {
        unread: localUnread.has(id) || (fgId !== id && ownUnread),
      });
      const effectiveUpdatedAt = Math.max(sessionTimestamp(summary?.updatedAt), completedAt.get(id) || 0) || summary?.updatedAt;
      const text = data?.attachmentOnly ? copy.sentAttachment : (data?.text || '');
      return {
        id,
        title: summary?.displayTitle || summary?.title || copy.newSession,
        workspaceName: sessionWorkspaceName(ctx.workspaces.list.getSnapshot(), id, summary, locale),
        text,
        placeholder: data?.error ? copy.inputError : data?.ready ? copy.inputEmpty : copy.inputLoading,
        ...sessionPresentation(effectiveStatus, { ...summary, updatedAt: effectiveUpdatedAt }, data?.draft, nowAt, locale),
      };
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    preview(ids) {
      let active = true;
      const owners = [];
      const release = () => {
        if (!active) return;
        active = false; previewOwners.delete(release);
        for (const owner of owners) { owner.stop?.(); owner.reference.release(); }
      };
      previewOwners.add(release);
      for (const id of ids) {
        // The mounted conversation already has a host-owned binding and watcher.
        if (id === observedId && observedBinding) continue;
        let owner;
        try {
          const reference = ctx.sessions.retain(id, { source: 'plugin:dsh-switcher' });
          owner = { reference }; owners.push(owner);
          owner.stop = watch(reference.binding);
          reference.ready.catch(() => {
            if (active && !disposed) { cache.set(id, { ...cache.get(id), error: true }); publish(); }
          });
        } catch {
          cache.set(id, { ...cache.get(id), error: true });
        }
      }
      publish();
      return release;
    },
    open: id => ctx.uiWorkspace.openSession(id),
    destroy() {
      disposed = true; clearDwell(); stopCurrent();
      for (const release of [...previewOwners]) release();
      for (const stop of stops) stop();
      listeners.clear(); cache.clear();
      wasRunning.clear(); rawRunning.clear(); completedAt.clear();
      localUnread.clear(); seenHostUnread.clear(); knownIds.clear();
    },
  };
}
