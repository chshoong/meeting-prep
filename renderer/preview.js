import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowser, browserFailure } from './pdf.js';
import { W, H } from './style.js';

export async function renderPreviews(htmlPath, outDir, count, browser, { timeoutMs = 60000, spawnImpl } = {}) {
  const dir = path.join(outDir, 'preview');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 1; i <= count; i++) {
    const png = path.join(dir, `slide-${String(i).padStart(2, '0')}.png`);
    const url = `${pathToFileURL(htmlPath).href}?slide=${i}`;
    const r = await runBrowser(browser, [`--screenshot=${png}`, `--window-size=${W},${H}`, '--hide-scrollbars', url], { timeoutMs, ...(spawnImpl ? { spawnImpl } : {}) });
    if (r.timedOut || !fs.existsSync(png)) throw browserFailure(`미리보기 ${i}번 이미지를 만들지 못했습니다`, r, timeoutMs);
    files.push(png);
  }
  return files;
}
