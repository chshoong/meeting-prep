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

export function renderPdf(htmlPath, pdfPath, browser, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'meeting-prep-browser-'));
    fs.rmSync(pdfPath, { force: true });
    const args = [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ];
    const child = spawn(browser, args, { stdio: 'ignore', windowsHide: true });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* 윈도우에서 잠시 잠겨 있을 수 있음 */ }
    };
    child.on('error', e => { cleanup(); reject(e); });
    child.on('exit', () => {
      cleanup();
      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) resolve(pdfPath);
      else reject(new Error('브라우저가 PDF를 만들지 못했습니다'));
    });
  });
}
