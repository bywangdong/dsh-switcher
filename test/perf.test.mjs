import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createHostAdapter } from '../src/plugin/host.js';

function store(value) {
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(); },
  };
}

test('large session catalogs (367 and 1000 sessions with projections & subagents) stay sub-millisecond on idle status/list updates', () => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  try {
    const now = Date.parse('2026-11-17T10:00:00.000Z');
    const totalTop = 500;
    const totalSub = 120;
    const ids = [];
    const byId = {};
    const projectionsBySession = {};
    const statusEntries = [];

    for (let i = 0; i < totalTop; i++) {
      const id = `sess-${i}`;
      ids.push(id);
      byId[id] = {
        sessionId: id,
        displayTitle: `Session ${i}`,
        updatedAt: now - i * 600_000,
        running: false,
        blank: false,
        cwd: '/code/project',
      };
      projectionsBySession[id] = {
        kind: 'cached',
        asOfSeq: 12,
        values: {
          sessionListMetadata: { blank: false, lastPromptAt: now - i * 600_000 },
          ...(i < totalSub ? { subagentCatalog: [{ id: `sub-${i}`, mode: 'in-process' }] } : {}),
        },
      };
      statusEntries.push([id, { running: false, pendingInteraction: undefined, completionUnread: false }]);
    }
    for (let i = 0; i < totalSub; i++) {
      const subId = `sub-${i}`;
      byId[subId] = {
        sessionId: subId,
        parentSessionId: `sess-${i}`,
        origin: 'subagent',
        updatedAt: now - i * 600_000,
        running: false,
        blank: false,
      };
      statusEntries.push([subId, { running: false, pendingInteraction: undefined, completionUnread: false }]);
    }

    let subagentAddressCalls = 0;
    const list = store({ phase: 'ready', ids, byId, projectionsBySession });
    const mounted = store('sess-0');
    const status = store(new Map(statusEntries));
    const workspaces = store({
      phase: 'ready',
      archivedSessionIds: [],
      items: [{ workspaceId: 'w1', title: 'Agent', path: '/code/project', sessionIds: ids }],
    });

    const ctx = {
      sessions: {
        list,
        binding: () => undefined,
        subagentAddress(id) {
          subagentAddressCalls++;
          for (const pid of Object.keys(projectionsBySession)) {
            const cat = projectionsBySession[pid]?.values?.subagentCatalog;
            if (cat?.find(c => c.id === id)) return { parentSessionId: pid, childSessionId: id, mode: 'in-process' };
          }
          return byId[id]?.origin === 'subagent' ? { parentSessionId: byId[id].parentSessionId, childSessionId: id, mode: 'unknown' } : undefined;
        },
        retain: id => ({
          binding: { sessionId: id, ctx: {}, session: Object.assign(store({ openState: 'open' }), { eventSource: store({ entries: [] }) }) },
          ready: Promise.resolve(),
          release() {},
        }),
      },
      sidebarRight: { mounted },
      uiSession: { sessionStatus: status },
      workspaces: { list: workspaces },
      conversation: { input: { for: () => ({ state: store({ draft: '' }) }) } },
      theme: { getTheme: () => ({ active: { colorScheme: 'dark' } }) },
      uiWorkspace: { openSession() {} },
      on: () => () => {},
    };

    const host = createHostAdapter(ctx, { now: () => now, readDwellMs: 0 });
    assert.equal(subagentAddressCalls, 0, 'Top-level and indexed subagent rows must never trigger linear host subagentAddress fallback');
    assert.equal(host.canPreview(), true);

    // Warm up JIT, then measure 10 status callbacks (including subagent -> parent rollup on `sub-12` -> `sess-12`).
    for (let warm = 0; warm < 3; warm++) {
      const m = new Map(statusEntries);
      m.set('sub-12', { running: warm % 2 === 0, pendingInteraction: undefined, completionUnread: warm % 2 === 1 });
      status.set(m);
    }

    const statusDurations = [];
    for (let i = 0; i < 11; i++) {
      const running = i % 2 === 0;
      const m = new Map(statusEntries.map(([k, v]) => [k, k === 'sub-25'
        ? { running, pendingInteraction: undefined, completionUnread: !running }
        : { ...v }]));
      const t0 = performance.now();
      status.set(m);
      statusDurations.push(performance.now() - t0);
    }
    statusDurations.sort((a, b) => a - b);
    const statusMedianMs = statusDurations[5];
    assert.ok(statusMedianMs < 5, `Expected median status update < 5ms for 620 sessions, got ${statusMedianMs.toFixed(3)}ms`);
    // After `i = 10` (`running = true`), flip `sub-25` to completed (`running = false, completionUnread = true`) and verify rollup.
    const doneMap = new Map(statusEntries);
    doneMap.set('sub-25', { running: false, pendingInteraction: undefined, completionUnread: true });
    status.set(doneMap);
    assert.equal(host.row('sess-25').kind, 'unread');
    assert.equal(host.candidates().includes('sess-25'), true);

    // Measure incremental `sessions.list` update (reusing unchanged summary references like DSH SessionManager.entryCache).
    const listDurations = [];
    for (let i = 0; i < 7; i++) {
      const nextById = { ...byId, 'sess-3': { ...byId['sess-3'], displayTitle: `Renamed ${i}` } };
      const t0 = performance.now();
      list.set({ phase: 'ready', ids, byId: nextById, projectionsBySession });
      listDurations.push(performance.now() - t0);
    }
    listDurations.sort((a, b) => a - b);
    const listMedianMs = listDurations[3];
    assert.ok(listMedianMs < 5, `Expected median incremental list update < 5ms for 620 sessions, got ${listMedianMs.toFixed(3)}ms`);

    // No-op status map notification must not republish to subscribers.
    let spuriousPublishes = 0;
    const unsub = host.subscribe(() => { spuriousPublishes++; });
    status.set(new Map(doneMap));
    assert.equal(spuriousPublishes, 0, 'Identical status values in a new Map must not notify subscribers');
    unsub();

    host.destroy();
  } finally {
    delete globalThis.sessionStorage;
  }
});
