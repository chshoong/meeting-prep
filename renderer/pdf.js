import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function browserCandidates(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    const roots = [env['PROGRAMFILES(X86)'], env.PROGRAMFILES, env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap(r => [
      path.win32.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.win32.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]);
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
}

export function findBrowser({ env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  if (env.MEETING_PREP_BROWSER) return exists(env.MEETING_PREP_BROWSER) ? env.MEETING_PREP_BROWSER : null;
  return browserCandidates(platform, env).find(p => exists(p)) ?? null;
}


export function runBrowser(browser, args, { timeoutMs = 60000, spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-prep-browser-'));
    const full = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, ...args];
    let child;
    try {
      child = spawnImpl(browser, full, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    } catch (e) {
      fs.rmSync(profile, { recursive: true, force: true });
      reject(e);
      return;
    }
    let stderr = '';
    child.stderr?.setEncoding?.('utf8');
    child.stderr?.on('data', d => { stderr = (stderr + d.toString()).slice(-4096); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* 윈도우에서 잠시 잠겨 있을 수 있음 */ }
    };
    child.on('error', e => { cleanup(); reject(e); });
    child.on('exit', () => { cleanup(); resolve({ stderr, timedOut }); });
  });
}

export function browserFailure(what, { stderr, timedOut }, timeoutMs) {
  const tail = stderr.trim().split(/\r?\n/).slice(-10).join(' / ');
  const reason = timedOut ? ` (시간 초과 ${timeoutMs / 1000}초)` : '';
  return new Error(`${what}${reason}${tail ? `. 브라우저 출력: ${tail}` : ''}`);
}

const sizeOf = file => { try { return fs.statSync(file).size; } catch { return 0; } };

// 윈도우 Edge는 종료된 뒤에 결과 파일을 저장하기도 한다. 파일이 생기고 크기가 멈출 때까지 기다린다.
export async function waitForFile(file, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const until = Date.now() + timeoutMs;
  let last = -1;
  for (;;) {
    const size = sizeOf(file);
    if (size > 0 && size === last) return true;
    last = size;
    if (Date.now() >= until) return size > 0;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

export async function renderPdf(htmlPath, pdfPath, browser, { timeoutMs = 60000, spawnImpl = spawn } = {}) {
  fs.rmSync(pdfPath, { force: true });
  const r = await runBrowser(browser, ['--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { timeoutMs, spawnImpl });
  if (!r.timedOut && await waitForFile(pdfPath)) return pdfPath;
  throw browserFailure('브라우저가 PDF를 만들지 못했습니다', r, timeoutMs);
}
