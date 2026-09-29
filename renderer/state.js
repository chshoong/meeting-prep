import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = '.deck-state.json';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const nameFor = n => (n === 1 ? 'deck.pptx' : `deck-v${n}.pptx`);

function readState(dir) {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(dir, STATE_FILE), 'utf8'));
    return { files: st.files ?? {} };
  } catch {
    return { files: {} };
  }
}

// 생성기가 마지막으로 쓴 내용과 같은 파일만 덮어쓴다. 사용자가 고쳤거나 열려 있으면 다음 번호로 저장한다.
export function writePptxSafely(dir, buffer, { writeFile = fs.writeFileSync, maxVersions = 50 } = {}) {
  const state = readState(dir);
  const warnings = [];
  for (let n = 1; n <= maxVersions; n++) {
    const name = nameFor(n);
    const file = path.join(dir, name);
    if (fs.existsSync(file) && state.files[name] !== sha(fs.readFileSync(file))) {
      warnings.push(`${name}이(가) 직접 수정되어 덮어쓰지 않았습니다`);
      continue;
    }
    try {
      writeFile(file, buffer);
    } catch (e) {
      if (e.code === 'EBUSY' || e.code === 'EPERM') {
        warnings.push(`${name}이(가) 열려 있어 쓸 수 없습니다 (PowerPoint를 닫으면 다음부터 덮어씁니다)`);
        continue;
      }
      throw e;
    }
    state.files[name] = sha(buffer);
    fs.writeFileSync(path.join(dir, STATE_FILE), JSON.stringify(state, null, 2), 'utf8');
    return { file, warnings };
  }
  throw new Error('저장할 수 있는 PPTX 파일 이름을 찾지 못했습니다');
}
