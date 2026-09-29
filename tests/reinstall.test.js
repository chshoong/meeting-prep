import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findClaude, compareVersions } from '../scripts/reinstall.js';
import { tempDir } from './helpers.js';

test('compareVersions: 숫자 단위 비교', () => {
  assert.ok(compareVersions('2.1.10', '2.1.9') > 0);
  assert.ok(compareVersions('2.1.9', '2.1.10') < 0);
  assert.equal(compareVersions('2.1.9', '2.1.9'), 0);
});

test('findClaude: CLAUDE_BIN이 우선', () => {
  assert.equal(findClaude({ env: { CLAUDE_BIN: 'X:/c.exe' }, exists: p => p === 'X:/c.exe' }), 'X:/c.exe');
});

test('findClaude: 데스크톱 앱의 가장 높은 버전 claude.exe', () => {
  const appData = tempDir('앱 데이터');
  for (const v of ['2.1.9', '2.1.10']) {
    fs.mkdirSync(path.join(appData, 'Claude', 'claude-code', v), { recursive: true });
    fs.writeFileSync(path.join(appData, 'Claude', 'claude-code', v, 'claude.exe'), '');
  }
  const found = findClaude({ env: {}, platform: 'win32', appData, onPath: () => false });
  assert.equal(found, path.join(appData, 'Claude', 'claude-code', '2.1.10', 'claude.exe'));
});

test('findClaude: PATH에 claude가 있으면 그것', () => {
  assert.equal(findClaude({ env: {}, platform: 'linux', onPath: () => true }), 'claude');
});

test('findClaude: 아무것도 없으면 null', () => {
  assert.equal(findClaude({ env: {}, platform: 'win32', appData: tempDir('빈'), onPath: () => false }), null);
});
