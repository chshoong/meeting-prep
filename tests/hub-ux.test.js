import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as hub from '../hub/lib.js';
import { tempDir } from './helpers.js';

function env() {
  const root = tempDir('허브 UX');
  return { root, env: { MEETING_PREP_CONFIG: path.join(root, 'config.json'), MEETING_HUB: path.join(root, '허브') } };
}

test('writeConfig는 기존 설정과 병합, readConfig는 깨진 파일이면 {}', () => {
  const { env: e, root } = env();
  hub.writeConfig({ nudgeMinutes: 45 }, e);
  hub.writeConfig({ hubPath: path.join(root, 'x') }, e);
  assert.deepEqual(hub.readConfig(e), { nudgeMinutes: 45, hubPath: path.join(root, 'x') });
  fs.writeFileSync(e.MEETING_PREP_CONFIG, '{ 깨짐', 'utf8');
  assert.deepEqual(hub.readConfig(e), {});
});

test('initHub는 nudgeMinutes 설정을 지우지 않음', () => {
  const { env: e } = env();
  hub.writeConfig({ nudgeMinutes: 30 }, e);
  hub.initHub(e.MEETING_HUB, e);
  assert.equal(hub.readConfig(e).nudgeMinutes, 30);
});

test('ensureHub: 없으면 만들고, 있으면 그대로', () => {
  const { env: e } = env();
  assert.deepEqual(hub.ensureHub(e), { hubPath: path.resolve(e.MEETING_HUB), createdHub: true });
  assert.ok(fs.existsSync(path.join(e.MEETING_HUB, 'hub.md')));
  assert.deepEqual(hub.ensureHub(e), { hubPath: path.resolve(e.MEETING_HUB), createdHub: false });
});

test('requireHub: NO_HUB 코드', () => {
  const { env: e } = env();
  assert.throws(() => hub.requireHub(e), err => err.code === 'NO_HUB');
});

test('addSource: 작업 폴더 추가, 중복 무시', () => {
  const { env: e, root } = env();
  const { hubPath } = hub.ensureHub(e);
  const a = path.join(root, '프로젝트 A');
  hub.addTrack(hubPath, { name: 'KAMP', type: 'project', sources: [a] });
  const b = path.join(root, '프로젝트 B');
  hub.addSource(hubPath, 'KAMP', b);
  const t = hub.addSource(hubPath, 'KAMP', b);
  assert.deepEqual(t.sources, [a, b]);
  assert.deepEqual(hub.resolveTrack(hubPath, path.join(b, 'src')).map(x => x.name), ['KAMP']);
  assert.throws(() => hub.addSource(hubPath, '없음', b), err => err.code === 'NO_TRACK');
});

test('moveHub: 폴더 이동과 설정 갱신, 대상이 있으면 거부', () => {
  const { env: e, root } = env();
  const { hubPath } = hub.ensureHub(e);
  hub.writeConfig({ nudgeMinutes: 60 }, e);
  const envNoOverride = { MEETING_PREP_CONFIG: e.MEETING_PREP_CONFIG };
  const target = path.join(root, '새 위치', '허브');
  assert.deepEqual(hub.moveHub(hubPath, target, envNoOverride), { hubPath: target });
  assert.ok(fs.existsSync(path.join(target, 'hub.md')));
  assert.equal(fs.existsSync(hubPath), false);
  assert.deepEqual(hub.readConfig(envNoOverride), { nudgeMinutes: 60, hubPath: target });
  fs.mkdirSync(path.join(root, '이미 있음'));
  assert.throws(() => hub.moveHub(target, path.join(root, '이미 있음'), envNoOverride), err => err.code === 'EXISTS');
});

test('findLastLog: 현재 사이클 → 직전 사이클 순서', () => {
  const { env: e } = env();
  const { hubPath } = hub.ensureHub(e);
  const t = hub.addTrack(hubPath, { name: 'T', type: 'project' });
  assert.deepEqual(hub.findLastLog(t.dir, 's'), { cycle: 'next', last: null, lastCycle: null });
  hub.appendLog(t.dir, `${hub.formatLogHeading(new Date(2026, 8, 30, 10, 0), 's')}\n- 한 일: a`);
  hub.closeCycle(t.dir, '# 피드백\n', { today: '2026-09-30' });
  assert.deepEqual(hub.findLastLog(t.dir, 's'), {
    cycle: 'next', last: { timestamp: '2026-09-30 10:00', sessionId: 's' }, lastCycle: '2026-09-30',
  });
});

test('amendLastLog: 이 세션의 마지막 항목 본문만 바꿈', () => {
  const { env: e } = env();
  const { hubPath } = hub.ensureHub(e);
  const t = hub.addTrack(hubPath, { name: 'T', type: 'project' });
  const h1 = hub.formatLogHeading(new Date(2026, 8, 30, 10, 0), 's');
  const h2 = hub.formatLogHeading(new Date(2026, 8, 30, 11, 0), 'other');
  const h3 = hub.formatLogHeading(new Date(2026, 8, 30, 12, 0), 's');
  hub.appendLog(t.dir, `${h1}\n- 한 일: 첫째`);
  hub.appendLog(t.dir, `${h2}\n- 한 일: 다른 채팅`);
  hub.appendLog(t.dir, `${h3}\n- 한 일: 틀린 값 70.0`);
  const r = hub.amendLastLog(t.dir, 's', '- 한 일: 고친 값 72.4\n');
  const text = fs.readFileSync(r.file, 'utf8');
  assert.match(text, /## 이번 사이클 할 일/);
  assert.match(text, /첫째/);
  assert.match(text, /다른 채팅/);
  assert.doesNotMatch(text, /틀린 값/);
  assert.ok(text.endsWith(`${h3}\n- 한 일: 고친 값 72.4\n`));
});

test('amendLastLog: 중간 항목도 뒤 항목과 빈 줄로 분리 유지', () => {
  const { env: e } = env();
  const { hubPath } = hub.ensureHub(e);
  const t = hub.addTrack(hubPath, { name: 'T', type: 'project' });
  const h1 = hub.formatLogHeading(new Date(2026, 8, 30, 10, 0), 's');
  const h2 = hub.formatLogHeading(new Date(2026, 8, 30, 11, 0), 'other');
  hub.appendLog(t.dir, `${h1}\n- 한 일: 원래`);
  hub.appendLog(t.dir, `${h2}\n- 한 일: 다른 채팅`);
  const r = hub.amendLastLog(t.dir, 's', '- 한 일: 고침');
  const text = fs.readFileSync(r.file, 'utf8');
  assert.ok(text.includes(`${h1}\n- 한 일: 고침\n\n${h2}\n- 한 일: 다른 채팅\n`));
});

test('amendLastLog: 이 세션 항목이 없으면 NO_ENTRY', () => {
  const { env: e } = env();
  const { hubPath } = hub.ensureHub(e);
  const t = hub.addTrack(hubPath, { name: 'T', type: 'project' });
  assert.throws(() => hub.amendLastLog(t.dir, 's', '- x'), err => err.code === 'NO_ENTRY');
});
