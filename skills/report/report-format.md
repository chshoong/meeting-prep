# report.md 작성 규칙

`report.md`는 `---`로 둘러싼 YAML 블록의 연속이다. 블록의 첫 키가 종류를 정하고, **순서가 구조**다: `report` → `tab` → `section` → `component` … `text`·`details`·`callout`·`custom`만 닫는 `---` 아래에 본문을 쓴다.

## 블록 경계 (가장 흔한 실수)

본문이 **없는** 블록 뒤에는 `---`가 두 줄 연달아 온다(닫는 줄 + 다음 블록의 여는 줄). 본문이 **있는** 블록은 본문 다음 `---` **한 줄**이 곧 다음 블록의 여는 줄이다.

```
---
component: stats            ← 본문 없음
items:
  - { label: 반복, value: 3회 }
---
---
component: text             ← 본문 있음
---
본문 문단.
---
component: callout          ← 본문 바로 다음 --- 한 줄로 시작 (--- 두 줄 쓰면 오류)
tone: warn
---
주의할 점.
```

부품은 `type:`이 아니라 `component: <종류>`로 시작한다.

## 머리 블록 (맨 앞 1개)

```
---
report:
  kicker: KAMP 제조 AI · 프로젝트 보고서
  title: 불량 예측 모델 비교
  subtitle: 5-fold CV로 고른 구성의 테스트 성능
  pills: [2022–2024 학습, 2025 평가, 조건별 3회 반복]
datasets:
  runs:
    file: assets/results.csv          # 정돈된 긴 표 (한 줄 = 실행 결과 하나)
    dims: [method, scenario]          # 고를 수 있는 조건 열
    labels: { method: 방법, scenario: 시나리오 }
    metrics:
      ap: { label: Test AP, decimals: 3, better: up }
      fp: { label: 오탐 수, decimals: 0, better: down }
---
```

## 탭과 섹션

```
---
tab: results            # 영문 id
title: 결과
---
---
section: 방법별 Test AP
kicker: RESULTS
cycle: 2026-10-06       # 이 섹션을 만들거나 크게 고친 날짜 (강조판은 지난 강조판 이후 날짜의 섹션을 표시)
archived: false         # true면 탭 아래 "이전 결과"로
---
```

## 부품

| component | 필드 |
|---|---|
| `text` | 본문(문단, `- ` 목록, `**보라**`, `==분홍==`, `` `코드` ``) |
| `stats` | `items`(1~4): `label`, `value`, `note`, `delta`, `good` |
| `cards` | `columns`(2/3), `items`(1~6): `title`, `text` |
| `steps` | `items`(2~6): `title`, `text` |
| `chart` | 슬라이드 chart와 같은 필드(`type`, `title`, `categories`/`series` 또는 CSV `data`) 또는 `from` |
| `table` | `columns`/`rows` 또는 `from`, `highlight`(강조 행 번호) |
| `compare` | `dataset`, `dims`, `metrics`, `a`, `b`, `presets`(`label`, `a`, `b`) |
| `filter` | `dataset`, `dims` — 같은 탭의 `from`이 같은 dataset인 chart·table이 따라 바뀜 |
| `details` | `title`, 본문 |
| `callout` | `tone`(info/warn), 본문 |
| `figure` | `image`, `caption` |
| `checklist` | `items`: `status`(done/doing/todo), `text`, `note` |
| `custom` | 본문 HTML·SVG(+ 선택 `<script>`) |

### from

```
from:
  dataset: runs
  x: scenario            # 가로축 또는 표의 행 기준 (dims)
  y: [ap]                # 지표 (metrics)
  by: method             # 계열로 나눌 조건 (선택)
  agg: mean              # mean | median | min | max | sum | count | sd
  show: [mean, sd]       # 표에서만: 여러 통계를 열로
  where: { scenario: S1 }  # 고정 조건 (선택)
```

차트는 계열 4개·항목 12개까지. 넘으면 `by`나 `where`로 줄이거나 표로 보여준다.

### custom

- 색은 CSS 변수(`var(--primary)`, `var(--accent)`, `var(--muted)`, `var(--line)`, `var(--tint)`)를, 상자는 `card` 클래스를 쓴다.
- 외부 주소(`http://`, `https://`, `//`)는 쓰지 못한다(인터넷 없이 열려야 한다).
- 스크립트 안에서 `el`(부품 영역)과 `MP`를 쓸 수 있다: `MP.data('runs')`(데이터셋), `MP.calc.where(rows, cond)`, `MP.calc.summarize(values)`, `MP.chart(el, spec)`.
- 스크립트 오류는 그 부품 안에만 표시된다.

## 주의

- `#`, `:`, 쉼표가 든 값, 숫자처럼 보이는 문자열은 큰따옴표로 감싼다. 특히 표의 `rows: [[...]]` 안에서 쉼표가 든 칸은 반드시 감싼다: `["A, B", "0.43"]`. 칸이 많거나 길면 목록 형식으로 쓴다:
  ```
  rows:
    - ["방법 A", "느림, 정확"]
    - ["방법 B", "빠름"]
  ```
- 본문 안에 `---`만 있는 줄을 쓰지 않는다.
- 그림은 png, jpg, gif. 경로는 `report.md` 기준(`assets/...`).
