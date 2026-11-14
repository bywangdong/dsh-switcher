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
