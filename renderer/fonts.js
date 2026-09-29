import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../node_modules/pretendard/', import.meta.url));
const FACES = [['Pretendard-Regular.subset.woff2', 400], ['Pretendard-Bold.subset.woff2', 700]];

function findFile(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findFile(p, name);
      if (r) return r;
    } else if (e.name === name) {
      return p;
    }
  }
  return null;
}

let cache = null;

export function fontFaceCss() {
  if (cache !== null) return cache;
  if (!fs.existsSync(ROOT)) return (cache = '');
  cache = FACES.map(([file, weight]) => {
    const p = findFile(ROOT, file);
    if (!p) return '';
    const b64 = fs.readFileSync(p).toString('base64');
    return `@font-face{font-family:'Pretendard';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
  return cache;
}
