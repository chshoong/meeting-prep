# deck.md 작성 규칙 (A 스타일)

`deck.md`는 `deck:` 머리말(선택) 뒤에 슬라이드가 이어진다. 슬라이드마다 `---`로 둘러싼 YAML 머리말로 시작한다. `bullets`만 닫는 `---` 아래에 본문 목록을 쓴다. 본문이 없는 슬라이드는 닫는 `---` 바로 다음 줄에 다음 슬라이드의 여는 `---`가 온다.

## 덱 머리말

```
---
deck:
  brand: KAMP PROJECT          # 오른쪽 위 이름표
  logo: assets/lab-logo.png    # 있으면 이름표 대신
  author: 홍길동
  affiliation: ○○대학교 ○○학과
  date: 2026-10-06
---
```

## 공통 필드

- `layout` (필수), `title` (필수, `**강조**`는 보라색)
- `section`: 위쪽 "● 섹션 이름". 없으면 앞 슬라이드 것을 이어 쓴다. `section` 레이아웃의 제목이 다음 슬라이드들의 섹션이 된다.
- `subtitle`: 제목 아래 회색 한 줄
- `takeaway`: 아래 결론 띠. `**보라**`, `==분홍==`
- `notes`: 발표자 노트

## 레이아웃

| layout | 필드 | 쓰는 곳 |
|---|---|---|
| `title` | `kicker`, `title`, `question`, (`author`, `affiliation`, `date`는 없으면 deck 값) | 첫 장 |
| `section` | `number`("01"), `title`, `subtitle` | 긴 발표의 간지 |
| `chart` | `chart`(아래), `kpis`(0~3개) | 결과 비교 |
| `stats` | `kpis`(2~4개) | 핵심 수치 요약 |
| `cards` | `cards`(2~4개: `title`, `items`, `color`), `flow: true`면 화살표 | 파이프라인, 단계, 방법 |
| `figure` | `image`, `caption`, `note`(오른쪽 해석) | 복잡한 그림 |
| `table` | `columns`, `rows`, `highlight`(강조 행 번호 목록) | 수치 표 |
| `checklist` | `items`: `status`(done/doing/todo), `text`, `note` | 지난 피드백 반영 현황 |
| `compare` | `left`, `right`: `label` + `items` 또는 `image` 또는 `kpis` | 전/후, A vs B |
| `bullets` | 본문 목록 | 다음 계획, 논의할 점 |

`kpis` 항목: `label`, `value`, `delta`(예: `"+0.06"`, `"-18%"`), `good`(`up` 기본, 줄어드는 게 좋은 지표는 `down`).
`color`: `primary`, `violet`, `orange`, `green`, `pink`, `accent` 또는 `#RRGGBB`.

## chart 블록

```
chart:
  type: bar              # bar | hbar | line | scatter
  title: 제품별 Test AP
  categories: [CN7, RG3]
  series:
    - { name: 베이스라인, values: [0.37, 0.30] }
    - { name: 선정 모델, values: [0.43, 0.38] }
```

CSV로:

```
chart:
  type: bar
  data: assets/metrics.csv     # copy-asset으로 복사한 파일
  x: product
  y: [baseline_ap, selected_ap]
  names: [베이스라인, 선정 모델]
```

산점도:

```
chart:
  type: scatter
  data: assets/configs.csv
  x: cv_ap
  y: test_ap
  highlight: { column: selected, value: true, label: 선정 모델 }
  xLabel: CV AP
  yLabel: Test AP
```

- 계열 이름이 "베이스라인", "기존", "기준", "baseline"으로 시작하면 연한 파랑으로 칠한다.
- 계열 4개, 항목 12개, 점 500개까지. 넘으면 이미지로 그려서 `figure`로 넣는다.
- 선택: `yMin`, `xLabel`, `yLabel`, `valueLabels`(막대 기본 true), `decimals`(기본 2).

## 예시

```
---
layout: chart
section: 주요 결과
title: 선정 모델이 **테스트 AP**에서 앞섰다
subtitle: 5-fold CV로 고른 구성을 2025년 테스트셋에 적용
takeaway: "**CV에서 좋은 구성**이 ==테스트에서도== 좋다는 보장은 없었다"
chart:
  type: bar
  title: 제품별 Test AP
  data: assets/metrics.csv
  x: product
  y: [baseline_ap, selected_ap]
  names: [베이스라인, 선정 모델]
kpis:
  - { label: Test AP 평균 향상, value: "+0.07", delta: "21%" }
  - { label: 오탐(FP) 수, value: "84", delta: "-18%", good: down }
---
---
layout: cards
section: 프로젝트 전체 구조
title: 분석 **파이프라인** 요약
flow: true
cards:
  - { title: Data Audit, items: [공식 파일 점검, 스케일링 확인] }
  - { title: Model Selection, items: [LightGBM · RF, 5-fold CV] }
  - { title: Evaluation, color: green, items: [테스트셋 적용, AP · AUC] }
---
---
layout: checklist
section: 지난 미팅 피드백
title: 지난 피드백 **반영 현황**
items:
  - { status: done, text: "#1 베이스라인 추가", note: LightGBM 기본값 }
  - { status: doing, text: "#2 오류 분석" }
---
```

## 주의

- `#`로 시작하는 값, `:`가 들어간 값, 숫자처럼 보이는 문자열(`"68.1"`, `"+4.3"`), `**`나 `==`로 시작하는 값은 큰따옴표로 감싼다.
- 본문 안에 `---`만 있는 줄을 쓰지 않는다.
- 그림은 png, jpg, gif만 된다. `image`, `logo`, `data`는 `deck.md` 기준 상대 경로(`assets/...`).
- 제목은 한 줄, 결론 띠도 한 줄 안에 들어가게 쓴다. 넘치면 렌더러가 경고한다.
