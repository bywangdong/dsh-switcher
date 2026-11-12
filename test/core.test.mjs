import test from 'node:test';
import assert from 'node:assert/strict';
import { readHistory, remember, candidates, SwitchCycle, latestUserInput, hasDraft, sessionPresentation, sessionWorkspaceName, sessionTimestamp, relativeTime, phraseBreaks } from '../src/plugin/core.js';

test('MRU survives malformed storage and only contains unique ids', () => {
  assert.deepEqual(readHistory('{'), []);
  assert.deepEqual(readHistory('["b",null,"a","b",8]'), ['b', 'a']);
  assert.deepEqual(remember(['b', 'a', 'c'], 'a'), ['a', 'b', 'c']);
});
test('candidates follow visits, exclude archives/deletions and do not surface unvisited subagents', () => {
  const snapshot = { ids: ['a', 'b', 'c', 'd', 'child'], byId: {
    a: { updatedAt: 1 }, b: { updatedAt: 9 }, c: { updatedAt: 4 }, d: { updatedAt: 5 }, child: { parentId: 'a', updatedAt: 20 },
  } };
  assert.deepEqual(candidates(snapshot, ['b'], ['a', 'gone', 'c'], 'a'), ['a', 'c', 'd']);
  assert.deepEqual(candidates(snapshot, [], ['a', 'child'], 'a'), ['a', 'child', 'b', 'd', 'c']);
});
test('cycling freezes MRU, wraps both ways, and has no commit side effects', () => {
  const history = ['a', 'b', 'c'];
  const cycle = new SwitchCycle(history, 'a', 1);
  assert.equal(cycle.selected, 'b'); history.unshift('new');
  cycle.step(1); assert.equal(cycle.selected, 'c');
  cycle.step(1); assert.equal(cycle.selected, 'a');
  cycle.step(-1); assert.equal(cycle.selected, 'c');
  assert.equal(new SwitchCycle(['a', 'b', 'c'], 'a', -1).selected, 'c');
  cycle.select('gone'); assert.equal(cycle.selected, 'c');
});
test('unused blank sessions cannot displace real recent conversations', () => {
  const snapshot = { ids: ['current', 'empty', 'real'], byId: {
    current: { blank: true }, empty: { blank: true, updatedAt: 99 }, real: { blank: false, updatedAt: 1 },
  } };
  assert.deepEqual(candidates(snapshot, [], ['empty'], 'current'), ['current', 'real']);
  assert.deepEqual(candidates(snapshot, [], ['empty'], 'current', ['empty']), ['current', 'empty', 'real']);
});
test('an explicitly visited subagent remains reachable even outside the top-level ids', () => {
  const snapshot = { ids: ['a'], byId: { a: {}, child: { parentId: 'a' } } };
  assert.deepEqual(candidates(snapshot, [], ['a'], 'child'), ['child', 'a']);
  assert.deepEqual(candidates(snapshot, [], ['child'], 'a'), ['a', 'child']);
});
test('excerpt is the latest human input, never assistant text or tool output', () => {
  const user = content => ({ event: { type: 'user/message', data: { role: 'user', source: { kind: 'user' }, content } } });
  const entries = [user([{ type: 'text', text: '旧输入' }]), user([{ type: 'text', text: ' 最后\n输入 ' }]),
    { event: { type: 'assistant/message', data: { content: '不显示' } } },
    { event: { type: 'user/message', data: { source: { kind: 'subagent' }, content: '内部消息' } } }];
  assert.equal(latestUserInput(entries), '最后 输入');
  assert.equal(latestUserInput([user([{ type: 'image', source: 'private-path' }])]), '已发送附件');
  assert.equal(latestUserInput([]), '');
  assert.equal(latestUserInput([user('<script>untrusted</script>')]), '<script>untrusted</script>');
});
test('host attention wins over running; unread and draft remain distinct', () => {
  assert.equal(sessionPresentation({ running: true, pendingInteraction: { kind: 'approval' } }, {}, true).label, '等待用户确认，有草稿');
  assert.equal(sessionPresentation({ running: true, completionUnread: true }, {}).kind, 'running');
  assert.equal(sessionPresentation({ running: false }, { running: true }).kind, 'idle');
  assert.equal(sessionPresentation({ completionUnread: true }, {}, true).kind, 'unread');
  assert.equal(sessionPresentation({}, {}, true).kind, 'draft');
  assert.equal(hasDraft({ text: '  ' }), false); assert.equal(hasDraft({ text: '未发送' }), true);
});

test('compact status keeps approval, response and coexisting draft distinguishable', () => {
  assert.equal(sessionPresentation({ pendingInteraction: { kind: 'approval' } }, {}, true).shortLabel, '待确认 · 有草稿');
  assert.equal(sessionPresentation({ pendingInteraction: { kind: 'question' } }, {}).shortLabel, '待回应');
  assert.equal(sessionPresentation({ running: true }, {}, true).shortLabel, '运行中 · 有草稿');
  assert.equal(sessionPresentation({ completionUnread: true }, {}, true).shortLabel, '新结果 · 有草稿');
  assert.equal(sessionPresentation({}, {}).shortLabel, '已就绪');
});

test('recent sessions sort by time whether the host gives ISO strings or epoch numbers', () => {
  const iso = { ids: ['a', 'b', 'c', 'd'], byId: {
    a: { updatedAt: '2026-11-10T08:00:00.000Z' }, b: { updatedAt: '2026-11-12T08:00:00.000Z' },
    c: { updatedAt: '2026-11-11T08:00:00.000Z' }, d: { updatedAt: 'not a date' },
  } };
  assert.deepEqual(candidates(iso, [], [], 'a'), ['a', 'b', 'c', 'd']);
  const at = Date.parse('2026-11-12T08:00:00.000Z');
  assert.equal(sessionTimestamp('2026-11-12T08:00:00.000Z'), at);
  assert.equal(sessionTimestamp(at), at); assert.equal(sessionTimestamp(at / 1000), at);
  assert.equal(sessionTimestamp(String(at)), at); assert.equal(sessionTimestamp(new Date(at)), at);
  for (const value of [undefined, null, '', 'soon', NaN, -5, {}]) assert.equal(sessionTimestamp(value), 0);
});

test('an idle row shows when the session was last updated; other states keep their words', () => {
  const now = new Date(2026, 10, 12, 9, 30).getTime(), ago = minutes => now - minutes * 60000;
  assert.equal(relativeTime(ago(0), now), '刚刚'); assert.equal(relativeTime(ago(-3), now), '刚刚');
  assert.equal(relativeTime(ago(1), now), '1 分钟前'); assert.equal(relativeTime(ago(59), now), '59 分钟前');
  assert.equal(relativeTime(ago(60), now), '1 小时前'); assert.equal(relativeTime(ago(23 * 60 + 59), now), '23 小时前');
  // Past a day the label follows the calendar, not elapsed hours.
  assert.equal(relativeTime(new Date(2026, 10, 11, 9, 0).getTime(), now), '昨天');
  assert.equal(relativeTime(new Date(2026, 10, 10, 23, 50).getTime(), now), '前天');
  assert.equal(relativeTime(new Date(2026, 10, 6, 12, 0).getTime(), now), '6 天前');
  assert.equal(relativeTime(new Date(2026, 10, 5, 12, 0).getTime(), now), '11月5日');
  assert.equal(relativeTime(new Date(2025, 11, 31, 12, 0).getTime(), now), '2025年12月31日');
  assert.equal(relativeTime(undefined, now), ''); assert.equal(relativeTime('无效', now), '');

  const idle = sessionPresentation({}, { updatedAt: new Date(ago(125)).toISOString() }, false, now);
  assert.equal(idle.kind, 'idle'); assert.equal(idle.shortLabel, '2 小时前'); assert.equal(idle.label, '会话已就绪，2 小时前更新');
  assert.equal(sessionPresentation({}, { updatedAt: 'broken' }, false, now).shortLabel, '已就绪');
  assert.equal(sessionPresentation({ running: true }, { updatedAt: ago(125) }, false, now).shortLabel, '运行中');
  assert.equal(sessionPresentation({}, { updatedAt: ago(125) }, true, now).shortLabel, '有草稿');
});

test('title break marks sit only between words and never change the visible text', () => {
  const mark = '\u200b';
  const titles = ['整理本周的发布检查清单', '在窄窗口里验证 Scroll 行为', '修复：登录失败（二次验证）的问题', 'Refine focus restoration', ''];
  for (const title of titles) {
    const marked = phraseBreaks(title);
    assert.equal(marked.split(mark).join(''), title);
    // A line may not start with a lone character, a space or punctuation.
    for (const piece of marked.split(mark).slice(1)) assert.match(piece, /^[\p{L}\p{N}]{2}/u);
    assert.doesNotMatch(marked, /[\s\p{P}]\u200b/u);
  }
  assert.equal(phraseBreaks('Refine focus restoration'), 'Refine focus restoration');
  assert.ok(phraseBreaks('整理本周的发布检查清单').includes(mark));
  assert.equal(phraseBreaks(undefined), undefined);
});

test('workspace title follows authoritative membership and falls back to directory or ungrouped', () => {
  const snapshot = { items: [{ workspaceId: 'w', title: '自定义项目名', path: '/code/old-name', sessionIds: ['a'] }] };
  assert.equal(sessionWorkspaceName(snapshot, 'a', { cwd: '/code/old-name' }), '自定义项目名');
  assert.equal(sessionWorkspaceName(snapshot, 'b', { cwd: '/code/other-project/' }), 'other-project');
  assert.equal(sessionWorkspaceName(snapshot, 'c', { cwd: 'C:\\code\\Windows Project\\' }), 'Windows Project');
  assert.equal(sessionWorkspaceName(snapshot, 'd', {}), '未分组');
  assert.equal(sessionWorkspaceName({ items: [{ title: ' ', path: '/code/fallback/', sessionIds: ['a'] }] }, 'a'), 'fallback');
  assert.equal(sessionWorkspaceName({}, 'a'), '未分组');
});
