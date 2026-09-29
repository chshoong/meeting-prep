#!/usr/bin/env node
// 설치본(플러그인 캐시)은 복사본이라, 코드를 고친 뒤 이 스크립트로 다시 설치한다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLUGIN = 'meeting-prep@meeting-prep-local';
const MARKETPLACE = 'meeting-prep-local';

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const defaultOnPath = () => spawnSync('claude', ['--version'], { shell: true, stdio: 'ignore' }).status === 0;

export function findClaude({ env = process.env, platform = process.platform, exists = fs.existsSync, appData = env.APPDATA, onPath = defaultOnPath } = {}) {
  if (env.CLAUDE_BIN) return exists(env.CLAUDE_BIN) ? env.CLAUDE_BIN : null;
  if (onPath()) return 'claude';
  if (platform !== 'win32' || !appData) return null;
  const root = path.join(appData, 'Claude', 'claude-code');
  let versions = [];
  try { versions = fs.readdirSync(root).filter(v => /^\d+(\.\d+)*$/.test(v)); } catch { return null; }
  versions.sort(compareVersions).reverse();
  for (const v of versions) {
    const exe = path.join(root, v, 'claude.exe');
    if (exists(exe)) return exe;
  }
  return null;
}

function main() {
  const claude = findClaude();
  if (!claude) {
    console.error('claude 실행 파일을 찾지 못했습니다. CLAUDE_BIN 환경 변수로 경로를 지정해주세요.');
    process.exitCode = 1;
    return;
  }
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const steps = [
    ['plugin', 'marketplace', 'update', MARKETPLACE],
    ['plugin', 'uninstall', PLUGIN],
    ['plugin', 'install', PLUGIN],
  ];
  for (const args of steps) {
    console.log(`> claude ${args.join(' ')}`);
    const r = spawnSync(claude, args, { cwd: repo, stdio: 'inherit', shell: claude === 'claude' });
    if (r.status !== 0 && args[1] !== 'uninstall') {
      process.exitCode = r.status ?? 1;
      return;
    }
  }
  console.log('다시 설치했어요. 새 세션부터 반영됩니다.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) main();
