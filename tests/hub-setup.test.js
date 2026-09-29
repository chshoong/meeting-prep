import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as hub from '../hub/lib.js';
import { tempDir } from './helpers.js';

function freshEnv() {
  const root = tempDir('허브 테스트');
  return { root, env: { MEETING_PREP_CONFIG: path.join(root, 'config.json') }, hubPath: path.join(root, '미팅 허브') };
}

test('initHub: 폴더 구조, hub.md, 설정 파일', () => {
  const { env, hubPath } = freshEnv();
  const r = hub.initHub(hubPath, env);
  assert.equal(r.created, true);
  for (const d of ['library', '.tmp', 'tracks/research', 'tracks/project']) assert.ok(fs.existsSync(path.join(hubPath, d)), d);
  assert.deepEqual(hub.readKnowledge(hubPath), []);
  assert.equal(hub.getHubPath(env), hubPath);
});

test('initHub는 두 번 불러도 기존 내용을 지우지 않음', () => {
  const { env, hubPath, root } = freshEnv();
  hub.initHub(hubPath, env);
  const wiki = path.join(root, '위키');
  fs.mkdirSync(wiki);
  hub.addKnowledge(hubPath, { type: 'wiki', path: wiki });
  assert.equal(hub.initHub(hubPath, env).created, false);
  assert.equal(hub.readKnowledge(hubPath).length, 1);
});

test('getHubPath: MEETING_HUB 환경 변수가 우선, 설정이 없으면 null', () => {
  const { env, hubPath } = freshEnv();
  assert.equal(hub.getHubPath(env), null);
  assert.equal(hub.getHubPath({ ...env, MEETING_HUB: hubPath }), path.resolve(hubPath));
});

test('requireHub: 허브가 없으면 NO_HUB', () => {
  const { env } = freshEnv();
  assert.throws(() => hub.requireHub(env), e => e.code === 'NO_HUB' && /meeting-init/.test(e.message));
});

test('addKnowledge: 형식 검사, 없는 폴더 거부, 중복 방지', () => {
  const { env, hubPath, root } = freshEnv();
  hub.initHub(hubPath, env);
  const pdfs = path.join(root, '논문 PDF');
  fs.mkdirSync(pdfs);
  assert.throws(() => hub.addKnowledge(hubPath, { type: 'zotero', path: pdfs }), e => e.code === 'BAD_TYPE');
  assert.throws(() => hub.addKnowledge(hubPath, { type: 'pdf', path: path.join(root, '없음') }), e => e.code === 'NOT_FOUND');
  hub.addKnowledge(hubPath, { type: 'pdf', path: pdfs });
  const list = hub.addKnowledge(hubPath, { type: 'pdf', path: pdfs });
  assert.deepEqual(list, [{ type: 'pdf', path: pdfs, exists: true }]);
});

test('readKnowledge: 사라진 폴더는 exists=false', () => {
  const { env, hubPath, root } = freshEnv();
  hub.initHub(hubPath, env);
  const wiki = path.join(root, '위키');
  fs.mkdirSync(wiki);
  hub.addKnowledge(hubPath, { type: 'wiki', path: wiki });
  fs.rmSync(wiki, { recursive: true });
  assert.equal(hub.readKnowledge(hubPath)[0].exists, false);
});

test('addTrack: track.md와 첫 사이클(next/log.md) 생성', () => {
  const { env, hubPath, root } = freshEnv();
  hub.initHub(hubPath, env);
  const src = path.join(root, '프로젝트 A');
  const t = hub.addTrack(hubPath, { name: '논문A', type: 'research', sources: [src] });
  assert.equal(t.dir, path.join(hubPath, 'tracks', 'research', '논문A'));
  assert.ok(fs.existsSync(path.join(t.dir, 'cycles', 'next', 'log.md')));
  const { data } = hub.splitFrontmatter(fs.readFileSync(path.join(t.dir, 'track.md'), 'utf8'));
  assert.deepEqual(data, { name: '논문A', type: 'research', sources: [src] });
  assert.deepEqual(hub.listTracks(hubPath), [{ name: '논문A', type: 'research', dir: t.dir, sources: [src] }]);
});

test('addTrack: 잘못된 종류, 빈 이름, 중복 거부', () => {
  const { env, hubPath } = freshEnv();
  hub.initHub(hubPath, env);
  assert.throws(() => hub.addTrack(hubPath, { name: 'x', type: 'thesis' }), e => e.code === 'BAD_TYPE');
  assert.throws(() => hub.addTrack(hubPath, { name: ' ', type: 'project' }), e => e.code === 'BAD_NAME');
  hub.addTrack(hubPath, { name: '과제B', type: 'project' });
  assert.throws(() => hub.addTrack(hubPath, { name: '과제B', type: 'research' }), e => e.code === 'EXISTS');
});

test('addTrack: 같은 폴더로 매핑되는 이름은 덮어쓰지 않고 EXISTS', () => {
  const { env, hubPath } = freshEnv();
  hub.initHub(hubPath, env);
  const first = hub.addTrack(hubPath, { name: 'a/b', type: 'research', description: '첫 트랙' });
  const file = path.join(first.dir, 'track.md');
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => hub.addTrack(hubPath, { name: 'a:b', type: 'research', description: '둘째' }), e => e.code === 'EXISTS');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('addTrack: 점으로 시작하는 이름 거부', () => {
  const { env, hubPath } = freshEnv();
  hub.initHub(hubPath, env);
  for (const name of ['..', '.', '.숨김']) {
    assert.throws(() => hub.addTrack(hubPath, { name, type: 'project' }), e => e.code === 'BAD_NAME', name);
  }
});

test('addTrack: 윈도우에서는 대소문자만 다른 이름도 EXISTS', { skip: process.platform !== 'win32' }, () => {
  const { env, hubPath } = freshEnv();
  hub.initHub(hubPath, env);
  hub.addTrack(hubPath, { name: '논문a', type: 'research' });
  assert.throws(() => hub.addTrack(hubPath, { name: '논문A', type: 'research' }), e => e.code === 'EXISTS');
});

test('safeName: 경로에 쓸 수 없는 문자 치환', () => {
  assert.equal(hub.safeName('a/b:c?'), 'a-b-c-');
});

test('resolveTrack: 작업 폴더가 원본 경로 안에 있으면 선택', () => {
  const { env, hubPath, root } = freshEnv();
  hub.initHub(hubPath, env);
  const a = path.join(root, '프로젝트 A');
  const b = path.join(root, '프로젝트 B');
  hub.addTrack(hubPath, { name: '논문A', type: 'research', sources: [a] });
  hub.addTrack(hubPath, { name: '과제B', type: 'project', sources: [b, a] });
  assert.deepEqual(hub.resolveTrack(hubPath, path.join(b, 'src')).map(t => t.name), ['과제B']);
  assert.deepEqual(hub.resolveTrack(hubPath, a).map(t => t.name).sort(), ['과제B', '논문A']);
  assert.deepEqual(hub.resolveTrack(hubPath, path.join(root, '프로젝트 AB')), []);
  assert.throws(() => hub.findTrack(hubPath, '없음'), e => e.code === 'NO_TRACK');
});

test('윈도우에서는 대소문자가 달라도 같은 경로', { skip: process.platform !== 'win32' }, () => {
  assert.ok(hub.isInside('C:\\USERS\\x\\proj\\src', 'c:/users/x/proj'));
  assert.ok(hub.samePath('C:\\a\\B\\', 'c:\\a\\b'));
});
