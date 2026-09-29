import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readTranscripts, extractText } from '../hub/transcripts.js';
import { tempDir } from './helpers.js';

function fixture() {
  const root = tempDir('기록');
  const proj = path.join(root, '연구 프로젝트');
  const other = path.join(root, '다른 폴더');
  const pdir = path.join(root, 'projects', 'C--proj');
  fs.mkdirSync(pdir, { recursive: true });
  const line = o => JSON.stringify(o);
  const lines = [
    line({ type: 'user', cwd: proj, sessionId: 's1', timestamp: '2026-09-30T05:00:00.000Z', message: { role: 'user', content: '베이스라인 다시 돌려줘' } }),
    line({ type: 'assistant', cwd: path.join(proj, 'src'), sessionId: 's1', timestamp: '2026-09-30T05:01:00.000Z', message: { content: [{ type: 'thinking', thinking: '생각' }, { type: 'text', text: '결과: 72.4' }] } }),
    line({ type: 'user', cwd: proj, sessionId: 's1', timestamp: '2026-09-30T05:02:00.000Z', message: { content: [{ type: 'tool_result', content: 'ignored' }] } }),
    line({ type: 'user', cwd: proj, sessionId: 's1', timestamp: '2026-09-30T05:03:00.000Z', message: { content: [{ type: 'text', text: '<system-reminder>숨김</system-reminder>좋아' }] } }),
    line({ type: 'attachment', cwd: proj, sessionId: 's1', timestamp: '2026-09-30T05:04:00.000Z' }),
    '{ 깨진 줄',
    'null',
    line({ type: 'user', cwd: 123, sessionId: 's1', timestamp: '2026-09-30T05:10:00.000Z', message: { content: '숫자cwd' } }),
    line({ type: 'user', cwd: {}, sessionId: 's1', timestamp: '2026-09-30T05:11:00.000Z', message: { content: '객체cwd' } }),
    line({ type: 'user', cwd: proj, sessionId: 5, timestamp: '2026-09-30T05:12:00.000Z', message: { content: '숫자세션' } }),
    line({ type: 'user', cwd: proj, sessionId: 's1', timestamp: 'garbage', message: { content: '깨진시각' } }),
    line({ type: 'user', cwd: other, sessionId: 's2', timestamp: '2026-09-30T06:00:00.000Z', message: { content: '다른 프로젝트' } }),
    line({ type: 'user', cwd: proj, sessionId: 's3', timestamp: '2026-09-01T00:00:00.000Z', message: { content: '오래된 대화' } }),
    line({ type: 'user', cwd: proj, sessionId: 'me', timestamp: '2026-09-30T07:00:00.000Z', message: { content: '지금 채팅' } }),
  ];
  fs.writeFileSync(path.join(pdir, 'a.jsonl'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(pdir, 'notes.txt'), 'x');
  return { root: path.join(root, 'projects'), proj };
}

test('extractText: 문자열과 text 블록만', () => {
  assert.equal(extractText('a'), 'a');
  assert.equal(extractText([{ type: 'text', text: 'a' }, { type: 'tool_use' }, { type: 'text', text: 'b' }]), 'a\nb');
  assert.equal(extractText(undefined), '');
});

test('readTranscripts: 경로·기간·세션으로 거르고 도구 결과와 숨김 텍스트는 뺌', () => {
  const { root, proj } = fixture();
  const r = readTranscripts({ root, since: '2026-09-20', paths: [proj], excludeSession: 'me' });
  assert.deepEqual(r.sessions, [{ sessionId: 's1', cwd: proj, count: 3 }]);
  assert.match(r.digest, /사용자: 베이스라인 다시 돌려줘/);
  assert.match(r.digest, /Claude: 결과: 72\.4/);
  assert.match(r.digest, /사용자: 좋아/);
  assert.doesNotMatch(r.digest, /숨김|숫자cwd|객체cwd|숫자세션|깨진시각|ignored|생각|다른 프로젝트|오래된 대화|지금 채팅/);
  assert.equal(r.truncated, false);
});

test('readTranscripts: 글자 수 제한', () => {
  const { root, proj } = fixture();
  const limit = `### session s1 (${proj})\n`.length + 60;
  const r = readTranscripts({ root, since: '2026-09-20', paths: [proj], maxChars: limit });
  assert.equal(r.truncated, true);
  assert.ok(r.digest.length > 0);
  assert.match(r.digest, /사용자:/);
  assert.ok(r.digest.length <= limit);
});

test('readTranscripts: 문자열이 아닌 paths 항목은 무시', () => {
  const { root, proj } = fixture();
  const r = readTranscripts({ root, since: '2026-09-20', paths: [proj, 42, null, ''], excludeSession: 'me' });
  assert.deepEqual(r.sessions, [{ sessionId: 's1', cwd: proj, count: 3 }]);
});

test('readTranscripts: 기록 폴더가 없으면 빈 결과', () => {
  const r = readTranscripts({ root: path.join(tempDir('없음'), 'nope'), paths: ['C:/x'] });
  assert.deepEqual(r, { sessions: [], digest: '', truncated: false, skippedFiles: 0 });
});

function multiFixture() {
  const root = tempDir('기록2');
  const proj = path.join(root, 'p');
  const pdir = path.join(root, 'projects', 'x');
  fs.mkdirSync(pdir, { recursive: true });
  const u = (sid, ts, text) => JSON.stringify({ type: 'user', cwd: proj, sessionId: sid, timestamp: ts, message: { content: text } });
  fs.writeFileSync(path.join(pdir, 'a.jsonl'), [
    u('old', '2026-09-01T00:00:00.000Z', '가장 오래된 메시지'),
    u('mid', '2026-09-10T00:00:00.000Z', '중간 메시지'),
    u('new', '2026-09-20T00:00:00.000Z', '가장 최근 메시지'),
  ].join('\n'), 'utf8');
  return { root: path.join(root, 'projects'), proj };
}

test('readTranscripts: 제한이 작으면 최신 세션을 남기고 오래된 것을 버림, 출력은 시간순', () => {
  const { root, proj } = multiFixture();
  const one = `### session new (${proj})\n`.length + 60;
  const r = readTranscripts({ root, paths: [proj], maxChars: one });
  assert.equal(r.truncated, true);
  assert.match(r.digest, /가장 최근 메시지/);
  assert.doesNotMatch(r.digest, /가장 오래된 메시지/);
  const r2 = readTranscripts({ root, paths: [proj], maxChars: 2 * one });
  assert.match(r2.digest, /중간 메시지[\s\S]*가장 최근 메시지/);
  assert.doesNotMatch(r2.digest, /가장 오래된 메시지/);
});

test('readTranscripts: 다이제스트 시각은 로컬 시간', () => {
  const { root, proj } = multiFixture();
  const r = readTranscripts({ root, paths: [proj] });
  const d = new Date('2026-09-20T00:00:00.000Z');
  const p = n => String(n).padStart(2, '0');
  const want = `[${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}]`;
  assert.ok(r.digest.includes(want), r.digest);
});
