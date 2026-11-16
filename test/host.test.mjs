import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostAdapter } from '../src/plugin/host.js';

function store(value) {
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(); }, get size() { return listeners.size; } };
}
test('host observes real sources, retains only preview candidates, and releases on close/unload', async () => {
  const storage = new Map(); globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  const events = store({ entries: [{ event: { type: 'user/message', data: { content: [{ type: 'text', text: '实际输入' }] } } }] });
  const session = Object.assign(store({ openState: 'open' }), { eventSource: events });
  const input = store({ draft: { text: '未发送' } });
  const binding = { sessionId: 'a', ctx: {}, session };
  let retains = 0, releases = 0, reject, opened;
  const list = store({ ids: ['a', 'b'], byId: { a: { displayTitle: '真实标题' }, b: { displayTitle: '另一会话' } } });
  const mounted = store('a'), status = store(new Map([['a', { running: true }]]));
  const workspaces = store({ archivedSessionIds: [], items: [{ workspaceId: 'w', title: 'Switcher', path: '/code/switcher', sessionIds: ['a'] }] });
  const ctx = {
    sessions: { list, binding: id => id === 'a' ? binding : undefined, retain(id) { retains++; return {
      binding: { ...binding, sessionId: id }, ready: new Promise((_, no) => { reject = no; }), release() { releases++; },
    }; } },
    sidebarRight: { mounted }, uiSession: { sessionStatus: status }, workspaces: { list: workspaces },
    conversation: { input: { for: () => ({ state: input }) } }, theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
    uiWorkspace: { openSession: id => { opened = id; } }, on: () => () => {},
  };
  const host = createHostAdapter(ctx);
  assert.equal(retains, 0); assert.equal(host.row('a').text, '实际输入'); assert.equal(host.row('a').kind, 'running');
  assert.equal(host.row('a').draft, true); assert.equal(host.theme(), 'dark');
  assert.equal(host.row('a').workspaceName, 'Switcher');
  let updates = 0; const stopUpdates = host.subscribe(() => updates++);
  workspaces.set({ archivedSessionIds: [], items: [{ workspaceId: 'w', title: '重命名项目', sessionIds: ['a'] }] });
  assert.equal(updates, 1); assert.equal(host.row('a').workspaceName, '重命名项目');
  workspaces.set({ archivedSessionIds: [], items: [{ workspaceId: 'w2', title: '移动后的项目', sessionIds: ['a', 'b'] }] });
  assert.equal(updates, 2); assert.equal(host.row('a').workspaceName, '移动后的项目');
  assert.equal(host.row('b').workspaceName, '移动后的项目'); stopUpdates();
  const stop = host.preview(['b']); assert.equal(retains, 1);
  stop(); stop(); assert.equal(releases, 1);
  reject(new Error('late cancellation')); await Promise.resolve();
  assert.equal(host.row('b').placeholder, '还没有输入');
  host.open('b'); assert.equal(opened, 'b');
  mounted.set('b'); assert.deepEqual(host.candidates(), ['b', 'a']);
  assert.equal([...storage.values()].some(value => value.includes('实际输入')), false);
  host.destroy(); assert.equal(events.size, 0); assert.equal(input.size, 0); assert.equal(list.size, 0); assert.equal(status.size, 0); assert.equal(workspaces.size, 0);
  delete globalThis.sessionStorage;
});

test('streaming uses event deltas; draft/status notifications do not rescan or republish unchanged text', () => {
  let materializations = 0, retains = 0, releases = 0;
  const user = text => ({ event: { type: 'user/message', data: { content: text } } });
  const assistant = { event: { type: 'assistant/message', data: { content: 'stream' } } };
  const windowOf = (revision, change, entries) => ({ revision, change, get entries() { materializations++; return entries; } });
  const events = store(windowOf(0, { kind: 'replace' }, [user('最初输入')]));
  const session = Object.assign(store({ openState: 'open' }), { eventSource: events });
  const input = store({ draft: '' }), binding = { sessionId: 'a', ctx: {}, session };
  const ctx = {
    sessions: { list: store({ ids: ['a'], byId: { a: { title: 'A' } } }), binding: () => binding,
      retain() { retains++; return { binding, ready: Promise.resolve(), release() { releases++; } }; } },
    sidebarRight: { mounted: store('a') }, uiSession: { sessionStatus: store(new Map()) },
    workspaces: { list: store({ items: [], archivedSessionIds: [] }) },
    conversation: { input: { for: () => ({ state: input }) } },
    theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) }, uiWorkspace: { openSession() {} }, on: () => () => {},
  };
  const host = createHostAdapter(ctx);
  let updates = 0; host.subscribe(() => updates++);
  assert.equal(materializations, 1);
  for (let revision = 1; revision <= 100; revision++) {
    events.set(windowOf(revision, { kind: 'append', entries: [assistant] }, [user('最初输入'), assistant]));
  }
  assert.equal(materializations, 1); assert.equal(updates, 0);
  input.set({ draft: '草稿' }); input.set({ draft: '草稿继续输入' }); session.set({ openState: 'open' });
  assert.equal(materializations, 1); assert.equal(updates, 1); assert.equal(host.row('a').draft, true);
  events.set(windowOf(101, { kind: 'append', entries: [user('新的输入')] }, []));
  assert.equal(host.row('a').text, '新的输入'); assert.equal(updates, 2);
  events.set(windowOf(102, { kind: 'prepend', entries: [user('更早的输入')] }, []));
  events.set(windowOf(103, { kind: 'settle-assistant', entry: assistant }, []));
  assert.equal(host.row('a').text, '新的输入'); assert.equal(materializations, 1); assert.equal(updates, 2);
  // A missed publication or a replacement must fall back to the complete snapshot.
  events.set(windowOf(105, { kind: 'append', entries: [assistant] }, [user('跳过版本后的输入'), assistant]));
  assert.equal(host.row('a').text, '跳过版本后的输入'); assert.equal(materializations, 2);
  events.set(windowOf(106, { kind: 'replace' }, [user('替换窗口后的输入')]));
  assert.equal(host.row('a').text, '替换窗口后的输入'); assert.equal(materializations, 3);
  // A tail-only replacement can temporarily need a cached fallback; a later
  // history page must still replace it with the window's latest human input.
  events.set(windowOf(107, { kind: 'replace' }, [assistant]));
  assert.equal(host.row('a').text, '替换窗口后的输入');
  events.set(windowOf(108, { kind: 'prepend', entries: [user('分页补回的最近输入')] }, []));
  assert.equal(host.row('a').text, '分页补回的最近输入'); assert.equal(materializations, 4);
  const stop = host.preview(['a']);
  assert.equal(retains, 0); assert.equal(events.size, 1);
  stop(); assert.equal(releases, 0);
  host.destroy(); assert.equal(events.size, 0); assert.equal(input.size, 0);
});

test('host scrubs stored subagents, ignores subagent mounts, and anchors on the parent session', () => {
  const storage = new Map([['dsh-switcher.mru.v1', JSON.stringify(['subOrigin', 'subRetained', 'subAddr', 'b', 'a'])]]);
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  try {
    const eventsA = store({ entries: [{ event: { type: 'user/message', data: { content: '父会话输入' } } }] });
    const eventsSub = store({ entries: [{ event: { type: 'user/message', data: { content: '子代理内部任务' } } }] });
    const sessionA = Object.assign(store({ openState: 'open' }), { eventSource: eventsA });
    const sessionSub = Object.assign(store({ openState: 'open' }), { eventSource: eventsSub });
    const bindingCalls = [];
    const list = store({
      ids: ['a', 'b', 'subOrigin'],
      byId: {
        a: { displayTitle: '父会话 A', updatedAt: 10 },
        b: { displayTitle: '会话 B', updatedAt: 20 },
        subOrigin: { displayTitle: '子代理 O', parentId: 'a', origin: 'subagent', updatedAt: 99 },
        subRetained: { displayTitle: '子代理 R', parentId: 'a', updatedAt: 98 },
        subAddr: { displayTitle: '子代理 Addr', updatedAt: 97 },
      },
    });
    const mounted = store('a');
    const ctx = {
      sessions: {
        list,
        binding(id) {
          bindingCalls.push(id);
          if (id === 'a') return { sessionId: 'a', ctx: {}, session: sessionA };
          if (id === 'subOrigin') return { sessionId: 'subOrigin', ctx: {}, session: sessionSub };
          return undefined;
        },
        subagentAddress: id => (id === 'subAddr' ? { parentSessionId: 'b' } : undefined),
        retain: id => ({ binding: { sessionId: id, ctx: {}, session: sessionA }, ready: Promise.resolve(), release() {} }),
      },
      sidebarRight: { mounted },
      uiSession: { sessionStatus: store(new Map()) },
      workspaces: { list: store({ archivedSessionIds: [], items: [] }) },
      conversation: { input: { for: () => ({ state: store({ draft: '' }) }) } },
      theme: { getTheme: () => ({ active: { colorScheme: 'light' } }) },
      uiWorkspace: { openSession() {} },
      on: () => () => {},
    };

    const host = createHostAdapter(ctx);
    assert.deepEqual(JSON.parse(storage.get('dsh-switcher.mru.v1')), ['a', 'b']);
    assert.deepEqual(host.candidates(), ['a', 'b']);
    assert.equal(host.exists('a'), true);
    for (const subId of ['subOrigin', 'subRetained', 'subAddr']) assert.equal(host.exists(subId), false);

    // Viewing subagents never records them to MRU or binds their event streams.
    mounted.set('subOrigin');
    assert.equal(host.activeSession(), 'a');
    assert.deepEqual(host.candidates(), ['a', 'b']);
    assert.equal(eventsSub.size, 0);
    assert.equal(bindingCalls.includes('subOrigin'), false);
    assert.deepEqual(JSON.parse(storage.get('dsh-switcher.mru.v1')), ['a', 'b']);

    // Mounting a subagent attached to b anchors MRU/switcher on b, still excluding subagents.
    mounted.set('subRetained');
    list.set({
      ...list.getSnapshot(),
      byId: { ...list.getSnapshot().byId, subRetained: { displayTitle: '子代理 R', parentId: 'b', updatedAt: 98 } },
    });
    assert.equal(host.activeSession(), 'b');
    assert.deepEqual(host.candidates(), ['b', 'a']);
    assert.deepEqual(JSON.parse(storage.get('dsh-switcher.mru.v1')), ['b', 'a']);

    // Orphan subagent without a root target resolves to undefined and still leaves b, a clean.
    mounted.set('subAddr');
    assert.equal(host.exists('subAddr'), false);
    assert.equal(host.activeSession(), undefined);
    assert.deepEqual(host.candidates(), ['b', 'a']);

    host.destroy();
  } finally {
    delete globalThis.sessionStorage;
  }
});

test('host tracks visit departure/arrival timestamps and respects live working-set scope switches', () => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  try {
    let now = Date.parse('2026-11-14T10:00:00.000Z');
    let scope = 'hot';
    const mins = m => now - m * 60_000;
    const list = store({
      ids: ['a', 'b', 'oldRef', 'bgTask', 'stale'],
      byId: {
        a: { displayTitle: '主线 A', updatedAt: mins(5) },
        b: { displayTitle: '主线 B', updatedAt: mins(15) },
        oldRef: { displayTitle: '五天前的参考会话', updatedAt: mins(5 * 1440) },
        bgTask: { displayTitle: '昨日长任务', updatedAt: mins(1500) },
        stale: { displayTitle: '昨日闲置', updatedAt: mins(1600) },
      },
    });
    const mounted = store('a');
    const status = store(new Map());
    const ctx = {
      sessions: {
        list,
        binding: () => undefined,
        retain: id => ({
          binding: { sessionId: id, ctx: {}, session: Object.assign(store({ openState: 'open' }), { eventSource: store({ entries: [] }) }) },
          ready: Promise.resolve(),
          release() {},
        }),
      },
      sidebarRight: { mounted },
      uiSession: { sessionStatus: status },
      workspaces: { list: store({ archivedSessionIds: [], items: [] }) },
      conversation: { input: { for: () => ({ state: store({ draft: '' }) }) } },
      theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
      uiWorkspace: { openSession() {} },
      on: () => () => {},
    };

    const host = createHostAdapter(ctx, { getPrefs: () => ({ scope }), now: () => now });
    // Initially `a` and `b` are warm; 3-card floor tops up with `bgTask` without padding out to 5.
    assert.deepEqual(host.candidates(), ['a', 'b', 'bgTask']);

    // User visits `b`, then opens `oldRef` (5 days old, read-only) for 90m, then switches back to `a`.
    mounted.set('b');
    mounted.set('oldRef');
    now += 90 * 60_000; // 11:30 (+90m: `a`, `b`, `oldRef` are all within 2h!)
    mounted.set('a');
    assert.deepEqual(host.candidates(), ['a', 'oldRef', 'b']);

    // A background task from yesterday enters `approval` — expands `hot` to 4 cards!
    status.set(new Map([['bgTask', { pendingInteraction: { kind: 'approval' } }]]));
    assert.deepEqual(host.candidates(), ['a', 'oldRef', 'b', 'bgTask']);

    // Switching scope to `classic` restores 5-card backfill; `top3` caps at 3.
    scope = 'classic';
    assert.deepEqual(host.candidates(), ['a', 'oldRef', 'b', 'bgTask', 'stale']);
    scope = 'top3';
    assert.deepEqual(host.candidates(), ['a', 'oldRef', 'b']);

    // 3 hours later with `bgTask` resolved, all sessions are cold -> floor of 3 keeps `a`, `oldRef`, `b`.
    status.set(new Map());
    now += 180 * 60_000;
    scope = 'hot';
    assert.deepEqual(host.candidates(), ['a', 'oldRef', 'b']);

    host.destroy();
  } finally {
    delete globalThis.sessionStorage;
  }
});

test('host reliably marks newly completed tasks as unread, requires foreground dwell before clearing, and reads scheduled event.time', async () => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  let windowFocused = true;
  const docTarget = new EventTarget();
  docTarget.hidden = false;
  docTarget.hasFocus = () => windowFocused;
  docTarget.querySelector = () => null;
  globalThis.document = docTarget;
  try {
    let now = new Date(2026, 10, 16, 21, 0, 0).getTime();
    const mins = m => new Date(now - m * 60_000).toISOString();
    const todayTenAm = new Date(2026, 10, 16, 10, 0, 0).getTime();
    const nov3Iso = new Date(2026, 10, 3, 9, 0, 0).toISOString();
    const schedEvents = store({
      revision: 1,
      change: { kind: 'replace' },
      entries: [
        { event: { type: 'user/message', time: todayTenAm, data: { source: { kind: 'schedule' }, content: '检测升级' } } },
        { event: { type: 'turn/end', time: todayTenAm + 5_000, data: {} } },
      ],
    });
    const schedSession = Object.assign(store({ openState: 'open' }), { eventSource: schedEvents });
    const list = store({
      phase: 'ready',
      ids: ['a', 'b', 'c', 'dailyCheck'],
      byId: {
        a: { displayTitle: '主会话 A', updatedAt: mins(5), running: true },
        b: { displayTitle: '父会话 B', updatedAt: mins(240), running: false },
        c: { displayTitle: '常规会话 C', updatedAt: mins(20), running: false },
        dailyCheck: { displayTitle: '升级到 v0.2.2-alpha.3', updatedAt: nov3Iso, running: false },
      },
      projectionsBySession: {
        b: { values: { subagentCatalog: [{ id: 'sub-b1' }] } },
      },
    });
    const mounted = store('a');
    const status = store(new Map([['a', { running: true, completionUnread: false }]]));
    const ctx = {
      sessions: {
        list,
        binding: id => (id === 'dailyCheck' ? { sessionId: id, ctx: {}, session: schedSession } : undefined),
        subagentAddress: id => (id === 'sub-b1' ? { parentSessionId: 'b' } : undefined),
        retain: id => ({
          binding: { sessionId: id, ctx: {}, session: id === 'dailyCheck' ? schedSession : Object.assign(store({ openState: 'open' }), { eventSource: store({ entries: [] }) }) },
          ready: Promise.resolve(),
          release() {},
        }),
      },
      sidebarRight: { mounted },
      uiSession: { sessionStatus: status },
      workspaces: { list: store({ archivedSessionIds: [], items: [] }) },
      conversation: { input: { for: () => ({ state: store({ draft: '' }) }) } },
      theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
      uiWorkspace: { openSession() {} },
      on: () => () => {},
    };

    const host = createHostAdapter(ctx, { now: () => now, readDwellMs: 35 });
    assert.equal(host.row('a').kind, 'running');

    // Case 1: User switches to Tasks/Plugins/Settings (`mounted` is `undefined`), while DSH keeps
    // `retainedBy.mainView > 0` on `a` so `UiSession` sets `completionUnread: false` when `a` finishes!
    mounted.set(undefined);
    now += 60_000;
    list.set({ ...list.getSnapshot(), byId: { ...list.getSnapshot().byId, a: { displayTitle: '主会话 A', updatedAt: mins(6), running: false } } });
    status.set(new Map([['a', { running: false, completionUnread: false }]]));
    assert.equal(host.row('a').kind, 'unread');
    assert.equal(host.row('a').shortLabel, '新结果');

    // Quick glance (< 35ms dwell) does NOT wipe `新结果`; switching away preserves it!
    mounted.set('a');
    assert.equal(host.row('a').kind, 'unread', 'New result must not disappear at 0ms on brief glance');
    mounted.set('c');
    await new Promise(r => setTimeout(r, 45));
    assert.equal(host.row('a').kind, 'unread', 'Leaving before dwell elapses preserves New result');

    // Staying on `a` in foreground for >= dwell clears unread and transitions into `fresh` (`刚刚`).
    mounted.set('a');
    await new Promise(r => setTimeout(r, 45));
    assert.equal(host.row('a').kind, 'idle');
    assert.equal(host.row('a').recency, 'fresh');
    assert.equal(host.row('a').shortLabel, '刚刚');

    // Case 1b: Completion while DSH window is unfocused (`!document.hasFocus()`) marks even the mounted session unread!
    windowFocused = false;
    status.set(new Map([['a', { running: true, completionUnread: false }]]));
    list.set({ ...list.getSnapshot(), byId: { ...list.getSnapshot().byId, a: { displayTitle: '主会话 A', updatedAt: mins(6), running: true } } });
    now += 20_000;
    list.set({ ...list.getSnapshot(), byId: { ...list.getSnapshot().byId, a: { displayTitle: '主会话 A', updatedAt: mins(6), running: false } } });
    status.set(new Map([['a', { running: false, completionUnread: false }]]));
    assert.equal(host.row('a').kind, 'unread', 'Completion while DSH is in background marks mounted session unread');
    windowFocused = true;
    docTarget.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 45));
    assert.equal(host.row('a').kind, 'idle');

    // Case 2: Subagent `sub-b1` of 4h-old parent `b` runs and completes while user is on `a`.
    status.set(new Map([['sub-b1', { running: true, completionUnread: false }]]));
    assert.equal(host.row('b').kind, 'running');
    assert.equal(host.candidates().includes('b'), true);

    now += 30_000;
    status.set(new Map([['sub-b1', { running: false, completionUnread: true }]]));
    assert.equal(host.row('b').kind, 'unread');
    assert.equal(host.row('b').shortLabel, '新结果');

    // User opens parent `b` for >= dwell (without opening `sub-b1` directly, so `UiSession` keeps `sub-b1` completionUnread: true).
    mounted.set('b');
    await new Promise(r => setTimeout(r, 45));
    assert.equal(host.row('b').kind, 'idle');
    mounted.set('a');
    assert.equal(host.row('b').kind, 'idle', 'parent must not re-latch onto sticky subagent completionUnread after parent was viewed');

    // Case 3: Recurring scheduled task `dailyCheck` created Nov 3 whose `eventSource` ran today at 10:00 AM
    // updates from `11月3日` (`cold`) to `今天 10:00` (`today`), and persists across reload!
    assert.equal(host.row('dailyCheck').shortLabel, '11月3日');
    mounted.set('dailyCheck');
    assert.equal(host.row('dailyCheck').shortLabel, '今天 10:00');
    assert.equal(host.row('dailyCheck').recency, 'today');

    // Case 4: Scheduled task `sched-1` emits status `true -> false` BEFORE `sessions.list` flushes `sched-1` into `byId`,
    // and `UiSession.reconcileStatus` wiped `completionUnread` during the gap.
    mounted.set('a');
    status.set(new Map([['sched-1', { running: true, completionUnread: false }]]));
    status.set(new Map());
    now += 15_000;
    status.set(new Map([['sched-1', { running: false, completionUnread: false }]]));
    list.set({
      ...list.getSnapshot(),
      ids: ['sched-1', 'a', 'b', 'c', 'dailyCheck'],
      byId: {
        ...list.getSnapshot().byId,
        'sched-1': { displayTitle: '定时巡检报告', blank: false, running: false, updatedAt: new Date(now).toISOString() },
      },
    });
    assert.equal(host.row('sched-1').kind, 'unread');
    assert.equal(host.row('sched-1').shortLabel, '新结果');

    // Case 5: Instant post-baseline task session `sched-instant` vs blank `+ 新会话` vs imported old session.
    now += 10_000;
    list.set({
      ...list.getSnapshot(),
      ids: ['sched-instant', 'blank-new', 'imported-old', ...list.getSnapshot().ids],
      byId: {
        ...list.getSnapshot().byId,
        'sched-instant': { displayTitle: '秒级后台任务', blank: false, running: false, updatedAt: new Date(now).toISOString() },
        'blank-new': { displayTitle: '', blank: true, running: false, updatedAt: new Date(now).toISOString() },
        'imported-old': { displayTitle: '三天前导入记录', blank: false, running: false, updatedAt: mins(3 * 1440) },
      },
    });
    assert.equal(host.row('sched-instant').kind, 'unread');
    assert.equal(host.row('blank-new').kind, 'idle');
    assert.equal(host.row('imported-old').kind, 'idle');

    // Reloading the host adapter preserves both `sched-1` unread status and `dailyCheck` today 10:00 timestamp!
    host.destroy();
    const reloaded = createHostAdapter(ctx, { now: () => now, readDwellMs: 35 });
    assert.equal(reloaded.row('sched-1').kind, 'unread');
    assert.equal(reloaded.row('dailyCheck').shortLabel, '今天 10:00');
    reloaded.destroy();
  } finally {
    delete globalThis.document;
    delete globalThis.sessionStorage;
  }
});

test('host follows live ctx.locale / locale/change updates across statuses, fallbacks, and attachment excerpts', () => {
  const localeStore = store({ active: 'zh', revision: 1 });
  const bus = new Map();
  const imgEntry = { event: { type: 'user/message', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'image', source: 'img1' }] } } };
  const sessionA = Object.assign(store({ openState: 'open' }), { eventSource: store({ entries: [imgEntry] }) });
  const sessionB = Object.assign(store({ openState: 'open' }), { eventSource: store({ entries: [] }) });
  const list = store({
    phase: 'ready',
    ids: ['a', 'b'],
    byId: {
      a: { title: '', updatedAt: Date.now() },
      b: { displayTitle: 'Task B', updatedAt: Date.now() },
    },
  });
  const status = store(new Map([['b', { running: false, completionUnread: true }]]));
  const ctx = {
    get: name => (name === 'locale' ? localeStore : undefined),
    sessions: {
      list,
      binding: id => (id === 'a' ? { sessionId: 'a', ctx: {}, session: sessionA } : undefined),
      retain: id => ({ binding: { sessionId: id, ctx: {}, session: sessionB }, ready: Promise.resolve(), release() {} }),
    },
    sidebarRight: { mounted: store('a') },
    uiSession: { sessionStatus: status },
    workspaces: { list: store({ archivedSessionIds: [], items: [] }) },
    conversation: { input: { for: () => ({ state: store({ draft: '' }) }) } },
    theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
    uiWorkspace: { openSession() {} },
    on(event, fn) {
      if (!bus.has(event)) bus.set(event, new Set());
      bus.get(event).add(fn);
      return () => bus.get(event).delete(fn);
    },
  };

  const host = createHostAdapter(ctx);
  const stopPreview = host.preview(['b']);
  assert.equal(host.locale(), 'zh');
  assert.equal(host.row('a').title, '新会话');
  assert.equal(host.row('a').workspaceName, '未分组');
  assert.equal(host.row('a').text, '已发送附件');
  assert.equal(host.row('b').placeholder, '还没有输入');
  assert.equal(host.row('b').shortLabel, '新结果');

  let updates = 0;
  host.subscribe(() => updates++);
  localeStore.set({ active: 'en', revision: 2 });
  assert.ok(updates >= 1);
  assert.equal(host.locale(), 'en');
  assert.equal(host.row('a').title, 'New Session');
  assert.equal(host.row('a').workspaceName, 'Ungrouped');
  assert.equal(host.row('a').text, 'Sent attachment');
  assert.equal(host.row('b').placeholder, 'No input yet');
  assert.equal(host.row('b').shortLabel, 'New result');
  assert.equal(host.row('b').label, 'New result available');

  stopPreview();
  host.destroy();
});
