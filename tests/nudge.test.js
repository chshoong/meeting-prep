import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readNudges, recordNudge, checkNudge, nudgeMinutes, nudgeFile, parseLogTimestamp } from '../hub/nudge.js';
import { writeConfig } from '../hub/lib.js';
import { tempDir } from './helpers.js';

const T0 = new Date(2026, 8, 30, 9, 0);
const plus = (d, min) => new Date(d.getTime() + min * 60000);

test('처음 보는 세션은 firstSeen만 기록하고 알림 없음', () => {
  const hubPath = tempDir('제안');
  const r = checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: T0, minutes: 90 });
  assert.deepEqual(r, { due: false, idleMinutes: 0, isNew: true });
  assert.equal(readNudges(hubPath).sessions.s.firstSeen, T0.toISOString());
});

test('90분 전에는 알림 없고, 90분이 지나면 알림', () => {
  const hubPath = tempDir('제안');
  checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: T0, minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 89), minutes: 90 }).due, false);
  const r = checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 95), minutes: 90 });
  assert.equal(r.due, true);
  assert.equal(Math.floor(r.idleMinutes), 95);
});

test('최근 로그가 있으면 그 시각이 기준', () => {
  const hubPath = tempDir('제안');
  checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: T0, minutes: 90 });
  const r = checkNudge({ hubPath, sessionId: 's', lastLogAt: plus(T0, 60), now: plus(T0, 100), minutes: 90 });
  assert.equal(r.due, false);
});

test('shown: 제안 시각이 기준이 됨', () => {
  const hubPath = tempDir('제안');
  checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: T0, minutes: 90 });
  recordNudge(hubPath, 's', 'shown', { now: plus(T0, 95), minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 100), minutes: 90 }).due, false);
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 186), minutes: 90 }).due, true);
});

test('declined: 90분 동안 조용', () => {
  const hubPath = tempDir('제안');
  recordNudge(hubPath, 's', 'declined', { now: T0, minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 89), minutes: 90 }).due, false);
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 91), minutes: 90 }).due, true);
});

test('later: 약 20분 뒤 다시 알림', () => {
  const hubPath = tempDir('제안');
  recordNudge(hubPath, 's', 'later', { now: T0, minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 19), minutes: 90 }).due, false);
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 21), minutes: 90 }).due, true);
});

test('잘못된 action은 BAD_ARGS', () => {
  assert.throws(() => recordNudge(tempDir('제안'), 's', 'maybe'), e => e.code === 'BAD_ARGS');
});

test('깨진 상태 파일은 빈 상태로, 30일 지난 세션은 정리', () => {
  const hubPath = tempDir('제안');
  fs.mkdirSync(path.dirname(nudgeFile(hubPath)), { recursive: true });
  fs.writeFileSync(nudgeFile(hubPath), '{ 깨짐', 'utf8');
  assert.deepEqual(readNudges(hubPath), { sessions: {} });
  recordNudge(hubPath, 'old', 'shown', { now: T0 });
  recordNudge(hubPath, 'new', 'shown', { now: plus(T0, 31 * 24 * 60) });
  assert.deepEqual(Object.keys(readNudges(hubPath).sessions), ['new']);
});

test('nudgeMinutes: 설정값, 없거나 잘못되면 90', () => {
  const root = tempDir('제안');
  const env = { MEETING_PREP_CONFIG: path.join(root, 'config.json') };
  assert.equal(nudgeMinutes(env), 90);
  writeConfig({ nudgeMinutes: 45 }, env);
  assert.equal(nudgeMinutes(env), 45);
  writeConfig({ nudgeMinutes: 'abc' }, env);
  assert.equal(nudgeMinutes(env), 90);
});

test('parseLogTimestamp: 로컬 시각', () => {
  assert.equal(parseLogTimestamp('2026-09-30 14:05').getTime(), new Date(2026, 8, 30, 14, 5).getTime());
  assert.equal(parseLogTimestamp('엉망'), null);
});

test('깨진 세션 항목(null, 배열)은 제거하고 recordNudge는 실패하지 않음', () => {
  const hubPath = tempDir('제안');
  fs.mkdirSync(path.dirname(nudgeFile(hubPath)), { recursive: true });
  fs.writeFileSync(nudgeFile(hubPath), JSON.stringify({ sessions: { a: null, b: [1] } }), 'utf8');
  assert.deepEqual(readNudges(hubPath), { sessions: {} });
  recordNudge(hubPath, 'x', 'shown', { now: T0 });
  assert.equal(readNudges(hubPath).sessions.x.firstSeen, T0.toISOString());
});

test('파싱 불가능한 lastNudge는 firstSeen으로 폴백', () => {
  const hubPath = tempDir('제안');
  const state = {
    sessions: {
      s: { firstSeen: plus(T0, -100).toISOString(), lastNudge: 'garbage', snoozeUntil: null }
    }
  };
  fs.mkdirSync(path.dirname(nudgeFile(hubPath)), { recursive: true });
  fs.writeFileSync(nudgeFile(hubPath), JSON.stringify(state), 'utf8');
  const r = checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: T0, minutes: 90 });
  assert.equal(r.due, true);
});

test('declined 후 later 호출하면 snoozeUntil 해제', () => {
  const hubPath = tempDir('제안');
  recordNudge(hubPath, 's', 'declined', { now: T0, minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 5), minutes: 90 }).due, false);
  recordNudge(hubPath, 's', 'later', { now: plus(T0, 5), minutes: 90 });
  assert.equal(checkNudge({ hubPath, sessionId: 's', lastLogAt: null, now: plus(T0, 26), minutes: 90 }).due, true);
});

test("'constructor' 같은 특수한 세션 id도 작동", () => {
  const hubPath = tempDir('제안');
  const r = checkNudge({ hubPath, sessionId: 'constructor', lastLogAt: null, now: T0, minutes: 90 });
  assert.equal(r.isNew, true);
  assert.equal(readNudges(hubPath).sessions.constructor.firstSeen, T0.toISOString());
});
