import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

export function loadImage(src, baseDir) {
  const absPath = path.resolve(baseDir, src);
  const info = { src, absPath, ok: false, width: 0, height: 0, mime: MIME[path.extname(absPath).toLowerCase()] ?? null, data: null };
  if (!info.mime || !fs.existsSync(absPath)) return info;
  try {
    const data = fs.readFileSync(absPath);
    const { width, height } = imageSize(data);
    if (width && height) Object.assign(info, { ok: true, width, height, data });
  } catch {
    // 깨진 그림은 ok=false로 남긴다
  }
  return info;
}

export function resolveImages(slides, baseDir) {
  const warnings = [];
  const load = (src, slide) => {
    const img = loadImage(src, baseDir);
    if (!img.ok) warnings.push({ slide: slide.index, message: `그림을 찾을 수 없거나 지원하지 않는 형식입니다(png, jpg, gif만 가능): ${src}` });
    return img;
  };
  for (const s of slides) {
    if (s.layout === 'figure') s.img = load(s.image, s);
    if (s.layout === 'two-column' || s.layout === 'compare') {
      for (const side of [s.left, s.right]) if (side.image) side.img = load(side.image, s);
    }
  }
  return warnings;
}
