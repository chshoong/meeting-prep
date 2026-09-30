import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// 이 저장소의 ESM 파일(한 줄 import, 이름 있는 export만 사용)을 IIFE 식으로 묶는다.
export function inlineModules(files, names) {
  const body = files.map(f => fs.readFileSync(f, 'utf8')
    .replace(/^import[^;]*;[ \t]*$/gm, '')
    .replace(/^export\s+(?=(?:const|let|function|class|async)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};?[ \t]*$/gm, '')).join('\n');
  return `(() => {\n${body}\nreturn { ${names.join(', ')} };\n})()`;
}

const here = name => fileURLToPath(new URL(`./${name}`, import.meta.url));

export function chartBundleSource() {
  return inlineModules([here('style.js'), here('chart-svg.js')], ['chartSvg', 'chartScale', 'seriesColors']);
}
