import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck, parseInline, parseList, LAYOUTS } from '../renderer/parse.js';
import { FIXTURES } from './helpers.js';

const sample = fs.readFileSync(path.join(FIXTURES, 'sample-deck.md'), 'utf8');

test('샘플 덱(v1): 7장, 오류 없음, two-column은 compare로', () => {
  const { slides, errors } = parseDeck(sample);
  assert.deepEqual(errors, []);
  assert.deepEqual(slides.map(s => s.layout), ['title', 'checklist', 'bullets', 'figure', 'compare', 'table', 'compare']);
  assert.deepEqual(LAYOUTS, ['title', 'section', 'chart', 'stats', 'cards', 'figure', 'table', 'checklist', 'compare', 'bullets']);
});

test('title: YAML 날짜를 YYYY-MM-DD 문자열로', () => {
  const s = parseDeck(sample).slides[0];
  assert.equal(s.date, '2026-10-06');
  assert.equal(s.question, '주간 연구 미팅');
  assert.equal(s.notes, '오늘은 모듈 B 위주로 말씀드림');
  assert.equal(s.line, 1);
});

test('bullets: 들여쓰기 수준과 본문', () => {
  const s = parseDeck(sample).slides[2];
  assert.deepEqual(s.items, [
    { text: '베이스라인 3종 재실험 (seed 5개)', level: 0, bullet: true },
    { text: '**Ours 72.4** vs Baseline 68.1', level: 1, bullet: true },
    { text: '데이터셋 B에서 OOM 발생 → 배치 축소', level: 0, bullet: true },
  ]);
});

test('two-column과 compare는 같은 left/right 형태', () => {
  const { slides } = parseDeck(sample);
  const tc = slides[4];
  assert.deepEqual(tc.left, { label: '가설 1', image: null, items: [
    { text: '초기 토큰 의존', level: 0, bullet: true },
    { text: '길이에 민감', level: 0, bullet: true },
  ], kpis: [] });
  const cp = slides[6];
  assert.deepEqual(cp.left, { label: '이전', image: null, items: [
    { text: '느림', level: 0, bullet: true },
    { text: '메모리 많음', level: 0, bullet: true },
  ], kpis: [] });
  assert.deepEqual(cp.right, { label: '이후', image: 'assets/plot.png', items: [], kpis: [] });
});

test('table과 checklist', () => {
  const { slides } = parseDeck(sample);
  assert.deepEqual(slides[5].columns, ['모델', '정확도', '비고']);
  assert.deepEqual(slides[5].rows, [['Baseline', '68.1', '기존'], ['Ours', '72.4', '+4.3']]);
  assert.deepEqual(slides[1].items[0], { status: 'done', text: '#1 베이스라인 추가', note: '3종 추가 완료' });
  assert.equal(slides[1].items[1].note, '');
});

test('CRLF와 BOM이 있어도 LF와 같은 결과', () => {
  const crlf = '﻿' + sample.replace(/\n/g, '\r\n');
  assert.deepEqual(parseDeck(crlf), parseDeck(sample));
});

test('parseInline: **굵게**와 ==분홍== 구간 분리', () => {
  assert.deepEqual(parseInline('a **b** c'), [
    { text: 'a ', bold: false, pink: false }, { text: 'b', bold: true, pink: false }, { text: ' c', bold: false, pink: false },
  ]);
  assert.deepEqual(parseInline('x ==y== **z**'), [
    { text: 'x ', bold: false, pink: false }, { text: 'y', bold: false, pink: true },
    { text: ' ', bold: false, pink: false }, { text: 'z', bold: true, pink: false },
  ]);
  assert.deepEqual(parseInline('plain'), [{ text: 'plain', bold: false, pink: false }]);
});

test('parseList: 글머리표가 아닌 줄은 bullet=false', () => {
  assert.deepEqual(parseList('설명 문장\n- 항목'), [
    { text: '설명 문장', level: 0, bullet: false },
    { text: '항목', level: 0, bullet: true },
  ]);
});

test('오류: 알 수 없는 레이아웃', () => {
  const { errors } = parseDeck('---\nlayout: pie\ntitle: x\n---\n');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].slide, 1);
  assert.equal(errors[0].line, 1);
  assert.match(errors[0].message, /가능한 값/);
});

test('오류: YAML 중복 키는 실제 줄 번호로 보고', () => {
  const deck = [
    '---', 'layout: bullets', 'title: 정상', '---', '- a',
    '---', 'layout: table', 'title: a', 'title: b', '---', '',
  ].join('\n');
  const { errors } = parseDeck(deck);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].slide, 2);
  assert.equal(errors[0].line, 9);
});

test('오류: 닫는 --- 없음', () => {
  const { errors } = parseDeck('---\nlayout: bullets\ntitle: x\n');
  assert.match(errors[0].message, /닫는/);
});

test('오류: 표 행의 칸 수 불일치, 체크리스트 상태값, 그림 없는 figure', () => {
  const deck = [
    '---', 'layout: table', 'title: t', 'columns: [a, b]', 'rows:', '  - [1]', '---',
    '---', 'layout: checklist', 'title: c', 'items:', '  - status: finished', '    text: x', '---',
    '---', 'layout: figure', 'title: f', '---', '',
  ].join('\n');
  const { errors } = parseDeck(deck);
  assert.equal(errors.length, 3);
  assert.match(errors[0].message, /1번째 행/);
  assert.match(errors[1].message, /status/);
  assert.match(errors[2].message, /image/);
});

const sampleV2 = fs.readFileSync(path.join(FIXTURES, 'sample-deck-v2.md'), 'utf8');

test('샘플 덱 v2: deck 머리말과 10종 레이아웃', () => {
  const { deck, slides, errors } = parseDeck(sampleV2);
  assert.deepEqual(errors, []);
  assert.deepEqual(deck, { brand: 'KAMP PROJECT', logo: '', author: '홍길동', affiliation: '테스트대학교 통계학과', date: '2026-10-06' });
  assert.deepEqual(slides.map(s => s.layout), ['title', 'section', 'chart', 'stats', 'cards', 'figure', 'table', 'checklist', 'compare', 'bullets']);
  assert.deepEqual(slides.map(s => s.index), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('section 이어받기: section 슬라이드 제목이 뒤로 이어짐', () => {
  const { slides } = parseDeck(sampleV2);
  assert.equal(slides[2].section, '주요 결과');
  assert.equal(slides[5].section, '프로젝트 전체 구조');
  assert.equal(slides[6].section, '프로젝트 전체 구조');
  assert.equal(slides[7].section, '지난 미팅 피드백');
});

test('kpis, cards, table highlight, compare kpis', () => {
  const { slides } = parseDeck(sampleV2);
  assert.deepEqual(slides[2].kpis[2], { label: '오탐(FP) 수', value: '84', delta: '-18%', good: 'down' });
  assert.equal(slides[2].kpis[0].good, 'up');
  assert.equal(slides[4].flow, true);
  assert.deepEqual(slides[4].cards[2], { title: 'Evaluation', color: 'green', items: [
    { text: '2025년 테스트셋', level: 0, bullet: true }, { text: 'AP · AUC · TP/FP', level: 0, bullet: true }] });
  assert.equal(slides[4].cards[0].color, null);
  assert.deepEqual(slides[6].highlight, [2]);
  assert.equal(slides[5].note, '상관이 거의 없다');
  assert.equal(slides[8].right.kpis[0].value, '12분');
  assert.equal(slides[2].takeaway, '**CV에서 좋은 구성**이 ==테스트에서도== 좋다는 보장은 없었다');
});

test('오류: kpis·cards 개수, deck 블록 위치, chart 블록 없음', () => {
  const one = '---\nlayout: stats\ntitle: t\nkpis:\n  - { label: a, value: "1" }\n---\n';
  assert.match(parseDeck(one).errors[0].message, /2~4개/);
  const cards = '---\nlayout: cards\ntitle: t\ncards:\n  - { title: a, items: [x] }\n---\n';
  assert.match(parseDeck(cards).errors[0].message, /2~4개/);
  const lateDeck = '---\nlayout: bullets\ntitle: t\n---\n- a\n---\ndeck:\n  brand: x\n---\n';
  assert.match(parseDeck(lateDeck).errors[0].message, /맨 앞/);
  const noChart = '---\nlayout: chart\ntitle: t\n---\n';
  assert.match(parseDeck(noChart).errors[0].message, /chart 블록/);
  const manyKpi = '---\nlayout: chart\ntitle: t\nchart: { type: bar }\nkpis: [{label: a, value: "1"},{label: b, value: "1"},{label: c, value: "1"},{label: d, value: "1"}]\n---\n';
  assert.match(parseDeck(manyKpi).errors[0].message, /3개까지/);
});
